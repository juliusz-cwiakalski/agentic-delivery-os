---
id: chg-GH-234-test-plan
status: Proposed
created: "2026-11-07T00:00:00Z"
last_updated: "2026-11-07T00:00:00Z"
owners: [engineering]
service: delivery-os provider engine
labels: [change, planning]
version_impact: minor
summary: "Prove model routing as profile-driven machinery: typed tier/profile/seat/pacing configuration with fail-closed validation and inspectable provenance; deterministic declarative selection heuristics; a hard capability gate that refuses a text-only seat for a vision task regardless of chain position; an eligibility chain whose provider probes are lazy and memoized within a resolution pass; normalized watch mappings for the coding-plan subscription windows, DeepSeek balance, and OpenAI usage windows behind the existing transport seam; expensive-window parks with cause and absolute expiry and exact resume; switch-not-park on subscription exhaustion with a persisted target and automatic revert-on-recovery; typed pacingClass enforcement that moves only execution seats; resolution-before-spawn with data-v1 env records that are never shell-interpreted and are hardened beyond the legacy ADOS_HOOK_ENV_V1 floor; guarded-vocabulary and error-table sync; and the five ported decision-table groups. The battery is hermetic: injected clock, sleep, transport, credential port, and state store; zero live network, live credentials, or real sleeps."
links:
  change_spec: ./chg-GH-234-spec.md
  implementation_plan: null   # authored in delivery_planning (phase 4); TCs and traces are pinned here
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - M1-S21: Model profiles and provider watching

## 1. Scope and Objectives

This plan protects one behavioural thesis: **the engine, not operator discipline, decides which model an agent runs at every spawn**. That thesis fails if eligibility is not total over a profile's providers, if a text-only seat can receive a vision task under quota pressure, if exhaustion stalls a spawn instead of switching, if an expensive window parks without a cause or an absolute expiry, if a recovered provider never reverts the persisted target, if a pacing rung can move a judgment seat, if any of that requires a code change instead of configuration, or if the resolved model environment reaches a spawn as anything other than validated data. The highest-severity surface is env-record injection (F-8, Appendix D): a validation gap there is a shell-injection class, so the legacy `ADOS_HOOK_ENV_V1` floor is treated as the minimum, not the target. The second is truthfulness under failure: a probe failure, malformed vendor response, or missing credential must never read as availability or "clear" (F-4, F-5, RSK-2).

The seed scenarios SC-M1-21 and SC-M1-22 in `doc/planning/oss-tooling/milestones/m1/test-scenarios.md` are binding; divergence after delivery is a defect. Their assertions are folded into TC-PROFILE-008, TC-PROFILE-022, TC-PROFILE-024, TC-PROFILE-026, TC-PROFILE-029, TC-PROFILE-034, and TC-PROFILE-049.

### 1.1 In Scope

- The typed profile-model configuration branch: tiers, profiles, model-per-tier/seat assignments, per-agent overrides, capability descriptors, provider sets, preference chains, pacing goal priorities, named rungs, and thresholds — layered through the existing catalog, fail-closed, empty by default (F-1, F-7; DM-1..DM-5; AC-F1-5; DEC-9; NFR-11).
- Declarative selection heuristics evaluated as policy data (consequence of error × reasoning depth ÷ volume, amplification rules, family-diversity rules) and the selection event that records profile, tier, rung, and reason (F-2; EVT-5; DEC-7).
- Hard capability gates: a text-only seat is refused for a vision task regardless of chain position or quota advantage; the refusal is a named blocker; selection proceeds to the next capable candidate or fails closed (F-3; DM-6; EVT-3; AC-F3-3).
- Eligibility as "every provider a profile uses is available", with a verdict and named blockers per profile, lazy probes, per-pass memoization, probe-failure-is-never-availability, and the evaluation-cost bound (F-4; DM-6; NFR-5; NFR-6; Appendix A groups 1–2).
- Provider watching for the first-iteration set — coding-plan subscription weekly and rolling windows, DeepSeek balance against a configured floor, OpenAI subscription usage windows — as normalized snapshot mappings behind the delivered quota transport seam, with the engine's malformed/outage/credential classification unchanged and read-only status (F-5, F-9; DM-9; AC-F9-7; NFR-2, NFR-9).
- Profile-level park, switch, and revert: expensive-window parks with a closed cause and absolute expiry; switch-not-park on exhaustion; a switch event carrying the new target and revert condition; a persisted target-profile state record; automatic revert with exactly one revert event per episode (F-6; EVT-1, EVT-2, EVT-4; DM-10; AC-F6-1, AC-F6-2; Appendix A groups 3–4).
- Subscription pacing with a typed `pacingClass` on every seat assignment (`judgment` | `execution`): rungs move only execution seats; judgment seats are invariant across rungs; a configuration attempting to move a judgment seat is rejected or structurally inert (F-7; DM-3, DM-5; AC-F7-4; DEC-1).
- Spawn-time resolution and `provider profile resolve --for-spawn` env records in `data-v1`: resolution runs before every current spawn surface; a spawn never starts without a resolved profile; the record is header + `set`/`unset` + final LF + size limits + allowlist + hardened validation classes; values are data and are never shell-interpreted (F-8; DM-7; AC-F8-1; DEC-3; NFR-7).
- Command surface: `provider resolve --profile`, `provider profile resolve [--agent] [--for-spawn]`, `provider watch status [--provider]`, envelope shapes, and exit conventions (F-9; Appendix C).
- Guarded-vocabulary growth synchronized in-change: switch/revert/ineligible events, the target-profile record kind, the selection event, new error identities, bidirectional error-table sync, bounded evidence, and secret safety (F-10; EVT-1..EVT-5; NFR-4, NFR-8, NFR-10).
- Ported decision-table coverage over the five enumerated groups (chain order, lazy probes, park-versus-switch, revert, condition seams) and the no-silent-path matrix (F-11; AC-F11-6; Appendix A; DEC-5).
- Cross-cutting guarantees: determinism, hermetic tests, runtime neutrality and boundary confinement, secret safety canaries, idempotence and zero-write reads (NFR-1..NFR-4, NFR-8, NFR-9).

Ticket-to-AC traceability: the seven ticket ACs map to AC-F8-1, AC-F6-2, AC-F6-1, AC-F3-3, AC-F7-4, AC-F1-5, and AC-F11-6; the milestone-exit criterion is AC-F8-8; the watching deliverable is AC-F9-7.

### 1.2 Out of Scope & Known Gaps

- [OUT] Dispatch-daemon integration — NG-1, M1-S9 (GH-239). This plan proves the `--for-spawn` seam; it does not drive a daemon.
- [OUT] The command audit ledger and its override-evidence surface — NG-2, M1-S22 (GH-223). AC-F8-8's "zero manual overrides in the final two-week window" is milestone-scoped and cannot be asserted by this change's suite (see GAP-T1).
- [OUT] Spend reporting, cost dashboards, and metrics exporters — NG-3. Selection events are tested; consumers are not built.
- [OUT] Difficulty proposal/cross-validation flow — NG-8. The declarative heuristics framework is tested; the escalation flow is not.
- [OUT] Non-UTC, cross-midnight, or local-timezone pricing windows — NG-4. All window tests are UTC.
- [OUT] Background watchers, timers, or daemons — NG-5. Every transition is observed at resolution time; no test starts a timer.
- [OUT] Modification or retirement of the legacy bash hook — NG-6. The `ADOS_HOOK_ENV_V1` contract is carried over as data; a structure check asserts the hook is not modified.
- [OUT] Tracker, VCS, and CI provider work; MCP/OpenCode provider surfaces — NG-7.
- [OUT] New harness adapters or changes to delivered adapter capability gaps — NG-9.
- [GAP-T1 — milestone-exit evidence is external to this change] AC-F8-8 explicitly says the exit evidence arrives via M1-S9 and M1-S22 and is not gated on this change's merge. The only in-change assertions are that current spawn surfaces route through resolution and that the `--for-spawn` seam exists and is exercised (TC-PROFILE-058). The "audit ledger shows zero manual overrides in the final two-week window" is a milestone review obligation, not a permanent suite assertion; asserting it here would violate the invariant-test rule against moving-window/PR-time checks.
- [GAP-T2 — watch vendor mappings are fixture-proven, not live-proven] The three vendor response shapes are external APIs (RSK-2). Tests prove normalization, boundary classification, and "never clear on malformed" over committed fixtures; they do not call the vendors. Live-shape drift remains a review/operations concern. If a vendor fixture is not supplied at delivery, the mapping test fails naming the missing fixture rather than weakening the assertion.
- [GAP-T3 — spawn-surface enforcement versus the untouched legacy hook] F-8 says resolution runs before every spawn on current surfaces, while NG-6/§8.5 say the legacy bash hook is untouched and its contract carries over as data. The enforceable in-change point is the engine/wrapper seam plus the hook contract's validated records; the concrete current spawn surface and its integration point are delivery-bound (see OQ-T1). Tests assert the seam and the data contract, never a hook modification.
- [GAP-T4 — pacing goal-priority conflict resolution is not pinned] DM-5 declares three goal priorities (utilize the subscription window; keep the judgment seat until a configured tail; minimize paid use) but the spec does not state precedence when they conflict. Tests assert deterministic evaluation over declared priorities and the typed `execution`-only movement rule; the precedence order must be pinned in delivery planning or by a decision record (see OQ-T2). No test invents a precedence.
- [GAP-T5 — tier, rung, and threshold names are delivery-bound] Tier working names (lite/regular/powerful), rung names, the tail threshold, and the priced-multiplier threshold are configuration identifiers (OQ-1). Tests use fixture-declared names; they do not freeze a vocabulary that the naming lock may rename.
- [GAP-T6 — NFR-6 "reference environment" is unspecified] The 50 ms bound for 100 profiles × 100 providers excludes transport but depends on the runner. The perf test records the measured baseline and asserts the bound on the reference CI class; a slower local machine is not a defect. The test also asserts no I/O occurs during evaluation, which is environment-independent.
- [GAP-T7 — provenance surface for the new branch] "Provenance of every effective value is inspectable" is satisfied through the delivered `config debug` / `config get --show-origin` surface. If the profile branch needs a dedicated inspection flag, that is a design addition, not a reinterpretation of the AC; tests assert the existing surface reports the new branch's values and origins.
- [GAP-T8 — delivery-bound names and locations] Module paths, export names, record-kind names, payload-schema strings, configuration keys, error identities, and fixture filenames are delivery-bound. The behaviours, closed sets, AC traces, and assertions are not. Per §4.1, a test that cannot resolve a seam must fail naming the missing contract instead of silently skipping.

## 2. References

- **Change specification**: [chg-GH-234-spec.md](./chg-GH-234-spec.md) — §5 F-1..F-11, §6 flows 1–5, §8 EVT-1..EVT-5 and DM-1..DM-10, §9 NFR-1..NFR-11, §11 RSK-1..RSK-8, §14 OQ-1..OQ-3, §15 DEC-1..DEC-9, §17 AC-F8-1..AC-F8-8, §20 privacy, §21 security, §24 Appendix A (ported groups), Appendix B (seeded scenarios), Appendix C (envelope shapes), Appendix D (env-record classes).
- **Seed scenarios**: [doc/planning/oss-tooling/milestones/m1/test-scenarios.md](../../../planning/oss-tooling/milestones/m1/test-scenarios.md) — SC-M1-21 (profile eligibility with hard capability gate and auto-switch revert) and SC-M1-22 (expensive window parks; exhaustion switches) are binding; divergence is a defect.
- **PM record**: [chg-GH-234-pm-notes.yaml](./chg-GH-234-pm-notes.yaml) — context only: ported-tests definition (decision-table groups, not an external ID battery), spawn-integration scope, milestone-exit scoping, and the open external-battery question. The spec is the source of truth.
- **Testing strategy**: [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) — `bun:test` under `tests/**/*.test.ts`; fixtures are never `*.test.ts`; permanent suites assert the current tree; goldens are regenerated only by an explicit command; boundary rules need a failing fixture; `pnpm check` is the aggregate gate.
- **TypeScript rules**: [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md) — strict typing, purity, injected time/randomness/environment, the error contract, injected fakes over module mocking, no moving-base diff assertions.
- **Delivered substrate reused, never re-implemented**:
  - Provider contracts and engine: `packages/core/src/contracts/provider.ts`, `packages/core/src/provider/{engine,chain,conditions,parks,peak,quota,validate,announcements}.ts`.
  - Provider CLI: `packages/cli/src/commands/provider.ts` (`resolve`, `quota`, `parks list`) and `packages/cli/src/classify.ts`.
  - Config layer: `packages/core/src/config/{catalog,defaults,resolver,schema,provenance}.ts`, `config debug`, and `config get --show-origin`.
  - State layer: additive record kinds, single-writer fences, verified reads, and the state test harness (`tests/fixtures/state/harness.ts`).
  - Result contract: `CommandResult` envelope, `packages/core/src/contracts/error-table.ts`, `scripts/checks/error-table-sync.ts`, `tests/checks/error-table-sync.test.ts`.
  - Deny-by-default spawn environment: `packages/core/src/domain/harness-spawn-env.ts` and `tests/behaviour/harness-spawn-env.test.ts`.
  - Credential port and secret-read boundary: `packages/core/src/contracts/credentials.ts`, `packages/adapters/src/credentials/**`, `scripts/checks/secret-read-boundary.ts`, `tests/checks/secret-read-boundary.test.ts`.
  - Legacy env-record validation precedents: `scripts/.tests/test-hook-regression.sh`, `scripts/ceo-loop.sh` (the `OC_ADOS_AGENT_*_MODEL` allowlist and `ADOS_HOOK_ENV_V1` grammar). The legacy script is read as a contract, never executed as a live oracle.
  - Boundary machinery: `.dependency-cruiser.cjs`, `scripts/checks/ambient-globals.ts`, `scripts/checks/workspace-entrypoints.ts`, `tests/boundaries/**`.
- **Precedent plans**: [chg-GH-182-test-plan.md](../../2026-10/2026-10-31--GH-182--provider-v1/chg-GH-182-test-plan.md) (provider engine) and [chg-GH-233-test-plan.md](../../2026-11-06--GH-233--harness-adapters/chg-GH-233-test-plan.md) (harness seam) — house format and rigor.
- **Related system specs**: `doc/spec/features/feature-provider-engine.md`, `feature-harness-adapters.md`, `feature-config-layer.md`, `feature-state-layer.md`, `feature-result-contract.md`, and `feature-monorepo-scaffold-toolchain.md` (paths as delivered; reconcile at doc-sync if a feature spec is split for the profile area per §16).
- **Ticket**: GitHub issue `juliusz-cwiakalski/agentic-delivery-os#234` — M1-S21: Model profiles and provider watching.

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| AC | Criterion (abbreviated) | TC ID(s) | Status |
|----|--------------------------|----------|--------|
| AC-F8-1 | Resolution runs before every current spawn surface; the spawn starts only with a resolved profile; the emitted environment is a validated `data-v1` record, never shell code or shell-interpreted; no profile means a classified, announced refusal and no spawn — never an implicit model. | TC-PROFILE-003, TC-PROFILE-033, TC-PROFILE-034, TC-PROFILE-035, TC-PROFILE-036, TC-PROFILE-037, TC-PROFILE-044, TC-PROFILE-058 | Covered |
| AC-F6-1 | An expensive window parks the provider with a closed cause and an absolute expiry; profiles using it are ineligible with the park named as blocker; the provider resumes exactly when the window clears; no sleep-without-record path and no background timer. | TC-PROFILE-022, TC-PROFILE-023, TC-PROFILE-049, TC-PROFILE-051 | Covered |
| AC-F6-2 | Exhaustion makes the preferred profile ineligible and selects the next eligible profile automatically (switch-not-park); the switch event carries the new target and revert condition; the target persists; recovery reverts to the preferred profile automatically with exactly one revert event. | TC-PROFILE-024, TC-PROFILE-025, TC-PROFILE-026, TC-PROFILE-027, TC-PROFILE-028, TC-PROFILE-041, TC-PROFILE-050 | Covered |
| AC-F3-3 | A text-only candidate is refused for a vision task regardless of chain position or quota advantage; the eligibility list names the capability blocker per refused profile; selection proceeds with the next capable candidate or fails closed with a classified refusal. | TC-PROFILE-008, TC-PROFILE-009, TC-PROFILE-010 | Covered |
| AC-F7-4 | With declared goal priorities and rungs and a threshold crossing, only `execution`-class seats move; every `judgment` seat is unchanged across all rungs; an attempt to move a judgment seat is rejected at validation or structurally inert. | TC-PROFILE-029, TC-PROFILE-030, TC-PROFILE-031, TC-PROFILE-032 | Covered |
| AC-F1-5 | Changing only configuration (chain, thresholds, rungs, per-agent overrides) changes routing with zero code changes; invalid configurations fail closed with classified errors; every effective value's provenance is inspectable. | TC-PROFILE-001, TC-PROFILE-002, TC-PROFILE-004, TC-PROFILE-005 | Covered |
| AC-F11-6 | Each of the five ported decision-table groups has coverage; every legacy fail-open/fail-stuck class asserts a structured event or classified outcome; no silent behaviour remains. | TC-PROFILE-047, TC-PROFILE-048, TC-PROFILE-049, TC-PROFILE-050, TC-PROFILE-051, TC-PROFILE-052 | Covered |
| AC-F9-7 | `provider watch status [--provider]` reports name, condition, source, and checkedAt from each normalized snapshot mapping; malformed vendor responses surface as outage, never clear; the read performs zero state writes. | TC-PROFILE-016, TC-PROFILE-017, TC-PROFILE-018, TC-PROFILE-019, TC-PROFILE-020, TC-PROFILE-021, TC-PROFILE-045 | Covered |
| AC-F8-8 | At milestone exit every pilot-path spawn resolved through the engine and the audit ledger shows zero manual overrides in the final two-week window; this change delivers the machinery and the seam, with evidence arriving via M1-S9 and M1-S22. | TC-PROFILE-058 | Covered for machinery/seam; **TODO (external)** for milestone evidence — GAP-T1, DEC-4/DEC-6 |

**Capability coverage** (every F-# has at least one TC):

- F-1 → 001, 002, 003, 004, 005
- F-2 → 006, 007
- F-3 → 008, 009, 010
- F-4 → 011, 012, 013, 014, 015
- F-5 → 016, 017, 018, 019, 020, 021
- F-6 → 022, 023, 024, 025, 026, 027, 028
- F-7 → 029, 030, 031, 032
- F-8 → 033, 034, 035, 036, 037, 038, 058
- F-9 → 043, 044, 045, 046
- F-10 → 039, 040, 041, 042
- F-11 → 047, 048, 049, 050, 051, 052
- Cross-cutting NFRs → 053, 054, 055, 056, 057

**Capability-level coverage (no AC added or renumbered)**: F-2 selection-event telemetry and heuristic replay → 006, 007; F-10 vocabulary/record/error growth → 039, 040, 041, 042; F-9 named-profile resolve and invalid grammar → 043, 046; NFR-only guarantees → 053, 054, 055, 056, 057, 015.

**Seeded-scenario traceability**:

| Seed | Assertions | TC ID(s) |
|------|------------|----------|
| SC-M1-21 | mixed ineligible on exhaustion; deepseek selected automatically; text-only candidate refused for a vision task regardless of position; revert to mixed on recovery; env record emitted as validated data; per-profile blocker; revert event; judgment seats unchanged across rungs. | TC-PROFILE-008, TC-PROFILE-024, TC-PROFILE-026, TC-PROFILE-029, TC-PROFILE-034, TC-PROFILE-049, TC-PROFILE-050 |
| SC-M1-22 | peak-window provider parks with cause and expiry and resumes at window clear; exhausted provider does not park the spawn and the chain switches; park record carries cause + expiry; switch event carries new target + revert condition; no sleep-without-record path. | TC-PROFILE-022, TC-PROFILE-024, TC-PROFILE-027, TC-PROFILE-049, TC-PROFILE-052 |

**Decision coverage**: DEC-1 → 029, 030; DEC-2 → 008, 011, 012, 013, 014, 022, 024, 026; DEC-3 → 034, 035, 036, 037; DEC-4/DEC-6 → 058; DEC-5 → 047, 048, 049, 050, 051, 052; DEC-7 → 006; DEC-8 → 001, 005, 016, 017, 018; DEC-9 → 003, 033.

**Risk coverage**: RSK-1 → 039, 040; RSK-2 → 019, 051; RSK-3 → 047..052; RSK-4 → 035, 036, 037, 038; RSK-5 → 025, 028; RSK-6 → 058; RSK-7 → 009; RSK-8 → 032, 057.

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

The spec declares no REST/HTTP endpoint and no `API-#` identifier (§8.1). The outbound interactions are the three declared watch mappings behind the existing transport seam. The interface is the event and data-model contract below.

| Element | TC ID(s) | Observable assertion |
|---------|----------|----------------------|
| EVT-1 profile switch event | TC-PROFILE-024, TC-PROFILE-025, TC-PROFILE-028, TC-PROFILE-049 | Carries previous target, new target, and revert condition; deterministic identity; no duplicate for an unchanged condition; bounded secret-free evidence |
| EVT-2 profile revert event | TC-PROFILE-026, TC-PROFILE-028, TC-PROFILE-050 | Carries restored target and recovering provider; exactly one per exhaustion episode; no duplicate on later unchanged resolutions |
| EVT-3 profile-ineligible event / eligibility list | TC-PROFILE-008, TC-PROFILE-010, TC-PROFILE-011, TC-PROFILE-024, TC-PROFILE-049 | Per refused profile: verdict and named blockers (condition or capability); surfaced in the selection envelope `eligibility[]`; never silently dropped |
| EVT-4 target-profile record | TC-PROFILE-024, TC-PROFILE-025, TC-PROFILE-026, TC-PROFILE-041, TC-PROFILE-050, TC-PROFILE-057 | Additive record kind with its own payload schema, store-scoped key, single-writer fence, verified post-append read, latest wins; reason and revert condition; no schema-version bump or migration |
| EVT-5 selection event | TC-PROFILE-006, TC-PROFILE-007, TC-PROFILE-032, TC-PROFILE-057 | One event per decision with profile, tier, rung, reason, and blockers when the top candidate was refused; deterministic identity and dedupe |
| DM-1 tier | TC-PROFILE-001, TC-PROFILE-002, TC-PROFILE-039 | Named responsibility group; typed catalog branch; exact-key discipline |
| DM-2 profile and capability descriptor | TC-PROFILE-001, TC-PROFILE-002, TC-PROFILE-009, TC-PROFILE-039 | Model-per-tier/seat, per-agent overrides, closed capability vocabulary per seat, provider set, chain position data |
| DM-3 seat assignment with `pacingClass` | TC-PROFILE-001, TC-PROFILE-002, TC-PROFILE-029, TC-PROFILE-030 | Closed `judgment`/`execution`; engine enforces rung movement by the field, not by name |
| DM-4 preference chain | TC-PROFILE-002, TC-PROFILE-004, TC-PROFILE-005, TC-PROFILE-011 | Base profile, fallbacks, order; non-empty; no unknown references; no duplicates; ordering violations classified |
| DM-5 pacing configuration | TC-PROFILE-001, TC-PROFILE-002, TC-PROFILE-031 | Goal priorities, named rungs, thresholds; all values configuration; no hardcoded policy |
| DM-6 eligibility verdict | TC-PROFILE-008, TC-PROFILE-010, TC-PROFILE-011, TC-PROFILE-012, TC-PROFILE-013 | Per profile `eligible`/`ineligible` with blockers; lazy order follows the chain |
| DM-7 env record (`data-v1`) | TC-PROFILE-034, TC-PROFILE-035, TC-PROFILE-036, TC-PROFILE-037 | Header, `set`/`unset`, final LF, size limits, allowlist, hardened classes, `recordFormat: data-v1`; data only |
| DM-8 selection decision envelope | TC-PROFILE-043, TC-PROFILE-044 | Selected profile, rung, agent overrides, eligibility list, env record with `--for-spawn`, events; or classified refusal with eligibility list and announcements |
| DM-9 watch condition view | TC-PROFILE-016, TC-PROFILE-017, TC-PROFILE-018, TC-PROFILE-019, TC-PROFILE-020, TC-PROFILE-045 | Name, condition, source (mapping id plus human summary), checkedAt; normalized snapshot only; never raw vendor body |
| DM-10 expensive window | TC-PROFILE-022, TC-PROFILE-023, TC-PROFILE-049 | Declared peak hours or priced-multiplier threshold; closed cause; absolute expiry at window end; exact resume |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR | TC ID(s) | Gate / assertion |
|-----|----------|------------------|
| NFR-1 Determinism | TC-PROFILE-006, TC-PROFILE-011, TC-PROFILE-053 | 100 identical replays produce identical decisions, eligibility lists, env records, and event identities; injected clock/locale/environment changes do not alter results; no ambient randomness |
| NFR-2 Hermetic tests | TC-PROFILE-019, TC-PROFILE-054 | 0 live network calls, 0 live credential reads, 0 real sleeps; injected clock/sleep/transport/credential/state; throwing-fetch guard |
| NFR-3 Runtime neutrality | TC-PROFILE-055 | Selection policy imports only core contracts; 0 runtime-API access; watch transports are declared adapter edges; secret-read boundary gains 0 allowlist entries |
| NFR-4 Secret safety | TC-PROFILE-021, TC-PROFILE-038, TC-PROFILE-056 | 0 secret bytes, auth headers, credential values, raw vendor bodies, or endpoint userinfo in envelopes, env records, state records, events, diagnostics, or evidence; one-time credential handoff |
| NFR-5 Probe laziness and memoization | TC-PROFILE-012, TC-PROFILE-013, TC-PROFILE-048 | At most one availability probe per distinct provider per pass; providers probed only when a decision depends on them; probe count ≤ distinct providers evaluated |
| NFR-6 Evaluation cost | TC-PROFILE-015 | 100 profiles over a 100-provider configuration evaluate in ≤ 50 ms on the reference environment, excluding transport; no I/O during evaluation |
| NFR-7 Env-record hardening | TC-PROFILE-035, TC-PROFILE-036, TC-PROFILE-037 | 100% of Appendix D classes rejected with a classified refusal; values never shell-interpreted; no unauthorized name, duplicate, homoglyph, metacharacter, NUL, CR, embedded equals-in-name, missing final LF, or over-limit payload reaches a spawn |
| NFR-8 Bounded evidence | TC-PROFILE-042 | Event and state-record evidence ≤ 1024 serialized bytes and ≤ 20 fields, drawn only from the closed engine allowlists |
| NFR-9 Idempotence | TC-PROFILE-007, TC-PROFILE-020, TC-PROFILE-025, TC-PROFILE-026, TC-PROFILE-028, TC-PROFILE-032, TC-PROFILE-057 | Unchanged conditions append 0 duplicate switch, revert, ineligible, or selection events; one revert per episode; `watch status` and read-path resolves perform 0 state writes |
| NFR-10 Error-table synchronization | TC-PROFILE-039, TC-PROFILE-040 | 100% of new error identities exist in the machine and documented tables in both directions; exact-code, total classification; `fallback.internal` containment; existing rows unchanged |
| NFR-11 Configuration-only tuning | TC-PROFILE-004, TC-PROFILE-001, TC-PROFILE-002, TC-PROFILE-005 | Chain, thresholds, rungs, and per-agent overrides change routing with 0 code changes, demonstrated by config-only test variations; invalid values fail closed |

## 4. Test Types and Layers

| Level | Scope | Proposed suites / files | Execution |
|---|---|---|---|
| Structure / contract inventory | Closed sets (tiers, capabilities, `pacingClass`, rungs, goal priorities, event codes, error identities, record kinds), schema identifiers, envelope field shapes, config field shape/defaults | `tests/structure/provider-profile-contract.test.ts`; extend `tests/structure/provider-contract.test.ts` and `tests/fixtures/provider/contract-inventory.json` | `bun test tests/structure` |
| Behaviour — configuration | Layered merge/reset/list-replace, provenance, fail-closed validation, shipped-empty default, config-only tuning | `tests/behaviour/provider-profile-config.test.ts`; `tests/fixtures/provider/profile/config/**` | `bun test tests/behaviour/provider-profile-config.test.ts` |
| Behaviour — selection | Declarative heuristics, capability gate, eligibility chain, chain order, determinism, selection events | `tests/behaviour/provider-profile-selection.test.ts`; `tests/fixtures/provider/profile/selection/**` | `bun test tests/behaviour/provider-profile-selection.test.ts` |
| Behaviour — probes | Laziness, per-pass memoization, probe-failure classification, evaluation cost | `tests/behaviour/provider-profile-probes.test.ts`; `tests/fixtures/provider/profile/probes/**` | `bun test tests/behaviour/provider-profile-probes.test.ts` |
| Behaviour — watch mappings | Three vendor mappings, thresholds, malformed/outage/credential classes, snapshot normalization | `tests/behaviour/provider-watch-mappings.test.ts`; `tests/fixtures/provider/watch/**` | `bun test tests/behaviour/provider-watch-mappings.test.ts` |
| Behaviour — watch status | Read-only status, filtering, checkedAt, zero state writes, credential-port-only auth | `tests/behaviour/provider-watch-status.test.ts` | `bun test tests/behaviour/provider-watch-status.test.ts` |
| Behaviour — park/switch/revert | Park cause/expiry, switch-not-park, target persistence, revert-on-recovery, idempotence | `tests/behaviour/provider-profile-park-switch-revert.test.ts`; `tests/fixtures/provider/profile/lifecycle/**` | `bun test tests/behaviour/provider-profile-park-switch-revert.test.ts` |
| Behaviour — pacing | `pacingClass` enforcement, judgment invariance, goal priorities, rung events | `tests/behaviour/provider-profile-pacing.test.ts`; `tests/fixtures/provider/profile/pacing/**` | `bun test tests/behaviour/provider-profile-pacing.test.ts` |
| Behaviour — spawn integration | Resolution-before-spawn, `--for-spawn` record construction, deny-by-default injection | `tests/behaviour/provider-profile-spawn.test.ts`; `tests/fixtures/provider/profile/spawn/**` | `bun test tests/behaviour/provider-profile-spawn.test.ts` |
| Behaviour — env records | `data-v1` grammar, carried-over floor, hardened ceiling, literal values, legacy allowlist carry-over | `tests/behaviour/provider-profile-env-record.test.ts`; `tests/fixtures/provider/env-record/**` | `bun test tests/behaviour/provider-profile-env-record.test.ts` |
| Behaviour — CLI | Named-profile resolve, profile-resolve envelope, watch-status envelope, invalid grammars, exits | `tests/behaviour/provider-profile-cli.test.ts`; `tests/golden/provider-profile-*.test.ts` | `bun test tests/behaviour/provider-profile-cli.test.ts tests/golden` |
| Legacy decision table | The five ported groups and the no-silent-path matrix, over fixtures derived from the legacy semantics | `tests/behaviour/provider-profile-legacy-decision-table.test.ts`; `tests/fixtures/provider/profile/legacy/**` | `bun test tests/behaviour/provider-profile-legacy-decision-table.test.ts` |
| Golden output | Normalized machine and human output for resolved, switched, reverted, parked, refused, and watch-status cases | `tests/golden/provider-profile-resolve.test.ts`, `tests/golden/provider-watch-status.test.ts`, `tests/fixtures/provider/profile/golden/**` | `bun test tests/golden` |
| Checks / invariants | Determinism, hermeticity, secret canaries, evidence bounds, error-table sync, contract inventory, secret-read boundary, ambient globals, forbidden literals | `tests/checks/provider-profile-hermetic.test.ts`, `tests/checks/provider-profile-evidence-bounds.test.ts`, extend `tests/checks/error-table-sync.test.ts` and `tests/checks/secret-read-boundary.test.ts`; `scripts/checks/*.ts` | `bun test tests/checks`; `bun run scripts/checks/error-table-sync.ts` |
| Boundaries | Runtime-API confinement for the declared watch transport edge, package/subpath/tier rules, fixture coverage | `.dependency-cruiser.cjs`, `tests/boundaries/**` | `bun test tests/boundaries`; `pnpm check:boundaries` |
| Performance | 100 profiles × 100 providers evaluation cost | `tests/behaviour/provider-profile-probes.test.ts` (perf case) | `bun test tests/behaviour/provider-profile-probes.test.ts` |
| Aggregate | Whole workspace | all of the above | `pnpm check` |

All suites use `bun:test` under `tests/**`; fixtures are never named `*.test.ts`. Clock, sleep, transport, credential material, environment, and state stores are injected. Goldens carry no absolute paths, wall-clock timestamps, or unstable ordering and are regenerated only by an explicit command. No permanent suite asserts a diff against a moving base branch.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Impact | Priority | AC |
|---|---|---|---|---|---|---|
| TC-PROFILE-001 | Profile, tier, seat, and pacing configuration model | Happy Path | Structure/Behaviour | Critical | High | AC-F1-5 |
| TC-PROFILE-002 | Fail-closed configuration validation matrix | Negative | Behaviour | Critical | High | AC-F1-5 |
| TC-PROFILE-003 | Shipped-empty defaults refuse resolution and spawn | Negative | Behaviour | Critical | High | AC-F8-1, AC-F1-5 |
| TC-PROFILE-004 | Configuration-only tuning changes routing | Happy Path | Behaviour | Critical | High | AC-F1-5 |
| TC-PROFILE-005 | Layered provenance for every effective value | Happy Path | Behaviour | Critical | High | AC-F1-5 |
| TC-PROFILE-006 | Declarative selection heuristics are deterministic policy | Happy Path | Behaviour | Critical | High | AC-F1-5 (capability-level F-2) |
| TC-PROFILE-007 | Selection event records profile, tier, rung, and reason | Happy Path | Behaviour | Important | High | Capability-level F-2/F-10, NFR-9 |
| TC-PROFILE-008 | Hard capability gate refuses a text-only seat for vision | Edge Case | Behaviour | Critical | High | AC-F3-3 |
| TC-PROFILE-009 | Capability gate reads declared descriptors, not names | Negative | Behaviour | Critical | High | AC-F3-3 |
| TC-PROFILE-010 | No capable candidate fails closed with named blockers | Negative | Behaviour | Critical | High | AC-F3-3 |
| TC-PROFILE-011 | Eligibility requires every provider; first fully eligible wins | Happy Path | Behaviour | Critical | High | AC-F6-2, AC-F11-6 |
| TC-PROFILE-012 | Probes are lazy and stop after the decision | Edge Case | Behaviour | Critical | High | AC-F11-6, NFR-5 |
| TC-PROFILE-013 | Probes are memoized once per provider per pass | Edge Case | Behaviour | Critical | High | AC-F11-6, NFR-5 |
| TC-PROFILE-014 | Probe failure is never availability | Negative | Behaviour | Critical | High | AC-F11-6, NFR-5 |
| TC-PROFILE-015 | Evaluation cost of 100 profiles over 100 providers | Performance | Behaviour | Important | Medium | Capability-level F-4, NFR-6 |
| TC-PROFILE-016 | Coding-plan weekly and rolling windows normalize | Happy Path | Behaviour | Critical | High | AC-F9-7 |
| TC-PROFILE-017 | DeepSeek balance compares to a configured floor | Happy Path | Behaviour | Critical | High | AC-F9-7 |
| TC-PROFILE-018 | OpenAI usage windows normalize and supply park expiry | Happy Path | Behaviour | Critical | High | AC-F9-7 |
| TC-PROFILE-019 | Malformed vendor classes are never clear | Negative | Behaviour | Critical | High | AC-F9-7, NFR-2 |
| TC-PROFILE-020 | Watch status is read-only and zero-write | Happy Path | Behaviour | Critical | High | AC-F9-7, NFR-9 |
| TC-PROFILE-021 | Watch authorization is credential-port-only | Negative | Behaviour | Critical | High | AC-F9-7, NFR-4 |
| TC-PROFILE-022 | Expensive window parks with cause and absolute expiry | Happy Path | Behaviour | Critical | High | AC-F6-1 |
| TC-PROFILE-023 | Priced-multiplier threshold and window boundaries | Edge Case | Behaviour | Critical | High | AC-F6-1 |
| TC-PROFILE-024 | Exhaustion switches, never parks; target persists | Happy Path | Behaviour | Critical | High | AC-F6-2 |
| TC-PROFILE-025 | Persisted target stays stable across spawns | Happy Path | Behaviour | Critical | High | AC-F6-2, NFR-9 |
| TC-PROFILE-026 | Recovery reverts exactly once per episode | Happy Path | Behaviour | Critical | High | AC-F6-2, NFR-9 |
| TC-PROFILE-027 | Nothing eligible yields an honest parked decision | Corner Case | Behaviour | Critical | High | AC-F6-2, AC-F11-6 |
| TC-PROFILE-028 | Switch/revert dedupe and flap stabilization | Regression | Behaviour | Critical | High | AC-F6-2, NFR-9 |
| TC-PROFILE-029 | Rungs move only execution-class seats | Happy Path | Behaviour | Critical | High | AC-F7-4 |
| TC-PROFILE-030 | A judgment seat cannot be moved by rungs | Negative | Behaviour | Critical | High | AC-F7-4 |
| TC-PROFILE-031 | Goal priorities hold judgment until the declared tail | Edge Case | Behaviour | Critical | High | AC-F7-4 |
| TC-PROFILE-032 | Rung transitions are recorded and deduplicated | Happy Path | Behaviour | Important | High | AC-F7-4, NFR-9 |
| TC-PROFILE-033 | Resolution runs before every spawn; refusal stops the spawn | Negative | Behaviour | Critical | High | AC-F8-1 |
| TC-PROFILE-034 | `--for-spawn` emits a data-v1 record into the spawn seam | Happy Path | Behaviour | Critical | High | AC-F8-1 |
| TC-PROFILE-035 | Carried-over env-record validation floor | Negative | Behaviour | Critical | High | AC-F8-1, NFR-7 |
| TC-PROFILE-036 | Hardened env-record validation ceiling | Negative | Behaviour | Critical | High | AC-F8-1, NFR-7 |
| TC-PROFILE-037 | Values are data; the legacy allowlist carries over | Negative | Behaviour | Critical | High | AC-F8-1, NFR-7 |
| TC-PROFILE-038 | Env record carries no secret or prompt material | Negative | Checks | Critical | High | AC-F8-1, NFR-4 |
| TC-PROFILE-039 | Contract inventory and guarded closed sets | Contract | Structure | Critical | High | Capability-level F-10 |
| TC-PROFILE-040 | Bidirectional error-table synchronization | Regression | Checks | Critical | High | Capability-level F-10, NFR-10 |
| TC-PROFILE-041 | Target-profile record is additive and latest-wins | Contract | Behaviour | Critical | High | AC-F6-2, Capability-level F-10 |
| TC-PROFILE-042 | Evidence is bounded to closed allowlists | Edge Case | Checks | Important | High | NFR-8 |
| TC-PROFILE-043 | `provider resolve --profile` scopes the context | Happy Path | Behaviour | Important | High | Capability-level F-9 |
| TC-PROFILE-044 | `provider profile resolve` envelope and exit conventions | Happy Path | Behaviour | Critical | High | AC-F8-1, Capability-level F-9 |
| TC-PROFILE-045 | `provider watch status` envelope and filter | Happy Path | Behaviour | Important | High | AC-F9-7 |
| TC-PROFILE-046 | Invalid command grammar fails classified | Negative | Behaviour | Important | High | Capability-level F-9 |
| TC-PROFILE-047 | Ported group 1 — chain order | Regression | Legacy/Behaviour | Critical | High | AC-F11-6 |
| TC-PROFILE-048 | Ported group 2 — lazy probes | Regression | Legacy/Behaviour | Critical | High | AC-F11-6, NFR-5 |
| TC-PROFILE-049 | Ported group 3 — park versus switch | Regression | Legacy/Behaviour | Critical | High | AC-F11-6, AC-F6-1, AC-F6-2 |
| TC-PROFILE-050 | Ported group 4 — revert | Regression | Legacy/Behaviour | Critical | High | AC-F11-6, AC-F6-2 |
| TC-PROFILE-051 | Ported group 5 — condition seams | Regression | Legacy/Behaviour | Critical | High | AC-F11-6, AC-F6-1 |
| TC-PROFILE-052 | No-silent-path matrix | Regression | Legacy/Behaviour | Critical | High | AC-F11-6 |
| TC-PROFILE-053 | 100-run deterministic replay | Regression | Behaviour | Critical | High | NFR-1 |
| TC-PROFILE-054 | Hermetic suite guarantees | Regression | Checks | Critical | High | NFR-2 |
| TC-PROFILE-055 | Runtime neutrality and watch-edge confinement | Negative | Checks/Boundaries | Critical | High | NFR-3 |
| TC-PROFILE-056 | Secret-safety canaries across all surfaces | Negative | Checks | Critical | High | NFR-4 |
| TC-PROFILE-057 | Idempotence and zero-write reads | Regression | Behaviour | Critical | High | NFR-9 |
| TC-PROFILE-058 | Milestone-exit seam evaluability | Integration | Behaviour/Manual | Critical | High | AC-F8-8 (partial; external evidence) |

### 5.2 Scenario Details

#### TC-PROFILE-001 - Profile, tier, seat, and pacing configuration model

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-7, AC-F1-5, DM-1, DM-2, DM-3, DM-4, DM-5, NFR-11
**Test Type(s)**: Unit, Contract, Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/provider-profile-contract.test.ts`, `tests/behaviour/provider-profile-config.test.ts`, `tests/fixtures/provider/profile/config/**`
**Tags**: @backend, @config

**Preconditions**:
- Configuration fixtures declare tiers, profiles, model-per-tier/seat assignments, per-agent overrides, capability descriptors, provider sets, a preference chain, pacing goal priorities, named rungs, and thresholds.
- The delivered layered catalog and `config debug` provenance surface are available.

**Steps**:
1. Resolve a valid layered fixture; assert every declared field is typed and accepted, and that seat assignments carry `pacingClass` with a closed value.
2. Assert record maps merge by child name, lists replace whole, and a reset removes inherited values, matching the delivered catalog rules.
3. Assert a profile declares its provider set and capability descriptor per seat; assert the preference chain declares base, fallbacks, and order.
4. Assert the shipped defaults declare no profile, tier, rung, or chain (the empty-by-default rule).

**Expected Outcome**:
- The profile-model branch is fully typed and layered, every seat has an enforceable `pacingClass`, and no profile or chain is invented by defaults.

#### TC-PROFILE-002 - Fail-closed configuration validation matrix

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-5, DM-1, DM-2, DM-3, DM-4, DM-5, NFR-11
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-config.test.ts`, `tests/fixtures/provider/profile/config/invalid/**`
**Tags**: @backend, @config, @negative

**Preconditions**:
- Invalid fixtures cover: unknown tier/profile/provider reference, duplicate profile or tier name, chain with duplicate or unknown entries, empty chain, ordering violation, unknown top-level or nested key, invalid `pacingClass`, capability value outside the closed vocabulary, and a negative or malformed threshold.
- Recording transport, credential port, and state store fakes prove no I/O occurs on validation failure.

**Steps**:
1. Validate each invalid fixture and assert a classified configuration error naming the offending field, profile, or chain entry.
2. Assert validation performs no credential resolution, no probe, no state write, and produces no partial decision.
3. Assert a valid control fixture validates and resolves.
4. In a temp copy, mutate one valid field per class and assert the failure names that field; restore and assert the clean control passes.

**Expected Outcome**:
- Every invalid configuration fails closed with an actionable identity, and no silent default, reorder, or partial application occurs.

#### TC-PROFILE-003 - Shipped-empty defaults refuse resolution and spawn

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-8, AC-F8-1, AC-F1-5, DEC-9, NFR-7
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-config.test.ts`, `tests/behaviour/provider-profile-spawn.test.ts`
**Tags**: @backend, @config, @spawn

**Preconditions**:
- The shipped configuration declares no profile and no preference chain.
- A recording harness spawn port is injected.

**Steps**:
1. Resolve profiles against the shipped defaults; assert a classified refusal with exit 1 (misconfiguration), naming the absence of a profile/chain.
2. Assert no model is substituted and no implicit default profile exists.
3. Request a spawn; assert resolution fails before the harness spawn port is called and the refusal is announced.
4. Declare a valid profile and chain in a temp config and assert the same spawn path now resolves and proceeds.

**Expected Outcome**:
- A fresh installation fails closed, never invents a model, and never starts a spawn without a resolved profile.

#### TC-PROFILE-004 - Configuration-only tuning changes routing

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-2, AC-F1-5, DM-4, DM-5, NFR-11
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-config.test.ts`, `tests/fixtures/provider/profile/config/tuning/**`
**Tags**: @backend, @config, @routing

**Preconditions**:
- Four paired fixtures differ only in configuration: (a) preference-chain order, (b) a threshold that changes park or rung behavior, (c) a rung definition that changes an execution seat's model, (d) a per-agent override.
- No source file is modified between runs.

**Steps**:
1. Resolve with fixture (a) and its pair; assert the selected profile changes with the declared order and nothing else.
2. Resolve with fixture (b) and its pair at the same provider fact; assert the park/rung decision changes at the declared threshold.
3. Resolve with fixture (c) and its pair; assert the execution seat's model changes while the judgment seat does not.
4. Resolve with fixture (d) and its pair; assert only the overridden agent's seat model changes.
5. For every pair, assert the only input difference is configuration and that provenance reports the changed value and layer.

**Expected Outcome**:
- All four knobs demonstrably change behaviour through configuration alone, satisfying NFR-11 without a code edit.

#### TC-PROFILE-005 - Layered provenance for every effective value

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-5, DM-1..DM-5, NFR-11
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-config.test.ts`, `tests/fixtures/provider/profile/config/layers/**`
**Tags**: @backend, @config, @provenance

**Preconditions**:
- Defaults, project, and user layers each set overlapping and non-overlapping profile values.
- The delivered `config debug` and `config get --show-origin` surfaces are available.

**Steps**:
1. Resolve the layered fixtures and assert the effective value for each field.
2. Inspect provenance and assert every effective value names its winning layer and source.
3. Apply a reset in a higher layer and assert the inherited value disappears and provenance reflects the reset.
4. Replace a list in a higher layer and assert the whole list replaces rather than concatenates; merge a record map and assert child-name merging.

**Expected Outcome**:
- Every effective profile value is inspectable with its origin, and layered merge/reset semantics match the delivered catalog rules.

#### TC-PROFILE-006 - Declarative selection heuristics are deterministic policy

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, DEC-7, NFR-1 (capability-level; no dedicated AC)
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-selection.test.ts`, `tests/fixtures/provider/profile/selection/heuristics/**`
**Tags**: @backend, @routing

**Preconditions**:
- Declarative policy fixtures declare consequence of error, reasoning depth, volume, amplification rules, and family-diversity rules.
- Two policies differ only in declared weights or rules.

**Steps**:
1. Evaluate a task under policy A; assert the engine scores consequence × reasoning depth ÷ volume as declared and selects the expected tier/profile.
2. Evaluate the same facts under policy B; assert the selection changes only according to the declared difference.
3. Assert amplification and family-diversity rules are read from configuration; no weight or rule is hardcoded in the evaluated path.
4. Replay policy A 100 times with the same facts and assert identical results.

**Expected Outcome**:
- Selection is deterministic, replayable policy data; tuning it changes outcomes without code, and no heuristic is embedded in engine code.

#### TC-PROFILE-007 - Selection event records profile, tier, rung, and reason

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-2, F-10, EVT-5, NFR-9 (capability-level; no dedicated AC)
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-selection.test.ts`, `tests/checks/provider-profile-evidence-bounds.test.ts`
**Tags**: @backend, @events

**Preconditions**:
- A resolution selects a profile and includes at least one refused candidate with blockers.
- A recording state store captures appended events.

**Steps**:
1. Resolve; assert exactly one selection event carries the selected profile, tier, rung, reason, and the blockers for a refused top candidate when present.
2. Assert the event identity is deterministic for identical facts and that a second identical resolution appends no duplicate.
3. Change one fact (rung or selected profile) and assert a new event is appended.
4. Assert the event carries no secret or raw vendor body.

**Expected Outcome**:
- Every selection decision is recorded once with the join key later spend/metrics stories need, and unchanged facts produce no event noise.

#### TC-PROFILE-008 - Hard capability gate refuses a text-only seat for vision

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-4, AC-F3-3, DM-6, EVT-3; seed SC-M1-21
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-selection.test.ts`, `tests/fixtures/provider/profile/selection/capability/**`
**Tags**: @backend, @routing, @capability

**Preconditions**:
- A vision-capable task is queued for an agent.
- The chain's first candidate is a text-only seat with a quota advantage; a later candidate is vision-capable.
- The capability gate must run before eligibility preference.

**Steps**:
1. Resolve with the text-only candidate first; assert it is refused with a capability blocker regardless of chain position and quota advantage.
2. Assert the eligibility list contains the verdict and the capability blocker for that candidate.
3. Assert selection proceeds with the next eligible, capable candidate.
4. Assert the selected env record corresponds to the capable candidate, not the refused one.
5. Re-run with quota pressure inverted (the text-only candidate even more attractive); assert the refusal is unchanged.

**Expected Outcome**:
- A text-only seat never receives a vision task; the gate is hard, named, and independent of position or quota.

#### TC-PROFILE-009 - Capability gate reads declared descriptors, not names

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-3, DM-2, RSK-7
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-selection.test.ts`, `tests/fixtures/provider/profile/selection/capability/descriptors.yaml`
**Tags**: @backend, @capability, @negative

**Preconditions**:
- Two profiles use the same model identifier but declare opposite capability descriptors.
- A profile name contains the word "vision" while its descriptor says text-only.

**Steps**:
1. Resolve a vision task against the name-suggestive but text-only profile; assert it is refused because the descriptor governs.
2. Resolve against the declared vision-capable profile with a text-neutral name; assert it is eligible.
3. Invert the descriptors in a temp fixture; assert the outcomes invert, proving no inference from names.
4. Assert a capability value outside the closed vocabulary is a classified configuration error.

**Expected Outcome**:
- The gate is driven only by declared descriptors; misdeclaration is visible through the refusal and never silently bypassed or inferred.

#### TC-PROFILE-010 - No capable candidate fails closed with named blockers

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-4, AC-F3-3, DM-6, EVT-3
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-selection.test.ts`
**Tags**: @backend, @routing, @negative

**Preconditions**:
- Every candidate in the chain is text-only for a vision task.
- A recording harness spawn port is injected.

**Steps**:
1. Resolve the vision task; assert a classified refusal, exit 2 (all candidates skipped), with the full eligibility list.
2. Assert each refused profile names the capability blocker; no candidate is silently omitted.
3. Assert the refusal is announced and the harness spawn port records zero calls.
4. Assert no fallback to an incapable candidate and no implicit model.

**Expected Outcome**:
- When no capable candidate exists, the decision fails closed with complete reasons and never spawns.

#### TC-PROFILE-011 - Eligibility requires every provider; first fully eligible wins

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, F-6, AC-F6-2, AC-F11-6, DM-6
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-selection.test.ts`, `tests/fixtures/provider/profile/selection/eligibility/**`
**Tags**: @backend, @routing

**Preconditions**:
- A profile uses two providers; one is unavailable.
- A later profile uses only available providers.
- Injected provider facts are fixed.

**Steps**:
1. Resolve; assert the first profile is ineligible because not every provider it uses is available, with the unavailable provider named as blocker.
2. Assert the next fully eligible profile is selected in declared order.
3. Assert later eligible profiles are reported as shadowed-equivalent rather than silently omitted.
4. Assert every profile receives exactly one verdict, in chain order.

**Expected Outcome**:
- Eligibility is total over a profile's provider set, the first fully eligible profile wins, and later candidates remain visible.

#### TC-PROFILE-012 - Probes are lazy and stop after the decision

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F11-6, NFR-5, DM-6
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-probes.test.ts`
**Tags**: @backend, @probes

**Preconditions**:
- The chain is [A uses provider p1], [B uses p2, p3].
- A is fully eligible.
- A recording probe seam logs every probe by provider.

**Steps**:
1. Resolve; assert A is selected and only p1 was probed.
2. Assert no probe occurs for p2 or p3 because no decision depended on them.
3. Make A ineligible; assert B is then evaluated and p2/p3 are probed in the order the decision requires.
4. Assert providers referenced only by profiles after the selected one are never probed.

**Expected Outcome**:
- Probe cost is bounded to decisions actually made; no speculative or eager probing occurs.

#### TC-PROFILE-013 - Probes are memoized once per provider per pass

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F11-6, NFR-5, DM-6
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-probes.test.ts`
**Tags**: @backend, @probes

**Preconditions**:
- Ten profiles all use the same provider p1; several also use distinct providers.
- The probe seam counts calls per provider per resolution pass.

**Steps**:
1. Resolve the chain; assert exactly one probe for p1 even though ten profiles reference it.
2. Assert the total probe count is at most the number of distinct providers evaluated in the pass.
3. Run a second resolution pass; assert p1 is probed once in that pass (memoization is per pass, not global).
4. Assert a probe result is reused only for the same provider and pass; changing facts in a new pass re-probes.

**Expected Outcome**:
- Memoization bounds fetches without caching across passes or conflating providers.

#### TC-PROFILE-014 - Probe failure is never availability

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F11-6, NFR-5, RSK-2
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-probes.test.ts`, `tests/fixtures/provider/profile/probes/failures.ts`
**Tags**: @backend, @probes, @negative

**Preconditions**:
- Probe fixtures cover transport throw, timeout, malformed snapshot, and credential rejection.
- The engine's delivered classification vocabulary is available.

**Steps**:
1. For each failure class, resolve and assert the profile is ineligible with the matching outage or credential blocker.
2. Assert no failure class yields eligible or a "clear" condition.
3. Assert the failure is announced or classified exactly as the engine classifies the same class today.
4. Assert the next eligible profile is still evaluated after a failed probe.

**Expected Outcome**:
- Probe failure is fail-loud and never mistaken for availability, and one failed provider does not abort the chain.

#### TC-PROFILE-015 - Evaluation cost of 100 profiles over 100 providers

**Scenario Type**: Performance
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-4, NFR-6
**Test Type(s)**: Performance
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-probes.test.ts`
**Tags**: @perf, @backend

**Preconditions**:
- A generated fixture declares 100 profiles over a 100-provider configuration.
- Probes are no-op injected functions; the measured region excludes transport time.

**Steps**:
1. Warm up once; then measure pure eligibility evaluation over the fixture.
2. Assert the measured duration is ≤ 50 ms on the reference CI class, or assert the committed baseline bound used by the suite.
3. Assert zero transport, credential, or state calls occur during the measured region.
4. Record the measured value in the execution log so drift is visible.

**Expected Outcome**:
- Eligibility evaluation meets the reference bound and is provably I/O-free; local-machine variance is not mistaken for a regression (GAP-T6).

#### TC-PROFILE-016 - Coding-plan weekly and rolling windows normalize

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F9-7, DM-9
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-watch-mappings.test.ts`, `tests/fixtures/provider/watch/coding-plan/**`
**Tags**: @backend, @watch

**Preconditions**:
- Committed fixtures model the coding-plan weekly and rolling-window responses.
- An injected transport returns the fixture body; the clock is fixed.

**Steps**:
1. Normalize the weekly-window fixture; assert the snapshot carries the engine's limit shape, integer percentage, and reset instant.
2. Normalize the rolling-window fixture; assert a distinct window is represented without collapsing it into the weekly one.
3. Assert threshold and reset semantics match the engine's quota rules.
4. Assert no raw vendor body, header, or credential value appears in the snapshot.

**Expected Outcome**:
- Both window shapes normalize into the secret-free snapshot vocabulary with correct threshold/reset meaning.

#### TC-PROFILE-017 - DeepSeek balance compares to a configured floor

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F9-7, DM-9
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-watch-mappings.test.ts`, `tests/fixtures/provider/watch/deepseek/**`
**Tags**: @backend, @watch

**Preconditions**:
- Balance fixtures exist above, at, and below a configured floor.
- The recovery condition is operator top-up, recorded honestly.

**Steps**:
1. Normalize an above-floor balance; assert the provider condition is available/clear.
2. Normalize a below-floor balance; assert the engine's exhaustion class, with a declared recovery condition rather than a fabricated reset.
3. Assert the at-floor boundary follows the declared comparison rule.
4. Assert the snapshot carries no credential or raw body.

**Expected Outcome**:
- Balance is normalized and compared to the configured floor; below-floor is an exhaustion class with an honest recovery condition.

#### TC-PROFILE-018 - OpenAI usage windows normalize and supply park expiry

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F9-7, DM-9, DM-10
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-watch-mappings.test.ts`, `tests/fixtures/provider/watch/openai/**`
**Tags**: @backend, @watch

**Preconditions**:
- Fixtures declare at least one usage window with a percentage and an end instant.
- The clock is fixed.

**Steps**:
1. Normalize the usage-window fixture; assert declared windows and percentages appear in the snapshot.
2. Assert a window crossing its threshold produces the engine's exhaustion/limit class.
3. Assert the window end supplies the absolute park expiry when the window parks.
4. Assert no raw vendor body or authorization header appears.

**Expected Outcome**:
- OpenAI usage windows normalize like quota limits and provide the park expiry from the window end.

#### TC-PROFILE-019 - Malformed vendor classes are never clear

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F9-7, NFR-2, RSK-2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-watch-mappings.test.ts`, `tests/fixtures/provider/watch/malformed/**`
**Tags**: @backend, @watch, @negative

**Preconditions**:
- Fixtures cover malformed JSON, missing required fields, wrong types, non-auth HTTP 5xx, HTTP 401/403, transport timeout, and missing credential.
- The engine's delivered classification matrix is the oracle.

**Steps**:
1. For each class, normalize and assert the resulting condition matches the engine's classification for that class (outage, credential, or classified failure).
2. Assert no class yields clear/available.
3. Assert `reset_missing`-style announcements appear where the engine emits them, without fabricating an expiry.
4. Assert every classification is deterministic across repeated runs.

**Expected Outcome**:
- Every malformed, non-auth, transport, or credential failure is classified exactly as the engine classifies it today and is never treated as clear.

#### TC-PROFILE-020 - Watch status is read-only and zero-write

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, F-9, AC-F9-7, DM-9, NFR-9
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-watch-status.test.ts`
**Tags**: @backend, @watch, @readonly

**Preconditions**:
- Three configured providers have fixed normalized snapshots.
- A recording state store detects any write.
- The injected clock returns a fixed instant.

**Steps**:
1. Run `watch status`; assert each provider reports name, condition, source (mapping identifier plus human summary), and checkedAt from the fixed clock.
2. Run with `--provider`; assert only the named provider is reported and the others are absent, not empty.
3. Assert the state store records zero writes and no park or event is appended.
4. Assert repeated runs produce identical output and still zero writes.

**Expected Outcome**:
- Watch status is a read-only, deterministic projection with zero state mutation.

#### TC-PROFILE-021 - Watch authorization is credential-port-only

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F9-7, NFR-4
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-watch-status.test.ts`, `tests/checks/secret-read-boundary.test.ts`
**Tags**: @backend, @watch, @security

**Preconditions**:
- The credential port returns a canary material value.
- A recording transport captures what it receives.

**Steps**:
1. Resolve a watch read; assert the credential port is called at use time and the transport receives the material once.
2. Assert the material is not cached across providers or calls beyond the declared handoff.
3. Assert the endpoint must be HTTPS without userinfo; a non-HTTPS or userinfo endpoint is a classified configuration error.
4. Assert the snapshot, envelope, diagnostics, and evidence contain no canary, authorization header, or raw body.
5. Assert an unresolvable credential reference is a classified credential condition, never an ambient fallback.

**Expected Outcome**:
- Watch authorization flows only through the credential port with one-time handoff and leaves no secret trace.

#### TC-PROFILE-022 - Expensive window parks with cause and absolute expiry

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, F-4, AC-F6-1, DM-10, NFR-9; seed SC-M1-22
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-park-switch-revert.test.ts`, `tests/fixtures/provider/profile/lifecycle/peak.yaml`
**Tags**: @backend, @parks, @routing

**Preconditions**:
- A provider has a declared UTC peak window with a buffer.
- Profiles using that provider and a profile not using it are in the chain.
- The injected clock can be moved to before, at, and after the window boundary; the sleep port is a recording fake.

**Steps**:
1. Resolve inside the window; assert the provider parks with a closed cause, active conditions, and an absolute expiry at the effective window end.
2. Assert profiles using the provider are ineligible with the park named as blocker, and the chain proceeds to another eligible profile or an honest parked decision.
3. Move the clock to the expiry instant; assert the provider resumes on the next resolution without any timer or background job.
4. Assert the sleep port was never called and every pause is a record or a classified outcome.

**Expected Outcome**:
- Expensive windows park with cause and absolute expiry, profiles name the park as blocker, and resume happens exactly at window clear with no sleep-without-record path.

#### TC-PROFILE-023 - Priced-multiplier threshold and window boundaries

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-1, DM-10, RSK-2
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-park-switch-revert.test.ts`
**Tags**: @backend, @parks

**Preconditions**:
- A priced-multiplier threshold is declared for a provider.
- Fixtures place the multiplier below, at, and above the threshold; the clock covers window start, just before end, and end.

**Steps**:
1. Assert below-threshold does not park.
2. Assert above-threshold parks with the declared cause and an expiry at the window end.
3. Assert the at-threshold boundary follows the spec's "above threshold" wording and is not silently coerced.
4. Assert the start instant is inactive/active according to the engine's half-open convention, and the end instant resumes.

**Expected Outcome**:
- Priced-multiplier parking is boundary-correct and shares the engine's expiry semantics.

#### TC-PROFILE-024 - Exhaustion switches, never parks; target persists

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, F-4, AC-F6-2, EVT-1, EVT-3, EVT-4; seed SC-M1-21 and SC-M1-22
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-park-switch-revert.test.ts`, `tests/fixtures/provider/profile/lifecycle/chain-mixed-deepseek.yaml`
**Tags**: @backend, @parks, @routing

**Preconditions**:
- The chain is [mixed, deepseek]; mixed uses the exhausted coding-plan provider; deepseek is eligible.
- A recording state store captures switch events and target records.

**Steps**:
1. Resolve; assert mixed is ineligible with the exhaustion blocker named.
2. Assert deepseek is selected automatically and the spawn proceeds; assert mixed is not parked in a way that stalls the spawn.
3. Assert the switch event carries the previous target (mixed), the new target (deepseek), and the revert condition.
4. Assert a target-profile record persists deepseek with reason "switch" and the revert condition.
5. Assert a later resolution with unchanged facts uses the persisted target.

**Expected Outcome**:
- Exhaustion switches to the next eligible profile, records why and when to revert, and persists the target instead of stalling.

#### TC-PROFILE-025 - Persisted target stays stable across spawns

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-2, EVT-4, NFR-9
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-park-switch-revert.test.ts`, `tests/fixtures/state/harness.ts`
**Tags**: @backend, @state

**Preconditions**:
- A switched target is already persisted.
- The preferred provider is still exhausted.
- A recording state store counts appends.

**Steps**:
1. Resolve three times with unchanged facts; assert each selects the persisted target.
2. Assert no duplicate switch event and no duplicate target record are appended.
3. Assert the target record read is verified after append and reports the latest value.
4. Change the target (a new switch) and assert exactly one new record is appended; latest wins.

**Expected Outcome**:
- The target is stable across spawns with no append noise, and latest-record-wins semantics hold.

#### TC-PROFILE-026 - Recovery reverts exactly once per episode

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-2, EVT-2, EVT-4, NFR-9; seed SC-M1-21
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-park-switch-revert.test.ts`
**Tags**: @backend, @state, @routing

**Preconditions**:
- The target is switched to deepseek because mixed is exhausted.
- A clock/fact seam can mark mixed recovered.

**Steps**:
1. Mark mixed recovered and resolve; assert the target reverts to mixed automatically.
2. Assert exactly one revert event carries the restored target and the recovering provider.
3. Assert the persisted target record now names mixed with reason "revert".
4. Resolve again with unchanged recovered facts; assert no second revert event or target append.
5. Exhaust mixed again in a new episode and recover; assert a new revert event is allowed for the new episode.

**Expected Outcome**:
- Revert is automatic, recorded once per exhaustion episode, and the target record reflects the restored preference.

#### TC-PROFILE-027 - Nothing eligible yields an honest parked decision

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, F-4, AC-F6-2, AC-F11-6; seed SC-M1-22
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-park-switch-revert.test.ts`
**Tags**: @backend, @routing, @negative

**Preconditions**:
- Every profile is ineligible through a mix of exhaustion and expensive windows.
- A recording harness spawn port and sleep port are injected.

**Steps**:
1. Resolve; assert a classified parked/refused decision with the full eligibility list and exit 2.
2. Assert the decision is announced with reasons and does not fabricate a target.
3. Assert the harness spawn port records zero calls and the sleep port records zero calls.
4. Assert the decision is deterministic and append-only records are limited to the honest outcome.

**Expected Outcome**:
- When nothing is eligible, the engine parks the decision honestly and never stalls silently or spawns an implicit model.

#### TC-PROFILE-028 - Switch/revert dedupe and flap stabilization

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-2, NFR-9, RSK-5
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-park-switch-revert.test.ts`
**Tags**: @backend, @state, @idempotence

**Preconditions**:
- A provider fact seam can alternate exhausted/recovered across resolutions.
- Declared thresholds gate transitions.

**Steps**:
1. Resolve across an alternating sequence with an unchanged condition inside each state; assert no duplicate switch or revert event within a state.
2. Cross a declared threshold in each direction; assert exactly one transition event per crossing.
3. Assert the persisted target does not thrash without a threshold crossing.
4. Assert all event identities are deterministic and bounded.

**Expected Outcome**:
- Flapping does not produce duplicate or oscillating records; transitions occur only on declared threshold changes.

#### TC-PROFILE-029 - Rungs move only execution-class seats

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-4, DM-3, DM-5; seed SC-M1-21
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-pacing.test.ts`, `tests/fixtures/provider/profile/pacing/rungs.yaml`
**Tags**: @backend, @pacing

**Preconditions**:
- At least two rungs are declared.
- One seat is `judgment` and one is `execution`.

**Steps**:
1. Resolve at each rung with a threshold crossing; assert the `execution` seat's model moves per the rung definition.
2. Assert the `judgment` seat's model is identical at every rung.
3. Assert the movement is driven by the typed `pacingClass` field, not by the seat or profile name.
4. Assert a mixed profile moves only its execution seats in the same resolution.

**Expected Outcome**:
- Execution seats move with rungs and judgment seats are structurally invariant across all rungs.

#### TC-PROFILE-030 - A judgment seat cannot be moved by rungs

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-4, DM-3, DEC-1
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-pacing.test.ts`, `tests/fixtures/provider/profile/pacing/invalid/**`
**Tags**: @backend, @pacing, @negative

**Preconditions**:
- A fixture declares a rung action targeting a judgment seat.
- Another fixture declares an invalid `pacingClass` value.

**Steps**:
1. Validate the judgment-seat rung fixture; assert either a classified validation error or a structurally inert result that leaves the seat unchanged.
2. Assert the invalid `pacingClass` is a classified configuration error.
3. Assert no code path infers "judgment" from a seat/profile name.
4. Assert the clean control moves the execution seat and only that seat.

**Expected Outcome**:
- Judgment seats cannot be moved by rungs; the typed field is the enforcement boundary, not a naming convention.

#### TC-PROFILE-031 - Goal priorities hold judgment until the declared tail

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-4, DM-5
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-pacing.test.ts`, `tests/fixtures/provider/profile/pacing/goals.yaml`
**Tags**: @backend, @pacing

**Preconditions**:
- Goal priorities, rungs, and a subscription-window tail threshold are declared.
- Fixtures place utilization below, at, and above the tail.

**Steps**:
1. Below the tail, assert execution seats may move while the judgment seat remains on its assigned model.
2. At the declared tail boundary, assert the declared behavior is applied deterministically.
3. Above the tail, assert any judgment-seat action is the one explicitly declared by configuration and still typed, never inferred.
4. Assert the evaluation is deterministic and reads priorities from configuration.

**Expected Outcome**:
- Judgment seats are held until the declared tail, and goal-priority evaluation is deterministic over declared data (precedence pending OQ-T2).

**Notes / Clarifications**:
- GAP-T4: the spec does not pin precedence when the three goal priorities conflict. This scenario asserts determinism and the typed execution-only rule; the precedence order must be pinned in delivery planning or by a decision record before the at/above-tail assertions are finalized.

#### TC-PROFILE-032 - Rung transitions are recorded and deduplicated

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-7, AC-F7-4, EVT-5, NFR-9
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-pacing.test.ts`
**Tags**: @backend, @pacing, @events

**Preconditions**:
- Two rungs and a threshold that can be crossed.
- A recording state store captures events.

**Steps**:
1. Cross the threshold; assert one rung transition event carries profile, rung, and reason.
2. Resolve again with the unchanged rung; assert no duplicate event.
3. Cross back; assert one new transition event.
4. Assert the selection event for the same decision reports the active rung.

**Expected Outcome**:
- Rung changes are recorded once per crossing and deduplicated for unchanged conditions.

#### TC-PROFILE-033 - Resolution runs before every spawn; refusal stops the spawn

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, F-4, AC-F8-1, DEC-9
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-spawn.test.ts`
**Tags**: @backend, @spawn

**Preconditions**:
- A spawn wrapper path is exercised with a resolution seam and a harness spawn port.
- One case resolves and one case refuses (empty configuration or no eligible profile).

**Steps**:
1. Request a spawn; assert resolution is invoked before the harness spawn port.
2. In the resolving case, assert the spawn proceeds only after a resolved profile and a valid env record.
3. In the refusing case, assert the harness spawn port records zero calls and the refusal is classified and announced.
4. Assert no implicit model or ambient model variable is used as a fallback.

**Expected Outcome**:
- No spawn starts without a resolved profile, and refusal is classified, announced, and side-effect-free at the harness boundary.

**Notes / Clarifications**:
- GAP-T3 / OQ-T1: the concrete current spawn surface is delivery-bound because the legacy hook is untouched. The test exercises the wrapper/seam path and must fail naming a missing seam rather than asserting a hook modification.

#### TC-PROFILE-034 - `--for-spawn` emits a data-v1 record into the spawn seam

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-1, DM-7, DEC-3; seed SC-M1-21
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-spawn.test.ts`, `tests/fixtures/provider/profile/spawn/env-records/**`
**Tags**: @backend, @spawn, @env-record

**Preconditions**:
- A resolved profile declares model environment names matching the allowlist.
- `buildHarnessSpawnEnvironment` and a fixture descriptor are available.

**Steps**:
1. Run `provider profile resolve --for-spawn`; assert the envelope includes `envRecord` with `recordFormat: data-v1`.
2. Assert the record has the exact header, only `set NAME=value` and `unset NAME` lines, and a final LF.
3. Feed the record into the deny-by-default spawn-environment builder; assert the built environment equals the record's declared variables exactly.
4. Assert undeclared parent variables are absent and no ambient environment key appears.
5. Assert the size limits are enforced and a valid record is accepted.

**Expected Outcome**:
- The resolved environment reaches the spawn seam as validated data records and produces exactly the declared child environment.

#### TC-PROFILE-035 - Carried-over env-record validation floor

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-1, NFR-7, DEC-3
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-env-record.test.ts`, `tests/fixtures/provider/env-record/floor/**`
**Tags**: @backend, @env-record, @negative

**Preconditions**:
- Fixtures reproduce the legacy `ADOS_HOOK_ENV_V1` validation classes: exact header, only `set`/`unset`, allowlist match, duplicate names, NUL, CR, missing final LF, file/line/record size limits, and unsafe file metadata where the file path applies.

**Steps**:
1. For each fixture, validate and assert a classified refusal; assert the record is never partially applied.
2. Assert the exact header is required and any other header fails.
3. Assert duplicate names and unauthorized names fail.
4. Assert CR and NUL anywhere fail, and a missing final LF fails.
5. Assert over-limit file, line, and record payloads fail and a boundary-sized valid payload passes.

**Expected Outcome**:
- The legacy validation floor is preserved exactly, with every class rejected and a clean boundary control accepted.

#### TC-PROFILE-036 - Hardened env-record validation ceiling

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-1, NFR-7, RSK-4
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-env-record.test.ts`, `tests/fixtures/provider/env-record/ceiling/**`
**Tags**: @backend, @env-record, @security

**Preconditions**:
- Fixtures cover: name outside the strict identifier shape, embedded equals in a name, homoglyph/non-ASCII name, metacharacters in a name, and an unknown/unauthorized name.
- A clean control uses a valid allowlisted name.

**Steps**:
1. For each hardened class, validate and assert a classified refusal naming the offending record.
2. Assert allowlist matching is exact and rejects homoglyph lookalikes.
3. Assert an embedded equals sign in the name is rejected rather than parsed as part of the value.
4. Assert no failure partially applies earlier valid records.
5. Assert the clean control passes and a metacharacter in the value (not the name) is accepted as data.

**Expected Outcome**:
- Every Appendix D hardened class is rejected with a classified refusal, and values remain data rather than being conflated with names.

#### TC-PROFILE-037 - Values are data; the legacy allowlist carries over

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-1, NFR-7, DEC-3
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-env-record.test.ts`, `tests/fixtures/provider/env-record/legacy-carryover/**`
**Tags**: @backend, @env-record, @security

**Preconditions**:
- A value fixture contains shell metacharacters: command substitution, backticks, semicolons, globs, equals, quotes, and backslashes.
- The built-in allowlist is `OC_ADOS_AGENT_*_MODEL`, overridable by configuration.
- The legacy hook file is present but must not be modified.

**Steps**:
1. Emit the record with the metacharacter value; assert the spawn environment receives the exact literal string.
2. Assert no shell is invoked and no evaluation of the value occurs at any consumption point.
3. Assert the built-in `OC_ADOS_AGENT_*_MODEL` allowlist accepts an authorized name and rejects an unauthorized one.
4. Configure an additional allowlist pattern and assert it is honored; reset it and assert the built-in behavior returns.
5. Assert a structure check shows the legacy hook file is unchanged by this change.

**Expected Outcome**:
- Values are never shell-interpreted, the legacy allowlist carries over and is configurable, and the legacy hook remains untouched.

**Notes / Clarifications**:
- GAP-T3: "untouched" is a structure assertion about the legacy file, not a modification. The carry-over is proven through the data contract.

#### TC-PROFILE-038 - Env record carries no secret or prompt material

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-1, NFR-4
**Test Type(s)**: Checks, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-env-record.test.ts`, `tests/checks/provider-profile-hermetic.test.ts`
**Tags**: @backend, @security, @canary

**Preconditions**:
- Canary values are planted in the credential source, parent environment, and vendor body.
- The env record is emitted and serialized.

**Steps**:
1. Emit the record and envelope; assert no canary appears in the record, envelope, diagnostics, or any appended state.
2. Assert the record carries only model identifiers and agent role names, never prompt text, transcripts, diffs, or tool output.
3. Assert parent environment canaries are absent from the built spawn environment.
4. Assert the allowed credential-handoff path never writes the material into the record.

**Expected Outcome**:
- The env record contains no secret or prompt material, and canaries are absent from every observable surface.

#### TC-PROFILE-039 - Contract inventory and guarded closed sets

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, NFR-10, RSK-1
**Test Type(s)**: Contract, Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/provider-profile-contract.test.ts`, `tests/fixtures/provider/contract-inventory.json`
**Tags**: @backend, @contract

**Preconditions**:
- The provider-profile contract module exports closed sets for tiers, capabilities, `pacingClass`, rungs/goal priorities, event codes, record kinds, and error identities.
- The inventory fixture is an independent expectation.

**Steps**:
1. Parse the live contracts with the TypeScript AST and compare exports and closed sets with the fixture in both directions.
2. Assert exactly one new target-profile record kind and its payload schema identifier; assert existing record kinds and schema ids are unchanged.
3. In a temp copy, add, remove, and rename one closed-set member; assert the inventory fails naming the offending member; restore and assert the clean control passes.
4. Assert every new event code has the declared severity and bounded evidence allowlist.

**Expected Outcome**:
- Vocabulary growth is explicit, closed, and detected by mutation; no unlisted code or record kind can slip in.

#### TC-PROFILE-040 - Bidirectional error-table synchronization

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, NFR-10, RSK-1
**Test Type(s)**: Checks, Regression
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/error-table-sync.test.ts`, `scripts/checks/error-table-sync.ts`
**Tags**: @backend, @checks, @errors

**Preconditions**:
- New provider/profile error identities are declared for configuration, selection, refusal, and watch failures.
- The documented error table and the machine table are both present.

**Steps**:
1. Run the sync check; assert every new identity exists in both tables in both directions.
2. Assert existing rows are unchanged and no identity is renumbered.
3. Assert exact-code classification is total and unknown/wrong-kind failures contain to `fallback.internal`.
4. In a temp copy, add a machine-only row, add a doc-only row, and alter an existing row; assert each mutation fails naming the mismatch; restore and assert green.

**Expected Outcome**:
- The error tables are synchronized in both directions, classification is exact and total, and existing rows are preserved.

#### TC-PROFILE-041 - Target-profile record is additive and latest-wins

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, F-10, AC-F6-2, EVT-4
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-park-switch-revert.test.ts`, `tests/fixtures/state/harness.ts`
**Tags**: @backend, @state

**Preconditions**:
- The state-layer harness provides temp stores with a single-writer fence and verified reads.
- Two target records can be appended in sequence.

**Steps**:
1. Append one target record; assert it carries its own payload schema identifier, a store-scoped key, the current target, the reason, and the revert condition when present.
2. Read back and assert the verified post-append read returns the appended value.
3. Append a second record and assert latest wins on read.
4. Assert no schema-version bump or migration is required and existing records remain readable.
5. Assert a concurrent writer without the fence is refused or serialized per the delivered state contract.

**Expected Outcome**:
- The target profile persists as a clean additive record with verified reads and latest-wins semantics.

#### TC-PROFILE-042 - Evidence is bounded to closed allowlists

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: NFR-8, F-10
**Test Type(s)**: Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/provider-profile-evidence-bounds.test.ts`, `tests/fixtures/provider/profile/evidence/**`
**Tags**: @backend, @checks

**Preconditions**:
- Fixtures provide an in-bound evidence object, a 1024-byte boundary object, an over-bound object, a 20-field object, a 21-field object, and an unknown-key object.

**Steps**:
1. Assert the in-bound and boundary objects are accepted.
2. Assert the over-bound and 21-field objects are rejected or trimmed per the engine rule, never silently accepted.
3. Assert the unknown-key object is rejected against the closed allowlist.
4. Assert every accepted event or record serializes to ≤ 1024 bytes and ≤ 20 fields.

**Expected Outcome**:
- Evidence is bounded and allowlisted, and no event or record can carry uncontrolled fields.

#### TC-PROFILE-043 - `provider resolve --profile` scopes the context

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-9, DM-8 (capability-level; no dedicated AC)
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-cli.test.ts`, `tests/golden/provider-profile-resolve.test.ts`
**Tags**: @backend, @cli

**Preconditions**:
- Two profiles exist with distinguishable decisions.
- The delivered `provider resolve` behavior and envelope are known.

**Steps**:
1. Run `provider resolve --profile` with a named profile; assert the decision is scoped to that profile and the envelope keeps `provider`, `mode`, `decision`, and `parksConsidered`.
2. Assert the existing `provider resolve` without the flag is unchanged.
3. Assert an unknown profile name is a classified configuration error, not a silent default.
4. Assert the human output and JSON envelope agree on the decision.

**Expected Outcome**:
- Named-profile resolution is scoped, classified, and additive over the delivered resolve surface.

#### TC-PROFILE-044 - `provider profile resolve` envelope and exit conventions

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, F-8, AC-F8-1, DM-8
**Test Type(s)**: Integration, Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-cli.test.ts`, `tests/golden/provider-profile-resolve.test.ts`
**Tags**: @backend, @cli

**Preconditions**:
- Fixtures produce a resolved case, a misconfiguration case, and an all-skipped case.
- A per-agent override is declared.

**Steps**:
1. Run `provider profile resolve`; assert the envelope carries `profile`, `eligibility[]`, `rung`, and `agentOverrides`.
2. Run with `--agent`; assert the override for that agent is applied and visible.
3. Assert exit 0 for resolved, 1 for classified misconfiguration, and 2 when all candidates are skipped or exhausted with reasons.
4. Run with `--for-spawn`; assert `envRecord` is added and `recordFormat: data-v1` is declared.
5. Assert the human output prints the equivalent continuity keys.

**Expected Outcome**:
- The selection decision is a complete, classified envelope with the documented exits and the optional env record.

#### TC-PROFILE-045 - `provider watch status` envelope and filter

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-9, F-5, AC-F9-7, DM-9
**Test Type(s)**: Integration, Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-watch-status.test.ts`, `tests/golden/provider-watch-status.test.ts`
**Tags**: @backend, @cli, @watch

**Preconditions**:
- Three configured providers have fixed snapshots.
- The clock is fixed.

**Steps**:
1. Run `provider watch status`; assert `providers[]` entries each carry name, condition, source, and checkedAt.
2. Run with `--provider`; assert only that provider appears.
3. Assert an unknown provider name is a classified invocation/config error.
4. Assert exit 0 and zero state writes in both forms.

**Expected Outcome**:
- The status envelope is complete per DM-9, filterable, classified on bad input, and read-only.

#### TC-PROFILE-046 - Invalid command grammar fails classified

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-9 (capability-level; no dedicated AC)
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-cli.test.ts`
**Tags**: @backend, @cli, @negative

**Preconditions**:
- Invalid grammars are enumerated: unknown subcommand, unknown flag, missing flag value, extra positional argument, and an unknown profile/agent provider value.

**Steps**:
1. Run each invalid grammar; assert a classified invocation error with exit 1 and a remediation hint.
2. Assert no resolution, probe, credential read, or state write occurs.
3. Assert no partial envelope or partial env record is emitted.
4. Assert the valid control grammar succeeds.

**Expected Outcome**:
- Invalid grammar is a clean classified invocation failure with no side effects.

#### TC-PROFILE-047 - Ported group 1 — chain order

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-11, F-4, AC-F11-6, Appendix A group 1, DEC-5
**Test Type(s)**: Regression, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-legacy-decision-table.test.ts`, `tests/fixtures/provider/profile/legacy/group-1/**`
**Tags**: @backend, @legacy, @routing

**Preconditions**:
- Ported fixtures declare profiles in a preference order, including an ineligible early profile and two eligible later profiles.
- The legacy semantics are encoded as expected decisions, not executed as a live script.

**Steps**:
1. Resolve in declared order; assert the first fully eligible profile wins.
2. Assert later eligible profiles are reported as shadowed-equivalent.
3. Assert a chain ordering violation fails validation.
4. Assert the same fixtures produce the same decision across repeated runs.

**Expected Outcome**:
- Group 1's legacy chain-order semantics are covered with structured outcomes and no silent reordering.

#### TC-PROFILE-048 - Ported group 2 — lazy probes

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-11, F-4, AC-F11-6, NFR-5, Appendix A group 2, DEC-5
**Test Type(s)**: Regression, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-legacy-decision-table.test.ts`, `tests/fixtures/provider/profile/legacy/group-2/**`
**Tags**: @backend, @legacy, @probes

**Preconditions**:
- Fixtures cover a shared provider, an unreached provider, and a failed probe.

**Steps**:
1. Assert a provider is probed only when a decision depends on it.
2. Assert one probe per provider per pass regardless of referencing profiles.
3. Assert probe failure is never availability.
4. Assert the ported expected outcomes match TC-PROFILE-012..014 without duplicating their implementation.

**Expected Outcome**:
- Group 2's legacy lazy-probe semantics are covered and anchored to the behaviour suite.

#### TC-PROFILE-049 - Ported group 3 — park versus switch

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-11, F-6, AC-F11-6, AC-F6-1, AC-F6-2, Appendix A group 3, DEC-5; seeds SC-M1-21 and SC-M1-22
**Test Type(s)**: Regression, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-legacy-decision-table.test.ts`, `tests/fixtures/provider/profile/legacy/group-3/**`
**Tags**: @backend, @legacy, @parks

**Preconditions**:
- Fixtures cover an expensive window, an exhausted subscription, and an all-ineligible chain.

**Steps**:
1. Expensive window: assert a park with cause and expiry.
2. Exhaustion: assert a switch to the next eligible profile, never a spawn-stalling park.
3. All ineligible: assert an honest parked/refused decision with reasons.
4. Assert every outcome is a structured event or classified result, never silence.

**Expected Outcome**:
- Group 3's legacy park-versus-switch semantics are covered end to end.

#### TC-PROFILE-050 - Ported group 4 — revert

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-11, F-6, AC-F11-6, AC-F6-2, Appendix A group 4, DEC-5; seed SC-M1-21
**Test Type(s)**: Regression, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-legacy-decision-table.test.ts`, `tests/fixtures/provider/profile/legacy/group-4/**`
**Tags**: @backend, @legacy, @state

**Preconditions**:
- Fixtures cover a switched target, an unchanged intermediate spawn, and a recovery.

**Steps**:
1. Assert recovery restores the preferred target automatically.
2. Assert exactly one revert event per episode.
3. Assert the persisted target is stable across the intermediate spawns.
4. Assert a later new episode can record a new revert.

**Expected Outcome**:
- Group 4's revert semantics are covered with exactly-once episode behavior and stable persistence.

#### TC-PROFILE-051 - Ported group 5 — condition seams

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-11, F-5, F-6, AC-F11-6, AC-F6-1, Appendix A group 5, DEC-5, RSK-2
**Test Type(s)**: Regression, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-legacy-decision-table.test.ts`, `tests/fixtures/provider/profile/legacy/group-5/**`
**Tags**: @backend, @legacy, @boundaries

**Preconditions**:
- Fixtures cover threshold crossings, window start/end instants, buffer effects, credential classes, and malformed vendor responses.

**Steps**:
1. Assert conditions change exactly at the declared boundaries and not before/after.
2. Assert buffer effects extend the effective window as declared.
3. Assert credential classes classify as credential failures, not outage or clear.
4. Assert malformed vendor responses are never clear.
5. Assert every case asserts a structured condition or classified outcome.

**Expected Outcome**:
- Group 5's condition seams are covered at the profile level with no silent boundary behavior.

#### TC-PROFILE-052 - No-silent-path matrix

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-11, AC-F11-6, Appendix A, DEC-5; seed SC-M1-22
**Test Type(s)**: Regression, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-legacy-decision-table.test.ts`, `tests/fixtures/provider/profile/legacy/no-silent-paths.ts`
**Tags**: @backend, @legacy, @negative

**Preconditions**:
- A committed matrix enumerates every legacy fail-open and fail-stuck class in the ported table.
- Each row declares the expected structured event or classified outcome.

**Steps**:
1. Execute every matrix row; assert the outcome is a structured event or classified result.
2. Assert no row produces silence, an implicit model, or a spawn-stalling sleep.
3. Assert the matrix is non-vacuous: every row has an assertion and the expected classes are non-empty.
4. In a temp copy, delete a row and assert the non-vacuity meta-check fails; restore and assert green.

**Expected Outcome**:
- No covered case has silent behaviour, and the matrix cannot shrink unnoticed.

#### TC-PROFILE-053 - 100-run deterministic replay

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-1
**Test Type(s)**: Regression, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-selection.test.ts`, `tests/behaviour/provider-profile-park-switch-revert.test.ts`
**Tags**: @backend, @determinism

**Preconditions**:
- A fixed configuration and provider-fact fixture produces a selection, an eligibility list, an env record, and event identities.
- The clock, locale, timezone, and environment are injected.

**Steps**:
1. Replay the same inputs 100 times; assert byte-identical decisions, eligibility lists, env records, and event identities.
2. Vary the host timezone, locale, and ambient environment; assert the results are unchanged.
3. Assert no `Date.now`, `Math.random`, locale-dependent formatting, or ambient environment read enters selection policy.
4. Assert determinism holds for a switched and reverted sequence as well.

**Expected Outcome**:
- Identical facts produce identical results across 100 runs and across ambient variation.

#### TC-PROFILE-054 - Hermetic suite guarantees

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-2
**Test Type(s)**: Checks, Regression
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/provider-profile-hermetic.test.ts`
**Tags**: @backend, @checks, @hermetic

**Preconditions**:
- Global `fetch` can be spied or replaced; the credential port, sleep, clock, transport, and state store are injectable fakes.

**Steps**:
1. Run representative resolution, watch, switch, and spawn cases; assert zero live `fetch` calls.
2. Assert the credential port is the only credential source and no ambient environment credential is read.
3. Assert the sleep port records zero real waits; assert no test file uses a real timer for a declared pause.
4. Assert temp state stores are used and cleaned up; assert no network-capable module is imported by the selection suite.

**Expected Outcome**:
- The suite is hermetic: 0 live network, 0 live credentials, 0 real sleeps, and isolated state.

#### TC-PROFILE-055 - Runtime neutrality and watch-edge confinement

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-3, NFR-4
**Test Type(s)**: Contract, Static, Boundary
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/provider-profile-contract.test.ts`, `tests/checks/provider-profile-hermetic.test.ts`, `.dependency-cruiser.cjs`, `tests/boundaries/**`, `scripts/checks/ambient-globals.ts`, `scripts/checks/secret-read-boundary.ts`
**Tags**: @backend, @boundaries, @security

**Preconditions**:
- Selection policy lives in the core tier; watch transports are declared adapter edges.
- The boundary harness and fixture-coverage meta-check are available.

**Steps**:
1. Parse the selection-policy sources; assert imports are only core contracts and no `node:*`, `bun:*`, `process`, `fetch`, timers, filesystem, or environment reads appear.
2. Assert exactly the declared watch adapter subpath has a runtime-API allowance with a reason; assert no other new allowance exists.
3. Run the boundary suite; assert the declared edge passes and a planted runtime import in core policy fails.
4. Assert the fixture-coverage meta-check has a registered failing fixture for every changed rule.
5. Run the secret-read boundary check; assert it gains zero new allowlist entries.

**Expected Outcome**:
- Selection policy is runtime-neutral, only the declared watch edge may touch runtime APIs, and the secret-read boundary is unchanged.

#### TC-PROFILE-056 - Secret-safety canaries across all surfaces

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-4
**Test Type(s)**: Checks, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/provider-profile-hermetic.test.ts`, `tests/fixtures/provider/profile/security/canaries.ts`
**Tags**: @backend, @security, @canary

**Preconditions**:
- Distinct canaries are planted in credential material, parent environment, vendor body, and endpoint userinfo attempt.
- Envelopes, env records, state stores, events, diagnostics, and evidence are all observable.

**Steps**:
1. Run resolution, watch, switch, revert, pacing, and spawn cases with the canaries present.
2. Assert no canary appears in any envelope, env record, state record, event, diagnostic, or evidence payload.
3. Assert no authorization header, raw vendor body, credential value, or userinfo is persisted or returned.
4. Assert the secret-read boundary and forbidden-literal scans stay green.

**Expected Outcome**:
- Zero secret bytes cross any observable surface; watch authorization remains credential-port-only.

#### TC-PROFILE-057 - Idempotence and zero-write reads

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-9
**Test Type(s)**: Integration, Regression
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-park-switch-revert.test.ts`, `tests/behaviour/provider-watch-status.test.ts`
**Tags**: @backend, @idempotence, @state

**Preconditions**:
- A switched state and a watched state are established.
- A recording state store counts appends and writes.

**Steps**:
1. Resolve repeatedly with unchanged conditions; assert 0 duplicate switch, revert, ineligible, or selection events.
2. Assert exactly one revert per exhaustion episode across repeated resolutions.
3. Run `watch status` and a read-path resolve repeatedly; assert 0 state writes.
4. Assert repeated runs return identical results.

**Expected Outcome**:
- Unchanged conditions produce no event noise and read paths never mutate state.

#### TC-PROFILE-058 - Milestone-exit seam evaluability

**Scenario Type**: Integration
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, F-9, AC-F8-8, DEC-4, DEC-6
**Test Type(s)**: Integration, Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `tests/behaviour/provider-profile-spawn.test.ts`; milestone review evidence in `doc/changes/.../` and M1 trackers
**Tags**: @backend, @spawn, @milestone

**Preconditions**:
- The current spawn surfaces and the `--for-spawn` seam are exercised.
- The audit ledger (M1-S22) and dispatch daemon (M1-S9) are not delivered.

**Steps**:
1. Enumerate every current spawn surface; assert each invokes profile resolution before the harness spawn call and consumes the `data-v1` record.
2. Assert no tested surface uses a manual model-environment override as its primary path; assert a manual override is not silently treated as a resolved profile.
3. Assert the `--for-spawn` envelope is the documented seam the future daemon consumes (envelope shape and exit conventions).
4. Record explicitly that the audit-ledger zero-override evidence and the daemon integration are milestone-scoped and external to this change; do not assert them in the permanent suite.

**Expected Outcome**:
- The machinery and the seam are proven on current surfaces; the milestone-exit evidence is explicitly delegated to M1-S9/M1-S22 rather than silently reinterpreted as satisfied.

**Notes / Clarifications**:
- GAP-T1 / GAP-T3: the audit-ledger zero-override evidence and daemon integration are external and milestone-scoped. This scenario is semi-automated: the seam assertions run in the suite, while the milestone evidence review is manual and does not become a permanent tree assertion.

## 6. Environments and Test Data

- **Runtime**: Bun (`bun test`) on the repository's pinned version; TypeScript strict mode; `pnpm check` is the aggregate gate. No test requires a live harness, vendor endpoint, or credential.
- **Injected seams**: clock, sleep, quota/watch transport, credential port, environment, and state store. The profile-selection policy is pure and receives facts as data.
- **Hermeticity**: zero live network calls, zero live credential reads, zero real sleeps. `globalThis.fetch` is treated as a failure if reached by provider/profile tests. No test opens a socket.
- **Fixtures**: committed under `tests/fixtures/provider/profile/**` (config, selection, probes, lifecycle, pacing, spawn, env-record, legacy, evidence, security) and `tests/fixtures/provider/watch/**` (coding-plan, DeepSeek, OpenAI, malformed). Fixtures are data, never `*.test.ts`, and never execute a legacy script.
- **State**: temporary stores per test through `tests/fixtures/state/harness.ts`; single-writer fence and verified reads exercised; cleanup on test exit. No test writes the repository's real state.
- **Time**: all windows and expiries are UTC; the clock is fixed at a chosen instant and moved explicitly. Boundary instants are tested exactly (start, end, expiry, tail).
- **Performance reference**: NFR-6 is measured on the reference CI class with warm-up; the measured baseline is recorded in §10. Local variance is not a regression (GAP-T6).
- **Golden data**: normalized JSON and human output under `tests/fixtures/provider/profile/golden/**`; no absolute paths, wall-clock timestamps, or unstable ordering. Regeneration is an explicit command, not a blanket rewrite.
- **Security data**: canaries are synthetic and clearly non-secret; no real credential value is committed. Homoglyph and metacharacter fixtures are inert strings.

## 7. Automation Plan and Implementation Mapping

All scenarios are **To Implement** in this change (no existing profile suite). Existing suites are extended where noted. Every TC below appears in §5.1 and §5.2.

| TC ID | Test file(s) to create or update | Execution | Status |
|---|---|---|---|
| TC-PROFILE-001 | `tests/structure/provider-profile-contract.test.ts`, `tests/behaviour/provider-profile-config.test.ts` | `bun test tests/structure/provider-profile-contract.test.ts tests/behaviour/provider-profile-config.test.ts` | To Implement |
| TC-PROFILE-002 | `tests/behaviour/provider-profile-config.test.ts` | `bun test tests/behaviour/provider-profile-config.test.ts` | To Implement |
| TC-PROFILE-003 | `tests/behaviour/provider-profile-config.test.ts`, `tests/behaviour/provider-profile-spawn.test.ts` | `bun test tests/behaviour/provider-profile-config.test.ts tests/behaviour/provider-profile-spawn.test.ts` | To Implement |
| TC-PROFILE-004 | `tests/behaviour/provider-profile-config.test.ts` | `bun test tests/behaviour/provider-profile-config.test.ts` | To Implement |
| TC-PROFILE-005 | `tests/behaviour/provider-profile-config.test.ts` | `bun test tests/behaviour/provider-profile-config.test.ts` | To Implement |
| TC-PROFILE-006 | `tests/behaviour/provider-profile-selection.test.ts` | `bun test tests/behaviour/provider-profile-selection.test.ts` | To Implement |
| TC-PROFILE-007 | `tests/behaviour/provider-profile-selection.test.ts`, `tests/checks/provider-profile-evidence-bounds.test.ts` | `bun test tests/behaviour/provider-profile-selection.test.ts tests/checks/provider-profile-evidence-bounds.test.ts` | To Implement |
| TC-PROFILE-008 | `tests/behaviour/provider-profile-selection.test.ts` | `bun test tests/behaviour/provider-profile-selection.test.ts` | To Implement |
| TC-PROFILE-009 | `tests/behaviour/provider-profile-selection.test.ts` | `bun test tests/behaviour/provider-profile-selection.test.ts` | To Implement |
| TC-PROFILE-010 | `tests/behaviour/provider-profile-selection.test.ts` | `bun test tests/behaviour/provider-profile-selection.test.ts` | To Implement |
| TC-PROFILE-011 | `tests/behaviour/provider-profile-selection.test.ts` | `bun test tests/behaviour/provider-profile-selection.test.ts` | To Implement |
| TC-PROFILE-012 | `tests/behaviour/provider-profile-probes.test.ts` | `bun test tests/behaviour/provider-profile-probes.test.ts` | To Implement |
| TC-PROFILE-013 | `tests/behaviour/provider-profile-probes.test.ts` | `bun test tests/behaviour/provider-profile-probes.test.ts` | To Implement |
| TC-PROFILE-014 | `tests/behaviour/provider-profile-probes.test.ts` | `bun test tests/behaviour/provider-profile-probes.test.ts` | To Implement |
| TC-PROFILE-015 | `tests/behaviour/provider-profile-probes.test.ts` | `bun test tests/behaviour/provider-profile-probes.test.ts` | To Implement |
| TC-PROFILE-016 | `tests/behaviour/provider-watch-mappings.test.ts` | `bun test tests/behaviour/provider-watch-mappings.test.ts` | To Implement |
| TC-PROFILE-017 | `tests/behaviour/provider-watch-mappings.test.ts` | `bun test tests/behaviour/provider-watch-mappings.test.ts` | To Implement |
| TC-PROFILE-018 | `tests/behaviour/provider-watch-mappings.test.ts` | `bun test tests/behaviour/provider-watch-mappings.test.ts` | To Implement |
| TC-PROFILE-019 | `tests/behaviour/provider-watch-mappings.test.ts` | `bun test tests/behaviour/provider-watch-mappings.test.ts` | To Implement |
| TC-PROFILE-020 | `tests/behaviour/provider-watch-status.test.ts` | `bun test tests/behaviour/provider-watch-status.test.ts` | To Implement |
| TC-PROFILE-021 | `tests/behaviour/provider-watch-status.test.ts`, `tests/checks/secret-read-boundary.test.ts` | `bun test tests/behaviour/provider-watch-status.test.ts tests/checks/secret-read-boundary.test.ts` | To Implement |
| TC-PROFILE-022 | `tests/behaviour/provider-profile-park-switch-revert.test.ts` | `bun test tests/behaviour/provider-profile-park-switch-revert.test.ts` | To Implement |
| TC-PROFILE-023 | `tests/behaviour/provider-profile-park-switch-revert.test.ts` | `bun test tests/behaviour/provider-profile-park-switch-revert.test.ts` | To Implement |
| TC-PROFILE-024 | `tests/behaviour/provider-profile-park-switch-revert.test.ts` | `bun test tests/behaviour/provider-profile-park-switch-revert.test.ts` | To Implement |
| TC-PROFILE-025 | `tests/behaviour/provider-profile-park-switch-revert.test.ts` | `bun test tests/behaviour/provider-profile-park-switch-revert.test.ts` | To Implement |
| TC-PROFILE-026 | `tests/behaviour/provider-profile-park-switch-revert.test.ts` | `bun test tests/behaviour/provider-profile-park-switch-revert.test.ts` | To Implement |
| TC-PROFILE-027 | `tests/behaviour/provider-profile-park-switch-revert.test.ts` | `bun test tests/behaviour/provider-profile-park-switch-revert.test.ts` | To Implement |
| TC-PROFILE-028 | `tests/behaviour/provider-profile-park-switch-revert.test.ts` | `bun test tests/behaviour/provider-profile-park-switch-revert.test.ts` | To Implement |
| TC-PROFILE-029 | `tests/behaviour/provider-profile-pacing.test.ts` | `bun test tests/behaviour/provider-profile-pacing.test.ts` | To Implement |
| TC-PROFILE-030 | `tests/behaviour/provider-profile-pacing.test.ts` | `bun test tests/behaviour/provider-profile-pacing.test.ts` | To Implement |
| TC-PROFILE-031 | `tests/behaviour/provider-profile-pacing.test.ts` | `bun test tests/behaviour/provider-profile-pacing.test.ts` | To Implement |
| TC-PROFILE-032 | `tests/behaviour/provider-profile-pacing.test.ts` | `bun test tests/behaviour/provider-profile-pacing.test.ts` | To Implement |
| TC-PROFILE-033 | `tests/behaviour/provider-profile-spawn.test.ts` | `bun test tests/behaviour/provider-profile-spawn.test.ts` | To Implement |
| TC-PROFILE-034 | `tests/behaviour/provider-profile-spawn.test.ts` | `bun test tests/behaviour/provider-profile-spawn.test.ts` | To Implement |
| TC-PROFILE-035 | `tests/behaviour/provider-profile-env-record.test.ts` | `bun test tests/behaviour/provider-profile-env-record.test.ts` | To Implement |
| TC-PROFILE-036 | `tests/behaviour/provider-profile-env-record.test.ts` | `bun test tests/behaviour/provider-profile-env-record.test.ts` | To Implement |
| TC-PROFILE-037 | `tests/behaviour/provider-profile-env-record.test.ts` | `bun test tests/behaviour/provider-profile-env-record.test.ts` | To Implement |
| TC-PROFILE-038 | `tests/behaviour/provider-profile-env-record.test.ts`, `tests/checks/provider-profile-hermetic.test.ts` | `bun test tests/behaviour/provider-profile-env-record.test.ts tests/checks/provider-profile-hermetic.test.ts` | To Implement |
| TC-PROFILE-039 | `tests/structure/provider-profile-contract.test.ts`, `tests/fixtures/provider/contract-inventory.json` | `bun test tests/structure/provider-profile-contract.test.ts` | To Implement |
| TC-PROFILE-040 | `tests/checks/error-table-sync.test.ts` | `bun test tests/checks/error-table-sync.test.ts` | Existing — Update |
| TC-PROFILE-041 | `tests/behaviour/provider-profile-park-switch-revert.test.ts` | `bun test tests/behaviour/provider-profile-park-switch-revert.test.ts` | To Implement |
| TC-PROFILE-042 | `tests/checks/provider-profile-evidence-bounds.test.ts` | `bun test tests/checks/provider-profile-evidence-bounds.test.ts` | To Implement |
| TC-PROFILE-043 | `tests/behaviour/provider-profile-cli.test.ts`, `tests/golden/provider-profile-resolve.test.ts` | `bun test tests/behaviour/provider-profile-cli.test.ts tests/golden` | To Implement |
| TC-PROFILE-044 | `tests/behaviour/provider-profile-cli.test.ts`, `tests/golden/provider-profile-resolve.test.ts` | `bun test tests/behaviour/provider-profile-cli.test.ts tests/golden` | To Implement |
| TC-PROFILE-045 | `tests/behaviour/provider-watch-status.test.ts`, `tests/golden/provider-watch-status.test.ts` | `bun test tests/behaviour/provider-watch-status.test.ts tests/golden` | To Implement |
| TC-PROFILE-046 | `tests/behaviour/provider-profile-cli.test.ts` | `bun test tests/behaviour/provider-profile-cli.test.ts` | To Implement |
| TC-PROFILE-047 | `tests/behaviour/provider-profile-legacy-decision-table.test.ts` | `bun test tests/behaviour/provider-profile-legacy-decision-table.test.ts` | To Implement |
| TC-PROFILE-048 | `tests/behaviour/provider-profile-legacy-decision-table.test.ts` | `bun test tests/behaviour/provider-profile-legacy-decision-table.test.ts` | To Implement |
| TC-PROFILE-049 | `tests/behaviour/provider-profile-legacy-decision-table.test.ts` | `bun test tests/behaviour/provider-profile-legacy-decision-table.test.ts` | To Implement |
| TC-PROFILE-050 | `tests/behaviour/provider-profile-legacy-decision-table.test.ts` | `bun test tests/behaviour/provider-profile-legacy-decision-table.test.ts` | To Implement |
| TC-PROFILE-051 | `tests/behaviour/provider-profile-legacy-decision-table.test.ts` | `bun test tests/behaviour/provider-profile-legacy-decision-table.test.ts` | To Implement |
| TC-PROFILE-052 | `tests/behaviour/provider-profile-legacy-decision-table.test.ts` | `bun test tests/behaviour/provider-profile-legacy-decision-table.test.ts` | To Implement |
| TC-PROFILE-053 | `tests/behaviour/provider-profile-selection.test.ts`, `tests/behaviour/provider-profile-park-switch-revert.test.ts` | `bun test tests/behaviour/provider-profile-selection.test.ts tests/behaviour/provider-profile-park-switch-revert.test.ts` | To Implement |
| TC-PROFILE-054 | `tests/checks/provider-profile-hermetic.test.ts` | `bun test tests/checks/provider-profile-hermetic.test.ts` | To Implement |
| TC-PROFILE-055 | `tests/structure/provider-profile-contract.test.ts`, `tests/checks/provider-profile-hermetic.test.ts`, `tests/boundaries/**`, `.dependency-cruiser.cjs` | `bun test tests/structure/provider-profile-contract.test.ts tests/checks/provider-profile-hermetic.test.ts tests/boundaries` | To Implement |
| TC-PROFILE-056 | `tests/checks/provider-profile-hermetic.test.ts` | `bun test tests/checks/provider-profile-hermetic.test.ts` | To Implement |
| TC-PROFILE-057 | `tests/behaviour/provider-profile-park-switch-revert.test.ts`, `tests/behaviour/provider-watch-status.test.ts` | `bun test tests/behaviour/provider-profile-park-switch-revert.test.ts tests/behaviour/provider-watch-status.test.ts` | To Implement |
| TC-PROFILE-058 | `tests/behaviour/provider-profile-spawn.test.ts`; milestone review evidence | `bun test tests/behaviour/provider-profile-spawn.test.ts` plus manual milestone review | To Implement |

**Implementation-order mapping** (per spec §18 delivery order; reconcile with `chg-GH-234-plan.yaml` at phase 4):

1. Configuration branch and validation → TC-PROFILE-001, 002, 003, 005.
2. Selection engine (heuristics, gate, eligibility, probes) → TC-PROFILE-006..015, 047, 048.
3. Park/switch/revert and pacing → TC-PROFILE-022..032, 041, 049, 050.
4. Watch mappings and status → TC-PROFILE-016..021, 045, 051.
5. CLI surface → TC-PROFILE-043, 044, 046.
6. Spawn seam and env records → TC-PROFILE-033..038, 058.
7. Vocabulary/evidence and cross-cutting gates → TC-PROFILE-039, 040, 042, 052..057.

**Mocking/injection requirements**: no `mock.module`; inject fakes (clock, sleep, transport, credential port, state store, spawn port). Tests that need a provider fact use a fixture-driven fake, never a live call. Tests that need an env record consume it as data and assert byte-level shape.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

- **T-RSK-1 — Fixture-only vendor proof (RSK-2)**: watch mappings are proven against committed fixtures, not live vendors. A live shape drift will not fail CI. Mitigation: normalization is defensive and every malformed class is an outage; GAP-T2 and OQ-T4 make the missing-fixture failure explicit.
- **T-RSK-2 — "Zero code change" is structural**: AC-F1-5 is demonstrated by changing configuration fixtures only, not by literally editing source. Mitigation: TC-PROFILE-004 asserts the only input difference is configuration and provenance; review confirms no source diff accompanies the behaviour change.
- **T-RSK-3 — Performance bound is environment-sensitive (GAP-T6)**: NFR-6's 50 ms bound depends on the runner. Mitigation: warm-up, committed baseline, recorded measurement, and an I/O-free assertion that is environment-independent.
- **T-RSK-4 — Spawn-surface ambiguity (GAP-T3)**: the legacy hook is untouched, so the enforcement point for "any current spawn surface" is delivery-bound. Mitigation: TC-PROFILE-033/058 assert the seam and the wrapper path; OQ-T1 requires the plan to name the concrete surface. This is not reinterpreted as hook modification.
- **T-RSK-5 — Delivery-bound names (GAP-T8)**: module paths, record kinds, schema strings, error ids, and fixture names may be chosen in delivery. Mitigation: tests resolve seams through the delivered contracts and fail naming a missing contract; the behaviours, AC traces, and IDs remain pinned.
- **T-RSK-6 — Pacing precedence underspecified (GAP-T4)**: goal priorities can conflict and the spec does not pin precedence. Mitigation: TC-PROFILE-031 asserts deterministic evaluation over declared priorities and the typed execution-only rule; OQ-T2 requires the precedence to be pinned before the pacing test is finalized.
- **T-RSK-7 — Milestone AC cannot be closed here (GAP-T1)**: AC-F8-8's audit-ledger evidence is external. Mitigation: TC-PROFILE-058 proves the machinery/seam and explicitly records the external evidence. The plan does not claim the milestone criterion is satisfied.
- **T-RSK-8 — Permission/file-metadata classes in an in-memory record path**: the legacy floor includes safe regular file and ownership/permission checks. If the engine env record is in-memory only, those classes apply to the legacy file contract, not to an in-memory record. Mitigation: TC-PROFILE-035 asserts the file classes through the legacy-carry-over file path and the in-memory classes through the record validator; the split is stated so no class is silently dropped.

### 8.2 Assumptions

- The engine v1 condition set (enabled, peak, quota, outage, credential) expresses profile eligibility without new condition kinds (spec §12).
- The delivered harness spawn-env seam accepts constructed data and can receive the resolved model environment as records.
- The legacy `ADOS_HOOK_ENV_V1` grammar is an accurate carry-over contract for the current bash spawn surface; the legacy hook itself is not modified.
- The three vendor endpoints expose the shapes the spec describes; fixtures are the delivery's committed approximation.
- Expensive windows are UTC; operators declare the UTC equivalent of local pricing windows.
- Tier, rung, and threshold names are configuration identifiers and may be renamed without structural change.
- Selection events are sufficient for later spend attribution; no join consumer is built here.
- `config debug` / `config get --show-origin` is the provenance surface for the new branch (GAP-T7).

### 8.3 Open Questions

| ID | Question | Impact | Blocking? | Owner |
|----|----------|--------|-----------|-------|
| OQ-T1 | Which concrete current spawn surface(s) invoke resolution in this change, given the legacy hook is untouched? (GAP-T3) | Determines where TC-PROFILE-033/058 run; does not change the seam contract | No for test authoring; yes for delivery mapping | plan-writer / owner |
| OQ-T2 | What is the precedence among the three declared pacing goal priorities when they conflict? (GAP-T4) | TC-PROFILE-031 asserts determinism but cannot assert an unpinned precedence | Yes for finalizing TC-PROFILE-031 assertions | spec owner / decision-advisor |
| OQ-T3 | Exact tier, rung, and tail-threshold names and values | Fixtures use declared names; renames are configuration data | No | delivery / naming lock (OQ-1) |
| OQ-T4 | Committed vendor response fixtures for coding-plan, DeepSeek, and OpenAI | TC-PROFILE-016..019 fail naming the missing fixture rather than weakening | No for test authoring; yes for delivery | delivery |
| OQ-T5 | Is there an external legacy resolver battery to port ID-for-ID? (spec OQ-3) | The five groups define the contract per DEC-5; an external battery would extend mapping | No | owner at PR review |
| OQ-T6 | Audit-ledger and daemon evidence for AC-F8-8 | Milestone-scoped; not testable here | No (external by design) | M1-S22 / M1-S9 |
| OQ-T7 | Does the profile area warrant its own feature spec at doc-sync? (spec §16) | Documentation placement only | No | doc-syncer |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-07 | test-plan-writer | Initial plan from chg-GH-234-spec.md v1.0, pm-notes, seeded scenarios SC-M1-21/22, and the delivered provider-engine and harness-adapter precedents. 58 TCs; all nine ACs traced; AC-F8-8 marked partial with external milestone evidence. |

## 10. Test Execution Log

Populated during delivery and quality gates. No execution has occurred at authoring time.

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| TC-PROFILE-001..005 | 2026-11-07 | PASS | `provider-profile-config` 18 pass; shipped-empty, validation matrix, tuning, provenance |
| TC-PROFILE-006..015, 047, 048 | 2026-11-07 | PASS | `provider-profile-selection`/`probes`/`legacy` 42 pass; NFR-6 measured under 50 ms |
| TC-PROFILE-016..021, 045(engine), 051 | 2026-11-07 | PASS | `provider-watch-mappings`/`provider-watch-status`/legacy group 5 74 pass; boundaries clean |
| TC-PROFILE-022..032, 041, 049, 050, 053(lifecycle) | 2026-11-07 | PASS | `provider-profile-park-switch-revert`/`pacing`/legacy 47 pass; parks/chain 35 pass |
| TC-PROFILE-033..038, 058 | 2026-11-07 | PASS | `provider-profile-spawn`/`env-record`/`config`/harness-spawn-env 54 pass |
| TC-PROFILE-039, 040, 042, 052..057 | 2026-11-07 | PASS | structure/checks/boundaries 44 pass; boundaries 140 pass; secret-read/ambient/workspace checks OK; legacy-hook regression 39 pass |
| TC-PROFILE-043..046, 045(CLI/golden) | 2026-11-07 | PASS | `provider-profile-cli` + goldens 27 pass; existing provider CLI/goldens 14 pass |
| Aggregate | 2026-11-07 | PASS (2 environmental) | `pnpm check` 4731/4733 pass; the 2 named environmental failures are TC-STATE-021 (Corepack pnpm 12.18.0 download with no network) and CI-parity (cross-device `git clone --local`), neither touching provider/profile code; error-table-sync 91/91; changeset present; doc-distribution N/A for delivery phases (doc/spec/** and doc/planning/** touches ride the doc-sync handoff) |
| Remediation iteration 1 (phase 10) | 2026-11-07 | PASS (2 environmental) | `pnpm check` 4742 pass / 4 skip / 2 fail across 4748 tests (469 files); the only failures are the same two named environmental ones (TC-STATE-021 Corepack pnpm download; CI-parity cross-device clone). New edge-wiring production suite (13 tests) covers `--profile`/`--agent`/`--for-spawn`/`--provider` on the real edge; lifecycle switch/revert/persist proven through the production path and the engine-path golden. error-table-sync 91/91; boundaries 251 modules 0 violations, secret-read allowlist 5; exports-parity 5 publishables; hook regression 39/39. |
| External obligations | 2026-11-07 | NOT ASSERTED | AC-F8-8 milestone exit evidence arrives via M1-S9 (GH-239) and M1-S22 (GH-223); OQ-3/OQ-T5 external battery surfaced at PR review — never recorded as passing |
