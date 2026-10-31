---
id: chg-GH-182-test-plan
status: Updated
created: 2026-10-31T15:00:00Z
last_updated: 2026-10-31T16:00:00Z
owners: [engineering]
service: delivery-os provider engine
labels: [change, planning]
version_impact: minor
summary: "Verify all 46 acceptance criteria for the v1 provider engine: typed provider configuration, deterministic subscription-first chain resolution with eight closed skip reasons including `shadowed`, UTC peak-window and quota evaluation ported from the legacy battery, named self-expiring parks persisted through the state layer and folded into `provider-parks.json`, fail-loud announcements with closed secret-free evidence allowlists, credential-port-only quota authorization, the three-command provider surface, exact-code provider classification, completed-sleep loop-cap accounting, and a 49-check legacy parity mapping with explicit fail-loud divergence."
links:
  change_spec: ./chg-GH-182-spec.md
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - M0-S13: provider v1 — quota-aware routing, named parks, fail-loud announcements

## 1. Scope and Objectives

Protect the provider engine contract before any spawn integration consumes it: a declared chain must resolve deterministically and subscription-first, every peak/quota/outage condition must become a named park with an honest absolute expiry, and every indeterminate availability verdict must be announced or classified. The highest risks are (a) a legacy fail-open outcome surviving as a silent "clear", (b) a credential or raw quota body leaking through an envelope, diagnostic, park, or announcement, (c) a park without a future expiry or a park mistaken for a blocked lane, and (d) a ported battery that looks complete but does not assert the fail-loud divergence. This plan is a design and implementation map; it makes no execution claim.

### 1.1 In Scope

- All 46 acceptance criteria in spec §17: AC-F1-1 through AC-F9-2, including AC-F2-5, and AC-NFR-1 through AC-NFR-6, plus the linked NFR-7, NFR-8, NFR-9, and NFR-10 thresholds.
- Provider contract inventory, closed sets, schema identifiers, deterministic park naming, configuration schema validation, semantic validation, shipped defaults, and provenance.
- Chain resolution: declared order, subscription-first selection, the eight closed skip reasons with deterministic precedence (`disabled` > own condition > `paid-fallback-not-allowed` > `shadowed`), the `shadowed` versus `paid-fallback-not-allowed` distinction, empty/missing chain failure, chain-exhausted park, and the no-paid-substitution peak rule.
- Peak evaluation: UTC half-open window, buffer clamp, custom windows, invalid-window rejection, and MAX combination with quota.
- Quota evaluation: TOKENS_LIMIT filtering, percentage threshold, reset parsing/clamping, soonest reset, mixed reset behavior, clear conditions, exhausted-without-reset classification, fresh re-evaluation, and the completed-sleep loop cap.
- Named parks: record shape, state round-trip, exact-expiry inactivity, dedupe/refresh/clear, the `provider-parks.json` rebuild-on-read projection with no separate rebuild CLI, park-versus-blocked-lane distinction, list ordering/filtering, and bounded cap/chain expiry.
- Structured announcements: closed codes, severity, subject/cause/conditions/park/expiry, deterministic identity, closed park and announcement evidence allowlists, skipped-entry outage visibility, and all CLI surfaces.
- Credential-port-only quota authorization, missing/rejected credential behavior, canary scans, secret-read boundary (zero new allowlist entries), and the single declared `provider-quota` runtime-confinement admission with a negative fixture and clean control.
- The `ados provider` surface: `resolve`, `quota`, `parks list`, invalid flags, machine envelopes, human output, and exit projection.
- Provider error rows in both directions, exact-code classification, `provider.quota.exceeded` retention, and `fallback.internal` containment for unclassified/wrong-kind failures.
- Determinism (100-run replay), hermetic guarantees (0 live network, 0 live credentials, 0 real sleeps), idempotence, bounded evidence, evaluation cost, golden output, and the ported legacy battery for every Appendix A group.

### 1.2 Out of Scope & Known Gaps

- No model-profile selection, profile classes, difficulty heuristics, or agent-to-model mapping (spec NG-1).
- No harness spawn, process launch, dispatch, or adapter implementation; `resolve` returns a decision, not a session (spec NG-2).
- No tracker/VCS/CI provider work, credential sidecar, non-UTC/DST/cross-midnight windows, daemons/timers, spend/status/queue/doctor/MCP surfaces, or legacy-hook modification (spec NG-3 through NG-8).
- No live Z.AI endpoint call, live credential, or real wall-clock sleep in any test; all are injected seams.
- The implementation plan is absent at authoring time. When it lands, file locations and commands may be reconciled, but every TC ID, AC trace, legacy mapping, and assertion intent is preserved.
- The legacy battery executes 49 `TC-ZAI-*` checks; the nominal `TC-ZAI-001..071` numeric range has gaps. This plan maps the 49 delivered IDs and does not claim 71 cases; OQ-3 is resolved in §8.3 and is not a blocker.
- Value-level secret scanning of arbitrary content is outside this change; this plan proves structural evidence closure, canary non-observation, and the boundary invariants (see §8.1).
- No AC is marked TODO. Every AC has at least one concrete scenario in §3.1 and §5.

## 2. References

- [Change specification](./chg-GH-182-spec.md) v1.2, especially §5 (F-1 to F-9), §6 flows, §8.2 (EVT-1 to EVT-4), §8.3 (DM-1 to DM-13, evidence allowlists, contract rules), §9 (NFR-1 to NFR-10), §11 (RSK-1 to RSK-10), §14, §15 (DEC-1 to DEC-13), §16 (components and codebase map), §17 (46 ACs and QA strategy), §18 (Definition of Done), §21 (security review), §24 Appendix A (legacy parity, 49 executed checks), Appendix B (config contract), Appendix C (error/announcement mapping), and Appendix D (ticket traceability). Plan OQ-1 to OQ-5 are resolved in §8.3 below.
- [Repository testing strategy](../../../../.ai/rules/testing-strategy.md): layers, module-to-test mapping, gates, CI order, fixture discipline.
- [TypeScript workspace rules](../../../../.ai/rules/typescript.md): strict TS, purity, injected seams, boundary rules, bun:test authoring.
- [AGENTS.md](../../../../AGENTS.md): package tiers, delivery workflow, change artifact conventions, no hand-added headers.
- Delivered substrate to extend: `packages/core/src/contracts/error-table.ts`, `packages/core/src/config/{catalog,defaults}.ts`, `packages/core/src/state/**`, `packages/adapters/src/credentials/**`, `scripts/checks/ambient-globals.ts`, `scripts/checks/error-table-sync.ts`, `scripts/checks/secret-read-boundary.ts`, `.dependency-cruiser.cjs`, `tests/boundaries/**`, `tests/checks/**`.
- Legacy parity source: `scripts/hooks/pre-opencode-iteration-zai.sh` and `scripts/.tests/test-hook-zai-example.sh` (49 executed `TC-ZAI-*` checks across the Appendix A groups).
- House format and rigor precedents: [chg-GH-181-test-plan.md](../2026-10-30--GH-181--primitive-ports-credential-metadata/chg-GH-181-test-plan.md); [chg-GH-188-test-plan.md](../2026-10-31--GH-188--client-seeds-trap-catalogs/chg-GH-188-test-plan.md); [chg-GH-174-test-plan.md](../2026-10-30--GH-174--state-layer/chg-GH-174-test-plan.md).
- Related system specs: [feature-result-contract.md](../../../spec/features/feature-result-contract.md), [feature-config-layer.md](../../../spec/features/feature-config-layer.md), [feature-state-layer.md](../../../spec/features/feature-state-layer.md), [feature-adapter-ports.md](../../../spec/features/feature-adapter-ports.md), [feature-monorepo-scaffold-toolchain.md](../../../spec/features/feature-monorepo-scaffold-toolchain.md).

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| Capability | AC | TC(s) | Status |
|---|---|---|---|
| F-1 | AC-F1-1 | TC-PROV-001, TC-PROV-002 | Planned |
| F-1, F-9 | AC-F1-2 | TC-PROV-005 | Planned |
| F-1, F-2 | AC-F1-3 | TC-PROV-004 | Planned |
| F-1, NFR-3 | AC-F1-4 | TC-PROV-006 | Planned |
| F-1, NFR-8 | AC-F1-5 | TC-PROV-002, TC-PROV-003 | Planned |
| F-2, NFR-1 | AC-F2-1 | TC-PROV-007 | Planned |
| F-2, DM-2 | AC-F2-2 | TC-PROV-004, TC-PROV-008 | Planned |
| F-2, F-5, F-6 | AC-F2-3 | TC-PROV-009 | Planned |
| F-2, F-3 | AC-F2-4 | TC-PROV-010 | Planned |
| F-2, F-3, DM-2, DM-6, DM-7 | AC-F2-5 | TC-PROV-010 | Planned |
| F-3, DM-3 | AC-F3-1 | TC-PROV-011, TC-PROV-054 | Planned |
| F-3, NFR-1 | AC-F3-2 | TC-PROV-012, TC-PROV-054 | Planned |
| F-1, F-3, NFR-8 | AC-F3-3 | TC-PROV-002 | Planned |
| F-3, F-4, F-5 | AC-F3-4 | TC-PROV-013 | Planned |
| F-4, F-5 | AC-F4-1 | TC-PROV-014 | Planned |
| F-4 | AC-F4-2 | TC-PROV-015, TC-PROV-016, TC-PROV-017, TC-PROV-018, TC-PROV-019, TC-PROV-020, TC-PROV-057 | Planned |
| F-4 | AC-F4-3 | TC-PROV-021 | Planned |
| F-4, F-6, F-9 | AC-F4-4 | TC-PROV-022, TC-PROV-057 | Planned |
| F-4, F-6, NFR-6 | AC-F4-5 | TC-PROV-023, TC-PROV-058, TC-PROV-061 | Planned |
| F-4, F-6, F-9, NFR-9 | AC-F4-6 | TC-PROV-024, TC-PROV-025, TC-PROV-026, TC-PROV-027, TC-PROV-037, TC-PROV-052, TC-PROV-055, TC-PROV-056, TC-PROV-057 | Planned |
| F-5, NFR-5 | AC-F5-1 | TC-PROV-001, TC-PROV-028 | Planned |
| F-5, NFR-7 | AC-F5-2 | TC-PROV-029 | Planned |
| F-5, F-6, NFR-6 | AC-F5-3 | TC-PROV-030 | Planned |
| F-5 | AC-F5-4 | TC-PROV-031 | Planned |
| F-5, F-8, NFR-6 | AC-F5-5 | TC-PROV-032 | Planned |
| F-5, NFR-7 | AC-F5-6 | TC-PROV-009, TC-PROV-033 | Planned |
| F-6, NFR-4, NFR-5 | AC-F6-1 | TC-PROV-001, TC-PROV-034 | Planned |
| F-2, F-6 | AC-F6-2 | TC-PROV-035 | Planned |
| F-6, F-8 | AC-F6-3 | TC-PROV-036, TC-PROV-053 | Planned |
| F-6, NFR-9 | AC-F6-4 | TC-PROV-037, TC-PROV-052, TC-PROV-055, TC-PROV-059, TC-PROV-061 | Planned |
| F-7, NFR-3, NFR-4 | AC-F7-1 | TC-PROV-038 | Planned |
| F-7, F-9 | AC-F7-2 | TC-PROV-039, TC-PROV-056 | Planned |
| F-7, NFR-4 | AC-F7-3 | TC-PROV-040, TC-PROV-059 | Planned |
| F-6, F-7, F-9 | AC-F7-4 | TC-PROV-024, TC-PROV-025, TC-PROV-026 | Planned |
| F-8, DM-7, DM-11 | AC-F8-1 | TC-PROV-041, TC-PROV-053 | Planned |
| F-8, F-9 | AC-F8-2 | TC-PROV-042, TC-PROV-053 | Planned |
| F-8, NFR-6 | AC-F8-3 | TC-PROV-043, TC-PROV-053 | Planned |
| F-8, F-9 | AC-F8-4 | TC-PROV-044 | Planned |
| F-9, NFR-8 | AC-F9-1 | TC-PROV-001, TC-PROV-045 | Planned |
| F-9, NFR-8 | AC-F9-2 | TC-PROV-046 | Planned |
| NFR-1, NFR-3 | AC-NFR-1 | TC-PROV-047 | Planned |
| NFR-2 | AC-NFR-2 | TC-PROV-048, TC-PROV-062 | Planned |
| NFR-3, NFR-4 | AC-NFR-3 | TC-PROV-006 | Planned |
| NFR-5 | AC-NFR-4 | TC-PROV-040, TC-PROV-049 | Planned |
| NFR-6 | AC-NFR-5 | TC-PROV-050 | Planned |
| NFR-10 | AC-NFR-6 | TC-PROV-051 | Planned |

All 46 ACs are mapped, including AC-F2-5 through TC-PROV-010. There is no TODO acceptance criterion. NFR-7, NFR-8, and NFR-9 have no separate AC IDs in §17; they are traced through AC-F5-6, AC-F9-1/2, and AC-F4-6/AC-F6-4 respectively, and appear in the NFR table below.

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

The spec declares no `API-*` identifiers and no served HTTP endpoint (§8.1). The only outbound interaction is the declared quota `GET`; its behavior is covered through DM-4/DM-9 and the injected transport tests.

| Interface | TC IDs | Observable assertion |
|---|---|---|
| EVT-1 `provider.park` state record | TC-PROV-028, TC-PROV-030, TC-PROV-031, TC-PROV-033 | Record kind `provider.park`, payload schema `delivery.provider.park.v1`, append-only truth, latest per park name wins, folded into the rebuildable `provider-parks.json` derived document. |
| EVT-2 `provider.announcement` state record | TC-PROV-034, TC-PROV-040, TC-PROV-049, TC-PROV-050 | Record kind `provider.announcement`, schema `delivery.provider.announcement.v1`, deterministic identity, bounded evidence from the closed announcement allowlist, no duplicate for an unchanged park generation. |
| EVT-3 Command-result announcement list | TC-PROV-036, TC-PROV-041, TC-PROV-042, TC-PROV-053 | `resolve` and successful `quota` put announcements in `data.announcements`; failing `quota` carries error identity plus announcement code in the safe summary and a safe diagnostic. |
| EVT-4 `provider.resumed` announcement | TC-PROV-030 | Emitted once by the next mutating `resolve` that observes a previously active park clear; `parks list` only reports expired state. |
| DM-1 provider descriptor | TC-PROV-002, TC-PROV-003 | Cost class, optional enabled flag, optional peak window, optional quota policy; no secret material or model heuristic. |
| DM-2 cost class | TC-PROV-001, TC-PROV-004, TC-PROV-008, TC-PROV-010 | Closed `subscription`/`pay-per-token` set; subscription-before-paid validation, selection, and the `shadowed` versus `paid-fallback-not-allowed` distinction. |
| DM-3 peak window | TC-PROV-011, TC-PROV-012, TC-PROV-013 | UTC seconds-of-day, buffer clamp, half-open effective window, custom window, MAX with quota. |
| DM-4 quota policy | TC-PROV-002, TC-PROV-003, TC-PROV-014, TC-PROV-023 | Endpoint/credential reference/timeout/threshold/loop cap/TTLs; defaults; engine cap default when policy absent. |
| DM-5 credential reference binding | TC-PROV-002, TC-PROV-038, TC-PROV-039 | Declarative `literal`/`environment-prefixed` reference; resolution yields material or `config.credential.missing`; no secret in config. |
| DM-6 provider chain | TC-PROV-002, TC-PROV-004, TC-PROV-005, TC-PROV-007, TC-PROV-009, TC-PROV-010 | Ordered entries plus paid-fallback boolean; empty/duplicate/unknown/cost-order violations rejected. |
| DM-7 chain resolution decision | TC-PROV-007, TC-PROV-008, TC-PROV-009, TC-PROV-010, TC-PROV-041 | `selected` or `parked` decision plus ordered skipped entries with exactly one of the eight closed reasons and deterministic precedence (`disabled` > own condition > `paid-fallback-not-allowed` > `shadowed`). |
| DM-8 condition evaluation | TC-PROV-011, TC-PROV-013, TC-PROV-021, TC-PROV-042 | Clear/parked/blocked state with active condition kinds, wait seconds, and absolute expiry where parkable. |
| DM-9 quota snapshot and limit | TC-PROV-014 through TC-PROV-022, TC-PROV-027 | Normalized limits only, TOKENS_LIMIT filtering, integer percentage, reset epoch milliseconds, never raw body. |
| DM-10 park record | TC-PROV-028, TC-PROV-029, TC-PROV-030, TC-PROV-031, TC-PROV-033, TC-PROV-034, TC-PROV-040, TC-PROV-049 | Name, subject, closed cause, conditions, state, creation time, absolute expiry, clear time, and bounded secret-free evidence drawn only from the eight-field park allowlist. |
| DM-11 announcement record | TC-PROV-034, TC-PROV-040, TC-PROV-049, TC-PROV-050 | Deterministic identity, closed code, severity, subject, optional cause/conditions/park/expiry, safe message, and bounded evidence drawn only from the eleven-field announcement allowlist. |
| DM-12 parks projection and view | TC-PROV-029, TC-PROV-030, TC-PROV-032, TC-PROV-033, TC-PROV-043, TC-PROV-050 | Derived document `provider-parks.json`; rebuild from verified ledger truth on read when missing/divergent; v1 adds no separate rebuild CLI; active/expired/cleared state; ISO-8601 UTC expiry; deterministic ordering. |
| DM-13 re-evaluation policy | TC-PROV-023, TC-PROV-033, TC-PROV-051, TC-PROV-058, TC-PROV-061 | MAX over conditions, fresh fetch per iteration, injected sleep, loop cap counted as completed sleeps (N = `maxSleepLoops`), cap park after the Nth sleep with cap TTL expiry, no further fetch, no extra iteration. |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR | TC IDs | Gate / assertion |
|---|---|---|
| NFR-1 Determinism | TC-PROV-047, TC-PROV-060 | 100 identical replays produce byte-identical decisions, park payloads, and announcement identities; portable UTC formatting is byte-identical across host timezone/locale; no ambient clock/randomness/locale/environment. |
| NFR-2 Hermetic tests | TC-PROV-048, TC-PROV-062 | 0 live network, 0 live credentials, 0 real sleeps; injected clock/sleep/credential/transport seams; throwing-fetch guard. |
| NFR-3 Runtime neutrality | TC-PROV-006 | Core provider policy imports only core contracts; no `bun:*`/`node:*`, ambient globals, filesystem/network/environment access; guards green. |
| NFR-4 Secret safety | TC-PROV-040, TC-PROV-049 | Planted canary absent from envelopes, diagnostics, parks, announcements, and `provider-parks.json`; no raw body, auth header, credential value, or endpoint userinfo. |
| NFR-5 Bounded output | TC-PROV-049 | Evidence ≤ 1024 serialized bytes and ≤ 20 fields, drawn only from the closed allowlists (8 park fields; 8 base + 3 announcement fields = 11); announcements bounded by evaluated-entry count. |
| NFR-6 Idempotence | TC-PROV-050 | Unchanged condition appends 0 duplicate records; repeated `parks list` has 0 side effects; repeated `quota` writes 0 state; missing/divergent `provider-parks.json` is rebuilt on read without extra ledger writes. |
| NFR-7 Expiry correctness | TC-PROV-029, TC-PROV-033 | Inactive at exactly `expiresAt`; TTL/chain expiry strictly future; never a past or absent expiry. |
| NFR-8 Error-table synchronization | TC-PROV-045, TC-PROV-046 | Both machine and documented tables agree in both directions; exact-code provider classification is total; unclassified/wrong-kind contains to `fallback.internal`. |
| NFR-9 Legacy parity | TC-PROV-037, TC-PROV-052, TC-PROV-054 through TC-PROV-062 | Every Appendix A group has a ported case; all 49 executed `TC-ZAI-*` checks are mapped; every legacy fail-open class asserts an announcement or classified error; 0 silent clear. |
| NFR-10 Evaluation cost | TC-PROV-051 | 100 provider entries pure evaluation ≤ 50 ms on the reference environment, excluding transport. |

## 4. Test Types and Layers

| Level | Scope | Suites / files | Execution |
|---|---|---|---|
| Structure / contract inventory | Closed sets, schema identifiers, config field shape/defaults, error-row inventory, park/announcement record kinds, deterministic naming | `tests/structure/provider-contract.test.ts`, `tests/structure/error-table.test.ts`, `tests/fixtures/provider/contract-inventory.json` | `bun test tests/structure` |
| Behaviour | Chain validation/resolution, peak arithmetic, quota math, park lifecycle, announcements, credentials, CLI paths | `tests/behaviour/provider-chain-resolution.test.ts`, `provider-peak-window.test.ts`, `provider-quota-evaluation.test.ts`, `provider-parks.test.ts`, `provider-announcements.test.ts`, `provider-credentials.test.ts`, `provider-cli.test.ts` | `bun test tests/behaviour` |
| Golden output | Normalized machine envelopes and human output for selected, parked, outage/skipped, quota success/failure, and parks-list cases | `tests/golden/provider-*.test.ts`, `tests/fixtures/provider/golden/**` | `bun test tests/golden` |
| Legacy parity | Every Appendix A group, every delivered `TC-ZAI-*` ID, and the explicit fail-loud divergence | `tests/behaviour/provider-legacy-parity.test.ts`, `tests/fixtures/provider/legacy/**` | `bun test tests/behaviour/provider-legacy-parity.test.ts` |
| Determinism / idempotence / cost | 100-run replay, dedupe/no-append, exact-expiry boundary, bounded evidence, 100-entry evaluation cost | `tests/behaviour/provider-parks.test.ts`, `provider-announcements.test.ts`, `provider-quota-evaluation.test.ts`, `tests/checks/provider-evidence-bounds.test.ts` | `bun test` selected suites |
| Checks / boundaries | Secret-read boundary, runtime-API confinement, ambient globals, forbidden literals, error-table sync, fixture coverage | `scripts/checks/secret-read-boundary.ts`, `scripts/checks/ambient-globals.ts`, `scripts/checks/error-table-sync.ts`, `tests/checks/secret-read-boundary.test.ts`, `tests/checks/error-table-sync.test.ts`, `tests/boundaries/**` | `bun run scripts/checks/*.ts`; `bun test tests/checks tests/boundaries`; `pnpm check:boundaries` |
| Aggregate | Whole workspace | all of the above plus `pnpm check` | `pnpm check` |

All tests use `bun:test` under `tests/**`; fixtures are never named `*.test.ts`. Time, sleep, sleep duration, credential material, quota responses, and state stores are injected. `tests/golden` output is normalized (no absolute paths, wall-clock timestamps, or unstable ordering) and regenerated only by an explicit script.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Impact | Priority | AC |
|---|---|---|---|---|---|---|
| TC-PROV-001 | Contract inventory and closed vocabularies | Contract | Structure | Critical | High | AC-F1-1, AC-F5-1, AC-F6-1, AC-F9-1 |
| TC-PROV-002 | Provider config schema and semantic validation | Negative | Structure | Critical | High | AC-F1-1, AC-F1-5, AC-F3-3 |
| TC-PROV-003 | Shipped defaults, optional fields, and provenance | Happy Path | Behaviour | Critical | High | AC-F1-5 |
| TC-PROV-004 | Cost-order rejection and no resolution attempt | Negative | Behaviour | Critical | High | AC-F1-3, AC-F2-2 |
| TC-PROV-005 | Missing or empty chain fails closed | Negative | Behaviour | Critical | High | AC-F1-2 |
| TC-PROV-006 | Runtime neutrality, forbidden literals, and confinement | Negative | Checks | Critical | High | AC-F1-4, AC-NFR-3 |
| TC-PROV-007 | Declared-order resolution and eight closed skip reasons | Happy Path | Behaviour | Critical | High | AC-F2-1 |
| TC-PROV-008 | Subscription wins; paid entry is `shadowed` or `paid-fallback-not-allowed` | Happy Path | Behaviour | Critical | High | AC-F2-2 |
| TC-PROV-009 | Chain-exhausted park and announcement | Corner Case | Behaviour | Critical | High | AC-F2-3, AC-F5-6 |
| TC-PROV-010 | Peak park shadows paid entry; no paid substitution | Edge Case | Behaviour | Critical | High | AC-F2-4, AC-F2-5 |
| TC-PROV-011 | Peak boundary and buffer matrix | Edge Case | Behaviour | Critical | High | AC-F3-1 |
| TC-PROV-012 | Custom peak window is declarative | Happy Path | Behaviour | Critical | High | AC-F3-2 |
| TC-PROV-013 | Peak and quota combine by MAX | Edge Case | Behaviour | Critical | High | AC-F3-4 |
| TC-PROV-014 | Exhausted TOKENS_LIMIT with valid reset | Happy Path | Behaviour | Critical | High | AC-F4-1 |
| TC-PROV-015 | Both limits exhausted: soonest reset | Edge Case | Behaviour | Critical | High | AC-F4-2 |
| TC-PROV-016 | TIME_LIMIT is ignored | Edge Case | Behaviour | Critical | High | AC-F4-2 |
| TC-PROV-017 | Percentage exactly 100 and above 100 | Edge Case | Behaviour | Critical | High | AC-F4-2 |
| TC-PROV-018 | Past reset clamps to zero and does not park | Edge Case | Behaviour | Critical | High | AC-F4-2 |
| TC-PROV-019 | Mixed valid and invalid resets use the valid one | Corner Case | Behaviour | Critical | High | AC-F4-2 |
| TC-PROV-020 | Non-exhausted earlier reset is ignored | Edge Case | Behaviour | Critical | High | AC-F4-2 |
| TC-PROV-021 | Clear condition produces no outage artifact | Happy Path | Behaviour | Critical | High | AC-F4-3 |
| TC-PROV-022 | Exhausted without valid reset fails loud | Negative | Behaviour | Critical | High | AC-F4-4 |
| TC-PROV-023 | Fresh re-evaluation and completed-sleep cap park | Edge Case | Behaviour | Critical | High | AC-F4-5 |
| TC-PROV-024 | Transport failure or timeout is announced | Negative | Behaviour | Critical | High | AC-F4-6, AC-F7-4 |
| TC-PROV-025 | HTTP 401/403 is credential rejection | Negative | Behaviour | Critical | High | AC-F4-6, AC-F7-4 |
| TC-PROV-026 | Non-auth HTTP failure is an outage | Negative | Behaviour | Critical | High | AC-F4-6, AC-F7-4 |
| TC-PROV-027 | Malformed JSON, envelope, limits, percentage | Negative | Behaviour | Critical | High | AC-F4-6 |
| TC-PROV-028 | Park record shape, allowlist, and `provider-parks.json` round-trip | Contract | Behaviour | Critical | High | AC-F5-1 |
| TC-PROV-029 | Exact-expiry inactivity with no write | Edge Case | Behaviour | Critical | High | AC-F5-2 |
| TC-PROV-030 | Dedupe, refresh, clear, and projection rebuild | Edge Case | Behaviour | Critical | High | AC-F5-3 |
| TC-PROV-031 | Park is distinct from a blocked lane; projection record | Contract | Structure | Critical | High | AC-F5-4 |
| TC-PROV-032 | Parks list reads `provider-parks.json`; ordering/filters | Happy Path | Behaviour | Critical | High | AC-F5-5 |
| TC-PROV-033 | Cap/chain expiry and projection rebuild | Edge Case | Behaviour | Critical | High | AC-F5-6, NFR-7 |
| TC-PROV-034 | Announcement shape, closed allowlist, severity, identity | Contract | Behaviour | Critical | High | AC-F6-1 |
| TC-PROV-035 | Skipped-entry outage stays visible | Edge Case | Behaviour | Critical | High | AC-F6-2 |
| TC-PROV-036 | Announcements on resolve/quota surfaces | Happy Path | Behaviour | Critical | High | AC-F6-3 |
| TC-PROV-037 | Legacy fail-open is replaced by fail-loud | Regression | Behaviour | Critical | High | AC-F6-4, AC-F4-6 |
| TC-PROV-038 | Credential-port-only resolution | Contract | Behaviour | Critical | High | AC-F7-1 |
| TC-PROV-039 | Missing credential parks with `failureClass` evidence | Negative | Behaviour | Critical | High | AC-F7-2 |
| TC-PROV-040 | Planted canary and closed allowlists never leak | Negative | Checks | Critical | High | AC-F7-3, AC-NFR-4 |
| TC-PROV-041 | `resolve` machine and human output | Happy Path | Behaviour | Critical | High | AC-F8-1 |
| TC-PROV-042 | `quota` is non-mutating and classified | Happy Path | Behaviour | Critical | High | AC-F8-2 |
| TC-PROV-043 | `parks list` view, `provider-parks.json`, filters | Happy Path | Behaviour | Critical | High | AC-F8-3 |
| TC-PROV-044 | Invalid provider flags fail classified | Negative | Behaviour | Critical | High | AC-F8-4 |
| TC-PROV-045 | Bidirectional error-table sync | Regression | Checks | Critical | High | AC-F9-1 |
| TC-PROV-046 | Exact-code provider classification | Regression | Behaviour | Critical | High | AC-F9-2 |
| TC-PROV-047 | 100-run deterministic replay | Regression | Behaviour | Critical | High | AC-NFR-1 |
| TC-PROV-048 | Hermetic suite guarantees | Regression | Checks | Critical | High | AC-NFR-2 |
| TC-PROV-049 | Bounded closed-allowlist evidence and announcement list | Edge Case | Checks | Critical | High | AC-NFR-4 |
| TC-PROV-050 | Idempotent persistence and reads | Regression | Behaviour | Critical | High | AC-NFR-5 |
| TC-PROV-051 | 100-entry evaluation cost | Performance | Behaviour | Important | High | AC-NFR-6 |
| TC-PROV-052 | No-silent-path matrix | Regression | Behaviour | Critical | High | AC-F6-4, AC-F4-6 |
| TC-PROV-053 | Golden machine and human outputs | Regression | Golden | Important | High | AC-F6-3, AC-F8-1, AC-F8-2, AC-F8-3 |
| TC-PROV-054 | Legacy parity group A (001..005) | Regression | Legacy Parity | Critical | High | AC-F3-1, AC-F3-2, NFR-9 |
| TC-PROV-055 | Legacy parity group B (010..020) | Regression | Legacy Parity | Critical | High | AC-F4-6, AC-F6-4 |
| TC-PROV-056 | Legacy parity group B' (021..025) | Regression | Legacy Parity | Critical | High | AC-F4-6, AC-F7-2 |
| TC-PROV-057 | Legacy parity groups C/D (029..042) | Regression | Legacy Parity | Critical | High | AC-F4-2, AC-F4-4, AC-F4-6 |
| TC-PROV-058 | Legacy parity group E (045..046) and completed-sleep fetch | Regression | Legacy Parity | Critical | High | AC-F4-5 |
| TC-PROV-059 | Legacy parity group F (050..052) | Regression | Legacy Parity | Critical | High | AC-F7-3, AC-F6-4 |
| TC-PROV-060 | Legacy parity group G (055..056) | Regression | Legacy Parity | Critical | High | NFR-1 |
| TC-PROV-061 | Legacy parity group H (060..064) and completed-sleep cap | Regression | Legacy Parity | Critical | High | AC-F4-5, AC-F6-4 |
| TC-PROV-062 | Legacy parity group I (070..071) | Regression | Legacy Parity | Critical | High | AC-NFR-2, NFR-9 |

### 5.2 Scenario Details

#### TC-PROV-001 - Contract inventory and closed vocabularies

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-5, F-6, F-9, AC-F1-1, AC-F5-1, AC-F6-1, AC-F9-1, DM-1, DM-2, DM-10, DM-11
**Test Type(s)**: Contract, Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/provider-contract.test.ts`, `tests/fixtures/provider/contract-inventory.json`
**Tags**: @backend

**Preconditions**:
- `packages/core/src/contracts/provider.ts` exports the provider contract surface and closed sets.
- The inventory fixture is the exact expected export/set inventory, independent of the current source.

**Steps**:
1. Parse the provider contracts with the TypeScript AST; collect exported types, interfaces, and `as const` values; compare both directions with the fixture.
2. Assert the closed sets exactly: cost classes, park causes, condition kinds, the eight skip reasons (`disabled`, `peak-window`, `quota-exhausted`, `provider-outage`, `credential-missing`, `credential-rejected`, `paid-fallback-not-allowed`, `shadowed`), announcement codes, and record kinds.
3. Assert the park evidence allowlist is exactly the eight fields and the announcement evidence allowlist is exactly the eleven fields; assert no additional evidence key is admitted.
4. Assert schema identifiers are `delivery.provider.park.v1` and `delivery.provider.announcement.v1`, the projection name is `provider-parks.json`, and park naming helpers produce only `provider:<name>` and `chain:<name>`.
5. In a temp copy, add an extra cause, remove a skip reason, and add an unknown evidence key; assert the inventory fails naming the offending member; restore and run the clean control.

**Expected Outcome**:
- Then the provider contract surface equals the fixture exactly in both directions, every vocabulary and allowlist is closed, and deterministic naming/schema/projection identifiers are pinned.

#### TC-PROV-002 - Provider config schema and semantic validation

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, AC-F1-5, AC-F3-3, DM-1, DM-3, DM-4, DM-5, DM-6, NFR-8
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-chain-resolution.test.ts`, `tests/behaviour/provider-peak-window.test.ts`, `tests/fixtures/provider/config/**`
**Tags**: @backend

**Preconditions**:
- Config fixtures cover: valid chain, duplicate entry, unknown reference, empty chain, paid-before-subscription, missing required field, omitted optional fields, non-UTC timezone, end at or before start, out-of-range seconds, non-HTTPS endpoint, and endpoint userinfo.
- The existing config validator and `config debug` provenance surface are available.

**Steps**:
1. Validate the valid fixture; assert every required/optional/default rule from Appendix B is enforced and the optional defaults materialize.
2. For each invalid fixture, assert the exact classified identity: `provider.chain.invalid` for duplicates/unknown references/cost order/peak range/userinfo; `provider.chain.empty` for missing or empty entries.
3. Assert a missing required field fails closed and an omitted optional field takes its documented default (or stays absent for optional peak/quota blocks).
4. Assert validation performs no credential resolution, quota fetch, or state write; then mutate a valid fixture in a temp copy and assert the failure names the offending field/entry.

**Expected Outcome**:
- Then every invalid configuration fails closed with the declared code and an actionable identity, valid configuration validates, and no silent reorder/default substitution occurs.

#### TC-PROV-003 - Shipped defaults, optional fields, and provenance

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-5, DM-1, DM-4
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-chain-resolution.test.ts`, `tests/fixtures/provider/config/defaults.yaml`, `tests/fixtures/provider/config/optional-omitted.yaml`
**Tags**: @backend

**Preconditions**:
- The built-in defaults ship the `zai-coding-plan` descriptor and the `zai` credential reference; no chain is enabled by default.
- The config layer exposes provenance through `config debug`.

**Steps**:
1. Resolve the defaults; assert the descriptor and credential reference exist exactly once, and assert no default chain is enabled.
2. Assert optional defaults: enabled `true`, buffer `0`, quota timeout `15000`, threshold `100`, loop cap `24`, outage TTL `300`, credential TTL `900`, cap TTL `300`, paid fallback `false`.
3. Assert absent optional peak/quota blocks remain absent rather than being fabricated.
4. Run `config debug`; assert provenance names the defaults layer and the resolved source for each provider field; mutate a default in a temp copy and assert the provenance/value test fails.

**Expected Outcome**:
- Then defaults are the documented shipped case, absent optionals stay absent where required, and provenance is visible without hidden substitution.

#### TC-PROV-004 - Cost-order rejection and no resolution attempt

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-2, AC-F1-3, AC-F2-2, DM-2, DM-6
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-chain-resolution.test.ts`, `tests/fixtures/provider/config/paid-before-subscription.yaml`
**Tags**: @backend

**Preconditions**:
- A chain declares a `pay-per-token` entry before a `subscription` entry.
- A recording transport, credential port, and state store are injected to prove no resolution work occurs.

**Steps**:
1. Validate the chain; assert `provider.chain.invalid` names the chain and the offending entries.
2. Assert no resolution decision is produced and the transport/credential/state fakes record zero calls.
3. Reverse the order in a temp copy; assert validation passes and resolution selects the subscription entry.
4. Assert the validator never silently reorders entries or substitutes a default chain.

**Expected Outcome**:
- Then cost-order violations fail before any I/O, and a corrected order resolves subscription-first.

#### TC-PROV-005 - Missing or empty chain fails closed

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-9, AC-F1-2, DM-6, NFR-8
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-chain-resolution.test.ts`, `tests/fixtures/provider/config/no-chain.yaml`, `empty-chain.yaml`
**Tags**: @backend

**Preconditions**:
- One fixture declares no `provider.defaultChain` and no `--chain`; another declares a chain with zero entries.
- A recording state store and transport are injected.

**Steps**:
1. Run `resolve` with no chain selected; assert `provider.chain.empty`, category `user`, retryable `false`, exit `1`.
2. Assert no park or announcement record is written and no provider is invented.
3. Repeat with the empty-entries chain; assert the same identity and zero state writes.
4. Resolve an explicit valid chain in a temp control; assert it succeeds, proving the failure is specific to absence/emptiness.

**Expected Outcome**:
- Then a missing/empty chain is a classified user failure, not an empty success and not a fabricated provider park.

#### TC-PROV-006 - Runtime neutrality, forbidden literals, and confinement

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-4, AC-NFR-3, NFR-3, NFR-4
**Test Type(s)**: Contract, Static, Boundary
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/provider-contract.test.ts`, `tests/checks/forbidden-literals.test.ts`, `tests/boundaries/**`, `.dependency-cruiser.cjs`, `scripts/checks/ambient-globals.ts`
**Tags**: @backend

**Preconditions**:
- Core provider policy lives under `packages/core/src/provider/**` and imports only core contracts.
- The ambient-globals guard, forbidden-literals scanner, and boundary harness are available.
- `.dependency-cruiser.cjs` declares exactly one new allowance: `packages/adapters/src/provider-quota/**` with a reason.

**Steps**:
1. Parse every provider core file; assert imports are only core contracts/`#` aliases and there are no `node:*`, `bun:*`, `process`, `fetch`, timers, `Date.now`, `Math.random`, filesystem, or environment reads.
2. Run the ambient-globals guard; assert zero violations in provider core.
3. Run the forbidden-literals scan over provider contracts/policy/defaults; assert no product brand token appears outside the branding seam; assert provider names, endpoints, and credential source keys come from declarative fixtures.
4. Positive boundary control: import a runtime API from `packages/adapters/src/provider-quota/probe.ts`; assert the production cruise is clean for that declared subpath.
5. Negative boundary controls: assert runtime imports in `packages/core/src/provider/**`, `packages/adapters/src/credentials/**`, `repo`, `file`, `host`, `session`, and `legacy` still violate `runtime-apis-confinement`; assert the fixture-coverage meta-check has a registered failing fixture for the rule.
6. In a temp file, inject `process.env`, `Date.now()`, and a vendor brand literal; in a temp config copy, widen the allowance to `adapters/**`; assert each mutation fails naming file/line or rule; the clean control passes.

**Expected Outcome**:
- Then core policy is runtime-neutral and brand-neutral, only the declared `provider-quota` subpath is admitted, and a planted runtime/brand/boundary violation is detectable.

#### TC-PROV-007 - Declared-order resolution and eight closed skip reasons

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-1, DM-7, NFR-1
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-chain-resolution.test.ts`, `tests/fixtures/provider/config/skip-matrix.yaml`
**Tags**: @backend

**Preconditions**:
- A chain contains entries that are disabled, peak-parked, quota-exhausted, outaged, credential-missing, credential-rejected, `paid-fallback-not-allowed`, `shadowed`, and one eligible entry.
- Injected clock, credential port, and transport return the fixture states.

**Steps**:
1. Resolve the chain; assert the first eligible entry in declared order is selected.
2. Assert every non-selected entry appears exactly once with exactly one reason from the eight-value closed set; assert all eight reasons are exercised across the fixture matrix.
3. Assert the deterministic precedence: `disabled` > own condition (`peak-window`, `quota-exhausted`, `provider-outage`, `credential-missing`, `credential-rejected`) > `paid-fallback-not-allowed` > `shadowed`.
4. Assert `paid-fallback-not-allowed` is used only when fallback is disabled, and a later entry with no higher-precedence reason is `shadowed`, relative to the selected or determining entry.
5. Assert no entry is silently omitted and no reason is free text; resolve twice with identical facts and assert deep-equal decisions/skipped lists.

**Expected Outcome**:
- Then resolution is declared-order, total over non-selected entries, eight-reason closed, precedence-correct, and deterministic.

#### TC-PROV-008 - Subscription wins; paid entry is `shadowed` or `paid-fallback-not-allowed`

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-2, DM-2, DM-7
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-chain-resolution.test.ts`, `tests/fixtures/provider/config/subscription-first.yaml`
**Tags**: @backend

**Preconditions**:
- A subscription entry and a later pay-per-token entry are both eligible; `allowPaidFallback` is `true` in one fixture and `false` in another.
- Both entries have clear peak/quota conditions.

**Steps**:
1. Resolve the allowed-fallback fixture; assert the subscription entry is selected and the paid entry is reported `shadowed`, not `paid-fallback-not-allowed`.
2. Resolve the disabled-fallback fixture; assert the paid entry is reported `paid-fallback-not-allowed`.
3. Assert no paid transport/credential work is performed, and a disabled subscription entry lets the paid entry be selected only when fallback is allowed.
4. Assert both decisions are deterministic across repeated runs.

**Expected Outcome**:
- Then a later eligible paid entry is `shadowed` when fallback is allowed or `paid-fallback-not-allowed` when disabled; it never displaces an eligible subscription entry.

#### TC-PROV-009 - Chain-exhausted park and announcement

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-5, F-6, AC-F2-3, AC-F5-6, DM-7, DM-10
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-chain-resolution.test.ts`, `tests/behaviour/provider-parks.test.ts`, `tests/fixtures/provider/config/all-parked.yaml`
**Tags**: @backend

**Preconditions**:
- Every chain entry is parked with a future provider expiry; the earliest is recorded independently in the fixture.
- A recording state store is injected.

**Steps**:
1. Resolve the chain; assert the decision is `parked` with park name `chain:<name>` and cause `chain-exhausted`.
2. Assert the chain park expiry equals the earliest contributing provider expiry and is strictly future.
3. Assert a `provider.chain.exhausted` warning announcement is produced exactly once and persisted.
4. In a temp copy, remove all contributing future expiries; assert the engine fails loud with a classified provider failure rather than fabricating an expiry.

**Expected Outcome**:
- Then chain exhaustion becomes a named park with the earliest honest resume time and a single announcement, never an empty success or fabricated expiry.

#### TC-PROV-010 - Peak park shadows paid entry; no paid substitution

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-3, AC-F2-4, AC-F2-5, DM-2, DM-6, DM-7
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-chain-resolution.test.ts`, `tests/fixtures/provider/config/peak-substitution.yaml`
**Tags**: @backend

**Preconditions**:
- A subscription entry is parked for `peak-window`; a later pay-per-token entry is eligible; `allowPaidFallback` is `true`.
- The peak-parked subscription is the determining entry that supplies the chain park's earliest expiry.

**Steps**:
1. Resolve the chain; assert no paid entry is selected and the chain/decision is parked at the peak-window end.
2. Assert the later eligible paid entry is reported exactly `shadowed`, because fallback is not disabled and the peak-parked subscription is the determining entry.
3. Assert `paid-fallback-not-allowed` is not used in this case; assert the peak entry carries cause `peak-window`.
4. Assert no paid credential fetch or quota request occurs.

**Expected Outcome**:
- Then a peak-window park never permits paid substitution even when fallback is enabled, the paid entry is `shadowed` rather than `paid-fallback-not-allowed`, and the resume time is the peak end.

#### TC-PROV-011 - Peak boundary and buffer matrix

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1, DM-3
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-peak-window.test.ts`, `tests/fixtures/provider/config/peak-zai.yaml`
**Tags**: @backend

**Preconditions**:
- The fixture declares start `06:00` UTC, end `10:00` UTC, buffer `7200` seconds, timezone `UTC`.
- The clock is injected at the four boundary instants.

**Steps**:
1. Evaluate at `03:59:59`; assert clear.
2. Evaluate at `04:00:00`; assert parked with wait to `10:00`.
3. Evaluate at `09:59:59`; assert parked with a one-second wait.
4. Evaluate at `10:00:00`; assert clear (half-open window).
5. Assert a buffer that starts before midnight clamps to the day boundary and never yields a negative wait.

**Expected Outcome**:
- Then the effective window is exactly `[max(0, start-buffer), end)` and all four boundary instants behave as specified.

#### TC-PROV-012 - Custom peak window is declarative

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-2, DM-3, NFR-1
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-peak-window.test.ts`, `tests/fixtures/provider/config/peak-custom.yaml`
**Tags**: @backend

**Preconditions**:
- A custom window declares values different from the shipped Z.AI window.
- The evaluator source is available for a constant scan.

**Steps**:
1. Evaluate the custom window at its boundaries; assert the declared start/end/buffer are used.
2. Scan the evaluator source for hardcoded `21600`, `36000`, `7200`, or a Z.AI-specific branch; assert none exists.
3. Change only the fixture values and assert the result changes accordingly.
4. Assert the evaluation is pure over the injected clock and descriptor data.

**Expected Outcome**:
- Then custom windows are fully declarative and no vendor-specific values are hardcoded in the evaluator.

#### TC-PROV-013 - Peak and quota combine by MAX

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-4, F-5, AC-F3-4, DM-3, DM-8, DM-10
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-peak-window.test.ts`, `tests/behaviour/provider-quota-evaluation.test.ts`, `tests/fixtures/provider/quota/peak-plus-quota.json`
**Tags**: @backend

**Preconditions**:
- Peak wait is `21000` seconds and quota wait is `30000` seconds from the same injected now.
- Both conditions are active.

**Steps**:
1. Evaluate both conditions; assert the combined wait is `30000` (MAX), not the sum or the first.
2. Assert the park lists both condition kinds and the cause is `quota-exhausted`, the condition determining the later expiry.
3. Assert the expiry is the later of the two absolute expiries.
4. Swap the waits in a temp fixture; assert the cause and expiry follow the later condition, respecting the fixed tie order.

**Expected Outcome**:
- Then MAX wins, both condition kinds are visible, and the single cause is the one determining the expiry.

#### TC-PROV-014 - Exhausted TOKENS_LIMIT with valid reset

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, F-5, AC-F4-1, DM-4, DM-9, DM-10
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-quota-evaluation.test.ts`, `tests/fixtures/provider/quota/exhausted-valid-reset.json`
**Tags**: @backend

**Preconditions**:
- A `TOKENS_LIMIT` entry has percentage exactly `100` and a future `nextResetTime` in epoch milliseconds.
- A fixed clock is injected.

**Steps**:
1. Evaluate the snapshot; assert the condition is `quota-exhausted`.
2. Assert the wait equals `reset - now` and the park expiry equals the reset instant.
3. Assert a `provider.quota.parked` informational announcement is produced.
4. Assert no raw body is retained in the snapshot; only normalized limits.

**Expected Outcome**:
- Then an exhausted limit with a valid reset produces the exact wait/expiry and an informational park announcement.

#### TC-PROV-015 - Both limits exhausted: soonest reset

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-2, DM-9
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-quota-evaluation.test.ts`, `tests/fixtures/provider/quota/both-exhausted.json`
**Tags**: @backend

**Preconditions**:
- Two `TOKENS_LIMIT` entries are exhausted with different future resets.
- The fixture records the earlier reset independently.

**Steps**:
1. Evaluate; assert both entries are considered exhausted.
2. Assert the soonest reset wins and determines the wait/expiry.
3. Reorder the limits in a temp fixture; assert the same reset wins.
4. Assert `TIME_LIMIT` entries do not participate.

**Expected Outcome**:
- Then the soonest valid reset among exhausted TOKENS_LIMIT entries is selected deterministically.

#### TC-PROV-016 - TIME_LIMIT is ignored

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-2, DM-9
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-quota-evaluation.test.ts`, `tests/fixtures/provider/quota/time-limit-only.json`
**Tags**: @backend

**Preconditions**:
- A `TIME_LIMIT` entry is at `100%` and earlier than the token reset; all `TOKENS_LIMIT` entries are below threshold.

**Steps**:
1. Evaluate; assert `TIME_LIMIT` is filtered out.
2. Assert the condition is clear because no `TOKENS_LIMIT` is exhausted.
3. Assert no quota park or outage announcement is produced.
4. Add an exhausted `TOKENS_LIMIT` in a temp fixture; assert it now drives the wait.

**Expected Outcome**:
- Then `TIME_LIMIT` never causes a quota park and only TOKENS_LIMIT entries drive exhaustion.

#### TC-PROV-017 - Percentage exactly 100 and above 100

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-2, DM-9
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-quota-evaluation.test.ts`, `tests/fixtures/provider/quota/pct-99.json`, `pct-100.json`, `pct-105.json`
**Tags**: @backend

**Preconditions**:
- Three `TOKENS_LIMIT` fixtures use percentages `99`, `100`, and `105` with valid future resets.
- The configured threshold is `100`.

**Steps**:
1. Evaluate `99`; assert clear.
2. Evaluate `100`; assert exhausted.
3. Evaluate `105`; assert exhausted.
4. Assert no fractional/negative percentage is treated as exhausted; a non-integer percentage is a malformed input handled by TC-PROV-027.

**Expected Outcome**:
- Then the threshold is inclusive at 100 and any percentage above 100 is exhausted; 99 remains clear.

#### TC-PROV-018 - Past reset clamps to zero and does not park

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-2, DM-9
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-quota-evaluation.test.ts`, `tests/fixtures/provider/quota/past-reset.json`
**Tags**: @backend

**Preconditions**:
- An exhausted `TOKENS_LIMIT` has a `nextResetTime` strictly before the injected now.

**Steps**:
1. Evaluate; assert the computed wait clamps to zero.
2. Assert no park is created with a past expiry and no quota-wait announcement is emitted.
3. Assert the snapshot retains the reset value but the condition does not produce a negative wait.
4. Repeat with a reset exactly equal to now; assert the same zero-wait clamp.

**Expected Outcome**:
- Then a past reset yields zero wait and does not park, and no negative/past expiry is fabricated.

#### TC-PROV-019 - Mixed valid and invalid resets use the valid one

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-2, DM-9
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-quota-evaluation.test.ts`, `tests/fixtures/provider/quota/mixed-reset.json`
**Tags**: @backend

**Preconditions**:
- One exhausted token limit has a non-numeric reset; another exhausted token limit has a valid future reset.

**Steps**:
1. Evaluate; assert the malformed reset is ignored for expiry selection.
2. Assert the wait/expiry come from the valid reset, not a fabricated value.
3. Assert no `provider.quota.reset_missing` is emitted while a valid reset exists.
4. Swap which limit is malformed; assert the same valid-reset outcome.

**Expected Outcome**:
- Then a mixed snapshot uses the valid reset and does not fail or fabricate when at least one exhausted limit has a valid future reset.

#### TC-PROV-020 - Non-exhausted earlier reset is ignored

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-2, DM-9
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-quota-evaluation.test.ts`, `tests/fixtures/provider/quota/non-exhausted-earlier.json`
**Tags**: @backend

**Preconditions**:
- An exhausted token limit resets later; a non-exhausted token limit resets earlier.

**Steps**:
1. Evaluate; assert only exhausted limits are candidates for the reset.
2. Assert the later reset from the exhausted limit wins, despite the earlier non-exhausted reset.
3. Assert the non-exhausted limit does not contribute an expiry.
4. Reorder the limits; assert the same result.

**Expected Outcome**:
- Then earlier resets on non-exhausted limits are ignored, and only exhausted valid resets determine the wait.

#### TC-PROV-021 - Clear condition produces no outage artifact

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-3, DM-8, DM-9
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-quota-evaluation.test.ts`, `tests/fixtures/provider/quota/clear-no-tokens.json`, `clear-below-threshold.json`
**Tags**: @backend

**Preconditions**:
- One fixture has no `TOKENS_LIMIT`; another has only below-threshold token limits.

**Steps**:
1. Evaluate each fixture; assert the condition is clear.
2. Assert zero outage announcements and zero quarantine/outage parks.
3. Assert no quota park is created and no state record is written for the clear condition.
4. Assert the snapshot is still normalized and secret-free.

**Expected Outcome**:
- Then clear quota yields no announcement or park, and clear is distinct from an indeterminate verdict.

#### TC-PROV-022 - Exhausted without valid reset fails loud

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, F-6, F-9, AC-F4-4, DM-9, NFR-7
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-quota-evaluation.test.ts`, `tests/behaviour/provider-cli.test.ts`, `tests/fixtures/provider/quota/reset-absent.json`, `reset-malformed.json`, `reset-null.json`
**Tags**: @backend

**Preconditions**:
- Three exhausted token-limit fixtures: reset absent, reset non-numeric, reset null.
- A recording state store and CLI error stream are available.

**Steps**:
1. Evaluate each fixture; assert no expiry is fabricated and no park is created.
2. Assert the classified identity is `provider.quota.exceeded`: transient, retryable, exit `2`.
3. Assert the safe summary/diagnostic carries `provider.quota.reset_missing` and names the provider and failure class.
4. Assert zero state park/announcement records are written, and the diagnostic contains no raw body or secret.

**Expected Outcome**:
- Then an exhausted limit with no valid reset is a classified, retryable failure with a visible announcement code and no fabricated park/expiry.

#### TC-PROV-023 - Fresh re-evaluation and completed-sleep cap park

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, F-6, AC-F4-5, DM-13, NFR-6
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-quota-evaluation.test.ts`, `tests/behaviour/provider-parks.test.ts`, `tests/fixtures/provider/quota/sequence-*.json`
**Tags**: @backend

**Preconditions**:
- A sequence transport returns exhausted with a `7200` wait, then clear.
- A second scenario keeps the condition exhausted with a fixed clock and `maxSleepLoops: N` (test both `N=1` and a larger `N`).
- The sleep seam records durations without sleeping and counts completed sleeps.

**Steps**:
1. Run the re-evaluation driver; assert the first iteration sleeps `7200` and the next iteration performs a fresh fetch (2 transport calls, no cache).
2. Assert a clear result returns without another park.
3. Run the fixed-clock cap scenario; assert exactly `N` completed sleeps, then `provider.reevaluation.cap` and a `reevaluation-cap` park with expiry `now + capParkTtlSeconds`.
4. Assert cap-park creation consumes no additional iteration and no further quota fetch occurs after the Nth sleep; the driver never proceeds as clear.

**Expected Outcome**:
- Then every iteration fetches fresh, MAX is honored, and the cap is counted in completed sleeps: exactly N sleeps, no post-cap fetch, no extra iteration for the park.

#### TC-PROV-024 - Transport failure or timeout is announced

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, F-6, F-7, F-9, AC-F4-6, AC-F7-4, DM-9
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-quota-evaluation.test.ts`, `tests/behaviour/provider-announcements.test.ts`, `tests/fixtures/provider/quota/transport-failure.ts`
**Tags**: @backend

**Preconditions**:
- The injected transport throws a transport error and, separately, a timeout is simulated.
- `resolve` persists parks; `quota` is non-mutating and returns classified errors.

**Steps**:
1. Resolve; assert a `provider-outage` park with a future outage-TTL expiry.
2. Assert exactly one warning announcement with code `provider.quota.unreachable`.
3. Run `quota`; assert `provider.outage` (transient, retryable, exit `2`) and a safe diagnostic; assert no state write.
4. Assert the outcome is never clear and no raw error/body/credential is emitted.

**Expected Outcome**:
- Then transport failure/timeout is a visible outage park or classified error with the matching announcement, never a silent clear.

#### TC-PROV-025 - HTTP 401/403 is credential rejection

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, F-6, F-7, F-9, AC-F4-6, AC-F7-4, DM-9
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-quota-evaluation.test.ts`, `tests/behaviour/provider-credentials.test.ts`, `tests/fixtures/provider/quota/http-401.ts`, `http-403.ts`
**Tags**: @backend

**Preconditions**:
- The transport returns HTTP 401 and, separately, 403 with an empty body.
- A credential canary is supplied through the port.

**Steps**:
1. Resolve; assert a `credential-rejected` park with the credential-park TTL and cause `credential-rejected`.
2. Assert exactly one `provider.quota.auth_rejected` warning announcement.
3. Run `quota`; assert `provider.auth.rejected` (user, non-retryable, exit `1`) and a safe diagnostic; assert no retry.
4. Assert no credential material or header appears in the park, announcement, envelope, or diagnostic.

**Expected Outcome**:
- Then 401/403 is user-fixable credential rejection with a credential-rejected park/announcement and no retry or leak.

#### TC-PROV-026 - Non-auth HTTP failure is an outage

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, F-6, F-7, F-9, AC-F4-6, AC-F7-4, DM-9
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-quota-evaluation.test.ts`, `tests/fixtures/provider/quota/http-500.ts`, `http-429.ts`, `http-302.ts`
**Tags**: @backend

**Preconditions**:
- The transport returns non-auth HTTP failures: 500, 429, and a redirect that is not followed with credentials.

**Steps**:
1. Resolve each fixture; assert a `provider-outage` park with a future outage-TTL expiry.
2. Assert exactly one `provider.quota.http_error` warning per failure; no auth-rejected park.
3. Run `quota`; assert `provider.outage` (transient, retryable, exit `2`) and a safe diagnostic.
4. Assert the HTTP status may appear in evidence but the raw body, URL userinfo, and authorization header do not.

**Expected Outcome**:
- Then non-auth HTTP failures are outages, not credential rejections or silent clears.

#### TC-PROV-027 - Malformed JSON, envelope, limits, percentage

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-6, DM-9
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-quota-evaluation.test.ts`, `tests/fixtures/provider/quota/malformed-*.json`
**Tags**: @backend

**Preconditions**:
- Fixtures: malformed JSON, envelope code not 200, envelope success false, limits absent, limits non-array, non-numeric percentage.
- The injected transport returns these as sanitized body strings.

**Steps**:
1. For each fixture in `resolve`, assert exactly one `provider.quota.malformed` warning and a `provider-outage` park (or classified outage when no park is possible).
2. In `quota`, assert `provider.outage` (transient, retryable, exit `2`) with a safe diagnostic naming the provider.
3. Assert no case returns clear and no raw body is retained or echoed.
4. Mutation: make one malformed case return a clear snapshot; assert the no-silent-path test fails naming the class.

**Expected Outcome**:
- Then every malformed class is announced/parked or classified, with exactly one matching announcement and no silent clear.

#### TC-PROV-028 - Park record shape, allowlist, and `provider-parks.json` round-trip

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1, DM-10, DM-12, EVT-1, NFR-5
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-parks.test.ts`, `tests/fixtures/provider/parks/park-active.json`, `tests/fixtures/provider/parks/provider-parks.json`, `tests/fixtures/provider/evidence/park-allowlist.json`
**Tags**: @backend

**Preconditions**:
- A non-clear condition produces a park through a fixture state store.
- The expected park shape and the eight-field park evidence allowlist are recorded independently as fixtures.

**Steps**:
1. Persist the park; assert name, subject, closed cause, active conditions, creation time, absolute future expiry, and bounded evidence.
2. Assert the evidence keys are exactly the eight park allowlist fields (`providerName`, `chainName`, `conditionKinds`, `waitSeconds`, `resetEpochMs`, `httpStatus`, `failureClass`, `credentialRefName`); assert no extra key, raw body, auth header, credential value, or userinfo.
3. Read the record back through the state layer; assert deep equality with the persisted payload and schema `delivery.provider.park.v1`.
4. Assert the record kind is `provider.park`, the park name is `provider:<name>` or `chain:<name>`, and the `provider-parks.json` derived document folds the latest record by park name.
5. In a temp copy, remove the expiry or add an unknown evidence key; assert the state/contract test rejects it by field.

**Expected Outcome**:
- Then every park has the declared shape and closed allowlist, round-trips through the state layer unchanged, and appears in the `provider-parks.json` projection.

#### TC-PROV-029 - Exact-expiry inactivity with no write

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-2, DM-10, DM-12, NFR-7
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-parks.test.ts`, `tests/fixtures/provider/parks/park-expiry-boundary.json`
**Tags**: @backend

**Preconditions**:
- An active park has an absolute expiry `T`; the injected clock can be set to `T-1`, `T`, and `T+1`.

**Steps**:
1. At `T-1`, assert the park is active and appears in default `parks list`.
2. At exactly `T`, assert the park is inactive/expired and does not appear by default.
3. Assert no delete or expiry write occurred; the ledger still contains the original record.
4. Run `parks list --all`; assert the park appears as expired with the ISO-8601 UTC expiry.

**Expected Outcome**:
- Then a park is inactive exactly at `expiresAt`, expiry is derived at read time, and no write/delete is required.

#### TC-PROV-030 - Dedupe, refresh, clear, and projection rebuild

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, F-6, AC-F5-3, DM-10, DM-11, DM-12, NFR-6
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-parks.test.ts`, `tests/behaviour/provider-announcements.test.ts`, `tests/fixtures/provider/parks/park-generations.json`, `tests/fixtures/provider/parks/provider-parks.json`
**Tags**: @backend

**Preconditions**:
- An active park is re-evaluated repeatedly with unchanged cause/expiry.
- A changed-cause/changed-expiry fixture, a clear fixture, and a torn/missing `provider-parks.json` fixture exist.

**Steps**:
1. Re-evaluate the unchanged park three times; assert zero new park records and zero new announcement records.
2. Change the cause; assert one new park record and the latest record wins in the `provider-parks.json` fold.
3. Observe the park clear before expiry; assert a `cleared` record is appended and one `provider.resumed` informational announcement is emitted.
4. Delete or corrupt `provider-parks.json`; assert the next read rebuilds it from verified ledger truth with no separate rebuild CLI and no extra ledger append.
5. Re-evaluate after the clear; assert no duplicate clear/resume record.

**Expected Outcome**:
- Then unchanged generations are deduplicated, changed generations append one new record, clears/resumes happen exactly once, and the projection rebuilds from ledger truth on read.

#### TC-PROV-031 - Park is distinct from a blocked lane; projection record

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-4, DM-10, DM-12
**Test Type(s)**: Contract, Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/provider-contract.test.ts`, `tests/behaviour/provider-parks.test.ts`, `tests/fixtures/provider/parks/park-vs-lane.json`, `tests/fixtures/provider/parks/provider-parks.json`
**Tags**: @backend

**Preconditions**:
- A provider park fixture and a blocked-lane fixture are available from the delivered state/queue vocabulary.
- The contract inventory includes the provider record kinds separately from lane records.

**Steps**:
1. Assert the park record kind and state are distinct from the blocked-lane record kind/state.
2. Assert the park always carries a resume time and a provider/chain subject; assert `provider-parks.json` records only provider/chain parks.
3. Assert no `provider-parks.json` field reports a lane as blocked, and no lane readiness field is derived from a park.
4. Assert the projection is rebuilt on read from verified ledger truth when missing/divergent, with no separate rebuild CLI.
5. In a temp copy, merge the record kinds or drop the resume time; assert the contract test fails.

**Expected Outcome**:
- Then parks and blocked lanes remain distinct in the ledger and in `provider-parks.json`, and a park always describes provider availability with a resume time.

#### TC-PROV-032 - Parks list reads `provider-parks.json`; ordering/filters

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, F-8, AC-F5-5, DM-12, NFR-6
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-parks.test.ts`, `tests/fixtures/provider/parks/list-matrix.json`, `tests/fixtures/provider/parks/provider-parks.json`
**Tags**: @backend

**Preconditions**:
- A `provider-parks.json` projection contains active, expired, and cleared parks with varied expiries and subjects.
- A recording state store and a throwing network guard are injected.

**Steps**:
1. Run `parks list`; assert it reads `provider-parks.json` and active parks are sorted by expiry ascending then name lexical.
2. Run `parks list --provider <name>`; assert only that subject's parks are returned.
3. Run `parks list --all`; assert expired and cleared entries appear with the documented state.
4. Delete/corrupt `provider-parks.json`; assert the read rebuilds it from verified ledger truth on demand and no separate rebuild CLI exists.
5. Assert the command performs no network call and no state mutation; the ledger record count is unchanged.

**Expected Outcome**:
- Then the list view is deterministic, filterable, complete under `--all`, rebuilds on read, and is strictly read-only.

#### TC-PROV-033 - Cap/chain expiry and projection rebuild

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-6, DM-10, DM-13, NFR-7
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-parks.test.ts`, `tests/fixtures/provider/parks/cap-and-chain.json`, `tests/fixtures/provider/parks/provider-parks.json`
**Tags**: @backend

**Preconditions**:
- A `reevaluation-cap` outcome uses `capParkTtlSeconds`; a `chain-exhausted` outcome uses the earliest contributing provider expiry.
- Both creation times are fixed by the injected clock.

**Steps**:
1. Persist a cap park; assert `expiresAt = now + capParkTtlSeconds` and strictly greater than creation.
2. Persist a chain park; assert its expiry equals the earliest contributing provider expiry and is strictly future.
3. Assert no cap/chain park is created with a past or absent expiry; assert invalid cap TTL (`0`) fails validation.
4. Assert the cap/chain parks appear in `provider-parks.json`; delete the projection and assert it rebuilds from verified ledger truth on read with no separate CLI.
5. At the exact expiry, assert the park is inactive without a write.

**Expected Outcome**:
- Then cap and chain parks always carry an honest absolute future expiry, appear in the rebuilt projection, and expire by read-time derivation.

#### TC-PROV-034 - Announcement shape, closed allowlist, severity, identity

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-1, DM-11, NFR-4, NFR-5
**Test Type(s)**: Contract, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-announcements.test.ts`, `tests/fixtures/provider/announcements/matrix.json`, `tests/fixtures/provider/evidence/announcement-allowlist.json`
**Tags**: @backend

**Preconditions**:
- The closed announcement set is known: `provider.peak.parked`, `provider.quota.parked`, `provider.quota.reset_missing`, `provider.quota.unreachable`, `provider.quota.http_error`, `provider.quota.auth_rejected`, `provider.quota.malformed`, `provider.credential.missing`, `provider.chain.exhausted`, `provider.reevaluation.cap`, `provider.resumed`.
- Severity mapping is known: peak/parked, quota/parked, and resumed are informational; the rest are warnings.
- The announcement evidence allowlist is the eight base fields plus `parkName`, `parkExpiresAt`, and `announcementCode` (max eleven).

**Steps**:
1. For every code, assert the announcement carries a closed code, the declared severity, a subject, and the applicable cause/conditions/park/expiry.
2. Assert evidence keys are a subset of the eleven-field announcement allowlist, with no unknown key; assert no raw provider body, authorization header, credential value, or endpoint userinfo.
3. Assert the message is a safe template naming only provider/condition/resume time; no secret/header/raw body.
4. Assert identity is deterministic from subject + code + park generation across repeated runs.
5. Re-evaluate an unchanged generation; assert exactly one announcement; mutate the generation; assert one new announcement.

**Expected Outcome**:
- Then every announcement has the closed shape/severity, only allowlisted evidence, and a deterministic identity with exactly one record per generation.

#### TC-PROV-035 - Skipped-entry outage stays visible

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-6, AC-F6-2, DM-7, DM-10, DM-11
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-chain-resolution.test.ts`, `tests/behaviour/provider-announcements.test.ts`, `tests/fixtures/provider/config/skipped-outage.yaml`
**Tags**: @backend

**Preconditions**:
- Subscription entry A has an unreachable quota endpoint; later subscription entry B is eligible.
- A recording state store is injected.

**Steps**:
1. Resolve; assert entry B is selected and entry A is reported with skip reason `provider-outage`.
2. Assert A is parked with cause `provider-outage` and announced with `provider.quota.unreachable`.
3. Assert the result lists both the selected and skipped entries and both the selected decision and A's park.
4. Assert the outage is visible even though the chain succeeded; no announcement is suppressed.

**Expected Outcome**:
- Then a skipped entry's outage remains parked and announced, and success on another entry never hides it.

#### TC-PROV-036 - Announcements on resolve/quota surfaces

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, F-8, AC-F6-3, DM-11
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-cli.test.ts`, `tests/golden/provider-announcement-surfaces.test.ts`
**Tags**: @backend

**Preconditions**:
- `resolve --json` can produce a park/warning; `quota` can succeed or fail.
- stdout and stderr are captured separately.

**Steps**:
1. Run `resolve --json` with a warning; assert announcements appear under `data.announcements` and the warning text appears on stderr, not inside the JSON envelope.
2. Run a successful `quota --json`; assert per-provider announcements appear under `data.announcements`.
3. Run a failing `quota`; assert the classified error identity, the announcement code in the safe summary, and a safe stderr diagnostic.
4. Assert no execution path returns a clear verdict when the condition is indeterminate.

**Expected Outcome**:
- Then announcements are visible on the declared surfaces, warnings stay on the diagnostics stream, and no failure is silently reported as clear.

#### TC-PROV-037 - Legacy fail-open is replaced by fail-loud

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-4, AC-F4-6, NFR-9
**Test Type(s)**: Regression, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-legacy-parity.test.ts`, `tests/fixtures/provider/legacy/fail-open-matrix.ts`
**Tags**: @backend

**Preconditions**:
- Every legacy fail-open class is represented: transport, 401/403, non-200, malformed JSON, invalid envelope, absent/non-array limits, non-numeric percentage, exhausted with missing/malformed reset.
- The legacy behavior is recorded as a comparison fixture, not executed from bash.

**Steps**:
1. Drive each class through `resolve` and `quota` with injected fakes.
2. Assert each outcome is an announcement plus a park or a classified error; assert zero classes return a silent clear.
3. Assert the announcement/error code matches Appendix C for the class.
4. Assert the legacy "WARN + proceed" outcome is not reproduced.

**Expected Outcome**:
- Then every legacy fail-open class is assertably replaced by fail-loud behavior with the matching code.

#### TC-PROV-038 - Credential-port-only resolution

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-1, DM-5, NFR-3, NFR-4
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-credentials.test.ts`, `tests/checks/secret-read-boundary.test.ts`, `scripts/checks/secret-read-boundary.ts`, `tests/fixtures/provider/security/credential-port-recording.ts`
**Tags**: @backend

**Preconditions**:
- A recording `CredentialPort` returns a canary material for the declared reference.
- A recording quota transport captures the authorization header/material use.
- No ambient environment read is available in core.

**Steps**:
1. Evaluate quota; assert the port is called exactly once with the declared reference and the transport receives the material once for one request.
2. Assert no client/engine instance stores the material after the request; a second evaluation resolves again rather than using a cache.
3. Assert the credential is not read from `process.env`/`Bun.env`/any ambient global; the secret-read boundary remains green with zero new allowlist entries.
4. Assert no secret appears in the returned snapshot, park, announcement, or diagnostic.

**Expected Outcome**:
- Then quota authorization flows only through the credential port, used once per request, and no ambient read or cache exists.

#### TC-PROV-039 - Missing credential parks and names the cause

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, F-9, AC-F7-2, DM-5, DM-10
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-credentials.test.ts`, `tests/fixtures/provider/security/credential-missing.ts`
**Tags**: @backend

**Preconditions**:
- The credential port returns `config.credential.missing` for the declared reference.
- A recording quota transport proves no fetch occurs.

**Steps**:
1. Evaluate; assert the transport is never called.
2. Assert a `credential-missing` park with the credential-park TTL and cause `credential-missing`.
3. Assert exactly one `provider.credential.missing` warning announcement and park evidence whose `failureClass` is exactly `config.credential.missing`; assert `credentialRefName` is the reference name only.
4. Assert the evidence keys stay within the closed park/announcement allowlists and no extra key is present; assert a chain may continue to a later eligible entry of the same cost class, or park as chain-exhausted; no secret is emitted.

**Expected Outcome**:
- Then an unresolvable credential is a named park/announcement with `failureClass = config.credential.missing`, no fetch, and the chain continues only through eligible entries.

#### TC-PROV-040 - Planted canary and closed allowlists never leak

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-3, NFR-4, DM-10, DM-11
**Test Type(s)**: Integration, Static
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-credentials.test.ts`, `tests/fixtures/provider/security/canary.ts`, `tests/fixtures/provider/evidence/park-allowlist.json`, `tests/fixtures/provider/evidence/announcement-allowlist.json`
**Tags**: @backend

**Preconditions**:
- A unique credential canary is supplied through the injected port; a raw-body canary is supplied in the quota response.
- Capture sinks cover envelope data, diagnostics, park records, announcement records, and `provider-parks.json`.
- The closed park (8) and announcement (11) evidence allowlists are recorded.

**Steps**:
1. Run selected, parked, outage, credential-missing, and rejected cases.
2. Scan every captured surface for the credential canary and the raw-body canary in raw and JSON-escaped/backslash forms.
3. Assert park/announcement evidence keys are subsets of the closed allowlists; assert no authorization header, URL userinfo, credential value, or raw response body is retained.
4. In a temp copy, echo the canary into an allowlisted evidence field or add an unknown evidence key; assert the scan/allowlist test fails naming the surface.

**Expected Outcome**:
- Then a planted credential/raw-body canary is never observable on any declared surface, only allowlisted evidence keys survive, and a leak is detectable.

#### TC-PROV-041 - `resolve` machine and human output

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-1, DM-7, DM-11
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-cli.test.ts`, `tests/golden/provider-resolve.test.ts`
**Tags**: @backend

**Preconditions**:
- `resolve` can select an entry or park a chain.
- `--json` output and human output are captured separately.

**Steps**:
1. Run `resolve --json`; assert exactly one valid CommandResult envelope, exit `0`, and data contains the decision, skipped entries, active parks, and announcements.
2. Run the parked case; assert the envelope carries the chain park and announcement.
3. Run human mode; assert it prints the selected provider or the park's cause and resume time; warnings go to stderr.
4. Assert no invalid envelope, no duplicate document, and no secret/raw body.

**Expected Outcome**:
- Then `resolve` returns one valid machine envelope or a truthful human summary with the required decision fields.

#### TC-PROV-042 - `quota` is non-mutating and classified

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, F-9, AC-F8-2, DM-8
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-cli.test.ts`, `tests/golden/provider-quota.test.ts`
**Tags**: @backend

**Preconditions**:
- `quota` evaluates one provider or the default chain with injected fakes.
- A recording state store is available.

**Steps**:
1. Run `quota --json`; assert per-provider state, active conditions, resume time, and announcements.
2. Assert zero state writes/parks are persisted.
3. Run the failure cases (transport/auth/malformed/credential); assert the classified provider error and projected exit code.
4. Assert the success/failure envelopes are valid and no secret/raw body appears.

**Expected Outcome**:
- Then `quota` is a non-mutating diagnostic with truthful state and classified failures.

#### TC-PROV-043 - `parks list` view, `provider-parks.json`, and filters

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-3, DM-12, NFR-6
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-cli.test.ts`, `tests/golden/provider-parks-list.test.ts`, `tests/fixtures/provider/parks/provider-parks.json`
**Tags**: @backend

**Preconditions**:
- `provider-parks.json` contains active, expired, and cleared parks.
- A throwing network guard and a recording state store are injected.

**Steps**:
1. Run `parks list`; assert it reads `provider-parks.json`, returns only active parks, and sorts deterministically.
2. Run `--all`; assert expired/cleared entries appear with documented state.
3. Run `--provider <name>`; assert subject filtering.
4. Delete/corrupt `provider-parks.json`; assert the read rebuilds it from verified ledger truth with no separate rebuild CLI.
5. Assert no network call, no ledger append, and no mutation of the projection.

**Expected Outcome**:
- Then `parks list` returns the documented view from `provider-parks.json`, rebuilds on read, and has zero side effects.

#### TC-PROV-044 - Invalid provider flags fail classified

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, F-9, AC-F8-4
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-cli.test.ts`, `tests/fixtures/provider/cli/invalid-flags.ts`
**Tags**: @backend

**Preconditions**:
- Cases: unknown `--chain`, unknown `--provider`, unknown subcommand, missing value, and an invalid boolean value.

**Steps**:
1. Run each case; assert a classified input or provider-configuration error, never a crash.
2. Assert the output is a valid CommandResult envelope with the projected exit code.
3. Assert no state write, transport call, or credential resolution occurs.
4. Assert the diagnostic names the offending flag/value and the next action.

**Expected Outcome**:
- Then every invalid flag is a classified failure with a valid envelope and no side effects.

#### TC-PROV-045 - Bidirectional error-table sync

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, AC-F9-1, NFR-8
**Test Type(s)**: Contract, Static
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/error-table-sync.test.ts`, `tests/structure/error-table.test.ts`, `scripts/checks/error-table-sync.ts`, `doc/spec/features/feature-result-contract.md`
**Tags**: @backend

**Preconditions**:
- The machine table is `packages/core/src/contracts/error-table.ts`; the documented table is in `doc/spec/features/feature-result-contract.md`.
- The new rows are `provider.chain.empty`, `provider.chain.invalid`, `provider.outage`, `provider.auth.rejected`; `provider.quota.exceeded` is retained.

**Steps**:
1. Run the sync check; assert zero failures and equal source/documented counts.
2. Assert each new row’s category, retryable flag, consequence, remediation hint, and projection match Appendix C.
3. Assert `provider.quota.exceeded` keeps its existing identity/fields.
4. In temp copies, add a machine-only row, a doc-only row, and a field mismatch; assert each fails naming the code; the live tree is unchanged.

**Expected Outcome**:
- Then the provider rows agree exactly in both directions and existing identities are unchanged.

#### TC-PROV-046 - Exact-code provider classification

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, AC-F9-2, NFR-8
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/error-classification.test.ts`, `tests/behaviour/provider-cli.test.ts`, `tests/fixtures/provider/security/classification-cases.ts`
**Tags**: @backend

**Preconditions**:
- The provider kind now has multiple rows; exact-code classification is required.
- Cases include each declared provider code, no code, an undeclared code, and a wrong-kind code.

**Steps**:
1. For each declared provider code, assert the classification resolves that exact row and projected exit.
2. For no code/undeclared/wrong-kind, assert containment as `fallback.internal`, never the first provider row by kind.
3. Assert existing non-provider classification (config/input/etc.) is unchanged.
4. In a temp copy, restore the kind-only provider shortcut; assert the classification test fails.

**Expected Outcome**:
- Then provider failures classify by exact code, and unclassified/wrong-kind failures contain to `fallback.internal`.

#### TC-PROV-047 - 100-run deterministic replay

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR-1, NFR-1, NFR-3
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-chain-resolution.test.ts`, `tests/behaviour/provider-parks.test.ts`, `tests/fixtures/provider/determinism/replay-case.json`
**Tags**: @backend

**Preconditions**:
- Identical configuration, injected clock, credential result, and quota snapshot are prepared.
- A replay harness can run the pure resolve/projection path 100 times in-process.

**Steps**:
1. Run 100 iterations; serialize each decision, park payload, and announcement identity.
2. Assert all 100 serializations are byte-identical.
3. Assert no ambient clock, randomness, locale, or environment value enters the output; change only an ambient value and assert the output is unchanged.
4. Change one injected fact; assert the output changes deterministically.

**Expected Outcome**:
- Then 100 replays are byte-identical and only injected facts affect the decision/records.

#### TC-PROV-048 - Hermetic suite guarantees

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR-2, NFR-2
**Test Type(s)**: Contract, Static
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/provider-hermetic.test.ts`, `tests/behaviour/provider-legacy-parity.test.ts`
**Tags**: @backend

**Preconditions**:
- A throwing `fetch` guard, a recording transport, an injected credential record, and a sleep spy are available.
- The provider suite is run under the repository test runner.

**Steps**:
1. Run the provider suite with the guards active; assert zero live network calls, zero ambient credential reads, and zero real sleeps.
2. Assert every HTTP path uses the injected transport; an unfixtured request throws instead of reaching the network.
3. Assert every sleep uses the injected seam and records its duration; the real timer is never called.
4. Assert the legacy battery file is not executed as a live script and no test references a real endpoint hostname.

**Expected Outcome**:
- Then the provider suite is hermetic by construction: 0 live network, 0 live credentials, 0 real sleeps.

#### TC-PROV-049 - Bounded closed-allowlist evidence and announcement list

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR-4, NFR-5, DM-10, DM-11
**Test Type(s)**: Contract, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/provider-evidence-bounds.test.ts`, `tests/fixtures/provider/evidence/max-evidence.json`, `over-bound-evidence.json`, `unknown-key-evidence.json`, `park-allowlist.json`, `announcement-allowlist.json`
**Tags**: @backend

**Preconditions**:
- Maximum allowed park/announcement evidence fixtures and an over-bound fixture exist.
- The closed park allowlist (8 fields) and announcement allowlist (8 base + 3 = 11 fields) are recorded.

**Steps**:
1. Serialize the maximum park and announcement fixtures; assert ≤ 1024 bytes and ≤ 20 fields.
2. Assert every park key is in the eight-field park allowlist and every announcement key is in the eleven-field announcement allowlist; assert no unknown key is admitted.
3. Assert the announcement list length is bounded by the number of evaluated entries (plus the declared chain outcome) and contains no raw provider body, auth header, credential value, or endpoint userinfo.
4. In a temp copy, add one byte/one field over the bound and an unknown allowlist key; assert the bounds/allowlist test fails.
5. Assert no unbounded array/object is admitted into evidence by the closed field contract.

**Expected Outcome**:
- Then evidence is bounded and closed to the declared allowlists, and an over-bound/unknown-key/raw-body payload is rejected by test.

#### TC-PROV-050 - Idempotent persistence and reads

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR-5, NFR-6, DM-10, DM-11
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-parks.test.ts`, `tests/behaviour/provider-cli.test.ts`
**Tags**: @backend

**Preconditions**:
- A recording state store counts appends; repeated commands use identical inputs.

**Steps**:
1. Run `resolve` once; assert the expected park/announcement records append.
2. Run `resolve` twice more with unchanged inputs; assert zero new records and zero state mutation.
3. Run `quota` repeatedly; assert zero state writes. Run `parks list` repeatedly; assert zero side effects and that a missing/divergent `provider-parks.json` rebuild adds no ledger records.
4. Change one condition and assert only the changed generation appends.

**Expected Outcome**:
- Then only the first unchanged resolve persists, repeated quota/list calls are truly read-only, and projection rebuild never appends truth.

#### TC-PROV-051 - 100-entry evaluation cost

**Scenario Type**: Performance
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-NFR-6, NFR-10, DM-8
**Test Type(s)**: Performance, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-quota-evaluation.test.ts`, `tests/fixtures/provider/performance/100-entries.json`
**Tags**: @perf, @backend

**Preconditions**:
- A chain of 100 provider entries with declared peak/quota conditions is prepared.
- Evaluation excludes transport time and uses a warmed pure function on the reference environment.

**Steps**:
1. Warm the evaluator; run the 100-entry evaluation repeatedly and take a stable measurement (median plus a bounded max).
2. Assert the pure evaluation completes in ≤ 50 ms excluding transport.
3. Assert the measurement is not dominated by fixture parsing or setup; parsing is outside the timed region.
4. Record the environment/runner and measurement in §10 when executed.

**Expected Outcome**:
- Then pure evaluation of 100 entries meets the ≤ 50 ms threshold without transport time.

#### TC-PROV-052 - No-silent-path matrix

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F6-4, AC-F4-6, NFR-9
**Test Type(s)**: Regression, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-legacy-parity.test.ts`, `tests/fixtures/provider/legacy/no-silent-paths.ts`
**Tags**: @backend

**Preconditions**:
- The matrix covers every failure class in §5.4: transport/timeout, 401, 403, non-200, malformed JSON, invalid envelope, absent/non-array limits, non-numeric percentage, exhausted missing/malformed reset, missing credential, loop cap, chain exhaustion, skipped-entry outage.
- A sentinel "silent clear" result is not an allowed outcome.

**Steps**:
1. Drive every class through `resolve` and `quota` with injected fakes.
2. Assert each class produces an announcement/park or a classified error, never a clear verdict.
3. Assert the matrix count equals the declared class count and every class has a named asserting TC.
4. Add a temp class that returns clear; assert the matrix fails naming the class.

**Expected Outcome**:
- Then every failure class is accounted for and no execution path silently returns clear.

#### TC-PROV-053 - Golden machine and human outputs

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F6-3, AC-F8-1, AC-F8-2, AC-F8-3
**Test Type(s)**: Golden, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/golden/provider-resolve.test.ts`, `provider-quota.test.ts`, `provider-parks-list.test.ts`, `tests/fixtures/provider/golden/**`
**Tags**: @backend

**Preconditions**:
- Committed golden fixtures exist for selected, parked, outage/skipped, quota success, quota failure, parks list active, and parks list `--all`.
- Each case has normalized machine JSON and human text, with injected clock/state.

**Steps**:
1. Run each case; compare the normalized machine envelope to the golden JSON.
2. Compare the human output to the golden text, ignoring only documented volatile fields after normalization.
3. Assert diagnostics are compared separately from stdout.
4. In a temp regeneration, change ordering/timestamps and assert the normalizer keeps the diff reviewable; a real behavior change must produce a reviewed diff.

**Expected Outcome**:
- Then machine and human outputs are pinned by reviewable, normalized golden fixtures for the declared cases.

#### TC-PROV-054 - Legacy parity group A (001..005)

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-1, AC-F3-2, NFR-9, Appendix A row TC-ZAI-001..005
**Test Type(s)**: Regression, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-legacy-parity.test.ts`, `tests/fixtures/provider/legacy/group-a.json`
**Tags**: @backend

**Preconditions**:
- The ported battery harness can select legacy subcases by `TC-ZAI-*` ID.
- Descriptor gating replaces the legacy model-string gate; the clock/sleep/transport seams are injected.

**Steps**:
1. Port TC-ZAI-001..005 as subcases; assert descriptor gating, off-peak clear, in-peak park, buffer park, and custom-window arithmetic match the recorded legacy boundaries.
2. Assert the v1 decision is a park/decision envelope, not a blocking sleep; the CLI never sleeps.
3. Assert the non-declared/disabled provider entry is not evaluated and no fetch occurs.
4. Assert the group asserts the intentional divergence: gating is by declared chain/descriptor, not a model string.

**Expected Outcome**:
- Then group A boundary math is preserved while gating and non-blocking behavior follow v1.

#### TC-PROV-055 - Legacy parity group B (010..020)

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F4-6, AC-F6-4, NFR-9, Appendix A row TC-ZAI-010..020
**Test Type(s)**: Regression, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-legacy-parity.test.ts`, `tests/fixtures/provider/legacy/group-b.ts`
**Tags**: @backend

**Preconditions**:
- Fixtures cover transport failure, 401, 403, non-200 envelope code, success=false, malformed JSON, absent/non-array limits, non-numeric percentage, invalid reset, mixed failures, and peak-active failure.
- Each ported subcase records the legacy warning class and the v1 expected code.

**Steps**:
1. Port TC-ZAI-010..020; for each, assert exactly one warning announcement with the matching code and a park or classified error.
2. Assert no subcase returns clear or reproduces the legacy "WARN + proceed" outcome.
3. Assert the peak-active failure case still applies the peak condition and parks/announces both.
4. Assert exactly one warning per failure class and no duplicate announcements.

**Expected Outcome**:
- Then every group B failure class is ported and every one asserts fail-loud divergence with exactly one matching announcement.

#### TC-PROV-056 - Legacy parity group B' (021..025)

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F4-6, AC-F7-2, NFR-9, Appendix A row TC-ZAI-021..025
**Test Type(s)**: Regression, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-legacy-parity.test.ts`, `tests/fixtures/provider/legacy/group-b-prime.ts`
**Tags**: @backend

**Preconditions**:
- Cases: key unset, opt-out, missing external tools, opt-out with peak active, and a declared credential that cannot resolve.
- A quota-disabled descriptor fixture and a missing-credential fixture exist.

**Steps**:
1. Port TC-ZAI-021..025; assert a quota-disabled descriptor is silent by design and performs no fetch.
2. Assert a declared credential that cannot resolve is a `credential-missing` park and `provider.credential.missing` announcement, not a silent opt-out.
3. Assert missing external tools map to the native transport outage path and never a silent clear.
4. Assert opt-out with peak active still produces the peak park/announcement.

**Expected Outcome**:
- Then opt-out remains silent only by declaration, missing credentials are loud, and peak still applies.

#### TC-PROV-057 - Legacy parity groups C/D (029..042)

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F4-2, AC-F4-4, AC-F4-6, NFR-9, Appendix A row TC-ZAI-029..042
**Test Type(s)**: Regression, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-legacy-parity.test.ts`, `tests/fixtures/provider/legacy/group-c-d.json`
**Tags**: @backend

**Preconditions**:
- Fixtures cover no TOKENS_LIMIT, below threshold, 5h/weekly exhaustion, both exhausted, TIME_LIMIT, 100 boundary, over 100, past reset, mixed reset, non-exhausted earlier reset, and peak+quota MAX.
- Each ported subcase has a recorded legacy wait and the v1 expected park/wait.

**Steps**:
1. Port TC-ZAI-029..042; assert the legacy wait math is preserved for every non-failure case.
2. Assert each park carries cause, conditions, and absolute expiry; assert the MAX cases name both conditions.
3. Assert exhausted-without-valid-reset diverges to a classified error and a `reset_missing` announcement.
4. Assert no subcase is silently treated as clear.

**Expected Outcome**:
- Then quota boundary math is preserved, parks are truthful, and the one intentional fail-loud divergence is asserted.

#### TC-PROV-058 - Legacy parity group E (045..046) and completed-sleep fetch

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F4-5, NFR-6, NFR-9, Appendix A row TC-ZAI-045..046
**Test Type(s)**: Regression, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-legacy-parity.test.ts`, `tests/fixtures/provider/legacy/group-e.ts`
**Tags**: @backend

**Preconditions**:
- A quota-disabled fixture and a no-cache/fresh-fetch sequence fixture exist.
- A recording transport counts fetches; the sleep seam counts completed sleeps; a temp directory is watched for cache artifacts.

**Steps**:
1. Port TC-ZAI-045; assert quota disabled performs no fetch and produces no park/announcement.
2. Port TC-ZAI-046; assert one fresh fetch per completed sleep and no file cache artifact.
3. Assert the loop cap counts completed sleeps (N = `maxSleepLoops`): after the Nth completed sleep there is no further fetch, and cap-park creation consumes no extra iteration.
4. Assert records are append-only and deduplicated rather than cached in a file; assert no cache knob or file-path dependency exists.

**Expected Outcome**:
- Then disabled quota, fresh-per-completed-sleep fetching, and the completed-sleep cap accounting are preserved, with append-only dedupe instead of a file cache.

#### TC-PROV-059 - Legacy parity group F (050..052)

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F7-3, AC-F6-4, NFR-9, Appendix A row TC-ZAI-050..052
**Test Type(s)**: Regression, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-legacy-parity.test.ts`, `tests/behaviour/provider-credentials.test.ts`, `tests/fixtures/provider/legacy/group-f.ts`
**Tags**: @backend

**Preconditions**:
- A credential canary and a raw-body canary are supplied; the legacy fail-open exit-0 matrix is recorded.
- Capture sinks cover all surfaces.

**Steps**:
1. Port TC-ZAI-050; assert the credential canary is never logged on exhaustion, failure, or disabled paths.
2. Port TC-ZAI-051; assert the raw body canary is never logged on success or malformed paths.
3. Port TC-ZAI-052; assert the legacy fail-open exit-0 path is removed for indeterminate quota: `resolve` parks and `quota` classifies, never proceeds silently.
4. Assert no secret/header/raw body appears in any output; assert any persisted evidence uses only the closed park/announcement allowlists and contains no auth header, credential value, or userinfo.

**Expected Outcome**:
- Then secret/body non-observation and the closed evidence allowlists are preserved, and the fail-open exit-0 path is explicitly replaced.

#### TC-PROV-060 - Legacy parity group G (055..056)

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-1, NFR-9, Appendix A row TC-ZAI-055..056
**Test Type(s)**: Regression, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-legacy-parity.test.ts`, `tests/fixtures/provider/legacy/group-g.json`
**Tags**: @backend

**Preconditions**:
- Known UTC epochs and expected ISO-8601 strings are recorded independently.
- The core formatter is pure and independent of shell `date`.

**Steps**:
1. Port TC-ZAI-055; assert the formatter returns the recorded UTC strings for epoch zero and the fixture epochs.
2. Port TC-ZAI-056; assert the engine has no shell `date -d`/`date -r` dependency and uses pure arithmetic/ISO formatting.
3. Assert the formatter is identical under a different host timezone/locale injection.
4. Assert the output is byte-identical across repeated runs.

**Expected Outcome**:
- Then UTC formatting is portable, pure, and independent of platform date commands/timezones.

#### TC-PROV-061 - Legacy parity group H (060..064) and completed-sleep cap

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F4-5, AC-F6-4, NFR-9, Appendix A row TC-ZAI-060..064
**Test Type(s)**: Regression, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-legacy-parity.test.ts`, `tests/fixtures/provider/legacy/group-h.ts`
**Tags**: @backend

**Preconditions**:
- A stepping-clock seam and a sequence transport are available; the sleep seam counts completed sleeps.
- Cases: cross-time quota into peak, sleep then clear, past reset after sleep, cap, fresh fetch each iteration.

**Steps**:
1. Port TC-ZAI-060; assert the waits are `quota` then `peak` and both conditions appear across iterations.
2. Port TC-ZAI-061; assert one sleep then clear.
3. Port TC-ZAI-062; assert a past reset after sleep causes no loop.
4. Port TC-ZAI-063; assert exactly N completed sleeps, then `provider.reevaluation.cap` and a `reevaluation-cap` park, with no further fetch and no extra iteration for the park; it is not a silent proceed.
5. Port TC-ZAI-064; assert a fresh fetch occurs after every completed sleep and no fetch occurs after the cap.

**Expected Outcome**:
- Then MAX re-evaluation, fresh fetch, past-reset no-loop, and completed-sleep cap behavior are preserved with the cap divergence asserted.

#### TC-PROV-062 - Legacy parity group I (070..071)

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR-2, NFR-9, Appendix A row TC-ZAI-070..071
**Test Type(s)**: Regression, Static
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-legacy-parity.test.ts`, `tests/checks/provider-hermetic.test.ts`, `doc/guides/**`
**Tags**: @backend

**Preconditions**:
- The suite has a throwing `fetch` guard, an injected credential record, and a sleep spy.
- A provider condition/park guide exists in the documentation sync scope.

**Steps**:
1. Port TC-ZAI-070; assert the suite is hermetic by construction and the battery file references no live endpoint.
2. Port TC-ZAI-071; assert the guide documents the provider condition/park contract (condition kinds, park causes, resume/expiry, fail-loud rule), not the legacy hook contract.
3. Assert the guide contains no secret or live endpoint credential and no product hardcode.
4. In a temp copy, remove the condition/park section; assert the guide contract check fails.

**Expected Outcome**:
- Then hermetic-by-construction and the documented provider contract are both asserted.

### 5.3 Legacy Battery Parity Matrix (Appendix A)

The legacy battery is treated as a parity source for boundary math, not as a behavior to preserve wholesale. Each row is a subcase inside the named v1 TC; the v1 assertion is the explicit fail-loud divergence. The delivered battery executes 49 `TC-ZAI-*` checks; the nominal `TC-ZAI-001..071` numeric range has gaps. All 49 executed checks are listed below; OQ-3 is resolved and this is not an open blocker.

| Legacy ID | Legacy behavior | Ported v1 case | v1 assertion / intentional divergence |
|---|---|---|---|
| TC-ZAI-001 | Non-Z.AI model → no condition evaluated | TC-PROV-054 | Descriptor/chain gating replaces the model-string gate; undeclared/disabled entry not evaluated; no fetch, no sleep, no park. |
| TC-ZAI-002 | Z.AI off-peak → no sleep | TC-PROV-054 | Clear decision; no park/announcement; CLI never sleeps. |
| TC-ZAI-003 | Z.AI in-peak → sleep to peak end | TC-PROV-054 | `peak-window` park with peak-end expiry and `provider.peak.parked` info; no blocking sleep. |
| TC-ZAI-004 | Z.AI in buffer → sleep to end | TC-PROV-054 | Same park, wait includes the buffer; boundary math preserved. |
| TC-ZAI-005 | Custom peak window | TC-PROV-054 | Declarative custom window used; no Z.AI constants hardcoded. |
| TC-ZAI-010 | Transport/network failure → 0 + one `[WARN]` | TC-PROV-055 | `provider-outage` park + `provider.quota.unreachable` warning; `quota` → `provider.outage`; no silent clear. |
| TC-ZAI-011 | HTTP 401 → 0 + one `[WARN]` | TC-PROV-055 | `credential-rejected` park + `provider.quota.auth_rejected`; `quota` → `provider.auth.rejected`; no clear. |
| TC-ZAI-012 | HTTP 403 → 0 + one `[WARN]` | TC-PROV-055 | Same credential-rejected outcome; no retry/clear. |
| TC-ZAI-013 | Envelope code ≠ 200 → 0 + one `[WARN]` | TC-PROV-055 | `provider-outage` park + `provider.quota.malformed`; `quota` → `provider.outage`; no clear. |
| TC-ZAI-014 | Envelope `success` ≠ true → 0 + one `[WARN]` | TC-PROV-055 | Same malformed/outage outcome; no clear. |
| TC-ZAI-015 | Malformed JSON → 0 + one `[WARN]` | TC-PROV-055 | `provider.quota.malformed` + outage park/classified error; no clear. |
| TC-ZAI-016 | `data.limits` absent/non-array → 0 + one `[WARN]` | TC-PROV-055 | Same malformed class; no clear. |
| TC-ZAI-017 | Non-numeric percentage → 0 + one `[WARN]` | TC-PROV-055 | Same malformed class; no clear. |
| TC-ZAI-018 | Bad `nextResetTime`, no valid reset → 0 + one `[WARN]` | TC-PROV-055 | `provider.quota.exceeded` + `reset_missing`; no park/state write; no clear. |
| TC-ZAI-019 | Fail-open + peak active → peak applies | TC-PROV-055 | Peak park/announcement still applies; outage park/announcement also visible; MAX combined. |
| TC-ZAI-020 | Exactly one `[WARN]` across active failures | TC-PROV-055 | Exactly one matching warning per failure class; no duplicate; no clear. |
| TC-ZAI-021 | Key unset → silent, 0 fetch, 0 jq | TC-PROV-056 | A quota-enabled descriptor with an unresolvable credential is a `credential-missing` park/announcement; a quota-disabled descriptor remains silent by design; no fetch either way. |
| TC-ZAI-022 | `jq` missing → silent, no fetch | TC-PROV-056 | No external tool dependency; native transport outage is announced/parked, never silent. |
| TC-ZAI-023 | `curl` missing → silent, no fetch | TC-PROV-056 | Same native-transport outage path; no silent clear. |
| TC-ZAI-024 | Disabled → silent, no fetch | TC-PROV-056 | `quota.enabled: false` is silent by design and performs no fetch; a disabled descriptor is skipped with reason `disabled`. |
| TC-ZAI-025 | Opt-out + peak active → peak applies | TC-PROV-056 | Peak park/announcement applies; no quota fetch; no warning for the opt-out. |
| TC-ZAI-029 | No TOKENS_LIMIT → 0, no `[WARN]` | TC-PROV-057 | Clear; no park/announcement. |
| TC-ZAI-030 | All TOKENS_LIMIT pct < 100 → 0 | TC-PROV-057 | Clear; no park/announcement. |
| TC-ZAI-031 | 5h pct ≥ 100 → sleep to 5h reset | TC-PROV-057 | Quota park at reset; expiry = reset instant. |
| TC-ZAI-032 | Weekly pct ≥ 100 → sleep to weekly reset | TC-PROV-057 | Quota park at weekly reset. |
| TC-ZAI-033 | Both ≥ 100 → soonest reset | TC-PROV-057 | Soonest valid reset wins. |
| TC-ZAI-034 | TIME_LIMIT exhausted → ignored | TC-PROV-057 | TIME_LIMIT filtered; only TOKENS_LIMIT drives exhaustion. |
| TC-ZAI-035 | pct == 100 boundary → exhausted | TC-PROV-057 | Threshold is inclusive at 100. |
| TC-ZAI-036 | pct > 100 overage → exhausted | TC-PROV-057 | Any pct ≥ 100 exhausted. |
| TC-ZAI-037 | Past `nextResetTime` → clamp 0 | TC-PROV-057 | Zero wait; no park; no past expiry. |
| TC-ZAI-038 | Mixed reset → uses good, 0 `[WARN]` | TC-PROV-057 | Valid reset used; no fabricated expiry; no `reset_missing` while a valid reset exists. |
| TC-ZAI-039 | Non-exhausted earlier reset ignored | TC-PROV-057 | Only exhausted valid resets determine wait. |
| TC-ZAI-040 | In-peak AND quota exhausted → MAX | TC-PROV-057 | Later expiry wins; both condition kinds listed; single determining cause. |
| TC-ZAI-041 | In-peak AND quota OK → peak only | TC-PROV-057 | Peak park only. |
| TC-ZAI-042 | Off-peak AND quota exhausted → quota only | TC-PROV-057 | Quota park only. |
| TC-ZAI-045 | Disabled + key → no fetch, 0 | TC-PROV-058 | Disabled quota performs no fetch and writes no park. |
| TC-ZAI-046 | No file cache; 1 fetch/iter; no knob | TC-PROV-058 | Fresh fetch per completed sleep; cap after N completed sleeps with no post-cap fetch; no file cache; append-only dedupe. |
| TC-ZAI-050 | Full key never logged | TC-PROV-059 | Credential canary absent on all paths. |
| TC-ZAI-051 | Raw body never logged | TC-PROV-059 | Raw-body canary absent on success and malformed paths. |
| TC-ZAI-052 | Fail-open keeps exit 0 off-peak | TC-PROV-059 | Fail-open exit-0 path removed for indeterminate quota; `resolve` parks, `quota` classifies; never silent proceed. |
| TC-ZAI-055 | `format_utc_epoch` correct sans `date -d` | TC-PROV-060 | Pure UTC arithmetic/ISO formatting; no shell date dependency. |
| TC-ZAI-056 | Whole-file no `date -d` preserved | TC-PROV-060 | Same guarantee expressed in pure core; no platform date dependency. |
| TC-ZAI-060 | Cross-time quota → peak re-eval | TC-PROV-061 | Waits are quota then peak; both conditions visible across iterations. |
| TC-ZAI-061 | Sleep then clear → returns | TC-PROV-061 | One sleep then clear; no extra park. |
| TC-ZAI-062 | Past reset after sleep → no loop | TC-PROV-061 | No further iteration after past-reset clamp. |
| TC-ZAI-063 | Max sleep loops cap → 0 + `[WARN]` | TC-PROV-061 | Exactly N completed sleeps, then `provider.reevaluation.cap` + `reevaluation-cap` park; no post-cap fetch, no extra iteration, no silent proceed. |
| TC-ZAI-064 | Fresh fetch each iteration | TC-PROV-061 | Fresh fetch per iteration; no cache. |
| TC-ZAI-070 | Hermetic by construction | TC-PROV-062 | 0 live network, 0 live credentials, 0 real sleeps; injected seams. |
| TC-ZAI-071 | Guide documents condition-function contract | TC-PROV-062 | Guide documents the provider condition/park contract, not the legacy hook contract. |

### 5.4 No-Silent-Path Matrix

Every row must produce an announcement/park or a classified error. A "clear" outcome for any row is a test failure.

| Failure / condition class | Fixture / trigger | `resolve` outcome | `quota` outcome | Announcement code | Error code | Asserting TC |
|---|---|---|---|---|---|---|
| Transport failure / timeout | thrown transport, `000`, timeout | `provider-outage` park (outage TTL) | classified outage, exit 2 | `provider.quota.unreachable` | `provider.outage` | TC-PROV-024, 052, 055 |
| HTTP 401 | `http-401` | `credential-rejected` park | classified auth rejection, exit 1 | `provider.quota.auth_rejected` | `provider.auth.rejected` | TC-PROV-025, 052, 055 |
| HTTP 403 | `http-403` | `credential-rejected` park | classified auth rejection, exit 1 | `provider.quota.auth_rejected` | `provider.auth.rejected` | TC-PROV-025, 052, 055 |
| Non-200 HTTP (5xx/429) | `http-500`, `http-429` | `provider-outage` park | classified outage, exit 2 | `provider.quota.http_error` | `provider.outage` | TC-PROV-026, 052, 055 |
| Malformed JSON | `malformed-json` | `provider-outage` park | classified outage, exit 2 | `provider.quota.malformed` | `provider.outage` | TC-PROV-027, 052, 055 |
| Invalid envelope (`code`/`success`) | `envelope-code`, `envelope-success` | `provider-outage` park | classified outage, exit 2 | `provider.quota.malformed` | `provider.outage` | TC-PROV-027, 052, 055 |
| Limits absent / non-array | `limits-absent`, `limits-nonarray` | `provider-outage` park | classified outage, exit 2 | `provider.quota.malformed` | `provider.outage` | TC-PROV-027, 052, 055 |
| Non-numeric percentage | `pct-non-numeric` | `provider-outage` park | classified outage, exit 2 | `provider.quota.malformed` | `provider.outage` | TC-PROV-027, 052, 055 |
| Exhausted, reset absent/malformed/null | `reset-*` | classified error, no park | classified error, exit 2 | `provider.quota.reset_missing` | `provider.quota.exceeded` | TC-PROV-022, 052, 055, 057 |
| Missing credential | absent/empty injected key | `credential-missing` park (credential TTL) | classified credential failure, exit 1 | `provider.credential.missing` | `config.credential.missing` (quota) | TC-PROV-039, 052, 056 |
| Loop cap reached after N completed sleeps | fixed clock + `maxSleepLoops: N` | `reevaluation-cap` park (cap TTL), no post-cap fetch | n/a (driver only) | `provider.reevaluation.cap` | none | TC-PROV-023, 052, 061 |
| All chain entries parked | `all-parked` | `chain-exhausted` park (earliest provider expiry) | n/a | `provider.chain.exhausted` | none | TC-PROV-009, 052 |
| Skipped-entry outage | `skipped-outage` | selected entry + outage park/announcement for skipped entry | per-provider outage state | `provider.quota.unreachable` | none for resolve | TC-PROV-035, 052 |
| Peak window active | `peak-zai` | `peak-window` park | `peak-window` state | `provider.peak.parked` (info) | none | TC-PROV-011, 052 |
| Quota exhausted with valid reset | `exhausted-valid-reset` | `quota-exhausted` park | exhausted state with resume | `provider.quota.parked` (info) | none | TC-PROV-014, 052 |

## 6. Environments and Test Data

- **Runtime:** Bun pinned by `.bun-version`; `pnpm install --frozen-lockfile` and `pnpm build` precede dist-dependent/boundary suites. Tests run under `bun test`; no live endpoint is reachable.
- **Clock and sleep:** Every time-dependent case injects a fixed or stepping clock. The sleep seam records durations and counts completed sleeps; it never calls a real timer. A sleep spy asserts 0 real sleeps. The cap is asserted as exactly N completed sleeps (`N = maxSleepLoops`), with no further fetch and no extra iteration for the cap park.
- **Credentials:** No real secrets. Fixtures use unique canary strings supplied through an injected credential/env record, never the developer's `process.env`. The canary is scanned in raw and JSON-escaped forms.
- **Network:** 0 live calls. The quota transport is an injected fake that returns committed `(status, body)` pairs; a throwing `fetch` guard fails any unfixtured request. The legacy bash battery is not executed as a live script.
- **Config fixtures (`tests/fixtures/provider/config/`):** `valid-chain.yaml`, `valid-chain-multi.yaml`, `paid-before-subscription.yaml`, `duplicate-entries.yaml`, `unknown-reference.yaml`, `empty-chain.yaml`, `no-chain.yaml`, `missing-required.yaml`, `optional-omitted.yaml`, `defaults.yaml`, `quota-policy.yaml`, `quota-policy-minimal.yaml`, `quota-disabled.yaml`, `skip-matrix.yaml`, `subscription-first.yaml`, `peak-substitution.yaml`, `peak-zai.yaml`, `peak-custom.yaml`, `peak-invalid-timezone.yaml`, `peak-end-before-start.yaml`, `peak-out-of-range.yaml`, `all-parked.yaml`, `disabled-entry.yaml`, `allowed-paid-fallback.yaml`, `disallowed-paid-fallback.yaml`, `skipped-outage.yaml`.
- **Quota fixtures (`tests/fixtures/provider/quota/`):** `clear-no-tokens.json`, `clear-below-threshold.json`, `exhausted-valid-reset.json`, `both-exhausted.json`, `time-limit-only.json`, `pct-99.json`, `pct-100.json`, `pct-105.json`, `past-reset.json`, `mixed-reset.json`, `non-exhausted-earlier.json`, `reset-absent.json`, `reset-malformed.json`, `reset-null.json`, `malformed-json.json`, `envelope-code.json`, `envelope-success.json`, `limits-absent.json`, `limits-nonarray.json`, `pct-non-numeric.json`, `transport-failure.ts`, `http-401.ts`, `http-403.ts`, `http-500.ts`, `http-429.ts`, `http-302.ts`, `peak-plus-quota.json`, `sequence-*.json`. All bodies are sanitized; no live tenant data, no real token, no raw account identifiers.
- **Park/announcement fixtures (`tests/fixtures/provider/parks/`, `announcements/`):** `park-active.json`, `park-cleared.json`, `park-expired.json`, `park-cap.json`, `park-chain-exhausted.json`, `cap-and-chain.json` (cap park + chain-exhausted park fixtures), `park-expiry-boundary.json`, `park-generations.json`, `park-vs-lane.json`, `provider-parks.json` (including a torn/missing variant), `list-matrix.json`, `announcement-matrix.json`, `severity-matrix.json`, `dedupe-cases.json`.
- **Evidence fixtures (`tests/fixtures/provider/evidence/`):** `max-evidence.json` at the 1024-byte/20-field boundary; `over-bound-evidence.json` one byte/one field over; `unknown-key-evidence.json` for the closed-allowlist rejection; `park-allowlist.json` with the eight park fields; `announcement-allowlist.json` with the eleven announcement fields; `raw-body-canary.json` for the no-raw-body assertion.
- **Golden fixtures (`tests/fixtures/provider/golden/`):** `resolve-selected.json`, `resolve-parked.json`, `resolve-outage-skipped.json`, `quota-success.json`, `quota-failure.json`, `parks-list-active.json`, `parks-list-all.json`, and matching `.txt` human outputs. Volatile values (absolute paths, wall-clock) are normalized before comparison.
- **Security fixtures (`tests/fixtures/provider/security/`):** `canary.ts`, `credential-port-recording.ts`, `credential-missing.ts`, `classification-cases.ts`, `planted-env-read.ts`, `runtime-confinement-cases.ts`. Planted violations and mutation copies live only under `tests/fixtures/**` or `mkdtemp` workspaces, never under `packages/**`; fixtures are never named `*.test.ts`.
- **Isolation:** Read-only scans are checked with `git status --porcelain` before/after. Mutation cases run in temp copies. The live tree is never written by a mutation test.
- **Test data provenance:** quota bodies are hand-authored sanitized fixtures modeled on the declared Z.AI envelope; provider names/endpoints/credential source keys are declarative fixture data, not code constants.

## 7. Automation Plan and Implementation Mapping

All rows are **To Implement** unless marked **Existing – Update** or **Existing – No Change**. Paths are proposed under the testing strategy; the implementation plan may adjust locations while preserving every TC ID, AC trace, and legacy mapping.

### 7.1 Traceability Matrix (TC ↔ AC ↔ Suite/File)

| TC | AC | Suite / file | Execution command | Control / status |
|---|---|---|---|---|
| TC-PROV-001 | AC-F1-1, AC-F5-1, AC-F6-1, AC-F9-1 | `tests/structure/provider-contract.test.ts`, `tests/fixtures/provider/contract-inventory.json` | `bun test tests/structure/provider-contract.test.ts` | Exact inventory, eight skip reasons, closed evidence allowlists, `provider-parks.json` name; To Implement |
| TC-PROV-002 | AC-F1-1, AC-F1-5, AC-F3-3 | `tests/behaviour/provider-chain-resolution.test.ts`, `provider-peak-window.test.ts`, `tests/fixtures/provider/config/**` | `bun test tests/behaviour/provider-chain-resolution.test.ts tests/behaviour/provider-peak-window.test.ts` | Valid/invalid config matrix + temp-copy mutation; To Implement |
| TC-PROV-003 | AC-F1-5 | `tests/behaviour/provider-chain-resolution.test.ts`, `tests/fixtures/provider/config/defaults.yaml`, `optional-omitted.yaml` | `bun test tests/behaviour/provider-chain-resolution.test.ts` | Defaults/provenance + mutation; To Implement |
| TC-PROV-004 | AC-F1-3, AC-F2-2 | `tests/behaviour/provider-chain-resolution.test.ts`, `tests/fixtures/provider/config/paid-before-subscription.yaml` | `bun test tests/behaviour/provider-chain-resolution.test.ts` | No-I/O validation and reversed-order control; To Implement |
| TC-PROV-005 | AC-F1-2 | `tests/behaviour/provider-chain-resolution.test.ts`, `tests/fixtures/provider/config/no-chain.yaml`, `empty-chain.yaml` | `bun test tests/behaviour/provider-chain-resolution.test.ts` | Classified failure + zero state writes; To Implement |
| TC-PROV-006 | AC-F1-4, AC-NFR-3 | `tests/structure/provider-contract.test.ts`, `tests/checks/forbidden-literals.test.ts`, `tests/boundaries/**`, `.dependency-cruiser.cjs`, `scripts/checks/ambient-globals.ts` | `bun test tests/structure/provider-contract.test.ts tests/boundaries`; `bun run scripts/checks/ambient-globals.ts`; `pnpm check:boundaries` | AST/ambient/brand + confinement admission/negative controls; To Implement |
| TC-PROV-007 | AC-F2-1 | `tests/behaviour/provider-chain-resolution.test.ts`, `tests/fixtures/provider/config/skip-matrix.yaml` | `bun test tests/behaviour/provider-chain-resolution.test.ts` | Eight-reason precedence matrix + double replay; To Implement |
| TC-PROV-008 | AC-F2-2 | `tests/behaviour/provider-chain-resolution.test.ts`, `tests/fixtures/provider/config/subscription-first.yaml` | `bun test tests/behaviour/provider-chain-resolution.test.ts` | Subscription-first + `shadowed` vs `paid-fallback-not-allowed` control; To Implement |
| TC-PROV-009 | AC-F2-3, AC-F5-6 | `tests/behaviour/provider-chain-resolution.test.ts`, `tests/behaviour/provider-parks.test.ts`, `tests/fixtures/provider/config/all-parked.yaml` | `bun test tests/behaviour/provider-chain-resolution.test.ts tests/behaviour/provider-parks.test.ts` | Earliest-expiry chain park + no-fabrication control; To Implement |
| TC-PROV-010 | AC-F2-4, AC-F2-5 | `tests/behaviour/provider-chain-resolution.test.ts`, `tests/fixtures/provider/config/peak-substitution.yaml` | `bun test tests/behaviour/provider-chain-resolution.test.ts` | Peak park, no paid selection, paid entry reason `shadowed`; To Implement |
| TC-PROV-011 | AC-F3-1 | `tests/behaviour/provider-peak-window.test.ts`, `tests/fixtures/provider/config/peak-zai.yaml` | `bun test tests/behaviour/provider-peak-window.test.ts` | Four-boundary matrix + buffer clamp; To Implement |
| TC-PROV-012 | AC-F3-2 | `tests/behaviour/provider-peak-window.test.ts`, `tests/fixtures/provider/config/peak-custom.yaml` | `bun test tests/behaviour/provider-peak-window.test.ts` | Custom window + no-hardcode scan; To Implement |
| TC-PROV-013 | AC-F3-4 | `tests/behaviour/provider-peak-window.test.ts`, `provider-quota-evaluation.test.ts`, `tests/fixtures/provider/quota/peak-plus-quota.json` | `bun test tests/behaviour/provider-peak-window.test.ts tests/behaviour/provider-quota-evaluation.test.ts` | MAX + condition-kind/cause assertions; To Implement |
| TC-PROV-014 | AC-F4-1 | `tests/behaviour/provider-quota-evaluation.test.ts`, `tests/fixtures/provider/quota/exhausted-valid-reset.json` | `bun test tests/behaviour/provider-quota-evaluation.test.ts` | Reset wait/expiry + info announcement; To Implement |
| TC-PROV-015 | AC-F4-2 | `tests/behaviour/provider-quota-evaluation.test.ts`, `tests/fixtures/provider/quota/both-exhausted.json` | `bun test tests/behaviour/provider-quota-evaluation.test.ts` | Soonest reset + order-insensitivity; To Implement |
| TC-PROV-016 | AC-F4-2 | `tests/behaviour/provider-quota-evaluation.test.ts`, `tests/fixtures/provider/quota/time-limit-only.json` | `bun test tests/behaviour/provider-quota-evaluation.test.ts` | TIME_LIMIT filtering + control; To Implement |
| TC-PROV-017 | AC-F4-2 | `tests/behaviour/provider-quota-evaluation.test.ts`, `tests/fixtures/provider/quota/pct-99.json`, `pct-100.json`, `pct-105.json` | `bun test tests/behaviour/provider-quota-evaluation.test.ts` | Inclusive threshold matrix; To Implement |
| TC-PROV-018 | AC-F4-2 | `tests/behaviour/provider-quota-evaluation.test.ts`, `tests/fixtures/provider/quota/past-reset.json` | `bun test tests/behaviour/provider-quota-evaluation.test.ts` | Zero-wait clamp, no park; To Implement |
| TC-PROV-019 | AC-F4-2 | `tests/behaviour/provider-quota-evaluation.test.ts`, `tests/fixtures/provider/quota/mixed-reset.json` | `bun test tests/behaviour/provider-quota-evaluation.test.ts` | Valid-reset selection + swap; To Implement |
| TC-PROV-020 | AC-F4-2 | `tests/behaviour/provider-quota-evaluation.test.ts`, `tests/fixtures/provider/quota/non-exhausted-earlier.json` | `bun test tests/behaviour/provider-quota-evaluation.test.ts` | Non-exhausted reset ignored; To Implement |
| TC-PROV-021 | AC-F4-3 | `tests/behaviour/provider-quota-evaluation.test.ts`, `tests/fixtures/provider/quota/clear-*.json` | `bun test tests/behaviour/provider-quota-evaluation.test.ts` | Clear = no outage artifact; To Implement |
| TC-PROV-022 | AC-F4-4 | `tests/behaviour/provider-quota-evaluation.test.ts`, `provider-cli.test.ts`, `tests/fixtures/provider/quota/reset-*.json` | `bun test tests/behaviour/provider-quota-evaluation.test.ts tests/behaviour/provider-cli.test.ts` | Classified `provider.quota.exceeded` + no state write; To Implement |
| TC-PROV-023 | AC-F4-5 | `tests/behaviour/provider-quota-evaluation.test.ts`, `provider-parks.test.ts`, `tests/fixtures/provider/quota/sequence-*.json` | `bun test tests/behaviour/provider-quota-evaluation.test.ts tests/behaviour/provider-parks.test.ts` | Fresh fetch + exactly N completed sleeps + cap park; To Implement |
| TC-PROV-024 | AC-F4-6, AC-F7-4 | `tests/behaviour/provider-quota-evaluation.test.ts`, `provider-announcements.test.ts`, `tests/fixtures/provider/quota/transport-failure.ts` | `bun test tests/behaviour/provider-quota-evaluation.test.ts tests/behaviour/provider-announcements.test.ts` | Outage park/classified error; To Implement |
| TC-PROV-025 | AC-F4-6, AC-F7-4 | `tests/behaviour/provider-quota-evaluation.test.ts`, `provider-credentials.test.ts`, `tests/fixtures/provider/quota/http-40*.ts` | `bun test tests/behaviour/provider-quota-evaluation.test.ts tests/behaviour/provider-credentials.test.ts` | Auth rejection + no retry/leak; To Implement |
| TC-PROV-026 | AC-F4-6, AC-F7-4 | `tests/behaviour/provider-quota-evaluation.test.ts`, `tests/fixtures/provider/quota/http-500.ts`, `http-429.ts`, `http-302.ts` | `bun test tests/behaviour/provider-quota-evaluation.test.ts` | Non-auth outage matrix; To Implement |
| TC-PROV-027 | AC-F4-6 | `tests/behaviour/provider-quota-evaluation.test.ts`, `tests/fixtures/provider/quota/malformed-*.json` | `bun test tests/behaviour/provider-quota-evaluation.test.ts` | Six malformed classes + mutation; To Implement |
| TC-PROV-028 | AC-F5-1 | `tests/behaviour/provider-parks.test.ts`, `tests/fixtures/provider/parks/park-active.json`, `tests/fixtures/provider/parks/provider-parks.json`, `tests/fixtures/provider/evidence/park-allowlist.json` | `bun test tests/behaviour/provider-parks.test.ts` | Round-trip, 8-field allowlist, `provider-parks.json` fold; To Implement |
| TC-PROV-029 | AC-F5-2 | `tests/behaviour/provider-parks.test.ts`, `tests/fixtures/provider/parks/park-expiry-boundary.json` | `bun test tests/behaviour/provider-parks.test.ts` | T−1/T/T+1 + no write; To Implement |
| TC-PROV-030 | AC-F5-3 | `tests/behaviour/provider-parks.test.ts`, `provider-announcements.test.ts`, `tests/fixtures/provider/parks/park-generations.json`, `tests/fixtures/provider/parks/provider-parks.json` | `bun test tests/behaviour/provider-parks.test.ts tests/behaviour/provider-announcements.test.ts` | Dedupe/refresh/clear + rebuild-on-read; To Implement |
| TC-PROV-031 | AC-F5-4 | `tests/structure/provider-contract.test.ts`, `tests/behaviour/provider-parks.test.ts`, `tests/fixtures/provider/parks/park-vs-lane.json`, `tests/fixtures/provider/parks/provider-parks.json` | `bun test tests/structure/provider-contract.test.ts tests/behaviour/provider-parks.test.ts` | Record-kind distinction + projection excludes lanes; To Implement |
| TC-PROV-032 | AC-F5-5 | `tests/behaviour/provider-parks.test.ts`, `tests/fixtures/provider/parks/list-matrix.json`, `tests/fixtures/provider/parks/provider-parks.json` | `bun test tests/behaviour/provider-parks.test.ts` | Reads/rebuilds `provider-parks.json`, ordering/filters, zero side effects; To Implement |
| TC-PROV-033 | AC-F5-6, NFR-7 | `tests/behaviour/provider-parks.test.ts`, `tests/fixtures/provider/parks/cap-and-chain.json`, `tests/fixtures/provider/parks/provider-parks.json` | `bun test tests/behaviour/provider-parks.test.ts` | Cap/chain expiry + projection rebuild + exact boundary; To Implement |
| TC-PROV-034 | AC-F6-1 | `tests/behaviour/provider-announcements.test.ts`, `tests/fixtures/provider/announcements/matrix.json`, `tests/fixtures/provider/evidence/announcement-allowlist.json` | `bun test tests/behaviour/provider-announcements.test.ts` | Closed code/severity, 11-field allowlist, deterministic identity; To Implement |
| TC-PROV-035 | AC-F6-2 | `tests/behaviour/provider-chain-resolution.test.ts`, `provider-announcements.test.ts`, `tests/fixtures/provider/config/skipped-outage.yaml` | `bun test tests/behaviour/provider-chain-resolution.test.ts tests/behaviour/provider-announcements.test.ts` | Skipped-entry outage visibility; To Implement |
| TC-PROV-036 | AC-F6-3 | `tests/behaviour/provider-cli.test.ts`, `tests/golden/provider-announcement-surfaces.test.ts` | `bun test tests/behaviour/provider-cli.test.ts tests/golden/provider-announcement-surfaces.test.ts` | stdout/stderr surface split; To Implement |
| TC-PROV-037 | AC-F6-4, AC-F4-6 | `tests/behaviour/provider-legacy-parity.test.ts`, `tests/fixtures/provider/legacy/fail-open-matrix.ts` | `bun test tests/behaviour/provider-legacy-parity.test.ts` | Fail-open → fail-loud matrix; To Implement |
| TC-PROV-038 | AC-F7-1 | `tests/behaviour/provider-credentials.test.ts`, `tests/checks/secret-read-boundary.test.ts`, `scripts/checks/secret-read-boundary.ts`, `tests/fixtures/provider/security/credential-port-recording.ts` | `bun test tests/behaviour/provider-credentials.test.ts tests/checks/secret-read-boundary.test.ts`; `bun run scripts/checks/secret-read-boundary.ts` | Port-only, once-per-request, no cache, zero new allowlist entries; To Implement |
| TC-PROV-039 | AC-F7-2 | `tests/behaviour/provider-credentials.test.ts`, `tests/fixtures/provider/security/credential-missing.ts` | `bun test tests/behaviour/provider-credentials.test.ts` | No fetch + credential-missing park + `failureClass` evidence; To Implement |
| TC-PROV-040 | AC-F7-3, AC-NFR-4 | `tests/behaviour/provider-credentials.test.ts`, `tests/fixtures/provider/security/canary.ts`, `tests/fixtures/provider/evidence/*-allowlist.json` | `bun test tests/behaviour/provider-credentials.test.ts` | Canary scan + closed allowlists across all surfaces; To Implement |
| TC-PROV-041 | AC-F8-1 | `tests/behaviour/provider-cli.test.ts`, `tests/golden/provider-resolve.test.ts` | `bun test tests/behaviour/provider-cli.test.ts tests/golden/provider-resolve.test.ts` | One envelope + human summary; To Implement |
| TC-PROV-042 | AC-F8-2 | `tests/behaviour/provider-cli.test.ts`, `tests/golden/provider-quota.test.ts` | `bun test tests/behaviour/provider-cli.test.ts tests/golden/provider-quota.test.ts` | Non-mutating + classified failure; To Implement |
| TC-PROV-043 | AC-F8-3 | `tests/behaviour/provider-cli.test.ts`, `tests/golden/provider-parks-list.test.ts`, `tests/fixtures/provider/parks/provider-parks.json` | `bun test tests/behaviour/provider-cli.test.ts tests/golden/provider-parks-list.test.ts` | `provider-parks.json` view/rebuild + filters + zero side effects; To Implement |
| TC-PROV-044 | AC-F8-4 | `tests/behaviour/provider-cli.test.ts`, `tests/fixtures/provider/cli/invalid-flags.ts` | `bun test tests/behaviour/provider-cli.test.ts` | Classified invalid flags + valid envelope; To Implement |
| TC-PROV-045 | AC-F9-1 | `tests/checks/error-table-sync.test.ts`, `tests/structure/error-table.test.ts`, `scripts/checks/error-table-sync.ts` | `bun test tests/checks/error-table-sync.test.ts tests/structure/error-table.test.ts`; `bun run scripts/checks/error-table-sync.ts` | Bidirectional drift mutations; Existing – Update |
| TC-PROV-046 | AC-F9-2 | `tests/behaviour/error-classification.test.ts`, `provider-cli.test.ts`, `tests/fixtures/provider/security/classification-cases.ts` | `bun test tests/behaviour/error-classification.test.ts tests/behaviour/provider-cli.test.ts` | Exact-code + `fallback.internal` containment; Existing – Update |
| TC-PROV-047 | AC-NFR-1 | `tests/behaviour/provider-chain-resolution.test.ts`, `provider-parks.test.ts`, `tests/fixtures/provider/determinism/replay-case.json` | `bun test tests/behaviour/provider-chain-resolution.test.ts tests/behaviour/provider-parks.test.ts` | 100-run byte equality; To Implement |
| TC-PROV-048 | AC-NFR-2 | `tests/checks/provider-hermetic.test.ts`, `tests/behaviour/provider-legacy-parity.test.ts` | `bun test tests/checks/provider-hermetic.test.ts tests/behaviour/provider-legacy-parity.test.ts` | Throwing fetch + sleep spy; To Implement |
| TC-PROV-049 | AC-NFR-4 | `tests/checks/provider-evidence-bounds.test.ts`, `tests/fixtures/provider/evidence/*.json` | `bun test tests/checks/provider-evidence-bounds.test.ts` | 1024-byte/20-field boundary + closed 8/11 allowlists; To Implement |
| TC-PROV-050 | AC-NFR-5 | `tests/behaviour/provider-parks.test.ts`, `provider-cli.test.ts` | `bun test tests/behaviour/provider-parks.test.ts tests/behaviour/provider-cli.test.ts` | Append counts + read-only commands + projection rebuild without ledger writes; To Implement |
| TC-PROV-051 | AC-NFR-6 | `tests/behaviour/provider-quota-evaluation.test.ts`, `tests/fixtures/provider/performance/100-entries.json` | `bun test tests/behaviour/provider-quota-evaluation.test.ts` | ≤ 50 ms pure evaluation; To Implement |
| TC-PROV-052 | AC-F6-4, AC-F4-6 | `tests/behaviour/provider-legacy-parity.test.ts`, `tests/fixtures/provider/legacy/no-silent-paths.ts` | `bun test tests/behaviour/provider-legacy-parity.test.ts` | Exhaustive no-silent-path matrix; To Implement |
| TC-PROV-053 | AC-F6-3, AC-F8-1, AC-F8-2, AC-F8-3 | `tests/golden/provider-resolve.test.ts`, `provider-quota.test.ts`, `provider-parks-list.test.ts`, `tests/fixtures/provider/golden/**` | `bun test tests/golden` | Normalized machine/human goldens; To Implement |
| TC-PROV-054 | AC-F3-1, AC-F3-2, NFR-9 | `tests/behaviour/provider-legacy-parity.test.ts`, `tests/fixtures/provider/legacy/group-a.json` | `bun test tests/behaviour/provider-legacy-parity.test.ts` | TC-ZAI-001..005 parity + divergence; To Implement |
| TC-PROV-055 | AC-F4-6, AC-F6-4 | `tests/behaviour/provider-legacy-parity.test.ts`, `tests/fixtures/provider/legacy/group-b.ts` | `bun test tests/behaviour/provider-legacy-parity.test.ts` | TC-ZAI-010..020 fail-loud; To Implement |
| TC-PROV-056 | AC-F4-6, AC-F7-2 | `tests/behaviour/provider-legacy-parity.test.ts`, `tests/fixtures/provider/legacy/group-b-prime.ts` | `bun test tests/behaviour/provider-legacy-parity.test.ts` | TC-ZAI-021..025 opt-out/missing-credential; To Implement |
| TC-PROV-057 | AC-F4-2, AC-F4-4, AC-F4-6 | `tests/behaviour/provider-legacy-parity.test.ts`, `tests/fixtures/provider/legacy/group-c-d.json` | `bun test tests/behaviour/provider-legacy-parity.test.ts` | TC-ZAI-029..042 quota math + reset divergence; To Implement |
| TC-PROV-058 | AC-F4-5 | `tests/behaviour/provider-legacy-parity.test.ts`, `tests/fixtures/provider/legacy/group-e.ts` | `bun test tests/behaviour/provider-legacy-parity.test.ts` | TC-ZAI-045..046 no-fetch/no-cache + completed-sleep fetch; To Implement |
| TC-PROV-059 | AC-F7-3, AC-F6-4 | `tests/behaviour/provider-legacy-parity.test.ts`, `provider-credentials.test.ts`, `tests/fixtures/provider/legacy/group-f.ts` | `bun test tests/behaviour/provider-legacy-parity.test.ts tests/behaviour/provider-credentials.test.ts` | TC-ZAI-050..052 canaries + fail-open divergence; To Implement |
| TC-PROV-060 | NFR-1 | `tests/behaviour/provider-legacy-parity.test.ts`, `tests/fixtures/provider/legacy/group-g.json` | `bun test tests/behaviour/provider-legacy-parity.test.ts` | TC-ZAI-055..056 portable UTC; To Implement |
| TC-PROV-061 | AC-F4-5, AC-F6-4 | `tests/behaviour/provider-legacy-parity.test.ts`, `tests/fixtures/provider/legacy/group-h.ts` | `bun test tests/behaviour/provider-legacy-parity.test.ts` | TC-ZAI-060..064 re-eval + completed-sleep cap; To Implement |
| TC-PROV-062 | AC-NFR-2, NFR-9 | `tests/behaviour/provider-legacy-parity.test.ts`, `tests/checks/provider-hermetic.test.ts`, `doc/guides/**` | `bun test tests/behaviour/provider-legacy-parity.test.ts tests/checks/provider-hermetic.test.ts` | TC-ZAI-070..071 hermetic + guide contract; To Implement |

### 7.2 Implementation Notes and Gate Handoff

- **Injected seams are the testability contract:** the engine must accept a `Clock`, a `Sleep`, a `CredentialPort`, a quota `Transport`, and a state store/port as explicit construction inputs. The CLI composition edge wires the production implementations; tests wire fakes. This mechanism is required by NFR-2 and is not a new consumer-facing port.
- **Fixture transport:** implement a fake that returns committed `(status, body)` pairs and throws on an unfixtured request. The behavior test asserts the recording transport is the only HTTP path; a throwing global `fetch` guard proves no live call.
- **Skip reasons:** implement the eight-value closed set and precedence exactly as pinned: `disabled` > own condition > `paid-fallback-not-allowed` > `shadowed`. `paid-fallback-not-allowed` means fallback is disabled; `shadowed` means a later entry has no higher-precedence reason relative to the selected or determining entry. Do not use `paid-fallback-not-allowed` merely because an earlier entry won.
- **Loop driver:** expose the re-evaluation policy as a pure/testable function taking the condition evaluator, clock, sleep, and loop cap. Count completed sleeps; after the Nth completed sleep (`N = maxSleepLoops`), emit the cap announcement and cap park with no further fetch and no extra iteration for the park. Test with a fixed clock and a sleep spy so no wall-clock wait occurs.
- **State-layer tests:** use the delivered state test harness to append/read `provider.park` and `provider.announcement` records and to build the `provider-parks.json` derived document. A missing/divergent projection is rebuilt from verified ledger truth on read; no separate rebuild CLI exists in v1. Do not invent a second store.
- **Evidence allowlists:** park evidence is exactly the eight fields; announcement evidence is the eight base fields plus `parkName`, `parkExpiresAt`, and `announcementCode`. Reject unknown keys and never admit a raw body, auth header, credential value, or endpoint userinfo.
- **Secret-read boundary:** do not add any `SECRET_READ_ALLOWLIST` entry. Add planted-read fixtures for `packages/core/src/provider/**`, `packages/cli/src/commands/provider.ts`, and `packages/adapters/src/provider-quota/**`; assert the check fails naming rule/file/line there, while the live tree stays clean.
- **Runtime-API confinement:** `.dependency-cruiser.cjs` gains exactly the declared `packages/adapters/src/provider-quota/**` allowance with a reason. Add a clean control importing a runtime API from that subpath and a negative fixture for every neighboring path (`credentials`, `repo`, `file`, `host`, `session`, `legacy`, core provider policy); register the fixture so the fixture-coverage meta-check stays green. Do not widen to `adapters/**`.
- **Error table:** add the four rows to the machine table and the documented table in the same change; keep `provider.quota.exceeded`; update the exact-code provider classification and assert `fallback.internal` for no-code/undeclared/wrong-kind.
- **Golden output:** normalize absolute paths, absolute timestamps, and unordered collections; keep a regeneration script so a diff is reviewable. Do not blanket-update snapshots.
- **CI wiring:** `ts-test` runs `pnpm test` and discovers `tests/structure`, `tests/behaviour`, `tests/golden`, `tests/checks`, and `tests/boundaries`. `ts-typecheck` runs `pnpm typecheck`. `ts-invariants` runs the static checks, including `ambient-globals.ts`, `secret-read-boundary.ts`, and `error-table-sync.ts`. `ts-boundaries` runs `pnpm check:boundaries` (including `workspace-entrypoints.ts`). `ts-aggregate` runs `pnpm check`. No live-network job is added.
- **Gate handoff commands to record in §10:** `pnpm install --frozen-lockfile`; `pnpm build`; `bun test tests/structure tests/behaviour tests/golden tests/checks tests/boundaries`; `bun run scripts/checks/ambient-globals.ts`; `bun run scripts/checks/secret-read-boundary.ts`; `bun run scripts/checks/error-table-sync.ts`; `bun run scripts/checks/workspace-entrypoints.ts`; `pnpm check:boundaries`; `pnpm typecheck`; `pnpm check`; `git diff --check`.
- **PR handoff:** base `main-tools`; all required `ts-*` jobs green on the pushed HEAD, not an earlier SHA; the legacy bash hook remains byte-unchanged.
- **Do not record unrun evidence as passing.** The implementation plan may rename files; preserve TC IDs and update only the location/command columns.

### 7.3 Definition of Test Completion and Coverage Accounting

The change is test-complete only when all of the following hold:

1. **AC evidence:** every one of the 46 ACs in §17 has at least one passing scenario and an evidence path recorded in §10; no AC is TODO.
2. **Legacy parity:** every Appendix A group has a ported case (TC-PROV-054 through TC-PROV-062), all 49 executed `TC-ZAI-*` checks appear in §5.3, and every legacy fail-open class asserts an announcement or classified error with **0 silent-clear** cases.
3. **No orphans:** every TC in §5.1 appears in §5.2 and §7.1 and maps to at least one AC or NFR; every TC in §7.1 appears in §5.1/§5.2.
4. **Hermeticity:** 0 live network calls, 0 live credential reads, 0 real sleeps, and the throwing-fetch/sleep-spy guards pass.
5. **Security boundaries:** secret-read boundary green with **zero new allowlist entries**; runtime-API confinement has exactly the declared `provider-quota` admission, a clean control, and failing negative fixtures; fixture-coverage meta-check green.
6. **Synchronization:** machine and documented provider error tables agree in both directions; exact-code classification is total and `fallback.internal` contains unclassified/wrong-kind failures.
7. **Determinism/idempotence/bounds:** 100-run replay is byte-identical; unchanged conditions append 0 duplicate records; repeated `quota`/`parks list` have 0 state writes; `provider-parks.json` rebuilds on read; evidence is ≤ 1024 bytes/≤ 20 fields and only from the closed allowlists.
8. **Loop cap:** exactly N completed sleeps before the cap announcement/park, with no post-cap fetch and no extra iteration for the cap park.
9. **Aggregate:** `pnpm check` is green, the changed-file `git diff --check` is clean, and all required CI jobs are green on the pushed HEAD with an unmerged PR targeting `main-tools`.

Coverage accounting:

| Accounting item | Count / result |
|---|---|
| Spec ACs mapped | 46 / 46 (40 functional + 6 NFR ACs), including AC-F2-5 |
| Appendix A groups mapped | 9 / 9 (TC-PROV-054 through TC-PROV-062) |
| Delivered legacy check IDs mapped | 49 / 49 (nominal 001..071 range has gaps) |
| Test cases defined | 62 |
| Test cases with an AC/NFR owner | 62 / 62 (no orphan tests) |
| TODO acceptance criteria | 0 |
| Claimed executions | 0 (authoring only; §10 is empty until delivery) |

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

- **Legacy parity can look complete while missing a case.** The matrix in §5.3 maps all 49 executed IDs, but a ported subcase could assert the wrong outcome. Mitigation: each row names the v1 assertion and the asserting TC; TC-PROV-052 adds a class-level no-silent-path mutation that fails when any class returns clear.
- **The fail-loud divergence changes operator-visible behavior.** `resolve` now parks where the legacy hook proceeded. Mitigation: every divergence is asserted and documented; the legacy hook remains untouched; no spawn cutover is in this change.
- **Skip-reason precedence could be implemented inconsistently.** The spec now pins the eight-value set and precedence. The residual risk is a deliverer applying `paid-fallback-not-allowed` merely because an earlier entry won, or omitting the determining-entry rule. TC-PROV-007/008/010 assert the exact precedence and the `shadowed` versus fallback-disabled distinction; §8.3 OQ-1 is resolved.
- **Evidence allowlists could erode.** TC-PROV-034/040/049 assert the exact eight park fields and eleven announcement fields; a later field addition could slip through if the allowlist fixture is not regenerated. Mitigation: the allowlist fixtures are committed and the unknown-key/over-bound mutations must fail.
- **The runtime-confinement admission could be widened accidentally.** Mitigation: exact-path allowance, clean control, negative controls for neighboring paths, and the fixture-coverage meta-check. Do not add `adapters/**`.
- **The secret-read boundary could grow a new entry.** Mitigation: no allowlist change; planted reads inside provider core/CLI/transport must fire; the existing mutation battery (remove entry, undeclared addition, wildcard, second credential entry) stays green.
- **Canary scanning is not universal value-level secret detection.** It proves the declared credential/raw-body canaries are unobservable; it cannot prove an arbitrary string in an allowed field is not a secret. This is the same residual class as the delivered adapter work; M0-S15 owns durable content scanning.
- **Golden output can be brittle.** Mitigation: normalized fields, committed fixtures, explicit regeneration, and separate stdout/stderr comparison. A volatile timestamp must not force a blanket snapshot update.
- **The 50 ms evaluation threshold is environment-sensitive.** Mitigation: exclude transport and fixture parsing, warm the function, take a stable measurement, and record the runner; a cold-start or loaded-runner failure is investigated, not silenced.
- **The completed-sleep cap could be off by one.** TC-PROV-023/058/061 assert exactly N completed sleeps, no post-cap fetch, and no extra iteration for the cap park. The counted unit is now pinned to completed sleeps.
- **Projection rebuild could be bypassed by a separate command or stale read.** DM-12 pins `provider-parks.json` and rebuild-on-read with no separate rebuild CLI. TC-PROV-030/031/032/043/050 assert the rebuild from verified ledger truth and no extra ledger append.

### 8.2 Assumptions

- The change specification is the single source of truth; no requirement, failure class, or legacy case is invented.
- The delivered state layer’s append, verified read, and derived-document replace operations are sufficient without a state schema change.
- The delivered credential port resolves synchronously; the quota transport is asynchronous and receives the material as data.
- The CLI composition edge can inject the clock, sleep, credential port, quota transport, and state store.
- The shipped Z.AI response shape is the only concrete quota shape; other providers conform to the generic snapshot contract.
- The legacy hook remains the spawn gate; this change returns a decision and does not cut over.
- `provider.quota.exceeded` remains the immediate-refusal code when quota exhaustion cannot produce an honest expiry.
- Optional defaults and the config field contract follow Appendix B exactly; an omitted optional block may remain absent.
- Evidence bounds apply to the bounded `evidence` payload of a park/announcement, not to the whole record envelope; park evidence is exactly eight fields and announcement evidence at most eleven.
- `provider-parks.json` is the pinned derived-document name; a missing/divergent projection is rebuilt from verified ledger truth on read, and v1 has no separate rebuild CLI.
- The loop cap counts completed sleeps: after N completed sleeps (`N = maxSleepLoops`), the cap announcement/park is produced with no further fetch and no extra iteration.
- `parks list` reports expired state without writing; `resolve` is the only mutating subcommand.
- No license headers are added manually; change artifacts remain header-free.

### 8.3 Open Questions

All prior open questions are resolved by spec v1.2 and are closed here. No open questions remain.

| ID | Resolution | Evidence |
|---|---|---|
| OQ-1 | The skip set is the eight values `disabled`, `peak-window`, `quota-exhausted`, `provider-outage`, `credential-missing`, `credential-rejected`, `paid-fallback-not-allowed`, and `shadowed`, with precedence `disabled` > own condition > `paid-fallback-not-allowed` > `shadowed`. A later eligible paid entry after a selected subscription is `shadowed` when fallback is allowed; `paid-fallback-not-allowed` is used only when fallback is disabled. When a peak-parked subscription is the determining entry, the later eligible paid entry is `shadowed`, not `paid-fallback-not-allowed` (AC-F2-5). | F-2, DM-7, AC-F2-1, AC-F2-2, AC-F2-5; TC-PROV-007/008/010 |
| OQ-2 | The projection is the derived document `provider-parks.json` using the state layer's `replaceDocument` bare-file-name convention. A missing/divergent projection is rebuilt from verified ledger truth on read; v1 adds no separate rebuild CLI. | F-5, EVT-1, DM-12; TC-PROV-028/030/031/032/033/043 |
| OQ-3 | The delivered legacy battery executes 49 `TC-ZAI-*` checks; the nominal `TC-ZAI-001..071` range has gaps. §5.3 maps all 49 executed checks; this is settled, not a DoR blocker. | Appendix A preamble; §5.3; §7.3 |
| OQ-4 | Park evidence is exactly `providerName`, `chainName`, `conditionKinds`, `waitSeconds`, `resetEpochMs`, `httpStatus`, `failureClass`, `credentialRefName` (8 fields). Announcement evidence is those 8 base fields plus `parkName`, `parkExpiresAt`, `announcementCode` (max 11). No other field is permitted; no raw body, auth header, credential value, or endpoint userinfo. | DM-10, DM-11, NFR-5, AC-F5-1, AC-F6-1, AC-NFR-4; TC-PROV-034/040/049 |
| OQ-5 | The loop cap counts completed sleeps. N = `maxSleepLoops`; after exactly N completed sleeps the engine announces `provider.reevaluation.cap` and returns a `reevaluation-cap` park with no further quota fetch; cap-park creation consumes no additional iteration. | F-4, DM-13, AC-F4-5; TC-PROV-023/058/061 |

No AC is left without a mapped test. All 46 ACs, all 9 Appendix A groups, and all 49 delivered legacy check IDs are traced. Open questions: none.

## 9. Plan Revision Log

| Version | Date (UTC) | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-10-31T15:00:00Z | Change Test Plan Writer | Initial plan: 62 test cases across structure/behaviour/golden/legacy-parity/checks levels; initial AC traceability (raised to 46/46 in 1.1 with AC-F2-5); 9/9 Appendix A group mapping with 49 delivered legacy IDs; fail-loud no-silent-path matrix; fixture inventory; hermetic/security/determinism/idempotence/bounds/cost coverage; CI wiring and definition of test completion; no execution claimed. |
| 1.1 | 2026-10-31T16:00:00Z | Change Test Plan Writer | Aligned to spec v1.2: added AC-F2-5 and raised AC traceability to 46/46; pinned the eight-value skip set and `shadowed`/`paid-fallback-not-allowed` precedence; pinned `provider-parks.json` rebuild-on-read with no separate CLI; asserted the closed 8-field park and 11-field announcement evidence allowlists; pinned loop-cap counting to completed sleeps (N = `maxSleepLoops`); recorded 49 executed legacy `TC-ZAI-*` checks and closed OQ-1 through OQ-5. No TC IDs changed; no execution claimed. |

## 10. Test Execution Log

No executions are recorded at authoring time. Populate this table only after running the commands in §7; do not record unrun evidence as passing.

| TC ID / gate | Run Date (UTC) | Result | Notes / command / HEAD |
|---|---|---|---|
| — | — | Not run | Authoring only; delivery owns execution. |

