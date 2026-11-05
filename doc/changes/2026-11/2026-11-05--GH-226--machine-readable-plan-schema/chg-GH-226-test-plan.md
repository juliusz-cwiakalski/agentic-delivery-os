---
id: chg-GH-226-test-plan
status: Proposed
created: 2026-11-05T20:20:03Z
last_updated: 2026-11-05T20:20:03Z
owners: [engineering]
service: delivery-os-cli
labels: [change, m1, delivery-engine]
version_impact: minor
summary: "Verify the machine-readable delivery plan schema and the `plan` family: classified validation and gate refusal, tier/artifact/lease echo, overlap sequencing with named paths, declared-versus-actual diff, plan lint, legacy transition, and deterministic read-only envelopes."
links:
  change_spec: ./chg-GH-226-spec.md
  implementation_plan: null
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - M1-S13: Machine-readable delivery plan schema

## 1. Scope and Objectives

Protect the computability of delivery plans: a plan validates or is refused with a classified code naming the phase and field, the ceremony tier is echoed from plan data with no built-in default, overlap answers sequence versus parallel with the shared paths named and producers first, `diff` classifies declared versus actual scope, and legacy markdown plans stay readable with a classified transition verdict. Two integrity risks dominate: a silent accept of an uncomputable plan (the scheduler would act on it), and a false-parallel verdict (two changes would collide in delivery). Every verdict path is also deterministic, read-only, and envelope-clean, because downstream schedulers (M1-S17) branch on verdict data rather than exit codes.

### 1.1 In Scope

- Plan document schema and schema-version handling (F-1, DM-1): per-phase scope (files, packages, folders, wildcards), done-artifacts, leases, weight class, interactions, tier/variant data, plan-level defaults.
- Pure verdict logic in the core domain layer: schema validation and classification, tier resolution, lease-class reporting, overlap computation with producer-first ordering, declared-versus-actual diff classification, bounded output truncation.
- `plan validate`, `plan diff`, `plan overlap` command definitions tested through injected runtimes, plus CLI-edge exit projection and the envelope contract.
- `lint` plan target: conformant, non-conformant, unreadable.
- Ready-for-development verdict and gate refusal (AC-F12-1), including the seeded scenarios SC-M1-06 and SC-M1-07 with their recorded reconciliations.
- Additive `plan.*` error identities, error-table/registry binding, layering and registration invariants.
- Migration surface: plan-writer output flip, implementation-plan template, consuming prompt guidance, generated-plugin staleness, plan file naming documentation, `ados_distribution` markers on changed distributable docs.

### 1.2 Out of Scope & Known Gaps

Deferred or untestable in this change (explicit, not silent):

- **`queue add` park-behind-valid-plan warning** — the M1-S17 integration point (DEC-2). No `queue add` surface exists in this change; the seed's assertion (SC-M1-07) is reconciled to the in-scope gate refusal in TC-DPLAN-009. **Owner: M1-S17.**
- **Scheduler consumption of verdicts** — N-way batching, lane placement, lease acquisition, single-flight, weight-class co-scheduling all belong to M1-S17. This plan verifies that verdict data is present and well-formed; it does not verify scheduling decisions.
- **Execution-time verification of done-artifacts at lane joins** — plans declare MR URL, pipeline id, deployed environment, tracker transition; verifying their reality needs tracker/CI reads that this story does not have (F-3 detail).
- **Ceremony engine and escalation-trigger evaluation** (M2-S3) — triggers are echoed as inert data only (TC-DPLAN-006).
- **Blocking enforcement of `plan diff` findings** — diff is observational here.
- **Removal of legacy markdown readability** — deliberately deferred (F-13).
- **Feature specification under `doc/spec/features/`** — authored or flagged at the `system_spec_update` phase (spec §16), verified there, not by this plan.
- **Generated-plugin behavioural parity** — only staleness (regeneration committed in sync) is checked; plugin runtime behavior is out of scope.
- **Real git/network/tracker behavior** — every plan-command test injects a repository-diff port and file reads; no test runs `git`, reads a network, or spawns a process.

## 2. References

- [Change specification](./chg-GH-226-spec.md) — sections 5 (capabilities), 8 (interfaces), 9 (NFRs), 12, 15 (DEC-1..DEC-7), 17 (ACs), 21 (security), 22 (maintenance).
- Repository testing strategy: `.ai/rules/testing-strategy.md` (layers, module-to-test mapping, invariant-test authoring, quality gates).
- TypeScript workspace rules: `.ai/rules/typescript.md` — §7 (envelope, error codes, registry binding), §9 (bun:test authoring, fixtures, goldens, determinism), §10 (gates).
- Design baseline: `doc/planning/oss-tooling/milestones/m1/commands/plan.md` (output data, exit status), `.../commands/lint.md` (plan target, exit 2 unreadable), `.../contracts.md` (plan family contracts), `.../test-scenarios.md` (SC-M1-06, SC-M1-07, SC-M1-19), `.../interactions.md` (producer-first session).
- Plan file naming pin: DEC-7; unified change convention guide `doc/guides/unified-change-convention-tracker-agnostic-specification.md`.
- Implementation plan: **not present at authoring time** (test planning precedes delivery planning). Reconcile this document's Automation Plan and Risks when `chg-GH-226-plan.md` lands; the plan may add testing tasks but must not replace these acceptance criteria.

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| Capability | Acceptance criterion | Scenario(s) | Status |
|---|---|---|---|
| F-1 versioned plan document | — (schema version surface) | TC-DPLAN-001, TC-DPLAN-003 | Implemented |
| F-2 per-phase declared scope | AC-F10-1 (precision), AC-F9-1 (classification) | TC-DPLAN-015, TC-DPLAN-017, TC-DPLAN-019 | Implemented |
| F-3 done-artifacts | AC-F3-1 | TC-DPLAN-007, TC-DPLAN-003 | Implemented |
| F-4 leases and weight class | AC-F7-1 | TC-DPLAN-008 | Implemented |
| F-5 declared interactions | AC-F10-3 | TC-DPLAN-013, TC-DPLAN-016 | Implemented |
| F-6 tier/variant as data | AC-F6-1 | TC-DPLAN-004, TC-DPLAN-005, TC-DPLAN-006 | Implemented |
| F-7 lease classes (planning lease-free / delivery lease-taking) | AC-F7-1 | TC-DPLAN-008 | Implemented |
| F-8 `plan validate` | AC-F8-1 | TC-DPLAN-001, TC-DPLAN-002, TC-DPLAN-003 | Implemented |
| F-9 `plan diff` | AC-F9-1 | TC-DPLAN-017, TC-DPLAN-018, TC-DPLAN-019 | Implemented |
| F-10 `plan overlap` | AC-F10-1, AC-F10-2, AC-F10-3 | TC-DPLAN-013, TC-DPLAN-014, TC-DPLAN-015, TC-DPLAN-016 | Implemented |
| F-11 plan lint target | AC-F11-1 | TC-DPLAN-020, TC-DPLAN-021 | Implemented |
| F-12 ready-for-development gate | AC-F12-1 | TC-DPLAN-009, TC-DPLAN-010 | Implemented |
| F-13 legacy migration path | AC-F13-1 | TC-DPLAN-011, TC-DPLAN-012, TC-DPLAN-029, TC-DPLAN-030 | Implemented |

| Acceptance criterion | Description (short) | Scenario(s) | Status |
|---|---|---|---|
| AC-F3-1 | Done-artifacts echoed per delivery phase | TC-DPLAN-007 | Implemented |
| AC-F6-1 | Tier echoed with no built-in default; unknown tier rejected | TC-DPLAN-004, TC-DPLAN-005, TC-DPLAN-006 | Implemented |
| AC-F7-1 | Planning lease-free, delivery lease-taking; leases and weight echoed | TC-DPLAN-008 | Implemented |
| AC-F8-1 | Invalid schema rejected with `plan.schema.invalid` naming phase and field | TC-DPLAN-002, TC-DPLAN-003 | Implemented |
| AC-F9-1 | Diff classifies `within` / `outside-declared` / `undeclared-missing` under the classified scope code | TC-DPLAN-017, TC-DPLAN-019 | Implemented |
| AC-F10-1 | Sequence verdict, every overlapping path named, exit 1 with verdict data | TC-DPLAN-013, TC-DPLAN-015 | Implemented |
| AC-F10-2 | Parallel verdict, empty overlapping list, exit 0 | TC-DPLAN-014 | Implemented |
| AC-F10-3 | Producer-first ordering with shared-contract reason | TC-DPLAN-013, TC-DPLAN-016 | Implemented |
| AC-F11-1 | Lint plan non-conformant with classified errors + location, exit 1; conformant exit 0 | TC-DPLAN-020, TC-DPLAN-021 | Implemented |
| AC-F12-1 | Unvalidatable plan refused: `readyForDevelopment=false`, classified error naming phase and field, exit 1 | TC-DPLAN-009, TC-DPLAN-010 | Implemented |
| AC-F13-1 | Legacy markdown answered with classified legacy-format verdict, no crash, never silently schema-valid | TC-DPLAN-011, TC-DPLAN-012 | Implemented |

**Seeded scenario traceability and reconciliation** (source: `doc/planning/oss-tooling/milestones/m1/test-scenarios.md`, coverage map row M1-S13 = SC-M1-06..07):

| Seed | Inherited by | Reconciliation recorded |
|---|---|---|
| SC-M1-06 | TC-DPLAN-013 | **Exit assertion reconciled per DEC-1.** The seed asserts `exit 0` for a `run-in-sequence` verdict. The delivered contract (`commands/plan.md` exit status; the shared "negative verdict is a clean refusal" pin) fixes **exit 1 with verdict data always in the envelope** ("a verdict, not a failure"). The plan asserts exit 1, `data.verdict=run-in-sequence`, named `overlappingPaths`, producer-first `ordering`, `reason=shared-contract-files`, and — the seed's own machine-checkable rule — that every listed path exists in both declared scopes. The seed's intent (sequence answer with paths named) is preserved; only the exit number is refined, and consumers branch on data. |
| SC-M1-07 | TC-DPLAN-009 | **`queue add` warning assertion reconciled per DEC-2.** The seed asserts "queue add of GH-308 warns the entry is parked behind a valid plan"; `queue add` arrives with M1-S17 and the shipped `queue ready` is read-only and unchanged. In-scope realization: `plan validate GH-308` refuses with `plan.schema.invalid` naming phase 6 and the missing field, `readyForDevelopment=false`, exit 1. The plan additionally asserts that `queue ready` performs **zero plan reads** and emits byte-identical output for the same fixture as before the change, so the deferral is verified rather than assumed. |
| SC-M1-19 (cross-cutting) | TC-DPLAN-022 | Envelope-valid-on-failure and exit projection are re-asserted for the plan family, including the sequence-verdict exit class. |

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

No HTTP endpoints (spec §8.1) and no events (spec §8.2). The command-line surface is the contract.

| Surface / element | Scenario(s) | Status |
|---|---|---|
| `<binary> plan validate <ref>` — verdict, `perPhase`, `readyForDevelopment`, exit 0/1 | TC-DPLAN-001, TC-DPLAN-002, TC-DPLAN-009, TC-DPLAN-022 | Implemented |
| `<binary> plan diff <ref> [--against <base>]` — per-path table, exit 0/1 | TC-DPLAN-017, TC-DPLAN-018, TC-DPLAN-019, TC-DPLAN-022 | Implemented |
| `<binary> plan overlap <refA> <refB>` — verdict, `overlappingPaths`, `ordering`, `reason`, exit 0/1 | TC-DPLAN-013, TC-DPLAN-014, TC-DPLAN-015, TC-DPLAN-016, TC-DPLAN-022 | Implemented |
| `<binary> lint plan <ref>` — `documents[]` with verdict, errors, location; exit 0/1/2 | TC-DPLAN-020, TC-DPLAN-021 | Implemented |
| Text-mode keys (`verdict=`, `overlapping=`, `reason=`) | TC-DPLAN-013, TC-DPLAN-017, TC-DPLAN-022 | Implemented |
| DM-1 delivery plan document (versioned YAML, `chg-<ref>-plan.yaml`) | TC-DPLAN-001, TC-DPLAN-003, TC-DPLAN-010, TC-DPLAN-011, TC-DPLAN-030 | Implemented |
| DM-2 phase scope declaration with package/folder wildcards | TC-DPLAN-015, TC-DPLAN-019 | Implemented |
| DM-3 done-artifact typed slots | TC-DPLAN-007, TC-DPLAN-003 | Implemented |
| DM-4 lease and weight declaration | TC-DPLAN-008 | Implemented |
| DM-5 interaction declaration (producer/consumer) | TC-DPLAN-013, TC-DPLAN-016 | Implemented |
| DM-6 tier/variant declaration (phase sets, escalation triggers) | TC-DPLAN-004, TC-DPLAN-006 | Implemented |
| DM-7 verdict payloads (envelope `data`) | TC-DPLAN-001, TC-DPLAN-013, TC-DPLAN-017, TC-DPLAN-022, TC-DPLAN-025 | Implemented |
| DM-8 additive `plan.*` identities | TC-DPLAN-002, TC-DPLAN-003, TC-DPLAN-005, TC-DPLAN-011, TC-DPLAN-017, TC-DPLAN-028 | Implemented |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR | Scenario(s) | Status |
|---|---|---|
| NFR-1 determinism / byte-identical replay | TC-DPLAN-016, TC-DPLAN-024 | Implemented |
| NFR-2 no network/LLM, p95 < 500 ms for 30 phases | TC-DPLAN-023, TC-DPLAN-026 | Implemented |
| NFR-3 read-only posture (zero writes, fences, mutations, spawns, credential reads) | TC-DPLAN-023, TC-DPLAN-027 | Implemented |
| NFR-4 bounded output with deterministic truncation marker | TC-DPLAN-025 | Implemented |
| NFR-5 every rejection carries a `plan.*` code naming phase and field; no fallback classification | TC-DPLAN-003, TC-DPLAN-028 | Implemented |
| NFR-6 legacy availability across the transition window | TC-DPLAN-011, TC-DPLAN-012 | Implemented |
| NFR-7 purity boundaries (data + pure functions in core, I/O-free command definitions, adapter YAML precedent) | TC-DPLAN-027 | Implemented |

## 4. Test Types and Layers

Per `.ai/rules/testing-strategy.md`, `packages/**` changes map to `bun test tests/structure tests/behaviour`, the boundary suite, and `pnpm typecheck`; docs/templates map to static/diff and content checks.

- **Unit — pure domain logic (bun:test):** `tests/behaviour/plan-*.test.ts` driven by a fixture harness in `tests/fixtures/plan/harness/` (mirroring the `tests/fixtures/queue-ready/harness.ts` precedent). Inputs are parsed plan values and injected ports; no clock, no filesystem, no process.
- **Contract/structure:** `tests/structure/` for schema shape, additive error-table rows (`plan.*`), module registration in `tests/structure/inventory.json` and subpath exports, and the ambient-globals/secret-read guards over new `packages/core/src/contracts` files.
- **Behaviour/integration through command definitions:** `tests/behaviour/` invoking the `plan`/`lint` command definitions with injected runtimes plus the CLI edge for exit projection and envelope conformance (`assertEnvelopeContract` from `packages/testkit/src/result-conformance`).
- **Boundary:** `bun test tests/boundaries` and `pnpm check:boundaries` — only if the change needs a new allowed edge (for example the repository-diff read path or YAML parsing); a new allowed edge requires a failing negative fixture plus the fixture-coverage meta-check in the same change.
- **Performance (bounded, non-flaky in shape):** a single latency/read-cost assertion in `tests/behaviour/plan-performance.test.ts` with the context logged (Bun version, platform, phase count), following `queue-ready-performance.test.ts`.
- **Manual content review:** writer flip, template, prompts, naming documentation, `ados_distribution` markers — with `bash scripts/.tests/test-doc-distribution.sh` and the plugin staleness check as automated support.
- **Aggregate gate:** `pnpm check` (lint → format → typecheck → test → boundaries + exports parity). No new CI job is introduced.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Priority | AC Coverage |
|---|---|---|---|---|---|
| TC-DPLAN-001 | Valid plan validates and is ready for development | Happy Path | Critical | High | AC-F8-1 (control), F-1, F-8 |
| TC-DPLAN-002 | Invalid schema classified naming phase and field | Negative | Critical | High | AC-F8-1 |
| TC-DPLAN-003 | Rejection corpus: every uncomputable class classified, none silently accepted | Negative | Critical | High | AC-F8-1, NFR-5 |
| TC-DPLAN-004 | Tier echoed verbatim; no built-in default consulted | Happy Path | Critical | High | AC-F6-1 |
| TC-DPLAN-005 | Unknown tier rejected with `plan.tier.unknown` | Negative | Critical | High | AC-F6-1 |
| TC-DPLAN-006 | Tier phase sets and escalation triggers are inert data | Edge Case | Important | Medium | AC-F6-1, F-6 |
| TC-DPLAN-007 | Done-artifacts echoed for every delivery phase | Happy Path | Critical | High | AC-F3-1 |
| TC-DPLAN-008 | Planning lease-free, delivery lease-taking, leases and weight echoed | Happy Path | Critical | High | AC-F7-1 |
| TC-DPLAN-009 | Ready-for-development refuses an unvalidatable plan (seed SC-M1-07) | Negative | Critical | High | AC-F12-1 |
| TC-DPLAN-010 | Missing plan artifact is classified, never a crash | Edge Case | Important | High | AC-F12-1, F-12 |
| TC-DPLAN-011 | Legacy markdown plan answered with a transition verdict | Regression | Critical | High | AC-F13-1 |
| TC-DPLAN-012 | Legacy transition corpus stays readable and never schema-valid | Regression | Critical | High | AC-F13-1, NFR-6 |
| TC-DPLAN-013 | Overlap answers sequence with paths named, producer first (seed SC-M1-06) | Corner Case | Critical | High | AC-F10-1, AC-F10-3 |
| TC-DPLAN-014 | Disjoint plans answer parallel with an empty path list | Happy Path | Critical | High | AC-F10-2 |
| TC-DPLAN-015 | Overlap precision: no false positives across path and wildcard granularity | Edge Case | Critical | High | AC-F10-1, F-2 |
| TC-DPLAN-016 | Overlap ordering is symmetric, declared, and deterministic | Edge Case | Important | High | AC-F10-3, NFR-1 |
| TC-DPLAN-017 | Diff classifies declared versus actual scope | Corner Case | Critical | High | AC-F9-1 |
| TC-DPLAN-018 | Diff fully within declared scope exits 0 and honours `--against` | Happy Path | Important | High | AC-F9-1, F-9 |
| TC-DPLAN-019 | Diff resolves package/folder wildcards and prefix boundaries | Edge Case | Important | Medium | AC-F9-1, F-2 |
| TC-DPLAN-020 | Lint plan target reports conformance with locations | Negative | Critical | High | AC-F11-1 |
| TC-DPLAN-021 | Lint plan classifies an unreadable document | Negative | Important | Medium | AC-F11-1, NFR-5 |
| TC-DPLAN-022 | Envelope valid on failure and exits projected at the edge | Regression | Critical | High | DEC-1, NFR-5 |
| TC-DPLAN-023 | Plan verdicts are read-only and free of network, spawn, and credential access | Regression | Critical | High | NFR-2, NFR-3 |
| TC-DPLAN-024 | Verdict output is byte-identical on replay | Regression | Critical | High | NFR-1 |
| TC-DPLAN-025 | Oversized verdict payloads truncate deterministically | Edge Case | Important | Medium | NFR-4 |
| TC-DPLAN-026 | Thirty-phase plan validates within the latency and read-cost bound | Performance | Important | Medium | NFR-2 |
| TC-DPLAN-027 | Purity, layering, and registration invariants hold | Regression | Critical | High | NFR-7 |
| TC-DPLAN-028 | Plan error identities are registered and registry-synced | Regression | Critical | High | NFR-5, DM-8 |
| TC-DPLAN-029 | Writer flip, template, and consuming prompts ship together | Happy Path | Critical | High | AC-F13-1, F-1, F-13 |
| TC-DPLAN-030 | Plan naming and distribution markers are documented and drift-free | Happy Path | Important | High | F-13, DM-1 |

### 5.2 Scenario Details

#### TC-DPLAN-001 - Valid plan validates and is ready for development

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-8, DM-1, DM-7, NFR-1 (control case for AC-F8-1)
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `packages/core/src/domain/` (validate), `tests/behaviour/plan-validate.test.ts`
**Tags**: @backend, @api

**Preconditions**:
- A baseline schema-valid YAML plan fixture declaring schema version, ceremony tier, and at least one planning and one delivery phase with scope, artifacts, leases, weight, and interactions.
- An in-memory runtime returning that document for the fixture ref.

**Steps**:
1. Run `plan validate <ref>` through the command definition with the injected runtime, then through the CLI edge.
2. Inspect envelope `data`: `verdict`, `perPhase`, `readyForDevelopment`; inspect the schema version echoed in the payload.
3. Run the same input in text mode.

**Expected Outcome**:
- `data.verdict = valid`, `data.readyForDevelopment = true`, exit 0, one `perPhase` entry per declared phase, schema version echoed.
- Text mode prints `verdict=valid`; the envelope carries `schemaVersion`, `runId`, `exitCode`, and `timing`.
- No second source of truth is read: the only injected read is the plan document for `<ref>`.

**Postconditions**:
- No writes, no state change (asserted in TC-DPLAN-023).

#### TC-DPLAN-002 - Invalid schema classified naming phase and field

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, F-2, DM-8, NFR-5, AC-F8-1
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `packages/core/src/domain/` (validate), `tests/behaviour/plan-validate-rejections.test.ts`
**Tags**: @backend

**Preconditions**:
- A plan fixture whose phase 6 declares no `scope.files`.

**Steps**:
1. Validate the fixture through the command definition.
2. Read the classified error entries: code, phase identifier, missing/invalid field.
3. Confirm `verdict`, `readyForDevelopment`, and the projected exit.

**Expected Outcome**:
- `verdict = invalid`, `readyForDevelopment = false`, exit 1.
- Exactly the identity `plan.schema.invalid` is reported with `phase = 6` and `missing = scope.files` (naming the phase and the field, matching the man-page example shape).
- The generic internal/fallback identity never appears.

#### TC-DPLAN-003 - Rejection corpus: every uncomputable class classified, none silently accepted

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F8-1, NFR-5, F-1, DM-1, DM-3
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/plan-validate-rejections.test.ts`, `tests/fixtures/plan/invalid/`
**Tags**: @backend

**Preconditions**:
- A corpus of invalid fixtures, each stored as its own file under `tests/fixtures/plan/invalid/`, one defect per file: unparseable YAML (stored as `.yaml.txt` per the pm-notes precedent), top-level not a mapping, missing schema version, unsupported/forward schema version, phase missing scope entirely, phase with an unknown scope key, wrong value type for a declared field, malformed typed done-artifact slot (for example a pipeline id given as a mapping), a delivery phase declared lease-free, and a phase referencing an interaction target it does not own.
- Each fixture carries the expected code, phase, and field in a committed expectation table beside the fixture.

**Steps**:
1. Validate every fixture through the command definition.
2. Assert per fixture: `verdict = invalid`, at least one classified code, the expected phase and field named, `readyForDevelopment = false`, exit 1.
3. Assert the corpus-wide properties: zero fixtures produce the generic fallback identity, zero fixtures produce a stack trace or thrown error, zero fixtures report `valid`.

**Expected Outcome**:
- Every uncomputable fixture is refused with a `plan.*` code naming phase and field; the unsupported schema version is classified rather than reinterpreted; no fixture is silently accepted.
- Adding a new invalid class to the directory without an expectation row fails the suite (non-vacuity guard).

**Notes / Clarifications**:
- The unsupported-schema-version and interaction-ownership cases are derived from DM-1 ("carries a schema version for additive evolution") and spec §22 ("breaking shape changes require a new schema version, never a silent reinterpretation"). See OQ-1 for the exact identity of the version case.

#### TC-DPLAN-004 - Tier echoed verbatim; no built-in default consulted

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F6-1, F-6, DM-6
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `packages/core/src/domain/` (tier resolution), `tests/behaviour/plan-tier.test.ts`
**Tags**: @backend

**Preconditions**:
- Two plan fixtures declaring different ceremony tiers (for example `full` and `lite`), each with its own phase set.
- A third fixture that declares no tier at all.

**Steps**:
1. Validate each of the two tiered fixtures and read the tier echoed in `perPhase`/plan-level data.
2. Assert each verdict carries its own declared tier value, byte-identical to the declaration.
3. Validate the tier-less fixture and read the outcome.
4. Assert no built-in default phase set is consulted: instrument the runtime so any read other than the plan document fails the test, and assert the tier-less fixture is classified rather than defaulted.

**Expected Outcome**:
- Each plan echoes its own tier verbatim; the two verdicts differ exactly as declared.
- A plan without a tier is classified as invalid — never defaulted to a built-in set. No constant phase set or default tier participates in any verdict.

#### TC-DPLAN-005 - Unknown tier rejected with `plan.tier.unknown`

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F6-1, F-6, DM-6, DM-8
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `packages/core/src/domain/` (tier resolution), `tests/behaviour/plan-tier.test.ts`
**Tags**: @backend

**Preconditions**:
- A plan fixture declaring a tier outside the known set (for example a misspelled variant).

**Steps**:
1. Validate the fixture.
2. Read the classified error entries and `readyForDevelopment`.

**Expected Outcome**:
- Rejected with `plan.tier.unknown`, naming the tier field location, `verdict = invalid`, `readyForDevelopment = false`, exit 1.
- The unknown tier is never guessed, coerced to a known tier, or echoed as accepted.

#### TC-DPLAN-006 - Tier phase sets and escalation triggers are inert data

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-F6-1, F-6, DM-6, §7.3 (trigger evaluation deferred)
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `packages/core/src/domain/`, `tests/behaviour/plan-tier.test.ts`
**Tags**: @backend

**Preconditions**:
- A valid plan whose tier declares a per-tier phase set and at least one escalation trigger (a trigger that would fire if evaluated against the fixture's state).

**Steps**:
1. Validate the plan and read the tier payload.
2. Assert the declared phase set and escalation triggers are returned as data, unchanged and complete.
3. Assert no escalation-trigger evaluation ran: the trigger's condition is not consulted, no trigger outcome appears in the verdict, and no additional runtime read occurs.

**Expected Outcome**:
- Tier data round-trips as inert declaration data; validate reports phase sets and triggers without evaluating them (evaluation belongs to M2-S3).

#### TC-DPLAN-007 - Done-artifacts echoed for every delivery phase

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-1, F-3, DM-3
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `packages/core/src/domain/`, `tests/behaviour/plan-validate.test.ts`
**Tags**: @backend

**Preconditions**:
- A schema-valid plan with at least two delivery phases, each declaring MR URL, pipeline id, deployed environment, and tracker transition slots, and at least one planning phase that declares none.

**Steps**:
1. Validate the plan.
2. For every delivery phase, read the echoed done-artifacts and compare with the declaration.
3. Read the planning phase's entry.

**Expected Outcome**:
- Every delivery phase echoes all four typed artifact slots with the declared values; lane joins could verify artifacts from verdict data alone.
- The planning phase reports no delivery artifacts without failing validation, and does not invent placeholder artifacts.
- No tracker or CI read occurs — the values are inert declaration data.

#### TC-DPLAN-008 - Planning lease-free, delivery lease-taking, leases and weight echoed

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F7-1, F-4, F-7, DM-4
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `packages/core/src/domain/`, `tests/behaviour/plan-validate.test.ts`
**Tags**: @backend

**Preconditions**:
- A schema-valid plan with planning phases and delivery phases; delivery phases declare repo leases and a build-weight class (for example `standard` and `heavy` across phases).

**Steps**:
1. Validate the plan and read `perPhase` lease data.
2. Confirm the planning phases report lease-free and the delivery phases report lease-taking.
3. Confirm per-phase leases and weight class are echoed with their declared values, including a plan-level default applied to phases that omit them.

**Expected Outcome**:
- The lease split is explicit in verdict data: planning = lease-free (safely parallel), delivery = lease-taking.
- Leases and weight class appear verbatim per phase; a plan-level declaration is applied once and echoed, never re-derived.

#### TC-DPLAN-009 - Ready-for-development refuses an unvalidatable plan (seed SC-M1-07)

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F12-1, F-12, F-8, DEC-2, DEC-6, DM-8
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/plan-ready-gate.test.ts`, `tests/behaviour/queue-ready-*.test.ts` (unchanged-control)
**Tags**: @backend

**Preconditions**:
- A plan fixture for a ref whose phase 6 omits its per-phase scope (the seeded SC-M1-07 world).
- The existing `queue ready` runtime with a read recorder.

**Steps**:
1. Run `plan validate <ref>` and read `readyForDevelopment`, the error entries, and the projected exit.
2. Assert the gate refusal: `readyForDevelopment = false`, `plan.schema.invalid` naming phase 6 and the missing field, exit 1.
3. Run `queue ready` for the same fixture and compare its output with a recorded pre-change baseline; assert zero plan reads in the recorder.
4. Confirm no `queue add` surface is invoked or added by this change.

**Expected Outcome**:
- The gate is mechanical and computed by `plan validate`: the unvalidatable plan is refused with a classified error and `readyForDevelopment=false`.
- `queue ready` is unchanged: identical output, zero plan reads (DEC-2). No `queue add` warning path exists here — it is the recorded M1-S17 integration point.

**Notes / Clarifications**:
- **Reconciliation of SC-M1-07 recorded in §3.1**: the seed's `queue add` warning assertion is out of scope per DEC-2; the in-scope assertion is the gate refusal verified in step 2 plus the verified non-change of `queue ready` in step 3.

#### TC-DPLAN-010 - Missing plan artifact is classified, never a crash

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F12-1, F-12, F-13, DM-1, DEC-7
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/plan-validate.test.ts`, `tests/fixtures/plan/absent/`
**Tags**: @backend

**Preconditions**:
- A ref whose change folder contains neither `chg-<ref>-plan.yaml` nor a legacy `chg-<ref>-plan.md` (the fixture runtime reports absence).

**Steps**:
1. Validate the ref.
2. Read the envelope: error classification, `readyForDevelopment`, and the exit.

**Expected Outcome**:
- A classified error (no throw, no stack trace, no empty success), `verdict = invalid`, `readyForDevelopment = false`, exit 1.
- The error names the ref and the missing artifact class in its detail.

**Notes / Clarifications**:
- Absence handling is derived from F-12 ("ready exactly when its plan validates") and spec §21 (malformed input classified, not failing openly); the exact code identity is OQ-2.

#### TC-DPLAN-011 - Legacy markdown plan answered with a transition verdict

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F13-1, F-13, DM-8, DM-1, DEC-7, NFR-6
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `packages/core/src/domain/` (format detection), `tests/behaviour/plan-legacy.test.ts`
**Tags**: @backend

**Preconditions**:
- A change folder whose only plan is a legacy prose markdown plan (`chg-<ref>-plan.md`) with ordinary headings and task lists.

**Steps**:
1. Validate the ref.
2. Read `verdict`, the classified error identity, `readyForDevelopment`, and the exit.
3. Confirm the verdict names the document it read.

**Expected Outcome**:
- The plan is read without a crash and answered with the classified transition identity `plan.format.legacy-markdown`.
- The verdict is never `valid`: a legacy plan is emphatically not silently schema-valid; `readyForDevelopment = false`; exit 1 (negative verdict per DEC-1).
- The verdict names the markdown artifact path it read, so a reader can tell the format was recognized, not guessed.

**Notes / Clarifications**:
- AC-F13-1 fixes readability and classification but not the exit number. DEC-1 classifies every negative verdict as exit 1; if implementation chooses a distinct transition exit, change this scenario and §8.3 OQ-3 together, not one of them.

#### TC-DPLAN-012 - Legacy transition corpus stays readable and never schema-valid

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F13-1, NFR-6, F-13, DM-8
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/plan-legacy.test.ts`, `tests/fixtures/plan/legacy/`
**Tags**: @backend

**Preconditions**:
- A legacy corpus under `tests/fixtures/plan/legacy/`: a prose plan, a headings-and-checklist plan, an empty file, a file containing a YAML-looking fragment under a markdown suffix, a non-UTF8-safe/very large plan, and a change folder carrying both `-plan.md` and `-plan.yaml`.

**Steps**:
1. Validate every legacy fixture and record verdict, identity, and exit.
2. Assert per fixture: no crash, a classified transition verdict, never `valid`, `readyForDevelopment = false`.
3. For the both-formats fixture, assert the verdict deterministically names which artifact it read, and that a replay returns the same document.

**Expected Outcome**:
- 100% of legacy fixtures are answered with a classified transition verdict; zero crashes; zero silent schema-valid accepts (NFR-6).
- Both-formats refs resolve deterministically and disclose the artifact read (precedence policy is OQ-4).

#### TC-DPLAN-013 - Overlap answers sequence with paths named, producer first (seed SC-M1-06)

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F10-1, AC-F10-3, F-10, F-2, F-5, DEC-1, DEC-5, DM-5
**Test Type(s)**: Unit, Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `packages/core/src/domain/` (overlap), `tests/behaviour/plan-overlap-sequence.test.ts`, `tests/fixtures/plan/overlap/sequence/`
**Tags**: @backend, @api

**Preconditions**:
- The seeded world: `GH-306` and `GH-307` plans that both declare writes to `packages/core/src/contracts/queue.ts`; the fixture pair additionally declares a producer/consumer interaction on that contract file (`GH-306` producer, `GH-307` consumer) and one further shared path under `doc/spec/features/`.

**Steps**:
1. Run `plan overlap GH-306 GH-307` through the command definition, then through the CLI edge with `--json`.
2. Read `data.verdict`, `data.overlappingPaths`, `data.ordering`, `data.reason`, and the projected exit.
3. Recompute the declared scopes from the two fixtures and compare with `overlappingPaths`.
4. Run text mode.

**Expected Outcome**:
- `verdict = run-in-sequence`, exit **1** with the verdict carried in the envelope.
- `overlappingPaths` names every path present in both declared scopes (the contract file and the spec file) and lists nothing absent from either.
- `ordering` places `GH-306` (producer) before `GH-307` (consumer) for the contract-file overlap; `reason = shared-contract-files`.
- Text mode prints `verdict=run-in-sequence overlapping=packages/core/src/contracts/queue.ts reason=shared-contract-files` (path list may be summarized in text; the machine payload is authoritative).

**Notes / Clarifications**:
- **Reconciliation of SC-M1-06 recorded in §3.1**: the seed asserts exit 0; DEC-1 and the plan man page fix exit 1 for a sequence verdict. This scenario asserts exit 1 and keeps the seed's own assertion (every listed path exists in both declared scopes). The change is deliberate and must not be "fixed" back to 0 by an implementer reading the seed.

#### TC-DPLAN-014 - Disjoint plans answer parallel with an empty path list

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F10-2, F-10, F-2
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/plan-overlap-parallel.test.ts`, `tests/fixtures/plan/overlap/parallel/`
**Tags**: @backend

**Preconditions**:
- Two schema-valid plans whose declared scopes are entirely disjoint (different packages and folders, no shared interaction targets).

**Steps**:
1. Run `plan overlap` in both argument orders.
2. Read `verdict`, `overlappingPaths`, `ordering`, and the exit.

**Expected Outcome**:
- `verdict = parallel`, `overlappingPaths = []` (present and empty, not omitted), exit 0 in both orders.
- No `ordering`/`reason` value invents a sequence; the payload states the parallel answer unambiguously.
- 0 false-sequence verdicts for the disjoint fixture set (the spec's KPI: 100% of disjoint pairs answer `parallel`).

#### TC-DPLAN-015 - Overlap precision: no false positives across path and wildcard granularity

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F10-1, F-2, DM-2, DEC-5
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/plan-overlap-precision.test.ts`, `tests/fixtures/plan/overlap/precision/`
**Tags**: @backend

**Preconditions**:
- Pairs of plans covering near-miss shapes: same basename in different directories; a declared file versus a declared sibling directory (`src/plan/` versus `src/planner/`); identical path declared by different phase numbers; one plan declaring a package wildcard (`packages/core/src/contracts/**`) and the other a file inside it; both declaring the same package wildcard; one declaring a folder and the other a file beneath it.

**Steps**:
1. Run overlap for each pair and read `verdict` and `overlappingPaths`.
2. Compare the reported paths against the intersection computed from the fixture declarations, using the wildcard semantics documented for the schema.

**Expected Outcome**:
- Every `run-in-sequence` verdict names at least one path that genuinely matches in both declared scopes; every near-miss pair answers `parallel` with an empty list.
- Wildcard-versus-file and folder-versus-file intersections are reported as overlapping with the concrete path named (or the wildcard pattern plus its matching path), never as a bare "overlap" without paths.
- Zero false-parallel and zero false-sequence verdicts across the precision corpus.

**Notes / Clarifications**:
- The contract example (`overlapping=packages/core/src/contracts/** (3 phases)`) shows wildcard reporting; the exact rendering of a wildcard overlap in `overlappingPaths` is confirmed at implementation and pinned by this scenario's fixture, see OQ-5.

#### TC-DPLAN-016 - Overlap ordering is symmetric, declared, and deterministic

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F10-3, F-5, F-10, DM-5, NFR-1
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/plan-overlap-ordering.test.ts`, `tests/fixtures/plan/overlap/ordering/`
**Tags**: @backend

**Preconditions**:
- Pair A/B where a declared interaction makes B the producer of a shared generated file and A the consumer.
- Pair C/D that shares a plain file with no declared interaction.

**Steps**:
1. Run overlap for A/B and for B/A; compare `ordering` and `reason`.
2. Run overlap for C/D; record `ordering` and `reason`, then replay the identical input.
3. Assert the ordering string names the plans in producer-first order and that the producer in each case is the plan whose declaration states production.

**Expected Outcome**:
- Declared interaction wins: the producer is reported first regardless of argument order, with the shared-contract reason.
- For a shared path with no declared interaction, the ordering is still deterministic and stable across replay and across argument order (a verdict cannot flip because the operator typed the refs the other way round).
- No ordering is emitted for a `parallel` verdict.

**Notes / Clarifications**:
- What reason is used when no interaction is declared is not specified by the spec (OQ-6). This scenario pins stability and producer-first semantics, not a particular reason string.

#### TC-DPLAN-017 - Diff classifies declared versus actual scope

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F9-1, F-9, F-2, DM-2, DM-8
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `packages/core/src/domain/` (diff), `tests/behaviour/plan-diff.test.ts`, `tests/fixtures/plan/diff/outside/`
**Tags**: @backend

**Preconditions**:
- A plan declaring three paths across two phases; the injected actual-diff port reports one declared-and-touched path, one untouched declared path, and one touched path that no phase declares.

**Steps**:
1. Run `plan diff <ref>` with the injected diff port.
2. Read the per-path table entries and their classifications, plus the classified findings and the exit.
3. Confirm each path appears exactly once and no path is dropped or duplicated.

**Expected Outcome**:
- The touched declared path is `within`; the touched undeclared path is `outside-declared`; the declared-but-untouched path is `undeclared-missing`.
- Out-of-scope findings carry `plan.scope.undeclared-paths`; `undeclared-missing` findings are reported as declared-but-untouched (naming phase and path) without crashing the verdict.
- Exit 1 with the findings in envelope data; text mode prints the per-path table.

#### TC-DPLAN-018 - Diff fully within declared scope exits 0 and honours `--against`

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F9-1, F-9
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/plan-diff.test.ts`, `tests/fixtures/plan/diff/within/`
**Tags**: @backend

**Preconditions**:
- A plan whose declared scope exactly covers the injected actual diff (no untouched declared paths).

**Steps**:
1. Run `plan diff <ref>` and read verdict data and exit.
2. Run `plan diff <ref> --against <base>` and confirm the base is passed to the injected diff port unchanged.
3. Run without `--against` and confirm the documented default base is requested.

**Expected Outcome**:
- All paths are `within`, no findings, exit 0.
- `--against` is forwarded verbatim to the read-only diff port; the default base is used when omitted; no other repository access occurs.

#### TC-DPLAN-019 - Diff resolves package/folder wildcards and prefix boundaries

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-F9-1, F-2, DM-2
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/plan-diff.test.ts`, `tests/fixtures/plan/diff/wildcards/`
**Tags**: @backend

**Preconditions**:
- A plan declaring a package wildcard (`packages/core/src/domain/**`) and a folder (`doc/guides/`); the injected actual diff includes files under both, plus a file in a sibling path that only shares a prefix (`doc/guides-archive/x.md`).

**Steps**:
1. Run `plan diff` and read per-path classifications.
2. Compare with the wildcard/folder semantics documented for the schema.

**Expected Outcome**:
- Files under the declared package and folder are `within`; the prefix-only sibling is `outside-declared` (no prefix bleed).
- Undeclared actual paths remain classified under `plan.scope.undeclared-paths` rather than being silently absorbed by a wildcard.

#### TC-DPLAN-020 - Lint plan target reports conformance with locations

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F11-1, F-11, F-8, NFR-3
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `packages/cli/src/commands/lint.ts` (plan target), `tests/behaviour/plan-lint.test.ts`
**Tags**: @backend

**Preconditions**:
- A conformant plan fixture and a non-conformant one (missing per-phase scope in one phase); pm-notes and registry reads wired to fixtures unchanged from their existing behavior.

**Steps**:
1. Run `lint plan <ref>` for the conformant fixture: read `documents[]` entries and exit.
2. Run it for the non-conformant fixture: read the per-document verdict, the classified errors with their locations, and the exit.
3. Run the existing `lint <ref>` pm-notes target and registry target on their unchanged fixtures and compare with recorded baselines.

**Expected Outcome**:
- Conformant: `documents[]` reports the plan path with `verdict = valid`, empty errors, exit 0.
- Non-conformant: the document is reported non-conformant with classified errors including a location that identifies the phase and field, exit 1.
- The pm-notes and registry targets are byte-identical to their baselines: the plan target is additive.

#### TC-DPLAN-021 - Lint plan classifies an unreadable document

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-F11-1, NFR-5, lint(1) exit 2
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/plan-lint.test.ts`, `tests/fixtures/plan/invalid/`
**Tags**: @backend

**Preconditions**:
- A plan document the injected reader cannot parse (unreadable/undecodable), distinct from a parseable-but-non-conformant plan.

**Steps**:
1. Run `lint plan <ref>` for the unreadable fixture.
2. Read the classified error, the document entry, and the exit.

**Expected Outcome**:
- Exit 2 with a classified error (the lint surface's unreadable class), a `documents[]` entry naming the document, and no stack trace or partial verdict.
- The unreadable case is distinguished from the non-conformant case (exit 1 in TC-DPLAN-020).

**Notes / Clarifications**:
- Exit 2 for unreadable documents is the lint man page contract; how `plan validate` treats the same unreadable file is covered by TC-DPLAN-003 (classified invalid schema, exit 1) per spec §21, not exit 2. See OQ-7.

#### TC-DPLAN-022 - Envelope valid on failure and exits projected at the edge

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: DEC-1, NFR-5, DM-7, SC-M1-19 (continuity), TS §7
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/plan-envelope.test.ts`, `packages/cli/src/projection.ts`
**Tags**: @backend, @api

**Preconditions**:
- Fixtures that produce each outcome class: valid (exit 0), invalid schema (exit 1), sequence verdict (exit 1), diff findings (exit 1), lint non-conformant (exit 1), lint unreadable (exit 2), and a deliberately malformed invocation (unknown flag / missing ref), projected as exit 1 via `input.value.rejected` (user-validation).

**Steps**:
1. For each fixture, run the command with `--json` and parse the output as JSON.
2. Assert envelope conformance: `schemaVersion` present, `runId` present, `exitCode` matches the projected exit, `timing` present, exactly one of `data`/`error`.
3. For failures, assert the error carries code, category, retryability, consequence, and remediation hint; assert no secret-shaped values appear.
4. Assert the projection class mapping: validation/verdict failures → 1, platform/unreadable → 2, success → 0; and that command handlers contain no numeric exit decision (covered by the existing `exit-code-literals` check).

**Expected Outcome**:
- Every outcome, including the sequence verdict, yields a valid envelope with a projected exit and a classified error where applicable — no command emits a bare message or chooses an exit inside a handler.
- Consumers can branch on `data` alone; exit 1 for a sequence verdict remains a verdict, not a failure envelope.

#### TC-DPLAN-023 - Plan verdicts are read-only and free of network, spawn, and credential access

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-2, NFR-3, F-8, F-9, F-10
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/plan-readonly.test.ts`, `packages/testkit/src/` (recording fakes)
**Tags**: @backend, @security

**Preconditions**:
- Recording fakes for every injected port: plan document read, repository diff read, and any state read; counters for writes, fences, spawns, and credential reads.

**Steps**:
1. Drive every verdict path (validate valid/invalid/legacy/absent, diff, overlap sequence/parallel) over the fixture corpus.
2. Assert the recorder shows only read calls, and only the expected ones per command (validate: plan read; overlap: two plan reads; diff: plan read plus diff read).
3. Assert zero writes, zero fences, zero state mutations, zero process spawns, zero credential reads, zero network or provider calls across all invocations.

**Expected Outcome**:
- 0 violations of the read-only posture across every fixture; the commands cannot write, spawn, or read credentials even when the plan content requests it.
- The set of reads per command is bounded and declared.

#### TC-DPLAN-024 - Verdict output is byte-identical on replay

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-1, DM-7, F-8, F-9, F-10
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/plan-determinism.test.ts`, `tests/golden/plan/`
**Tags**: @backend

**Preconditions**:
- Golden machine outputs (normalized: no `runId`, no timestamps, no absolute paths) for one validate, one diff, and both overlap verdicts.

**Steps**:
1. Invoke each command twice on identical inputs with identical injected dependencies.
2. Normalize the volatile envelope fields and compare invocations byte-for-byte, then compare against the committed golden.
3. Repeat with a shuffled input ordering where the schema permits it (for example path declaration order inside a phase) and confirm the ordering of emitted lists is stable.

**Expected Outcome**:
- Replay output is byte-identical (100% on replay), including path-list order and error ordering.
- Goldens are updated only by an explicit regeneration step and show a human-reviewable diff.

#### TC-DPLAN-025 - Oversized verdict payloads truncate deterministically

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: NFR-4, DM-7, AC-F9-1, AC-F10-1
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/plan-bounded-output.test.ts`, `tests/fixtures/plan/bounded/`
**Tags**: @backend

**Preconditions**:
- A plan pair whose declared scopes overlap in far more paths than any reasonable payload bound, and a diff fixture with an oversized findings list.

**Steps**:
1. Run overlap and diff on the oversized fixtures.
2. Read the emitted lists and any truncation marker and reported totals.
3. Replay and compare.

**Expected Outcome**:
- The payload is bounded; truncation is explicit (a marker plus the total count) and deterministic across replays.
- Truncation never changes the verdict; a truncated sequence verdict still names at least one overlapping path.

#### TC-DPLAN-026 - Thirty-phase plan validates within the latency and read-cost bound

**Scenario Type**: Performance
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: NFR-2, F-8, NFR-1
**Test Type(s)**: Performance
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/plan-performance.test.ts`, `tests/fixtures/plan/valid/thirty-phases.yaml`
**Tags**: @backend, @perf

**Preconditions**:
- A generated-but-committed 30-phase plan fixture (committed so the measurement is reproducible, not generated at test time).

**Steps**:
1. Warm up once, then take several samples of validation latency; record the median and p95 with Bun version and platform, following the queue-ready performance precedent.
2. Assert both the median and p95 are below 500 ms (NFR-2 pins p95; the test hard-asserts both statistics).
3. Assert the read count for the invocation is exactly one plan read and no other port is touched (proving the bound is local reads, not cached network).

**Expected Outcome**:
- Median and p95 validation latency < 500 ms for a 30-phase plan on CI-class hardware, with the measurement context logged in the run output.
- If the bound proves flaky on shared CI, the assertion is relaxed only with a recorded justification in §10 — never silently deleted.

#### TC-DPLAN-027 - Purity, layering, and registration invariants hold

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-7, TS §4, testing-strategy boundary rules
**Test Type(s)**: Contract, Manual (review)
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/`, `tests/boundaries/`, `packages/core/src/{contracts,domain}`, `packages/cli/src/commands/`
**Tags**: @backend, @architecture

**Preconditions**:
- The implemented modules exist: schema/type declarations in the core contracts layer, pure verdict functions in the core domain layer, command definitions in the CLI surface, YAML parsing through the existing adapter precedent, and the repository diff read through a declared port.

**Steps**:
1. Run the structure registration tests: the new contract/domain modules appear in `tests/structure/inventory.json` and resolve through declared subpaths.
2. Run the ambient-globals and secret-read guards plus `pnpm check:boundaries` over the new files; confirm command definitions import no runtime API and construct no adapter.
3. Confirm pure verdict functions take time/ids/config as parameters (no ambient clock, randomness, env, or filesystem).
4. If a new allowed edge was added (for example a diff-read port), confirm a failing negative fixture exists and the fixture-coverage meta-check passes.

**Expected Outcome**:
- 0 boundary violations; schema and verdict logic are data plus pure functions in the core layers; command definitions stay I/O-free with injected runtimes; no ambient global, singleton, or module side effect is introduced.
- The architecture checks fail loudly (naming the offending field or dependency) if a later change shortcuts a layer.

#### TC-DPLAN-028 - Plan error identities are registered and registry-synced

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: DM-8, NFR-5, TS §7, AC-F8-1
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `packages/core/src/contracts/error-table.ts`, `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts`
**Tags**: @backend

**Preconditions**:
- The additive identities are declared: `plan.schema.invalid`, `plan.scope.undeclared-paths`, `plan.tier.unknown`, and the proposed transition identity `plan.format.legacy-markdown`.

**Steps**:
1. Run the error-table structure suite: every `plan.*` row has code, domain kind, category, retryability, consequence, remediation hint, and projection class; the symbolic code shape is valid.
2. Run the binding sync check between the code table and the registry.
3. Confirm the projection class of each plan code maps to exit 1 (user-validation) and that no plan code is left unregistered while referenced in code.

**Expected Outcome**:
- All four identities (three pinned plus the one additive refinement) are registered, round-trip through the binding check, and project to the intended exit class.
- A referenced-but-unregistered plan code fails the suite.

**Notes / Clarifications**:
- The lint surface may additionally reference a `lint.plan.*` identity per `lint(1)`; whichever identity ships for the lint target must also be registered and synced. See OQ-7.

#### TC-DPLAN-029 - Writer flip, template, and consuming prompts ship together

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F13-1, F-1, F-13, RSK-5, RSK-6
**Test Type(s)**: Manual, Contract
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/templates/implementation-plan-template.md`, `.opencode/agent/plan-writer.md`, `.opencode/command/write-plan.md`, `.opencode/command/run-plan.md`, `.opencode/agent/coder.md`, `.ados-claude/` (generated)
**Tags**: @docs, @tooling

**Preconditions**:
- The change is complete enough for review: writer and consuming prompt sources edited, generated plugin regenerated.

**Steps**:
1. Read the implementation-plan template and confirm it specifies the YAML plan shape: schema version, per-phase scope (files/packages/folders with wildcard guidance), done-artifacts, leases, weight class, interactions, tier data, and the `chg-<ref>-plan.yaml` file name.
2. Read `plan-writer`, `write-plan`, `run-plan`, and `coder` guidance and confirm each states the YAML plan as the current format and points legacy markdown handling at the transition verdict.
3. Run the generated-plugin regeneration and diff check (`./scripts/build-claude-plugin.sh --verbose` then `git diff --exit-code -- .ados-claude`); confirm prompt sources and generated output are committed together.
4. Confirm no prompt claims behavior this change does not deliver (scheduler, queue, ceremony engine).

**Expected Outcome**:
- Template, writer, and consumers describe one format; the generated plugin is current (stale output fails CI); guidance does not attribute downstream behavior to this change.
- The atomic flip is verifiable in a single review pass: no surface still promises markdown authoring except where legacy readability is explicitly described.

#### TC-DPLAN-030 - Plan naming and distribution markers are documented and drift-free

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-13, DM-1, DEC-7, RSK-5
**Test Type(s)**: Manual, Contract
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/guides/unified-change-convention-tracker-agnostic-specification.md`, `doc/templates/implementation-plan-template.md`, `doc/planning/oss-tooling/cli-command-registry.md`
**Tags**: @docs

**Preconditions**:
- The naming documentation and registry row updates are present in the change.

**Steps**:
1. Confirm the unified change convention guide documents `chg-<ref>-plan.yaml` as the machine-readable plan and `chg-<ref>-plan.md` as the legacy format valid during the transition (DEC-7), including which file a consumer prefers when both exist.
2. Confirm the CLI command registry records the `plan` family status consistently with what shipped.
3. Confirm every changed distributable doc under `doc/guides/` or `doc/templates/` declares `ados_distribution` in its existing frontmatter (no new frontmatter block, no license header added).
4. Run `bash scripts/.tests/test-doc-distribution.sh` and `git diff --check`.

**Expected Outcome**:
- Naming is documented with an explicit precedence rule; the registry row matches the shipped surface; every changed distributable doc carries a valid distribution marker.
- The distribution drift guard and whitespace/conflict-marker guard pass; docs render correctly (headings, tables, fences).

## 6. Environments and Test Data

**Environments.** Local developer machine and CI, both Bun per the workspace pin. No deployed environment, no network, no credentials, no tracker or CI access: the repository diff, plan document reads, and state reads are all injected. `pnpm check` is the aggregate gate; narrow runs during iteration are `bun test tests/behaviour/plan-*`, `bun test tests/structure`, `bun test tests/boundaries`.

**Fixture corpus.** All plan fixtures live under `tests/fixtures/plan/` (never `*.test.ts`, so they are not discovered as suites), organized by class:

- `valid/` — baseline plan, tier `full`, tier `lite`, wildcard-scope plan, 30-phase performance plan.
- `invalid/` — one defect per file (see TC-DPLAN-003), with an expectation table naming code, phase, and field; unparseable YAML stored as `*.yaml.txt` following the `tests/fixtures/pm-notes/malformed/` precedent.
- `legacy/` — real markdown plans stored as `.md` because the format is the thing under test (prose, headings/checklists, empty, YAML fragment under `.md`, large, and a both-formats case).
- `overlap/{sequence,parallel,precision,ordering,bounded}/` — plan pairs plus the expected intersection computed by hand in the fixture metadata.
- `diff/{within,outside,wildcards}/` — plan plus the injected actual-diff path list (a committed JSON list, not a real git call), with `--against` base echoed in the fixture metadata.
- `absent/` — a fixture runtime result representing "no plan artifact".
- `harness/` — the shared support module: an in-memory runtime factory that builds the plan read, diff read, and recorders; each command run returns data, envelope, and exit so tests can assert data and exit separately (mirroring `tests/fixtures/queue-ready/harness.ts`).

**Isolation.** Each test constructs its sandbox from fixture text in memory; no test reads `doc/changes/**`, `$HOME`, the real repository, or the network. Nothing is written to disk except temporary directories created and removed inside a test that must exercise a file read. Goldens live in `tests/golden/plan/` and are normalized (no `runId`, timestamps, absolute paths, or unstable ordering).

**Test data discipline.** Fixtures declare realistic change refs (`GH-306`, `GH-307`, `GH-308`) used by the seeded scenarios so the reconciliation is traceable to the seed text.

## 7. Automation Plan and Implementation Mapping

| Scenario | Test file | Execution | Mocking / injection | Status |
|---|---|---|---|---|
| TC-DPLAN-001 | `tests/behaviour/plan-validate.test.ts` | `bun test tests/behaviour/plan-validate.test.ts` | In-memory plan read + CLI edge; no fs | Implemented |
| TC-DPLAN-002 | `tests/behaviour/plan-validate-rejections.test.ts` | `bun test tests/behaviour/plan-validate-rejections.test.ts` | In-memory plan read | Implemented |
| TC-DPLAN-003 | `tests/behaviour/plan-validate-rejections.test.ts` | same | Fixture corpus + expectation table; no parser mock (the real YAML parse path runs) | Implemented |
| TC-DPLAN-004 | `tests/behaviour/plan-tier.test.ts` | `bun test tests/behaviour/plan-tier.test.ts` | Plan read recorder that fails on any unexpected read | Implemented |
| TC-DPLAN-005 | `tests/behaviour/plan-tier.test.ts` | same | In-memory plan read | Implemented |
| TC-DPLAN-006 | `tests/behaviour/plan-tier.test.ts` | same | In-memory plan read; assert no trigger evaluation side channel | Implemented |
| TC-DPLAN-007 | `tests/behaviour/plan-validate.test.ts` | `bun test tests/behaviour/plan-validate.test.ts` | In-memory plan read | Implemented |
| TC-DPLAN-008 | `tests/behaviour/plan-validate.test.ts` | same | In-memory plan read | Implemented |
| TC-DPLAN-009 | `tests/behaviour/plan-ready-gate.test.ts` | `bun test tests/behaviour/plan-ready-gate.test.ts` | Plan read + queue-ready runtime recorder with baseline output | Implemented |
| TC-DPLAN-010 | `tests/behaviour/plan-validate.test.ts` | `bun test tests/behaviour/plan-validate.test.ts` | Runtime returning absence | Implemented |
| TC-DPLAN-011 | `tests/behaviour/plan-legacy.test.ts` | `bun test tests/behaviour/plan-legacy.test.ts` | In-memory plan read over `.md` fixture text | Implemented |
| TC-DPLAN-012 | `tests/behaviour/plan-legacy.test.ts` | same | Legacy corpus; both-formats case | Implemented |
| TC-DPLAN-013 | `tests/behaviour/plan-overlap-sequence.test.ts` | `bun test tests/behaviour/plan-overlap-sequence.test.ts` | Two in-memory plan reads; CLI edge for exit | Implemented |
| TC-DPLAN-014 | `tests/behaviour/plan-overlap-parallel.test.ts` | `bun test tests/behaviour/plan-overlap-parallel.test.ts` | Two in-memory plan reads | Implemented |
| TC-DPLAN-015 | `tests/behaviour/plan-overlap-precision.test.ts` | `bun test tests/behaviour/plan-overlap-precision.test.ts` | Fixture pairs + computed intersections | Implemented |
| TC-DPLAN-016 | `tests/behaviour/plan-overlap-ordering.test.ts` | `bun test tests/behaviour/plan-overlap-ordering.test.ts` | Fixture pairs, both argument orders | Implemented |
| TC-DPLAN-017 | `tests/behaviour/plan-diff.test.ts` | `bun test tests/behaviour/plan-diff.test.ts` | Plan read + injected diff port | Implemented |
| TC-DPLAN-018 | `tests/behaviour/plan-diff.test.ts` | same | Injected diff port recording the base | Implemented |
| TC-DPLAN-019 | `tests/behaviour/plan-diff.test.ts` | same | Injected diff port with wildcard fixtures | Implemented |
| TC-DPLAN-020 | `tests/behaviour/plan-lint.test.ts` | `bun test tests/behaviour/plan-lint.test.ts` | Lint command runtime with plan/pm-notes/registry reads; baselines | Implemented |
| TC-DPLAN-021 | `tests/behaviour/plan-lint.test.ts` | same | Reader returning an unreadable result | Implemented |
| TC-DPLAN-022 | `tests/behaviour/plan-envelope.test.ts` | `bun test tests/behaviour/plan-envelope.test.ts` | CLI edge + `assertEnvelopeContract`; existing `exit-code-literals` check | Implemented |
| TC-DPLAN-023 | `tests/behaviour/plan-readonly.test.ts` | `bun test tests/behaviour/plan-readonly.test.ts` | Recording fakes for every port; zero-call assertions | Implemented |
| TC-DPLAN-024 | `tests/behaviour/plan-determinism.test.ts` | `bun test tests/behaviour/plan-determinism.test.ts` | Golden files in `tests/golden/plan/`, normalized | Implemented |
| TC-DPLAN-025 | `tests/behaviour/plan-bounded-output.test.ts` | `bun test tests/behaviour/plan-bounded-output.test.ts` | Oversized fixtures in memory | Implemented |
| TC-DPLAN-026 | `tests/behaviour/plan-performance.test.ts` | `bun test tests/behaviour/plan-performance.test.ts` | 30-phase committed fixture; warm-up + median/p95 | Implemented |
| TC-DPLAN-027 | `tests/structure/*` additions, `tests/boundaries/*` if an edge is added | `pnpm check:boundaries`, `bun test tests/structure tests/boundaries` | None (tree-level) | Implemented |
| TC-DPLAN-028 | `tests/structure/error-table.test.ts` (existing) + new plan rows | `bun test tests/structure/error-table.test.ts tests/checks/error-table-sync.test.ts` | None | Implemented (additive rows) |
| TC-DPLAN-029 | Review artifact (no test file) | `./scripts/build-claude-plugin.sh --verbose`; `git diff --exit-code -- .ados-claude`; `git diff --check` | N/A | Implemented — manual review + CI staleness check |
| TC-DPLAN-030 | Review artifact (no test file) | `bash scripts/.tests/test-doc-distribution.sh`; `git diff --check` | N/A | Implemented — manual review + distribution guard |

**Suite ordering during iteration.** 1) pure domain units (`plan-validate*`, `plan-tier`, `plan-overlap*`, `plan-diff`, `plan-bounded-output`); 2) command/envelope (`plan-envelope`, `plan-ready-gate`, `plan-lint`); 3) structural/boundary (`tests/structure`, `tests/boundaries`); 4) determinism/performance; 5) `pnpm check` as the final gate. Execute the distribution guard and plugin regeneration check whenever prompt or doc files change, even if the code suite is green.

**Non-vacuity guards to include.** The invalid corpus must be non-empty and its expectation table must match the directory contents; the legacy corpus must include at least one non-empty and one empty file; the overlap precision corpus must include at least one expected-`parallel` and one expected-`run-in-sequence` pair, so a broken comparator cannot pass by answering everything the same way.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

- **The seed asserts exit 0 (SC-M1-06).** An implementer reading the seed instead of the spec could pin the wrong exit. Mitigation: TC-DPLAN-013 states the reconciled expectation in its body and §3.1 records the reasoning; review must reject a "fix" to exit 0 without a decision-record change.
- **Overlap false negatives are silent.** A comparator that normalizes paths inconsistently (trailing slashes, `./` prefixes, case) can answer `parallel` for colliding plans. Mitigation: TC-DPLAN-015 precision corpus plus near-miss pairs, and the spec's 0-false-parallel KPI is asserted as a corpus property.
- **Legacy readability can rot into a crash or a silent accept.** Mitigation: TC-DPLAN-012's corpus including empty, large, and both-formats fixtures; the test asserts classification rather than mere absence of a throw.
- **Fixture/validator drift.** A fixture may be written to satisfy the validator rather than the documented schema. Mitigation: fixtures are derived from the design-baseline plan example and the template; TC-DPLAN-029 checks the template and fixtures describe the same shape.
- **Performance assertion flakiness on shared CI.** Mitigation: median of several samples, logged context, and an explicit relaxation rule recorded in the execution log; the read-count assertion is the non-flaky part of the NFR.
- **Envelope tests duplicated with existing suites.** Mitigation: reuse `assertEnvelopeContract` and the existing exit-projection tests instead of copying assertions; the plan family only adds its outcome classes.
- **Docs/template drift (distribution markers, plugin staleness).** Mitigation: TC-DPLAN-029/030 run the existing guards; these are CI-blocking already.

### 8.2 Assumptions

- The state layer (GH-174) and pm-notes lint/phase transitions (GH-179) are in tree, so the envelope, error table, exit projection, and `lint` command surface exist and are extended additively rather than created.
- Module names in this plan (`plan-validate`, `plan-overlap`, `plan-diff` and their test files) are proposed placement guidance; the implementation plan may rename modules, but the scenarios, fixtures, and assertions transfer unchanged.
- The repository-diff input for `plan diff` arrives through an existing read-only port; no new dependency or credential surface is needed.
- `bun test` fixture harnesses are the vehicle for this change; no `scripts/.tests/test-*.sh` file is needed unless the implementation introduces a script, in which case a matching `test-*.sh` becomes mandatory.
- No `doc/spec/**` feature file is verified here; that is the `system_spec_update` phase's evidence.

### 8.3 Open Questions

| ID | Question | Blocking? | Proposed resolution / owner |
|---|---|---|---|
| OQ-1 | Which classified identity covers an unsupported/forward schema version — `plan.schema.invalid` or a distinct version identity? | No (test can assert "classified, naming the version field") | Assume `plan.schema.invalid` naming the version field; pin with the fixture expectation at implementation. Owner: `@coder` + `@reviewer`. |
| OQ-2 | Which identity covers "no plan artifact at all"? | No | Assume a classified error naming the missing artifact; if a dedicated identity is added it must be registered and synced (TC-DPLAN-028). Owner: `@coder`. |
| OQ-3 | Is a legacy-format verdict exit 1 (DEC-1 negative verdict) or a distinct transition exit? | Low | DEC-1 applies: exit 1, `readyForDevelopment=false`. Confirm at review; a change here updates TC-DPLAN-011 and this table together. Owner: `@pm`/`@reviewer`. |
| OQ-4 | When both `chg-<ref>-plan.yaml` and `chg-<ref>-plan.md` exist, which wins? | No | Test only asserts determinism plus disclosure of the artifact read; the precedence rule is documented in TC-DPLAN-030 step 1 and pinned at implementation. Owner: `@spec-writer` (guide) + `@coder`. |
| OQ-5 | How is a wildcard overlap rendered inside `overlappingPaths` — the pattern, the matched concrete path, or both? | No | Freeze at implementation; TC-DPLAN-015 asserts a path that genuinely matches in both scopes and is named, not a bare "overlap". Owner: `@coder`. |
| OQ-6 | What `reason` is used for a sequence verdict when no interaction is declared? | No | TC-DPLAN-016 asserts stable, producer-first ordering only; the reason vocabulary is pinned at implementation and must stay a stable string. Owner: `@coder`. |
| OQ-7 | Does the lint target report `lint.plan.*` (lint man page) or the shared `plan.*` codes (DM-8)? | No | Whichever ships must be registered and synced; TC-DPLAN-020 asserts "classified error from the plan family with location", TC-DPLAN-021 distinguishes unreadable from non-conformant. Owner: `@reviewer`. |
| OQ-8 | Is an unknown build-weight class classified (like an unknown tier) or accepted as opaque data? | No | Not specified; the test asserts echo of declared values only. If classification lands, add the fixture to the TC-DPLAN-003 corpus. Owner: `@spec-writer` (clarify at review). |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-11-05T20:20:03Z | Test plan writer | Initial test design from the completed GH-226 specification; 30 scenarios covering F-1..F-13, AC-F3-1/AC-F6-1/AC-F7-1/AC-F8-1/AC-F9-1/AC-F10-1..3/AC-F11-1/AC-F12-1/AC-F13-1, NFR-1..NFR-7, DM-1..DM-8; SC-M1-06 and SC-M1-07 inherited with their DEC-1/DEC-2 reconciliations recorded. |

## 10. Test Execution Log

| TC ID | Run Date | Result | Notes |
|---|---|---|---|
| TC-DPLAN-001..026 (automated plan suites) | 2026-11-05 | Pass — 88/88 | `bun test tests/behaviour/plan-*.test.ts` across 16 files, 440 `expect()` calls: validate, rejection corpus, tier, ready gate, legacy, overlap (sequence/parallel/precision/ordering), diff, lint, envelope, read-only, determinism, bounded output, and performance. The count is 87 at review HEAD plus the F-6 conservative-overlap fixture added in remediation 8.6. |
| TC-DPLAN-027/028 (structure and boundary invariants) | 2026-11-05 | Plan-family invariants pass; 2 unrelated pre-existing failures | `bun test tests/structure tests/boundaries`: 523 pass / 2 fail. Both failures are the missing `doc/spec/features/feature-plan-schema.md` row in `scripts/checks/forbidden-literals.registry.json` (`unregistered user-facing doc absent at corpusBaseline`), a doc-sync artifact outside the plan suites; no plan-family structure or boundary assertion fails. |
| TC-DPLAN-026 | 2026-11-05 | Pass | 30-phase fixture, warm-up plus 20 samples, hard assertions median < 500 ms AND p95 < 500 ms (NFR-2). Delivery run: median 6.41 ms, p95 11.25 ms (Bun 1.4.4, linux/x64); reviewer independent re-run: p95 4.59 ms; remediation re-runs: median 3.64–4.47 ms, p95 5.50–6.75 ms. Exactly one plan read and no other port touched. No relaxation used: the relaxation rule remains available and unused. |
| TC-DPLAN-029 | 2026-11-05 | Pass (manual) | Writer flip, template, and consuming prompts ship together; `.ados-claude` regenerated in the same commit; plugin staleness clean; no scheduler/queue/ceremony overclaim. |
| TC-DPLAN-030 | 2026-11-05 | Pass (manual) | Naming/precedence and registry rows verified; distribution guard no drift (81 docs); `git diff --check` clean. |
| Remediation gates (8.5–8.6) | 2026-11-05 | Pass | `pnpm typecheck` green; `pnpm exec biome check` clean on `tests/behaviour/plan-overlap-precision.test.ts` and the two new fixtures; `git status` shows only the intended change-artifact and fixture edits (uncommitted for the PM checkpoint). |

---

### Coverage self-check (authoring)

- [x] Every AC in spec §17 maps to at least one scenario (`AC-F3-1`→007; `AC-F6-1`→004/005/006; `AC-F7-1`→008; `AC-F8-1`→002/003; `AC-F9-1`→017/019; `AC-F10-1`→013/015; `AC-F10-2`→014; `AC-F10-3`→013/016; `AC-F11-1`→020/021; `AC-F12-1`→009/010; `AC-F13-1`→011/012).
- [x] Every capability F-1..F-13 appears in §3.1 with at least one scenario.
- [x] Every NFR-1..NFR-7 appears in §3.3 with at least one scenario or an explicit out-of-scope note.
- [x] Every DM-1..DM-8 appears in §3.2 with at least one scenario.
- [x] Seeded scenarios SC-M1-06 and SC-M1-07 are inherited with recorded reconciliations (§3.1, TC-DPLAN-013, TC-DPLAN-009).
- [x] Every TC ID appears in §5.1, §5.2, and §7.
- [x] Deferred scope is stated in §1.2, not left silent.
