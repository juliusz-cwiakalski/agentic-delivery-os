---
id: chg-GH-241-test-plan
status: Updated
created: 2026-11-07T12:45:00Z
last_updated: 2026-11-07T20:15:00Z
owners: [engineering]
service: delivery-os coordinator supervision (lifecycle decisions, artifact-evidence stuck detection, kill with grace, restart budget, exhaustion escalation, predicate-bound wake)
labels: [cli, supervision, session-lifecycle, state, blockers, harness, process-lifecycle, m1]
version_impact: minor
summary: "M1-S23 coordinator supervision: prove that a coordinator session has the same managed lifecycle lanes already have. The plan pins a new `coordinator` family (start/stop/status/tick) over a pure decision domain and an injected process-lifecycle port; recorded join-live / resume-context / spawn-fresh decisions that survive a supervisor restart and never re-execute closed-out work (SC-M1-25); artifact-evidence stuck detection over digest-consumed, merge, and answer with a sourced-progress prefill-safety veto, no CPU read anywhere, and an `unevaluable` fail-closed path; coordinator single-instance ownership as a durable, append-only **instance lease** carried by `coordinator.fence` records (`acquired`, `released`, `stale-takeover`, `stop-requested`), folded by **ledger sequence** (`recordedAt` descriptive only), claimed as one fenced critical section (`acquireFence` -> re-read the fold and `alive(handle)` -> append one `acquired` or one `stale-takeover` -> `releaseFence`) with `state.lock.busy` mapped to `coordinator.already-running`, liveness-first (**alive=true** refused regardless of age, **alive=false** takeover-eligible, **unknown** age-fallback only past 2x `collection-interval`), single-record takeover (a `stale-takeover` is itself the new acquisition, never followed by `acquired`), and `tick` sharing the same claim/takeover path so a crashed holder is recovered without a separate `start`; `stop` as a recorded request that reports `requested=true`/`released=false` or `not-running` and never releases another process's write-fence handle; a per-append state write fence helper that recovers one age-stale state fence via the delivered `recoverFence` and retries once, else returns `state.lock.busy`/`state.write.failed`, with no `contracts/state.ts` change; foreground-only v1 (`supervisorMode` exactly `foreground`, `detached` reserved and never produced, `externalUnit=absent`, bare `start` is `fallback.invocation` exit 1 naming `--foreground` and the M1-S18 seam); a two-phase `coordinator.stuck` record (`phase=verdict`, `killOutcome=not-attempted` before the kill; `phase=outcome`, same `stuckId` = `iterationId`, after) folded latest-wins by ledger sequence with a replay appending nothing; a state-sourced digest-input fingerprint over the state event-log cursor plus open coordinator-audience question count only; a new turn as a positive `token-delta` or `session-traffic` reading mapped by the adapter, with the sixth key `coordinator.progress-bound` (default 300 000 ms) as the prefill-safety veto; persisted `data.stuck` split from the tick's separate `tickVerdict` (nullable phase/reason/evidence when `progressing`); PID plus process-start-time identity verification before TERM with `killFailureReason=identity-mismatch`; TERM-then-KILL with grace over the recorded process-tree handle only; a durable per-epoch restart budget distinct from lane and economics; exactly one owner-audience decision-needed escalation rendered **first by index** in both `typed-questions` and `blocker-questions`, with up to seven others in rank order and the lowest-ranked displaced and counted as omitted, and idempotent `exhausted-escalated`; a strict isCoordinatorPickup wake (an absent status counts as open) with one persisted wake per question and closed tick-result outcomes; six coordinator config keys with no decision-code literals; six additive coordinator records with STATE_SCHEMA_VERSION unchanged; six coordinator error identities with the exact two-code two-segment allowlist addition; deterministic bounded text and data; performance, privacy, security, idempotency, and non-regression of the delivered status/brief/economics/blockers surfaces. Seventy-two scenarios trace every one of the 48 acceptance criteria of specification v1.3; all DoR iteration-1 findings (RF-01..RF-12, A1/A2/A3/A6) and iteration-2 findings (RF2-01..RF2-12) are resolved, and the implementation plan (`chg-GH-241-plan.yaml`, v1.2, plus its v1.3 revision) maps every TC, so the plan is an executable verification map against fixed contracts."
links:
  change_spec: ./chg-GH-241-spec.md
  implementation_plan: ./chg-GH-241-plan.yaml
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - M1-S23: Coordinator supervision

## 1. Scope and Objectives

This change makes the last unmanaged actor in the M1 end state supervised. The tests must protect eight properties at once, and each one is a structural guarantee, not a behavioural hope. **First, lifecycle decisions are recorded before they are applied**: every evaluation chooses exactly one of `join-live`, `resume-context`, or `spawn-fresh`, persists the decision, session identity, context reading (or its explicit absence), reason, ordinal consumption, and iteration identity, and only then acts; a supervisor restart reads the same truth from durable records and a killed-mid-iteration coordinator resumes or respawns per the last recorded decision without re-executing closed-out phase, merge, or answer artifacts (`AC-F2-1`..`AC-F2-6`, `NFR-7`, `SC-M1-25`). **Second, stuck detection is artifact evidence, never CPU**: three read-only classes (`digest-consumed`, `merge`, `answer`) plus positive sourced session progress as a prefill-safety veto; a `stuck` verdict requires the declared window, no advanced class, no positive progress, and at least one evaluable stale class; all-unknown or an unreadable store is `unevaluable` with no kill and no restart; CPU is not read, structurally or behaviourally (`AC-F3-1`..`AC-F3-4`, `NFR-2`, `NFR-13`, `DEC-4`). **Third, kill is bounded and safe**: TERM, wait `coordinator.kill-grace`, KILL only if the recorded tree is still alive, then `terminated` / `forced` / `failed`; the target is always the recorded session and process-tree handle, never a name, pattern, or shell-interpolated value; a failed kill is `coordinator.session.kill-failed` at exit `2`, never a silent success; before TERM the recorded `pid` plus `processStartTimeMs` identity is verified and a mismatch sends no signal; the kill requires the current instance lease, and the kill-outcome append takes the delivered state write fence for that append only (`AC-F4-1`..`AC-F4-4`, `NFR-10`, `NFR-14`, `RSK-13`). **Fourth, the restart budget is distinct and durable**: per budget epoch under `coordinator/<coordinatorId>`, contiguous ordinals from `1`, torn or gapped means unevaluable (never count `0`), below-bound admits one restart, at/above-bound starts no replacement and refuses with `coordinator.restart-budget-exhausted` at exit `1` plus the history reference, and `start --fresh-budget` opens a new epoch while the old epoch and escalation stay in history (`AC-F5-1`..`AC-F5-5`, `NFR-6`, `NFR-7`). **Fifth, exhaustion is loud and idempotent**: exactly one owner-audience `decision-needed` question with the coordinator-and-epoch ref, count, bound, history, and declared options; reuse of an existing open question rather than a duplicate; the terminal receipt lands only after the question lands; publish failure is `coordinator.escalation.publish-failed` at exit `2` with `exhausted-escalation-failed` visible in status; the digest and brief keep one reserved escalation slot inside the existing eight-question bound, with at most seven other questions and displaced questions still counted as omitted (`AC-F6-1`..`AC-F6-3`, `DEC-5`, `NFR-4`, `NFR-13`). **Sixth, wake is predicate-bound**: strictly `isCoordinatorPickup` (rank 1, open, audience coordinator), one wake per question lifetime deduped on coordinator + question + `askedAt`, only a successful `woken` persisted (and consuming the lifetime) while `already-woken` is a no-op and `answered-before-wake` / `delivery-failed` / `no-pickup` are tick results that append nothing, and a new top question wakes normally (`AC-F7-1`..`AC-F7-6`, `DEC-9`, `NFR-8`). **Seventh, the supervisor regime is shared and single-instance**: a regime descriptor (state-dir scope, unit identity, distinct process kind, distinct budget store, `supervisorMode` exactly `foreground` in v1, `externalUnit` exactly `absent`, M1-S18 seam); coordinator single-instance ownership is a durable append-only **instance lease** folded from `coordinator.fence` records (`acquired`, `released`, `stale-takeover`, `stop-requested`) by **ledger sequence** with the instance identity (`instanceId`, `pid`, `holder`, `startedAt`, `supervisorMode`, `externalUnit`); the claim/takeover is one fenced critical section (`acquireFence` → re-read fold and `alive` → append one `acquired`/`stale-takeover` → `releaseFence`) with claim-time `state.lock.busy` → `coordinator.already-running`; liveness is decided before age (a live holder is refused at any age and remains stoppable; a dead holder is taken over with one `stale-takeover`, never followed by `acquired`; unknown liveness uses the 2×interval fallback); `tick` shares the claim path and recovers a crashed holder; every write takes the delivered state write fence for that append only, with one age-stale `recoverFence` retry, never for the supervisor's lifetime; `stop` is a recorded request, not a remote handle release; and no invented daemon or OS installer exists (`AC-F1-1`..`AC-F1-4`, `AC-F8-1`..`AC-F8-6`, `AC-F10-3`, `DEC-1`, `DEC-6`). **Eighth, the surface is closed and deterministic**: six `coordinator.*` config keys (`stuck-window`, `kill-grace`, `restart-budget`, `resume-context-limit`, `collection-interval`, `progress-bound`) with declared defaults and no decision-code literals; additive coordinator records under `delivery.state.v1` with `STATE_SCHEMA_VERSION` unchanged; six coordinator error identities with the exact two-code two-segment allowlist addition; bounded, ANSI-free text and `delivery.coordinator.v1` `data`; no prompt, transcript, secret, or credential value; no model call; exits only in `{0,1,2}` (`AC-F9-1`, `AC-F10-1`..`AC-F10-5`, `AC-NFR-1`..`AC-NFR-4`).

The plan is deliberately adversarial about the failure modes this story exists to prevent. **False green from a false kill**: a large working session must be vetoed by sourced progress (TC-COORD-033), a CPU-only reading must never classify (TC-COORD-037), and an unknown class must never be fabricated as stale (TC-COORD-034/036). **False kill after PID reuse**: the kill port must verify the recorded `pid` plus `processStartTimeMs` before TERM, and a mismatch must send no signal, record `killFailureReason=identity-mismatch`, and exit `2` (TC-COORD-045). **Silent exhaustion**: the escalation question must render first by index at the cap with the omitted count intact (TC-COORD-063), and a publish failure must be exit `2`, never exit `0` (TC-COORD-062). **Double supervisor or double evaluation**: the instance lease is proven from both sides, the claim is proven atomic (two overlapping claims over two store handles yield exactly one acquisition and one `coordinator.already-running`; TC-COORD-094), a live holder past 2×`collection-interval` is never taken over and can still be stopped (TC-COORD-093), a crashed holder is recovered by `tick` without a separate `start` (TC-COORD-095), and the kill path is proven lease-guarded with a per-append state write fence (TC-COORD-010/015/043). **Wake storm**: a still-top question is `already-woken` with no second record, while a delivery failure still retries (TC-COORD-071/074). **Schema and gate drift**: the coordinator records are additive with the schema version asserted unchanged (TC-COORD-001/083), and the two two-segment codes (`coordinator.already-running`, `coordinator.restart-budget-exhausted`) must join the exact allowlist in both the check and the structure test (set 22→24), with exact totals (TC-COORD-081/082). **Regressing the delivered surfaces**: status/brief goldens change only through the declared reserved-slot rule, and blockers ranking, economics records, lane records, and `ceo-loop.sh` stay untouched (TC-COORD-089).

This document is a verification map, not an execution claim: no command was run against a new implementation at authoring time. Where delivery owns a name (module path, record-kind string, schema id, store-key spelling), the scenario asserts the declared property and names the seam, never a guessed spelling (GAP-T5). The plan is aligned to specification v1.3: every DoR iteration-1 and iteration-2 finding is resolved as a pinned contract — the append-only **instance lease** carried by `coordinator.fence` records with a per-append state write fence (RF-01/RF-05/RF-06/RF-07/A1), now **liveness-first** and claimed as one fenced critical section with single-record takeover and shared `tick` recovery (RF2-01/RF2-02/RF2-03/RF2-06), the two-phase `coordinator.stuck` record folded by ledger sequence with `stuckId = iterationId` (RF-04/RF2-11/RF2-12), the `token-delta`/`session-traffic` new-turn source plus `coordinator.progress-bound` (RF-08/A3), the state-sourced fingerprint over the event-log cursor and open coordinator-question count only (RF-09), `exhausted-escalated` (RF-10), the render-first reserved slot asserted by index (RF-12/A5), PID plus process-start-time verification (A2), absent status counts as open (A6), the six-key config branch, foreground-only v1 (RF2-09), the split `data.stuck`/`tickVerdict` payload (RF2-10), and the per-append state-fence recovery (RF2-07). No assertion is left pending arbitration; the remaining GAP-T2..GAP-T6 markers are declared test-method constraints (§1.2, §8.4). The implementation plan (`chg-GH-241-plan.yaml`, v1.2) maps the 69 v1.2 TCs and its v1.3 revision maps every TC in this plan, so GAP-T1 remains removed and the PLAN-MAP item is closed.

### 1.1 In Scope

- The `coordinator` command family: `start --foreground [--fresh-budget]` (v1 foreground-only; a bare `start` without `--foreground` is `fallback.invocation` exit `1` naming the M1-S18 seam), `stop`, `status [--live]`, `tick`; grammar, single-cycle semantics, the `delivery.coordinator.v1` payload (including the separate `tickVerdict` with nullable phase/reason/evidence when `progressing`), and the `{0,1,2}` exit projection (F-1, F-9; AC-F1-1..AC-F1-4, AC-F9-1; DM-9, DM-11; NFR-4, NFR-12).
- The shared supervisor-regime descriptor and the state-dir single-instance **instance lease**, including the durable `coordinator.fence` records (`acquired`, `released`, `stale-takeover`, `stop-requested`) folded by ledger sequence (`recordedAt` descriptive only), the atomic fenced claim (`acquireFence` → re-read fold and `alive(handle)` → append one `acquired` or one `stale-takeover` → `releaseFence`; `state.lock.busy` → `coordinator.already-running`), liveness-first takeover (live holder refused regardless of age; dead holder takeover-eligible; unknown liveness age-fallback only past 2×`collection-interval`), single-record takeover, `tick` sharing the claim/takeover path to recover a crashed holder, different-state-dir independence, and instance identity folded from the latest lease (`instanceId`, `pid`, `holder`, `startedAt` = acquisition record time, `supervisorMode` exactly `foreground` in v1 with `detached` reserved and never produced, `externalUnit` `absent`) (F-1, F-8; AC-F1-1..AC-F1-4, AC-F8-1..AC-F8-6; DM-8, DM-11; EVT-7; DEC-1, DEC-6).
- The delivered short-lived state write fence used only for the duration of one append, through a per-append helper that calls `fenceStatus`, recovers one age-stale state fence via the delivered `recoverFence` and retries the acquire once, and otherwise returns `state.lock.busy`; a failed append returns `state.write.failed`; no write-fence handle is held across a cycle and no other process's handle is released, with no `contracts/state.ts` change (F-1, F-8; AC-F1-1, AC-F1-3, AC-F8-3, AC-F8-5, AC-F10-3, AC-F10-4; DM-11).
- The pure join-or-resume-or-spawn decision domain and its durable records, including every reason and ordinal rule, decision-before-action ordering, crash recovery, and non-re-execution of closed-out work (F-2; AC-F2-1..AC-F2-6; DM-1, DM-2; DEC-7).
- Artifact-evidence stuck detection over the three classes, the state-sourced digest-input fingerprint (event-log cursor plus open coordinator-audience question count only), the `token-delta`/`session-traffic` new-turn source, the `coordinator.progress-bound` prefill-safety corroborator, the full advanced/stale/unknown matrix, torn/unreadable classification, the two-phase stuck record, and the unevaluable fail-closed path (F-3; AC-F3-1..AC-F3-4; DM-3; DEC-4; NFR-1, NFR-2, NFR-9, NFR-13).
- Kill with grace over the injected process-lifecycle port, including the fake-clock TERM/KILL sequence, `terminated`/`forced`/`failed`, handle-only targeting, pre-TERM `pid` + `processStartTimeMs` identity verification (mismatch → no signal, `killFailureReason=identity-mismatch`), no shell interpolation, and the instance-lease guarantee with a per-append state write fence (F-4; AC-F4-1..AC-F4-4; DM-3, DM-7; NFR-10, NFR-14; RSK-13).
- The durable per-epoch restart budget, contiguous ordinals, below/at/above-bound behaviour, replayed ordinal idempotency, crash durability, `--fresh-budget`, and the distinct namespace (F-5; AC-F5-1..AC-F5-5; DM-2; DEC-8; NFR-6, NFR-7).
- Owner-brief exhaustion escalation: exactly one owner-audience `decision-needed` question, idempotent reuse with `exhausted-escalated`, terminal receipt ordering, publish-failure exit `2` with `exhausted-escalation-failed`, and the reserved escalation slot rendered **first by index** in both `typed-questions` and `blocker-questions` inside the declared eight-question bound, selected from the payload alone by the payload-only predicate (`type=decision-needed` AND `audience=owner` AND `lane=coordinator` AND `ref` shape `<coordinatorId>#<budgetEpochId>`), with up to seven others in rank order, the lowest-ranked displaced and counted as omitted, and no new anchor, section, type, or read (F-6; AC-F6-1..AC-F6-3; EVT-6; DM-4; DEC-5; NFR-4, NFR-13).
- Predicate-bound wake: strict `isCoordinatorPickup` (an absent status counts as open), one wake per question lifetime persisted only on a successful `woken`, `already-woken` as a no-op, `answered-before-wake`/`delivery-failed`/`no-pickup` as tick results that append no record, live-wake/resume/spawn paths, retry after delivery failure, and the next-new-top-question case (F-7; AC-F7-1..AC-F7-6; DM-5; DEC-9; NFR-8).
- The `coordinator` config branch: six keys (`stuck-window`, `kill-grace`, `restart-budget`, `resume-context-limit`, `collection-interval`, `progress-bound`), declared defaults and domains, unknown-key and invalid-value identities, boundary values (`restart-budget` 0, window/interval/progress-bound 1 ms), and no default or bound literal in decision code (F-10; AC-F10-1; DM-6; DEC-10).
- The additive coordinator state records: six record kinds (iteration, restart, two-phase stuck, exhaustion, wake, fence), schema/kind/required-field/vocabulary validation, identifier and instance-identity fields, ordinal contiguity, latest-wins stuck fold, permission-denied projection, no migration, no separate instance record, and the unchanged state schema version (F-10; AC-F10-3; DM-1..DM-5, DM-11; DEC-12; NFR-13).
- The `coordinator` error domain kind and six identities, the exact reserved two-segment allowlist addition of `coordinator.already-running` and `coordinator.restart-budget-exhausted` (set 22→24; table 99→105; the other four are three-segment), two-way documented sync, true/false-positive corpora, and total `{0,1,2}` projection (F-10; AC-F10-2; DM-10; DEC-11; NFR-12).
- Deterministic, bounded, ANSI-free observation: byte-identical `data` and text for identical state, config, and injected facts; no ambient clock, randomness, or environment; 64 KiB machine and 32 human-line bounds; at most one verified read per store per tick (F-9; AC-NFR-1, AC-NFR-4; NFR-1, NFR-4, NFR-5).
- Privacy, security, and idempotency: zero prompt/transcript/secret/credential values, bounded `key=value` evidence at ≤ 512 UTF-8 bytes, handle-only kill, same-user trust unchanged, and no duplicate record or destructive action on replay (AC-NFR-1..AC-NFR-3; NFR-6, NFR-11, NFR-14).
- Non-regression of the delivered status digest, brief, blockers ranking, economics, lane records, and `ceo-loop.sh`, with only the declared reserved-slot rendering rule as a permitted change (AC-NFR-1; NFR-15; AC-F10-5).
- The `ceo-loop.sh` function-map trace and the SC-M1-25 end-to-end reconciliation (AC-F10-5; Appendix A; Appendix C).

### 1.2 Out of Scope & Known Gaps

- [OUT] A `daemon` command, control socket, lane supervision, startup reconciliation, resident daemon process, or any OS supervisor unit installer — NG-1, M1-S18. This plan tests the regime descriptor, the instance lease, and the M1-S18 seam; it starts no daemon and installs no unit.
- [OUT] A `dispatch` command, spawn loop, dual-run evidence, or per-repo handover — NG-2, M1-S9.
- [OUT] Agent-prompt or lifecycle-instruction changes — NG-3, M1-S20.
- [OUT] Queue scheduling, merge execution, closeout mechanics, board expansion, or status-collector redesign — NG-4, NG-10.
- [OUT] A new status-digest section, a new brief anchor, or a new typed-question type — NG-7. The only digest/brief change is the reserved escalation slot inside the existing `typed-questions`/`blocker-questions` surfaces.
- [OUT] CPU-based liveness, CPU sampling, CPU thresholds, or any CPU-derived value in the decision path — NG-5, NFR-2.
- [OUT] Any model call in a deterministic decision, status, or render path — NG-6, NFR-3.
- [OUT] Reuse of `lane.restart-budget`, `lane.liveness-interval`, or `economics/<workItemRef>` for the coordinator — NG-8. Tests assert the namespaces are distinct and the lane/economics records unchanged.
- [OUT] Multi-coordinator, multi-host, or remote supervision — §7.2. One coordinator per state-dir scope.
- [OUT] Automatic application of the owner's exhaustion answer — §7.2. The owner decision is a manual `stop` + `start --fresh-budget` or a future daemon/queue path.
- [OUT] OS autostart behaviour — RSK-4. Declared and tested as a gap naming M1-S18, never as an invented installer.
- [PINNED — v1.3 observables] The instance lease is the latest `coordinator.fence` record action folded by **ledger sequence** (`recordedAt` descriptive only); there is no separate instance record kind or payload. The claim/takeover is one fenced critical section: `acquireFence` → re-read the fold and `alive(handle)` → append one `acquired` (released/absent) or one `stale-takeover` (dead holder) → `releaseFence`; `state.lock.busy` maps to `coordinator.already-running`; no interleaving produces two `acquired` records. A live holder is refused regardless of lease age; a dead holder is takeover-eligible; unknown liveness uses the 2×`collection-interval` age fallback only. A `stale-takeover` is itself the new acquisition and is never followed by a second `acquired`. `tick` shares the same claim/takeover path and therefore recovers a crashed holder without a separate `start`; a quiet tick appends exactly one lease pair and no action record. `stop` appends `stop-requested` and reports `requested=true`/`released=false` (or `not-running` when the lease is `released`, the holder is dead, or liveness is unknown and age > 2×interval); the live supervisor appends `released` at the next cycle boundary. Every append uses the per-append state write fence helper (one age-stale `recoverFence` + one retry on `state.lock.busy`, else the delivered `state.lock.busy`/`state.write.failed`), and no `contracts/state.ts` change is needed. `coordinator.stuck` is two-phase under one `stuckId` = the active expectation's `iterationId` (`phase=verdict` with `killOutcome=not-attempted` before the kill, `phase=outcome` after) folded latest-wins by ledger sequence; a replay appends nothing. A new turn is a positive `token-delta` OR a positive `session-traffic` reading from the delivered harness liveness facts, mapped at the adapter; an absent reading is `unknown`; `coordinator.progress-bound` defaults to 300 000 ms. `data.stuck` is the last persisted verdict with non-null phase/reason/evidence (or null); the tick result carries a separate `tickVerdict` whose phase/reason/evidence are nullable when `progressing`. The escalation state is `exhausted-escalated` (no `escalated`). The reserved escalation question renders first by index in both `typed-questions` and `blocker-questions`; the other seven follow in rank order and the lowest-ranked is displaced and counted as omitted. A recorded `pid` plus `processStartTimeMs` mismatch sends no signal, records `killFailureReason=identity-mismatch`, and exits `2`. An absent question `status` counts as open. In v1 `supervisorMode` is exactly `foreground`; `detached` is a reserved closed value never produced, `externalUnit` is exactly `absent`, and the supervisor records its own pid/process start time; a bare `start` is `fallback.invocation` exit `1`. TC-COORD-093/094/095 plus the updated TCs assert these directly.
- [GAP-T2 — no scheduler in v1] This change ships `tick` and a foreground loop, not a resident scheduler. NFR-8 and NFR-9 are asserted with v1 semantics: the **next `tick` after the qualifying condition produces exactly one wake** (the question becoming rank 1) or **exactly one verdict** (the window elapsing). The supervisor's own loop ticks at `coordinator.collection-interval`; a caller ticking slower is caller-bounded and does not violate the policy. No resident scheduler and no wall-clock timer is started, and cadence is not measured; an injected clock drives the fixtures.
- [GAP-T3 — absences are proven by three observations] "Not re-executed", "no CPU read", "no model call", and "no destructive action" are absences. Each is proven by (i) the capability/port not existing on the evaluated surface, (ii) zero recorded invocations in a recording fake, and (iii) zero state mutation, plus a structural scan or mutant where a source-level proof exists. A single passing behavioural assertion is never accepted as proof of an absence.
- [GAP-T4 — process-boundary durability at the store boundary] Supervisor-crash durability is proven by closing the writer handle and reopening a **fresh store handle** over the same temp root, not by a second OS process, unless delivery adds a bounded child process cheaply. No sleeps and no flake surface.
- [GAP-T5 — delivery-bound names] Module paths, export names, record-kind strings, schema ids, store-key spellings, field spellings not pinned by the spec, and human labels are delivery-bound. Behaviour, identities, exits, closed vocabularies, ordering rules, bounds, and AC traceability are not. A test that cannot resolve a seam must fail naming the missing contract, never skip silently.
- [GAP-T6 — performance measurement method] `tick` p95 ≤ 2 000 ms and `status` p95 ≤ 1 000 ms are measured over a synthetic reference store on the reference host with an injected clock (no real sleeping), recording the environment and iteration count in test output. The bound is never silently relaxed; a timing test that cannot be made deterministic in CI is marked `Semi-automated` with a manual gate, not deleted.
- [PLAN-MAP — satisfied] The implementation plan (`chg-GH-241-plan.yaml`, v1.2) maps all 69 v1.2 TCs exactly once, including TC-COORD-018, TC-COORD-029, and TC-COORD-045; its v1.3 revision maps the full v1.3 TC set, including the three new TCs TC-COORD-093/094/095. The plan.md SC-M1-25 table uses the same single-phase map. No TC is unmapped and no assertion is deferred to delivery.
- [PINNED — exact two-segment allowlist] Exactly two coordinator identities are two-segment: `coordinator.already-running` and `coordinator.restart-budget-exhausted`. Both join `RESERVED_TWO_SEGMENT_CODES` in `scripts/checks/error-table-sync.ts` and `tests/structure/error-table.test.ts`, taking the set from 22 to 24 and the table from 99 to 105 entries; the other four coordinator identities are three-segment. No `coordinator.*` wildcard and no generic two-segment widening. TC-COORD-081/082 assert the exact values and a near-miss rejection.

## 2. References

- **Change specification**: [chg-GH-241-spec.md](./chg-GH-241-spec.md) — specification v1.3; F-1..F-10, **48 ACs** (AC-F1-1..AC-F1-4, AC-F2-1..AC-F2-6, AC-F3-1..AC-F3-4, AC-F4-1..AC-F4-4, AC-F5-1..AC-F5-5, AC-F6-1..AC-F6-3, AC-F7-1..AC-F7-6, AC-F8-1..AC-F8-6, AC-F9-1, AC-F10-1..AC-F10-5, AC-NFR-1..4), DM-1..DM-11, EVT-1..EVT-7, NFR-1..NFR-15, RSK-1..RSK-14, DEC-1..DEC-13, §6 flows 1–8, §10 telemetry, §25 document history, Appendix A (`ceo-loop.sh` function map), Appendix B (closed vocabularies incl. lease liveness states), Appendix C (SC-M1-25), Appendix D (config defaults incl. `coordinator.progress-bound`), Appendix E (record shapes, including the four-action `coordinator.fence` instance lease with `stuckId = iterationId` and the two-phase `coordinator.stuck`), Appendix F (exit matrix incl. `identity-mismatch` and `state.lock.busy`/`state.write.failed`), Appendix G (command grammar and output shapes incl. the split `data.stuck`/`tickVerdict`), Appendix H (ticket traceability).
- **Implementation plan**: [chg-GH-241-plan.yaml](./chg-GH-241-plan.yaml) — `delivery.plan.v1`, 10 phases, with the TC→phase map and the plan's pinned-contract acknowledgement; v1.2 maps all 69 v1.2 TCs and its v1.3 revision maps the full v1.3 set (including TC-COORD-093/094/095). The YAML is authoritative when both plan formats exist.
- **PM record**: [chg-GH-241-pm-notes.yaml](./chg-GH-241-pm-notes.yaml) — context only: the six clarify-scope findings, the decision routing, and the spec-completion note. The specification is the source of truth.
- **Seed scenario**: [test-scenarios.md](../../../planning/oss-tooling/milestones/m1/test-scenarios.md) — SC-M1-25 (M1-S23 coordinator supervision lifecycle), reconciled in §3.4.
- **Testing strategy**: [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) — `bun:test` under `tests/**/*.test.ts`; fixtures never named `*.test.ts`; suites under `tests/{structure,types,behaviour,conformance,golden,checks,boundaries}`; permanent suites assert the current tree, never a moving base branch; goldens regenerate only by an explicit command; `pnpm check` is the aggregate gate.
- **TypeScript rules**: [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md) — strict typing; injected clock/randomness/environment; data-only contracts; pure domain; adapters own I/O; the error contract; injected fakes over `mock.module`; exact optional-property modelling.
- **Delivered error table and result contract**: `packages/core/src/contracts/error-table.ts` (`DOMAIN_KINDS`, `ERROR_TABLE`, `EXACT_CODE_DOMAIN_KINDS`), `packages/core/src/contracts/result.ts`, `scripts/checks/error-table-sync.ts`, `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts`, `tests/fixtures/result/code-corpora/**`, [feature-result-contract.md](../../../spec/features/feature-result-contract.md).
- **Delivered state layer**: `packages/core/src/contracts/state.ts` (`STATE_SCHEMA_VERSION = "delivery.state.v1"`, failure identities), `packages/core/src/state/artifact-boundary.ts`, `packages/core/src/state/index.ts` (`acquireFence`/`releaseFence` handle-scoped, `recoverFence` only age-stale), `packages/core/src/state/blockers.ts` (`appendBlockerQuestion` acquires and releases its own fence), `packages/core/src/state/economics.ts` (the closest additive-record pattern), `tests/fixtures/state/harness.ts`, [feature-state-layer.md](../../../spec/features/feature-state-layer.md). The delivered write fence is a short-lived, handle-scoped lock: a coordinator append takes it for that one append only, and the escalation publish composes with the delivered blocker append path without a handle-reusing refactor.
- **Delivered configuration layer**: `packages/core/src/config/{catalog,defaults,resolver,schema,provenance}.ts` (`PRODUCTION_CATALOG`, `LANE_BRANCH` pattern, `config.key.unknown`/`config.value.invalid`), `tests/behaviour/config-*.test.ts`, [feature-config-layer.md](../../../spec/features/feature-config-layer.md).
- **Delivered blocker channel and pickup predicate**: `packages/core/src/contracts/blockers.ts` (`BLOCKER_QUESTION_TYPES`, `BLOCKER_AUDIENCES`, `BLOCKER_PRIORITY_BY_TYPE`, `BLOCKER_QUESTION_RECORD_KIND`), `packages/core/src/domain/blockers.ts` (`rankBlockerQuestions`, `isCoordinatorPickup`), `packages/core/src/state/blockers.ts`, `tests/fixtures/blockers/**`, `tests/behaviour/blockers-*.test.ts`, [feature-blockers.md](../../../spec/features/feature-blockers.md).
- **Delivered status digest and brief**: `packages/core/src/domain/status.ts` (`typedQuestionsSection`, `STATUS_MAX_ITEMS_PER_SECTION = 8`), `packages/core/src/domain/brief.ts` (`blockerQuestions`), `packages/core/src/contracts/status.ts` (`STATUS_MAX_ITEMS_PER_SECTION`, `STATUS_MAX_HUMAN_LINES = 32`, `STATUS_MAX_MACHINE_BYTES = 65536`), `tests/golden/{status-digest,brief}.test.ts`, `tests/fixtures/{status,brief}/**`, [feature-status-digest.md](../../../spec/features/feature-status-digest.md), [feature-brief.md](../../../spec/features/feature-brief.md).
- **Delivered session-lifecycle economics (consumed, never reused)**: `packages/core/src/contracts/economics.ts`, `packages/core/src/domain/economics-{budget,evidence,resume,view}.ts`, `packages/core/src/state/economics.ts`, `tests/behaviour/economics-*.test.ts`, [feature-session-lifecycle-economics.md](../../../spec/features/feature-session-lifecycle-economics.md).
- **Delivered harness seam**: `packages/core/src/contracts/harness.ts` (`HarnessCapability`, `HarnessCapabilityDeclaration`, `HarnessSessionPort`, `harness.capability.gap`), `packages/core/src/domain/harness-{capability,liveness,canonical,registry}.ts`, `packages/adapters/src/harness/{opencode,claude}.ts`, `packages/testkit/src/conformance/harness.ts`, [feature-harness-adapters.md](../../../spec/features/feature-harness-adapters.md).
- **Delivered CLI edge and command definitions**: `packages/cli/src/edge.ts`, `packages/cli/src/commands/{index,blockers,status,brief,watchdog}.ts`, `packages/cli/src/index.ts`; command-registry and man-page rows in [cli-command-registry.md](../../../planning/oss-tooling/cli-command-registry.md), [m1/contracts.md](../../../planning/oss-tooling/milestones/m1/contracts.md), [m1/man-page.md](../../../planning/oss-tooling/milestones/m1/man-page.md).
- **Invariants and boundaries**: `scripts/checks/{error-table-sync,forbidden-literals,ambient-globals,secret-read-boundary,workspace-entrypoints}.ts`, `.dependency-cruiser.cjs`, `tests/boundaries/**`, `tests/structure/{content-inventory,subpaths,error-table,state-contract,config-contract,status-contract,brief-contract,blockers-contract}.test.ts`.
- **Ticket**: GitHub issue `juliusz-cwiakalski/agentic-delivery-os#241` — M1-S23: Coordinator supervision.
- **Decision records referenced by the spec**: TDR-0013 (supervision architecture, shared regime, process port, lifecycle decision, wake policy), TDR-0014 (artifact-evidence stuck detection, owner-brief exhaustion escalation), ODR-0003 (naming-surface rules; DEC-2 is registry-only).

## 3. Coverage Overview

All 48 acceptance criteria map to at least one named scenario; there are no TODO or uncovered ACs. Every TC names at least one AC, NFR, DEC, or the seed scenario. SC-M1-25 is reconciled clause by clause in §3.4. Specification v1.3 resolves the DoR iteration-1 findings (RF-01..RF-12, A1/A2/A3/A6) and the iteration-2 findings (RF2-01..RF2-12), so every assertion below targets a fixed contract.

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Description (abbreviated) | TC ID(s) | Status |
|-------|---------------------------|----------|--------|
| AC-F1-1 | `start --foreground` claims the instance lease as one fenced critical section and appends one `coordinator.fence` record with `action=acquired`, `instanceId`, `holder` (the supervisor's own pid + process start time), `supervisorMode=foreground`, `externalUnit=absent`, reports `running`, and status reports the instance; a second start is `coordinator.already-running` exit `2` with the holder named; a bare `start` without `--foreground` is `fallback.invocation` exit `1`; no state write fence is held beyond the lease append | TC-COORD-003, TC-COORD-010, TC-COORD-016, TC-COORD-018, TC-COORD-094 | Covered |
| AC-F1-2 | `tick` on a state dir with no live holder claims the lease through the same atomic path as `start` — one `acquired` when released/absent, one `stale-takeover` when the holder is dead — performs exactly one bounded collection cycle, appends one `released`, and returns `delivery.coordinator.v1` data with the instance, decision, wake, stuck, tick verdict, restart, and escalation fields; it starts no background loop; a quiet cycle appends exactly that lease pair and no action record; a tick contended with a live holder is the AC-F8-1 refusal | TC-COORD-003, TC-COORD-012, TC-COORD-017, TC-COORD-095 | Covered |
| AC-F1-3 | `stop` appends one `coordinator.fence` `action=stop-requested` record and reports `requested=true`, `released=false` without claiming `released=true`; the live supervisor observes it at the next cycle boundary, stops, and appends `action=released`; when the latest lease is `released`, or its recorded holder is not alive, or `alive` is unknown and the lease age exceeds two `collection-interval`s, `stop` reports `not-running` at exit `0` with nothing appended; a live holder is never treated as `not-running` because of lease age; `stop` never releases another process's state write fence handle | TC-COORD-003, TC-COORD-011, TC-COORD-017, TC-COORD-018, TC-COORD-093 | Covered |
| AC-F1-4 | The instance identity is folded from the latest `coordinator.fence` lease record by ledger sequence — `instanceId`, `pid`, `holder`, `startedAt` (the instance's acquisition record time, `acquired` or `stale-takeover`), `supervisorMode` (`foreground` in v1; `detached` reserved and never produced in v1), and `externalUnit` (`absent`) — and no separate instance record kind or payload exists | TC-COORD-013, TC-COORD-018 | Covered |
| AC-F2-1 | A live session records `join-live`, consumes no ordinal, and spawns/resumes nothing | TC-COORD-020, TC-COORD-026, TC-COORD-091 | Covered |
| AC-F2-2 | A resumable unclean session with known context below the limit records `resume-context`, consumes one ordinal, resumes without re-paying prefill | TC-COORD-021, TC-COORD-026, TC-COORD-091 | Covered |
| AC-F2-3 | `spawn-fresh` with `context-pressure` / `context-unknown` / `session-interrupted` consumes exactly one ordinal; an undeclared or unavailable harness resume selects `session-interrupted` with no error identity | TC-COORD-022, TC-COORD-026, TC-COORD-091 | Covered |
| AC-F2-4 | A mid-iteration kill resumes or respawns per the recorded decision; closed-out phase/merge/answer artifacts remain and are not re-executed | TC-COORD-024 | Covered |
| AC-F2-5 | The recorded decision and ordinal survive a supervisor restart and are reported by status | TC-COORD-025 | Covered |
| AC-F2-6 | `spawn-fresh` with `initial-start` / `clean-iteration-end` consumes no ordinal | TC-COORD-012, TC-COORD-023, TC-COORD-026 | Covered |
| AC-F3-1 | Window elapsed, no class advanced, no positive progress, ≥1 evaluable stale class → `stuck` verdict with closed reason `stuck-artifact-evidence` recorded as one append with `phase=verdict`, `killOutcome=not-attempted`, and bounded evidence; the fingerprint inputs are the state event-log cursor and open coordinator-audience question count only | TC-COORD-029, TC-COORD-030, TC-COORD-031, TC-COORD-032, TC-COORD-038, TC-COORD-039, TC-COORD-091 | Covered |
| AC-F3-2 | Positive sourced session progress within `coordinator.progress-bound` — a positive `token-delta` or `session-traffic` reading since the expectation — vetoes a stuck verdict; no kill | TC-COORD-029, TC-COORD-033 | Covered |
| AC-F3-3 | Session signals absent/unsupported map to `unknown` (never zero/false); a stale merge/answer class can still yield `stuck`; all-unknown or unreadable is `unevaluable` with reason `evidence-unevaluable`, no kill/restart, exit `2` with the state identity; absence alone never kills | TC-COORD-029, TC-COORD-031, TC-COORD-034, TC-COORD-035, TC-COORD-036, TC-COORD-039 | Covered |
| AC-F3-4 | Identical state/config/facts yield identical verdict and evidence; no CPU signal is read | TC-COORD-037 | Covered |
| AC-F4-1 | The supervisor has already appended `phase=verdict`; the port verifies the recorded `pid` plus `processStartTimeMs`, TERM is sent, `coordinator.kill-grace` elapses, KILL is sent if alive, and `phase=outcome` appends `terminated` or `forced` with the same `stuckId` | TC-COORD-040, TC-COORD-045, TC-COORD-091 | Covered |
| AC-F4-2 | A kill that cannot terminate appends `phase=outcome` with the same `stuckId` and `killOutcome=failed`, returns `coordinator.session.kill-failed` exit `2` with consequence `unknown`, and does not retry forever | TC-COORD-041, TC-COORD-045 | Covered |
| AC-F4-3 | The kill target is the recorded session and process-tree handle; no name/pattern kill and no shell interpolation | TC-COORD-042, TC-COORD-043, TC-COORD-085 | Covered |
| AC-F4-4 | A recorded `pid` plus `processStartTimeMs` that no longer matches sends no signal, appends `phase=outcome` with the same `stuckId`, `killOutcome=failed`, and `killFailureReason=identity-mismatch`, returns `coordinator.session.kill-failed` exit `2`, and never signals the reused pid | TC-COORD-041, TC-COORD-045 | Covered |
| AC-F5-1 | A restart lands in `coordinator/<coordinatorId>`, not in lane or economics; those records are unchanged | TC-COORD-050, TC-COORD-083 | Covered |
| AC-F5-2 | Below `coordinator.restart-budget`: one restart record with the next contiguous ordinal, and the action proceeds | TC-COORD-026, TC-COORD-051, TC-COORD-056, TC-COORD-091 | Covered |
| AC-F5-3 | At/above the bound: no replacement, `coordinator.restart-budget-exhausted` exit `1` with history, escalation runs, a prior kill is recorded and not undone | TC-COORD-052, TC-COORD-056, TC-COORD-091 | Covered |
| AC-F5-4 | Supervisor crash/restart preserves count and bound; a replayed ordinal appends nothing | TC-COORD-053, TC-COORD-055 | Covered |
| AC-F5-5 | `start --fresh-budget` opens a new epoch at count `0`, preserving the old epoch and escalation in history | TC-COORD-016, TC-COORD-054 | Covered |
| AC-F6-1 | Exactly one owner-audience `decision-needed` question with ref, count, bound, history, and options; the digest `typed-questions` section and brief `blocker-questions` anchor render it **first by index** even at the cap, the other questions follow in rank order up to seven, and the lowest-ranked is displaced and counted as omitted; selected from the payload alone by the payload-only predicate (type `decision-needed`, audience `owner`, lane `coordinator`, `ref` = `<coordinatorId>#<budgetEpochId>` with exactly one `#` and both sides non-empty) | TC-COORD-052, TC-COORD-060, TC-COORD-063, TC-COORD-064, TC-COORD-091 | Covered |
| AC-F6-2 | Publish failure returns `coordinator.escalation.publish-failed` exit `2` with consequence `unknown`; status reports `exhausted-escalation-failed`; no exit `0` without a receipt | TC-COORD-062 | Covered |
| AC-F6-3 | A repeated exhausted tick reuses the existing open question, creates no second question/terminal record, returns idempotent `exhausted-escalated` at exit `0`, and leaves the original open | TC-COORD-061, TC-COORD-065 | Covered |
| AC-F7-1 | A newly rank-1, open, coordinator-audience question wakes the coordinator (live/resume/spawn) and appends a `woken` record within one collection interval | TC-COORD-070, TC-COORD-073, TC-COORD-091 | Covered |
| AC-F7-2 | The same still-top already-woken question yields `already-woken` with no second wake or duplicate record; dedupe uses coordinator id, question id, and persisted `askedAt` | TC-COORD-071 | Covered |
| AC-F7-3 | An owner-audience or explicitly non-open head, or no question, yields `no-pickup` and no wake; an absent `status` counts as open, so a rank-1 absent-status coordinator-audience head is a pickup | TC-COORD-070, TC-COORD-073 | Covered |
| AC-F7-4 | A question answered between ranking and wake yields `answered-before-wake`, no wake, and the next cycle re-evaluates | TC-COORD-072 | Covered |
| AC-F7-5 | Wake delivery failure returns `coordinator.wake.delivery-failed` exit `2`, appends no durable wake record, and the next cycle retries; only a later successful wake appends the single `woken` record, so retry cannot duplicate records | TC-COORD-074 | Covered |
| AC-F7-6 | A new question that replaces the answered one as rank 1 wakes normally; one-wake is per question, not per coordinator | TC-COORD-075 | Covered |
| AC-F8-1 | Given the latest lease action is `acquired`, `stale-takeover`, or `stop-requested` and either the recorded holder is alive or `alive` is unknown/unavailable and the lease age is at most two `collection-interval`s, a second `start` or a `tick` on the same state dir is refused `coordinator.already-running` exit `2` with the holder named (a live holder is refused regardless of lease age; unknown liveness is treated as held until the age fallback); the refused invocation appends no lease record and performs no cycle; a different state dir is independent; when the holder is not alive the second invocation may take over (AC-F8-3, AC-F8-6) | TC-COORD-010, TC-COORD-017, TC-COORD-018, TC-COORD-043, TC-COORD-094 | Covered |
| AC-F8-2 | The regime descriptor declares state-dir scope, single-instance lease, unit identity, distinct process kind, distinct budget, `supervisorMode` (`foreground` in v1; `detached` reserved but never produced), `externalUnit` (`absent`), and the M1-S18 daemon-install seam; a bare `start` without `--foreground` is `fallback.invocation` exit `1`; no OS autostart installer is shipped and the gap is declared and tested naming M1-S18 | TC-COORD-013, TC-COORD-014, TC-COORD-092 | Covered |
| AC-F8-3 | Given the latest lease action is `acquired`, `stale-takeover`, or `stop-requested` and the recorded holder is no longer alive (`alive(handle)=false`), or `alive` is unknown/unavailable and the lease age exceeds two `collection-interval`s, a `start` or `tick` appends exactly one `action=stale-takeover` record that is itself the new acquisition (new `holder`, `pid`, `processStartTimeMs`, `previousHolder`, `fenceAgeMs`) and appends no second `acquired`; the takeover evidence is readable from durable state and from `status`; a live holder is never taken over regardless of age | TC-COORD-015, TC-COORD-017, TC-COORD-018, TC-COORD-093, TC-COORD-095 | Covered |
| AC-F8-4 | Given a live holder whose latest lease record is older than two `collection-interval`s, a `start` or `tick` on the same state dir is refused `coordinator.already-running` exit `2` (age never overrides a positive `alive`), and when `coordinator stop` runs it appends `stop-requested`, reports `requested=true`, `released=false`, and the live supervisor stops and appends `released` at the next cycle boundary | TC-COORD-093, TC-COORD-011, TC-COORD-015 | Covered |
| AC-F8-5 | Given two concurrent `start`/`tick` claims over two store handles on the same state dir, both attempt the fenced claim: exactly one appends a lease acquisition and the other is refused `coordinator.already-running` exit `2`; no interleaving produces two `acquired` records; if `acquireFence` returns `state.lock.busy`, the claim maps to `coordinator.already-running` exit `2`, naming the holder when the lease is readable | TC-COORD-094, TC-COORD-010, TC-COORD-017 | Covered |
| AC-F8-6 | Given a crashed supervisor leaving the latest lease action `acquired`, `stale-takeover`, or `stop-requested` with `alive(handle)=false`, `coordinator tick` appends one `stale-takeover` (the new acquisition), runs exactly one cycle, appends `released`, and does not require a separate `start`; the tick does not block forever on the dead holder's lease | TC-COORD-095, TC-COORD-012, TC-COORD-043 | Covered |
| AC-F9-1 | `status [--live]` reports instance from the latest lease (`instanceId`, `pid`, `holder`, `startedAt` = acquisition record time, `supervisorMode`, `externalUnit`), session, decision, restarts, the **last persisted** stuck verdict (`stuck`/`unevaluable`) with non-null `phase`, `reason`, and `evidence`, the tick result's separate `tickVerdict` (`progressing`/`stuck`/`unevaluable` with nullable phase/reason/evidence when `progressing`), wake, escalation, and lease holder with the last lease action in deterministic text/data; `--live` degrades to `unknown`/`degraded` when facts are unavailable | TC-COORD-003, TC-COORD-012, TC-COORD-013, TC-COORD-017, TC-COORD-018 | Covered |
| AC-F10-1 | Six config keys validate with declared defaults/domains; unknown → `config.key.unknown`; wrong type/domain → `config.value.invalid`; no decision-code literal | TC-COORD-001, TC-COORD-056, TC-COORD-080 | Covered |
| AC-F10-2 | The `coordinator` kind and six identities resolve with category/retryability/consequence/remediation and `{0,1,2}` projection; `coordinator.already-running` and `coordinator.restart-budget-exhausted` join `RESERVED_TWO_SEGMENT_CODES` in both gate files (set 22→24; documented table 99→105), the other four are three-segment, and the reserved fallback namespace is unchanged | TC-COORD-004, TC-COORD-081, TC-COORD-082, TC-COORD-092 | Covered |
| AC-F10-3 | Unreadable/torn/unknown records yield `unevaluable`, no kill/restart, the state identity and exit; a torn/gapped ordinal is never count `0`; a per-append fence that remains busy after one stale-lock recovery returns the delivered `state.lock.busy` identity at exit `2`, and a failed append returns the delivered `state.write.failed` identity at exit `2` | TC-COORD-035, TC-COORD-036, TC-COORD-055, TC-COORD-083, TC-COORD-017 | Covered |
| AC-F10-4 | A missing process-port alive or kill-with-grace capability returns `coordinator.process.capability-gap` exit `2` and performs no destructive action; this identity does not cover harness resume (AC-F2-3), spawn (`harness.capability.gap`/`harness.spawn.refused`, exit `1`), or progress (`unknown` class, AC-F3-3) | TC-COORD-044 | Covered |
| AC-F10-5 | The `ceo-loop.sh` map — resume decision, stuck detection, kill, budget, wake — has at least one passing AC trace each | TC-COORD-090, TC-COORD-091 | Covered |
| AC-NFR-1 | A second identical `tick` appends no duplicate restart/stuck/wake/exhaustion record and performs no destructive action | TC-COORD-086, TC-COORD-087, TC-COORD-089 | Covered |
| AC-NFR-2 | No coordinator record or error evidence contains a prompt, transcript, secret, or credential value; evidence is bounded `key=value` ≤ 512 UTF-8 bytes | TC-COORD-084, TC-COORD-085 | Covered |
| AC-NFR-3 | Decision and render paths perform no model call and read no CPU signal | TC-COORD-002, TC-COORD-037 | Covered |
| AC-NFR-4 | Reference-store `tick` p95 ≤ 2 000 ms and `status` p95 ≤ 1 000 ms; output stays within the declared bounds | TC-COORD-088 | Covered |

**Capability coverage** (every F-# has at least one TC): F-1 → 003, 010, 011, 012, 016, 018, 095; F-2 → 020–026; F-3 → 029–039; F-4 → 040–045; F-5 → 050–056; F-6 → 060–065; F-7 → 070–075; F-8 → 010, 013, 014, 015, 017, 018, 093, 094, 095; F-9 → 003, 012, 013, 017, 018; F-10 → 001, 004, 080–083.

**Decision coverage**: DEC-1/DEC-6 → 014, 017, 018, 092; DEC-2 → 092; DEC-3/DEC-7 → 020–026, 091; DEC-4 → 029–037, 039; DEC-5 → 060–065; DEC-8 → 050–056; DEC-9 → 070–075; DEC-10 → 080; DEC-11 → 081, 082; DEC-12 → 001, 083; DEC-13 → 064, 089.

**Seed-scenario coverage**: SC-M1-25 → 091 (primary end-to-end), with clause-level mapping in §3.4 (020–026, 029–036, 040, 045, 051–052, 060–064, 070, 090).

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

The specification declares no REST/HTTP endpoint (API-#): the interface is the CLI family, the `delivery.coordinator.v1` payload, six additive record kinds, one reused typed-question record, the injected process-lifecycle port, the regime descriptor, six config keys, and the error table. There are no new external events; EVT-1..EVT-7 are the durable/reused message surface (§8.2).

| Element | TC ID(s) | Observable assertion |
|---------|----------|----------------------|
| EVT-1 `coordinator.iteration` | TC-COORD-020–026, TC-COORD-038, TC-COORD-083 | One record per recorded decision/expectation with iteration/coordinator/trigger/decision/reason/session/context/fingerprint/window/timestamp; `decision=none` allowed; the fingerprint covers only the state event-log cursor plus open coordinator-audience question count; nulls explicit; validated on read |
| EVT-2 `coordinator.restart` | TC-COORD-050–056, TC-COORD-083 | One record per admitted restart with `<coordinatorId>#<budgetEpochId>#<ordinal>`, contiguous ordinal from `1`, closed reason, session/previous session, epoch, timestamp |
| EVT-3 `coordinator.stuck` | TC-COORD-030–036, TC-COORD-039, TC-COORD-045, TC-COORD-083 | One or two records per `stuck`/`unevaluable` verdict sharing one `stuckId` (= the active expectation's `iterationId`): `phase=verdict` (before the kill, `killOutcome=not-attempted`) then `phase=outcome` (`terminated`/`forced`/`failed`), with closed `reason` (`stuck-artifact-evidence` or `evidence-unevaluable`), bounded evidence, `killFailureReason`; latest-wins fold by **ledger sequence** (`recordedAt` descriptive only); progressing is not persisted; a replay appends nothing |
| EVT-4 `coordinator.exhaustion` | TC-COORD-060–065, TC-COORD-083 | One terminal receipt per epoch (`<coordinatorId>#<budgetEpochId>`), with restarts/historyRef/escalationQuestionId/options/`terminal:true`; lands only after the question |
| EVT-5 `coordinator.wake` | TC-COORD-070–075, TC-COORD-083 | One record per **successful** wake (`outcome=woken`) with wakeId/coordinatorId/questionId/rank/**askedAt**/iterationId/timestamp; `already-woken`, `answered-before-wake`, `delivery-failed`, and `no-pickup` are tick results and append no record |
| EVT-6 owner escalation question | TC-COORD-060, TC-COORD-063, TC-COORD-064 | Reuses `decision-needed`/owner with ref `<coordinatorId>#<budgetEpochId>`, lane `coordinator`, bounded text, declared options; selected by the payload-only predicate; renders **first by index** in both sections; no new type |
| EVT-7 `coordinator.fence` | TC-COORD-010, TC-COORD-017, TC-COORD-018, TC-COORD-083, TC-COORD-093, TC-COORD-094, TC-COORD-095 | One record per lease action with fenceId/**instanceId**/coordinatorId/action (`acquired`/`released`/`stale-takeover`/`stop-requested`)/holder/**pid**/**processStartTimeMs**/**supervisorMode**/**externalUnit**/previousHolder/fenceAgeMs/timestamp; the latest record by **ledger sequence** is the instance identity; the claim is one `acquireFence` → re-read → append → `releaseFence` critical section with `state.lock.busy` mapped to `coordinator.already-running`; a `stale-takeover` is itself the new acquisition and is never followed by `acquired`; every append uses the per-append state-fence helper (one age-stale `recoverFence` + one retry); the `tick` lease pair is expected volume; reads validate it like every coordinator record |
| DM-1 lifecycle decision | TC-COORD-020–026, TC-COORD-083 | Closed decision/reason vocabulary, session identity, context reading or explicit absence, iteration identity, recorded before action |
| DM-2 restart record | TC-COORD-050–056, TC-COORD-083 | Durable per-epoch namespace, contiguous ordinal, closed reason, budget epoch, restartId identity |
| DM-3 stuck record | TC-COORD-030–036, TC-COORD-039, TC-COORD-045, TC-COORD-083 | Two-phase (`verdict` then `outcome`, same `stuckId` = `iterationId`) `stuck`/`unevaluable` verdict with closed `reason`, bounded `key=value` evidence ≤ 512 bytes, `killOutcome`, `killFailureReason` (`identity-mismatch` or null), latest-wins fold by ledger sequence |
| DM-4 exhaustion record | TC-COORD-060–065, TC-COORD-083 | Terminal receipt linking count, history reference, question id, options; one per epoch |
| DM-5 wake record | TC-COORD-070–075, TC-COORD-083 | Question id/rank/askedAt/iteration identity for a persisted `woken` only; `already-woken`/`answered-before-wake`/`delivery-failed`/`no-pickup` append nothing; one wake per question lifetime |
| DM-6 config branch | TC-COORD-056, TC-COORD-080 | Six keys (`stuck-window`, `kill-grace`, `restart-budget`, `resume-context-limit`, `collection-interval`, `progress-bound`) with declared defaults/domains; no literal in decision code |
| DM-7 process-lifecycle port / capability | TC-COORD-029, TC-COORD-040–045 | Injected spawn/attach, alive, kill-with-grace, and sourced-progress facts; harness session resume consumed from the delivered harness port; pre-TERM `pid` + `processStartTimeMs` identity verification; adapter mapping of delivered `token-delta`/`session-traffic` to `newTurn`/`progressing`; four-way ownership split (resume → decision input, spawn → harness identity, alive/kill → coordinator process gap, progress → `unknown` class) |
| DM-8 supervisor-regime descriptor | TC-COORD-010, TC-COORD-013, TC-COORD-014, TC-COORD-015, TC-COORD-017, TC-COORD-018, TC-COORD-093, TC-COORD-094 | State-dir scope, single-instance lease, unit identity, process kind, distinct budget store, `supervisorMode` exactly `foreground` in v1 (`detached` reserved, never produced), `externalUnit` exactly `absent`, M1-S18 seam; lease actions recorded durably; the descriptor's lease is liveness-first and claimed atomically |
| DM-9 closed vocabularies | TC-COORD-001 | Decisions, restart reasons, stuck reasons, verdicts, stuck phases, evidence classes/states, kill outcomes/failure reasons, wake outcomes, fence actions incl. `stop-requested`, supervisor modes, escalation states, options, config keys, error identities have one data-only home |
| DM-10 error-table integration | TC-COORD-081, TC-COORD-082 | `coordinator` kind with exactly six rows; exact two-segment allowlist (`coordinator.already-running`, `coordinator.restart-budget-exhausted`; set 22→24, table 99→105; other four three-segment); `{0,1,2}` projection; fallback unchanged |
| DM-11 coordinator fence record | TC-COORD-010, TC-COORD-017, TC-COORD-018, TC-COORD-083, TC-COORD-094, TC-COORD-095 | Durable instance-lease record for acquisition, release, single-record stale takeover, or stop request, naming the instance, holder (pid + start time), previous holder, fence age, supervisor mode, external unit, and time; the latest record by ledger sequence is the instance identity; a `stale-takeover` is itself the new acquisition and is never followed by a second `acquired`; no separate instance record; takeover evidence readable from status |
| Appendix F exit matrix | TC-COORD-004, TC-COORD-041, TC-COORD-044, TC-COORD-045, TC-COORD-062, TC-COORD-074, TC-COORD-081, TC-COORD-094 | Every listed outcome resolves to exactly one identity and one exit digit; no exit outside `{0,1,2}`; `identity-mismatch` is `coordinator.session.kill-failed` exit `2`; a claim-time `state.lock.busy` is `coordinator.already-running` exit `2`; a non-claim append that stays busy or fails is `state.lock.busy`/`state.write.failed` exit `2`; stop-requested is `requested=true`, `released=false` exit `0`; a bare `start` is `fallback.invocation` exit `1` |
| Appendix G command grammar/payload | TC-COORD-003, TC-COORD-012, TC-COORD-013, TC-COORD-017, TC-COORD-018, TC-COORD-093, TC-COORD-095 | Four subcommands/flags (v1 `start` requires `--foreground`); bounded `delivery.coordinator.v1` machine payload including `instance` (`instanceId`/`pid`/`holder`/`startedAt`/`supervisorMode=foreground`/`externalUnit=absent`), `fence.holder`/`fence.action`/`fence.previousHolder`/`fence.fenceAgeMs`, persisted `stuck` with non-null phase/reason/evidence (or null), and the separate `tickVerdict` with nullable phase/reason/evidence when `progressing`; deterministic bounded human text |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement (threshold) | TC ID(s) | Status |
|--------|--------------------------|----------|--------|
| NFR-1 | Identical state/config/facts → 100% identical decision and `data`; no ambient clock/random/env outside injected ports | TC-COORD-001, TC-COORD-029, TC-COORD-080, TC-COORD-086 | Covered |
| NFR-2 | 0 CPU reads or CPU-derived thresholds in the stuck/lifecycle path | TC-COORD-002, TC-COORD-029, TC-COORD-033, TC-COORD-037 | Covered |
| NFR-3 | 0 model calls in any decision/status/render path | TC-COORD-002, TC-COORD-037 | Covered |
| NFR-4 | At most one verified read per store per tick; ≤ 8 questions; ≤ 64 KiB machine and ≤ 32 human lines | TC-COORD-012, TC-COORD-063, TC-COORD-088 | Covered |
| NFR-5 | `tick` p95 ≤ 2 000 ms; `status` p95 ≤ 1 000 ms; `start` p95 ≤ 2 000 ms excluding spawn | TC-COORD-088 | Covered (GAP-T6) |
| NFR-6 | Repeated tick/wake/restart/exhaustion/stuck evaluation appends no duplicate restart/stuck/wake/exhaustion record and performs no duplicate destructive action (100%); the per-tick lease pair is expected volume and is excluded from this count (NFR-6 covers action records only) | TC-COORD-011, TC-COORD-012, TC-COORD-017, TC-COORD-030, TC-COORD-051, TC-COORD-061, TC-COORD-071, TC-COORD-087 | Covered |
| NFR-7 | Restart count, budget epoch, exhaustion receipt, wake dedupe, and instance lease survive a supervisor crash/restart (100%) | TC-COORD-018, TC-COORD-025, TC-COORD-053, TC-COORD-054, TC-COORD-093, TC-COORD-095 | Covered (GAP-T4) |
| NFR-8 | Wake latency ≤ one collection interval (default 30 000 ms) after the question qualifies; caller-bounded if the caller ticks slower | TC-COORD-070 | Covered (GAP-T2) |
| NFR-9 | Stuck-detection latency ≤ `stuck-window` + one interval (default 630 000 ms) after an expectation; caller-bounded if the caller ticks slower | TC-COORD-029, TC-COORD-030, TC-COORD-088 | Covered (GAP-T2) |
| NFR-10 | TERM then KILL after `kill-grace` (default 20 000 ms); `forced` is never reported as `terminated`; identity is verified before TERM | TC-COORD-040, TC-COORD-045 | Covered |
| NFR-11 | 0 prompt/transcript/secret/credential values; evidence bounded `key=value` ≤ 512 UTF-8 bytes | TC-COORD-084, TC-COORD-085 | Covered |
| NFR-12 | Exits only `0`/`1`/`2`; every non-zero resolves to one declared identity | TC-COORD-004, TC-COORD-041, TC-COORD-044, TC-COORD-045, TC-COORD-062, TC-COORD-074, TC-COORD-081, TC-COORD-082 | Covered |
| NFR-13 | 0 exit-`0` for an unverified state, an unlanded escalation, or a destructive action on unevaluable state; every skipped/degraded path is reported | TC-COORD-013, TC-COORD-017, TC-COORD-035, TC-COORD-044, TC-COORD-062, TC-COORD-083 | Covered |
| NFR-14 | Kill target is the recorded handle/tree only; no name/pattern kill; no shell interpolation; the recorded `pid` + `processStartTimeMs` identity is verified before TERM; the kill requires the current instance lease and the outcome append takes the state write fence for that append only | TC-COORD-042, TC-COORD-043, TC-COORD-045, TC-COORD-085 | Covered |
| NFR-15 | 0 changes to existing output/envelope/exits/config/digest/anchors except the declared reserved escalation slot | TC-COORD-064, TC-COORD-089, TC-COORD-092 | Covered |

### 3.4 Coverage-Matrix Integrity and SC-M1-25 Reconciliation

- **Uncovered ACs**: none (48/48 in §3.1). **Orphan TCs**: none; every TC names an AC, NFR, DEC, or the seed in §5.1 and §5.2.
- **Intentional duplicate coverage**: AC-F1-1 spans the start receipt, the duplicate refusal, the bare-`start` invocation error, and the fresh-budget refusal because they fail independently; AC-F1-4 adds the instance-identity fold. AC-F4-4 spans the identity-mismatch kill path together with AC-F4-2 because the failure classification and the pre-signal verification fail independently. AC-F2-* spans the decision matrix plus durability plus the ordinal matrix because recording, action, and bookmarking fail independently. AC-F3-* spans the evidence matrix, the fingerprint rule, the adapter new-turn mapping, the corroborator, the unknown rule, the unevaluable rule, and the no-CPU proof because each can regress alone. AC-F6-1 spans behaviour, the terminal receipt, the render-first index, and digest/brief agreement because the escalation can land but be crowded out. AC-F8-4 spans the live-holder refusal and the live-holder stop path because the two directions (takeover refusal, stop delivery) fail independently; AC-F8-5 spans the two-handle race and the `state.lock.busy` mapping because the interleaving and the lock-contention branch are distinct; AC-F8-6 spans the crash recovery and the quiet-cycle volume. AC-NFR-4 spans performance and read-count and output bounds.

**SC-M1-25 (restated from `doc/planning/oss-tooling/milestones/m1/test-scenarios.md`):**

> **Given** a coordinator session mid-iteration; context pressure rises; a coordinator-audience question is ranked top-of-digest. **When** supervision evaluates. **Then** the join-or-resume decision is recorded and applied; a stuck coordinator (no digest consumed, no merge, no answer within the declared window) is detected by artifact evidence, killed with grace, and restarted within budget; the typed question wakes the next iteration within one collection cycle. **Assert** restart events classified; exhaustion escalates to the owner brief (never silent); the `ceo-loop` function map (resume decision, stuck detection, kill, budget, wake) is covered.

| Seed clause | Test coverage | Notes |
|-------------|---------------|-------|
| Given: a coordinator session mid-iteration | TC-COORD-020, TC-COORD-024 | A live recorded session is `join-live`; a killed-mid-iteration session is recovered per the recorded decision with closed-out artifacts untouched |
| Given: context pressure rises | TC-COORD-021, TC-COORD-022 | `resume-context` below `resume-context-limit`; `spawn-fresh` with `context-pressure` at/above it |
| Given: a coordinator-audience question ranked top-of-digest | TC-COORD-070, TC-COORD-073 | Strict `isCoordinatorPickup`: rank 1, open (an absent status counts as open), audience coordinator |
| When: supervision evaluates | TC-COORD-012, TC-COORD-026 | One bounded `tick` performs the evaluation; the decision is persisted before the action |
| Then: join-or-resume decision recorded and applied | TC-COORD-020, TC-COORD-021, TC-COORD-024, TC-COORD-025, TC-COORD-026 | Decision + reason + session + context + ordinal + iteration recorded; durable across restart |
| Then: no digest consumed, no merge, no answer within the declared window | TC-COORD-029, TC-COORD-030, TC-COORD-031, TC-COORD-032 | Three classes; the fingerprint is the state event-log cursor plus open coordinator-question count; `digest-consumed` requires a fingerprint advance **and** a new turn (positive `token-delta` or `session-traffic`) |
| Then: detected by artifact evidence | TC-COORD-029, TC-COORD-030, TC-COORD-031, TC-COORD-034, TC-COORD-037 | No CPU read; unknown is disclosed, never fabricated as stale; positive progress within `progress-bound` vetoes |
| Then: killed with grace | TC-COORD-040, TC-COORD-042, TC-COORD-045 | TERM → grace → KILL if alive; recorded handle only; pre-TERM identity verified |
| Then: restarted within budget | TC-COORD-051, TC-COORD-052, TC-COORD-054 | Below bound appends the next ordinal; at/above refuses and escalates; fresh budget opens a new epoch |
| Then: the typed question wakes the next iteration within one collection cycle | TC-COORD-070, TC-COORD-073 | One tick after the question qualifies issues the wake; no scheduler in v1 (GAP-T2) |
| Assert: restart events classified | TC-COORD-026, TC-COORD-039, TC-COORD-051, TC-COORD-052 | Closed restart reasons plus the distinct closed stuck `reason` field (`stuck-artifact-evidence` / `evidence-unevaluable`) |
| Assert: exhaustion escalates to the owner brief, never silent | TC-COORD-060, TC-COORD-062, TC-COORD-063, TC-COORD-064 | Exactly one owner question; publish failure exit `2`; reserved slot renders first at the cap; digest/brief agree; `exhausted-escalated` |
| Assert: the ceo-loop function map is covered | TC-COORD-090 (trace) plus TC-COORD-020/029/040/045/051/070 | Context-resume decision, stuck detection, kill, budget, wake each have a passing AC trace |

**Divergence declaration.** No divergence. The only clarification beyond the seed's wording is the observable definition of "digest consumed" (spec DEC-4): the digest-input fingerprint must advance **and** the coordinator session must produce a new session turn. This preserves the seed's artifact-evidence intent and the corroborator prevents a false kill. TC-COORD-032 pins that a fingerprint advance without a turn does **not** count.

**Specification resolutions (v1.3)** (full detail in §8.4): RF-01/RF-05/RF-06/RF-07/A1 (the durable instance lease via `coordinator.fence` records replaces every lifetime-fence assertion; the per-append state write fence composes with the delivered `appendBlockerQuestion`; `stop` is a recorded request; AC-F1-4 pins the instance identity); RF2-01/RF2-02/RF2-03/RF2-06 (liveness-first lease, one fenced critical section with `state.lock.busy` → `coordinator.already-running`, `tick` sharing the claim/takeover path for crash recovery, and single-record takeover); RF-04/RF2-11/RF2-12 (two-phase `coordinator.stuck` under `stuckId = iterationId`, latest-wins fold by **ledger sequence**, replay appends nothing); RF2-05 (the per-tick lease pair is expected volume; NFR-6 covers action records only); RF2-07 (per-append `fenceStatus` + one `recoverFence` + one retry, else `state.lock.busy`/`state.write.failed`, with no `contracts/state.ts` change); RF2-09 (foreground-only v1; bare `start` is `fallback.invocation` exit `1`; `detached` reserved and never produced; the supervisor records its own pid/process start time); RF2-10 (persisted `data.stuck` split from the tick's `tickVerdict`, with nullable phase/reason/evidence when `progressing`); RF-08/A3 (new turn = positive `token-delta` or `session-traffic`; `coordinator.progress-bound` default 300 000 ms; adapter-level mapping; absent → `unknown`; caller-bounded next-tick semantics); RF-09 (fingerprint = state event-log cursor + open coordinator-question count only; no ready-to-merge, tracker, CI, or network read); RF-10 (`exhausted-escalated`, no `escalated`); RF-12/A5 (reserved question renders first by index in both sections; other seven in rank order; lowest displaced and counted omitted); A2/AC-F4-4 (pre-TERM `pid` + `processStartTimeMs` verification; mismatch → no signal, `killFailureReason=identity-mismatch`, exit `2`); A6 (absent status counts as open; `no-pickup` only for non-rank-1 / non-coordinator / explicitly non-open). No specification gap remains open; the affected TCs assert the pinned contracts directly.

## 4. Test Types and Layers

All TypeScript tests use `bun:test` with `describe`/`test`; fixtures are never named `*.test.ts`. Module and suite paths follow the delivered tier layout and are delivery-bound where GAP-T5 says so.

| Layer | Runner / invocation | Location | Covers |
|-------|--------------------|----------|--------|
| Static/diff and content | `git diff --check`; changed-file naming/path review; markdown table/fence sanity | change artifacts, touched docs | Gate precondition; TC-COORD-092 |
| Unit (pure domain) | `bun test tests/behaviour/coordinator-*.test.ts` importing the pure functions directly | `packages/core/src/domain/coordinator*` (expected) and `packages/core/src/contracts/coordinator*` | Decision, stuck (including TC-029 new-turn mapping), admission, wake, escalation matrix cases; no I/O |
| Structure / invariant | `bun test tests/structure/coordinator-*.test.ts` | contracts/domain/state/config modules; AST scans and temp-copy mutants | TC-COORD-001, 002, 003, 018, 037, 045, 080, 081, 083 |
| State-record | `bun test tests/behaviour/coordinator-records.test.ts tests/behaviour/coordinator-*-durability.test.ts tests/behaviour/coordinator-fence-records.test.ts tests/behaviour/coordinator-instance-lease.test.ts` | `packages/core/src/state/coordinator*` (expected), `tests/fixtures/state/harness.ts` | TC-COORD-017, 018, 025, 053, 055, 083, 094, 095 |
| Adapter / process-port | `bun test tests/behaviour/coordinator-{kill-grace,kill-failed,kill-identity,capability-gap,new-turn}.test.ts` | `tests/fixtures/coordinator/process-port.ts`, `packages/adapters/src/harness/process-lifecycle*` (expected) | TC-COORD-029, 040, 041, 044, 045 |
| Security / privacy | `bun test tests/checks/coordinator-privacy.test.ts tests/structure/coordinator-kill-target.test.ts` | privacy canaries, secret boundary, shell/network scans | TC-COORD-042, 084, 085 |
| Non-regression | `bun test tests/structure tests/behaviour tests/golden tests/conformance` | unchanged delivered suites plus the declared reserved-slot golden | TC-COORD-089 |
| Type-level | `pnpm typecheck`; `tests/types/coordinator.type-test.ts` | closed unions, absent-vs-null-vs-zero modelling, no CPU field, envelope exclusivity | Supports TC-COORD-001, 002, 004, 083 |
| Error-table binding | `bun test tests/checks/error-table-sync.test.ts`; `bun run scripts/checks/error-table-sync.ts` | `tests/fixtures/result/code-corpora/*.json`, `doc/spec/features/feature-result-contract.md` | TC-COORD-081, 082 |
| Behaviour (CLI in-process) | `bun test tests/behaviour/coordinator-*.test.ts` | `tests/fixtures/coordinator/**`; injected clock/ids/brand/ports/state; in-process `runCli` | TC-COORD-003–018, 020–075, 080–087, 093–095 |
| Integration (fake process harness) | `bun test tests/behaviour/coordinator-scenario.test.ts` | `tests/fixtures/coordinator/harness.ts` + `process-port.ts`; in-process CLI over a temp state root | TC-COORD-091 |
| Golden | `bun test tests/golden/coordinator.test.ts tests/golden/status-digest.test.ts tests/golden/brief.test.ts` | committed normalized fixtures under `tests/fixtures/coordinator/golden/`, `tests/fixtures/status/golden/`, `tests/fixtures/brief/golden/` | TC-COORD-013, 063, 064, 086, 089 |
| Checks / mutants / determinism | `bun test tests/checks/coordinator-{mutants,determinism}.test.ts` | `tests/fixtures/coordinator/mutants/**`, temp copies | TC-COORD-029, 037, 045, 086, 087 |
| Boundaries | `bun test tests/boundaries`; `pnpm check:boundaries` | production `.dependency-cruiser.cjs`, ambient-globals AST guard, fixture-coverage meta-check | TC-COORD-002, 085 |
| Performance | `bun test tests/behaviour/coordinator-performance.test.ts` | synthetic reference store; injected clock; p95 over declared iterations, environment recorded | TC-COORD-088 |
| Manual | content/manual review at phase 7 | `doc/spec/features/feature-coordinator-supervision.md`, registry, man page, decision records; `bash scripts/.tests/test-doc-distribution.sh` | TC-COORD-092 |

**Layer rules that bind every TC** (mirroring the delivered suite discipline):

1. **Hermetic.** Production modules are imported and fakes injected. No suite spawns a real harness session, opens the real user state directory, reads `$HOME`/`process.env`, opens a socket, or writes the live worktree. A suite that cannot resolve an injection seam fails naming the missing contract.
2. **One injected state seam.** Coordinator records are written through the delivered `StateStorePort` with a mutable clock and deterministic fence tokens; temp roots only. Never a real user state directory.
3. **One injected process seam.** The process-lifecycle port is a recording fake that records `spawn`, `resume`, `alive`, `kill` (with TERM/KILL phases and the fake-clock duration), and sourced-progress reads. No real child process, signal, or OS process-tree enumeration runs in the default suite.
4. **One injected blocker seam.** The verified blocker read is a fixture ledger; the wake and answer evidence reuse one read per tick (read-count asserted).
5. **Fixed facts.** Clock, ids, brand, config, session identities, ordinals, and capability declarations are injected and constant per case.
6. **No ambient clock/random/env.** `Date.now`, `Math.random`, `performance.now`, `process.env`, `Bun.env`, network, and filesystem APIs are forbidden in the decision/render domain and proven by AST scans and mutants.
7. **Temp roots only.** Any filesystem fixture is `mkdtemp`-created and removed in `afterEach`; goldens are read-only and their `mtimeMs` is asserted unchanged.
8. **No moving-base diff.** Every assertion reads the current tree, a committed fixture, a temp copy, or a recorded invocation. Branch-diff shape checks belong to review/CI, not the permanent suite.
9. **Exact counts stay exact.** Where a closed vocabulary or table grows, update the exact expected value; never replace it with `toBeGreaterThan` or a floor.

## 5. Test Scenarios

TC IDs use the `COORD` feature prefix. Sequence blocks are intentional: `0xx` contracts, command grammar, and CLI purity; `01x` start/stop/status/tick, regime, fence, and fresh budget; `02x` lifecycle decisions and durability; `03x` artifact-evidence stuck detection; `04x` kill with grace and capability gaps; `05x` restart budget and exhaustion refusal; `06x` owner-brief escalation and the reserved slot; `07x` predicate-bound wake; `08x` configuration, state, errors, privacy, security, determinism, idempotency, performance, and non-regression; `09x` the `ceo-loop` map trace, SC-M1-25 end-to-end, and documentation reconciliation; `093–095` append the v1.3 lease-safety scenarios (live-holder refusal and stop, two-handle atomic claim, and `tick` crash recovery) at the end without renumbering existing ids.

### 5.1 Scenario Index

| TC ID | Title | Type | Impact | Priority | AC / NFR |
|-------|-------|------|--------|----------|----------|
| TC-COORD-001 | Coordinator vocabularies and record schemas have one data-only home | Happy Path | Critical | High | AC-F10-1, AC-F10-2; DM-1..DM-9, DM-11; NFR-1, NFR-12 |
| TC-COORD-002 | Tier boundaries, purity, adapter confinement, and brand neutrality hold | Happy Path | Critical | High | AC-NFR-3; NFR-1, NFR-2, NFR-3 |
| TC-COORD-003 | Command grammar is the declared four-subcommand family; unknown input is classified | Happy Path | Critical | High | AC-F1-1, AC-F1-2, AC-F1-3, AC-F9-1 |
| TC-COORD-004 | The CLI handler is pure and every outcome projects one identity in `{0,1,2}` | Happy Path | Critical | High | AC-F10-2; NFR-12 |
| TC-COORD-010 | `start --foreground` claims the lease atomically, records the instance, refuses a second supervisor, and rejects a bare start | Happy Path | Critical | High | AC-F1-1, AC-F8-1, AC-F8-5; DM-8, DM-11 |
| TC-COORD-011 | `stop` is a recorded request, reports `requested`/`not-running`, and is idempotent without a supervisor | Happy Path | Critical | High | AC-F1-3, AC-F8-4; NFR-6 |
| TC-COORD-012 | `tick` claims the lease, runs exactly one bounded cycle, exposes persisted stuck and `tickVerdict`, and starts no loop | Happy Path | Critical | High | AC-F1-2, AC-F9-1, AC-F2-6; NFR-4 |
| TC-COORD-013 | `status [--live]` reports the full state (persisted stuck plus `tickVerdict`) and degrades honestly | Happy Path | Critical | High | AC-F9-1, AC-F8-2; NFR-13 |
| TC-COORD-014 | The regime descriptor is shared, is foreground-only in v1, declares the M1-S18 seam, and ships no installer | Happy Path | Important | High | AC-F8-2; DEC-1, DEC-6 |
| TC-COORD-015 | A dead-holder lease is taken over with one recorded `stale-takeover`; a live holder is never taken over | Edge Case | Critical | High | AC-F8-3, AC-F8-4; NFR-6 |
| TC-COORD-016 | `--fresh-budget` is a start-time option and requires a stopped supervisor | Negative | Important | High | AC-F1-1, AC-F5-5 |
| TC-COORD-017 | `coordinator.fence` records acquisition, release, single-record stale takeover, stop request, and per-append fence recovery durably | Happy Path | Critical | High | AC-F1-1, AC-F1-3, AC-F8-1, AC-F8-3, AC-F8-5, AC-F9-1, AC-F10-3; DM-11; EVT-7; NFR-6 |
| TC-COORD-018 | The instance identity is folded from the latest lease by ledger sequence; no separate instance record exists | Happy Path | Critical | High | AC-F1-1, AC-F1-3, AC-F1-4, AC-F8-1, AC-F9-1; DM-11; EVT-7 |
| TC-COORD-020 | A live session records `join-live` and consumes no ordinal | Happy Path | Critical | High | AC-F2-1; DEC-7; SC-M1-25 |
| TC-COORD-021 | A resumable unclean session records `resume-context` without re-paying prefill | Happy Path | Critical | High | AC-F2-2; DM-1, DM-2; SC-M1-25 |
| TC-COORD-022 | `spawn-fresh` recovery reasons each consume exactly one ordinal | Corner Case | Critical | High | AC-F2-3; DM-1, DM-2 |
| TC-COORD-023 | `spawn-fresh` for a first start or a clean end consumes no ordinal | Happy Path | Critical | High | AC-F2-6; DM-1 |
| TC-COORD-024 | A mid-iteration kill resumes/respawns without re-executing closed-out work | Edge Case | Critical | High | AC-F2-4; SC-M1-25 |
| TC-COORD-025 | The recorded decision survives a supervisor restart | Edge Case | Critical | High | AC-F2-5; NFR-7 |
| TC-COORD-026 | Ordinal accounting is consistent across all six decision outcomes | Corner Case | Critical | High | AC-F2-1..AC-F2-6, AC-F5-2 |
| TC-COORD-029 | The adapter maps `token-delta`/`session-traffic` to a new turn and progress-bound; absent is `unknown` | Corner Case | Critical | High | AC-F3-1, AC-F3-2, AC-F3-3; DM-7; DEC-4 |
| TC-COORD-030 | A stuck verdict is the full two-phase artifact-evidence conjunction (`stuckId = iterationId`, ledger-sequence fold) | Happy Path | Critical | High | AC-F3-1, AC-F4-1; DM-3; EVT-3; SC-M1-25 |
| TC-COORD-031 | The advanced/stale/unknown evidence matrix is total and deterministic | Corner Case | Critical | High | AC-F3-1, AC-F3-3 |
| TC-COORD-032 | A fingerprint advance without a session turn does not count as consumed; the fingerprint is state-sourced only | Negative | Critical | High | AC-F3-1; DEC-4 |
| TC-COORD-033 | Positive sourced progress within `progress-bound` vetoes a stuck verdict and no kill occurs | Regression | Critical | Critical | AC-F3-2; NFR-2; RSK-1 |
| TC-COORD-034 | Absent session signals map to `unknown`, never zero; only a stale artifact can justify a kill | Corner Case | Critical | High | AC-F3-3; DM-7 |
| TC-COORD-035 | All-unknown or an unreadable required store yields `unevaluable`, exit `2`, no action | Negative | Critical | Critical | AC-F3-3, AC-F10-3; NFR-13 |
| TC-COORD-036 | A single torn/unreadable store is unknown, never fabricated stale | Negative | Critical | High | AC-F3-3, AC-F10-3 |
| TC-COORD-037 | CPU is never read, structurally or behaviourally | Negative | Critical | Critical | AC-F3-4, AC-NFR-3; NFR-2 |
| TC-COORD-038 | One expectation is active per coordinator and a trigger refreshes it | Corner Case | Important | High | AC-F3-1; EVT-1 |
| TC-COORD-039 | The stuck record's closed `reason` distinguishes `stuck-artifact-evidence` from `evidence-unevaluable` | Corner Case | Critical | High | AC-F3-1, AC-F3-3, AC-F10-3; DM-3; EVT-3 |
| TC-COORD-040 | Kill verifies identity, sends TERM, waits grace, then KILL, and records the two-phase outcome | Happy Path | Critical | Critical | AC-F4-1; NFR-10; EVT-3; SC-M1-25 |
| TC-COORD-041 | A failed kill is classified at exit `2` and never claims success | Negative | Critical | Critical | AC-F4-2, AC-F4-4; NFR-12, NFR-13 |
| TC-COORD-042 | The kill target is the recorded handle and tree; no name/pattern/shell path exists | Negative | Critical | Critical | AC-F4-3; NFR-14 |
| TC-COORD-043 | No kill exists without the current instance lease; a contended tick is refused and a crashed holder is recoverable by `tick` | Negative | Critical | Critical | AC-F4-3, AC-F8-1, AC-F8-6; NFR-14 |
| TC-COORD-044 | Missing process-port capabilities are a classified gap; the four capability owners stay distinct | Negative | Critical | High | AC-F10-4; DM-7; NFR-13 |
| TC-COORD-045 | A PID/start-time identity mismatch sends no signal and records `identity-mismatch` | Negative | Critical | Critical | AC-F4-4, AC-F4-2; DM-3, DM-7; NFR-14; RSK-13 |
| TC-COORD-050 | The restart namespace is the coordinator's, not lane/economics | Happy Path | Critical | High | AC-F5-1; DM-2; DEC-8 |
| TC-COORD-051 | A below-bound restart appends the next contiguous ordinal and proceeds | Happy Path | Critical | High | AC-F5-2; NFR-6 |
| TC-COORD-052 | At/above the bound no replacement starts, the refusal is exit `1`, and escalation runs | Negative | Critical | Critical | AC-F5-3, AC-F6-1; SC-M1-25 |
| TC-COORD-053 | The budget survives a supervisor crash; a replay appends nothing | Edge Case | Critical | High | AC-F5-4; NFR-6, NFR-7 |
| TC-COORD-054 | `start --fresh-budget` opens a new epoch and preserves the old history | Happy Path | Critical | High | AC-F5-5; NFR-7 |
| TC-COORD-055 | A torn/gapped ordinal is unevaluable, never count `0` | Negative | Critical | Critical | AC-F10-3, AC-F5-4; NFR-13 |
| TC-COORD-056 | The bound is configuration-driven; budget `0` admits no restart and escalates | Corner Case | Critical | High | AC-F10-1, AC-F5-2, AC-F5-3 |
| TC-COORD-060 | Exactly one owner-audience exhaustion question lands, and the receipt follows it | Happy Path | Critical | Critical | AC-F6-1; DM-4; DEC-5; SC-M1-25 |
| TC-COORD-061 | A repeated exhausted tick is idempotent and leaves the original question open | Regression | Critical | High | AC-F6-3; NFR-6 |
| TC-COORD-062 | Publish failure is exit `2`, status says `exhausted-escalation-failed`, and no exit `0` lies | Negative | Critical | Critical | AC-F6-2; NFR-12, NFR-13 |
| TC-COORD-063 | The reserved escalation slot renders first by index at the cap with the omitted count intact | Corner Case | Critical | Critical | AC-F6-1; NFR-4 |
| TC-COORD-064 | The reserved slot adds no new anchor, section, or type, and digest/brief agree | Regression | Critical | High | AC-F6-1; NFR-15 |
| TC-COORD-065 | Escalation is idempotent by coordinator-and-epoch and reuses the open owner question | Corner Case | Critical | High | AC-F6-3 |
| TC-COORD-070 | Strict `isCoordinatorPickup` wakes only rank-1 open coordinator questions; an absent status counts as open | Happy Path | Critical | Critical | AC-F7-1, AC-F7-3; NFR-8; DEC-9; SC-M1-25 |
| TC-COORD-071 | One wake per question lifetime; a still-top question is `already-woken` | Regression | Critical | High | AC-F7-2; NFR-6 |
| TC-COORD-072 | A question answered between ranking and wake yields `answered-before-wake` | Edge Case | Critical | High | AC-F7-4 |
| TC-COORD-073 | The wake uses the live/resume/spawn path and records the question and iteration | Happy Path | Critical | High | AC-F7-1, AC-F7-3 |
| TC-COORD-074 | Wake delivery failure is exit `2`, appends nothing, and retries without duplicate records | Negative | Critical | High | AC-F7-5; NFR-6 |
| TC-COORD-075 | A new top question after an answered one wakes normally | Corner Case | Important | High | AC-F7-6 |
| TC-COORD-080 | The six config keys own defaults/domains; invalid input reuses the delivered identities | Happy Path | Critical | High | AC-F10-1; DM-6; DEC-10 |
| TC-COORD-081 | The error table gains the coordinator kind and exactly six rows, with the exact allowlist addition | Happy Path | Critical | Critical | AC-F10-2; DM-10; NFR-12 |
| TC-COORD-082 | The six documented rows bind two-way and the corpora are non-vacuous | Happy Path | Critical | Critical | AC-F10-2; NFR-12 |
| TC-COORD-083 | Coordinator records are additive, validated, and the schema version is unchanged | Happy Path | Critical | High | AC-F10-3, AC-F5-1; DM-1..DM-5, DM-11 |
| TC-COORD-084 | No prompt, transcript, secret, or credential value reaches any record or error | Negative | Critical | Critical | AC-NFR-2; NFR-11 |
| TC-COORD-085 | The kill path is shell-free and the same-user trust boundary is unchanged | Negative | Critical | Critical | AC-F4-3, AC-NFR-2; NFR-14 |
| TC-COORD-086 | Identical facts render byte-identical data and text with no ambient inputs | Happy Path | Critical | High | AC-NFR-1; NFR-1 |
| TC-COORD-087 | A second identical tick appends no duplicate action record (only its lease pair) and performs no destructive action | Regression | Critical | Critical | AC-NFR-1; NFR-6 |
| TC-COORD-088 | tick/status performance, read cost, and output bounds are within the declared thresholds | Happy Path | Important | High | AC-NFR-4; NFR-4, NFR-5 |
| TC-COORD-089 | The delivered status, brief, blockers, economics, lanes, and `ceo-loop.sh` do not regress | Regression | Critical | Critical | AC-NFR-1; NFR-15 |
| TC-COORD-090 | The `ceo-loop.sh` function map has a passing AC trace for all five functions | Happy Path | Important | High | AC-F10-5; Appendix A |
| TC-COORD-091 | SC-M1-25 end-to-end over an in-process CLI and a fake process harness | Happy Path | Critical | Critical | AC-F2-*, AC-F3-*, AC-F4-1, AC-F5-2/3, AC-F6-1, AC-F7-1, AC-F10-5 |
| TC-COORD-092 | Documentation, registry, man page, and distribution marker reconcile with the delivered surface | Happy Path | Important | Medium | AC-F8-2, AC-F10-2; NFR-15 |
| TC-COORD-093 | A live holder past 2×`collection-interval` is never taken over and can still be stopped | Edge Case | Critical | High | AC-F8-4, AC-F8-1, AC-F8-3; NFR-6 |
| TC-COORD-094 | Two overlapping claims over two store handles yield exactly one acquisition and one `coordinator.already-running` | Corner Case | Critical | Critical | AC-F8-5, AC-F8-1; NFR-6 |
| TC-COORD-095 | A `tick` recovers a crashed holder with one `stale-takeover`, one cycle, and one `released` | Edge Case | Critical | High | AC-F8-6, AC-F8-3, AC-F1-2; NFR-7 |

### 5.2 Scenario Details

#### TC-COORD-001 - Coordinator vocabularies and record schemas have one data-only home

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F10-1, AC-F10-2, F-10, DM-1..DM-9, DM-11, NFR-1, NFR-12
**Test Type(s)**: Unit, Contract, Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/coordinator-contract.test.ts`; `tests/types/coordinator.type-test.ts`; contracts module `packages/core/src/contracts/coordinator.ts` (expected) and `packages/core/src/contracts/index.ts`
**Tags**: @contract, @backend, @structure

**Preconditions**:
- The coordinator contract module and its export from the contracts index exist.
- The six record kinds, the config key paths, and the six error identities are declared.

**Steps**:
1. Import the closed vocabularies: lifecycle decisions, lifecycle reasons, restart reasons, stuck verdicts, stuck reasons, stuck phases, evidence classes and states, kill outcomes, kill failure reasons, wake outcomes (persisted and tick-result), fence actions, supervisor modes, escalation states, exhaustion options, config keys, and error identities.
2. Assert each vocabulary is a single `as const` declaration driving both the runtime list and the union type, with no duplicate, missing, or extra member; assert declared order where the spec declares order.
3. Assert the six record-kind identifiers and their payload schema ids are strings under the `coordinator.` prefix, distinct from `economics.*`, `blocker.*`, and every delivered kind; include the `fence` kind and its `acquired`/`released`/`stale-takeover`/`stop-requested` actions.
4. Assert `STATE_SCHEMA_VERSION` is still `delivery.state.v1` and the coordinator kinds are additive constants, not a schema version or migration marker; assert no `coordinator.instance` kind.
5. Assert `DOMAIN_KINDS` will contain `coordinator` exactly once and that the six identities are unique and two- or three-segment per Appendix B; assert the `supervisorMode` closed vocabulary contains exactly `foreground` (the only v1-produced value) and `detached` (reserved, never produced in v1), and `externalUnit` is exactly `absent`.
6. Assert the config key paths are exactly the six declared keys (`stuck-window`, `kill-grace`, `restart-budget`, `resume-context-limit`, `collection-interval`, `progress-bound`), with no seventh key and no alias.
7. Scan every file under `packages/` for a redeclaration of any coordinator vocabulary; assert none.
8. Run the structure layer's AST data-only detector over the module; a temp-copy mutant injecting a runtime import or an executable statement fails naming the file and kind.

**Expected Outcome**:
- Every coordinator vocabulary has exactly one data-only home and the union cannot drift from the runtime list.
- The record kinds are additive and the state schema version is unchanged.
- The config key set and error identity set are closed and exactly the declared ones.
- The mutation probe proves the data-only detector is non-vacuous.

**Notes / Clarifications**:
- Record-kind strings, schema ids, and store-key spellings not pinned by the spec are delivery-bound (GAP-T5); the test reads them from the contract and asserts one-home, closedness, and prefix, not a guessed literal.
- The `decision=none` member is part of the decision vocabulary for expectation-only iteration records; it is asserted here and exercised in TC-COORD-038.

#### TC-COORD-002 - Tier boundaries, purity, adapter confinement, and brand neutrality hold

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR-3, F-9, F-10, NFR-1, NFR-2, NFR-3
**Test Type(s)**: Unit, Contract, Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/coordinator-imports.test.ts`, `tests/boundaries`, `packages/core/src/{contracts,domain,state,config}/coordinator*`, `packages/adapters/src/harness/process-lifecycle*` (expected)
**Tags**: @contract, @backend, @boundary

**Preconditions**:
- The contracts, domain, state, config, adapter, and CLI modules for the coordinator surface exist.

**Steps**:
1. Assert the contracts modules are data-only and import no `node:`/`bun:` specifier.
2. Assert the pure domain modules (lifecycle decision, stuck verdict, restart admission, wake evaluation, escalation projection) import only `#contracts` or sibling domain modules and call no `Date.now`, `Math.random`, `performance.now`, `process.env`, `Bun.env`, `fetch`, timer, child-process, or filesystem API.
3. Assert the config branch uses only the delivered catalog/defaults/provenance/validation mechanisms; no bespoke parser and no coordinator literal in decision code.
4. Assert the process-lifecycle implementation lives only in the adapter seam beside the harness adapters; no OS API, signal, PID, or process-tree call exists in core contracts, core domain, state, config, or the CLI handler.
5. Assert no `opencode`/`claude-code` harness-name branch exists outside `packages/adapters/**`; per-harness facts arrive as injected capability declarations.
6. Assert no product/binary literal and no ambient environment read exists on the coordinator surface; brand facts are injected.
7. Run `bun test tests/boundaries` with the production `.dependency-cruiser.cjs`; every rule stays green and the fixture-coverage meta-check reports no unenforced rule.
8. Non-vacuity: three temp-copy mutants — `node:fs` in contracts, `Date.now()` in domain, and an OS-signal call in domain — each fail by file and kind.

**Expected Outcome**:
- The coordinator surface respects the tier matrix with no rule loosening and no matrix edge added.
- Process/OS and harness logic exists only in the adapter seam; the decision domain stays pure.
- No model call or CPU read is reachable from a decision or render path.

#### TC-COORD-003 - Command grammar is the declared four-subcommand family; unknown input is classified

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-1, AC-F1-2, AC-F1-3, AC-F9-1, F-1, F-9, DM-9
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-grammar.test.ts`; `packages/cli/src/edge.ts` and `packages/cli/src/commands/coordinator.ts` (expected)
**Tags**: @api, @backend, @cli

**Preconditions**:
- The `coordinator` command family is registered at the CLI edge and the command page row exists.

**Steps**:
1. Assert the family is exactly `coordinator start`, `coordinator stop`, `coordinator status`, and `coordinator tick`; no `supervise`, `daemon`, or fifth subcommand is registered.
2. Assert the declared flags only: `start --foreground` (required in v1), `start --fresh-budget`, `status --live`; `stop` and `tick` take none; assert a bare `start` without `--foreground` returns `fallback.invocation` at exit `1` naming `--foreground`.
3. Run an unknown subcommand (`coordinator frobnicate`) and an unknown flag (`coordinator status --wat`): each returns `fallback.invocation` at exit `1`, no `data`, and a bounded remediation hint.
4. Run each valid subcommand with `--json` and without it: each returns exactly one exclusive envelope (success `data` or failure `error`), never both.
5. Assert `tick` has no `--watch`, `--foreground`, or loop flag and that the invocation returns after one cycle (no process remains, no timer registered).
6. Assert the payload schema string is `delivery.coordinator.v1` for every success path.
7. Assert `coordinator` is present exactly once in the registry/man-page contract and the `ceo-loop.sh` strangler row names coordinator supervision as its replacement.

**Expected Outcome**:
- The grammar is closed and unknown input is classified, never a crash or a silent default.
- Every invocation returns one bounded envelope and one exit digit in `{0,1,2}`.
- `tick` is a one-shot surface; no background loop is started.

**Notes / Clarifications**:
- Per AC-F1-2, `tick`'s one-cycle claim applies to an uncontended state dir; the contended-tick refusal is TC-COORD-043.

#### TC-COORD-004 - The CLI handler is pure and every outcome projects one identity in `{0,1,2}`

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F10-2, NFR-12, F-10, DM-10
**Test Type(s)**: Contract, Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-envelope.test.ts`; `tests/checks/exit-code-literals.test.ts`; `packages/cli/src/commands/coordinator.ts` (expected)
**Tags**: @contract, @backend, @cli

**Preconditions**:
- The coordinator handler and its runtime ports are declared.

**Steps**:
1. Assert the handler owns no stream write and chooses no exit literal; the CLI edge is the only writer and the only projector.
2. Assert every handler return is either `{ data }` or `{ error: { kind, code, summary? } }`, never both and never neither.
3. Enumerate the Appendix F outcomes and assert each maps to exactly one declared identity and one exit digit; assert every digit is in `{0,1,2}`.
4. Assert success outcomes (start, stop, status, actionable tick, `already-woken`/`no-pickup`/`answered-before-wake`, idempotent no-supervisor stop, idempotent escalated tick) are exit `0` with data.
5. Assert `coordinator.restart-budget-exhausted` and `fallback.invocation` are exit `1`; `coordinator.already-running`, `coordinator.session.kill-failed`, `coordinator.escalation.publish-failed`, `coordinator.wake.delivery-failed`, and `coordinator.process.capability-gap` are exit `2`.
6. Assert no outcome maps to `fallback.internal`; a malformed handler return is contained as `fallback.internal` at exit `2`, never served as data.
7. Non-vacuity: a temp-copy mutant introducing a fourth exit digit or a second identity for one outcome fails naming the outcome.

**Expected Outcome**:
- Exactly one declared identity and one exit digit per outcome; no overlap and no exit outside `{0,1,2}`.
- The handler is stream-free and exit-free; the edge projection is total.
- `fallback.internal` remains a containment path, not a coordinator outcome.

#### TC-COORD-010 - `start --foreground` claims the lease atomically, records the instance, refuses a second supervisor, and rejects a bare start

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-1, AC-F1-4, AC-F8-1, AC-F8-5, F-1, F-8, DM-8, DM-11, EVT-7
**Test Type(s)**: Behaviour, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-start.test.ts`; `tests/fixtures/coordinator/harness.ts`
**Tags**: @backend, @cli, @lease

**Preconditions**:
- Three independent temp state roots exist (A, B, C); no supervisor holds any lease.
- The process-lifecycle fake, injected clock, and injected fence token are ready.
- A recording state port can observe `acquireFence`/`releaseFence` and force one `state.lock.busy` result.

**Steps**:
1. Run `coordinator start --foreground` against root A; assert exactly one `coordinator.fence` record with `action=acquired`, `instanceId`, `holder` (the supervisor's own pid + process start time), `pid`, `processStartTimeMs`, `supervisorMode=foreground`, and `externalUnit=absent`; assert `status` reports `state=running` and the same instance id.
2. Assert the claim ran as one fenced critical section: the recording state port shows `acquireFence` → a re-read of the lease fold and `alive(handle)` under the fence → one append → `releaseFence`, with the re-read occurring after the acquire and before the append.
3. Assert the start receipt carries `scope=state-dir`, `instance`, `pid` (or `-`), `supervisor=foreground`, and `external-unit=absent`.
4. Assert no state write fence handle is held after the lease append: a subsequent append by this process (or a recording fake) acquires and releases its own handle, and no lifetime lock is open.
5. Run a second `coordinator start --foreground` against root A while the first holder is `alive=true`; assert `coordinator.already-running` at exit `2`, the holder named, exactly one acquisition still present, and no second lease record appended.
6. Run `coordinator tick` against root A while the first supervisor holds a live lease; assert the same refusal (AC-F8-1) and no lease record appended by the refused invocation.
7. Run `coordinator start --foreground` against root B; assert it succeeds independently and both instances report their own scope.
8. Run a bare `coordinator start` (no `--foreground`) against a fresh root C; assert `fallback.invocation` at exit `1`, the error names that `--foreground` is required in v1 and that detached or OS-unit hosting is the M1-S18 seam, and no lease record is appended; assert `supervisorMode` is exactly `foreground` and no `detached` value is produced in v1.
9. Force `acquireFence` to return `state.lock.busy` during the claim; assert the start maps to `coordinator.already-running` exit `2`, names the holder only when the lease is readable, and appends nothing.
10. Assert a failed acquisition appends no lease record.

**Expected Outcome**:
- `start --foreground` claims the instance lease in one fenced critical section, records the instance, and reports `running`.
- A second start or a contended tick is `coordinator.already-running` at exit `2` with the holder named and no appended lease, including when the claim's `acquireFence` returns `state.lock.busy`.
- A bare `start` is `fallback.invocation` exit `1`; v1 produces only `foreground`.
- A different state dir is independent; no state write fence is held beyond an append.

**Notes / Clarifications**:
- AC-F8-1 governs the contended case; AC-F8-5 governs the two-handle race (TC-COORD-094); AC-F1-2's one-cycle property is exercised only on an uncontended state dir (TC-COORD-012). The detailed instance fold is TC-COORD-018; the four lease actions and per-append fence recovery are TC-COORD-017.

#### TC-COORD-011 - `stop` is a recorded request, reports `requested`/`not-running`, and is idempotent without a supervisor

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-3, AC-F8-4, F-1, F-8, NFR-6, DM-11, EVT-7
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-stop.test.ts`
**Tags**: @backend, @cli, @lease

**Preconditions**:
- One root has a running supervisor (latest lease `acquired`, holder alive); one has never had one; one has a `released` latest lease; one has a dead holder; one has unknown liveness with an old lease.
- The fake clock and `alive(handle)` fake are injected.

**Steps**:
1. With a running supervisor, run `coordinator stop`; assert it appends exactly one `coordinator.fence` record with `action=stop-requested`, the live holder/instance identity, and reports `requested=true`, `released=false`, exit `0`.
2. Assert `stop` does not release or hold another process's state write fence handle (no `releaseFence` call for a handle this process did not acquire) and does not kill.
3. Advance the fake clock past two `collection-interval`s while the holder is still `alive=true`; run `stop`; assert it still appends one `stop-requested` and reports `requested=true`, `released=false`, exit `0` — lease age never makes a live holder `not-running` (AC-F8-4).
4. Drive the live supervisor to its next cycle boundary; assert it observes the request, stops, and appends exactly one `action=released` record; assert status then reports `state=stopped` and the lease action `released`.
5. With no live supervisor and the latest lease `released`, or the recorded holder `alive=false`, or `alive` unknown and the lease age greater than two intervals, run `coordinator stop`; assert exit `0`, `not-running`, and **no** record appended.
6. Run `stop` twice in a row on the stopped root; assert both are exit `0`, `not-running`, and append no new record.
7. Assert a stop request never takes over the lease, never fabricates a release, and never reports `released=true` for another process.

**Expected Outcome**:
- A live `stop` appends one `stop-requested` record and reports `requested=true`/`released=false`, regardless of lease age while the holder is alive.
- The live supervisor appends `released` at its next cycle boundary; only then does status report stopped/released.
- A no-supervisor, dead-holder, or old-unknown-liveness stop is an idempotent `not-running` success at exit `0` with nothing appended, and no cross-process handle is released.

#### TC-COORD-012 - `tick` claims the lease, runs exactly one bounded cycle, exposes persisted stuck and `tickVerdict`, and starts no loop

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-2, AC-F8-6, AC-F9-1, AC-F2-6, F-1, F-8, F-9, DM-11, NFR-4, NFR-6
**Test Type(s)**: Behaviour, Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-tick.test.ts`; `tests/golden/coordinator.test.ts`
**Tags**: @backend, @cli, @golden, @lease

**Preconditions**:
- An uncontended temp state root exists; the fake process port, clock, config, and blocker ledger are injected.
- A fresh state dir case, a healthy running case, and a dead-holder case are prepared.

**Steps**:
1. Run `coordinator tick` once on a fresh state dir; assert exit `0`, one bounded cycle, `delivery.coordinator.v1` data with `coordinatorId`, `instance`, `decision`, `wake`, `stuck`, `tickVerdict`, `restarts`, `escalation`, `regime`, `session`, `fence`, and `degradation`.
2. Assert the fresh state dir is a verified-empty record set, the decision is `spawn-fresh` with reason `initial-start`, and no restart ordinal is consumed.
3. Assert the tick claims the lease through the same atomic path as `start`: one `acquired` (released/absent) then one `released`, or one `stale-takeover` (dead holder) then one `released`; assert the claim re-reads the fold and `alive(handle)` under the fence and releases the lease before returning, leaving no write-fence handle open.
4. Assert the invocation returns after the cycle: the fake records one collection cycle, no timer is registered, and no daemon/child process is spawned.
5. Run `tick` on a healthy running case; assert exactly one cycle and deterministic field values for the injected facts.
6. Assert `data.stuck` is the **last persisted** verdict (`stuck`/`unevaluable`) with non-null `phase`, `reason`, and `evidence`, or `null` when no verdict was persisted; assert the tick result's separate `tickVerdict` carries `verdict` `progressing`/`stuck`/`unevaluable` and that `phase`/`reason`/`evidence` are nullable exactly when `verdict=progressing`.
7. Assert a quiet cycle appends exactly one lease pair and no action record (no restart, stuck, wake, exhaustion, or decision record beyond the lease pair); a second identical tick appends only its own lease pair.
8. Assert the machine payload is ≤ 64 KiB and the human text is ≤ 32 lines.
9. Compare a committed normalized golden byte-for-byte for both cases.

**Expected Outcome**:
- `tick` claims and releases the instance lease through the shared atomic path, performs exactly one bounded collection cycle, and returns every declared field including the persisted-stuck/`tickVerdict` split.
- A fresh state dir is valid and yields `initial-start` with no ordinal; a dead-holder tick takes over (TC-COORD-095).
- A quiet cycle grows the log by exactly its lease pair and no action record; no background loop, timer, daemon, or lifetime write fence is started; output is bounded and golden-stable.

#### TC-COORD-013 - `status [--live]` reports the full state (persisted stuck plus `tickVerdict`) and degrades honestly

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-4, AC-F9-1, AC-F8-2, AC-F8-3, F-9, F-8, DM-11, NFR-13
**Test Type(s)**: Behaviour, Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-status.test.ts`; `tests/golden/coordinator.test.ts`
**Tags**: @backend, @cli, @golden

**Preconditions**:
- Running (foreground), exhausted, and stopped fixtures exist, including a running fixture whose latest lease is older than two intervals.
- Live process facts are available for one case and unavailable for another.

**Steps**:
1. Run `coordinator status` for each fixture; assert it reports the instance from the latest lease (`instanceId`, `pid`, `holder`, `startedAt` = the instance's acquisition record time, `supervisorMode=foreground`, `externalUnit=absent`), state-dir scope, lease holder and last lease action, coordinator session identity and liveness, last decision and reason, restart count and bound, history reference, the **last persisted** stuck verdict with non-null `phase`/`reason`/`evidence` (or null), the separate `tickVerdict` (`progressing`/`stuck`/`unevaluable` with nullable `phase`/`reason`/`evidence` when `progressing`), last wake outcome and question, escalation state and question id, and a bounded degradation list.
2. Assert the human text is deterministic, ANSI-free, and ≤ 32 lines; the machine `data` is `delivery.coordinator.v1` and ≤ 64 KiB.
3. Run `status --live` with live facts available; assert uptime and process facts are reported.
4. Run `status --live` with live facts unavailable; assert the field is `unknown` or a `degraded` entry naming the absence — never a fabricated alive/uptime value.
5. Assert an exhausted fixture reports `exhausted-escalated` or `exhausted-escalation-failed` and the question id (or null on failure), never `escalated`.
6. Assert a stopped fixture reports the durable last decision, last stuck, and last wake; status never mutates state.
7. Assert a running fixture whose latest lease is older than two intervals but whose holder is `alive=true` still reports the live instance with `supervisorMode=foreground` and `externalUnit=absent`; assert no `detached` value is produced in v1 and no `external-unit-absent` value appears as a supervisor mode.
8. Compare committed normalized goldens for one running text and one machine payload.

**Expected Outcome**:
- Status is the complete operational query and is deterministic and bounded.
- The instance identity is folded from the latest lease with the six declared fields and no separate instance record.
- The persisted stuck verdict and the separate `tickVerdict` are distinguishable; `--live` degrades honestly and never fabricates process facts; status reads durable state and appends nothing.

#### TC-COORD-014 - The regime descriptor is shared, is foreground-only in v1, declares the M1-S18 seam, and ships no installer

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F8-2, F-8, DM-8, DEC-1, DEC-6
**Test Type(s)**: Structure, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/coordinator-regime.test.ts`; `tests/behaviour/coordinator-status.test.ts`
**Tags**: @contract, @structure, @backend

**Preconditions**:
- The regime descriptor type/data and the status projection exist.

**Steps**:
1. Assert the descriptor declares state-dir scope, single-instance **instance lease**, unit identity derived from state dir and coordinator identity, a distinct process kind, a distinct budget store, `supervisorMode` exactly `foreground` in v1 (with `detached` reserved in the closed vocabulary), `externalUnit` exactly `absent`, and `daemonInstallSeam: "M1-S18"`.
2. Assert a foreground start records `supervisorMode=foreground` and `externalUnit=absent` in the descriptor and in `status`; assert no v1 code path produces `supervisorMode=detached` and a bare `start` returns `fallback.invocation` exit `1` naming `--foreground` and the M1-S18 seam rather than detaching.
3. Assert the mode vocabulary contains `foreground` and the reserved `detached` value but no `external-unit-absent` member (the absence is a separate `externalUnit` field); assert `detached` is unreachable in v1.
4. Assert the unit identity changes when the state dir or coordinator identity changes and is stable otherwise.
5. Assert no `daemon` command, control socket, lane supervision, or OS unit installer is registered or shipped; scan for systemd/launchd/Windows service files on the coordinator surface.
6. Assert the M1-S18 seam is declared as a tested gap naming M1-S18 in the feature spec and the registry, not as an implemented installer.
7. Non-vacuity: a temp-copy mutant that hardcodes a unit path, produces `supervisorMode=detached`, or adds `external-unit-absent` as a mode fails.

**Expected Outcome**:
- The shared regime descriptor is complete and observable through status.
- `supervisorMode` is exactly `foreground` in v1; `detached` is reserved and never produced; `externalUnit` is exactly `absent`.
- No daemon or OS autostart installer is invented or preempted, and a bare `start` is a classified invocation error naming the seam.

#### TC-COORD-015 - A dead-holder lease is taken over with one recorded `stale-takeover`; a live holder is never taken over

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F8-3, AC-F8-4, F-8, DM-8, DM-11, EVT-7, NFR-6
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-fence-stale.test.ts`
**Tags**: @backend, @lease, @edge

**Preconditions**:
- Cases exist for: holder `alive=false`; `alive` unknown with lease age > 2×`collection-interval`; `alive=true` with lease age > 2×`collection-interval`; `alive=true` with a fresh lease; `alive` unknown with lease age ≤ 2×`collection-interval`.
- The fake clock and process port are injected; a recording `recoverFence` spy and a per-append fence counter are armed.

**Steps**:
1. Seed an `acquired` lease whose recorded holder the fake reports as `alive=false`; run `start --foreground`; assert exactly one `coordinator.fence` record with `action=stale-takeover` that carries the new `holder`, `pid`, `processStartTimeMs`, the old `previousHolder`, and the observed `fenceAgeMs`; assert it is **not** followed by a second `acquired`.
2. Seed an `acquired` lease with `alive` unknown and lease age greater than two collection intervals; run `start`; assert one `stale-takeover` and no second `acquired`.
3. Seed an `acquired` lease with `alive=true` and lease age greater than two collection intervals; run `start`; assert `coordinator.already-running` at exit `2`, no takeover, and no lease record appended — age never overrides a positive `alive`.
4. Seed an `acquired` lease with `alive=true` and a fresh lease; run `start`; assert the same refusal and no append.
5. Seed an `acquired` lease with `alive` unknown and lease age at most two collection intervals; run `start`; assert `coordinator.already-running` exit `2`, no takeover, and no append (unknown liveness is held until the age fallback).
6. Assert the takeover record is durable across a reopened store handle and readable from `coordinator status` (`instance.instanceId`, `fence.holder`/`fence.action`/`fence.previousHolder`/`fence.fenceAgeMs`); assert the instance folds to the new holder and `startedAt` is the takeover record time.
7. Assert the decision was made under one fenced critical section (`acquireFence` → re-read fold and `alive(handle)` → append one `stale-takeover` → `releaseFence`); assert no `recoverFence` call was used for the lease decision and `packages/core/src/contracts/state.ts` is unchanged (an age-stale **state fence** recovery belongs only to the per-append helper, TC-COORD-017).
8. Assert a crash immediately after the takeover leaves the new holder recorded as the latest acquisition (the single `stale-takeover` is the acquisition).
9. Non-vacuity: a fixture with a live holder must not be taken over at any age.

**Expected Outcome**:
- A dead holder (or an unknown holder past the age fallback) is taken over with exactly one `stale-takeover` record that is itself the new acquisition; there is never a second `acquired`.
- A live holder is refused regardless of lease age; unknown liveness with a young lease is refused.
- Takeover evidence is durable and readable; no `recoverFence` and no state-contract change is used for the lease decision; a live holder is never signalled.

#### TC-COORD-016 - `--fresh-budget` is a start-time option and requires a stopped supervisor

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F1-1, AC-F1-3, AC-F5-5, F-1, F-5, DM-11
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-fresh-budget.test.ts`
**Tags**: @backend, @cli, @edge

**Preconditions**:
- A live supervisor case and a stopped/exhausted case exist.

**Steps**:
1. With a live supervisor (live lease), run `coordinator start --fresh-budget`; assert `coordinator.already-running` at exit `2`, the holder named, a hint to stop first, and no new epoch created.
2. Assert no restart record, no epoch record, no lease record, and no escalation change occurs on the refusal.
3. Request `stop` (which appends `stop-requested`), drive the supervisor to observe it and append `released`, then run `coordinator start --fresh-budget`; assert success, a new budget epoch at count `0`, and the old epoch plus its escalation still readable in history.
4. Assert `--fresh-budget` is rejected on `stop`, `status`, and `tick` with `fallback.invocation` exit `1`.
5. Assert the fresh-budget start claims the instance lease in one fenced critical section and appends one `action=acquired` record (not `stale-takeover`, because the lease is `released`) and records the instance identity.

**Expected Outcome**:
- `--fresh-budget` is a start-time option only and is refused while a live supervisor holds the lease.
- After a stop request and the supervisor's `released`, it opens a new epoch at zero and preserves old history.
- The refusal is classified and appends nothing.

#### TC-COORD-017 - `coordinator.fence` records acquisition, release, single-record stale takeover, stop request, and per-append fence recovery durably

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-1, AC-F1-3, AC-F8-1, AC-F8-3, AC-F8-5, AC-F9-1, AC-F10-3, F-8, EVT-7, DM-11, NFR-6
**Test Type(s)**: Behaviour, Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-fence-records.test.ts`; `tests/structure/coordinator-contract.test.ts`
**Tags**: @backend, @lease, @state

**Preconditions**:
- A fresh temp state root with no holder; a second root with a dead holder seeded; a third root with a live old holder.
- The fake clock and injected fence tokens are ready; a fresh store handle can be reopened over the same root.
- A recording state port counts `acquireFence`/`releaseFence`/`recoverFence` calls per append and can force `state.lock.busy` (stale and non-stale) and `state.write.failed`.

**Steps**:
1. Acquire the lease via `start --foreground`; assert exactly one `coordinator.fence` record with `action=acquired`, `instanceId`, the new `holder`, `pid`, `processStartTimeMs`, `supervisorMode=foreground`, `externalUnit=absent`, `previousHolder=null`, `fenceAgeMs=null`, and `recordedAt`; assert `status` reports `instance.instanceId`, `fence.holder`, and `fence.action=acquired`.
2. Request `stop` from another process; assert exactly one `action=stop-requested` record with the live holder/instance identity, and that `released` is still absent (the lease is not released by the request) even when the lease is older than two intervals.
3. Drive the live supervisor to append `action=released`; assert exactly one `action=released` record with the releasing holder and null previous/age; assert `status` reports `fence.action=released` and `fence.holder=null`.
4. Seed a dead holder and start; assert exactly one `action=stale-takeover` record with the new `holder`, the old `previousHolder`, the observed `fenceAgeMs`, and `recordedAt`, and assert there is **no** following `action=acquired`; assert `status` exposes the takeover fields and folds the instance to the new holder.
5. Seed a live holder whose lease is older than two intervals and start; assert `coordinator.already-running` exit `2` with no lease record appended (liveness-first; age never overrides a positive `alive`).
6. Reopen a fresh store handle over the same root and assert the lease sequence and status projection are reconstructed from durable state alone, with the latest record by ledger sequence as the instance (GAP-T4).
7. Assert every fence record validates kind/schema/required fields/vocabulary on read; a torn fence record is `unevaluable` and never yields a fabricated holder or action.
8. Assert each append acquires the delivered state write fence for that append only and releases it immediately: the recording state port shows one acquire/release pair per record and no lifetime handle. Force `acquireFence` to return `state.lock.busy` with `fenceStatus().stale=true`; assert exactly one `recoverFence` is called and the append retries once and succeeds. Force it busy with a non-stale fence; assert the append returns `state.lock.busy` at exit `2` with no record. Force a write failure; assert `state.write.failed` at exit `2` with no record. Assert `packages/core/src/contracts/state.ts` is unchanged.
9. Assert exactly one record per action; a refused contended start appends no lease record (AC-F8-1); no action record carries content beyond identities/counts/age; assert the acquisition, stop request, release, and takeover each use the same atomic claim/append discipline; assert no heartbeat or lease-refresh record is written for a live holder (the fence action set stays exactly the four declared actions) and a quiet live interval does not extend or rewrite `fenceAgeMs`.

**Expected Outcome**:
- Acquisition, stop request, release, and stale takeover each append one validated durable `coordinator.fence` record; takeover is a single `stale-takeover` with no following `acquired`.
- Takeover evidence (`holder`, `previousHolder`, `fenceAgeMs`) is readable from durable state and `status`; a live old holder is refused.
- The per-append helper recovers one age-stale state fence via `recoverFence` and retries once, otherwise returns `state.lock.busy`/`state.write.failed` at exit `2`; no `contracts/state.ts` change is needed.
- The lease fold is latest-wins by ledger sequence, the four actions are the only actions, and a refusal or torn record never fabricates a holder or an action.

**Notes / Clarifications**:
- Pinned by EVT-7/DM-11 (spec v1.3): the fence record is the append-only instance lease; `previousHolder` and `fenceAgeMs` are `null` except on `stale-takeover`; `stop-requested` does not release the lease; a `stale-takeover` is itself the new acquisition and is never followed by `acquired`; each append uses the per-append state-fence helper (one age-stale `recoverFence` + one retry, else `state.lock.busy`/`state.write.failed`).
- Record-kind/schema-id spellings remain delivery-bound (GAP-T5); the test reads them from the contract and asserts one-home and closedness (TC-COORD-001).

#### TC-COORD-018 - The instance identity is folded from the latest lease by ledger sequence; no separate instance record exists

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-1, AC-F1-3, AC-F1-4, AC-F8-1, AC-F8-3, AC-F9-1, F-1, F-8, F-9, DM-11, EVT-7
**Test Type(s)**: Behaviour, Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-instance-lease.test.ts`; `tests/structure/coordinator-contract.test.ts`
**Tags**: @backend, @lease, @contract

**Preconditions**:
- A lease sequence is seeded: `acquired` (instance A) → `stop-requested` (A) → `released` (A) → `stale-takeover` (previous A, new B).
- A foreground-start root and a root whose latest lease record is old but whose holder is alive exist.
- The contract record-kind set is imported.

**Steps**:
1. Read `status` after instance A's `acquired`; assert `instance.instanceId=A`, `pid`, `holder`, `startedAt` = A's acquisition record time, `supervisorMode=foreground`, and `externalUnit=absent`.
2. Append `stop-requested` for A; assert the reported instance identity does not change (`startedAt` is still A's acquisition time) and the lease action is `stop-requested`.
3. Append `released` for A; assert `status` reports the `released` action and does not fabricate a running instance or a new `startedAt`.
4. After the single `stale-takeover` for B (no following `acquired`), assert the instance folds to B: new `instanceId`, `pid`, `holder`, `startedAt` = the takeover record time, `supervisorMode=foreground`, `externalUnit=absent`, with `previousHolder`/`fenceAgeMs` visible on the takeover record.
5. Assert a foreground start reports `supervisorMode=foreground` and `externalUnit=absent`; assert the v1 surface never produces `detached` (a bare start is `fallback.invocation`, not a detached instance).
6. Assert the record-kind set is still exactly six (`iteration`, `restart`, `stuck`, `exhaustion`, `wake`, `fence`) and contains no `coordinator.instance` kind; assert `delivery.coordinator.v1` has an `instance` field derived from the lease and no separate `instanceRecord` payload.
7. Assert the latest record **by ledger sequence** is the sole instance identity: an older `acquired` record does not override a later `released`/`stale-takeover`, and a `recordedAt` that ties or inverts does not change the fold; a running fixture whose lease is old but whose holder is alive still folds to the live instance.

**Expected Outcome**:
- The instance identity is exactly the six declared fields folded from the latest `coordinator.fence` record by ledger sequence.
- `stop-requested` and `released` do not fabricate a new instance or rewrite `startedAt`; a single `stale-takeover` is the new acquisition.
- No separate instance record kind or payload exists; the record-kind set stays six; v1 produces only `foreground`.

**Notes / Clarifications**:
- Pinned by AC-F1-4/EVT-7/DM-11 (spec v1.3): the fence record is the instance identity folded by **ledger sequence**; `startedAt` is the acquisition record time (`acquired` or `stale-takeover`). TC-COORD-017 covers the action matrix and per-append fence recovery; this TC isolates the identity fold.

#### TC-COORD-020 - A live session records `join-live` and consumes no ordinal

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-1, F-2, DM-1, DEC-7, SC-M1-25
**Test Type(s)**: Behaviour, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-decision-join.test.ts`
**Tags**: @backend, @domain, @lifecycle

**Preconditions**:
- A durable coordinator session record reports a live session.
- The restart ledger is empty or has a fixed count; the fake process port records calls.

**Steps**:
1. Evaluate the lifecycle decision with the live-session fact.
2. Assert the decision is `join-live` and the iteration record carries the session identity, the context reading (or explicit absence), the reason, the digest fingerprint, the expectation window, and `recordedAt`.
3. Assert zero restart records are appended and the count is unchanged.
4. Assert the port records no `spawn` and no `resume`; an attach/observe call is the only interaction (or none, if join is observation-only).
5. Assert the decision record is written before any attach/observe effect.
6. Run the evaluation twice with identical facts; assert the same decision and no duplicate iteration record.

**Expected Outcome**:
- `join-live` is recorded with the full decision payload and consumes no ordinal.
- Nothing is spawned or resumed.
- Re-evaluation is deterministic and non-duplicating.

#### TC-COORD-021 - A resumable unclean session records `resume-context` without re-paying prefill

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-2, F-2, DM-1, DM-2, DEC-7, SC-M1-25
**Test Type(s)**: Behaviour, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-decision-resume.test.ts`
**Tags**: @backend, @domain, @lifecycle

**Preconditions**:
- No live session; the prior session did not complete cleanly, is resumable, has a known context below `coordinator.resume-context-limit`, and the port declares resume.

**Steps**:
1. Evaluate the lifecycle decision.
2. Assert the decision is `resume-context`, the reason is the declared resume reason, the session identity is the existing one, and the context reading is the known value.
3. Assert exactly one restart record is appended with the next contiguous ordinal and the classified reason.
4. Assert the port records exactly one `resume` call with the existing handle and zero `spawn` calls; assert no new session identity and no prefill re-pay marker.
5. Assert the decision and restart records are written before the resume effect.
6. Repeat with the context exactly at the limit minus one and at the limit; assert the boundary is respected per the declared domain (> 0 and below the limit resumes).

**Expected Outcome**:
- `resume-context` is recorded with the existing session and known context.
- Exactly one ordinal is consumed and the resume path is used, not spawn.
- The boundary value is honoured.

#### TC-COORD-022 - `spawn-fresh` recovery reasons each consume exactly one ordinal

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-3, F-2, DM-1, DM-2, DEC-7
**Test Type(s)**: Behaviour, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-decision-spawn.test.ts`; `tests/fixtures/coordinator/lifecycle.ts`
**Tags**: @backend, @domain, @lifecycle, @matrix

**Preconditions**:
- Three fixtures: context at/above the limit (`context-pressure`), a known-but-unknown reading or an unsupported context source (`context-unknown`), and an interrupted non-resumable/undeclared-resume session (`session-interrupted`).

**Steps**:
1. Evaluate each fixture and assert the decision is `spawn-fresh` with the respective reason.
2. Assert each recovery reason appends exactly one restart record with the next contiguous ordinal and the same reason.
3. Assert exactly one `spawn` call per fixture and zero `resume` calls.
4. Assert the decision/restart records carry the prior session identity (or an explicit absence) and never fabricate the new session identity before the port returns it; the new identity appears only from the spawn result.
5. Assert the reason vocabulary is closed: no other reason appears for a recovery.
6. Assert the `context-unknown` case never fabricates a context number and records the explicit absence.

**Expected Outcome**:
- The three recovery reasons are each classified and each consumes exactly one ordinal.
- Spawn is used, resume is not, and an unknown context is never fabricated.
- The boundary between recovery and non-recovery is explicit.

**Notes / Clarifications**:
- Pinned by AC-F2-3/DEC-7: an undeclared or unavailable harness resume is a decision input, not an error — the `session-interrupted` fixture selects `spawn-fresh`, consumes one recovery ordinal, and returns exit `0` with no error identity. Harness spawn gap/refusal and process-port alive/kill gaps are tested separately in TC-COORD-044.

#### TC-COORD-023 - `spawn-fresh` for a first start or a clean end consumes no ordinal

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-6, F-2, DM-1, DM-2
**Test Type(s)**: Behaviour, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-decision-spawn.test.ts`; `tests/fixtures/coordinator/lifecycle.ts`
**Tags**: @backend, @domain, @lifecycle

**Preconditions**:
- No prior session (`initial-start`) and a prior session that completed cleanly (`clean-iteration-end`).

**Steps**:
1. Evaluate the no-prior-session fixture; assert `spawn-fresh` with reason `initial-start`, zero restart records, and zero ordinal consumed.
2. Evaluate the clean-completion fixture; assert `spawn-fresh` with reason `clean-iteration-end`, zero restart records, and zero ordinal consumed.
3. Assert exactly one `spawn` call per fixture and no `resume`.
4. Assert the clean-completion fixture reads the completion record and does not treat a clean end as an interruption.
5. Assert a first start on a fresh state dir is not an error and records the expected decision.

**Expected Outcome**:
- Normal iteration starts and clean re-entries do not consume the recovery budget.
- The decision is still recorded and applied.
- A fresh state dir is a valid initial start.

#### TC-COORD-024 - A mid-iteration kill resumes/respawns without re-executing closed-out work

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-4, F-2, F-5, DM-1, DM-2, SC-M1-25
**Test Type(s)**: Behaviour, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-decision-recovery.test.ts`
**Tags**: @backend, @lifecycle, @recovery

**Preconditions**:
- A state root contains pre-existing closed-out phase-transition, merge, and blocker-answer records.
- The coordinator session record reports a mid-iteration kill with no completion record; the context is below or above the limit in two cases.

**Steps**:
1. Run the next `tick`; assert the lifecycle decision is `resume-context` (below limit) or `spawn-fresh context-pressure` (at/above).
2. Assert the decision and exactly one restart record are appended; the prior session is not marked clean.
3. Snapshot the closed-out phase, merge, and answer records before and after; assert they are byte-unchanged and no duplicate phase transition, merge, or answer record is appended.
4. Assert the recording fake shows no re-execution of a closed-out phase/merge/answer action (zero calls into those seams).
5. Assert the new session (or resumed session) is the only lifecycle effect.

**Expected Outcome**:
- Recovery follows the recorded decision and consumes one ordinal.
- Closed-out artifacts remain present and are not re-executed.
- No duplicate business record is created by recovery.

#### TC-COORD-025 - The recorded decision survives a supervisor restart

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-5, F-2, F-9, NFR-7
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-decision-durability.test.ts`
**Tags**: @backend, @state, @durability

**Preconditions**:
- A decision and its restart record have been written through one store handle.
- The writer handle is closed before the read.

**Steps**:
1. Write a `resume-context` decision and its ordinal through handle A; close A and its edge.
2. Open a fresh store handle B over the same temp root; run `coordinator status`.
3. Assert the decision kind, reason, session identity, context reading, iteration identity, and restart ordinal are reported from durable state alone.
4. Assert no in-memory cache is required: a new process-local evaluation with no prior state still sees them.
5. Assert a supervisor restart (new instance, same root) does not reset the count or rewrite the decision.
6. Assert the decision record is not duplicated by the restart.

**Expected Outcome**:
- The decision and ordinal are durable and status-readable after a supervisor restart.
- No cached counter or in-memory-only fact is required.
- The restart adds no duplicate decision record.

**Notes / Clarifications**:
- GAP-T4: durability is proven at the closed-and-reopened store boundary; no second OS process is required.

#### TC-COORD-026 - Ordinal accounting is consistent across all six decision outcomes

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-1, AC-F2-2, AC-F2-3, AC-F2-4, AC-F2-5, AC-F2-6, AC-F5-2, F-2, F-5, DM-1, DM-2
**Test Type(s)**: Behaviour, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-ordinals.test.ts`; `tests/fixtures/coordinator/lifecycle.ts`
**Tags**: @backend, @domain, @lifecycle, @matrix

**Preconditions**:
- A six-outcome matrix: join-live, resume-context, spawn-fresh(initial-start), spawn-fresh(clean-iteration-end), spawn-fresh(context-pressure), spawn-fresh(context-unknown), spawn-fresh(session-interrupted) — with the last three each expected to consume one ordinal.

**Steps**:
1. For each outcome, run one evaluation against a fixed ledger and record whether an ordinal was appended.
2. Assert exactly the three recovery outcomes append one ordinal; join-live and the two non-recovery spawn outcomes append none.
3. Assert ordinals are contiguous from `1` across consecutive recovery evaluations within an epoch and never reused.
4. Assert the decision record is written before the restart record and before the action for every row.
5. Assert a recovery that is refused at the bound (TC-COORD-052) is not counted as an ordinal here; the matrix only covers admitted decisions.
6. Non-vacuity: a temp-copy mutant that consumes an ordinal for `initial-start` or `join-live` fails naming the row.

**Expected Outcome**:
- Ordinal accounting is one rule, applied identically to every decision.
- The distinction between normal starts and recoveries is enforced.
- The order (decision → restart → action) is uniform.

#### TC-COORD-029 - The adapter maps `token-delta`/`session-traffic` to a new turn and progress-bound; absent is `unknown`

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-1, AC-F3-2, AC-F3-3, F-3, DM-7, DEC-4, NFR-1, NFR-2, NFR-9
**Test Type(s)**: Behaviour, Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-new-turn.test.ts`; `tests/fixtures/coordinator/process-port.ts`; process-lifecycle adapter (expected)
**Tags**: @backend, @adapter, @stuck, @mapping

**Preconditions**:
- Delivered harness liveness-report fixtures with a positive `token-delta`, a positive `session-traffic`, zero/negative readings, and an absent/unsupported reading.
- Config fixtures with the default `coordinator.progress-bound=300000` and explicit values.
- A recording adapter fake so the domain receives `newTurn`/`progressing` facts rather than raw liveness fields.

**Steps**:
1. With a delivered liveness report whose `token-delta` is positive since the expectation, assert the adapter yields `newTurn=true` and `progressing=true`.
2. With a positive `session-traffic` reading instead, assert the same `newTurn=true`/`progressing=true`; either positive reading is sufficient.
3. With both readings zero or negative, assert `newTurn=false` and `progressing=false` (present but not positive, not `unknown`).
4. With the reading absent or unsupported, assert `newTurn=unknown` and `progressing=unknown`, never `false` or `0`, and assert no error identity is raised.
5. Assert the mapping lives only in the process-lifecycle adapter (beside the harness adapters) and consumes the delivered liveness report's `token-delta`/`session-traffic`; the pure domain receives the mapped facts and reads no CPU.
6. Assert `coordinator.progress-bound` defaults to `300000` ms and is config-driven: a positive progress reading within the bound vetoes a stuck verdict; a reading older than the bound does not; no `300000` or other bound literal exists in the decision code.
7. Assert next-tick/caller-bounded semantics: the veto is evaluated on each `tick`; a caller ticking slower than `coordinator.collection-interval` is caller-bounded and does not violate the policy, and no wall-clock timer is started.
8. Non-vacuity: mutants that map absent→zero, ignore `session-traffic`, hardcode the progress bound, or read CPU fail naming the seam.

**Expected Outcome**:
- A new turn is exactly a positive `token-delta` OR positive `session-traffic` from the delivered harness liveness facts, mapped at the adapter.
- Absent/unsupported maps to `unknown`, never to zero or stale.
- `coordinator.progress-bound` (default 300 000 ms) is the config-driven veto window, and the assertion is next-tick/caller-bounded.

#### TC-COORD-030 - A stuck verdict is the full two-phase artifact-evidence conjunction

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-1, AC-F4-1, F-3, F-4, DM-3, DEC-4, EVT-3, SC-M1-25
**Test Type(s)**: Behaviour, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-stuck-verdict.test.ts`
**Tags**: @backend, @domain, @stuck

**Preconditions**:
- An expectation exists and its `coordinator.stuck-window` has elapsed on the injected clock.
- All three evidence classes are stale; no positive sourced progress.

**Steps**:
1. Evaluate the stuck check; assert the verdict is `stuck`.
2. Assert the **first** append is one `coordinator.stuck` record with `phase=verdict`, the stuck id, coordinator id, iteration id, verdict, closed `reason=stuck-artifact-evidence`, bounded `key=value` evidence, and `killOutcome=not-attempted`; assert it lands **before** any kill or restart.
3. Drive the kill; assert a **second** append with `phase=outcome` and the **same `stuckId`** (the active expectation's `iterationId`), carrying the resulting `killOutcome` (`terminated`, `forced`, or `failed`) and `killFailureReason` (`identity-mismatch` or null). Assert the outcome is never written onto the verdict record, and there is no update-in-place path.
4. Assert the read fold is deterministic latest-wins per `stuckId` by **ledger sequence** (`recordedAt` is descriptive only and never the tie-break): the `phase=outcome` record is the effective outcome, and a replay of the same evaluation appends nothing.
5. Assert the evidence corpus names each class and its state, the window, and only the state event-log cursor plus open coordinator-question count references — identities/counts only, no question text, no ready-to-merge/tracker/CI value.
6. Assert a `progressing` verdict is not persisted as a record.
7. Assert the verdict `reason` is `stuck-artifact-evidence` and the subsequent restart record carries the same classified restart reason.
8. Assert one expectation is active and `stuckId` equals its `iterationId`; assert a different iteration yields a different `stuckId`, so the replay guard is derivable from durable state.

**Expected Outcome**:
- The full conjunction yields exactly one `stuck` verdict in two ordered appends under one `stuckId`.
- `phase=verdict`/`killOutcome=not-attempted` precedes the kill; `phase=outcome` follows with the actual outcome; latest-wins fold is deterministic and a replay appends nothing.
- `progressing` is a transient result, not a durable record; the fingerprint is state-sourced only.

**Notes / Clarifications**:
- Pinned by AC-F3-1/AC-F4-1/EVT-3/Appendix E (spec v1.3): the `coordinator.stuck` record is two-phase under one `stuckId` = the active expectation's `iterationId`; the kill outcome is a second append, never an update; the fold is by ledger sequence. TC-COORD-039 pins the reason vocabulary and the verdict/reason coupling.

#### TC-COORD-031 - The advanced/stale/unknown evidence matrix is total and deterministic

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-1, AC-F3-3, F-3, DM-3, NFR-1
**Test Type(s)**: Behaviour, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-stuck-matrix.test.ts`; `tests/fixtures/coordinator/evidence.ts`
**Tags**: @backend, @domain, @stuck, @matrix

**Preconditions**:
- A committed 3×3×3 matrix over `digest-consumed`, `merge`, and `answer` with states `advanced`, `stale`, `unknown`.
- A fixed window-expired clock and zero sourced progress.

**Steps**:
1. For each row, assert the verdict:
   - any `advanced` class → not `stuck`;
   - no `advanced`, at least one `stale`, and not all `unknown` → `stuck`;
   - all `unknown` → `unevaluable`.
2. Assert a `digest-consumed` `advanced` requires both a fingerprint advance and a new session turn (the couple is fixed per row).
3. Assert `unknown` is disclosed in the evidence and never written as `stale`.
4. Assert the verdict and evidence are byte-identical across two runs of the same row.
5. Assert a stale class on a verified-empty store is legitimate (a count of zero is `stale`, not `unknown`).
6. Assert only `stuck` and `unevaluable` are persisted.

**Expected Outcome**:
- The matrix is total and matches the spec's rules row for row.
- `unknown` is never fabricated as stale and an advanced class always prevents `stuck`.
- Verdicts are deterministic.

#### TC-COORD-032 - A fingerprint advance without a session turn does not count as consumed; the fingerprint is state-sourced only

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-1, F-3, DEC-4, DM-7
**Test Type(s)**: Behaviour, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-stuck-fingerprint.test.ts`
**Tags**: @backend, @domain, @stuck

**Preconditions**:
- An expectation exists; the digest-input fingerprint (state event-log cursor + open coordinator-audience question count only) advances after it.
- The coordinator session produces no new turn in the first case and a new turn in the second.

**Steps**:
1. With fingerprint advanced and no new session turn, and merge/answer stale, evaluate; assert the `digest-consumed` class is not `advanced` and the verdict is `stuck` (window elapsed, no progress).
2. With fingerprint advanced and a new session turn (positive `token-delta` or `session-traffic`), and merge/answer stale, evaluate; assert `digest-consumed` is `advanced` and the verdict is not `stuck`.
3. Assert the fingerprint changes when the state event-log cursor advances and when the open coordinator-audience question count changes; it is bounded and opaque and contains no question text.
4. Assert the fingerprint does **not** read a ready-to-merge count and performs no tracker, CI, or network read; a recording network/tracker fake is never invoked, and a mutant that adds a ready-to-merge input fails.
5. Assert the fingerprint is stable when neither input changes.
6. Non-vacuity: a mutant that treats a fingerprint advance alone as consumed fails row 1; a mutant that adds a ready-to-merge input fails row 4.

**Expected Outcome**:
- "Digest consumed" is exactly the spec v1.3 clarification: state-sourced fingerprint advance **and** a new session turn (positive `token-delta` or `session-traffic`).
- The fingerprint has only two state-sourced inputs and no tracker/CI/network/ready-to-merge read.
- A re-run of a command without a turn does not fake progress; the fingerprint is bounded and content-free.

#### TC-COORD-033 - Positive sourced progress within `progress-bound` vetoes a stuck verdict and no kill occurs

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F3-2, F-3, NFR-2, RSK-1
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-stuck-corroborator.test.ts`
**Tags**: @backend, @domain, @stuck, @prefill-safety

**Preconditions**:
- An expectation exists and the window has elapsed; all three artifact classes are stale.
- The sourced progress signal reports a positive `token-delta` or `session-traffic` within `coordinator.progress-bound`.

**Steps**:
1. Evaluate; assert the verdict is not `stuck` (the corroborator vetoes).
2. Assert zero kill calls and zero spawn/resume calls; the kill counter stays `0`.
3. Assert no `coordinator.stuck` record is persisted.
4. Vary the positive signal (`token-delta` only, `session-traffic` only) and assert either positive sourced signal is sufficient to veto.
5. Advance the injected clock past `coordinator.progress-bound` while keeping the reading positive but stale; assert the veto no longer applies and the stale conjunction can yield `stuck`.
6. Negative control: with progress absent and all classes stale, the same fixture yields `stuck` (the veto is not permanent).
7. Assert a CPU-only "busy" fact does not veto (and is ignored) — the structural proof is TC-COORD-037.

**Expected Outcome**:
- A large working session is never killed while sourced progress is positive within `coordinator.progress-bound`.
- The veto is driven by sourced progress, not CPU, and is bounded by the config value.
- The negative control proves the veto is not vacuous.

#### TC-COORD-034 - Absent session signals map to `unknown`, never zero; only a stale artifact can justify a kill

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-3, F-3, DM-3, DM-7, DEC-4
**Test Type(s)**: Behaviour, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-stuck-unknown.test.ts`
**Tags**: @backend, @domain, @stuck

**Preconditions**:
- A harness/capability that cannot source session progress.
- A merge class that advanced, a merge class that is stale, and an answer class that is stale in different cases.

**Steps**:
1. With `token-delta` and `session-traffic` absent/unsupported and the digest fingerprint unchanged, assert the adapter reports `newTurn=unknown`/`progressing=unknown` (never `0` or `false`) and the `digest-consumed` class is `unknown`, disclosed in evidence.
2. With merge stale and answer stale, assert the verdict is `stuck` based on the stale artifact class.
3. With merge advanced (or answer advanced), assert the verdict is not `stuck`; absence of session signals alone never kills.
4. Assert the evidence names the unknown class and the reason (unsupported/absent), never a fabricated `stale` or a zero reading.
5. Assert no kill occurs when the only unknown is the digest class and no artifact class is stale.
6. Assert no failure identity is raised for the absent progress source (it is an `unknown` evidence class, not `coordinator.process.capability-gap`).

**Expected Outcome**:
- An unsupported progress source maps to `unknown` and makes only the digest class `unknown`.
- A stale merge or answer class can still justify `stuck`.
- Absence of session signals alone never triggers a kill or a failure identity.

#### TC-COORD-035 - All-unknown or an unreadable required store yields `unevaluable`, exit `2`, no action

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F3-3, AC-F10-3, F-3, F-10, DM-3, NFR-13
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-stuck-unevaluable.test.ts`
**Tags**: @backend, @domain, @stuck, @fail-closed

**Preconditions**:
- Two fixtures: every class `unknown`, and a required merge/answer store unreadable (torn/unknown).

**Steps**:
1. Evaluate each fixture; assert the verdict is `unevaluable`.
2. Assert one `coordinator.stuck` record with `phase=verdict`, `verdict=unevaluable`, `reason=evidence-unevaluable`, `killOutcome=not-attempted`, and bounded evidence, or the declared state-identity failure path; no fabricated verdict and no `phase=outcome` because no kill is attempted.
3. Assert zero kill, zero spawn, zero resume, and zero restart records.
4. Assert the command exits `2` and returns the delivered `state.store.torn` / `state.store.unknown` / schema identity as declared; no exit `0`.
5. Assert the degradation/evidence names the unreadable store and the class(es) unknown.
6. Assert a subsequent tick with the store repaired evaluates normally (the failure is not sticky).

**Expected Outcome**:
- Unknown state is never a green all-clear and never a kill.
- The state identity and exit `2` are returned as declared.
- Repair restores normal evaluation.

#### TC-COORD-036 - A single torn/unreadable store is unknown, never fabricated stale

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-3, AC-F10-3, F-3, F-10, DM-3
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-stuck-torn.test.ts`
**Tags**: @backend, @state, @stuck

**Preconditions**:
- Three fixtures, each corrupting one store (merge, answer, digest inputs) while the other two are valid.
- A verified-empty control store.

**Steps**:
1. Corrupt the merge store; assert the merge class is `unknown`, the answer class is valid, and the verdict is `unevaluable` unless another stale class exists.
2. Corrupt the answer store; assert the same rule for the answer class.
3. Corrupt the digest-input source; assert the digest class is `unknown` and no context/question text is invented.
4. Assert a verified-empty store yields `stale` (legitimate zero), not `unknown`.
5. Assert evidence is bounded and names the store/kind; no raw payload is copied.
6. Non-vacuity: a mutant that maps a read failure to `stale` fails.

**Expected Outcome**:
- A read failure is `unknown`; a verified-empty store is `stale`.
- The distinction is proven per store.
- No raw store content or prompt text leaks into evidence.

#### TC-COORD-037 - CPU is never read, structurally or behaviourally

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F3-4, AC-NFR-3, NFR-2, NFR-3
**Test Type(s)**: Structure, Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/coordinator-no-cpu.test.ts`; `tests/checks/coordinator-mutants.test.ts`
**Tags**: @structure, @checks, @no-cpu

**Preconditions**:
- The coordinator domain and adapter modules exist.

**Steps**:
1. AST-scan the decision, stuck, restart, wake, escalation, and render modules for `process.cpuUsage`, `os.loadavg`, `os.cpus`, `/proc/stat`, `getrusage`, or any CPU-shaped field/identifier.
2. Assert no CPU key exists in any coordinator contract, record, evidence corpus, or status payload.
3. Feed a fixture with a high CPU fact and all artifact classes stale and no sourced progress; assert the verdict is `stuck` (CPU is not a veto) and the evidence contains no CPU value.
4. Feed a fixture with zero CPU fact and positive sourced progress; assert the verdict is not `stuck` (CPU is not a kill signal).
5. Non-vacuity: three temp-copy mutants (a CPU read in domain, a CPU field in contracts, a CPU value in evidence) each fail by file and kind.
6. Assert the same scan finds zero model-provider import or call in the decision/render path.

**Expected Outcome**:
- CPU is structurally absent from the decision path and behaviourally ignored.
- The negative control proves the scan and the behavioural assertions are non-vacuous.
- No model call exists on the deterministic surface.

#### TC-COORD-038 - One expectation is active per coordinator and a trigger refreshes it

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F3-1, F-3, EVT-1
**Test Type(s)**: Behaviour, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-expectation.test.ts`
**Tags**: @backend, @domain, @expectation

**Preconditions**:
- Triggers available: start, wake, restart, actionable digest change.

**Steps**:
1. Issue a start expectation; assert exactly one active expectation and one iteration record.
2. Issue a wake trigger before the first expires; assert the window is refreshed and a new iteration record is written, not a second active expectation.
3. Issue a restart trigger; assert the same refresh rule and `trigger=stuck-restart`.
4. Issue an actionable digest change; assert a new iteration record with `trigger=collection`/declared value and `decision=none` when no lifecycle change occurs.
5. Assert an idle, non-actionable digest change does not open an expectation (a quiet world is `idle`, not `stuck`).
6. Assert the expectation window is read from config, not a literal.

**Expected Outcome**:
- At most one expectation is active; a new trigger refreshes it and records a new iteration.
- An iteration record may carry `decision=none` for an expectation-only trigger.
- A quiet world does not manufacture a stuck path.

#### TC-COORD-039 - The stuck record's closed `reason` distinguishes `stuck-artifact-evidence` from `evidence-unevaluable`

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-1, AC-F3-3, AC-F10-3, F-3, DM-3, EVT-3, DEC-4
**Test Type(s)**: Behaviour, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-stuck-reason.test.ts`; `tests/structure/coordinator-contract.test.ts`
**Tags**: @backend, @domain, @stuck, @contract

**Preconditions**:
- Two fixtures: a full stale conjunction with no progress (expects `stuck`) and an all-unknown/unreadable set (expects `unevaluable`).
- The stuck-reason vocabulary and the restart-reason vocabulary are imported from the contract.

**Steps**:
1. On the `stuck` fixture, assert the `coordinator.stuck` records have `phase=verdict` then `phase=outcome`, the same `stuckId`, `verdict=stuck`, and `reason=stuck-artifact-evidence`.
2. On the `unevaluable` fixture, assert `phase=verdict`, `verdict=unevaluable`, `reason=evidence-unevaluable`, and `killOutcome=not-attempted` (no outcome phase).
3. Assert the stuck-reason vocabulary is exactly those two values, that the restart-reason vocabulary is exactly `stuck-artifact-evidence`, `session-interrupted`, `context-pressure`, `context-unknown`, and that the two fields are declared separately and never aliased.
4. Assert an inconsistent couple (`verdict=stuck` with `reason=evidence-unevaluable`, or the reverse) is rejected on read as invalid, never served as truth.
5. Assert a `progressing` verdict is not persisted, so no `progressing` reason exists.
6. Assert `coordinator status` renders `stuck.reason` (`stuck` → `stuck-artifact-evidence`, `unevaluable` → `evidence-unevaluable`).

**Expected Outcome**:
- The stuck `reason` is a closed two-value field coupled to the verdict.
- It is distinct from the restart `reason` and cannot be aliased or mis-paired.
- Status exposes the stuck reason.

**Notes / Clarifications**:
- Pinned by AC-F3-1/AC-F3-3/EVT-3/Appendix E (spec v1.3): the earlier ambiguity about where `stuck-artifact-evidence` lives is resolved — it is the `coordinator.stuck.reason`, not only the restart reason, and the record is two-phase under one `stuckId`.

#### TC-COORD-040 - Kill verifies identity, sends TERM, waits grace, then KILL, and records the two-phase outcome

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F4-1, F-4, DM-3, DM-7, NFR-10, EVT-3, SC-M1-25
**Test Type(s)**: Behaviour, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-kill-grace.test.ts`; `tests/fixtures/coordinator/process-port.ts`
**Tags**: @backend, @process, @kill

**Preconditions**:
- A `stuck` verdict has been recorded for a known session and process-tree handle; its `phase=verdict` record exists with `killOutcome=not-attempted`.
- The fake process port and fake clock are injected; the grace is a declared fixture value; the recorded `pid` + `processStartTimeMs` matches the fake live process.

**Steps**:
1. Invoke the kill; assert the port first verifies the recorded `pid` + `processStartTimeMs` against the live process, then receives TERM on the recorded handle.
2. Advance the fake clock by less than the grace; assert no KILL.
3. Advance to the grace boundary with the fake tree reporting exiting/terminated; assert the outcome is `terminated` and no KILL is sent.
4. In a second case, keep the tree alive through the grace; assert KILL is sent at the boundary and the outcome is `forced`.
5. Assert the kill outcome is recorded as a **second** `coordinator.stuck` append with `phase=outcome` and the **same `stuckId`** (= the expectation's `iterationId`, `terminated`/`forced`), durable across a reopened handle and folded by ledger sequence; assert the verdict record is unchanged.
6. Assert the port is called with the handle only, and the grace value comes from `coordinator.kill-grace`.
7. Assert the kill is followed by the budget check, not by an immediate spawn; the outcome append takes the state write fence for that append only.

**Expected Outcome**:
- Identity is verified before TERM; TERM → grace → conditional KILL is exact.
- `terminated` and `forced` are distinguished and recorded in `phase=outcome` under the same `stuckId`.
- The kill does not bypass the budget check and does not hold a lifetime write fence.

#### TC-COORD-041 - A failed kill is classified at exit `2` and never claims success

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F4-2, AC-F4-4, F-4, DM-3, NFR-12, NFR-13
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-kill-failed.test.ts`
**Tags**: @backend, @process, @kill, @fail-loud

**Preconditions**:
- The fake port is configured to report the tree still alive after KILL (a declared kill error), with a matching recorded identity.
- A separate identity-mismatch control is covered in TC-COORD-045.

**Steps**:
1. Invoke the kill; assert the outcome is `failed` per the declared closed vocabulary and that the `phase=outcome` record carries `killOutcome=failed` with the same `stuckId`.
2. Assert the command returns `coordinator.session.kill-failed` at exit `2` with consequence `unknown` and a bounded remediation hint.
3. Assert the error does not claim `terminated` or `forced`, and the evidence names the failed kill; for a non-identity failure `killFailureReason` is `null` (identity mismatch is TC-COORD-045).
4. Assert the supervisor does not retry the kill forever: a bounded attempt count is recorded and a subsequent tick does not spin.
5. Assert no spawn/resume occurs on a failed kill (the tree is still unmanaged), and the exhaustion/restart path is not falsely advanced.
6. Assert `status` reports the failed kill outcome and the same `stuckId` fold.

**Expected Outcome**:
- A failed kill is loud, classified, and exit `2` with consequence `unknown`.
- Success is never fabricated and retries are bounded.
- No replacement is started while the tree is unmanaged.

#### TC-COORD-042 - The kill target is the recorded handle and tree; no name/pattern/shell path exists

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F4-3, F-4, DM-7, NFR-14
**Test Type(s)**: Structure, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/coordinator-kill-target.test.ts`; `tests/behaviour/coordinator-kill-target.test.ts`
**Tags**: @structure, @security, @kill

**Preconditions**:
- The process-lifecycle adapter and the domain kill call exist.

**Steps**:
1. AST-scan for `exec`, `execSync`, `spawn` with a shell string, `sh -c`, `child_process` in the kill path, and for name/pattern-based termination (`pkill`, `killall`, pattern match, user-supplied free-form target).
2. Assert the kill port's input type accepts only a recorded session/process-tree handle and the grace value; no free-form string target.
3. Drive the kill with a handle whose synthetic session id/label contains shell metacharacters (`;`, `$(...)`, backticks, newline); assert the port receives the exact opaque handle and no shell interpretation occurs (no child shell call recorded).
4. Assert the same handle is the one recorded in the stuck/iteration records.
5. Non-vacuity: a temp-copy mutant that builds a `pkill <name>` string fails with the offending line.

**Expected Outcome**:
- Only the recorded handle/tree is targeted.
- No name, pattern, or shell interpolation exists on the kill path.
- Shell metacharacters are inert data.

#### TC-COORD-043 - No kill exists without the current instance lease; a contended tick is refused and a crashed holder is recoverable by `tick`

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F4-3, AC-F8-1, AC-F8-6, AC-F10-3, F-4, F-8, DM-11, NFR-14
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-kill-fence.test.ts`
**Tags**: @backend, @lease, @kill

**Preconditions**:
- A stuck coordinator exists; the instance lease is held by another live supervisor in one case, held by a dead holder in another, and free in a third.
- A recording process port counts kill calls; a recording state port counts fence acquire/release/recover and can force `state.lock.busy`.

**Steps**:
1. With the instance lease held by a live supervisor, run `tick`; assert `coordinator.already-running` at exit `2`, zero kill calls, zero restart records, and no lease record appended.
2. With a dead holder's lease, run `tick`; assert it claims via one `stale-takeover` (no second `acquired`), runs one cycle, and may then proceed to the kill; assert the tick does not block forever on the dead holder.
3. With the instance lease free or acquired by this cycle, run the kill; assert it proceeds.
4. Assert the kill path checks the current instance lease immediately before the destructive call; a race that loses the lease aborts the kill with the refusal.
5. Assert a `status`/`stop` path never kills.
6. Assert the kill-outcome append acquires the state write fence for that append only and releases it even when the kill fails (finally), so the state dir is not wedged and no handle leaks. Force `state.lock.busy` with `fenceStatus().stale=true`; assert one `recoverFence` and one retry. Force busy with a non-stale fence; assert `state.lock.busy` at exit `2` with no append.
7. Non-vacuity: a mutant that kills before checking the current instance lease, that holds a lifetime write fence, or that treats a dead holder as forever-blocking fails.

**Expected Outcome**:
- Kill is impossible without the current instance lease.
- A contended tick is refused; a crashed holder is recovered by `tick` with a single-record takeover.
- The per-append state write fence is not leaked on failure and recovers one age-stale lock, returning `state.lock.busy` otherwise.

#### TC-COORD-044 - Missing process-port capabilities are a classified gap; the four capability owners stay distinct

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F10-4, AC-F2-3, AC-F3-3, F-10, F-2, F-3, DM-7, DEC-11, NFR-13
**Test Type(s)**: Behaviour, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-capability-gap.test.ts`; `tests/fixtures/coordinator/process-port.ts`
**Tags**: @backend, @process, @capability

**Preconditions**:
- Four independent capability fixtures: harness resume undeclared/unavailable; harness spawn impossible/refused; process-port alive or kill-with-grace absent; progress source absent.
- The destructive-action counter is armed and the fake port records every call.

**Steps**:
1. **Resume unmet** (no live session, interrupted prior, known context below the limit, resume undeclared/unavailable): assert the decision is `spawn-fresh` with reason `session-interrupted`, exactly one recovery ordinal, exit `0`, and **no** error identity (neither `harness.capability.gap` nor `coordinator.process.capability-gap`).
2. **Spawn impossible/refused**: when a needed fresh spawn cannot be performed, assert the delivered `harness.capability.gap` or `harness.spawn.refused` at exit `1`, consequence `not_landed`, and no process-port kill.
3. **Alive/kill unmet**: with alive or kill-with-grace capability absent and a `stuck` verdict, assert `coordinator.process.capability-gap` at exit `2`, zero kill calls, zero restart records, and no destructive action.
4. **Progress absent**: assert the digest class is `unknown`, no error identity is raised, and absence alone never kills (TC-COORD-034/039).
5. Assert each declaration is recorded and visible in `status`/regime as declared/missing, and that one capability gap never masquerades as another owner (a resume gap is not reported as a process gap).
6. Non-vacuity: a mutant that maps an absent resume to an error identity, or an absent kill capability to success, fails naming the owner.

**Expected Outcome**:
- The four capability owners stay distinct: resume → decision input (exit `0`, one ordinal), spawn → harness identity (exit `1`), alive/kill → `coordinator.process.capability-gap` (exit `2`), progress → `unknown` class.
- No destructive action occurs on any gap and declarations are authoritative.
- No capability gap is conflated with another.

**Notes / Clarifications**:
- Pinned by spec v1.3 DEC-11/§8.4: the four-way split is fixed; no fourth behaviour exists and no arbitration is pending. TC-COORD-022 covers the resume decision path in depth; TC-COORD-045 covers PID identity, which is not a capability gap.

#### TC-COORD-045 - A PID/start-time identity mismatch sends no signal and records `identity-mismatch`

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F4-4, AC-F4-2, F-4, DM-3, DM-7, NFR-14, RSK-13
**Test Type(s)**: Behaviour, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-kill-identity.test.ts`; `tests/fixtures/coordinator/process-port.ts`
**Tags**: @backend, @process, @kill, @identity

**Preconditions**:
- A `stuck` verdict has a recorded `pid` + `processStartTimeMs`; its `phase=verdict` record exists with `killOutcome=not-attempted`.
- The fake process port can report the recorded identity as matching or as mismatched (a reused pid with a different start time).
- A recording signal log counts TERM/KILL calls.

**Steps**:
1. Configure the fake live process so the recorded `pid` matches but `processStartTimeMs` differs; invoke the kill; assert the port sends **no signal** (zero TERM, zero KILL) and never signals the reused pid.
2. Assert the supervisor appends a second `coordinator.stuck` record with `phase=outcome`, the **same `stuckId`**, `killOutcome=failed`, and `killFailureReason=identity-mismatch`; assert the `phase=verdict` record is unchanged.
3. Assert the command returns `coordinator.session.kill-failed` at exit `2` with consequence `unknown`, and `status` reports the failed outcome and `identity-mismatch`.
4. Assert no spawn, resume, or restart occurs (the tree is not safely managed) and the budget is not falsely advanced.
5. Matching-identity control: with the same `pid` and matching `processStartTimeMs`, assert the kill proceeds to TERM (it is not blocked by the verification).
6. Non-vacuity: a mutant that signals before verifying, or that records `terminated`/`forced` on a mismatch, fails naming the step.

**Expected Outcome**:
- A `pid` + `processStartTimeMs` mismatch sends no signal and records `killOutcome=failed` with `killFailureReason=identity-mismatch`.
- The outcome is the second `phase=outcome` append under the same `stuckId`; the command exits `2` with `coordinator.session.kill-failed`.
- A matching identity proceeds normally; a reused pid is never signalled.

#### TC-COORD-050 - The restart namespace is the coordinator's, not lane/economics

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-1, F-5, DM-2, DEC-8
**Test Type(s)**: Behaviour, Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-restart-namespace.test.ts`
**Tags**: @backend, @state, @budget

**Preconditions**:
- A temp state root contains lane records under `lane.restart-budget` and economics records under `economics/<workItemRef>`.
- A coordinator restart is admitted.

**Steps**:
1. Append a coordinator restart; assert it lands under `coordinator/<coordinatorId>` with the coordinator restart payload.
2. Assert no record is written under `lane.restart-budget` or `economics/<workItemRef>`.
3. Snapshot the lane and economics records before and after; assert byte-unchanged.
4. Assert the restart record's `budgetEpochId` is a coordinator epoch, not a delivery ref.
5. Assert the coordinator fold does not read the lane/economics budget as its own.
6. Assert a lane/economics record with the same ordinal does not affect the coordinator count.

**Expected Outcome**:
- The coordinator budget is in its own namespace and epoch.
- Lane and economics records are untouched.
- No cross-actor conflation is possible.

#### TC-COORD-051 - A below-bound restart appends the next contiguous ordinal and proceeds

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-2, F-5, DM-2, NFR-6, SC-M1-25
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-restart-admit.test.ts`
**Tags**: @backend, @budget, @restart

**Preconditions**:
- Bound is a fixture value (for example `3`); the ledger has `0`, `1`, or `2` contiguous ordinals.

**Steps**:
1. With count `0`, admit a restart; assert one record with ordinal `1`, the classified reason, the session identity, the epoch, and `recordedAt`.
2. With count `1`, admit; assert ordinal `2`; with count `2`, assert ordinal `3`.
3. Assert the action (resume or spawn) proceeds after the record lands.
4. Assert contiguous ordinals and no duplicate.
5. Assert a below-bound restart at count `bound-1` succeeds exactly once; a second immediate evaluation at the bound refuses (TC-COORD-052).
6. Assert the record carries a previous session identity where the reason requires it.

**Expected Outcome**:
- Each admitted restart appends exactly one contiguous ordinal and proceeds.
- The bound is respected at the boundary.
- The record is complete and classified.

#### TC-COORD-052 - At/above the bound no replacement starts, the refusal is exit `1`, and escalation runs

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F5-3, AC-F6-1, F-5, F-6, DM-2, DM-4, SC-M1-25
**Test Type(s)**: Behaviour, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-restart-exhausted.test.ts`
**Tags**: @backend, @budget, @escalation

**Preconditions**:
- Restart count equals the bound (and a second case exceeds it).
- A prior stuck kill has been recorded.

**Steps**:
1. Attempt a resume/spawn; assert no replacement spawn/resume occurs.
2. Assert no new restart record is appended (the count stays at the bound).
3. Assert `coordinator.restart-budget-exhausted` at exit `1`, consequence `not_landed`, with the history reference.
4. Assert the escalation path runs (TC-COORD-060) and the prior kill remains recorded and is not undone.
5. Assert the command does not return exit `0` and does not silently requeue.
6. Assert a second attempt is the same refusal with no duplicate record.

**Expected Outcome**:
- Past the bound, no replacement starts and the refusal is classified at exit `1` with history.
- The escalation path is triggered.
- A prior kill is durable and not reversed.

#### TC-COORD-053 - The budget survives a supervisor crash; a replay appends nothing

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-4, F-5, NFR-6, NFR-7
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-restart-durability.test.ts`
**Tags**: @backend, @state, @durability

**Preconditions**:
- A ledger with fixed ordinals written through handle A; the writer is closed.
- A fresh handle B and a new supervisor instance.

**Steps**:
1. Reopen the root and read the restart records; assert the count and bound are unchanged.
2. Replay the same restart decision with the same ordinal/session; assert no record is appended and no destructive action is repeated.
3. Assert the fold reads verified records only and requires no cached counter.
4. Assert a crash between the restart record and the action leaves the decision recorded; the next tick does not double-append.
5. Assert the epoch identity is durable and unchanged across the restart.
6. Assert a new supervisor instance converges to the same count.

**Expected Outcome**:
- The count, bound, and epoch survive a crash and are never cached-only.
- A replay is a no-op.
- Recovery after a crash is idempotent.

#### TC-COORD-054 - `start --fresh-budget` opens a new epoch and preserves the old history

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-5, F-5, DM-2, DM-4, NFR-7
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-fresh-budget.test.ts`
**Tags**: @backend, @budget, @epoch

**Preconditions**:
- An exhausted coordinator with a terminal escalation in epoch E1.
- The supervisor is stopped.

**Steps**:
1. Run `start --fresh-budget`; assert a new epoch E2 with count `0` and a new epoch identity.
2. Assert the old epoch E1 and its restart records and escalation receipt remain readable in history.
3. Assert the next admitted restart uses ordinal `1` within E2 and a `restartId` naming E2.
4. Assert the old escalation question is not closed or rewritten by the fresh-budget start.
5. Assert the new epoch's history reference resolves to E1's history for the owner.
6. Assert a fresh budget without a prior epoch starts cleanly.

**Expected Outcome**:
- A new epoch starts at zero and is distinct.
- Old history and escalation are preserved.
- Ordinals restart at `1` only within the new epoch.

#### TC-COORD-055 - A torn/gapped ordinal is unevaluable, never count `0`

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F10-3, AC-F5-4, F-5, F-10, NFR-13
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-restart-torn.test.ts`
**Tags**: @backend, @state, @fail-closed

**Preconditions**:
- Three fixtures: ordinal gapped (`1,3`), a torn restart payload, and an unknown record kind in the coordinator namespace.

**Steps**:
1. Evaluate the budget fold; assert the state is unevaluable.
2. Assert no restart is admitted, no kill is attempted, and no replacement spawns.
3. Assert the delivered state identity (`state.store.torn`/`state.store.unknown`) and exit `2` per the exit matrix; no exit `0`.
4. Assert the count is never reported as `0` for a gapped/torn set.
5. Assert a `status` read reports the unevaluable/degraded state and the state identity, not a fabricated count.
6. Non-vacuity: a mutant that treats a gap as count `0` fails.

**Expected Outcome**:
- A torn or gapped ordinal is unevaluable, not zero.
- No destructive action occurs on unknown budget state.
- The classification and exit are the delivered state identities.

#### TC-COORD-056 - The bound is configuration-driven; budget `0` admits no restart and escalates

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F10-1, AC-F5-2, AC-F5-3, F-10, F-5, DM-6
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-budget-config.test.ts`
**Tags**: @backend, @config, @budget

**Preconditions**:
- Config fixtures set `coordinator.restart-budget` to `0`, `1`, and `10`.

**Steps**:
1. With budget `0`, attempt a restart; assert no restart is admitted, `coordinator.restart-budget-exhausted` at exit `1`, and the escalation path runs.
2. With budget `1`, admit exactly one restart and refuse the second.
3. With budget `10`, admit the declared count.
4. Assert a changed bound is observed at evaluation time (not captured at construction), per the policy-as-data requirement.
5. Assert a hardcoded bound or a default literal in the decision code fails a structural/mutant scan (TC-COORD-080).
6. Assert the bound never comes from `lane.restart-budget`.

**Expected Outcome**:
- The budget is entirely configuration-driven.
- `0` is a valid bound that admits nothing and escalates.
- Boundary behaviour is consistent across values.

#### TC-COORD-060 - Exactly one owner-audience exhaustion question lands, and the receipt follows it

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F6-1, F-6, EVT-6, DM-4, DEC-5, SC-M1-25
**Test Type(s)**: Behaviour, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-escalation-publish.test.ts`
**Tags**: @backend, @escalation, @owner

**Preconditions**:
- Restart exhaustion is observed; the blocker ledger has no open question for this coordinator-and-epoch ref.
- The injected blocker append and state append are recording fakes.

**Steps**:
1. Run the tick; assert exactly one owner-audience `decision-needed` question is published with type/audience/lane `coordinator`, `ref=<coordinatorId>#<budgetEpochId>`, the restart count and bound, the history reference, and the declared options (`restart-fresh-budget`, `park-owner-review`).
2. Assert the question text is bounded and contains no prompt/transcript/secret.
3. Assert publishing uses the delivered `appendBlockerQuestion` path unchanged: it acquires and releases its **own** state write fence for the append, and the tick holds no lifetime write fence; assert no handle-reusing refactor is required and no `state.lock.busy` collision occurs.
4. Assert the terminal `coordinator.exhaustion` receipt lands **after** the question append and carries the same ref, count, history, question id, options, and `terminal:true`; its own append also takes the write fence only for that append.
5. Assert the question id is stable and the receipt references it.
6. Assert no second question and no second terminal receipt is created in the same tick.
7. Assert the first exhaustion tick returns `coordinator.restart-budget-exhausted` at exit `1` (AC-F5-3) while the escalation lands; a later tick with no restart attempt returns the idempotent `exhausted-escalated` state at exit `0` (TC-COORD-061).

**Expected Outcome**:
- Exactly one owner-audience escalation question with the declared payload.
- Publishing composes with the delivered `appendBlockerQuestion` without a handle-reusing refactor; every append takes the write fence for that append only.
- The terminal receipt lands only after the question and references it; no duplicate question or receipt.
- The idempotent state is `exhausted-escalated`.

#### TC-COORD-061 - A repeated exhausted tick is idempotent and leaves the original question open

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F6-3, F-6, DM-4, NFR-6
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-escalation-idempotent.test.ts`
**Tags**: @backend, @escalation, @idempotency

**Preconditions**:
- Exhaustion is already escalated with one open owner question and one terminal receipt.

**Steps**:
1. Run the tick again; assert it reuses the existing open owner question for the same coordinator-and-epoch ref.
2. Assert no second question and no second terminal record is appended.
3. Assert the result is the idempotent `exhausted-escalated` state at exit `0` (never `escalated`).
4. Assert the original question remains open and its answer channel/options are unchanged.
5. Assert the terminal receipt is unchanged.
6. Assert the history reference is unchanged.

**Expected Outcome**:
- Repeat evaluation is an idempotent success.
- No duplicate question or terminal record.
- The original question stays open for the owner.

#### TC-COORD-062 - Publish failure is exit `2`, status says `exhausted-escalation-failed`, and no exit `0` lies

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F6-2, F-6, DM-4, NFR-12, NFR-13
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-escalation-failed.test.ts`
**Tags**: @backend, @escalation, @fail-loud

**Preconditions**:
- The blocker append/read fails with a declared failure (or the question cannot be published).

**Steps**:
1. Run the tick; assert `coordinator.escalation.publish-failed` at exit `2` with consequence `unknown` and a bounded remediation hint.
2. Assert no terminal receipt is appended (the question did not land).
3. Assert `coordinator status` derives `exhausted-escalation-failed` from the restart records and reports no question id (or the failed attempt).
4. Assert the command never returns exit `0` without an escalation receipt.
5. Assert a later tick with the channel repaired publishes exactly one question and then the receipt.
6. Assert the failed attempt does not duplicate an existing open question if one already exists.

**Expected Outcome**:
- Publish failure is loud, classified, and exit `2`.
- Status reports the failure state even without a receipt.
- Repair publishes once and no earlier lie remains.

#### TC-COORD-063 - The reserved escalation slot renders first by index at the cap with the omitted count intact

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F6-1, F-6, EVT-6, DEC-5, NFR-4
**Test Type(s)**: Behaviour, Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-escalation-slot.test.ts`; `tests/golden/coordinator.test.ts`
**Tags**: @backend, @escalation, @render, @cap

**Preconditions**:
- A ledger with eight open questions where the escalation question ranks eighth (seven others ahead).
- A second ledger with ten open questions where the escalation ranks tenth (nine others ahead), and a control ledger with a near-miss escalation-shaped question.

**Steps**:
1. Render `status` and `brief`; assert the escalation question is present in both `typed-questions` and `blocker-questions` even though it is ranked last in its ledger.
2. Assert it is **first by index** — index `0` — in both sections, ahead of every other question, for both the eight-question and ten-question ledgers.
3. Assert the other questions follow in normal shared-rank order (the seven highest-ranked non-escalation questions, asserted by index `1..7`); assert no ninth question renders.
4. Assert the lowest-ranked question is the one displaced and is counted in `omitted`; for the ten-question ledger assert exactly `2` omitted and `truncated=true`.
5. Assert the escalation is selected from the payload alone by `type === "decision-needed"` AND `audience === "owner"` AND `lane === "coordinator"` AND `ref` shape `<coordinatorId>#<budgetEpochId>`; assert exactly one `#` and both sides non-empty.
6. Assert near-miss payloads are **not** selected or rendered first: no `#`, two `#`, empty coordinator side, empty epoch side, wrong lane, wrong audience, wrong type. Assert zero coordinator-state reads (the render read-count is unchanged).
7. Assert the machine/human bounds still hold (at most eight rendered, ≤ 64 KiB / ≤ 32 lines) and the golden is byte-stable.
8. Non-vacuity: a mutant that renders the reserved question in rank position, drops it at the cap, renders nine, or widens the predicate to any owner question each fail.

**Expected Outcome**:
- The escalation renders first by index in both sections at the cap.
- The bound stays at eight, with at most seven others in rank order; the lowest-ranked is displaced and counted as omitted.
- The payload-only predicate selects exactly the exhaustion question and adds no read; ordering of the other questions is otherwise unchanged.

**Notes / Clarifications**:
- Pinned by AC-F6-1/EVT-6/DEC-5 (spec v1.3): the predicate is payload-only (type/audience/lane/ref shape) and adds no coordinator-state read; the reserved question renders first by index, the eight-question bound is unchanged (seven others plus the reserved one). No arbitration is pending.

#### TC-COORD-064 - The reserved slot adds no new anchor, section, or type, and digest/brief agree

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F6-1, F-6, NFR-15, DEC-13
**Test Type(s)**: Behaviour, Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-escalation-surface.test.ts`; `tests/golden/{status-digest,brief}.test.ts`
**Tags**: @backend, @render, @nonregression

**Preconditions**:
- The status digest and brief surface inventories are known.

**Steps**:
1. Assert the digest section id set is unchanged (no `coordinator` section) and `typed-questions` remains the only typed-question surface.
2. Assert the brief anchor set is unchanged (no new `coordinator` anchor) and `blocker-questions` remains the only blocker anchor.
3. Assert the typed-question type set is still exactly the delivered four; `decision-needed` is reused.
4. Assert the digest `typed-questions` projection and the brief `blocker-questions` projection render the same escalation question at index `0`, with the same rank, audience, lane, and omitted count, and the same ordered remaining questions at indices `1..7`.
5. Assert the status/brief golden diff is limited to the reserved-slot case; a control golden without an escalation is byte-unchanged.
6. Assert the status collector remains read-only and performs no coordinator kill/restart.

**Expected Outcome**:
- No new section, anchor, or question type is introduced.
- Digest and brief agree on the escalation question.
- The only golden change is the declared reserved-slot case.

#### TC-COORD-065 - Escalation is idempotent by coordinator-and-epoch and reuses the open owner question

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F6-3, F-6, DM-4, NFR-6
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-escalation-reuse.test.ts`
**Tags**: @backend, @escalation, @idempotency

**Preconditions**:
- Three ledgers: an open owner question for the same ref, an open owner question for a different epoch, and a closed question for the same ref.

**Steps**:
1. Same ref and open: assert reuse, no new question, and a terminal receipt referencing the existing question if missing.
2. Different epoch: assert the existing question is not reused as this epoch's escalation; publish a new one (one per epoch).
3. Same ref but closed: assert a new escalation question is published (the old one is not open) and the terminal receipt is not duplicated for an already-terminal epoch.
4. Assert the reuse predicate is `(coordinatorId, budgetEpochId)` and the `ref` value, not the question text.
5. Assert no duplicate terminal receipt is appended when one already exists.
6. Non-vacuity: a mutant that keys only on coordinator id (ignoring epoch) fails row 2.

**Expected Outcome**:
- Reuse is exact by coordinator-and-epoch and only for an open question.
- A new epoch gets its own escalation; a closed question is not treated as open.
- Terminal receipts are one per epoch.

#### TC-COORD-070 - Strict `isCoordinatorPickup` wakes only rank-1 open coordinator questions

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F7-1, AC-F7-3, F-7, DM-5, DEC-9, NFR-8, SC-M1-25
**Test Type(s)**: Behaviour, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-wake-pickup.test.ts`
**Tags**: @backend, @domain, @wake

**Preconditions**:
- A fixture ledger whose head is rank 1, open, audience `coordinator`.
- A second qualifying head with an **absent** `status` (must count as open).
- Controls: rank 1 owner, rank 1 explicitly `answered`/non-open, rank 2 coordinator, and no questions.

**Steps**:
1. With the qualifying open head, run one `tick`; assert the delivered `isCoordinatorPickup` returns true and exactly one wake is issued.
2. With the rank-1 coordinator-audience head whose `status` is absent, run `tick`; assert `isCoordinatorPickup` returns true (an absent status counts as open), a wake is issued, and `no-pickup` is **not** returned.
3. Assert one `coordinator.wake` record with outcome `woken`, the question id, rank 1, persisted `askedAt`, and the iteration identity.
4. For each control (owner head, explicitly `answered`/non-open head, rank 2 coordinator, empty), assert `isCoordinatorPickup` is false, the outcome is `no-pickup`, no wake is issued, and **no** wake record is persisted.
5. Assert the predicate is payload-determinable: it consumes only rank/status/audience from the ranked read, with no coordinator-state read; assert the status semantics match the delivered predicate (absent = open).
6. Assert the wake happens on the first tick after the question qualifies (one-cycle bound in the tick model; GAP-T2), not after a delay or a second tick.
7. Assert the ranking is the shared `rankBlockerQuestions`, not a second comparator.

**Expected Outcome**:
- Only a rank-1, open (including absent-status), coordinator-audience head wakes.
- `no-pickup` is returned only for non-rank-1, non-coordinator, or explicitly non-open heads (and empty ledgers), with no record.
- The wake is issued in the same bounded cycle.

#### TC-COORD-071 - One wake per question lifetime; a still-top question is `already-woken`

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F7-2, F-7, DM-5, NFR-6
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-wake-dedupe.test.ts`
**Tags**: @backend, @wake, @idempotency

**Preconditions**:
- A question was woken on a prior tick and remains rank 1, open, coordinator-audience.

**Steps**:
1. Run the next tick; assert the outcome is `already-woken` and no second wake is issued.
2. Assert exactly one `woken` record remains for the question and the record count is unchanged; `already-woken` is a no-op tick result that appends no durable wake record (EVT-5), never a second `woken` record.
3. Assert the dedupe key is coordinator identity + question id + `askedAt`, so a re-asked question (new `askedAt`) is a new lifetime.
4. Assert the session is not woken again (zero spawn/resume/attach calls).
5. Assert a different coordinator identity or question id is not deduped against this one.
6. Non-vacuity: a mutant that re-wakes a still-top question fails.

**Expected Outcome**:
- One wake per question lifetime.
- A still-top question is `already-woken` with no second wake or record.
- The dedupe key includes `askedAt`.

#### TC-COORD-072 - A question answered between ranking and wake yields `answered-before-wake`

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F7-4, F-7, DM-5
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-wake-answered.test.ts`
**Tags**: @backend, @wake, @edge

**Preconditions**:
- The verified read ranks a question first; the answer record lands before the wake effect (fixture injects the answer between rank and wake).

**Steps**:
1. Run the tick; assert the outcome is `answered-before-wake`, no wake is issued, and zero spawn/resume/attach calls occur.
2. Assert **no** durable `coordinator.wake` record is appended for `answered-before-wake` (it is a tick result, EVT-5); the wake-record count is unchanged.
3. Assert the next cycle re-evaluates the new ledger and wakes the next qualifying question if one exists (TC-COORD-075).
4. Assert the answer record is untouched and the question is closed.
5. Non-vacuity: a mutant that wakes an already-answered question fails.

**Expected Outcome**:
- An answered question is never woken.
- The outcome is recorded and the next cycle re-evaluates.
- No duplicate wake or session action.

#### TC-COORD-073 - The wake uses the live/resume/spawn path and records the question and iteration

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F7-1, AC-F7-3, F-7, F-2, DM-5
**Test Type(s)**: Behaviour, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-wake-paths.test.ts`
**Tags**: @backend, @wake, @lifecycle

**Preconditions**:
- Three session states: live, resumable non-live, and no-live/non-resumable.
- A qualifying rank-1 coordinator question in each.

**Steps**:
1. Live: assert the wake is a live wake/attach to the existing session; no spawn/resume and no new session; the wake record carries the iteration identity.
2. Resumable: assert the wake resumes the session per F-2 and consumes the declared restart/recovery accounting; no spawn.
3. No-live/non-resumable: assert the wake spawns per F-2 and consumes the declared accounting.
4. Assert every path appends exactly one wake record with `outcome=woken`, question id, rank, and the triggered iteration id (nullable only when no iteration was triggered).
5. Assert the wake decision reuses the lifecycle decision rather than inventing a fourth wake path.
6. Assert the wake record lands after the delivery attempt and reflects its actual outcome.

**Expected Outcome**:
- Wake uses the same lifecycle decision as start/recovery.
- The wake record identifies the question and iteration.
- No fourth, unmanaged wake path exists.

#### TC-COORD-074 - Wake delivery failure is exit `2`, appends nothing, and retries without duplicate records

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F7-5, F-7, DM-5, EVT-5, NFR-6
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-wake-failed.test.ts`
**Tags**: @backend, @wake, @fail-loud

**Preconditions**:
- The wake delivery port fails on the first attempt and succeeds on the next.
- The question remains rank 1, open, coordinator-audience.

**Steps**:
1. Run the tick; assert `coordinator.wake.delivery-failed` at exit `2` with consequence `unknown`; assert **no** durable `coordinator.wake` record is appended (delivery-failed is a tick result) and the record count is unchanged.
2. Assert no `woken` record exists, the one-wake lifetime is not consumed, and the question remains open.
3. Run the next tick with delivery repaired; assert the retry issues the wake and appends exactly one `woken` record.
4. Assert there are no duplicate `woken` records; a further identical tick yields `already-woken` and appends nothing.
5. Assert the retry is bounded and does not spin within one tick.
6. Non-vacuity: a mutant that persists `delivery-failed` or `already-woken`, marks a failed attempt as `woken`, or never retries fails.

**Expected Outcome**:
- Delivery failure is loud, classified, and exit `2`, with no persisted record.
- The next cycle retries and appends the single `woken` record.
- No duplicate `woken` records and the one-wake lifetime is consumed only by success.

**Notes / Clarifications**:
- Pinned by spec v1.3 DEC-9/EVT-5/AC-F7-5: only a successful `woken` persists and consumes the one-wake lifetime; `delivery-failed`, `answered-before-wake`, and `no-pickup` are tick results that append nothing, and `already-woken` is a no-op, so retry cannot duplicate records. The persisted `askedAt` is the lifetime identity. No arbitration is pending.

#### TC-COORD-075 - A new top question after an answered one wakes normally

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F7-6, F-7, DM-5, DEC-9
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-wake-next.test.ts`
**Tags**: @backend, @wake, @edge

**Preconditions**:
- Question A was woken and then answered; question B becomes the new rank-1 open coordinator question.

**Steps**:
1. Run the tick; assert question B wakes and a second `woken` record with B's id is appended.
2. Assert A's wake record is unchanged and A is not re-woken.
3. Assert the one-wake rule is per question, not per coordinator: the coordinator can be woken again for B.
4. Assert the wake record for B carries B's rank/askedAt identity.
5. Assert a question that becomes rank 1 but is owner-audience does not wake (control).
6. Assert two new top questions in sequence each wake once.

**Expected Outcome**:
- A new top question wakes normally after the previous one is answered.
- The one-wake rule is scoped per question.
- No cross-question dedupe.

#### TC-COORD-080 - The six config keys own defaults/domains; invalid input reuses the delivered identities

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F10-1, F-10, DM-6, DEC-10, NFR-1
**Test Type(s)**: Behaviour, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-config.test.ts`; `tests/fixtures/config/**`
**Tags**: @backend, @config, @contract

**Preconditions**:
- A config fixture root with an absent `coordinator` branch, explicit values, and invalid cases.
- The delivered config catalog/resolver/provenance are used unchanged.

**Steps**:
1. Absent branch: assert `stuck-window=600000`, `kill-grace=20000`, `restart-budget=10`, `resume-context-limit=100000`, `collection-interval=30000`, `progress-bound=300000`, each with a `defaults` origin.
2. Explicit values: assert all six are observed and the origin is the declaring layer.
3. Unknown key: assert `config.key.unknown` at the delivered exit projection, naming `coordinator.<key>`; assert there is no seventh coordinator key.
4. Wrong type (string for a number, scalar for the branch) and wrong domain (`stuck-window=0`, negative, fractional; `kill-grace=0`; `resume-context-limit=0`; `collection-interval=0`; `progress-bound=0`, negative, fractional; `restart-budget=-1`/fractional): assert `config.value.invalid`, naming the path.
5. Boundaries: `restart-budget=0` is valid; each positive window/interval/progress-bound at `1` ms is valid.
6. Assert no default or bound literal appears in the lifecycle/stuck/wake/admission decision code; the domain reads the resolved config values (structural scan + mutant), including the `progress-bound` veto window and the pre-TERM kill grace.
7. Assert the collection interval is distinct from `daemon.heartbeat-cycle` and `lane.liveness-interval`, and `progress-bound` is not aliased to `lane.liveness-interval` (no aliasing).
8. Non-vacuity: a mutant that hardcodes `300000` or `20000` in the decision code fails.

**Expected Outcome**:
- The six keys have the declared defaults and domains, including `progress-bound=300000`.
- Unknown and invalid input reuse the delivered identities; boundary values behave as declared.
- No decision-code literal and no cross-key aliasing.

#### TC-COORD-081 - The error table gains the coordinator kind and exactly six rows, with the exact allowlist addition

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F10-2, F-10, DM-10, NFR-12, DEC-11
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/error-table.test.ts` (existing suite, extended); `packages/core/src/contracts/error-table.ts`; `scripts/checks/error-table-sync.ts`
**Tags**: @contract, @backend, @error-table

**Preconditions**:
- `DOMAIN_KINDS` contains `coordinator` exactly once; six rows are appended.
- The reserved two-segment set in both the check and the structure test carries the two added codes.

**Steps**:
1. Assert `coordinator` is in `DOMAIN_KINDS` exactly once and `entries.filter(domainKind === "coordinator")` is exactly the six declared identities in declared order: `coordinator.already-running`, `coordinator.restart-budget-exhausted`, `coordinator.process.capability-gap`, `coordinator.session.kill-failed`, `coordinator.escalation.publish-failed`, `coordinator.wake.delivery-failed`.
2. Assert every row declares code, domain kind, category, retryable, consequence, remediation hint, projection class, and summary, with valid enum values and a non-empty hint.
3. Assert the exit projections match Appendix F: `restart-budget-exhausted` → user-validation exit `1`/`not_landed`; `already-running`, `process.capability-gap` → exit `2`/`not_landed`; `session.kill-failed`, `escalation.publish-failed`, `wake.delivery-failed` → exit `2`/`unknown`.
4. Assert `classifyDomainKind("coordinator", code)`, `resolveAppErrorCode(code)`, and `classifyThrown` round-trip; a wrong code under `coordinator` contains; a kind-only `"coordinator"` contains.
5. Assert the reserved two-segment set is exactly the delivered 22 plus `coordinator.already-running` and `coordinator.restart-budget-exhausted` = **24**, identical in `scripts/checks/error-table-sync.ts` and `tests/structure/error-table.test.ts`, with no `coordinator.*` wildcard and no other addition; a near-miss two-segment `coordinator.not-real` is still rejected; assert the other four coordinator identities are three-segment and need no allowlist entry.
6. Assert the table total is exactly **105** entries (99 + 6), not a floor; the documented coordinator rows appear exactly once each and match column-for-column.
7. Assert the fallback namespace remains exactly `fallback.internal`/`fallback.invocation` and no existing row is modified (committed row fingerprint).
8. Assert the six new codes are recognized in source S1 and documented, so the S1/S3 scanner does not ignore them.

**Expected Outcome**:
- Exactly one new domain kind and six rows; zero existing rows modified.
- The two two-segment codes are allowlisted exactly in both gate files, with exact counts 24 and 105; the other four are three-segment.
- Every row has a declared projection and remediation hint.

**Notes / Clarifications**:
- Pinned by AC-F10-2/DEC-11 (spec v1.3): exactly `coordinator.already-running` and `coordinator.restart-budget-exhausted` join `RESERVED_TWO_SEGMENT_CODES` (set 22→24); the other four are three-segment. A wildcard or a generic two-segment widening is a defect.
- Category/retryability are delivery-declared and asserted as valid/documented, not guessed; the pinned fields are code, domain kind, consequence, projection class, and non-empty hint.

#### TC-COORD-082 - The six documented rows bind two-way and the corpora are non-vacuous

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F10-2, F-10, DM-10, NFR-12, DEC-11
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/error-table-sync.test.ts` (existing suite, extended); `tests/fixtures/result/code-corpora/*.json`; `doc/spec/features/feature-result-contract.md`
**Tags**: @contract, @backend, @error-table

**Preconditions**:
- The six rows and their documented rows land in the same delivery phase.
- The `coordinator` documented heading exists.

**Steps**:
1. Run `bun run scripts/checks/error-table-sync.ts`; assert zero failures, 105 source entries, 105 documented rows, and all six codes recognized in S1.
2. For each code, assert the documented row appears exactly once and matches every column.
3. Add one true-positive corpus row per new code and assert the corpora pass; add no false-positive row that masks a real code.
4. Temp-copy mutation: delete one documented row → the check fails naming the undocumented source entry.
5. Temp-copy mutation: mismatch a hint/projection → the check fails naming the field.
6. Temp-copy mutation: insert a source row with no documented row → the check fails naming the code.
7. Temp-copy mutation: add a near-miss two-segment `coordinator.not-real` in source → the check fails on code format (not allowlisted).
8. Assert the existing rows keep their documented rows, the 99→105 count is exact, and the two two-segment coordinator codes are present in both gate files with the other four three-segment.

**Expected Outcome**:
- 6/6 new rows are documented, recognized, and resolvable; 0 existing rows modified.
- The check is non-vacuous in both directions and rejects a near-miss two-segment code.
- The live tree is never written; mutations happen in `mkdtemp` copies.

#### TC-COORD-083 - Coordinator records are additive, validated, and the schema version is unchanged

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F10-3, AC-F5-1, F-10, DM-1..DM-5, DM-11, DEC-12
**Test Type(s)**: Behaviour, Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-records.test.ts`; `tests/structure/state-contract.test.ts`
**Tags**: @backend, @state, @contract

**Preconditions**:
- Valid, torn, wrong-kind, missing-required-field, unknown-schema, gapped, and permission-denied record fixtures exist for all six kinds.

**Steps**:
1. Assert the six record kinds (`iteration`, `restart`, `stuck`, `exhaustion`, `wake`, `fence`) and their payload schema ids are additive under `delivery.state.v1` and `STATE_SCHEMA_VERSION` is unchanged; no migration or derived document is produced; assert there is no `coordinator.instance` kind.
2. For each valid fixture, assert the record round-trips through the store with every required field and identity field present; for the `fence` kind assert `instanceId`/`action` (`acquired`/`released`/`stale-takeover`/`stop-requested`)/`holder`/`pid`/`processStartTimeMs`/`supervisorMode`/`externalUnit`/`previousHolder`/`fenceAgeMs` validate and the takeover record is readable from a reopened handle; for `stuck` assert `phase` (`verdict`/`outcome`) pairs share one `stuckId = iterationId`, `killFailureReason` is `identity-mismatch` or null, and the latest-wins fold is deterministic by ledger sequence.
3. For each malformed fixture, assert the read fails with the declared state identity (`state.store.torn`/`state.store.unknown`), is never served as truth, and never becomes count `0`; a torn `fence` record never yields a fabricated holder, and an invalid `phase`/`killOutcome` couple is rejected.
4. Assert ordinal contiguity is validated before serving (`1,2,3` valid; `1,3` unevaluable).
5. Assert a permission-denied read/append maps to `state.permission.denied` exit `1`/`not_landed`, not exit `2`.
6. Assert records carry counts/identities/references and no prompt/transcript/secret field exists in any schema.
7. Assert the record kind prefix is `coordinator.` and is disjoint from `economics.*` and `blocker.*`.
8. Assert every coordinator record append (iteration, restart, both stuck phases, exhaustion, wake, fence) goes through the delivered fenced artifact boundary; a recording state port shows one acquire/release pair per append and no lifetime handle.
9. Assert every coordinator fold uses **ledger sequence** as the primary key — lease (latest `fence`), stuck (latest per `stuckId`), last decision (latest `iteration`), and last wake (latest `wake`) — with a fixture whose `recordedAt` ties or inverts relative to ledger order folding by ledger sequence; `recordedAt` is descriptive only and never the tie-break.

**Expected Outcome**:
- The six kinds are additive, validated, and schema-version-neutral; no separate instance record exists.
- The `fence` record validates the four lease actions and instance identity; the `stuck` record validates the two-phase fold.
- Every fold (lease, stuck, last decision, last wake) is ordered by ledger sequence, not `recordedAt`.
- Malformed records are classified and never served.
- Permission denial has the delivered exit projection.

#### TC-COORD-084 - No prompt, transcript, secret, or credential value reaches any record or error

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-NFR-2, F-10, NFR-11
**Test Type(s)**: Checks, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/coordinator-privacy.test.ts`; `tests/checks/secret-read-boundary.test.ts`
**Tags**: @checks, @privacy, @security

**Preconditions**:
- Privacy canaries and a registered synthetic secret are planted in every content-bearing field.
- Every command and record kind has a fixture.

**Steps**:
1. Run every command across the fixture matrix; assert no canary/secret appears in `data`, human text, error summaries, records, evidence, or status.
2. Assert the evidence corpus for stuck/restart/exhaustion/kill/wake is `key=value` only, ≤ 512 UTF-8 bytes, and carries counts/identities/references.
3. Assert no record field stores a prompt, transcript, question body beyond the bounded owner question, model output, or credential value.
4. Assert the owner escalation question text is bounded and contains only coordinator id/count/bound/options.
5. Assert the secret-read-boundary check stays green and no coordinator module reads a credential.
6. Non-vacuity: a mutant that copies a canary into evidence fails.

**Expected Outcome**:
- Zero content/secret leakage across records, evidence, status, and errors.
- Evidence is bounded and parseable.
- No new secret surface is introduced.

#### TC-COORD-085 - The kill path is shell-free and the same-user trust boundary is unchanged

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F4-3, AC-NFR-2, NFR-14, NFR-11
**Test Type(s)**: Structure, Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/coordinator-kill-target.test.ts`; `tests/boundaries`
**Tags**: @structure, @security, @boundaries

**Preconditions**:
- The process-lifecycle adapter and its composition exist.

**Steps**:
1. Assert the kill path uses no shell, no `exec`/`eval`, no string interpolation, and no user-supplied free-form target (shared with TC-COORD-042).
2. Assert the kill path verifies the recorded `pid` + `processStartTimeMs` before TERM and holds no signal for a reused pid.
3. Assert no network client, socket, listener, or remote transport exists on the coordinator surface.
4. Assert no privilege escalation (no `sudo`, setuid, service install) and no read of another user's state.
5. Assert the instance lease and filesystem permissions are the only boundary and the same-user assumption is documented; the state write fence is taken only per append.
6. Assert the dependency-cruiser boundary rule for the adapter seam stays green with no loosening and the fixture-coverage meta-check reports no unenforced rule.
7. Non-vacuity: a temp-copy mutant adding a network call or a shell kill fails.

**Expected Outcome**:
- The kill path is shell-free, handle-only, and identity-verified.
- The same-user, local trust boundary is unchanged; no network or privilege escalation exists.
- The boundary gate remains enforced.

#### TC-COORD-086 - Identical facts render byte-identical data and text with no ambient inputs

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR-1, F-9, NFR-1, NFR-3
**Test Type(s)**: Checks, Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/coordinator-determinism.test.ts`; `tests/golden/coordinator.test.ts`
**Tags**: @checks, @determinism, @golden

**Preconditions**:
- Two identical temp state roots and config, with the same injected clock/ids/brand/facts.
- An AST/ambient scan for `Date.now`, `Math.random`, `performance.now`, `process.env`, `Bun.env`, locale/timezone dependence, and network.

**Steps**:
1. Run `tick` and `status` twice over the two roots; assert byte-identical `data` and human text.
2. Assert the output changes only when an injected fact changes (a liveness control), and then in the declared field.
3. Assert no ambient clock/random/env/network read exists in the decision or render path; a temp-copy mutant that reads one fails.
4. Assert a locale/timezone change does not alter timestamps or ordering (fixed ISO UTC).
5. Assert the same result across a fresh process-local instance (no hidden cache) at the reopened-store boundary.
6. Assert no model call is made (zero provider invocations recorded).

**Expected Outcome**:
- Identical inputs produce byte-identical outputs.
- No ambient clock/random/env/locale dependence and no model call.
- Determinism is proven across a fresh instance and store handle.

#### TC-COORD-087 - A second identical tick appends no duplicate action record (only its lease pair) and performs no destructive action

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-NFR-1, F-1, NFR-6
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-idempotency.test.ts`
**Tags**: @backend, @idempotency, @state

**Preconditions**:
- A state root with one decision, one restart, one stuck, one wake, and one exhaustion escalation, depending on the sub-case.
- Recording counters per record kind and per destructive action.

**Steps**:
1. Run `tick` twice with unchanged state; assert the second run appends no decision, restart, stuck, wake, or exhaustion **action** record, and appends exactly one lease pair (its own `acquired`/`released` or `stale-takeover`/`released`), which is expected volume excluded from NFR-6.
2. Assert the second run performs no spawn, resume, kill, or blocker append, and no `stop-requested` duplicate.
3. Assert the second run returns the same actionable/idempotent outcome and exit `0` (or the same classified refusal), not a new effect; a repeated exhausted tick is `exhausted-escalated`.
4. Assert a changed fact (new question, window advanced) does cause the declared new effect (liveness control).
5. Assert a replayed restart ordinal, a replayed `coordinator.stuck` phase (same `stuckId`), a repeated exhausted escalation, and a repeated `stop` on a stopped root are all no-ops for action records.
6. Non-vacuity: a mutant that appends a duplicate action record on replay, or that treats the per-tick lease pair as an idempotency violation, fails.

**Expected Outcome**:
- A second identical tick is a no-op for action records and destructive actions while still appending its expected lease pair.
- Idempotency holds across every action record kind; the per-tick lease pair is deliberate volume, not a duplicate.
- A real change still produces the declared effect.

#### TC-COORD-088 - tick/status performance, read cost, and output bounds are within the declared thresholds

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-NFR-4, F-9, NFR-4, NFR-5, NFR-9, GAP-T6
**Test Type(s)**: Performance, Behaviour
**Automation Level**: Semi-automated
**Target Layer / Location**: `tests/behaviour/coordinator-performance.test.ts`; `tests/behaviour/coordinator-read-cost.test.ts`
**Tags**: @perf, @backend, @bounds

**Preconditions**:
- A synthetic reference state store at the declared size (full coordinator record set, cap-sized blocker ledger, reference session/config facts).
- An injected clock; no real sleeping.

**Steps**:
1. Warm up, then measure `tick` p95 over a declared iteration count; assert ≤ 2 000 ms.
2. Measure `status` p95; assert ≤ 1 000 ms.
3. Measure `start` p95 excluding spawn; assert ≤ 2 000 ms.
4. Assert at most one verified read per store per tick; the blocker read is reused for answer evidence and wake evaluation (count `1`, not `2`).
5. Assert machine `data` ≤ 64 KiB and human text ≤ 32 lines for every command and fixture, including hostile-length ref/lane fields (clamped with an explicit marker, never over-bound).
6. Record the environment (Bun/pnpm/OS/arch), iteration count, and p95 method in the test output.
7. If CI cannot make the timing deterministic, keep the structural/read-cost assertions automated and run the timing assertion behind the declared manual performance gate — never delete or relax the bound.

**Expected Outcome**:
- The declared p95 bounds hold on the reference store.
- Read cost is one verified read per store per tick.
- Output bounds hold even with hostile-length fields.

**Notes / Clarifications**:
- GAP-T6: p95 is measured with the injected clock and a synthetic store; the environment and method are recorded. A bound relaxation is a reviewed change, not a test tweak.

#### TC-COORD-089 - The delivered status, brief, blockers, economics, lanes, and `ceo-loop.sh` do not regress

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-NFR-1, F-10, NFR-15, AC-F10-5
**Test Type(s)**: Regression
**Automation Level**: Automated
**Target Layer / Location**: existing `tests/{structure,behaviour,golden,conformance,boundaries}` suites; `scripts/**`
**Tags**: @regression, @nonregression

**Preconditions**:
- The delivered suites are unchanged except for the declared reserved-slot golden update.

**Steps**:
1. Run the existing status digest, brief, blockers, economics, config, state, harness, and error-table suites; assert all green.
2. Assert the status/brief golden diff is limited to the reserved-slot case; a control golden without an escalation is byte-unchanged.
3. Assert blockers ranking/order is unchanged and no `blockers.*` record or identity is modified.
4. Assert economics and lane records are byte-unchanged and no coordinator write targets them.
5. Assert `ceo-loop.sh` is byte-unchanged and not wrapped or deprecated.
6. Assert every other command's envelope/exit is unchanged; no new digest section or brief anchor appears.
7. Assert the only new command family is `coordinator`; no daemon/dispatch/supervise surface is added.

**Expected Outcome**:
- Only the declared reserved-slot rendering rule changes.
- Blockers, economics, lanes, and `ceo-loop.sh` are untouched.
- No other command regresses.

#### TC-COORD-090 - The `ceo-loop.sh` function map has a passing AC trace for all five functions

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F10-5, F-1..F-7, Appendix A
**Test Type(s)**: Manual, Traceability
**Automation Level**: Manual
**Target Layer / Location**: change artifacts and the new feature spec
**Tags**: @traceability, @manual

**Preconditions**:
- The TC results exist and the spec Appendix A map is available.

**Steps**:
1. Build the trace table: context resume decision → TC-COORD-020/021/022/023/026 and AC-F2-1..6; stuck detection → TC-COORD-030/031/033/034/035 and AC-F3-1..4; kill with grace → TC-COORD-040/042 and AC-F4-1/3; restart budget → TC-COORD-051/052/053/054 and AC-F5-2..5; wake on question → TC-COORD-070/073/075 and AC-F7-1/3/6.
2. Assert each row names at least one **passing** TC at DoD, not just a planned one.
3. Assert the owner escalation row (F-6) and the regime row (F-8) are also traced, as Appendix A lists them.
4. Assert no `ceo-loop.sh` function is left untraced or silently dropped.
5. File the trace in the change artifacts for the DoD gate.

**Expected Outcome**:
- All five (plus the two extra) `ceo-loop.sh` functions have a passing AC trace.
- No silent lifecycle or exhaustion path remains.
- The trace is reviewable evidence, not a claim.

#### TC-COORD-091 - SC-M1-25 end-to-end over an in-process CLI and a fake process harness

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F1-1, AC-F1-3, AC-F1-4, AC-F2-1, AC-F2-2, AC-F2-3, AC-F2-4, AC-F2-5, AC-F2-6, AC-F3-1, AC-F3-2, AC-F3-3, AC-F3-4, AC-F4-1, AC-F4-4, AC-F5-2, AC-F5-3, AC-F6-1, AC-F7-1, AC-F8-6, AC-F10-5, SC-M1-25
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-scenario.test.ts`; `tests/fixtures/coordinator/harness.ts` + `process-port.ts`
**Tags**: @integration, @scenario, @seed

**Preconditions**:
- A temp state root with a live coordinator session mid-iteration, a known context below/above the limit, a cap-sized blocker ledger, and a rank-1 coordinator question.
- The in-process CLI, fake process port, fake clock, config, and state seams are injected.

**Steps**:
1. Run `coordinator tick`: claim the instance lease through the shared atomic path (one `acquired` when released/absent, or one `stale-takeover` when the holder is dead), record `join-live` (or `resume-context`/`spawn-fresh` per the context fixture), and apply it; assert the ordinal rule, that the instance identity folds from the latest lease by ledger sequence, and that a quiet cycle adds only the lease pair.
2. Advance the fake clock past `stuck-window` with no fingerprint advance, no merge, no answer, and no positive `token-delta`/`session-traffic` within `progress-bound`; run `tick`; assert `stuck` with bounded evidence, including the `phase=verdict`/`killOutcome=not-attempted` append before the kill; assert `data.stuck` is the persisted verdict with non-null phase/reason/evidence and `tickVerdict` is the tick-specific result with nullable phase/reason/evidence when `progressing`.
3. Assert identity verification, TERM → grace → KILL (fake), and the `phase=outcome` append with the same `stuckId` (= `iterationId`) and `terminated`/`forced`.
4. Assert the next restart is admitted below the bound with the classified reason; drive the count to the bound and assert the refusal + escalation.
5. Assert exactly one owner-audience escalation question and the terminal receipt; assert the brief/digest render it **first by index** at the cap, with the lowest-ranked displaced and counted as omitted, and the idempotent state is `exhausted-escalated`.
6. With a rank-1 coordinator question and a live/resumable/spawnable session, run `tick`; assert exactly one wake and the `woken` record with `askedAt`.
7. Assert a PID identity mismatch in the sequence sends no signal and records `identity-mismatch` (a negative sub-case) and that a stop request is append-only and idempotent.
8. Assert the whole scenario is deterministic: rerun on a fresh identical root and compare the normalized transcript.
9. Assert the `ceo-loop` map trace (TC-COORD-090) is satisfied by the sequence.

**Expected Outcome**:
- SC-M1-25 runs end to end with no divergence beyond the declared "digest consumed" clarification.
- The instance lease, two-phase stuck record, progress bound, render-first escalation, and PID identity all hold in the integrated flow.
- Every clause maps to an observable assertion and a TC; the scenario is hermetic and deterministic.

#### TC-COORD-092 - Documentation, registry, man page, and distribution marker reconcile with the delivered surface

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-F8-2, AC-F10-2, F-8, F-10, NFR-15
**Test Type(s)**: Manual, Content
**Automation Level**: Manual
**Target Layer / Location**: `doc/spec/features/feature-coordinator-supervision.md`, the five updated feature specs, `cli-command-registry.md`, `m1/{contracts,man-page}.md`, `doc/decisions/**`, `doc/00-index.md`
**Tags**: @docs, @manual

**Preconditions**:
- The implementation and the docs land in the same delivery.

**Steps**:
1. Assert the new feature spec is the current-truth home for the command family (foreground-only v1 and the bare-`start` invocation error), decisions, records (including the four-action `coordinator.fence` instance lease with liveness-first atomic claim, single-record takeover, per-append fence recovery, and the two-phase `coordinator.stuck` with `stuckId = iterationId`), the ledger-sequence fold rule, six config keys, error identities, and regime descriptor.
2. Assert the five consumer/boundary notes are present: economics (distinct budget; `token-delta`/`session-traffic` consumed), blockers (enforcement arm, unchanged vocabulary, absent status counts as open), brief (render-first reserved slot, no new anchor), status digest (render-first reserved slot, read-only), harness adapters (additive process port, new-turn mapping, `alive(handle)` as the lease-liveness source).
3. Assert the CLI registry and man page carry the four subcommands/flags and the M1-S18 seam; the `ceo-loop.sh` strangler row names coordinator supervision.
4. Assert TDR-0013/TDR-0014 references and the ODR-0003 registry-only naming note are accurate, and that the TDR-0013 amendment (four-way capability split, lease-based single-instance) and TDR-0014 checklist cleanup are recorded by `@decision-advisor`.
5. Assert the documentation index links the new feature spec and records; the distribution marker is declared on every changed redistributable doc.
6. Run `bash scripts/.tests/test-doc-distribution.sh` and `git diff --check`; assert green.
7. Assert the docs do not claim a daemon, socket, lane supervision, OS installer, prompt change, or new question type; they describe `stop` as a recorded request, the write fence as per-append with one stale-lock recovery, the lease as liveness-first and single-record on takeover, v1 as foreground-only, and the payload's persisted-stuck/`tickVerdict` split.

**Expected Outcome**:
- Docs reconcile with the delivered v1.3 surface and scope.
- The distribution and diff gates pass.
- No out-of-scope or stale v1.2 claim is documented.

#### TC-COORD-093 - A live holder past 2×`collection-interval` is never taken over and can still be stopped

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F8-4, AC-F8-1, AC-F8-3, F-1, F-8, DM-11, EVT-7, NFR-6
**Test Type(s)**: Behaviour, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-lease-liveness.test.ts`; `tests/fixtures/coordinator/process-port.ts`, `tests/fixtures/state/harness.ts`
**Tags**: @backend, @lease, @liveness, @edge

**Preconditions**:
- A temp state root holds an `acquired` lease whose recorded holder the fake reports `alive=true` and whose acquisition is older than three `collection-interval`s.
- The fake clock, the `alive(handle)` fake, and a recording state port are injected.

**Steps**:
1. Seed the old-but-live `acquired` lease; run `coordinator start --foreground`; assert `coordinator.already-running` at exit `2`, the holder named, no lease record appended, no takeover, and zero kill calls — age never overrides a positive `alive`.
2. Run `coordinator tick` against the same root; assert the same refusal, no lease record, and no collection cycle performed.
3. Run `coordinator stop`; assert exactly one `action=stop-requested` record, `requested=true`, `released=false`, exit `0`, no `released` appended by `stop`, and the instance identity unchanged.
4. Drive the live supervisor to its next cycle boundary; assert it observes the request, stops, and appends exactly one `action=released`; assert status then reports `stopped`/`released`.
5. Assert the decision consulted `alive(handle)` before lease age: a control fixture with `alive=false` at the same age is takeover-eligible (TC-COORD-015), proving liveness, not age, is decisive.
6. Non-vacuity: a mutant that treats `age > 2×collection-interval` as takeover-eligible regardless of `alive` fails.

**Expected Outcome**:
- A live holder past 2×`collection-interval` is never taken over by `start` or `tick`; both are refused `coordinator.already-running` exit `2`.
- `stop` still records the request (`requested=true`, `released=false`) and the live supervisor releases at the next cycle boundary.
- Live liveness, not age, is decisive.

#### TC-COORD-094 - Two overlapping claims over two store handles yield exactly one acquisition and one `coordinator.already-running`

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F8-5, AC-F8-1, AC-F1-1, F-1, F-8, DM-11, EVT-7, NFR-6
**Test Type(s)**: Behaviour, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-claim-race.test.ts`; `tests/fixtures/state/harness.ts`
**Tags**: @backend, @lease, @concurrency, @race

**Preconditions**:
- Two independent store handles over the same temp state root; the lease is `released`/absent.
- A deterministic interleaving controller (no sleeps) can interleave `acquireFence`, the fold/`alive` re-read, the append, and `releaseFence`, and a barrier lets both claims attempt `acquireFence` before either appends.

**Steps**:
1. Start two claims (`start` and `tick`, and `start`/`start`) over two handles behind a barrier; assert exactly one appends a lease acquisition and the other is refused `coordinator.already-running` at exit `2`.
2. Assert the loser appends no lease record and performs no cycle.
3. Assert the winner's sequence is `acquireFence` → re-read the lease fold and `alive(handle)` → append one lease record → `releaseFence`, and the loser's re-read occurred after the winner's append, so it observed the held lease.
4. Run a matrix of interleavings (both read before either acquires; one acquires before the other reads; both attempt with lock contention) and assert none produces two `acquired` records on the same state dir.
5. Force `acquireFence` for the second claim to return `state.lock.busy`; assert the claim maps to `coordinator.already-running` at exit `2` and names the holder when the lease is readable.
6. Control: concurrent claims on two different state dirs both succeed independently.
7. Non-vacuity: a mutant that re-reads before `acquireFence` (read-fold-then-append) fails; a mutant that maps `state.lock.busy` to a generic internal error fails.

**Expected Outcome**:
- Exactly one conflicting claim acquires; the other is `coordinator.already-running` exit `2`.
- The claim is one fenced critical section with the re-read under the fence; no interleaving produces a double acquisition.
- Claim-time `state.lock.busy` is classified as `coordinator.already-running`, not an internal error.

#### TC-COORD-095 - A `tick` recovers a crashed holder with one `stale-takeover`, one cycle, and one `released`

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F8-6, AC-F8-3, AC-F1-2, F-1, F-8, DM-11, EVT-7, NFR-7
**Test Type(s)**: Behaviour, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/coordinator-tick-takeover.test.ts`; `tests/fixtures/coordinator/process-port.ts`
**Tags**: @backend, @lease, @recovery

**Preconditions**:
- A temp state root whose latest lease action is `acquired` or `stop-requested` with the recorded holder `alive=false` (a SIGKILLed supervisor); no live process.
- The fake clock, process port, state port, and blocker ledger are injected.

**Steps**:
1. Seed `acquired` with `alive=false`; run `coordinator tick`; assert it appends exactly one `stale-takeover` (new `holder`, `previousHolder`, `fenceAgeMs`), runs exactly one cycle, and appends exactly one `released`; assert no separate `start` is required and no second `acquired` appears.
2. Seed `stop-requested` with `alive=false`; run `tick`; assert one `stale-takeover` then one `released`; the dead holder's stop request does not block the one-shot surface.
3. Assert the tick's `stale-takeover` folds the instance to the new holder and the cycle data reports that instance.
4. Assert the tick appends the lease pair plus only legitimate cycle action records; the takeover alone does not append a restart or other action record.
5. Assert the takeover performs no `recoverFence` for the lease decision (an age-stale **state** fence recovery belongs only to the per-append helper, TC-COORD-017) and no `contracts/state.ts` change is needed.
6. Run a second `tick` on the unchanged root; assert the latest action is `released`, so it appends its own `acquired`/`released` pair and does not take over again.
7. Non-vacuity: a mutant that refuses a dead holder's lease forever, or that requires a `start` before a `tick` can proceed, fails.

**Expected Outcome**:
- A crashed holder is recovered by `tick` alone: one `stale-takeover` (the new acquisition), one cycle, one `released`.
- The tick never blocks forever on the dead holder's lease and never emits a second `acquired` for the takeover.
- A subsequent tick sees a released lease and follows the normal acquire/release path.

## 6. Environments and Test Data

| Environment | Runtime / tool | Invocation | Scope |
|-------------|----------------|------------|-------|
| Local development | Bun `1.4.4` (repo pin), pnpm `10.18.3` | `bun test tests/structure/coordinator-*.test.ts`, `bun test tests/behaviour/coordinator-*.test.ts`, `bun test tests/golden/coordinator.test.ts` | Structure, types, behaviour, golden, checks, performance |
| Local invariants | Bun | `bun run scripts/checks/{error-table-sync,forbidden-literals,ambient-globals}.ts`; `pnpm check:boundaries` | Binding, brand, purity, boundaries |
| CI `ts-test` | Bun `1.4.4` | `pnpm test` after `pnpm install --frozen-lockfile` | Every `*.test.ts`, including the new suites |
| CI `ts-boundaries` | Bun | `pnpm build`; `pnpm check:boundaries` | Dependency-cruiser rules, ambient globals, fixture-coverage meta-check |
| CI `ts-invariants` | Bun | `bun run scripts/checks/*.ts` | Error-table sync, literal scans, entrypoints |
| CI aggregate | Bun | `pnpm check`; `git diff --check` | Lint, format, typecheck, tests, boundaries, exports parity |
| Documentation | bash and manual | `bash scripts/.tests/test-doc-distribution.sh` if a marker-scoped doc changes | Distribution-marker drift (phase 7) |

**Test data.**

- **Synthetic state dirs** live under `tests/fixtures/coordinator/states.ts` as committed case data: a verified-empty coordinator record set, a healthy running set, an exhausted set, a torn payload, a gapped ordinal (`1,3`), an unknown record kind, an undeclared schema id, a permission-denied root, liveness-first lease roots (`alive=false`; `alive=true` with an old lease; `alive` unknown with an old lease; `alive` unknown with a young lease; a crashed-holder root for `tick` recovery), a `stop-requested` root, a `released` root, and a torn `coordinator.fence` record. Each case declares the expected decision/verdict/exit; no case declares a separate instance record.
- **Fake process-lifecycle port** lives in `tests/fixtures/coordinator/process-port.ts`: records `spawn`, `resume`, `alive`, `kill` with a fake clock that advances only when the supervisor "waits" for the grace, records TERM/KILL signals and whether the recorded `pid` + `processStartTimeMs` matched, and returns declared `terminated`/`forced`/`failed` outcomes. It also exposes `token-delta`/`session-traffic` liveness readings, an `alive(handle)` probe, and per-capability `declared`/`missing` switches. No real child process, signal, PID, or process-tree enumeration is used.
- **Fake harness capability facts** cover spawn/resume/alive/kill/progress declared, individually missing, and all-missing; the declaration is authoritative and an absent declaration means unsupported (fail-closed). The new-turn mapping fixtures include positive `token-delta` only, positive `session-traffic` only, zero/negative, and absent/unsupported.
- **Fixture blocker ledgers** live in `tests/fixtures/coordinator/blockers.ts`: owner-only, coordinator-only, mixed rank order, a cap-sized ledger (8 open questions), a cap+1 ledger, an absent-status rank-1 coordinator question, and an exhaustion escalation that ranks ninth with seven other questions ahead of it. Question ids, `askedAt`, types, audiences, lanes, statuses, and refs are fixed; no real question text or secret appears.
- **Fixture coordinator records** are fixed by case: iteration/restart/stuck/exhaustion/wake/fence payloads in valid, torn, wrong-kind, malformed, gapped, and unknown forms; stuck records are two-phase under one `stuckId` (`phase=verdict` with `killOutcome=not-attempted`, `phase=outcome` with `terminated`/`forced`/`failed` and `killFailureReason`); fence records cover `acquired`/`released`/`stale-takeover`/`stop-requested` with `instanceId`, `pid`, `processStartTimeMs`, `supervisorMode`, `externalUnit`, and null/non-null `previousHolder`/`fenceAgeMs`; ordinals and epochs are constants.
- **Golden outputs** live under `tests/fixtures/coordinator/golden/` for `tick` and `status` text/data, plus new reserved-slot cases under `tests/fixtures/status/golden/` and `tests/fixtures/brief/golden/`. Normalization replaces temp roots and removes only `recordedAt`/`timing`; the reserved-slot golden asserts the escalation at index `0` and is the only permitted status/brief golden change, reviewed explicitly.
- **Privacy canaries**: fabricated canary strings are planted in every field that could carry content (session, ref, question, evidence, summary) and each suite asserts the canary never appears in a record, evidence payload, status output, or error envelope.
- **Configuration fixtures** live under `tests/fixtures/config/**` and cover: absent `coordinator` branch (defaults incl. `progress-bound=300000`), explicit values, unknown key, wrong type, wrong domain, negative/fractional/zero windows, `restart-budget` `0`/`1`/`10`, and window/interval/progress-bound `1` ms.
- **Mutants** live under `tests/fixtures/coordinator/mutants/**` and are applied to temp copies or in-memory strings; the live tree is never mutated. Each mutant declares the suite and assertion it must trip (no-CPU, no-literal, no-shell, no-model, bypass-lease, signal-before-identity-check, fabricated-stale, absent-to-zero, ready-to-merge-in-fingerprint, count-zero, duplicate-wake, duplicate-escalation, reserved-slot-dropped, reserved-slot-in-rank-position, `escalated`-instead-of-`exhausted-escalated`, age-overrides-liveness, read-fold-before-acquire, double-acquisition, `state.lock.busy`-as-internal, two-record-takeover, tick-blocks-on-dead-holder, detached-produced, progressing-with-non-null-phase).

**Isolation and cleanup.**

- Every filesystem-touching suite uses `mkdtemp` under the system temp directory and removes the root in `afterEach`, including on failure; a guard rejects any fixture root equal to `process.cwd()` or the real user state directory.
- State handles and edges are closed in `finally`; a fresh reader handle over the same root is opened only after the writer closes.
- Injected fakes replace clocks, ids, brands, config, ports, blocker reads, credentials, and streams. No suite reads the real `process.env`, `$HOME`, network, or a live harness store.
- The live worktree is never written; read-only and golden suites snapshot `git status --porcelain` before and after and assert it is unchanged.
- No suite sends a real signal, spawns a real harness session, starts a daemon, opens a socket, or installs a unit.

## 7. Automation Plan and Implementation Mapping

| TC ID | Test file to create or update | Execution command | Mocking / fixtures | Status |
|-------|-------------------------------|-------------------|--------------------|--------|
| TC-COORD-001 | `tests/structure/coordinator-contract.test.ts`; `tests/types/coordinator.type-test.ts`; contracts module (expected) | `bun test tests/structure/coordinator-contract.test.ts`; `pnpm typecheck` | AST data-only detector; temp-copy mutant | To Implement |
| TC-COORD-002 | `tests/structure/coordinator-imports.test.ts`; `tests/boundaries` | `bun test tests/structure/coordinator-imports.test.ts tests/boundaries`; `pnpm check:boundaries` | AST scans; temp-copy mutants; production depcruise rules | To Implement |
| TC-COORD-003 | `tests/behaviour/coordinator-grammar.test.ts`; `tests/structure/coordinator-contract.test.ts` | `bun test tests/behaviour/coordinator-grammar.test.ts` | In-process `runCli`; recorder; invalid-grammar matrix | To Implement |
| TC-COORD-004 | `tests/behaviour/coordinator-envelope.test.ts`; `tests/checks/exit-code-literals.test.ts` | `bun test tests/behaviour/coordinator-envelope.test.ts tests/checks/exit-code-literals.test.ts` | `assertEnvelopeContract`; outcome/identity/exit matrix | To Implement |
| TC-COORD-010 | `tests/behaviour/coordinator-start.test.ts`; `tests/fixtures/coordinator/harness.ts` | `bun test tests/behaviour/coordinator-start.test.ts` | Temp state roots; injected fence token; recording state port; atomic-claim order recorder; two state dirs; forced `state.lock.busy`; bare-start grammar case; lease-record oracle | To Implement |
| TC-COORD-011 | `tests/behaviour/coordinator-stop.test.ts` | `bun test tests/behaviour/coordinator-stop.test.ts` | Live (including old-but-live), dead, released, and unknown-liveness fixtures; fake clock; no-supervisor control; cross-process handle spy | To Implement |
| TC-COORD-012 | `tests/behaviour/coordinator-tick.test.ts`; `tests/golden/coordinator.test.ts` | `bun test tests/behaviour/coordinator-tick.test.ts tests/golden/coordinator.test.ts` | Fresh/valid/dead-holder state; fake process port; persisted-stuck vs `tickVerdict` oracle; quiet-cycle record counter; payload goldens | To Implement |
| TC-COORD-013 | `tests/behaviour/coordinator-status.test.ts`; `tests/golden/coordinator.test.ts` | `bun test tests/behaviour/coordinator-status.test.ts tests/golden/coordinator.test.ts` | Running/stopped/exhausted fixtures; old-but-live lease; persisted-stuck vs `tickVerdict`; live-fact absent/present | To Implement |
| TC-COORD-014 | `tests/structure/coordinator-regime.test.ts`; `tests/behaviour/coordinator-status.test.ts` | `bun test tests/structure/coordinator-regime.test.ts tests/behaviour/coordinator-status.test.ts` | Descriptor data; foreground-only; bare-start invocation error; no-installer negative scan | To Implement |
| TC-COORD-015 | `tests/behaviour/coordinator-fence-stale.test.ts` | `bun test tests/behaviour/coordinator-fence-stale.test.ts` | Liveness matrix (`alive` true/false/unknown × young/old lease); single-record takeover oracle; fake clock; `recoverFence` spy; `coordinator.fence` record oracle | To Implement |
| TC-COORD-017 | `tests/behaviour/coordinator-fence-records.test.ts`; `tests/structure/coordinator-contract.test.ts` | `bun test tests/behaviour/coordinator-fence-records.test.ts tests/structure/coordinator-contract.test.ts` | Acquire/stop-requested/release/single-record-takeover fixtures; reopened store handle; torn-fence fixture; per-append fence counter; forced `state.lock.busy` (stale/non-stale) and `state.write.failed`; ledger-sequence fold | To Implement |
| TC-COORD-018 | `tests/behaviour/coordinator-instance-lease.test.ts`; `tests/structure/coordinator-contract.test.ts` | `bun test tests/behaviour/coordinator-instance-lease.test.ts tests/structure/coordinator-contract.test.ts` | Single-record takeover lease sequence; ledger-sequence tie fixture; six-kind set assertion; identity fold oracle | To Implement |
| TC-COORD-016 | `tests/behaviour/coordinator-fresh-budget.test.ts` | `bun test tests/behaviour/coordinator-fresh-budget.test.ts` | Live-supervisor refusal; stop-request/release; stopped-supervisor success | To Implement |
| TC-COORD-020 | `tests/behaviour/coordinator-decision-join.test.ts` | `bun test tests/behaviour/coordinator-decision-join.test.ts` | Live-session fact; recording process port | To Implement |
| TC-COORD-021 | `tests/behaviour/coordinator-decision-resume.test.ts` | `bun test tests/behaviour/coordinator-decision-resume.test.ts` | Resumable/known-context fixture; port recorder | To Implement |
| TC-COORD-022 | `tests/behaviour/coordinator-decision-spawn.test.ts`; `tests/fixtures/coordinator/lifecycle.ts` | `bun test tests/behaviour/coordinator-decision-spawn.test.ts` | Recovery-reason matrix; resume-capability fixtures | To Implement |
| TC-COORD-023 | `tests/behaviour/coordinator-decision-spawn.test.ts`; `tests/fixtures/coordinator/lifecycle.ts` | `bun test tests/behaviour/coordinator-decision-spawn.test.ts` | Initial/clean fixtures; ordinal oracle | To Implement |
| TC-COORD-024 | `tests/behaviour/coordinator-decision-recovery.test.ts` | `bun test tests/behaviour/coordinator-decision-recovery.test.ts` | Killed-mid-iteration state; closed-out artifact snapshot | To Implement |
| TC-COORD-025 | `tests/behaviour/coordinator-decision-durability.test.ts` | `bun test tests/behaviour/coordinator-decision-durability.test.ts` | Closed/reopened store handles (GAP-T4) | To Implement |
| TC-COORD-026 | `tests/behaviour/coordinator-ordinals.test.ts`; `tests/fixtures/coordinator/lifecycle.ts` | `bun test tests/behaviour/coordinator-ordinals.test.ts` | Six-outcome matrix; recorder | To Implement |
| TC-COORD-029 | `tests/behaviour/coordinator-new-turn.test.ts`; `tests/fixtures/coordinator/process-port.ts` | `bun test tests/behaviour/coordinator-new-turn.test.ts` | Liveness-report fixtures (`token-delta`/`session-traffic` positive/zero/absent); progress-bound config; adapter mapping mutants | To Implement |
| TC-COORD-030 | `tests/behaviour/coordinator-stuck-verdict.test.ts` | `bun test tests/behaviour/coordinator-stuck-verdict.test.ts` | Window-expired fixture; fake clock; evidence corpus parser; two-phase `stuckId = iterationId`/outcome oracle; ledger-sequence fold | To Implement |
| TC-COORD-031 | `tests/behaviour/coordinator-stuck-matrix.test.ts`; `tests/fixtures/coordinator/evidence.ts` | `bun test tests/behaviour/coordinator-stuck-matrix.test.ts` | 3×3×3 evidence matrix; expected verdict table | To Implement |
| TC-COORD-032 | `tests/behaviour/coordinator-stuck-fingerprint.test.ts` | `bun test tests/behaviour/coordinator-stuck-fingerprint.test.ts` | Two-input state fingerprint fixtures; no-tracker/CI/network spy; fingerprint+turn couples | To Implement |
| TC-COORD-033 | `tests/behaviour/coordinator-stuck-corroborator.test.ts` | `bun test tests/behaviour/coordinator-stuck-corroborator.test.ts` | Positive progress fixture; kill counter stays `0` | To Implement |
| TC-COORD-034 | `tests/behaviour/coordinator-stuck-unknown.test.ts` | `bun test tests/behaviour/coordinator-stuck-unknown.test.ts` | Unsupported-progress fixture; stale merge/answer controls | To Implement |
| TC-COORD-035 | `tests/behaviour/coordinator-stuck-unevaluable.test.ts` | `bun test tests/behaviour/coordinator-stuck-unevaluable.test.ts` | All-unknown and unreadable-store fixtures; exit/identity oracle | To Implement |
| TC-COORD-036 | `tests/behaviour/coordinator-stuck-torn.test.ts` | `bun test tests/behaviour/coordinator-stuck-torn.test.ts` | Per-store fault injection; fabricated-stale mutant | To Implement |
| TC-COORD-037 | `tests/structure/coordinator-no-cpu.test.ts`; `tests/checks/coordinator-mutants.test.ts` | `bun test tests/structure/coordinator-no-cpu.test.ts tests/checks/coordinator-mutants.test.ts` | AST scan; CPU-shaped fixture; no-CPU mutant | To Implement |
| TC-COORD-038 | `tests/behaviour/coordinator-expectation.test.ts` | `bun test tests/behaviour/coordinator-expectation.test.ts` | Trigger sequence; iteration-record counter | To Implement |
| TC-COORD-039 | `tests/behaviour/coordinator-stuck-reason.test.ts`; `tests/structure/coordinator-contract.test.ts` | `bun test tests/behaviour/coordinator-stuck-reason.test.ts tests/structure/coordinator-contract.test.ts` | Stuck/unevaluable couples; verdict/reason vocabulary; invalid-couple reader | To Implement |
| TC-COORD-040 | `tests/behaviour/coordinator-kill-grace.test.ts`; `tests/fixtures/coordinator/process-port.ts` | `bun test tests/behaviour/coordinator-kill-grace.test.ts` | Fake clock/port; identity-match verify; TERM/KILL phase log; two-phase `stuckId` cases | To Implement |
| TC-COORD-041 | `tests/behaviour/coordinator-kill-failed.test.ts` | `bun test tests/behaviour/coordinator-kill-failed.test.ts` | Port returning failed; no-infinite-retry counter; `killFailureReason=null` control | To Implement |
| TC-COORD-042 | `tests/structure/coordinator-kill-target.test.ts`; `tests/behaviour/coordinator-kill-target.test.ts` | `bun test tests/structure/coordinator-kill-target.test.ts tests/behaviour/coordinator-kill-target.test.ts` | AST scan for shell/name kill; metacharacter handle fixture; identity check | To Implement |
| TC-COORD-043 | `tests/behaviour/coordinator-kill-fence.test.ts` | `bun test tests/behaviour/coordinator-kill-fence.test.ts` | Live/dead/free lease fixtures; kill counter; per-append fence counter; `state.lock.busy` stale recovery | To Implement |
| TC-COORD-044 | `tests/behaviour/coordinator-capability-gap.test.ts` | `bun test tests/behaviour/coordinator-capability-gap.test.ts` | Four-way ownership matrix (resume/spawn/alive-kill/progress); destructive-action counter | To Implement |
| TC-COORD-045 | `tests/behaviour/coordinator-kill-identity.test.ts`; `tests/fixtures/coordinator/process-port.ts` | `bun test tests/behaviour/coordinator-kill-identity.test.ts` | Matching/mismatched `pid`+`processStartTimeMs`; signal log; identity-mismatch effect oracle | To Implement |
| TC-COORD-050 | `tests/behaviour/coordinator-restart-namespace.test.ts` | `bun test tests/behaviour/coordinator-restart-namespace.test.ts` | Coordinator/lane/economics roots; byte snapshot | To Implement |
| TC-COORD-051 | `tests/behaviour/coordinator-restart-admit.test.ts` | `bun test tests/behaviour/coordinator-restart-admit.test.ts` | Below-bound matrix; ordinal parser | To Implement |
| TC-COORD-052 | `tests/behaviour/coordinator-restart-exhausted.test.ts` | `bun test tests/behaviour/coordinator-restart-exhausted.test.ts` | At/above-bound fixtures; spawn counter; history reference | To Implement |
| TC-COORD-053 | `tests/behaviour/coordinator-restart-durability.test.ts` | `bun test tests/behaviour/coordinator-restart-durability.test.ts` | Closed/reopened store handles; replay control | To Implement |
| TC-COORD-054 | `tests/behaviour/coordinator-fresh-budget.test.ts` | `bun test tests/behaviour/coordinator-fresh-budget.test.ts` | Old/new epoch records; preserved history | To Implement |
| TC-COORD-055 | `tests/behaviour/coordinator-restart-torn.test.ts` | `bun test tests/behaviour/coordinator-restart-torn.test.ts` | Gapped/torn ordinal fixtures; count-zero mutant | To Implement |
| TC-COORD-056 | `tests/behaviour/coordinator-budget-config.test.ts` | `bun test tests/behaviour/coordinator-budget-config.test.ts` | Budget `0`/`1`/`10`; hardcoded-bound mutant | To Implement |
| TC-COORD-060 | `tests/behaviour/coordinator-escalation-publish.test.ts` | `bun test tests/behaviour/coordinator-escalation-publish.test.ts` | Exhausted state; fixture ledger; append counter | To Implement |
| TC-COORD-061 | `tests/behaviour/coordinator-escalation-idempotent.test.ts` | `bun test tests/behaviour/coordinator-escalation-idempotent.test.ts` | Existing open owner question; duplicate counters | To Implement |
| TC-COORD-062 | `tests/behaviour/coordinator-escalation-failed.test.ts` | `bun test tests/behaviour/coordinator-escalation-failed.test.ts` | Failing blocker append; status projection | To Implement |
| TC-COORD-063 | `tests/behaviour/coordinator-escalation-slot.test.ts`; `tests/golden/coordinator.test.ts` | `bun test tests/behaviour/coordinator-escalation-slot.test.ts tests/golden/coordinator.test.ts` | Cap-sized ledger; escalation ranked ninth; index-0 render assertion; payload-predicate and near-miss-ref fixtures; omitted-count oracle | To Implement |
| TC-COORD-064 | `tests/behaviour/coordinator-escalation-surface.test.ts`; `tests/golden/{status-digest,brief}.test.ts` | `bun test tests/behaviour/coordinator-escalation-surface.test.ts tests/golden/status-digest.test.ts tests/golden/brief.test.ts` | Surface id/anchor inventory; digest/brief agreement | To Implement |
| TC-COORD-065 | `tests/behaviour/coordinator-escalation-reuse.test.ts` | `bun test tests/behaviour/coordinator-escalation-reuse.test.ts` | Same/different epoch fixtures; ref matching | To Implement |
| TC-COORD-070 | `tests/behaviour/coordinator-wake-pickup.test.ts` | `bun test tests/behaviour/coordinator-wake-pickup.test.ts` | Pickup matrix; rank/audience/status controls; wake counter | To Implement |
| TC-COORD-071 | `tests/behaviour/coordinator-wake-dedupe.test.ts` | `bun test tests/behaviour/coordinator-wake-dedupe.test.ts` | Already-woken fixture; record counter | To Implement |
| TC-COORD-072 | `tests/behaviour/coordinator-wake-answered.test.ts` | `bun test tests/behaviour/coordinator-wake-answered.test.ts` | Answer-between-ranking-and-wake fixture | To Implement |
| TC-COORD-073 | `tests/behaviour/coordinator-wake-paths.test.ts` | `bun test tests/behaviour/coordinator-wake-paths.test.ts` | Live/resume/spawn session facts; wake record | To Implement |
| TC-COORD-074 | `tests/behaviour/coordinator-wake-failed.test.ts` | `bun test tests/behaviour/coordinator-wake-failed.test.ts` | Failing delivery; retry tick; persisted-vs-tick-result counter | To Implement |
| TC-COORD-075 | `tests/behaviour/coordinator-wake-next.test.ts` | `bun test tests/behaviour/coordinator-wake-next.test.ts` | Answered-then-new-top ledger; two wake records | To Implement |
| TC-COORD-080 | `tests/behaviour/coordinator-config.test.ts`; `tests/fixtures/config/**` | `bun test tests/behaviour/coordinator-config.test.ts` | Six-key default/explicit/invalid/boundary fixtures; literal mutant | To Implement |
| TC-COORD-081 | `tests/structure/error-table.test.ts` (extended); `packages/core/src/contracts/error-table.ts`; `scripts/checks/error-table-sync.ts` | `bun test tests/structure/error-table.test.ts` | In-memory table; committed existing-row fingerprint; exact counts (set 24, table 105); both gate files | Existing – Update |
| TC-COORD-082 | `tests/checks/error-table-sync.test.ts`; `tests/fixtures/result/code-corpora/*.json`; `doc/spec/features/feature-result-contract.md` | `bun test tests/checks/error-table-sync.test.ts`; `bun run scripts/checks/error-table-sync.ts` | Temp-copy mutation roots; true/false-positive corpora | Existing – Update |
| TC-COORD-083 | `tests/behaviour/coordinator-records.test.ts`; `tests/structure/state-contract.test.ts` | `bun test tests/behaviour/coordinator-records.test.ts tests/structure/state-contract.test.ts` | Valid/torn/unknown/gapped/permission fixtures; four-action fence and two-phase stuck validation; schema assertion | To Implement |
| TC-COORD-084 | `tests/checks/coordinator-privacy.test.ts`; `tests/checks/secret-read-boundary.test.ts` | `bun test tests/checks/coordinator-privacy.test.ts tests/checks/secret-read-boundary.test.ts` | Privacy canaries; 512-byte evidence bound; redaction scan | To Implement |
| TC-COORD-085 | `tests/structure/coordinator-kill-target.test.ts`; `tests/boundaries` | `bun test tests/structure/coordinator-kill-target.test.ts tests/boundaries`; `pnpm check:boundaries` | Shell-call scan; no-network/no-privilege scan; mutant | To Implement |
| TC-COORD-086 | `tests/checks/coordinator-determinism.test.ts`; `tests/golden/coordinator.test.ts` | `bun test tests/checks/coordinator-determinism.test.ts tests/golden/coordinator.test.ts` | Two identical stores; injected clock/ids/brand; byte comparison | To Implement |
| TC-COORD-087 | `tests/behaviour/coordinator-idempotency.test.ts` | `bun test tests/behaviour/coordinator-idempotency.test.ts` | Action-record counters plus lease-pair expectation; stuck-phase and stop replay controls | To Implement |
| TC-COORD-088 | `tests/behaviour/coordinator-performance.test.ts`; `tests/behaviour/coordinator-read-cost.test.ts` | `bun test tests/behaviour/coordinator-performance.test.ts tests/behaviour/coordinator-read-cost.test.ts` | Reference store; p95 method; per-store read counters; bound assertions (GAP-T6) | To Implement |
| TC-COORD-089 | existing `tests/{structure,behaviour,golden,conformance,boundaries}` suites; `scripts/**` | `bun test tests/structure tests/behaviour tests/golden tests/conformance`; `bun test tests/boundaries`; `git diff --name-only` | Unchanged suites plus the declared reserved-slot golden update | Existing – Update |
| TC-COORD-090 | change-artifact trace review; `doc/spec/features/feature-coordinator-supervision.md` | Manual review against Appendix A; TC/AC cross-reference | — | Manual Only |
| TC-COORD-091 | `tests/behaviour/coordinator-scenario.test.ts` | `bun test tests/behaviour/coordinator-scenario.test.ts` | In-process CLI + fake process harness over a temp state root | To Implement |
| TC-COORD-092 | `doc/spec/features/feature-coordinator-supervision.md`, `doc/spec/features/{session-lifecycle-economics,blockers,brief,status-digest,harness-adapters}.md`, `cli-command-registry.md`, `m1/{contracts,man-page}.md`, `doc/decisions/**` | Manual review; `bash scripts/.tests/test-doc-distribution.sh`; `git diff --check` | — | Manual Only |
| TC-COORD-093 | `tests/behaviour/coordinator-lease-liveness.test.ts`; `tests/fixtures/coordinator/process-port.ts` | `bun test tests/behaviour/coordinator-lease-liveness.test.ts` | Old-but-live lease fixture; `alive(handle)` fake; fake clock; refusal/stop oracle; age-vs-liveness control | To Implement |
| TC-COORD-094 | `tests/behaviour/coordinator-claim-race.test.ts`; `tests/fixtures/state/harness.ts` | `bun test tests/behaviour/coordinator-claim-race.test.ts` | Two store handles; deterministic interleaving controller; acquire barrier; forced `state.lock.busy`; single-acquisition counter | To Implement |
| TC-COORD-095 | `tests/behaviour/coordinator-tick-takeover.test.ts`; `tests/fixtures/coordinator/process-port.ts` | `bun test tests/behaviour/coordinator-tick-takeover.test.ts` | Crashed-holder (`alive=false`) `acquired`/`stop-requested` roots; one-cycle/one-lease-pair oracle; no-`start`-required control | To Implement |

**Fixture helper obligations:**

- `tests/fixtures/coordinator/harness.ts` — an in-process `runCli` harness with injected clock/ids/brand/config/state/process/blocker seams, a call recorder, and counters for spawn, resume, alive, kill (TERM/KILL), progress reads, state appends, blocker reads, and destructive actions.
- `tests/fixtures/coordinator/process-port.ts` — the fake process-lifecycle port with a fake clock, per-capability `declared`/`missing`, `alive(handle)` (with a controlled `true`/`false`/`unknown` and a lease age), matching/mismatched `pid`+`processStartTimeMs`, handle-only kill, TERM/KILL phase logs, and positive/zero/absent `token-delta`/`session-traffic` readings.
- `tests/fixtures/coordinator/claim-race.ts` — two independent store handles over one temp root plus a deterministic interleaving controller and acquire barrier (no sleeps), with forced `acquireFence` results (`state.lock.busy` stale/non-stale, `state.write.failed`) and a single-acquisition counter.
- `tests/fixtures/coordinator/states.ts` — valid/torn/unknown/gapped/permission-denied coordinator record and state-root fixtures, including the `acquired`→`stop-requested`→`released`→single-`stale-takeover` lease sequence (no following `acquired`), the liveness-first matrix (`alive` true/false/unknown × young/old), the crashed-holder tick-recovery root, and two-phase `stuck` fixtures.
- `tests/fixtures/coordinator/lifecycle.ts` — session/context/capability matrices with expected decision, reason, and ordinal.
- `tests/fixtures/coordinator/evidence.ts` — the 3×3×3 evidence matrix plus fingerprint/turn couples and progress-bound windows.
- `tests/fixtures/coordinator/blockers.ts` — pickups, absent-status rank-1, cap boundaries, near-miss escalation refs, and the escalation-ranked-ninth ledger.
- `tests/fixtures/coordinator/golden/` — normalized `tick`/`status` data and text plus the reserved-slot status/brief goldens; explicit regeneration only.
- `tests/fixtures/coordinator/mutants/` — the mutant modules and their expected tripping suite/message.
- Reused unchanged: `tests/fixtures/state/harness.ts`, `tests/fixtures/blockers/{harness.ts,records.ts,bounds/**,capabilities/**,ranking/**}`, `tests/fixtures/status/harness.ts`, `tests/fixtures/brief/harness.ts`, `tests/fixtures/config/**`.

**Expected gate battery for this change:**

1. Narrow iteration: `bun test tests/structure/coordinator-*.test.ts tests/structure/error-table.test.ts tests/behaviour/coordinator-*.test.ts`.
2. Binding and brand: `bun run scripts/checks/error-table-sync.ts`; `pnpm check:forbidden-literals`; `bun run scripts/checks/ambient-globals.ts`.
3. Conformance and boundaries: `bun test tests/boundaries`; `pnpm check:boundaries`.
4. Goldens: `bun test tests/golden/coordinator.test.ts tests/golden/status-digest.test.ts tests/golden/brief.test.ts` (the only permitted status/brief golden diff is the reserved-slot case).
5. Aggregate: `pnpm check` (lint → format:check → typecheck → test → check:boundaries → exports parity) plus `git diff --check`.
6. Documentation: `bash scripts/.tests/test-doc-distribution.sh` when a marker-scoped doc changes.

**Exit criteria.**

- All 48 ACs traced to at least one passing TC; no orphan TC; SC-M1-25 clause map complete.
- All 72 TCs green (or `Manual Only` TCs signed off in phase 7 with evidence).
- `pnpm check` green: lint, format, typecheck, full `bun test`, boundaries, exports parity; `git diff --check` clean.
- No new lint warnings; no rule loosening; the fixture-coverage meta-check reports no unenforced rule.
- `bun run scripts/checks/error-table-sync.ts` green: 105 entries, 105 documented rows, six coordinator identities recognized, the reserved two-segment set exactly 24 (both gate files), corpora non-vacuous.
- `bash scripts/.tests/test-doc-distribution.sh` green for changed marker-scoped docs.
- The only permitted status/brief golden diff is the reserved escalation slot; blockers ranking, economics records, lane records, and `ceo-loop.sh` are byte-unchanged.
- Every process-boundary claim uses a reopened store handle; every absence claim has its three observations (GAP-T3); every declared test-method constraint names GAP-T2..GAP-T6, and no GAP-1..GAP-6, GAP-T1, or GAP-T7 assertion remains; the plan v1.2/v1.3 TC→phase map contains all 72 ids and no orphan (PLAN-MAP satisfied).
- The v1.3 pinned observables hold: the four-action instance lease folded by ledger sequence, liveness-first atomic claim and single-record takeover, `tick` crash recovery, per-append state-fence recovery, foreground-only v1, the two-phase stuck fold with `stuckId = iterationId`, the persisted-stuck/`tickVerdict` split, the two-input state fingerprint, the `progress-bound` veto, the render-first reserved slot, `exhausted-escalated`, absent-status pickup, and PID identity verification.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Risk | Impact | Mitigation |
|----|------|--------|------------|
| TR-1 | A large working coordinator session is killed as stuck because the corroborator is not wired, the new-turn source is wrong, or a CPU-only reading is used. | H | TC-COORD-029/033/037 require a positive `token-delta` or `session-traffic` within `progress-bound` to veto, plus a structural no-CPU scan and mutants; the fake port exposes the delivered liveness fields, and a CPU-shaped fixture must be ignored. |
| TR-2 | `unevaluable` is silently treated as `progressing`, so a torn store hides a wedged coordinator or a stale store causes a wrong kill. | H | TC-COORD-035/036/055 assert exit `2`, the state identity, zero kill/spawn, and a fabricated-stale/count-zero mutant; no exit-`0` result on unknown state. |
| TR-3 | The restart budget is cached in memory or conflated with the lane/economics budget, so a supervisor restart resets or double-counts. | H | TC-COORD-025/050/053/055 assert durable reopened-handle reads, the distinct namespace, byte-unchanged lane/economics records, and a replayed ordinal appending nothing. |
| TR-4 | Exhaustion is "escalated" but the question is crowded out of the eight-question render, making "never silent" false. | H | TC-COORD-063/064 pin the reserved slot at index `0` with seven others in rank order, the omitted count, no ninth, `exhausted-escalated`, and digest/brief agreement; a dropped-slot / rank-position mutant must fail. |
| TR-5 | A duplicate or thundering-herd wake, or a retry that never happens after `delivery-failed`. | H | TC-COORD-071 asserts one wake per question with persisted `askedAt`; TC-COORD-074 pins the persisted-vs-tick-result split (only `woken` persists and consumes the lifetime) and a record counter. |
| TR-6 | The reserved-slot predicate is implemented as a coordinator-state read, adding an undeclared read or making status depend on supervisor state. | M | AC-F6-1 pins the payload-only predicate; TC-COORD-063 asserts payload-determinable selection (type/audience/lane/ref shape) with near-miss rejection and TC-COORD-088 asserts read counts. |
| TR-7 | A two-segment coordinator identity fails the code-format gate, or a wildcard is used to pass it. | H | TC-COORD-081/082 pin the exact two-code addition (`coordinator.already-running`, `coordinator.restart-budget-exhausted`), exact set/table totals 24/105, the other four three-segment, and a near-miss rejection; no wildcard. |
| TR-8 | The status/brief goldens are regenerated wholesale, hiding a ranking, index, or anchor regression. | H | TC-COORD-089 asserts the only permitted diff is the reserved-slot case and names the unchanged suites; TC-COORD-063/064 assert the first-by-index rule; goldens are read-only with `mtimeMs` asserted. |
| TR-9 | The fake process port makes the kill test vacuous (it always "succeeds"), the real path shells out, or it signals a reused pid. | H | TC-COORD-041/042/043/045/085 use declared `failed` and identity-mismatch outcomes, a signal phase log, an AST scan for shell/name kill, a pre-TERM identity assertion, and a kill-only-under-current-lease counter; a shell/identity mutant must fail. |
| TR-10 | "Within one collection cycle" is read as a scheduler claim, and the test sleeps or flakes. | M | GAP-T2 pins the tick-model assertion and caller-bounded semantics; TC-COORD-029/070/030 use the injected clock and one-tick semantics, never a sleep. |
| TR-11 | Performance tests are flaky in CI and get softened. | M | GAP-T6 pins the method and environment; TC-COORD-088 records iteration count and environment, and a bound relaxation requires an explicit reviewed change. |
| TR-12 | The `ceo-loop.sh` function map is claimed but one function has no passing AC trace. | M | TC-COORD-090/091 enumerate the five functions and their TC/AC traces; a missing trace fails the manual review and the DoD gate. |
| TR-13 | PID reuse causes the supervisor to signal an unrelated process between the expectation and TERM. | H | TC-COORD-045 verifies the recorded `pid` + `processStartTimeMs` before TERM; a mismatch sends no signal, records `killFailureReason=identity-mismatch`, and exits `2`; TC-COORD-085 asserts the identity check on the kill path. |
| TR-14 | The instance lease drifts into a lifetime state-fence hold, or `stop` tries to release another process's handle. | H | TC-COORD-010/011/017/018 assert the lease records and per-append fence acquire/release, and that `stop` appends `stop-requested` without calling `releaseFence` for a foreign handle. |
| TR-15 | Takeover becomes age-based again, or the per-append helper conflates the lease decision with state-fence recovery. | H | TC-COORD-015/017/093 assert liveness-first takeover, single-record takeover, a `recoverFence` spy used only for an age-stale **state fence** (once + retry), and no `contracts/state.ts` change. |
| TR-16 | The claim is a read-fold-then-append, so two concurrent `start`/`tick` processes both read a free lease and both append `acquired`. | H | TC-COORD-094 asserts the one fenced critical section (`acquireFence` → re-read → append → `releaseFence`) over two store handles, exactly one acquisition per interleaving, and a failing mutant that re-reads before the acquire. |
| TR-17 | `tick` cannot recover a crashed holder, so the one-shot surface blocks forever on a dead holder's lease. | H | TC-COORD-095 asserts `tick` appends one `stale-takeover`, one cycle, one `released` without a `start`; a mutant that requires `start` fails. |
| TR-18 | Lease age overrides a positive `alive`, letting a second supervisor steal a live holder and making `stop` report `not-running` for a live supervisor. | H | TC-COORD-093/011 assert a live old holder is refused by `start`/`tick` and remains stoppable (`requested=true`, `released=false`); TC-COORD-015 asserts a dead holder is taken over at the same age. |
| TR-19 | The `progressing` verdict cannot populate the declared payload, so an implementation invents a phase/reason or drops the tick result. | M | TC-COORD-012/013 assert `data.stuck` is the last persisted verdict with non-null phase/reason/evidence, while `tickVerdict` carries nullable phase/reason/evidence for `progressing`; a mutant that persists `progressing` fails. |

### 8.2 Assumptions

- M1-S15 (GH-235) and M1-S16 (GH-230) are delivered and stable; their sourced progress signals, shared ranking, `isCoordinatorPickup`, blocker ledger, and brief anchor are consumed as current contracts and are not re-implemented.
- The state layer supports additive record kinds under `delivery.state.v1` without a schema bump, migration, or derived document.
- The harness adapter can expose a stable session handle and process identity sufficient for alive, resume, and kill; capability ownership is the pinned four-way split (resume → decision input, spawn → harness identity exit `1`, alive/kill → coordinator process gap exit `2`, progress → `unknown` class).
- The process-lifecycle port is injected at the CLI edge and faked in tests; the domain remains pure and owns no I/O, clock, randomness, environment, or network.
- One coordinator exists per state-dir scope; multi-coordinator, multi-host, and remote supervision are out of scope.
- The supervisor runs as the same OS user as the coordinator; the state-dir instance lease and filesystem permissions are the boundary, every append takes the state write fence only for that append (with one age-stale `recoverFence` retry, else `state.lock.busy`/`state.write.failed`), and no privilege escalation is needed. In v1 the supervisor runs only in the foreground; detached or OS-unit hosting is the M1-S18 seam.
- POSIX process signals are available on the reference host; the Windows equivalent is behind the same port and is not exercised on Linux.
- The owner reads the brief and the operator reads `coordinator status`; no additional notification channel is assumed.
- Module paths, export names, record-kind strings, schema ids, store-key spellings, and human labels are delivery-bound (GAP-T5); their behaviour, identities, closedness, and AC traceability are pinned.
- Bun `1.4.4` is available and `bun:test` is the only runner; no Jest/Vitest.

### 8.3 Open Questions

| ID | Question | Status | Resolution |
|----|----------|--------|------------|
| OQ-T1 | Does `tick` run a cycle when a live instance lease exists, or is it refused? | Resolved | A live holder is refused `coordinator.already-running` exit `2` (AC-F8-1); a dead holder is taken over by `tick` itself (AC-F8-6). TC-COORD-012/043/095. |
| OQ-T2 | Which layer owns `resume`, and which identity/exit applies when it is undeclared? | Resolved | Four-way split in DEC-11/§8.4: resume undeclared/unavailable → `spawn-fresh session-interrupted`, one ordinal, exit `0`, no error. TC-COORD-022/044. |
| OQ-T3 | How does the digest/brief identify the reserved escalation question? | Resolved | Payload-only predicate (type `decision-needed`, audience `owner`, lane `coordinator`, `ref` shape `<coordinatorId>#<budgetEpochId>` with exactly one `#`); no extra read; eight-question bound unchanged. TC-COORD-063. |
| OQ-T4 | Does a `delivery-failed` wake attempt consume the one-wake budget? | Resolved | Only a persisted `woken` consumes it; `already-woken` is a no-op; `delivery-failed`, `answered-before-wake`, and `no-pickup` append no record. TC-COORD-071/072/074. |
| OQ-T5 | Where is `reason=stuck-artifact-evidence` recorded? | Resolved | The `coordinator.stuck` record carries a closed `reason` (`stuck-artifact-evidence` / `evidence-unevaluable`), distinct from the restart reason. TC-COORD-030/039. |
| OQ-T6 | Which durable carrier holds the stale-holder takeover evidence? | Resolved | The durable `coordinator.fence` instance-lease record (`action`/`instanceId`/`holder`/`previousHolder`/`fenceAgeMs`), readable from `status`; a `stale-takeover` is itself the new acquisition and is never followed by `acquired`. TC-COORD-015/017/018. |
| OQ-T7 | Which exact counts must TC-COORD-081 assert after the six rows land? | Resolved | Set 22→24 with exactly `coordinator.already-running` and `coordinator.restart-budget-exhausted`; table 99→105; the other four three-segment. TC-COORD-081/082. |
| OQ-T8 | What is the durable instance identity, given the closed six-kind set? | Resolved (RF-01/RF2-11) | The latest `coordinator.fence` record **by ledger sequence** is the instance identity (`instanceId`, `pid`, `holder`, `startedAt` = acquisition record time, `supervisorMode`, `externalUnit`); no separate instance record/payload. TC-COORD-018. |
| OQ-T9 | How is the pre-kill verdict and post-kill outcome represented on an append-only record? | Resolved (RF-04/RF2-11/RF2-12) | Two appends under one `stuckId = iterationId`: `phase=verdict` (`killOutcome=not-attempted`) then `phase=outcome`; reads fold latest-wins by **ledger sequence** (`recordedAt` descriptive only); a replay appends nothing. TC-COORD-030/040/041/045/083/087. |
| OQ-T10 | What is a "new turn" and what is its bound? | Resolved (RF-08/A3) | A positive `token-delta` OR positive `session-traffic` from the delivered liveness facts, mapped at the adapter; `coordinator.progress-bound` defaults to 300 000 ms; absent → `unknown`; next-tick/caller-bounded. TC-COORD-029/033/080. |
| OQ-T11 | Which inputs may the digest-input fingerprint read? | Resolved (RF-09) | Only the state event-log cursor and the open coordinator-audience question count; no ready-to-merge, tracker, CI, or network read. TC-COORD-032. |
| OQ-T12 | What is the idempotent exhausted-tick state called? | Resolved (RF-10) | `exhausted-escalated`; `escalated` is not a declared state. TC-COORD-061/065. |
| OQ-T13 | Where does the reserved escalation question render? | Resolved (RF-12) | First by index (`0`) in both `typed-questions` and `blocker-questions`; up to seven others in rank order; the lowest-ranked is displaced and counted as omitted. TC-COORD-063/064. |
| OQ-T14 | How is PID reuse prevented from signalling an unrelated process? | Resolved (A2/AC-F4-4) | Verify the recorded `pid` + `processStartTimeMs` before TERM; a mismatch sends no signal, records `killFailureReason=identity-mismatch`, and exits `2`. TC-COORD-045. |
| OQ-T15 | Does an absent question `status` count as open for pickup? | Resolved (A6) | Yes; `no-pickup` is only for non-rank-1, non-coordinator, or explicitly non-open heads (and empty ledgers). TC-COORD-070. |
| OQ-T16 | How is a live old lease distinguished from a dead holder's lease? | Resolved (RF2-01) | Liveness-first: `alive=true` is held/refused regardless of age; `alive=false` is takeover-eligible; unknown/unavailable uses the 2×`collection-interval` age fallback only; no heartbeat records. TC-COORD-093/015/011. |
| OQ-T17 | How is the claim made atomic against two concurrent processes? | Resolved (RF2-02) | One `acquireFence` → re-read fold + `alive` → append one `acquired`/`stale-takeover` → `releaseFence` critical section; claim-time `state.lock.busy` maps to `coordinator.already-running`. TC-COORD-094/010. |
| OQ-T18 | Can `tick` recover a crashed holder without a `start`? | Resolved (RF2-03) | Yes; `tick` shares the claim/takeover path and appends one `stale-takeover`, one cycle, one `released`. TC-COORD-095. |
| OQ-T19 | Does the per-append helper recover an age-stale state fence? | Resolved (RF2-07) | `fenceStatus` + one `recoverFence` + one acquire retry; otherwise the delivered `state.lock.busy`; a failed append returns `state.write.failed`; no `contracts/state.ts` change. TC-COORD-017/043. |
| OQ-T20 | What is `supervisorMode` in v1 and how does a bare `start` behave? | Resolved (RF2-09) | Exactly `foreground`; `detached` is reserved and never produced; `externalUnit=absent`; a bare `start` is `fallback.invocation` exit `1`; the supervisor records its own pid/start time. TC-COORD-010/013/014. |
| OQ-T21 | How is a `progressing` verdict represented in the payload? | Resolved (RF2-10) | `data.stuck` is the last persisted verdict with non-null phase/reason/evidence (or null); the tick result's separate `tickVerdict` has nullable phase/reason/evidence when `progressing`. TC-COORD-012/013. |
| OQ-T22 | What orders every coordinator fold? | Resolved (RF2-11) | Ledger sequence is the primary fold key for lease, stuck, last decision, and last wake; `recordedAt` is descriptive only and never the tie-break. TC-COORD-017/018/030/040. |
| OQ-T23 | How is `stuckId` derived for the replay guard? | Resolved (RF2-12) | `stuckId = iterationId`; a replay appends nothing; a different iteration yields a different `stuckId`. TC-COORD-030/040/087. |

No specification question remains open. Every DoR iteration-1 and iteration-2 finding is resolved in specification v1.3.

### 8.4 Specification Resolutions (v1.3) — No Remaining Gaps

All blocking and advisory DoR iteration-1 and iteration-2 findings are resolved in specification v1.3. The table records each pinned resolution and the TCs that verify it; nothing is pending arbitration.

| Finding | Location in spec v1.3 | Pinned resolution | Verifying TCs |
|---------|-----------------------|-------------------|---------------|
| RF-01 / A1 | F-1, AC-F1-1..4, EVT-7, DM-11, Appendix G | The latest `coordinator.fence` record **by ledger sequence is the instance identity** (`instanceId`, `pid`, `holder`, `startedAt` = acquisition record time, `supervisorMode` exactly `foreground` in v1 with `detached` reserved, `externalUnit` `absent`); no separate instance record kind or payload; the record-kind set stays six. | TC-COORD-018, TC-COORD-010, TC-COORD-013 |
| RF-05 / RF-06 / RF-07 | F-1, F-6, F-8, AC-F1-1, AC-F1-3, AC-F6-1, AC-F8-3 | Coordinator ownership is a durable append-only instance lease; every write takes the delivered state write fence for that append only, through a helper that recovers one age-stale state fence and retries once; `stop` appends `stop-requested` and never releases another process's handle; escalation publishing composes with the delivered `appendBlockerQuestion` without a handle-reusing refactor. | TC-COORD-010, TC-COORD-011, TC-COORD-015, TC-COORD-017, TC-COORD-043, TC-COORD-060 |
| RF-04 / RF2-11 / RF2-12 | F-3, F-4, AC-F3-1, AC-F4-1, AC-F4-2, EVT-3, DM-3 | The stuck record is two-phase under one `stuckId = iterationId`; `phase=verdict` with `killOutcome=not-attempted` precedes the kill, `phase=outcome` follows; deterministic latest-wins fold by **ledger sequence** (`recordedAt` descriptive only); a replay appends nothing. | TC-COORD-030, TC-COORD-040, TC-COORD-041, TC-COORD-045, TC-COORD-083, TC-COORD-087 |
| RF2-01 | F-1, F-8, AC-F1-3, AC-F8-1, AC-F8-3, AC-F8-4, Appendix B | Lease liveness is decided before age: `alive=true` -> held/refused regardless of age and still stoppable; `alive=false` -> takeover-eligible; `alive` unknown/unavailable -> takeover only when age > 2×`collection-interval`, otherwise refused; no heartbeat or lease-refresh records. | TC-COORD-093, TC-COORD-015, TC-COORD-011 |
| RF2-02 | F-1, F-8, AC-F1-1, AC-F8-1, AC-F8-5 | The claim/takeover is one fenced critical section: `acquireFence` → re-read the lease fold and `alive(handle)` → append one `acquired` or one `stale-takeover` → `releaseFence`; claim-time `state.lock.busy` maps to `coordinator.already-running`; two concurrent claims yield exactly one acquisition. | TC-COORD-094, TC-COORD-010, TC-COORD-017 |
| RF2-03 | F-1, AC-F1-2, AC-F8-1, AC-F8-6 | `tick` shares the claim/takeover path, so a crashed holder is recovered by `tick` (one `stale-takeover`, one cycle, one `released`) and a live holder refuses the tick. | TC-COORD-095, TC-COORD-012, TC-COORD-043 |
| RF2-05 | F-1, §8.2, NFR-6, AC-F1-2, AC-NFR-1 | Every `tick` appends exactly one lease pair as expected volume; a quiet cycle appends no action record; NFR-6's idempotency claim covers action records (restart, stuck, wake, exhaustion), not the per-tick lease pair. | TC-COORD-012, TC-COORD-017, TC-COORD-087 |
| RF2-06 | F-1, F-8, AC-F8-3, EVT-7, DM-11 | A `stale-takeover` is itself the new acquisition with `previousHolder`/`fenceAgeMs`; no following `acquired`; a crash after takeover leaves the new holder recorded. | TC-COORD-015, TC-COORD-017, TC-COORD-018 |
| RF2-07 | F-1, F-8, AC-F10-3, NFR-14, Appendix F, RSK-14 | The per-append helper calls `fenceStatus`, recovers an age-stale state fence via the delivered `recoverFence` once and retries the acquire once; otherwise the delivered `state.lock.busy` at exit `2`; a failed append returns `state.write.failed`; no `contracts/state.ts` change is needed. | TC-COORD-017, TC-COORD-043 |
| RF2-09 | F-1, F-8, AC-F1-1, AC-F8-2, Appendix G | v1 is foreground-only (`supervisorMode` exactly `foreground`); `detached` is reserved and never produced; `externalUnit=absent`; a bare `start` is `fallback.invocation` exit `1` naming `--foreground` and the M1-S18 seam; the supervisor records its own pid/process start time. | TC-COORD-010, TC-COORD-013, TC-COORD-014 |
| RF2-10 | F-9, AC-F9-1, Appendix G | `data.stuck` is the last persisted verdict with non-null phase/reason/evidence (or null); the tick result carries a separate `tickVerdict` whose phase/reason/evidence are nullable when `progressing`; `progressing` is never persisted. | TC-COORD-012, TC-COORD-013 |
| RF2-11 | F-1, F-3, EVT-7, DM-3, DM-11 | Ledger sequence is the primary fold key for lease, stuck, last decision, and last wake; `recordedAt` is descriptive only and never the tie-break. | TC-COORD-017, TC-COORD-018, TC-COORD-030, TC-COORD-040 |
| RF2-12 | F-3, EVT-3, DM-3, Appendix E | `stuckId` equals the active expectation's `iterationId`; a replay appends nothing; a different iteration yields a different `stuckId`. | TC-COORD-030, TC-COORD-040, TC-COORD-087 |
| RF2-08 | Test plan §1.2, §8.4, §7 exit criteria | The stale PLAN-MAP bullet and remaining-item statement are removed; the plan maps all 69 v1.2 TCs and its v1.3 revision maps the full v1.3 set (including TC-COORD-093/094/095); no TC is unmapped. | Plan link; TC-COORD-090/092 |
| RF-08 / A3 | F-3, AC-F3-2, AC-F3-3, DM-7, DEC-4, Appendix D | A new turn is a positive `token-delta` or `session-traffic` reading from the delivered liveness facts; the adapter maps the raw fields to `newTurn`/`progressing`; absent → `unknown`; `coordinator.progress-bound` defaults to 300 000 ms; NFR-8/9 are next-tick and caller-bounded. | TC-COORD-029, TC-COORD-033, TC-COORD-034, TC-COORD-080 |
| RF-09 | F-3, AC-F3-1, EVT-1, DM-3 | The fingerprint reads only the state event-log cursor and the open coordinator-audience question count; no ready-to-merge, tracker, CI, or network input. | TC-COORD-032, TC-COORD-030 |
| RF-10 | F-6, AC-F6-3, Appendix B, Appendix F | The idempotent exhausted state is `exhausted-escalated`; `escalated` is undeclared. | TC-COORD-061, TC-COORD-065 |
| RF-12 | F-6, AC-F6-1, EVT-6, §10 | The reserved question renders first by index (`0`) in both `typed-questions` and `blocker-questions`; up to seven others in rank order; the lowest-ranked is displaced and counted as omitted, within the eight-question bound. | TC-COORD-063, TC-COORD-064 |
| A2 / AC-F4-4 | F-4, AC-F4-4, NFR-14, Appendix F | Before TERM the port verifies the recorded `pid` + `processStartTimeMs`; a mismatch sends no signal, records `killFailureReason=identity-mismatch`, and returns `coordinator.session.kill-failed` exit `2`. | TC-COORD-045, TC-COORD-041 |
| A6 | F-7, AC-F7-3, DEC-9 | An absent question `status` counts as open; `no-pickup` is only for non-rank-1, non-coordinator, or explicitly non-open heads (and empty ledgers). | TC-COORD-070 |
| A5 / GAP-T1 | Test plan front matter, §2 | The implementation plan exists (`chg-GH-241-plan.yaml`); GAP-T1 is removed and `links.implementation_plan` is set; the remaining test-method constraints are GAP-T2..GAP-T6. | Plan link; TC-COORD-090/092 |
| GAP-1..GAP-6 / GAP-T7 (v1.1) | Prior spec v1.1 sections | Still valid: uncontended-tick semantics, four-way capability ownership, payload-only predicate, persisted-`woken`-only accounting, closed stuck `reason`, the fence record, and the exact two-code allowlist (set 22→24, table 99→105). | TC-COORD-012/043, 022/044, 063/064, 071/072/074, 030/039, 015/017, 081/082 |

**Remaining specification gaps: none.** All DoR iteration-1 and iteration-2 findings are resolved in specification v1.3. GAP-T1 stays removed and the PLAN-MAP item is closed because the plan maps every v1.2 TC and its v1.3 revision maps the full set including TC-COORD-093/094/095. The only remaining items are the declared test-method constraints GAP-T2..GAP-T6, which are not specification ambiguities or deferred contracts.

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-07 | test-plan-writer | Initial test plan derived from `chg-GH-241-spec.md` v1.0, ticket GH-241, backlog M1-S23, seed scenario SC-M1-25, the delivered GH-235 economics and GH-230 blockers surfaces, and `.ai/rules/testing-strategy.md`. 64 scenarios; all 43 ACs covered; SC-M1-25 reconciled clause by clause; GAP-1..GAP-6 and GAP-T1..GAP-T7 recorded. |
| 1.1 | 2026-11-07 | test-plan-writer | Realigned to specification v1.1 (committed `08818818`). Removed every GAP-1..GAP-6 and GAP-T7 arbitration marker and replaced each with its pinned contract: uncontended-tick semantics, four-way capability ownership, payload-only reserved-slot predicate, persisted-`woken`-only wake accounting, closed `coordinator.stuck.reason`, the `coordinator.fence` record (EVT-7, DM-11), and the exact two-code two-segment allowlist (set 22→24; table 99→105). Added TC-COORD-017 (fence records) and TC-COORD-039 (stuck reason); rewrote TC-COORD-044 for the four-way split, TC-COORD-063 for the payload predicate, and TC-COORD-071/072/074 for tick-result wake outcomes; updated TC-COORD-030/035/081/082/083 and all coverage tables. 66 scenarios; 43/43 ACs covered; GAP-T1..GAP-T6 retained as declared test-method constraints; no specification gap remains. |
| 1.2 | 2026-11-07 | test-plan-writer | Realigned to specification v1.2 and the DoR iteration-1 findings (RF-01..RF-12, A1/A2/A3/A5/A6). Removed every assertion that the supervisor holds the state fence for its lifetime and replaced it with the durable append-only **instance lease** carried by `coordinator.fence` records (`acquired`, `released`, `stale-takeover`, `stop-requested`): `stop` is a recorded request (`requested=true`/`released=false` or `not-running`), the live supervisor appends `released` at the next cycle boundary, stale takeover is holder `alive(handle)` absent or lease age > 2x `collection-interval` with no `recoverFence` and no `contracts/state.ts` change, and every append takes the state write fence for that append only. Added **AC-F1-4** (instance identity folded from the latest lease; no separate instance record) and **AC-F4-4** (PID + process-start-time identity mismatch), bringing the plan to **45 ACs**. Added TC-COORD-018 (instance lease identity), TC-COORD-029 (adapter `token-delta`/`session-traffic` new-turn mapping and `progress-bound`), and TC-COORD-045 (identity-mismatch kill), and updated TC-COORD-010/011/012/013/014/015/016/017/030/032/033/034/039/040/041/043/060/061/063/064/070/080/083/087/091/092 plus every coverage table, risk, open question, and resolution row. Replaced the one-record stuck assertion with the two-phase `phase=verdict`/`phase=outcome` same-`stuckId` latest-wins fold (a replay appends nothing); removed the ready-to-merge fingerprint input; pinned `exhausted-escalated`; asserted the reserved question first by index with the lowest-ranked displaced; pinned `supervisorMode` exactly `foreground`/`detached` and `externalUnit` exactly `absent`; updated the config branch to six keys (adding `coordinator.progress-bound`, default 300 000 ms) and the boundary cases; removed GAP-T1 (the plan `chg-GH-241-plan.yaml` now exists and `links.implementation_plan` is set). 69 scenarios; 45/45 ACs covered; SC-M1-25 clause map complete; no specification gap remains; GAP-T2..GAP-T6 remain declared test-method constraints. |
| 1.3 | 2026-11-07 | test-plan-writer | Realigned to specification v1.3 and the DoR iteration-2 findings (RF2-01..RF2-12). Replaced every age-OR takeover assertion with the liveness-first rule (`alive=true` held/refused regardless of age and still stoppable; `alive=false` takeover-eligible; `alive` unknown age-fallback only past 2×`collection-interval`; no heartbeat records); pinned the claim/takeover as one fenced critical section (`acquireFence` → re-read fold and `alive` → append one `acquired` or one `stale-takeover` → `releaseFence`) with `state.lock.busy` mapped to `coordinator.already-running`; made `tick` share the claim/takeover path and recover a crashed holder; declared the per-tick lease pair as expected volume and NFR-6 as action-record-only; made `stale-takeover` a single-record acquisition with no following `acquired`; added the per-append stale-lock recovery (`fenceStatus` + one `recoverFence` + one retry, else `state.lock.busy`/`state.write.failed`, no `contracts/state.ts` change); restricted v1 to `start --foreground` with bare `start` = `fallback.invocation` exit 1, `detached` reserved and never produced, and the supervisor's own pid/start time; split the persisted `data.stuck` from the tick's `tickVerdict` (nullable phase/reason/evidence when `progressing`); made ledger sequence the primary fold key; pinned `stuckId = iterationId`. Added AC-F8-4/F8-5/F8-6, bringing the spec to **48 ACs**, and added TC-COORD-093 (live old holder refusal/stop), TC-COORD-094 (two-handle atomic claim race), and TC-COORD-095 (tick crash recovery), bringing the plan to **72 TCs**; updated TC-COORD-003/010/011/012/013/014/015/016/017/018/030/040/043/087/091/092 and every coverage table, interface table, risk, open question, and resolution row; removed the stale PLAN-MAP bullet and remaining item. 72 scenarios; 48/48 ACs covered; Scenario Index = Details = Automation Plan; SC-M1-25 clause map complete; no specification gap remains; GAP-T2..GAP-T6 remain declared test-method constraints. |

## 10. Test Execution Log

Run date: TBD at delivery. Environment: Bun `1.4.4`, pnpm `10.18.3`, Linux x64 (worktree `feat/GH-241/coordinator-supervision`, base `main-tools`).

### 10.1 Per-TC results (delivery phases 1-10)

| TC ID | Run Date | Result | Evidence |
|-------|----------|--------|----------|
| — | — | Not run | Populated by delivery. |

### 10.2 Aggregate gate evidence

| Gate | Command | Result | Evidence |
|------|---------|--------|----------|
| Full suite | `pnpm test` | Not run | — |
| Aggregate | `pnpm check` | Not run | — |
| Error-table sync | `bun run scripts/checks/error-table-sync.ts` | Not run | — |
| Boundaries | `pnpm check:boundaries` | Not run | — |
| Diff hygiene | `git diff --check` | Not run | — |
| Doc distribution | `bash scripts/.tests/test-doc-distribution.sh` | Not run | — |

### 10.3 Deviations and observations (for the review gate)

- Specification v1.3 resolves every DoR iteration-1 and iteration-2 finding (RF-01..RF-12, RF2-01..RF2-12, A1/A2/A3/A5/A6); delivery implements the pinned contracts and must not reintroduce arbitration. GAP-T2..GAP-T6 remain declared test-method constraints; the PLAN-MAP item is closed.
- The instance lease is the append-only `coordinator.fence` record folded by ledger sequence; the claim/takeover is one fenced critical section (`acquireFence` → re-read fold and `alive` → append one `acquired` or one `stale-takeover` → `releaseFence`) with claim-time `state.lock.busy` → `coordinator.already-running`; no lifetime state write fence is held, no separate instance record exists, and `stop` never releases another process's handle.
- Liveness is decided before age: a live holder is refused and remains stoppable at any age; a dead holder is taken over with one `stale-takeover` (no following `acquired`); unknown liveness uses the 2×`collection-interval` fallback; `tick` shares the claim path and recovers a crashed holder.
- Every append uses the per-append state-fence helper (one age-stale `recoverFence` + one retry, else the delivered `state.lock.busy`; a failed append is `state.write.failed`); no `contracts/state.ts` change is needed.
- The `coordinator.stuck` record is two-phase under one `stuckId = iterationId` (`phase=verdict` with `killOutcome=not-attempted`, then `phase=outcome`) folded by ledger sequence; a replay appends nothing. `data.stuck` is the last persisted verdict with non-null phase/reason/evidence, and `tickVerdict` carries nullable phase/reason/evidence when `progressing`.
- A quiet `tick` grows the log by exactly its lease pair and no action record; NFR-6 covers action records only.
- v1 is foreground-only; `detached` is reserved and never produced; a bare `start` is `fallback.invocation` exit `1`; the supervisor records its own pid/process start time.
- The digest-input fingerprint reads only the state event-log cursor and open coordinator-question count; a new turn is a positive `token-delta` or `session-traffic` within `coordinator.progress-bound` (default 300 000 ms).
- The reserved-slot status/brief golden is the only permitted digest/brief golden diff; the escalation must be at index `0`, and any other golden change is a defect.
- Exactly `coordinator.already-running` and `coordinator.restart-budget-exhausted` are two-segment; the exact allowlist addition is `+2` in both files (set 22→24), never a wildcard.
- `coordinator.stuck.reason` is a distinct closed field from the restart reason; the exhausted state is `exhausted-escalated`; a PID identity mismatch records `killFailureReason=identity-mismatch`.
