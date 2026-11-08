---
id: chg-GH-238-test-plan
status: Updated
created: "2026-11-07T20:45:00Z"
last_updated: "2026-11-08T00:45:00Z"
owners: [engineering]
service: delivery-os resident dispatch daemon
labels: [change, planning]
version_impact: minor
summary: "Prove the resident dispatch daemon as a crash-safe, single-instance, state-mediated supervisor: one daemon per state directory enforced by a fence-style lock with evidenced stale takeover; every command interaction complete through state alone with the control socket as an optional optimization; control protocol v1 as a layered NDJSON contract proven over stdio with n/n-1 negotiation, bounded subscriptions, no business truth, no secrets (the daemon lock token is the sole exempt same-user ownership capability), and a reserved caller principal; kill-and-restart convergence that classifies every in-flight lane alive/interrupted/crashed, resumes from the ledger, skips completed phases, increments each restart exactly once, enforces the delivered budget terminally, and duplicates zero tickets, comments, or commits; an external-effect protocol with outbox intent, receipts, first-class unknown, check-before-reapply, and commit crash safety through a pre-commit outbox intent carrying a message-independent path-set identity plus one bounded logSince(baselineHead) match, with the lane/one-shot owner restoring the phase binding and the daemon only recording a redrive request; safe-boundary preemption that never signals a live session; truthful daemon-down degradation for every one-shot command and both watch surfaces; configuration-only polling hygiene; a scoped systemd user install whose foreground ExecStart keeps a Type=simple unit resident, with classified unsupported outcomes elsewhere; and structural proof that no merge code path exists in the daemon. At-most-once mutation is a state-path property (intent records under one idempotency key through the single-writer fence); control frames are at-most-once by connection identity, id, and the lock token. The battery is hermetic and deterministic: in-memory stdio transport pairs, injected clock, process-supervisor, lane-executor, effect, supervisor, and state seams; zero live network, credentials, or unbounded sleeps. 102 named TCs cover all 36 acceptance criteria, all 18 NFRs, all 9 events, DM-1..DM-18, and the seven seeded scenario ids SC-M1-14, SC-M1-15, SC-M1-16, SC-M1-17, SC-M1-17b, SC-M1-18, and SC-M1-20 without weakening their assertions."
links:
  change_spec: ./chg-GH-238-spec.md
  implementation_plan: ./chg-GH-238-plan.yaml
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - M1-S18: Resident dispatch daemon

## 1. Scope and Objectives

This plan protects one behavioural thesis: **a resident driver is safe only when it is optional, single-instance, and reconstructible from state alone**. The thesis fails if two daemons can drive one state directory; if a live lock is taken over or a stale takeover lacks evidence; if any command needs the socket to complete; if a frame carries a fact that cannot be re-derived from state or a secret that should never transit; if a slow subscriber can stall the dispatcher or receive another connection's response; if a kill/restart guesses a lane's fate, re-executes a completed phase, increments a restart twice, or silently requeues a delivery past its budget; if an external effect re-applies after `unknown` without a query; if a preemption kills a live session; if a daemon-down one-shot fails, blocks, or claims a false all-clear; if a watch emits a silent empty stream; if the resident poller exceeds its configured rate; if `install` silently no-ops on an unsupported platform; or if any merge invocation becomes reachable from the daemon composition. Each failure is a delivery-correctness defect, not a test inconvenience.

The highest-severity surfaces are **single-instance ownership** (F-2; RSK-1, RSK-2), **crash convergence** (F-8; RSK-3), and **subscriber/dispatcher isolation** (F-4, F-6; RSK-4). The plan proves them with deterministic, fixture-driven interleavings and artifact evidence — never real OS races, real multi-user boundaries, live systemd, live network, live credentials, or unbounded sleeps (NFR-7). A real child-process start/stop smoke test is permitted only as one bounded, timeout-guarded case and never carries an assertion that the in-memory harness cannot also make.

The seeded scenarios `SC-M1-14`, `SC-M1-15`, `SC-M1-16`, `SC-M1-17`, `SC-M1-17b`, `SC-M1-18`, and `SC-M1-20` in `doc/planning/oss-tooling/milestones/m1/test-scenarios.md` are binding and are inherited without weakening — seven seeded scenario ids in total. `SC-M1-14` is bound to AC-F9-2; the daemon consumes the delivered prefill-safe liveness rule rather than re-deriving it. Their assertions are folded into the TCs named in §3.1; divergence is a defect, not a fork. `SC-M1-17b` is inherited from GH-237 AC-F4-1/AC-F4-2; this plan proves the daemon-down surface leaves that delivered mutual exclusion untouched and does not re-implement it.

### 1.1 In Scope

- The `daemon start|stop|status|install|uninstall` family, its deterministic human summary, machine envelope, and `{0, 1, 2}` exit projection (F-1; DM-1, DM-13; EVT-1, EVT-2, EVT-4; AC-F1-1, AC-F1-2).
- Fence-style daemon-lock ownership with staleness takeover, previous-instance evidence, live-holder refusal, per-state-directory isolation, and separation from the state layer's short write fence (F-2; DM-1; EVT-1; AC-F2-1..AC-F2-3; NFR-3).
- State-mediated truth: every queue, blocker, phase-complete, and commit interaction lands through state alone; poke/tail/poll wake ordering; no lost wake changes a durable outcome; no fact survives only in daemon memory (F-3; DM-1, DM-13; EVT-2; AC-F3-1, AC-F3-2; NFR-2).
- Control protocol v1: NDJSON envelope fields, closed frame kinds and interaction classes, `1`/`0` negotiation, unsupported-version refusal, poke/query/subscribe/control semantics, id correlation within one connection, no cross-connection leakage, no business truth, no credential/secret material (the lock token is the sole exempt same-user ownership capability), and the reserved caller principal (F-4, F-6; DM-6, DM-8; EVT-8, EVT-9; AC-F4-1..AC-F4-5; NFR-5, NFR-12, NFR-14, NFR-15).
- Layered codec/session/transport with config-selected transport, unix default permissions, stdio conformance, declared-not-delivered refusal, socket-path validation, and declared transport-degraded start (F-5; DM-6, DM-14; AC-F5-1; NFR-10, NFR-14).
- Connection-per-invocation concurrency, single event loop, bounded response timeout and state fallback, state-path at-most-once intent application under idempotency keys, and control-frame at-most-once handling keyed on (connection identity, frame `id`, lock token) — a cross-connection `id` collision is a distinct new request, never answered as already applied (F-6; DM-6, DM-7, DM-9, DM-10, DM-17; AC-F6-1, AC-F6-2; NFR-5, NFR-15).
- Durable heartbeat, three-state liveness projection, and stop release evidence (F-7; DM-2; EVT-2; AC-F7-1; NFR-1).
- Startup reconciliation: alive/interrupted/crashed classification from artifact evidence, evidence-insufficient hold, ledger resume, completed-phase skip, one restart per interruption, replay idempotence, terminal budget exhaustion, typed question surfacing, and zero duplicated artifacts (F-8, F-10; DM-3, DM-4, DM-9, DM-10, DM-11; EVT-3, EVT-4, EVT-6, EVT-7; AC-F8-1..AC-F8-4; NFR-4, NFR-13, NFR-15).
- Lane supervision through an injected lane-executor over the delivered `HarnessSessionPort`, `daemon.lane` execution evidence, no in-process delivery work, prefill-safe progress liveness, corroborated-stall classification, and declared `supervise-only` mode; the effect owner is the lane/one-shot process that owns the phase completion, and the daemon's effect duty stops at detection, one bounded query, and a durable redrive request (F-9; DM-3, DM-16, DM-18; EVT-3, EVT-6; AC-F9-1, AC-F9-2, AC-F8-4; NFR-2, NFR-14, NFR-17; TDR-0014 INV-7, DEC-19).
- External-effect protocol: `OutboxEffect` and `CommandReceipt` additive records, the legal state machine, first-class `unknown`, query-based check-before-reapply, and commit crash safety through a durable pre-commit outbox intent carrying `baselineHead`, change ref, phase, and the sorted normalized staged path set, matched by one bounded `logSince(baselineHead)` read whose normalized changed-path set equals the recorded set — `applied` only for exactly one such new commit, every other outcome `unknown` with no automatic re-apply, and no second commit; the daemon records the durable redrive request and the lane/one-shot owner restores the phase binding through the delivered `commit-without-record` convergence row (no message, subject, body, or fingerprint is recorded or matched) (F-9, F-10; DM-9, DM-10, DM-11, DM-18; EVT-6, EVT-7; AC-F8-4, AC-F10-1..AC-F10-3; NFR-4, NFR-15; TDR-0014 INV-1..INV-8, DEC-15, DEC-19).
- Safe-boundary automatic preemption: durable pending state, no signal/kill path, boundary-or-completion release, immediate no-session release, close-item naming, and single-flight until release (F-11; DM-5; EVT-5; AC-F11-1, AC-F11-2; NFR-4, NFR-14).
- Truthful degradation and one-shot continuity: daemon-down queue/claim/release/lanes surfaces, blockers unchanged, status versus `status --live`, unreadable-state fail-closed, and a marker that is absent when the daemon is reachable (F-12; DM-13, DM-14; AC-F12-1, AC-F12-2; NFR-13).
- Bounded live watch for `queue` and `lanes`: reachable streaming, deduplication, finding codes, frame bounds, degraded polling without a daemon, and exit 2 only on unreadable state (F-13; DM-7, DM-14; EVT-9; AC-F13-1, AC-F13-2; NFR-9, NFR-13).
- Per-platform polling rate limits and exponential backoff as configuration, with no unbounded loop and no poll outside a delivered read seam (F-14; DM-15; AC-F14-1; NFR-10, NFR-16).
- Optional scoped supervisor install: Linux systemd user unit content pinned to `ExecStart=<binary> daemon start --foreground`, `Type=simple`, and `Restart=on-failure`, the residency assertion that the installed unit keeps the daemon active (distinct from installation success), linger, state-directory scope, idempotence, rollback on linger failure, uninstall removal, and classified unsupported outcomes elsewhere (F-15; DM-12; AC-F15-1, AC-F15-2; NFR-18).
- Guarded vocabulary growth synchronized in-change: seven additive record kinds, exactly eight `daemon` error rows, typed `daemon` and `poll` configuration branches, the additive optional `callerPrincipal` field, `--watch` acceptance, one changeset, and bidirectional agreement under an additive-only rule — no schema id, required field, required key, collector id, existing record kind, existing error row, or breaking payload shape changes (F-16; EVT-1..EVT-7; AC-F16-1; NFR-8, NFR-11, NFR-14).
- Structural absence of a merge code path, asserted by two distinct proofs: a source-level dependency boundary over the core, CLI, and adapters daemon paths (an import of merge execution from any of them fails), and a reachability test where an injected merge executor computes `mergeCodePath: "present"` without adding an import edge; the production composition always computes `"absent"` from the closed set `{"absent", "present"}` (F-17; DM-13; AC-F17-1; NFR-17).
- Cross-cutting determinism, hermeticity, bounds, privacy, and mutation meta-tests (NFR-1, NFR-7, NFR-9, NFR-12, NFR-17).

### 1.2 Out of Scope & Known Gaps

- [OUT] `dispatch`, the full typed delivery loop, prompt selection, dual-run evidence, per-repo handover, and the key=value delivery summary — NG-1; M1-S9 (GH-239). This plan proves supervision against an injected lane-executor port.
- [OUT] Tracker, VCS, and CI writes and any production effect adapter beyond the delivered commit primitive — NG-2; the effect primitive is exercised only over injected effect adapters.
- [OUT] Merge execution, gate evaluation, waiver handling, and landing — NG-3. Only the structural absence is tested.
- [OUT] Remote, TCP, TLS, SSH, and container-attached transports, the additive `intent` frame class, and handshake identity — NG-4; M4-S6. Only the declared-and-refused configuration values are tested.
- [OUT] Multi-host, fleet, and distributed-lock coordination — NG-5. One daemon per local state directory is the boundary.
- [OUT] `status --watch` — NG-6. The digest watch remains its own reconciliation. `daemon status --live` is tested.
- [OUT] Tracker-driven queue discovery and automatic queue membership — NG-7.
- [OUT] Changes to `queue ready`, the six conditions, lease/park semantics, weight/rank classes, lane-state vocabulary, or delivered queue/lanes payloads beyond additive `--watch` and the reserved field — NG-8, NG-9.
- [OUT] Lane-scoped authorization, credential sidecars, and containerized lanes — NG-10. `callerPrincipal` is reserved and unauthenticated.
- [OUT] The status digest's `lanes-or-queue` gap and any status-digest rewire.

- [GAP-T1 — Single-instance concurrency is algorithmic, not OS-level] NFR-3's "100 concurrent start attempts" is proven with a deterministic lock harness: 100 contenders are released in a declared order against the injected lock/state port, and exactly one acquisition plus 99 evidenced refusals are asserted. It does not prove kernel-level `O_EXCL` behaviour across real processes; TC-HERMETIC-001 offers one bounded real-child smoke for the start/stop envelope only.
- [GAP-T2 — Real cross-user socket refusal and real systemd linger are OS/environment concerns] TC-TRANSPORT-002 asserts the same-user permission policy, the delivered `state.permission.denied` refusal at exit 1, and the `0700`/`0600` mode derivation through the injected filesystem seam; TC-INSTALL-001/002/003/007 assert the unit content, scope, linger invocation, and unit residency through the injected supervisor adapter. Actual multi-user rejection and an actual systemd start-at-login remain delivery/operations verification, named here rather than lowered.
- [GAP-T3 — NFR-6 latency is environment-sensitive] The 50 ms p99 bound is measured on the reference CI class after warm-up with the recorded baseline; the test also asserts the environment-independent structural properties (one bounded buffer per subscription, overflow emits exactly one `degraded` frame and drops only that subscriber, the dispatcher keeps serving other connections). A slower local machine is not a correctness defect.
- [GAP-T4 — `daemon install` on a live system is not exercised] The Linux adapter is tested as data over an injected supervisor port; no test invokes the real user manager or changes the host. This is the only way to satisfy NFR-7's hermeticity.
- [GAP-T5 — Delivery-bound names] Record-kind strings, payload schemas, store keys, error codes, configuration keys, module paths, unit name, and fixture filenames are pinned by spec Appendices D, E, and F. Fixtures use those names; a rename is a contract change, not a test-only change. A test that cannot resolve a seam fails naming the missing contract instead of skipping.
- [GAP-T6 — SC-M1-17's `dispatch <ref>` clause is inherited by M1-S9] Appendix A pins the inheritance and the PM acknowledgement. This plan proves the one-shot scheduling/state/claim/release path and the daemon-down degradation; it does not drive `dispatch`.
- [GAP-T7 — SC-M1-17b's mutual exclusion proof remains GH-237's] The delivered fence-token claim is the proof; this plan asserts it is unchanged when the daemon is absent and does not add a second implementation.

## 2. References

- **Change specification**: [chg-GH-238-spec.md](./chg-GH-238-spec.md) — §5 F-1..F-17 and §5.1 capability details, §5.2 C-1..C-4 contract clarifications, §6 flows 1–10, §8 EVT-1..EVT-9 / DM-1..DM-18, §9 NFR-1..NFR-18, §10 telemetry, §11 RSK-1..RSK-13, §12 assumptions, §13 dependencies, §14 OQ-1..OQ-6, §15 DEC-1..DEC-19, §17 AC-F1-1..AC-F17-1, §18 rollout, §21 security, §24 Appendix A (seeded-scenario reconciliation), Appendix B (frame table), Appendix C (command envelope and exit matrix), Appendix D (record kinds and payloads), Appendix E (configuration keys), Appendix F (error identities), Appendix G (ticket AC map), Appendix H (reconciliation algorithm), Appendix I (effect state machine), Appendix J (bounds).
- **Implementation plan**: [chg-GH-238-plan.yaml](./chg-GH-238-plan.yaml) — `delivery.plan.v1`, 12 phases. The plan is the sequencing authority for this change and supersedes the spec's §18 narrative order; §7.1 and §7.2 map every TC onto its declared phase and files. Every TC targets a plan-declared file; if a later change breaks that, §8.3 records the gap instead of inventing a path.
- **PM record**: [chg-GH-238-pm-notes.yaml](./chg-GH-238-pm-notes.yaml) — context only: the injected lane-executor seam, safe-boundary preemption, Linux supervisor adapter, external-effect protocol, watch acceptance, and the hermetic test posture. The spec is the source of truth.
- **Seed scenarios**: [doc/planning/oss-tooling/milestones/m1/test-scenarios.md](../../../planning/oss-tooling/milestones/m1/test-scenarios.md) — SC-M1-14 (referenced by AC-F9-2), SC-M1-15, SC-M1-16, SC-M1-17, SC-M1-17b, SC-M1-18, SC-M1-20 are binding; divergence after delivery is a defect.
- **M1 design pack**: [architecture.md](../../../planning/oss-tooling/milestones/m1/architecture.md) (daemon communication, protocol v1, transport layering, persistence/recovery, concurrency, boundary invariants), [commands/daemon.md](../../../planning/oss-tooling/milestones/m1/commands/daemon.md), [interactions.md](../../../planning/oss-tooling/milestones/m1/interactions.md) Session D, [contracts.md](../../../planning/oss-tooling/milestones/m1/contracts.md), and [test-scenarios.md](../../../planning/oss-tooling/milestones/m1/test-scenarios.md).
- **Testing strategy**: [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) — `bun:test` under `tests/**/*.test.ts`; fixtures never `*.test.ts`; permanent suites assert the current tree; goldens regenerated only by an explicit command; `pnpm check` is the aggregate gate.
- **TypeScript rules**: [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md) — strict typing, injected time/randomness/environment, ports and fakes over module mocking, the error contract, and deterministic `bun:test` authoring.
- **Delivered substrate reused, never re-implemented**:
  - State layer: `packages/core/src/contracts/state.ts` (`StateStorePort`, `StateFenceHandle`, `readRecords`, verified reads, `append`, `replaceDocument`, fence, integrity, salvage) and `packages/core/src/state/**`; fixture harness `tests/fixtures/state/harness.ts`.
  - Result contract: `packages/core/src/contracts/{result,error-table,envelope}.ts`, `packages/cli/src/classify.ts`, `packages/cli/src/projection.ts`, `scripts/checks/error-table-sync.ts`, `tests/checks/error-table-sync.test.ts`.
  - Configuration: `packages/core/src/config/{catalog,defaults,resolver,schema,provenance}.ts`, `packages/core/src/contracts/config.ts`, `tests/fixtures/config/**`, and the delivered concrete behaviour suites `tests/behaviour/config-schema.test.ts`, `config-resolver.test.ts`, `config-provenance.test.ts`, `config-cli.test.ts`, and `config-restrictions.test.ts`.
  - Scheduling engine: `packages/core/src/contracts/queue.ts`, `packages/core/src/domain/**` queue/schedule/lease/park folds, `packages/cli/src/commands/{queue,lanes}.ts`, `tests/behaviour/queue-*.test.ts`, `tests/behaviour/lanes.test.ts`, `tests/golden/queue-*` and `lanes-*`, `tests/fixtures/queue/**`.
  - Harness adapters: `packages/core/src/contracts/harness.ts` (`HarnessSessionPort`, spawn/deliver/resume/collect/classify/liveness/listSessions), `tests/behaviour/harness-*.test.ts`, `tests/fixtures/harness/**`.
  - Session economics: `packages/core/src/contracts/economics.ts`, `packages/core/src/domain/economics-view.ts`, `tests/fixtures/economics/**`.
  - Typed blockers: `packages/core/src/contracts/blockers.ts`, `packages/core/src/state/blockers.ts`, `tests/behaviour/blockers-*.test.ts`.
  - Commit primitive: `packages/core/src/contracts/commit.ts`, `packages/core/src/state/commit-telemetry.ts`, `packages/core/src/state/merge.ts`, `tests/behaviour/commit-*.test.ts`.
  - Merge boundary: `packages/core/src/contracts/merge.ts`, `packages/core/src/state/merge.ts`, `tests/structure/merge-imports.test.ts`, `.dependency-cruiser.cjs`.
  - Boundary and invariant machinery: `.dependency-cruiser.cjs`, `scripts/checks/*.ts`, `tests/boundaries/**`, `tests/checks/**`.
- **Precedent plan**: [chg-GH-237-test-plan.md](../../2026-11-07--GH-237--scheduling-engine/chg-GH-237-test-plan.md) — house format, deterministic concurrency rigour, phase-surface mapping, and the daemon-down/`--watch` boundary this change closes.
- **Related system specs**: `doc/spec/features/feature-scheduling-engine.md`, `feature-state-layer.md`, `feature-result-contract.md`, `feature-config-layer.md`, `feature-session-lifecycle-economics.md`, `feature-blockers.md`, `feature-harness-adapters.md`, `feature-merge-verify-deploy.md`, `feature-commit-primitive.md`, and `doc/spec/nonfunctional.md` (paths as delivered; reconciled at doc-sync).
- **Decisions**: [TDR-0004 state storage engine](../../../decisions/TDR-0004-state-storage-engine.md), [TDR-0005 delivery-result enum and exit taxonomy](../../../decisions/TDR-0005-delivery-result-enum-and-cli-exit-taxonomy.md), [ADR-0008 harness adapter contract](../../../decisions/ADR-0008-harness-adapter-contract.md), and [TDR-0014 commit external-effect crash safety](../../../decisions/TDR-0014-commit-effect-crash-safety-message-independent-identity.md) — the binding INV-1..INV-8 contract for the commit path-set identity, the fail-closed verdicts, and the lane/one-shot owner rule.
- **Ticket**: GitHub issue `juliusz-cwiakalski/agentic-delivery-os#238` — M1-S18: Resident dispatch daemon.

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Criterion (abbreviated) | TC ID(s) | Status |
|-------|--------------------------|----------|--------|
| AC-F1-1 | `daemon start` acquires the lock, appends one instance acquisition, reconciles, appends one reconciliation, opens the configured transport, emits instance/reconciliation/socket/heartbeat/degraded (with no daemon lock token), exit 0; `daemon stop` with no daemon is a noop at exit 0; `daemon status` reports uptime, depth, lanes, restarts, heartbeat age, socket, supervisor, and `mergeCodePath` from the closed set `{"absent", "present"}` with the production composition reporting `"absent"` at exit 0. | TC-LIFE-001, TC-LIFE-002, TC-LIFE-003, TC-LIFE-007, TC-LIFE-008 | Covered |
| AC-F1-2 | Plain status over absent/stale heartbeat exits 0 with a declared degradation and stopped/stale report; `status --live` with unreachable socket or stale heartbeat exits 2 with `daemon.socket-unreachable`/`daemon.heartbeat-stale` and a hint; `daemon uninstall` with no unit is a noop at exit 0. | TC-LIFE-004, TC-LIFE-005, TC-LIFE-008, TC-INSTALL-004 | Covered |
| AC-F2-1 | A live holder makes a second `daemon start` refuse at exit 1 with `daemon.already-running`, naming instance, process, acquisition time, and heartbeat age, appending nothing. (SC-M1-15 context) | TC-LOCK-001 | Covered |
| AC-F2-2 | A lock at or beyond `daemon.lock-staleness` is taken over with operation `taken-over` and previous instance/token/last heartbeat/age/time evidence; an explicit `takeover` control action or state request against a **live** lock is refused with `daemon.takeover-refused` at exit 1 and zero appends; a `daemon start` against that same live lock refuses with `daemon.already-running` and never `daemon.takeover-refused`. | TC-LOCK-001, TC-LOCK-002, TC-LOCK-003, TC-LOCK-006 | Covered |
| AC-F2-3 | Two different state directories on one host run independent daemons; locks, heartbeats, reconciliations, and frames are scope-isolated. | TC-LOCK-004 | Covered |
| AC-F3-1 | With the daemon stopped, every queue mutation, blocker publish/answer, and delivered read lands durably through state at exit 0; queue payloads carry `degraded: ["daemon-unreachable"]`; blocker shape is unchanged; after a later start each queue intent is effective exactly once with zero loss, each blocker answer stays durable and visible with `applied: false` and its `laneResume` projection preserved, the pending resume/application intent is recorded as `resumeIntent` on the lane execution record only when a lane exists, and a lane-holding answer is applied only at the next safe phase boundary when a lane exists — observable as exactly one executor resume/attach call for that answer and zero when no lane exists, plus the lane record's `resumeIntent` and state transition, while the answer record stays `applied: false`; full session resume remains M1-S9. (SC-M1-17) | TC-STATE-001, TC-STATE-002, TC-STATE-003 | Covered |
| AC-F3-2 | A poke is consumed and applied; a lost poke is recovered by tail or bounded poll; if both are unavailable the next start applies it; no wake loss changes a durable outcome. | TC-STATE-004, TC-STATE-005 | Covered |
| AC-F4-1 | Every v1 frame carries `v`, `id` where correlated, `kind` from the closed set, `type`, and `callerPrincipal`; a v0 frame omits the additive reserved fields, is accepted only where its fields are sufficient, and a frame missing a field its own version requires is refused; the daemon serves versions `1` and `0`; an unsupported version is refused with `daemon.protocol.unsupported` and offered versions `[1, 0]` before close. | TC-WIRE-001, TC-WIRE-002, TC-WIRE-008 | Covered |
| AC-F4-2 | The same request, response, event, error, poke, query, subscribe, and control frames behave identically over stdio and unix; no codec/session behaviour branches on transport identity. | TC-TRANSPORT-001 | Covered |
| AC-F4-3 | A slow `lanes` subscriber whose bounded buffer overflows receives one `degraded` frame carrying `subscriber-overflow`, is dropped alone, and the dispatcher keeps serving other connections with bounded latency. (SC-M1-20) | TC-WIRE-003, TC-WIRE-004 | Covered |
| AC-F4-4 | Every frame value is derivable from state or is an at-most-once control action; no credential value, credential token, secret material, prompt, body, transcript, diff, or raw provider payload appears; the daemon lock token is the sole exempt same-user ownership capability, appears only in the `drain`/`stop`/`takeover` payloads and durable lock/instance records, never in a `daemon start`, `daemon stop`, or `daemon status` command envelope or golden, and carries no credential-shaped value; a lost frame leaves the system correct. | TC-WIRE-005, TC-WIRE-006 | Covered |
| AC-F4-5 | Every intent record and v1 control frame carries `callerPrincipal` in the reserved shape; a v0 frame omits it; an intent record lacking it remains readable; no code path treats it as authorization. | TC-WIRE-007, TC-VOCAB-004 | Covered |
| AC-F5-1 | The configured transport is selected behind the interface; `unix` is the default inside a 0700 state dir with a 0600 socket; `stdio` is available; an outside socket path and declared-not-delivered values are refused with `config.value.invalid` naming the implemented set; an unopenable transport starts degraded at exit 0 with `daemon-socket-unreachable`. | TC-TRANSPORT-002, TC-TRANSPORT-003, TC-TRANSPORT-004, TC-TRANSPORT-005 | Covered |
| AC-F6-1 | Two simultaneous `daemon status --live` invocations on separate connections each receive their own id-correlated response; no frame crosses connections; both exit 0 with `live` facts. (SC-M1-18) | TC-CONC-001 | Covered |
| AC-F6-2 | Two concurrent CLI invocations re-sending one intent under the same idempotency key and two invocations writing different keys, appending through the **state path** with the daemon down and again with the daemon up: the same-key replay appends no second intent record and leaves exactly one effective intent (an effect replay may append only its `already-applied` receipt); the different-key intents serialize through the single-writer state fence as ordered appends; reconciliation applies each intent at most once and produces no second external effect. A duplicated control frame replayed on the same connection carrying the same `id` and a valid lock token is applied at most once; a frame on a second connection that reuses that `id` is a distinct new request, never answered as already applied. A `queue add` is never relayed as a wire mutation and has no external effect. | TC-CONC-002, TC-CONC-003, TC-CONC-004, TC-CONC-005 | Covered |
| AC-F7-1 | One heartbeat is appended per interval with a monotone ordinal, queue depth, lane counts, current spawn when present, and consumed cursor; stop records the release reason and status reports stopped; no reader fabricates a beat. | TC-HEART-001, TC-HEART-002 | Covered |
| AC-F8-1 | Reconciliation classifies L1 alive/reattached, L2 interrupted, and L3 crashed with its recorded reason, names each action, and holds any lane with `evidence-insufficient` instead of guessing. (SC-M1-16) | TC-RECON-001, TC-RECON-002 | Covered |
| AC-F8-2 | An interrupted lane at ledger phase 7 resumes at phase 8, skips completed phases, consumes exactly one restart, and a replay does not increment again; an alive lane reattaches with an unchanged counter. | TC-RECON-003, TC-RECON-004 | Covered |
| AC-F8-3 | GH-315 at 3/3 and a further failed spawn becomes a terminal `failed` lane and terminal queue hold with `restart-budget-exhausted`, the delivered `economics.budget-exhaustion` record, no fourth spawn, and a typed question with exhaustion options within one `daemon.heartbeat-cycle`; never a silent requeue. (SC-M1-15) | TC-RECON-005, TC-RECON-006 | Covered |
| AC-F8-4 | A kill mid-delivery and restart converge: the daemon detects each unresolved commit effect, performs one bounded `logSince(baselineHead)` read, and records a durable redrive request carrying the discovered SHA or `unknown`; the lane/one-shot owner restores the phase binding by re-running phase completion with that SHA through the delivered `commit-without-record` row, so the phase reads `both` and never `record-only`; the daemon creates no commit and runs no phase; tracker/comment effects are protected by receipts, `unknown`, and check-before-reapply; zero duplicated tickets, comments, or commits. | TC-RECON-007, TC-RECON-008 | Covered |
| AC-F9-1 | With a composed executor and one ready entry, the daemon claims through the delivered engine, spawns through the executor, records one `daemon.lane`, observes, and releases/parks on termination; it performs no delivery work in-process and is never a lane; with no executor it runs `supervise-only` and reports `lane-executor-unavailable` without claiming a spawn. | TC-LANE-001, TC-LANE-002, TC-LANE-003, TC-LANE-006 | Covered |
| AC-F9-2 | A lane with rising token delta or traffic during prefill/resume classifies `progressing` with no restart or kill; a fully corroborated stall applies the delivered watchdog classification and restart admission. (SC-M1-14) | TC-LANE-004, TC-LANE-005 | Covered |
| AC-F10-1 | An in-flight effect that lost its transport records `unknown`, performs one bounded identity query, records `applied`/`already-applied` with no second effect when found, re-applies once when not found, and stays `unknown` with no blind retry when unreadable. | TC-EFFECT-001, TC-EFFECT-002, TC-EFFECT-003, TC-EFFECT-004, TC-RECON-008 | Covered |
| AC-F10-2 | A commit effect whose pre-commit `outbox.effect` intent (`baselineHead`, change ref, phase, sorted normalized staged path set; no message, subject, body, or fingerprint) was written before the delivered commit primitive ran: after a kill with the commit object landed but no transition record or telemetry, the owning lane/one-shot re-drive performs one bounded `logSince(baselineHead)` read and resolves `applied` (`already-applied`) only when exactly one new commit's normalized changed-path set equals the recorded set, recording the landed SHA and creating no second commit; zero commits, multiple commits, a path-set mismatch, or an unreadable/over-cap read stays `unknown` with no automatic re-apply and no guessed SHA; the owner restores the phase binding through `commit-without-record` so the phase reads `both`; three negative controls each fail the test — break the path-set derivation, remove the log query, and break the match rule. | TC-EFFECT-005, TC-RECON-007 | Covered |
| AC-F10-3 | No tracker or VCS write operation is added; the effect primitive is exercised only against injected adapters; the commit primitive remains the only production effect adapter. | TC-EFFECT-006 | Covered |
| AC-F11-1 | A preempted lane with an active session records durable `pending`, never signals or kills the session, and at the next boundary or on completion releases, records `preempted-for-close-item`/`preemption`, and records the applied preemption naming the close item. | TC-PREEMPT-001, TC-PREEMPT-002, TC-PREEMPT-003 | Covered |
| AC-F11-2 | A preempted lane with no active session releases and parks immediately, records the preemption applied, names the close item; single-flight holds until release and the close item is not scheduled in the same pass. | TC-PREEMPT-004, TC-PREEMPT-005 | Covered |
| AC-F12-1 | With the daemon stopped, `queue plan --next 1`, `queue claim`, `queue release`, and `lanes list` compute/mutate from state, exit 0, carry `degraded: ["daemon-unreachable"]`, and require no daemon, socket, or background process. (SC-M1-17) | TC-DEGRADE-001, TC-DEGRADE-002 | Covered |
| AC-F12-2 | When the daemon is absent, stale, or crashed, every one-shot neither fails nor idles; plain status declares the degradation at exit 0 and only `status --live` fails closed at exit 2. | TC-DEGRADE-002, TC-DEGRADE-003, TC-DEGRADE-004, TC-LIFE-006 | Covered |
| AC-F13-1 | With a reachable daemon, `queue --watch`/`lanes --watch` subscribes to the closed topic, prints a bounded initial snapshot, then bounded event frames, deduplicates, keeps finding codes, never exceeds the frame bound, and exits 0 on interruption. | TC-WATCH-001, TC-WATCH-002, TC-WATCH-005 | Covered |
| AC-F13-2 | With no reachable daemon, watch enters declared degraded mode, prints `daemon-unreachable`, polls state at `daemon.watch-poll-interval`, prints only changed bounded snapshots, exits 0 on interruption, never fails or silently empties, and exits 2 only when state is unreadable with a `state.*` identity. | TC-WATCH-003, TC-WATCH-004 | Covered |
| AC-F14-1 | Configured per-platform base/max/spacing grows the interval exponentially on failure, resets on success, never exceeds the configured rate, and changes observed cadence with configuration alone. | TC-POLL-001, TC-POLL-002, TC-POLL-003, TC-POLL-004 | Covered |
| AC-F15-1 | Linux install writes a systemd user unit scoped to the state directory by an explicit `Environment=<PREFIX>_STATE_DIR=<canonical absolute state directory>` binding, with `ExecStart=<binary> daemon start --foreground`, `Type=simple`, `Restart=on-failure`; it enables linger, reports unit and linger at exit 0, and is idempotent; two `<PREFIX>_STATE_DIR` scopes each get their own lock/socket and cannot see each other, and a wrong scope is never silently shared; the installed unit keeps the daemon active and resident (a residence assertion distinct from installation success) while the default `daemon start` remains the interactive spawn-and-return form; linger failure removes the unit and exits 2 with `daemon.supervisor-unsupported` plus platform evidence; an absent unit leaves every one-shot identical. | TC-INSTALL-001, TC-INSTALL-002, TC-INSTALL-003, TC-INSTALL-004, TC-INSTALL-005, TC-INSTALL-007 | Covered |
| AC-F15-2 | On macOS or Windows without a delivered adapter, `daemon install` exits 2 with `daemon.supervisor-unsupported` naming platform and missing adapter, writes no unit, and never exits 0 silently. | TC-INSTALL-006 | Covered |
| AC-F16-1 | Seven additive record kinds, eight `daemon` rows, `daemon` and `poll` configuration branches, the additive optional `callerPrincipal` field, and `--watch` acceptance agree in both directions across machine table, documented table, source references, fixtures, and changeset under an additive-only rule: no schema id, required field, required key, collector id, existing record kind, existing error row, or breaking payload shape changes; the only additions are the declared new kinds/rows/branches, the optional `callerPrincipal`, and the `--watch` flag. | TC-VOCAB-001, TC-VOCAB-002, TC-VOCAB-003, TC-VOCAB-004, TC-VOCAB-005, TC-VOCAB-006, TC-VOCAB-007, TC-VOCAB-008 | Covered |
| AC-F17-1 | No merge execution is reachable from the daemon composition; the dependency boundary's `from` set covers the core daemon paths, the CLI daemon paths, and the adapters daemon subpath, so a source-level import of merge execution from any daemon path fails it; the reachability proof is distinct — an injected merge executor computes `mergeCodePath: "present"` while adding no import edge; the production composition computes `"absent"` from the closed set `{"absent", "present"}`. | TC-MERGEABS-001, TC-MERGEABS-002 | Covered |

**Coverage total**: 36 acceptance-criteria rows, all **Covered**; zero AC gaps; 102 TCs in total. Every TC names at least one AC, NFR, or EVT/DM element in §5.

**Capability coverage** (every F-# has at least one TC):

- F-1 → TC-LIFE-001..008, TC-INSTALL-004
- F-2 → TC-LOCK-001..006, TC-LIFE-006
- F-3 → TC-STATE-001..006, TC-DEGRADE-001
- F-4 → TC-WIRE-001..008, TC-CONC-001..005, TC-TRANSPORT-001
- F-5 → TC-TRANSPORT-001..005, TC-CONFIG-001
- F-6 → TC-CONC-001..005, TC-WIRE-003..004
- F-7 → TC-HEART-001..002, TC-LIFE-003..005
- F-8 → TC-RECON-001..009, TC-STATE-006
- F-9 → TC-LANE-001..006
- F-10 → TC-EFFECT-001..006, TC-RECON-007..008
- F-11 → TC-PREEMPT-001..005
- F-12 → TC-DEGRADE-001..004, TC-LIFE-002/004/005/006
- F-13 → TC-WATCH-001..005
- F-14 → TC-POLL-001..004
- F-15 → TC-INSTALL-001..007
- F-16 → TC-VOCAB-001..008
- F-17 → TC-MERGEABS-001..002, TC-META-001

**Seeded-scenario traceability**:

| Seed | Binding assertions preserved | TC ID(s) |
|------|-----------------------------|----------|
| SC-M1-15 budget exhaustion escalates, never silently requeues | GH-315 at restart 3/3 and a further failed spawn: terminal `failed` lane, terminal queue hold with `restart-budget-exhausted`, delivered `economics.budget-exhaustion` with restart history, no fourth spawn, typed question with requeue-with-fresh-budget and park-for-owner-review options within one collection cycle, never a silent requeue. | TC-RECON-005, TC-RECON-006 |
| SC-M1-16 daemon restart reconciles dead lanes | L1 process alive → `alive`/reattach; L2 process gone with no failure record → `interrupted`/resume from ledger, completed phases skipped, restarts+1; L3 recorded crash → `crashed` with classified reason and per-budget resume; zero duplicated ticket/comment/commit identities; completed phases not re-executed; counter incremented exactly once. | TC-RECON-001, TC-RECON-003, TC-RECON-004, TC-RECON-007, TC-RECON-008 |
| SC-M1-17 one-shot works daemon-down | Plan computed from state at exit 0 with `degraded=daemon-unreachable`; claim/release and blockers land durably; state consistent for later reconciliation; zero loss. The `dispatch <ref>` execution clause is inherited by M1-S9 (Appendix A, PM acknowledgement) and is not re-proven here. | TC-STATE-001, TC-STATE-003, TC-DEGRADE-001 |
| SC-M1-17b daemon-down one-shots are mutually exclusive | Inherited from GH-237 AC-F4-1/AC-F4-2: the delivered fence-token claim is the only proof. This plan asserts the daemon is not required for mutual exclusion and that the daemon-down surface does not weaken it; it does not add a second implementation. | TC-STATE-001, TC-DEGRADE-001; inherited proof in GH-237 TC-LEASE-002/003/005/006 |
| SC-M1-18 concurrent invocations without cross-talk | Two stdio connections replayed concurrently; each response id-correlated on its own connection; zero frame leakage; both exit 0 with live facts. | TC-CONC-001 |
| SC-M1-20 subscribe overflow degrades the subscriber, not the dispatcher | One `degraded` event carrying `subscriber-overflow` before drop; only that subscription drops; dispatcher latency stays bounded and other connections continue. | TC-WIRE-003, TC-WIRE-004 |
| SC-M1-14 prefilling session never reads as stalled | Rising token delta/traffic during prefill/resume classifies `progressing`; no restart event; state remains delivering. | TC-LANE-004 |

The table carries **seven seeded scenario ids** — `SC-M1-14`, `SC-M1-15`, `SC-M1-16`, `SC-M1-17`, `SC-M1-17b`, `SC-M1-18`, and `SC-M1-20`. No seed is dropped or weakened; any earlier count that omitted the inherited `SC-M1-14` exercise is superseded by the seven seeds listed here.

**Decision coverage**: DEC-1 → TC-LANE-001/003, TC-RECON-001; DEC-2 → TC-PREEMPT-001..005; DEC-3 → TC-INSTALL-001/003/006; DEC-4 → TC-EFFECT-001..006 (TDR-0014 INV-1..INV-8); DEC-5 → TC-WATCH-001..005; DEC-6 → TC-STATE-001..005, TC-DEGRADE-001; DEC-7 → TC-WIRE-002; DEC-8 → TC-WIRE-007, TC-VOCAB-004; DEC-9 → TC-RECON-001/002; DEC-10 → TC-RECON-003/005; DEC-11 → TC-POLL-001..004; DEC-12 → TC-MERGEABS-001..002; DEC-13 → TC-LANE-003; DEC-14 → TC-CONC-002/003/005; DEC-15 → TC-RECON-007, TC-EFFECT-005 (TDR-0014 INV-1..INV-6); DEC-16 → TC-STATE-003; DEC-17 → TC-INSTALL-001/007; DEC-18 → TC-INSTALL-001/007; DEC-19 → TC-EFFECT-005, TC-RECON-007, TC-LANE-002 (TDR-0014 INV-7..INV-8).

**Risk coverage**: RSK-1 → TC-LOCK-001..005; RSK-2 → TC-LOCK-002/003/006; RSK-3 → TC-RECON-001..009; RSK-4 → TC-WIRE-003/004; RSK-5 → TC-TRANSPORT-001, TC-WIRE-001; RSK-6 → TC-DEGRADE-001..004; RSK-7 → TC-PREEMPT-001..005; RSK-8 → TC-INSTALL-003/006; RSK-9 → TC-EFFECT-001..006 (commit path-set identity with the derivation-break, query-removal, and match-rule-break negative controls; residual: no production tracker write adapter); RSK-10 → TC-POLL-001..004; RSK-11 → TC-WIRE-007, TC-VOCAB-004; RSK-12 → TC-LANE-003; RSK-13 → TC-VOCAB-001..008.

### 3.2 Interface Coverage (EVT-#, DM-#)

The spec declares no REST/HTTP endpoint and no `API-#` identifier (§8.1). The contract is the event payloads, data-model shapes, command envelopes, frames, and error identities below.

| Element | TC ID(s) | Observable assertion |
|---------|----------|----------------------|
| EVT-1 `daemon.instance` record | TC-LIFE-001, TC-LOCK-001, TC-LOCK-002, TC-HEART-002 | Schema `delivery.daemon.instance.v1`, key `daemon.instance`, operations `acquired`/`taken-over`/`released`/`immediate-stop`, takeover evidence complete, latest wins, identical replay appends nothing, live instance never silently replaced |
| EVT-2 `daemon.heartbeat` record | TC-LIFE-001, TC-HEART-001, TC-HEART-002 | Schema `delivery.daemon.heartbeat.v1`, key `daemon.heartbeat`, monotone ordinal, beat time, uptime, depth, lane counts, current spawn, cursor; latest wins; no fabricated beat |
| EVT-3 `daemon.lane` record | TC-LANE-001, TC-LANE-006, TC-RECON-001, TC-RECON-003 | Schema `delivery.daemon.lane.v1`, key `daemon.lanes:<REF>`, daemon execution state, harness kind/session id, process id, ledger position, spawn ordinal, liveness, detachment, classification |
| EVT-4 `daemon.reconciliation` record | TC-LIFE-001, TC-RECON-001, TC-RECON-004, TC-RECON-005 | Schema `delivery.daemon.reconciliation.v1`, key `daemon.reconciliations:<instanceId>`, queue counts, per-lane classification/action/restarts, duplicates 0, questions, completion time; immutable, one per instance |
| EVT-5 `daemon.preemption` record | TC-PREEMPT-001..005 | Schema `delivery.daemon.preemption.v1`, key `daemon.preemptions:<REF>`, target/repository/close ref, `preempted-for-close-item`, `preemption`, holder, pending/applied/withdrawn, boundary evidence |
| EVT-6 `command.receipt` record | TC-EFFECT-002..005, TC-RECON-007 | Schema `delivery.command.receipt.v1`, key `command.receipts:<effectId>`, effect id, attempt, query verdict, status, bounded evidence, time; the first terminal receipt is authoritative, while the daemon's redrive detection (DM-18) is evidence only and never transitions the effect |
| EVT-7 `outbox.effect` record | TC-EFFECT-001..005, TC-VOCAB-004 | Schema `delivery.outbox.effect.v1`, key `outbox.effects:<effectId>`, intent id, ref, closed kind, target, payload digest, idempotency key, optional `callerPrincipal`, state, attempts, check strategy (`query-by-id`/`query-by-log-since`), and for commits baseline HEAD, change ref, phase, and the sorted normalized staged path set — never a message, subject, body, or message fingerprint; legal transitions only |
| EVT-8 control frames | TC-WIRE-001, TC-WIRE-002, TC-WIRE-005, TC-WIRE-007, TC-WIRE-008, TC-CONC-005, TC-WATCH-001, TC-WATCH-002 | NDJSON envelope `v`/`id?`/`kind`/`type`/`callerPrincipal` (v1 only) plus one of payload/data/error; closed wire types are exactly `poke`, `status`, `lane`, `subscribe`, `drain`, `stop`, `takeover`, `frame`, `degraded` — `query` is an interaction class over `status`/`lane`, not a wire type; state-derivable or at-most-once |
| EVT-9 `degraded` event | TC-WIRE-003, TC-WATCH-003, TC-WATCH-005 | One event with a closed reason (`subscriber-overflow`, `daemon-unreachable`, `daemon-heartbeat-stale`) and a remediation hint; no non-derivable business fact |
| DM-1 Daemon instance | TC-LIFE-001, TC-LOCK-001, TC-LOCK-002, TC-HEART-002, TC-PRIVACY-001 | Instance id, pid, `scope` (SHA-256 first 16 lowercase hex of the canonical absolute state-dir path, never the path), lock token, operation, acquisition/heartbeat times, release reason, takeover evidence; durable owner distinct from the state write fence |
| DM-2 Heartbeat | TC-HEART-001, TC-HEART-002 | Instance id, ordinal, beat time, uptime, depth, lane counts, current spawn, cursor; liveness only, never authorization |
| DM-3 Lane execution record | TC-LANE-001, TC-LANE-006, TC-RECON-001, TC-RECON-003 | Ref, daemon state (`delivering`/`detached`/`completed`/`failed`/`preempted`), harness/session/process, ledger position, spawn ordinal, liveness, classification; one current record |
| DM-4 Reconciliation report | TC-LIFE-001, TC-RECON-001, TC-RECON-004, TC-RECON-005 | Instance id, queue counts, per-lane classification/action/restarts, duplicates 0, question ids, times; immutable |
| DM-5 Pending preemption | TC-PREEMPT-001..005 | Target, repository, close ref, cause/condition type, holder, requested/applied times, boundary evidence, pending/applied/withdrawn |
| DM-6 Control frame envelope | TC-WIRE-001, TC-WIRE-005, TC-TRANSPORT-003, TC-CONC-005 | `v`, `id?`, `kind`, `type`, `callerPrincipal` on v1 (omitted on v0), exactly one of payload/data/error; no idempotency-key field (state application is keyed on the intent record; control frames are at-most-once by connection identity, frame `id`, and the lock token); bounded by frame max and validated before action |
| DM-7 Subscription | TC-WIRE-003, TC-WATCH-001, TC-WATCH-002 | Closed topic, connection identity, bounded buffer, last cursor, degradation state; in-memory only |
| DM-8 Caller principal | TC-WIRE-007, TC-VOCAB-004 | `{ kind: "local-same-user", id: string | null }`, required on every v1 frame and omitted on v0, and optionally on intent records; unauthenticated, never authorization |
| DM-9 Command receipt | TC-EFFECT-002..005, TC-RECON-007 | Effect id, attempt, query verdict, status, bounded evidence, time; the first terminal receipt per effect and attempt is authoritative, and a DM-18 redrive detection is evidence only |
| DM-10 Outbox effect | TC-EFFECT-001..005, TC-VOCAB-004 | Effect id, intent id, ref, kind, target, payload digest, idempotency key, optional `callerPrincipal`, state, attempts, strategy; for commits also baseline HEAD, change ref, phase, and the sorted normalized staged path set (repo-relative, `/` separators, no leading `./`, deduplicated, sorted) — never a message, subject, body, or fingerprint; no free-form content |
| DM-11 Effect state machine | TC-EFFECT-001, TC-EFFECT-005 | `accepted → in-flight → applied | failed | unknown`; unknown requires a query; for a commit, `applied` only for exactly one new commit whose normalized changed-path set equals the recorded set, and every other outcome stays `unknown` with no automatic re-apply; terminal states are not re-opened blindly |
| DM-12 Supervisor descriptor | TC-INSTALL-001, TC-INSTALL-002, TC-INSTALL-006 | Platform, adapter kind, unit, scope, linger, installed state, classified unsupported reason |
| DM-13 Daemon status projection | TC-LIFE-003, TC-LIFE-004, TC-DEGRADE-003, TC-MERGEABS-002 | Instance, uptime, depth, lanes, restarts with reasons, heartbeat age, socket path/transport/reachability, supervisor, reconciliation summary, `mergeCodePath` from the closed set `{"absent", "present"}`, degraded |
| DM-14 Degraded marker | TC-LIFE-004, TC-LIFE-005, TC-DEGRADE-002, TC-DEGRADE-004, TC-WATCH-003 | Closed values `daemon-unreachable`, `daemon-heartbeat-stale`, `daemon-socket-unreachable`, `lane-executor-unavailable`, `subscriber-overflow`; queue/lanes set remains exactly `["daemon-unreachable"]` |
| DM-15 Polling policy | TC-POLL-001..003 | Per-platform base, max, spacing, and derived backoff; configuration-derived; no resident state as truth |
| DM-16 Lane-executor port | TC-LANE-001, TC-LANE-003 | Injected start/observe/collect/classify seam; adapter composes `HarnessSessionPort`; absent → `supervise-only` |
| DM-17 Intent idempotency key | TC-CONC-002, TC-CONC-003, TC-VOCAB-004 | The record identity is the idempotency key (the client supplies the intent, not a separate key): the immutable store-scoped record identity for `queue.entry`, `queue.dependency`, `blocker.question`, `blocker.answer`, and the declared `idempotencyKey` field for `outbox.effect` (derived deterministically from change ref, phase, and baseline HEAD); carried on the intent record, never on the control-frame envelope; an identical replay under one key appends no second intent record |
| DM-18 Effect redrive request | TC-RECON-007, TC-EFFECT-005, TC-LANE-002 | Carried by the existing `command.receipt` kind (no new record kind): effect identity, the baseline it queried, the observed verdict (`found`, `not-found`, `unreadable`), the discovered SHA when one was proven, and the time; it names the owning lane/one-shot process's next action, is not a second attempt, creates no commit, never re-applies, and never transitions the effect |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR (requirement) | TC ID(s) | Status |
|-------------------|----------|--------|
| NFR-1 Determinism | TC-DET-001, TC-LIFE-003, TC-LIFE-008, TC-HEART-001 | Covered — 100 identical runs over injected state/clock produce byte-identical status, reconciliation, and classification; no ambient clock/randomness/locale/order input |
| NFR-2 State-only truth | TC-STATE-004, TC-STATE-005, TC-STATE-006, TC-LIFE-001, TC-WIRE-008 | Covered — a kill/restart reconstructs instance, queue, lanes, leases, parks, budgets, pending preemptions, effects, and receipts from verified state; 0 facts only in memory |
| NFR-3 Single-instance safety | TC-LOCK-001, TC-LOCK-002, TC-LOCK-003, TC-LOCK-004, TC-LOCK-005, TC-LOCK-006 | Covered — exactly 1 live daemon per state dir under 100 scheduled starts; 0 live takeovers; 100 % of stale takeovers carry full evidence |
| NFR-4 Crash convergence | TC-RECON-001..008, TC-EFFECT-005 | Covered — 0 duplicated tickets/comments/commits; every in-flight lane classified once; 0 completed phases re-executed; restart counters increment exactly once; a detected commit lands as a redrive request and the owner-restored transition makes the phase read `both`, never `record-only` |
| NFR-5 Bounded response | TC-CONC-004, TC-LIFE-004, TC-LIFE-005, TC-TRANSPORT-005 | Covered — every request completes or degrades within `daemon.response-timeout`; a CLI never blocks beyond the timeout plus one local read; 0 unbounded waits |
| NFR-6 Subscriber isolation | TC-WIRE-003, TC-WIRE-004 | Covered — dispatcher p99 ≤ 50 ms under 100 slow subscribers; 0 stalls; 100 % of overflowing subscriptions receive one `degraded` event before drop |
| NFR-7 Hermetic tests | TC-HERMETIC-001 | Covered — 0 live network, 0 real credentials, 0 unbounded sleeps; injected clock/transport/process/lane/effect/supervisor seams; at most 1 bounded timeout-guarded real-child smoke |
| NFR-8 State compatibility | TC-VOCAB-004, TC-VOCAB-006, TC-VOCAB-008 | Covered — 0 schema bumps/migrations/backfills; 7 additive kinds; existing store opens unmodified and daemon reads are verified-empty; historical records without `callerPrincipal` read unchanged |
| NFR-9 Bounds | TC-BOUNDS-001, TC-LIFE-008, TC-WATCH-001, TC-WATCH-002 | Covered — frame ≤ 65 536 bytes; buffer ≤ 256; status/reconciliation ≤ 200 lanes; status data ≤ 65 536 bytes; human ≤ 40 lines/8 192 bytes; evidence ≤ 512 bytes; every bound has an explicit truncation marker |
| NFR-10 Configuration-only tuning | TC-CONFIG-001, TC-POLL-003, TC-TRANSPORT-003, TC-TRANSPORT-004 | Covered — every `daemon.*` and `poll.<platform>.*` value changes behaviour with 0 code changes; invalid values are `config.value.invalid` naming the key |
| NFR-11 Error-table synchronization | TC-VOCAB-002 | Covered — exactly 8 `daemon` rows agree across machine table, documented table, source references, and fixtures in both directions; 0 existing rows change |
| NFR-12 Secret and payload safety | TC-PRIVACY-001, TC-WIRE-006, TC-INSTALL-001 | Covered — 0 secret/credential/credential-token/prompt/body/transcript/diff/provider/absolute-root bytes in frames, records, reports, status, goldens, logs, or telemetry; the daemon lock token is the only token-shaped value permitted, solely in the three control-frame payloads and durable lock/instance records, never in a `daemon start`, `daemon stop`, or `daemon status` command envelope or golden, and it must carry no credential-shaped value; redaction chokepoint covers new payloads |
| NFR-13 Fail-closed state reads | TC-LIFE-004, TC-LIFE-005, TC-DEGRADE-004, TC-WATCH-004, TC-RECON-009 | Covered — unreadable/torn/unknown daemon state yields classified `state.*`/`daemon.state-recovery-failed`; `status --live` and watch exit 2; no all-clear, zero-lane view, or empty stream as truth |
| NFR-14 Vocabulary stability | TC-VOCAB-007, TC-WIRE-001, TC-WIRE-008 | Covered — frame kinds, classes, topics, effect kinds/states, receipt statuses, instance operations, daemon lane states, classifications, markers, error codes, and config keys are closed sets |
| NFR-15 At-most-once application | TC-CONC-002, TC-CONC-003, TC-CONC-005, TC-EFFECT-002, TC-EFFECT-003, TC-EFFECT-004, TC-EFFECT-005 | Covered — for one intent idempotency key at most 1 effective application and at most 1 external effect (a first attempt may append its declared intent/transition/receipt; an identical replay appends nothing new); a duplicated control frame carries at most 1 action because control application is keyed on (connection identity, frame `id`, lock token), and a cross-connection `id` collision is a distinct new request; 100 % of `unknown` re-applies pass a query first, and a commit resolves `applied` only for exactly one new commit whose normalized changed-path set equals the recorded set, every other outcome `unknown` with no automatic re-apply |
| NFR-16 Polling discipline | TC-POLL-001, TC-POLL-002, TC-POLL-003, TC-POLL-004 | Covered — 0 polls above the configured rate; failure sequences back off exponentially; success resets; 0 polls outside a delivered read seam; no unbounded loop |
| NFR-17 Merge absence | TC-MERGEABS-001, TC-MERGEABS-002, TC-META-001 | Covered — 0 merge invocations reachable; 0 daemon imports of merge execution, with the boundary `from` set covering core, CLI, and `packages/adapters/src/daemon/`; `mergeCodePath` computed from the closed set `{"absent", "present"}` (production `"absent"`, injected executor `"present"`); the injection proof and the source-level import proof are distinct and each fails when its own mechanism changes |
| NFR-18 Supervisor truthfulness | TC-INSTALL-002, TC-INSTALL-003, TC-INSTALL-004, TC-INSTALL-005, TC-INSTALL-006 | Covered — 100 % of installs either write a real scoped unit or return a classified unsupported outcome; 0 silent no-ops; 0 installs that change one-shot behaviour |

## 4. Test Types and Layers

| Level | Scope | Proposed suites / files | Execution |
|---|---|---|---|
| Structure / contract inventory | Closed frame kinds/classes/topics, record kinds/schemas/keys, daemon execution states, classifications, effect kinds/states, receipt statuses, instance operations, degradation markers, error rows, config keys, envelope shapes, bounds | `tests/structure/daemon-contract.test.ts`; extend `tests/structure/{state,error-table,config,content-inventory}.test.ts`; `tests/structure/daemon-vocabulary.test.ts` | `bun test tests/structure` |
| Behaviour — lifecycle | Start/stop/status/install/uninstall, lock acquisition, takeover, readiness, foreground/resident, envelope, exit projection, human summary | `tests/behaviour/daemon-lifecycle.test.ts`, `tests/behaviour/daemon-lock.test.ts`, `tests/golden/daemon-lifecycle.test.ts`; `tests/fixtures/daemon/lifecycle/**`, `tests/fixtures/daemon/lock/**` | `bun test tests/behaviour/daemon-lifecycle.test.ts tests/behaviour/daemon-lock.test.ts` |
| Behaviour — lock concurrency | 100 scheduled start contenders, live-vs-stale matrix, per-state-dir isolation | `tests/behaviour/daemon-lock-concurrency.test.ts`; `tests/fixtures/daemon/lock/harness.ts` | `bun test tests/behaviour/daemon-lock-concurrency.test.ts` |
| Behaviour — state mediation | Daemon-down queue/blockers mutations, concurrent same/different-key intent application (daemon down and up), reconcile-on-start exactly once, blocker-answer durability and `resumeIntent`, poke/tail/poll, wake loss, world reconstruction | `tests/behaviour/daemon-state-mediation.test.ts`; `tests/fixtures/daemon/state/**` | `bun test tests/behaviour/daemon-state-mediation.test.ts` |
| Behaviour — protocol codec/session | Frame codec round-trip, closed wire-type set, version negotiation, unsupported refusal, id correlation, subscriptions, overflow, dispatcher isolation, secrets and lock-token scope, caller principal, control frames and duplicate-`id` handling | `tests/behaviour/control-codec.test.ts`, `tests/behaviour/control-session.test.ts`, `tests/behaviour/control-connection.test.ts`; `tests/fixtures/daemon/wire/**` | `bun test tests/behaviour/control-codec.test.ts tests/behaviour/control-session.test.ts tests/behaviour/control-connection.test.ts` |
| Behaviour — transport | stdio conformance pair, unix permission/path policy, declared-not-delivered refusal, transport-degraded start, layering purity | `tests/behaviour/control-conformance.test.ts`, `tests/behaviour/control-transport.test.ts`; `tests/fixtures/daemon/transport/**` | `bun test tests/behaviour/control-conformance.test.ts tests/behaviour/control-transport.test.ts` |
| Behaviour — heartbeat | Heartbeat content/ordinal/cursor, interval, stop release evidence, no fabricated beat | `tests/behaviour/daemon-heartbeat.test.ts`; `tests/fixtures/daemon/heartbeat/**` | `bun test tests/behaviour/daemon-heartbeat.test.ts` |
| Behaviour — reconciliation | Alive/interrupted/crashed, evidence-insufficient, ledger resume, replay idempotence, budget exhaustion, typed question, crash convergence, unreadable state | `tests/behaviour/daemon-reconciliation.test.ts`, `tests/behaviour/daemon-reconciliation-crash.test.ts`; `tests/fixtures/daemon/reconciliation/**` | `bun test tests/behaviour/daemon-reconciliation.test.ts tests/behaviour/daemon-reconciliation-crash.test.ts` |
| Behaviour — lane supervision | Claim/spawn/record/observe/release, no in-process delivery, supervise-only, prefill liveness, corroborated stall, lane-record vocabulary | `tests/behaviour/daemon-lane-supervision.test.ts`; `tests/fixtures/daemon/lanes/**` | `bun test tests/behaviour/daemon-lane-supervision.test.ts` |
| Behaviour — effects | Outbox/receipt state machine, unknown query found/not-found/unreadable, commit pre-intent plus one bounded `logSince(baselineHead)` path-set match (zero/multiple/mismatch/unreadable → `unknown`), owner binding restoration, three negative controls (derivation, query, match rule), adapter inventory | `tests/behaviour/daemon-effects.test.ts`; `tests/fixtures/daemon/effects/**` | `bun test tests/behaviour/daemon-effects.test.ts` |
| Behaviour — preemption | Pending/no-kill, boundary apply, restart survival, immediate no-session, single-flight | `tests/behaviour/daemon-preemption.test.ts`; `tests/fixtures/daemon/preemption/**` | `bun test tests/behaviour/daemon-preemption.test.ts` |
| Behaviour — degradation | One-shot surface daemon-down, continuity absent/stale/crashed, status matrix, unreadable state, marker truthfulness | `tests/behaviour/daemon-degradation.test.ts`; `tests/fixtures/daemon/degradation/**`; reuse `tests/fixtures/queue/**` | `bun test tests/behaviour/daemon-degradation.test.ts` |
| Behaviour — watch | Reachable queue/lanes streams, dedupe/finding codes/frame bound, degraded polling, unreadable state, mid-stream overflow | `tests/behaviour/watch-stream.test.ts`, `tests/behaviour/queue-watch.test.ts`, `tests/behaviour/lanes-watch.test.ts`; `tests/golden/watch-queue.test.ts`, `tests/golden/watch-lanes.test.ts`, `tests/golden/lanes-watch-accepted.test.ts`, `tests/golden/watch-refusal-absent.test.ts`, `tests/golden/watch-unreadable.test.ts` | `bun test tests/behaviour/watch-stream.test.ts tests/behaviour/queue-watch.test.ts tests/behaviour/lanes-watch.test.ts` |
| Behaviour — polling | Exponential backoff/reset, rate/spacing, config-only tuning, read-seam confinement | `tests/behaviour/daemon-polling.test.ts`; `tests/fixtures/daemon/polling/**` | `bun test tests/behaviour/daemon-polling.test.ts` |
| Behaviour — supervisor install | systemd unit content (`ExecStart=… daemon start --foreground`, `Type=simple`, `Restart=on-failure`), residency under the installed unit, linger, scope, idempotence, rollback, uninstall, unsupported platforms, no secrets/shell | `tests/behaviour/daemon-supervisor-install.test.ts`, `tests/golden/daemon-install.test.ts`; `tests/fixtures/daemon/supervisor/**` | `bun test tests/behaviour/daemon-supervisor-install.test.ts` |
| Checks / invariants | Hermeticity, determinism, bounds, error-table sync, secret-read boundary, privacy, mutation meta-tests | `tests/checks/daemon-hermetic.test.ts`, `tests/checks/daemon-determinism.test.ts`, `tests/checks/daemon-bounds.test.ts`; extend `tests/checks/{error-table-sync,secret-read-boundary}.test.ts`; `tests/checks/daemon-mutants.test.ts` | `bun test tests/checks`; `bun run scripts/checks/error-table-sync.ts` |
| Boundaries | Core, CLI, and adapters daemon paths may not import merge execution; package/subpath/tier rules, ambient globals, runtime-API confinement | `.dependency-cruiser.cjs`, `tests/structure/daemon-imports.test.ts`, `tests/boundaries/**` | `bun test tests/boundaries`; `pnpm check:boundaries` |
| Performance | 100 slow subscribers p99 ≤ 50 ms; 100 scheduled starts; 200-lane status/reconciliation rendering | `tests/behaviour/control-session.test.ts` (isolation), `tests/behaviour/daemon-lock-concurrency.test.ts`, `tests/checks/daemon-bounds.test.ts` | `bun test tests/behaviour/control-session.test.ts tests/behaviour/daemon-lock-concurrency.test.ts tests/checks/daemon-bounds.test.ts` |
| Aggregate | Whole workspace | all of the above | `pnpm check` |

All suites use `bun:test` under `tests/**`; fixtures are never named `*.test.ts`. Clock, lock/state transport, process supervisor, lane executor, external-effect adapters, supervisor adapter, and transport pair are injected. Goldens carry no absolute paths, wall-clock timestamps, hostnames, user names, unit-name product tokens, or unstable ordering and are regenerated only by an explicit command. No permanent suite asserts a diff against a moving base branch.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Impact | Priority | AC |
|---|---|---|---|---|---|---|
| TC-LIFE-001 | `daemon start` acquires, reconciles, opens, and returns ready | Happy Path | Behaviour/Integration | Critical | High | AC-F1-1 |
| TC-LIFE-002 | `daemon stop` with no daemon is an idempotent noop | Edge Case | Behaviour/CLI | Important | High | AC-F1-1 |
| TC-LIFE-003 | `daemon status` reports the full state-derived projection | Happy Path | Behaviour/CLI | Critical | High | AC-F1-1 |
| TC-LIFE-004 | Plain status over absent/stale heartbeat degrades at exit 0 | Negative | Behaviour/CLI | Critical | High | AC-F1-2 |
| TC-LIFE-005 | `daemon status --live` fails closed on unreachable socket/stale heartbeat | Negative | Behaviour/CLI | Critical | High | AC-F1-2 |
| TC-LIFE-006 | Stop drain/immediate is state-first, signals no lane, and leaves no false release | Edge Case | Behaviour/Integration | Critical | High | AC-F1-1, AC-F12-2 |
| TC-LIFE-007 | Foreground versus resident start returns at readiness | Happy Path | Behaviour | Important | High | AC-F1-1 |
| TC-LIFE-008 | Envelope, exit projection, and deterministic human summary | Contract | Behaviour/CLI/Golden | Critical | High | AC-F1-1, AC-F1-2 |
| TC-LOCK-001 | Second start against a live lock refuses with holder evidence | Negative | Behaviour/Integration | Critical | High | AC-F2-1 |
| TC-LOCK-002 | Stale-lock takeover records full previous-instance evidence | Edge Case | Behaviour/Integration | Critical | High | AC-F2-2 |
| TC-LOCK-003 | Live-lock takeover is refused with zero appends | Negative | Behaviour | Critical | High | AC-F2-2 |
| TC-LOCK-004 | Two state directories run independent daemons | Happy Path | Integration | Critical | High | AC-F2-3 |
| TC-LOCK-005 | 100 scheduled starts yield exactly one live daemon | Regression | Behaviour/Concurrency | Critical | High | NFR-3, AC-F2-1, AC-F2-2 |
| TC-LOCK-006 | Daemon lock is not the state write fence | Regression | Behaviour/Structure | Critical | High | AC-F2-2, NFR-3 |
| TC-STATE-001 | Queue mutations land daemon-down with degraded marker (SC-M1-17) | Happy Path | Behaviour/CLI | Critical | High | AC-F3-1, AC-F12-1 |
| TC-STATE-002 | Blocker publish/answer land daemon-down with unchanged shape | Happy Path | Behaviour/CLI | Critical | High | AC-F3-1 |
| TC-STATE-003 | Reconciliation makes daemon-down intents effective, with blocker answers durable until a lane boundary | Integration | Behaviour/Integration | Critical | High | AC-F3-1 |
| TC-STATE-004 | Poke, tail, and bounded poll each wake the daemon | Happy Path | Behaviour/Integration | Critical | High | AC-F3-2 |
| TC-STATE-005 | A lost poke/tail/poll changes no durable outcome | Negative | Behaviour | Critical | High | AC-F3-2 |
| TC-STATE-006 | Kill/restart reconstructs the world from state alone | Regression | Behaviour/Checks | Critical | High | NFR-2, AC-F3-1, AC-F8-1 |
| TC-WIRE-001 | Frame envelope and the closed Appendix B wire-type set round-trip | Contract | Unit/Contract | Critical | High | AC-F4-1, EVT-8 |
| TC-WIRE-002 | Version 1/0 negotiation and unsupported-version refusal | Contract | Unit/Contract | Critical | High | AC-F4-1 |
| TC-WIRE-003 | Subscription overflow degrades only the subscriber (SC-M1-20) | Edge Case | Behaviour/Concurrency | Critical | High | AC-F4-3 |
| TC-WIRE-004 | Dispatcher latency stays bounded under 100 slow subscribers | Performance | Behaviour/Perf | Critical | High | AC-F4-3, NFR-6 |
| TC-WIRE-005 | No business truth on the wire; a lost frame changes nothing | Negative | Behaviour/Contract | Critical | High | AC-F4-4 |
| TC-WIRE-006 | No credential/secret/prompt/body transits; the lock token is exempt but non-credential | Negative | Checks/Contract | Critical | High | AC-F4-4, NFR-12 |
| TC-WIRE-007 | `callerPrincipal` is present, reserved, and never authorization | Contract | Structure/Behaviour | Critical | High | AC-F4-5 |
| TC-WIRE-008 | Control drain/stop/takeover is token-guarded and state-expressible | Contract | Behaviour/Integration | Critical | High | AC-F4-1, AC-F1-1, NFR-2 |
| TC-TRANSPORT-001 | stdio conformance is identical and transport-agnostic (AC-F4-2) | Regression | Integration/Contract | Critical | High | AC-F4-2 |
| TC-TRANSPORT-002 | Unix default binds 0700 dir, 0600 socket, same-user policy | Happy Path | Integration/Checks | Critical | High | AC-F5-1 |
| TC-TRANSPORT-003 | Socket path outside the state directory is refused | Negative | Behaviour/Config | Critical | High | AC-F5-1, NFR-10 |
| TC-TRANSPORT-004 | Declared-not-delivered transports are refused, not fallback | Negative | Behaviour/Config | Critical | High | AC-F5-1, NFR-10 |
| TC-TRANSPORT-005 | Unopenable transport starts in declared degraded mode | Edge Case | Behaviour/Integration | Critical | High | AC-F5-1, NFR-5 |
| TC-CONC-001 | Concurrent `status --live` connections never cross-talk (SC-M1-18) | Regression | Behaviour/Concurrency | Critical | High | AC-F6-1 |
| TC-CONC-002 | Same-key state-path intent applies at most once, daemon down and daemon up | Regression | Behaviour/Concurrency | Critical | High | AC-F6-2, NFR-15 |
| TC-CONC-003 | Different-key intents serialize through the state fence, daemon down and daemon up | Regression | Behaviour/Concurrency | Critical | High | AC-F6-2 |
| TC-CONC-004 | Response timeout degrades to the state path, never blocks | Negative | Behaviour/Integration | Critical | High | AC-F6-2, NFR-5 |
| TC-CONC-005 | Control dedupe is per (connection, `id`, lock token): same-connection replay applies once; a cross-connection `id` collision is a distinct request | Regression | Behaviour/Concurrency | Critical | High | AC-F6-2, NFR-15 |
| TC-HEART-001 | Heartbeat carries ordinal, depth, lanes, spawn, and cursor | Happy Path | Behaviour/Contract | Critical | High | AC-F7-1 |
| TC-HEART-002 | Stop records the release reason; no reader fabricates a beat | Edge Case | Behaviour/Integration | Critical | High | AC-F7-1 |
| TC-RECON-001 | Reconciliation classifies alive, interrupted, and crashed (SC-M1-16) | Happy Path | Behaviour/Integration | Critical | High | AC-F8-1 |
| TC-RECON-002 | Insufficient evidence holds the lane instead of guessing | Negative | Behaviour | Critical | High | AC-F8-1 |
| TC-RECON-003 | Interrupted lane resumes at phase 8 and increments once | Happy Path | Behaviour/Integration | Critical | High | AC-F8-2 |
| TC-RECON-004 | Replayed reconciliation increments nothing and appends no second report | Regression | Behaviour | Critical | High | AC-F8-2 |
| TC-RECON-005 | Budget exhaustion is terminal with the delivered exhaustion record (SC-M1-15) | Edge Case | Behaviour/Integration | Critical | High | AC-F8-3 |
| TC-RECON-006 | Exhaustion raises a typed question within one cycle and never requeues (SC-M1-15) | Edge Case | Behaviour/Integration | Critical | High | AC-F8-3 |
| TC-RECON-007 | Kill/restart duplicates zero commits; the owner restores the binding from the redrive request | Regression | Behaviour/Integration | Critical | High | AC-F8-4, AC-F10-2 |
| TC-RECON-008 | Kill/restart duplicates zero tickets/comments (receipt half) | Regression | Behaviour/Integration | Critical | High | AC-F8-4, AC-F10-1 |
| TC-RECON-009 | Unreadable state refuses the start with `state-recovery-failed` | Negative | Behaviour/Integration | Critical | High | AC-F8-1, NFR-13 |
| TC-LANE-001 | Supervision claims, spawns, records, observes, and releases | Happy Path | Integration | Critical | High | AC-F9-1 |
| TC-LANE-002 | The daemon performs no delivery work in-process | Regression | Structure/Checks | Critical | High | AC-F9-1 |
| TC-LANE-003 | Missing executor runs `supervise-only` and declares it | Negative | Behaviour/Integration | Critical | High | AC-F9-1 |
| TC-LANE-004 | Prefilling/resuming lane is progressing, never stalled (SC-M1-14) | Regression | Behaviour | Critical | High | AC-F9-2 |
| TC-LANE-005 | A corroborated stall applies watchdog classification and restart | Edge Case | Behaviour | Critical | High | AC-F9-2 |
| TC-LANE-006 | `daemon.lane` state is distinct and updated only by the daemon | Contract | Structure/Behaviour | Critical | High | AC-F9-1, DM-3 |
| TC-EFFECT-001 | Effect state machine accepts only legal transitions | Happy Path | Behaviour/Contract | Critical | High | AC-F10-1 |
| TC-EFFECT-002 | Unknown + query found records `already-applied`, no second effect | Edge Case | Behaviour | Critical | High | AC-F10-1, NFR-15 |
| TC-EFFECT-003 | Unknown + query not-found re-applies exactly once | Edge Case | Behaviour | Critical | High | AC-F10-1, NFR-15 |
| TC-EFFECT-004 | Unknown + unreadable query stays unknown with no blind retry | Negative | Behaviour | Critical | High | AC-F10-1, NFR-15 |
| TC-EFFECT-005 | Commit re-drive matches the recorded path-set identity and creates no second commit | Regression | Behaviour/Integration | Critical | High | AC-F10-2, AC-F8-4 |
| TC-EFFECT-006 | No tracker/VCS write adapter ships; commit is the only production adapter | Regression | Structure/Checks | Critical | High | AC-F10-3 |
| TC-PREEMPT-001 | Active-session preemption is pending and never signals/kills | Edge Case | Behaviour/Integration | Critical | High | AC-F11-1 |
| TC-PREEMPT-002 | Boundary apply releases, parks, and names the close item | Happy Path | Behaviour/Integration | Critical | High | AC-F11-1 |
| TC-PREEMPT-003 | Pending preemption survives restart and re-evaluates | Regression | Behaviour/Integration | Critical | High | AC-F11-1 |
| TC-PREEMPT-004 | No-session preemption releases and parks immediately; explicit path equivalent | Happy Path | Behaviour/Integration | Critical | High | AC-F11-2 |
| TC-PREEMPT-005 | Single-flight holds until release; close item not scheduled same pass | Edge Case | Behaviour | Critical | High | AC-F11-2 |
| TC-DEGRADE-001 | Full one-shot surface works daemon-down with truthful markers (SC-M1-17) | Regression | Behaviour/CLI | Critical | High | AC-F12-1, AC-F3-1 |
| TC-DEGRADE-002 | Absent, stale, and crashed daemons never fail or idle a one-shot | Regression | Behaviour/Integration | Critical | High | AC-F12-2, AC-F12-1 |
| TC-DEGRADE-003 | Plain status degrades at exit 0; only `--live` fails at exit 2 | Contract | Behaviour/CLI | Critical | High | AC-F12-2, AC-F1-2 |
| TC-DEGRADE-004 | Unreadable state yields a classified exit 2, never an all-clear | Negative | Behaviour/CLI | Critical | High | AC-F12-2, NFR-13 |
| TC-WATCH-001 | `queue --watch` streams a bounded snapshot and deduplicated events | Happy Path | Behaviour/CLI | Critical | High | AC-F13-1 |
| TC-WATCH-002 | `lanes --watch` keeps finding codes and honours the frame bound | Happy Path | Behaviour/CLI | Critical | High | AC-F13-1 |
| TC-WATCH-003 | Watch without a daemon is declared degraded polling at exit 0 | Edge Case | Behaviour/CLI | Critical | High | AC-F13-2 |
| TC-WATCH-004 | Watch over unreadable state exits 2 with a `state.*` identity | Negative | Behaviour/CLI | Critical | High | AC-F13-2, NFR-13 |
| TC-WATCH-005 | Mid-stream overflow drops to polling with a degraded marker | Edge Case | Behaviour/Integration | Critical | High | AC-F13-1, AC-F13-2 |
| TC-POLL-001 | Failure backs off base→max; success resets to base | Happy Path | Behaviour/Config | Critical | High | AC-F14-1 |
| TC-POLL-002 | Minimum spacing and rate limit are honoured; reads stay on delivered seams | Regression | Behaviour/Checks | Critical | High | AC-F14-1, NFR-16 |
| TC-POLL-003 | Polling and one-shot cadence are configuration-only | Happy Path | Behaviour/Config | Critical | High | AC-F14-1, NFR-10 |
| TC-POLL-004 | No unbounded polling path or non-seam read exists | Regression | Structure/Checks | Critical | High | AC-F14-1, NFR-16 |
| TC-INSTALL-001 | systemd user unit is scoped, data-only, secret-free, and uses the foreground entry | Happy Path | Behaviour/Golden | Critical | High | AC-F15-1, NFR-12 |
| TC-INSTALL-002 | Install enables linger, reports it, and is idempotent | Happy Path | Behaviour/Integration | Critical | High | AC-F15-1 |
| TC-INSTALL-003 | Linger failure removes the unit and exits 2 | Negative | Behaviour/Integration | Critical | High | AC-F15-1, NFR-18 |
| TC-INSTALL-004 | Uninstall removes only what it created and noops when absent | Edge Case | Behaviour/Integration | Important | High | AC-F15-1, AC-F1-2 |
| TC-INSTALL-005 | An absent unit changes nothing for one-shots | Regression | Behaviour/CLI | Critical | High | AC-F15-1, NFR-18 |
| TC-INSTALL-006 | Unsupported platforms exit 2 and write no unit | Negative | Behaviour/CLI | Critical | High | AC-F15-2, NFR-18 |
| TC-INSTALL-007 | Installed unit keeps the daemon resident (not merely installed) | Integration | Behaviour/Integration | Critical | High | AC-F15-1, NFR-18 |
| TC-VOCAB-001 | Seven additive record kinds with schemas and keys | Contract | Structure | Critical | High | AC-F16-1, NFR-8 |
| TC-VOCAB-002 | Exactly eight `daemon` rows synchronize both directions | Regression | Checks/Structure | Critical | High | AC-F16-1, NFR-11 |
| TC-VOCAB-003 | `daemon` and `poll` configuration branches validate and default | Contract | Structure/Behaviour | Critical | High | AC-F16-1 |
| TC-VOCAB-004 | `callerPrincipal` is additive on intent records and backward-compatible | Contract | Structure/Behaviour | Critical | High | AC-F4-5, AC-F16-1, NFR-8 |
| TC-VOCAB-005 | `--watch` is accepted without changing delivered payloads | Contract | Structure/Behaviour | Critical | High | AC-F16-1 |
| TC-VOCAB-006 | One changeset; additive state with no schema bump | Regression | Checks | Critical | High | AC-F16-1, NFR-8 |
| TC-VOCAB-007 | Frame, record, effect, classification, and config sets are closed | Regression | Structure/Checks | Critical | High | NFR-14 |
| TC-VOCAB-008 | Existing stores read verified-empty; historical records read unchanged | Regression | Integration/Checks | Critical | High | AC-F16-1, NFR-8 |
| TC-MERGEABS-001 | No daemon path imports or reaches merge execution | Regression | Structure/Boundaries | Critical | High | AC-F17-1, NFR-17 |
| TC-MERGEABS-002 | `mergeCodePath` is a computed closed set (`absent`/`present`) | Contract | Behaviour/Structure | Critical | High | AC-F17-1 |
| TC-DET-001 | 100 identical runs produce byte-identical status/reconciliation | Regression | Checks/Behaviour | Critical | High | NFR-1, AC-F1-1, AC-F8-1 |
| TC-HERMETIC-001 | Hermetic guards and one bounded real-child smoke | Regression | Checks | Critical | High | NFR-7 |
| TC-BOUNDS-001 | Every declared bound truncates explicitly, never silently | Edge Case | Checks/Behaviour | Critical | High | NFR-9, AC-F1-1, AC-F8-1, AC-F13-1 |
| TC-PRIVACY-001 | No secrets, prompts, bodies, or absolute roots on any surface | Negative | Checks | Critical | High | NFR-12, AC-F4-4 |
| TC-META-001 | Mutation fixtures prove the key rules fail when broken | Regression | Checks | Critical | High | NFR-1, NFR-3, NFR-4, NFR-17 |
| TC-CONFIG-001 | Every `daemon.*` key is configuration-only and fail-closed | Happy Path | Behaviour/Config | Critical | High | NFR-10, AC-F5-1, AC-F14-1 |

### 5.2 Scenario Details

#### TC-LIFE-001 - `daemon start` acquires, reconciles, opens, and returns ready

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, DM-1, DM-13, EVT-1, EVT-2, EVT-4, NFR-1, NFR-9
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-lifecycle.test.ts`; `tests/fixtures/daemon/lifecycle/start/**`
**Tags**: @backend, @daemon, @lifecycle

**Preconditions**:
- A temporary state store with no daemon instance record; an injected clock fixed at `2026-11-07T10:00:00Z`.
- A recording state port, an injected transport factory that opens an in-memory pair, and a fixed instance identity source.
- A reconcile input with zero in-flight lanes and a valid configuration.

**Steps**:
1. Run `daemon start`; assert one `daemon.instance` acquisition append with operation `acquired`, a unique lock token, pid, scope, and acquisition time.
2. Assert one `daemon.reconciliation` append with queue counts, an empty lanes list, `duplicates: 0`, and no question ids.
3. Assert one initial heartbeat append and that the configured transport was opened behind the transport interface.
4. Assert the envelope carries `instance`, `reconciliation`, `socket` (`path`, `transport`, `reachable: true`), `heartbeat` (`intervalMs`, `ageMs`), and `degraded: []`; exit 0. The live path may appear here, but a deterministic golden renders it only as `<state-dir>/daemon.sock`.
5. Assert the invocation returned only after readiness (all three appends and the transport open completed).
6. Replay the identical start against the now-live lock; assert it refuses and appends nothing (detailed in TC-LOCK-001).

**Expected Outcome**:
- One durable instance, one reconciliation, and one heartbeat exist before the start returns; the envelope is complete and truthful; exit 0.

**Postconditions**:
- The instance record is the durable owner; the heartbeat age is zero relative to the injected clock.

#### TC-LIFE-002 - `daemon stop` with no daemon is an idempotent noop

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1, F-12, AC-F1-1, DM-1, DM-13
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-lifecycle.test.ts`; `tests/golden/daemon-lifecycle.test.ts`
**Tags**: @backend, @daemon, @cli

**Preconditions**:
- A state store with no instance record or with a `released` latest instance.
- No socket, no process, and no background task; a throwing `fetch` guard.

**Steps**:
1. Run `daemon stop`; assert exit 0, `result: "noop"`, no new record, and `degraded: []` or the declared stopped marker.
2. Run it again; assert the identical noop and zero new appends.
3. Assert no signal, process lookup, or socket open is attempted.
4. Run `daemon stop --mode immediate`; assert the same noop shape.

**Expected Outcome**:
- Stop against an absent daemon is a truthful idempotent noop at exit 0, not a failure and not an append.

#### TC-LIFE-003 - `daemon status` reports the full state-derived projection

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-7, AC-F1-1, DM-13, EVT-1, EVT-2, EVT-4, NFR-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-lifecycle.test.ts`; `tests/golden/daemon-lifecycle.test.ts`
**Tags**: @backend, @daemon, @status

**Preconditions**:
- A running instance with a heartbeat 1 000 ms old, two delivering lanes, one parked lane, a restart counter with a classified reason, and an installed supervisor descriptor.
- Injected clock; socket reachable.

**Steps**:
1. Run `daemon status`; assert `instance` (id, pid), `uptimeMs`, `queueDepth`, `lanes[]`, `restarts[]` (`ref`, `count`, `reason`, `classified`), `heartbeat` (`ageMs`, `intervalMs`, `state: "running"`), `socket` (`path`, `transport`, `reachable`), `supervisor`, `reconciliation` summary, `mergeCodePath` in the closed set `{"absent", "present"}` with the production composition reporting `"absent"`, and `degraded: []`.
2. Assert every value is derivable from the instance, heartbeat, lane, economics, and supervisor records; no process listing or socket-only fact is used.
3. At 200 lanes, assert the lane list is capped with `truncated: true` and a named `truncationReason`.
4. Run twice; assert byte-identical machine and human output.

**Expected Outcome**:
- Status is a complete, bounded, deterministic projection of durable state; exit 0.

#### TC-LIFE-004 - Plain status over absent/stale heartbeat degrades at exit 0

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-7, F-12, AC-F1-2, DM-13, DM-14, NFR-13
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-degradation.test.ts`; `tests/fixtures/daemon/degradation/status/**`
**Tags**: @backend, @daemon, @degraded

**Preconditions**:
- Case A: no instance record. Case B: an instance record with heartbeat age at and beyond `daemon.lock-staleness`. Case C: a `released` instance.
- Injected clock; no socket.

**Steps**:
1. For A, run plain `daemon status`; assert exit 0, `heartbeat.state: "stopped"` (or an explicit absent state), and a declared `degraded` marker.
2. For B, run plain status; assert exit 0, `heartbeat.state: "stale"`, the exact age, and `daemon-heartbeat-stale` in `degraded`.
3. For C, assert `heartbeat.state: "stopped"` and no fabricated running state.
4. Assert no surface reports an all-clear, a zero-lane view, or a running daemon.
5. Assert no append, no socket open, and no failure exit.

**Expected Outcome**:
- A plain status over absent or stale liveness is a truthful degraded success at exit 0.

#### TC-LIFE-005 - `daemon status --live` fails closed on unreachable socket/stale heartbeat

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-7, F-12, AC-F1-2, DM-13, DM-14, NFR-13
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-degradation.test.ts`; `tests/golden/daemon-status-matrix.test.ts`
**Tags**: @backend, @daemon, @fail-closed

**Preconditions**:
- Case A: socket unreachable, heartbeat fresh. Case B: socket reachable but heartbeat at/beyond staleness. Case C: both healthy.
- Injected transport pair that can refuse open.

**Steps**:
1. For A, run `daemon status --live`; assert exit 2, `daemon.socket-unreachable`, category `platform`, consequence `not_landed`, and a remediation hint.
2. For B, assert exit 2 with `daemon.heartbeat-stale` and the age; assert the stale fact is not presented as live.
3. For C, assert exit 0 and a response labeled `live` with state-derived facts.
4. Assert A and B emit no `data` sibling and no fabricated live values.
5. Assert no retry loop and no wait beyond `daemon.response-timeout`.

**Expected Outcome**:
- `--live` is the only status surface that fails closed, and it fails with the classified identity at exit 2.

#### TC-LIFE-006 - Stop drain/immediate is state-first, signals no lane, and leaves no false release

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-2, F-12, AC-F1-1, AC-F12-2, DM-1, EVT-1, NFR-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-lifecycle.test.ts`; `tests/fixtures/daemon/lifecycle/stop/**`
**Tags**: @backend, @daemon, @stop

**Preconditions**:
- A live instance with one delivering lane and one detached lane; a recording lane-executor/signal port that counts every signal.
- Case A: reachable control socket. Case B: socket unreachable but a recorded pid. Case C: neither reachable.

**Steps**:
1. For A, run `daemon stop --mode drain`; assert the control frame is used, new spawn decisions stop, live lane sessions remain recorded detached, the daemon appends its own `released` instance record, and no lane signal is recorded.
2. For B, run stop; assert the recorded process is signalled, no false `released` record is appended by the CLI, and the daemon's own exit appends the release.
3. For C, assert a classified noop/absent outcome at exit 0 with no append.
4. Run `--mode immediate`; assert the control loop stops without signalling any lane and the instance operation is `immediate-stop`.
5. Simulate an unclean exit (no release record); assert the next start sees a stale lock and takes over (TC-LOCK-002).

**Expected Outcome**:
- Stop never signals a lane, never writes another actor's release, and leaves stale evidence for the next start when unclean.

#### TC-LIFE-007 - Foreground versus resident start returns at readiness

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1, AC-F1-1, DM-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-lifecycle.test.ts`; `tests/fixtures/daemon/lifecycle/mode/**`
**Tags**: @backend, @daemon, @lifecycle

**Preconditions**:
- Two paired runs differ only by `--foreground`.
- An injected process host reports whether the invocation remained attached.

**Steps**:
1. Run `daemon start`; assert the default returns after readiness with `instance.mode: "resident"` and the process host records a detached resident.
2. Run `daemon start --foreground`; assert it stays attached, reports `mode: "foreground"`, and exits only on stop/interrupt.
3. Assert both append the same acquisition/reconciliation/heartbeat records and carry the same envelope fields.
4. With no executor composed, assert `mode: "supervise-only"` (TC-LANE-003).

**Expected Outcome**:
- Foreground and resident differ only in attachment, never in durable readiness facts.

#### TC-LIFE-008 - Envelope, exit projection, and deterministic human summary

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, AC-F1-2, DM-13, NFR-1, NFR-9, Appendix C
**Test Type(s)**: Contract, Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/golden/daemon-lifecycle.test.ts`, `tests/behaviour/daemon-lifecycle.test.ts`; `tests/fixtures/daemon/golden/**`
**Tags**: @backend, @api, @envelope, @golden

**Preconditions**:
- One success case per subcommand, one user refusal (`already-running`), one transient refusal (`takeover-refused`), one platform failure (`state-recovery-failed`, `supervisor-unsupported`), one degraded success, and one invocation rejection (unknown flag).
- The delivered `CommandResult` envelope and projection are available.

**Steps**:
1. For each success, assert exit 0, a parseable envelope with `schemaVersion`, `runId`, `exitCode`, `timing`, and `data`.
2. For `daemon start|stop|status`, assert the human summary prints `result=`, `instance=`, `pid=`, `heartbeat=`, `degraded=`, and `merge_code_path=` before any detail where defined.
3. For each refusal, assert exit 1, the exact `daemon.*` code, `category`, `retryable`, `consequence: "not_landed"`, and a remediation hint.
4. For each platform failure, assert exit 2 and the exact identity; for an unknown flag, assert exit 1 with `fallback.invocation`.
5. Assert human output is ≤ 40 lines and 8 192 bytes with a truncation marker when capped.
6. Run each case twice; assert byte-identical machine and human output.

**Expected Outcome**:
- Every daemon outcome projects through the delivered `{0, 1, 2}` taxonomy with a deterministic summary and no silent success.

#### TC-LOCK-001 - Second start against a live lock refuses with holder evidence

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-1, DM-1, EVT-1, NFR-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-lock.test.ts`; `tests/fixtures/daemon/lock/live/**`
**Tags**: @backend, @daemon, @lock, @negative

**Preconditions**:
- A live `daemon.instance` acquisition with instance `inst-a`, pid, acquisition time, lock token `t-91`, and heartbeat age 1 000 ms.
- A second start with instance `inst-b`; injected clock fixed.

**Steps**:
1. Run the second `daemon start`; assert exit 1 with `daemon.already-running`, consequence `not_landed`, and category `user`.
2. Assert the error/evidence names `inst-a`, its pid, acquisition time, last heartbeat time, and heartbeat age.
3. Assert zero new records and no change to the lock artifact or holder.
4. Assert the second process never opens the transport and never begins reconciliation.
5. Repeat; assert the same refusal with no additional append.

**Expected Outcome**:
- A live holder is never displaced; the second start is a clean exit-1 refusal with complete evidence and zero appends. (SC-M1-15 context.)

#### TC-LOCK-002 - Stale-lock takeover records full previous-instance evidence

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-2, DM-1, EVT-1, NFR-3, NFR-4
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-lock.test.ts`; `tests/fixtures/daemon/lock/stale/**`
**Tags**: @backend, @daemon, @lock, @takeover

**Preconditions**:
- `daemon.lock-staleness` is 30 000 ms. Cases: heartbeat age 29 999 ms (live), 30 000 ms (at bound), 71 000 ms (stale).
- Previous instance `inst-a`, previous token `t-91`, last heartbeat time recorded; injected clock fixed.

**Steps**:
1. For the live case, assert the claim refuses and appends nothing.
2. For the at-bound and stale cases, assert takeover succeeds and one `daemon.instance` record with operation `taken-over` is appended.
3. Assert the record's `takeover` carries `previousInstanceId`, `previousLockToken`, `lastHeartbeatAt`, `heartbeatAgeMs`, and `takenOverAt`.
4. Assert the new lock token is distinct and the previous instance is never silently replaced without the takeover evidence.
5. Assert reconciliation then runs and the start exits 0.

**Expected Outcome**:
- Staleness is stated inclusively at the bound; every takeover is fully evidenced; a live lock is never displaced.

#### TC-LOCK-003 - Live-lock takeover is refused with zero appends

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-2, DM-1, EVT-1, NFR-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-lock.test.ts`; `tests/fixtures/daemon/lock/refused/**`
**Tags**: @backend, @daemon, @lock, @negative

**Preconditions**:
- A live lock with fresh heartbeat; a live-holder takeover request carrying the current token and surfaced "evidence" that does not prove staleness.
- A recording store.
- Three separately named cases from AC-F2-2: (A) stale takeover, (B) explicit `takeover` against a live lock, (C) `daemon start` against that same live lock.

**Steps**:
1. Case B: request `takeover` (control frame and state path); assert exit 1 with `daemon.takeover-refused`, category `transient`, `retryable: true`, and `not_landed`.
2. Assert the refusal names the live holder and the absence of stale evidence.
3. Assert zero instance appends and no lock mutation for Case B.
4. Case C: run `daemon start` against the same live lock; assert exit 1 with `daemon.already-running` (per AC-F2-1) and **never** `daemon.takeover-refused`; assert zero appends.
5. Case A: assert the at-bound/stale path is the only takeover route and is proven in TC-LOCK-002 with full previous-instance evidence.
6. Assert the live daemon continues to serve a query and heartbeat normally in both B and C.

**Expected Outcome**:
- The three AC-F2-2 cases are separated: a stale lock is taken over with evidence, an explicit live takeover is `daemon.takeover-refused`, and a live `daemon start` is `daemon.already-running` — each at exit 1 with nothing appended.

#### TC-LOCK-004 - Two state directories run independent daemons

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-5, AC-F2-3, DM-1, DM-2, NFR-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-lock.test.ts`; `tests/fixtures/daemon/lock/scopes/**`
**Tags**: @backend, @daemon, @lock, @scope

**Preconditions**:
- Two temporary state directories `scope-a` and `scope-b`, each with its own store identity and injected clock.
- One daemon started in each; each has distinct queue, lane, and heartbeat facts.

**Steps**:
1. Start both; assert both exit 0 with distinct instance ids and lock tokens.
2. Assert each heartbeat, reconciliation, and lane record lands only in its own store.
3. Assert no record, lease, frame, socket path, or query result from `scope-a` is visible from `scope-b`.
4. Stop `scope-a`; assert `scope-b` continues, its lock remains live, and its heartbeat advances.
5. Assert a second start in `scope-a` refuses only against `scope-a`'s lock.

**Expected Outcome**:
- Per-state-directory scoping is complete: independent locks, records, streams, and lifecycles.

#### TC-LOCK-005 - 100 scheduled starts yield exactly one live daemon

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-3, F-2, AC-F2-1, AC-F2-2, RSK-1
**Test Type(s)**: Concurrency
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-lock-concurrency.test.ts`; `tests/fixtures/daemon/lock/harness.ts`
**Tags**: @backend, @daemon, @concurrency

**Preconditions**:
- A deterministic lock harness implements the daemon-lock port with a single-writer gate, an operation log, and a barrier at the staleness read.
- 100 start contenders with distinct instance ids, all observing "no live lock" before the gate drains.
- No real timer, worker thread, or OS race.

**Steps**:
1. Arm the barrier; release all 100 contenders in a fixed declared order.
2. Assert exactly 1 acquisition, exactly 1 `daemon.instance` record, and 99 `daemon.already-running` refusals at exit 1.
3. Assert 0 stale takeovers, because no heartbeat is old enough.
4. Assert the operation log proves every contender read staleness before attempting acquisition.
5. Repeat with 100 contenders where one stale lock exists; assert exactly 1 takeover and 99 refusals, and 1 takeover record.
6. Assert no duplicate instance record and no live lock displaced.

**Expected Outcome**:
- Under a forced "all saw free" interleaving, the single-writer lock yields exactly one live daemon and evidenced refusals; zero live takeovers.

#### TC-LOCK-006 - Daemon lock is not the state write fence

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-2, NFR-3, DM-1, TDR-0004
**Test Type(s)**: Structure, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/daemon-contract.test.ts`, `tests/behaviour/daemon-lock.test.ts`; `tests/fixtures/daemon/lock/fence/**`
**Tags**: @structure, @daemon, @lock, @state

**Preconditions**:
- The daemon lock artifact and the state fence are distinct types/ports.
- A recording state port counts fence acquisitions and durations.

**Steps**:
1. During a full start, assert the state fence is acquired only for short append windows, never held for the daemon lifetime.
2. Assert a long-running heartbeat or idle period acquires no fence.
3. Assert the daemon lock token is a different value and artifact from any state fence token.
4. Assert a state fence conflict does not cause `daemon.already-running`, and a daemon-lock conflict does not appear as `state.lock.busy`.

**Expected Outcome**:
- The two mechanisms remain separate; the daemon lock protects lifetime ownership, the state fence protects one write.

#### TC-STATE-001 - Queue mutations land daemon-down with degraded marker (SC-M1-17)

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-12, AC-F3-1, AC-F12-1, DM-1, DM-13, NFR-2, NFR-15
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-state-mediation.test.ts`, `tests/behaviour/queue-cli.test.ts`; `tests/fixtures/queue/e2e/**`
**Tags**: @backend, @daemon, @queue, @daemon-free

**Preconditions**:
- No daemon process, socket, or background task; a throwing `fetch` guard.
- A temporary state store, one repository binding, and a mutable injected clock.

**Steps**:
1. Run `queue add GH-401 --priority 5`; assert exit 0, one entry append, and `degraded: ["daemon-unreachable"]`.
2. Run `queue prioritize GH-401 2`, `queue dep GH-401 GH-400`, `queue claim GH-401 --holder one-shot-1`, and `queue release GH-401 --holder one-shot-1`; assert each lands under the fence, exits 0, and carries the marker.
3. Assert the claim produced a delivered `repo-exclusive` lease with heartbeat and the release produced a release record; this inherits SC-M1-17b's mutual-exclusion path without adding a second implementation.
4. Assert no socket, child process, or daemon notification appears in any envelope.
5. Re-open the store; assert every mutation is durable and ordered.

**Expected Outcome**:
- Every queue mutation completes through state alone at exit 0 with truthful degradation; no daemon is required at any point.

#### TC-STATE-002 - Blocker publish/answer land daemon-down with unchanged shape

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1, DM-1, NFR-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-state-mediation.test.ts`, `tests/behaviour/blockers-publish.test.ts`; `tests/fixtures/blockers/**`
**Tags**: @backend, @daemon, @blockers, @daemon-free

**Preconditions**:
- No daemon; a temporary state store with a published question `q-8f21`.
- The delivered blockers payload shape is captured as a baseline.

**Steps**:
1. Run `blockers publish decision-needed --lane L5 ...`; assert the question lands, exit 0, and the delivered blockers shape is byte-identical to the baseline.
2. Run `blockers answer q-8f21 --choice 2`; assert the answer lands with `applied: false` and a recorded `laneResume` projection, exit 0.
3. Assert the blockers payload carries no `degraded` field invention and no daemon notification claim.
4. Assert the answer and resume note are durable and readable by a later reconciliation.
5. Replay each command; assert no duplicate question or answer.

**Expected Outcome**:
- Blocker interaction remains the channel's own contract: durable, idempotent, daemon-free, and shape-unchanged.

#### TC-STATE-003 - Reconciliation makes daemon-down intents effective, with blocker answers durable until a lane boundary

**Scenario Type**: Integration
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1, DM-3, EVT-1, EVT-3, EVT-4, NFR-2, NFR-15
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-state-mediation.test.ts`; `tests/fixtures/daemon/state/reconcile-intents/**`
**Tags**: @backend, @daemon, @reconciliation, @blockers, @idempotence

**Preconditions**:
- A state store seeded by the daemon-down commands of TC-STATE-001/002: a new entry, a priority change, a dependency edge, a lease, a release, and a blocker answer.
- An injected lane-executor with separate resume/attach call counters, an injected scheduling engine, and a recording effect adapter.
- Case A: no lane exists for the answered question. Case B: a lane exists and holds the answer at a safe phase boundary.

**Steps**:
1. Run `daemon start`; assert reconciliation reads every queue intent and makes each effective exactly once (one queue graph rebuild, one lease observation), with `duplicates: 0`.
2. Assert the blocker answer remains durable and visible with `applied: false`, and its recorded `laneResume` projection is byte-identical to the delivered shape (the daemon never rewrites the answer record).
3. In Case B, assert the lane execution record carries `resumeIntent` (`questionId`, `mode` from the delivered `laneResume` closed set) — the spec's field for the pending resume/application intent — and that no second answer record exists.
4. In Case A (no lane), assert no lane record and no `resumeIntent`, and assert the executor's resume/attach counters stay at zero: no application step is fabricated, and the answer is still durable, visible, and lossless.
5. Assert application happens only at a safe phase boundary and has a named observable: before the boundary the answer stays `applied: false` and the executor counters stay zero; at the boundary in Case B assert **exactly one** executor resume/attach call for that answer, the lane record's `resumeIntent` and declared state transition, no second call, and that the answer record still reads `applied: false` (never rewritten).
6. Assert no full session resume is attempted (that remains M1-S9); assert the reconciliation report describes the answer as durable and awaiting its boundary rather than applying or dropping it.
7. Restart without new intents; assert zero re-application and an equal state projection; assert no intent is dropped or applied twice.
8. **Negative controls**: (a) never invoke the executor at the boundary — assert the "exactly one resume/attach call" assertion fails; (b) invoke it twice — assert the single-application assertion fails; (c) rewrite the answer's `applied` to `true` — assert the delivered-shape assertion fails. Restore each and re-run green.

**Expected Outcome**:
- Queue intents converge exactly once with zero loss; a blocker answer is durable and visible with `applied: false`, carries a `resumeIntent` only when a lane exists, and is applied only at a safe phase boundary when a lane exists — observed as exactly one executor resume/attach call for that answer and zero for the no-lane case, plus the lane record's `resumeIntent` and state transition, with the answer record never rewritten; full resume stays M1-S9.

#### TC-STATE-004 - Poke, tail, and bounded poll each wake the daemon

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-2, EVT-2, EVT-8, NFR-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-state-mediation.test.ts`; `tests/fixtures/daemon/state/wake/**`
**Tags**: @backend, @daemon, @wake

**Preconditions**:
- A running daemon over an in-memory transport pair, an event log with a cursor, and a controllable clock.
- A recording scheduling/apply port counts wake-driven re-reads.

**Steps**:
1. Write an intent and send a `poke` with `{ cursor }`; assert the daemon re-reads state and responds `{ applied: true }`.
2. Disable poke; append to the event log; assert the tail-follow wakes the daemon and applies the intent.
3. Disable both; advance the injected clock to `daemon.poll-interval`; assert the bounded poll wakes it.
4. Assert each wake re-reads state and applies the same intent at most once.
5. Assert the declared wake order is poke, tail, then poll.

**Expected Outcome**:
- All three wake sources converge on state; each is independently sufficient; none carries business truth.

#### TC-STATE-005 - A lost poke/tail/poll changes no durable outcome

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-2, EVT-2, EVT-8, NFR-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-state-mediation.test.ts`; `tests/fixtures/daemon/state/wake-loss/**`
**Tags**: @backend, @daemon, @wake, @negative

**Preconditions**:
- A written intent; a transport that drops the poke; a tail source that raises unavailable; a poll disabled until a later start.
- A recording store.

**Steps**:
1. Write the intent and drop the poke; assert no durable fact is lost and the daemon does not acknowledge a frame it did not read.
2. Make the tail unavailable; assert the daemon falls back without error.
3. Kill the daemon before any poll; restart it; assert reconciliation applies the intent.
4. Assert the final projection is identical to the TC-STATE-004 path.
5. Assert no frame loss produces a fabricated applied result or a duplicate append.

**Expected Outcome**:
- Wake loss is an optimization loss, never a correctness loss; the next read or start recovers it.

#### TC-STATE-006 - Kill/restart reconstructs the world from state alone

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-2, F-3, F-8, AC-F3-1, AC-F8-1, DM-1, DM-3, EVT-1, EVT-3
**Test Type(s)**: Integration, Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-state-mediation.test.ts`, `tests/checks/daemon-hermetic.test.ts`; `tests/fixtures/daemon/state/reconstruct/**`
**Tags**: @backend, @daemon, @state, @regression

**Preconditions**:
- A seeded world: instance, heartbeat, two lanes, one lease, one park, restart counters, one pending preemption, one outbox effect, and one receipt.
- A daemon process hosted in memory that can be killed at declared points.

**Steps**:
1. Kill the process at each declared point (after lock, after heartbeat, after lane record, after effect intent, before release).
2. Restart from the same store; assert instance, queue, lanes, leases, parks, budgets, pending preemptions, effects, and receipts are reconstructed.
3. Assert the reconstructed projection equals a fresh fold from the ledger and no fact is read from process memory.
4. Assert the daemon's in-memory singleton/cache is empty at start and populated only from verified reads.
5. Assert a structural check finds no daemon module holding durable facts in module-level mutable state.

**Expected Outcome**:
- Every fact that matters survives a kill because it lives in state; restart reconstructs the world without memory.

#### TC-WIRE-001 - Frame envelope and the closed Appendix B wire-type set round-trip

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, DM-6, EVT-8, NFR-14
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/control-codec.test.ts`; `tests/fixtures/daemon/wire/codec/**`
**Tags**: @backend, @protocol, @codec

**Preconditions**:
- One fixture per frame kind (`request`, `response`, `event`, `error`) and per **wire type** in the closed Appendix B set: `poke`, `status`, `lane`, `subscribe`, `drain`, `stop`, `takeover`, `frame`, and `degraded`.
- `query` is an interaction class covering the `status` and `lane` request types; it is never used as a fixture `type`.
- A `v: 0` variant of each frame whose fields are sufficient.
- A codec under test with no socket, file, or process dependency.

**Steps**:
1. Encode each frame; assert the wire line is one JSON object terminated by `\n`.
2. Decode it back; assert `v`, `id` (present only where correlated), `kind`, `type`, and `callerPrincipal` survive exactly.
3. Assert the fixture `type` set equals exactly the Appendix B set; assert `query` appears only as a class label, never as a frame `type`; assert `poke`/`subscribe` are request types and `frame`/`degraded` are event types.
4. Assert every `v: 1` fixture carries `callerPrincipal` and every `v: 0` fixture omits the additive reserved fields.
5. Assert exactly one of `payload`, `data`, or `error` is present per kind, no extra field is admitted, and the envelope carries no idempotency-key field.
6. Assert a `v: 0` frame missing a field its own version requires is refused, while a `v: 0` frame is accepted only where its fields are sufficient.
7. Assert an unknown `kind`, an unknown `type`, a missing `v`, and a frame with two of payload/data/error are refused with a classified error before any action; assert a frame over `daemon.frame-max-bytes` is refused before parsing into an action.
8. Assert round-trip is byte-identical for canonical input.

**Expected Outcome**:
- The codec is a total, closed, transport-free contract over exactly Appendix B's wire types; v1 carries the principal, v0 omits the additive reserved fields and is accepted only where sufficient; malformed frames are refused before they can mutate anything.

#### TC-WIRE-002 - Version 1/0 negotiation and unsupported-version refusal

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, EVT-8, NFR-14, DEC-7
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/control-session.test.ts`; `tests/fixtures/daemon/wire/version/**`
**Tags**: @backend, @protocol, @versioning

**Preconditions**:
- Frames for `v: 1`, `v: 0`, `v: 2`, and `v: -1`.
- A `v: 0` frame that omits the additive reserved fields but carries every field its own version requires, and a `v: 0` frame missing a field its version requires.
- A session over an in-memory pair.

**Steps**:
1. Send a `v: 1` request; assert it is served, the response carries `v: 1`, and every v1 request and response carries `callerPrincipal`.
2. Send a `v: 0` request whose fields are sufficient; assert it is accepted and answered without the additive reserved fields (`callerPrincipal` absent, not fabricated as `null`).
3. Send a `v: 0` frame missing a field its own version requires; assert it is refused through the delivered error table, not silently upgraded to v1.
4. Send a `v: 2` request; assert an error frame carries `daemon.protocol.unsupported`, the offered versions `[1, 0]`, and the connection closes.
5. Send `v: -1`; assert the same refusal.
6. Assert no state mutation, append, or query occurs for any refused version or insufficient v0 frame.

**Expected Outcome**:
- Version `1` and floor `0` are served; v1 frames carry `callerPrincipal`, v0 frames omit the additive reserved fields and are accepted only where sufficient; anything else is refused with the offered set before any action.

#### TC-WIRE-003 - Subscription overflow degrades only the subscriber (SC-M1-20)

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, F-6, AC-F4-3, DM-7, DM-14, EVT-9, NFR-6
**Test Type(s)**: Integration, Concurrency
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/control-session.test.ts`; `tests/fixtures/daemon/wire/overflow/**`
**Tags**: @backend, @protocol, @subscribe, @overflow

**Preconditions**:
- A running daemon over an in-memory pair; `daemon.subscription-buffer` set to a small deterministic value (for example 4).
- One slow subscriber on topic `lanes` that stops reading, one fast subscriber, and one independent query connection.
- A burst of lane events larger than the buffer.

**Steps**:
1. Subscribe both subscribers to `lanes`; assert each receives a bounded initial snapshot and an accepted response.
2. Emit the burst; assert the slow subscriber's buffer fills and it receives exactly one `event` of type `degraded` carrying `subscriber-overflow` before being dropped.
3. Assert only that subscription is dropped; the fast subscriber continues receiving events and the query connection continues to be served.
4. Assert the dispatcher loop processes the independent query while the slow subscriber is stalled.
5. Assert no unbounded memory growth and no duplicate degraded event.
6. Release the slow subscriber; assert it can re-subscribe and poll state.

**Expected Outcome**:
- Overflow is contained to one subscription with one degraded event; other connections and the dispatcher continue unaffected.

#### TC-WIRE-004 - Dispatcher latency stays bounded under 100 slow subscribers

**Scenario Type**: Performance
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, F-6, AC-F4-3, NFR-6, RSK-4
**Test Type(s)**: Performance, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/control-session.test.ts`; `tests/checks/daemon-bounds.test.ts`
**Tags**: @backend, @protocol, @perf

**Preconditions**:
- 100 slow subscribers with full buffers; one probe connection issuing a `query` every fixed injected tick.
- Warm-up, recorded baseline, and a deterministic event-feed loop (no real sleeps).

**Steps**:
1. Establish the 100 subscriptions and fill their buffers.
2. Emit the burst and measure dispatcher loop latency over the probe requests.
3. Assert p99 ≤ 50 ms on the reference CI class with the recorded baseline; a slower local run records the measurement without weakening the structural assertions.
4. Assert every overflowing subscriber received one `degraded` event and was dropped.
5. Assert every probe request completed within `daemon.response-timeout`.
6. Assert the structural bound: one buffer per subscription, no unbounded queue, no blocking write to a slow peer.

**Expected Outcome**:
- Subscriber count cannot stall dispatch; the structural properties hold everywhere and the latency bound is measured against a recorded baseline.

#### TC-WIRE-005 - No business truth on the wire; a lost frame changes nothing

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-4, DM-6, EVT-8, NFR-2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/control-session.test.ts`; `tests/fixtures/daemon/wire/truth/**`
**Tags**: @backend, @protocol, @truth

**Preconditions**:
- A seeded state with a queue, lanes, parks, and a pending preemption.
- A frame recorder and a state-fold oracle.

**Steps**:
1. Exercise every query/subscribe/poke frame; for each value, recompute it from state and assert equality.
2. Assert every mutating frame is one of `drain`, `stop`, or `takeover`, and each is also expressible through a signal or state record.
3. Drop each response, event, and poke in turn; assert the next state read reproduces the same world and no durable outcome changes.
4. Assert no frame carries a business fact that is absent from state.
5. Assert a duplicate poke applies the same intent once.

**Expected Outcome**:
- Frames are projections or at-most-once control actions; losing any frame leaves the system correct.

#### TC-WIRE-006 - No credential/secret/prompt/body transits; the lock token is exempt but non-credential

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-4, NFR-12, RSK-11
**Test Type(s)**: Checks, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/daemon-hermetic.test.ts`, `tests/checks/secret-read-boundary.test.ts`; `tests/fixtures/daemon/wire/secrets/**`
**Tags**: @checks, @protocol, @privacy

**Preconditions**:
- Synthetic, clearly non-secret canaries, each with an explicit class label: a credential value, a credential token, a prompt, a message body, a transcript excerpt, a diff hunk, a raw provider payload, and an absolute repository root.
- A synthetic daemon lock token that is an ownership capability, not a credential: it matches the declared ownership-token shape (opaque, bounded, no vendor prefix, no credential-looking pattern) and is deliberately **not** one of the credential canaries.
- Every frame type and every record/status/golden payload surface.

**Steps**:
1. Encode every frame and payload with the credential, secret, prompt, body, transcript, diff, provider-payload, and absolute-root canaries injected into hostile inputs; assert none appears in serialized output anywhere.
2. Lock-token scope: assert the daemon lock token appears only in the `drain`, `stop`, and `takeover` request payloads and in durable lock/instance records, and is absent from every other frame type, response, event, status payload, golden, log line, telemetry event, and from every `daemon start`, `daemon stop`, and `daemon status` command envelope and golden.
3. Lock-token shape: assert the lock token carries no credential-shaped value — it satisfies the declared ownership-token shape and is rejected by the credential-canary classifier; assert a credential-shaped value placed in the lock-token field fails this test.
4. Assert credential facts are variable names only and never values.
5. Assert no golden, log line, status payload, or reconciliation report contains an absolute path or any canary.
6. Assert the secret-read allowlist gained zero entries.

**Expected Outcome**:
- The oracle is unambiguous: every credential/secret/prompt/body/transcript/diff/provider/root canary fails if it transits, while the daemon lock token is the sole permitted ownership capability, restricted to the three control payloads and durable lock/instance records, provably not credential-shaped, and absent from every `daemon start`/`daemon stop`/`daemon status` envelope and golden.

#### TC-WIRE-007 - `callerPrincipal` is present, reserved, and never authorization

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-5, DM-8, EVT-8, NFR-8, NFR-14, DEC-8
**Test Type(s)**: Structure, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/daemon-contract.test.ts`, `tests/behaviour/control-codec.test.ts`; `tests/fixtures/daemon/wire/principal/**`
**Tags**: @structure, @protocol, @principal

**Preconditions**:
- Every request/response/event/error fixture; every intent record kind.
- A source scan for authorization reads.

**Steps**:
1. Assert every `v: 1` frame carries `callerPrincipal` in the shape `{ kind: "local-same-user", id: string | null }`; assert a `v: 0` frame omits it.
2. Assert an intent record produced by this change carries the same optional shape; a record without it remains readable.
3. Assert no code path branches on `callerPrincipal` for access, filtering, or mutation authority.
4. Assert an arbitrary `id` value changes no outcome and grants nothing.
5. Assert the field is additive: no schema identifier or version changes.

**Expected Outcome**:
- The principal is a reserved, unauthenticated label; it retrofits without a schema break and authorizes nothing.

#### TC-WIRE-008 - Control drain/stop/takeover is token-guarded and state-expressible

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-4, AC-F4-1, AC-F1-1, EVT-8, NFR-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/control-session.test.ts`, `tests/behaviour/daemon-lifecycle.test.ts`; `tests/fixtures/daemon/wire/control/**`
**Tags**: @backend, @protocol, @control

**Preconditions**:
- A live daemon with the current lock token; a wrong token and an absent token.
- Case A: reachable socket. Case B: socket unavailable.

**Steps**:
1. Send `drain` with the current token; assert `{ draining: true, lanes }`, no new spawn decisions, and no lane signal.
2. Send `stop` with mode `drain` and `immediate`; assert the documented outcomes and that `immediate` signals no lane.
3. Send `takeover` with the token and stale evidence; assert it succeeds only when stale (TC-LOCK-002) and refuses when live.
4. Send each frame with a wrong/absent token; assert a classified refusal and no action.
5. For B, express the same intent through the state/signal path; assert the outcome matches and the daemon appends its own release.
6. Assert each mutation is at-most-once for one (connection identity, `id`, lock token) key, and that a cross-connection `id` collision is evaluated as a distinct request (TC-CONC-005); assert no control frame carries an idempotency key.

**Expected Outcome**:
- Every control action is token-guarded and has a non-socket expression; losing the socket never removes control.

#### TC-TRANSPORT-001 - stdio conformance is identical and transport-agnostic (AC-F4-2)

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, F-5, AC-F4-2, EVT-8, NFR-5, RSK-5
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/control-conformance.test.ts`; `tests/fixtures/daemon/transport/stdio/**`
**Tags**: @conformance, @protocol, @transport

**Preconditions**:
- One in-process daemon composition; two transports: an in-memory stdio pair and an in-memory unix-like pair.
- A shared conformance corpus covering request, response, event, error, poke, query, subscribe, drain, stop, and takeover.

**Steps**:
1. Run the corpus over stdio; record the normalized frames and session outcomes.
2. Run the same corpus over the unix-like pair; assert byte-identical frames and identical outcomes.
3. Assert the same session logic (correlation, subscriptions, buffers, timeouts, version negotiation) runs in both.
4. Assert no codec or session module reads a transport kind, socket path, or `process.stdin`/`stdout`.
5. Assert a transport failure over stdio degrades exactly as over unix.

**Expected Outcome**:
- Transport independence is proven: the same frames and logic produce identical behaviour, and no codec/session branch on transport identity.

#### TC-TRANSPORT-002 - Unix default binds 0700 dir, 0600 socket, same-user policy

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1, DM-6, NFR-14
**Test Type(s)**: Integration, Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/control-transport.test.ts`; `tests/fixtures/daemon/transport/unix/**`
**Tags**: @backend, @transport, @security

**Preconditions**:
- A temporary state directory created by the injected filesystem seam; a recorded mode matrix.
- A policy seam that takes a caller identity fact and returns allow/refuse.

**Steps**:
1. Start with default configuration; assert `daemon.transport` resolves to `unix` and the socket resolves inside the state directory.
2. Assert the state directory mode is 0700 and the socket file mode is 0600.
3. Assert a same-user caller is accepted; assert a different-user caller is refused with the delivered `state.permission.denied` at exit 1, naming the socket path and the same-user requirement, and that no request frame is served.
4. Assert the socket is removed on clean stop and a stale socket file is not reported reachable.
5. Assert the real socket path may appear in local `daemon start`/`daemon status` envelopes, but a deterministic golden renders it only as the normalized `<state-dir>/daemon.sock` placeholder; assert it is never persisted to a state record, log line, or telemetry event.

**Expected Outcome**:
- The unix default is same-user, permission-scoped, and honest: cross-user access is `state.permission.denied` at exit 1, and the socket path stays local to start/status output and the normalized golden placeholder.

#### TC-TRANSPORT-003 - Socket path outside the state directory is refused

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1, NFR-10
**Test Type(s)**: Behaviour, Config
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/control-transport.test.ts`, `tests/behaviour/config-schema.test.ts`; `tests/fixtures/daemon/transport/path/**`
**Tags**: @backend, @transport, @config, @negative

**Preconditions**:
- Cases: a relative path inside the directory, an absolute path inside, an absolute path outside, a path traversing `..` outside, and a non-string value.
- Injected configuration and filesystem seam.

**Steps**:
1. For each inside path, assert it resolves and starts.
2. For each outside/traversal path, assert `config.value.invalid` naming `daemon.socket-path` at exit 1, and no socket is opened.
3. Assert no silent fallback to the default path.
4. Assert the state directory is not created or mutated for a refused configuration.
5. Re-run with a corrected path; assert success.

**Expected Outcome**:
- A socket path can never escape the state directory; refusal names the key and writes nothing.

#### TC-TRANSPORT-004 - Declared-not-delivered transports are refused, not fallback

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1, NFR-10, NFR-14
**Test Type(s)**: Behaviour, Config
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/control-transport.test.ts`; `tests/fixtures/daemon/transport/declared/**`
**Tags**: @backend, @transport, @config, @negative

**Preconditions**:
- `daemon.transport` values: `unix`, `stdio`, `tcp`, `tls`, `ssh`, `container-pipe`, and an unknown value.

**Steps**:
1. Assert `unix` and `stdio` start.
2. For each declared-not-delivered and unknown value, assert `config.value.invalid` naming `daemon.transport` and the implemented set `{unix, stdio}`.
3. Assert no silent fallback to unix and no listener is opened.
4. Assert the error is reachable through the delivered configuration identity and projection.
5. Assert the attempt leaves no instance or heartbeat record.

**Expected Outcome**:
- Declared-but-undelivered transports fail closed with the implemented set named; no hidden fallback exists.

#### TC-TRANSPORT-005 - Unopenable transport starts in declared degraded mode

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1, DM-14, NFR-5, C-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/control-transport.test.ts`; `tests/fixtures/daemon/transport/unopenable/**`
**Tags**: @backend, @transport, @degraded

**Preconditions**:
- A transport factory that fails to open (permission denied, path in use, or simulated refusal).
- A valid lock and a readable state store.

**Steps**:
1. Run `daemon start`; assert exit 0, the instance and reconciliation records are durable, and `degraded` contains `daemon-socket-unreachable`.
2. Assert `socket.reachable: false` and the state-mediated path continues (heartbeat advances, queries via state work).
3. Assert the daemon never reports the socket reachable.
4. Assert a later `status --live` fails at exit 2 with `daemon.socket-unreachable`, while plain status reports the degradation at exit 0.
5. Assert the daemon can retry the transport open after start without re-running reconciliation.

**Expected Outcome**:
- A transport failure degrades the daemon truthfully; it does not fail the start or claim a socket it does not have.

#### TC-CONC-001 - Concurrent `status --live` connections never cross-talk (SC-M1-18)

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-1, DM-6, DM-7, EVT-8, NFR-5
**Test Type(s)**: Concurrency, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/control-connection.test.ts`; `tests/fixtures/daemon/wire/concurrency/**`
**Tags**: @backend, @protocol, @concurrency

**Preconditions**:
- A running daemon; two in-memory stdio connections with distinct connection ids and distinct request ids.
- Both issue `status --live` at a declared concurrent interleaving.

**Steps**:
1. Replay both connections concurrently with a barrier at request dispatch.
2. Assert each response arrives on the connection that asked and carries the matching `id`.
3. Assert no frame from connection A appears on connection B in either direction.
4. Assert both exit 0 with `live` facts and no cross-connection state.
5. Repeat with 20 connections and interleaved pokes/subscribes; assert the same isolation.

**Expected Outcome**:
- Responses are correlated within one connection only; zero cross-connection leakage.

#### TC-CONC-002 - Same-key state-path intent applies at most once, daemon down and daemon up

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-6, AC-F6-2, DM-10, DM-17, NFR-2, NFR-15
**Test Type(s)**: Concurrency, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-state-mediation.test.ts`; `tests/fixtures/daemon/state/idempotency/**`
**Tags**: @backend, @state, @idempotence

**Preconditions**:
- A temporary state store, a single-writer fence harness with a declared acquire/release order, and a recording append log.
- Case A: no daemon process, socket, or background task. Case B: a running daemon over an in-memory transport pair.
- Two concurrent CLI invocations writing the same intent (for example `blockers answer q-8f21 --choice 2`) under one idempotency key — the immutable store-scoped record identity for the delivered blocker kind (DM-17) — with identical payload.
- A recording external-effect adapter. No business mutation is expressed as a wire frame at any point.

**Steps**:
1. Release both invocations at one barrier; assert the append runs under the state fence and exactly one intent record exists for that key.
2. Assert the duplicate returns the prior outcome (the delivered replay shape, `noop`/`already-applied` where the surface declares a receipt) and appends no second intent record.
3. Assert the operation log shows exactly one effective append for the key and zero loss: the final projection contains the intended answer exactly once.
4. For an `outbox.effect` intent under one `idempotencyKey`, assert a replay may append only its `already-applied` receipt and never a second effect.
5. Repeat in Case B (daemon up): assert the same-key replay still appends nothing new and the daemon applies the intent at most once after a wake or reconcile.
6. Assert no `queue add` (or any business mutation) was sent as a control frame and no `intent` wire class appears in the fixture corpus.

**Expected Outcome**:
- At-most-once application is a state-path property: one idempotency key yields one effective intent with zero loss, with or without a daemon, and no business mutation is relayed as a wire frame.

#### TC-CONC-003 - Different-key intents serialize through the state fence, daemon down and daemon up

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-6, AC-F6-2, DM-17, NFR-2, NFR-15
**Test Type(s)**: Concurrency, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-state-mediation.test.ts`; `tests/fixtures/daemon/state/serialize/**`
**Tags**: @backend, @state, @concurrency

**Preconditions**:
- Two (and then 20) concurrent CLI invocations with distinct keys and distinct targets, each writing a state intent.
- A deterministic single-writer fence harness with a declared drain order; daemon-down (Case A) and daemon-up (Case B) cases.

**Steps**:
1. Release all invocations; assert they serialize through the state fence in one declared order, with one fence acquire/release around each append.
2. Assert every intent lands exactly once, the final ledger contains all targets, and no interleaved half-append or torn record exists.
3. Assert the fence is never held across an external effect (no effect-adapter call inside a fence window).
4. Assert a later reconcile applies every intent exactly once with `duplicates: 0`, following the declared order per target.
5. Repeat with one failing append; assert it fails classified and neither blocks, drops, nor duplicates the others.
6. Repeat in Case B; assert the daemon observes the same ordered ledger and adds no second application.

**Expected Outcome**:
- Different-key intents serialize under the single-writer fence with zero loss and at-most-once application in both daemon states.

#### TC-CONC-004 - Response timeout degrades to the state path, never blocks

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-2, NFR-5, C-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-degradation.test.ts`, `tests/behaviour/control-connection.test.ts`; `tests/fixtures/daemon/wire/timeout/**`
**Tags**: @backend, @protocol, @timeout

**Preconditions**:
- `daemon.response-timeout` fixed (for example 2 000 ms); an injected clock and a transport that never answers one request.
- A command with a state-only fallback.

**Steps**:
1. Send a request and hold the response; advance the injected clock to the timeout.
2. Assert the CLI abandons the socket, performs one local state read, and returns within timeout plus one read.
3. Assert the result is the state-path result with `degraded: ["daemon-unreachable"]` where the surface declares it.
4. Assert no unbounded wait, no retry loop, and no duplicate mutation.
5. Assert a later reachable socket removes the marker (TC-DEGRADE-002).

**Expected Outcome**:
- A timeout is a bounded degradation, never an agent-blocking wait.

#### TC-CONC-005 - Control dedupe is per (connection, `id`, lock token): same-connection replay applies once; a cross-connection `id` collision is a distinct request

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, F-6, AC-F6-2, DM-6, EVT-8, NFR-15, DEC-14
**Test Type(s)**: Concurrency, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/control-connection.test.ts`, `tests/behaviour/control-session.test.ts`; `tests/fixtures/daemon/wire/control-idempotency/**`
**Tags**: @backend, @protocol, @control, @idempotence

**Preconditions**:
- A running daemon with the current lock token and two independent connections, each with its own connection identity.
- A recording lifecycle/control port, a control-application log keyed by (connection identity, `id`, lock token), and an append log.

**Steps**:
1. **Same-connection replay**: send the same `drain` frame twice with one `id` and a valid `lockToken` on one connection; assert exactly one drain action, a response for each request, and a duplicate acknowledgement that reports the already-applied state with no second action.
2. Repeat the same-connection replay for `stop` (mode `drain` and `immediate`) and for `takeover` against a stale lock; assert each (connection, `id`, token) key yields at most one control action and at most one lock/instance transition.
3. **Cross-connection `id` collision**: open a second connection and send a `drain` frame that reuses the first connection's `id`, `type`, and payload with the valid token. Assert the second frame is a distinct new request: it is evaluated with the second connection's identity, is never answered with the first request's already-applied acknowledgement or deduplicated away, and any state-derived response is produced from its own evaluation.
4. Repeat the cross-connection collision for `stop` and `takeover`; assert the second connection's request reaches the control handler and cannot be suppressed by the first connection's dedupe entry.
5. Assert the dedupe key is the triple (connection identity, `id`, lock token), not `id` plus the token alone: the same `id` on two connections produces two distinct keys.
6. Assert no control frame writes an intent record or a business fact: control frames carry no idempotency key (DM-6).
7. Assert a replay with the same `id` but a different `type` or payload on the same connection is refused, never silently applied.
8. Assert a duplicate carrying an absent or wrong lock token is refused with a classified error and performs no action.
9. **Negative control**: key the dedupe on `id` plus the lock token only (global). Assert this scenario fails because the second connection's genuinely new request is falsely answered as already applied. Restore the triple key and re-run green.
10. Assert the state/signal expression of the same control action is also applied at most once.

**Expected Outcome**:
- Same-connection replay is at most once per (connection identity, `id`, lock token); a cross-connection `id` collision is a distinct new request and is never answered as already applied. The two outcomes are asserted separately and the global-key mutation fails the test.

#### TC-HEART-001 - Heartbeat carries ordinal, depth, lanes, spawn, and cursor

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-1, DM-2, EVT-2, NFR-1
**Test Type(s)**: Behaviour, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-heartbeat.test.ts`; `tests/fixtures/daemon/heartbeat/content/**`
**Tags**: @backend, @daemon, @heartbeat

**Preconditions**:
- A running daemon with two delivering lanes, one parked lane, a current spawn identity, and an event cursor.
- Injected clock advanced by `daemon.heartbeat-interval` across beats.

**Steps**:
1. Advance one interval; assert one `daemon.heartbeat` record with `instanceId`, `ordinal: 1`, `beatAt`, `uptimeMs`, `queueDepth`, `laneCounts` (`delivering`, `idle`, `parked`, `failed`), `currentSpawn` (`ref`, `sessionId`) when present, and `cursor`.
2. Advance again; assert `ordinal: 2` strictly increasing and a later `beatAt`.
3. Assert no beat is written before the interval or twice for one interval.
4. Assert a reader never synthesizes a beat when none exists; the latest record wins and a gap is stale evidence.

**Expected Outcome**:
- The heartbeat is a durable, monotone, state-derived liveness record with the full declared field set.

#### TC-HEART-002 - Stop records the release reason; no reader fabricates a beat

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-1, DM-1, DM-2, EVT-1, EVT-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-heartbeat.test.ts`; `tests/fixtures/daemon/heartbeat/stop/**`
**Tags**: @backend, @daemon, @heartbeat, @stop

**Preconditions**:
- A running daemon with several beats; then a clean stop and an unclean kill.
- Injected clock; no process introspection.

**Steps**:
1. Run `daemon stop`; assert the instance record operation `released` carries a release reason and status reports `stopped` with the last beat age.
2. Assert no heartbeat is appended after release.
3. For the unclean case, assert no release record exists, the last beat remains, and status reports `stale` at/beyond the bound.
4. Assert a reader does not fabricate a beat, a zero age, or a running state.
5. Assert the heartbeat record carries no prompt, body, transcript, diff, credential, or absolute root.

**Expected Outcome**:
- Stop evidence and unclean evidence are both durable and truthful; no reader invents liveness.

#### TC-RECON-001 - Reconciliation classifies alive, interrupted, and crashed (SC-M1-16)

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-1, DM-3, DM-4, EVT-3, EVT-4, NFR-4
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-reconciliation.test.ts`; `tests/fixtures/daemon/reconciliation/classes/**`
**Tags**: @backend, @daemon, @reconciliation

**Preconditions**:
- An instance record saying the previous process did not release; three delivering lanes:
  - L1: recorded process observable and session observable.
  - L2: process and session gone, no failure record.
  - L3: a recorded failure (for example harness spawn failure) with a reason.
- Injected process supervisor and harness session port; a ledger with known completed phases.

**Steps**:
1. Run `daemon start`; assert L1 classifies `alive` and its action is reattach/observe with no restart increment.
2. Assert L2 classifies `interrupted` and its action is resume from the ledger.
3. Assert L3 classifies `crashed`, naming the recorded reason, and resumes per budget.
4. Assert one `daemon.reconciliation` record names each lane's classification, action, and restarts, with `duplicates: 0`.
5. Assert every lane is either classified or held with `evidence-insufficient`; none is silently omitted.
6. Assert zero duplicated ticket/comment/commit identities (detailed in TC-RECON-007/008).

**Expected Outcome**:
- Every in-flight lane is classified exactly once from artifact evidence, and the report is complete and truthful.

#### TC-RECON-002 - Insufficient evidence holds the lane instead of guessing

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-1, DM-3, DM-4, EVT-3, EVT-4, DEC-9
**Test Type(s)**: Behaviour, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-reconciliation.test.ts`; `tests/fixtures/daemon/reconciliation/insufficient/**`
**Tags**: @backend, @daemon, @reconciliation, @negative

**Preconditions**:
- Cases: process observation unavailable, session observation unavailable, ledger position missing, failure-record read unreadable, and a lane with no recorded process/session at all.
- A control case with complete evidence.

**Steps**:
1. For each missing source, assert the lane is reported with `evidence-insufficient` and held for the next pass.
2. Assert it is not classified `alive`, `interrupted`, or `crashed` and no restart is consumed.
3. Assert no resume, spawn, or kill is attempted.
4. Assert the reconciliation record names the missing evidence source.
5. Run a second pass with the missing source restored; assert classification then succeeds.
6. Assert the control lane classifies normally.

**Expected Outcome**:
- Ambiguity is an explicit held state, never a guessed class or a silent resume.

#### TC-RECON-003 - Interrupted lane resumes at phase 8 and increments once

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-2, DM-3, DM-4, EVT-3, EVT-4, NFR-4, SC-M1-16
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-reconciliation.test.ts`; `tests/fixtures/daemon/reconciliation/resume/**`
**Tags**: @backend, @daemon, @reconciliation, @resume

**Preconditions**:
- L2 classified `interrupted`; its ledger's last completed phase is 7; a delivered restart-budget gate at 1/3.
- A recording lane-executor that records the requested resume position and every phase execution.
- A delivery plan with phases 1–11.

**Steps**:
1. Reconcile; assert the resume starts at phase 8 and phases 1–7 are not executed.
2. Assert exactly one restart is consumed through the delivered gate and the counter reads 2/3.
3. Assert one `daemon.lane` update records the new ledger position and classification.
4. Assert the resume is idempotent: re-running from phase 8 skips completed phases again.
5. Assert an `alive` lane in the same pass reattaches with an unchanged counter (AC-F8-2 second clause).
6. Assert no completed phase is re-executed in any path.

**Expected Outcome**:
- Resume is exactly from the ledger position, completed phases are skipped, and the counter increments once per interruption.

#### TC-RECON-004 - Replayed reconciliation increments nothing and appends no second report

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-2, DM-4, EVT-4, NFR-4
**Test Type(s)**: Behaviour, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-reconciliation.test.ts`; `tests/fixtures/daemon/reconciliation/replay/**`
**Tags**: @backend, @daemon, @reconciliation, @idempotence

**Preconditions**:
- A completed reconciliation for instance `inst-a` with one interrupted lane at 2/3.
- A recording store.

**Steps**:
1. Replay the identical classification for the same instance; assert no second restart increment and no duplicate decision.
2. Assert no second `daemon.reconciliation` record is appended for `inst-a`.
3. Assert the report is immutable: a re-read returns the original bytes.
4. Re-run `daemon start` as `inst-b` after a clean stop; assert a new report is appended once and counters reflect the real state.
5. Assert no completed phase is re-executed on either replay.

**Expected Outcome**:
- Reconciliation is idempotent on replay: one report per instance, one increment per interruption.

#### TC-RECON-005 - Budget exhaustion is terminal with the delivered exhaustion record (SC-M1-15)

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-3, DM-3, DM-4, EVT-3, EVT-4, NFR-4, NFR-15
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-reconciliation.test.ts`; `tests/fixtures/daemon/reconciliation/budget/**`
**Tags**: @backend, @daemon, @reconciliation, @budget

**Preconditions**:
- GH-315 at restart 3/3; the next spawn fails again with a recorded failure.
- Injected economics with the delivered `economics.budget-exhaustion` shape and restart history; a recording queue/blocker port.

**Steps**:
1. Reconcile; assert the lane projection becomes terminal `failed` with a classified reason.
2. Assert the queue entry is held terminal with `restart-budget-exhausted` and is not requeued.
3. Assert the delivered `economics.budget-exhaustion` record is present with the restart history.
4. Assert no fourth spawn occurs; the executor's spawn count stays 3.
5. Assert the reconciliation report names the terminal decision and the question identity.
6. Restart; assert the terminal state and question remain and no new spawn is attempted.

**Expected Outcome**:
- Exhaustion is terminal, loud, and durable; no fourth spawn and no silent requeue.

#### TC-RECON-006 - Exhaustion raises a typed question within one cycle and never requeues (SC-M1-15)

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-3, DM-4, EVT-4, NFR-4, SC-M1-15
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-reconciliation.test.ts`, `tests/behaviour/blockers-publish.test.ts`; `tests/fixtures/daemon/reconciliation/question/**`
**Tags**: @backend, @daemon, @blockers, @budget

**Preconditions**:
- Exhaustion from TC-RECON-005; injected clock at the start of a `daemon.heartbeat-cycle` of 60 000 ms.
- A recording blocker channel and digest projection.

**Steps**:
1. Advance the clock by one `daemon.heartbeat-cycle`; assert exactly one typed exhaustion question exists with the delivered options (requeue with fresh budget, park for owner review).
2. Assert the question is surfaced within the cycle, not later, and carries the failure reason and restart history.
3. Assert the question appears in the reconciliation report's `questions[]` and in the digest/blockers list.
4. Assert the queue entry remains terminal and no requeue occurs even after a further cycle.
5. Assert a duplicate reconciliation does not publish a second question.

**Expected Outcome**:
- Exhaustion escalates with the delivered options within one collection cycle and never silently requeues.

#### TC-RECON-007 - Kill/restart duplicates zero commits; the owner restores the binding from the redrive request

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, F-9, F-10, AC-F8-4, AC-F9-1, AC-F10-2, DM-3, DM-9, DM-10, DM-11, DM-18, EVT-3, EVT-6, EVT-7, NFR-4, NFR-15, TDR-0014 INV-7/INV-8, DEC-19
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-reconciliation-crash.test.ts`, `tests/behaviour/commit-act.test.ts`; `tests/fixtures/daemon/effects/commit-crash/**`
**Tags**: @backend, @daemon, @crash, @commit

**Preconditions**:
- A delivering lane whose commit-effect wrapper appends exactly one durable `outbox.effect` intent carrying `baselineHead`, the change ref, the phase, and the sorted normalized staged path set (no message, subject, body, or fingerprint), then invokes the delivered atomic record-plus-commit primitive unchanged.
- The kill window under test: the commit object has landed, but the transition record and telemetry have not. The phase ledger therefore holds no commit binding, and a naive re-run would land a `record-only` completion or a second commit.
- An injected bounded `logSince(baselineHead)` read returning each commit's SHA and normalized changed-path set; the fixture returns the landed orphan whose set equals the recorded set.
- A recording commit counter, a recording transition appender, and an injected lane/one-shot owner harness that can re-run phase completion with the redrive request's discovered SHA. No injected adapter is declared to "provide SHA idempotency": the only route to `applied` is the bounded read plus the path-set match.

**Steps**:
1. Kill the daemon after the commit object lands but before the transition record and telemetry; assert the `outbox.effect` intent is durable, the effect is `in-flight` (no terminal receipt, no `applied`), and no phase binding exists.
2. Restart; assert daemon reconciliation detects the unresolved commit effect, performs exactly one bounded `logSince(baselineHead)` read with the recorded baseline, matches exactly one new commit whose normalized changed-path set equals the recorded set, and records one durable DM-18 redrive request carrying the baseline, verdict `found`, and the discovered SHA. Assert the daemon created no commit, ran no phase, and appended no transition; assert the redrive record is evidence only and did not transition the outbox.
3. Run the owning lane/one-shot process; assert it restores the phase binding by re-running phase completion with the discovered SHA as commit evidence. The delivered convergence classifies `commit-without-record` with that SHA, appends the transition carrying it with durable intent `atomic`, and the phase reads `both`, never `record-only`. Assert the terminal receipt is `already-applied` with the discovered SHA, the effect is `applied`, and the owner created no commit and appended no second effect.
4. Assert the commit counter stays 1, no second commit object is created, and no branch ref is written twice.
5. **Owner-restoration negative control**: skip the owner's restore step (or withhold the discovered SHA as commit evidence); assert the phase does not adopt the orphan SHA. The atomic completion writes the pm-notes transition before the commit act and lands a fresh transition commit (GH-242 staging scope), so the required `both` binding for the orphan commit fails. Restore the step and re-run green.
6. **Mechanism negative controls, each must fail this test**: (a) break the path-set derivation by recording one path fewer; (b) remove the `logSince` query; (c) break the match rule by accepting a path-set mismatch. In each case assert no `applied` receipt and no transition binding appear from the broken mechanism. Restore each and re-run green.
7. **Ambiguity control**: with `logSince` returning zero commits, multiple commits, a path-set mismatch, or an unreadable/over-cap read, assert the redrive request carries `unknown` with no SHA, the owner does not auto-apply, the effect stays `unknown`, no second commit exists, and the phase is not silently forced to `record-only` (the binding remains recoverable by an explicit owner decision).
8. **Daemon-boundary control**: attempt the restore through the daemon composition; assert the recording commit/phase/transition ports stay at zero and the structural proof in TC-LANE-002 fails the composition. The daemon only records the redrive request.
9. Assert the delivered commit format, message composition, and atomic record-plus-commit primitive are unchanged (no new trailer, no altered message, no forced template).

**Expected Outcome**:
- Commit crash safety is a real two-process mechanism, not fixture fiat: the durable pre-commit intent plus one bounded path-set read detect the landed commit; the daemon records the redrive request and nothing else; the lane/one-shot owner restores the binding through `commit-without-record`, so the phase reads `both` and no commit is duplicated or silently lost. Breaking the derivation, the query, the match rule, or the owner's restore fails the test, and every ambiguous read resolves `unknown` with no automatic re-apply and no guessed SHA.

#### TC-RECON-008 - Kill/restart duplicates zero tickets/comments (receipt half)

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, F-10, AC-F8-4, AC-F10-1, DM-9, DM-10, DM-11, EVT-6, EVT-7, NFR-4, NFR-15
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-reconciliation-crash.test.ts`, `tests/behaviour/daemon-effects.test.ts`; `tests/fixtures/daemon/effects/crash/**`
**Tags**: @backend, @daemon, @crash, @effects

**Preconditions**:
- Injected tracker-transition and tracker-comment effect adapters that record every applied effect by stable identity.
- A kill after the effect applied but before the receipt; then a restart.

**Steps**:
1. Kill after the adapter applies a transition/comment but before its receipt lands.
2. Restart; assert the effect is classified `unknown` and one bounded query by stable identity runs.
3. When the query finds the effect, assert `already-applied` is recorded and no second effect is applied.
4. When the query finds nothing, assert exactly one re-apply and a new receipt (TC-EFFECT-003).
5. Assert every applied effect identity is unique and zero duplicates appear.
6. Assert no blind retry occurred when the query was unreadable (TC-EFFECT-004).

**Expected Outcome**:
- Tracker transitions and comments converge through receipts, first-class `unknown`, and check-before-reapply; zero duplicates.

#### TC-RECON-009 - Unreadable state refuses the start with `state-recovery-failed`

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-1, NFR-13, DM-4, Appendix H
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-reconciliation.test.ts`; `tests/fixtures/daemon/reconciliation/unreadable/**`
**Tags**: @backend, @daemon, @reconciliation, @fail-closed

**Preconditions**:
- Cases: torn ledger tail, unreadable queue key, unknown record kind, permission-denied state file.
- A control readable store.

**Steps**:
1. Run `daemon start`; assert exit 2 with `daemon.state-recovery-failed` (or the delivered `state.*` identity) and bounded evidence.
2. Assert the daemon does not start half-reconciled: no heartbeat, no socket opened, no reconciliation report claiming success.
3. Assert one-shot guidance is included in the remediation hint.
4. Assert no append repairs or guesses the state.
5. Run a one-shot command; assert it remains usable and reports the state identity, not an all-clear.
6. For the control store, assert start succeeds.

**Expected Outcome**:
- Unreadable state refuses the daemon and leaves one-shots available; no half-start and no fabricated truth.

#### TC-LANE-001 - Supervision claims, spawns, records, observes, and releases

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, AC-F9-1, DM-3, DM-16, EVT-3, NFR-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-lane-supervision.test.ts`; `tests/fixtures/daemon/lanes/cycle/**`
**Tags**: @backend, @daemon, @lanes

**Preconditions**:
- One ready queue entry on repo-alpha; a composed lane-executor over an injected `HarnessSessionPort`; the delivered scheduling engine.
- A recording lease port, executor, and harness session.

**Steps**:
1. Run one supervision cycle; assert a lease is claimed through the delivered fenced claim path.
2. Assert the executor is called once to spawn with the expected ref/descriptor; the harness `spawn` is invoked once.
3. Assert one `daemon.lane` record carries ref, `delivering`, harness kind, session id, process id, ledger position, and spawn ordinal.
4. Assert the session is observed (collect/liveness) and on termination the lease is released or parked.
5. Assert the daemon process executes no phase, reads no repository code, writes no commit, and evaluates no gate.
6. Assert a second cycle does not spawn a second lane for the same single-flight lease.

**Expected Outcome**:
- The daemon supervises through the injected seam and records execution state; it is never a lane.

#### TC-LANE-002 - The daemon performs no delivery work in-process

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, F-10, AC-F9-1, AC-F8-4, DM-18, EVT-6, NFR-17, RSK-12, TDR-0014 INV-7, DEC-19
**Test Type(s)**: Structure, Checks, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/daemon-imports.test.ts`, `tests/checks/daemon-hermetic.test.ts`, `tests/behaviour/daemon-effects.test.ts`; `.dependency-cruiser.cjs`
**Tags**: @structure, @daemon, @boundaries, @effects

**Preconditions**:
- The daemon composition module graph and the delivered boundaries.
- A recording commit port, phase runner, transition appender, and effect-apply port reachable from the composition.
- An in-flight commit effect left by a killed owning process, and the lane/one-shot owner harness.

**Steps**:
1. Assert the daemon surface imports or constructs no phase executor, commit writer, gate evaluator, prompt builder, dispatch loop, or phase-transition appender.
2. Assert no daemon module reads repository files, runs a subprocess for delivery, or writes a commit.
3. Assert the effect owner is the lane/one-shot process: with the killed-effect fixture, a daemon reconciliation pass records exactly one DM-18 redrive request (baseline, verdict, discovered SHA or `unknown`, time) and makes zero commit calls, zero phase runs, zero transition appends, and zero effect applies; the redrive request never transitions the outbox.
4. Run the owner harness; assert it performs the apply/restore path and the phase converges through `commit-without-record` to `both` (TC-RECON-007). Assert the daemon still made zero of the owner-only calls.
5. Assert the only spawn path is the injected lane-executor over `HarnessSessionPort`.
6. Assert the dependency-boundary rule is present and has a negative fixture for each daemon path family — `^packages/core/src/(app|domain)/daemon`, `^packages/cli/src/daemon`, and `^packages/adapters/src/daemon/` — that fails when the forbidden edge is added.
7. Assert the daemon can run with a throwing executor and still reconcile/serve status (supervise-only).

**Expected Outcome**:
- Structural and runtime proof that the daemon supervises, never becomes a lane, and never owns a commit effect: it detects, queries once, and records a durable redrive request, while the lane/one-shot owner applies and restores the binding.

#### TC-LANE-003 - Missing executor runs `supervise-only` and declares it

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, AC-F9-1, DM-14, DM-16, C-1, DEC-13, RSK-12
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-lane-supervision.test.ts`; `tests/fixtures/daemon/lanes/supervise-only/**`
**Tags**: @backend, @daemon, @degraded

**Preconditions**:
- A composition with no lane-executor; one ready queue entry.
- A recording spawn port that must receive zero calls.

**Steps**:
1. Run `daemon start`; assert `instance.mode: "supervise-only"` and `degraded: ["lane-executor-unavailable"]`.
2. Assert reconciliation, status, query, and control still work.
3. Assert the next action is computed and published but no lease is claimed and no spawn occurs.
4. Assert status does not claim a spawn, a current session, or a delivering lane.
5. Compose the executor later; assert the mode changes and supervision begins without a restart losing state.

**Expected Outcome**:
- The missing executor is a declared mode, never a silent idle or a fabricated spawn.

#### TC-LANE-004 - Prefilling/resuming lane is progressing, never stalled (SC-M1-14)

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, AC-F9-2, DM-3, NFR-4, SC-M1-14
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-lane-supervision.test.ts`; `tests/fixtures/daemon/lanes/prefill/**`
**Tags**: @backend, @daemon, @liveness

**Preconditions**:
- A lane in prefill/resume with rising token delta and rising traffic, no phase output yet.
- Injected harness liveness sourced signals and the delivered economics liveness rule; a recording restart port.

**Steps**:
1. Evaluate liveness at several injected ticks; assert the classification is `progressing` at every tick.
2. Assert no restart event is recorded and no kill/resume is requested.
3. Assert the lane state remains `delivering` and the session id is unchanged.
4. Compare with a quiet session; assert only the fully corroborated stall is later classified stalled (TC-LANE-005).
5. Assert the token-delta and traffic signals are consumed from the delivered harness/economics seam, not invented.

**Expected Outcome**:
- Prefill and resume are progress, never a stall; no false restart or kill.

#### TC-LANE-005 - A corroborated stall applies watchdog classification and restart

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, AC-F9-2, DM-3, NFR-4, NFR-14
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-lane-supervision.test.ts`; `tests/fixtures/daemon/lanes/stall/**`
**Tags**: @backend, @daemon, @liveness, @restart

**Preconditions**:
- A lane with no token delta, no traffic, and no worktree activity for at least `lane.liveness-interval`, corroborated by every delivered signal.
- The delivered `watchdog.liveness-stalled` classification and restart admission.

**Steps**:
1. Evaluate liveness; assert the delivered `watchdog.liveness-stalled` classification.
2. Assert the delivered restart admission runs and increments the counter once.
3. Assert the restart decision is recorded and the lane re-enters the supervisor per the delivered rule.
4. Assert a single quiet signal without corroboration is not classified stalled.
5. Assert no duplicate restart and no kill of an unrelated session.

**Expected Outcome**:
- Only a fully corroborated stall triggers the delivered classification and restart, exactly once.

#### TC-LANE-006 - `daemon.lane` state is distinct and updated only by the daemon

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, AC-F9-1, DM-3, EVT-3, NFR-14
**Test Type(s)**: Structure, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/daemon-contract.test.ts`, `tests/behaviour/daemon-lane-supervision.test.ts`; `tests/fixtures/daemon/lanes/records/**`
**Tags**: @structure, @daemon, @lanes

**Preconditions**:
- Delivered six-value `QUEUE_LANE_STATES` and the daemon execution set `{delivering, detached, completed, failed, preempted}`.
- A recording store and the delivered `lanes` projection.

**Steps**:
1. Assert the daemon execution set is distinct from the delivered lane-state set and neither is redefined.
2. Assert exactly one current `daemon.lane` record per ref and latest-wins.
3. Assert a lane record is written only by the daemon on a state change, with the declared fields.
4. Assert `lanes list` folds daemon evidence without inventing a seventh lane state.
5. Assert a non-daemon writer cannot append a `daemon.lane` record without violating the writer-attribution contract.

**Expected Outcome**:
- Daemon execution state is additive evidence, not a second lane vocabulary.

#### TC-EFFECT-001 - Effect state machine accepts only legal transitions

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, AC-F10-1, DM-10, DM-11, EVT-7, Appendix I
**Test Type(s)**: Behaviour, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-effects.test.ts`; `tests/fixtures/daemon/effects/state-machine/**`
**Tags**: @backend, @effects, @state

**Preconditions**:
- An effect intent with identity, intent id, ref, closed kind, target, payload digest, and idempotency key.
- A recording effect adapter and receipt port.

**Steps**:
1. Record intent; assert state `accepted` with the declared fields and no free-form content.
2. Dispatch; assert `in-flight` with attempt ordinal 1.
3. Apply successfully; assert `applied` and one `command.receipt` with status `applied`.
4. Repeat for a definite failure (`failed`) and a lost transport (`unknown`).
5. Attempt each illegal transition (for example `applied → in-flight`, `unknown → applied` without a receipt); assert it is refused with a classified `state.*` and no fabricated state.
6. Assert the first terminal receipt per attempt is authoritative.

**Expected Outcome**:
- Only the declared effect transitions are possible; illegal transitions fail closed and never rewrite history.

#### TC-EFFECT-002 - Unknown + query found records `already-applied`, no second effect

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, AC-F10-1, DM-9, DM-10, DM-11, EVT-6, NFR-15
**Test Type(s)**: Behaviour, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-effects.test.ts`; `tests/fixtures/daemon/effects/query-found/**`
**Tags**: @backend, @effects, @unknown

**Preconditions**:
- An effect `e-1` in `unknown`; a query adapter that finds the stable identity (comment id, transition id, or commit SHA).
- A recording effect adapter that counts applications.

**Steps**:
1. Reconcile; assert one bounded query by stable identity runs.
2. Assert the query verdict is `found`, the effect becomes `applied`, and the receipt status is `already-applied`.
3. Assert zero second effects are applied and the adapter application count stays 1.
4. Assert the receipt carries bounded evidence and the query time.
5. Replay the reconciliation; assert no second query-driven effect and no state change.

**Expected Outcome**:
- A landed effect is detected, not duplicated; `unknown` resolves to `already-applied` with no second effect.

#### TC-EFFECT-003 - Unknown + query not-found re-applies exactly once

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, AC-F10-1, DM-9, DM-10, DM-11, EVT-6, NFR-15
**Test Type(s)**: Behaviour, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-effects.test.ts`; `tests/fixtures/daemon/effects/query-not-found/**`
**Tags**: @backend, @effects, @unknown

**Preconditions**:
- An effect `e-2` in `unknown`; a query adapter that finds nothing.
- A recording effect adapter that succeeds on the first re-apply.

**Steps**:
1. Reconcile; assert the query verdict is `not-found`.
2. Assert one re-apply attempt moves the effect `accepted → in-flight → applied` and appends a new receipt.
3. Assert the adapter application count is 2 total (the original plus one re-apply), never more.
4. Assert a subsequent reconciliation finds the effect applied and performs no further query-driven apply.
5. Assert the attempt ordinal increments and the prior failure/unknown remains evidence.

**Expected Outcome**:
- A not-found query authorizes exactly one re-apply with a new receipt; no loop and no blind repetition.

#### TC-EFFECT-004 - Unknown + unreadable query stays unknown with no blind retry

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, AC-F10-1, DM-9, DM-10, DM-11, NFR-15
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-effects.test.ts`; `tests/fixtures/daemon/effects/query-unreadable/**`
**Tags**: @backend, @effects, @negative

**Preconditions**:
- An effect `e-3` in `unknown`; a query adapter that returns unreadable (timeout, permission failure, provider error).
- A recording effect adapter that must receive zero calls.

**Steps**:
1. Reconcile; assert the query verdict is `unreadable`.
2. Assert the effect stays `unknown`, no re-apply occurs, and the adapter application count is unchanged.
3. Assert the effect remains visible in status/forensics with the unreadable evidence.
4. Advance several cycles; assert it is never blindly retried.
5. Restore a readable query that finds nothing; assert one re-apply is then allowed.

**Expected Outcome**:
- An unreadable query forbids a blind retry; the effect stays visible and resolvable later.

#### TC-EFFECT-005 - Commit re-drive matches the recorded path-set identity and creates no second commit

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, F-10, AC-F10-2, AC-F8-4, DM-9, DM-10, DM-11, DM-18, EVT-6, EVT-7, NFR-4, NFR-15, TDR-0014 INV-1..INV-8, DEC-15, DEC-19
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-effects.test.ts`; `tests/fixtures/daemon/effects/commit-path-set/**`
**Tags**: @backend, @effects, @commit

**Preconditions**:
- A two-file staged change in a temporary repository. The wrapper computes the staged path set before the commit with the delivered pure staging computation over one tree read and the same scope request the primitive receives, normalized as repo-relative paths with `/` separators, no leading `./`, deduplicated, and sorted.
- Exactly one `outbox.effect` (`effectKind: commit`, `checkStrategy: query-by-log-since`) is durable **before** the primitive is invoked, carrying `effectId`, `intentId`, `idempotencyKey` (derived deterministically from change ref, phase, and `baselineHead`), `changeRef`, `phase`, `baselineHead`, and the sorted normalized staged path set. It carries no message, subject, body, or message fingerprint.
- The commit object has landed; the transition record and telemetry have not. The commit message is whatever the delivered transport produced: the model-path fixture returns a message no template would produce, and no fixture supplies or asserts an expected subject or body.
- An injected bounded `CommitGitPort.logSince(baselineHead)` returns the ordered commits after the baseline, each with its SHA and normalized changed-path set (a rename contributes its delete and add paths), capped at the declared maximum. A recording query counter.
- A recording commit counter, and an injected lane/one-shot owner harness that can run phase completion with a supplied commit-evidence SHA.

**Steps**:
1. Assert the intent is durable before the primitive is invoked (append ordering), the check strategy is `query-by-log-since` (not `query-by-sha`, not an adapter-declared property), and the recorded path set equals the independently computed normalized set. Assert no message, subject, body, or fingerprint field exists in the record.
2. Run the owning lane/one-shot re-drive; assert exactly one bounded `logSince(baselineHead)` call with the recorded baseline, returning the landed commit's SHA and normalized changed-path set. Assert the read never consumes or compares the commit message.
3. Assert `applied` (`already-applied`) only because the read yields exactly one new commit **and** its normalized changed-path set equals the recorded set; assert the receipt records the landed SHA, the state machine moves `in-flight → applied`, the commit counter stays 1, no second commit object exists, and no second receipt or effect is appended for the same effect identity.
4. Four fail-closed controls, each on a fresh effect: (a) zero new commits → `unknown`; (b) two new commits → `unknown`; (c) exactly one commit whose changed-path set differs by one path → `unknown`; (d) an unreadable or over-cap `logSince` read → `unknown`. In every case assert no automatic re-apply, no second commit, no guessed SHA, and no silently lost binding: the effect stays durable with a DM-18 redrive request, and the phase binding is neither guessed nor discarded.
5. Owner restoration: assert the owning lane/one-shot process re-runs phase completion with the receipt's discovered SHA as commit evidence; the delivered convergence classifies `commit-without-record` with that SHA, appends the transition carrying it with durable intent `atomic`, creates no commit, and the phase reads `both`. Assert the daemon appended no transition and ran no phase — it only recorded the redrive request (TC-LANE-002).
6. **Three negative controls, each must fail this test**: (a) break the path-set derivation — record one path fewer than the staged set, so no recorded set can match and the effect must not resolve `applied`; (b) remove the `logSince` query — no receipt and no SHA can be produced; (c) break the match rule — accept a path-set mismatch (or more than one new commit) as `applied`, so a non-matching commit is wrongly claimed. Restore each control and re-run green.
7. **Owner-restoration negative control**: skip the owner's restore step; assert the phase does not adopt the orphan SHA — it lands a fresh transition commit through the atomic completion (the required `both` assertion for the orphan fails) and the binding is not silently considered restored. Restore the step and re-run green.
8. Repeat step 2–3 after a second unclean stop; assert the same result with one bounded query, never an unbounded scan.
9. Assert the delivered commit primitive's message composition, commit format, and landing order are unchanged: the model-path fixture still uses its own message, no template is forced, and no model call is suppressed or duplicated for effect commits.

**Expected Outcome**:
- Commit crash safety is observed through the production mechanism, never granted by adapter declaration or by a fixture-supplied expected message: the durable pre-commit intent plus one bounded `logSince(baselineHead)` read resolves `applied` only for exactly one new commit whose normalized changed-path set equals the recorded set, records the landed SHA, creates no second commit, and leaves every ambiguous outcome `unknown` with no automatic re-apply. The owner — never the daemon — restores the phase binding, and each of the derivation-break, query-removal, match-rule-break, and missing-owner-restore controls fails the test when broken.

#### TC-EFFECT-006 - No tracker/VCS write adapter ships; commit is the only production adapter

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, AC-F10-3, NG-2, NFR-12, NFR-14, RSK-9
**Test Type(s)**: Structure, Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/daemon-imports.test.ts`, `tests/checks/daemon-hermetic.test.ts`; `tests/fixtures/daemon/effects/adapters/**`
**Tags**: @structure, @effects, @boundaries

**Preconditions**:
- The delivered adapter inventory and the daemon composition.
- A source scan for tracker/VCS write ports.

**Steps**:
1. Assert the only production external-effect adapter composed is the delivered commit primitive.
2. Assert tracker transition and comment adapters exist only as injected test fakes, not production exports.
3. Assert no daemon path calls a tracker or VCS write API.
4. Assert the effect primitive's ports are typed and injected, with no ambient client construction.
5. Assert a boundary/import test fails when a production tracker write adapter is added.

**Expected Outcome**:
- The effect protocol is proven without adding a write path; commits are the sole production effect adapter.

#### TC-PREEMPT-001 - Active-session preemption is pending and never signals/kills

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-11, AC-F11-1, DM-5, EVT-5, DEC-2, RSK-7
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-preemption.test.ts`; `tests/fixtures/daemon/preemption/active/**`
**Tags**: @backend, @daemon, @preemption

**Preconditions**:
- A scheduler-computed preemption: GH-310 merge-ready on repo-alpha; GH-311 holds repo-alpha with an active session in phase delivery.
- A recording signal/kill port that must receive zero calls.

**Steps**:
1. Apply the computed preemption; assert a durable `daemon.preemption` record with state `pending`, target GH-311, close ref GH-310, `preempted-for-close-item`, and `preemption`.
2. Assert no signal, kill, resume, or session mutation is sent; the signal/kill count is zero.
3. Assert the session continues delivering and the lease remains held.
4. Assert status exposes the pending preemption.
5. Assert the close item is not scheduled in the same pass.

**Expected Outcome**:
- Preemption of a live session is a durable intent only; the session is never killed or signalled.

#### TC-PREEMPT-002 - Boundary apply releases, parks, and names the close item

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-11, AC-F11-1, DM-5, EVT-5, NFR-4
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-preemption.test.ts`; `tests/fixtures/daemon/preemption/boundary/**`
**Tags**: @backend, @daemon, @preemption

**Preconditions**:
- The pending preemption from TC-PREEMPT-001; the lane reaches its next phase boundary (or completes).
- A recording lease/park port.

**Steps**:
1. Emit the boundary event; assert the lease is released and the park `preempted-for-close-item` with condition type `preemption` is recorded in one fenced transaction.
2. Assert the preemption record becomes `applied` and carries boundary evidence (phase, observed time).
3. Assert the record names the close item GH-310 and the holder.
4. Assert no live session signal occurred.
5. Assert the release/park is atomic: neither half alone is projected.

**Expected Outcome**:
- The pending intent applies only at a safe boundary, atomically, with the close item named.

#### TC-PREEMPT-003 - Pending preemption survives restart and re-evaluates

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-11, AC-F11-1, DM-5, EVT-5, NFR-2, NFR-4
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-preemption.test.ts`; `tests/fixtures/daemon/preemption/restart/**`
**Tags**: @backend, @daemon, @preemption, @state

**Preconditions**:
- A `pending` preemption; kill the daemon before the boundary; the lane session is gone on restart.
- A readable state store.

**Steps**:
1. Restart; assert reconciliation reads the pending preemption and re-evaluates it.
2. Assert the pending state is not lost, duplicated, or silently withdrawn.
3. If the session is gone, assert the release/park applies immediately (TC-PREEMPT-004).
4. If the session is observable, assert it stays pending and the live session is untouched.
5. Assert no second preemption record for the same target/close pair.

**Expected Outcome**:
- Pending preemption is durable and re-evaluated after restart without loss or duplication.

#### TC-PREEMPT-004 - No-session preemption releases and parks immediately; explicit path equivalent

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-11, AC-F11-2, DM-5, EVT-5, NFR-4
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-preemption.test.ts`; `tests/fixtures/daemon/preemption/no-session/**`
**Tags**: @backend, @daemon, @preemption

**Preconditions**:
- GH-311 holds repo-alpha with no active session; GH-310 is merge-ready.
- A recording lease/park port and the delivered explicit `queue release --park preempted-for-close-item` path.

**Steps**:
1. Apply the preemption; assert immediate fenced release plus park `preempted-for-close-item`/`preemption`.
2. Assert the preemption record is `applied` and names GH-310.
3. Run the explicit `queue release GH-311 --park preempted-for-close-item`; assert the same durable release/park shape.
4. Assert the daemon does not implement a second release semantic: the two paths produce the same records.
5. Assert a replay appends no second release or park.

**Expected Outcome**:
- With no live session, preemption applies immediately and matches the explicit path exactly.

#### TC-PREEMPT-005 - Single-flight holds until release; close item not scheduled same pass

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-11, AC-F11-2, DM-5, EVT-5, NFR-4
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-preemption.test.ts`; `tests/fixtures/daemon/preemption/single-flight/**`
**Tags**: @backend, @daemon, @preemption

**Preconditions**:
- GH-311 holds repo-alpha; GH-310 is the close item; a pending preemption exists.
- A deterministic pass scheduler.

**Steps**:
1. Compute the pass before release; assert GH-310 is held `lease-held` (or the declared preemption hold) and is not a next action.
2. Apply the release; assert the next pass schedules GH-310.
3. Assert only one close item is scheduled and no same-pass double claim occurs.
4. Assert a replay of the pass before release never schedules GH-310.
5. Assert no other repository is affected.

**Expected Outcome**:
- Single-flight holds until the release lands; the close item is never scheduled in the same pass.

#### TC-DEGRADE-001 - Full one-shot surface works daemon-down with truthful markers (SC-M1-17)

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-12, AC-F12-1, AC-F3-1, DM-13, DM-14, NFR-2, NFR-13
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-degradation.test.ts`, `tests/behaviour/queue-cli.test.ts`, `tests/behaviour/lanes.test.ts`; `tests/fixtures/daemon/degradation/one-shot/**`
**Tags**: @backend, @daemon, @cli, @daemon-free

**Preconditions**:
- No daemon, no socket, no background task; a throwing `fetch` guard and a process-spawn spy.
- One ready entry on repo-alpha; a readable state store.

**Steps**:
1. Run `queue plan --next 1`; assert exit 0, one action, and `degraded: ["daemon-unreachable"]`.
2. Run `queue claim GH-320 --holder one-shot-1`; assert exit 0, a lease, and the marker.
3. Run `queue release GH-320 --holder one-shot-1`; assert exit 0, release, and the marker.
4. Run `lanes list`; assert exit 0 with the delivered payload and the marker.
5. Assert no socket open, no child process, and no daemon notification claim.
6. Re-open state; assert consistency for a later reconciliation.

**Expected Outcome**:
- Every listed one-shot completes from state at exit 0 with a truthful marker; the daemon is optional.

#### TC-DEGRADE-002 - Absent, stale, and crashed daemons never fail or idle a one-shot

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-12, AC-F12-2, AC-F12-1, DM-13, DM-14, NFR-13
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-degradation.test.ts`; `tests/fixtures/daemon/degradation/continuity/**`
**Tags**: @backend, @daemon, @cli, @degraded

**Preconditions**:
- Cases: daemon absent; daemon stale (heartbeat at/beyond bound); daemon crashed (stale instance, no release); daemon reachable (control case).
- A matrix of one-shot commands: queue read/mutate/claim/release, blockers publish/answer, phase complete, commit, lanes list/show, plain status.

**Steps**:
1. For each case and command, assert exit 0 (or the command's own contract exit), no timeout, and no idle wait.
2. Assert every read that declares `degraded` carries `daemon-unreachable` in the three non-reachable cases and omits it in the reachable control.
3. Assert queue mutations land even in the crashed case and are durable.
4. Assert blockers and phase/commit behavior is unchanged against a daemon-free baseline.
5. Assert plain status declares the degradation; only `status --live` fails closed (TC-DEGRADE-003).
6. Assert no command blocks longer than its own bounded timeout plus one local read.

**Expected Outcome**:
- The daemon's liveness never changes a one-shot result; the marker is a fact, not a constant.

#### TC-DEGRADE-003 - Plain status degrades at exit 0; only `--live` fails at exit 2

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-12, AC-F12-2, AC-F1-2, DM-13, DM-14, NFR-13, C-3
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-degradation.test.ts`, `tests/golden/daemon-status-matrix.test.ts`; `tests/fixtures/daemon/degradation/status-matrix/**`
**Tags**: @backend, @daemon, @status

**Preconditions**:
- A 3×2 matrix: daemon state {running, stale, stopped} × socket {reachable, unreachable}, with heartbeat state controlled.

**Steps**:
1. For each cell, run plain `daemon status`; assert exit 0, the correct `heartbeat.state`, and the correct `degraded` marker.
2. For each cell, run `daemon status --live`; assert exit 0 only when both heartbeat fresh and socket reachable, otherwise exit 2 with the exact identity (`daemon.socket-unreachable` or `daemon.heartbeat-stale`).
3. Assert plain status never exits 2 and `--live` never exits 0 on a degraded cell.
4. Assert the remediation hint is present on every exit-2 cell.
5. Assert the machine and human goldens match the matrix.

**Expected Outcome**:
- The degradation matrix is exact: plain status declares at exit 0, `--live` fails closed at exit 2.

#### TC-DEGRADE-004 - Unreadable state yields a classified exit 2, never an all-clear

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-12, AC-F12-2, NFR-13, DM-14
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-degradation.test.ts`; `tests/fixtures/daemon/degradation/unreadable/**`
**Tags**: @backend, @daemon, @fail-closed

**Preconditions**:
- Cases: torn ledger, unreadable key, unknown record kind, permission denied.
- A control readable store.

**Steps**:
1. For each case, run plain status and a daemon-down one-shot read; assert the delivered `state.*` identity at exit 2 where the surface fails closed, and no `data` sibling.
2. Assert no surface reports an all-clear, a zero-lane view, or an empty schedule as truth.
3. Assert `status --live` exits 2 with the state identity when state is unreadable.
4. Assert a watch exits 2 with the state identity (TC-WATCH-004).
5. Assert the control store reports normally.

**Expected Outcome**:
- Unreadable state is a platform failure, never a fabricated healthy view.

#### TC-WATCH-001 - `queue --watch` streams a bounded snapshot and deduplicated events

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-13, AC-F13-1, DM-7, EVT-8, EVT-9, NFR-9
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-watch.test.ts`; `tests/golden/watch-queue.test.ts`; `tests/fixtures/daemon/watch/queue/**`
**Tags**: @backend, @daemon, @watch

**Preconditions**:
- A reachable daemon over an in-memory pair; a queue with two entries and one park.
- A controlled event feed and an interrupt signal injected at a deterministic point.

**Steps**:
1. Run `queue --watch`; assert a `subscribe` to topic `queue`, an accepted response, and an initial bounded snapshot.
2. Emit repeated and changed events; assert one JSON object per line, deduplicated by the declared identity, with finding codes preserved.
3. Assert no frame exceeds `daemon.frame-max-bytes` and every rendered line is bounded.
4. Inject an interrupt; assert exit 0.
5. Assert machine mode emits no non-JSON line and no empty stream.

**Expected Outcome**:
- Reachable watch streams bounded, deduplicated state; interruption is a clean exit 0.

#### TC-WATCH-002 - `lanes --watch` keeps finding codes and honours the frame bound

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-13, AC-F13-1, DM-7, EVT-8, EVT-9, NFR-9
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/lanes-watch.test.ts`; `tests/golden/watch-lanes.test.ts`, `tests/golden/lanes-watch-accepted.test.ts`; `tests/fixtures/daemon/watch/lanes/**`
**Tags**: @backend, @daemon, @watch

**Preconditions**:
- A reachable daemon; a lane transition and a stuck-park finding; a bounded event burst.
- Injected interrupt.

**Steps**:
1. Run `lanes --watch`; assert a subscribe to topic `lanes`, an initial snapshot, and event frames carrying `kind: "event"`, `type`, `topic`, and the bounded projection.
2. Assert a finding-bearing event keeps its code and severity.
3. Assert deduplication across repeated identical lane states and the declared frame/line bound.
4. Assert interruption exits 0.
5. Assert no frame carries an unbounded or secret value.

**Expected Outcome**:
- Lanes watch is bounded, finding-coded, deduplicated, and truthful.

#### TC-WATCH-003 - Watch without a daemon is declared degraded polling at exit 0

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-13, AC-F13-2, DM-7, DM-14, EVT-9, NFR-9, NFR-13, C-4
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-watch.test.ts`, `tests/behaviour/lanes-watch.test.ts`; `tests/golden/lanes-watch-accepted.test.ts`, `tests/golden/watch-refusal-absent.test.ts`; `tests/fixtures/daemon/watch/degraded/**`
**Tags**: @backend, @daemon, @watch, @degraded

**Preconditions**:
- No daemon or socket; a readable state store; `daemon.watch-poll-interval` fixed; a controllable clock and an interrupt.
- State changes between polls.

**Steps**:
1. Run `queue --watch`; assert a declared degraded marker naming `daemon-unreachable` before the first snapshot.
2. Advance the clock; assert polls at the configured interval and only changed bounded snapshots are printed.
3. Assert no duplicate unchanged snapshot is printed.
4. Run `lanes --watch`; assert the same behavior.
5. Inject an interrupt; assert exit 0 and no non-JSON line in machine mode.
6. Assert the invocation never fails and never emits a silent empty stream.

**Expected Outcome**:
- Without a daemon, watch is a declared bounded poll at exit 0, never a failure or a silent stream.

#### TC-WATCH-004 - Watch over unreadable state exits 2 with a `state.*` identity

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-13, AC-F13-2, NFR-13, DM-14
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-watch.test.ts`, `tests/behaviour/lanes-watch.test.ts`; `tests/golden/watch-unreadable.test.ts`
**Tags**: @backend, @daemon, @watch, @fail-closed

**Preconditions**:
- Cases: torn ledger, unreadable key, unknown kind; no daemon.
- A control readable store.

**Steps**:
1. Run each watch; assert exit 2 with the delivered `state.*` identity and bounded evidence.
2. Assert no polling begins and no empty or partial snapshot is printed as truth.
3. Assert the error is a classified envelope with a remediation hint.
4. Repeat with a daemon reachable but state unreadable; assert the same exit 2.
5. Assert the control store watches normally.

**Expected Outcome**:
- Unreadable state fails the watch closed instead of polling a lie.

#### TC-WATCH-005 - Mid-stream overflow drops to polling with a degraded marker

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-13, AC-F13-1, AC-F13-2, DM-7, DM-14, EVT-9, NFR-6, NFR-9, C-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/watch-stream.test.ts`; `tests/fixtures/daemon/watch/overflow/**`
**Tags**: @backend, @daemon, @watch, @overflow

**Preconditions**:
- A reachable daemon, a small subscription buffer, a slow watch consumer, and a burst of events.
- A readable state store and a controllable clock.

**Steps**:
1. Start `lanes --watch` and stop reading until the buffer overflows.
2. Assert one `degraded` event carrying `subscriber-overflow` is emitted before the subscription drops.
3. Assert the invocation then falls back to bounded state polling with a `subscriber-overflow` marker and exits 0 on interrupt.
4. Assert the dispatcher continues serving another connection during the overflow.
5. Assert no silent empty stream and no unbounded buffer.

**Expected Outcome**:
- Overflow degrades one watch to declared polling at exit 0 and never stalls the dispatcher.

#### TC-POLL-001 - Failure backs off base→max; success resets to base

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-14, AC-F14-1, DM-15, NFR-16, DEC-11
**Test Type(s)**: Behaviour, Config
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-polling.test.ts`; `tests/fixtures/daemon/polling/backoff/**`
**Tags**: @backend, @daemon, @polling

**Preconditions**:
- `poll.<platform>.base-interval` 5 000 ms, `max-interval` 60 000 ms, `min-spacing` 1 000 ms.
- An injected clock and a read adapter that fails N times, then succeeds, then fails again.

**Steps**:
1. Drive repeated failures; assert the observed intervals grow exponentially from the base to the cap and never exceed the cap.
2. Assert a success resets the next interval to the base.
3. Assert a later failure sequence starts again from the base.
4. Assert the derived cadence matches the configured policy with no code change.
5. Assert a missing policy falls back to defaults with a `defaults` origin.

**Expected Outcome**:
- Backoff is exponential, bounded, and reset by success exactly as configured.

#### TC-POLL-002 - Minimum spacing and rate limit are honoured; reads stay on delivered seams

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-14, AC-F14-1, NFR-16, RSK-10
**Test Type(s)**: Behaviour, Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-polling.test.ts`, `tests/checks/daemon-hermetic.test.ts`; `tests/fixtures/daemon/polling/spacing/**`
**Tags**: @backend, @daemon, @polling, @checks

**Preconditions**:
- A policy with `min-spacing` 1 000 ms; a burst of queued work that would otherwise poll faster.
- A recording provider/CI read adapter and a source import scan.

**Steps**:
1. Drive the burst; assert no two polls occur closer than `min-spacing` and no window exceeds the base/max rate.
2. Assert every poll goes through a delivered read seam; zero direct HTTP/client construction.
3. Assert failure backoff and spacing compose (backoff never violates the minimum spacing).
4. Assert a one-shot command performs a single read and is not subject to resident backoff state.
5. Assert no unbounded polling loop exists (TC-POLL-004).

**Expected Outcome**:
- The resident poller respects the configured rate and read seams; one-shots remain single-read.

#### TC-POLL-003 - Polling and one-shot cadence are configuration-only

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-14, AC-F14-1, NFR-10, DM-15
**Test Type(s)**: Behaviour, Config
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-polling.test.ts`, `tests/behaviour/config-resolver.test.ts`; `tests/fixtures/daemon/polling/config/**`
**Tags**: @backend, @daemon, @polling, @config

**Preconditions**:
- Two paired fixtures differ only in `poll.<platform>.base-interval`/`max-interval`/`min-spacing`.
- A provenance read surface.

**Steps**:
1. Run the same failure sequence under both fixtures; assert the observed cadence differs exactly as configured.
2. Assert the resolved values and origins are inspectable.
3. Assert a non-integer, zero, negative, or unknown platform key refuses with `config.value.invalid` naming the key.
4. Assert changing only configuration produces no source diff.
5. Assert an absent `poll` branch uses defaults.

**Expected Outcome**:
- Polling is data, not code; invalid policy fails closed with the key named.

#### TC-POLL-004 - No unbounded polling path or non-seam read exists

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-14, AC-F14-1, NFR-16, NFR-14
**Test Type(s)**: Structure, Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/daemon-imports.test.ts`, `tests/checks/daemon-hermetic.test.ts`; `.dependency-cruiser.cjs`
**Tags**: @structure, @daemon, @polling, @boundaries

**Preconditions**:
- The daemon composition module graph; a source scan for `setInterval`, `while (true)`, recursive timers, and direct HTTP imports.

**Steps**:
1. Assert every polling loop is bounded by the configured interval and cancellable.
2. Assert no `while (true)`/unbounded retry without an interval or budget.
3. Assert no direct network/client import in the daemon polling path.
4. Assert the boundary fixture fails when a raw poll loop or direct read is added.
5. Assert no real timer is used in tests (injected clock only).

**Expected Outcome**:
- Polling structure is bounded and seam-confined; a rule break fails the boundary or source check.

#### TC-INSTALL-001 - systemd user unit is scoped, data-only, secret-free, and uses the foreground entry

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-15, AC-F15-1, DM-12, NFR-12, NFR-18
**Test Type(s)**: Behaviour, Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-supervisor-install.test.ts`, `tests/golden/daemon-install.test.ts`; `tests/fixtures/daemon/supervisor/unit/**`
**Tags**: @backend, @daemon, @install, @golden

**Preconditions**:
- A Linux platform fact; an injected supervisor adapter and a temporary HOME/XDG root; a state-directory scope.
- A recording filesystem seam.

**Steps**:
1. Run `daemon install`; assert the adapter writes a systemd user unit at the expected user location.
2. Assert the unit's `ExecStart` is exactly `<binary> daemon start --foreground`, with `Type=simple` and `Restart=on-failure`, and that the state-directory scope is bound explicitly as `Environment=<PREFIX>_STATE_DIR=<canonical absolute state directory>` — not inherited from an ambient working directory and not selected by a `--state-dir` flag (none exists).
3. Assert the unit's argument vector is not shell-evaluated (no shell wrapper, no metacharacter expansion, no ambient interpolation) and that the unit content is data with no ambient working-directory assumption and no secret/credential value.
4. Assert the envelope reports `supervisor.kind: "systemd-user"`, unit, scope, linger, `commandForm`, `serviceType`, and `restartPolicy`.
5. Assert the golden contains no hostname, user name, absolute home path, product token, or lock token; the socket path renders only as `<state-dir>/daemon.sock`.
6. Assert exit 0. Assert installation success here is distinct from residency: whether the unit actually keeps the daemon active is proven separately in TC-INSTALL-007, and the default `daemon start` (spawn-and-return) is exercised in TC-LIFE-007.
7. **Scope binding**: set two different `<PREFIX>_STATE_DIR` values and install each; assert each unit carries its own canonical binding, each daemon acquires its own lock and socket, and neither sees the other's records. Then inspect a unit bound to a different scope than the one under test; assert the operator sees no daemon (stopped or stale at exit 0), and a socket path resolving outside the resolved state directory is refused with `config.value.invalid` at exit 1.

**Expected Outcome**:
- The Linux adapter writes a real, scoped, secret-free user unit as data with the foreground entry, `Type=simple`, and `Restart=on-failure`; unit installation is not conflated with unit residency.

#### TC-INSTALL-002 - Install enables linger, reports it, and is idempotent

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-15, AC-F15-1, DM-12, NFR-18, DEC-3
**Test Type(s)**: Behaviour, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-supervisor-install.test.ts`; `tests/fixtures/daemon/supervisor/idempotent/**`
**Tags**: @backend, @daemon, @install

**Preconditions**:
- A recording supervisor port that reports linger enabled; an installed unit absent then present.
- A one-shot command baseline.

**Steps**:
1. Run `daemon install`; assert linger is enabled once and reported `linger: true`.
2. Run it again; assert `result: "noop"` or an idempotent `installed`, no duplicate enablement, and the same unit.
3. Assert the one-shot baseline is byte-identical before and after install (TC-INSTALL-005).
4. Assert no secret is passed to the supervisor and no shell is invoked.
5. Assert exit 0 both times.

**Expected Outcome**:
- Install is idempotent, linger is reported truthfully, and one-shot behavior is unchanged.

#### TC-INSTALL-003 - Linger failure removes the unit and exits 2

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-15, AC-F15-1, DM-12, NFR-18, RSK-8
**Test Type(s)**: Behaviour, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-supervisor-install.test.ts`; `tests/fixtures/daemon/supervisor/linger-failure/**`
**Tags**: @backend, @daemon, @install, @negative

**Preconditions**:
- A supervisor port whose linger enablement fails with platform evidence; a recording filesystem that records the unit write and removal.
- No prior unit.

**Steps**:
1. Run `daemon install`; assert the unit is written and then removed, and no partial unit remains.
2. Assert exit 2 with `daemon.supervisor-unsupported` and platform evidence.
3. Assert the envelope has no success `data` sibling.
4. Assert a subsequent `daemon status` reports no installed unit and linger false.
5. Assert a retry after the cause clears installs successfully.

**Expected Outcome**:
- A partial install is never reported as success; the rolled-back state is truthful.

#### TC-INSTALL-004 - Uninstall removes only what it created and noops when absent

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-15, AC-F15-1, AC-F1-2, DM-12, NFR-18
**Test Type(s)**: Behaviour, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-supervisor-install.test.ts`; `tests/fixtures/daemon/supervisor/uninstall/**`
**Tags**: @backend, @daemon, @install

**Preconditions**:
- Cases: a unit created by this installation with linger enabled by it; a pre-existing unit not created by it; no unit.
- A recording filesystem/supervisor.

**Steps**:
1. Uninstall the created unit; assert it is removed and linger is disabled because this installation enabled it.
2. For the pre-existing unit, assert it is left in place and linger is not disabled.
3. For no unit, assert `result: "noop"` at exit 0 with no write and no linger call.
4. Run uninstall twice; assert the second is a noop.
5. Assert one-shot behavior is unchanged.

**Expected Outcome**:
- Uninstall removes only its own artifact and noops truthfully when absent.

#### TC-INSTALL-005 - An absent unit changes nothing for one-shots

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-15, AC-F15-1, NFR-18, AC-F12-2
**Test Type(s)**: Behaviour, CLI
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-supervisor-install.test.ts`, `tests/behaviour/daemon-degradation.test.ts`; `tests/fixtures/daemon/supervisor/absent/**`
**Tags**: @backend, @daemon, @install, @cli

**Preconditions**:
- Two identical state directories: one with no unit, one with an installed unit but no running daemon.
- A command corpus.

**Steps**:
1. Run the corpus (queue, lanes, blockers, status) against both; assert byte-identical outputs and exits.
2. Assert the presence of a unit never changes a one-shot result or lease decision.
3. Assert an absent unit is not reported as an error and does not imply a daemon.
4. Assert plain status truthfully reports no supervisor and no daemon.
5. Assert no command attempts to start the unit.

**Expected Outcome**:
- Installation is optional; its absence is neutral for every one-shot.

#### TC-INSTALL-006 - Unsupported platforms exit 2 and write no unit

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-15, AC-F15-2, DM-12, NFR-18, DEC-3, RSK-8
**Test Type(s)**: Behaviour, CLI
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-supervisor-install.test.ts`; `tests/fixtures/daemon/supervisor/unsupported/**`
**Tags**: @backend, @daemon, @install, @negative

**Preconditions**:
- Platform facts: macOS (launchd declared, not delivered), Windows (service declared, not delivered), and an unknown platform.
- A recording filesystem that must record zero writes.

**Steps**:
1. Run `daemon install` for each; assert exit 2 with `daemon.supervisor-unsupported`, naming the platform and the missing adapter.
2. Assert zero unit files are written and zero supervisor calls are made beyond the classified refusal.
3. Assert the envelope has no success `data` sibling and no silent no-op.
4. Assert one-shot behavior is unchanged.
5. Assert uninstall on those platforms is a noop at exit 0 (no artifact to remove).

**Expected Outcome**:
- Unsupported platforms are an explicit classified outcome, never a silent success.

#### TC-INSTALL-007 - Installed unit keeps the daemon resident (not merely installed)

**Scenario Type**: Integration
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-15, AC-F15-1, DM-12, NFR-18, RSK-8
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-supervisor-install.test.ts`, `tests/behaviour/daemon-lifecycle.test.ts`; `tests/fixtures/daemon/supervisor/residency/**`
**Tags**: @backend, @daemon, @install, @residency

**Preconditions**:
- A Linux platform fact and an injected supervisor adapter that parses the installed unit's `ExecStart`, `Type`, and `Restart` and starts the declared command against an in-memory process seam.
- A temporary state directory, injected clock, and a recording process-supervisor seam.
- The default `daemon start` (no flag) and `daemon start --foreground` both composed.

**Steps**:
1. Install the unit; assert the supervisor reads `ExecStart=<binary> daemon start --foreground`, `Type=simple`, `Restart=on-failure`, and `Environment=<PREFIX>_STATE_DIR=<canonical absolute state directory>` from the installed content.
2. Start the unit through the injected supervisor; assert the foreground process stays attached after readiness (no exit-at-readiness), keeps the unit active, and the daemon continues appending heartbeats.
3. Assert the unit is not restarted in a loop: with `Restart=on-failure` and a healthy process, assert zero restart invocations over several heartbeat intervals.
4. Assert a forced foreground exit is classified by the supervisor as a failure and is restarted (the restart policy is real, not prose).
5. Assert installation success alone does not imply residency: with a unit whose `ExecStart` uses the default `daemon start` (the mutation/negative control), assert the process exits at readiness and the residency assertion fails.
6. Assert the default `daemon start` still returns after readiness and leaves the daemon resident as a detached process (TC-LIFE-007), and that this interactive form is not what the unit uses.
7. Assert no real systemd is invoked; the whole assertion runs over the injected supervisor seam (GAP-T2, GAP-T4).

**Expected Outcome**:
- The unit is proven to keep the daemon resident through the foreground entry under `Type=simple`, distinct from installation success; the default `daemon start` remains the interactive spawn-and-return form, and the negative control fails when the unit uses it.

#### TC-VOCAB-001 - Seven additive record kinds with schemas and keys

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-16, AC-F16-1, NFR-8, NFR-14, EVT-1..EVT-7
**Test Type(s)**: Structure, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/daemon-vocabulary.test.ts`, `tests/structure/state-contract.test.ts`; `tests/fixtures/daemon/state/kinds/**`
**Tags**: @structure, @daemon, @state

**Preconditions**:
- The seven declared kinds: `daemon.instance`, `daemon.heartbeat`, `daemon.lane`, `daemon.reconciliation`, `daemon.preemption`, `command.receipt`, `outbox.effect`.
- A verified store; one valid seed per kind.

**Steps**:
1. Assert exactly seven additive kinds and their payload schemas/keys match Appendix D.
2. Append one valid record per kind; assert it lands under the declared key and reads back verified.
3. Assert a wrong kind, malformed payload, duplicate acquisition for one instance, or illegal effect transition is a classified `state.*` and never a fabricated value.
4. Assert latest-wins per identity and identical replay appends nothing.
5. Assert no existing record kind, schema, key prefix, or read behavior changed.

**Expected Outcome**:
- Seven additive kinds are declared, validated, and round-trip without touching existing state vocabulary.

#### TC-VOCAB-002 - Exactly eight `daemon` rows synchronize both directions

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-16, AC-F16-1, NFR-11, Appendix F
**Test Type(s)**: Checks, Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/error-table-sync.test.ts`, `tests/structure/error-table.test.ts`; `scripts/checks/error-table-sync.ts`; `tests/fixtures/daemon/errors/**`
**Tags**: @checks, @daemon, @errors

**Preconditions**:
- The machine table, documented table, source references, and fixtures.
- The eight expected codes from Appendix F.

**Steps**:
1. Assert exactly eight `daemon` rows exist with the declared category, retryable, consequence, and projection.
2. Assert every row is reachable by a documented trigger and every documented row exists in the machine table (both directions).
3. Assert zero existing rows changed or renumbered and the collector-id set remains `{tracker, lanes}`.
4. Assert `fallback.internal` containment is unchanged and an unclassified daemon failure is contained.
5. Run `bun run scripts/checks/error-table-sync.ts`; assert non-zero exit and the offending field named when a row is removed or added.

**Expected Outcome**:
- The eight rows agree in both directions; no drift is possible without failing the sync check.

#### TC-VOCAB-003 - `daemon` and `poll` configuration branches validate and default

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-16, AC-F16-1, NFR-10, Appendix E
**Test Type(s)**: Structure, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/config-contract.test.ts`, `tests/behaviour/config-schema.test.ts`; `tests/fixtures/daemon/config/**`
**Tags**: @structure, @daemon, @config

**Preconditions**:
- The `daemon` branch keys from Appendix E and the `poll.<platform>` branch.
- An absent branch, a valid branch, and invalid values.

**Steps**:
1. Assert every declared key exists with the declared type, default, and validation.
2. Assert an absent branch resolves to defaults with `defaults` origins.
3. Assert an unknown key, non-integer, zero, negative interval, or invalid transport refuses `config.value.invalid` naming the key.
4. Assert the `poll.<platform>` record validates platform identifiers by exact-key discipline.
5. Assert no capacity/bandwidth/concurrency/CI-slot key is introduced.

**Expected Outcome**:
- The two branches are typed, defaulted, and fail closed; no hidden knob exists.

#### TC-VOCAB-004 - `callerPrincipal` is additive on intent records and backward-compatible

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, F-16, AC-F4-5, AC-F16-1, DM-8, NFR-8, C-2
**Test Type(s)**: Structure, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/daemon-vocabulary.test.ts`, `tests/behaviour/daemon-state-mediation.test.ts`; `tests/fixtures/daemon/state/principal/**`
**Tags**: @structure, @daemon, @state

**Preconditions**:
- Intent kinds: `queue.entry`, `queue.dependency`, `blocker.question`, `blocker.answer`, `outbox.effect`; one historical record without the field.
- Every new intent record produced by this change.

**Steps**:
1. Assert the field is optional on each intent kind — `queue.entry`, `queue.dependency`, `blocker.question`, `blocker.answer`, and `outbox.effect` — and has the reserved shape when present.
2. Assert explicitly that `outbox.effect` carries `callerPrincipal?` under the same optional/backward-compatible rule as every other intent kind (EVT-7, DM-10, Appendix D); a commit intent record without the field remains valid and reads unchanged.
3. Assert a historical record without it reads exactly as before.
4. Assert the additive-only rule: no schema identifier changes, no version bump, no migration, no backfill; the only additive changes are the optional `callerPrincipal` and the accepted `--watch` flag — no required field, required key, or breaking payload shape changes.
5. Assert an execution/outcome record does not carry it (absent, not fabricated).
6. Assert every `v: 1` control frame carries it and every `v: 0` frame omits it (TC-WIRE-007).

**Expected Outcome**:
- The field retrofits additively on every intent kind including `outbox.effect`, preserves historical reads, and nothing treats it as authorization.

#### TC-VOCAB-005 - `--watch` is accepted without changing delivered payloads

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-16, AC-F16-1, AC-F13-1, NG-8, NFR-14
**Test Type(s)**: Structure, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/queue-scheduling-contract.test.ts`, `tests/behaviour/queue-cli.test.ts`, `tests/behaviour/lanes.test.ts`; `tests/golden/lanes-watch-accepted.test.ts`, `tests/golden/watch-refusal-absent.test.ts`; `tests/fixtures/queue/golden/**`
**Tags**: @structure, @daemon, @watch, @compat

**Preconditions**:
- The delivered `queue`/`lanes` grammars and payload goldens from GH-237.
- The new `--watch` acceptance.

**Steps**:
1. Assert `queue --watch` and `lanes --watch` are accepted rather than refused through `fallback.invocation`.
2. Assert every non-watch grammar, payload field, exit projection, and `degraded` set is byte-identical to the GH-237 corpus.
3. Assert the only additive changes are `--watch` and the reserved field.
4. Assert no delivered `queue ready` behavior or six-condition vocabulary changed.
5. Assert a watch with no daemon uses the new declared path, not the old refusal hint.
6. Assert the golden split is explicit: `tests/golden/lanes-watch-accepted.test.ts` asserts the accepted/degraded `lanes --watch` behaviour, `tests/golden/watch-refusal-absent.test.ts` asserts the absent-daemon degraded acceptance, and no `lanes-watch-refusal` golden survives as an overlapping duplicate.

**Expected Outcome**:
- Watch is additive; every delivered payload and grammar is preserved, and the accepted/degraded suite is distinct from the absent-daemon degraded suite.

#### TC-VOCAB-006 - One changeset; additive state with no schema bump

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-16, AC-F16-1, NFR-8
**Test Type(s)**: Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/daemon-vocabulary.test.ts`, `tests/checks/error-table-sync.test.ts`; `.changeset/**`
**Tags**: @checks, @daemon, @release

**Preconditions**:
- The change branch and `.changeset/`.
- The delivered state schema constant.

**Steps**:
1. Assert exactly one changeset is added for the daemon, protocol, records, errors, and configuration.
2. Assert `STATE_SCHEMA_VERSION` is still `delivery.state.v1` and no migration/backfill exists.
3. Assert the changeset is minor and names the additive surface.
4. Assert no existing record kind, error row, config key, or collector id changed.
5. Assert the documented table/source/fixture/changeset names agree (the doc direction is completed at doc-sync).

**Expected Outcome**:
- The release artifact and the additive state contract land together with no schema break.

#### TC-VOCAB-007 - Frame, record, effect, classification, and config sets are closed

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-14, F-4, F-16, AC-F16-1
**Test Type(s)**: Structure, Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/daemon-vocabulary.test.ts`, `tests/structure/daemon-contract.test.ts`; `tests/fixtures/daemon/vocabulary/**`
**Tags**: @structure, @daemon, @vocabulary

**Preconditions**:
- Every declared closed set: frame kinds, interaction classes, topics, effect kinds, effect states, receipt statuses, instance operations, daemon execution states, lane classifications, degradation markers, error codes, and configuration keys.

**Steps**:
1. For each set, assert it is an `as const` closed union and every fixture value belongs to it.
2. Assert no free-form string enters a closed field and no fourth/extra state exists.
3. Assert cross-cutting growth requires a spec change: adding a value outside the set fails the structure test.
4. Assert the daemon execution set is distinct from the delivered lane-state set and the degradation set is exactly the declared markers.
5. Assert the collector-id set is unchanged.

**Expected Outcome**:
- Vocabulary is closed and guarded; growth cannot happen silently.

#### TC-VOCAB-008 - Existing stores read verified-empty; historical records read unchanged

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-16, AC-F16-1, NFR-8
**Test Type(s)**: Integration, Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-state-mediation.test.ts`, `tests/checks/daemon-hermetic.test.ts`; `tests/fixtures/daemon/state/compat/**`
**Tags**: @backend, @daemon, @state, @compat

**Preconditions**:
- A store created before this change with queue, blockers, and economics records.
- A store with no daemon records at all.
- A store with a historical intent record lacking `callerPrincipal`.

**Steps**:
1. Open the pre-change store; assert it verifies and opens unmodified with no migration.
2. Read daemon keys; assert `verified-empty`, never torn/zeroed.
3. Read the historical intent record; assert it reads unchanged and is valid.
4. Start the daemon on the store; assert it appends only additive records and the pre-change records remain byte-identical.
5. Assert the additive-only rule across the observable surface: the only payload-shape differences from the pre-change corpus are the optional `callerPrincipal` and the accepted `--watch` flag; no required field, required key, schema id, collector id, existing record kind, or existing error row changed.
6. Assert no rebuild command or backfill runs.

**Expected Outcome**:
- Existing installations open unchanged and see daemon state as verified-empty; history is preserved and the only differences are the declared additive ones.

#### TC-MERGEABS-001 - No daemon path imports or reaches merge execution

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-17, AC-F17-1, NFR-17, DEC-12, RSK-12
**Test Type(s)**: Structure, Boundaries
**Automation Level**: Automated
**Target Layer / Location**: `.dependency-cruiser.cjs`, `tests/structure/daemon-imports.test.ts`, `tests/boundaries/**`, `tests/boundaries/fixtures/cases.ts`, `tests/boundaries/fixture-registry.json`
**Tags**: @structure, @daemon, @boundaries

**Preconditions**:
- The daemon composition module graph and the delivered merge transaction surface.
- A negative fixture that adds the forbidden edge for each daemon path family: `^packages/core/src/(app|domain)/daemon`, `^packages/cli/src/daemon`, and `^packages/adapters/src/daemon/`.

**Steps**:
1. Assert the dependency-boundary rule's `from` set covers all three daemon path families, including the adapters daemon subpath, and forbids importing merge execution.
2. Assert the rule has a failing fixture per family (the fixture-coverage meta-check), including a source-level import from `packages/adapters/src/daemon/`.
3. Assert a reachability test finds no merge transaction, gate evaluation, or landing call reachable from the daemon composition. This is a runtime/reachability proof, distinct from the source-level import proof.
4. Assert adding a merge import from any daemon path fails the boundary test, while injecting a merge executor only changes the reachability result (`mergeCodePath: "present"`) and adds no import edge (TC-MERGEABS-002).
5. Assert the daemon may read merge readiness and rank a merge-ready entry without invoking merge.

**Expected Outcome**:
- Merge absence is structural and enforced at the source level for every daemon path family; the import proof and the injection/reachability proof remain distinct, not a documentation claim.

#### TC-MERGEABS-002 - `mergeCodePath` is a computed closed set (`absent`/`present`)

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-17, AC-F17-1, DM-13, NFR-17, DEC-12
**Test Type(s)**: Behaviour, Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-lifecycle.test.ts`, `tests/structure/daemon-contract.test.ts`; `tests/fixtures/daemon/lifecycle/merge-absence/**`
**Tags**: @backend, @daemon, @status

**Preconditions**:
- A composed daemon with no merge executor; a status request.
- A mutation fixture that injects a merge executor into the composition, and a separate source fixture that adds a merge import under `packages/adapters/src/daemon/`.

**Steps**:
1. Assert the production composition reports `mergeCodePath: "absent"`.
2. Assert the value is computed by the composition (a capability scan), not a literal in the status renderer.
3. Assert the value is the closed set `{"absent", "present"}`: every observed value belongs to it, and no third value is representable.
4. Inject a merge executor into the test composition; assert the computed value is exactly `"present"` (the defined complement) and that the injected executor adds no import edge — the module-graph scan still finds no merge import.
5. **Separate source-level proof**: add a merge import under `packages/adapters/src/daemon/` (and, in additional fixtures, under the core and CLI daemon paths) and assert the dependency boundary fails for each. Assert this failure is independent of step 4's injected-executor `present` result; neither proof substitutes for the other.
6. Assert `daemon status` reports the field in machine and human output.
7. Assert no status path imports merge to compute it.

**Expected Outcome**:
- The status field is a computed structural fact over a closed two-value set; an injected merge executor yields `"present"` as a reachability result without an import edge, while a source-level import from any daemon path — including `packages/adapters/src/daemon/` — independently fails the dependency boundary. The two proofs stay distinct.

#### TC-DET-001 - 100 identical runs produce byte-identical status/reconciliation

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-1, AC-F1-1, AC-F8-1, EVT-4
**Test Type(s)**: Checks, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/daemon-determinism.test.ts`; `tests/fixtures/daemon/determinism/**`
**Tags**: @checks, @daemon, @determinism

**Preconditions**:
- A fixed state corpus, injected clock at one instant, fixed instance ids, and fixed lane facts.
- Varied ambient locale, timezone, environment insertion order, and object key order between runs.

**Steps**:
1. Compute `daemon status` 100 times; assert all machine payloads byte-identical.
2. Compute reconciliation/classification 100 times; assert all reports byte-identical.
3. Render human output 100 times; assert byte-identical.
4. Vary locale/timezone/insertion order; assert no change.
5. Assert no ambient clock, randomness, environment read, or iteration-order dependence is reachable from the report paths (ambient-globals check).

**Expected Outcome**:
- Daemon reports are pure functions of injected state and clock; 100 runs are byte-identical.

#### TC-HERMETIC-001 - Hermetic guards and one bounded real-child smoke

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-7, NFR-2, RSK-1
**Test Type(s)**: Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/daemon-hermetic.test.ts`; `tests/fixtures/daemon/hermetic/**`
**Tags**: @checks, @daemon, @hermetic

**Preconditions**:
- A throwing `globalThis.fetch` guard; a credential-port spy; a timer/sleep spy; a socket-open spy.
- One opt-in bounded real-child start/stop smoke guarded by an environment flag and a hard timeout.

**Steps**:
1. Run the daemon suites with the fetch guard armed; assert zero fetch calls, zero live sockets, and zero live credential reads.
2. Assert zero real sleeps/timers; the clock advances only through the injected seam.
3. Assert a missing fixture fails naming the missing fixture rather than skipping.
4. Run the real-child smoke (if enabled) with a hard timeout; assert start reaches readiness, stop exits, and the child is reaped; skip cleanly when disabled, never hang.
5. Assert the daemon domain imports no runtime API outside the declared locations (boundary check).

**Expected Outcome**:
- The battery is hermetic; the one real-child test is bounded, optional, and cannot hang the suite.

#### TC-BOUNDS-001 - Every declared bound truncates explicitly, never silently

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-9, AC-F1-1, AC-F8-1, AC-F13-1, Appendix J
**Test Type(s)**: Checks, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/daemon-bounds.test.ts`, `tests/behaviour/daemon-lifecycle.test.ts`; `tests/fixtures/daemon/bounds/**`
**Tags**: @checks, @daemon, @bounds

**Preconditions**:
- A corpus at each declared cap: frame 65 536 bytes, subscription buffer 256, status lanes 200, reconciliation lanes 200, status data 65 536 bytes, human 40 lines/8 192 bytes, evidence 512 bytes, watch snapshot.
- A control under each cap.

**Steps**:
1. For each bound, assert the output is capped and sets `truncated: true` with a named `truncationReason`.
2. Assert the under-cap control is not truncated.
3. Assert a frame over the cap is a classified error, not a truncation.
4. Assert subscription overflow emits the degraded event rather than growing the buffer.
5. Assert no surface silently drops a row or emits an unbounded stream.
6. Assert reconciliation at 200+ lanes reports truncation and never silently omits a lane.

**Expected Outcome**:
- Every bound is explicit and observable; no silent cut and no unbounded output.

#### TC-PRIVACY-001 - No secrets, prompts, bodies, or absolute roots on any surface

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-12, AC-F4-4, AC-F7-1, RSK-11, §20, §21
**Test Type(s)**: Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/daemon-hermetic.test.ts`, `tests/checks/secret-read-boundary.test.ts`, `scripts/checks/privacy-literals.ts`; `tests/fixtures/daemon/privacy/**`
**Tags**: @checks, @daemon, @privacy

**Preconditions**:
- Synthetic canaries for a credential value, a credential token, a prompt, a message body, a transcript, a diff, a raw provider payload, and an absolute repository/home root.
- Hostile inputs to every daemon, effect, watch, and status surface.
- Two candidate state directories with known canonical absolute paths, plus an injected clock and filesystem seam.

**Steps**:
1. Exercise every surface with the canaries; assert none appears in frames, records, reconciliation, status, watch lines, human output, goldens, logs, or telemetry.
2. Assert the instance record's `scope` is the declared non-path digest: exactly the first 16 lowercase hex characters of SHA-256 over the canonical absolute state-directory path, matching `^[0-9a-f]{16}$`.
3. Assert the mapping is recoverable by recomputation: recomputing the digest for the same canonical directory reproduces the stored `scope`, and a different directory yields a different `scope`.
4. Assert the raw state-directory path is never stored in a record, frame, golden, log line, or telemetry event; assert the socket path is emitted only by local `daemon start`/`daemon status` envelopes and as the normalized `<state-dir>/daemon.sock` golden placeholder.
5. Assert the daemon never records an absolute repository root.
6. Assert the delivered redaction chokepoint covers the new payloads and the secret-read allowlist is unchanged; assert the daemon lock token is out of scope here as a non-credential (TC-WIRE-006 owns its canary scope) while every credential canary still fails if it transits.

**Expected Outcome**:
- No secret, payload, or absolute root leaks on any daemon surface; the durable scope is a declared, recomputable, non-path digest; a canary appearance fails.

#### TC-META-001 - Mutation fixtures prove the key rules fail when broken

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-1, NFR-3, NFR-4, NFR-17, AC-F2-2, AC-F8-2, AC-F17-1
**Test Type(s)**: Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/daemon-mutants.test.ts`; `tests/fixtures/daemon/mutants/**`
**Tags**: @checks, @daemon, @meta

**Preconditions**:
- Copy-on-write mutant copies of the daemon policy with one rule broken each: livelock takeover allowed, restart increments twice, completed phase re-executed, merge import reachable, subscriber blocks dispatcher, unknown effect re-applied without query, fabricated heartbeat, non-deterministic ordering.

**Steps**:
1. Run the relevant TC against each mutant; assert the TC fails and names the broken rule.
2. Assert the unmutated baseline passes the same TC.
3. Assert the mutation harness does not alter production files and runs in a temporary copy.
4. Assert at least the following are mutation-covered: live-lock takeover, double restart, phase re-execution, merge reachability, subscriber stall, blind unknown retry, fabricated heartbeat.
5. Record any rule that cannot be mutated and explain why in §8.

**Expected Outcome**:
- The key assertions are proven to fail when their rule is broken; the suite is not vacuous.

#### TC-CONFIG-001 - Every `daemon.*` key is configuration-only and fail-closed

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-10, AC-F5-1, AC-F14-1, Appendix E
**Test Type(s)**: Behaviour, Config
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-lifecycle.test.ts`, `tests/behaviour/daemon-polling.test.ts`, `tests/behaviour/config-schema.test.ts`, `tests/behaviour/config-resolver.test.ts`; `tests/fixtures/daemon/config/keys/**`
**Tags**: @backend, @daemon, @config

**Preconditions**:
- Paired fixtures for every `daemon.*` key: heartbeat interval, heartbeat cycle, lock staleness, poll interval, watch poll interval, response timeout, subscription buffer, frame max bytes, reconcile max lanes, transport, socket path.
- One valid and one invalid value per key.

**Steps**:
1. For each interval/size key, change only configuration and assert the observed behavior changes (heartbeat cadence, staleness boundary, timeout, buffer, frame refusal, reconciliation cap).
2. Assert an invalid value (`0`, negative, non-integer, wrong type, outside-path) refuses `config.value.invalid` naming the key.
3. Assert provenance reports the changed value and its origin.
4. Assert no source diff accompanies the behavior change.
5. Assert every absent key resolves to the Appendix E default.

**Expected Outcome**:
- Every daemon key is data with a default and a fail-closed validation; no behavior is hardcoded.

## 6. Environments and Test Data

- **Runtime**: Bun (`bun test`) on the repository's pinned version; TypeScript strict mode; `pnpm check` is the aggregate gate. No test requires a live tracker, VCS, CI, provider, deploy trace, daemon, supervisor, or credential.
- **Injected seams**: clock, state store/fence, daemon-lock port, process supervisor, lane executor, `HarnessSessionPort`, external-effect adapters, supervisor adapter, event-log tail, transport factory, instance-identity source, the additive bounded `logSince(baselineHead)` git read (each commit's SHA and normalized changed-path set), and the lane/one-shot owner harness that restores a phase binding. The control protocol runs over an in-memory stdio transport pair (and an in-memory unix-like pair for equivalence); the daemon runs in-process.
- **Hermeticity**: zero live network calls, zero live credential reads, zero real sleeps, zero real sockets, zero systemd/launchd/Windows manager calls. A throwing `globalThis.fetch` guard is armed for the daemon, protocol, watch, effect, and supervisor suites; a missing fixture fails naming the missing fixture rather than silently skipping. The single optional real-child start/stop smoke is timeout-guarded and disabled unless explicitly enabled.
- **State**: temporary stores per test through `tests/fixtures/state/harness.ts` (temp root, injected edge, mutable clock, fence, verified reads); cleanup on exit. No test writes the repository's real state directory or the user's real state/home.
- **Time**: every heartbeat, staleness, response-timeout, watch-poll, and backoff boundary is an exact injected instant; boundary values are tested at `bound - 1`, `bound`, and `bound + 1`. All windows are UTC.
- **Concurrency**: deterministic, fixture-driven. The lock harness serializes acquisition attempts and uses a barrier at the staleness read; the protocol harness schedules connections and subscriber buffers in a declared order. No real OS race, worker thread, or timer is used (GAP-T1).
- **Transport**: an in-memory ordered byte-stream pair implements the transport interface. The stdio pair is the conformance default; the unix-like pair proves equivalence. No file descriptor is opened by the equivalence suite.
- **Supervisor**: an injected supervisor adapter returns success, linger failure, or unsupported with platform evidence. The unit content is asserted as text; no host unit is read or written.
- **Performance reference**: NFR-6 is measured on the reference CI class with warm-up; the measured baseline is recorded in §10. Local variance is not a correctness regression (GAP-T3).
- **Golden data**: normalized JSON and human output under `tests/fixtures/daemon/golden/**`; no absolute paths, hostnames, user names, wall-clock timestamps, product tokens, lock tokens, or unstable ordering. The socket path appears in a golden only as the normalized `<state-dir>/daemon.sock` placeholder. Watch goldens are split by surface: `tests/golden/watch-queue.test.ts`, `tests/golden/watch-lanes.test.ts`, and `tests/golden/lanes-watch-accepted.test.ts` cover accepted streaming/degraded polling, while `tests/golden/watch-refusal-absent.test.ts` covers the absent-daemon degraded acceptance. Regeneration is an explicit command, never a blanket rewrite.
- **Security data**: canaries are synthetic and clearly non-secret; no real credential value is committed. Redaction fixtures are inert strings.

**Fixture and state-corpus needs** (proposed; delivery-bound names):

| Corpus | Contents | Proposed location |
|---|---|---|
| Lifecycle | start/stop/status/install cases, foreground/resident, absent/stale/stopped matrices, envelope/exit cases, human goldens | `tests/fixtures/daemon/lifecycle/**`, `tests/fixtures/daemon/golden/**` |
| Lock | live/at-bound/stale matrices, 100 contenders, takeover evidence, two scopes, fence separation | `tests/fixtures/daemon/lock/**` |
| State mediation | daemon-down mutations, reconcile intents, poke/tail/poll, wake loss, reconstruction, compatibility stores | `tests/fixtures/daemon/state/**` |
| Wire | frame corpus per kind/type, version matrix, malformed frames, overflow, slow subscribers, secrets, principal, control | `tests/fixtures/daemon/wire/**` |
| Transport | stdio and unix-like pairs, permission matrix, path variants, declared-not-delivered values, open failures | `tests/fixtures/daemon/transport/**` |
| Heartbeat | content, interval boundaries, stop, unclean kill, no-fabrication cases | `tests/fixtures/daemon/heartbeat/**` |
| Reconciliation | alive/interrupted/crashed, evidence-insufficient, ledger resume, replay, budget exhaustion, questions, crash points, unreadable stores | `tests/fixtures/daemon/reconciliation/**` |
| Lanes | supervision cycle, no-executor, prefill, stall, lane records | `tests/fixtures/daemon/lanes/**` |
| Effects | state machine, query found/not-found/unreadable, pre-commit intent + `logSince(baselineHead)` match, negative controls, adapter inventory | `tests/fixtures/daemon/effects/**` |
| Preemption | active, boundary, restart, no-session, single-flight | `tests/fixtures/daemon/preemption/**` |
| Degradation | daemon-down matrix, status matrix, unreadable state | `tests/fixtures/daemon/degradation/**` |
| Watch | queue/lanes streams, dedupe, overflow, degraded polling, unreadable state, accepted (`lanes-watch-accepted`) and absent-daemon (`watch-refusal-absent`) goldens | `tests/fixtures/daemon/watch/**` |
| Polling | backoff sequences, spacing, config pairs, read-seam cases | `tests/fixtures/daemon/polling/**` |
| Supervisor | unit content, linger, rollback, uninstall, unsupported platforms | `tests/fixtures/daemon/supervisor/**` |
| Vocabulary | record-kind seeds, error rows, config keys, principal records, state-dir scope digests, closed sets | `tests/fixtures/daemon/vocabulary/**`, `tests/fixtures/daemon/errors/**` |
| Merge absence | negative import fixture, reachability fixture, status composition | `tests/fixtures/daemon/merge-absence/**` |
| Cross-cutting | determinism corpus, bounds corpus, privacy canaries, mutation copies | `tests/fixtures/daemon/{determinism,bounds,privacy,mutants}/**` |

## 7. Automation Plan and Implementation Mapping

All scenarios are **To Implement** in this change except where an existing suite is extended. Every TC below appears in §5.1 and §5.2. `chg-GH-238-plan.yaml` (12 phases) is the sequencing authority; §7.1 records the phase-surface split and the plan-remediation closure of every formerly named gap, and §7.2 maps each TC onto its plan phase.

| TC ID | Test file(s) to create or update | Execution | Status |
|---|---|---|---|
| TC-LIFE-001 | `tests/behaviour/daemon-lifecycle.test.ts` | `bun test tests/behaviour/daemon-lifecycle.test.ts` | To Implement |
| TC-LIFE-002 | `tests/behaviour/daemon-lifecycle.test.ts` | `bun test tests/behaviour/daemon-lifecycle.test.ts` | To Implement |
| TC-LIFE-003 | `tests/behaviour/daemon-lifecycle.test.ts`, `tests/golden/daemon-lifecycle.test.ts` | `bun test tests/behaviour/daemon-lifecycle.test.ts tests/golden/daemon-lifecycle.test.ts` | To Implement |
| TC-LIFE-004 | `tests/behaviour/daemon-degradation.test.ts` | `bun test tests/behaviour/daemon-degradation.test.ts` | To Implement |
| TC-LIFE-005 | `tests/behaviour/daemon-degradation.test.ts`, `tests/golden/daemon-status-matrix.test.ts` | `bun test tests/behaviour/daemon-degradation.test.ts tests/golden/daemon-status-matrix.test.ts` | To Implement |
| TC-LIFE-006 | `tests/behaviour/daemon-lifecycle.test.ts` | `bun test tests/behaviour/daemon-lifecycle.test.ts` | To Implement |
| TC-LIFE-007 | `tests/behaviour/daemon-lifecycle.test.ts` | `bun test tests/behaviour/daemon-lifecycle.test.ts` | To Implement |
| TC-LIFE-008 | `tests/golden/daemon-lifecycle.test.ts`, `tests/behaviour/daemon-lifecycle.test.ts` | `bun test tests/golden/daemon-lifecycle.test.ts tests/behaviour/daemon-lifecycle.test.ts` | To Implement |
| TC-LOCK-001 | `tests/behaviour/daemon-lock.test.ts` | `bun test tests/behaviour/daemon-lock.test.ts` | To Implement |
| TC-LOCK-002 | `tests/behaviour/daemon-lock.test.ts` | `bun test tests/behaviour/daemon-lock.test.ts` | To Implement |
| TC-LOCK-003 | `tests/behaviour/daemon-lock.test.ts` | `bun test tests/behaviour/daemon-lock.test.ts` | To Implement |
| TC-LOCK-004 | `tests/behaviour/daemon-lock.test.ts` | `bun test tests/behaviour/daemon-lock.test.ts` | To Implement |
| TC-LOCK-005 | `tests/behaviour/daemon-lock-concurrency.test.ts` | `bun test tests/behaviour/daemon-lock-concurrency.test.ts` | To Implement |
| TC-LOCK-006 | `tests/structure/daemon-contract.test.ts`, `tests/behaviour/daemon-lock.test.ts` | `bun test tests/structure/daemon-contract.test.ts tests/behaviour/daemon-lock.test.ts` | To Implement |
| TC-STATE-001 | `tests/behaviour/daemon-state-mediation.test.ts`, `tests/behaviour/queue-cli.test.ts` | `bun test tests/behaviour/daemon-state-mediation.test.ts tests/behaviour/queue-cli.test.ts` | To Implement |
| TC-STATE-002 | `tests/behaviour/daemon-state-mediation.test.ts`, `tests/behaviour/blockers-publish.test.ts` | `bun test tests/behaviour/daemon-state-mediation.test.ts tests/behaviour/blockers-publish.test.ts` | To Implement |
| TC-STATE-003 | `tests/behaviour/daemon-state-mediation.test.ts` | `bun test tests/behaviour/daemon-state-mediation.test.ts` | To Implement |
| TC-STATE-004 | `tests/behaviour/daemon-state-mediation.test.ts` | `bun test tests/behaviour/daemon-state-mediation.test.ts` | To Implement |
| TC-STATE-005 | `tests/behaviour/daemon-state-mediation.test.ts` | `bun test tests/behaviour/daemon-state-mediation.test.ts` | To Implement |
| TC-STATE-006 | `tests/behaviour/daemon-state-mediation.test.ts`, `tests/checks/daemon-hermetic.test.ts` | `bun test tests/behaviour/daemon-state-mediation.test.ts tests/checks/daemon-hermetic.test.ts` | To Implement |
| TC-WIRE-001 | `tests/behaviour/control-codec.test.ts` | `bun test tests/behaviour/control-codec.test.ts` | To Implement |
| TC-WIRE-002 | `tests/behaviour/control-session.test.ts` | `bun test tests/behaviour/control-session.test.ts` | To Implement |
| TC-WIRE-003 | `tests/behaviour/control-session.test.ts` | `bun test tests/behaviour/control-session.test.ts` | To Implement |
| TC-WIRE-004 | `tests/behaviour/control-session.test.ts`, `tests/checks/daemon-bounds.test.ts` | `bun test tests/behaviour/control-session.test.ts tests/checks/daemon-bounds.test.ts` | To Implement |
| TC-WIRE-005 | `tests/behaviour/control-session.test.ts` | `bun test tests/behaviour/control-session.test.ts` | To Implement |
| TC-WIRE-006 | `tests/checks/daemon-hermetic.test.ts`, `tests/checks/secret-read-boundary.test.ts` | `bun test tests/checks/daemon-hermetic.test.ts tests/checks/secret-read-boundary.test.ts` | Existing — Update |
| TC-WIRE-007 | `tests/structure/daemon-contract.test.ts`, `tests/behaviour/control-codec.test.ts` | `bun test tests/structure/daemon-contract.test.ts tests/behaviour/control-codec.test.ts` | To Implement |
| TC-WIRE-008 | `tests/behaviour/control-session.test.ts`, `tests/behaviour/daemon-lifecycle.test.ts` | `bun test tests/behaviour/control-session.test.ts tests/behaviour/daemon-lifecycle.test.ts` | To Implement |
| TC-TRANSPORT-001 | `tests/behaviour/control-conformance.test.ts` | `bun test tests/behaviour/control-conformance.test.ts` | To Implement |
| TC-TRANSPORT-002 | `tests/behaviour/control-transport.test.ts` | `bun test tests/behaviour/control-transport.test.ts` | To Implement |
| TC-TRANSPORT-003 | `tests/behaviour/control-transport.test.ts`, `tests/behaviour/config-schema.test.ts` | `bun test tests/behaviour/control-transport.test.ts tests/behaviour/config-schema.test.ts` | To Implement |
| TC-TRANSPORT-004 | `tests/behaviour/control-transport.test.ts` | `bun test tests/behaviour/control-transport.test.ts` | To Implement |
| TC-TRANSPORT-005 | `tests/behaviour/control-transport.test.ts` | `bun test tests/behaviour/control-transport.test.ts` | To Implement |
| TC-CONC-001 | `tests/behaviour/control-connection.test.ts` | `bun test tests/behaviour/control-connection.test.ts` | To Implement |
| TC-CONC-002 | `tests/behaviour/daemon-state-mediation.test.ts` | `bun test tests/behaviour/daemon-state-mediation.test.ts` | To Implement |
| TC-CONC-003 | `tests/behaviour/daemon-state-mediation.test.ts` | `bun test tests/behaviour/daemon-state-mediation.test.ts` | To Implement |
| TC-CONC-004 | `tests/behaviour/daemon-degradation.test.ts`, `tests/behaviour/control-connection.test.ts` | `bun test tests/behaviour/daemon-degradation.test.ts tests/behaviour/control-connection.test.ts` | To Implement |
| TC-CONC-005 | `tests/behaviour/control-connection.test.ts`, `tests/behaviour/control-session.test.ts` | `bun test tests/behaviour/control-connection.test.ts tests/behaviour/control-session.test.ts` | To Implement |
| TC-HEART-001 | `tests/behaviour/daemon-heartbeat.test.ts` | `bun test tests/behaviour/daemon-heartbeat.test.ts` | To Implement |
| TC-HEART-002 | `tests/behaviour/daemon-heartbeat.test.ts` | `bun test tests/behaviour/daemon-heartbeat.test.ts` | To Implement |
| TC-RECON-001 | `tests/behaviour/daemon-reconciliation.test.ts` | `bun test tests/behaviour/daemon-reconciliation.test.ts` | To Implement |
| TC-RECON-002 | `tests/behaviour/daemon-reconciliation.test.ts` | `bun test tests/behaviour/daemon-reconciliation.test.ts` | To Implement |
| TC-RECON-003 | `tests/behaviour/daemon-reconciliation.test.ts` | `bun test tests/behaviour/daemon-reconciliation.test.ts` | To Implement |
| TC-RECON-004 | `tests/behaviour/daemon-reconciliation.test.ts` | `bun test tests/behaviour/daemon-reconciliation.test.ts` | To Implement |
| TC-RECON-005 | `tests/behaviour/daemon-reconciliation.test.ts` | `bun test tests/behaviour/daemon-reconciliation.test.ts` | To Implement |
| TC-RECON-006 | `tests/behaviour/daemon-reconciliation.test.ts`, `tests/behaviour/blockers-publish.test.ts` | `bun test tests/behaviour/daemon-reconciliation.test.ts tests/behaviour/blockers-publish.test.ts` | To Implement |
| TC-RECON-007 | `tests/behaviour/daemon-reconciliation-crash.test.ts`, `tests/behaviour/commit-act.test.ts` | `bun test tests/behaviour/daemon-reconciliation-crash.test.ts tests/behaviour/commit-act.test.ts` | To Implement |
| TC-RECON-008 | `tests/behaviour/daemon-reconciliation-crash.test.ts`, `tests/behaviour/daemon-effects.test.ts` | `bun test tests/behaviour/daemon-reconciliation-crash.test.ts tests/behaviour/daemon-effects.test.ts` | To Implement |
| TC-RECON-009 | `tests/behaviour/daemon-reconciliation.test.ts` | `bun test tests/behaviour/daemon-reconciliation.test.ts` | To Implement |
| TC-LANE-001 | `tests/behaviour/daemon-lane-supervision.test.ts` | `bun test tests/behaviour/daemon-lane-supervision.test.ts` | To Implement |
| TC-LANE-002 | `tests/structure/daemon-imports.test.ts`, `tests/checks/daemon-hermetic.test.ts`, `tests/behaviour/daemon-effects.test.ts` | `bun test tests/structure/daemon-imports.test.ts tests/checks/daemon-hermetic.test.ts tests/behaviour/daemon-effects.test.ts` | To Implement |
| TC-LANE-003 | `tests/behaviour/daemon-lane-supervision.test.ts` | `bun test tests/behaviour/daemon-lane-supervision.test.ts` | To Implement |
| TC-LANE-004 | `tests/behaviour/daemon-lane-supervision.test.ts` | `bun test tests/behaviour/daemon-lane-supervision.test.ts` | To Implement |
| TC-LANE-005 | `tests/behaviour/daemon-lane-supervision.test.ts` | `bun test tests/behaviour/daemon-lane-supervision.test.ts` | To Implement |
| TC-LANE-006 | `tests/structure/daemon-contract.test.ts`, `tests/behaviour/daemon-lane-supervision.test.ts` | `bun test tests/structure/daemon-contract.test.ts tests/behaviour/daemon-lane-supervision.test.ts` | To Implement |
| TC-EFFECT-001 | `tests/behaviour/daemon-effects.test.ts` | `bun test tests/behaviour/daemon-effects.test.ts` | To Implement |
| TC-EFFECT-002 | `tests/behaviour/daemon-effects.test.ts` | `bun test tests/behaviour/daemon-effects.test.ts` | To Implement |
| TC-EFFECT-003 | `tests/behaviour/daemon-effects.test.ts` | `bun test tests/behaviour/daemon-effects.test.ts` | To Implement |
| TC-EFFECT-004 | `tests/behaviour/daemon-effects.test.ts` | `bun test tests/behaviour/daemon-effects.test.ts` | To Implement |
| TC-EFFECT-005 | `tests/behaviour/daemon-effects.test.ts` | `bun test tests/behaviour/daemon-effects.test.ts` | To Implement |
| TC-EFFECT-006 | `tests/structure/daemon-imports.test.ts`, `tests/checks/daemon-hermetic.test.ts` | `bun test tests/structure/daemon-imports.test.ts tests/checks/daemon-hermetic.test.ts` | To Implement |
| TC-PREEMPT-001 | `tests/behaviour/daemon-preemption.test.ts` | `bun test tests/behaviour/daemon-preemption.test.ts` | To Implement |
| TC-PREEMPT-002 | `tests/behaviour/daemon-preemption.test.ts` | `bun test tests/behaviour/daemon-preemption.test.ts` | To Implement |
| TC-PREEMPT-003 | `tests/behaviour/daemon-preemption.test.ts` | `bun test tests/behaviour/daemon-preemption.test.ts` | To Implement |
| TC-PREEMPT-004 | `tests/behaviour/daemon-preemption.test.ts` | `bun test tests/behaviour/daemon-preemption.test.ts` | To Implement |
| TC-PREEMPT-005 | `tests/behaviour/daemon-preemption.test.ts` | `bun test tests/behaviour/daemon-preemption.test.ts` | To Implement |
| TC-DEGRADE-001 | `tests/behaviour/daemon-degradation.test.ts`, `tests/behaviour/queue-cli.test.ts`, `tests/behaviour/lanes.test.ts` | `bun test tests/behaviour/daemon-degradation.test.ts tests/behaviour/queue-cli.test.ts tests/behaviour/lanes.test.ts` | To Implement |
| TC-DEGRADE-002 | `tests/behaviour/daemon-degradation.test.ts` | `bun test tests/behaviour/daemon-degradation.test.ts` | To Implement |
| TC-DEGRADE-003 | `tests/behaviour/daemon-degradation.test.ts`, `tests/golden/daemon-status-matrix.test.ts` | `bun test tests/behaviour/daemon-degradation.test.ts tests/golden/daemon-status-matrix.test.ts` | To Implement |
| TC-DEGRADE-004 | `tests/behaviour/daemon-degradation.test.ts` | `bun test tests/behaviour/daemon-degradation.test.ts` | To Implement |
| TC-WATCH-001 | `tests/behaviour/queue-watch.test.ts`, `tests/golden/watch-queue.test.ts` | `bun test tests/behaviour/queue-watch.test.ts tests/golden/watch-queue.test.ts` | To Implement |
| TC-WATCH-002 | `tests/behaviour/lanes-watch.test.ts`, `tests/golden/watch-lanes.test.ts`, `tests/golden/lanes-watch-accepted.test.ts` | `bun test tests/behaviour/lanes-watch.test.ts tests/golden/watch-lanes.test.ts tests/golden/lanes-watch-accepted.test.ts` | To Implement |
| TC-WATCH-003 | `tests/behaviour/queue-watch.test.ts`, `tests/behaviour/lanes-watch.test.ts`, `tests/golden/lanes-watch-accepted.test.ts`, `tests/golden/watch-refusal-absent.test.ts` | `bun test tests/behaviour/queue-watch.test.ts tests/behaviour/lanes-watch.test.ts tests/golden/lanes-watch-accepted.test.ts tests/golden/watch-refusal-absent.test.ts` | To Implement |
| TC-WATCH-004 | `tests/behaviour/queue-watch.test.ts`, `tests/behaviour/lanes-watch.test.ts`, `tests/golden/watch-unreadable.test.ts` | `bun test tests/behaviour/queue-watch.test.ts tests/behaviour/lanes-watch.test.ts` | To Implement |
| TC-WATCH-005 | `tests/behaviour/watch-stream.test.ts` | `bun test tests/behaviour/watch-stream.test.ts` | To Implement |
| TC-POLL-001 | `tests/behaviour/daemon-polling.test.ts` | `bun test tests/behaviour/daemon-polling.test.ts` | To Implement |
| TC-POLL-002 | `tests/behaviour/daemon-polling.test.ts`, `tests/checks/daemon-hermetic.test.ts` | `bun test tests/behaviour/daemon-polling.test.ts tests/checks/daemon-hermetic.test.ts` | To Implement |
| TC-POLL-003 | `tests/behaviour/daemon-polling.test.ts`, `tests/behaviour/config-resolver.test.ts` | `bun test tests/behaviour/daemon-polling.test.ts tests/behaviour/config-resolver.test.ts` | To Implement |
| TC-POLL-004 | `tests/structure/daemon-imports.test.ts`, `tests/checks/daemon-hermetic.test.ts` | `bun test tests/structure/daemon-imports.test.ts tests/checks/daemon-hermetic.test.ts` | To Implement |
| TC-INSTALL-001 | `tests/behaviour/daemon-supervisor-install.test.ts`, `tests/golden/daemon-install.test.ts` | `bun test tests/behaviour/daemon-supervisor-install.test.ts tests/golden/daemon-install.test.ts` | To Implement |
| TC-INSTALL-002 | `tests/behaviour/daemon-supervisor-install.test.ts` | `bun test tests/behaviour/daemon-supervisor-install.test.ts` | To Implement |
| TC-INSTALL-003 | `tests/behaviour/daemon-supervisor-install.test.ts` | `bun test tests/behaviour/daemon-supervisor-install.test.ts` | To Implement |
| TC-INSTALL-004 | `tests/behaviour/daemon-supervisor-install.test.ts` | `bun test tests/behaviour/daemon-supervisor-install.test.ts` | To Implement |
| TC-INSTALL-005 | `tests/behaviour/daemon-supervisor-install.test.ts`, `tests/behaviour/daemon-degradation.test.ts` | `bun test tests/behaviour/daemon-supervisor-install.test.ts tests/behaviour/daemon-degradation.test.ts` | To Implement |
| TC-INSTALL-006 | `tests/behaviour/daemon-supervisor-install.test.ts` | `bun test tests/behaviour/daemon-supervisor-install.test.ts` | To Implement |
| TC-INSTALL-007 | `tests/behaviour/daemon-supervisor-install.test.ts`, `tests/behaviour/daemon-lifecycle.test.ts` | `bun test tests/behaviour/daemon-supervisor-install.test.ts tests/behaviour/daemon-lifecycle.test.ts` | To Implement |
| TC-VOCAB-001 | `tests/structure/daemon-vocabulary.test.ts`, `tests/structure/state-contract.test.ts` | `bun test tests/structure/daemon-vocabulary.test.ts tests/structure/state-contract.test.ts` | To Implement |
| TC-VOCAB-002 | `tests/checks/error-table-sync.test.ts`, `tests/structure/error-table.test.ts` | `bun test tests/checks/error-table-sync.test.ts tests/structure/error-table.test.ts` | Existing — Update |
| TC-VOCAB-003 | `tests/structure/config-contract.test.ts`, `tests/behaviour/config-schema.test.ts` | `bun test tests/structure/config-contract.test.ts tests/behaviour/config-schema.test.ts` | Existing — Update |
| TC-VOCAB-004 | `tests/structure/daemon-vocabulary.test.ts`, `tests/behaviour/daemon-state-mediation.test.ts` | `bun test tests/structure/daemon-vocabulary.test.ts tests/behaviour/daemon-state-mediation.test.ts` | To Implement |
| TC-VOCAB-005 | `tests/structure/queue-scheduling-contract.test.ts`, `tests/behaviour/queue-cli.test.ts`, `tests/behaviour/lanes.test.ts`, `tests/golden/lanes-watch-accepted.test.ts`, `tests/golden/watch-refusal-absent.test.ts` | `bun test tests/structure/queue-scheduling-contract.test.ts tests/behaviour/queue-cli.test.ts tests/behaviour/lanes.test.ts tests/golden/lanes-watch-accepted.test.ts tests/golden/watch-refusal-absent.test.ts` | Existing — Update |
| TC-VOCAB-006 | `tests/checks/daemon-vocabulary.test.ts`, `tests/checks/error-table-sync.test.ts` | `bun test tests/checks/daemon-vocabulary.test.ts tests/checks/error-table-sync.test.ts` | To Implement |
| TC-VOCAB-007 | `tests/structure/daemon-vocabulary.test.ts`, `tests/structure/daemon-contract.test.ts` | `bun test tests/structure/daemon-vocabulary.test.ts tests/structure/daemon-contract.test.ts` | To Implement |
| TC-VOCAB-008 | `tests/behaviour/daemon-state-mediation.test.ts`, `tests/checks/daemon-hermetic.test.ts` | `bun test tests/behaviour/daemon-state-mediation.test.ts tests/checks/daemon-hermetic.test.ts` | To Implement |
| TC-MERGEABS-001 | `.dependency-cruiser.cjs`, `tests/structure/daemon-imports.test.ts`, `tests/boundaries/**`, `tests/boundaries/fixtures/cases.ts`, `tests/boundaries/fixture-registry.json` | `bun test tests/boundaries tests/structure/daemon-imports.test.ts`; `pnpm check:boundaries` | To Implement |
| TC-MERGEABS-002 | `tests/behaviour/daemon-lifecycle.test.ts`, `tests/structure/daemon-contract.test.ts`, `tests/structure/daemon-imports.test.ts`, `tests/boundaries/**` | `bun test tests/behaviour/daemon-lifecycle.test.ts tests/structure/daemon-contract.test.ts tests/boundaries`; `pnpm check:boundaries` | To Implement |
| TC-DET-001 | `tests/checks/daemon-determinism.test.ts` | `bun test tests/checks/daemon-determinism.test.ts` | To Implement |
| TC-HERMETIC-001 | `tests/checks/daemon-hermetic.test.ts` | `bun test tests/checks/daemon-hermetic.test.ts` | To Implement |
| TC-BOUNDS-001 | `tests/checks/daemon-bounds.test.ts`, `tests/behaviour/daemon-lifecycle.test.ts` | `bun test tests/checks/daemon-bounds.test.ts` | To Implement |
| TC-PRIVACY-001 | `tests/checks/daemon-hermetic.test.ts`, `tests/checks/secret-read-boundary.test.ts`, `scripts/checks/privacy-literals.ts` | `bun test tests/checks/daemon-hermetic.test.ts tests/checks/secret-read-boundary.test.ts`; `bun run scripts/checks/privacy-literals.ts` | Existing — Update |
| TC-META-001 | `tests/checks/daemon-mutants.test.ts` | `bun test tests/checks/daemon-mutants.test.ts` | To Implement |
| TC-CONFIG-001 | `tests/behaviour/daemon-lifecycle.test.ts`, `tests/behaviour/daemon-polling.test.ts`, `tests/behaviour/config-schema.test.ts`, `tests/behaviour/config-resolver.test.ts` | `bun test tests/behaviour/daemon-lifecycle.test.ts tests/behaviour/daemon-polling.test.ts tests/behaviour/config-schema.test.ts tests/behaviour/config-resolver.test.ts` | To Implement |

### 7.1 Phase-surface note

`chg-GH-238-plan.yaml` (`delivery.plan.v1`, 12 phases) is the sequencing authority for this change and supersedes the spec's §18 narrative order. Every TC's Target Layer below names a concrete file; the plan must declare the files named in **Plan obligations for plan v1.3 or later** at the end of this subsection in the named phase scopes and gates. Until those declarations land, this alignment is an open plan obligation recorded in T-RSK-9/OQ-T11, not a claim that the current plan already declares them.

A TC that spans a policy half and a command half is **partial** in the earlier phase and complete only where its surface lands:

| Group | Early-phase rows | Completing phase (plan) |
|---|---|---|
| TC-LIFE-001..008 | Phase 2 lock/instance/heartbeat state | Phase 5 lifecycle command, status projection, envelope and `tests/golden/daemon-lifecycle.test.ts`; Phase 9 3x2 status-matrix golden for TC-LIFE-005 |
| TC-LOCK-001..006 | Phase 2 lock engine, evidence, 100-contender harness | Phase 5 CLI refusal/takeover envelope and goldens |
| TC-STATE-001..006 | Phase 4 state mediation, reconciliation, wake folds | Phase 4 (reconcile), Phase 5 (queue/status), Phase 6 (`blockers-publish`), Phase 9 (daemon-down one-shot) |
| TC-WIRE-001..008 | Phase 1 contract declarations | Phase 3 codec/session/connection round-trip |
| TC-TRANSPORT-001..005 | Phase 3 transport pair, unix policy, declared-not-delivered, unopenable | Phase 5 degraded-start envelope |
| TC-CONC-001..005 | Phase 3 session/concurrency, same-connection control replay and cross-connection `id` distinction (TC-CONC-002/003 declare no Phase 3 assertion) | Phase 4 state-path same/different-key intent application; Phase 5 timeout fallback |
| TC-HEART-001..002 | Phase 2 heartbeat record and folds | Phase 5 stop-release evidence and status |
| TC-RECON-001..009 | Phase 4 classification/resume/budget/question | Phase 6 `blockers-publish` question path; Phase 7 commit crash convergence with the owner binding restoration |
| TC-LANE-001..006 | Phase 6 lane supervision | Phase 6 (TC-LANE-002 owner/redrive runtime proof shares the Phase 7 effect fixture) |
| TC-EFFECT-001..006 | Phase 7 effect primitive, records, path-set `logSince` match, four fail-closed outcomes and three negative controls | Phase 7 |
| TC-PREEMPT-001..005 | Phase 8 preemption | Phase 8 |
| TC-DEGRADE-001..004 | Phase 5 status/degradation | Phase 6 supervise-only; Phase 9 full one-shot matrix and `tests/golden/daemon-status-matrix.test.ts` |
| TC-WATCH-001..005 | Phase 9 watch streams, degraded polling, and the split accepted/absent goldens | Phase 9 |
| TC-POLL-001..004 | Phase 5 poll policy | Phase 9 watch-poll configuration |
| TC-INSTALL-001..007 | Phase 10 supervisor adapter, unit content, residency | Phase 10 |
| TC-VOCAB-001..008 | Phase 1 vocabulary/configuration/errors, including the concrete `config-schema`/`config-resolver` suites | Phase 11 documented-table direction, changeset, content inventory |
| TC-MERGEABS-001..002 | Phase 1 boundary rule and failing fixture | Phase 5 status composition; Phase 6 reachability from the composed daemon |
| TC-DET-001, TC-HERMETIC-001, TC-BOUNDS-001, TC-PRIVACY-001, TC-META-001, TC-CONFIG-001 | Phase 1/3/5 partial rows | Phase 9/11 aggregate `pnpm check`, `scripts/checks/privacy-literals.ts`, `tests/checks/daemon-mutants.test.ts` |

No assertion is weakened by the split: each half is still required at its real surface.

**Plan remediation resolved (plan `chg-GH-238-plan.yaml`, `delivery.plan.v1`, 12 phases):**

- **Every named fixture root is now declared in a phase scope.** `tests/fixtures/daemon/{hermetic,privacy,bounds}` are Phase 3 folders, `tests/fixtures/daemon/determinism` is Phase 5, `tests/fixtures/daemon/mutants` is Phase 11, `tests/fixtures/queue/{golden,e2e}` are Phase 9, and `tests/fixtures/blockers` is Phase 6. No TC in this plan targets an undeclared root.
- **`tests/golden/daemon-status-matrix.test.ts` is Phase 9 scope.** Phase 5 declares the `status --live` behaviour and `tests/behaviour/daemon-degradation.test.ts`, so Phase 5 coverage leaves **TC-LIFE-005** and **TC-DEGRADE-003** as behaviour halves; Phase 9 task 9.5 creates the 3x2 machine/human status matrix and Phase 9 coverage records both as completed ("TC-LIFE-005 (completes…)", "TC-DEGRADE-003 (completes…)").
- **TC-CONC-002 and TC-CONC-003 are Partial in Phase 3 with completion in Phase 4.** Phase 3 coverage declares both "partial: no assertion is claimed in this phase"; Phase 4 task 4.7 creates `tests/behaviour/daemon-state-mediation.test.ts` and runs the same-key and different-key state-path application with the daemon down and up (Phase 4 coverage lists TC-CONC-002/003).
- **`tests/behaviour/commit-act.test.ts` is created by Phase 7 task 7.6.** The task defines the crash-window contract — durable pre-commit `outbox.effect` intent carrying the path-set identity, simulated kill after the commit object lands, one bounded `logSince(baselineHead)` path-set match, no second commit, the three negative controls, and the owner's `commit-without-record` restoration — and names TC-RECON-007 and TC-EFFECT-005, so the path this plan adopts has a defining task once the plan wording is updated (obligations 4–6).
- **TC-META-001 is mapped in Phase 11.** Phase 11 coverage carries "TC-META-001 (completes: the mutation fixtures prove each key rule fails when broken…)", the Phase 11 folder list scopes `tests/fixtures/daemon/mutants`, and the Phase 11 gate runs `tests/checks/daemon-mutants.test.ts`; no earlier phase claims it.
- **The plan covers 102/102 TCs.** Its phase coverage names all 102 locally defined TCs with a completing phase, 36/36 ACs, all 18 NFRs, EVT-1..EVT-9, DM-1..DM-18, and the seven seeded scenario ids; its Phase 11 and Phase 12 PR-ready tasks assert "102/102 TCs". The only `TC-LEASE-002` mention in this plan is GH-237's inherited proof, not a local TC.

**Plan obligations for plan v1.3 or later — exact declarations the plan owner must make:**

1. **Version header.** Cite `chg-GH-238-spec.md` at v1.2 or later and this test plan at v1.3 or later (the current header cites spec v1.1 and test plan v1.1).
2. **Phase 1 scope and gate — concrete config suites.** Add `tests/behaviour/config-schema.test.ts` and `tests/behaviour/config-resolver.test.ts` (targets of TC-VOCAB-003, TC-TRANSPORT-003, TC-POLL-003, TC-CONFIG-001). Re-audit `tests/structure/config-contract.test.ts`, `tests/behaviour/config-provenance.test.ts`, `config-cli.test.ts`, and `config-restrictions.test.ts` for exact-set catalog assertions that the additive `daemon`/`poll` branches will break.
3. **Phase 1 boundary rule — adapters daemon path.** Add `^packages/adapters/src/daemon/` to the `daemon-merge-absence` rule's `from` set (task 1.7 currently lists only core and CLI) plus its failing fixture and registry entry (TC-MERGEABS-001/002).
4. **Phase 7 scope — production implementor and owner path.** Declare `packages/adapters/src/git/commit.ts` (role `producer`, the only production `CommitGitPort` implementor for the additive `logSince`), change `packages/core/src/contracts/commit.ts` to role `producer` for the same additive read, and declare the owner-side transition-restoration files, including `packages/cli/src/commands/phase.ts` and whichever phase-evidence/delta contract changes; the daemon composition must not own these (TC-RECON-007, TC-LANE-002).
5. **Phase 7 identity wording.** Replace the message identity in tasks 7.1, 7.2, 7.4, and 7.6 ("expected commit identity", "expected subject plus body fingerprint", "SHA, subject, body fingerprint") with the message-independent path-set identity: `baselineHead`, `changeRef`, `phase`, and the sorted normalized staged path set, matched on `logSince` by the normalized changed-path set (TC-EFFECT-005, TC-RECON-007).
6. **Phase 7/9 daemon redrive request.** Declare the DM-18 redrive request (carried by the existing `command.receipt` kind, evidence only) and the four fail-closed outcomes (`unknown`) plus the three negative controls in the task text and gate (TC-EFFECT-005, TC-RECON-007, TC-LANE-002).
7. **Phase 9 watch goldens — split, not overlap.** Rename `tests/golden/lanes-watch-refusal.test.ts` → `tests/golden/lanes-watch-accepted.test.ts` and `tests/fixtures/queue/golden/lanes-watch-refusal.json` → `tests/fixtures/queue/golden/lanes-watch-accepted.json`; keep `tests/golden/watch-refusal-absent.test.ts` as the distinct absent-daemon degraded suite. Update task 9.4, the Phase 9 scope, and the Phase 9 gate; remove the old `lanes-watch-refusal` names (TC-WATCH-002/003, TC-VOCAB-005).
8. **Phase 9 goldens.** Confirm `tests/golden/watch-queue.test.ts`, `watch-lanes.test.ts`, `lanes-watch-accepted.test.ts`, `watch-refusal-absent.test.ts`, `watch-unreadable.test.ts`, and `daemon-status-matrix.test.ts` are all declared in Phase 9 scope and gate.

### 7.2 Implementation-order mapping (plan phases 1–12)

1. **Phase 1 — vocabulary, contracts, configuration, error rows, boundary scaffolding**: TC-VOCAB-001..008 structure rows; TC-CONFIG-001 config half through `config-schema`/`config-resolver`; TC-WIRE-001/002/007 contract halves; TC-LANE-006 structure half; TC-MERGEABS-001 boundary fixture including the adapters daemon path.
2. **Phase 2 — daemon lock, instance ledger, heartbeat**: TC-LOCK-001..006 engine rows; TC-HEART-001/002; TC-LOCK-004 lock/instance half.
3. **Phase 3 — control protocol codec/session/connection/transport**: TC-WIRE-001..008; TC-TRANSPORT-001..005; TC-CONC-001/004/005 control-frame halves; TC-CONC-002/003 state-path half in Phase 4; TC-HERMETIC-001 wire half; TC-BOUNDS-001 frame/buffer half; TC-PRIVACY-001 wire half.
4. **Phase 4 — startup reconciliation and state mediation**: TC-RECON-001..006/009; TC-STATE-003/004/005/006; TC-CONC-002/003 state-path half.
5. **Phase 5 — resident runtime and the daemon command family**: TC-LIFE-001..008 (TC-LIFE-005 behaviour half); TC-LOCK-001/002 CLI completion; TC-STATE-001/002; TC-HEART-002 completion; TC-DEGRADE-003 behaviour half; TC-POLL-001..004; TC-MERGEABS-002; TC-CONFIG-001 behaviour half.
6. **Phase 6 — lane supervision**: TC-LANE-001..006; TC-STATE-002 completion; TC-STATE-006 completion; TC-MERGEABS-001 completion; TC-RECON-006 completion; TC-DEGRADE-002 supervise-only half.
7. **Phase 7 — external-effect protocol**: TC-EFFECT-001..006; TC-RECON-007/008 completion; the path-set identity and four fail-closed outcomes; the DM-18 redrive request; the owner-side binding restoration through `commit-without-record`.
8. **Phase 8 — safe-boundary preemption**: TC-PREEMPT-001..005.
9. **Phase 9 — bounded live watch and truthful degradation**: TC-WATCH-001..005; TC-DEGRADE-001/002/004 completion; TC-STATE-001 completion; TC-VOCAB-005 completion; TC-BOUNDS-001 completion; TC-CONFIG-001 watch keys; TC-LIFE-005 golden completion; the `lanes-watch-accepted`/`watch-refusal-absent` golden split.
10. **Phase 10 — optional scoped supervisor install**: TC-INSTALL-001..007.
11. **Phase 11 — documentation reconciliation, changeset, aggregate gates**: TC-VOCAB-002 documented direction; TC-VOCAB-006 changeset; TC-HERMETIC-001; TC-DET-001; TC-BOUNDS-001; TC-PRIVACY-001; TC-META-001; TC-MERGEABS-001/002; `pnpm check`; `scripts/checks/privacy-literals.ts`.
12. **Phase 12 — review remediation and release closure**: re-run any TC whose assertion changed; reconcile the §10 execution log.

**Mocking/injection requirements**: no `mock.module`; inject fakes for clock, state store/fence, daemon-lock port, process supervisor, lane executor, harness session, effect adapters, supervisor adapter, event-log tail, transport factory, instance identity, and the additive `logSince(baselineHead)` git read. The concurrency suites use scheduled harnesses, never real OS concurrency. Tests that need a conflict or a timeout assert the operation log and injected clock, not wall-clock timing. Tests that need a golden consume normalized output and fail naming a missing fixture rather than skipping.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

- **T-RSK-1 — Single-instance and subscriber concurrency are algorithmic, not OS-level (RSK-1, RSK-4; GAP-T1)**: the lock harness proves the staleness read plus single-writer gate under a forced interleaving; the protocol harness proves bounded buffers and dispatcher isolation under a declared schedule. Mitigation: TC-LOCK-005 asserts the operation order and the 1/99 split; TC-WIRE-003/004 assert one degraded event and continued service; review confirms the lock is acquired atomically and the dispatcher never awaits a peer write.
- **T-RSK-2 — Real cross-user refusal and real systemd linger/residency are environment concerns (GAP-T2)**: TC-TRANSPORT-002 asserts the permission policy and the `state.permission.denied` exit-1 refusal; TC-INSTALL-001/002/003/007 assert unit content and adapter outcomes, including residency through the injected supervisor. Mitigation: the production permission check is a small, reviewable seam; the unit is data-only, scoped, and uses the foreground entry under `Type=simple`.
- **T-RSK-3 — Crash convergence is fixture-driven (RSK-3)**: kill points are declared and simulated in memory; a real host restart is not exercised. Mitigation: TC-RECON-001..009 cover every classification and every restart counter path; TC-HERMETIC-001's optional real-child smoke bounds only the lifecycle envelope, not reconciliation.
- **T-RSK-4 — Effect convergence has no production tracker adapter (RSK-9)**: the protocol is proven over injected adapters. Mitigation: the commit half exercises the production mechanism — a pre-commit `outbox.effect` intent carrying the path-set identity plus one bounded `logSince(baselineHead)` match — with three negative controls (break the derivation, remove the query, break the match rule) and the four fail-closed `unknown` outcomes; the daemon records only the DM-18 redrive request and the owner restores the binding. The commit format and atomic primitive are unchanged. The tracker half is explicitly residual until a write adapter lands. This is an accepted spec boundary, not a test gap.
- **T-RSK-5 — NFR-6 latency is environment-sensitive (GAP-T3)**: the 50 ms p99 is measured on the reference CI class with a recorded baseline. Mitigation: the structural assertions (bounded buffer, one degraded event, continued service) hold independently.
- **T-RSK-6 — Delivery-bound names (GAP-T5)**: record keys, schemas, error codes, config keys, module paths, and the unit name are pinned by the spec appendices. Mitigation: fixtures use the pinned names; a test that cannot resolve a seam fails naming the missing contract.
- **T-RSK-7 — The `daemon install` linger-failure classification is semantically odd**: AC-F15-1 maps a permission/environment failure onto `daemon.supervisor-unsupported` (a platform-unsupported identity). It is testable exactly as written (TC-INSTALL-003), but the classification conflates "the platform has no adapter" with "linger could not be enabled". Mitigation: the test asserts the specified outcome and records the concern in §8.3 for the spec owner; it does not silently redefine the code.
- **T-RSK-8 — The `daemon status` uptime and restart facts must be state-derived**: F-7 says heartbeat is liveness evidence, while AC-F1-1 asks for uptime and restart reasons. Mitigation: TC-LIFE-003 and TC-HEART-001 derive both from the heartbeat/economics records; process introspection is structurally forbidden.
- **T-RSK-9 — Phase-surface alignment with `chg-GH-238-plan.yaml`**: the v1.2 remediation aligned every named fixture root and the status-matrix golden, and this revision names concrete files instead of the former `config-*.test.ts` wildcard and the overlapping `lanes-watch-refusal` golden. The plan must still declare the files listed under **Plan obligations for plan v1.3 or later** in §7.1: `tests/behaviour/config-schema.test.ts`, `tests/behaviour/config-resolver.test.ts`, the renamed `tests/golden/lanes-watch-accepted.test.ts` and fixture, `packages/adapters/src/git/commit.ts`, `packages/cli/src/commands/phase.ts` plus the evidence contract, the `^packages/adapters/src/daemon/` boundary path, and the path-set/redrive wording. Mitigation: this test plan names every file concretely and OQ-T11 records the exact declaration list; if the plan omits one, delivery fails naming the missing file rather than silently skipping. Once those declarations land, every TC Target Layer names a plan-declared file and no assertion is dropped by the split.

### 8.2 Assumptions

- The delivered state layer exposes verified reads, `readRecords`, `append`, `replaceDocument`, and a short-lived fence with writer-neutral semantics; the daemon lock is a separate artifact.
- The delivered `HarnessSessionPort` can spawn, observe, collect, classify, and report liveness; a declared gap is returned as a gap, not invented.
- The delivered restart-budget gate and economics records are the only counter; the daemon adds no second budget.
- The delivered scheduling engine owns readiness, precedence, claim, release, park, and preemption; the daemon consumes it.
- The delivered commit primitive provides atomic record-plus-commit; crash safety for commits comes from this change's durable pre-commit `outbox.effect` intent carrying `baselineHead`, change ref, phase, and the sorted normalized staged path set, matched by the additive bounded `logSince(baselineHead)` git read whose normalized changed-path set equals the recorded set — not from an idempotency property of the delivered primitive and never from the commit message.
- The git adapter can expose the additive `logSince(baselineHead)` read (each commit's SHA and normalized changed-path set, bounded and ordered) without changing the commit format, message composition, or the atomic primitive.
- The effect owner is the lane/one-shot process that owns the phase completion: it applies/re-applies and restores the binding through `commit-without-record`; the daemon only detects, queries once, and records the DM-18 redrive request.
- The commit message is model-authored on the production path and is never read, recorded, matched, or asserted by this plan; no template-only mode is introduced.
- The daemon lock token is a same-user ownership capability, never a credential; it is expected only in the three control-frame payloads and durable lock/instance records, never in a `daemon start`, `daemon stop`, or `daemon status` command envelope or golden.
- The state-directory scope is selected only by the brand-derived `<PREFIX>_STATE_DIR` environment variable when set, otherwise `<home>/<brand.stateDirectoryName>`; there is no `--state-dir` flag and no state-directory configuration key.
- The durable state-directory scope is the declared digest (SHA-256, first 16 lowercase hex of the canonical absolute path); the path→scope mapping is recoverable by recomputation, and the raw path is never stored.
- One state directory is one project scope; multiple projects use separate stores and separate daemons.
- The filesystem boundary is the only local authorization; `callerPrincipal` is unauthenticated and reserved.
- Linux is the supervisor target; macOS and Windows are classified unsupported outcomes.
- A queue entry maps to at most one supervised lane at a time; the delivered single-flight lease enforces it.
- The lane-executor port is injected until M1-S9; a missing executor is `supervise-only`.

### 8.3 Open Questions and Findings

| ID | Question / Finding | Disposition | Owner |
|----|--------------------|-------------|-------|
| OQ-T1 | AC-F15-1 classifies linger-enablement failure as `daemon.supervisor-unsupported`, which also means "no adapter for this platform". Is a distinct environmental code intended? | **Tested as written** (TC-INSTALL-003 asserts the specified code and rollback). Flagged to the spec owner as a semantic-conflation concern; not a blocker and not silently reinterpreted. | spec owner / PM |
| OQ-T2 | AC-F1-1 asks plain `daemon status` for uptime while F-7 makes the heartbeat the liveness evidence. Should uptime be derived from the heartbeat or the instance record? | **Resolved for testing** — derive from the durable heartbeat/instance records (TC-LIFE-003), never process introspection. The spec allows both as durable evidence; no contract change. | delivery |
| OQ-T3 | NFR-6's "50 ms p99 under 100 slow subscribers" has no stated reference environment. | **Resolved as a measurement note** — record the baseline on the reference CI class and assert the environment-independent structural properties (GAP-T3). A slower local machine is not a defect. | delivery / CI |
| OQ-T4 | How is a real cross-user socket connection simulated hermetically? | **Resolved as a policy-seam test** — TC-TRANSPORT-002 asserts the same-user allow/refuse policy, the delivered `state.permission.denied` at exit 1, and the 0700/0600 derivation; the actual kernel check remains operations verification (GAP-T2). | delivery |
| OQ-T5 | Should `daemon uninstall` run on an unsupported platform? | **Resolved as a noop at exit 0** — there is no artifact to remove (TC-INSTALL-006 step 5); this does not weaken AC-F15-2's install refusal. | delivery |
| OQ-T6 | SC-M1-17's `dispatch <ref>` clause and SC-M1-17b's mutual-exclusion proof. | **Inherited** — Appendix A pins the M1-S9 inheritance and SC-M1-17b to GH-237 AC-F4-1/AC-F4-2. This plan proves the daemon-down surface and does not re-prove `dispatch` or the lease algorithm (GAP-T6, GAP-T7). | PM / spec |
| OQ-T7 | Exact unit name, module paths, record keys, error codes, and fixture names. | **Delivery-bound** — pinned by spec Appendices D/E/F where possible; a rename is a contract change, not a test-only edit (GAP-T5). | delivery / naming lock |
| OQ-T8 | The plan did not declare several cross-cutting fixture roots (`tests/fixtures/daemon/{hermetic,bounds,privacy,mutants,determinism}`, `tests/fixtures/queue/e2e`, `tests/fixtures/blockers`) and created `daemon-status-matrix.test.ts` only in Phase 9 while TC-LIFE-005 needs it in Phase 5. | **Resolved by plan remediation** — every named root is now a declared phase folder: `daemon/{hermetic,privacy,bounds}` in Phase 3, `daemon/determinism` in Phase 5, `daemon/mutants` in Phase 11, `queue/{golden,e2e}` in Phase 9, and `blockers` in Phase 6. TC-LIFE-005 and TC-DEGRADE-003 are declared partial in Phase 5, with Phase 9 task 9.5 creating `tests/golden/daemon-status-matrix.test.ts` to complete both. Residual: delivery still fails naming a missing fixture (TC-HERMETIC-001 step 3). | delivery planning |
| OQ-T9 | Is the daemon lock token a "token" that fails the secret canary? | **Resolved and unambiguous** — the lock token is a same-user ownership capability, explicitly exempt from the canary set; it is permitted only in the three control payloads and durable lock/instance records, never in a `daemon start`/`stop`/`status` envelope or golden, and must carry no credential-shaped value (TC-WIRE-006 steps 2–3). Every credential/secret canary still fails if it transits. | spec owner (F-2/F-4) |
| OQ-T10 | `tests/behaviour/commit-act.test.ts` and the commit crash-window contract: the v1.2 task still describes a message identity (expected subject plus body fingerprint) and a daemon-side re-apply. | **Re-opened and re-derived** — TC-EFFECT-005 and TC-RECON-007 now exercise the message-independent path-set identity (`baselineHead`, change ref, phase, sorted normalized staged path set), the four fail-closed `unknown` outcomes, the three negative controls (derivation, query, match rule), the DM-18 redrive request, and the owner's `commit-without-record` restoration. The plan must rewrite tasks 7.1/7.2/7.4/7.6 accordingly and declare `packages/cli/src/commands/phase.ts` plus the evidence contract (§7.1 Plan obligations 4–6). Residual: plan v1.3 must remove every "expected subject/body fingerprint" wording. | delivery planning |
| OQ-T11 | The plan still declares no concrete config behaviour suite, still cites the overlapping `lanes-watch-refusal` golden, and still omits `packages/adapters/src/git/commit.ts` and the adapters daemon boundary path. | **Named here, declared by plan v1.3** — Phase 1 must declare `tests/behaviour/config-schema.test.ts` and `tests/behaviour/config-resolver.test.ts`; Phase 9 must rename `tests/golden/lanes-watch-refusal.test.ts` → `tests/golden/lanes-watch-accepted.test.ts` (fixture `lanes-watch-refusal.json` → `lanes-watch-accepted.json`) and keep `tests/golden/watch-refusal-absent.test.ts` distinct; Phase 7 must declare `packages/adapters/src/git/commit.ts` (producer) and `packages/cli/src/commands/phase.ts` plus the evidence contract; task 1.7 must add `^packages/adapters/src/daemon/` to the merge-absence `from` set. This is the exact list in §7.1. T-RSK-9 stays an open obligation until the plan declares it. | delivery planning |
| OQ-T12 | Plan/spec version hygiene. | **Flagged** — the plan header cites spec v1.1 and test plan v1.1; plan v1.3 or later must cite spec v1.2 or later and test plan v1.3 or later. No test assertion depends on the citation; this is a documentation-consistency fix. | delivery planning |

**Spec gap summary for PM**: the DoR-iteration-1 blocking test-planning gaps are closed (R-01, R-02, R-03, R-04, R-05, R-06, R-07, R-13/R-14..R-18). The DoR-iteration-2 test-planning corrections are applied here: N-01/N-02 (path-set identity, owner=lane/one-shot, four fail-closed outcomes, three mechanism negative controls, owner-restoration control, DM-18 redrive request, no message fixtures), N-08 (same-connection replay split from the cross-connection `id` collision), N-10 (concrete `config-schema`/`config-resolver` targets; the wildcard is gone), N-11 (separate injection and source-import proofs plus the adapters daemon path; stale `"absent"`/DM-8 rows fixed), N-12 (named executor resume/attach observable), N-13 (table rows restored), and N-14 (watch-golden split named; DM-18 traced; plan version hygiene flagged). OQ-T1 remains a semantic concern, and OQ-T11/OQ-T12 are the residual plan-declaration obligations. No acceptance criterion is untestable or self-contradictory.

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-07 | test-plan-writer | Initial plan from `chg-GH-238-spec.md` v1.0, `chg-GH-238-pm-notes.yaml`, the M1 design pack (architecture, daemon command, interactions, contracts, test scenarios), and the delivered state/result/config/scheduling/economics/blockers/harness/commit/merge substrates. 100 TCs; all 36 ACs traced; all 18 NFRs traced; all 9 events and 16 data-model elements traced; six seeded scenarios explicitly mapped with no weakening. Spec concerns OQ-T1 and OQ-T2 recorded for PM. |
| 1.1 | 2026-11-07 | test-plan-writer | Definition-of-Ready iteration-1 remediation against the remediated spec v1.1 and `chg-GH-238-plan.yaml` (12 phases): R-01 rewrote TC-CONC-002/003 as state-path concurrent intent application (daemon down and up) and added TC-CONC-005 for duplicate control-frame `id`; R-02 rewrote TC-RECON-007/TC-EFFECT-005 around the pre-commit `outbox.effect` intent plus bounded `logSince(baselineHead)` identity match with negative controls; R-03 scoped TC-WIRE-006's lock-token exemption; R-04 fixed TC-WIRE-001/002 to the Appendix B wire-type set and v1/v0 principal rules plus TC-VOCAB-004/008 additive-only; R-05 added `outbox.effect` `callerPrincipal?`; R-06 rewrote TC-STATE-003; R-07 added unit foreground/`Type=simple`/`Restart=on-failure` assertions and TC-INSTALL-007 residency; R-13 linked the plan and aligned Target Layers; R-14 `mergeCodePath` closed set; R-15 `state.permission.denied` and pinned exit 1; R-16 socket-path placeholder; R-17 scope digest; R-18 takeover split and seven seeded ids. Count 100 → 102 TCs. |
| 1.2 | 2026-11-07 | test-plan-writer | Reconciliation against the remediated `chg-GH-238-plan.yaml`: §7.1 replaces the carried-mismatch block with the resolved placement — all named fixture roots declared (Phase 3 hermetic/privacy/bounds, Phase 5 determinism, Phase 6 blockers, Phase 9 queue/golden+e2e, Phase 11 mutants); `tests/golden/daemon-status-matrix.test.ts`, TC-LIFE-005 and TC-DEGRADE-003 complete in Phase 9 task 9.5; TC-CONC-002/003 are Partial in Phase 3 with completion in Phase 4 task 4.7; `tests/behaviour/commit-act.test.ts` is created by Phase 7 task 7.6; TC-META-001 is mapped in Phase 11; plan coverage is 102/102 TCs. §8.3 closes OQ-T8 and OQ-T10 and narrows the residual list to OQ-T1, OQ-T7, GAP-T2 and GAP-T6/T7; §8.1 T-RSK-9 reflects the alignment. No assertion, TC id, or count changed: still 102 TCs and seven seeded ids. |
| 1.3 | 2026-11-08 | test-plan-writer | Definition-of-Ready iteration-2 remediation against spec v1.2 and TDR-0014 INV-1..INV-8. N-01/N-02: TC-EFFECT-005 and TC-RECON-007 re-derived from the production mechanism — pre-commit `outbox.effect` with `baselineHead`/change ref/phase/sorted normalized staged path set, one bounded `logSince(baselineHead)` read, `applied` only for exactly one new commit whose normalized changed-path set equals the recorded set, zero/multiple/mismatch/unreadable → `unknown` with no automatic re-apply, no second commit, no lost binding; the lane/one-shot owner restores the phase binding through `commit-without-record` (reads `both`, never `record-only`), the daemon records only the DM-18 redrive request; three mechanism negative controls plus the owner-restoration control; every subject/body-fingerprint fixture removed; TC-LANE-002 aligned. N-08: TC-CONC-005 splits same-connection replay from the cross-connection `id` collision with a global-key negative control. N-10: `config-*.test.ts` replaced by `tests/behaviour/config-schema.test.ts` and `config-resolver.test.ts` in TC-VOCAB-003, TC-TRANSPORT-003, TC-POLL-003, TC-CONFIG-001 and their automation rows; T-RSK-9 made truthful. N-11: TC-MERGEABS-001/002 separate the injected-executor reachability proof from the source-level import proof, add the adapters daemon path, and fix the AC-F1-1/TC-LIFE-003 `"absent"` and DM-8 v1-only rows. N-12: TC-STATE-003 asserts exactly one executor resume/attach call for the answer, zero without a lane, the lane `resumeIntent`/state transition, and `applied: false`. N-13: §4 table rows restored. N-14: watch goldens split into `lanes-watch-accepted` and `watch-refusal-absent`; DM-18 traced (DM-1..DM-18); plan-version hygiene flagged. Counts unchanged: 102 TCs, 36/36 ACs, 18/18 NFRs, EVT-1..EVT-9, DM-1..DM-18, seven seeded ids. No TC id was added or removed; the existing ids were retitled/oracle-rewritten in place. |

## 10. Test Execution Log

Populated during delivery and quality gates. No execution has occurred at authoring time. The v1.1 Definition-of-Ready iteration-1 remediation and the v1.3 iteration-2 remediation changed assertions and oracle derivations only; the v1.2 plan-alignment reconciliation changed planning notes only. No test has been run.

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| — | — | NOT RUN | Plan authored; delivery has not started. |

### 10.1 Delivery execution log (2026-11-08)

Every row below records the phase gate that executed it. A named gap is not a pass.

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| TC-BOUNDS-001 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-CONC-001 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-CONC-002 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-CONC-003 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-CONC-004 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-CONC-005 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-CONFIG-001 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-DEGRADE-001 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-DEGRADE-002 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-DEGRADE-003 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-DEGRADE-004 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-DET-001 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-EFFECT-001 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-EFFECT-002 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-EFFECT-003 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-EFFECT-004 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-EFFECT-005 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-EFFECT-006 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-HEART-001 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-HEART-002 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-HERMETIC-001 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-INSTALL-001 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-INSTALL-002 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-INSTALL-003 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-INSTALL-004 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-INSTALL-005 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-INSTALL-006 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-INSTALL-007 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-LANE-001 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-LANE-002 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-LANE-003 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-LANE-004 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-LANE-005 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-LANE-006 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-LEASE-002 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-LIFE-001 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-LIFE-002 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-LIFE-003 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-LIFE-004 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-LIFE-005 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-LIFE-006 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-LIFE-007 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-LIFE-008 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-LOCK-001 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-LOCK-002 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-LOCK-003 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-LOCK-004 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-LOCK-005 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-LOCK-006 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-MERGEABS-001 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-MERGEABS-002 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-META-001 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-POLL-001 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-POLL-002 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-POLL-003 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-POLL-004 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-PREEMPT-001 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-PREEMPT-002 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-PREEMPT-003 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-PREEMPT-004 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-PREEMPT-005 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-PRIVACY-001 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-RECON-001 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-RECON-002 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-RECON-003 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-RECON-004 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-RECON-005 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-RECON-006 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-RECON-007 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-RECON-008 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-RECON-009 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-STATE-001 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-STATE-002 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-STATE-003 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-STATE-004 | 2026-11-08 | GAP | GAP-RECORDED: wake port delivered and injected; no dedicated wake suite in this delivery. |
| TC-STATE-005 | 2026-11-08 | GAP | GAP-RECORDED: lost-wake durability is structural (next wake re-reads state); no dedicated suite. |
| TC-STATE-006 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-TRANSPORT-001 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-TRANSPORT-002 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-TRANSPORT-003 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-TRANSPORT-004 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-TRANSPORT-005 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-VOCAB-001 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-VOCAB-002 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-VOCAB-003 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-VOCAB-004 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-VOCAB-005 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-VOCAB-006 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-VOCAB-007 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-VOCAB-008 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-WATCH-001 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-WATCH-002 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-WATCH-003 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-WATCH-004 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-WATCH-005 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-WIRE-001 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-WIRE-002 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-WIRE-003 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-WIRE-004 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-WIRE-005 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-WIRE-006 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-WIRE-007 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |
| TC-WIRE-008 | 2026-11-08 | PASS | Phase gate green locally (see pm-notes phase evidence). |

**Aggregate:** 36/36 ACs traced; 102/102 TCs recorded (100 PASS, 2 named gaps); 18/18 NFRs evidenced or boundaried; the seven seeded scenarios (SC-M1-14/15/16/17/17b/18/20) are covered by the named suites. TC-LEASE-002 belongs to the delivered GH-237 base and is re-verified unchanged.
