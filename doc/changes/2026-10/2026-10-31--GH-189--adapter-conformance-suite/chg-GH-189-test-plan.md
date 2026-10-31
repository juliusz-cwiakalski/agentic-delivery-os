---
id: chg-GH-189-test-plan
status: Proposed
created: 2026-10-31T19:20:00Z
last_updated: 2026-10-31T19:20:00Z
owners: [engineering]
service: delivery-os provider adapters
labels: [change, planning]
version_impact: minor
summary: "Verify the provider-agnostic adapter conformance suite: three-flow registry over all seven closed operations, capability-gated GitHub/GitLab/Jira execution against deterministic mock tenants, structural and runtime coverage gates, the broken-adapter control, the delivery.conformance.v1 artifact, the read-only scheduled live tier and its not-configured/failed behavior, the workflow contract, and the repository boundary, secret, fixture, inventory, and CI invariants."
links:
  change_spec: ./chg-GH-189-spec.md
  implementation_plan: ./chg-GH-189-plan.md
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - M0-S20: Adapter conformance suite v1

## 1. Scope and Objectives

Protect the first provider-agnostic conformance contract: every shipped provider adapter must respond to the same primitive flows in the same vocabulary, supported operations must execute with primitive assertions, declared gaps must be visible and exact, and the suite must fail closed when coverage becomes vacuous or a provider contract appears unregistered. The highest risks are (a) a suite that is green because it skips everything, (b) an artifact or diagnostic that leaks a raw provider payload, header, token, or personal datum, (c) a scheduled live workflow that gains a PR trigger, unpinned action, or write permission, and (d) an adapter change that breaks a covered flow but still passes CI because the mock suite is not in the existing test path. This plan is a design and implementation map, not an execution claim.

### 1.1 In Scope

- All 22 spec acceptance criteria (AC-F1-1 through AC-F10-1) and their linked F-/DM-/NFR- ids.
- The mock tier: three flows (`change-lifecycle`, `comment-provenance`, `label-semantics`) × three adapters (GitHub, GitLab, Jira), capability-gated execution, exact declared-gap skips, primitive assertions, deterministic double replay, the throwing-`fetch` zero-call guard, exact-URL replay, and unfixtured-request failure.
- The structural and runtime coverage gates: registry completeness, the new `*_ADAPTER_CONTRACT` registration scan, every closed operation represented, every supported operation executed, every declared gap encountered with its exact reason, carrier coverage, non-vacuity, and unique ids.
- The deliberately broken adapter control and its unmodified clean control.
- The `delivery.conformance.v1` artifact: schema validation, bounds, redaction, status matrix (`passed`/`failed`/`not-configured`), and exit codes `0`/`1`/`0`.
- The live entrypoint: not-configured behavior, missing-variable reporting, configured-provider failure, read-only/no-mutation/zero-created-artifact proof, and injected clock/run-id/writer determinism.
- The scheduled-workflow contract test: triggers, least-privilege permissions, SHA-pinned actions, secret scoping, always-run artifact upload, Bun pin resolved from `.bun-version`, and the live wall-clock bound.
- Repository invariants: secret-read allowlist stays exactly four, zero ambient environment reads in `packages/*/src`, no `node:*` imports in testkit source, testkit remains dev-only, inventory and executable allowances updated, fixture sanitization and provenance clean, `ci.yml` byte-unchanged at review, topology/bindingness/supply-chain green, and `pnpm check` as the aggregate gate.

### 1.2 Out of Scope & Known Gaps

- No full write conformance, merge, deploy-trace, or pipeline expansion flows (spec NG-1, M1-S4). Write steps exist and are asserted as declared-gap skips; no provider write executes.
- No provider write adapters and no full GitHub adapter (NG-2, M3-S3).
- No core-contract, package, subpath, dependency, export-map, or `ci.yml` job change (NG-3, NG-4).
- The live tier is evidence-only and is not a merge gate; a failed live run does not create a tracker ticket in v1 (NG-5, DEC-5).
- No tenant-provisioning automation; tenants remain manual and the live run records `not-configured` until the documented settings exist (NG-6, DEC-12).
- No conformance coverage for `azure`/`ci` placeholders, the provider registry, or non-provider I/O adapters (NG-7, DEC-1).
- The implementation plan is absent at authoring time. When `chg-GH-189-plan.md` lands, reconcile file locations and commands only; every TC ID and AC trace is preserved.
- AC-F8-1's "bounded provider, flow, and step counts" has no numeric cap in the spec. The plan tests the mechanism (validator-declared finite caps, rejection of over-cap synthetic reports) and the explicit 256 KiB bound; the concrete numbers are delivery-defined and recorded as OQ-A. No AC is blocked by this.

## 2. References

- [Change specification](./chg-GH-189-spec.md) v1.0, especially §§4 (G-1 to G-9), 5 (F-1 to F-10), 6 (flows), 7 (scope), 8.3 (DM-1 to DM-8), 8.4 (live tenants), 9 (NFR-1 to NFR-9), 11 (RSK-1 to RSK-10), 15 (DEC-1 to DEC-15), 17 (22 ACs), 18 (Definition of Done), 22 (tenant variable names), and 24 (operation coverage matrix and artifact shape).
- [Ticket GH-189](https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/189): three ticket ACs (mock suite green for every shipped adapter; scheduled live run records a result artifact; an adapter change that breaks a flow fails CI).
- [Adapter conformance concept](../../../planning/concepts/adapter-conformance.md) — flow families, mock/live tiers, guardrails.
- [Feature: Adapter ports, credential resolution, and embedded metadata](../../../spec/features/feature-adapter-ports.md) — primitive views, capability/gap contract, credential port, secret-read boundary, quality strategy.
- [Feature: Provider client seeds and trap catalogs](../../../spec/features/feature-provider-client-seeds.md) — read slices, transport seam, fixture provenance, live revalidation handoff.
- [Feature: Monorepo scaffold and toolchain](../../../spec/features/feature-monorepo-scaffold-toolchain.md) — package graph, runtime-API confinement, inventory, CI coexistence.
- [Repository testing strategy](../../../../.ai/rules/testing-strategy.md); [TypeScript workspace rules](../../../../.ai/rules/typescript.md); [AGENTS.md](../../../../AGENTS.md).
- Decisions: [ADR-0003](../../../decisions/ADR-0003-oss-monorepo-structure.md) (conformance suite in testkit; live evidence is additional, not the gate), [ADR-0005](../../../decisions/ADR-0005-runtime-confinement-provider-client-subpaths.md) (provider-subpath confinement).
- Delivered mechanisms to extend: `packages/core/src/contracts/adapter-capabilities.ts`, `packages/core/src/contracts/ports.ts`, `packages/core/src/contracts/credentials.ts`, `packages/adapters/src/{github,gitlab,jira}/{client,capabilities}.ts`, `packages/adapters/src/io/provider-transport.ts`, `tests/behaviour/providers/{support,trap-harness}.ts`, `tests/checks/{ci-checks,fixture-sanitization}.test.ts`, `tests/structure/{content-inventory.test.ts,inventory.json,subpaths.test.ts}`, `scripts/checks/{secret-read-boundary,workspace-entrypoints,ci-topology,ci-bindingness,ci-supply-chain,testkit-exclusion}.ts`, `.dependency-cruiser.cjs`, `.github/workflows/{ci,release}.yml`, `bunfig.toml`, `package.json`.
- House format and gate handoff precedent: [chg-GH-188-test-plan.md](../2026-10-31--GH-188--client-seeds-trap-catalogs/chg-GH-188-test-plan.md).

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| Capability | AC | TC(s) | Status |
|---|---|---|---|
| F-1 | AC-F1-1 | TC-CONF-001, TC-CONF-004, TC-CONF-005 | Planned |
| F-1, F-2 | AC-F1-2 | TC-CONF-007, TC-CONF-008, TC-CONF-009 | Planned |
| F-2 | AC-F2-1 | TC-CONF-006, TC-CONF-007, TC-CONF-008, TC-CONF-009, TC-CONF-010 | Planned |
| F-2, F-5 | AC-F2-2 | TC-CONF-010, TC-CONF-011 | Planned |
| F-2, DM-2, DM-8 | AC-F2-3 | TC-CONF-004, TC-CONF-012, TC-CONF-013 | Planned |
| F-3 | AC-F3-1 | TC-CONF-003 | Planned |
| F-3 | AC-F3-2 | TC-CONF-002 | Planned |
| F-4, NFR-2 | AC-F4-1 | TC-CONF-015 | Planned |
| F-4, NFR-1 | AC-F4-2 | TC-CONF-014, TC-CONF-025 | Planned |
| F-4, NFR-6 | AC-F4-3 | TC-CONF-031 | Planned |
| F-5, NFR-3 | AC-F5-1 | TC-CONF-004, TC-CONF-005, TC-CONF-011, TC-CONF-013 | Planned |
| F-10, NFR-3 | AC-F5-2 | TC-CONF-016 | Planned |
| F-6, NFR-4 | AC-F6-1 | TC-CONF-006, TC-CONF-033 | Planned |
| F-6, NFR-4 | AC-F6-2 | TC-CONF-016, TC-CONF-032 | Planned |
| F-7, F-8, NFR-5 | AC-F7-1 | TC-CONF-020, TC-CONF-021, TC-CONF-022, TC-CONF-026 | Planned |
| F-7, NFR-5 | AC-F7-2 | TC-CONF-021 | Planned |
| F-7, NFR-5 | AC-F7-3 | TC-CONF-022 | Planned |
| F-7, NFR-4, NFR-6 | AC-F7-4 | TC-CONF-026, TC-CONF-027, TC-CONF-032 | Planned |
| F-7, NFR-6 | AC-F7-5 | TC-CONF-024, TC-CONF-028, TC-CONF-029 | Planned |
| F-8, NFR-7 | AC-F8-1 | TC-CONF-017, TC-CONF-018, TC-CONF-019 | Planned |
| F-9, NFR-8 | AC-F9-1 | TC-CONF-023 | Planned |
| F-10, NFR-7 | AC-F10-1 | TC-CONF-016, TC-CONF-017 | Planned |

All 22 spec ACs have at least one test case and none is marked untestable. Ticket AC coverage: AC-1 → TC-CONF-006/007/008/009/033; AC-2 → TC-CONF-020/021/022/026; AC-3 → TC-CONF-010/011/014/016/032.

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

The spec declares no ADOS-owned REST endpoint (API-*) and no event/message schema (EVT-*); §8.2 states the result artifact is a file, not an event. Provider HTTP surfaces are consumed only through the existing `ProviderTransport` seam.

| Interface | TC IDs | Observable assertion |
|---|---|---|
| DM-1 conformance flow definition | TC-CONF-001, TC-CONF-005 | Exactly three flows with stable ids, ordered steps, unique ids. |
| DM-2 conformance step | TC-CONF-001, TC-CONF-004, TC-CONF-010, TC-CONF-012 | Stable step id, operation from `ADAPTER_OPERATIONS`, assertion family, optional carrier requirement. |
| DM-3 adapter registration | TC-CONF-002, TC-CONF-003 | Exactly GitHub/GitLab/Jira; contract binding; client builder over a conformance tenant; no placeholder registration. |
| DM-4 mock tenant | TC-CONF-031, TC-CONF-015 | Example-host instance, credential reference name, addressing, ordered exact-URL routes, expected projections, provenance. |
| DM-5 conformance report | TC-CONF-018, TC-CONF-019, TC-CONF-020 | Tier, run id, injected generation time, provider/flow/step outcomes, skip reasons, assertion counts, bounded failures, mutation counters, overall status. |
| DM-6 live result artifact | TC-CONF-018, TC-CONF-019, TC-CONF-020 | `schema: delivery.conformance.v1`, `notConfigured` names only, bounded and secret-free JSON. |
| DM-7 live tenant configuration | TC-CONF-024 | Non-secret settings and credential reference names under `tests/`; token material resolved only through the credential port. |
| DM-8 capability-gated skip record | TC-CONF-010, TC-CONF-012, TC-CONF-013 | Step id, operation, exact declared gap reason, `skipped` status; distinct from a `live-read-only` deferral. |
| Live entrypoint composition | TC-CONF-020, TC-CONF-024, TC-CONF-025 | Injected registry, clock, run id, writer; native-fetch recording transport and process credential port at the composition edge. |
| Scheduled workflow | TC-CONF-026, TC-CONF-027 | Triggers, permissions, pins, secret scope, upload, Bun pin, timeout. |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR | TC IDs | Gate / assertion |
|---|---|---|
| NFR-1 determinism | TC-CONF-014, TC-CONF-025 | Double mock replay identical; injected clock/run id/writer; no ambient time, randomness, or environment in testkit conformance source. |
| NFR-2 offline mock execution | TC-CONF-015 | Fixture transport only; throwing `fetch` observes zero calls; unfixtured request fails by method and URL. |
| NFR-3 non-vacuity and coverage | TC-CONF-001, TC-CONF-002, TC-CONF-004, TC-CONF-005, TC-CONF-006, TC-CONF-010, TC-CONF-011, TC-CONF-013, TC-CONF-016 | Exact three flows, ≥3 adapters, all 7 operations, 100% supported executed, 100% gaps encountered, carrier coverage, non-empty sets. |
| NFR-4 CI bindingness | TC-CONF-026, TC-CONF-027, TC-CONF-032, TC-CONF-033 | No new `ci.yml` job; suite runs under `pnpm test`; no advisory constructs; topology/bindingness green; `ci.yml` byte-unchanged at review. |
| NFR-5 live no-false-alarm | TC-CONF-020, TC-CONF-021, TC-CONF-022 | `passed`→0, `not-configured`→0, `failed`→1; artifact on every run; unconfigured providers listed. |
| NFR-6 security and boundaries | TC-CONF-017, TC-CONF-019, TC-CONF-024, TC-CONF-028, TC-CONF-029, TC-CONF-031 | Exactly four allowlist entries; zero ambient env reads in package src; zero `node:*` in testkit src; no secret/PII in fixtures/artifacts; no live config in production packages. |
| NFR-7 artifact integrity | TC-CONF-017, TC-CONF-018, TC-CONF-019 | `delivery.conformance.v1` validation; ≤256 KiB; no raw payload/header/token; bounded failures and counts. |
| NFR-8 bounded execution and mutation | TC-CONF-020, TC-CONF-023, TC-CONF-026 | Mock wall clock measured and recorded; live job `timeout-minutes: 10`; zero mutation requests; zero created artifacts; non-`GET` fails. |
| NFR-9 repository gate integrity | TC-CONF-030, TC-CONF-031, TC-CONF-032, TC-CONF-033 | Inventory/allowances, sanitization, doc guard, boundaries, and `pnpm check` stay green; no invariant weakened. |

## 4. Test Types and Layers

- **Structure (`bun:test` under `tests/structure/**`):** flow/step registry shape, closed-operation representation, adapter registration and `*_ADAPTER_CONTRACT` scan, carrier/step coverage, non-vacuity floors, content inventory and executable allowances.
- **Behaviour (`bun:test` under `tests/conformance/**`):** the mock suite over all registered adapters, capability-gated skips, primitive assertions, deterministic replay, offline guard, broken-adapter control, artifact schema/status, and the live entrypoint composition tests.
- **Checks (`bun:test` under `tests/checks/**`):** scheduled-workflow contract and mutation controls, fixture sanitization/provenance, secret-read boundary, and CI check mutations.
- **Boundaries (`tests/boundaries/**`, `depcruise`):** testkit runtime-API confinement and dev-only edges, run against the production `.dependency-cruiser.cjs`; fixture-coverage meta-check.
- **Live evidence tests (`tests/conformance/live/*.test.ts`):** exercise the exported composition with injected config/transport/clock/run-id/writer. `tests/conformance/live/run-live.ts` is an entrypoint, not a `*.test.ts`, so `bun test` discovery does not run it.
- **Aggregate:** `pnpm check` is the single entry point (`lint → format:check → typecheck → test → check:boundaries → exports-parity`). `pretest` runs `pnpm build`, so package `dist` is current before the test battery.

| Level | Scope | Suites / files | Gate |
|---|---|---|---|
| Structure | Flow registry, operation representation, adapter registry, registration scan, carrier/step coverage, non-vacuity, inventory | `tests/structure/conformance-coverage.test.ts`, `tests/structure/content-inventory.test.ts`, `tests/structure/inventory.json` | `bun test tests/structure` (CI `ts-test`) |
| Behaviour (mock) | Three providers × three flows, primitive assertions, skips, determinism, offline guard, diagnostics | `tests/conformance/mock-conformance.test.ts`, `tests/conformance/broken-adapter-control.test.ts`, `tests/conformance/support/fixtures.ts` | `bun test tests/conformance` (CI `ts-test`) |
| Behaviour (artifact) | Schema, bounds, redaction, status matrix, exit codes | `tests/conformance/artifact.test.ts` | `bun test tests/conformance` (CI `ts-test`) |
| Behaviour (live) | Not-configured, configured failure, zero mutation, config/credential, determinism | `tests/conformance/live/live-entrypoint.test.ts`, `tests/conformance/live/config.ts`, `tests/conformance/live/run-live.ts` | `bun test tests/conformance/live` (CI `ts-test`) |
| Checks | Workflow contract, sanitization, secret-read invariant | `tests/checks/conformance-workflow.test.ts`, `tests/checks/fixture-sanitization.test.ts`, `tests/checks/secret-read-boundary.test.ts` | `bun test tests/checks` (CI `ts-test` / `ts-invariants`) |
| Boundaries | Testkit confinement and dev-only edges | `tests/boundaries/boundaries.test.ts`, `tests/boundaries/fixtures/cases.ts`, `tests/boundaries/fixture-registry.json`, `.dependency-cruiser.cjs` | `bun test tests/boundaries`; `pnpm check:boundaries` |
| Aggregate | Whole workspace | all of the above plus `scripts/checks/*.ts` | `pnpm check` (CI `ts-aggregate`) |

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Impact | Priority | AC |
|---|---|---|---|---|---|
| TC-CONF-001 | Flow registry shape and closed-operation representation | Happy Path | Critical | High | AC-F1-1 |
| TC-CONF-002 | Adapter registry completeness and contract binding | Happy Path | Critical | High | AC-F3-2 |
| TC-CONF-003 | Provider-contract registration scan fails on an unregistered contract | Negative | Critical | High | AC-F3-1 |
| TC-CONF-004 | Structural step and carrier coverage per adapter | Happy Path | Critical | High | AC-F2-3, AC-F5-1 |
| TC-CONF-005 | Structural non-vacuity floors and mutation controls | Negative | Critical | High | AC-F1-1, AC-F5-1 |
| TC-CONF-006 | Mock suite green for GitHub, GitLab, and Jira | Happy Path | Critical | High | AC-F2-1, AC-F6-1 |
| TC-CONF-007 | GitHub operation matrix and primitive assertions | Happy Path | Critical | High | AC-F1-2, AC-F2-1 |
| TC-CONF-008 | GitLab operation matrix and primitive assertions | Happy Path | Critical | High | AC-F1-2, AC-F2-1 |
| TC-CONF-009 | Jira operation matrix and primitive assertions | Happy Path | Critical | High | AC-F1-2, AC-F2-1 |
| TC-CONF-010 | Undeclared unsupported operation and silent-skip guard | Negative | Critical | High | AC-F2-1, AC-F2-2 |
| TC-CONF-011 | Runtime coverage gates execute supported operations and encounter every gap | Happy Path | Critical | High | AC-F2-2, AC-F5-1 |
| TC-CONF-012 | Comment-provenance read half and shipped carrier skip | Edge Case | Critical | High | AC-F2-3 |
| TC-CONF-013 | Carrier roundtrip control and `no-declared-carrier` skip | Edge Case | Critical | High | AC-F2-3, AC-F5-1 |
| TC-CONF-014 | Deterministic double replay with injected clock and run id | Regression | Critical | High | AC-F4-2 |
| TC-CONF-015 | Exact-URL replay, throwing-fetch guard, unfixtured failure | Negative | Critical | High | AC-F4-1 |
| TC-CONF-016 | Broken adapter control fails by provider, flow, and step | Negative | Critical | High | AC-F5-2, AC-F6-2 |
| TC-CONF-017 | Failure diagnostics and redaction | Edge Case | Critical | High | AC-F10-1, AC-F8-1 |
| TC-CONF-018 | Artifact schema validation for `delivery.conformance.v1` | Happy Path | Critical | High | AC-F8-1 |
| TC-CONF-019 | Artifact bounds and redaction | Negative | Critical | High | AC-F8-1 |
| TC-CONF-020 | Artifact status matrix, write-in-every-status, and exit codes | Happy Path | Critical | High | AC-F7-1, AC-F7-2, AC-F7-3 |
| TC-CONF-021 | Live not-configured behavior and missing-variable reporting | Happy Path | Critical | High | AC-F7-1, AC-F7-2 |
| TC-CONF-022 | Configured-provider live failure | Negative | Critical | High | AC-F7-1, AC-F7-3 |
| TC-CONF-023 | Live read-only, zero-mutation, and zero-created-artifact proof | Negative | Critical | High | AC-F9-1 |
| TC-CONF-024 | Live configuration reader and credential-port exclusivity | Happy Path | Critical | High | AC-F7-5 |
| TC-CONF-025 | Live injection determinism and no ambient time/randomness | Regression | Critical | High | AC-F4-2, NFR-1 |
| TC-CONF-026 | Scheduled workflow contract | Happy Path | Critical | High | AC-F7-1, AC-F7-4 |
| TC-CONF-027 | Scheduled workflow mutation controls | Negative | Critical | High | AC-F7-4 |
| TC-CONF-028 | Secret-read allowlist stays exactly four | Regression | Critical | High | AC-F7-5 |
| TC-CONF-029 | Testkit confinement and dev-only edges | Happy Path | Critical | High | AC-F7-5 |
| TC-CONF-030 | Content inventory and executable allowances updated | Regression | Important | High | NFR-9 |
| TC-CONF-031 | Conformance fixtures sanitized, provenance-marked, and placeholders declared | Regression | Critical | High | AC-F4-3 |
| TC-CONF-032 | CI topology, bindingness, supply chain, and `ci.yml` byte-unchanged | Regression | Critical | High | AC-F6-2, NFR-4 |
| TC-CONF-033 | Aggregate gate and test discovery | Regression | Critical | High | AC-F6-1, NFR-9 |

#### Operation rollup (adapter × operation × expected outcome)

| Operation | Flow step(s) | GitHub | GitLab | Jira |
|---|---|---|---|---|
| `read-work-item` | `change-lifecycle.read-work-item`, `comment-provenance.read-comments`, `label-semantics.read-labels` | executes (3 steps) | declared-gap skip `adapter-not-implemented` (3 steps) | executes (3 steps) |
| `write-work-item` | `change-lifecycle.open-change`, `label-semantics.replace`, `label-semantics.sweep` | declared-gap skip `adapter-not-implemented` | declared-gap skip `adapter-not-implemented` | declared-gap skip `adapter-not-implemented` |
| `transition-work-item` | `change-lifecycle.transition` | declared-gap skip `adapter-not-implemented` | declared-gap skip `adapter-not-implemented` | declared-gap skip `adapter-not-implemented` |
| `read-delivery-request` | `change-lifecycle.read-delivery-request` | executes | executes | declared-gap skip `provider-unsupported` |
| `write-delivery-request` | `change-lifecycle.create-delivery-request` | declared-gap skip `adapter-not-implemented` | declared-gap skip `adapter-not-implemented` | declared-gap skip `provider-unsupported` |
| `read-pipeline-run` | `change-lifecycle.read-pipeline-run` | executes | executes | declared-gap skip `provider-unsupported` |
| `write-comment` | `change-lifecycle.comment`, `comment-provenance.carrier-roundtrip` | declared-gap skip `adapter-not-implemented` | declared-gap skip `adapter-not-implemented` | declared-gap skip `adapter-not-implemented` |

The exact reasons come from the shipped contracts: GitHub gaps all `adapter-not-implemented`; GitLab gaps all `adapter-not-implemented`; Jira gaps are `adapter-not-implemented` for the three write operations and `provider-unsupported` for `read-delivery-request`, `write-delivery-request`, and `read-pipeline-run`.

#### Step matrix (12 steps)

| Flow | Step id | Operation | Carrier requirement | GitHub | GitLab | Jira |
|---|---|---|---|---|---|---|
| `change-lifecycle` | `change-lifecycle.read-work-item` | `read-work-item` | none | execute | skip | execute |
| `change-lifecycle` | `change-lifecycle.read-delivery-request` | `read-delivery-request` | none | execute | execute | skip |
| `change-lifecycle` | `change-lifecycle.read-pipeline-run` | `read-pipeline-run` | none | execute | execute | skip |
| `change-lifecycle` | `change-lifecycle.open-change` | `write-work-item` | none | skip | skip | skip |
| `change-lifecycle` | `change-lifecycle.transition` | `transition-work-item` | none | skip | skip | skip |
| `change-lifecycle` | `change-lifecycle.create-delivery-request` | `write-delivery-request` | none | skip | skip | skip |
| `change-lifecycle` | `change-lifecycle.comment` | `write-comment` | none | skip | skip | skip |
| `comment-provenance` | `comment-provenance.read-comments` | `read-work-item` | none | execute | skip | execute |
| `comment-provenance` | `comment-provenance.carrier-roundtrip` | `write-comment` | declared carrier | skip (declared gap) | skip (declared gap) | skip (declared gap) |
| `label-semantics` | `label-semantics.read-labels` | `read-work-item` | none | execute | skip | execute |
| `label-semantics` | `label-semantics.replace` | `write-work-item` | none | skip | skip | skip |
| `label-semantics` | `label-semantics.sweep` | `write-work-item` | none | skip | skip | skip |

### 5.2 Scenario Details

#### TC-CONF-001 - Flow registry shape and closed-operation representation

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, DM-1, DM-2, NFR-3
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/conformance-coverage.test.ts`; `packages/testkit/src/conformance/{flows,types}.ts`
**Tags**: @backend

**Preconditions**:

- The flow registry is importable as data from testkit.
- `ADAPTER_OPERATIONS` is the closed seven-operation set from core contracts.

**Steps**:

1. Assert the registry has exactly the flow ids `change-lifecycle`, `comment-provenance`, and `label-semantics`, and no others.
2. Assert every flow has a non-empty, ordered step list; every step has a stable step id, an operation, and an assertion family.
3. Assert every step operation is a member of `ADAPTER_OPERATIONS`; reject unknown strings.
4. Assert every closed operation appears in at least one step; assert the set of step operations is exactly the seven-operation set.
5. Assert flow ids and step ids are unique across the registry, and step ids are stable data rather than generated from array position.
6. Assert the public conformance helpers are reachable through the existing `@delivery-os/testkit` root export and that no new package subpath is required.
7. In a temp registry copy, add a fourth flow, duplicate a step id, and use an unknown operation; assert each mutation fails naming the offending id or operation.

**Expected Outcome**:

- Exactly three flows, twelve ordered steps, unique ids, and complete representation of all seven closed operations.
- A missing operation, duplicate id, extra flow, or unknown operation fails structurally by name.

#### TC-CONF-002 - Adapter registry completeness and contract binding

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-2, DM-3, NFR-3
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/conformance-coverage.test.ts`; `packages/testkit/src/conformance/adapters.ts`
**Tags**: @backend

**Preconditions**:

- The shipped contracts are `GITHUB_ADAPTER_CONTRACT`, `GITLAB_ADAPTER_CONTRACT`, and `JIRA_ADAPTER_CONTRACT`, each with a matching `adapterName`.
- The adapters package exposes `azure`, `ci`, `registry`, and non-provider I/O subpaths that do not export a provider `AdapterContract`.

**Steps**:

1. Assert the registry has exactly three entries, keyed by `github`, `gitlab`, and `jira`, and no duplicates.
2. Assert each registration binds the imported contract whose `adapterName` equals the registry key; a mismatch fails naming both names.
3. Assert each registration supplies a client builder over a conformance tenant (instance, credential port, injected transport, addressing) and the addressing the flows use.
4. Assert no placeholder (`azure`, `ci`), registry, or non-provider I/O subpath is registered.
5. In a temp registry copy, point a registration at the wrong contract and add an `azure` registration; assert each fails naming the registration and the reason.

**Expected Outcome**:

- The registry is the sole participant list and contains exactly the three real provider contracts, each bound to its own contract and client builder.

#### TC-CONF-003 - Provider-contract registration scan fails on an unregistered contract

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1, NFR-3
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/conformance-coverage.test.ts`; `packages/adapters/src/**/*.ts`; `packages/testkit/src/conformance/adapters.ts`
**Tags**: @backend

**Preconditions**:

- The scan reads the adapters package source and finds exported `*_ADAPTER_CONTRACT` bindings.
- The scan accepts a root parameter so negative controls can use a temp tree.

**Steps**:

1. On the live tree, assert every exported provider `*_ADAPTER_CONTRACT` source has a matching conformance registration, and every registration names a matching contract.
2. Create a temp adapters tree with a new `packages/adapters/src/example/capabilities.ts` exporting `EXAMPLE_ADAPTER_CONTRACT`; assert the gate fails naming the source file and `example` adapter.
3. Create a temp registration naming a contract that does not exist; assert the gate fails naming the registration and the missing contract.
4. Assert the scan ignores non-provider I/O subpaths and placeholder modules that expose no `*_ADAPTER_CONTRACT` export.
5. Assert the live scan is non-vacuous: it finds exactly the three known contracts and at least one source file.

**Expected Outcome**:

- A new provider contract without registration fails structurally before review can waive it.
- A dangling registration fails by name.
- Non-provider modules do not create false positives.

#### TC-CONF-004 - Structural step and carrier coverage per adapter

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-5, AC-F2-3, AC-F5-1, DM-2
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/conformance-coverage.test.ts`; `packages/testkit/src/conformance/coverage.ts`
**Tags**: @backend

**Preconditions**:

- The coverage module exports a structural function over the registry and adapter declarations.

**Steps**:

1. For each adapter, assert every supported operation has at least one step and every declared gap operation has at least one step.
2. Assert every operation in each adapter's `supportedOperations` is in the closed set and every gap record has a valid `CapabilityGapReason`.
3. Assert an adapter that declares a writable or readable carrier has a step with a carrier requirement; assert the three shipped adapters declare no carriers and the carrier step is still registered.
4. Assert no adapter declares a carrier for which the registry has no carrier step.
5. In a temp declaration, declare a carrier without a carrier step, remove the only step for a supported operation, and remove the only step for a declared gap; assert each fails naming the adapter and operation.

**Expected Outcome**:

- Structural coverage is complete for all three adapters, including the never-executed carrier branch.
- Removing a step for a supported operation or a declared gap fails structurally.

#### TC-CONF-005 - Structural non-vacuity floors and mutation controls

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-5, AC-F1-1, AC-F5-1, NFR-3
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/conformance-coverage.test.ts`; `packages/testkit/src/conformance/coverage.ts`
**Tags**: @backend

**Preconditions**:

- The non-vacuity function asserts exact sets and floors, not a growing count against a moving base.

**Steps**:

1. Assert `flows.length === 3`, `adapters.length === 3`, and the represented operation set equals all seven closed operations.
2. Assert every flow has at least one step and every adapter has at least one step that can execute or skip for each of its declared operations.
3. Assert the registry contains no empty flow, no empty step list, and no adapter with zero supported operations and zero declared gaps.
4. In temp copies, empty the registry, empty one flow, remove all steps for one operation, and remove all adapters; assert each mutation fails with a specific non-vacuity message.
5. Assert the checks do not compare against `origin/main-tools` or any moving ref.

**Expected Outcome**:

- The suite cannot pass on an empty or shrunken registry.
- Floors and exact sets make the structural gate non-vacuous and stable over time.

#### TC-CONF-006 - Mock suite green for GitHub, GitLab, and Jira

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-6, AC-F2-1, AC-F6-1, NFR-3, NFR-4
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/mock-conformance.test.ts`; `tests/conformance/support/fixtures.ts`
**Tags**: @backend

**Preconditions**:

- The three mock tenants decode through the test-side fixture loader.
- The runner is invoked with the production adapter registry, fake credential ports, and fixture transports.

**Steps**:

1. Run the registry against GitHub, GitLab, and Jira with the fixture transport and a throwing-`fetch` guard installed.
2. Assert each adapter produces three flow results and twelve step results in registry order.
3. Assert the overall mock status is `passed`, with only declared or capability-absent skips and no failed step.
4. Assert each adapter has at least one executed step and at least one encountered declared gap; no adapter is vacuous.
5. Assert the suite performs zero live network calls and the run completes inside the mock budget; record the measured wall clock with `/usr/bin/time -f '%e s' bun test tests/conformance/mock-conformance.test.ts`.
6. In a temp copy, remove one tenant route; assert the suite fails naming the provider, flow, step, and request URL.

**Expected Outcome**:

- All three shipped adapters are green in the mock tier with declared-gap skips treated as green only when declared.
- The suite is non-vacuous per adapter and offline.
- Wall clock is recorded as evidence against the ≤60 s budget.

#### TC-CONF-007 - GitHub operation matrix and primitive assertions

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-2, AC-F1-2, AC-F2-1, DM-3, DM-6, DM-7
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/mock-conformance.test.ts`; `tests/fixtures/providers/conformance/github/tenant.json`
**Tags**: @backend

**Preconditions**:

- The GitHub tenant provides exact routes for issue read, pull read, check-runs-per-SHA read, and the comment/label read steps.
- The GitHub contract supports `read-work-item`, `read-delivery-request`, and `read-pipeline-run`.

**Steps**:

1. Assert the three `read-work-item` steps execute and return a normalized `WorkItem` equal to the tenant's expected projection; assert identity, non-empty title, closed delivery state, labels array, closed relation kinds, and ISO-8601 UTC `updatedAt` when present.
2. Assert the change-lifecycle `read-delivery-request` step executes and returns a `DeliveryRequest` with provider-qualified identity, source/target refs, closed review state, and `DeliveryThread` entries.
3. Assert the `read-pipeline-run` step executes and returns the complete per-SHA check-run set with closed job states and trace evidence references that carry a name and location.
4. Assert every write step records `skipped` with the exact `adapter-not-implemented` reason; no provider request is attempted for a skipped step.
5. Assert no provider-native key (`number`, `html_url`, `user`, `head`, `base`, `_links`, check-run native fields) appears on a returned primitive view.
6. In a temp tenant, change one expected projection and corrupt one normalized label; assert the GitHub case fails naming provider, flow, step, and assertion.

**Expected Outcome**:

- GitHub executes every supported read operation with primitive assertions and skips every write step with the exact declared reason.
- Normalized views contain no provider-native leakage.

#### TC-CONF-008 - GitLab operation matrix and primitive assertions

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-2, AC-F1-2, AC-F2-1, DM-3, DM-6, DM-7
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/mock-conformance.test.ts`; `tests/fixtures/providers/conformance/gitlab/tenant.json`
**Tags**: @backend

**Preconditions**:

- The GitLab tenant provides exact routes for merge-request read and pipelines-per-SHA read.
- The GitLab contract supports `read-delivery-request` and `read-pipeline-run`.

**Steps**:

1. Assert the change-lifecycle `read-delivery-request` step executes and returns a normalized `DeliveryRequest` equal to the expected projection, with a closed review state and no GitLab-native keys (`iid`, `web_url`, `source_branch`, `target_branch`).
2. Assert the `read-pipeline-run` step executes and returns every pipeline for the SHA, with closed job states and trace evidence references.
3. Assert all three `read-work-item` steps (change-lifecycle, comment-provenance, label-semantics) record `skipped` with `adapter-not-implemented`; assert the `read-work-item` gap is encountered.
4. Assert every write step records `skipped` with `adapter-not-implemented` and no request is attempted.
5. Assert the flow list is still exactly three flows and the skipped read-work-item steps do not remove the flows from the report.
6. In a temp tenant, drop one pipeline and change the review state to a value outside the closed set; assert each mutation fails naming provider, flow, step, and assertion.

**Expected Outcome**:

- GitLab executes its two supported read operations and truthfully skips the unsupported work-item and write operations.
- Pipeline multiplicity is not flattened and review state stays closed.

#### TC-CONF-009 - Jira operation matrix and primitive assertions

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-2, AC-F1-2, AC-F2-1, DM-3, DM-6, DM-7
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/mock-conformance.test.ts`; `tests/fixtures/providers/conformance/jira/tenant.json`
**Tags**: @backend

**Preconditions**:

- The Jira tenant provides an exact issue route whose fixture supplies labels and a comment set.
- The Jira contract supports only `read-work-item`.

**Steps**:

1. Assert the three `read-work-item` steps execute and return a normalized `WorkItem` equal to the expected projection; assert identity, non-empty title, closed delivery state, labels array, closed relation kinds, present comment set, and ISO-8601 UTC `updatedAt` when present.
2. Assert the comment-provenance read half asserts the provider-asserted comment set (author account and non-empty body) and does not surface the raw carrier.
3. Assert the label-semantics read step asserts the labels array and does not invent order semantics.
4. Assert `read-delivery-request` and `read-pipeline-run` record `skipped` with `provider-unsupported`; assert `write-delivery-request` records `provider-unsupported`; assert `write-work-item`, `transition-work-item`, and `write-comment` record `adapter-not-implemented`.
5. Assert no Jira-native key (`fields`, `customfield_*`, `key`, `self`) appears on the returned primitive view.
6. In a temp tenant, remove the comment payload and separately emit `comments: []` for the omitted payload; assert the first preserves absence and the second fails.

**Expected Outcome**:

- Jira executes its supported read operation with primitive assertions and exact provider-vs-adapter gap reasons.
- Comment absence and present-empty remain distinguishable.

#### TC-CONF-010 - Undeclared unsupported operation and silent-skip guard

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-5, AC-F2-1, AC-F2-2, DM-8
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/mock-conformance.test.ts`; `packages/testkit/src/conformance/{runner,coverage}.ts`
**Tags**: @backend

**Preconditions**:

- The runner accepts an injected adapter declaration and client so controls do not mutate the production registry.

**Steps**:

1. Build a control declaration whose `supportedOperations` omits an operation and whose `declaredGaps` has no record for it; assert the runner fails naming the adapter and operation instead of producing an anonymous skip.
2. Build a control whose gap reason is outside `CapabilityGapReason`; assert it fails by reason.
3. Build a control whose `write-comment` is unsupported with a declared gap; assert the carrier step records the declared-gap skip and is counted as encountered.
4. Build a control whose `write-comment` is supported but both carrier arrays are empty; assert the carrier step records the `no-declared-carrier` capability skip, not a pass.
5. Assert a skipped step never counts as an executed step for supported-operation coverage.

**Expected Outcome**:

- Undeclared unsupported operations fail closed.
- Every skip is either a declared gap or an explicit capability-absent skip; no silent pass exists.

#### TC-CONF-011 - Runtime coverage gates execute supported operations and encounter every gap

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-5, AC-F2-2, AC-F5-1, NFR-3
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/mock-conformance.test.ts`; `packages/testkit/src/conformance/coverage.ts`
**Tags**: @backend

**Preconditions**:

- The runtime report carries per-step status, skip reason, and operation.

**Steps**:

1. For each adapter, assert at least one step executed.
2. Assert every supported operation executed at least one step.
3. Assert every declared gap was encountered at least once with exactly its declared reason; assert the encountered-gap set equals `declaredGaps`.
4. Assert every declared carrier was exercised, or the adapter declares none.
5. Assert no executed step returned a non-primitive failure classified as success.
6. In temp reports, remove the only executed step for a supported operation, remove the only encountered gap, and mark a failed step as passed; assert each mutation fails naming provider, flow, step, or operation.
7. Assert coverage failures name the provider plus the flow, step, or operation, not just a generic count.

**Expected Outcome**:

- Runtime coverage proves execution is non-vacuous and complete for all three adapters.
- A lost execution, stale gap, or masked failure fails by name.

#### TC-CONF-012 - Comment-provenance read half and shipped carrier skip

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-3, DM-2, DM-8
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/mock-conformance.test.ts`; `tests/fixtures/providers/conformance/jira/tenant.json`
**Tags**: @backend

**Preconditions**:

- The Jira tenant supplies a comment set; a temp copy omits the comment payload.
- No shipped adapter declares a carrier.

**Steps**:

1. Assert the comment-provenance flow is registered for all three adapters and appears in every report.
2. Assert the Jira read half returns a present, non-empty `comments` set with author accounts and bodies.
3. Assert the temp omitted-comment payload yields an absent `comments` field (`!("comments" in view)`), never an empty array; assert the raw carrier (for example a metadata block) is not surfaced.
4. Assert the carrier-roundtrip step on all three shipped adapters records `skipped` with the `write-comment` declared gap reason because `write-comment` is unsupported.
5. Assert no adapter with no declared carrier claims carrier parity.
6. In a temp tenant, emit `comments: []` for the omitted payload; assert the case fails naming the flow and step.

**Expected Outcome**:

- The comment read half is asserted where supplied, absence stays absence, and the carrier roundtrip is an explicit declared-gap skip for all shipped adapters.

#### TC-CONF-013 - Carrier roundtrip control and `no-declared-carrier` skip

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-5, AC-F2-3, AC-F5-1, DM-8
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/mock-conformance.test.ts`; `tests/conformance/support/fixtures.ts`
**Tags**: @backend

**Preconditions**:

- A test-only control adapter (not registered in the production registry) supports `read-work-item` and `write-comment` and declares a writable/readable carrier.
- A second test-only control supports `write-comment` with empty carrier arrays.

**Steps**:

1. Run the registry with the carrier-declaring control; assert the carrier-roundtrip step executes, writes through the declared carrier, reads it back, and asserts the primitive metadata roundtrip.
2. Assert the carrier coverage gate passes because the declared carrier was exercised.
3. Run the registry with the empty-carrier control; assert the carrier step records a `no-declared-carrier` capability skip and the coverage gate passes.
4. Assert neither control appears in the production adapter registry and both are injected only through the runner's adapter-list parameter.
5. In a temp copy, declare a carrier but remove the carrier step; assert the structural gate fails naming the adapter and carrier.

**Expected Outcome**:

- The carrier-positive branch and the empty-carrier skip are both proven non-vacuously.
- Test-only controls never widen the shipped registry.

#### TC-CONF-014 - Deterministic double replay with injected clock and run id

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-2, NFR-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/mock-conformance.test.ts`; `packages/testkit/src/conformance/runner.ts`
**Tags**: @backend

**Preconditions**:

- The runner accepts an injected `nowIso` clock and `runId`.

**Steps**:

1. Run the mock suite twice with the same injected clock and run id and the same tenants.
2. Assert the two reports are deeply equal: flow order, step order, executed/skipped statuses, skip reasons, assertion counts, diagnostics, and mutation counters.
3. Assert `generatedAt` equals the injected clock value in both runs and is never read from ambient time.
4. Run with a failing control; assert the failure diagnostics are byte-identical across two runs, including expected/received values.
5. Run with two different injected run ids; assert only `runId` differs and step outcomes remain identical.

**Expected Outcome**:

- Identical inputs produce identical reports and diagnostics; only the injected run id changes.
- Determinism is proven for both passing and failing outcomes.

#### TC-CONF-015 - Exact-URL replay, throwing-fetch guard, unfixtured failure

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, NFR-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/mock-conformance.test.ts`; `tests/conformance/support/fixtures.ts`
**Tags**: @backend

**Preconditions**:

- The fixture transport resolves only exact URL matches and records every request.
- The throwing-`fetch` guard replaces `globalThis.fetch` for the duration of flow execution.

**Steps**:

1. Install the throwing-`fetch` guard, run the full mock suite, and assert the guard observed zero calls.
2. Assert the fixture transport received only the exact route URLs declared by each tenant; assert every request method is `GET`.
3. Change one tenant's addressing to produce an unfixtured URL; assert the run fails with the method and URL in the message.
4. Add a route with a near-miss URL (different query string or path encoding); assert it does not satisfy the exact match.
5. Restore `globalThis.fetch`; assert the guard is removed and a control call reaches the restored function.

**Expected Outcome**:

- The fixture transport is the only provider input path and a throwing `fetch` observes zero calls.
- Exact-URL matching is proven; an unfixtured request fails visibly without a network fallback.

#### TC-CONF-016 - Broken adapter control fails by provider, flow, and step

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, AC-F5-2, AC-F6-2, NFR-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/broken-adapter-control.test.ts`
**Tags**: @backend

**Preconditions**:

- A test-only wrapper around a production client corrupts one normalized outcome (for example, replaces a `WorkItem.title` or drops a label).
- The unmodified client uses the same tenant and fixture transport.

**Steps**:

1. Run the corrupting control through the change-lifecycle flow; assert the run fails.
2. Assert the failure names provider `github`, flow `change-lifecycle`, step `change-lifecycle.read-work-item`, and the assertion that observed the corruption.
3. Assert the failure includes expected and received primitive values and the fixture reference or request descriptor.
4. Run the unmodified client through the same flow; assert it passes every step, proving the assertion is live rather than always-failing.
5. Corrupt a different flow's outcome (label-semantics) and assert the failure names that flow and step, proving localization.
6. Assert the control is test-only and never appears in the production registry.

**Expected Outcome**:

- A covered-flow regression fails CI by provider, flow, and step.
- The unmodified control passes, so the failure is not vacuous.

#### TC-CONF-017 - Failure diagnostics and redaction

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, AC-F10-1, AC-F8-1, NFR-6, NFR-7
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/broken-adapter-control.test.ts`; `packages/testkit/src/conformance/runner.ts`
**Tags**: @backend, @security

**Preconditions**:

- The failing control produces a diagnostic from a fixture containing a raw-payload marker and a canary credential value supplied through the credential port.

**Steps**:

1. Assert the diagnostic names provider, flow id, step id, operation, assertion name, expected and received primitive values, and the fixture reference or request descriptor.
2. Assert the diagnostic contains no raw provider payload, no authorization header, no token value, and no personal datum (email/avatar), including JSON-escaped forms.
3. Assert the canary credential value is absent from the serialized report and from the thrown error text.
4. Assert expected/received values are normalized primitive data, never a provider-native object.
5. In a temp diagnostic, inject the raw payload marker into the failure detail; assert the redaction/validation test fails.

**Expected Outcome**:

- Every failed step is actionable at the primitive level without leaking secret or raw provider content.
- The redaction control proves the diagnostic test is not vacuous.

#### TC-CONF-018 - Artifact schema validation for `delivery.conformance.v1`

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-1, DM-5, DM-6, NFR-7
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/artifact.test.ts`; `packages/testkit/src/conformance/artifact.ts`
**Tags**: @artifact

**Preconditions**:

- The artifact module exports schema constants, serialization, and a validator.
- A mock report from the runner is available in memory.

**Steps**:

1. Serialize the mock report and assert `schema === "delivery.conformance.v1"` and the required top-level fields: `runId`, `tier`, `generatedAt`, `status`, `providers`, `flows`, `steps`, `mutationRequests`, `createdArtifacts`, `totals`.
2. Assert each provider entry has provider name, adapter name, status, missing-setting names, and flows; each flow entry has flow id, name, status, and steps; each step entry has step id, operation, status, skip reason, assertion count, and optional failure.
3. Assert status values are members of the schema's closed sets and timestamps are ISO-8601 UTC.
4. Assert an unknown schema version, a missing required array, an invalid status, and a missing mutation counter are each rejected naming the field.
5. Assert the mock report and a persisted live artifact validate through the same validator and shape.

**Expected Outcome**:

- The mock and live tiers share one versioned artifact contract.
- Malformed artifacts fail by field name rather than being silently accepted.

#### TC-CONF-019 - Artifact bounds and redaction

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-1, NFR-6, NFR-7
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/artifact.test.ts`; `packages/testkit/src/conformance/artifact.ts`
**Tags**: @artifact, @security

**Preconditions**:

- The validator declares finite count caps and a failure-detail cap.
- A canary token, authorization header, email address, avatar URL, and raw-payload marker are available in test data only.

**Steps**:

1. Assert a normal artifact serializes to ≤256 KiB.
2. Inject an oversized failure detail; assert serialization truncates it with a visible truncation marker and the artifact stays ≤256 KiB.
3. Build a synthetic report exceeding each declared provider/flow/step count cap; assert the validator rejects it naming the cap and the observed count.
4. Inject each canary shape into a failure/diagnostic field; assert the serialized artifact contains none of them.
5. Assert raw provider payload objects and authorization headers are never serialized into the artifact.
6. Assert the count caps are finite positive integers exported by the artifact module, so the bounds cannot be silently disabled.

**Expected Outcome**:

- The artifact is bounded and secret-free.
- Over-cap, oversized, or leaking artifacts fail by field or cap name.

#### TC-CONF-020 - Artifact status matrix, write-in-every-status, and exit codes

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, F-8, AC-F7-1, AC-F7-2, AC-F7-3, NFR-5
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/artifact.test.ts`; `tests/conformance/live/live-entrypoint.test.ts`; `tests/conformance/live/run-live.ts`
**Tags**: @artifact, @live

**Preconditions**:

- The live entrypoint exports a testable composition function that accepts injected configuration, transport, credential port, clock, run id, and writer.
- The writer records the artifact path/content instead of touching the real filesystem in unit tests.

**Steps**:

1. Run the composition with no configured provider; assert overall `not-configured`, the artifact is written, and the exit code is `0`.
2. Run with a configured provider whose reads pass; assert overall `passed`, the artifact is written, and the exit code is `0`.
3. Run with a configured provider whose read fails; assert overall `failed`, the artifact is written, and the exit code is `1`.
4. Assert every status path writes exactly one artifact and calls the writer before returning.
5. Assert the mock report uses the same shape in memory and is not persisted by the mock suite.
6. In a temp control, skip the writer on failure; assert the test fails naming the missing artifact.

**Expected Outcome**:

- `passed`→0, `not-configured`→0, `failed`→1; every terminal status produces an artifact.
- The mock tier stays in memory; only the live entrypoint persists.

#### TC-CONF-021 - Live not-configured behavior and missing-variable reporting

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-1, AC-F7-2, NFR-5, DEC-12
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/live/live-entrypoint.test.ts`; `tests/conformance/live/config.ts`; `tests/conformance/live/run-live.ts`
**Tags**: @live

**Preconditions**:

- All documented `CONFORMANCE_LIVE_*` names are absent from the injected environment.
- The documented names are the GitHub six settings plus token, the GitLab four settings plus token, and the Jira three settings plus token.

**Steps**:

1. Run the entrypoint composition with an empty environment; assert all three providers are `not-configured`, overall is `not-configured`, and the exit code is `0`.
2. Assert the artifact lists, per provider, every missing variable name and never a value.
3. Spawn `bun run tests/conformance/live/run-live.ts --out "$TMPDIR/conformance-live.json"` with the documented names unset; assert process exit `0` and a valid artifact file at the output path.
4. Assert no provider request was attempted and no credential was resolved in the not-configured path.
5. Assert the artifact is still uploaded by the workflow contract test (TC-CONF-026).

**Expected Outcome**:

- A run before tenants exist is a clean no-false-alarm `not-configured` with an artifact and exit `0`.
- Missing names are actionable without exposing values.

#### TC-CONF-022 - Configured-provider live failure

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-1, AC-F7-3, NFR-5, DEC-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/live/live-entrypoint.test.ts`; `tests/conformance/live/run-live.ts`
**Tags**: @live

**Preconditions**:

- All GitHub settings and its token source key are present; the GitLab and Jira settings are absent.
- An injected recording transport returns a failing response for the GitHub read.

**Steps**:

1. Run the composition with the configured GitHub provider and a failing read; assert overall `failed` and exit code `1`.
2. Assert the artifact is written in the failed run and names the provider, flow, step, operation, assertion, expected/received primitive values, and request descriptor.
3. Assert the unconfigured GitLab and Jira providers are listed separately as `not-configured`, not as failures.
4. Assert no tracker ticket is created: no write operation is executed, `mutationRequests` is `0`, and the workflow has no ticket-creation step (TC-CONF-026).
5. Assert a failing provider does not prevent the artifact writer from being called and does not throw before the artifact is written.

**Expected Outcome**:

- A configured provider failure is visible as `failed` with exit `1`, a complete artifact, and no automatic ticket.
- Unconfigured providers never create false failures.

#### TC-CONF-023 - Live read-only, zero-mutation, and zero-created-artifact proof

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, AC-F9-1, NFR-8, DEC-10
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/live/live-entrypoint.test.ts`; `tests/conformance/live/run-live.ts`
**Tags**: @live, @security

**Preconditions**:

- The live recording transport captures every request method and URL.
- A control adapter supports a non-read operation; a second supports a non-read operation that is declared as a gap.

**Steps**:

1. Run a live composition with the read-only registry; assert every recorded request method is `GET`, `mutationRequests === 0`, and `createdArtifacts === 0`.
2. Feed a synthetic recorded request with method `POST`; assert the read-only guard fails the run and names the method and URL.
3. Assert a supported non-read step is recorded as a `live-read-only` deferral and never calls the transport.
4. Assert an unsupported non-read step records its declared-gap skip and never calls the transport.
5. Assert the mock tier reaches no network (TC-CONF-015) and simulated write requests in the mock tier only touch the fixture transport.
6. Assert the artifact always contains both mutation counters, including in `not-configured` and `failed` runs.

**Expected Outcome**:

- Live v1 cannot mutate a provider: any non-`GET` fails, and the artifact proves zero mutations and zero created artifacts.
- Read-only deferrals remain distinct from declared-gap skips.

#### TC-CONF-024 - Live configuration reader and credential-port exclusivity

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-5, NFR-6, DEC-8
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/live/config.ts`; `tests/conformance/live/live-entrypoint.test.ts`; `tests/checks/secret-read-boundary.test.ts`
**Tags**: @live, @security

**Preconditions**:

- The config reader lives under `tests/`, outside the production-source secret-read scan scope.
- Credential references use literal source-key names matching the documented token variables.

**Steps**:

1. Assert the config reader returns only non-secret settings (base URLs, owner/repo/project/issue/pull/SHA addressing) and credential reference names.
2. Assert it determines configuration by the presence of every documented setting name and the token source-key name only; it never returns or logs a token value.
3. Inject a recording credential port; assert the live composition resolves each configured provider's token through the port using the declared reference, and the token value never enters the artifact, diagnostics, or errors.
4. Assert `packages/*/src` contains no import of the live config reader and no live tenant configuration.
5. Assert the secret-read allowlist stays exactly four entries (TC-CONF-028) and no `packages/*/src` ambient environment read is introduced.

**Expected Outcome**:

- Live configuration is non-secret and test-side only; token material resolves exclusively through the credential port.
- No production source gains live tenant configuration or a new secret-read allowance.

#### TC-CONF-025 - Live injection determinism and no ambient time/randomness

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-2, NFR-1
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/live/live-entrypoint.test.ts`; `packages/testkit/src/conformance/**`
**Tags**: @live

**Preconditions**:

- The live composition accepts injected flow registry, assertion code, clock, run id, and writer.
- A structural scan can inspect testkit conformance source for ambient time, randomness, and environment access.

**Steps**:

1. Run the live composition twice with the same injected clock, run id, config, and transport; assert the two serialized artifacts are identical.
2. Change only the injected run id; assert only `runId` changes.
3. Change only the injected clock; assert only `generatedAt` changes.
4. Assert the writer receives the same artifact content in both identical runs and does not append nondeterministic metadata.
5. Scan `packages/testkit/src/**` for ambient `Date.now`, `new Date()` without an injected value, `Math.random`, `process.env`, `Bun.env`, and `Deno.env`; assert zero hits; add a temp hit and assert the scan fails.

**Expected Outcome**:

- Live artifacts are reproducible from injected inputs.
- Testkit source contains no ambient time, randomness, or environment dependency.

#### TC-CONF-026 - Scheduled workflow contract

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-1, AC-F7-4, NFR-4, NFR-6, DEC-11, DEC-15
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/conformance-workflow.test.ts`; `.github/workflows/conformance-live.yml`
**Tags**: @ci, @security

**Preconditions**:

- The workflow is a separate file from `ci.yml`.
- The workflow-contract test parses the YAML with the repository `yaml` dependency.

**Steps**:

1. Assert the only triggers are `schedule` and `workflow_dispatch`; assert exactly one schedule with cron `17 5 * * 1`; assert no `pull_request`, `pull_request_target`, `push`, or other trigger.
2. Assert every job that runs the live entrypoint declares job-scoped `permissions.contents: read` and no write/id-token scope.
3. Assert every `uses:` action is pinned to a full 40-hex commit SHA.
4. Assert the Bun setup resolves the version from `.bun-version` (`bun-version-file`) and does not hardcode a second version; assert `.bun-version` is `1.4.4`.
5. Assert token secrets are referenced only inside the live job/step, are never present in a trigger or unrelated step, and `secrets: inherit` is absent.
6. Assert the artifact upload step uses `if: always()`, the `conformance-live` artifact name, `retention-days: 90`, and the artifact path written by the entrypoint.
7. Assert the live job has `timeout-minutes: 10`, no `continue-on-error`, no `|| true`, no `set +e`, and no ticket-creation command (`gh issue create`, Jira write, or tracker POST).

**Expected Outcome**:

- The live workflow is weekly/dispatch-only, least-privilege, SHA-pinned, secret-scoped to non-PR runs, always uploads the artifact, and uses the single Bun pin source.
- No automatic ticket is created.

#### TC-CONF-027 - Scheduled workflow mutation controls

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-4, NFR-4, NFR-6
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/conformance-workflow.test.ts`
**Tags**: @ci, @security

**Preconditions**:

- The workflow contract exposes a `validateWorkflow(text)` function so controls can point at a mutated copy without touching the live file.

**Steps**:

1. Remove the schedule, add a `pull_request` trigger, add a `push` trigger, and change the cron; assert each mutation fails naming the trigger block.
2. Replace a SHA pin with `@v4`, add an unpinned action, and add `continue-on-error: true`; assert each fails naming the step.
3. Change permissions to `contents: write` and add `id-token: write`; assert each fails naming the job.
4. Remove `if: always()` from the upload, change the retention to `0`, and change the artifact name; assert each fails naming the upload step.
5. Hardcode `bun-version: "1.4.4"` instead of `bun-version-file: .bun-version`; assert it fails the single-source pin rule.
6. Add `secrets: inherit`, move a token secret to an unrelated step, and add `gh issue create`; assert each fails naming the offending location.
7. Assert the unmutated live workflow passes all checks.

**Expected Outcome**:

- Every contract clause has a failing control, so the workflow test is not vacuous.
- The unmodified workflow passes.

#### TC-CONF-028 - Secret-read allowlist stays exactly four

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-5, NFR-6, G-9
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `scripts/checks/secret-read-boundary.ts`; `tests/checks/secret-read-boundary.test.ts`; `tests/fixtures/secret-boundary/cases.ts`
**Tags**: @security

**Preconditions**:

- The allowlist has one `credential-material` directory and three `configuration-environment-source` files.
- Testkit conformance source is inside the scanned `packages/testkit/src/**` scope.

**Steps**:

1. Run the boundary check on the live tree; assert zero violations, exactly four allowlist entries, exactly one credential-material entry, and a non-zero scoped-file count.
2. Plant `process.env.SECRET`, `Bun.env.SECRET`, and a computed-key access inside `packages/testkit/src/conformance/probe.ts`; assert the check fails naming rule, file, and line for each.
3. Assert the three shipped provider subpaths and the new testkit conformance source are not allowlisted.
4. Run the existing allowlist mutation cases (remove an entry, add an undeclared path, add a wildcard, add a second credential entry); assert each still fails closed.
5. Assert `git status --porcelain` is unchanged before and after the read-only scans.

**Expected Outcome**:

- The secret-read allowlist remains exactly four entries; testkit conformance code cannot read ambient environment variables.
- Planted violations and allowlist mutations fail by name.

#### TC-CONF-029 - Testkit confinement and dev-only edges

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-5, NFR-6, RSK-7
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `.dependency-cruiser.cjs`; `tests/boundaries/{boundaries.test.ts,fixtures/cases.ts,fixture-registry.json}`; `scripts/checks/{testkit-exclusion,workspace-entrypoints}.ts`
**Tags**: @backend, @security

**Preconditions**:

- `runtime-apis-confinement` has no testkit allowance; testkit may import `core` (`.` and `./contracts`) and adapters subpaths only.
- Testkit remains a devDependency and exposes no new subpath.

**Steps**:

1. Add a negative boundary fixture importing `node:fs` from `packages/testkit/src/conformance/probe.ts`; assert it violates `runtime-apis-confinement` and is registered with a failing fixture.
2. Add a clean control importing `node:fs` from an allowed location (for example `packages/core/src/state/driver/probe.ts`); assert it passes.
3. Assert testkit importing `cli`, `mcp`, or `opencode` still violates `testkit-no-surface-import`.
4. Run `bun run scripts/checks/testkit-exclusion.ts`; assert testkit appears in no published dependency graph and remains a devDependency of the workspace test layer.
5. Run `bun test tests/structure/subpaths.test.ts` and `bun run scripts/checks/workspace-entrypoints.ts`; assert no new subpath or workspace edge was added.
6. Assert the fixture-coverage meta-check is green and the new testkit negative fixture is registered.

**Expected Outcome**:

- Testkit conformance source cannot import runtime APIs, CLI/MCP/OpenCode surfaces, or new workspace edges.
- Boundary changes are enforced by a failing fixture and a clean control.

#### TC-CONF-030 - Content inventory and executable allowances updated

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: NFR-9, §8.5
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/content-inventory.test.ts`; `tests/structure/inventory.json`
**Tags**: @backend

**Preconditions**:

- Every new testkit conformance source file is committed under `packages/testkit/src/conformance/**`.
- `content-inventory.test.ts` enforces inventory equality and per-file executable allowances.

**Steps**:

1. Assert the actual testkit source file set equals the committed inventory, including every new conformance module.
2. Assert every exported function/value in a new conformance module is listed in that file's executable allowance; internal helpers are not treated as exports.
3. Assert no conformance module is missing an allowance entry and no non-conformance file gained an allowance.
4. In a temp tree, add a testkit source file without an inventory entry; assert the inventory test fails naming the file.
5. In a temp tree, add an undeclared exported function to an allowed file; assert the allowance test fails naming the export.
6. Assert the allowance list is per-file, not a global switch.

**Expected Outcome**:

- Inventory and allowances match the delivered testkit modules exactly.
- Missing inventory or undeclared executables fail by file and export name.

#### TC-CONF-031 - Conformance fixtures sanitized, provenance-marked, and placeholders declared

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-3, NFR-6, DEC-14
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/fixture-sanitization.test.ts`; `tests/fixtures/providers/conformance/{github,gitlab,jira}/tenant.json`; `tests/fixtures/providers/sanitization/placeholders.json`
**Tags**: @fixtures, @security

**Preconditions**:

- The sanitization audit scans every JSON file under `tests/fixtures/providers/**` except `sanitization/`.
- Every scanned fixture must be valid JSON with a top-level `provenance` string.

**Steps**:

1. Run the audit on the live tree; assert zero findings and a non-zero scoped-file count that includes the three conformance `tenant.json` files.
2. Assert every conformance fixture has the top-level `provenance` marker and uses only allowed example hosts (`*.example.com`, `*.invalid`, `*.test`, or `localhost`).
3. Assert every placeholder-shaped token and every `acct-####` token in the tenants is declared in `placeholders.json`; assert every declared placeholder is still used somewhere in the scoped corpus.
4. Assert no live tenant identifier, private repository reference, email, avatar URL, provider token, or private key appears in a conformance fixture.
5. Mutation controls: remove `provenance`, introduce a non-example host, add an undeclared `*-placeholder` token, add an email, and add a provider-token shape; assert each fails naming the file, line, and detail.
6. Assert the audit is read-only: `git status --porcelain` is identical before and after.

**Expected Outcome**:

- The three conformance tenants are inside the audited fixture root, provenance-marked, example-host-only, and placeholder-clean.
- New placeholder tokens force a registry update; stale placeholders fail.

#### TC-CONF-032 - CI topology, bindingness, supply chain, and `ci.yml` byte-unchanged

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-2, AC-F7-4, NFR-4
**Test Type(s)**: Contract
**Automation Level**: Semi-automated
**Target Layer / Location**: `.github/workflows/ci.yml`; `tests/checks/ci-checks.test.ts`; `scripts/checks/{ci-topology,ci-bindingness,ci-supply-chain}.ts`
**Tags**: @ci

**Preconditions**:

- `tests/checks/ci-checks.test.ts` pins the exact bash and TypeScript job sets.
- The mock conformance suite is discovered by `bun test` and therefore by the existing `ts-test` and `ts-aggregate` jobs.

**Steps**:

1. Run `bun run scripts/checks/ci-topology.ts`; assert the exact job sets are unchanged and no `conformance` job exists.
2. Run `bun run scripts/checks/ci-bindingness.ts` and `bun run scripts/checks/ci-supply-chain.ts`; assert zero advisory/bypass constructs and every `ts-` action SHA-pinned.
3. Run `bun test tests/checks/ci-checks.test.ts`; assert the topology mutation tests still pass.
4. Assert the mock suite is in the existing test path: `bun test tests/conformance` is discovered without a new job and `pnpm test` includes it.
5. Review-time evidence: run `git diff --exit-code "$(git merge-base HEAD origin/main-tools)" -- .github/workflows/ci.yml` and record the result in §10. This is a change-scoped gate, not a permanent suite assertion against a moving base.
6. Confirm the new scheduled workflow is separate and does not alter any `ci.yml` job, trigger, permission, or step.

**Expected Outcome**:

- `ci.yml` is byte-unchanged at review, the pinned job set is unchanged, and the mock suite rides the existing jobs.
- No new CI job is introduced.

#### TC-CONF-033 - Aggregate gate and test discovery

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-1, NFR-9
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `package.json`; `bunfig.toml`; all suites
**Tags**: @ci

**Preconditions**:

- `bunfig.toml` discovers `tests/**/*.test.ts`; `tests/conformance/live/run-live.ts` is not a `*.test.ts`.
- `pretest` runs `pnpm build`; `pretypecheck` also builds.

**Steps**:

1. Run `bun test tests/conformance tests/structure tests/checks tests/boundaries`; assert all suites green.
2. Run `pnpm check`; assert lint, format, typecheck, test, boundaries, and exports-parity pass.
3. Assert `bun test tests/conformance` discovers the mock, broken-control, artifact, and live-entrypoint test files, and does not execute `run-live.ts` as a suite.
4. Run `git diff --check`; assert no whitespace or conflict-marker findings.
5. Run `bash scripts/.tests/test-doc-distribution.sh` when documentation changes in the doc-sync phase; assert no distribution drift.
6. Run `bun run scripts/checks/license-audit.ts`; assert zero new external dependencies and zero denied verdicts (NG-8: no new dependencies).
7. Record the measured mock wall clock and the gate command results in §10; do not record unrun evidence as passing.

**Expected Outcome**:

- The full repository battery is green and the conformance suite is genuinely part of it.
- `run-live.ts` remains an entrypoint, not an accidentally discovered test.

## 6. Environments and Test Data

- **Runtime:** Bun pinned by `.bun-version` (1.4.4). Run `pnpm install --frozen-lockfile` and `pnpm build` before dist-dependent suites. `pnpm test` and `pnpm check` trigger `pretest`/`pretypecheck` builds; a narrow `bun test` after a source change requires an explicit `pnpm build` first.
- **Network:** None in the mock tier. The mock suite installs a throwing-`fetch` guard and resolves only exact-URL fixture routes; an unfixtured request fails with the method and URL. The live tier is not part of `pnpm test` or `pnpm check`; it runs only via the scheduled/dispatch workflow or an explicit local invocation.
- **Secrets:** No real secrets in committed files or mock tests. Mock credentials are non-secret canary strings supplied through an injected credential port. Live tokens resolve only through the adapters `./credentials` credential port; the live entrypoint reads only non-secret settings and credential reference names.
- **Fixtures:** New conformance tenants live at `tests/fixtures/providers/conformance/{github,gitlab,jira}/tenant.json`, inside the existing sanitization audit root. Fixtures are valid JSON (no comments/trailing commas), never named `*.test.ts`, and are decoded by `tests/conformance/support/fixtures.ts`.
- **Isolation:** Negative controls (mutated registries, tenants, reports, workflow text, boundary fixtures, and sanitization canaries) live in `mkdtemp` workspaces or in-memory copies. Nothing writes under `packages/**`; read-only scans are wrapped with a `git status --porcelain` before/after assertion where practical.
- **Determinism:** Clock, run id, writer, ordering, and credentials are injected. No sleeps, no real clock, no randomness, no ambient environment in testkit source. Mock replay is asserted twice.
- **Live environment names:** The documented names are the GitHub six settings plus `CONFORMANCE_LIVE_GITHUB_TOKEN`; the GitLab four settings plus `CONFORMANCE_LIVE_GITLAB_TOKEN`; the Jira three settings plus `CONFORMANCE_LIVE_JIRA_TOKEN` (spec §22). Tests assert names only, never values.
- **Live output:** The plan proposes `bun run tests/conformance/live/run-live.ts --out "$OUT"`; the exact flag/env spelling is delivery-defined and recorded in the implementation plan (OQ-B). Tests call the exported composition function for injected statuses and use one subprocess for the not-configured exit path.
- **Provenance:** Each tenant carries `"provenance": "hand-authored-synthetic 2026-10-31"` (or the delivery date). The sanitization audit requires a top-level `provenance` string on every scoped JSON fixture.

### 6.1 Conformance tenant data plan

Each `tenant.json` is declarative data for one provider and must contain:

| Element | Requirement |
|---|---|
| `provenance` | Top-level hand-authored-synthetic marker; no live capture. |
| `provider` / `adapterName` | One of `github`, `gitlab`, `jira`; matches the registry key and contract `adapterName`. |
| `instance` | `ExternalSystemInstance` shape with an example-only base URL: `https://github.example.com`, `https://gitlab.example.com`, or `https://jira.example.com`; `authMethod` uses a `credential-reference` with a declared reference name. |
| `credentialReferenceName` | Non-secret mock reference name, for example `conformance-mock-github`; the source key is a literal documented-style name, never a secret value. |
| `addressing` | Provider addressing the flows need: GitHub `owner`, `repo`, `issueNumber`, `pullNumber`, `commitSha`; GitLab `projectPath`, `mrIid`, `commitSha`; Jira `issueKey`. Use declared placeholders (`owner-placeholder`, `project-placeholder`, `group-placeholder`) and synthetic numeric ids/SHA; no live ids. |
| `routes` | Ordered exact-URL routes from the production client's request URL to `{ status, body }`. One route per URL; no wildcards; no query-string near-misses. |
| `expected` | One normalized primitive projection per executed read step keyed by step id (for example `change-lifecycle.read-work-item`, `change-lifecycle.read-delivery-request`, `change-lifecycle.read-pipeline-run`, `comment-provenance.read-comments`, `label-semantics.read-labels`). Expected values are primitive data only; no raw provider payload in the expected projection. |

Route URL families to author (matching the shipped clients):

- **GitHub:** `/repos/owner-placeholder/project-placeholder/issues/{n}`, `/repos/owner-placeholder/project-placeholder/pulls/{n}`, `/repos/owner-placeholder/project-placeholder/commits/{sha}/check-runs?per_page={limit}`.
- **GitLab:** `/api/v4/projects/group-placeholder%2Fproject-placeholder/merge_requests/{iid}`, `/api/v4/projects/group-placeholder%2Fproject-placeholder/pipelines?sha={sha}`.
- **Jira:** `/rest/api/2/issue/{issueKey}`.

The Jira tenant supplies a comment set and labels so the comment-provenance and label-semantics read halves execute; the GitHub tenant supplies the issue, pull, and check-run projections; the GitLab tenant supplies the MR and pipeline projections. The GitHub `read-comments` step may assert absence without fabrication when the fixture does not supply comments.

**Placeholder registry update:** `tests/fixtures/providers/sanitization/placeholders.json` already declares `owner-placeholder`, `reviewer-placeholder`, `person-placeholder`, `acct-0001`–`acct-0003`, `group-placeholder`, and `project-placeholder`. Reuse those where possible. If a conformance tenant introduces a new placeholder-shaped token (`*-placeholder` or `acct-####`), add it to the registry in the same change; the audit fails an undeclared token, and the declared-placeholder usage test fails a stale entry. Do not add a parallel fixture root or a per-provider sanitization exemption.

## 7. Automation Plan and Implementation Mapping

All rows are **To Implement** unless marked otherwise. Paths follow the spec's intended path map; the implementation plan may adjust exact module names while preserving every TC ID and AC trace.

### 7.1 Traceability Matrix (TC ↔ AC ↔ Suite/File)

| TC | AC | Suite / file | Execution command | Control / status |
|---|---|---|---|---|
| TC-CONF-001 | AC-F1-1 | `tests/structure/conformance-coverage.test.ts`; `packages/testkit/src/conformance/{flows,types}.ts` | `bun test tests/structure/conformance-coverage.test.ts` | Exact three flows, twelve steps, unique ids, all seven operations; mutations fail by id/operation; To Implement |
| TC-CONF-002 | AC-F3-2 | `tests/structure/conformance-coverage.test.ts`; `conformance/adapters.ts` | `bun test tests/structure/conformance-coverage.test.ts` | Exactly GitHub/GitLab/Jira, contract binding, no placeholders; wrong-contract/azure mutations fail; To Implement |
| TC-CONF-003 | AC-F3-1 | `tests/structure/conformance-coverage.test.ts`; adapters source scan | `bun test tests/structure/conformance-coverage.test.ts` | Unregistered `*_ADAPTER_CONTRACT` fails naming source/adapter; dangling registration fails; To Implement |
| TC-CONF-004 | AC-F2-3, AC-F5-1 | `tests/structure/conformance-coverage.test.ts`; `conformance/coverage.ts` | `bun test tests/structure/conformance-coverage.test.ts` | Every supported op and gap has a step; carrier step registered; mutations fail; To Implement |
| TC-CONF-005 | AC-F1-1, AC-F5-1 | `tests/structure/conformance-coverage.test.ts`; `conformance/coverage.ts` | `bun test tests/structure/conformance-coverage.test.ts` | Exact sets/floors; empty/shrunken registry mutations fail; no moving-base comparison; To Implement |
| TC-CONF-006 | AC-F2-1, AC-F6-1 | `tests/conformance/mock-conformance.test.ts` | `bun test tests/conformance/mock-conformance.test.ts` | 3 providers × 3 flows green; per-adapter executed step and encountered gap; missing route fails; To Implement |
| TC-CONF-007 | AC-F1-2, AC-F2-1 | `tests/conformance/mock-conformance.test.ts`; github tenant | `bun test tests/conformance/mock-conformance.test.ts` | GitHub read matrix executes; writes skip `adapter-not-implemented`; primitive purity; projection mutation fails; To Implement |
| TC-CONF-008 | AC-F1-2, AC-F2-1 | `tests/conformance/mock-conformance.test.ts`; gitlab tenant | `bun test tests/conformance/mock-conformance.test.ts` | GitLab MR/pipeline reads execute; read-work-item and writes skip; dropped pipeline/closed-state mutation fails; To Implement |
| TC-CONF-009 | AC-F1-2, AC-F2-1 | `tests/conformance/mock-conformance.test.ts`; jira tenant | `bun test tests/conformance/mock-conformance.test.ts` | Jira read executes; provider-unsupported vs adapter-not-implemented exact; omission mutation fails; To Implement |
| TC-CONF-010 | AC-F2-1, AC-F2-2 | `tests/conformance/mock-conformance.test.ts`; `conformance/runner.ts` | `bun test tests/conformance/mock-conformance.test.ts` | Undeclared unsupported op fails; `no-declared-carrier` skip; skipped step never counts as executed; To Implement |
| TC-CONF-011 | AC-F2-2, AC-F5-1 | `tests/conformance/mock-conformance.test.ts`; `conformance/coverage.ts` | `bun test tests/conformance/mock-conformance.test.ts` | 100% supported executed, 100% gaps encountered; lost execution/stale gap/masked failure mutations fail; To Implement |
| TC-CONF-012 | AC-F2-3 | `tests/conformance/mock-conformance.test.ts`; jira tenant | `bun test tests/conformance/mock-conformance.test.ts` | Present comments vs absent (`!in`), no `[]` collapse, carrier declared-gap skip; To Implement |
| TC-CONF-013 | AC-F2-3, AC-F5-1 | `tests/conformance/mock-conformance.test.ts`; control adapters | `bun test tests/conformance/mock-conformance.test.ts` | Carrier control executes; empty-carrier control skips `no-declared-carrier`; controls unregistered; To Implement |
| TC-CONF-014 | AC-F4-2 | `tests/conformance/mock-conformance.test.ts`; `conformance/runner.ts` | `bun test tests/conformance/mock-conformance.test.ts` | Double replay deep-equal; injected clock/run id; failing diagnostic identical; To Implement |
| TC-CONF-015 | AC-F4-1 | `tests/conformance/mock-conformance.test.ts`; support fixtures | `bun test tests/conformance/mock-conformance.test.ts` | Throwing fetch 0 calls; exact URL; unfixtured request fails with method/URL; To Implement |
| TC-CONF-016 | AC-F5-2, AC-F6-2 | `tests/conformance/broken-adapter-control.test.ts` | `bun test tests/conformance/broken-adapter-control.test.ts` | Corruption fails naming provider/flow/step; unmodified passes; localized failure; To Implement |
| TC-CONF-017 | AC-F10-1, AC-F8-1 | `tests/conformance/broken-adapter-control.test.ts`; `conformance/runner.ts` | `bun test tests/conformance/broken-adapter-control.test.ts` | Diagnostic fields complete; canary/raw/header absent; injection mutation fails; To Implement |
| TC-CONF-018 | AC-F8-1 | `tests/conformance/artifact.test.ts`; `conformance/artifact.ts` | `bun test tests/conformance/artifact.test.ts` | Schema/fields/status/timestamp; malformed field mutations fail; mock/live share validator; To Implement |
| TC-CONF-019 | AC-F8-1 | `tests/conformance/artifact.test.ts`; `conformance/artifact.ts` | `bun test tests/conformance/artifact.test.ts` | ≤256 KiB; truncation; count caps; canary/header/raw rejection; To Implement |
| TC-CONF-020 | AC-F7-1, AC-F7-2, AC-F7-3 | `tests/conformance/artifact.test.ts`; `tests/conformance/live/live-entrypoint.test.ts` | `bun test tests/conformance/artifact.test.ts tests/conformance/live` | Status matrix 0/1/0; artifact in every status; mock in memory; To Implement |
| TC-CONF-021 | AC-F7-1, AC-F7-2 | `tests/conformance/live/live-entrypoint.test.ts`; `live/{config,run-live}.ts` | `bun test tests/conformance/live` | Empty env → `not-configured`, exit 0, missing names, artifact file; To Implement |
| TC-CONF-022 | AC-F7-1, AC-F7-3 | `tests/conformance/live/live-entrypoint.test.ts`; `live/run-live.ts` | `bun test tests/conformance/live` | Configured failure → `failed`, exit 1, artifact, unconfigured listed, no ticket; To Implement |
| TC-CONF-023 | AC-F9-1 | `tests/conformance/live/live-entrypoint.test.ts`; `live/run-live.ts` | `bun test tests/conformance/live` | All GET; POST guard fails; `live-read-only` deferral; counters 0; To Implement |
| TC-CONF-024 | AC-F7-5 | `tests/conformance/live/config.ts`; `live/live-entrypoint.test.ts`; secret-read | `bun test tests/conformance/live`; `bun run scripts/checks/secret-read-boundary.ts` | Non-secret config only; port-only token; no packages/*/src env read; To Implement |
| TC-CONF-025 | AC-F4-2, NFR-1 | `tests/conformance/live/live-entrypoint.test.ts`; testkit source scan | `bun test tests/conformance/live` | Identical artifacts from injected inputs; no ambient time/random/env; To Implement |
| TC-CONF-026 | AC-F7-1, AC-F7-4 | `tests/checks/conformance-workflow.test.ts`; `conformance-live.yml` | `bun test tests/checks/conformance-workflow.test.ts` | Triggers, permissions, SHA pins, secret scope, upload, Bun pin, timeout, no ticket; To Implement |
| TC-CONF-027 | AC-F7-4 | `tests/checks/conformance-workflow.test.ts` | `bun test tests/checks/conformance-workflow.test.ts` | Nine mutation families fail by location; unmodified passes; To Implement |
| TC-CONF-028 | AC-F7-5 | `tests/checks/secret-read-boundary.test.ts`; `scripts/checks/secret-read-boundary.ts` | `bun test tests/checks/secret-read-boundary.test.ts`; `bun run scripts/checks/secret-read-boundary.ts` | Exactly 4 entries; planted testkit reads fire; mutations fail closed; To Implement |
| TC-CONF-029 | AC-F7-5 | `tests/boundaries/**`; `.dependency-cruiser.cjs`; `testkit-exclusion`; `workspace-entrypoints` | `bun test tests/boundaries`; `bun run scripts/checks/testkit-exclusion.ts`; `bun run scripts/checks/workspace-entrypoints.ts` | node:* testkit negative; clean control; dev-only; no new subpath/edge; To Implement |
| TC-CONF-030 | NFR-9 | `tests/structure/content-inventory.test.ts`; `inventory.json` | `bun test tests/structure/content-inventory.test.ts` | Inventory equality; per-file allowances; missing-file/export mutations fail; To Implement |
| TC-CONF-031 | AC-F4-3 | `tests/checks/fixture-sanitization.test.ts`; conformance tenants; `placeholders.json` | `bun test tests/checks/fixture-sanitization.test.ts` | Zero findings; provenance; example hosts; declared placeholders; mutations fail; To Implement |
| TC-CONF-032 | AC-F6-2, NFR-4 | `scripts/checks/{ci-topology,ci-bindingness,ci-supply-chain}.ts`; `tests/checks/ci-checks.test.ts`; `ci.yml` | `bun run scripts/checks/ci-topology.ts`; `bun run scripts/checks/ci-bindingness.ts`; `bun run scripts/checks/ci-supply-chain.ts`; `bun test tests/checks/ci-checks.test.ts` | Exact job sets; no conformance job; SHA pins; review-time `ci.yml` diff empty; Semi-automated |
| TC-CONF-033 | AC-F6-1, NFR-9 | `package.json`; `pnpm-lock.yaml`; `bunfig.toml`; all suites | `bun test tests/conformance tests/structure tests/checks tests/boundaries`; `pnpm check`; `bun run scripts/checks/license-audit.ts`; `git diff --check` | Discovery includes conformance, not `run-live.ts`; aggregate green; zero new dependencies; To Implement |

### 7.2 Quality-Gate Checklist

Run narrow commands while iterating; run the aggregate gate only when the change is coherent. `pretest` runs `pnpm build`, so `pnpm test` and `pnpm check` use fresh package output; a bare `bun test` after a source change requires a prior `pnpm build`.

**During iteration (narrow):**

1. `bun test tests/conformance`
2. `bun test tests/conformance/mock-conformance.test.ts`
3. `bun test tests/conformance/broken-adapter-control.test.ts`
4. `bun test tests/conformance/artifact.test.ts`
5. `bun test tests/conformance/live`
6. `bun test tests/structure`
7. `bun test tests/checks`
8. `bun test tests/boundaries`
9. `bun run scripts/checks/ci-topology.ts`
10. `bun run scripts/checks/ci-bindingness.ts`
11. `bun run scripts/checks/ci-supply-chain.ts`
12. `bun run scripts/checks/secret-read-boundary.ts`
13. `bun run scripts/checks/testkit-exclusion.ts`
14. `bun run scripts/checks/workspace-entrypoints.ts`

**Before handoff (final):**

1. `pnpm install --frozen-lockfile`
2. `pnpm check` — lint → format:check → typecheck (with build) → test (with build) → check:boundaries → exports-parity
3. `bash scripts/.tests/test-doc-distribution.sh` when the doc-sync phase changes distributable docs
4. `git diff --check`
5. Review-time `ci.yml` byte-diff: `git diff --exit-code "$(git merge-base HEAD origin/main-tools)" -- .github/workflows/ci.yml`
6. Record every command and result in §10; never mark an unrun command as passing.

### 7.3 Implementation Notes and Gate Handoff

- **Testability contract for delivery:** the flow registry, step model, adapter registry, mock-tenant replay, runner, coverage gates, and artifact validator must be data-injected and free of ambient time, randomness, and environment access. The runner and coverage functions must accept an injected adapter list/registry so TC-CONF-010 and TC-CONF-013 can exercise controls without mutating production data.
- **Mock tenant loader:** keep fixture decoding in `tests/conformance/support/fixtures.ts`. Testkit source must not read the filesystem; the loader passes decoded data into testkit. Route matching is exact URL, and an unfixtured request throws with the method and URL.
- **Throwing-`fetch` guard:** reuse or mirror `tests/behaviour/providers/support.ts` (`installThrowingFetchGuard`) rather than duplicating a different guard. Restore `globalThis.fetch` in a `finally`.
- **Broken-adapter control:** implement the corrupting wrapper inside `tests/conformance/broken-adapter-control.test.ts` (or a test-only support helper that is never exported from testkit). Assert the failure names provider, flow, step, operation, and assertion; assert the unmodified client passes the same flow.
- **Carrier controls:** keep the carrier-declaring and empty-carrier controls test-only and inject them through the runner's adapter-list parameter. They must not appear in `packages/testkit/src/conformance/adapters.ts`.
- **Artifact writer:** expose a writer interface and a filesystem implementation at the live entrypoint boundary. Mock reports stay in memory; the live composition persists through the injected writer. The validator rejects unknown schema versions, missing fields, invalid statuses, and over-cap counts.
- **Live composition:** `tests/conformance/live/run-live.ts` should export a testable `main`/`runLive` function with injected config, transport, credential port, clock, run id, and writer, plus a thin process wrapper that wires native `fetch`, the process credential port, and the output path. Exit codes are `0` for `passed`/`not-configured` and `1` for `failed`. The exact output flag is recorded in the implementation plan (OQ-B). `tests/conformance/live/live-entrypoint.test.ts` is test-only and adds no product surface; if delivery keeps the live tests inside another `*.test.ts` file, preserve the TC IDs and locations in this matrix.
- **Workflow contract test:** parse `.github/workflows/conformance-live.yml` with `yaml`; export `validateWorkflow(text)` and a root-based `validate(root)` so mutation controls can use temp copies. Mirror the existing `ci-checks.test.ts` style: live passes, each mutation fails by location. The existing `pin-equality` check covers four pin copies and does not scan the new workflow; TC-CONF-026 is the enforcement point for the new workflow's Bun pin (DEC-15).
- **`ci.yml` byte-unchanged:** the permanent suite asserts exact job sets and the absence of a conformance job. The byte-identical claim is change-scoped review evidence: `git diff --exit-code "$(git merge-base HEAD origin/main-tools)" -- .github/workflows/ci.yml`, recorded in §10. Do not add a permanent branch-diff assertion (testing-strategy invariant rule).
- **Inventory and allowances:** add every new `packages/testkit/src/conformance/*.ts` file to `tests/structure/inventory.json` and its exported functions/values to the per-file `EXECUTABLE_ALLOWANCES` in `tests/structure/content-inventory.test.ts`. Do not add a global executable switch.
- **Fixtures and placeholders:** keep tenants under `tests/fixtures/providers/conformance/{provider}/tenant.json`; reuse declared placeholders; add any new placeholder token to `placeholders.json` in the same change; keep every JSON valid and provenance-marked.
- **Non-vacuity controls (must be implemented, not stubbed):** duplicate flow/step id; unknown operation; missing operation; extra flow; wrong contract binding; unregistered `*_ADAPTER_CONTRACT`; dangling registration; removed supported-operation step; removed declared-gap step; declared carrier without carrier step; empty registry/flow/step; undeclared unsupported operation; `no-declared-carrier` branch; lost executed step; stale gap; masked failure; missing tenant route; near-miss URL; corrupt normalized outcome; injected raw payload/secret in diagnostics/artifact; oversized failure; over-cap counts; invalid artifact status/version/field; POST request; non-read supported step; missing writer on failure; each workflow mutation in TC-CONF-027; planted testkit env read; node:* testkit import; missing inventory entry; undeclared executable export; fixture without provenance; non-example host; undeclared placeholder; stale placeholder.
- **Gate handoff commands to record in §10:** `pnpm install --frozen-lockfile`; `pnpm build`; `bun test tests/conformance`; `bun test tests/conformance/mock-conformance.test.ts`; `bun test tests/conformance/broken-adapter-control.test.ts`; `bun test tests/conformance/artifact.test.ts`; `bun test tests/conformance/live`; `bun test tests/structure/conformance-coverage.test.ts`; `bun test tests/checks/conformance-workflow.test.ts`; `bun test tests/checks/fixture-sanitization.test.ts`; `bun test tests/checks/secret-read-boundary.test.ts`; `bun test tests/checks/ci-checks.test.ts`; `bun run scripts/checks/secret-read-boundary.ts`; `bun run scripts/checks/ci-topology.ts`; `bun run scripts/checks/ci-bindingness.ts`; `bun run scripts/checks/ci-supply-chain.ts`; `bun run scripts/checks/testkit-exclusion.ts`; `bun run scripts/checks/workspace-entrypoints.ts`; `bun test tests/boundaries`; `pnpm check`; `git diff --check`; `bash scripts/.tests/test-doc-distribution.sh` (docs phase); and the review-time `ci.yml` diff.
- **Do not record unrun evidence as passing.** If the implementation plan renames files, preserve TC IDs and update only locations/commands.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

- **The live tier is evidence, not a gate.** A green scheduled run does not prove merge safety, and a red run does not block a PR (ADR-0003, DEC-4). The mock suite and coverage gates are the merge evidence; TC-CONF-020/026 keep the live workflow from becoming a hidden gate.
- **No live credentials in CI PRs.** The workflow must have no `pull_request` trigger and token secrets scoped to the scheduled/dispatch job. TC-CONF-026/027 enforce this; a future trigger change is a review-blocking workflow mutation.
- **Tenant availability is not guaranteed.** Before tenants exist, every run is `not-configured` and exits `0`; repeated `not-configured` runs prove nothing about provider shape (RSK-2). The artifact names missing variables, and OQ-A in the spec tracks tenant ownership.
- **`run-live.ts` is not discovered by `bun test`.** The entrypoint is intentionally outside `*.test.ts` discovery. TC-CONF-021 spawns it once for the not-configured path, and the live composition tests exercise the injectable function; a structural check should assert the file exists and is referenced by the workflow. Otherwise a rename could silently disable live evidence.
- **Artifact redaction is canary-based.** TC-CONF-017/019 prove the named shapes (token, header, email, avatar, raw payload, canary) are rejected; a novel secret format or a secret in an allowed string field could pass. The schema excludes raw payloads and headers, and the credential port is the only token path; residual risk is accepted (RSK-6).
- **Timing thresholds are environment-sensitive.** The mock ≤60 s budget is recorded as measured evidence, not a hard in-test assertion that could flake on a slow runner. The live ≤10 min bound is enforced by the workflow `timeout-minutes: 10` and asserted structurally. A hard wall-clock test would be a flaky permanent assertion (RSK-10).
- **Count caps are delivery-defined.** The spec requires bounded counts but gives no numbers (OQ-A). The validator must publish finite caps and the tests must reject over-cap synthetic reports; without that, AC-F8-1's bound clause would be under-evidenced.
- **`ci.yml` byte-unchanged is change-scoped.** A permanent test cannot assert "unchanged vs a moving base" (testing-strategy invariant rule). The topology test asserts the exact job set; the byte-diff is recorded at review time. A later change that edits `ci.yml` is outside this plan.
- **Placeholder registry churn.** Adding a new conformance placeholder without a registry update fails the audit; adding an unused placeholder fails the usage test. The tenant author must keep the registry and fixtures in sync (TC-CONF-031).
- **Test-only controls could leak into the production registry.** The carrier and broken-adapter controls must be injected through the runner's adapter list, never appended to `packages/testkit/src/conformance/adapters.ts`. TC-CONF-013/016 assert the production registry stays at three.
- **Narrow `bun test` without a build can use stale `dist`.** Conformance tests import testkit through the package surface; run `pnpm build` before narrow cycles or use `pnpm test`/`pnpm check`, which run `pretest`/`pretypecheck`.
- **The sanitization audit is pattern-based.** A tenant with a live-looking but allowed example host could pass; provenance, example-only hosts, declared placeholders, and review are the layered mitigation. Live tenant identifiers are not mechanically distinguishable from synthetic ones by shape alone.

### 8.2 Assumptions

- The change specification is the single source of truth; no flow, operation, skip reason, artifact field, or workflow property is invented beyond the spec, ticket, DEC-1..DEC-15, and the shipped capability contracts.
- The three GH-188 read slices remain the only shipped provider contracts during M0; a new contract activates the registration gate.
- The injected `ProviderTransport` and `CredentialPort` remain the construction seams; no production client requires a module-level transport or credential.
- `bun test` discovery (`bunfig.toml`, `tests/**/*.test.ts`) remains the CI test entry; `ts-test` and `ts-aggregate` continue to run it.
- Example-only hosts accepted by the sanitization audit are sufficient for mock tenants.
- Live scratch tenants remain manually provisioned; until then the live run records `not-configured`.
- The workflow can reference repository variables and secrets for scheduled/dispatch runs, and the artifact upload action/retention policy is available on the repository plan.
- The testkit root export can gain conformance helpers without a new subpath or package export change.
- The exact live output flag is delivery-defined; the plan proposes `--out "$OUT"` and records the actual spelling in OQ-B.
- No license headers are added manually; change artifacts are header-free.

### 8.3 Open Questions

| Item | Owner / timing | Blocking? |
|---|---|---|
| OQ-A: **Artifact count caps.** The spec bounds provider/flow/step counts but gives no numeric caps. Delivery must export finite caps from the artifact module and assert over-cap rejection; record the numbers in the feature spec at doc-sync. | Plan writer / delivery / doc-syncer | Not blocking; TC-CONF-019 tests the mechanism and the explicit 256 KiB size bound. |
| OQ-B: **Live entrypoint output path.** The spec says "with an output path" but does not pin the flag or env name. The plan proposes `--out "$OUT"`; record the actual spelling and wire it in the workflow. | Delivery | Not blocking; TC-CONF-021 uses the recorded invocation. |
| OQ-C: **Provider result status enum.** The artifact shape names provider status and missing settings but does not enumerate the provider-level status set. Delivery must export the closed set; tests assert membership against it. | Delivery | Not blocking; the overall status set (`passed`/`failed`/`not-configured`) is fixed by the spec. |
| OQ-D: **Live count of configured providers.** A run with at least one configured provider and no failures is `passed`, with unconfigured providers listed separately (DEC-12). The artifact shape should make "configured" distinguishable from `passed` per provider. | Delivery | Not blocking; TC-CONF-022 asserts the separation. |
| OQ-E: **Wall-clock evidence.** The mock ≤60 s budget is recorded, not hard-asserted, to avoid a flaky permanent test. Confirm the review accepts measured evidence plus the existing CI job timeout. | @pm / @reviewer | Not blocking; the live ≤10 min bound is enforced structurally. |

No AC is left without a mapped test. All 22 spec ACs are traced and assertable; the open questions are threshold/CLI/config-shape details recorded rather than hidden. No blocking spec gap was found.

## 9. Plan Revision Log

| Version | Date (UTC) | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-10-31T19:20:00Z | Change Test Plan Writer | Initial plan: 33 test cases across structure/behaviour/artifact/live/checks/boundaries/aggregate; 22/22 spec-AC traceability; three-flow × three-adapter operation and step matrices; declared-gap skip exactness; structural and runtime coverage gates; broken-adapter and carrier controls; `delivery.conformance.v1` schema/bounds/status/exit matrix; live not-configured/failed/read-only/determinism; scheduled-workflow contract and mutation controls; secret-read, testkit confinement, inventory, fixture sanitization, CI topology, and aggregate gates; conformance tenant data plan and placeholder-registry update; no execution claimed. |

## 10. Test Execution Log

Populated during execution. Do not record unrun evidence as passing.

| TC ID / gate | Run Date (UTC) | Result | Notes / command / HEAD |
|---|---|---|---|
| TC-CONF-001 | — | — | `bun test tests/structure/conformance-coverage.test.ts` |
| TC-CONF-002 | — | — | same |
| TC-CONF-003 | — | — | same |
| TC-CONF-004 | — | — | same |
| TC-CONF-005 | — | — | same |
| TC-CONF-006 | — | — | `bun test tests/conformance/mock-conformance.test.ts`; record wall clock |
| TC-CONF-007 | — | — | same |
| TC-CONF-008 | — | — | same |
| TC-CONF-009 | — | — | same |
| TC-CONF-010 | — | — | same |
| TC-CONF-011 | — | — | same |
| TC-CONF-012 | — | — | same |
| TC-CONF-013 | — | — | same |
| TC-CONF-014 | — | — | same |
| TC-CONF-015 | — | — | same |
| TC-CONF-016 | — | — | `bun test tests/conformance/broken-adapter-control.test.ts` |
| TC-CONF-017 | — | — | same |
| TC-CONF-018 | — | — | `bun test tests/conformance/artifact.test.ts` |
| TC-CONF-019 | — | — | same |
| TC-CONF-020 | — | — | `bun test tests/conformance/artifact.test.ts tests/conformance/live` |
| TC-CONF-021 | — | — | `bun test tests/conformance/live`; spawned entrypoint |
| TC-CONF-022 | — | — | same |
| TC-CONF-023 | — | — | same |
| TC-CONF-024 | — | — | same; `bun run scripts/checks/secret-read-boundary.ts` |
| TC-CONF-025 | — | — | same |
| TC-CONF-026 | — | — | `bun test tests/checks/conformance-workflow.test.ts` |
| TC-CONF-027 | — | — | same |
| TC-CONF-028 | — | — | `bun test tests/checks/secret-read-boundary.test.ts`; `bun run scripts/checks/secret-read-boundary.ts` |
| TC-CONF-029 | — | — | `bun test tests/boundaries`; `bun run scripts/checks/testkit-exclusion.ts`; `bun run scripts/checks/workspace-entrypoints.ts` |
| TC-CONF-030 | — | — | `bun test tests/structure/content-inventory.test.ts` |
| TC-CONF-031 | — | — | `bun test tests/checks/fixture-sanitization.test.ts` |
| TC-CONF-032 | — | — | `bun run scripts/checks/ci-topology.ts`; `ci-bindingness.ts`; `ci-supply-chain.ts`; `bun test tests/checks/ci-checks.test.ts`; review-time `ci.yml` diff |
| TC-CONF-033 | — | — | `bun test tests/conformance tests/structure tests/checks tests/boundaries`; `pnpm check`; `git diff --check` |
| `ci.yml` byte-unchanged | — | — | `git diff --exit-code "$(git merge-base HEAD origin/main-tools)" -- .github/workflows/ci.yml` |
| Aggregate | — | — | `pnpm check` (pretest builds) |
