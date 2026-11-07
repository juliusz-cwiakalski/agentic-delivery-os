---
id: chg-GH-235-test-plan
status: Proposed
version: 1.0
created: 2026-11-07T00:00:00Z
last_updated: 2026-11-07T00:00:00Z
owners: [engineering]
service: delivery-os session lifecycle core (liveness signal sourcing, restart budget, resume economics)
labels: [change, m1]
version_impact: minor
summary: "Verify session lifecycle economics contract-first: heartbeat age, session traffic, and token delta are sourced at the harness-adapter seam and projected into the unchanged watchdog signal shape with absent kinds staying absent and no CPU field anywhere, a prefilling or resuming session classifies progressing and is never killed or restarted (SC-M1-14), a corroborated stall gains exactly one machine identity at exit 1 while progressing stays exit 0 and source-unavailable stays exit 2, resume economics prefer attach-and-continue without prefill re-pay and refuse within-budget uneconomical re-entry with a named reason, a durable per-delivery restart budget appends one restart event per admitted restart and refuses past-budget attempts before any spawn with a classified loud terminal exhaustion record identical on daemon-style and one-shot paths (SC-M1-15 economics half), restart count/history/amplification reconstruct from state alone with null-with-warning degradation, the two lane configuration keys own their defaults and validation, and the four new error-table rows bind two-way with zero existing rows modified. Thirty-seven scenarios across structure, types, conformance, behaviour, golden, and checks suites, traced to all thirteen acceptance criteria."
links:
  change_spec: ./chg-GH-235-spec.md
  implementation_plan: null
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - M1-S15: Session lifecycle economics

## 1. Scope and Objectives

This change kills the resume-loop amplification class, so the plan protects five properties at once and each one is a structural guarantee rather than a behavioural hope. **Signal honesty**: progress signals are sourced read-only at the harness-adapter seam into the already-declared watchdog shape, an unsourced kind stays absent (never zero), and CPU is not a signal anywhere, so a source-less lane still answers `watchdog.signals-absent` at exit `2` (AC-F1-1, AC-F1-2, NFR-2). **Prefill safety**: the delivered corroboration rule now runs on real values, so a large prefilling or resuming session — rising token delta and/or traffic, no output yet — classifies `progressing` with no kill, no restart event, and unchanged lane state; `stalled` requires heartbeat age at or beyond the bound AND token delta `0` AND traffic `0` (AC-F2-1, AC-F2-2, NFR-1, SC-M1-14). **Economics classification**: a declared attach capability continues without re-paying prefill and consumes no ordinal, while a re-entry that must re-pay is refused with `dispatch.resume-uneconomical` and named re-pay evidence (AC-F3-1, AC-F3-2). **Bounded durability**: one restart event per admitted restart, a fail-closed gate composed by every resume path, and a refusal past budget that happens before any spawn, is classified `dispatch.restart-budget-exceeded` at exit `1`, and leaves a terminal exhaustion record carrying the history the later queue/question/daemon consumers need (AC-F4-1..AC-F4-4, NFR-3, NFR-4, SC-M1-15 economics half). **Closed machine surface**: one new `watchdog` identity and two new `dispatch` identities, exactly one exclusive v1 envelope per invocation, exits only in `{0, 1, 2}` with exit `2` still reserved for source-unavailable, and four documented rows bound two-way to the table (AC-F5-1, NFR-6..NFR-8). Per-delivery restart count and amplification reconstruct from durable records alone, degrading to null-with-warning rather than fabricating a figure (AC-F6-1, NFR-5).

This document is a verification map, not an execution claim: no command was run against a new implementation at authoring time. Where the spec leaves a shape to delivery (record-kind names, module paths, the exact amplification formula), the scenarios assert the declared property and name the seam, never a guessed spelling.

### 1.1 In Scope

- Adapter-level sourcing of heartbeat age, session traffic, and token delta, the neutral liveness assembly, and the watchdog bridge that projects all three declared keys with absent keys staying absent (F-1; DM-1; AC-F1-1).
- Preserved source-less classification: declared-gap harnesses and source-less lanes answer `watchdog.signals-absent`, exit `2`, no verdict, never a guessed or CPU-substituted reading (F-1; AC-F1-2; NFR-2).
- The prefill/resume safety matrix and the full corroboration matrix, including boundary values of the declared stall bound, every partial reading, and evidence on every verdict (F-2; DM-1; AC-F2-1, AC-F2-2; NFR-1, NFR-7; DEC-4; SC-M1-14).
- Resume economics: capability-driven attach-and-continue without re-pay and without an ordinal, and within-budget uneconomical refusal with `dispatch.resume-uneconomical`, exit `1`, and named re-pay evidence (F-3; AC-F3-1, AC-F3-2; DEC-7).
- The durable restart budget: one restart event per admitted restart with ordinal, reason, session identity, and re-pay delta; survival across a process boundary; a fail-closed gate; refusal before any spawn past the bound with `dispatch.restart-budget-exceeded`, exit `1`, history-bearing evidence, and a durable terminal exhaustion record (F-4; DM-2, DM-3; AC-F4-1..AC-F4-4; NFR-3, NFR-4; DEC-2, DEC-3).
- Identical consumption by a daemon-style supervised composition and a one-shot resume composition, with zero divergence in identity, evidence, exit, and spawn count (AC-F4-3; RSK-3).
- The sourced stalled identity: `watchdog.liveness-stalled` on a failure envelope, no `data.verdict`, exit `1`, signals in evidence; `progressing` success at exit `0`; `signals-absent` unchanged at exit `2` (F-5; DM-5; AC-F5-1; DEC-1; GAP-T2 resolution).
- Per-delivery economics derivation from durable records alone: restart count, ordered history, resume-amplification signal, no harness re-query, null-with-warning degradation (F-6; DM-4; AC-F6-1; NFR-5).
- Lane configuration: `lane.liveness-interval` default `30000` ms and `lane.restart-budget` default `3`, origin provenance, and existing validation identities for unknown keys, wrong types, and invalid values (F-7; DM-6; AC-F7-1; DEC-5).
- The closed surface: the `dispatch` domain kind with exactly its two economics identities, the fourth `watchdog` row, the declared outcome/identity/exit matrix, exactly one valid exclusive envelope per invocation, and two-way documentation binding (DM-5; AC-F5-1, AC-F4-2, AC-F3-2; NFR-6..NFR-8).
- Structural conformance: one-home vocabularies, data-only contracts, pure domain, per-harness logic confined to the adapter seam, zero product/binary literals, and additive state record kinds with no schema-version change (NFR-9; §16).
- Regression protection for the delivered watchdog contract/behaviour/golden suites, the harness conformance liveness suite, the config suites, the state suites, and the error-table binding check (§1.2 lists the deliberate updates such a flip requires).

### 1.2 Out of Scope & Known Gaps

- [OUT] Queue-entry failed-marking at exhaustion, `lanes`/`queue` rendering, and any status surface rendering of restart count or amplification — NG-1, NG-4, M1-S17/S18. This plan asserts the **data** is present and derivable; it never asserts a rendered surface.
- [OUT] Typed question publication, answering, audience routing, and coordinator delivery — NG-2, M1-S16. SC-M1-15's "blockers list shows the question; digest ranks it" assertions belong to M1-S16/S18 and are not claimed here. This plan claims only the terminal record's escalation-ready fields.
- [OUT] The daemon, its collection cycle, heartbeat cadence to state, reconciliation, and live escalation delivery within one cycle — NG-3, M1-S18. "Daemon-style" in this plan means the supervised resume **composition**, exercised in-process; no daemon process is started and no cadence is scheduled.
- [OUT] The dispatch command surface, its `dispatch.session.spawn-failed` identity, and the `restarts`/`resumeAmplification` **envelope emission** — NG-4, M1-S9. This plan asserts the economics view carries the declared field names and types; the envelope projection is M1-S9's.
- [OUT] Spend rendering of amplification, spend records, and aggregation — NG-5, M1-S19. Derivability and the view shape are in scope; no spend command is exercised.
- [OUT] Session spawn, kill, steer, or restart **execution mechanics** — NG-6. The economics surface classifies, records, and refuses. Tests assert the absence of these capabilities on the new surface and zero invocations on every refusal, never that a spawn succeeds.
- [OUT] Worktree-activity as a fourth corroborating source and any Claude Code capability expansion — NG-7. Declared gaps stay gaps; absent sources classify unknown.
- [OUT] State schema-version bumps, migrations, changes to the watchdog stall bound, verdict vocabulary, or signal keys — NG-8. A test asserts the schema version and these vocabularies are **unchanged**.
- [OUT] Bash-era stack parity or script changes — §7.2. No bash script is modified.
- [GAP-T1 — the harness liveness kind vocabulary is not the watchdog signal vocabulary, and the spec does not say which side grows] DM-1 says the neutral report carries sourced heartbeat-age and token-delta entries "alongside session traffic (closed kinds, explicit absence reasons)", while the delivered `HARNESS_LIVENESS_KINDS` is exactly `session-traffic | worktree-activity | process` and both the conformance suite and GH-233's plan assert exactly three kinds. Extending that closed vocabulary is an additive harness-contract change this spec does not list as a decision; deriving heartbeat age and token delta from sourced traffic plus token statistics avoids it. This plan therefore asserts the **observable contract** — the watchdog keys are populated from adapter facts, an unsourced key stays absent, no CPU key exists, and the declared vocabulary has one home — and treats the choice as a delivery decision (OQ-T1). Delivery must reconcile the existing exact-three assertions deliberately; it must never loosen them to a floor.
- [GAP-T2 — structured failure evidence must fit the exclusive v1 envelope] The delivered `CommandResultError` carries `code`, `category`, `retryable`, `consequence`, `remediationHint`, and an optional `summary` — there is no structured evidence field, and §8.5/NG-8 keep the envelope shape untouched. AC-F2-2 ("carries the signals as evidence"), AC-F3-2 ("names the reason and the re-pay"), and AC-F4-2 ("reason and full restart history") therefore need one of: a bounded machine-parseable evidence string on the failure side, or a resolvable history reference to the durable record (§8.2's exhaustion record is explicitly a "history reference"). Tests assert the **property** — the exact identity, a non-empty evidence payload that names the reason and exposes the numeric facts, and a history reference that resolves to the full durable history — and leave the carrier delivery-bound. OQ-T2 records the decision; no test asserts a new envelope field.
- [GAP-T3 — "never killed" is an absence, not an action] There is no kill capability in this codebase and this change adds none (NG-6). "No kill" is therefore proven by three observable facts rather than one: no spawn/kill/steer port exists on the evaluated surface, zero such invocations are recorded across every fixture, and no restart event or lane-state mutation occurs on a `progressing` classification. A mutant that invokes a spawn port on a progressing or refusal path is the non-vacuity control (TC-ECON-022, TC-ECON-081).
- [GAP-T4 — process-boundary durability is asserted at the store boundary, not with a second OS process unless delivery adds one] TC-ECON-051 reads the same temp store root through a **fresh store handle** after the writing handle is closed, which proves durability across process lifetime and cache. If delivery can spawn a bounded child process cheaply, the same assertions strengthen; the plan does not require it (no sleeps, no flake surface).
- [GAP-T5 — delivery-bound names] Module paths, export names, record-kind strings, store-key spellings, payload-schema identifiers, the amplification flag name, and the evidence carrier's exact spelling are delivery-bound. Behaviour, identities, exits, closed vocabularies, ordering rules, and AC traceability are not. A test that cannot resolve a seam must fail naming the missing contract, never silently skip.
- [GAP-T6 — implementation plan not yet authored] `chg-GH-235-plan.yaml` does not exist at test-planning time (`links.implementation_plan: null`). Delivery planning must map phases onto these TCs; it must not reshape identities, exits, corroboration, precedence, or traceability.

## 2. References

- **Change specification**: [chg-GH-235-spec.md](./chg-GH-235-spec.md) — F-1..F-7, 13 ACs (AC-F1-1..AC-F7-1), DM-1..DM-6, NFR-1..NFR-9, RSK-1..RSK-6, DEC-1..DEC-7, §6 flows 1–4, §8.1 outcome/identity/exit matrix, §8.2 record kinds, §21 security highlights, Appendix B.
- **PM record**: [chg-GH-235-pm-notes.yaml](./chg-GH-235-pm-notes.yaml) — context only: the SC-M1-15 scope split, delivered dependencies, and the anticipated documentation impacts. The spec is the source of truth.
- **Seed scenarios**: [test-scenarios.md](../../../planning/oss-tooling/milestones/m1/test-scenarios.md) — SC-M1-14 (primary TC-ECON-020; extended by 021, 022) and SC-M1-15 (economics half: TC-ECON-052, extended by 053, 054). SC-M1-15's queue-marking, typed-question, digest-ranking, and one-collection-cycle assertions are M1-S16/S17/S18 and are excluded here.
- **Testing strategy**: [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) — `bun:test` under `tests/**/*.test.ts`; fixtures never named `*.test.ts`; `tests/{structure,types,behaviour,conformance,golden,checks,boundaries}`; permanent suites assert the current tree, never a moving base branch; goldens regenerate only by an explicit command; `pnpm check` is the aggregate gate.
- **TypeScript rules**: [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md) — strict typing, injected time/randomness/environment, data-only contracts, pure domain, adapters own I/O, the error contract, injected fakes over `mock.module`, exact optional-property modelling.
- **Delivered watchdog contracts (reused, never re-implemented)**: `packages/core/src/contracts/watchdog.ts` (`WATCHDOG_VERDICTS`, `WATCHDOG_SIGNAL_KEYS`, `WATCHDOG_STALL_HEARTBEAT_MS`, `WATCHDOG_ERROR_CODES`), `packages/core/src/domain/watchdog.ts` (`classifyWatchdogLiveness`, `readWatchdogSignals`, `buildWatchdogVerdictData`), `packages/cli/src/commands/watchdog.ts` (liveness handler and exit projection).
- **Delivered harness seam (reused)**: `packages/core/src/contracts/harness.ts` (`HARNESS_LIVENESS_KINDS`, absence reasons, capability/gap model, `HarnessSessionPort`), `packages/core/src/domain/harness-liveness.ts` (`assembleHarnessLiveness`, `harnessLivenessToWatchdogSignals`), `packages/adapters/src/harness/{opencode,claude}.ts`, `packages/testkit/src/conformance/harness.ts`.
- **Result and error contracts**: [feature-result-contract.md](../../../spec/features/feature-result-contract.md) — exclusive `data`/`error`, four mandatory fields, projection classes, documented table; `packages/core/src/contracts/{result,error-table}.ts`.
- **State layer**: [feature-state-layer.md](../../../spec/features/feature-state-layer.md) — additive record kinds, fenced verified append, verified reads, no migration; `packages/core/src/state/commit-telemetry.ts` is the record-kind pattern; `tests/fixtures/state/harness.ts` is the durability harness.
- **Configuration layer**: [feature-config-layer.md](../../../spec/features/feature-config-layer.md) — `PRODUCTION_CATALOG`, defaults, provenance, `generateConfigSchema`, existing validation identities; `packages/core/src/config/{catalog,defaults,resolver,schema,provenance}.ts`.
- **Branding seam**: [feature-branding-seam.md](../../../spec/features/feature-branding-seam.md) — injected brand; zero product/binary literals.
- **Binding check**: `scripts/checks/error-table-sync.ts` and `tests/checks/error-table-sync.test.ts` — documented rows at `doc/spec/features/feature-result-contract.md`, source scan (S1), fixture scan (S3), true/false-positive corpora at `tests/fixtures/result/code-corpora/`.
- **Invariants**: `scripts/checks/{error-table-sync,forbidden-literals,ambient-globals,secret-read-boundary,workspace-entrypoints}.ts`, `.dependency-cruiser.cjs`, `tests/boundaries/**`, `tests/structure/{content-inventory,subpaths}.test.ts`.
- **Existing suites mirrored**: `tests/behaviour/watchdog-*.test.ts`, `tests/golden/watchdog-output.test.ts`, `tests/structure/{watchdog-contract,watchdog-imports,error-table,harness-contract,harness-neutrality,harness-imports}.test.ts`, `tests/conformance/harness-liveness.test.ts`, `tests/behaviour/{config-*,state-*,harness-*}.test.ts`, `tests/checks/{error-table-sync,harness-mutants,harness-determinism}.test.ts`, `tests/fixtures/{watchdog,harness,state}/**`.
- **Ticket**: GitHub issue `juliusz-cwiakalski/agentic-delivery-os#235` — M1-S15: Session lifecycle economics.
- **Milestone contracts**: [contracts.md](../../../planning/oss-tooling/milestones/m1/contracts.md) — refusal semantics, v1 envelope, `{0, 1, 2}` taxonomy, dispatch codes, `lane.liveness-interval` ownership.

## 3. Coverage Overview

All thirteen acceptance criteria map to at least one named scenario; there are no TODO or uncovered ACs. Seed scenarios SC-M1-14 and SC-M1-15 are mapped explicitly in §3.4, including the part of SC-M1-15 this change does not own.

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Description (abbreviated) | TC ID(s) | Status |
|-------|---------------------------|----------|--------|
| AC-F1-1 | Adapter-level sourcing feeds all three declared signal keys; unsourced stays absent; no CPU value anywhere | TC-ECON-001, TC-ECON-002, TC-ECON-010, TC-ECON-012, TC-ECON-084 | Covered |
| AC-F1-2 | Source-less lanes classify `watchdog.signals-absent`, exit `2`, no verdict, never a stall response | TC-ECON-011, TC-ECON-031, TC-ECON-082 | Covered |
| AC-F2-1 | A large resuming/prefilling session is never `stalled`: `progressing`, exit `0`, no kill, no restart event, lane delivering (SC-M1-14) | TC-ECON-020, TC-ECON-022, TC-ECON-081 | Covered |
| AC-F2-2 | `stalled` requires heartbeat age ≥ bound AND tokenDelta `0` AND traffic `0`; partial readings progress; stall carries signal evidence | TC-ECON-021, TC-ECON-033, TC-ECON-082 | Covered |
| AC-F3-1 | Attach-and-continue resumes without re-paying prefill; session identity persists; no new tree root; no ordinal consumed | TC-ECON-040, TC-ECON-043 | Covered |
| AC-F3-2 | Within-budget uneconomical re-entry refused with `dispatch.resume-uneconomical`, exit `1`, named re-pay, zero spawns | TC-ECON-041, TC-ECON-042, TC-ECON-043, TC-ECON-033 | Covered |
| AC-F4-1 | A restart within budget is admitted and recorded durably: ordinal, reason, session identity, re-pay delta; folds from verified records | TC-ECON-050, TC-ECON-051, TC-ECON-060, TC-ECON-072 | Covered |
| AC-F4-2 | Past budget: refused before any spawn, `dispatch.restart-budget-exceeded`, exit `1`, reason + history, terminal record, no silent requeue | TC-ECON-003, TC-ECON-004, TC-ECON-052, TC-ECON-033, TC-ECON-055, TC-ECON-056 | Covered |
| AC-F4-3 | Exhaustion is durable and consumed identically by daemon-style and one-shot resume paths | TC-ECON-053, TC-ECON-055, TC-ECON-056 | Covered |
| AC-F4-4 | The terminal state is escalation-ready data (reason + history reference for M1-S16/S17/S18); no automatic re-entry | TC-ECON-054 | Covered |
| AC-F5-1 | A sourced stall has exactly one identity `watchdog.liveness-stalled`, failure envelope, no `data.verdict`, exit `1`; progressing `0`; absent `2` | TC-ECON-003, TC-ECON-004, TC-ECON-005, TC-ECON-030, TC-ECON-031, TC-ECON-032, TC-ECON-033, TC-ECON-082 | Covered |
| AC-F6-1 | Restart count, history, and amplification derive per delivery from state alone; missing figures null-with-warning, never fabricated | TC-ECON-060, TC-ECON-061, TC-ECON-062, TC-ECON-080, TC-ECON-083 | Covered |
| AC-F7-1 | `lane.liveness-interval` (30 s) and `lane.restart-budget` (3) own defaults/semantics; invalid values reuse existing identities | TC-ECON-070, TC-ECON-071, TC-ECON-072, TC-ECON-002 | Covered |

**Capability coverage** (every F-# has at least one TC): F-1 → 001, 002, 010, 011, 012; F-2 → 020, 021, 022; F-3 → 040, 041, 042, 043; F-4 → 003, 004, 050, 051, 052, 053, 054, 055, 056; F-5 → 005, 030, 031, 032, 033; F-6 → 060, 061, 062; F-7 → 070, 071, 072.

**Decision coverage**: DEC-1 → 030, 031, 032, 033; DEC-2 → 003, 004, 052; DEC-3 → 050, 051, 053, 060; DEC-4 → 020, 021, 022; DEC-5 → 070, 071, 072; DEC-6 → 012, 084; DEC-7 → 040, 041, 042, 043.

**Seed-scenario coverage**: SC-M1-14 → 020 (primary), 021, 022; SC-M1-15 economics half → 052 (primary), 053, 054. See §3.4 for the boundary.

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

The spec declares no REST/HTTP endpoint (API-#): the interface is the v1 envelope over existing commands, two additive durable record kinds, the neutral liveness carriage, the economics view, and two configuration keys. There are no new external events (EVT-#); the record kinds are the event surface (§8.2).

| Element | TC ID(s) | Observable assertion |
|---------|----------|----------------------|
| DM-1 sourced signal carriage | TC-ECON-010, TC-ECON-011, TC-ECON-012 | Neutral report carries one entry per declared kind with explicit absence reasons; the watchdog bridge projects all three declared keys; absent keys stay absent, never `0`; no CPU key exists |
| DM-2 restart event record | TC-ECON-050, TC-ECON-051, TC-ECON-060 | One additive record per admitted restart with work item, run, session identity, ordinal, classified reason, prefill re-pay delta, timestamps; fenced verified append; verified read; no schema bump |
| DM-3 budget exhaustion record | TC-ECON-052, TC-ECON-054, TC-ECON-062 | One terminal per-delivery record with the classified reason and a restart-history reference; terminal marker and escalation-consumer fields present as data |
| DM-4 per-delivery economics view | TC-ECON-060, TC-ECON-061, TC-ECON-062 | Restart count, ordered history, amplification signal; rebuildable from records alone; declared field names (`restarts`, `resumeAmplification`); null-with-warning degradation |
| DM-5 error-table rows | TC-ECON-003, TC-ECON-004, TC-ECON-005 | `dispatch` kind with exactly two economics rows; fourth `watchdog` row; projection classes match exits; four documented rows two-way bound; zero existing rows modified |
| DM-6 configuration keys | TC-ECON-070, TC-ECON-071, TC-ECON-072 | `lane.liveness-interval` = 30000 ms default, `lane.restart-budget` = 3 default with `defaults` origins; existing identities for unknown/wrong-type/invalid |
| §8.1 outcome/identity/exit matrix | TC-ECON-005, TC-ECON-030, TC-ECON-031, TC-ECON-033 | Exactly one declared identity and one exit digit per outcome; no overlap; no exit outside `{0, 1, 2}`; exit `2` reserved for identifier `watchdog.signals-absent` |
| §8.2 record surface (EVT) | TC-ECON-050, TC-ECON-052, TC-ECON-054 | Two additive kinds only; no new event bus, no external message, no second history home |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement (threshold) | TC ID(s) | Status |
|--------|--------------------------|----------|--------|
| NFR-1 | Prefill/resume misclassification `0 / 0` (SC-M1-14 over the fixture matrix) | TC-ECON-020, TC-ECON-021, TC-ECON-080, TC-ECON-081 | Covered |
| NFR-2 | CPU-derived signals `0`; verdicts from absent sources `0` | TC-ECON-010, TC-ECON-011, TC-ECON-012, TC-ECON-021, TC-ECON-031 | Covered |
| NFR-3 | Restarts past budget that proceed `0`; cross-path budget divergence `0` | TC-ECON-042, TC-ECON-052, TC-ECON-053, TC-ECON-055, TC-ECON-056, TC-ECON-072 | Covered |
| NFR-4 | Silent exhaustion `0`; fourth spawn past a 3-of-3 budget `0` | TC-ECON-022, TC-ECON-052, TC-ECON-054, TC-ECON-055 | Covered |
| NFR-5 | Restart count and amplification reconstructible from state alone `100%` | TC-ECON-050, TC-ECON-051, TC-ECON-060, TC-ECON-061, TC-ECON-062 | Covered |
| NFR-6 | Envelope validity `0` violations; exits outside `{0, 1, 2}` `0` | TC-ECON-005, TC-ECON-030, TC-ECON-031, TC-ECON-032, TC-ECON-033, TC-ECON-080 | Covered |
| NFR-7 | Evidence totality `0` bare outcomes (stall, budget, uneconomical) | TC-ECON-021, TC-ECON-033, TC-ECON-041, TC-ECON-052, TC-ECON-054 | Covered |
| NFR-8 | Error-table binding `4/4`; existing rows modified `0` | TC-ECON-003, TC-ECON-004, TC-ECON-082, TC-ECON-083 | Covered |
| NFR-9 | Product/binary literals `0`; behaviour or I/O in contracts `0`; per-harness logic outside the adapter seam `0` | TC-ECON-002, TC-ECON-012, TC-ECON-084 | Covered |

### 3.4 Coverage-Matrix Integrity

- **Uncovered ACs**: none (13/13 in §3.1). **Orphan TCs**: none; every TC names at least one AC or NFR in §5.1 and §5.2.
- **SC-M1-14 (prefilling session never reads as stalled)** is inherited verbatim in its two observable assertions — "no restart event" and "the lane state remains delivering" — by TC-ECON-020, extended by the corroboration matrix (021) and by the no-kill/no-spawn structural proof (022).
- **SC-M1-15 (budget exhaustion escalates, never silently requeues)** is inherited on the economics half only: "restart 3/3", "no fourth spawn", "terminal, classified reason, restart history" are TC-ECON-052/053/054. The other half — "queue entry marked failed", "typed question raised within one collection cycle with options", "blockers list shows the question", "digest ranks it" — is M1-S17/S18 and M1-S16, and is explicitly not claimed here. Divergence discovered later is a defect; this split mirrors the spec's SC-M1-15 ownership note.
- **Partially testable, with the boundary recorded**: AC-F2-1's "no kill" is an absence proven by port absence, zero invocations, and zero state mutation (GAP-T3); AC-F4-1's "survives a process boundary" is proven at the closed-and-reopened store boundary (GAP-T4); AC-F3-2's "measured or expected re-pay" is asserted as a numeric fact present in evidence, not a fixed formula; AC-F6-1's amplification is asserted by ordering/monotonicity and the null rule, with the exact formula delivery-bound (OQ-T2); DM-1's carriage is asserted at the projected watchdog shape, with the neutral-vocabulary growth left to delivery (GAP-T1).
- **Intentional duplicate coverage**: AC-F5-1 spans eight TCs because the declared matrix, the table rows, the documentation binding, the three-way behaviour, the goldens, the envelope matrix, and the regression flip fail independently. AC-F4-1 spans four because recording, durability, reconstruction, and config-driven bounding fail independently. AC-F3-2 spans four because the refusal, precedence, fail-closed capability rule, and envelope validity fail independently.
- **Regression half**: the delivered `watchdog-*`, `harness-*`, `config-*`, `state-*`, `error-table`, and `tests/boundaries` suites run in TC-ECON-082. Five existing assertions are **deliberately updated** by this change, and only these five: (i) `WATCHDOG_ERROR_CODES` exactly-three → exactly-four; (ii) the error-table total row count → the new exact total; (iii) GH-221's "no M1-S1 runtime path produces `stalled` or `progressing`" → reachability assertions (the flip is this change's purpose); (iv) the harness liveness "exactly three kinds" assertion → reconciled per GAP-T1; (v) watchdog liveness fixtures that expected `signals-absent` on a now-sourced lane. All other existing test files must remain unchanged; that is a review obligation, not a permanent tree assertion.

## 4. Test Types and Layers

All TypeScript tests use `bun:test` with `describe`/`test`; fixtures are never named `*.test.ts`. Module and suite paths follow the delivered tier layout and are delivery-bound where GAP-T5 says so.

| Layer | Runner / invocation | Location | Covers |
|-------|--------------------|----------|--------|
| Static/diff and content | `git diff --check`; changed-file naming/path review; markdown table/fence sanity | change artifacts, touched docs | Gate precondition; TC-ECON-083 |
| Structure / invariant | `bun test tests/structure/economics-*.test.ts` | `packages/core/src/contracts/economics*.ts` (expected), domain/state/config modules; AST scans and temp-copy mutants | TC-ECON-001, 002, 003, 005, 012, 056, 084 |
| Type-level | `pnpm typecheck`; `tests/types/economics.type-test.ts` | closed unions, absent-vs-zero modelling, no CPU field, envelope exclusivity | Supports TC-ECON-001, 002, 005, 012, 062 |
| Error-table binding | `bun test tests/checks/error-table-sync.test.ts`; `bun run scripts/checks/error-table-sync.ts` | `tests/fixtures/result/code-corpora/*.json`, `doc/spec/features/feature-result-contract.md` | TC-ECON-004, 003 (table half) |
| Conformance | `bun test tests/conformance/harness-liveness.test.ts tests/structure/conformance-coverage.test.ts` | `packages/testkit/src/conformance/harness.ts`, `tests/fixtures/harness/**` | TC-ECON-010, 011, 012 |
| Behaviour | `bun test tests/behaviour/economics-*.test.ts tests/behaviour/watchdog-liveness.test.ts` | `tests/fixtures/economics/**`, `tests/fixtures/state/harness.ts`, `tests/fixtures/harness/harness-io.ts`; injected clock/run-id/brand/buffer sinks | TC-ECON-011, 020–022, 030–033, 040–043, 050–056, 060–062, 070–072 |
| Golden | `bun test tests/golden/watchdog-output.test.ts tests/golden/economics.test.ts` | committed normalized fixtures under `tests/fixtures/economics/golden/` and `tests/fixtures/watchdog/golden/` | TC-ECON-032, 033 (golden halves), 080 |
| Checks / mutants / determinism | `bun test tests/checks/economics-mutants.test.ts tests/checks/economics-determinism.test.ts` | `tests/fixtures/economics/mutants/**`, temp copies | TC-ECON-080, 081 |
| Boundaries | `bun test tests/boundaries`; `pnpm check:boundaries` | production `.dependency-cruiser.cjs`, ambient-globals AST guard, fixture-coverage meta-check | TC-ECON-002, 084 |
| Regression | the existing suites named in TC-ECON-082 | unchanged watchdog/harness/config/state/error-table suites | TC-ECON-082 |
| Manual | content/manual review at phase 7 | `doc/spec/features/*` and the new economics feature spec; `bash scripts/.tests/test-doc-distribution.sh` if a marker-scoped doc changes | TC-ECON-083 |
| Performance | N/A by spec | — | The change declares no latency, throughput, or cost threshold; bounded reads are inherited from the delivered adapter guardrails. Determinism is asserted as replay equality, not timing. |

**Layer rules that bind every TC** (mirroring the delivered suite discipline):

1. **Hermetic.** Production modules are imported and fakes injected. No suite spawns a harness, opens a real session store, reads the real `$HOME` or `process.env`, opens a socket, or writes the live worktree. A suite that cannot resolve an injection seam fails naming the missing contract.
2. **One injected state seam.** Restart and exhaustion records are written through the existing `StateStorePort`; tests use `tests/fixtures/state/harness.ts` with a mutable clock and deterministic fence tokens. Never a real user state directory.
3. **One injected harness seam.** Sourcing tests inject liveness facts through the delivered harness I/O fakes; the adapter's declared capability set is read from its declaration, never hardcoded per harness in a shared test.
4. **No harness re-query.** Derivation suites assert the harness seam's call count is zero.
5. **Fixed facts.** Clock, run id, brand, budget bound, and session identities are injected and constant per case.
6. **Temp roots only.** Any filesystem fixture is `mkdtemp`-created and removed in `afterEach`; goldens are read-only and their `mtimeMs` is asserted unchanged.
7. **No moving-base diff.** Every assertion reads the current tree, a committed fixture, a temp copy, or a recorded invocation.
8. **Exact counts stay exact.** Where a closed vocabulary or table grows, update the exact expected value; never replace it with `toBeGreaterThan` or a floor.

## 5. Test Scenarios

TC IDs use the `ECON` feature prefix. Sequence blocks are intentional: `0xx` contracts, vocabularies, error table, and the declared matrix; `01x` adapter sourcing; `02x` prefill safety and corroboration; `03x` the stalled identity and envelopes; `04x` resume economics; `05x` the restart budget; `06x` economics derivation; `07x` configuration; `08x` determinism, mutants, regression, documentation, and tier conformance.

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Priority | AC Coverage |
|-------|-------|------|-------|----------|-------------|
| TC-ECON-001 | Economics contract data has one data-only home | Happy Path | Structure | High | AC-F1-1, AC-F3-1, AC-F4-2, AC-F6-1; DM-2..DM-4, NFR-9 |
| TC-ECON-002 | Tier boundaries and the adapter seam hold for the economics surface | Happy Path | Structure | High | AC-F1-1, AC-F7-1; NFR-9 |
| TC-ECON-003 | Error table gains the `dispatch` kind and exactly four rows; existing rows untouched | Happy Path | Structure | Critical | AC-F3-2, AC-F4-2, AC-F5-1; DM-5, NFR-8 |
| TC-ECON-004 | Four documented rows bind two-way to the table and corpora | Happy Path | Checks | Critical | AC-F3-2, AC-F4-2, AC-F5-1; DM-5, NFR-8 |
| TC-ECON-005 | The outcome/identity/exit matrix is declared once and total | Happy Path | Structure | High | AC-F3-2, AC-F4-2, AC-F5-1; DM-5, NFR-6 |
| TC-ECON-010 | Sourced signals populate exactly the three declared keys; absence stays absent | Happy Path | Conformance | Critical | AC-F1-1; DM-1, NFR-2 |
| TC-ECON-011 | A source-less lane keeps the classified unknown answer | Negative | Behaviour | Critical | AC-F1-2, NFR-2 |
| TC-ECON-012 | CPU is never a liveness signal, structurally or behaviourally | Negative | Structure | Critical | AC-F1-1, AC-F2-2; DM-1, NFR-2 |
| TC-ECON-020 | A large prefilling or resuming session is never stalled (SC-M1-14) | Regression | Behaviour | Critical | AC-F2-1; NFR-1, RSK-1 |
| TC-ECON-021 | Stall requires the full corroboration; partial readings progress | Corner Case | Behaviour | Critical | AC-F2-2; NFR-1, NFR-7 |
| TC-ECON-022 | Lifecycle evaluation refuses or records; it never spawns, kills, or steers | Negative | Behaviour | Critical | AC-F2-1, AC-F3-2, AC-F4-2; NFR-3, NFR-4 |
| TC-ECON-030 | A corroborated stall has exactly one machine identity (GAP-T2) | Happy Path | Behaviour | Critical | AC-F5-1; DM-5, NFR-6, NFR-7 |
| TC-ECON-031 | Progressing stays exit `0` and signals-absent stays exit `2` | Regression | Behaviour | Critical | AC-F5-1, AC-F1-2; NFR-6 |
| TC-ECON-032 | Canonical liveness envelopes are committed goldens | Happy Path | Golden | High | AC-F5-1; DM-1, NFR-6 |
| TC-ECON-033 | Every new outcome emits one valid exclusive envelope inside `{0,1,2}` | Corner Case | Behaviour | Critical | AC-F5-1, AC-F4-2, AC-F3-2; NFR-6, NFR-7 |
| TC-ECON-040 | Attach-and-continue resumes without re-paying prefill | Happy Path | Behaviour | Critical | AC-F3-1; DM-2, DEC-7 |
| TC-ECON-041 | A within-budget uneconomical re-entry is refused with a reason | Negative | Behaviour | Critical | AC-F3-2; NFR-7, RSK-4 |
| TC-ECON-042 | Budget refusal precedes economics; the two reasons stay distinct | Corner Case | Behaviour | High | AC-F3-2, AC-F4-2, AC-F4-3; NFR-3, NFR-4 |
| TC-ECON-043 | Resume economics is capability-driven and fail-closed | Negative | Behaviour | High | AC-F3-1, AC-F3-2; NFR-3 |
| TC-ECON-050 | A restart within budget is admitted and recorded durably | Happy Path | Behaviour | Critical | AC-F4-1, AC-F6-1; DM-2, NFR-5 |
| TC-ECON-051 | The budget survives a process boundary and replays identically | Edge Case | Behaviour | Critical | AC-F4-1; DM-2, NFR-5 |
| TC-ECON-052 | A restart past budget fails loudly with history (SC-M1-15 economics half) | Negative | Behaviour | Critical | AC-F4-2; DM-3, NFR-3, NFR-4, NFR-7 |
| TC-ECON-053 | Every resume path consumes the exhaustion identically | Corner Case | Behaviour | Critical | AC-F4-3; NFR-3, RSK-3 |
| TC-ECON-054 | The terminal state is escalation-ready data, not silence | Happy Path | Behaviour | High | AC-F4-4; DM-3, DM-4, NFR-4 |
| TC-ECON-055 | The budget gate is fail-closed on unevaluable state | Negative | Behaviour | Critical | AC-F4-2, AC-F4-3; NFR-4 |
| TC-ECON-056 | One gate, every path: budget consumption has a single seam | Negative | Structure | Critical | AC-F4-2, AC-F4-3; NFR-3, RSK-3 |
| TC-ECON-060 | Per-delivery economics derives from durable records alone | Happy Path | Behaviour | Critical | AC-F6-1; DM-2..DM-4, NFR-5 |
| TC-ECON-061 | Resume amplification is computed and flagged by name | Happy Path | Behaviour | High | AC-F6-1; DM-4 |
| TC-ECON-062 | Missing economics figures degrade to null with a warning | Edge Case | Behaviour | High | AC-F6-1; DM-4, NFR-5 |
| TC-ECON-070 | The lane configuration keys own their defaults and semantics | Happy Path | Behaviour | High | AC-F7-1; DM-6, DEC-5 |
| TC-ECON-071 | Invalid lane configuration reuses existing identities | Negative | Behaviour | High | AC-F7-1; DM-6 |
| TC-ECON-072 | The budget bound is configuration-driven, never a literal | Corner Case | Behaviour | High | AC-F7-1, AC-F4-1; NFR-3 |
| TC-ECON-080 | Identical facts replay to identical verdicts and economics | Happy Path | Checks | High | NFR-1, NFR-6; AC-F5-1, AC-F6-1 |
| TC-ECON-081 | Mutants prove every zero-defect threshold is enforced | Negative | Checks | Critical | NFR-1..NFR-5; AC-F2-1, AC-F4-3, AC-F6-1 |
| TC-ECON-082 | Existing behaviour does not regress on the additive path | Regression | Regression | Critical | AC-F1-2, AC-F2-2, AC-F5-1; NFR-8 |
| TC-ECON-083 | Documentation and inventory reconcile with the delivered surface | Happy Path | Manual | Medium | AC-F6-1, AC-F7-1; DM-5, DM-6, NFR-8 |
| TC-ECON-084 | The new surface is tier- and brand-conformant | Negative | Structure | High | AC-F1-1, AC-F7-1; NFR-9 |

### 5.2 Scenario Details

#### TC-ECON-001 - Economics contract data has one data-only home

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-1, AC-F3-1, AC-F4-2, AC-F6-1, F-1, F-3, F-4, F-6, DM-2, DM-3, DM-4, NFR-9
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/economics-contract.test.ts`; contracts module `packages/core/src/contracts/economics.ts` (expected), `packages/core/src/contracts/watchdog.ts`, `packages/core/src/contracts/index.ts`
**Tags**: @contract, @backend, @structure

**Preconditions**:
- The economics contract module and its export from `packages/core/src/contracts/index.ts` exist.
- The four new error codes are declared.

**Steps**:
1. Import the closed vocabularies: restart reasons, the two record-kind identifiers, the economics view field names, the amplification flag names, and the two configuration key paths.
2. Assert each vocabulary is a single `as const` declaration that drives both the runtime list and the union type, with no duplicate or extra member.
3. Assert the view field names include `restarts` and `resumeAmplification` exactly, matching the names the dispatch envelope declares in the milestone contract; assert the history field is declared and ordered by ordinal.
4. Assert `WATCHDOG_SIGNAL_KEYS` remains exactly `heartbeatAgeMs`, `tokenDelta`, `traffic` and that no contract type declares a CPU field.
5. Assert `WATCHDOG_ERROR_CODES` is exactly the three delivered codes plus `watchdog.liveness-stalled`, in append order.
6. Scan every file under `packages/` for a redeclaration of any of these vocabularies; assert none.
7. Run the structure layer's AST data-only detector over the module: only type/interface/import/export/`as const` declarations, no runtime imports; a temp-copy mutant injecting `import "node:fs"` or an executable statement fails naming the file and kind.
8. Assert `STATE_SCHEMA_VERSION` is unchanged and the new record kinds are additive string constants, not a schema version.

**Expected Outcome**:
- Every closed vocabulary has exactly one data-only home and the union cannot drift from the runtime list.
- No CPU key exists anywhere in contract types; the watchdog signal key set is unchanged.
- The contract module is data-only and runtime-neutral; the mutation probe proves the detector is non-vacuous.
- No schema-version change is introduced by the record kinds.

**Notes / Clarifications**:
- Record-kind strings, store-key spellings, and the amplification flag spelling are delivery-bound (GAP-T5); the test reads them from the contract and asserts one-home and closedness, not a guessed literal.
- The `restarts` / `resumeAmplification` names are pinned because the dispatch envelope declares them; the emission surface is M1-S9 (NG-4).

#### TC-ECON-002 - Tier boundaries and the adapter seam hold for the economics surface

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-1, AC-F7-1, F-1, F-4, F-7, NFR-9
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/economics-imports.test.ts`, `tests/types/economics.type-test.ts`, `tests/boundaries`; contracts/domain/state/config modules and `packages/adapters/src/harness/**`
**Tags**: @contract, @backend, @boundary

**Preconditions**:
- The contracts, domain, state, config, and adapter modules for the new surface exist.

**Steps**:
1. Assert the contracts modules are data-only and import no `node:`/`bun:` specifier.
2. Assert the domain modules (budget evaluation, resume economics, amplification fold, liveness bridge) import only `#contracts`, `#domain/*`, or local modules, and call no `Date.now`, `Math.random`, `performance.now`, `process.env`, `Bun.env`, `fetch`, timer, or filesystem API.
3. Assert the config branch module uses only the existing catalog/defaults/provenance mechanisms; no bespoke parser.
4. Assert per-harness sourcing lives only in `packages/adapters/src/harness/**`: no `harness === "opencode"` / `"claude-code"` branch, and no harness name literal, exists in core contracts, core domain, state, config, or the CLI command module.
5. Assert `scripts/checks/ambient-globals.ts` scopes the new domain files and reports zero violations.
6. Run `bun test tests/boundaries` with the production `.dependency-cruiser.cjs`; every rule stays green and the fixture-coverage meta-check reports no unenforced rule.
7. Non-vacuity: three failing mutants in temp copies — `node:fs` in contracts, `Date.now()` in domain, and a harness-kind branch in core domain — each fail by file and kind.

**Expected Outcome**:
- The new surface respects the tier matrix with no rule loosening and no matrix edge added.
- Per-harness logic exists only in the adapter seam; core classification stays neutral.
- If a matrix edge were needed, its failing negative fixture would be required in the same change; none is needed here.

#### TC-ECON-003 - Error table gains the `dispatch` kind and exactly four rows; existing rows untouched

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F3-2, AC-F4-2, AC-F5-1, F-3, F-4, F-5, DM-5, NFR-8, DEC-2
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/error-table.test.ts` (existing suite, extended); `packages/core/src/contracts/error-table.ts`
**Tags**: @contract, @backend, @error-table

**Preconditions**:
- `DOMAIN_KINDS` contains `dispatch`; four rows are appended to `ERROR_TABLE`.

**Steps**:
1. Assert `dispatch` is in `DOMAIN_KINDS` and `entries.filter(domainKind === "dispatch")` has exactly `dispatch.restart-budget-exceeded` then `dispatch.resume-uneconomical`, in that order.
2. Assert the `watchdog` rows are exactly the three delivered codes plus `watchdog.liveness-stalled`, in append order.
3. Assert every new row declares every required column with valid enum values and a non-empty remediation hint.
4. Assert all four new rows project as `user-validation` (exit `1`), matching the declared outcome/exit matrix; assert that a `platform-provider` projection — exit `2` — is produced by no new row.
5. Assert `classifyDomainKind("dispatch", code)` returns the exact row, `resolveAppErrorCode(code)` round-trips, and `classifyThrown({ kind: "dispatch", code })` matches; a kind-only `"dispatch"` is ambiguous and contains to `fallback.internal`; a wrong code under `dispatch` contains.
6. Assert the pre-existing rows are byte-identical to their pre-change declarations using a committed row fingerprint (code, domain kind, category, retryable, consequence, remediation hint, projection class, summary), and that no existing row gains or loses a column.
7. Update the existing exact row-count assertions to the new exact total; assert the count is exact, not a floor.
8. If any new row uses consequence `unknown`, assert it is listed in `tests/fixtures/result/unknown-consequence-allowlist.json` with a recorded reason.

**Expected Outcome**:
- Exactly two `dispatch` rows and exactly four `watchdog` rows, with the documented identities and `user-validation` projection.
- One new domain kind and four new rows; zero existing rows modified.
- Runtime lookup and thrown classification are total and contain invalid shapes.

**Notes / Clarifications**:
- Category and retryability are delivery-declared and asserted as valid/documented, not guessed; the pinned fields are the code, the domain kind, the projection class, and the non-empty remediation hint.
- The fingerprint is the "existing rows modified: 0" oracle (NFR-8) and is reviewed as a tree invariant, not a branch-diff assertion.

#### TC-ECON-004 - Four documented rows bind two-way to the table and corpora

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F3-2, AC-F4-2, AC-F5-1, F-3, F-4, F-5, DM-5, NFR-8
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/error-table-sync.test.ts` (existing suite, extended); `tests/fixtures/result/code-corpora/true-positives.json`; `doc/spec/features/feature-result-contract.md`
**Tags**: @contract, @backend, @error-table

**Preconditions**:
- The four rows exist and their documented rows land in `doc/spec/features/feature-result-contract.md` in the same delivery phase; the `dispatch` kind's documented heading exists.

**Steps**:
1. Run `bun run scripts/checks/error-table-sync.ts` over the live tree; assert zero failures and that all four codes are recognized in S1 and documented.
2. For each code, assert the documented row appears exactly once and matches every column (code, domain kind, category, retryable, consequence, remediation hint, projection class, summary).
3. Add one true-positive corpus row per new code and assert the corpora still pass; add no false-positive row that would mask a real code.
4. In a temp copy, delete one documented row and run the check: it fails naming the undocumented source entry.
5. In a temp copy, insert a documented row with a mismatched hint and projection class: it fails naming the field.
6. In a temp copy, insert a source row with no documented row: it fails naming the code.
7. Assert the 4/4 binding holds and the existing rows keep their documented rows; run the existing exact-row suites to prove zero modifications.

**Expected Outcome**:
- 4/4 new rows are documented, recognized, and resolvable; 0 existing rows modified.
- The check is non-vacuous in both directions: a missing documented row, a drifted row, and an undocumented source row each fail with the offending code named.
- The live tree is never written; all mutations happen in `mkdtemp` copies.

**Notes / Clarifications**:
- This is the NFR-8 binding obligation: a row without its documented counterpart fails `pnpm test` before doc-sync.
- The new economics feature spec is a phase-7 deliverable and does not replace the binding path.

#### TC-ECON-005 - The outcome/identity/exit matrix is declared once and total

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-2, AC-F4-2, AC-F5-1, F-3, F-4, F-5, DM-5, NFR-6, DEC-1, DEC-2
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/economics-contract.test.ts`; the declared matrix in the contracts tier
**Tags**: @contract, @backend, @structure

**Preconditions**:
- The contract module declares the outcome/identity/exit matrix from spec §8.1.

**Steps**:
1. Assert the matrix has exactly the six declared outcomes: progressing, stalled, sources-absent, restart-within-budget, restart-past-budget, resume-uneconomical — no seventh, no missing row.
2. Assert each refusal row carries exactly one identity and one exit digit: stalled → `watchdog.liveness-stalled` / `1`; past budget → `dispatch.restart-budget-exceeded` / `1`; uneconomical → `dispatch.resume-uneconomical` / `1`; sources-absent → `watchdog.signals-absent` / `2`.
3. Assert the progressing row declares a success projection with exit `0` and no refusal identity; the restart-within-budget row declares a record, no refusal identity, and no exit digit (owning surface).
4. Assert every declared identity resolves in `ERROR_TABLE` and its `projectionClass` matches the declared digit; `user-validation` ↔ `1`, `platform-provider` ↔ `2`, no row maps to `fallback.*`.
5. Assert the matrix is the only home: no second copy of the mapping exists in the CLI or adapter packages.
6. Assert the exit-digit set is a subset of `{0, 1, 2}` and that no outcome declares more than one digit.

**Expected Outcome**:
- One declared, total, non-overlapping outcome/identity/exit matrix with every digit traceable to a table row.
- A mutation adding a seventh outcome, a duplicate identity, a fourth digit, or a `fallback.*` identity fails naming the row.

**Notes / Clarifications**:
- This is the declared half; the observed half is TC-ECON-033. They fail independently, so both exist.

#### TC-ECON-010 - Sourced signals populate exactly the three declared keys; absence stays absent

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F1-1, F-1, F-2, DM-1, NFR-2, DEC-6
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/harness-liveness.test.ts` (extended); `tests/behaviour/economics-liveness-sourcing.test.ts`; `packages/core/src/domain/harness-liveness.ts`; `packages/adapters/src/harness/**`
**Tags**: @conformance, @backend, @liveness

**Preconditions**:
- The adapter declaration states its sourced liveness kinds; injected facts exist for each declared kind.
- The watchdog bridge and the neutral assembly are reachable from the test.

**Steps**:
1. Inject a heartbeat-age fact, a session-traffic fact, and a token-delta fact (where declared) with fixed observation times; run the adapter's liveness read.
2. Assert the neutral report carries exactly one entry per declared kind in closed order; each sourced entry carries the injected value and the injected observation time.
3. Project the report through the watchdog bridge; assert `heartbeatAgeMs`, `tokenDelta`, and `traffic` equal the injected facts under the declared unit mapping.
4. Assert the projected key set is a subset of `WATCHDOG_SIGNAL_KEYS`; an undeclared or unsourced kind yields an **absent** key, never `0`, `false`, `""`, or an invented timestamp.
5. Assert the projection performs no second store or file read: the recording harness seam shows zero additional reads.
6. Run `watchdog liveness --json` with sourced signal sources wired; assert the populated keys reach the emitted payload and the verdict is `progressing` or `stalled` per the corroboration rule — never `signals-absent`.
7. Replay the read with fresh fakes and identical facts; assert byte-identical canonical output.

**Expected Outcome**:
- All three declared keys are populated from adapter facts where sources exist; unsourced keys stay absent.
- The zone between "absent" and "zero" is preserved end to end, so the classifier can still answer unknown.
- Sourcing is a projection of adapter facts, not a re-read.

**Notes / Clarifications**:
- Whether the neutral kind vocabulary grows or heartbeat/token-delta derive from traffic plus token statistics is a delivery decision (GAP-T1, OQ-T1). Where the declaration is authoritative, the test reads it; it never hardcodes a per-harness expectation and never loosens the existing vocabulary assertions to a floor.

#### TC-ECON-011 - A source-less lane keeps the classified unknown answer

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F1-2, F-1, DM-1, NFR-2, NG-7
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/watchdog-liveness.test.ts` (extended command-level); `tests/conformance/harness-liveness.test.ts`
**Tags**: @backend, @cli, @negative

**Preconditions**:
- A Claude Code fixture declaring every liveness kind as a gap, and an opencode fixture with no sourced facts.

**Steps**:
1. Run `watchdog liveness lane-1 --json` for each fixture.
2. Parse the single envelope; assert exit `2` and `error.code === "watchdog.signals-absent"` with the documented error fields.
3. Assert no `data` key and no `verdict` key anywhere in the serialized payload; assert the evidence-bearing text states the answer is unknown and names the absent kinds/reasons.
4. Assert zero restart events appended, zero kill/spawn/steer invocations, and no lane-state mutation.
5. Run a source-present control through the same wiring; assert it does not produce `signals-absent`, proving the refusal is not unconditional.
6. Replay and compare normalized output.

**Expected Outcome**:
- A genuinely source-less lane stays unknown at exit `2` with no verdict and no stall response.
- Absent sources never degrade to a guessed or CPU-substituted verdict.
- The source-present control proves the branch is real.

#### TC-ECON-012 - CPU is never a liveness signal, structurally or behaviourally

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F1-1, AC-F2-2, F-1, F-2, DM-1, NFR-2, DEC-6
**Test Type(s)**: Unit, Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/economics-imports.test.ts`, `tests/structure/watchdog-contract.test.ts`, `tests/behaviour/watchdog-liveness.test.ts`; `tests/types/economics.type-test.ts`
**Tags**: @backend, @negative, @structure

**Preconditions**:
- The signal shape type and all sourcing projections exist.

**Steps**:
1. AST/type scan the contracts, domain, adapter sourcing, and CLI for a CPU-shaped key (`cpu`, `cpuPercent`, `cpuMs`, `loadAverage`, `process.cpu`) inside the signal shape or a projection into it; assert zero matches.
2. Serialize a populated `WatchdogSignals` object and assert its key set is a subset of the three declared keys.
3. Feed the classifier a CPU-only object (busy/idle/high/low and an explicit `cpu` field) and assert the outcome is the absent classification, never a verdict.
4. Inject adapter facts that include an undeclared CPU field alongside declared facts; assert the projection drops it and never maps it to `traffic` or `tokenDelta`.
5. Assert the emitted payload of a sourced liveness run contains no CPU-derived key.
6. Non-vacuity: a mutant that maps CPU-busy alone to `stalled` is caught by TC-ECON-021/TC-ECON-081.

**Expected Outcome**:
- No CPU value enters the shape, the sources, the bridge, or the evaluation.
- A CPU-only reading can never satisfy the declared shape, so `stalled` is unreachable without progress-signal corroboration.

#### TC-ECON-020 - A large prefilling or resuming session is never stalled (SC-M1-14)

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F2-1, F-2, NFR-1, RSK-1, DEC-4, SC-M1-14
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/economics-liveness-prefill.test.ts`; matrix `PREFILL_CASES` in `tests/fixtures/economics/cases.ts`
**Tags**: @backend, @cli, @scenario-m1-14

**Preconditions**:
- A committed matrix over session size (small, large, huge) × prefill duration (short, long, beyond the stall bound) × source shape (rising token delta only; traffic only; both; both with heartbeat age at or beyond the declared bound).
- A recording runtime that logs spawn, kill, steer, state appends, and lane-state writes.

**Steps**:
1. For each matrix row, build the fixture: token delta `> 0` and/or traffic `> 0`, no phase output yet, heartbeat age varied from well under to beyond the declared bound.
2. Run `watchdog liveness --json`.
3. Assert exit `0`, a success envelope, `data.verdict === "progressing"`, and populated signals/evidence.
4. Assert zero restart-event appends and zero ordinal consumption.
5. Assert zero spawn, kill, steer, or restart invocations and no lane-state mutation; the lane remains delivering.
6. Assert the assertion holds at and beyond the stall bound when delta/traffic are rising, so size and duration can never tip the verdict.
7. Assert the matrix floor (at least three sizes × three durations × four source shapes) is met; a suite that finds fewer rows fails.

**Expected Outcome**:
- Every prefilling or resuming row classifies `progressing` at exit `0` with no kill, no restart event, and unchanged lane state — SC-M1-14's two observable assertions verbatim.
- The costliest failure in the class — killing the largest resuming session — is structurally impossible once signal sourcing is wired.

**Notes / Clarifications**:
- "No kill" is an absence (GAP-T3): port absence plus zero invocations plus zero state mutation.
- A naive mutant that reads a large session as stalled once heartbeat passes the bound is the non-vacuity control (TC-ECON-081).

#### TC-ECON-021 - Stall requires the full corroboration; partial readings progress

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F2-2, F-2, F-5, NFR-1, NFR-7, DEC-4
**Test Type(s)**: Unit, Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/economics-liveness-corroboration.test.ts`; matrix `CORROBORATION_CASES`; `packages/core/src/domain/watchdog.ts` and the command edge
**Tags**: @backend, @cli, @corroboration

**Preconditions**:
- The delivered classifier and the wired command edge are reachable.

**Steps**:
1. Build the matrix: heartbeat age absent / below the bound / exactly at the bound / above; token delta absent / `> 0` / `0`; traffic absent / `> 0` / `0` — every present-value combination at least once.
2. Assert exactly one combination classifies `stalled`: heartbeat at or above `WATCHDOG_STALL_HEARTBEAT_MS` AND tokenDelta `0` AND traffic `0`.
3. Assert every other present-signal combination classifies `progressing`, including at-bound-with-nonzero-delta, at-bound-with-zero-traffic-but-absent-token-delta, and two-of-three corroboration.
4. Assert an absent heartbeat never stalls even when delta and traffic are both `0`, and that an absent signal is never coerced to `0`.
5. Assert boundary behaviour at `bound - 1`, `bound`, and `bound + 1`.
6. Assert every `stalled` outcome carries non-empty, machine-readable evidence naming the three corroborating values.
7. Assert the classifier stays pure and deterministic: same input twice → identical outcome and evidence.
8. Non-vacuity: drop each criterion in turn (traffic, token delta, bound comparison) in temp-copy mutants; each mutant flips at least one matrix row and is caught.

**Expected Outcome**:
- The corroboration rule is exact and total: full corroboration stalls, anything less progresses.
- Every stall is evidence-bearing; no stall can be produced from a partial reading.

#### TC-ECON-022 - Lifecycle evaluation refuses or records; it never spawns, kills, or steers

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F2-1, AC-F3-2, AC-F4-2, F-2, F-3, F-4, NG-6, NFR-3, NFR-4
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/economics-no-execution.test.ts`; recording runtime in `tests/fixtures/economics/harness.ts`
**Tags**: @backend, @security, @cli

**Preconditions**:
- The economics surface exposes a read/liveness/record/refuse runtime only; a recording double counts any spawn, kill, steer, restart-execution, or supervision call.

**Steps**:
1. Assert the runtime type declares no spawn, kill, steer, or restart-execution port.
2. Run every fixture: prefill, stall, absent, attach resume, economical re-entry, uneconomical refusal, within-budget restart, past-budget refusal.
3. Assert the call log contains zero spawn, kill, steer, restart-execution, and supervision invocations across all fixtures.
4. Statically scan the domain, state, config, and CLI economics modules for imports of session-execution, host, or harness-CLI ports; assert none.
5. Assert no fixture mutates a lane record's delivery state.
6. Non-vacuity: a mutant that calls a spawn port on a refusal path fails the call-log assertion.

**Expected Outcome**:
- The change classifies, records, and refuses; it adds no execution path to any surface.
- Refusal always precedes execution: zero spawns on every refusal outcome.

#### TC-ECON-030 - A corroborated stall has exactly one machine identity (GAP-T2)

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F5-1, AC-F2-2, F-5, DM-5, NFR-6, NFR-7, DEC-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/watchdog-liveness.test.ts` (command-level), `tests/behaviour/economics-envelope.test.ts`
**Tags**: @backend, @cli, @contract

**Preconditions**:
- A fully corroborated sourced fixture (heartbeat ≥ bound, tokenDelta `0`, traffic `0`).
- The `watchdog.liveness-stalled` row exists with `user-validation` projection.

**Steps**:
1. Run `watchdog liveness lane-1 --json` on the corroborated fixture.
2. Assert exactly one JSON document is emitted; assert it is the failure side (`error` present, `data` absent).
3. Assert `error.code === "watchdog.liveness-stalled"`, exit `1`, and the documented category/retryable/consequence/remediation hint.
4. Assert no `verdict` key exists anywhere in the payload and no verdict value is serialized as the outcome.
5. Assert the evidence payload is non-empty, names the stall reason, and exposes the three corroborating signal values in machine-readable form.
6. Run text mode; assert the same identity and the same evidence tokens are rendered, with the injected brand name and no envelope JSON.
7. Assert the outcome resolves in `ERROR_TABLE`; assert it is not `fallback.internal` and not `watchdog.signals-absent`.
8. Run the progressing control (exit `0`) and the absent control (exit `2`) to prove the identity is specific.

**Expected Outcome**:
- A sourced stall has exactly one machine representation at exit `1` with signals in evidence and no success payload — GAP-T2 resolved as DEC-1.
- The three liveness outcomes are distinguishable by identity and exit alone.

**Notes / Clarifications**:
- Evidence carriage follows GAP-T2: the failure side carries a bounded evidence payload, and a history/reference pattern is permitted; no new envelope field is assumed.
- The current handler builds `stalled` as success data; this TC is the behavioural flip's assertion.

#### TC-ECON-031 - Progressing stays exit `0` and signals-absent stays exit `2`

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F5-1, AC-F1-2, F-1, F-5, DM-1, NFR-6
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/economics-envelope.test.ts`, `tests/behaviour/watchdog-liveness.test.ts`
**Tags**: @backend, @cli, @regression

**Preconditions**:
- Three fixtures: sourced progressing, corroborated stall, source-less lane.

**Steps**:
1. Run each fixture through `--json`.
2. Assert progressing: success envelope, `data.verdict === "progressing"`, populated signals and evidence, exit `0`.
3. Assert stall: failure envelope, `watchdog.liveness-stalled`, no `data.verdict`, exit `1`.
4. Assert absent: failure envelope, `watchdog.signals-absent`, no verdict, exit `2`.
5. Assert the three outcomes are mutually exclusive and jointly exhaustive over the liveness fixtures: no fixture yields two identities, no fixture yields none, and no fourth liveness outcome exists.
6. Assert exit `2` occurs only for the absent class in the liveness matrix.

**Expected Outcome**:
- `progressing` remains a success verdict, `stalled` is a classified refusal, and `signals-absent` remains the exit-`2` unknown — the delivered contract is extended, not reinterpreted.
- The three-way matrix is total over the fixture population.

#### TC-ECON-032 - Canonical liveness envelopes are committed goldens

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F5-1, F-5, DM-1, NFR-6
**Test Type(s)**: Golden, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/golden/watchdog-output.test.ts` (extended); committed goldens under `tests/fixtures/watchdog/golden/`
**Tags**: @golden, @backend, @cli

**Preconditions**:
- Deterministic clock, run-id generator, brand, and temp roots.

**Steps**:
1. Run progressing, stalled, and signals-absent fixtures through `--json` and text mode.
2. Normalize only `runId`, `timing`, and the temp root; serialize canonically.
3. Compare against committed goldens and assert equality.
4. Assert goldens are opened read-only and their `mtimeMs` is unchanged after the suite.
5. Assert the raw (pre-normalization) evidence still contains the semantic tokens — signal keys and values, the reason, the lane — proving normalization did not erase meaning.
6. Assert regeneration is only through the documented explicit command; a prose change produces a human-reviewable golden diff.

**Expected Outcome**:
- The three liveness envelopes are pinned as reviewable goldens.
- Normalization is narrow and cannot hide a semantic change.

#### TC-ECON-033 - Every new outcome emits one valid exclusive envelope inside `{0,1,2}`

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F5-1, AC-F4-2, AC-F3-2, F-3, F-4, F-5, NFR-6, NFR-7
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/economics-envelope.test.ts`; golden half in `tests/golden/economics.test.ts`; reuse `assertEnvelopeContract` from `@delivery-os/testkit`
**Tags**: @backend, @cli, @contract

**Preconditions**:
- The full fixture matrix: progressing, stalled, signals-absent, restart-within-budget, past-budget refusal, uneconomical refusal, unevaluable-budget refusal.

**Steps**:
1. For each fixture, run `--json` through `runCli` with injected streams.
2. Assert stdout parses as exactly one JSON document with no trailing content and exactly one `schemaVersion` occurrence.
3. Assert the four mandatory fields (`schemaVersion`, `runId`, `exitCode`, `timing`) are present.
4. Assert exactly one of `data`/`error` is present and the other is absent.
5. Assert failure errors carry code, category, retryable, consequence, remediation hint, and a non-empty evidence-bearing summary or evidence payload; assert success data is non-undefined.
6. Assert the envelope `exitCode` equals the numeric return value and the set over the matrix is a subset of `{0, 1, 2}`.
7. Assert exit `0` appears only for success classes, exit `1` only for refusals, exit `2` only for source/availability-unavailable classes.
8. Assert no stderr envelope under `--json`.
9. Assert every refusal outcome carries evidence naming its reason; a failure with empty evidence fails.

**Expected Outcome**:
- One valid exclusive envelope per invocation across every new outcome; zero double payloads, zero empty payloads, zero missing mandatory fields.
- The exit taxonomy is preserved exactly, with exit `2` still reserved.

**Notes / Clarifications**:
- Reuse the existing envelope validator; do not fork a second one. Add only the evidence-totality and exit-class assertions on top.

#### TC-ECON-040 - Attach-and-continue resumes without re-paying prefill

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F3-1, F-3, DM-2, DEC-7
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/economics-resume-attach.test.ts`; harness capability fixtures in `tests/fixtures/economics/cases.ts`
**Tags**: @backend, @resume, @economics

**Preconditions**:
- A fixture whose adapter declaration includes the resume/attach capability, with a persisted session identity and tree root.
- A recording harness seam that logs spawn and resume invocations.

**Steps**:
1. Record the delivery's session identity, tree root, and restart budget view.
2. Invoke the resume path.
3. Assert the session identity is unchanged and no new tree root is created.
4. Assert zero spawns and zero prompt re-entry invocations; the adapter's resume capability was used.
5. Assert no restart event appended and the restart count is unchanged (no ordinal consumed).
6. Assert no re-pay delta is recorded for the delivery.
7. Assert the outcome evidence names attach-and-continue.
8. Run a control fixture whose declaration omits the capability; assert it takes the re-entry path instead (covered in detail by TC-ECON-041/050), proving the branch is capability-driven.

**Expected Outcome**:
- Where the capability is declared, resume is economical by construction: identity persists, prefill is not re-paid, no ordinal is consumed.
- The branch is driven by the adapter declaration, not by a per-harness assumption.

#### TC-ECON-041 - A within-budget uneconomical re-entry is refused with a reason

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F3-2, F-3, NFR-7, DEC-7, RSK-4
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/economics-resume-uneconomical.test.ts`
**Tags**: @backend, @resume, @negative

**Preconditions**:
- A fixture whose harness declares no attach capability, whose only re-entry re-pays prefill, and whose economics classify it uneconomical while the restart count is within budget.

**Steps**:
1. Record the budget view and the session evidence.
2. Invoke the resume path.
3. Assert the outcome is `dispatch.resume-uneconomical` on a failure envelope, exit `1`.
4. Assert the evidence names the reason and the measured or expected prefill re-pay as a numeric token figure; assert the reason token is from the closed reason vocabulary.
5. Assert zero spawns and zero prompt re-entry invocations.
6. Assert no restart event appended and the restart count unchanged.
7. Assert the refusal is a recorded decision, not a destructive act: session identity and existing records are unchanged.
8. Run a control fixture identical except that the economics classify it economical; assert it proceeds and records exactly one restart event (TC-ECON-050), proving the refusal is not unconditional.

**Expected Outcome**:
- A within-budget uneconomical path is refused with an exact identity, exit `1`, and named re-pay evidence; no session is spawned.
- The economical control proves refinement: not every re-entry is refused.

#### TC-ECON-042 - Budget refusal precedes economics; the two reasons stay distinct

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-2, AC-F4-2, AC-F4-3, F-3, F-4, DM-5, NFR-3, NFR-4, DEC-7
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/economics-resume-precedence.test.ts`; matrix `RESUME_PRECEDENCE_CASES`
**Tags**: @backend, @economics, @corner

**Preconditions**:
- A four-cell matrix: (within budget, economical), (within budget, uneconomical), (past budget, economical), (past budget, uneconomical).

**Steps**:
1. Run each cell through the same resume entry point.
2. Assert cell 1 is admitted and appends exactly one restart event.
3. Assert cell 2 is refused with `dispatch.resume-uneconomical`.
4. Assert cells 3 and 4 are both refused with `dispatch.restart-budget-exceeded` — the budget reason wins when past budget.
5. Assert exactly one identity per attempt: no combined error, no two envelopes, no economics evidence replacing the budget reason.
6. Assert zero spawns in all three refusal cells and the budget count unchanged by refusals.
7. Assert the two identities resolve to distinct documented rows with distinct remediation hints (fresh budget vs. capability/harness change).

**Expected Outcome**:
- Past-budget refusal is unambiguous and always the budget reason, so the operator's remediation is exact.
- Within-budget uneconomical refusal stays distinct; the two reasons never alias.

#### TC-ECON-043 - Resume economics is capability-driven and fail-closed

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-1, AC-F3-2, F-3, §21, NFR-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/economics-resume-capability.test.ts`
**Tags**: @backend, @resume, @security

**Preconditions**:
- The delivered capability/gap model from the harness seam, with fixtures for a declared capability, an absent declaration, and a declared-but-gapped-at-use-time capability.

**Steps**:
1. Assert an absent capability declaration is treated as unsupported, never as attach-capable (fail-closed default).
2. Assert a declared capability that reports a gap at use time produces a classified refusal naming the gap, with zero spawns.
3. Assert economics evaluation with incomplete session evidence (missing token facts, unreadable cost) refuses rather than admitting, and never fabricates a `0` re-pay.
4. Assert the refusal reason and evidence name the missing/unevaluable fact.
5. Non-vacuity: a mutant that defaults an undefined capability to "attach" fails.

**Expected Outcome**:
- Economics never assumes a capability the harness did not declare, and never admits an unevaluable resume.
- Degraded evidence is classified, never guessed.

#### TC-ECON-050 - A restart within budget is admitted and recorded durably

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F4-1, AC-F6-1, F-4, F-6, DM-2, NFR-5, DEC-3, NFR-7
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/economics-restart-record.test.ts`; `tests/fixtures/state/harness.ts`
**Tags**: @backend, @state, @economics

**Preconditions**:
- A temp state store with the configured budget `3`; a delivery with zero restart records.

**Steps**:
1. Admit restart 1; read back the appended record.
2. Assert exactly one record is appended, with work item, run, session identity, ordinal `1`, a classified reason from the closed vocabulary, the prefill re-pay delta, and timestamps.
3. Assert the append is fenced and verified: the read-back equals the appended payload and the store reports success.
4. Repeat for restarts 2 and 3; assert ordinals `2` and `3` and exactly one record per admission.
5. Assert the fold over verified records returns count `3` and history ordered by ordinal.
6. Assert a refused attempt (cross-ref TC-ECON-052) appends nothing and does not advance the ordinal.
7. Assert reading the fold never appends.
8. Assert `STATE_SCHEMA_VERSION` is unchanged and existing record kinds still read.

**Expected Outcome**:
- Each admitted restart leaves exactly one durable, verified record with the four declared facts.
- The count and history are a pure fold of verified records, not a mutable counter.

#### TC-ECON-051 - The budget survives a process boundary and replays identically

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F4-1, F-4, DM-2, NFR-5, DEC-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/economics-restart-durability.test.ts`; `tests/fixtures/state/harness.ts`
**Tags**: @backend, @state, @durability

**Preconditions**:
- A temp store root under `mkdtemp`; a writer handle and a later fresh reader handle over the same root.

**Steps**:
1. Through the writer handle, admit two restarts and close the handle (and its edge).
2. Open a fresh handle over the same root; derive the economics view.
3. Assert count `2`, history identical in ordinal, reason, re-pay delta, and session identity, and that the next admitted restart would take ordinal `3`.
4. Assert no cache or in-memory state is required: the fresh handle sees the records without any prior read.
5. Assert no harness store was queried during the fresh-handle derivation.
6. Derive twice from two fresh handles; assert byte-identical canonical output.
7. Assert no migration ran and the schema version is unchanged.
8. Assert cleanup removes only the temp root.

**Expected Outcome**:
- The budget and history survive process lifetime and are reconstructible by any path, which is what makes daemon-down one-shot consumption valid.
- Replay is deterministic and side-effect free.

**Notes / Clarifications**:
- Durability is asserted at the closed-and-reopened store boundary (GAP-T4); a bounded child process may strengthen it but is not required.

#### TC-ECON-052 - A restart past budget fails loudly with history (SC-M1-15 economics half)

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F4-2, F-4, F-5, DM-3, NFR-3, NFR-4, NFR-7, DEC-2, SC-M1-15
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/economics-budget-exhaustion.test.ts`
**Tags**: @backend, @cli, @scenario-m1-15, @state

**Preconditions**:
- A 3-of-3 fixture: three restart records and a configured budget of `3`.
- A recording runtime that logs spawns, queue mutations, and state appends.

**Steps**:
1. Attempt restart 4.
2. Assert the attempt is refused **before any spawn**: the spawn log is empty and the gate is evaluated before any execution step.
3. Assert the outcome is `dispatch.restart-budget-exceeded` on a failure envelope, exit `1`.
4. Assert the evidence names the classified reason, the restart count, and the full restart history (or a reference that resolves to the full durable history).
5. Assert a terminal exhaustion record is appended durably with the classified reason and the history reference; read it back.
6. Assert no restart-event record is appended for the refused attempt and the count stays `3`.
7. Assert no silent requeue: zero queue-mutation calls and zero spawn calls; nothing in this change marks the entry or re-enters.
8. Assert the outcome/records carry the reason and count/history that a status data surface would render (data present; rendering out of scope).
9. Control: a 2-of-3 attempt is admitted and appends ordinal `3` — the refusal is not unconditional.

**Expected Outcome**:
- Restart N+1 past budget is refused loudly with a classified reason, full history, and a durable terminal record; no fourth spawn on any path.
- SC-M1-15's economics assertions hold: "no fourth spawn", "terminal, classified reason, restart history".

**Notes / Clarifications**:
- Queue marking (M1-S17), typed question (M1-S16), and one-collection-cycle delivery (M1-S18) are out of scope; this TC asserts the data they consume (TC-ECON-054), never their behaviour.
- Evidence carriage follows GAP-T2: a bounded evidence payload plus a resolvable history reference is sufficient; no envelope schema change is assumed.

#### TC-ECON-053 - Every resume path consumes the exhaustion identically

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F4-3, F-4, NFR-3, DEC-3, RSK-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/economics-budget-path-parity.test.ts`
**Tags**: @backend, @state, @parity

**Preconditions**:
- Two distinct entry points: a daemon-style supervised resume composition and a one-shot resume composition, each wired through production composition (not a shared test helper that bypasses one).
- The same exhausted durable state for one delivery.

**Steps**:
1. Run the supervised composition; capture the failure envelope, identity, evidence, exit, and spawn log.
2. Run the one-shot composition against the same state; capture the same facts.
3. Assert both are refused with `dispatch.restart-budget-exceeded`, exit `1`, and zero spawns.
4. Assert the normalized refusal payloads are identical in identity, reason, restart count, and history-reference shape; assert zero divergence (an empty diff over the normalized payloads).
5. Assert the durable terminal record remains the single terminal truth for the delivery: a second refusal does not overwrite it, fork the reason, or create a conflicting terminal state.
6. Assert the one-shot path does not require the daemon or a live supervisor (it reads state only).
7. Non-vacuity: a mutant one-shot composition that spawns after a local count check fails the parity and spawn assertions.

**Expected Outcome**:
- Both paths refuse identically, so a one-shot resume past budget is as loud and as classified as a supervised one.
- Cross-path divergence is exactly zero; the terminal record stays the single truth.

#### TC-ECON-054 - The terminal state is escalation-ready data, not silence

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F4-4, F-4, F-6, DM-3, DM-4, NFR-4
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/economics-exhaustion-record.test.ts`
**Tags**: @backend, @state, @escalation

**Preconditions**:
- An exhausted delivery with three restart records and a terminal exhaustion record.

**Steps**:
1. Read the terminal record and assert it is marked terminal for the delivery.
2. Assert it carries the classified reason (`dispatch.restart-budget-exceeded`) and a restart-history reference that resolves to the full ordered history.
3. Assert the consumer-field set is present as data: the fields a queue failure marking needs (delivery identity, terminal state, reason), the fields a typed question needs (reason, restart count, available options as declared data), and the fields a collection-cycle delivery needs (delivery/run identity, reason, timestamp). Assert the field contract is declared in the contracts tier, not inferred from prose.
4. Assert the record contains no prompt text, transcript, or credential material.
5. Run a post-exhaustion replay (re-read the state and re-run any resume evaluation); assert zero spawns, zero automatic re-entry, and no queue mutation performed by this change.
6. Assert nothing in the change writes a "requeue" or "retry" instruction for an exhausted delivery.
7. Assert the record is additive: no schema bump and existing record kinds remain readable.

**Expected Outcome**:
- Exhaustion is a rich terminal datum: reason, history, and the fields later consumers need, with no silence and no automatic re-entry.
- The change never requeues; it hands the data to the stories that will.

**Notes / Clarifications**:
- Asserting field presence is asserting the change's own output, not M1-S16/S17/S18 behaviour (NG-1..NG-3).
- The exact field names beyond the spec's named reason/history are delivery-bound (GAP-T5); the test reads the declared consumer-field contract.

#### TC-ECON-055 - The budget gate is fail-closed on unevaluable state

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F4-2, AC-F4-3, F-4, §21, NFR-4
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/economics-budget-failclosed.test.ts`; `tests/fixtures/state/harness.ts` fault injection
**Tags**: @backend, @state, @security, @negative

**Preconditions**:
- Fixtures: a torn budget record, an unreadable store, an unknown record kind among the delivery's records, and a contradictory ordinal sequence (gap and duplicate).

**Steps**:
1. Run the gate for each fixture.
2. Assert each refuses: no admission, zero spawns, and no restart event appended.
3. Assert the outcome is a classified failure (exit `1` or `2` per the classifying row), never a success and never a silent admission.
4. Assert the evidence names the unevaluable condition and the delivery identity.
5. Assert the classification reuses an existing identity (`state.store.torn`, `state.store.unknown`, or the delivered invalid-record identity) and is not `fallback.internal`.
6. Assert the gate never fabricates count `0` from an unreadable state.
7. Non-vacuity: a mutant that treats an unreadable store as an empty budget (count `0` → admit) fails.

**Expected Outcome**:
- An unevaluable budget refuses rather than admits; fail-closed is asserted, not inferred.
- Every unevaluable class is classified and evidence-bearing.

#### TC-ECON-056 - One gate, every path: budget consumption has a single seam

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F4-2, AC-F4-3, F-4, NFR-3, RSK-3
**Test Type(s)**: Unit, Contract, Static
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/economics-gate-seam.test.ts`; AST/dependency scan over the domain and composition modules
**Tags**: @backend, @structure, @boundary

**Preconditions**:
- The budget gate and both resume compositions exist.

**Steps**:
1. Assert exactly one exported admission/gate function (or one composition decoration) decides restart admission; assert no second implementation exists.
2. Scan every restart-event append call site; assert each is dominated by the gate's admission result — no path appends a record before evaluating the gate.
3. Assert both the supervised and one-shot compositions reference the same gate (reference equality at composition), not a copy.
4. Assert the gate reads the count by folding durable records; assert no lane-/session-/process-scoped counter and no cached count field exists.
5. Assert no module other than the declared gate composes restart admission.
6. Non-vacuity: a mutant resume path that spawns after appending a record, bypassing the gate, fails the call-order or domination assertion, naming the file.

**Expected Outcome**:
- One seam is the only admission authority; a bypass is structurally detectable, which is the mitigation for RSK-3.
- The gate's truth is the durable record fold, not a parallel counter.

#### TC-ECON-060 - Per-delivery economics derives from durable records alone

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F6-1, F-6, DM-2, DM-3, DM-4, NFR-5
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/economics-view.test.ts`; `tests/fixtures/state/harness.ts`
**Tags**: @backend, @state, @economics

**Preconditions**:
- Four fixtures: zero restarts, one restart, three restarts, three restarts plus a terminal exhaustion record.
- A recording harness seam that counts session/store queries.

**Steps**:
1. Derive the per-delivery view from a fresh store handle for each fixture.
2. Assert `restarts` equals the record count and the history is ordered by ordinal with reason, re-pay delta, and session identity.
3. Assert `resumeAmplification` is present per the declared semantics (see TC-ECON-061).
4. Assert the view field names match the dispatch envelope's declared names (`restarts`, `resumeAmplification`) and the history field is declared in the contract.
5. Assert the recording harness seam shows zero session/store queries during derivation — no re-query.
6. Derive twice from two fresh handles; assert byte-identical output (100% reconstruction).
7. Assert the terminal record is reflected in the view (terminal flag or reason) without a second read path.
8. Assert derivation is read-only: no append, no mutation, no lane write.

**Expected Outcome**:
- Restart count, history, and amplification reconstruct per delivery from state alone, in the shape the later consumers expect.
- Derivation is pure over records: no harness access, no writes.

#### TC-ECON-061 - Resume amplification is computed and flagged by name

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F6-1, F-6, DM-4, §10
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/economics-amplification.test.ts`
**Tags**: @backend, @economics, @amplification

**Preconditions**:
- Fixtures: zero re-pay, one re-pay delta, three ascending re-pay deltas, and a loop fixture (repeated re-pay with no growth in unique progress).
- The declared amplification semantics and flag vocabulary in the contract.

**Steps**:
1. Derive the view for each fixture.
2. Assert a zero-re-pay fixture reads the declared healthy baseline (approximately `1`, within the declared tolerance) or the declared underivable value — never a fabricated `0`.
3. Assert one re-pay raises the ratio above the healthy baseline, and three ascending deltas raise it monotonically.
4. Assert the loop fixture is flagged by the declared name and its ratio is strictly above the healthy baseline.
5. Assert the flag name and the ratio field come from one contract home; no free-form string appears in output.
6. Assert a delivery with zero restarts carries no amplification flag and no invented ratio.
7. Assert the figures are counts/token classes only, with no prompt text.

**Expected Outcome**:
- Amplification is a per-delivery number that separates healthy deliveries from a restart loop, and the loop is flagged by name.
- The signal is computed from records, never from a guess or a live session.

**Notes / Clarifications**:
- The exact formula and the flag threshold are under-specified by the spec ("tokens paid across restarts versus unique progress, approximately 1 for healthy deliveries"); the test asserts the declared ordering, monotonicity, flag naming, and null rule (OQ-T2). Delivery may not weaken these properties.

#### TC-ECON-062 - Missing economics figures degrade to null with a warning

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F6-1, F-6, DM-2, DM-4, NFR-5, §10
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/economics-degradation.test.ts`
**Tags**: @backend, @economics, @degradation

**Preconditions**:
- Restart records with an absent re-pay delta, an absent token class, and an absent cost figure.

**Steps**:
1. Derive the view for each degraded fixture.
2. Assert the absent figure is `null` (or absent per the declared optional semantics), never `0` and never an estimate.
3. Assert a warning names the missing field and the affected record ordinal.
4. Assert derivation completes and the rest of the view (count, history, other figures) remains correct.
5. Assert the warning set is non-empty only for the degraded fields — a complete fixture produces no warning.
6. Assert optional payload fields are modelled as absent, not as explicit `undefined` values (type test).
7. Non-vacuity: a mutant that substitutes `0` for a missing re-pay delta fails naming the field.

**Expected Outcome**:
- Missing economics data degrades visibly to null-with-warning and never fabricates a zero or an estimate.
- A healthy delivery's view carries no spurious warnings.

#### TC-ECON-070 - The lane configuration keys own their defaults and semantics

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F7-1, F-7, DM-6, DEC-5
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/config-lane.test.ts` (new or extended `config-*` suite); `packages/core/src/config/{catalog,defaults,resolver,provenance}.ts`
**Tags**: @backend, @config

**Preconditions**:
- The catalog declares the `lane` branch with the two keys; shipped defaults exist.

**Steps**:
1. Resolve configuration with an absent `lane` branch; assert `lane.liveness-interval` resolves to `30000` (ms) and `lane.restart-budget` to `3`, each with the `defaults` origin.
2. Resolve configuration with explicit values; assert the values and their source origins (`user`/`project` as applicable).
3. Assert the key paths are exactly the spec's spellings and the units are declared (ms for the interval, restarts per delivery for the budget).
4. Assert the liveness evaluation seam reads the resolved interval as its declared cadence policy: the resolved value is passed to the seam and governs the evaluation policy datum. Assert no scheduler is started (daemon is M1-S18).
5. Assert the budget gate reads the resolved bound (cross-ref TC-ECON-072).
6. Assert each default is declared once in the defaults layer, documented with its semantics, and not duplicated as a literal elsewhere (structure scan).
7. Assert the existing configuration suites still pass and no existing key changes value or origin.

**Expected Outcome**:
- Both keys resolve with `defaults` origins when absent and carry their declared semantics.
- The defaults are single-homed and documented; the interval is policy data, not a scheduling claim.

#### TC-ECON-071 - Invalid lane configuration reuses existing identities

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F7-1, F-7, DM-6
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/config-lane.test.ts`; invalid fixtures under `tests/fixtures/config/**`
**Tags**: @backend, @config, @negative

**Preconditions**:
- A matrix of invalid configurations under `lane`.

**Steps**:
1. Run the resolver for each case: unknown key under `lane`, wrong type (string budget, float interval, boolean), invalid value (`0`, negative, non-integer budget; `0`/negative interval), and `lane` itself as a scalar.
2. Assert each is classified through the existing configuration identities (`config.key.unknown`, `config.value.invalid` as delivered), naming the key and the accepted value.
3. Assert no new configuration identity is added to the error table by this change.
4. Assert invalid input never silently falls back to the default: it refuses.
5. Assert the failures are evidence-bearing and exit per the existing projection.
6. Assert a valid control resolves, proving the matrix is not vacuous.

**Expected Outcome**:
- Invalid lane configuration reuses the delivered identities exactly, with no new codes and no silent defaulting.
- Unknown-key discipline holds for the fixed branch.

#### TC-ECON-072 - The budget bound is configuration-driven, never a literal

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F7-1, AC-F4-1, F-4, F-7, NFR-3, DEC-5
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/economics-budget-config.test.ts`
**Tags**: @backend, @config, @economics

**Preconditions**:
- Fixtures resolving `lane.restart-budget` to `0`, `1`, `3`, and `5`.

**Steps**:
1. With budget `0`, attempt restart 1; assert refusal with `dispatch.restart-budget-exceeded`, no event, no spawn.
2. With budget `1`, assert the first admission appends ordinal `1` and the second attempt is refused.
3. With budget `5`, assert five admissions append ordinals `1..5` and the sixth is refused.
4. Assert the count/history in each fixture reflects exactly the configured bound, not `3`.
5. Non-vacuity: a mutant hardcoding `3` fails the budget-`5` case; a structure scan asserts no `3` literal in the gate module and that the default lives only in the defaults layer.
6. Assert the configured bound is read at evaluation time, not captured at construction (change the resolved config between evaluations in a fixture and observe the new bound).

**Expected Outcome**:
- The bound is policy-as-data: exactly the configured number of restarts is admitted, then the gate refuses.
- A hardcoded bound is caught by a mutant and a structure scan.

#### TC-ECON-080 - Identical facts replay to identical verdicts and economics

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: NFR-1, NFR-6, AC-F5-1, AC-F6-1
**Test Type(s)**: Integration, Golden, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/economics-determinism.test.ts`; goldens under `tests/fixtures/economics/golden/`
**Tags**: @backend, @golden, @determinism

**Preconditions**:
- Injected clock, run-id generator, brand, budget bound, and buffer sinks.
- Two structurally identical temp store roots and one store run twice.

**Steps**:
1. Run each liveness fixture and each economics fixture twice against the same store; normalize `runId`, `timing`, and temp roots.
2. Run the same fixtures against a second structurally identical store; normalize identically.
3. Compare envelopes, evidence, restart ordinals, reasons, re-pay deltas, and the amplification view; assert byte-identical.
4. Assert the raw (pre-normalization) evidence still contains the semantic refs, signal names/values, and reason tokens.
5. Assert the normalizer replaced only volatile fields and never a code, reason, ordinal, or signal value.
6. Assert no test observes wall-clock time, randomness, locale, or ordering-dependent state.

**Expected Outcome**:
- Identical facts produce identical verdicts, records, and economics views.
- Normalization is narrow and reviewable; zero replay drift.

#### TC-ECON-081 - Mutants prove every zero-defect threshold is enforced

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: NFR-1, NFR-2, NFR-3, NFR-4, NFR-5, AC-F2-1, AC-F4-3, AC-F6-1
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/economics-mutants.test.ts`; committed mutant fixtures under `tests/fixtures/economics/mutants/**`
**Tags**: @backend, @checks, @mutants

**Preconditions**:
- Each mutant is an isolated module in a temp copy or an in-memory replacement; the live tree is never mutated.

**Steps**:
1. Mutant A — prefill misclassification: classify `stalled` when token delta `> 0`. Assert TC-ECON-020's suite fails naming the case.
2. Mutant B — CPU substitution: map CPU-busy to `stalled`. Assert TC-ECON-012/021 fail naming the CPU fact.
3. Mutant C — absence-to-zero: map an absent traffic reading to `0`. Assert TC-ECON-010/021 fail naming the kind.
4. Mutant D — gate bypass: a resume path that spawns and appends without the gate. Assert TC-ECON-056/053 fail naming the file.
5. Mutant E — hardcoded bound `3`. Assert TC-ECON-072 fails naming the configured bound.
6. Mutant F — fail-open budget: unreadable store treated as count `0`. Assert TC-ECON-055 fails naming the store condition.
7. Mutant G — silent exhaustion: refusal with no reason and no history reference. Assert TC-ECON-052/054 fail naming the missing evidence.
8. Mutant H — fabricated zero: missing re-pay delta rendered as `0`. Assert TC-ECON-062 fails naming the field.
9. Assert each mutant failure message names the offending field or condition; a mutant that passes fails the meta-assertion.

**Expected Outcome**:
- Every zero-defect threshold in NFR-1..NFR-5 has a failing mutant, so the threshold is enforced rather than claimed.
- The mutant catalogue is committed data reviewed like code.

#### TC-ECON-082 - Existing behaviour does not regress on the additive path

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F1-2, AC-F2-2, AC-F5-1, NFR-8, NFR-9
**Test Type(s)**: Regression, Integration
**Automation Level**: Automated
**Target Layer / Location**: existing `tests/structure/watchdog-*`, `tests/behaviour/watchdog-*`, `tests/golden/watchdog-output.test.ts`, `tests/conformance/harness-*`, `tests/behaviour/config-*`, `tests/behaviour/state-*`, `tests/structure/error-table.test.ts`, `tests/boundaries`
**Tags**: @backend, @regression

**Preconditions**:
- The delivered suites are present and unchanged except for the five deliberate updates listed below.

**Steps**:
1. Run the delivered watchdog suites: contract, imports, preflight, teardown, memory, liveness, envelope, exit, checks-not-runner, determinism, and goldens. Assert green.
2. Run the harness conformance liveness and classification suites and the conformance-coverage meta-check. Assert green.
3. Run the config, state, error-table, envelope, and exit-projection suites. Assert green.
4. Run `bun test tests/boundaries` and `pnpm check:boundaries`. Assert green with no rule change.
5. Assert signals-absent still exits `2` with no verdict (TC-ECON-011 overlap is intentional: the regression suite must independently hold).
6. Assert the five deliberate updates are exactly: (i) `WATCHDOG_ERROR_CODES` exactly-three → exactly-four; (ii) the error-table exact total → the new exact total; (iii) GH-221's "no runtime path produces `stalled`/`progressing`" → reachability assertions; (iv) the harness liveness exact-kind-count assertion reconciled per GAP-T1; (v) watchdog liveness fixtures that expected `signals-absent` on a now-sourced lane.
7. Assert no assertion was weakened to a floor (`toBeGreaterThan`) or deleted rather than replaced.
8. Review-time obligation (not a permanent suite): confirm with `git diff --name-only` that no other existing test file changed.

**Expected Outcome**:
- The additive change alters no delivered behaviour beyond the intended liveness flip.
- The five updates are explicit, exact, and reviewed; no coverage is silently lost.

#### TC-ECON-083 - Documentation and inventory reconcile with the delivered surface

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-F6-1, AC-F7-1, DM-5, DM-6, NFR-8, §16
**Test Type(s)**: Manual, Contract
**Automation Level**: Manual
**Target Layer / Location**: `doc/spec/features/{feature-watchdog-lane-contracts,feature-harness-adapters,feature-result-contract,feature-config-layer,feature-state-layer}.md`, the new session-lifecycle-economics feature spec, `tests/structure/inventory.json`
**Tags**: @docs, @phase-7

**Preconditions**:
- Delivery is complete and the documentation-sync phase runs.

**Steps**:
1. Assert `feature-watchdog-lane-contracts.md` states sourced signals, the `stalled`/`progressing` reachability flip, and GAP-T2's resolution as DEC-1.
2. Assert `feature-harness-adapters.md` updates its out-of-scope note so liveness sourcing is no longer described as pending.
3. Assert `feature-result-contract.md` carries the new `dispatch` kind and the four rows, byte-matching the table (TC-ECON-004 proves the mechanical half).
4. Assert `feature-config-layer.md` documents `lane.liveness-interval` (30 s) and `lane.restart-budget` (3).
5. Assert `feature-state-layer.md` documents the two additive record kinds and no schema bump.
6. Assert a session-lifecycle-economics feature spec exists and matches the delivered behaviour.
7. If exports or subpaths were added, assert `tests/structure/content-inventory.test.ts` and `tests/structure/subpaths.test.ts` are updated and green.
8. Assert every changed distributable doc declares `ados_distribution`, and run `bash scripts/.tests/test-doc-distribution.sh` if a marker-scoped doc changed.
9. Run `git diff --check` and review headings, tables, and code fences for rendering.

**Expected Outcome**:
- The system spec matches the delivered surface; no doc claims a capability that was not delivered or omits one that was.
- Distribution markers and inventories are consistent, so the doc-distribution drift guard stays green.

#### TC-ECON-084 - The new surface is tier- and brand-conformant

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-1, AC-F7-1, NFR-9, F-1, F-7, §21
**Test Type(s)**: Unit, Contract, Static
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/economics-imports.test.ts`; `scripts/checks/forbidden-literals.ts`; `tests/checks/forbidden-literals.test.ts`
**Tags**: @backend, @branding, @security

**Preconditions**:
- The new modules and any rendered text/diagnostic exist; the synthetic brand is available from `tests/golden/helpers.ts`.

**Steps**:
1. Run the seed-literal matcher over every new module and any new diagnostic text; assert zero matches.
2. Render every text-mode output and refusal diagnostic with the synthetic brand; assert the injected `binaryName` appears where a binary name is rendered and no seed literal appears.
3. Run `pnpm check:forbidden-literals` over the live tree; assert zero violations.
4. Assert contracts carry no behaviour or I/O; domain carries no runtime API; adapters own harness specifics (TC-ECON-002 overlap is intentional: brand and tier fail independently).
5. Assert refusal evidence and records contain no secret-shaped or prompt-shaped content; run the delivered privacy/secret scans over the new payloads and assert no canary from a fixture appears in output.
6. Non-vacuity: inject a product literal and a `node:fs` import into temp copies of the new modules; each scanner fails naming the file and token.

**Expected Outcome**:
- Zero product/binary literals, zero behaviour in contracts, zero per-harness logic outside the adapter seam.
- Refusal and record payloads carry counts and identities only, never content or secrets.

## 6. Environments and Test Data

| Environment | Runtime / tool | Invocation | Scope |
|-------------|----------------|------------|-------|
| Local development | Bun `1.4.4` (repo pin), pnpm `10.18.3` | `bun test tests/structure/economics-*`, `bun test tests/behaviour/economics-*`, `bun test tests/behaviour/watchdog-liveness.test.ts` | Structure, types, conformance, behaviour, golden, and checks suites |
| Local invariants | Bun | `bun run scripts/checks/{error-table-sync,forbidden-literals,ambient-globals}.ts`; `pnpm check:boundaries` | Binding, brand, purity, boundaries |
| CI `ts-test` | Bun `1.4.4` | `pnpm test` after `pnpm install --frozen-lockfile` | Every `*.test.ts`, including the new suites |
| CI `ts-boundaries` | Bun | `pnpm build`; `pnpm check:boundaries` | Dependency-cruiser rules, ambient globals, fixture-coverage meta-check |
| CI `ts-invariants` | Bun | `bun run scripts/checks/*.ts` | Error-table sync, literal scans, entrypoints |
| CI aggregate | Bun | `pnpm check`; `git diff --check` | Lint, format, typecheck, tests, boundaries, exports parity |
| Documentation | bash and manual | `bash scripts/.tests/test-doc-distribution.sh` only if a marker-scoped doc changes | Distribution-marker drift (phase 7) |

**Test data.**

- **Liveness matrices** live in `tests/fixtures/economics/cases.ts` as committed, code-reviewed data: `PREFILL_CASES` (size × duration × source shape), `CORROBORATION_CASES` (heartbeat × token delta × traffic, including boundary values), `RESUME_PRECEDENCE_CASES`, `BUDGET_PATH_CASES`, and `OUTCOME_EXIT_CASES`. Matrices are data, not prose; adding a row is a reviewed change.
- **Signal facts** are synthetic: fabricated heartbeat ages, token deltas, and traffic counts with fixed observation timestamps. No real session is read.
- **Session identities** are fabricated (`ses_fixture_*`, synthetic tree roots). No real harness session id, prompt, transcript, diff, or credential appears anywhere.
- **Restart and exhaustion records** are written through `tests/fixtures/state/harness.ts` into temp store roots with a mutable clock and deterministic fence tokens. Ordinals, reasons, re-pay deltas, and session identities are fixed per case.
- **Privacy canaries**: fabricated canary strings are planted in any field that could carry content, and each suite asserts the canary never appears in a record, evidence payload, or rendered diagnostic.
- **Configuration fixtures** live under `tests/fixtures/config/**` and cover: absent `lane` branch, explicit values, and every invalid case (unknown key, wrong type, `0`/negative/non-integer, scalar branch).
- **Goldens** live under `tests/fixtures/economics/golden/` and `tests/fixtures/watchdog/golden/`; normalization replaces temp roots and removes `runId`/`timing` only. Goldens are opened read-only and their `mtimeMs` is asserted unchanged; regeneration is an explicit, reviewed command.
- **Mutants** live under `tests/fixtures/economics/mutants/**` and are applied to temp copies or in-memory strings; the live tree is never mutated. Each mutant declares the suite and assertion it must trip.

**Isolation and cleanup.**

- Every filesystem-touching suite uses `mkdtemp` under the system temp directory and removes the root in `afterEach`, including on failure; a guard rejects any fixture root equal to `process.cwd()`.
- State handles and edges are closed in `finally`; a fresh reader handle over the same root is opened only after the writer closes.
- Injected fakes replace clocks, run ids, brands, config, harness I/O, credentials, and streams. No suite reads the real `process.env`, `$HOME`, network, or a live harness store.
- The live worktree is never written; read-only and golden suites snapshot `git status --porcelain` before and after and assert it is unchanged.

## 7. Automation Plan and Implementation Mapping

| TC ID | Test file to create or update | Execution command | Mocking / fixtures | Status |
|-------|-------------------------------|-------------------|--------------------|--------|
| TC-ECON-001 | `tests/structure/economics-contract.test.ts`; `tests/types/economics.type-test.ts`; contracts module (expected) | `bun test tests/structure/economics-contract.test.ts`; `pnpm typecheck` | AST data-only detector; temp-copy mutant | To Implement |
| TC-ECON-002 | `tests/structure/economics-imports.test.ts`; `tests/boundaries` | `bun test tests/structure/economics-imports.test.ts tests/boundaries`; `pnpm check:boundaries` | AST scans; temp-copy mutants; production depcruise rules | To Implement |
| TC-ECON-003 | `tests/structure/error-table.test.ts` (extended); `packages/core/src/contracts/error-table.ts` | `bun test tests/structure/error-table.test.ts` | In-memory table; committed existing-row fingerprint | Existing – Update |
| TC-ECON-004 | `tests/checks/error-table-sync.test.ts`; `tests/fixtures/result/code-corpora/*.json`; `doc/spec/features/feature-result-contract.md` | `bun test tests/checks/error-table-sync.test.ts`; `bun run scripts/checks/error-table-sync.ts` | Temp-copy mutation roots per existing suite | Existing – Update |
| TC-ECON-005 | `tests/structure/economics-contract.test.ts` | `bun test tests/structure/economics-contract.test.ts` | Declared matrix data; in-memory mutants | To Implement |
| TC-ECON-010 | `tests/conformance/harness-liveness.test.ts`; `tests/behaviour/economics-liveness-sourcing.test.ts`; `tests/fixtures/harness/**` | `bun test tests/conformance/harness-liveness.test.ts tests/behaviour/economics-liveness-sourcing.test.ts` | Injected liveness facts; recording harness seam | Existing – Update |
| TC-ECON-011 | `tests/behaviour/watchdog-liveness.test.ts`; `tests/conformance/harness-liveness.test.ts` | `bun test tests/behaviour/watchdog-liveness.test.ts tests/conformance/harness-liveness.test.ts` | Declared-gap fixtures; buffer sinks | Existing – Update |
| TC-ECON-012 | `tests/structure/economics-imports.test.ts`; `tests/structure/watchdog-contract.test.ts`; `tests/behaviour/watchdog-liveness.test.ts`; `tests/types/economics.type-test.ts` | `bun test tests/structure/ tests/behaviour/watchdog-liveness.test.ts`; `pnpm typecheck` | AST scan; CPU-shaped fixtures | Existing – Update |
| TC-ECON-020 | `tests/behaviour/economics-liveness-prefill.test.ts`; `tests/fixtures/economics/cases.ts` | `bun test tests/behaviour/economics-liveness-prefill.test.ts` | Prefill matrix; recording runtime | To Implement |
| TC-ECON-021 | `tests/behaviour/economics-liveness-corroboration.test.ts`; `CORROBORATION_CASES` | `bun test tests/behaviour/economics-liveness-corroboration.test.ts` | Matrix; temp-copy criterion mutants | To Implement |
| TC-ECON-022 | `tests/behaviour/economics-no-execution.test.ts`; `tests/fixtures/economics/harness.ts` | `bun test tests/behaviour/economics-no-execution.test.ts` | Recording runtime; AST scan; mutant | To Implement |
| TC-ECON-030 | `tests/behaviour/watchdog-liveness.test.ts`; `tests/behaviour/economics-envelope.test.ts` | `bun test tests/behaviour/watchdog-liveness.test.ts tests/behaviour/economics-envelope.test.ts` | Corroborated fixture; buffer sinks | Existing – Update |
| TC-ECON-031 | `tests/behaviour/economics-envelope.test.ts` | `bun test tests/behaviour/economics-envelope.test.ts` | Three-way matrix | To Implement |
| TC-ECON-032 | `tests/golden/watchdog-output.test.ts`; `tests/fixtures/watchdog/golden/` | `bun test tests/golden/watchdog-output.test.ts` | Normalized goldens; read-only mtime assertion | Existing – Update |
| TC-ECON-033 | `tests/behaviour/economics-envelope.test.ts`; `tests/golden/economics.test.ts` | `bun test tests/behaviour/economics-envelope.test.ts tests/golden/economics.test.ts` | Full outcome matrix; `assertEnvelopeContract` | To Implement |
| TC-ECON-040 | `tests/behaviour/economics-resume-attach.test.ts` | `bun test tests/behaviour/economics-resume-attach.test.ts` | Capability fixtures; recording harness seam | To Implement |
| TC-ECON-041 | `tests/behaviour/economics-resume-uneconomical.test.ts` | `bun test tests/behaviour/economics-resume-uneconomical.test.ts` | Uneconomical/economical controls | To Implement |
| TC-ECON-042 | `tests/behaviour/economics-resume-precedence.test.ts`; `RESUME_PRECEDENCE_CASES` | `bun test tests/behaviour/economics-resume-precedence.test.ts` | Four-cell matrix | To Implement |
| TC-ECON-043 | `tests/behaviour/economics-resume-capability.test.ts` | `bun test tests/behaviour/economics-resume-capability.test.ts` | Capability/gap fixtures; fail-closed mutant | To Implement |
| TC-ECON-050 | `tests/behaviour/economics-restart-record.test.ts`; `tests/fixtures/state/harness.ts` | `bun test tests/behaviour/economics-restart-record.test.ts` | Temp store; fence/clock; verified append | To Implement |
| TC-ECON-051 | `tests/behaviour/economics-restart-durability.test.ts` | `bun test tests/behaviour/economics-restart-durability.test.ts` | Closed and reopened store handles | To Implement |
| TC-ECON-052 | `tests/behaviour/economics-budget-exhaustion.test.ts` | `bun test tests/behaviour/economics-budget-exhaustion.test.ts` | 3-of-3 fixture; recording runtime | To Implement |
| TC-ECON-053 | `tests/behaviour/economics-budget-path-parity.test.ts` | `bun test tests/behaviour/economics-budget-path-parity.test.ts` | Two production compositions; bypass mutant | To Implement |
| TC-ECON-054 | `tests/behaviour/economics-exhaustion-record.test.ts` | `bun test tests/behaviour/economics-exhaustion-record.test.ts` | Terminal record fixtures; consumer-field contract | To Implement |
| TC-ECON-055 | `tests/behaviour/economics-budget-failclosed.test.ts` | `bun test tests/behaviour/economics-budget-failclosed.test.ts` | Fault-injecting state edge; fail-open mutant | To Implement |
| TC-ECON-056 | `tests/structure/economics-gate-seam.test.ts`; AST scan over domain/composition | `bun test tests/structure/economics-gate-seam.test.ts` | AST/reference equality; bypass mutant | To Implement |
| TC-ECON-060 | `tests/behaviour/economics-view.test.ts` | `bun test tests/behaviour/economics-view.test.ts` | Four record fixtures; recording harness seam | To Implement |
| TC-ECON-061 | `tests/behaviour/economics-amplification.test.ts` | `bun test tests/behaviour/economics-amplification.test.ts` | Zero/one/three/loop re-pay fixtures | To Implement |
| TC-ECON-062 | `tests/behaviour/economics-degradation.test.ts`; `tests/types/economics.type-test.ts` | `bun test tests/behaviour/economics-degradation.test.ts`; `pnpm typecheck` | Degraded records; fabricated-zero mutant | To Implement |
| TC-ECON-070 | `tests/behaviour/config-lane.test.ts`; `tests/fixtures/config/**` | `bun test tests/behaviour/config-lane.test.ts` | Default and explicit config fixtures | To Implement |
| TC-ECON-071 | `tests/behaviour/config-lane.test.ts`; invalid fixtures | `bun test tests/behaviour/config-lane.test.ts` | Invalid matrix; valid control | To Implement |
| TC-ECON-072 | `tests/behaviour/economics-budget-config.test.ts` | `bun test tests/behaviour/economics-budget-config.test.ts` | Budget `0/1/3/5` fixtures; hardcoded-bound mutant | To Implement |
| TC-ECON-080 | `tests/checks/economics-determinism.test.ts`; `tests/fixtures/economics/golden/` | `bun test tests/checks/economics-determinism.test.ts` | Two identical stores; injected clock/run-id/brand | To Implement |
| TC-ECON-081 | `tests/checks/economics-mutants.test.ts`; `tests/fixtures/economics/mutants/**` | `bun test tests/checks/economics-mutants.test.ts` | Eight isolated mutants | To Implement |
| TC-ECON-082 | existing `tests/{structure,behaviour,golden,conformance,boundaries}` suites | `bun test tests/structure tests/behaviour tests/golden tests/conformance`; `bun test tests/boundaries` | Unchanged suites plus the five documented updates | Existing – Update |
| TC-ECON-083 | `doc/spec/features/*`, new feature spec, `tests/structure/inventory.json` | Manual review; `bash scripts/.tests/test-doc-distribution.sh` if marker-scoped docs change; `git diff --check` | — | Manual Only (phase 7) |
| TC-ECON-084 | `tests/structure/economics-imports.test.ts`; `tests/checks/forbidden-literals.test.ts` | `bun test tests/structure/economics-imports.test.ts tests/checks/forbidden-literals.test.ts`; `pnpm check:forbidden-literals` | Seed-literal matcher; synthetic brand; temp-copy mutants | To Implement |

**Fixture helper obligations:**

- `tests/fixtures/economics/cases.ts` — the committed matrices (`PREFILL_CASES`, `CORROBORATION_CASES`, `RESUME_PRECEDENCE_CASES`, `BUDGET_PATH_CASES`, `OUTCOME_EXIT_CASES`) with each case's expected outcome, identity, exit, and `SC-M1-*` reference where applicable.
- `tests/fixtures/economics/harness.ts` — a recording runtime over `runCli` with injected clock/run-id/brand/buffer sinks, sourced signal sources, and counters for spawn, kill, steer, queue mutation, state append, and harness query.
- `tests/fixtures/economics/golden/` — normalized canonical envelopes and economics views; explicit regeneration script only.
- `tests/fixtures/economics/mutants/` — the eight mutant modules with their expected tripping suite and message.
- Reused unchanged: `tests/fixtures/state/harness.ts`, `tests/fixtures/harness/{harness-io.ts,scenarios/**}`, `tests/fixtures/watchdog/{cases.ts,harness.ts}`.

**Expected gate battery for this change:**

1. Narrow iteration: `bun test tests/structure/economics-*.test.ts tests/structure/watchdog-contract.test.ts tests/structure/error-table.test.ts tests/behaviour/economics-*.test.ts tests/behaviour/watchdog-liveness.test.ts`.
2. Binding and brand: `bun run scripts/checks/error-table-sync.ts`; `pnpm check:forbidden-literals`.
3. Conformance: `bun test tests/conformance/harness-liveness.test.ts tests/structure/conformance-coverage.test.ts`.
4. Boundaries: `bun test tests/boundaries` (expected no rule change; a rule change without a negative fixture fails the meta-check).
5. Aggregate: `pnpm check` (lint → format:check → typecheck → test → check:boundaries → exports parity) plus `git diff --check`.
6. What the aggregate proves for this change: the new modules typecheck under strict flags, satisfy every layering/ambient/brand rule with no rule loosening, pass the full existing suite including the five deliberate updates, and export correctly. It does **not** prove live-harness sourcing, daemon consumption, queue marking, question delivery, spend rendering, or any out-of-scope behaviour.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Risk | Impact | Mitigation |
|----|------|--------|------------|
| TR-1 | The neutral liveness vocabulary and the watchdog signal vocabulary are conflated, so sourcing tests pin a shape delivery must change, or delivery silently loosens GH-233's exact-three assertions. | H | GAP-T1/OQ-T1: assert the projected watchdog keys, absence semantics, no-CPU rule, and one-home; read the declared vocabulary instead of hardcoding; require the exact-count reconciliation to be deliberate and reviewed. |
| TR-2 | "Never killed" is asserted as a behavioural absence that no test can observe directly, so a passing suite proves nothing. | H | GAP-T3: three independent observations — port absence, zero recorded invocations, zero state mutation — plus a mutant that calls a spawn port on a progressing/refusal path (TC-ECON-022, TC-ECON-081). |
| TR-3 | Structured failure evidence cannot ride the exclusive v1 envelope, so "signals in evidence" or "full history in evidence" could be satisfied by prose only. | H | GAP-T2/OQ-T2: assert machine-readable numeric facts plus a history reference that resolves to the durable record; assert no new envelope field; treat a prose-only summary as insufficient. |
| TR-4 | Durability tests use a fresh handle in the same process and could pass while a real second process diverges (for example, a cached count or an unflushed append). | M | GAP-T4: close the writer handle and its edge before reopening; assert the read requires no prior in-memory state; strengthen with a bounded child process if delivery adds one cheaply. |
| TR-5 | Cross-path parity is vacuous when both "paths" share a test helper that bypasses one production composition. | H | TC-ECON-053 requires two distinct production compositions and reference equality on the gate; the bypass mutant in TC-ECON-056/081 must be caught. |
| TR-6 | The amplification formula is under-specified, so a test pins a guessed constant and blocks a legitimate formula refinement or masks a real regression. | M | Assert ordering, monotonicity, the healthy baseline, the loop flag's name, and the null rule; record the exact formula as OQ-T2 and never freeze a constant the spec does not state. |
| TR-7 | The intended liveness flip invalidates existing assertions; a delivery that deletes or floors them silently loses coverage. | H | TC-ECON-082 enumerates exactly five permitted updates and asserts exact counts and replaced (not removed) assertions; review checks the diff. |
| TR-8 | Two-way table sync and documented rows land in different phases, so the binding check fails late and tempts a weakened row. | M | TC-ECON-003/004 and TC-ECON-083 make the same-phase obligation explicit; the delivery order in spec §18 puts rows and documented rows first. |
| TR-9 | Fail-closed budget classification is under-specified, so a test pins a guessed identity or accepts `fallback.internal`. | M | TC-ECON-055 asserts "classified, non-zero, never admits, never fabricates count 0" and forbids `fallback.internal`; the exact existing identity is delivery-bound. |
| TR-10 | A mutant lives in the live tree or a golden is rewritten as a side effect, creating a false green. | M | Mutants are temp-copy/in-memory only with a `process.cwd()` guard; goldens are read-only with `mtimeMs` asserted; regeneration is an explicit reviewed command. |
| TR-11 | The "no fourth spawn" assertion is checked only in-process, so a real daemon path could still spawn. | M | The out-of-scope boundary is explicit (NG-3): this change asserts the gate's decision and zero in-process spawns; daemon execution coverage is M1-S18's. The terminal record makes a bypass visible in state (RSK-3). |
| TR-12 | Bundle-size of a 37-scenario battery slows iteration and encourages selective runs that skip the binding checks. | L | The §7 gate battery orders narrow suites first and names the binding, conformance, and aggregate gates explicitly; CI runs all suites. |

### 8.2 Assumptions

- The delivered watchdog verdict vocabulary, signal keys, stall bound, and corroboration rule are reused unchanged; only sourcing, the fourth identity, and reachability are added (spec §12).
- The harness adapter capability declarations are the authority on resume/attach support; an absent declaration means unsupported (fail-closed), never an assumed capability.
- The state layer's additive record-kind pattern (fenced verified append, verified read, no migration) is available and is the durable home for both new kinds.
- The restart budget counts per delivery (work item), not per session or process, so daemon-style and one-shot paths share one budget.
- The liveness interval governs the evaluation policy datum; no scheduler exists in this change (daemon is M1-S18), so no cadence timing is asserted.
- The economics view exposes the dispatch envelope's declared field names (`restarts`, `resumeAmplification`); emission is M1-S9's and no envelope field is added here.
- Failure evidence rides the exclusive envelope's failure side (bounded evidence payload and/or a resolvable durable reference); no `CommandResultError` extension is assumed (GAP-T2).
- Module paths, export names, record-kind strings, store-key spellings, and the amplification flag spelling are delivery-bound; their behaviour and closedness are pinned (GAP-T5).
- Local `git` is not used by this change's tests except for the read-only worktree-unchanged snapshot; no lane repository fixture is needed.
- Bun `1.4.4` is available and `bun:test` is the only runner.

### 8.3 Open Questions

| ID | Question | Blocking? | Owner | Resolution path |
|----|----------|-----------|-------|-----------------|
| OQ-T1 | Does the neutral liveness report grow its closed kind vocabulary (e.g. heartbeat-age, token-delta) or do those two watchdog values derive from sourced traffic plus token statistics? DM-1 says "sourced heartbeat-age and token-delta entries alongside session traffic (closed kinds)", while the delivered vocabulary is exactly three kinds and both suites assert that. | No for authoring; **yes before delivery** because it changes a cross-story contract and the conformance assertions. | `@plan-writer` / `@coder` / `@decision-advisor` if it needs a record | Decide in the delivery plan; reconcile the exact-three assertions deliberately in the same phase; never loosen to a floor. TC-ECON-010 asserts the observable projection either way. |
| OQ-T2 | What is the exact amplification formula, the healthy/tolerance boundary, the flag name, and the null rule? The spec says "tokens paid across restarts versus unique progress, approximately 1 for healthy deliveries, flagged by name where a restart loop amplified". | No | `@plan-writer` / `@coder` | Delivery declares the formula and flag name in the contracts tier; TC-ECON-061 asserts ordering, monotonicity, flag naming, and the null rule. |
| OQ-T3 | Where does structured refusal evidence live on a failure envelope: a bounded machine-parseable evidence payload, a durable history reference, or (out of scope) a new envelope error field? | No for authoring; **yes before delivery** for AC-F2-2/AC-F3-2/AC-F4-2 to be objectively verifiable. | `@plan-writer` / `@coder` | Choose within the exclusive v1 envelope (no schema change); TC-ECON-030/033/041/052/054 assert machine-readable facts plus a resolvable history, never prose alone. |
| OQ-T4 | Which existing identity classifies an unevaluable budget state (`state.store.torn`, `state.store.unknown`, or a delivered invalid-record identity)? | No | `@coder` | Reuse an existing row; TC-ECON-055 asserts "classified, non-zero, never admits" and forbids `fallback.internal`, not a specific code. |
| OQ-T5 | Is the terminal exhaustion record one per delivery appended once, or appended per refused attempt with one current terminal state? | No | `@coder` | TC-ECON-053 asserts the terminal record remains the single terminal truth and refusals do not fork the reason; the append count is delivery-bound. |
| OQ-T6 | Do the two new record kinds get their own store-scoped keys (per delivery) or a single shared ledger key folded by delivery? | No | `@coder` | Delivery-bound; TC-ECON-050/060 assert durability, per-delivery isolation, and derivation, not the key spelling. |
| OQ-T7 | Does the restart gate read the resolved config at evaluation time or capture the bound at construction? | No | `@coder` | TC-ECON-072 asserts evaluation-time behaviour (a changed bound is observed); if delivery captures at construction, it must justify it against the policy-as-data requirement. |
| OQ-T8 | Exactly which consumer fields must the terminal record carry for M1-S16/S17/S18, and are they declared as a contract type here? | No | `@plan-writer` / `@coder` | TC-ECON-054 asserts the declared consumer-field contract; the names are delivery-bound within the spec's named reason/history plus the consumers' stated needs. |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-07 | test-plan-writer | Initial test plan derived from `chg-GH-235-spec.md` v1.0, ticket GH-235, backlog M1-S15, seed scenarios SC-M1-14/SC-M1-15, the delivered GH-221 watchdog and GH-233 harness contracts, and `.ai/rules/testing-strategy.md`. 37 scenarios; all 13 ACs covered; SC-M1-15's escalation half mapped to M1-S16/S17/S18; GAP-T1..T6 and OQ-T1..T8 recorded. |

## 10. Test Execution Log

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| — | — | Not run | Populated during delivery and quality gates. |
