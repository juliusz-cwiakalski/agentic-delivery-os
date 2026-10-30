---
id: chg-GH-181-primitive-ports-credential-metadata
status: Proposed
created: 2026-10-30T20:31:46Z
last_updated: 2026-10-30T20:31:46Z
owners: [engineering]
service: delivery-os adapter contracts
labels: [change, planning]
links:
  change_spec: ./chg-GH-181-spec.md
  test_plan: ./chg-GH-181-test-plan.md
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
  typescript_rules: ../../../../.ai/rules/typescript.md
  adr_refs:
    - ../../../decisions/ADR-0003-oss-monorepo-structure.md
  related_changes:
    - ../2026-10-30--GH-173--config-layer/chg-GH-173-plan.md
summary: >
  Deliver the v1 typed primitive ports (nine catalogue adapter-interaction rows)
  with capability/gap flags in the runtime-neutral core contracts tier, one
  centralized credential-resolution port with a single environment-backed
  implementation at a declared adapters credentials subpath, the embedded
  metadata envelope v1 with a pure adapter-internal codec, and a binding
  secret-read boundary invariant in CI plus one synchronized error-table row.
version_impact: minor
---

# IMPLEMENTATION PLAN — GH-181: M0-S12: Primitive ports, credential port, and embedded metadata

## Context and Goals

Implement F-1–F-6 of the completed specification (v1.1, 17 ACs in §17, DEC-1–DEC-9 in §15) against the completed test plan (v1.1, 19 TCs). Both artifacts are committed; this plan derives every task, file location, and gate from them and adds no requirement. Execution belongs on `feat/GH-181/primitive-ports-credential-metadata`; the PR targets `main-tools`.

The substrate lands complete and mechanically enforced before any adapter consumes it: typed contracts first, then the codec and credential implementation, then the boundary invariant that makes secret centralization a mechanical property. The spec's placement decisions are binding inputs: DEC-2 (credential implementation in the adapters I/O tier as a new declared `./credentials` subpath), DEC-4 (AST secret-read invariant, binding in CI and the local boundary chain), DEC-7/DEC-8 (version window and degradation taxonomy), DEC-9 (pure codec adapter-internal; core `./contracts` data-only; no new core subpath).

### Decisions this plan records (test-plan §8.3 items owned by the plan writer)

- **OQ-A / spec OQ-3 — exact v1 constants**: envelope schema identifier `delivery.metadata.v1` (same `delivery.*.v1` discipline as the reserved result/telemetry schema names); serialized size bound **2048 bytes** (the spec ceiling). Recorded in the Phase 1 contract so TC-META-001/004 can assert exact equality.
- **OQ-D — type-level carrier probe**: a new `tests/types/` project (own `tsconfig.json`, files never named `*.test.ts` so Bun discovery ignores them) chained into the root `typecheck` script, so `pnpm typecheck` and the CI `ts-typecheck` job compile the carrier-exclusion probes bindingly (AC-F2-2 typing half).
- **OQ-E — invariant wiring shape**: a step in the existing `ts-invariants` job (additions-only per `ci-topology`), not a new `ts-*` job; `TS_JOBS` stays unchanged. The command also joins the local `check:boundaries` chain, whose content extension leaves the five-step aggregate shape (`script-surface.ts`) untouched.
- **OQ-F — empty-value policy**: an absent key and an empty-string value both resolve to `config.credential.missing` (AC-F3-2 wording); a whitespace-only value is a non-empty value and resolves. The reference→source-key mapping is declarative data.
- **DEC-9 mechanics — codec import path**: the codec lives at `packages/adapters/src/io/` behind the existing `#io/*` internal alias (no new adapters subpath for it — spec §8.5 admits exactly one new declared adapters subpath, `./credentials`). Root test suites and fixtures import it by relative path into `packages/adapters/src/io/...`, the established dev-edge precedent (`tests/behaviour/legacy-adapter.test.ts` imports `packages/adapters/src/legacy/index`; root `tests/**` sit outside the `depcruise packages` scope). No testkit package change is required for codec access; TC-META-005 step 5 is verified as "no production cross-boundary edge": only `packages/adapters/**` and root `tests/**` import the codec.
- **Fixture-adapter location**: the spec's "dev-only test harness" fixtures live at root `tests/fixtures/ports/**` and `tests/fixtures/envelope/**` exactly as the test plan's target layers state; testkit's dev-edge rules govern what such tests may import (core and adapters, never the surfaces).

### Open questions

- **OQ-1 (spec §14) — credential implementation placement**: DEC-2 is the recorded decision. If the implementer disputes it during delivery, STOP the affected tier work and raise a technical decision record via `@decision-advisor` before merging; do not silently relocate the implementation or widen the allowlist. Carried as Phase 3 task 3.5.
- **OQ-2 (spec §14) — catalogue bookkeeping for the credential port and envelope**: owned by the documentation-sync phase (lifecycle phase 7) and the M0-S17 decision record, not this change. No catalogue edits here (spec §12).

No other blocking spec/test-plan gaps exist. All 17 ACs and 19 TCs are covered by the phases below.

## Scope

### In Scope

- **F-1**: nine catalogue adapter-interaction primitives typed at M0 (`ExternalSystemInstance`, `AdapterContract`, `WorkItem`, `WorkflowMap`, `WorkItemRelation`, `DeliveryRequest`, `PipelineRun`, `RetryPolicy`, `IdempotencyKey`) as data contracts in core `./contracts`, keyed by catalogue PascalCase names; fail-closed inventory both directions.
- **F-2**: typed capability flags, explicit gap records, and carrier-kind capability declarations on the adapter contract; carrier selection restricted to declared carriers (runtime + type level).
- **F-3**: credential-resolution port contract in core `./contracts` plus one environment-backed implementation at the new declared adapters `./credentials` subpath (injectable environment source, explicit reference→key mapping, brand-derived prefixes, no implementation mode).
- **F-4**: `scripts/checks/secret-read-boundary.ts` AST invariant with an enumerated three-entry allowlist, negative fixtures, mutation and non-vacuity proofs, binding CI wiring (`ts-invariants` step) and local wiring (`check:boundaries`), topology/bindingness assertions extended in the same change.
- **F-5**: envelope data contract in core `./contracts` (schema id, kind values, closed v1 payload, carrier kinds, size bound) and pure serialize/parse/strip codec adapter-internal in `packages/adapters/src/io/`; round-trip, strip, degradation, version-window, write-path, and closed-schema matrices.
- **F-6**: one `config.credential.missing` row in the machine table and the documented table in the same change; sync and classification regressions green.

### Out of Scope

- Credential sidecar, mediated mode, sidecar transport, token issuance/revocation (spec NG-1; documented constraint only).
- Concrete provider adapters and provider-engine routing (NG-2; M0-S13 and client-seed stories).
- Typing of catalogue primitives outside the v1 set (NG-3); metadata retention/local event-log mirroring (NG-4); privacy-guard emitter scanning (M0-S15) and gate-battery provenance consumption (M0-S9) (NG-5).
- Any edit to `scripts/*.sh` (beyond the new `scripts/checks/*.ts` file), `tools/`, `.opencode/`, `.ados-claude/`, the bash delivery stack, public naming, or the branding resolver contract.
- New feature-spec authoring and catalogue status updates — owned by the lifecycle documentation-sync phase, except the documented error-table row which is a code-bound artifact of the sync check and ships in-change (Phase 1).

### Constraints

- **Build-order (GH-170 review note)**: workspace-import resolution requires `pnpm build` before boundary checks wherever new cross-package imports or subpaths appear. Locally run `pnpm build` before `pnpm check:boundaries`; the CI `ts-boundaries` job already builds first and `boundary-ci-parity` asserts it. `pretest`/`pretypecheck` already build.
- **Tier purity**: core `./contracts` additions are types and `as const` data only — no functions, runtime imports, ambient environment, clock, or randomness (NFR-1; `ambient-globals` neutral set + declaration-only content inventory).
- **Brand neutrality**: no `ados`/`ADOS_`/`~/.ados` tokens anywhere; any product-prefixed credential source key derives from `BrandIdentity.environmentPrefix` passed as data (spec F-3); carrier markers follow the `delivery.*.v1` discipline; `forbidden-literals` stays green.
- **One new adapters subpath only** (`./credentials`): register it in `packages/adapters/package.json` (exports + `#credentials/*` imports alias), `scripts/checks/workspace-entrypoints.ts`, `tests/structure/subpaths.test.ts`, `tests/boundaries/harness.ts` (ADAPTER_SUBPATHS), and the `workspaceImports` manifests of `cli`, `mcp`, `opencode`, `testkit`. No new core subpath.
- **Boundary-rule changes ship with failing negative fixtures** in the same change (fixture-coverage meta-check): the `runtime-apis-confinement` allowlist entry for `credentials` (Phase 3) and the new secret-read rule (Phase 4).
- **CI wiring is additions-only**: `ci.yml` gains the invariant line inside `ts-invariants`; no base line removed (`ci-topology` diff guard), `TS_JOBS` unchanged, no bypass constructs (`ci-bindingness`). The local chain extension appends to `check:boundaries` without altering the five named checks or aggregate order (`script-surface`).
- **Error-table lockstep**: machine row and documented row land in the same commit; never a red intermediate sync state (GH-173 Phase 1 precedent).
- **Inventory discipline**: every new `packages/**` source file joins `tests/structure/inventory.json`; `as const` executable data joins `EXECUTABLE_ALLOWANCES` in `tests/structure/content-inventory.test.ts` with the exact export list.
- **Fixture quarantine**: planted violations and mutation copies live only in `mkdtemp` trees or `tests/fixtures/**` (never `*.test.ts`); the live tree is verified read-only (`git status --porcelain`) around read-only scans.
- **No license headers added by hand**; change artifacts are header-free; agents never run the header script for this change's paths.
- **Commits**: one Conventional Commit per phase, scope `GH-181` (e.g., `feat(GH-181): ...`), bodies within the repository 100-character limit; the orchestrator delegates commits to `@committer`.
- **Test provenance**: every suite exercises the exported production module (codec, credential implementation, contracts) — no re-implementation of logic under test.

### Risks

- **RSK-1 (port shapes churn at M0-S13)**: contracts derive strictly from the catalogue rows and spec DM-1–DM-10; consumer stories review before implementation; evolution stays additive within v1. A TDR path exists for disputed shapes.
- **RSK-2 (allowlist erosion)**: exact-path, reason-bearing, class-tagged registry; exactly one `credential-material` entry; growth is a reviewed change; mutations A–E (Phase 4) prove fail-closed behavior; non-vacuity is proven by scoped-file counts and fixture-deletion failures.
- **RSK-3 (providers strip carriers)**: graceful degradation with visible evidence is the specified behavior; the six-case matrix and the marker-fallback carrier are tested exhaustively; absent/stripped share `missing` (DEC-8).
- **RSK-4 (identifier/secret leakage)**: closed v1 payload admits no secret/credential field; credential-canary control proves the envelope is not fed from the credential result; brand-neutral constants; resolved material returned once and never enters diagnostics (existing redaction chokepoint governs surfaced payloads).
- **RSK-5 (contracts-tier growth)**: v1 set is bounded to the nine rows plus the two ticket-mandated contracts; reviewed by the M0-S17 decision record.
- **RSK-6 (placement dispute)**: DEC-2 recorded with the alternative; Phase 3 task 3.5 routes disputes to a TDR before merge; contracts tier stays pure either way.
- **RSK-7 (metadata vs event-ledger drift)**: the sync rule is stated in the contract docs and restated for M0-S17; no local mirroring code exists here.

**Rollback**: the change is additive — no persisted state, no configuration keys, no installed-corpus changes, no bash-stack edits. If rejected, revert the phase commits as one coherent unit: core contracts + error row (machine and documented together — never one side), adapters codec + credentials subpath + all subpath/confinement/allowlist registrations, the invariant + its CI/local wiring, tests/fixtures/registries, and the changeset. Re-run `pnpm check`, `pnpm check:boundaries`, and `bun run scripts/checks/error-table-sync.ts` on the rolled-back tree to confirm the baseline is intact. Never roll back one side of the error-table sync or leave the confinement allowlist edited without its fixture.

### Success Metrics

- 9/9 catalogue adapter-interaction primitives typed; inventory fail-closed in both directions (AC-F1-1).
- 0 ambient environment/I/O/clock/randomness accesses in the contracts tier (AC-F1-2, NFR-1).
- 0 non-allowlisted ambient environment reads in workspace package production sources; ≥1 planted violation proven to fire; exactly one credential-material allowlist entry (NFR-2, NFR-7).
- New invariant binding in CI and the local chain with 0 bypass constructs; topology/bindingness extended and green (NFR-3).
- 100% golden round-trip logical equality across all declared carriers within the 2048-byte bound (NFR-4).
- 0 flow failures across the six-case degradation matrix; 100% visible evidence naming the DEC-8 reason (NFR-5).
- Error-table sync green in both directions with the new row; existing classification unchanged (NFR-6).

## Phases

Dependency order: **1 → 2 → 3 → 4 → 5 → (6 if findings) → 7**. Each phase ends in a verifiable state and one Conventional Commit (scope `GH-181`) via `@committer`. Build before dist-dependent suites and before boundary checks.

### Phase 1: Core contract surface and the credential failure identity

**Goal**: Land the full runtime-neutral contract surface (nine primitives, capability/gap declarations, credential port type, envelope data contract) and the synchronized `config.credential.missing` row so every later phase consumes stable contracts and a classified failure identity.

**Tasks**:

- [x] **1.1** Add `packages/core/src/contracts/ports.ts` with the nine primitive data contracts keyed by their catalogue PascalCase names — `ExternalSystemInstance` (DM-1: instance identity + declared auth method referencing credentials by declared reference, never inline secrets), `AdapterContract` (DM-2 declaration shell), `WorkItem` (DM-3), `WorkflowMap` (DM-4), `WorkItemRelation` (DM-5), `DeliveryRequest` (DM-6), `PipelineRun` (DM-7), `RetryPolicy` + `IdempotencyKey` (DM-8: only known-safe retries representable; unsafe writes carry no policy). Types and `as const` data only; compound-qualified naming per the catalogue discipline; no numeric identifiers. (AC-F1-1; feeds TC-PORT-001) — done — `packages/core/src/contracts/ports.ts`; TC-PORT-001 inventory PASS
- [x] **1.2** Add `packages/core/src/contracts/adapter-capabilities.ts`: typed operation capability flags, explicit gap records (capability + reason), carrier-kind flags over the closed `CARRIER_KINDS` set (invisible comment block, provider custom field, compact marker fallback), and the carrier-selection input type constrained to a declared carrier union (no `string` escape). Absence of a flag is a machine-readable gap. (F-2, DM-2, DM-10; feeds TC-PORT-003, TC-PORT-004) — done — `adapter-capabilities.ts` (`CARRIER_KINDS`, `ADAPTER_OPERATIONS`, gap + declared-carrier input types)
- [x] **1.3** Add `packages/core/src/contracts/credentials.ts`: credential reference type with the explicit reference→source-key mapping as declarative data, resolution result (secret material once, or the classified failure), and the port type exposing **no** `mode`/`implementation`/`mediated`/`direct` discriminant and no environment-specific typing. Document the sidecar adoption path (interface unchanged; mediated execution is a second implementation) in the contract docs as a constraint only. (F-3, DM-9; feeds TC-PORT-007, TC-PORT-008) — done — `credentials.ts` (reference/source-key data, classified failure, port; sidecar constraint documented)
- [x] **1.4** Add `packages/core/src/contracts/envelope.ts`: schema identifier constant `delivery.metadata.v1`, envelope kind values, closed v1 payload types (comment provenance: producing agent + operator authority; delivery linkage: work-item + run identifiers), carrier-kind types, size bound constant 2048 bytes, degradation evidence type with the closed DEC-8 reason taxonomy (`missing`, `malformed`, `wrong-kind`, `unknown-version`), and the version-policy statement (current-plus-all-older; unknown versions bind to the degradation path, DEC-7). (F-5, DM-10; feeds TC-META-004, TC-META-006) — done — `envelope.ts` (`delivery.metadata.v1`, 2048 bytes, closed payload, DEC-7/DEC-8 statements)
- [x] **1.5** Export the new contract modules from `packages/core/src/contracts/index.ts`; add every new file to `tests/structure/inventory.json` and the new `as const` values (`CARRIER_KINDS`, envelope constants) to `EXECUTABLE_ALLOWANCES` in `tests/structure/content-inventory.test.ts`. Verify neutrality: `bun run scripts/checks/ambient-globals.ts` green, declaration-only content inventory green, no runtime imports. (AC-F1-2, NFR-1; TC-PORT-002) — done — index exports + inventory + `EXECUTABLE_ALLOWANCES`; ambient/declaration guards green (TC-PORT-002 PASS)
- [x] **1.6** Add the `config.credential.missing` row to `ERROR_TABLE` (`packages/core/src/contracts/error-table.ts`) with exact spec §8.3 fields (kind `config`, category `user`, retryable `false`, consequence `not_landed`, projection `user-validation`, spec-exact summary and remediation hint) **and** the documented row in `doc/spec/features/feature-result-contract.md` in the same commit; `bun run scripts/checks/error-table-sync.ts` green; classification regressions green (config kind-only lookup still throws; provider/input singletons unchanged; fallback containment unchanged). (AC-F6-1, NFR-6; TC-ERR-001, identity half of TC-PORT-006) — done — `config.credential.missing` in machine + documented tables; `error-table-sync` green (entries=14/documented=14)

**Acceptance Criteria**:

- Must: contracts contain types and `as const` data only; ambient/declaration guards green (AC-F1-2).
- Must: error-table sync green in both directions with the new row in both tables and existing classification behavior unchanged (AC-F6-1).
- Should: contract file layout keeps one concern per module so the Phase 2/3 suites can assert placement by path.

**Files and modules**:

- Code areas: new `packages/core/src/contracts/{ports,adapter-capabilities,credentials,envelope}.ts`; updated `packages/core/src/contracts/{index,error-table}.ts`; updated `tests/structure/inventory.json`, `tests/structure/content-inventory.test.ts`, existing error-table/classification tests.
- System docs: `doc/spec/features/feature-result-contract.md` (one documented row, fixed header/column order) — the only in-change doc edit; all other doc reconciliation is the lifecycle doc-sync phase.

**Tests**:

- `bun test tests/structure tests/behaviour` (existing suites); `bun run scripts/checks/ambient-globals.ts`; `bun run scripts/checks/error-table-sync.ts`; `pnpm build` then `pnpm check:boundaries`.

**Completion signal**: `feat(GH-181): add v1 primitive port, capability, credential and envelope contracts with synchronized credential error row`

---

### Phase 2: Adapter-internal envelope codec and metadata behaviour matrices

**Goal**: Deliver the pure codec (DEC-9) and prove capability declarations, carrier typing, round-trip, strip, degradation, version-window, write-path, and closed-schema behavior through fixture adapters — no provider implementations shipped.

**Tasks**:

- [x] **2.1** Implement the pure codec at `packages/adapters/src/io/envelope-codec.ts` (behind the existing `#io/*` internal alias): `serialize` (payload → compact JSON envelope within the 2048-byte bound, byte length measured deterministically), `parse` (envelope → payload or degradation evidence with the DEC-8 reason; unknown versions → `unknown-version` per DEC-7), `strip` (carrier text → human content minus envelope, no marker residue), and per-carrier encoders/decoders for the three `CARRIER_KINDS`. Pure functions only: no ambient reads, no clock, no randomness, no `node:*`/`bun:*` imports (`src/io` is outside the runtime-API confinement allowlist and must stay there). (F-5, DEC-9; feeds TC-META-001–006) — done — `packages/adapters/src/io/envelope-codec.ts` (pure; no runtime imports; `#io/*` alias; `ENVELOPE_FIELD_NAME`)
- [x] **2.2** Add fixture adapters and declarations at `tests/fixtures/ports/capabilities.ts` (root dev-edge; imports core contracts and, where needed, the codec by relative path): one adapter declaring an explicit gap for an unsupported operation, one fully-declared positive control, and adapters declaring subsets of the three carrier kinds. Add `tests/behaviour/port-capabilities.test.ts`: undeclared operations surface as explicit gaps, no implied parity, gap-removal mutation fails, positive control reports no gaps for declared operations. (AC-F2-1; TC-PORT-003; runtime half of TC-PORT-004) — done — `tests/fixtures/ports/capabilities.ts` + `tests/behaviour/port-capabilities.test.ts`; TC-PORT-003 PASS
- [x] **2.3** Add the type-test project (OQ-D): `tests/types/tsconfig.json` (strict, extending the base config; maps imports to package sources) and `tests/types/port-carrier-types.type-test.ts` asserting declared-carrier union selection and `@ts-expect-error` probes (with one-line reasons) for undeclared carrier literals and for a widened `string` union. Chain the project compile into the root `typecheck` script so `pnpm typecheck` and CI `ts-typecheck` bind it. Files are never `*.test.ts` (outside Bun discovery). (AC-F2-2 typing half; TC-PORT-004) — done — `tests/types/{tsconfig.json,port-carrier-types.type-test.ts}` chained into root `typecheck`; TC-PORT-004 typing PASS
- [x] **2.4** Add `tests/behaviour/envelope-roundtrip.test.ts` with golden fixtures under `tests/fixtures/envelope/golden/**`: minimum/typical/maximum-field/quoting-unicode payloads × every `CARRIER_KINDS` value; deep logical equality after documented normalization; every case ≤ 2048 bytes; human content never displaced; over-bound case fails by name; matrix exhaustiveness over carrier kinds. (AC-F5-1, NFR-4; TC-META-001) — done — golden matrix over 4 payloads x 3 carriers, ≤2048 bytes; TC-META-001 PASS
- [x] **2.5** Extend the round-trip suite with parse-and-strip coverage: envelope at beginning/middle/end and in a custom field; original content restored exactly; no marker residue or extra blank line; re-parse of stripped content degrades with `missing`; raw carrier text reachable only via the audited escape hatch; residue mutation fails. (AC-F5-2; TC-META-002) — done — parse/strip at beginning/middle/end + custom field, re-parse `missing`, residue control; TC-META-002 PASS
- [x] **2.6** Add `tests/behaviour/envelope-degradation.test.ts` with fixtures under `tests/fixtures/envelope/degradation/**` and `tests/fixtures/envelope/versions/**`: the six input cases (absent, malformed, wrong-kind, unknown version, stripped, human-edited) mapped onto the closed taxonomy — absent/stripped → `missing`, human-edited → `malformed` or `missing` per mechanical detectability; 0 flow failures; account-based heuristic provenance identical in every case; heuristic never masquerades as structural; malformed produces no error code and no `fallback.*`; valid-envelope control clean; matrix count 6/6. Version window: older-than-v1 and newer-than-v1 strings both degrade visibly with `unknown-version` (DEC-7); v1 reads structurally; version matrix recorded. (AC-F5-3, AC-F5-6, NFR-5; TC-META-003, TC-META-006) — done — six-case matrix + valid control + older/newer unknown versions; TC-META-003/006 PASS
- [x] **2.7** Add `tests/behaviour/envelope-write-path.test.ts` and extend `tests/structure/envelope-contract.test.ts`: agent-facing primitive views carry no raw carrier/marker/serializer field; adapter writes select a declared carrier and reject undeclared carriers as declared gaps; core `./contracts` exports envelope types/`as const` data only (no codec behavior, no new core subpath); the codec lives adapter-internal; no production cross-boundary edge (codec imported only within `packages/adapters/**` and root `tests/**`); temp-copy hoist and raw-writer mutations fail. (AC-F5-5; TC-META-005) — done — `tests/behaviour/envelope-write-path.test.ts` + placement checks in `tests/structure/envelope-contract.test.ts`; TC-META-005 PASS
- [x] **2.8** Extend `tests/structure/envelope-contract.test.ts` with `tests/fixtures/envelope/schema-cases.json`: closed payload schema (unknown/missing/nested-unknown fields rejected, never silently stripped); no secret/credential/free-form-token field names; credential canary present in the injected environment never appears in serialized envelopes; markers match `delivery.*.v1`; `forbidden-literals` scan green; extra-field and embedded-token mutations fail. (AC-F5-4, NFR-4; TC-META-004) — done — closed schema/secret-field/canary/brand-neutral fixtures in `tests/structure/envelope-contract.test.ts`; TC-META-004 PASS

**Acceptance Criteria**:

- Must: 100% golden round-trip equality within the bound; 0 degradation flow failures with 100% visible evidence; only declared carriers selectable at runtime and by typing (AC-F5-1, AC-F5-3, AC-F2-2).
- Must: codec placement provably adapter-internal; no agent-facing raw carrier construction (AC-F5-5).
- Should: codec modules stay under `src/io` with zero runtime imports so the confinement allowlist never needs to grow for them.

**Files and modules**:

- Code areas: new `packages/adapters/src/io/envelope-codec.ts` (updated `packages/adapters/src/io/index.ts` re-export or direct module import — no new subpath); new `tests/types/**`, `tests/fixtures/ports/**`, `tests/fixtures/envelope/**`, `tests/behaviour/{port-capabilities,envelope-roundtrip,envelope-degradation,envelope-write-path}.test.ts`, `tests/structure/envelope-contract.test.ts`; updated root `package.json` `typecheck` chain, `tests/structure/inventory.json`, `EXECUTABLE_ALLOWANCES`.
- System docs: none (feature-spec authoring is the doc-sync phase).

**Tests**:

- `pnpm build` then `bun test tests/behaviour/port-capabilities.test.ts tests/behaviour/envelope-roundtrip.test.ts tests/behaviour/envelope-degradation.test.ts tests/behaviour/envelope-write-path.test.ts tests/structure/envelope-contract.test.ts`; `pnpm typecheck` (now includes the type-test project); `pnpm check:forbidden-literals`.

**Completion signal**: `feat(GH-181): add adapter-internal envelope codec with round-trip, degradation and carrier-typing matrices`

---

### Phase 3: Environment-backed credential implementation and the ./credentials subpath

**Goal**: Land the single credential-port implementation behind a declared runtime-aware subpath, register the subpath everywhere the entrypoint matrix demands, and admit it to the runtime-API confinement allowlist with a failing negative fixture — per DEC-2/OQ-1.

**Tasks**:

- [x] **3.1** Implement `packages/adapters/src/credentials/index.ts`: resolve a declared credential reference against an **injectable** environment source (production wrapper reads the ambient environment only inside this one module); explicit reference→source-key mapping as declared data; any product-prefixed key derives from `BrandIdentity.environmentPrefix` supplied as data; present-and-non-empty key → material returned exactly once in the port result; absent or empty-string key → failure carrying exactly `config.credential.missing` identity (per OQ-F: whitespace-only values resolve); no diagnostic/log channel on the port; no implementation-mode surface. (AC-F3-1, AC-F3-2, AC-F3-3; feeds TC-PORT-005, TC-PORT-006, TC-PORT-007, TC-PORT-008) — done — injectable environment source; brand-derived key; absent/empty fail, whitespace resolves; no diagnostic channel (TC-PORT-005/006/008 PASS)
- [x] **3.2** Register the `./credentials` subpath: `packages/adapters/package.json` (exports entry + `#credentials/*` imports alias), `scripts/checks/workspace-entrypoints.ts` ADAPTER_SUBPATHS, `tests/structure/subpaths.test.ts` ADAPTER_SUBPATHS, `tests/boundaries/harness.ts` ADAPTER_SUBPATHS, and the `workspaceImports` adapters lists in `packages/{cli,mcp,opencode,testkit}/package.json`. `bun run scripts/checks/workspace-entrypoints.ts` and `tests/structure/subpaths.test.ts` green after `pnpm build` (declared subpath resolves through `dist`). (spec §8.5, §7.1) — done — exports + `#credentials/*`, workspace-entrypoints, subpaths test, boundary harness, four `workspaceImports` lists; entrypoints green
- [x] **3.3** Admit `credentials` to the runtime-API confinement allowlist in `.dependency-cruiser.cjs` (`pathNot` regex for `runtime-apis-confinement`, comment updated to name it as credential I/O) and register a failing negative fixture in `tests/boundaries/fixtures/cases.ts` + `tests/boundaries/fixture-registry.json` under the existing rule: a provider scaffold subpath importing `node:*` fails while the credentials subpath's ambient access passes; fixture-coverage meta-check green. Run `bun test tests/boundaries` and `pnpm check:boundaries` (after build). (NFR-7; supports AC-F3-3, AC-F4-3) — done — confinement allowlist admits `credentials`; failing `io` fixture + admitted `credentials` clean control; boundaries 113 PASS
- [x] **3.4** Add `tests/behaviour/credential-port.test.ts` (+ `tests/fixtures/credentials/cases.ts`) and `tests/structure/{port-credential-surface,credential-constants}.test.ts`: success returns material once with a canary absent from every captured diagnostic/log/error payload (raw and JSON-escaped forms); host-`process.env` mutation does not affect resolution (only the injected record is consulted); deterministic repeat resolution; absent/empty references classified exactly (user, non-retryable, not landed, user-validation) with no containment and no environment dump; kind-only `config` lookup still throws; surface AST asserts no mode/implementation/environment-specific discriminant (temp-copy `mode: "direct" | "mediated"` injection fails); declared mapping survives external-system rename (no guessing); brand prefix derives from the seam (literal-prefix mutation fails); `forbidden-literals` green over the new constants; mapping is declarative data, not an algorithm reading ambient state. (AC-F3-1, AC-F3-2, AC-F3-3; TC-PORT-005, TC-PORT-006, TC-PORT-007, TC-PORT-008) — done — behaviour + surface/constant suites; canary, host-env isolation, exact identity, no-mode injection, declarative mapping
- [x] **3.5** Placement-dispute gate (OQ-1/RSK-6): if delivery disputes the DEC-2 placement of the environment-backed implementation, STOP the affected tier work before merging and raise a technical decision record via `@decision-advisor` (PM routes it); the recorded alternative (environment record injected from each surface edge, three allowlist entries) may only replace the recorded placement through that decision — never by silent relocation or allowlist widening. If undisputed, record "not required" with a one-line note. (spec §14 OQ-1, §15 DEC-2) — not required — DEC-2 placement was undisputed during delivery; no TDR raised

**Acceptance Criteria**:

- Must: secret material returned once through the port result and absent from all captured outputs; absent/empty credentials carry the exact classified identity (AC-F3-1, AC-F3-2).
- Must: the port surface exposes no implementation mode; the sidecar path is documented as a constraint; the implementation lives outside the contracts tier (AC-F3-3).
- Must: the confinement allowlist change ships with its failing negative fixture; every registration surface lists `./credentials` consistently (NFR-7).

**Files and modules**:

- Code areas: new `packages/adapters/src/credentials/**`; updated `packages/adapters/package.json`, `.dependency-cruiser.cjs`, `scripts/checks/workspace-entrypoints.ts`, `tests/structure/subpaths.test.ts`, `tests/boundaries/{harness.ts,fixtures/cases.ts,fixture-registry.json}`, `packages/{cli,mcp,opencode,testkit}/package.json`; new credential test suites/fixtures; updated `tests/structure/inventory.json`.
- System docs: none beyond the Phase 1 error row (sidecar constraint is contract documentation, authored in Phase 1/3 code docs).

**Tests**:

- `pnpm build` then `bun test tests/behaviour/credential-port.test.ts tests/behaviour/error-classification.test.ts tests/structure/subpaths.test.ts tests/structure/port-credential-surface.test.ts tests/structure/credential-constants.test.ts tests/boundaries`; `bun run scripts/checks/workspace-entrypoints.ts`; `pnpm check:boundaries`; `pnpm check:forbidden-literals`.

**Completion signal**: `feat(GH-181): add environment-backed credential port at declared adapters credentials subpath`

---

### Phase 4: Secret-read boundary invariant, binding in CI and the local chain

**Goal**: Make "no secret read outside the credential port" a mechanically proven property: the AST invariant, its enumerated allowlist, negative fixtures, mutation/non-vacuity proofs, and binding wiring asserted by the extended topology/bindingness invariants (DEC-4).

**Tasks**:

- [x] **4.1** Add `scripts/checks/secret-read-boundary.ts` mirroring the `ambient-globals.ts` style: exported `scan(root)`/`validate(root)`, rule identifier, fail-closed output naming rule/file/line, read-only live-tree run, and a reported scoped-file count (non-vacuity). Scope: `packages/*/src/**` production sources. Detect ambient environment reads across AST forms: `process.env.X`, `Bun.env`, `Deno.env`, bracket access, optional chaining, and destructured reads — every form either reported by the rule or rejected by a documented unsupported-form negative control, never silently accepted. (F-4, DEC-4; feeds TC-SECRET-001) — done — `scripts/checks/secret-read-boundary.ts` (`scan`/`validate`, rule id, fail-closed rule/file/line, scoped count; env forms incl. bracket/optional/destructured/aliased)
- [x] **4.2** Define the enumerated allowlist registry inside the check: exact paths with class and reason — `packages/adapters/src/credentials/` (`credential-material`, the sole such entry: environment-backed credential implementation), `packages/adapters/src/file/yaml-parser.ts` (`configuration-environment-source`: pre-existing parser host-switch guard), `packages/adapters/src/legacy/index.ts` (`configuration-environment-source`: pre-existing legacy-name adapter). Exact-path-only validation; entries require reasons; wildcards/prefixes rejected. (F-4, spec §8.3 credential rules; feeds TC-SECRET-003) — done — exact `file` vs `directory` entries with class + reason; one `credential-material`; wildcards/prefixes/trailing separators rejected (DoR nit 4)
- [x] **4.3** Add `tests/checks/secret-read-boundary.test.ts` with fixtures at `tests/fixtures/secret-boundary/{cases,allowlist}.ts` (materialized only in `mkdtemp` workspaces, never under `packages/**`, never `*.test.ts`): planted `process.env.SECRET` in a provider-adapter-shaped module fails naming rule/file/line; every AST variant covered or explicitly rejected; clean control (the three sanctioned readers) passes; registry-shape assertions (exact entries, classes, reasons, sole credential-material entry); mutations A–E — remove credential entry (sanctioned read now fails), add undeclared provider credential path, reasonless entry, second `credential-material` entry, wildcard/prefix entry — all fail closed; live tree unchanged (`git status --porcelain` before/after). (AC-F4-1, AC-F4-3, NFR-2, NFR-7; TC-SECRET-001, TC-SECRET-003) — done — `tests/checks/secret-read-boundary.test.ts` + fixtures; mutations A–E fail closed; live tree read-only
- [x] **4.4** Non-vacuity and fixture coverage (TC-SECRET-004): assert the live scan scopes a non-zero file set with zero violations; a planted violation returns >0 naming the fixture path; removing the clean control's allowlist entry in a temp copy fails (the control is a real sanctioned read); register the new rule with the fixture-coverage meta-check (`tests/boundaries/fixture-coverage.test.ts`, mirroring the ambient rule ids) so deleting the only negative fixture, emptying the registry, or downgrading to advisory fails. (AC-F4-3, NFR-7) — done — non-vacuity + fixture-coverage meta-check (`validateFixtureCoverage`) registered; deletion/empty-registry proofs
- [x] **4.5** Wire bindingly and extend the wiring invariants (TC-SECRET-002): append `bun run scripts/checks/secret-read-boundary.ts` to the root `check:boundaries` chain; add the same command as a line inside the existing `ts-invariants` CI job (additions-only; `TS_JOBS` unchanged); extend `tests/checks/ci-checks.test.ts` (command invoked by name from `ts-invariants`; removal from a temp workflow/package.json copy fails by name) and the local-chain parity assertions (`boundary-ci-parity` check/tests cover the boundary chain containing the new command); `ci-topology` generic wiring scan stays green (the new `scripts/checks/*.ts` name appears in `ci.yml` + `package.json`); `ci-bindingness` green with no bypass constructs on mutated copies (`continue-on-error`, `|| true`, `set +e`, `if: always()`, `exit 0`); `pnpm check` green end-to-end. (AC-F4-2, NFR-3) — done — appended to `check:boundaries` and one `ts-invariants` line; `ci-checks` asserts both surfaces and removals by name; topology/bindingness/parity green (local-chain attribution per DoR finding 3)

**Acceptance Criteria**:

- Must: a planted ambient read in a provider adapter module fails naming rule, file, and line; the clean control passes (AC-F4-1).
- Must: the invariant runs as a binding CI step and in the local boundary chain, asserted by the extended topology/bindingness/parity checks; no bypass construct accepted (AC-F4-2).
- Must: allowlist mutations fail closed; the registry is reason-bearing, exact-path, and holds exactly one credential-material entry; non-vacuity and fixture-coverage proofs green (AC-F4-3).

**Files and modules**:

- Code areas: new `scripts/checks/secret-read-boundary.ts`, `tests/checks/secret-read-boundary.test.ts`, `tests/fixtures/secret-boundary/**`; updated root `package.json` (`check:boundaries`), `.github/workflows/ci.yml` (one added line in `ts-invariants`), `tests/checks/ci-checks.test.ts`, `tests/checks/boundary-ci-parity.test.ts` (+ `scripts/checks/boundary-ci-parity.ts` if the local-chain assertion belongs in the check), `tests/boundaries/fixture-coverage.test.ts`.
- System docs: none (the invariant's contract is its output shape: rule, file, line).

**Tests**:

- `pnpm build` then `bun test tests/checks/secret-read-boundary.test.ts tests/checks/ci-checks.test.ts tests/checks/boundary-ci-parity.test.ts tests/boundaries`; `bun run scripts/checks/secret-read-boundary.ts` (clean tree, read-only); `bun run scripts/checks/ci-topology.ts`; `bun run scripts/checks/ci-bindingness.ts`; `pnpm check:boundaries`; `pnpm check`.

**Completion signal**: `feat(GH-181): add binding secret-read boundary invariant with allowlist registry and CI wiring`

---

### Phase 5: Code Review (Analysis)

**Goal**: Independently audit the delivered substrate against spec, plan, and test plan without modifying implementation during analysis.

**Tasks**:

- [ ] **5.1** PM delegates independent analysis to `@reviewer` after the coder's no-review handoff: trace all 17 ACs and 19 TCs to code and non-vacuous test evidence; inspect the inventory fail-closed proof, capability/gap typing, credential classification and leak controls, invariant firing/bindingness/mutation proofs, and matrix exhaustiveness. — skipped per this run instruction (`no review`); no review artifact produced
- [ ] **5.2** Audit secret handling end-to-end (canary coverage, returned-once discipline, allowlist integrity, no diagnostic channel), codec purity and placement (no runtime imports under `src/io`, no core-subpath hoist, no agent-facing raw carrier), contract neutrality, and protected-path compliance (no `scripts/*.sh`, `tools/`, `.opencode/`, `.ados-claude/` changes; no hand-added headers; brand-neutral constants). — skipped per this run instruction (`no review`); no review artifact produced
- [ ] **5.3** Record findings/verdict through the review artifact workflow; route implementation findings to Phase 6 and decision-class findings (placement, allowlist growth, contract shape disputes) to the PM and `@decision-advisor` — never a silent alternative. — skipped per this run instruction (`no review`); no review artifact produced

**Acceptance Criteria**:

- Must: reviewer produces a traceable PASS or actionable findings against spec/test plan/plan with no fabricated evidence.
- Must: any missing evidence or failed negative control is unfinished work; no severity downgrade to pass the gate.

**Files and modules**:

- Code areas: none (read-only analysis of Phases 1–4).
- System docs: none during analysis.

**Tests**:

- Evidence inspection for all 19 TCs; `@runner` reproduction of questionable evidence rather than assumed passes.

**Completion signal**: independent verdict recorded; PASS advances to Phase 7, findings activate Phase 6.

---

### Phase 6: Post-Code Review Fixes (conditional)

**Goal**: Close accepted review findings without scope expansion or regression loss.

**Tasks**:

- [ ] **6.1** If findings exist: reproduce each via the relevant TC/negative fixture, add the missing regression first, then apply the smallest fix; preserve behavior outside the accepted slice. — activated by review iteration 1 (see remediation tasks R-1..R-3 below)
- [ ] **6.2** Fix code, registries, fixtures, and any affected docs together; an error-table change carries both tables in the same fix; an allowlist or boundary-rule change carries its failing fixture in the same fix. — activated by review iteration 1 (see remediation tasks R-1..R-3 below)
- [ ] **6.3** PM delegates `@runner` repetition of affected suites/mutations and the full applicable gates, and independent re-review until PASS. If no findings, record the phase as not required with the Phase 5 PASS as evidence. — pending; re-review (iteration 2) required after R-1..R-3

**Remediation tasks from review iteration 1** (`review/review-iter-1.md`; verdict FAIL — 0 blockers, 1 major, 2 minor, 2 informational):

- [ ] **R-1 (major — finding F-1)** Close the computed-key hole in `scripts/checks/secret-read-boundary.ts`: element access over an ambient-global identifier with a non-literal key (`process[key]`, `process[\`env\`]`) and computed global names (`globalThis[expr].env`) is currently silently accepted (empirically proven: zero violations), violating spec F-4 / task 4.1 "never silently accepted". Fix fail-closed: flag `ElementAccessExpression` whose expression is an ambient-global identifier whenever the argument is not a string literal, naming it `ambient element access with non-literal key` (or document these as unsupported forms with negative-control fixtures per task 4.1). Add fixtures to `tests/fixtures/secret-boundary/cases.ts` for computed-key and template-literal keys; keep the clean control green; re-run `bun test tests/checks/secret-read-boundary.test.ts` and `bun run scripts/checks/secret-read-boundary.ts`.
- [ ] **R-2 (minor — finding F-2)** Bound adversarial marker scanning in `packages/adapters/src/io/envelope-codec.ts`: the lazy-quantifier marker regexes are quadratic on marker-dense input (measured 1747 ms for a 193 KB hostile comment in a single parse call; provider comment text becomes external user-controlled content when M0-S13 adapters land). Fix by capping the scanned input (documented maximum with `missing` degradation beyond it) or an equivalent non-quadratic scan; add a pathological-input regression test with a time bound.
- [ ] **R-3 (minor — finding F-3)** Fix stale-index span stripping in `removeMarkers`/`stripSpan`: when an envelope payload string contains a compact-marker lookalike and trailing human content follows the comment marker, `stripEnvelope` returns `""`/truncated output — silently destroying human-readable content with no degradation evidence (violates AC-F5-2 identity; empirically proven). Fix by rebuilding the string from non-overlapping spans in a single pass (or one combined regex) so indices cannot go stale; add a regression fixture with a nested lookalike plus trailing content. Informational F-4 (lookalike text in plain human content is stripped as a marker) may be documented alongside in `doc/spec/features/feature-adapter-ports.md`; no code change required.

**Acceptance Criteria**:

- Must: all accepted findings closed; affected ACs remain traceable; previously green controls stay green.
- Must: no waived check, no undocumented scope expansion, no unresolved blocker.

**Files and modules**:

- Code areas: only affected Phase 1–4 files and their regressions; no blanket cleanup.
- System docs: only the Phase 1 documented row if the error identity changes (lockstep preserved).

**Tests**:

- Reproduce the failing TC cases; re-run affected suites, then the Phase 7 gate battery.

**Completion signal**: reviewer PASS after fixes, or explicit not-required state backed by Phase 5 PASS.

---

### Phase 7: Finalize and Release

**Goal**: Version intent, gate battery, DoD verification, and a coherent rollback-ready handoff as an open unmerged PR to `main-tools`; merge/publish stay outside this slice.

**Tasks**:

- [x] **7.1** Add a Changesets minor release declaration for the five publishable fixed-group packages (`@delivery-os/core`, `@delivery-os/adapters`, `@delivery-os/cli`, `@delivery-os/mcp`, `@delivery-os/opencode`), mirroring the GH-173 precedent (`.changeset/` file with all five `minor` entries and a GH-181 description); the contract surface change (new core `./contracts` exports and the new adapters subpath) warrants minor; `changesets-group` and `testkit-exclusion` checks green; no version hand-bumps, no publish, no private-flag flips. — done — `.changeset/gh-181-primitive-ports-minor.md` (five minor entries); changesets-group + testkit-exclusion green
- [x] **7.2** Spec reconciliation handoff: confirm the in-change doc set is exactly the documented error-table row (Phase 1); hand the new feature spec (adapter/credential/envelope ports), primitive-catalogue status updates for the nine rows, glossary terms, and OQ-2 catalogue bookkeeping to the lifecycle documentation-sync phase (`@doc-syncer`); verify no stale doc claims contradict the delivered surface. — done — in-change doc set is exactly the `config.credential.missing` row; feature-spec, catalogue status, glossary, OQ-2 handed to doc-sync
- [x] **7.3** Ask `@runner` to execute and record the final ordered gate battery with commands, results, and the tested SHA: `pnpm install --frozen-lockfile` → `pnpm build` → `bun test tests/structure tests/behaviour tests/checks tests/boundaries` → `bun run scripts/checks/{ambient-globals,error-table-sync,secret-read-boundary,ci-topology,ci-bindingness,ci-supply-chain,workspace-entrypoints,forbidden-literals,changesets-group,testkit-exclusion}.ts` → `pnpm check:boundaries` → `pnpm check` → exports gates (`exports-discipline`, `exports-parity`, per-package `publint`/`attw` since the adapters exports map changed) → `git diff --check`. Resolve failures and repeat rather than bypassing; record per-TC evidence in the test plan's §10 execution log. — done — ordered battery green (554 targeted PASS, `pnpm check` 604 PASS, ten invariants, boundaries, exports/publint/attw, `git diff --check`); per-TC rows in test-plan §10
- [x] **7.4** Verify the Definition of Done checklist (below) against current evidence; PM confirms all 17 ACs have passing traceable evidence and records divergences for escalation rather than rewriting requirements to match bugs. — done — 17/17 ACs traceable to passing TCs; all DoD predicates verified except the open PR
- [ ] **7.5** Rollback instructions and scope proof in the PR handoff: additive-only change (no persisted state, no config keys, no bash-stack edits, no installed-corpus changes); revert all phase commits as one coherent unit per the Scope > Rollback paragraph — error-table rows and boundary/allowlist registrations never revert one-sided; re-run baseline gates after any rollback. PR targets `main-tools`; all required `ts-*` and bash jobs green on the pushed HEAD, not an earlier SHA; STOP at the open unmerged PR. — rollback/scope proof recorded; open PR NOT created — push/PR was not requested in this run, so the `/pr` handoff is pending

**Acceptance Criteria**:

- Must: minor release intent present and consistent with the fixed group; spec reconciliation handoff explicit; gate battery green at the recorded SHA.
- Must: every DoD checklist predicate has current passing evidence.
- Must: rollback is coherent and never splits a synchronized pair; PR open, unmerged, base `main-tools`, CI green on the pushed HEAD.

**Files and modules**:

- Code areas: `.changeset/` minor declaration; no product-code change unless a gate reopens Phase 6.
- System docs: handoff notes only; feature-spec authoring belongs to the doc-sync phase.

**Tests**:

- The Phase 7.3 battery is the test set; no separate execution is claimed by this plan.

**Completion signal**: `chore(GH-181): add minor release intent and final gate evidence for PR handoff`

### Definition of Done checklist (mirrors spec §18)

- [x] All 17 ACs (AC-F1-1 … AC-F6-1) have passing, traceable evidence via the 19 TCs (test-plan §10).
- [x] Secret-read invariant green on the clean tree and proven to fire on planted violations; clean controls stay green.
- [x] Round-trip and degradation matrices pass exhaustively (100% / 0 failures / 100% visible evidence).
- [x] Error-table sync green with `config.credential.missing` in both tables; existing classification unchanged.
- [x] All existing binding gates (bash and TypeScript) remain green; `pnpm check` passes; bash jobs byte-unchanged.
- [x] Placement disputes: none raised (DEC-2 undisputed); no TDR required.
- [x] Documentation synchronized in-change (error row); remainder handed to the doc-sync phase.
- [ ] Open unmerged PR targeting `main-tools` — NOT created: push/PR was not requested in this run.

---

## Test Scenarios

All 19 TCs from the test plan map to phases below; TC IDs, AC traces, and target files follow test-plan §§5–7 (locations authoritative there; only reconciliations this plan made are the codec path and the type-test project, recorded in Context).

| TC ID | Scenario | AC | Phase(s) | Suite / file |
|---|---|---|---|---|
| TC-PORT-001 | v1 contract surface inventory, fail-closed both directions | AC-F1-1 | 1 | `tests/structure/port-contract-inventory.test.ts`, `tests/fixtures/ports/v1-contract-inventory.json` |
| TC-PORT-002 | Neutral-tier purity (ambient + declaration-only + aggregate) | AC-F1-2 | 1, 4 | `tests/structure/port-neutrality.test.ts`, `tests/structure/content-inventory.test.ts`, `tests/boundaries/**` |
| TC-PORT-003 | Capability flags and explicit gaps on fixture adapters | AC-F2-1 | 2 | `tests/behaviour/port-capabilities.test.ts`, `tests/fixtures/ports/capabilities.ts` |
| TC-PORT-004 | Declared-carrier typing (runtime + type-level probe) | AC-F2-2 | 1, 2 | `tests/structure/port-carrier-types.test.ts`, `tests/behaviour/port-capabilities.test.ts`, `tests/types/port-carrier-types.type-test.ts` |
| TC-PORT-005 | Credential success without leaks (canary, capture sink) | AC-F3-1 | 3 | `tests/behaviour/credential-port.test.ts`, `tests/fixtures/credentials/cases.ts` |
| TC-PORT-006 | Missing/empty credential classified; no containment | AC-F3-2 | 1, 3 | `tests/behaviour/credential-port.test.ts`, `tests/behaviour/error-classification.test.ts` |
| TC-PORT-007 | No implementation mode; sidecar path documented | AC-F3-3 | 1, 3 | `tests/structure/port-credential-surface.test.ts` |
| TC-PORT-008 | Declared reference and brand-neutral source key | AC-F3-1 | 3 | `tests/behaviour/credential-port.test.ts`, `tests/structure/credential-constants.test.ts` |
| TC-SECRET-001 | Planted ambient-read violation fires; variants covered | AC-F4-1 | 4 | `tests/checks/secret-read-boundary.test.ts`, `tests/fixtures/secret-boundary/cases.ts` |
| TC-SECRET-002 | Binding CI step and local boundary chain; wiring asserted | AC-F4-2 | 4 | `tests/checks/ci-checks.test.ts`, `tests/checks/boundary-ci-parity.test.ts` |
| TC-SECRET-003 | Allowlist mutations A–E fail closed; sole credential entry | AC-F4-3 | 4 | `tests/checks/secret-read-boundary.test.ts`, `tests/fixtures/secret-boundary/allowlist.ts` |
| TC-SECRET-004 | Non-vacuity and fixture coverage | AC-F4-3 | 4 | `tests/checks/secret-read-boundary.test.ts`, `tests/boundaries/fixture-coverage.test.ts` |
| TC-META-001 | Golden carrier round-trip within the 2048-byte bound | AC-F5-1 | 1, 2 | `tests/behaviour/envelope-roundtrip.test.ts`, `tests/fixtures/envelope/golden/**` |
| TC-META-002 | Parse and strip; no residue; audited escape hatch only | AC-F5-2 | 2 | `tests/behaviour/envelope-roundtrip.test.ts` |
| TC-META-003 | Six-case degradation matrix, DEC-8 taxonomy | AC-F5-3 | 2 | `tests/behaviour/envelope-degradation.test.ts`, `tests/fixtures/envelope/degradation/**` |
| TC-META-004 | Closed payload; no secret fields; brand-neutral constants | AC-F5-4 | 1, 2 | `tests/structure/envelope-contract.test.ts`, `tests/fixtures/envelope/schema-cases.json` |
| TC-META-005 | Adapter-only write path; codec placement (DEC-9) | AC-F5-5 | 2 | `tests/behaviour/envelope-write-path.test.ts`, `tests/structure/envelope-contract.test.ts` |
| TC-META-006 | Version window; unknown versions degrade visibly (DEC-7) | AC-F5-3, AC-F5-6 | 1, 2 | `tests/behaviour/envelope-degradation.test.ts`, `tests/fixtures/envelope/versions/**` |
| TC-ERR-001 | Error-table sync both directions; classification unchanged | AC-F6-1 | 1 | `tests/checks/error-table-sync.test.ts`, `tests/structure/error-table.test.ts`, `tests/behaviour/error-classification.test.ts` |

Ticket-AC traceability (spec §24 appendix): AC-1 (typed ports + capability flags) → AC-F1-1/F1-2/F2-1/F2-2 → Phases 1–2; AC-2 (CI boundary check on secret reads) → AC-F3-1/F3-3/F4-1/F4-2/F4-3 → Phases 3–4; AC-3 (envelope round-trip + graceful degradation) → AC-F5-1…F5-6 → Phases 1–2.

## Artifacts and Links

| Artifact | Location | Role / handling |
|---|---|---|
| Change specification | [chg-GH-181-spec.md](./chg-GH-181-spec.md) | Source of requirements: F-1–F-6, DM-1–DM-10, NFR-1–NFR-7, DEC-1–DEC-9, §17 ACs, §18 DoD |
| Test plan | [chg-GH-181-test-plan.md](./chg-GH-181-test-plan.md) | Source of the 19 TC IDs, target layers, matrices, mutation/non-vacuity discipline, §7.2 wiring notes |
| PM notes | `./chg-GH-181-pm-notes.yaml` | Read-only orchestration context |
| This plan | `./chg-GH-181-plan.md` | Only file written by this authoring pass |
| Architecture | [ADR-0003](../../../decisions/ADR-0003-oss-monorepo-structure.md) | Package/tier matrix, runtime-API confinement, dev-edge rules this plan extends |
| Error contract doc | `doc/spec/features/feature-result-contract.md` | Phase 1 documented row (code-bound artifact of the sync check) |
| Precedent plan | [chg-GH-173-plan.md](../2026-10-30--GH-173--config-layer/chg-GH-173-plan.md) | Phase structure, changeset convention, gate-battery ordering |
| Testing strategy | [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) | Layer-to-gate mapping, fixture rules |
| TS rules | [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md) | Strict-TS, purity, boundary-change discipline |
| Boundary config | `.dependency-cruiser.cjs` | Phase 3 confinement allowlist entry + negative fixture |
| New invariant | `scripts/checks/secret-read-boundary.ts` (Phase 4) | Registered in CI `ts-invariants` and `check:boundaries` |
| Release intent | `.changeset/` minor declaration (Phase 7) | Five-package fixed group; no publishing here |
| System docs (post-delivery) | `doc/spec/features/**`, primitive catalogue, glossary | Owned by the lifecycle doc-sync phase, not this change |

Protected paths untouched by every phase: `scripts/*.sh`, `tools/`, `.opencode/`, `.ados-claude/`, bash CI jobs. The only `.github/workflows/ci.yml` change is one added line inside `ts-invariants` (additions-only per `ci-topology`).

## Plan Revision Log

| Version | Date (UTC) | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-10-30T20:31:46Z | Implementation Plan Writer | Initial seven-phase, 35-task plan: 17/17 AC and 19/19 TC mapping; codec placement mechanics (DEC-9) resolved to `packages/adapters/src/io/` with root-test dev-edge imports; type-test project added for AC-F2-2; secret-read invariant wiring as a `ts-invariants` step plus `check:boundaries` entry; error-row lockstep in Phase 1; changeset and DoD/rollback in Phase 7. |
| 1.1 | 2026-10-30T21:48:32Z | Reviewer (review iteration 1) | Phase 6 activated with remediation tasks R-1..R-3 from `review/review-iter-1.md` (1 major: computed-key ambient reads silently accepted by the secret-read invariant; 2 minor: codec quadratic marker scan, stale-index strip corruption). Phase 5 execution-log row recorded. No other plan content changed. |

## Execution Log

| Phase | Status | Started | Completed | Commit | Notes |
|-------|--------|---------|-----------|--------|-------|
| Authoring | Complete | 2026-10-30T20:31:46Z | 2026-10-30T20:31:46Z | none | Read the completed spec and test plan, the template, ADR-0003, GH-173 precedent, and the live repo surfaces (contracts, adapters manifests, `.dependency-cruiser.cjs`, checks, CI workflow, boundary harness, testkit). Only this plan file written; no git/build/test operations. |
| 1 | Complete | 2026-10-30T20:45Z | 2026-10-30T21:51Z | 2beeaf2 | 6/6 tasks; `bun test tests/structure tests/behaviour` 229 PASS; ambient-globals + error-table-sync (14/14) + `pnpm check:boundaries` green. |
| 2 | Complete | 2026-10-30T21:52Z | 2026-10-30T22:20Z | 806cbef | 8/8 tasks; typecheck incl. `tests/types` green; 264 structure+behaviour tests PASS; forbidden-literals green. |
| 3 | Complete | 2026-10-30T22:21Z | 2026-10-30T22:40Z | 2273b2b | 5/5 tasks (3.5 not required); 148 targeted+boundaries PASS; check:boundaries, workspace-entrypoints, forbidden-literals green. |
| 4 | Complete | 2026-10-30T22:41Z | 2026-10-30T23:20Z | f81ec70 | 5/5 tasks; 160 targeted+boundaries PASS; `pnpm check` 604 PASS (remediation: per-test timeout on the pre-existing attw pack mutation, behavior unchanged). |
| 5 | Complete | 2026-10-30T21:05Z | 2026-10-30T21:48Z | none | Independent review iteration 1 (`review/review-iter-1.md`): FAIL — 0 blockers, 1 major (secret-read invariant silently accepts computed-key ambient reads), 2 minor (codec quadratic marker scan; stale-index strip corruption), 2 informational. All 17 AC/19 TC evidence spot-verified by re-running suites (36 behaviour + 121 structure + 153 checks + 115 boundaries PASS; invariants green). |
| 6 | Activated (pending) | 2026-10-30T21:48Z | — | — | Remediation tasks R-1..R-3 appended to Phase 6; re-review iteration 2 required after fixes. |
| 7 | Complete (PR pending) | 2026-10-30T23:21Z | 2026-10-30T23:45Z | ffd2a34 | Changeset + gate battery + DoD verified; open PR not created because push/PR was not requested. |
