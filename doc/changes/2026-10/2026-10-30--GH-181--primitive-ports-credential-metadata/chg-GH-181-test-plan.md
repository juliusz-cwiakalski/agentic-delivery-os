---
id: chg-GH-181-test-plan
status: Updated
created: 2026-10-30T20:14:11Z
last_updated: 2026-10-30T20:22:26Z
owners: [engineering]
service: delivery-os adapter contracts
labels: [change, planning]
version_impact: minor
summary: "Verify the nine v1 primitive ports with capability/gap flags, one credential port that never leaks secrets, a binding secret-read boundary invariant, the embedded metadata envelope round-trip and degradation matrix, and bidirectional error-table sync."
links:
  change_spec: ./chg-GH-181-spec.md
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - M0-S12: Primitive ports, credential port, and embedded metadata

## 1. Scope and Objectives

Protect the adapter-era contract substrate: the exact v1 typed primitive set, structural capability/gap declarations, centralized credential resolution, a mechanically binding secret-read boundary, and a metadata envelope that round-trips through declared carriers and degrades visibly instead of failing. The highest risks are (a) a contract surface that silently drifts beyond the v1 set or acquires runtime behavior, (b) a secret escaping through diagnostics, logs, errors, or metadata, (c) a boundary check that passes vacuously or is advisory in CI, and (d) metadata becoming a correctness dependency instead of an optimization of provenance reliability. This plan is a design and implementation map, not an execution claim.

### 1.1 In Scope

- The seventeen spec acceptance criteria (AC-F1-1 through AC-F6-1, including AC-F5-6) and their linked functional capabilities, DM interfaces, and NFR thresholds.
- The exact nine catalogue primitives typed at M0 plus the ticket-mandated credential port and metadata envelope; fail-closed inventory in both directions.
- Runtime-neutral contracts-tier purity, typed capability flags and explicit gap records, and carrier selection restricted to declared carrier kinds.
- Credential resolution through one port with an injectable environment source, the classified `config.credential.missing` failure, and the no-implementation-mode surface.
- The new AST secret-read boundary invariant: planted violations, clean controls, CI and local-chain bindingness, allowlisted-entry mutation, and non-vacuity proofs.
- Envelope codec behavior: golden round-trip across declared carriers, parse-and-strip, the six-case degradation matrix, closed payload schema, brand-neutral constants, and the adapter-only write path.
- Bidirectional error-table synchronization with the new row and unchanged existing classification behavior.

### 1.2 Out of Scope & Known Gaps

- No credential-sidecar implementation, mediated-mode code, sidecar transport, token issuance/revocation, or provider adapters (spec NG-1, NG-2).
- No typing of catalogue primitives outside the v1 set (harness, queue/scheduling, state/audit, non-adapter context primitives) (spec NG-3).
- No metadata retention/cleanup policy, local event-log mirroring, emitter-side privacy scan (M0-S15), or gate-battery provenance consumption (M0-S9) (spec NG-4, NG-5).
- No network, no vendor API, no real secrets, no real `$HOME`, and no dependency on a developer workstation environment.
- The implementation plan was absent at authoring time. When it lands, reconcile file locations and keep every TC ID and AC trace intact.
- Testability gaps that are not silently patched are recorded in §8.3: the exact v1 envelope constants and the type-level test mechanism. The iteration-2 spec amendment resolved the version window (DEC-7), the reason taxonomy (DEC-8), and codec placement (DEC-9).

## 2. References

- [Change specification](./chg-GH-181-spec.md) v1.1 (iteration 2), especially §§5, 6, 8.3 (DM-1 to DM-10 and contract rules), 9 (NFR-1 to NFR-7), 11 (RSK-1 to RSK-7), 14 (OQ-1 to OQ-3), 15 (DEC-1 to DEC-9), 17 (17 ACs including AC-F5-6), 18 (open-PR Definition of Done), and the appendix ticket traceability.
- [Repository testing strategy](../../../../.ai/rules/testing-strategy.md); [TypeScript workspace rules](../../../../.ai/rules/typescript.md); [AGENTS.md](../../../../AGENTS.md).
- Existing invariant style and infrastructure: `scripts/checks/ambient-globals.ts`, `scripts/checks/error-table-sync.ts`, `scripts/checks/ci-topology.ts`, `scripts/checks/ci-bindingness.ts`, `scripts/checks/boundary-ci-parity.ts`, `scripts/checks/workspace-entrypoints.ts`, `tests/boundaries/**`, `tests/checks/**`.
- Current system contracts: [feature-result-contract.md](../../../spec/features/feature-result-contract.md), [feature-config-layer.md](../../../spec/features/feature-config-layer.md), [feature-branding-seam.md](../../../spec/features/feature-branding-seam.md), and [feature-monorepo-scaffold-toolchain.md](../../../spec/features/feature-monorepo-scaffold-toolchain.md).
- Delivery precedent for shape and gate handoff: [chg-GH-173-test-plan.md](../2026-10-30--GH-173--config-layer/chg-GH-173-test-plan.md).
- No implementation plan is linked yet; plan reconciliation is an explicit open task in §8.

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| Capability | AC | TC(s) | Status |
|---|---|---|---|
| F-1 | AC-F1-1 | TC-PORT-001 | Planned |
| F-1 | AC-F1-2 | TC-PORT-002 | Planned |
| F-2 | AC-F2-1 | TC-PORT-003 | Planned |
| F-2 | AC-F2-2 | TC-PORT-004 | Planned |
| F-3 | AC-F3-1 | TC-PORT-005, TC-PORT-008 | Planned |
| F-3, F-6 | AC-F3-2 | TC-PORT-006 | Planned |
| F-3 | AC-F3-3 | TC-PORT-007 | Planned |
| F-4 | AC-F4-1 | TC-SECRET-001 | Planned |
| F-4 | AC-F4-2 | TC-SECRET-002 | Planned |
| F-4 | AC-F4-3 | TC-SECRET-003, TC-SECRET-004 | Planned |
| F-5 | AC-F5-1 | TC-META-001 | Planned |
| F-5 | AC-F5-2 | TC-META-002 | Planned |
| F-5 | AC-F5-3 | TC-META-003, TC-META-006 | Planned |
| F-5 | AC-F5-4 | TC-META-004 | Planned |
| F-2, F-5 | AC-F5-5 | TC-META-005 | Planned |
| F-5 | AC-F5-6 | TC-META-006 | Planned |
| F-6 | AC-F6-1 | TC-ERR-001 | Planned |

All seventeen ACs have at least one test case. No AC is marked TODO; the single partial-coverage note (value-level metadata secret scanning, M0-S15) is recorded as a gap in §8.3 rather than hidden.

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

The spec declares no API-* endpoints and no EVT-* messages; §8.1 and §8.2 confirm there is no network or event surface. Diagnostics and degradation evidence are returned view state, not events.

| Interface | TC IDs | Observable assertion |
|---|---|---|
| DM-1 `ExternalSystemInstance` | TC-PORT-001, 005, 006, 008 | Instance identity and auth method are typed data; the auth method references credentials, never inline secret material. |
| DM-2 `AdapterContract` | TC-PORT-003, 004, 005 | Capability flags and gap records are typed data; no declaration implies parity beyond its flags. |
| DM-3 `WorkItem` | TC-PORT-001, TC-META-003, 005 | Normalized view fields survive parse/strip; degraded reads still return a primitive view. |
| DM-4 `WorkflowMap` | TC-PORT-001 | Status alias and transition-mechanism kind are typed contract data only. |
| DM-5 `WorkItemRelation` | TC-PORT-001 | Relation kinds are a closed typed set. |
| DM-6 `DeliveryRequest` | TC-PORT-001, TC-META-001, 005 | PR/MR view contract and envelope linkage round-trip. |
| DM-7 `PipelineRun` | TC-PORT-001 | Pipeline, job, and trace evidence are typed; no bare status color. |
| DM-8 `RetryPolicy` + `IdempotencyKey` | TC-PORT-001 | Only known-safe retries are representable; unsafe writes carry no retry policy. |
| DM-9 credential reference and resolution result | TC-PORT-005, 006, 007, 008 | Declared reference resolves to material or the classified failure; no implementation mode. |
| DM-10 metadata envelope v1 | TC-META-001 through TC-META-006, TC-PORT-004 | Closed payload, declared carriers, round-trip, strip, degradation evidence, brand-neutral constants. |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR | TC IDs | Gate / assertion |
|---|---|---|
| NFR-1 contracts-tier neutrality | TC-PORT-001, 002, 008, TC-META-004 | Ambient-globals guard, declaration-only AST scan, no runtime imports, aggregate `pnpm check`. |
| NFR-2 secret centralization | TC-PORT-005, 006, 008, TC-SECRET-001, 003, 004 | 0 non-allowlisted ambient environment reads; exactly one credential-material entry; planted violation fires. |
| NFR-3 CI bindingness | TC-SECRET-002 | Invariant is a binding CI step with no bypass constructs; local boundary chain includes it. |
| NFR-4 envelope boundedness | TC-META-001, 004 | Every golden case is within the v1 bound (target ≤ 2048 bytes); metadata never displaces human content. |
| NFR-5 degradation totality | TC-META-003, 006 | 0 flow failures across the matrix; 100% carry visible evidence naming one of the four mechanically detectable reasons (`missing`, `malformed`, `wrong-kind`, `unknown-version`). |
| NFR-6 compatibility and sync | TC-ERR-001 | Bidirectional error-table sync green; existing kind-only classification unchanged; pre-existing gates green. |
| NFR-7 fixture discipline | TC-SECRET-001, 003, 004 | At least one failing negative fixture for the new invariant and the allowlist change; non-vacuity proven. |

## 4. Test Types and Layers

- **Unit / behaviour:** `bun:test` under `tests/behaviour/**`. Exercise the production port contracts, the pure envelope codec imported from the adapters-internal shared module (DEC-9; testkit may import adapters under the dev-edge rule, never the surfaces), fixture adapters, and injected environment source. No duplicate implementation of the logic under test.
- **Contract / structure:** `bun:test` under `tests/structure/**` with TypeScript AST parsing and committed inventory fixtures. Assert the exact v1 export surface, neutral-tier declarations, closed envelope schema, brand-neutral constants, and error-table row identity. Envelope data contracts stay in core `./contracts` as types and `as const` data only; the pure codec is asserted to live in the adapters-internal module with no new core subpath (DEC-9).
- **Static invariants:** `scripts/checks/*.ts` invoked by `bun run`; mutation-tested by `tests/checks/**`. The new secret-read boundary follows the ambient-globals guard style: exported `scan`/`validate`, an enumerated allowlist, fail-closed output naming rule/file/line, and a read-only live-tree run.
- **Boundary negative fixtures:** `tests/boundaries/**` for any new dependency-cruiser rule, new declared subpath, or fixture-coverage requirement. Fixtures live in temp workspaces (`mkdtemp`) and are never named `*.test.ts`.
- **Integration:** fixture adapters through the ports, injected environment records, and temp-rooted repositories. No external API and no network.
- **Manual / semi-automated:** documentation review of the sidecar adoption constraint and the exact v1 constants recorded at delivery (TC-PORT-007, TC-META-004). Everything mechanically verifiable is automated.
- **Type-level:** carrier-exclusion typing (TC-PORT-004) needs a typecheck-visible probe. Because the root `tsconfig.json` currently references only the six packages, a type-test project or equivalent compile step must be added or the typing half of AC-F2-2 remains unproven. This is flagged in §8.3.
- **Gate handoff (not run by this writer):** after `pnpm install --frozen-lockfile`, run `pnpm build` before dist-dependent suites; then `bun test tests/structure tests/behaviour tests/checks tests/boundaries`, `bun run scripts/checks/ambient-globals.ts`, `bun run scripts/checks/error-table-sync.ts`, the new secret-read check, `bun run scripts/checks/ci-topology.ts`, `bun run scripts/checks/ci-bindingness.ts`, `pnpm check:boundaries`, and `pnpm check`. Record exact commands, SHA, and results in §10.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Impact | Priority | AC |
|---|---|---|---|---|---|
| TC-PORT-001 | v1 contract surface inventory | Contract | Critical | High | AC-F1-1 |
| TC-PORT-002 | Neutral-tier purity | Contract | Critical | High | AC-F1-2 |
| TC-PORT-003 | Capability flags and explicit gaps | Unit | Critical | High | AC-F2-1 |
| TC-PORT-004 | Declared-carrier typing | Contract | Critical | High | AC-F2-2 |
| TC-PORT-005 | Credential success without leaks | Unit | Critical | High | AC-F3-1 |
| TC-PORT-006 | Missing credential classified | Negative | Critical | High | AC-F3-2 |
| TC-PORT-007 | No implementation mode | Contract | Critical | High | AC-F3-3 |
| TC-PORT-008 | Declared reference and brand-neutral key | Unit | Important | High | AC-F3-1 |
| TC-SECRET-001 | Planted violation fires | Negative | Critical | High | AC-F4-1 |
| TC-SECRET-002 | Binding CI and local chain | Contract | Critical | High | AC-F4-2 |
| TC-SECRET-003 | Allowlist mutations fail closed | Negative | Critical | High | AC-F4-3 |
| TC-SECRET-004 | Non-vacuity and fixture coverage | Regression | Critical | High | AC-F4-3 |
| TC-META-001 | Golden carrier round-trip | Happy Path | Critical | High | AC-F5-1 |
| TC-META-002 | Parse and strip | Happy Path | Critical | High | AC-F5-2 |
| TC-META-003 | Degradation matrix | Edge Case | Critical | High | AC-F5-3 |
| TC-META-004 | Closed payload and neutral constants | Negative | Critical | High | AC-F5-4 |
| TC-META-005 | Adapter-only write path | Contract | Critical | High | AC-F5-5 |
| TC-META-006 | Version window and unknown-version degradation | Edge Case | Important | Medium | AC-F5-3, AC-F5-6 |
| TC-ERR-001 | Error-table sync and unchanged classification | Regression | Critical | High | AC-F6-1 |

### 5.2 Scenario Details

#### TC-PORT-001 - v1 contract surface inventory

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, DM-1, DM-2, DM-3, DM-4, DM-5, DM-6, DM-7, DM-8, DM-9, DM-10, NFR-1
**Test Type(s)**: Contract, Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/port-contract-inventory.test.ts`, `tests/fixtures/ports/v1-contract-inventory.json`
**Tags**: @backend

**Preconditions**:

- The contracts tier exports the nine v1 primitives (`ExternalSystemInstance`, `AdapterContract`, `WorkItem`, `WorkflowMap`, `WorkItemRelation`, `DeliveryRequest`, `PipelineRun`, `RetryPolicy`, `IdempotencyKey`) plus the credential-port and metadata-envelope types.
- The inventory fixture is the exact expected set, independent of whatever the source currently exports.

**Steps**:

1. Parse `packages/core/src/contracts/**` with the TypeScript AST; collect every exported type, interface, and `as const` value; compare both directions with the fixture.
2. Assert the nine primitive names are exactly the catalogue PascalCase names; assert no numeric-leading or numeric-only identifier; assert the credential port and envelope are present exactly once.
3. In a temp copy, remove one primitive declaration and assert the inventory fails naming the missing contract.
4. In a temp copy, add `Compensation`, a harness primitive, or an extra port and assert the inventory fails naming the extra contract.
5. Run the live-tree control and assert it passes.

**Expected Outcome**:

- The delivered contract surface equals the fixture exactly in both directions; all nine names are catalogue-qualified and non-numeric; adding or removing any primitive fails by name; the credential port and envelope are not miscounted as catalogue primitives.

#### TC-PORT-002 - Neutral-tier purity

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-2, NFR-1
**Test Type(s)**: Contract, Static
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/port-neutrality.test.ts`, `tests/structure/content-inventory.test.ts`, `tests/boundaries/**`
**Tags**: @backend

**Preconditions**:

- New contracts files are inside the ambient-globals neutral set (`packages/core/src/contracts/**`).
- `content-inventory` allowances and `tests/structure/inventory.json` are updated for any new source file.

**Steps**:

1. Run `scan(process.cwd())` from `scripts/checks/ambient-globals.ts`; assert zero violations in the new contract files.
2. Parse each new contracts file and assert only type/interface/import/export declarations and `as const` variable statements are present; reject functions, classes, top-level executable statements, and runtime imports (`node:*`, `bun:*`).
3. Assert no `process`, `Bun`, `Deno`, `fetch`, timers, `Date.now`, or `Math.random` enter the contracts tier.
4. In a temp contract file, inject `process.env`, `Date.now()`, and a function declaration; assert the ambient/declaration checks fail naming file and line; the clean control passes.
5. In gate handoff, run `pnpm check` and `bun run scripts/checks/ambient-globals.ts`; assert the aggregate and neutral-tier guards are green.

**Expected Outcome**:

- Contracts contain types and `as const` data only; 0 ambient environment, I/O, clock, or randomness accesses; mutations fail by file and line; the aggregate check is green.

#### TC-PORT-003 - Capability flags and explicit gaps

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-1, DM-2
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/port-capabilities.test.ts`, `tests/fixtures/ports/capabilities.ts`
**Tags**: @backend

**Preconditions**:

- Fixture adapters in the dev-only harness declare operations and carriers through typed flags.
- At least one fixture declares an explicit gap for an operation it does not support; another declares all supported operations as a positive control.

**Steps**:

1. Inspect the fixture declarations: capabilities are typed flags, gaps are explicit records (operation plus reason), and no capability is described only in prose.
2. Present an operation that the fixture did not declare; assert the adapter represents it as an explicit gap, not a success and not a silent parity assumption.
3. For every operation absent from the flag set, assert a gap record exists or the absence is itself the machine-readable gap; assert no implied parity.
4. Remove a gap record in a temp declaration and assert the scenario fails because the undeclared operation no longer has an explicit representation.
5. Run the fully declared positive control and assert it still reports no gaps for declared operations.

**Expected Outcome**:

- Capabilities and gaps are typed data; an undeclared operation is representable as an explicit gap; no declaration implies parity beyond its flags; removing a gap is detectable.

#### TC-PORT-004 - Declared-carrier typing

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-2, DM-10
**Test Type(s)**: Contract, Unit
**Automation Level**: Automated (runtime) and Semi-automated (type probe)
**Target Layer / Location**: `tests/structure/port-carrier-types.test.ts`, `tests/behaviour/port-capabilities.test.ts`, `tests/types/port-carrier-types.type-test.ts`
**Tags**: @backend

**Preconditions**:

- Fixture adapters declare subsets of the three carrier kinds (invisible comment block, provider custom field, compact marker fallback).
- A type-level probe exists that is included in a typecheck step; see §8.3 for the current root-tsconfig limitation.

**Steps**:

1. Runtime: select each declared carrier and assert success; select an undeclared carrier and assert a typed rejection or declared-gap result, never silent coercion.
2. Type-level: assert the selection input is constrained to the adapter's declared carrier union; an undeclared literal is a compile error in a dedicated type fixture with a one-line reason.
3. Assert `CARRIER_KINDS` is a closed `as const` set and the selection function has no `string` escape hatch.
4. In a temp declaration, widen the carrier union to `string` and assert the type/contract test fails.

**Expected Outcome**:

- Only a declared carrier kind is selectable; undeclared carriers are excluded by typing and rejected at runtime; widening the union is detectable.

#### TC-PORT-005 - Credential success without leaks

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1, DM-9, NFR-2
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/credential-port.test.ts`, `tests/fixtures/credentials/cases.ts`
**Tags**: @backend

**Preconditions**:

- A declared credential reference maps explicitly to an injected environment record key.
- The environment record contains a unique canary secret; no real secret or host environment is used.
- A capture sink records everything the fixture adapter emits as diagnostics, logs, or errors.

**Steps**:

1. Resolve the declared reference through the credential port; assert success and assert the secret material is returned exactly once through the port result.
2. Capture every diagnostic, log, and error payload; assert the canary is absent in raw form and in JSON-escaped/backslash forms.
3. Mutate the real host `process.env` in the test and assert resolution is unaffected; only the injected record is consulted.
4. Resolve the same reference twice and assert deterministic output.
5. Assert the success result exposes no duplicate secret copy (no secret in metadata, labels, or diagnostic fields).

**Expected Outcome**:

- Secret material is returned once through the port result; it never appears in diagnostics, logs, or error payloads; resolution is injected, deterministic, and free of ambient reads.

#### TC-PORT-006 - Missing credential classified

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-6, AC-F3-2, DM-9
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/credential-port.test.ts`, `tests/behaviour/error-classification.test.ts`
**Tags**: @backend

**Preconditions**:

- Declared references whose injected source key is absent and whose value is the empty string.
- The existing classification chain and `config.credential.missing` row are present.

**Steps**:

1. Resolve the absent-key reference; assert the failure carries exactly `config.credential.missing`.
2. Assert the failure fields: domain kind `config`, category `user`, retryable `false`, consequence `not_landed`, projection `user-validation` (standalone exit 1).
3. Resolve the empty-value reference; assert the same identity.
4. Run the failure through the existing classification chain; assert it never resolves to `fallback.internal` or `fallback.invocation`.
5. Assert the error payload contains no secret canary and no environment dump.
6. Confirm kind-only `config` lookup still throws (no first-row fallback) and provider/input kind-only singletons remain unchanged.

**Expected Outcome**:

- Absent or empty credentials always return the classified user/non-retryable/not-landed/user-validation failure; containment never occurs; no secret leaks; existing config kind discipline is unchanged.

#### TC-PORT-007 - No implementation mode

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-3, DM-9
**Test Type(s)**: Contract, Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `tests/structure/port-credential-surface.test.ts`, `tests/structure/port-contract-inventory.test.ts`
**Tags**: @backend

**Preconditions**:

- The credential port type and the documented sidecar adoption path are delivered.
- The environment-backed implementation is outside `core/src/contracts` in the adapters I/O tier.

**Steps**:

1. Inspect the credential port type with the TypeScript AST; assert there is no `mode`, `implementation`, `mediated`, or `direct` discriminant, and no environment-specific (`node:*`/`bun:*`/`process.env`) type in the contracts surface.
2. Assert the env-backed implementation path is outside the contracts tier and that contracts imports no runtime API.
3. Review the documented sidecar adoption path; assert it states the interface is unchanged and mediated execution is a second implementation, with no mediated code in this change.
4. In a temp copy of the port type, inject `mode: "direct" | "mediated"` and assert the surface test fails; the clean control passes.

**Expected Outcome**:

- The port exposes no implementation mode or environment-specific typing; the sidecar path is documented as a second-implementation constraint; injecting a mode is detectable.

#### TC-PORT-008 - Declared reference and brand-neutral key

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-3, AC-F3-1, AC-F3-3, DM-9, NFR-1
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/credential-port.test.ts`, `tests/structure/credential-constants.test.ts`
**Tags**: @backend

**Preconditions**:

- A declared reference carries an explicit source-key mapping; the branding seam supplies the environment prefix.
- The forbidden-literals registry and branding contract tests are available.

**Steps**:

1. Resolve with the declared mapping; change the external system name without changing the reference and assert the source key does not change (no guessing from system names).
2. Assert any product-prefixed source key derives from `BrandIdentity.environmentPrefix`, not a literal token.
3. Run the forbidden-literals scan against contracts and the credential constants; assert no `ados`, `ADOS_`, or `~/.ados` token.
4. In a temp copy, replace the brand-derived prefix with a literal and assert the constant/forbidden-literal check fails; the clean control passes.
5. Assert the reference mapping is declarative data, not an algorithm that reads ambient environment.

**Expected Outcome**:

- The reference-to-source-key mapping is explicit and declared; brand-derived prefixes come from the seam; no hardcoded product token; the mapping is deterministic data.

#### TC-SECRET-001 - Planted violation fires

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, NFR-2, NFR-7
**Test Type(s)**: Static, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/secret-read-boundary.test.ts`, `scripts/checks/secret-read-boundary.ts`, `tests/fixtures/secret-boundary/cases.ts`
**Tags**: @backend

**Preconditions**:

- The new AST check exports `scan(root)`/`validate(root)` and a rule identifier, mirroring `ambient-globals.ts`.
- Fixture source strings are materialized only in a `mkdtemp` workspace, never under `packages/**` or as `*.test.ts`.
- The clean control contains only sanctioned reads: the credential implementation and the pre-existing configuration environment-source readers from the allowlist.

**Steps**:

1. Scan the clean control and assert zero violations.
2. Plant `process.env.SECRET` in a provider adapter module (for example a fixture `packages/adapters/src/github/provider.ts`) and assert the check fails naming rule, file, and exact line.
3. Add AST-coverage variants in separate temp trees: `Bun.env`, `Deno.env`, bracket access, optional chaining, and a destructured environment read; assert each is either reported by the same rule or a documented unsupported form is rejected by a separate negative control. Do not silently accept a variant.
4. Remove the fixture and assert the clean control passes.
5. Run the live tree and assert zero violations and `git status --porcelain` is unchanged before and after (read-only check).

**Expected Outcome**:

- A planted ambient environment read fails CI naming rule, file, and line; the clean control passes; covered AST variants are intentional; the live-tree scan is read-only.

#### TC-SECRET-002 - Binding CI and local chain

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-2, NFR-3
**Test Type(s)**: Contract, Static
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/ci-checks.test.ts`, `tests/checks/boundary-ci-parity.test.ts`, `scripts/checks/ci-topology.ts`, `scripts/checks/ci-bindingness.ts`, `package.json`
**Tags**: @backend

**Preconditions**:

- The new check command (for example `bun run scripts/checks/secret-read-boundary.ts`) is added to the CI `ts-invariants` step beside the existing static invariants and to the local `check:boundaries` chain.
- `TS_JOBS` and the topology/bindingness checks are the binding surfaces.

**Steps**:

1. Run `ci-topology.validate(ROOT)` and assert zero failures; assert the new command appears in the workflow and in the declared local boundary chain. If a new job is used instead of a step, extend `TS_JOBS` and assert the job exists.
2. Run `ci-bindingness.validate(ROOT)` and assert zero failures.
3. In a temp workflow copy, inject `continue-on-error`, `|| true`, `set +e`, `if: always()`, or an `exit 0` wrap around the new step; assert the bindingness check fails naming the job and line.
4. In a temp workflow copy, remove the new command; assert the topology/parity check fails naming the missing command.
5. In a temp `package.json` copy, remove the new command from `check:boundaries`; assert the local-chain parity test fails.
6. Restore the live tree and assert the read-only controls still pass.

**Expected Outcome**:

- The invariant is a binding CI step and part of the local boundary chain; no bypass construct is accepted; removing the wiring fails by name; the live tree is not mutated.

#### TC-SECRET-003 - Allowlist mutations fail closed

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-4, AC-F4-3, NFR-2, NFR-7
**Test Type(s)**: Static, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/secret-read-boundary.test.ts`, `scripts/checks/secret-read-boundary.ts`, `tests/fixtures/secret-boundary/allowlist.ts`
**Tags**: @backend

**Preconditions**:

- The allowlist is an enumerated registry with exact paths and reasons: the environment-backed credential implementation, the file-tier parser host-switch guard, and the legacy-name adapter.
- Each entry carries a class such as `credential-material` or `configuration-environment-source`; exactly one entry is `credential-material`.

**Steps**:

1. Assert the live registry's exact entries, classes, and reasons; assert exactly one `credential-material` entry and that it is the credential implementation.
2. Mutation A: remove the credential implementation entry in a temp copy; assert the sanctioned read now fails (fail-closed).
3. Mutation B: add an undeclared provider credential path that reads `process.env`; assert the check fails naming the path.
4. Mutation C: add an allowlist entry without a reason; assert the registry-shape check fails.
5. Mutation D: add a second `credential-material` entry; assert the "sole credential entry" assertion fails.
6. Mutation E: add a wildcard or prefix entry; assert exact-path-only validation fails.
7. Assert all mutations run in temp copies and the live tree remains unchanged.

**Expected Outcome**:

- Removing an entry or adding an undeclared credential path fails closed; the registry requires reasons and exact paths; the credential implementation is the sole credential-material entry.

#### TC-SECRET-004 - Non-vacuity and fixture coverage

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-3, NFR-7
**Test Type(s)**: Static, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/secret-read-boundary.test.ts`, `tests/boundaries/fixture-coverage.test.ts`, `tests/fixtures/secret-boundary/cases.ts`
**Tags**: @backend

**Preconditions**:

- At least one failing fixture and one clean control exist; the fixture-coverage meta-check knows about the new rule.
- The scanner reports the number of scoped files so an empty scope cannot pass silently.

**Steps**:

1. Assert the live scan is non-vacuous: it scopes a non-zero number of production files and returns zero violations.
2. Assert a planted violation returns greater than zero violations and names the fixture path.
3. Assert the clean control is a real sanctioned read, not an empty tree; prove it by removing its allowlist entry in a temp copy and observing a failure.
4. Assert the fixture-coverage meta-check fails when the only negative fixture is deleted, when the registry entry is empty, and when the rule is downgraded to advisory.
5. In a temp copy, empty the allowlist; assert the live tree now fails because the sanctioned reads are no longer allowed; restoring the allowlist passes.

**Expected Outcome**:

- The invariant is proven non-vacuous; every new rule has a registered failing fixture; deleting fixtures or emptying the allowlist fails; the clean control is meaningful.

#### TC-META-001 - Golden carrier round-trip

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1, DM-10, NFR-4
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/envelope-roundtrip.test.ts`, `tests/fixtures/envelope/golden/**`, `packages/adapters/src/**` (adapter-internal envelope codec module per DEC-9; exact path set by delivery plan)
**Tags**: @backend

**Preconditions**:

- Canonical v1 provenance and linkage payloads: minimum, typical, maximum-field, and quoting/unicode edge cases.
- Every declared carrier kind has at least one golden case; the size-bound constant is recorded in the contract.
- The fixture adapter writes through the declared-carrier path.

**Steps**:

1. For each carrier kind and canonical payload, encode the envelope into the carrier and decode it back.
2. Assert deep logical payload equality after the documented normalization.
3. Assert every serialized envelope is within the v1 bound and that the bound constant is ≤ 2048 bytes.
4. Assert the raw carrier output still contains the original human-readable content unchanged; metadata is appended/embedded, never substituted.
5. Assert the matrix enumerates every value of `CARRIER_KINDS`; a missing carrier case fails the matrix.
6. In a temp copy, add a payload that exceeds the bound and assert the case fails by name; the canonical cases still pass.

**Expected Outcome**:

- 100% logical payload equality across declared carriers; every case is within the v1 bound; human content is never displaced; the matrix is exhaustive over carrier kinds.

#### TC-META-002 - Parse and strip

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-2, DM-10
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/envelope-roundtrip.test.ts`, `packages/adapters/src/**` (adapter-internal envelope codec module per DEC-9)
**Tags**: @backend

**Preconditions**:

- A carrier containing human-readable content and an embedded envelope.
- Expected original content is recorded independently of the parser.

**Steps**:

1. Parse the carrier and strip the envelope; assert the returned human-readable content is identical to the original minus the envelope.
2. Place the envelope at the beginning, middle, and end of a comment, and in a custom field; assert only the envelope is removed and no marker residue or extra blank line remains.
3. Re-parse the stripped content; assert no metadata is found and the view degrades with the `missing` reason and visible evidence (DEC-8: stripped and absent share `missing`).
4. Assert raw carrier text is available only through the audited escape hatch, not through the normal parse result.
5. In a temp copy, leave a marker in the stripped output and assert the test fails.

**Expected Outcome**:

- Parse-and-strip restores the original human content exactly; re-parsing finds no metadata; no marker residue; the raw carrier is not exposed on the normal path.

#### TC-META-003 - Degradation matrix

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-3, DM-10, NFR-5
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/envelope-degradation.test.ts`, `tests/fixtures/envelope/degradation/**`, `packages/adapters/src/**` (adapter-internal envelope codec module per DEC-9)
**Tags**: @backend

**Preconditions**:

- Six independent cases: metadata absent, malformed payload, wrong-kind payload, unknown schema version, stripped envelope, and human-edited comment. Absent and stripped are one observational case class sharing the `missing` reason; the human-edited case classifies as `malformed` or `missing` per what is mechanically detectable (DEC-8).
- Account identity facts are available for the heuristic fallback; a fixture adapter performs the read.
- A valid-envelope control is available.

**Steps**:

1. For each case, read through the fixture adapter; assert the flow succeeds with no thrown error and no failure result.
2. Assert the returned primitive view carries account-based heuristic provenance and a visible degradation evidence record whose reason is one of the four mechanically detectable values: `missing`, `malformed`, `wrong-kind`, `unknown-version`.
3. Assert the evidence distinguishes heuristic provenance from structural provenance; a degraded view must not masquerade as structural.
4. Assert the six input cases map onto the closed taxonomy: absent → `missing`; stripped → `missing` (same reason, not a separate value); malformed payload → `malformed`; wrong-kind payload → `wrong-kind`; unknown schema version → `unknown-version`; human-edited comment → `malformed` or `missing` per what is mechanically detectable.
5. Assert account-based heuristic fallback is identical across all cases: the same provenance shape and the same non-structural marker, with no case-specific fallback path.
6. Assert malformed metadata produces no error-table code and no `fallback.*` containment.
7. Run the valid-envelope control and assert structural provenance with no degradation evidence.
8. Assert the matrix count is 6/6 input cases (with absent and stripped sharing one reason value) with evidence and 0 flow failures; a missing case fails the matrix.

**Expected Outcome**:

- 0 degradation cases fail the flow; every case returns the primitive view with heuristic provenance and visible evidence naming one of the four mechanically detectable reasons; absent and stripped both report `missing`; the human-edited case reports `malformed` or `missing`; heuristic fallback is identical in every case; malformed metadata is not a failure; the valid control is clean.

#### TC-META-004 - Closed payload and neutral constants

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-4, DM-10, NFR-4
**Test Type(s)**: Contract, Static
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/envelope-contract.test.ts`, `tests/fixtures/envelope/schema-cases.json`
**Tags**: @backend

**Preconditions**:

- The v1 payload field set is closed: comment provenance (producing agent, operator authority) and delivery linkage (work-item identifier, run identifier).
- Carrier markers/namespaces are brand-neutral constants; the forbidden-literals scanner is available.
- A credential canary is available to prove the envelope is not fed from the credential result.

**Steps**:

1. Validate a canonical payload; assert unknown fields, missing required fields, and unknown nested fields are rejected, never silently stripped.
2. Assert the schema contains no secret/credential field names and no free-form environment or token field.
3. Build a primitive view while a credential canary is present in the injected environment; serialize the envelope and assert the canary and all credential material are absent.
4. Assert carrier markers/namespaces match the brand-neutral `delivery.*.v1` discipline and contain no product token; run the forbidden-literals scan.
5. In a temp copy, add an extra payload field and assert the closed-schema test fails; embed a product token in a marker and assert the constant/forbidden-literal test fails.

**Expected Outcome**:

- The payload schema is closed, admits no secret or credential field, and carries only provenance/linkage facts; markers are brand-neutral with zero hardcoded product tokens; mutations fail.

#### TC-META-005 - Adapter-only write path

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-5, AC-F5-5, DM-10
**Test Type(s)**: Contract, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/envelope-write-path.test.ts`, `tests/structure/envelope-contract.test.ts`, `tests/fixtures/ports/capabilities.ts`, `packages/adapters/src/**` (adapter-internal envelope codec module per DEC-9)
**Tags**: @backend

**Preconditions**:

- A fixture adapter declares the carriers it can write and read.
- An agent-facing primitive view type carries requested provenance; it does not expose raw carrier construction.
- The public export inventory and the pure codec surface are inspectable.

**Steps**:

1. Construct a primitive view as an agent would and assert the agent-facing type has no raw carrier, marker, or serializer field.
2. Ask the adapter to write metadata; assert it selects a declared carrier and succeeds.
3. Ask the adapter to write with an undeclared carrier; assert rejection as a declared gap.
4. Inspect the public `./contracts` surface and the adapters-internal codec module (DEC-9): assert core `./contracts` carries only envelope types and `as const` data (no serialize/parse/strip behavior, no new core subpath), the pure codec lives inside the adapters package, and no raw carrier builder or codec entry point is exported to agents; assert the codec requires a declared carrier and returns a typed envelope.
5. Assert the testkit dev-edge import is the only test-side access to the codec: testkit may import core and adapters, never the surfaces (cli/mcp/opencode), and no production cross-boundary edge is added.
6. In a temp export inventory, add a raw marker writer to the agent-facing surface or hoist the codec into a new core subpath; assert the surface/placement test fails.

**Expected Outcome**:

- The write path is adapter-only, uses a declared carrier, and no agent-facing contract exposes raw carrier construction; undeclared carriers are rejected; the pure codec stays adapter-internal with no new core subpath; an extra raw writer or codec hoist is detectable.

#### TC-META-006 - Version window and unknown-version degradation

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-5, AC-F5-3, AC-F5-6, DM-10, NFR-5
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/envelope-degradation.test.ts`, `tests/fixtures/envelope/versions/**`, `packages/adapters/src/**` (adapter-internal envelope codec module per DEC-9)
**Tags**: @backend

**Preconditions**:

- A v1 envelope (the only known schema version at delivery) and unknown-version fixtures for an older-than-v1 version string and a newer-than-v1 version string.
- DEC-7 defines the standing read window as current-plus-all-older; because no older version exists at delivery, any version string outside the known set binds to the visible-degradation path with the `unknown-version` reason. No separate older-version forward-compatible fixture is required at delivery.

**Steps**:

1. Parse the newer unknown-version fixture; assert graceful degradation with visible evidence naming the `unknown-version` reason, heuristic provenance, and no flow failure.
2. Parse the older-than-v1 unknown-version fixture; assert the same binding behavior — visible degradation naming `unknown-version`, heuristic provenance, and no flow failure (DEC-7: an older version outside the known set is not silently read forward-compatibly at delivery).
3. Assert an unknown version is never silently accepted as v1 and never returns structural provenance.
4. Assert the read window is current-plus-all-older as a declared policy: v1 reads structurally; every other version string, older or newer, takes the `unknown-version` degradation path; narrowing the window or retiring a version would require a spec update and is not encoded silently.
5. Assert the version matrix represents v1 plus the older and newer unknown-version strings, each with its read outcome and reason.

**Expected Outcome**:

- Any version outside the known set — older or newer — degrades visibly with the `unknown-version` reason and account-based heuristic provenance without failing the flow; v1 is the only known version and reads structurally; unknown versions are never silently accepted as v1; the window is current-plus-all-older per DEC-7 and needs no older-version fixture at delivery.

**Notes / Clarifications**:

- Resolves the former §8.3 TODO / OQ-B part 1: spec DEC-7 (v1.1 iteration 2) defines the window, so the older-version half is now the binding unknown-version degradation path rather than an unimplemented fixture.

#### TC-ERR-001 - Error-table sync and unchanged classification

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-1, NFR-6
**Test Type(s)**: Contract, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/error-table-sync.test.ts`, `tests/structure/error-table.test.ts`, `tests/behaviour/error-classification.test.ts`, `doc/spec/features/feature-result-contract.md`
**Tags**: @backend

**Preconditions**:

- The machine table (`packages/core/src/contracts/error-table.ts`) and the documented table both contain the new `config.credential.missing` row.
- Existing provider/input singletons, config exact-code discipline, and fallback containment are unchanged.

**Steps**:

1. Run `runSyncCheck({ root: process.cwd() })`; assert zero failures, equal source/documented counts, and non-zero recognized S1/S3 and corpus counts.
2. Assert the new row exactly matches spec §8.3: kind `config`, category `user`, retryable `false`, consequence `not_landed`, projection `user-validation`, exact summary and remediation hint.
3. Drive the new credential failure through `classifyDomainKind`/`classifyThrown`; assert it resolves exactly and exits 1.
4. Assert existing behavior: provider/input kind-only singletons still resolve; `classifyDomainKind("config")` still throws; unknown/mismatched codes still contain to `fallback.internal`; no first-config-row fallback.
5. In temp copies: add a machine row only → sync fails naming the undocumented code; add a documented row only → sync fails naming the missing source entry; alter a field on either side → sync fails naming the mismatch.
6. Assert the mutations never write the live tree and the live tree remains unchanged.

**Expected Outcome**:

- The machine and documented tables agree exactly with the new row; existing classification behavior is unchanged; either drift direction fails by name; no containment regression.

## 6. Environments and Test Data

- **Runtime:** Bun pinned by `.bun-version` and the root/CI manifests; Node is used only where packed-import parity requires it. `pnpm install --frozen-lockfile` and `pnpm build` precede dist-dependent suites.
- **Secrets:** No real secrets are used. Credentials are unique canary strings supplied through an injected environment record, never through the developer's real `process.env`. The canaries are not registered as production secrets, and every assertion checks both raw and JSON-escaped forms.
- **Network:** None. Fixture adapters and port fakes stand in for providers; no vendor API, no `fetch`, no DNS, no remote baseline fetch in the tests themselves.
- **Determinism:** Injected clock/ID seams; no sleeps, no real `$HOME`, no order-dependent tests. The credential environment source is an explicit injection parameter. The envelope codec is pure and repeatable.
- **Fixture quarantine:** Planted secret-read violations, malformed envelopes, and mutation copies live only in `tests/fixtures/**`, `tests/**/*.test.ts` (never fixtures), or `mkdtemp` workspaces. Nothing is written under `packages/**`. The live tree is checked with `git status --porcelain` before and after read-only scans. Fixtures are never named `*.test.ts` so temporary workspaces are not discovered as suites.
- **Envelope test data:** Canonical payloads and carriers live under `tests/fixtures/envelope/**`; degradation cases are committed as case definitions with explicit reasons drawn only from the closed DEC-8 taxonomy (`missing`, `malformed`, `wrong-kind`, `unknown-version`; absent and stripped share `missing`). A valid-envelope control is always paired with each degradation matrix. Size-bound cases include the exact boundary and one byte over. Behaviour suites import the pure codec from the adapters-internal module under DEC-9 via the testkit dev edge.
- **Type-test data:** A type-level carrier probe must be visible to a typecheck step. If the repo keeps tests outside the root typecheck project, the delivery must add a dedicated type-test project or equivalent; see §8.3.
- **Documentation:** Manual review of the sidecar adoption constraint and the exact v1 constants recorded at delivery. No license headers are added manually in this change; change artifacts are temporary and header-free, and any source header is added only by the repository script if a path requires it.

## 7. Automation Plan and Implementation Mapping

All rows are **To Implement** unless marked otherwise. Paths are proposed under the testing strategy; the implementation plan may adjust locations while preserving every TC ID and AC trace.

### 7.1 Traceability Matrix (TC ↔ AC ↔ Suite/File)

| TC | AC | Suite / file | Execution command | Control / status |
|---|---|---|---|---|
| TC-PORT-001 | AC-F1-1 | `tests/structure/port-contract-inventory.test.ts`, `tests/fixtures/ports/v1-contract-inventory.json` | `bun test tests/structure/port-contract-inventory.test.ts` | Exact inventory plus temp-copy add/remove mutations; To Implement |
| TC-PORT-002 | AC-F1-2 | `tests/structure/port-neutrality.test.ts`, `tests/structure/content-inventory.test.ts` | `bun test tests/structure/port-neutrality.test.ts tests/structure/content-inventory.test.ts`; `bun run scripts/checks/ambient-globals.ts` | Ambient/declaration mutations; To Implement (content inventory update existing) |
| TC-PORT-003 | AC-F2-1 | `tests/behaviour/port-capabilities.test.ts`, `tests/fixtures/ports/capabilities.ts` | `bun test tests/behaviour/port-capabilities.test.ts` | Fixture declarations and gap-removal mutation; To Implement |
| TC-PORT-004 | AC-F2-2 | `tests/structure/port-carrier-types.test.ts`, `tests/behaviour/port-capabilities.test.ts`, `tests/types/port-carrier-types.type-test.ts` | `bun test tests/structure/port-carrier-types.test.ts tests/behaviour/port-capabilities.test.ts` plus the type-test project | Declared/undeclared carrier matrix plus compile probe; To Implement |
| TC-PORT-005 | AC-F3-1 | `tests/behaviour/credential-port.test.ts`, `tests/fixtures/credentials/cases.ts` | `bun test tests/behaviour/credential-port.test.ts` | Injected environment and capture sink; To Implement |
| TC-PORT-006 | AC-F3-2 | `tests/behaviour/credential-port.test.ts`, `tests/behaviour/error-classification.test.ts` | `bun test tests/behaviour/credential-port.test.ts tests/behaviour/error-classification.test.ts` | Absent/empty references and containment controls; Existing – Update |
| TC-PORT-007 | AC-F3-3 | `tests/structure/port-credential-surface.test.ts` | `bun test tests/structure/port-credential-surface.test.ts` | AST surface plus documentation review; To Implement |
| TC-PORT-008 | AC-F3-1 | `tests/behaviour/credential-port.test.ts`, `tests/structure/credential-constants.test.ts` | `bun test tests/behaviour/credential-port.test.ts tests/structure/credential-constants.test.ts`; `bun run scripts/checks/forbidden-literals.ts` | Declared mapping and brand-neutral prefix mutation; To Implement |
| TC-SECRET-001 | AC-F4-1 | `tests/checks/secret-read-boundary.test.ts`, `scripts/checks/secret-read-boundary.ts`, `tests/fixtures/secret-boundary/cases.ts` | `bun test tests/checks/secret-read-boundary.test.ts`; `bun run scripts/checks/secret-read-boundary.ts` | Planted variants plus clean control; To Implement |
| TC-SECRET-002 | AC-F4-2 | `tests/checks/ci-checks.test.ts`, `tests/checks/boundary-ci-parity.test.ts` | `bun test tests/checks/ci-checks.test.ts tests/checks/boundary-ci-parity.test.ts`; `bun run scripts/checks/ci-topology.ts`; `bun run scripts/checks/ci-bindingness.ts` | Workflow and local-chain mutations; Existing – Update |
| TC-SECRET-003 | AC-F4-3 | `tests/checks/secret-read-boundary.test.ts`, `tests/fixtures/secret-boundary/allowlist.ts` | `bun test tests/checks/secret-read-boundary.test.ts` | Allowlist remove/add/wildcard/second-credential mutations; To Implement |
| TC-SECRET-004 | AC-F4-3 | `tests/checks/secret-read-boundary.test.ts`, `tests/boundaries/fixture-coverage.test.ts` | `bun test tests/checks/secret-read-boundary.test.ts tests/boundaries/fixture-coverage.test.ts` | Non-vacuity, deletion, empty registry; Existing – Update |
| TC-META-001 | AC-F5-1 | `tests/behaviour/envelope-roundtrip.test.ts`, `tests/fixtures/envelope/golden/**` | `bun test tests/behaviour/envelope-roundtrip.test.ts` | Carrier × payload matrix and size boundary; To Implement |
| TC-META-002 | AC-F5-2 | `tests/behaviour/envelope-roundtrip.test.ts` | `bun test tests/behaviour/envelope-roundtrip.test.ts` | Strip positions and re-parse; To Implement |
| TC-META-003 | AC-F5-3 | `tests/behaviour/envelope-degradation.test.ts`, `tests/fixtures/envelope/degradation/**` | `bun test tests/behaviour/envelope-degradation.test.ts` | Six-case matrix with DEC-8 reason taxonomy plus valid control; To Implement |
| TC-META-004 | AC-F5-4 | `tests/structure/envelope-contract.test.ts`, `tests/fixtures/envelope/schema-cases.json` | `bun test tests/structure/envelope-contract.test.ts`; forbidden-literals scan | Closed schema, secret canary, brand-neutral mutation; To Implement |
| TC-META-005 | AC-F5-5 | `tests/behaviour/envelope-write-path.test.ts`, `tests/structure/envelope-contract.test.ts`, `packages/adapters/src/**` (codec, DEC-9) | `bun test tests/behaviour/envelope-write-path.test.ts tests/structure/envelope-contract.test.ts` | Agent-facing surface, declared-carrier write, and no core-subpath codec; To Implement |
| TC-META-006 | AC-F5-3, AC-F5-6 | `tests/behaviour/envelope-degradation.test.ts`, `tests/fixtures/envelope/versions/**`, `packages/adapters/src/**` (codec, DEC-9) | `bun test tests/behaviour/envelope-degradation.test.ts` | Older and newer unknown versions both degrade with `unknown-version` (DEC-7); To Implement |
| TC-ERR-001 | AC-F6-1 | `tests/checks/error-table-sync.test.ts`, `tests/structure/error-table.test.ts`, `tests/behaviour/error-classification.test.ts` | `bun test tests/checks/error-table-sync.test.ts tests/structure/error-table.test.ts tests/behaviour/error-classification.test.ts`; `bun run scripts/checks/error-table-sync.ts` | Bidirectional drift mutations and unchanged classification; Existing – Update |

The envelope behaviour scenarios (`TC-META-001`, `TC-META-002`, `TC-META-003`, `TC-META-005`, `TC-META-006`) import the pure codec (serialize, parse, strip) from the adapters-internal shared module (`packages/adapters/src/**`; exact path set by the delivery plan) per DEC-9. Core `./contracts` carries the envelope data contract only and no new core subpath is created; testkit may import core and adapters under the dev-edge rule, never the surfaces.

### 7.2 Implementation Notes and Gate Handoff

- The new secret-read check should be extracted as `scripts/checks/secret-read-boundary.ts` with exported `scan(root)`/`validate(root)`, a rule identifier, and an enumerated allowlist registry, so both the CLI run and `tests/checks` mutation tests use the same production logic.
- The new check must be added to the CI `ts-invariants` step (or a new `ts-` job registered in `TS_JOBS`) and to `check:boundaries`; the topology/bindingness checks must be extended in the same change. No `continue-on-error`, `|| true`, `set +e`, `if: always()`, or `exit 0` wrapper is acceptable.
- The adapters `./credentials` subpath must be added to the manifest, `tests/structure/subpaths.test.ts`, `scripts/checks/workspace-entrypoints.ts`, `tests/boundaries/harness.ts`, and `packages/adapters/package.json` `workspaceImports`; a failing negative fixture for the runtime-API confinement allowlist change is required in the same change.
- `packages/core/src/contracts/**` new files must be added to `tests/structure/inventory.json` and to `EXECUTABLE_ALLOWANCES` in `tests/structure/content-inventory.test.ts` only where an `as const` value is legitimately executable data.
- The error table row must be added to both the machine table and `doc/spec/features/feature-result-contract.md` in the same change; the documented table header/column order is fixed by `scripts/checks/error-table-sync.ts`.
- Envelope codec placement is fixed by DEC-9: the pure codec (serialize, parse, strip) is an adapters-internal shared module, while core `./contracts` carries only the data contract (schema identifier constant, kind values, payload types, carrier-kind types, size bound constant) and no new core subpath is created. Behaviour tests import the codec through the testkit dev-edge rule; `tests/structure/envelope-contract.test.ts` asserts no codec behavior or raw carrier builder is exported from `./contracts`.
- Gate handoff commands to record in §10: `pnpm install --frozen-lockfile`; `pnpm build`; `bun test tests/structure tests/behaviour tests/checks tests/boundaries`; `bun run scripts/checks/ambient-globals.ts`; `bun run scripts/checks/error-table-sync.ts`; `bun run scripts/checks/secret-read-boundary.ts`; `bun run scripts/checks/ci-topology.ts`; `bun run scripts/checks/ci-bindingness.ts`; `bun run scripts/checks/workspace-entrypoints.ts`; `pnpm check:boundaries`; `pnpm check`; `git diff --check`.
- CI handoff: confirm PR base `main-tools` and all required `ts-*` and bash jobs green on the pushed HEAD, not an earlier SHA. The spec §18 Definition of Done lists all 17 ACs with traceable evidence, the clean-tree secret-read invariant plus planted-violation proof, exhaustive round-trip/degradation matrices, bidirectional sync, green existing gates, synchronized docs, and an open unmerged PR.
- Do not record unrun evidence as passing. The implementation plan may rename files; preserve TC IDs and update only the location column.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

- **Type-level carrier exclusion may be unproven.** The root `tsconfig.json` references only the six packages, so `tests/**` is not typechecked by `pnpm typecheck`. A `@ts-expect-error` in a Bun test would be silently ignored. TC-PORT-004 needs a type-test project or an equivalent compile step before AC-F2-2's typing half is credible.
- **Envelope codec placement is resolved, but must stay adapter-internal.** DEC-9 places the pure codec in the adapters package and keeps core `./contracts` data-only with no new core subpath. The residual risk is erosion: a later change could hoist behavior into contracts or expose a raw carrier builder. TC-META-005 asserts the placement and the agent-facing surface, including a temp-copy hoist mutation.
- **Absent and stripped are deliberately one reason, not two.** DEC-8 collapses them to `missing` because read time cannot distinguish an envelope that was never written from one removed externally. The matrix keeps them as separate input cases but asserts the shared reason; any future attempt to add a separate `stripped` value would be speculative evidence and needs a spec change.
- **The version window is settled but only v1 exists.** DEC-7 defines the standing window as current-plus-all-older, with every version outside the known set binding to the `unknown-version` degradation path. At delivery no older version exists, so TC-META-006 asserts the older and newer unknown-version strings both degrade visibly; a real older-version fixture is not required until a new schema version is introduced, and adding one must extend this matrix.
- **Exact v1 constants are deferred.** Spec OQ-3 defers the envelope schema identifier and serialized size bound to delivery. Tests assert the brand-neutral `delivery.*.v1` pattern and the ≤ 2048-byte ceiling; exact equality can only be asserted once the contract records the constants.
- **"Admits no secret material" is structural at this change.** The closed payload schema and the credential-canary control prove structure and non-leakage from the credential path. Value-level secret detection in emitter content is M0-S15 (NG-5) and cannot be proven here; a secret placed in an otherwise allowed string field would not be caught by this change's schema.
- **The credential port has no specified diagnostic channel.** AC-F3-1 says secrets never enter diagnostics/logs/errors, but the port itself exposes no logger. The test uses a capture sink around shared serialization/fixture-adapter output; if later adapters add their own logging, the leak assertion must extend there.
- **The allowlist can erode.** The registry must remain exact-path, reason-bearing, and class-tagged; mutation tests must prove removal, undeclared additions, wildcards, and a second credential entry all fail. A broad prefix/wildcard entry would defeat the check.
- **CI wiring shape may vary.** The spec says "beside the existing static invariants"; the plan assumes a step in `ts-invariants` plus `check:boundaries`. If delivery adds a new `ts-` job, `TS_JOBS`, `ci-topology`, `ci-bindingness`, and `ci-supply-chain` all need the same change, and the tests must assert the command, not only job names.

### 8.2 Assumptions

- The change specification is the single source of truth; no catalogue primitive outside the v1 set is typed or invented, and no requirement is added by this plan.
- Fixture adapters live in the dev-only test harness; no provider implementation, no mediated mode, and no sidecar transport is required to exercise the contracts.
- Credential resolution uses an injected environment record; the production implementation reads the ambient environment only inside its single allowlisted location.
- Malformed, missing, wrong-kind, unknown-version, stripped, or human-edited metadata is a returned view state, never a failure and never an error-table code (DEC-5, DEC-8). Absent and stripped share the single `missing` reason; a human-edited comment classifies as `malformed` or `missing` per what is mechanically detectable; account-based heuristic fallback applies identically in every case.
- The pure envelope codec lives in the adapters package as an adapter-internal shared module (DEC-9); testkit imports it under the dev-edge rule, and core `./contracts` remains types-and-`as const`-data-only with no new core subpath.
- Existing classification behavior (provider/input singletons, config exact-code discipline, fallback containment) is unchanged by the additive `config.credential.missing` row.
- The implementation plan is not yet authored; when it lands, TC IDs and AC coverage are preserved and only locations/commands are reconciled.
- No license headers are added manually; any new source header is applied only through the repository header script where a path requires it.

### 8.3 Open Questions

| Item | Owner / timing | Blocking? |
|---|---|---|
| OQ-A (spec OQ-3): exact envelope schema identifier and serialized size bound. | Spec writer / delivery; record in the contract before TC-META-001/004 assert exact equality. | Not blocking authoring; tests use the ≤ 2048-byte ceiling and the brand-neutral pattern until recorded. |
| OQ-B (resolved by spec DEC-7/DEC-8, v1.1 iteration 2): older-version compatibility window and absent-vs-stripped reason taxonomy. | Resolved in spec; reflected in TC-META-006 (window) and TC-META-003 (taxonomy). | No — the read window is current-plus-all-older, any unknown version binds to the visible `unknown-version` degradation path, and absent/stripped share `missing`; no older-version fixture is needed at delivery. |
| OQ-C (resolved by spec DEC-9, v1.1 iteration 2): envelope codec placement and the adapters import edge. | Resolved in spec; reflected in §7.2 and TC-META-005. | No — the pure codec is an adapters-internal shared module, core `./contracts` stays data-only, no new core subpath is created, and testkit imports the codec under the dev-edge rule. |
| OQ-D: type-level carrier probe mechanism while `tests/**` is outside the root typecheck project. | Plan writer; add a type-test project or equivalent compile step. | Blocking for AC-F2-2's typing evidence; runtime carrier rejection can be tested without it. |
| OQ-E: whether the new secret-read invariant is a step in `ts-invariants` or a new `ts-` job. | Plan writer / delivery. | Not blocking; TC-SECRET-002 asserts the command in whichever binding surface is chosen and requires `TS_JOBS` extension if a job is added. |
| OQ-F: credential empty-value policy (literal empty versus whitespace-only) and exact declared reference-to-key mapping shape. | Spec writer / delivery. | Minor; TC-PORT-006 covers absent and empty as written, and the mapping is asserted as explicit data. |
| OQ-G: value-level metadata secret scanning is M0-S15, not this change. | PM / later story. | Not blocking; AC-F5-4 is tested structurally with a credential-path canary, and the limitation is recorded above. |

No AC is left without a mapped test. All 17 ACs — including AC-F5-6, traced to TC-META-006 — have at least one scenario. The only partial coverage remaining is value-level metadata secret scanning (OQ-G), which belongs to M0-S15 and is recorded above, not silently omitted.

## 9. Plan Revision Log

Plan version **1.1 (iteration 2)** aligns with change specification **v1.1 (iteration 2)** and its DEC-7/DEC-8/DEC-9 amendment and AC-F5-6.

| Version | Date (UTC) | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-10-30T20:14:11Z | Change Test Plan Writer | Initial plan: 19 test cases, 16/16 AC traceability, secret-read negative controls and non-vacuity discipline, envelope round-trip/degradation matrices, error-table sync, and testable-gap register; no execution claimed. |
| 1.1 | 2026-10-30T20:22:26Z | Change Test Plan Writer | Iteration 2, aligned with change spec v1.1 (iteration-2 amendment). Adds AC-F5-6 traceability to TC-META-006 (17/17 ACs); resolves §8.3 OQ-B per DEC-7 (current-plus-all-older window; unknown versions bind to visible degradation) and DEC-8 (mechanically detectable reason taxonomy; absent/stripped share `missing`); places the pure codec in the adapters-internal module per DEC-9 and updates envelope suite targets; updates TC-META-002/003/005/006 expectations. All TC IDs unchanged. |

## 10. Test Execution Log

| TC ID / gate | Run Date (UTC) | Result | Notes / command / HEAD |
|---|---|---|---|
| TC-PORT-001 | 2026-10-30 | PASS | `bun test tests/structure/port-contract-inventory.test.ts` — 7 tests; inventory equals fixture both directions; add/remove mutations fail by name. |
| TC-PORT-002 | 2026-10-30 | PASS | `bun test tests/structure/port-neutrality.test.ts`; `bun run scripts/checks/ambient-globals.ts` — 18 neutral files clean; injected ambient/clock/randomness/function fails by file+line. |
| TC-PORT-003 | 2026-10-30 | PASS | `bun test tests/behaviour/port-capabilities.test.ts` — explicit gaps, no implied parity, gap-removal detectable, positive control clean. |
| TC-PORT-004 | 2026-10-30 | PASS | `bun test tests/structure/port-carrier-types.test.ts tests/behaviour/port-capabilities.test.ts`; `pnpm typecheck` compiles `tests/types/port-carrier-types.type-test.ts` (declared union, widened `string[]` rejected). |
| TC-PORT-005 | 2026-10-30 | PASS | `bun test tests/behaviour/credential-port.test.ts` — canary returned once; host env isolated; deterministic. |
| TC-PORT-006 | 2026-10-30 | PASS | `bun test tests/behaviour/credential-port.test.ts tests/behaviour/error-classification.test.ts` — absent/empty classified exactly; no containment; kind-only `config` still throws. |
| TC-PORT-007 | 2026-10-30 | PASS | `bun test tests/structure/port-credential-surface.test.ts` — no mode/implementation/mediated/direct; injected mode detected; sidecar constraint documented. |
| TC-PORT-008 | 2026-10-30 | PASS | `bun test tests/behaviour/credential-port.test.ts tests/structure/credential-constants.test.ts`; forbidden-literals green over both credential files. |
| TC-SECRET-001 | 2026-10-30 | PASS | `bun test tests/checks/secret-read-boundary.test.ts` — every env-read form fires naming rule/file/line; clean control passes; live scan read-only. |
| TC-SECRET-002 | 2026-10-30 | PASS | `bun test tests/checks/ci-checks.test.ts tests/checks/boundary-ci-parity.test.ts`; `ci-topology`/`ci-bindingness` green; both wiring surfaces asserted with removal-by-name mutations. |
| TC-SECRET-003 | 2026-10-30 | PASS | `bun test tests/checks/secret-read-boundary.test.ts` — mutations A–E fail closed; sole `credential-material` entry. |
| TC-SECRET-004 | 2026-10-30 | PASS | `bun test tests/checks/secret-read-boundary.test.ts tests/boundaries/fixture-coverage.test.ts` — non-vacuity 51 files, clean control meaningful, fixture-coverage meta-check green. |
| TC-META-001 | 2026-10-30 | PASS | `bun test tests/behaviour/envelope-roundtrip.test.ts` — 4 payloads × 3 carriers round-trip; all ≤ 2048 bytes; over-bound fails by name. |
| TC-META-002 | 2026-10-30 | PASS | `bun test tests/behaviour/envelope-roundtrip.test.ts` — strip at beginning/middle/end and custom field; re-parse `missing`; residue control. |
| TC-META-003 | 2026-10-30 | PASS | `bun test tests/behaviour/envelope-degradation.test.ts` — 6/6 cases, closed taxonomy, identical heuristic fallback, valid control clean. |
| TC-META-004 | 2026-10-30 | PASS | `bun test tests/structure/envelope-contract.test.ts` — closed schema mutations rejected; no secret field; canary absent; markers `delivery.*.v1`. |
| TC-META-005 | 2026-10-30 | PASS | `bun test tests/behaviour/envelope-write-path.test.ts tests/structure/envelope-contract.test.ts` — agent views expose no raw carrier; codec adapter-internal; hoist/raw-writer mutations fail. |
| TC-META-006 | 2026-10-30 | PASS | `bun test tests/behaviour/envelope-degradation.test.ts` — older/newer unknown versions degrade visibly; v1 structural; window matrix recorded. |
| TC-ERR-001 | 2026-10-30 | PASS | `bun test tests/checks/error-table-sync.test.ts tests/structure/error-table.test.ts tests/behaviour/error-classification.test.ts`; sync 14/14 with bidirectional drift mutations. |
| Final gates | 2026-10-30 | PASS | `bun test tests/structure tests/behaviour tests/checks tests/boundaries` 554 PASS; `pnpm check` 604 PASS; ten invariant checks green; `pnpm check:boundaries` green; exports-parity + five `publint`/`attw` runs green; `git diff --check` clean. HEAD `f81ec70` + phase-7 changeset. |
