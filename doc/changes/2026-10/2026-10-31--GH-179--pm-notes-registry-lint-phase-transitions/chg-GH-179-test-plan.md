---
id: chg-GH-179-test-plan
status: Proposed
created: 2026-10-31T03:45:00Z
last_updated: 2026-10-31T03:45:00Z
owners: [engineering]
service: delivery-os CLI and state tier
labels: [change, planning]
version_impact: minor
summary: "Verify M0-S10: pm-notes and delivery-registry conformance through `ados lint`; `ados phase` as the only schema-validated, idempotent phase-state write path; variant-declared required phase sets (full 11, pinned LITE 6); the nine-cell transition matrix including no-op evidence and absent-phase entry creation; classified storage failures on the registry read; the variant-era corpus boundary minus the GH-171 exclusion manifest; and the five new lint error identities with bidirectional documented-table sync, envelope/exit projection, determinism, read-only lint, tier/runtime confinement and packed Node/Bun consumption."
links:
  change_spec: ./chg-GH-179-spec.md
  implementation_plan: null
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - M0-S10: pm-notes and registry lint, and phase transitions

## 1. Scope and Objectives

This change makes conformance a write-time property and gives phase state exactly one write path, so the tests must prove: **lint conformance** (parseability, required keys, schema-declared value types, variant/required-phase rules, target resolution, and the corpus boundary — with every rejection class pinned to exactly one `lint.*` code), **variant honesty** (absent `variant` means full; LITE is explicit; opaque extras are never inspected; the six pinned LITE phases are enforced one by one), **transition semantics** (all nine matrix cells: landing, no-op with evidence, re-completion, reopen, absent-phase entry creation, out-of-order advisory, grammar rejection before any state inspection), **ledger safety** (torn, schema-mismatch and missing-key registry reads fail classified through the GH-174 state layer, never silent zeros; the derived projection rebuilds from verified ledger truth), **failure identity** (five exact lint codes plus the `lint` domain kind; bidirectional documented-table sync; kind-only ambiguity and `fallback.internal` containment), and **surface discipline** (tier/purity/runtime confinement, zero product literals, envelope and `{0,1,2}` exit projection for every invocation class, deterministic read-only lint, and packed Node/Bun consumption).

The proof is built around two mechanisms the specification names: the **nine-row idempotency matrix** and the **corpus boundary**. No-op cells are non-vacuous by asserting the ledger line count, the absent entry, and the no-op evidence class together; rejection fixtures are non-vacuous by pairing every negative with a restored-or-valid control. Corpus acceptance is derived from the folder-date boundary plus the explicit exclusion manifest, never from a frozen file list.

### 1.1 In Scope

- pm-notes schema conformance: required top-level keys; typed-when-present optional keys; collection entry shape; canonical phase entry `started`/`completed` rules; parser dialect (YAML 1.2 core; unquoted date scalars are strings) (C-1, AC-L1, AC-L6).
- Variant declaration and the pinned LITE set: `full | lite`; absent means full; explicit LITE required phases; opaque extras and non-canonical phase keys (C-2, AC-L4, AC-L6, OQ-1).
- `ados lint` target semantics: pm-notes target, registry target, both; missing pm-notes → `lint.target.missing`; absent registry → explicit verified-empty PASS; read-only (C-3, AC-L1, AC-L5, NFR-2, NFR-3).
- All rejection classes and their single pinned codes: unparseable, wrong-typed top-level value, non-timestamp typed value, missing required top-level key, phase entry missing `started`/`completed`, unknown variant, missing required variant phase, missing pm-notes target (C-6, AC-L1, AC-L4).
- `ados phase list|complete|reopen` semantics and the full nine-row idempotency matrix, including no-op evidence and absent-phase entry creation with outside-set advisory (C-4, AC-L2, AC-L3).
- Write-path lint composition: every malformed class blocks `complete`/`reopen` before mutation with the same pinned identity and zero ledger records (C-3, C-4, AC-L1).
- Registry over the GH-174 state port: `phase.transition` records, append-only order, derived per-change projection, torn/schema/key-set read failures classified with `state.*` identities (C-5, AC-L5).
- Corpus acceptance: variant-era folders (2026-10 or later) minus the exclusion manifest; legacy-era files outside the corpus but write-path bound; opaque-extra positive controls; permanent CI fixture and schema-change re-assertion (AC-L6, NFR-4).
- Five lint rows plus the `lint` domain kind: 5/5 round-trip, bidirectional documented-table sync, containment through `fallback.internal`, kind-only ambiguity (C-6, NFR-5).
- Tier/purity/runtime confinement, zero product literals, envelope and exit projection, determinism and read-only lint, packed `core` surface on Node and Bun (NFR-1, NFR-2, NFR-3).

### 1.2 Out of Scope & Known Gaps

- [OUT] M0-S8 verify change (GH-177); lint is document conformance, not evidence against reality (NG-1).
- [OUT] Agent prompt adoption of `ados phase` in `.opencode/` and `.ados-claude/`; migration is an operating-model note (NG-2).
- [OUT] Registry expansion to retro/ceremony artifacts, memory lint, decision-record/frontmatter/deploy-checklist lint, and any lint policy beyond schema/format conformance (NG-3, NG-5).
- [OUT] A closed key set for pm-notes: extra top-level keys, extra phase keys, extra entry keys and free-form values are opaque and never inspected (NG-4, C-1, C-2).
- [OUT] Repair of the GH-171 pm-notes historical artifact; it is excluded from the corpus by manifest and its repair is owner follow-up (AC-L6).
- [GAP-1 — plan absent at authoring] No `chg-GH-179-plan.md` exists yet; `delivery_planning` follows this phase. This plan binds behaviour and assertions, not task numbering; the plan must map onto these TCs and must not reshape them.
- [GAP-2 — scoped spawn exception] NFR-1 requires packed `core` consumption on both Node and Bun, which necessarily spawns a runtime. Per the GH-174 OQ-T1 precedent, the packed probe is the single scoped spawned-process exception; every lint/phase behaviour suite remains in-process and spawn-free. No other spawned test is licensed.
- [GAP-3 — delivery-bound spellings] The lint target selector spelling (`lint REF` versus an explicit registry selector), the derived projection file name/shape, and evidence field names are delivery-bound. The target semantics, evidence classes, identities and record payload fields are pinned by this plan.
- [GAP-4 — dynamic corpus] The corpus is derived at run time from folder dates and the exclusion manifest, not frozen as a list. The spec's measured scan predates GH-179; the boundary therefore includes GH-179's own pm-notes, which must pass. This is consistent with AC-L6, not an extension.
- [GAP-5 — meta-property] NFR-4's "100% re-assertion on schema-module change" is a CI/change property, not a single runtime output. It is proven by a mutation control that changes the pinned variant constants in a temp copy and observes the corpus/phase fixture re-evaluate.

## 2. References

- **Change specification**: [chg-GH-179-spec.md](./chg-GH-179-spec.md) — AC-L1..AC-L6, C-1..C-6, NFR-1..NFR-5, QA Strategy, matrix rows 1–9, revision log v1.1 (R1–R3e) and v1.2 (corpus boundary + exclusion manifest).
- **Testing strategy**: [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) — `bun:test`, `tests/{structure,behaviour,checks,boundaries,golden}`, `scripts/checks/*.ts` mutation tests, boundary fixtures, `pnpm check`.
- **TypeScript rules**: [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md) — strict typing, injected time/randomness/environment, runtime-API confinement, no ambient reads.
- **State layer**: [feature-state-layer.md](../../../spec/features/feature-state-layer.md) and [chg-GH-174-test-plan.md](../2026-10-30--GH-174--state-layer/chg-GH-174-test-plan.md) — store port, verified-empty semantics, torn-state detection, key-set assertions, derived-document replace, scoped packed-probe precedent.
- **Result contract**: [feature-result-contract.md](../../../spec/features/feature-result-contract.md) — envelope shape, documented error table, classification chain, binding bidirectional sync.
- **Command registry**: [cli-command-registry.md](../../../planning/oss-tooling/cli-command-registry.md) — `ados lint` and `ados phase` rows; `phase list|complete|reopen` grammar; lint-versus-verify terminology.
- **Change lifecycle**: [change-lifecycle.md](../../../guides/change-lifecycle.md) — the canonical 11 phases behind the `full` variant.
- **Architecture**: [ADR-0003 — OSS Monorepo Structure](../../../decisions/ADR-0003-oss-monorepo-structure.md) — tier matrix, runtime-API allowlist.
- **Existing mechanisms**: `tests/fixtures/state/harness.ts`; `tests/structure/state-imports.test.ts`; `tests/structure/state-scope.test.ts`; `tests/structure/error-table.test.ts`; `tests/checks/error-table-sync.test.ts`; `scripts/checks/{error-table-sync,ambient-globals,forbidden-literals,exit-code-literals}.ts`; `tests/checks/packed-state.test.ts`; `tests/boundaries/**`.
- **Ticket**: GH-179 — M0-S10: pm-notes and registry lint, and phase transitions.

## 3. Coverage Overview

### 3.1 Functional Coverage (AC-#, C-#)

| AC ID | Criterion (abbreviated) | TC ID(s) | Status |
|-------|--------------------------|----------|--------|
| AC-L1 | Malformed notes rejected at write with the pinned lint identity, non-zero exit, and zero mutations | TC-LINT-001, TC-LINT-002, TC-LINT-003, TC-LINT-004, TC-LINT-005, TC-LINT-010, TC-PHASE-006 | Covered |
| AC-L2 | Transitions are idempotent; every redundant matrix cell exits 0 with zero additional records and no-op evidence | TC-PHASE-001, TC-PHASE-002, TC-PHASE-003, TC-PHASE-004, TC-PHASE-005, TC-PHASE-009 | Covered |
| AC-L3 | Reopen without a reason is rejected `input.value.rejected` before state inspection or mutation | TC-PHASE-005 | Covered |
| AC-L4 | A LITE declaration missing any pinned LITE phase fails lint naming it; restored passes | TC-LINT-005, TC-LINT-006 | Covered |
| AC-L5 | Registry reads return only verified, schema-checked records; torn/mismatch/key-set failures are classified `state.*`, never silent zeros | TC-PHASE-007, TC-PHASE-009 | Covered |
| AC-L6 | The variant-era corpus minus the exclusion manifest passes with the effective-variant default; opaque extras are never inspected | TC-LINT-006, TC-LINT-007, TC-LINT-008 | Covered |

**Capability coverage** (no capability left unlinked): C-1 → TC-LINT-001, TC-LINT-002, TC-LINT-006, TC-LINT-007, TC-LINT-008; C-2 → TC-LINT-003, TC-LINT-005, TC-LINT-006; C-3 → TC-LINT-001..005, TC-LINT-009, TC-LINT-010, TC-PHASE-006; C-4 → TC-PHASE-001..009; C-5 → TC-PHASE-007, TC-PHASE-009; C-6 → TC-SYNC-007, TC-SYNC-008, TC-SYNC-009.

**TC → AC traceability**: every scenario's `Related IDs` line and the Scenario Index (§5.1) carry the reverse direction; the table above carries the forward direction. Both are derived from AC-L1..AC-L6 and NFR-1..NFR-5.

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

The spec declares no `API-#`, `EVT-#` or `DM-#` identifiers and no REST/HTTP endpoints or events. The interface surface is the six capabilities below; each is mapped to TCs.

| Interface / capability | Description | TC ID(s) | Status |
|------------------------|-------------|----------|--------|
| C-1 — pm-notes document shape | Typed top-level keys, phase entries, collections; opaque extras; YAML 1.2 dialect | TC-LINT-001, TC-LINT-002, TC-LINT-006, TC-LINT-007, TC-LINT-008 | Covered |
| C-2 — variant contract | `full` or `lite`; absent means full; pinned LITE set; opaque keys beyond the effective set | TC-LINT-003, TC-LINT-005, TC-LINT-006 | Covered |
| C-3 — lint command surface | Named targets; check families; target resolution; read-only; `--json` envelope | TC-LINT-001..005, TC-LINT-009, TC-LINT-010, TC-PHASE-006 | Covered |
| C-4 — phase command surface | `list`/`complete`/`reopen`; grammar before state; nine-row matrix; single write path | TC-PHASE-001..009 | Covered |
| C-5 — registry records | `phase.transition` payload; append-only ledger; derived per-change projection; state-port read | TC-PHASE-007, TC-PHASE-009 | Covered |
| C-6 — error identities | Five lint rows under the `lint` kind; existing `input`/`state` reuse; containment | TC-SYNC-007, TC-SYNC-008, TC-SYNC-009 | Covered |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement | TC ID(s) | Status |
|--------|-------------|----------|--------|
| NFR-1 | Runtime neutrality and tier conformance: 0 tier violations, 0 runtime-conditionals in contracts/domain, 0 runtime APIs outside the driver edge, 0 CLI rendering/exit decisions in core, 0 packed-surface failures on Node or Bun | TC-BOUND-001, TC-BOUND-002, TC-BOUND-003 | Covered |
| NFR-2 | Machine output: 100% envelope validity, 100% single-serializer `--json`, 0 exits outside `{0,1,2}`, 0 user-category failures not projecting to 1 | TC-LINT-010, TC-PHASE-008 | Covered |
| NFR-3 | Determinism and read-only lint: 0 verdict drift across replays, 0 ambient reads outside declared edges, 0 bytes written by standalone lint | TC-LINT-009 | Covered |
| NFR-4 | Corpus compatibility: 0 failures over the boundary minus manifest, 0 legitimate-shape regressions, 100% re-assertion on schema-module change | TC-LINT-007, TC-LINT-008 | Covered |
| NFR-5 | Error-table binding: 5/5 lint codes round-trip, 0 drift both directions, 0 containment escapes, 0 ambiguous kind-only selections | TC-SYNC-007, TC-SYNC-008, TC-SYNC-009 | Covered |

## 4. Test Types and Layers

| Layer | Runner / invocation | Location | Covers |
|-------|--------------------|----------|--------|
| Contract/structure vocabulary | `bun test tests/structure` | `tests/structure/pm-notes-contract.test.ts` (assumed), `tests/structure/registry-contract.test.ts` (assumed), existing `tests/structure/error-table.test.ts` | TC-LINT-006 (shape half), TC-SYNC-007, TC-BOUND-001 |
| pm-notes lint behaviour | `bun test tests/behaviour` | `tests/behaviour/pm-notes-lint.test.ts` (assumed), `tests/behaviour/pm-notes-lint-rejections.test.ts` (assumed) + `tests/fixtures/pm-notes/**` | TC-LINT-001..006, TC-LINT-010, TC-PHASE-006 |
| Corpus acceptance and boundary | `bun test tests/behaviour` (or `tests/golden`) | `tests/behaviour/pm-notes-corpus.test.ts` (assumed) + committed corpus manifest | TC-LINT-007, TC-LINT-008 |
| Determinism and read-only | `bun test tests/behaviour` | `tests/behaviour/pm-notes-lint-determinism.test.ts` (assumed) | TC-LINT-009 |
| Phase transitions and idempotency | `bun test tests/behaviour` | `tests/behaviour/phase-transitions.test.ts`, `tests/behaviour/phase-idempotency.test.ts`, `tests/behaviour/phase-rejections.test.ts` (assumed) + `tests/fixtures/phase/**` | TC-PHASE-001..006, TC-PHASE-008, TC-PHASE-009 |
| Registry over the state port | `bun test tests/behaviour` | `tests/behaviour/phase-registry.test.ts` (assumed), reusing `tests/fixtures/state/harness.ts` | TC-PHASE-007, TC-PHASE-009 |
| Error-table sync mutations | `bun run scripts/checks/error-table-sync.ts`; `bun test tests/checks/error-table-sync.test.ts` | existing check + mutation suite, extended for lint rows | TC-SYNC-008, TC-SYNC-009 |
| Boundary and purity | `bun test tests/boundaries tests/structure`; `bun run scripts/checks/{ambient-globals,forbidden-literals,exit-code-literals}.ts` | existing boundary harness, import detectors, literal registry | TC-BOUND-001, TC-BOUND-002 |
| Packed consumer | `bun test tests/checks/packed-state.test.ts` | existing packed-tarball pattern, extended for the new `core` surface | TC-BOUND-003 |
| Aggregate and non-regression | `pnpm check`; existing bash/tool suites | repo root; unchanged | TC-BOUND-001, TC-BOUND-003 |

### 4.1 In-Process Command-Harness Contract (binding for all lint/phase behaviour TCs)

1. **One harness, no spawned processes.** Tests build the `lint` and `phase` command programs with the existing CLI dependency pattern (`brand`, injected `clock`, `newRunId`, `secrets`, `program`) plus injected filesystem/state-root facts, then call `runCli(argv, streams, deps)` in-process. No child process is spawned by any lint/phase suite; the packed probe in TC-BOUND-003 is the sole recorded exception (GAP-2).
2. **Injected time and paths.** The clock is a deterministic sequence; pm-notes paths, state directory, workspace identifier and fence namespace are injected. No test reads `$HOME`, the wall clock, the real state directory or an ambient environment where purity is asserted.
3. **Self-materializing fixtures.** Every fixture tree is created under a fresh `mkdtemp` root in the OS temp directory (or is a committed fixture under `tests/fixtures/**`); no fixture depends on a gitignored local scratch directory inside the repository. Corpus fixtures read committed files read-only.
4. **One assertion oracle per rejection class.** Each negative fixture asserts exactly one pinned code; the suite fails if a second code also matches or if a generic error is returned. Valid/restored controls are run in the same test so a silently permissive implementation cannot pass.
5. **Ledger-delta observation.** Mutation tests count `phase.transition` records in the raw ledger (and through the verified read) before and after the invocation; no-op assertions require a zero delta and unchanged target bytes.

### 4.2 Non-Vacuity Contract (binding for every negative and no-op scenario)

- Every malformed fixture carries a distinctive `planted-payload-*` canary that must not appear in errors, evidence or serialized output; the fixture builder asserts the intended mutation/omission is present before lint runs.
- Every negative fixture is paired with a restored-or-valid control that passes (or mutates) through the same invocation path.
- Every no-op cell asserts three things together: exit 0, zero additional ledger records, and no entry creation/change. A control implementation that appends on a no-op must fail the suite.
- Every storage-failure fixture is generated from verified bytes and mutated by a named operation; a detection-disabled control must expose the planted value, proving the fixture is live.
- Error-table mutation tests run in isolated temp copies; the unchanged control is always green and the live tree is never written.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Impact | Priority | AC |
|-------|-------|------|--------|----------|----|
| TC-LINT-001 | Malformed syntax and non-conforming value types | Negative | Critical | High | AC-L1 |
| TC-LINT-002 | Missing required keys, top-level and entry-level | Negative | Critical | High | AC-L1 |
| TC-LINT-003 | Unknown variant versus wrong-typed variant | Negative | Critical | High | AC-L1 |
| TC-LINT-004 | Target resolution: missing pm-notes versus verified-empty registry | Corner Case | Critical | High | AC-L1, AC-L5 |
| TC-LINT-005 | LITE required-phase omissions, one pinned phase at a time | Negative | Critical | High | AC-L1, AC-L4 |
| TC-LINT-006 | Variant semantics and opaque keys | Happy Path | Critical | High | AC-L4, AC-L6 |
| TC-LINT-007 | Variant-era corpus acceptance | Happy Path | Critical | High | AC-L6 |
| TC-LINT-008 | Corpus boundary, exclusion manifest and opaque controls | Edge Case | Critical | High | AC-L6 |
| TC-LINT-009 | Lint determinism and read-only behaviour | Regression | Critical | High | NFR-3 |
| TC-LINT-010 | Lint envelope and exit projection | Regression | Critical | High | AC-L1, NFR-2 |
| TC-PHASE-001 | Matrix rows 1–3: complete landing, no-op and re-completion | Happy Path | Critical | High | AC-L2 |
| TC-PHASE-002 | Matrix rows 4–5: reopen landing and no-op | Happy Path | Critical | High | AC-L2 |
| TC-PHASE-003 | Matrix row 6: out-of-order completion advisory | Edge Case | Important | High | AC-L2 |
| TC-PHASE-004 | Matrix row 9: absent canonical phase entry creation | Edge Case | Critical | High | AC-L2 |
| TC-PHASE-005 | Matrix rows 7–8: grammar rejections before state inspection | Negative | Critical | High | AC-L3, AC-L2 |
| TC-PHASE-006 | Write-path lint blocks every malformed class | Negative | Critical | High | AC-L1 |
| TC-PHASE-007 | Registry read safety and classified storage failures | Negative | Critical | High | AC-L5 |
| TC-PHASE-008 | Phase surface: list, envelope and exit projection | Regression | Critical | High | NFR-2 |
| TC-PHASE-009 | Phase ledger records and derived projection | Happy Path | Critical | High | AC-L2, AC-L5 |
| TC-SYNC-007 | Five lint identities round-trip | Regression | Critical | High | NFR-5 |
| TC-SYNC-008 | Bidirectional documented-table synchronization | Regression | Critical | High | NFR-5 |
| TC-SYNC-009 | Lint containment and multi-row-kind ambiguity | Regression | Critical | High | NFR-5 |
| TC-BOUND-001 | Tier, purity, runtime confinement and literals | Regression | Critical | High | NFR-1 |
| TC-BOUND-002 | CLI edge ownership and command composition | Regression | Critical | High | NFR-1 |
| TC-BOUND-003 | Packed core surface on Node and Bun | Regression | Critical | High | NFR-1 |

`TC-SYNC-007..009` continue the repository's existing `TC-SYNC-001..006` sequence (GH-172) so no identifier is reused for a different scenario.

### 5.2 Scenario Details

#### TC-LINT-001 - Malformed syntax and non-conforming value types

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: C-1, C-3, AC-L1, NFR-2
**Test Type(s)**: Unit, Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/pm-notes-lint-rejections.test.ts`, `tests/fixtures/pm-notes/malformed/**`
**Tags**: @backend

**Preconditions**:

- Fixtures: an unparseable document (orphaned indentation, as in the GH-171 artifact); wrong-typed top-level values (`change_id: 42`, `title: [..]`, `phases: "not-a-map"`, `delivery_mode: false`); non-timestamp typed phase values (`started: 42`, `completed: true`, `started: {}` on a required canonical phase); wrong-typed collection entries (`notes: [{text: 42}]`, `decisions: [{text: "x", date: 7}]`).
- Positive controls: a valid document; unquoted and quoted ISO date strings in `date` fields; `started: "2026-10-31T00:00:00Z"`; `completed: null`.
- Each malformed fixture carries a `planted-payload-*` canary; the builder asserts the mutation/omission is present.

**Steps**:

1. Run lint against each malformed fixture with `--json`.
2. Assert the error code is exactly `lint.notes.malformed`, category `user`, `retryable: false`, consequence `not_landed`, projection class `user-validation`, exit 1, and no `data` property.
3. Assert the failure location names the offending top-level key, phase id or collection entry; the canary never appears in stdout or stderr.
4. Run the positive controls and assert exit 0; assert unquoted date scalars are accepted as strings (YAML 1.2 core).
5. Run a control fixture with the offending value corrected and assert exit 0.

**Expected Outcome**:

- Every syntax/structure/value-type fixture fails exactly `lint.notes.malformed`; no such fixture yields `lint.keys.missing`, `lint.variant.unknown` or a crash.
- Valid and corrected controls pass; unquoted dates are strings; lint writes nothing.

#### TC-LINT-002 - Missing required keys, top-level and entry-level

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: C-1, C-3, AC-L1
**Test Type(s)**: Unit, Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/pm-notes-lint-rejections.test.ts`, `tests/fixtures/pm-notes/malformed/**`
**Tags**: @backend

**Preconditions**:

- One fixture per required top-level key omitted: `change_id`, `title`, `delivery_mode`, `phases`.
- A fixture with a canonical phase entry missing `started`, one missing `completed`, and one collection entry missing `text`.
- A control fixture omitting only optional top-level keys (`milestone`, `story_code`, `variant`, `decisions`, `open_questions`, `blockers`, `notes`).

**Steps**:

1. Run lint for each omission and assert exactly `lint.keys.missing`.
2. Assert the failure names the missing key or keys and the phase/collection location; no value is substituted for the missing key.
3. Assert the optional-only omission control passes.
4. Restore each missing key and assert the fixture passes.

**Expected Outcome**:

- Missing required keys fail exactly `lint.keys.missing` with the missing names; optional omissions pass; no default substitution.

#### TC-LINT-003 - Unknown variant versus wrong-typed variant

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: C-2, C-3, AC-L1
**Test Type(s)**: Unit, Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/pm-notes-lint-rejections.test.ts`, `tests/fixtures/pm-notes/variant/**`
**Tags**: @backend

**Preconditions**:

- Unknown-value fixtures: `variant: compressed`, `variant: LITE`, `variant: " lite"`.
- Wrong-type fixtures: `variant: 1`, `variant: ["lite"]`, `variant: {name: lite}`.
- Positive controls: `variant: full`, `variant: lite`, and `variant` absent.

**Steps**:

1. Run lint for each unknown-value fixture and assert exactly `lint.variant.unknown`.
2. Run lint for each wrong-type fixture and assert exactly `lint.notes.malformed` (the value-type class, not the unknown-value class).
3. Assert positive controls pass with the effective variant applied.

**Expected Outcome**:

- Unknown enum values fail `lint.variant.unknown`; wrong-typed values fail `lint.notes.malformed`; the two classes never cross; valid and absent variants pass.

#### TC-LINT-004 - Target resolution: missing pm-notes versus verified-empty registry

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: C-3, AC-L1, AC-L5
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/pm-notes-lint.test.ts`, `tests/behaviour/pm-notes-lint-rejections.test.ts`
**Tags**: @backend

**Preconditions**:

- A change ref with no pm-notes file; a change ref with a valid pm-notes file.
- An absent registry target (no state store); a present registry with a valid ledger; a present-but-torn registry fixture from TC-PHASE-007.

**Steps**:

1. Lint the missing pm-notes target and assert exactly `lint.target.missing`, exit 1, no mutation.
2. Lint the absent registry target and assert exit 0 with an explicit verified-empty marker in evidence; assert the code is not `lint.target.missing`.
3. Lint the present-but-torn registry and assert `state.store.torn`, never `lint.target.missing` and never a verified-empty pass.
4. Lint the valid pm-notes and valid registry and assert both pass.

**Expected Outcome**:

- Missing pm-notes is the only target-resolution failure; an absent registry is an explicit verified-empty PASS; a torn registry is a classified storage failure, not a target failure; the four outcomes are distinct.

#### TC-LINT-005 - LITE required-phase omissions, one pinned phase at a time

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: C-2, C-3, AC-L1, AC-L4
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/pm-notes-lint.test.ts`, `tests/fixtures/pm-notes/variant/**`
**Tags**: @backend

**Preconditions**:

- The pinned LITE set: `clarify_scope`, `specification`, `delivery`, `quality_gates`, `dod_check`, `pr_creation`.
- Six fixtures, each declaring `variant: lite` with exactly one pinned phase key omitted and the other five present (null timestamps allowed).
- A control with all six present, and a control omitting the non-required canonical phase `test_planning`.

**Steps**:

1. For each of the six fixtures, run lint and assert exactly `lint.phases.incomplete`, exit 1, and that the evidence names exactly the omitted phase.
2. Restore the omitted phase in each fixture and assert exit 0.
3. Assert the all-six control passes and the `test_planning`-omitted control passes.
4. Assert a fixture omitting two pinned phases still fails `lint.phases.incomplete`; the single-omission fixtures pin the exact naming.

**Expected Outcome**:

- Each pinned LITE phase is independently enforced; the failure names the omitted phase; restoration passes; non-required canonical phases are not required by LITE.

#### TC-LINT-006 - Variant semantics and opaque keys

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: C-1, C-2, AC-L4, AC-L6, OQ-1
**Test Type(s)**: Unit, Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/pm-notes-lint.test.ts`, `tests/structure/pm-notes-contract.test.ts` (assumed), `tests/fixtures/pm-notes/variant/**`
**Tags**: @backend

**Preconditions**:

- Full-variant fixtures: all 11 canonical phases present; one omitting `test_planning`; one with `variant` absent and all 11 present.
- LITE fixtures: all six required present; `test_planning` absent; `test_planning` present as a plain string; a non-canonical key `ci_remediation` carrying a sequence.
- Opaque-extra fixtures: a required phase entry carrying `reopened`, `commits`, `verdict`, `url`, `evidence` with arbitrary value types; a collection entry with extra keys; a non-canonical phase key with a sequence value.
- The committed GH-170 pm-notes as the real opaque-extra control.

**Steps**:

1. Assert absent `variant` and explicit `variant: full` both require the canonical 11; omitting any canonical phase fails `lint.phases.incomplete`.
2. Assert explicit `variant: lite` requires only the pinned six; a dropped phase may be absent or carry an arbitrary value and still pass.
3. Assert non-canonical phase keys and extra keys on required entries are never inspected: arbitrary sequences, strings and maps pass; missing `started`/`completed` on an opaque key does not fail.
4. Assert a required canonical entry with a missing `started`/`completed` still fails `lint.keys.missing` and a required entry with wrong-typed timestamps fails `lint.notes.malformed`.
5. Run lint over the GH-170 pm-notes and assert it passes.

**Expected Outcome**:

- Omission never yields LITE; the effective required set is validated; opaque keys and extras are accepted without inspection; GH-170's real shapes pass.

#### TC-LINT-007 - Variant-era corpus acceptance

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: C-1, C-2, AC-L6, NFR-4
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/pm-notes-corpus.test.ts` (assumed), committed `doc/changes/**` corpus
**Tags**: @backend @golden

**Preconditions**:

- A corpus enumerator that selects `doc/changes/*/*--*/chg-*-pm-notes.yaml` whose change folder month is 2026-10 or later.
- The explicit exclusion manifest naming exactly `doc/changes/2026-10/2026-10-29--GH-171--branding-seam-working-name/chg-GH-171-pm-notes.yaml`.
- The effective-variant default (absent `variant` means full).

**Steps**:

1. Enumerate the boundary set and assert it is non-empty and includes the measured variant-era members GH-170, GH-172, GH-173, GH-174, GH-181 and GH-179; assert GH-171 is excluded only by the manifest.
2. Assert legacy-era folders (before 2026-10) are not in the set.
3. Lint every boundary file with the effective-variant default; assert zero failures and exit 0 for each.
4. Assert each file is parseable, has the required keys with declared types, has the effective variant's required phases, and that extra keys are accepted (GH-170's sequence/string extras are the positive control).
5. In an isolated temp copy, inject one malformed variant-era file and one fixture missing a required phase; assert the scan fails for each, proving the corpus test is live.

**Expected Outcome**:

- Zero corpus failures over the boundary minus manifest; the set is derived dynamically; malformed injections fail; legacy files are outside the fixture.

#### TC-LINT-008 - Corpus boundary, exclusion manifest and opaque controls

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: C-1, C-2, AC-L6, NFR-4
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/pm-notes-corpus.test.ts` (assumed), corpus manifest fixture
**Tags**: @backend @golden

**Preconditions**:

- A temp copy of the change tree; the corpus enumerator; the exclusion-manifest guard.
- A legacy-era fixture (pre-2026-10) missing `delivery_mode`; a synthetic lite document; the schema constants for the LITE set.

**Steps**:

1. Add a new variant-era pm-notes file in the temp copy and assert it is picked up; move a file to a 2026-09 folder and assert it leaves the set.
2. Assert the manifest names exactly one path, that the path exists, and that the file is genuinely unparseable (the exclusion is justified); assert a second manifest entry without a known-unparseable file fails the guard.
3. Target the legacy-era fixture with a mutating phase invocation in a temp root and assert it fails the appropriate `lint.keys.missing` (naming `delivery_mode`), proving the schema still applies at write time even though the file is outside the corpus.
4. Run synthetic opaque-extra positive controls (extra phase keys with sequences/strings, extra entry keys, non-canonical phases) and assert they pass.
5. In a temp copy, change the pinned LITE required set in the schema module and assert the corpus/phase fixtures re-evaluate and a previously passing lite document now fails; assert no hardcoded duplicate of the set exists in the corpus test.

**Expected Outcome**:

- The fixture drifts correctly with folder dates and the manifest; the exclusion is justified and cannot grow silently; legacy files are outside the corpus but write-path bound; opaque shapes pass; a schema-module change re-asserts the corpus.

#### TC-LINT-009 - Lint determinism and read-only behaviour

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: C-3, NFR-3
**Test Type(s)**: Unit, Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/pm-notes-lint-determinism.test.ts` (assumed)
**Tags**: @backend

**Preconditions**:

- Success, each rejection-class fixture, and the corpus boundary file; a recording edge that records every write/append/rename/truncate/index write and fence acquisition; ambient stubs that throw.
- A target-byte digest and state-directory digest before each run.

**Steps**:

1. Run standalone lint three times over identical bytes for each fixture; assert the identity, category, evidence class and location are identical across runs (zero drift).
2. Install ambient stubs for environment, clock and randomness and assert the verdict is unchanged; AST-scan the contracts and domain tiers for ambient reads and assert zero.
3. Snapshot target bytes and the state directory before and after standalone lint; assert byte-identical and zero writes, appends, renames, truncations, index writes and fence acquisitions.
4. Run a control lint implementation that writes a cache file and assert the digest/recorder assertion catches it.

**Expected Outcome**:

- Identical inputs yield identical verdicts and evidence classes; zero ambient reads outside declared edges; zero bytes written; the write-detecting control is caught.

#### TC-LINT-010 - Lint envelope and exit projection

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: C-3, C-6, AC-L1, NFR-2
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/pm-notes-lint.test.ts`, `tests/golden/helpers.ts` (reuse)
**Tags**: @backend

**Preconditions**:

- Invocation classes: success; each of the five lint codes through its trigger; an invocation/grammar rejection if the lint surface has one; human and `--json` modes.
- `assertEnvelopeContract` from `@delivery-os/testkit`.

**Steps**:

1. For every class run `--json` and assert stdout parses, contains exactly one envelope, and `assertEnvelopeContract` returns an empty violation list.
2. Assert failures carry no `data`, and `error.code`, `category`, `retryable`, `consequence`, `remediationHint` match the documented row.
3. Assert exit codes: success 0; every lint code is user-category and exits 1; no exit outside `{0,1,2}`.
4. Run human mode and assert the same exit codes; success output is human, failure diagnostics go to the error stream; the single serializer is the only writer.

**Expected Outcome**:

- Every lint invocation returns through the envelope; `--json` is always valid; user failures project to 1; no exit outside `{0,1,2}`.

#### TC-PHASE-001 - Matrix rows 1–3: complete landing, no-op and re-completion

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: C-4, AC-L2, NFR-2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/phase-transitions.test.ts`, `tests/behaviour/phase-idempotency.test.ts` (assumed)
**Tags**: @backend

**Preconditions**:

- A valid full-variant pm-notes fixture with all 11 phases present; phase P (`delivery`) present with `completed: null`; an injected deterministic clock; a temp state root.
- Raw access to the ledger and to the derived phase state.

**Steps**:

1. Row 1: run `phase complete REF delivery`; assert exit 0, one new `phase.transition` record, P's entry completed with the injected timestamp, and the record's operation `complete`.
2. Row 2: run the same invocation again; assert exit 0, zero additional ledger records, P's entry unchanged, and no-op evidence citing the existing completion.
3. Row 3: run `phase reopen REF delivery REASON` (row 4), then `phase complete REF delivery`; assert exit 0, one new record for the re-completion (in addition to the reopen record), P completed with a new timestamp, and operation `complete`.
4. Assert the raw ledger line count equals the number of landing transitions and that rows 1 and 3 produced distinct records.
5. Run a control that appends on the second completion and assert the no-op assertion catches it.

**Expected Outcome**:

- Row 1 lands and records; row 2 is a no-op success with zero records and no entry change; row 3 re-lands as a new record; the append-on-no-op control is detected.

#### TC-PHASE-002 - Matrix rows 4–5: reopen landing and no-op

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: C-4, AC-L2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/phase-transitions.test.ts`, `tests/behaviour/phase-idempotency.test.ts` (assumed)
**Tags**: @backend

**Preconditions**:

- A completed phase P; an open phase Q (present, `completed: null`); an absent canonical phase R; a deterministic clock and temp state root.

**Steps**:

1. Row 4: run `phase reopen REF P REASON`; assert exit 0, one new record with operation `reopen` and the exact reason, P no longer completed, and the reason surfaced in evidence.
2. Row 5: run `phase reopen REF Q REASON`; assert exit 0, zero additional records, Q's entry unchanged, no entry created, evidence reports Q was not completed, and the reason appears only in evidence.
3. Run the same reopen against the absent phase R; assert no entry is created and the ledger delta is zero.
4. Assert `complete` records carry no reason field and `reopen` records do.
5. Run a control that appends on the reopen no-op and assert the suite catches it.

**Expected Outcome**:

- Row 4 lands with the recorded reason; row 5 is a no-op success with no record and no entry creation; the reason is echoed only in evidence; the append-on-no-op control is detected.

#### TC-PHASE-003 - Matrix row 6: out-of-order completion advisory

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: C-4, AC-L2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/phase-transitions.test.ts` (assumed)
**Tags**: @backend

**Preconditions**:

- A full-variant fixture where all phases earlier than `dod_check` are completed except `quality_gates`; `dod_check` open.
- A lite-variant fixture with the same shape for the effective variant.

**Steps**:

1. Run `phase complete REF dod_check` on the full fixture; assert exit 0, one record, and advisory evidence naming exactly `quality_gates` (the earlier open phase of the effective variant).
2. Reopen `quality_gates` after it was completed, then complete `dod_check`; assert the advisory still names `quality_gates`, proving the advisory follows the reopened state rather than a one-time snapshot.
3. Run the ordered control (all earlier phases completed) and assert success with no advisory.
4. Run the lite fixture and assert the advisory names the earlier open phase of the pinned LITE set, not a phase outside it.
5. Assert the out-of-order invocation is not rejected and the transition lands.

**Expected Outcome**:

- Out-of-order completion is allowed and lands; advisory names the earlier open phase(s) of the effective variant; an ordered control has no advisory.

#### TC-PHASE-004 - Matrix row 9: absent canonical phase entry creation

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: C-4, AC-L2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/phase-transitions.test.ts` (assumed)
**Tags**: @backend

**Preconditions**:

- Full-variant fixture with `review_fix` absent from the `phases` map.
- Full-variant fixture with `test_planning` absent (canonical and required).
- Lite-variant fixture with `test_planning` absent (canonical but outside the LITE required set).
- A deterministic clock. The write path validates the post-transition (staged) document before landing, so the target phase's own entry creation satisfies the required-phase check without exempting any unrelated defect (A-T9).

**Steps**:

1. Assert each target phase key is absent before the invocation.
2. Run `phase complete REF review_fix` (full) and `phase complete REF test_planning` (full); assert exit 0, a valid entry with `started` and `completed`, one new record, and no outside-set advisory.
3. Run `phase complete REF test_planning` on the lite fixture; assert exit 0, a valid entry created, one new record, and advisory evidence that the phase is outside the declared variant's required set.
4. Assert the advisory is distinct from the earlier-open advisory of TC-PHASE-003.
5. Assert that completing an absent phase does not exempt an unrelated missing required phase: with `review_fix` and `dor_check` both absent, completing `review_fix` still fails `lint.phases.incomplete` naming `dor_check` and lands nothing.
6. Run a control that appends without creating the entry and assert the suite catches it.

**Expected Outcome**:

- Completing an absent canonical phase creates a valid `started`/`completed` entry and lands a record; outside the declared required set, the advisory is present; unrelated missing required phases still block; the append-without-entry control is detected.

#### TC-PHASE-005 - Matrix rows 7–8: grammar rejections before state inspection

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: C-4, AC-L3, AC-L2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/phase-rejections.test.ts` (assumed)
**Tags**: @backend

**Preconditions**:

- A valid target, a malformed target and a missing target; a completed phase; the canonical phase vocabulary.
- A recording state/read seam that notes any state inspection.

**Steps**:

1. Row 7: run `phase reopen REF PHASE` with the reason missing and with an empty reason; assert exit 1, exactly `input.value.rejected`, `consequence: not_landed`, zero ledger records, and target bytes unchanged.
2. Repeat row 7 against the malformed and missing targets; assert the same `input.value.rejected` (grammar validation precedes target resolution and state inspection).
3. Row 8: run `phase complete REF unknown_phase` and `phase reopen REF ci_remediation REASON`; assert exactly `input.value.rejected`, no state inspection, no mutation, zero records.
4. Assert neither case returns a `lint.*` or `state.*` code.
5. Run the positive controls: `phase reopen REF completed_phase REASON` and `phase complete REF canonical_phase` succeed and mutate; run a control that validates the reason after state inspection and assert the missing-target case would return `lint.target.missing`, proving the ordering assertion is live.

**Expected Outcome**:

- Reason-less reopen and unknown phase ids fail exactly `input.value.rejected` before state inspection; zero records and zero target change; valid reason/canonical phase controls succeed.

#### TC-PHASE-006 - Write-path lint blocks every malformed class

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: C-3, C-4, AC-L1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/phase-write-path-lint.test.ts` (assumed), reusing the malformed fixtures
**Tags**: @backend

**Preconditions**:

- Every malformed class from TC-LINT-001..005 (unparseable, wrong-typed top-level, non-timestamp, missing top-level key, phase entry missing `started`/`completed`, unknown variant, missing target, LITE missing phase) plus a valid control.
- For phase-entry and missing-required-phase classes, the mutating target phase is chosen so it is not the defective or omitted phase; otherwise the target's own staged entry creation would legitimately repair the defect (matrix row 9).
- A completed-phase variant for the reopen check; raw ledger access; a recording edge for append calls.

**Steps**:

1. For each malformed fixture, run `phase complete REF PHASE` and, where the fixture has a completed phase, `phase reopen REF PHASE REASON`.
2. Assert the error code is exactly the same pinned lint code the standalone lint returned for that fixture; assert exit 1, `consequence: not_landed`, and a valid `--json` envelope.
3. Assert zero new `phase.transition` records and target bytes unchanged; assert no append occurred and that any acquired fence was released without an append.
4. Run the valid control through both invocations and assert success with exactly one new record, proving the mutation path is live.
5. Assert the missing-target case fails `lint.target.missing` and not a state code; assert the unrelated-missing-phase case fails `lint.phases.incomplete` naming the omitted phase and lands nothing.

**Expected Outcome**:

- Every malformed class blocks the mutation with its pinned lint identity, exit 1, and zero records; the valid control mutates; no lint failure is bypassed.

#### TC-PHASE-007 - Registry read safety and classified storage failures

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: C-5, AC-L5, NFR-2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/phase-registry.test.ts` (assumed), `tests/fixtures/state/harness.ts`
**Tags**: @backend

**Preconditions**:

- A valid registry built by landing transitions; deterministic torn fixtures (payload byte flip, framing break, sequence gap), each with a `planted-payload-*` canary; a schema-mismatch header/record fixture; a missing-declared-key read; an absent registry; a corrupted derived projection.

**Steps**:

1. Read through `phase list` (and the registry lint target) for each torn fixture; assert exactly `state.store.torn`, zero values returned, a safe location (path plus record position), no canary in raw or serialized output, and never a verified-empty marker.
2. Read the schema-mismatch fixture and assert exactly `state.schema.mismatch` with zero values and no coercion.
3. Read declaring an absent record key and assert exactly `state.keys.missing` naming the missing keys and substituting no default or empty value.
4. Read the absent registry and assert explicit verified-empty evidence, success for the empty declaration, distinct from torn.
5. Corrupt or delete the derived projection and assert it rebuilds from verified ledger truth; inject a storage I/O failure during the rebuild and assert exactly `state.write.failed` (transient, retryable, `not_landed`, per the GH-174 derived-document precedent), with no stale read; returned values equal the ledger fold.
6. Invoke a mutating phase command against the torn registry; assert the same `state.store.torn` failure, zero ledger records, and no pm-notes mutation (the write path cannot decide idempotency from unverified bytes).
7. Run a detection-disabled control and assert the planted canary would be exposed, proving the torn fixtures are live.

**Expected Outcome**:

- Torn/schema/key-set failures are classified `state.*`, never silent zeros; a projection rebuild failure is exactly `state.write.failed`; verified-empty is explicit and distinct; the derived projection is rebuildable; the write path refuses to mutate over torn bytes; the detection-disabled control is caught.

#### TC-PHASE-008 - Phase surface: list, envelope and exit projection

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: C-4, NFR-2
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/phase-envelope.test.ts` (assumed), `tests/golden/helpers.ts` (reuse)
**Tags**: @backend

**Preconditions**:

- A populated registry; an absent registry; success and failure invocations from TC-PHASE-001/002/005/006/007; `assertEnvelopeContract`.

**Steps**:

1. Run `phase list REF` on the populated registry; assert exit 0, the derived per-change phase state, and no ledger mutation.
2. Run `phase list REF` on the absent registry; assert verified-empty success and explicit evidence.
3. Run `complete`/`reopen` success and failure cases with `--json`; assert exactly one envelope, `assertEnvelopeContract` empty, no `data` on failure, and documented error fields.
4. Assert exit projections: success 0; `input.value.rejected` and `lint.*` and user `state.*` failures 1; platform `state.*` failures (torn, schema, keys) 2; no exit outside `{0,1,2}`.
5. Run human mode and assert the same exit codes; assert the existing unknown-command/flag path still returns `fallback.invocation`.

**Expected Outcome**:

- The phase surface returns through the envelope; `--json` is always valid; exit projection is exact; `phase list` reads without mutating; verified-empty is explicit.

#### TC-PHASE-009 - Phase ledger records and derived projection

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: C-4, C-5, AC-L2, AC-L5
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/phase-registry.test.ts` (assumed)
**Tags**: @backend

**Preconditions**:

- A registry with landed `complete` and `reopen` transitions; a no-op invocation; the injected clock; raw ledger access.

**Steps**:

1. Assert every landing mutation appended exactly one record of kind `phase.transition` with payload keys for the change ref, phase id, operation (`complete | reopen`), reason (reopen only), timestamp (injected clock) and outcome.
2. Assert no-op transitions (rows 2 and 5) appended nothing.
3. Snapshot the ledger prefix and assert earlier lines are byte-identical after later transitions; assert no in-place rewrite and no prune/delete surface.
4. Fold the verified `phase.transition` records and assert the result equals `phase list`; replace/rebuild the derived projection and assert the same state.
5. Assert the registry contributes no independent record kind for the projection; the derived state is not an appended record.
6. Run a control that appends a record on a no-op and assert the suite catches it.

**Expected Outcome**:

- Exactly one `phase.transition` per landing mutation with the pinned payload; no-op writes nothing; the ledger is append-only; the derived projection equals the verified ledger fold and is rebuildable; the no-op-append control is detected.

#### TC-SYNC-007 - Five lint identities round-trip

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: C-6, NFR-5
**Test Type(s)**: Unit, Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/error-table.test.ts` (update), `tests/behaviour/pm-notes-lint.test.ts`
**Tags**: @backend

**Preconditions**:

- `DOMAIN_KINDS` including `lint`; `ERROR_TABLE` with exactly five lint rows; the trigger fixtures from TC-LINT-001..005; `classifyDomainKind` and `classifyThrown`.

**Steps**:

1. Assert `DOMAIN_KINDS` contains `lint` and that exactly five rows have domain kind `lint`, with the exact code, category, retryability, consequence `not_landed`, projection class `user-validation` and remediation hint from the spec.
2. Drive each code through its trigger and assert the returned failure is exactly that entry.
3. Assert `classifyDomainKind("lint", CODE)` and `classifyThrown({ kind: "lint", code: CODE })` return the same entry for all five codes.
4. Assert each code round-trips through the envelope with matching fields and exit 1.
5. Run a temp-copy control that removes one lint row and assert the corresponding trigger fails the suite.

**Expected Outcome**:

- 5/5 exact lint identities; all fields match; each code is reachable through its trigger and the classification chain; the row count is exactly five; the removal control is caught.

#### TC-SYNC-008 - Bidirectional documented-table synchronization

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: C-6, NFR-5
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/checks/error-table-sync.ts`, `tests/checks/error-table-sync.test.ts` (update), `doc/spec/features/feature-result-contract.md`
**Tags**: @backend

**Preconditions**:

- The five lint rows authored in-change in both the machine table and the documented table; the existing sync check and mutation harness; isolated temp copies.

**Steps**:

1. Run the sync check on the delivered state; assert green and non-zero counts for source entries (including the five lint rows), documented rows, recognized lint references and corpus rows.
2. In a machine copy, remove one lint row and separately remove `lint` from `DOMAIN_KINDS`; assert each fails and names the offending code or kind.
3. In a documentation copy, remove a lint row, add a doc-only lint row, alter a documented field and duplicate a row; assert each fails in the documentation direction.
4. Assert a missing, empty or unparseable documented table fails closed; run the unchanged control and assert it stays green.
5. Assert the five lint rows exist exactly once in `doc/spec/features/feature-result-contract.md`.

**Expected Outcome**:

- 5/5 lint rows synchronize in both directions; machine-only and documentation-only drift each fail with a named offender; the check cannot pass vacuously; the unchanged control is green.

#### TC-SYNC-009 - Lint containment and multi-row-kind ambiguity

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: C-6, NFR-5
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/error-classification.test.ts` (update) or `tests/structure/error-table.test.ts`
**Tags**: @backend

**Preconditions**:

- Five lint rows; the existing `config` and `state` rows; `classifyDomainKind` and `classifyThrown`; a first-row-selecting control classifier.

**Steps**:

1. Assert `classifyDomainKind("lint")` without a code throws (ambiguous, five rows); assert `classifyThrown({ kind: "lint" })` returns `fallback.internal`, never the first lint row.
2. Assert wrong-kind (`lint` with `state.store.torn`), unknown code, missing code, mismatched code and non-string code all contain through `fallback.internal`.
3. Assert exact-code lookup for each lint row returns exactly that row.
4. Assert existing `config` and `state` exact-code and kind-only behaviours are unchanged.
5. Run the first-row-selecting control and assert the suite catches it.

**Expected Outcome**:

- Kind-only `lint` is ambiguous and contained; wrong/missing/mismatched codes contain through `fallback.internal`; exact codes resolve; existing kinds do not regress; the first-row control is caught.

#### TC-BOUND-001 - Tier, purity, runtime confinement and literals

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-1
**Test Type(s)**: Static, Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/pm-notes-imports.test.ts` (assumed), `tests/structure/registry-imports.test.ts` (assumed), `tests/boundaries/**`, `scripts/checks/{ambient-globals,forbidden-literals,exit-code-literals}.ts`
**Tags**: @backend

**Preconditions**:

- The new contracts files; `packages/core/src/domain/pm-notes-lint.ts`; `packages/core/src/state/registry.ts`; the boundary harness and fixture registry; the forbidden-literal registry including the new feature doc.

**Steps**:

1. Assert `contracts/pm-notes.ts` and `contracts/registry.ts` contain only type/interface/import/export/as-const variable declarations; no executable statements, no runtime imports, no behavior; the ambient guard covers them.
2. Assert the domain lint rules import no `node:*`/`bun:*`, no adapters, branding, config or CLI; assert the parser is not invoked in the domain and a parse failure is an input value, not a thrown crash.
3. Run the state-import detector over `packages/core/src/state/**` including the new registry module; assert only `#contracts`/`./contracts` and own modules are imported; assert runtime APIs appear only in `state/driver/runtime-edge.ts`; run the negative and clean controls.
4. AST-scan contracts and domain for runtime-conditional branches (`process.platform`, `Bun`, `Deno`, `window`, `navigator`); assert zero and run a synthetic control.
5. Assert core has no stream writes, no `process.exit`, no exit-code digit literals outside the projection module, and no CLI import; run the existing edge-seam and exit-literal checks with a seeded-violation control.
6. Run the forbidden-literal scan; assert the new lint/phase feature doc is registered and zero product literals exist; run the synthetic literal control.
7. Assert the boundary fixture-coverage meta-check passes; delete one new fixture in a temp copy and assert the meta-check fails.

**Expected Outcome**:

- Contracts are data-only; the domain is pure; state imports `./contracts` only; runtime APIs stay in the driver edge; no runtime-conditionals, product literals or rendering/exit decisions in core; every new rule has a failing fixture and a clean control.

#### TC-BOUND-002 - CLI edge ownership and command composition

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-1
**Test Type(s)**: Static, Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/cli-edge-seam.test.ts` (update), `tests/structure/pm-notes-imports.test.ts` (assumed)
**Tags**: @backend

**Preconditions**:

- The new `commands/lint.ts` and `commands/phase.ts`; `commands/index.ts`; `edge.ts`; the config command precedent; the structural scan helpers.

**Steps**:

1. Assert both commands are registered in `commands/index.ts` and composed into the CLI edge following the config command-registration precedent.
2. Assert target files are read and parsed at the CLI surface edge and that contracts/domain receive parsed values or a parse-failure input; assert no file access, clock read or environment read exists in contracts/domain.
3. Assert handlers return data or error without writing streams and without choosing an exit code; assert the CLI owns the `{0,1,2}` projection and rendering.
4. Assert the brand binary name arrives through the injected brand; assert no product literal in the new command files.
5. Assert `packages/core/src/**` does not import `packages/cli/**`; run a seeded violation (a core file importing the CLI) and assert the scan fails.

**Expected Outcome**:

- The CLI edge owns file access, rendering and exit projection; pure tiers stay pure; both commands are composed through the existing pattern; zero product literals; the seeded violation is caught.

#### TC-BOUND-003 - Packed core surface on Node and Bun

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-1
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/packed-state.test.ts` (update), extending the packed-tarball pattern
**Tags**: @backend

**Preconditions**:

- A built `core` package; a real `pnpm pack` tarball installed in an isolated consumer with a hermetic HOME; the declared subpaths; Node and Bun available per the recorded runtime matrix.

**Steps**:

1. Pack `core`; install it into an isolated consumer; import `@delivery-os/core/contracts` and `@delivery-os/core/state` under Node and Bun.
2. Assert the new pm-notes and registry vocabulary loads, and read a runtime value (the variant enum or a required-phase constant) so a type-only import cannot vacuously pass.
3. Open a local state store and perform a minimal append/read through the public state surface under each runtime; assert the registry record shape is accepted.
4. Assert no new package subpath beyond the declared surfaces, no ambient read under stubbed environment/clock, and no unsupported dependency in the packed manifest.
5. Run a negative probe against a non-existent subpath and assert resolution fails; retain the real-import control.

**Expected Outcome**:

- The packed `core` surface imports and runs under Node and Bun; the new vocabulary is exercised at runtime; no new subpaths, ambient reads or unsupported dependencies; the negative probe fails as expected. This is the single scoped spawned-process exception (GAP-2).

## 6. Environments and Test Data

### 6.1 Environments

| Environment | Requirements | Notes |
|-------------|--------------|-------|
| Local dev (delivery) | Bun pinned by `.bun-version`; pnpm pinned by `packageManager`; Node available for the packed probe | All lint/phase behaviour suites are hermetic and in-process |
| CI (GitHub Actions, `ubuntu-latest`) | Frozen-lockfile install; pinned Bun/pnpm/Node; existing `ts-*` jobs | Authoritative for corpus, boundary, sync, envelope and aggregate gates |
| Packed probe | Node and Bun per the recorded runtime matrix | The only spawned-process test (GAP-2) |
| Temp fixture trees | `mkdtemp` under the OS temp directory | Malformed, variant, corpus-copy, torn, mutation and packed-consumer fixtures never write the live tree |
| In-process test process | Bun runtime; injected brand, clock, fs/state root and streams | No child processes for behaviour suites; deterministic clock sequences |

### 6.2 Test Data

| Data | Source / shape | Lifecycle |
|------|----------------|-----------|
| Valid pm-notes fixtures | Full-11 and LITE-6 documents, with null and non-null timestamps | Read-only under `tests/fixtures/pm-notes/**` |
| Malformed pm-notes fixtures | Unparseable, wrong-typed, missing-key, non-timestamp and unknown-variant documents, each with a planted canary | Read-only; builder asserts the omission/mutation |
| Opaque-extra fixtures | Extra phase keys with sequences/strings, extra entry keys, non-canonical phase ids | Read-only; positive controls |
| Corpus | Committed `doc/changes/**` pm-notes, boundary derived from folder dates plus the exclusion manifest | Read-only at test time; mutation copies only |
| Registry fixtures | Valid ledger, torn ledger (flip/framing/sequence), schema mismatch, missing key, absent store, corrupt projection | Generated in temp roots; canaries planted |
| Phase fixtures | Completed, open, reopened and absent phases; full and LITE variants | Read-only; per-test temp state roots |
| Error table | `ERROR_TABLE`, `DOMAIN_KINDS` and `doc/spec/features/feature-result-contract.md` with the five lint rows authored in-change | Read-only at test time; drift fails sync |
| Mutation copies | Temp copies of the table, documented table, corpus tree and schema module | Generated per test in `mkdtemp`; deleted at test end |

### 6.3 Isolation Strategy

- Every fixture and mutation test uses a fresh temporary root; no test writes the live repository tree, `dist/` or the user's real state directory. A clean-tree assertion after the suite is part of the aggregate gate.
- Lint/phase suites inject brand, paths, clock, filesystem/state facts and streams; they never read `$HOME`, the wall clock or an ambient environment where purity is asserted.
- The corpus test reads committed files read-only; boundary-drift and schema-mutation tests operate on temp copies only.
- The packed probe uses a real tarball, `--ignore-workspace`, a hermetic HOME and explicit cleanup; it never installs into the workspace.
- Mutation tests edit copies only; the unchanged control always runs in the same suite so a disabled check is observable.

## 7. Automation Plan and Implementation Mapping

All TCs are automated. Locations are proposed under the repository testing strategy; delivery planning may bind different filenames but must preserve each TC's behaviour, assertions and AC mapping. Run `pnpm build` before the packed probe; use narrow Bun suites while iterating and `pnpm check` for the final gate.

| TC ID | Test file / artefact | Execution command | Control / mutation | Status |
|-------|----------------------|-------------------|--------------------|--------|
| TC-LINT-001 | `tests/behaviour/pm-notes-lint-rejections.test.ts` + `tests/fixtures/pm-notes/malformed/**` | `bun test tests/behaviour/pm-notes-lint-rejections.test.ts` | restored/valid controls; canary sweep; date-scalar positive control | To Implement |
| TC-LINT-002 | same | same | restored-key controls; optional-omission control | To Implement |
| TC-LINT-003 | same + `tests/fixtures/pm-notes/variant/**` | same | wrong-type versus unknown-value split; valid variants | To Implement |
| TC-LINT-004 | `tests/behaviour/pm-notes-lint.test.ts` | `bun test tests/behaviour/pm-notes-lint.test.ts` | absent/present/torn target controls; verified-empty distinction | To Implement |
| TC-LINT-005 | `tests/behaviour/pm-notes-lint.test.ts` + variant fixtures | same | six per-phase omissions; restored controls | To Implement |
| TC-LINT-006 | `tests/behaviour/pm-notes-lint.test.ts`, `tests/structure/pm-notes-contract.test.ts` | corresponding `bun test` | GH-170 real control; opaque extras; required-entry failures | To Implement |
| TC-LINT-007 | `tests/behaviour/pm-notes-corpus.test.ts` | `bun test tests/behaviour/pm-notes-corpus.test.ts` | malformed injection in a temp copy; boundary membership assertions | To Implement |
| TC-LINT-008 | `tests/behaviour/pm-notes-corpus.test.ts` + corpus manifest | same | add/move files; manifest-growth guard; legacy write-path control; schema-mutation control | To Implement |
| TC-LINT-009 | `tests/behaviour/pm-notes-lint-determinism.test.ts` | `bun test tests/behaviour/pm-notes-lint-determinism.test.ts` | replay comparison; recording edge; ambient stubs; writing-control | To Implement |
| TC-LINT-010 | `tests/behaviour/pm-notes-lint.test.ts` | corresponding `bun test` | every class; `assertEnvelopeContract`; exit matrix | To Implement |
| TC-PHASE-001 | `tests/behaviour/phase-transitions.test.ts`, `tests/behaviour/phase-idempotency.test.ts` | corresponding `bun test` | rows 1–3; ledger delta; append-on-no-op control | To Implement |
| TC-PHASE-002 | same | same | rows 4–5; reason placement; append-on-no-op control | To Implement |
| TC-PHASE-003 | `tests/behaviour/phase-transitions.test.ts` | same | ordered control; full versus lite advisory | To Implement |
| TC-PHASE-004 | same | same | absent-phase entry creation; outside-set advisory; append-without-entry control | To Implement |
| TC-PHASE-005 | `tests/behaviour/phase-rejections.test.ts` | `bun test tests/behaviour/phase-rejections.test.ts` | malformed/missing target; state-seam recorder; valid controls | To Implement |
| TC-PHASE-006 | `tests/behaviour/phase-write-path-lint.test.ts` | `bun test tests/behaviour/phase-write-path-lint.test.ts` | all malformed classes; valid control; zero-record assertion | To Implement |
| TC-PHASE-007 | `tests/behaviour/phase-registry.test.ts` + `tests/fixtures/state/harness.ts` | `bun test tests/behaviour/phase-registry.test.ts` | torn/mismatch/key-set fixtures; detection-disabled control | To Implement |
| TC-PHASE-008 | `tests/behaviour/phase-envelope.test.ts` | `bun test tests/behaviour/phase-envelope.test.ts` | success/failure matrix; `assertEnvelopeContract`; exit projection | To Implement |
| TC-PHASE-009 | `tests/behaviour/phase-registry.test.ts` | same | record payload; ledger prefix; projection fold; no-op control | To Implement |
| TC-SYNC-007 | `tests/structure/error-table.test.ts`, `tests/behaviour/pm-notes-lint.test.ts` | corresponding `bun test` | five triggers; five-row removal control | Existing – Update |
| TC-SYNC-008 | `scripts/checks/error-table-sync.ts`, `tests/checks/error-table-sync.test.ts` | `bun run scripts/checks/error-table-sync.ts`; `bun test tests/checks/error-table-sync.test.ts` | both drift directions; kind removal; empty-table control | Existing – Update |
| TC-SYNC-009 | `tests/structure/error-table.test.ts` or `tests/behaviour/error-classification.test.ts` | corresponding `bun test` | kind-only ambiguity; bad-code containment; first-row control | Existing – Update |
| TC-BOUND-001 | `tests/structure/pm-notes-imports.test.ts`, `tests/structure/registry-imports.test.ts`, `tests/boundaries/**`, `scripts/checks/{ambient-globals,forbidden-literals,exit-code-literals}.ts` | `bun test tests/structure tests/boundaries`; `bun run scripts/checks/ambient-globals.ts`; `bun run scripts/checks/forbidden-literals.ts`; `bun run scripts/checks/exit-code-literals.ts` | synthetic violations; fixture-deletion self-test; literal control | Existing – Update |
| TC-BOUND-002 | `tests/structure/cli-edge-seam.test.ts`, `tests/structure/pm-notes-imports.test.ts` | corresponding `bun test` | seeded core-imports-CLI violation; no-I/O handler scan | Existing – Update |
| TC-BOUND-003 | `tests/checks/packed-state.test.ts` | `bun test tests/checks/packed-state.test.ts` | packed tarball; Node/Bun probes; non-existent subpath | Existing – Update |

**Execution order.**

1. Structure and vocabulary: TC-SYNC-007, TC-BOUND-001, TC-BOUND-002.
2. Lint rejection classes and variant semantics: TC-LINT-001..006.
3. Corpus and boundary: TC-LINT-007, TC-LINT-008.
4. Determinism and envelope: TC-LINT-009, TC-LINT-010.
5. Phase matrix: TC-PHASE-001..005.
6. Write-path lint and registry safety: TC-PHASE-006, TC-PHASE-007, TC-PHASE-009.
7. Phase surface envelope: TC-PHASE-008.
8. Error-table sync: TC-SYNC-008, TC-SYNC-009.
9. Packed probe and aggregate regression: TC-BOUND-003, `pnpm check`.

**Wiring.** The new behaviour suites are discovered by root `bun test`. The error-table sync check stays in the existing `ts-invariants` wiring; no new CI job topology is introduced. Boundary updates extend existing rules and fixtures; the fixture-coverage meta-check enforces them. The packed probe belongs to `tests/checks` and runs in the existing `ts-test` suite after a build, matching the packed-state precedent.

**Evidence commands** (run and record in the change/PR; never record unrun results as passing):

```
pnpm install --frozen-lockfile
pnpm build
bun test tests/structure
bun test tests/behaviour/pm-notes-lint.test.ts
bun test tests/behaviour/pm-notes-lint-rejections.test.ts
bun test tests/behaviour/pm-notes-corpus.test.ts
bun test tests/behaviour/pm-notes-lint-determinism.test.ts
bun test tests/behaviour/phase-transitions.test.ts
bun test tests/behaviour/phase-idempotency.test.ts
bun test tests/behaviour/phase-rejections.test.ts
bun test tests/behaviour/phase-write-path-lint.test.ts
bun test tests/behaviour/phase-registry.test.ts
bun test tests/behaviour/phase-envelope.test.ts
bun test tests/checks/error-table-sync.test.ts
bun test tests/checks/packed-state.test.ts
bun test tests/boundaries
bun run scripts/checks/error-table-sync.ts
bun run scripts/checks/ambient-globals.ts
bun run scripts/checks/forbidden-literals.ts
bun run scripts/checks/exit-code-literals.ts
bun run scripts/checks/workspace-entrypoints.ts
pnpm check
git diff --check
git status --porcelain
```

**Open-PR DoD evidence checklist.** All six ACs have a passing traceable TC; all five NFR thresholds measured; all nine matrix rows exercised with no-op cells asserting zero records and no entry creation; every rejection class pinned to exactly one code; the corpus boundary minus manifest green and the GH-171 exclusion justified; five lint rows synchronized in both directions with kind-only ambiguity contained; envelope and exit projection exact for every invocation class; lint deterministic and read-only; tier/purity/runtime/branding/literal gates green; packed Node/Bun probe green; no existing gate weakened; the new feature doc registered; a minor changeset recorded; an open unmerged PR targets `main-tools`. No merge or owner acceptance is claimed by this plan.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Risk | Impact | Probability | Mitigation |
|----|------|--------|-------------|------------|
| RSK-T1 | A rejection fixture is inert, so lint passes without proving detection | H | M | Every fixture asserts its omission/mutation and carries a planted canary; restored/valid controls run in the same test; no negative control may pass silently |
| RSK-T2 | No-op cells pass vacuously because the ledger is not inspected | H | M | Rows 2 and 5 assert exit 0, zero additional records, no entry creation/change and evidence class together; an append-on-no-op control must fail |
| RSK-T3 | Grammar validation is accidentally ordered after state inspection | H | M | Row 7/8 cases run against malformed and missing targets and assert `input.value.rejected`; a state/read recorder asserts no inspection; a wrongly ordered control is caught |
| RSK-T4 | The corpus fixture freezes a file list and drifts from the actual boundary | H | M | The enumerator derives from folder dates plus the manifest; add/move mutation controls; schema-change re-assertion control |
| RSK-T5 | The exclusion manifest grows silently and hides real corpus failures | H | L | The guard requires exactly one path, the file exists and is genuinely unparseable; a second entry fails |
| RSK-T6 | Torn registry fixtures do not exercise the real read path | H | M | Fixtures are generated from verified bytes, mutated by named operations, carry canaries, and run through `phase list` and the registry lint target; detection-disabled control |
| RSK-T7 | Error-table sync becomes vacuous (missing rows, empty table, no counts) | H | L | Non-zero count assertions; both drift directions; kind removal; missing/unparseable table fails closed; unchanged control green |
| RSK-T8 | The packed probe is skipped or vacuously type-only | M | M | The probe reads a runtime value and performs a minimal append/read under both runtimes; a non-existent subpath negative probe; the exception is recorded, not hidden |
| RSK-T9 | LITE omission is accepted by accident | H | M | Absent `variant` is tested as full in TC-LINT-006; each LITE phase has its own omission fixture in TC-LINT-005 |
| RSK-T10 | Existing behaviour regresses while extending shared modules | M | M | Existing `config`/`state` suites, boundary suite, sync mutations and `pnpm check` run in the aggregate gate; no rule is weakened |

### 8.2 Assumptions

- **A-T1 — Behaviour-bound TCs.** Proposed filenames and symbols marked "assumed" may change in delivery planning; the behaviour, assertion target, pinned identities and AC mapping must not. Spec-fixed values (`lint.*` codes, variant values, the LITE set, `phase.transition`, `fallback.internal`, `input.value.rejected`, `state.*`) may not be rebound.
- **A-T2 — In-process harness.** Lint/phase behaviour is exercised through `runCli` with injected dependencies; the packed probe is the only spawned test (GAP-2, GH-174 OQ-T1 precedent).
- **A-T3 — Delivery-bound spellings.** The lint target selector, projection file name and evidence field names may be chosen in delivery; the semantics (pm-notes versus registry target, missing pm-notes versus verified-empty registry, evidence classes) are pinned here.
- **A-T4 — Corpus manifest.** The exclusion manifest content is pinned (exactly the GH-171 pm-notes path); its storage location (contracts data or a committed test fixture) is delivery-bound.
- **A-T5 — Plan-relative.** The plan ([chg-GH-179-plan.md](./chg-GH-179-plan.md), pending) maps its phases onto these TCs; any later plan or implementation change that alters a TC's behaviour, assertion or AC mapping must reopen this test plan.
- **A-T6 — Reason placement.** The reopen reason is asserted in the `phase.transition` record and command evidence (C-5); the plan does not require a schema-declared reason key on the pm-notes phase entry.
- **A-T7 — Version impact.** The spec declares no `version_impact`; `minor` is recorded because the change is additive (new commands and contract data). The owner may amend at PR review.
- **A-T8 — Corpus includes the current change.** The spec's measured scan predates GH-179; the folder-date boundary includes GH-179's own pm-notes, which must pass.
- **A-T9 — Staged write-path validation.** Matrix row 9 requires the phase write path to validate the post-transition (staged) document before landing, so the target phase's own entry creation satisfies the required-phase presence check; unrelated missing required phases still block the mutation. TC-PHASE-004 asserts the outcome and the unrelated-missing-phase block; it does not pin the internal ordering. A defect the target transition cannot repair still lands nothing (TC-PHASE-006).

### 8.3 Open Questions

| ID | Question | Context | Status | Owner |
|----|----------|---------|--------|-------|
| OQ-T1 | What is the exact lint target selector spelling? | The spec pins the semantics (pm-notes, registry, both) but not the flag names; tests use the command definition's target descriptors. | Open — delivery-bound, non-blocking | @plan-writer / @coder |
| OQ-T2 | Where does the corpus exclusion manifest live? | Content is pinned (exactly the GH-171 path); storage as contracts as-const data or a committed test fixture is delivery-bound. | Open — delivery-bound, non-blocking | @coder |
| OQ-T3 | Does NFR-1's packed Node/Bun probe violate the in-process rule? | It necessarily spawns a runtime; GH-174 OQ-T1 established the single scoped packed-probe exception, and all behaviour suites stay in-process. | Resolved — scoped exception recorded (GAP-2) | @readiness-reviewer |
| OQ-T4 | What is the derived per-change projection file name and shape? | C-5 pins the semantics (derived, atomically replaced, rebuildable, not an independent record kind); the file name/shape is delivery-bound. | Open — delivery-bound, non-blocking | @coder |
| OQ-T5 | What exact evidence fields report no-op, out-of-order and outside-set advisories? | The evidence classes and named phases are pinned; field names are delivery-bound. | Open — delivery-bound, non-blocking | @plan-writer / @coder |
| OQ-T6 | Is the reopen reason stored in the pm-notes entry itself? | C-5 pins the reason in the `phase.transition` record; row 5 pins evidence-only for a no-op. Tests assert record plus evidence, not a schema-declared entry key. | Resolved by this plan (A-T6) | @test-plan-writer |
| OQ-T7 | How can `complete` land on an absent required phase when the write path lints required-phase presence? | Row 9 explicitly requires entry creation and landing; the coherent reading is staged validation of the post-transition document, with unrelated missing phases still blocking. | Resolved by this plan (A-T9) — no spec amendment requested; the matrix row is the binding outcome | @test-plan-writer |

**Recorded gaps, not silently adjusted:**

1. **Plan absent** — GAP-1/A-T5; the plan must map onto these TCs.
2. **Packed probe spawn** — GAP-2/OQ-T3; the single scoped exception, no other spawned tests.
3. **Delivery-bound spellings** — GAP-3/A-T3/OQ-T1/OQ-T2/OQ-T4/OQ-T5; semantics, identities and record fields are pinned.
4. **Dynamic corpus** — GAP-4/A-T8; the fixture derives from the boundary and manifest, and includes GH-179.
5. **Schema-change re-assertion** — GAP-5; proven by a mutation control, not a runtime output.

No AC is left without a TC.

## 9. Plan Revision Log

| Version | Date (UTC) | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-10-31T03:45:00Z | Change Test Plan Writer | Initial plan: 25 TCs (TC-LINT-001..010, TC-PHASE-001..009, TC-SYNC-007..009 continuing the GH-172 sequence, TC-BOUND-001..003). All six ACs and five NFRs mapped; all nine matrix rows covered with explicit no-op and absent-phase assertions; every rejection class pinned to exactly one code; LITE six-phase omissions and absent-variant-means-full; corpus boundary minus the GH-171 manifest with legacy write-path control and opaque-extra positive controls; five lint rows with bidirectional sync and containment; envelope/exit, determinism/read-only, tier/runtime/literal and packed Node/Bun coverage. Spec gaps and delivery-bound spellings recorded, not reinterpreted. |

## 10. Test Execution Log

| TC ID / gate | Run Date (UTC) | Result | Notes / command / HEAD |
|---|---|---|---|
| Not run | — | Planned | This writer ran no builds or tests and implemented no code. The executor records per-TC evidence, commands, HEAD and pushed-HEAD CI results here; unrun evidence must never be recorded as passing. |
