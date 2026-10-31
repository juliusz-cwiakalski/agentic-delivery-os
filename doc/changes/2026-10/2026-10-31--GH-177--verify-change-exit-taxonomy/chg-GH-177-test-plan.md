---
id: chg-GH-177-test-plan
status: Proposed
created: 2026-10-31T05:30:00Z
last_updated: 2026-10-31T05:30:00Z
owners: [engineering]
service: delivery-os CLI verification and state tier
labels: [change, planning]
version_impact: minor
summary: "Verify M0-S8: a read-only `ados verify change <ref>` that checks the declared variant's phase ledger against the pm-notes declaration and the verified registry transition history, classifies the delivery result tuple in the eleven-token bash-era vocabulary, and projects every classified outcome through one total exit taxonomy. The plan proves: variant-aware missing-phase naming (full eleven, pinned LITE six); exact `result=…; variant=…; missing=…` summaries; classified malformed-note and registry-failure outcomes with zero crashes and zero exit-zero false success; the eleven-token enum/taxonomy bound to the bash usage enum and the spec table; overlay precedence with presence-tolerant reads and projection-not-evidence; read-only, network-free, spawn-free, deterministic behaviour; the new `verify` error kind/row with two-way table sync; and the real committed GH-179/GH-170/GH-171 corpus."
links:
  change_spec: ./chg-GH-177-spec.md
  implementation_plan: null
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - M0-S8: verify change and exit taxonomy

## 1. Scope and Objectives

This change introduces the one read-only verifier that kills the exit-zero false-success class at the verification layer: `ados verify change <ref>` reads the committed pm-notes declaration and the verified `phase.transition` history, names every required phase of the declared variant that is not completed, classifies the delivery result tuple in the eleven-token bash-era vocabulary, and returns exactly one envelope whose exit is the projection of that identity. The tests must prove three things at once: **completeness is evidence** (every missing required phase is named in required-set order, and only a fully verified ledger exits `0`), **bad input is classified** (unparseable, structurally invalid, unknown-variant, missing-target, grammar, and registry failures each resolve to exactly one pinned identity, never a crash and never `fallback.internal`), and **the vocabulary is bound** (the contracts enum equals the bash usage enum in set and order, the taxonomy is total, and the documented tables agree with the data).

The plan is built around two adversarial mechanisms the specification names. First, a **non-vacuous rejection matrix**: every negative fixture asserts the exact identity, the exact exit, the absence of `data`, the absence of exit `0`, and the absence of `fallback.internal`, and every negative is paired with a restored-or-valid control. Second, **two-direction overlay controls**: a declaration-only implementation must fail the registry-reopen fixture, a registry-required implementation must fail the declaration-only fixture, and a projection-reading implementation must fail the projection-contradiction fixture. The real-corpus fixture pins the declaration fallback against committed files read in place.

### 1.1 In Scope

- The `verify change <ref>` surface: exactly one subcommand and one ref, no command-specific flags, global `--json`, parser-level rejection before the handler, handler grammar rejection before any read (C-1, AC-V14).
- Variant-aware required sets from the already-pinned `PM_NOTES_REQUIRED_PHASES_BY_VARIANT`: full eleven, pinned LITE six, absence means full, unknown value is a lint finding, wrong type is malformed (C-2, AC-V1, AC-V2, AC-V4).
- Per-phase evidence merge: declaration as fallback, registry transition overrides every phase it mentions, absent per-change record is no evidence, a missing store is a verified-empty store, and the derived projection is never evidence (C-3, AC-V6, AC-V12, DEC-4, DEC-10).
- The complete, ordered missing-phase verdict and the two `partial` identities: `lint.phases.incomplete` when a required phase key is still absent after the overlay; `verify.ledger.incomplete` when every remaining missing phase is declared but not completed (C-6, C-7, AC-V1, AC-V2, AC-V3, AC-V13).
- Malformed classes and their exact identities: unparseable, missing required top-level key, missing entry `started`/`completed`, missing collection `text`, wrong-typed values, unknown variant, missing target, and the fixed parse → keys → value-types → variant → phase-presence order (C-7, AC-V3, AC-V4, AC-V5).
- Registry read failures: torn store, schema mismatch, corrupt per-change transition payload, and permission denial, with the platform/user exit split and no write or fence (C-8, AC-V7).
- The eleven-token result enum and total taxonomy as contracts data, bound to the `scripts/deliver-ticket.sh` usage enum and to the documented C-4 table (C-4, C-5, AC-V8, NFR-5).
- The envelope/exit matrix: exactly one valid envelope per invocation, success only for `finished`, no `data` on failure, and exit digits only in the projection module (C-5, C-6, AC-V9, NFR-2, NFR-3).
- Read-only, network-free, spawn-free, deterministic behaviour, including zero writes, appends, fences, projection rebuilds, and byte-identical replays over identical facts (AC-V10, NFR-4).
- The real committed corpus: GH-179 finished, GH-170 partial naming `test_planning,delivery_planning`, GH-171 malformed, all read in place (AC-V11, NFR-7).
- The additive `verify` domain kind and `verify.ledger.incomplete` row, with bidirectional documented-table sync and untouched existing rows (C-8, NFR-6).
- Tier, data-only, single-enum-home, handler-purity, inventory, brand-literal, ambient, exit-literal, and dependency-cruiser gates for the new modules (NFR-1).

### 1.2 Out of Scope & Known Gaps

- [OUT] Tracker, PR, CI, session, or dispatch evidence; the seven reserved tokens (`merged`, `blocked`, `pr-open`, `pr-open-unverified`, `max-restarts`, `noop-lane-permission`, `noop-lane-nothing-to-do`) are asserted declared and unreachable, not derived (NG-1, AC-V8).
- [OUT] Any mutation: verify writes no pm-notes, appends no registry record, rebuilds no projection, acquires no fence, and calls no tracker/PR provider (NG-2).
- [OUT] `verify gates` (M0-S9), CI-status evaluation, push parity, owner-gate scan, squash preflight, dispatch/supervision/liveness, and agent-prompt adoption (NG-3, NG-4, NG-7).
- [OUT] pm-notes schema or variant-set changes; the pinned required sets are consumed as data and are not re-declared (NG-6).
- [OUT] Cross-repository, remote, or shared ledger reads; M0-S8 uses local state only (NG-8).
- [OUT] A packed Node/Bun consumer probe: this change adds modules under existing package subpaths and changes no package manifest, so NFR-1 is proven by the tier, ambient, and dependency-cruiser gates the spec names; no spawned probe is introduced.
- [GAP-1 — plan absent] No `chg-GH-177-plan.md` exists at authoring; `delivery_planning` follows this phase. This plan binds behaviour, assertions, identities, and AC mapping, not task numbering; the plan must map onto these TCs and must not reshape them.
- [GAP-2 — `state.level.unsupported` is not reachable by verify] C-8 documents the row as "not reachable on the local read path today, but total". It is therefore proven by the error-table totality/round-trip test, not by a fabricated verify fixture; AC-V9's matrix covers every verify-reachable identity (see TC-VERIFY-012 and TC-VERIFY-019).
- [GAP-3 — delivery-bound spellings] The verify runtime type names, the reachable-subset export name (if any), the internal helper names, and the exact lint `detail` punctuation are delivery-bound. The identities, summaries, tokens, exits, evidence keys, and record shapes are pinned here and may not be rebound.
- [GAP-4 — platform-conditional permission fixture] The `state.permission.denied` fixture uses a real POSIX mode violation and the existing win32 ACL branch, following `tests/behaviour/state-permissions.test.ts`; the exit/identity assertion is platform-independent.
- [GAP-5 — change-spec table binding] AC-V8 binds the documented C-4 table in this change spec. If the change folder is later archived or the spec moves, the structure test fails closed and must be re-pointed deliberately; the phase-7 current-truth feature doc is reconciled separately and is not a second silent oracle.

## 2. References

- **Change specification**: [chg-GH-177-spec.md](./chg-GH-177-spec.md) — AC-V1..AC-V14, C-1..C-8, DEC-1..DEC-11, NFR-1..NFR-7, QA Strategy, C-4/C-5/C-6 tables, C-8 error identities, revision log v1.0.
- **Decision record**: [TDR-0005 — Delivery result enum and CLI exit taxonomy](../../../decisions/TDR-0005-delivery-result-enum-and-cli-exit-taxonomy.md) — token parity, `state-unverified` → `platform-provider` → exit `2`, broken invocations → exit `1`, single enum home.
- **Testing strategy**: [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) — `bun:test`, `tests/{structure,behaviour,checks,boundaries}`, `scripts/checks/*.ts` mutation tests, `pnpm check`.
- **TypeScript rules**: [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md) — strict typing, purity, runtime-API confinement, no ambient reads.
- **Result contract**: [feature-result-contract.md](../../../spec/features/feature-result-contract.md) — envelope shape, documented error table, classification chain, `{0,1,2}` projection, bidirectional sync.
- **pm-notes lint and phase transitions**: [feature-pm-notes-lint-and-phase-transitions.md](../../../spec/features/feature-pm-notes-lint-and-phase-transitions.md) — schema, variant sets, lint identities, `phase.transition` records, fold semantics, write-time ledger authority.
- **State layer**: [feature-state-layer.md](../../../spec/features/feature-state-layer.md) — verified reads, torn/schema/key-set evidence, verified-empty, no write on read.
- **Architecture**: [ADR-0003 — OSS Monorepo Structure](../../../decisions/ADR-0003-oss-monorepo-structure.md) — package tiers, runtime-API allowlist.
- **Bash-era reference**: `scripts/deliver-ticket.sh` — usage `result=<…>` enum, `print_delivery_summary`, `classify_result`, `classify_artifact`, exit-code block.
- **Existing mechanisms**: `tests/behaviour/pm-notes-lint-command-support.ts` (in-process `runCli` harness pattern); `tests/behaviour/pm-notes-lint-rejections.test.ts` (canary/control pattern); `tests/behaviour/phase-support.ts`; `tests/behaviour/state-permissions.test.ts` (POSIX/ACL permission trigger); `tests/fixtures/state/harness.ts`; `tests/structure/pm-notes-imports.test.ts` (tier detectors); `tests/structure/content-inventory.test.ts` and `tests/structure/inventory.json`; `tests/structure/error-table.test.ts`; `tests/checks/error-table-sync.test.ts`; `tests/structure/result-contract.test.ts`; `packages/testkit/src/result-conformance.ts` (`assertEnvelopeContract`); `tests/boundaries/**`; `scripts/checks/{error-table-sync,ambient-globals,forbidden-literals,exit-code-literals,workspace-entrypoints}.ts`.
- **Ticket**: GH-177 — M0-S8: verify change and exit taxonomy.

## 3. Coverage Overview

### 3.1 Functional Coverage (AC-#, C-#)

| AC ID | Criterion (abbreviated) | TC ID(s) | Status |
|-------|--------------------------|----------|--------|
| AC-V1 | An incomplete full ledger names every missing phase, exits 1, carries `verify.ledger.incomplete`, and emits no `data` | TC-VERIFY-001, TC-VERIFY-012, TC-VERIFY-013 | Covered |
| AC-V2 | An incomplete LITE ledger names only LITE phases; the complete LITE control (five non-LITE phases null/absent) is `finished` exit 0 | TC-VERIFY-003, TC-VERIFY-013 | Covered |
| AC-V3 | Every malformed class is classified with exactly one pinned `lint.*` identity, exit 1, no crash, no `fallback.internal` | TC-VERIFY-004, TC-VERIFY-007 | Covered |
| AC-V4 | An unknown variant is `lint.variant.unknown`, exit 1, `result=failed; variant=unknown; missing=-`, no registry read | TC-VERIFY-008, TC-VERIFY-012 | Covered |
| AC-V5 | A missing target is `lint.target.missing`, exit 1, `result=failed; variant=unknown; missing=-`, no registry read | TC-VERIFY-009, TC-VERIFY-012 | Covered |
| AC-V6 | A complete full ledger is `finished` exit 0 with the exact success `data` key set and ordered arrays; an absent per-change record is no evidence | TC-VERIFY-002, TC-VERIFY-005 | Covered |
| AC-V7 | Registry torn/schema/corrupt-payload failures exit 2 with `state.*` and `state-unverified`; permission denial exits 1 with `failed`; never success | TC-VERIFY-010, TC-VERIFY-012 | Covered |
| AC-V8 | The eleven-token enum and total taxonomy equal the bash usage enum (set and order), have one valid row each, and match the spec table; the reachable subset is exactly four | TC-VERIFY-016, TC-VERIFY-017, TC-VERIFY-018 | Covered |
| AC-V9 | Every non-verified outcome is non-zero and error-only; only a fully verified `finished` outcome exits 0; the matrix covers every pinned reachable identity | TC-VERIFY-012 (with every negative TC as a contributing fixture) | Covered |
| AC-V10 | Verify writes zero bytes, acquires no fence, makes no network/spawn call, and replays identically over identical facts | TC-VERIFY-014, TC-VERIFY-015, TC-VERIFY-021 | Covered |
| AC-V11 | GH-179 is `finished` exit 0; GH-170 is `partial` exit 1 naming `test_planning,delivery_planning`; GH-171 is `lint.notes.malformed` exit 1 | TC-VERIFY-006 | Covered |
| AC-V12 | Registry evidence overrides a stale declaration per phase; declaration is the fallback; an absent per-change record is no evidence; the projection is not evidence | TC-VERIFY-004, TC-VERIFY-005 | Covered |
| AC-V13 | The `partial` summary is exactly the three-segment `result=partial; variant=…; missing=…` form with the effective variant and the ordered ids; success carries `missingPhases: []` and ordered phases; declaration key order does not matter | TC-VERIFY-013 | Covered |
| AC-V14 | Handler grammar → `input.value.rejected`; parser grammar → `fallback.invocation`; both exit 1, error-only, no reads; a well-formed invocation is unaffected | TC-VERIFY-011, TC-VERIFY-012 | Covered |

**Capability coverage** (no capability left unlinked): C-1 → TC-VERIFY-002, TC-VERIFY-009, TC-VERIFY-011, TC-VERIFY-020; C-2 → TC-VERIFY-001, TC-VERIFY-003, TC-VERIFY-013; C-3 → TC-VERIFY-002, TC-VERIFY-004, TC-VERIFY-005, TC-VERIFY-006, TC-VERIFY-010, TC-VERIFY-014; C-4 → TC-VERIFY-016, TC-VERIFY-017, TC-VERIFY-018; C-5 → TC-VERIFY-012, TC-VERIFY-017; C-6 → TC-VERIFY-001, TC-VERIFY-003, TC-VERIFY-012, TC-VERIFY-013; C-7 → TC-VERIFY-004, TC-VERIFY-007, TC-VERIFY-008, TC-VERIFY-009; C-8 → TC-VERIFY-010, TC-VERIFY-019.

**TC → AC traceability**: every scenario's `Related IDs` line and the Scenario Index (§5.1) carry the reverse direction; the table above carries the forward direction. All fourteen ACs are covered; there is no deferred case and no uncovered AC.

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

The specification declares no `API-#`, `EVT-#`, or `DM-#` identifiers and no REST/HTTP endpoints or events. The interface surface is the eight capabilities; each is mapped to TCs below.

| Interface / capability | Description | TC ID(s) | Status |
|------------------------|-------------|----------|--------|
| C-1 — command surface | `verify change <ref>`; parser and handler grammar; read order; `--json`; no command flags | TC-VERIFY-002, TC-VERIFY-009, TC-VERIFY-011, TC-VERIFY-020 | Covered |
| C-2 — variant-aware required sets | Effective variant and required set from pinned contracts data; full/LITE order; unknown/invalid variant | TC-VERIFY-001, TC-VERIFY-003, TC-VERIFY-008, TC-VERIFY-013 | Covered |
| C-3 — evidence merge | Declaration fallback; per-phase registry override; presence-tolerant read; projection not evidence | TC-VERIFY-002, TC-VERIFY-004, TC-VERIFY-005, TC-VERIFY-006, TC-VERIFY-010, TC-VERIFY-014 | Covered |
| C-4 — result enum | Eleven tokens and per-token taxonomy as contracts data; reserved/reachable split | TC-VERIFY-016, TC-VERIFY-017, TC-VERIFY-018 | Covered |
| C-5 — exit taxonomy | Projection class per token; `{0,1,2}`; `state-unverified` → 2; broken invocations → 1 | TC-VERIFY-012, TC-VERIFY-017 | Covered |
| C-6 — summary contract | Deterministic `result=…; variant=…; missing=…[; detail=…]`; success structured tuple | TC-VERIFY-001, TC-VERIFY-003, TC-VERIFY-012, TC-VERIFY-013 | Covered |
| C-7 — malformed notes never crash | Fixed rule order; reused `lint.*` identities; absence-vs-incompleteness precedence | TC-VERIFY-004, TC-VERIFY-007, TC-VERIFY-008, TC-VERIFY-009 | Covered |
| C-8 — error identities | One additive `verify` kind/row; reused `lint.*`/`state.*`/`input` identities; table totality | TC-VERIFY-010, TC-VERIFY-019 | Covered |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement | TC ID(s) | Status |
|--------|-------------|----------|--------|
| NFR-1 | Runtime neutrality and tier conformance: 0 behavior/I/O in contracts, 0 foreign domain imports, 0 new runtime-API locations, 0 runtime-conditional branches in contracts/domain; all boundary, ambient, and dependency-cruiser gates green | TC-VERIFY-020, TC-VERIFY-021 | Covered |
| NFR-2 | Machine-output validity: 100% one valid envelope under `--json`; 0 exits outside `{0,1,2}`; 0 user-category failures not projecting to 1; 0 platform-category failures not projecting to 2 | TC-VERIFY-010, TC-VERIFY-011, TC-VERIFY-012 | Covered |
| NFR-3 | Non-zero guarantee: 0 exit-0 outcomes for incomplete/malformed/missing-target/unverifiable fixtures; 0 failure envelopes carrying `data`; 0 documented classes contained as `fallback.internal` | TC-VERIFY-001, TC-VERIFY-004, TC-VERIFY-007, TC-VERIFY-008, TC-VERIFY-009, TC-VERIFY-010, TC-VERIFY-012 | Covered |
| NFR-4 | Determinism and read-only: 0 verdict/summary drift across replays; 0 bytes written; 0 fences; 0 network calls; 0 child processes | TC-VERIFY-013, TC-VERIFY-014, TC-VERIFY-015 | Covered |
| NFR-5 | Taxonomy binding: 11/11 tokens equal the bash usage enum (set and order); 11/11 tokens with exactly one taxonomy row; 0 invalid projection classes; 0 reachable-subset drift | TC-VERIFY-016, TC-VERIFY-017, TC-VERIFY-018 | Covered |
| NFR-6 | Error-table binding: 1/1 new `verify` row round-trips with its documented row; 0 two-way drift; 0 existing rows modified; 0 ambiguous kind-only `verify` selections | TC-VERIFY-019, TC-VERIFY-012 | Covered |
| NFR-7 | Real-corpus correctness: 0 crashes or unclassified fallbacks over the pinned GH-179/GH-170/GH-171 fixtures; 0 incorrect tokens | TC-VERIFY-006 | Covered |

## 4. Test Types and Layers

| Layer | Runner / invocation | Location | Covers |
|-------|--------------------|----------|--------|
| Behaviour — classification | `bun test tests/behaviour/verify-change-classification.test.ts` | `tests/behaviour/verify-change-classification.test.ts`, `tests/behaviour/verify-support.ts`, `tests/fixtures/verify/classification/**` | TC-VERIFY-001, TC-VERIFY-002, TC-VERIFY-003, TC-VERIFY-004, TC-VERIFY-005 |
| Behaviour — rejections | `bun test tests/behaviour/verify-change-rejections.test.ts` | `tests/behaviour/verify-change-rejections.test.ts`, `tests/fixtures/verify/malformed/**`, `tests/fixtures/verify/target/**`, `tests/fixtures/verify/grammar/**` | TC-VERIFY-007, TC-VERIFY-008, TC-VERIFY-009, TC-VERIFY-011 |
| Behaviour — evidence failure | `bun test tests/behaviour/verify-change-state.test.ts` | `tests/behaviour/verify-change-state.test.ts`, reusing `tests/fixtures/state/harness.ts` | TC-VERIFY-010 |
| Behaviour — envelope and determinism | `bun test tests/behaviour/verify-envelope.test.ts` | `tests/behaviour/verify-envelope.test.ts`, `tests/golden/helpers.ts` | TC-VERIFY-012, TC-VERIFY-013, TC-VERIFY-014, TC-VERIFY-015 |
| Behaviour — real corpus | `bun test tests/behaviour/verify-corpus.test.ts` | `tests/behaviour/verify-corpus.test.ts`, committed `doc/changes/**` files read in place | TC-VERIFY-006 |
| Structure — enum/taxonomy | `bun test tests/structure/delivery-result-contract.test.ts` | `tests/structure/delivery-result-contract.test.ts` | TC-VERIFY-016, TC-VERIFY-017, TC-VERIFY-018 |
| Structure — tier/imports/inventory | `bun test tests/structure/verify-imports.test.ts`; `bun test tests/structure/content-inventory.test.ts`; `bun test tests/structure/error-table.test.ts` | `tests/structure/verify-imports.test.ts` (new), existing detectors, `tests/structure/inventory.json` | TC-VERIFY-020 |
| Checks — error table | `bun run scripts/checks/error-table-sync.ts`; `bun test tests/checks/error-table-sync.test.ts` | existing check plus extended mutation suite | TC-VERIFY-019 |
| Boundaries / ambient / literals | `bun test tests/boundaries`; `bun run scripts/checks/{ambient-globals,forbidden-literals,exit-code-literals,workspace-entrypoints}.ts` | existing harnesses and checks; no new rule | TC-VERIFY-021 |
| Aggregate and non-regression | `pnpm check`; `git diff --check`; `git status --porcelain` | repo root | all TCs |

### 4.1 In-Process Command-Harness Contract (binding for every verify behaviour TC)

1. **One harness, no spawned processes.** Every behaviour test builds the `verify` command definition with injected dependencies (`brand`, `clock`, `newRunId`, `secrets`, `program`) and calls `runCli(argv, streams, deps)` in process, following `tests/behaviour/pm-notes-lint-command-support.ts`. No child process is spawned by any verify suite.
2. **Injected reads and time.** The pm-notes changes directory, the state store, the clock ticks, the run id, the brand, and the output streams are injected. No test reads `$HOME`, the wall clock, the real state directory, or an ambient environment where purity is asserted.
3. **Self-materializing fixtures.** Synthetic fixtures are created under a fresh `mkdtemp` root (or are committed under `tests/fixtures/verify/**`); no test depends on a gitignored scratch directory. Corpus fixtures read committed files read-only.
4. **One assertion oracle per rejection class.** Every negative fixture asserts exactly one pinned identity, the exact exit, an error-only envelope, and the absence of `data`, exit `0`, the wrong sibling identity, and `fallback.internal`. A second matching identity, a generic error, or a success envelope fails the cell.
5. **Recording seams.** The runtime wraps `readPmNotes` and `readRegistry` with call recorders; the state store is wrapped to record `read` and to throw if `acquireFence`, `append`, `replaceDocument`, or `releaseFence` is called. The recorder is proven live by a positive control that performs a read (and, for the write detectors, by a mutating `phase` invocation that must record writes).
6. **Fixed output facts.** Where byte equality is asserted, the harness injects a fixed `runId` (for example `run-verify-fixture`) and a fixed two-tick clock so the envelope is comparable byte-for-byte.

### 4.2 Non-Vacuity Contract (binding for every negative, overlay, and read-only scenario)

- Every malformed fixture carries a distinctive `planted-payload-verify-*` canary that must not appear in stdout, stderr, the summary, or evidence; the fixture builder asserts the intended mutation/omission is present before verify runs.
- Every negative is paired with a restored-or-valid control that passes through the same invocation path (for example, the phase restored to a timestamp yields `finished`).
- Every overlay fixture has a directional control: the declaration-only reading and the registry-required reading both produce a different answer than the specified one, so a one-sided implementation is caught.
- Every read-only assertion is paired with a seeded-write control that the digest/recorder check detects; a recorder that never observes a read is itself a failure.
- Every structure/enum mutation runs on an in-memory mutated value or a temp copy; the live tree is never written, and the unmutated control is always green in the same test.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Impact | Priority | AC / NFR |
|-------|-------|------|--------|----------|----------|
| TC-VERIFY-001 | Full variant incomplete ledger names each missing phase | Negative | Critical | High | AC-V1 |
| TC-VERIFY-002 | Complete full ledger is a verified success | Happy Path | Critical | High | AC-V6 |
| TC-VERIFY-003 | LITE variant: required six, never the other five | Happy Path | Critical | High | AC-V2 |
| TC-VERIFY-004 | Partial identity split: declared-incomplete vs absent | Corner Case | Critical | High | AC-V3, AC-V12 |
| TC-VERIFY-005 | Overlay precedence and presence-tolerant registry evidence | Corner Case | Critical | High | AC-V6, AC-V12 |
| TC-VERIFY-006 | Real committed changes classify correctly | Regression | Critical | High | AC-V11, NFR-7 |
| TC-VERIFY-007 | Malformed pm-notes classes, one pinned identity each | Negative | Critical | High | AC-V3 |
| TC-VERIFY-008 | Unknown variant classified before any registry read | Negative | Critical | High | AC-V4 |
| TC-VERIFY-009 | Missing target classified before any registry read | Negative | Critical | High | AC-V5 |
| TC-VERIFY-010 | Registry failures are classified, never success | Negative | Critical | High | AC-V7 |
| TC-VERIFY-011 | Verify grammar fails before any read | Negative | Critical | High | AC-V14 |
| TC-VERIFY-012 | Envelope and exit matrix: every non-verified outcome is non-zero | Regression | Critical | High | AC-V9, NFR-2, NFR-3 |
| TC-VERIFY-013 | Summary grammar and machine-consumable tuple | Regression | Critical | High | AC-V13, NFR-4 |
| TC-VERIFY-014 | Verify is read-only, network-free, and spawn-free | Regression | Critical | High | AC-V10, NFR-4 |
| TC-VERIFY-015 | Determinism and replay equality | Regression | Critical | High | AC-V10, NFR-4 |
| TC-VERIFY-016 | Bash usage enum binding | Regression | Critical | High | AC-V8, NFR-5 |
| TC-VERIFY-017 | Taxonomy totality, classes, and reachable subset | Regression | Critical | High | AC-V8, NFR-5 |
| TC-VERIFY-018 | Spec documented taxonomy table matches the data | Regression | Important | High | AC-V8, NFR-5 |
| TC-VERIFY-019 | Error-table binding for the new verify kind and row | Regression | Critical | High | NFR-6 |
| TC-VERIFY-020 | Tier, purity, single-home, and inventory invariants | Regression | Critical | High | NFR-1 |
| TC-VERIFY-021 | Boundary, ambient, exit-code, and entrypoint gates | Regression | Critical | High | NFR-1, NFR-2 |

All twenty-one TCs are automated. Every TC is non-vacuous: controls and seeded violations are named in §4.2 and in each scenario.

### 5.2 Scenario Details

#### TC-VERIFY-001 - Full variant incomplete ledger names each missing phase

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: C-2, C-4 (`partial`), C-6, AC-V1, NFR-3, NFR-5
**Test Type(s)**: Unit, Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-change-classification.test.ts`, `tests/fixtures/verify/classification/full/**`
**Tags**: @backend

**Preconditions**:

- A full base fixture: `variant` absent, all eleven canonical phase entries present, every `completed` a non-null timestamp, `started` also present.
- Eleven derived fixtures: exactly one required phase's `completed` is `null` (its entry remains present, with a non-null `started`); the other ten stay completed. No required key is removed.
- A multi-missing fixture: `test_planning`, `dor_check`, and `quality_gates` are `null`, with all keys present.
- A verified-empty / absent registry (no per-change record).
- A distinctive canary in an opaque extra key; the builder asserts the intended `completed: null` mutation is present.
- The in-process harness with fixed `runId` and clock.

**Steps**:

1. For each of the eleven single-missing fixtures run `--json verify change GH-177`.
2. Assert exit `1`; stdout contains exactly one envelope; `assertEnvelopeContract` returns `[]`; `data` is absent; `error.code` is exactly `verify.ledger.incomplete` with envelope fields `category: user`, `retryable: false`, `consequence: not_landed`, and the `ERROR_TABLE` row's `projectionClass: user-validation` (the projection class is table metadata, not an envelope key).
3. Assert `error.summary` is exactly `result=partial; variant=full; missing=dor_check` for the `dor_check` fixture (and the analogous single id for each other fixture): three segments, no `detail`, no space after a comma, no trailing comma.
4. Run the multi-missing fixture and assert `missing=test_planning,dor_check,quality_gates` in canonical required-set order, independent of the fixture's key insertion order.
5. Negative controls: for every fixture assert the code is not `lint.phases.incomplete` (all keys are present), not `state.keys.missing`, not `fallback.internal`; assert exit is not `0`; assert `data` is absent; assert the canary never appears in stdout or stderr.
6. Positive controls: the complete full fixture and each restored fixture classify `finished` with exit `0` and `missingPhases: []`.

**Expected Outcome**:

- Every declared-but-not-completed required phase produces exactly one `verify.ledger.incomplete` failure envelope, exit `1`, with the exact three-segment summary in canonical order; no key-set or state error is substituted; complete and restored controls pass.

**Notes / Clarifications**:

- This TC covers the declared-incomplete class only. Absent phase keys and absence precedence are TC-VERIFY-004 and TC-VERIFY-005.

#### TC-VERIFY-002 - Complete full ledger is a verified success

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: C-1, C-3, C-4 (`finished`), C-6, AC-V6, NFR-2, NFR-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-change-classification.test.ts`, `tests/fixtures/verify/classification/full-complete.yaml`
**Tags**: @backend

**Preconditions**:

- A full complete fixture: `variant` absent, all eleven phases present and completed, one opaque extra phase key and one opaque extra entry key present.
- Three injected registry states: (a) no store at all; (b) a verified-empty store; (c) a verified store containing records only for a different ref (`GH-999`, including a `delivery` transition), with no per-change record for the verified ref.
- Fixed `runId` and two-tick clock; `assertEnvelopeContract`.

**Steps**:

1. Run each registry state with `--json verify change GH-177`.
2. Assert exit `0`, exactly one success envelope, no `error` key, and `assertEnvelopeContract` empty.
3. Assert the top-level envelope key set is exactly `{schemaVersion, runId, exitCode, timing, data}`.
4. Assert the exact `data` key set is `{changeRef, target, result, variant, requiredPhases, completedPhases, missingPhases, evidence}`; assert `changeRef` is the ref, `target` is `"change"`, `result` is `"finished"`, `variant` is `"full"`.
5. Assert `requiredPhases` is the eleven canonical ids in canonical order (not alphabetical, not object insertion order) and `completedPhases` is the same ordered list; `missingPhases` is exactly `[]`.
6. Assert `evidence` has exactly `{declaration, registry}`; `declaration` has exactly `{completedCount, requiredCount}` with `11` and `11`; `registry` has exactly `{present, verifiedEmpty, recordCount, transitionCount, overlaidPhases}` with `present: false`, `transitionCount: 0`, `overlaidPhases: []`, `verifiedEmpty` true for (a)/(b) and false for (c), and `recordCount` a non-negative integer (see OQ-T2 for its delivery-bound semantic).
7. Negative controls: assert (c) never emits `state.keys.missing` and never reports `verifiedEmpty: true`; assert the success is not produced by ignoring the registry (the recorder observes the registry read in all three cases).
8. Determinism control: with the fixed run id and clock, run (a) twice and assert byte-identical stdout.

**Expected Outcome**:

- A complete full ledger yields exactly one success envelope, exit `0`, with the pinned `data` shape and ordered arrays; an absent per-change record, an empty store, and an other-ref-only store are all no evidence rather than `state.keys.missing`.

**Notes / Clarifications**:

- The spec's C-6 fixes the key set; OQ-T2 records the one non-key semantic (`recordCount`).

#### TC-VERIFY-003 - LITE variant: required six, never the other five

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: C-2, C-4 (`partial`/`finished`), AC-V2, NFR-3, NFR-5
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-change-classification.test.ts`, `tests/fixtures/verify/classification/lite/**`
**Tags**: @backend

**Preconditions**:

- A LITE base fixture: `variant: lite`, all six LITE required entries (`clarify_scope`, `specification`, `delivery`, `quality_gates`, `dod_check`, `pr_creation`) present and completed; the five non-LITE canonical entries absent.
- A LITE control with the five non-LITE entries present with `completed: null` (or absent).
- Six derived fixtures: exactly one LITE required phase's `completed` is `null`, the other five completed.
- A LITE fixture whose non-LITE entries carry wrong-typed `completed` values (for example `true`) and a non-canonical phase key carrying a sequence.
- A full-variant fixture missing `dor_check` as a variant-gating control.
- A verified-empty / absent registry.

**Steps**:

1. For each of the six LITE omissions run verify; assert exit `1`, exactly `verify.ledger.incomplete`, a valid error-only envelope, and `missing=quality_gates` for the `quality_gates` fixture (and the analogous single id for each other fixture) with exactly one id.
2. Assert the summary is exactly `result=partial; variant=lite; missing=quality_gates` for the `quality_gates` fixture (and the analogous single id for each other fixture) and does not contain `test_planning`, `delivery_planning`, `dor_check`, `system_spec_update`, or `review_fix`.
3. Run the complete LITE controls (non-LITE phases `null` and absent); assert exit `0`, `result: "finished"`, `variant: "lite"`, `requiredPhases` equal to the six LITE ids in canonical relative order, `completedPhases` equal to the same order, and `missingPhases: []`.
4. Run the wrong-typed non-LITE / opaque-extra fixture; assert it still classifies `finished` exit `0` (non-required phases are neither validated nor reported).
5. Negative controls: assert no LITE omission is reported as `lint.phases.incomplete` (entries are present) and no non-LITE phase appears in `missing`; assert the full-variant `dor_check` control does name `dor_check`, proving the relaxation is variant-gated.
6. Restore each omitted phase and assert `finished` exit `0` (control).

**Expected Outcome**:

- Each LITE required phase is independently enforced; the five non-LITE phases are never required, named, or validated; complete LITE controls finish with exit `0`; the full variant still enforces `dor_check`.

#### TC-VERIFY-004 - Partial identity split: declared-incomplete vs absent

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: C-6, C-7, AC-V3, AC-V12, NFR-3
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-change-classification.test.ts`, `tests/fixtures/verify/classification/partial-identities/**`
**Tags**: @backend

**Preconditions**:

- Fixture A: all eleven keys present, `dor_check.completed: null`, others completed.
- Fixture B: `dor_check` key absent, all other ten keys present and completed, registry has no evidence.
- Fixture C: `dor_check` key absent and `quality_gates.completed: null`, other nine completed, registry has no evidence.
- Restored controls: B with `dor_check: {started: "2026-10-31T00:00:00Z", completed: null}`; C with both completed.

**Steps**:

1. Run A; assert `verify.ledger.incomplete`, exit `1`, and `result=partial; variant=full; missing=dor_check`.
2. Run B; assert `lint.phases.incomplete` (not `verify.ledger.incomplete`), exit `1`, and `result=partial; variant=full; missing=dor_check`.
3. Run C; assert `lint.phases.incomplete` (absence precedence), exit `1`, and `missing=dor_check,quality_gates` in required-set order (the missing set is the verdict's full set, not only the absent subset).
4. Assert none of A/B/C returns `lint.keys.missing` or `state.keys.missing`; a required phase that is absent after the overlay is a `partial` verdict, not a key-set failure.
5. Controls: the restored B fixture (key present, completion null) yields `verify.ledger.incomplete`; the fully completed C fixture yields `finished` exit `0`.
6. Negative control: a fixture with a deliberately missing non-required opaque key does not change any of the above (proves only required phases participate).

**Expected Outcome**:

- The two `partial` identities are distinct and pinned: declared-but-incomplete → `verify.ledger.incomplete`; still-absent → `lint.phases.incomplete`; mixed cases use absence precedence and name every missing required phase; neither is `keys.missing`.

#### TC-VERIFY-005 - Overlay precedence and presence-tolerant registry evidence

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: C-3, C-4, DEC-4, DEC-10, AC-V6, AC-V12, NFR-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-change-classification.test.ts`, `tests/fixtures/state/harness.ts`
**Tags**: @backend

**Preconditions**:

- Overlay fixtures whose registry history is built with the real `appendPhaseTransition` (verified records, not hand-written payloads), using a temp state root:
  - O1: declaration `delivery.completed: "2026-10-31T00:00:00Z"`; registry history for `delivery` is `complete` then `reopen` (so the fold has an entry and the latest operation is `reopen`); all other ten completed; no other registry mentions. Expected `partial`, `verify.ledger.incomplete`, `missing=delivery`.
  - O2: declaration `delivery.completed: null`; registry latest `complete`; other ten completed. Expected `finished`; `overlaidPhases` contains `delivery`.
  - O3: declaration `review_fix` key absent; registry latest `complete`; other ten completed. Expected `finished`; `overlaidPhases` contains `review_fix`.
  - O4: declaration `quality_gates.completed: "2026-10-31T00:00:00Z"`; registry latest `complete` (match). Expected `finished`; `overlaidPhases` contains `quality_gates`.
  - O5: declaration `dor_check.completed: null`; registry history `complete` then `reopen` (agrees open). Expected `partial`, `missing=dor_check`.
- Presence fixtures:
  - O6: verified store with only another ref's records, declaration full complete. Expected `finished`, `present: false`, no `state.keys.missing`.
  - O7: verified store with only another ref's records, declaration `dor_check` null. Expected `partial`, `missing=dor_check`, no `state.keys.missing`.
  - O8: verified non-empty store with no per-change record, declaration `dor_check` null. Expected `partial`, no `state.keys.missing`.
  - O9: no store at all; complete and incomplete declarations decide as usual.
- Projection fixtures:
  - P1: the derived `phase-state.<REF>.json` projection says all eleven completed while the ledger history for `delivery` is `complete` then `reopen` and the declaration says completed. Expected `partial`, `missing=delivery`.
  - P2: the store contains only a projection document (all completed) and no transition records; declaration `dor_check` null. Expected `partial`, not `finished`.
- Recording runtime that observes the registry read.

**Steps**:

1. Run O1..O5 and assert token, identity, exit, and missing set exactly as above.
2. For O2/O3/O4 assert `overlaidPhases` as a set equals the expected registry-decided required phases (order is OQ-T3); for O1/O5 assert the registry-decided phase is named missing.
3. For O3 assert lint's required-phase-absence finding is non-terminal: the run succeeds even though the declaration lacks the key.
4. Run O6..O9 and assert `state.keys.missing` is never emitted; for successes assert `present: false`.
5. Run P1 and P2 and assert the verdict is exactly `partial` with the declaration/ledger-derived missing set; run the same fixtures with the projection absent or corrupt and assert an identical verdict (no `state.*` failure from the projection).
6. Negative controls: a declaration-only implementation would answer `finished` for O1 and `partial` for O2/O3; a registry-required implementation would answer `state.keys.missing` for O6/O8; a projection-reading implementation would answer `finished` for P1/P2. The suite asserts the specified middle answer for each.
7. Assert the recorder observed the registry read on every overlay fixture, so the absence of evidence is not passing by skipping.

**Expected Outcome**:

- Registry evidence overrides the declaration per mentioned phase in both directions; absent evidence is never negative evidence; the projection is never evidence; the declaration fallback keeps declaration-only changes correct.

**Notes / Clarifications**:

- O4 is the declaration-match control required by AC-V12's DoD predicate.

#### TC-VERIFY-006 - Real committed changes classify correctly

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: C-2, C-3, C-4 (`finished`/`partial`), C-7, AC-V11, NFR-7
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-corpus.test.ts`, committed files read in place
**Tags**: @backend @golden

**Preconditions**:

- The exact committed fixtures, read in place and read-only:
  - GH-179: `doc/changes/2026-10/2026-10-31--GH-179--pm-notes-registry-lint-phase-transitions/chg-GH-179-pm-notes.yaml` — no `variant`, all eleven canonical phases completed, no per-change registry record. Expected `finished`, exit `0`.
  - GH-170: `doc/changes/2026-10/2026-10-29--GH-170--monorepo-scaffold-toolchain/chg-GH-170-pm-notes.yaml` — full, `test_planning` and `delivery_planning` completed `null`, opaque non-canonical keys (`dor_iterations`, `review_iterations`, `quality_gate_iterations`, `dod_findings`). Expected `partial`, exit `1`, `verify.ledger.incomplete`, `missing=test_planning,delivery_planning`.
  - GH-171: `doc/changes/2026-10/2026-10-29--GH-171--branding-seam-working-name/chg-GH-171-pm-notes.yaml` — unparseable. Expected `lint.notes.malformed`, exit `1`.
- A fresh temp state root injected for each run, so the real local state is never read; the corpus tests never write the change tree.
- Fixed `runId` and clock; `assertEnvelopeContract`.

**Steps**:

1. Before running, assert each fixture's precondition from its committed bytes: GH-179 parses with no `variant` and all eleven completions; GH-170 parses with exactly the two `null` completions and the opaque keys; GH-171 fails to parse. Record a digest of each file.
2. Run verify against a changes directory rooted at the repository with an injected empty registry.
3. Assert GH-179 exit `0`, `finished`, ordered `requiredPhases`/`completedPhases`, `missingPhases: []`; assert no `state.keys.missing` and no registry-required failure.
4. Assert GH-170 exit `1`, `verify.ledger.incomplete`, `missing=test_planning,delivery_planning`; assert no opaque non-canonical key appears in the missing list or causes a conformance failure.
5. Assert GH-171 exit `1`, `lint.notes.malformed`; assert no crash, no stack trace, and no raw parser bytes.
6. Assert all three envelopes pass `assertEnvelopeContract`; assert none returns `fallback.internal`; assert GH-179 proves the declaration fallback.
7. Assert the digests are unchanged after the runs and `git status --porcelain` is unchanged for the live tree.
8. Mutation controls in temp copies only: make GH-179's `delivery.completed: null` → `partial`; repair GH-171's indentation so it parses → no longer `lint.notes.malformed`. These prove the corpus assertions are live, not hardcoded.

**Expected Outcome**:

- The three committed changes classify exactly as AC-V11 pins; all three are permanent read-only fixtures; no crash, no `fallback.internal`, no incorrect token; temp-copy controls prove liveness.

#### TC-VERIFY-007 - Malformed pm-notes classes, one pinned identity each

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: C-1, C-7, C-8, AC-V3, NFR-2, NFR-3
**Test Type(s)**: Unit, Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-change-rejections.test.ts`, `tests/fixtures/verify/malformed/**`
**Tags**: @backend

**Preconditions**:

- One fixture per class, each with a `planted-payload-verify-*` canary and a builder assertion that the mutation/omission is present:
  - Unparseable document (orphaned indentation, as in the GH-171 artifact) → `lint.notes.malformed`.
  - Missing required top-level key, one per key: `change_id`, `title`, `delivery_mode`, `phases` → `lint.keys.missing`.
  - Required phase entry missing `started`, and missing `completed` → `lint.keys.missing`.
  - Collection entry missing `text` (for example `notes: [{type: "info"}]`) → `lint.keys.missing`.
  - Wrong-typed declared values: `change_id: 42`, `title: [..]`, `phases: "not-a-map"`, `variant: 1`, `notes: "not-array"` → `lint.notes.malformed`.
  - Non-timestamp typed phase values: `started: 42`, `completed: true` on a required phase → `lint.notes.malformed`.
  - Co-occurrence fixtures for ordering: a missing top-level key (`title`) plus a wrong-typed `change_id`; a missing entry field plus a wrong-typed other field; a wrong-typed value plus an unknown variant; an unknown variant plus an absent phase.
  - A valid full document and a restored version of each malformed fixture as controls.
- A recording runtime.

**Steps**:

1. Run each class with `--json`; assert exit `1`, exactly one error-only envelope, `assertEnvelopeContract` empty, no `data`, and exactly the pinned identity; assert no second code matches.
2. Assert the envelope's `error.category`, `retryable`, and `consequence` match the `ERROR_TABLE` row for the identity, and assert the row's `projectionClass` yields the observed exit.
3. Assert the summary's fixed prefix is `result=failed; variant=unknown; missing=-`; when a single trailing `; detail=` segment is present for `lint.notes.malformed` or `lint.keys.missing`, assert it names the safe location (top-level key, `phases.<id>.<field>`, or `notes[0].text`), collapses newlines, remains one segment, and contains no canary or raw document bytes.
4. Assert no class yields `fallback.internal`, no stack trace on the error stream, and no raw parser output.
5. Assert the fixed order on the co-occurrence fixtures: keys → value types → variant → phase presence; the earlier family's identity wins.
6. Assert zero registry reads for every class (recorded) and zero bytes written to the target or state roots.
7. Controls: the corrected fixture passes (or yields only the legitimate `partial`/`finished` verdict); the valid full document yields no malformed code.

**Expected Outcome**:

- Every documented malformed class resolves to exactly one pinned `lint.*` identity, exit `1`, a valid error-only envelope, no crash, no registry read, and no write; the ordering is total and deterministic.

#### TC-VERIFY-008 - Unknown variant classified before any registry read

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: C-2, C-5 (`failed`), C-7, AC-V4, NFR-3, NFR-6
**Test Type(s)**: Unit, Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-change-rejections.test.ts`, `tests/fixtures/verify/malformed/variant/**`
**Tags**: @backend

**Preconditions**:

- Unknown string variants: `compressed`, `LITE`, `" lite"`, `full-ish`, and the empty string.
- Wrong-typed variants: `1`, `["lite"]`, `{name: lite}` → the value-type class.
- Positive controls: `variant: lite`, `variant: full`, and `variant` absent.
- A recording runtime; a valid target document.

**Steps**:

1. Run each unknown-value fixture; assert exit `1`, exactly `lint.variant.unknown`, a valid error-only envelope, no `data`, and `error.summary` exactly `result=failed; variant=unknown; missing=-` (three segments, no `detail`).
2. Assert zero registry reads (recorded) and zero target writes.
3. Run each wrong-typed fixture and assert `lint.notes.malformed`, never `lint.variant.unknown` (the value-type class and the unknown-value class never cross).
4. Run the positive controls and assert no `lint.variant.unknown`; the `lite` control applies the LITE required set.
5. Assert no `fallback.internal` and no crash/stack trace.

**Expected Outcome**:

- Unknown string variants fail exactly `lint.variant.unknown` with the pinned three-segment summary and no registry read; wrong-typed variants fail the value-type class; valid/absent variants are unaffected.

#### TC-VERIFY-009 - Missing target classified before any registry read

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: C-1, C-5 (`failed`), C-7, AC-V5, NFR-3, NFR-6
**Test Type(s)**: Unit, Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-change-rejections.test.ts`, `tests/fixtures/verify/target/**`
**Tags**: @backend

**Preconditions**:

- A changes directory with no pm-notes for the ref.
- Refs outside the `<PREFIX>-<digits>` shape: `not-a-ref`, `gh-177`, `GH177`.
- A present-target control, a malformed present target, and a recording runtime.

**Steps**:

1. Run the absent-target ref; assert exit `1`, exactly `lint.target.missing`, a valid error-only envelope, no `data`, and `error.summary` exactly `result=failed; variant=unknown; missing=-`.
2. Assert zero registry reads (recorded) and no state-store open; the only read is the target-location read.
3. Run each malformed-shape ref and assert the same `lint.target.missing` (verify adds no separate ref-shape error).
4. Run the present-target control and assert `lint.target.missing` is absent; run the malformed present target and assert its own `lint.*` identity, not `lint.target.missing`.
5. Assert no `fallback.internal` and no crash/stack trace.

**Expected Outcome**:

- A ref with no pm-notes target fails exactly `lint.target.missing` with the pinned summary, no registry read, and no new ref-shape identity; present targets are unaffected.

#### TC-VERIFY-010 - Registry failures are classified, never success

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: C-3, C-4 (`state-unverified`), C-5, C-8, AC-V7, NFR-2, NFR-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-change-state.test.ts`, `tests/fixtures/state/harness.ts`
**Tags**: @backend

**Preconditions**:

- A complete declaration fixture (so a broken registry must override a would-be `finished`).
- Fixtures built with the real state harness over a temp root:
  - Torn ledger: payload byte flip, framing break, and sequence gap, each with a `planted-payload-verify-*` canary.
  - Schema mismatch: unsupported store/record schema version.
  - Corrupt per-change transition payload: missing `transitions`, and a transition missing `operation` or `timestamp` → `state.keys.missing`.
  - Permission denial: a real POSIX mode violation (and the existing win32 ACL branch per `tests/behaviour/state-permissions.test.ts`).
  - A valid store control.
- A wrapping store that records `read` and throws/records on `acquireFence`, `append`, `replaceDocument`, and `releaseFence`.
- `assertEnvelopeContract`.

**Steps**:

1. For each platform fixture run verify; assert exit `2`, exactly the pinned identity (`state.store.torn`, `state.schema.mismatch`, or `state.keys.missing`), a valid error-only envelope, and no `data`.
2. Assert the summary begins with exactly `result=state-unverified; variant=full; missing=-` for the full declaration fixture (and the analogous effective variant for a LITE fixture); if a trailing `; detail=` is present, assert it equals the error-table row summary and contains no canary/newline (see A-T6 on AC-V7 vs C-6 optionality).
3. Run the permission fixture; assert exit `1`, exactly `state.permission.denied`, and the fixed prefix `result=failed; variant=full; missing=-` (or the fixture's effective variant) with the same optional-detail rule.
4. Assert the envelope's `category`, `retryable`, and `consequence` per the table, and assert the exit equals `projectExitCode(entry.projectionClass)` for the identity's table row.
5. Assert the recorder saw `read` and saw zero `acquireFence`, zero `append`, zero `replaceDocument`, zero `releaseFence`, and zero write calls.
6. Assert no success envelope, no `data`, no `fallback.internal`, and no canary in stdout/stderr.
7. Controls: the complete declaration with a valid or empty store yields `finished` exit `0`; a detection-disabled torn fixture exposes the planted canary in the raw bytes, proving the torn fixture is live.
8. Assert a corrupt or absent projection in an otherwise valid store does not produce a `state.*` failure (the projection is not read).

**Expected Outcome**:

- Torn, schema-mismatch, and corrupt-payload failures exit `2` with the specific `state.*` identity and the `state-unverified` token; permission denial exits `1` with `failed`; every failure is error-only and valid; no fence or write call is made; a valid store still finishes.

#### TC-VERIFY-011 - Verify grammar fails before any read

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: C-1, C-5, AC-V14, NFR-2, NFR-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-change-rejections.test.ts`, `tests/fixtures/verify/grammar/**`
**Tags**: @backend

**Preconditions**:

- A valid target and a registry runtime with a call recorder.
- `assertEnvelopeContract`.

**Steps**:

1. Handler-grammar cases: `verify`, `verify change`, `verify other GH-177`, `verify unknown GH-177`; assert exit `1`, exactly `input.value.rejected`, a valid error-only envelope, no `data`, and the summary `result=failed; variant=unknown; missing=-` (no `detail`).
2. Parser-level cases: `verify change GH-177 extra` (extra positional), `verify change GH-177 --verify-gates` (unknown flag), and `verify --verify-gates change GH-177`; assert exit `1`, exactly `fallback.invocation`, a valid error-only envelope, and no `data`.
3. Assert zero `readPmNotes` and zero `readRegistry` calls for every case (recorded), proving no target read and no state read.
4. Assert every case exits `1`, never `0`, and never returns `fallback.internal`.
5. Controls: `verify change GH-177` and `verify change GH-177 --json` (and `--json` before the command) are unaffected; the valid target yields its expected `finished`/`partial` verdict and the recorder observes the reads, proving the zero-read assertions are live.

**Expected Outcome**:

- Handler grammar (`verify`, `verify change`, `verify other <ref>`, `verify unknown <ref>`) fails `input.value.rejected`; parser grammar (extra positional, unknown flag) fails `fallback.invocation`; both exit `1`, are error-only, and perform no reads; valid invocations are unaffected.

**Notes / Clarifications**:

- Parser-level `fallback.invocation` is the existing broken-invocation path and runs before the verify handler; C-6's tuple is asserted only for the handler-grammar cases, while the parser-level cases are asserted for identity, exit, and error-only envelope (A-T6).

#### TC-VERIFY-012 - Envelope and exit matrix: every non-verified outcome is non-zero

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: C-4, C-5, C-6, AC-V9, NFR-2, NFR-3
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-envelope.test.ts`, `tests/golden/helpers.ts` (reuse)
**Tags**: @backend

**Preconditions**:

- A fixture for every verify-reachable identity and both success variants:
  - Success: `finished` full and `finished` LITE.
  - `partial`: `verify.ledger.incomplete` (full and LITE, single and multi-missing) and `lint.phases.incomplete`.
  - `failed`: `lint.notes.malformed`, `lint.keys.missing` (top-level, entry, collection), `lint.variant.unknown`, `lint.target.missing`, `input.value.rejected` (three handler-grammar cases), `fallback.invocation` (two parser cases), and `state.permission.denied`.
  - `state-unverified`: `state.store.torn`, `state.schema.mismatch`, `state.keys.missing`.
- `assertEnvelopeContract`; `projectExitCode`; `ERROR_TABLE`.
- The `state.level.unsupported` row is not fabricated as a verify fixture (GAP-2); its totality is TC-VERIFY-019.

**Steps**:

1. Iterate the matrix with `--json`; assert stdout parses as exactly one envelope and `assertEnvelopeContract` returns `[]` for every cell.
2. Assert the two complete fixtures are the only cells with exit `0`; every other cell exits non-zero and has `error` with no `data`.
3. Assert each cell's exit equals `projectExitCode(entry.projectionClass)` and the AC-pinned digit: `0` only for `finished`; `1` for `partial` and user-category `failed`; `2` for platform-category `state-unverified`.
4. Assert every `error.code` is one of the pinned identities; assert no documented class is contained as `fallback.internal`; assert every cell's exit is in `{0,1,2}`.
5. Assert the C-6 summary grammar for every verify-handled cell: `result=`, `variant=`, `missing=` in that order; `missing=-` for every non-`partial`; the computed comma-separated list for `partial`; no spaces after commas; no newline. Assert `detail` is absent for `partial`, unknown variant, missing target, and handler grammar; when `detail` is present for a `lint.*`/`state.*` failure, assert it is one safe segment (no canary, no newline) and, for `state.*`, equals the row summary. The parser-level `fallback.invocation` cell is exempt from the C-6 tuple because the handler never runs; it is asserted for identity, exit, and error-only envelope only (AC-V14).
6. Assert the matrix is non-vacuous: the set of observed identities equals the expected set (one cell per identity, plus both success variants), and the count of negative cells is greater than the count of success cells.
7. Run human mode for every class; assert the same exits, failure diagnostics on stderr, no stack trace, and no second envelope on stdout.

**Expected Outcome**:

- The matrix is exhaustive over every verify-reachable identity; only a fully verified `finished` outcome exits `0`; every failure is error-only and valid; every exit is the exact projection of its identity's class.

#### TC-VERIFY-013 - Summary grammar and machine-consumable tuple

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: C-6, C-2, AC-V13, NFR-4
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-envelope.test.ts`, `tests/fixtures/verify/classification/**`
**Tags**: @backend

**Preconditions**:

- A full partial fixture with three missing phases: `test_planning`, `delivery_planning`, `dor_check`.
- A LITE partial fixture with `quality_gates` missing.
- Reversed-declaration-key-order twins of each (same entries, reverse insertion order).
- Success fixtures: full complete and LITE complete.
- A test-local oracle that computes the required set and the missing set from the fixture's phase map plus injected registry facts.

**Steps**:

1. Assert the exact full summary: `result=partial; variant=full; missing=test_planning,delivery_planning,dor_check`.
2. Assert the exact LITE summary: `result=partial; variant=lite; missing=quality_gates`.
3. Assert the missing set equals the independent oracle's set; assert the order is the required-set order.
4. Run the reversed-key-order twins and assert the summary and exit are deep-equal to the canonical fixtures; for the success twins assert `data` is deep-equal; with the fixed run id/clock, assert stdout bytes are identical.
5. For the success fixtures assert `missingPhases: []`; `requiredPhases` equals the contract required set in order; `completedPhases` equals the same order; assert the arrays are not alphabetical and not object-insertion order (the reversed fixture proves it).
6. Negative controls: a fixture whose insertion order differs from canonical still emits canonical order; assert the summary has no space after a comma, no trailing comma, and exactly three segments for `partial` (no `detail`).

**Expected Outcome**:

- The summary is exactly the pinned grammar with ids in required-set order; the missing set matches the verdict's computation; declaration key order never changes output; success carries the ordered structured tuple.

#### TC-VERIFY-014 - Verify is read-only, network-free, and spawn-free

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: C-1, C-3, AC-V10, NFR-4
**Test Type(s)**: Contract, Integration, Static
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-envelope.test.ts`, `tests/structure/verify-imports.test.ts`
**Tags**: @backend

**Preconditions**:

- Success, partial, malformed, unknown-variant, missing-target, grammar, and platform/permission state-failure fixtures.
- Recording read seams; a state-store wrapper that throws if `acquireFence`, `append`, `replaceDocument`, or `releaseFence` is called; a write-file seam that throws if called.
- Ambient stubs for environment, clock, and randomness that throw if read.
- Before/after SHA-256 digests of the fixture tree and the temp state root; a `git status --porcelain` snapshot for the live tree.
- AST/import detectors for `node:child_process`, `Bun.spawn`, `spawnSync`, `execFile`, `fetch`, `node:http`, `node:https`, `node:net`, and `undici`.

**Steps**:

1. For each fixture snapshot the digests, run verify, and re-snapshot; assert byte-identical targets and state roots (zero writes, appends, index writes, projection rebuilds).
2. Assert the recorder observed the expected reads and zero `acquireFence`/`append`/`replaceDocument`/`releaseFence`/write calls; the throwing seams prove a write would fail the test.
3. Assert the verifier never consults the derived projection document as evidence: it is not used to decide any phase, and no projection rebuild occurs (cross-ref TC-VERIFY-005 P1/P2).
4. AST/import scan: `contracts/delivery-result.ts`, `domain/verify-change.ts`, `state/registry.ts` (extension), and `commands/verify.ts` import none of the spawn/network modules; no `Bun.spawn`, `fetch`, or child-process call; no `Date.now`, `Math.random`, or `process.env` in contracts/domain.
5. Ambient stubs: the verdict is unchanged and no ambient stub is invoked.
6. Negative controls: run a mutating `phase complete` through the same recorder and assert it records write/fence calls (proves the recorder is live); run a control that writes a cache file and assert the digest check catches it.

**Expected Outcome**:

- Zero bytes written, zero fences, zero appends, zero projection rebuilds, zero network calls, zero child processes; the read-only proof is non-vacuous; the boundary/ambient gates stay green.

#### TC-VERIFY-015 - Determinism and replay equality

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: C-1, C-3, AC-V10, NFR-4
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-envelope.test.ts`
**Tags**: @backend

**Preconditions**:

- One fixture per classification class: `finished`, `partial`, malformed, unknown variant, missing target, handler grammar, parser grammar, `state.store.torn`, `state.permission.denied`.
- Fixed `runId`, fixed two-tick clock, and identical injected registry facts.
- A second run in the same process and a third after a fresh harness root with identical facts.

**Steps**:

1. Run each fixture twice; assert identical exit, stdout bytes, stderr, envelope, result token, variant, missing list, evidence, and `overlaidPhases` set.
2. Run the third time in a fresh harness root with identical facts; assert the same tuple and bytes.
3. Assert the reversed-declaration-key-order fixture produces identical bytes (cross-ref TC-VERIFY-013) and that ordering comes from contract arrays, not map iteration.
4. Assert no clock, randomness, environment, or run-id value changes the verdict (the harness fixes them; changing only the run id changes the envelope `runId`, not the tuple).
5. Negative control: change one input fact (complete a missing phase) and assert the token/summary/exit change; a run that ignored the input would fail this control.

**Expected Outcome**:

- Identical inputs and injected facts produce byte-identical verdicts, summaries, and exits across replays; ordering is contract-driven; a real input change is observable.

#### TC-VERIFY-016 - Bash usage enum binding

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: C-4, AC-V8, NFR-5
**Test Type(s)**: Structure, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/delivery-result-contract.test.ts`
**Tags**: @backend

**Preconditions**:

- `scripts/deliver-ticket.sh` with the usage line `result=<merged|…|noop-lane-nothing-to-do>`.
- `DELIVERY_RESULT_TOKENS` and `DELIVERY_RESULT_TAXONOMY` from the contracts module.
- A test-local extractor anchored on `result=<...>` that reads the live script at test time.
- In-memory mutated script text for controls; a non-existent path for the fail-closed control.

**Steps**:

1. Read the script; extract the `result=<...>` list; assert exactly 11 tokens with no duplicates and non-empty endpoints (`merged` and `noop-lane-nothing-to-do`).
2. Assert `DELIVERY_RESULT_TOKENS` equals the extracted list in set **and** order (11/11, 0 drift).
3. Assert the taxonomy keys equal the token list in the same order.
4. Mutation controls on mutated text: swap two adjacent tokens → a mismatch naming the first divergent position; remove one token → a length/set mismatch; empty text or a script without the usage line → the extractor throws/fails (never returns an empty list, never skips); duplicate a token in a mutated contracts list → uniqueness fails.
5. Fail-closed control: point the reader at a non-existent temp path and assert it fails; the live read is non-empty.
6. The live tree is never written; the unmutated live comparison is green.

**Expected Outcome**:

- The contracts enum equals the bash usage enum exactly in set and order; drift in either direction fails closed; the extractor is non-vacuous and the reference is not silently replaced.

#### TC-VERIFY-017 - Taxonomy totality, classes, and reachable subset

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: C-4, C-5, AC-V8, NFR-5
**Test Type(s)**: Structure, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/delivery-result-contract.test.ts`
**Tags**: @backend

**Preconditions**:

- `DELIVERY_RESULT_TOKENS`, `DELIVERY_RESULT_TAXONOMY`, and `projectExitCode`.
- A pure test-local validator over `(tokens, taxonomy)` so mutation controls can pass mutated in-memory data.
- The pinned projection classes `success | user-validation | platform-provider` and derivation classes `verify | tracker-pr | dispatch-session`.

**Steps**:

1. Assert exactly 11 unique tokens; the taxonomy has exactly one entry per token, no duplicate keys, no missing key, no extra token.
2. Assert every entry declares exactly one projection class from the pinned set and one derivation class from the pinned set; 11/11 rows are valid.
3. Assert the pinned derivation mapping exactly: `verify` → `{finished, partial, failed, state-unverified}`; `tracker-pr` → `{merged, blocked, pr-open, pr-open-unverified}`; `dispatch-session` → `{max-restarts, noop-lane-permission, noop-lane-nothing-to-do}` (assert the declared lists in the spec's order).
4. Assert the M0-S8-reachable subset is exactly the four `verify` tokens; assert the other seven are `tracker-pr`/`dispatch-session` and are never emitted by any verify fixture (cross-ref TC-VERIFY-012).
5. Assert each token's exit from `projectExitCode(projectionClass)` equals the C-5 table: `success` → `0`, `user-validation` → `1`, `platform-provider` → `2`; assert `state-unverified` → `2` (the deliberate DEC-5 divergence) and all other ten match the documented digits.
6. Mutation controls with mutated in-memory data: duplicate a token; delete a token; add a twelfth; set an invalid projection class; move a token between derivation classes; delete a taxonomy row. Each must fail naming the field; the unmutated data is green.

**Expected Outcome**:

- The taxonomy is total and unique over the eleven tokens; every row has one valid projection class and one valid derivation class; the derivation mapping and reachable subset are exact; every exit projects correctly; mutation controls catch drift.

#### TC-VERIFY-018 - Spec documented taxonomy table matches the data

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: C-4, AC-V8, NFR-5
**Test Type(s)**: Structure, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/delivery-result-contract.test.ts`
**Tags**: @backend

**Preconditions**:

- The C-4 table and the "Pinned derivation mapping" paragraph in `doc/changes/2026-10/2026-10-31--GH-177--verify-change-exit-taxonomy/chg-GH-177-spec.md`, read read-only.
- `DELIVERY_RESULT_TOKENS`, `DELIVERY_RESULT_TAXONOMY`, and `projectExitCode`.
- A test-local table comparer over the table text.

**Steps**:

1. Parse the C-4 table rows in order, normalizing backticks and markdown emphasis; assert 11 rows whose tokens equal `DELIVERY_RESULT_TOKENS` in order.
2. For each row assert the `Projection` cell equals the taxonomy projection class and the `Exit` cell's leading integer equals `projectExitCode(projectionClass)` (the `state-unverified` cell carries the documented `2 (see DEC-5)` annotation).
3. Assert the `M0-S8 derivation` cell marks exactly the seven reserved tokens with "Reserved" (case-insensitive, after normalizing emphasis) and the four reachable tokens without it; assert the four reachable rows carry a non-"none" `Identity source` cell and the seven reserved rows carry "none".
4. Parse the "Pinned derivation mapping" paragraph; assert each class's token list equals the taxonomy's derivation class (set and order).
5. Mutation controls: pass mutated table text (wrong projection, swapped exit, reordered rows, a missing row, a twelfth row) to the comparer and assert it fails naming the token/field; the unmutated table is green.
6. Assert the file digest is unchanged after the comparison (read-only).

**Expected Outcome**:

- The documented C-4 table and derivation mapping agree with the contracts data token-for-token and exit-for-exit; drift in either direction is caught.

**Notes / Clarifications**:

- AC-V8 binds "the documented table in this spec"; GAP-5 records the maintenance consequence if the change artifact moves.
- The C-5 exit table's CLI-exit column is the same projection asserted token-by-token in TC-VERIFY-017; TC-VERIFY-018 binds the C-4 taxonomy table and its derivation paragraph.

#### TC-VERIFY-019 - Error-table binding for the new verify kind and row

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: C-8, NFR-6, NFR-2
**Test Type(s)**: Structure, Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts`, `scripts/checks/error-table-sync.ts`
**Tags**: @backend

**Preconditions**:

- `ERROR_TABLE`, `DOMAIN_KINDS`, `resolveAppErrorCode`, `classifyDomainKind`, and `classifyThrown`.
- The documented table in `doc/spec/features/feature-result-contract.md` (updated in the same delivery phase).
- A test-local frozen baseline oracle of every pre-existing row's full column set.
- `runSyncCheck` for temp-copy drift controls.

**Steps**:

1. Assert `DOMAIN_KINDS` includes `verify` and the `verify` kind has exactly one row: `verify.ledger.incomplete`, category `user`, retryable `false`, consequence `not_landed`, projection `user-validation`, and the exact C-8 remediation hint and summary.
2. Assert `resolveAppErrorCode("verify.ledger.incomplete")` and `classifyThrown({kind: "verify", code: "verify.ledger.incomplete"})` return the same row; assert `classifyDomainKind("verify", "verify.ledger.incomplete")` resolves; assert `classifyDomainKind("verify", "lint.notes.malformed")` throws (exact code required, no wrong-kind selection).
3. Assert the documented `verify.ledger.incomplete` row appears exactly once in `feature-result-contract.md` and equals the machine row column-for-column.
4. Run `runSyncCheck` on temp copies for two-way drift: remove the machine row → "documented code verify.ledger.incomplete has no source entry"; remove the doc row → "source entry verify.ledger.incomplete is undocumented"; remove `verify` from `DOMAIN_KINDS` → "undeclared namespace verify"; malformed row → "columns"; duplicated row → "duplicate documented row"; the unchanged copy is green.
5. Assert no pre-existing row changed: the baseline oracle equals the live table for every non-`verify` row; assert the table length is exactly baseline + 1; assert the provider/input/config/state/lint counts are unchanged.
6. Mutation control in a temp copy: change an existing row (for example `state.store.torn`'s projection class) and assert the baseline check fails naming the row; the live tree is unchanged.
7. Assert zero ambiguous kind-only selections: exactly one `verify` row; if `commands/verify.ts` calls `classifyDomainKind`, every call passes an exact code; and every error path from the handler carries an exact `code` (never a bare kind), so the CLI cannot select by kind alone.

**Expected Outcome**:

- The new `verify` kind and row round-trip exactly with the documented table; both drift directions fail; no existing row is modified; the verify path always classifies by exact code.

#### TC-VERIFY-020 - Tier, purity, single-home, and inventory invariants

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-1, AC-V8 (single enum home)
**Test Type(s)**: Structure, Static
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/verify-imports.test.ts` (new), `tests/structure/cli-edge-seam.test.ts`, `tests/structure/content-inventory.test.ts`, `tests/structure/error-table.test.ts`, `tests/structure/state-scope.test.ts`, `tests/structure/inventory.json`
**Tags**: @backend

**Preconditions**:

- New modules: `packages/core/src/contracts/delivery-result.ts`, `packages/core/src/domain/verify-change.ts`, `packages/cli/src/commands/verify.ts`.
- Extended modules: `contracts/error-table.ts`, `contracts/index.ts`, `domain/index.ts`, `core/src/index.ts`, `state/registry.ts`, `commands/index.ts`, `cli/src/edge.ts`.
- The existing AST detectors from `tests/structure/pm-notes-imports.test.ts` and `tests/structure/content-inventory.test.ts`.

**Steps**:

1. Contracts data-only: assert `delivery-result.ts` and the `error-table.ts` extension contain only type aliases, interfaces, import/export declarations, and `as const` data; no function, class, expression statement, `node:`/`bun:` import, or environment/runtime-conditional branch.
2. Single enum home: assert `DELIVERY_RESULT_TOKENS` and `DELIVERY_RESULT_TAXONOMY` are declared only in `delivery-result.ts`; scan `packages/**` production modules for a redeclared token list or symbol; tests may hold an oracle, and the bash reference remains the external contract.
3. Domain purity: assert `verify-change.ts` imports only `#contracts`, `#domain/`, or relative modules; contains no parser, file I/O, clock, environment, randomness, or runtime API call.
4. State tier: assert the presence-tolerant read extension imports only `#contracts` and own state modules; no runtime import; no new runtime-API location. Assert `STATE_CONSUMERS` is still exactly the CLI edge and the phase command (`packages/cli/src/commands/phase.ts`, `packages/cli/src/edge.ts`): `commands/verify.ts` must not import `@delivery-os/core/state` directly, so the verify consumer is composed through the edge and the documented consumer set does not grow.
5. Command surface: assert `commands/index.ts` exports the verify command definition and `edge.ts` composes the verify runtime into `createConfigProgram` beside `config`, `lint`, and `phase`, following the existing registration precedent. Assert `commands/verify.ts` imports no `node:`/`bun:`, no adapters, and no `edge.js`; contains no `console.*`, `process.exit`, stream write, or numeric exit literal; the handler returns data or error only.
6. Brand neutrality: run the forbidden-literals scan over `packages/**` and assert zero for the new modules; assert no `ados`, `ADOS_`, or `~/.ados` literal enters them; the command uses the injected brand if it needs one.
7. Inventory: assert `tests/structure/inventory.json` lists the new files exactly; assert `EXECUTABLE_ALLOWANCES` declares the new contracts constants and the domain/command exports; run `content-inventory` and assert no missing/extra file.
8. Mutation controls: each detector has a failing fixture and a clean control; deleting a rule's failing fixture fails the meta-check; a temp contracts module with a function fails; a temp CLI module declaring a token list fails; a mutated inventory object missing the new file fails the same comparison; a temp `commands/verify.ts` importing `@delivery-os/core/state` fails the consumer-list assertion. The live tree is clean.

**Expected Outcome**:

- Contracts are data-only; the enum has one home; domain, state, and command tiers are clean; no brand literals; inventory and executable allowances are updated; every detector is non-vacuous.

#### TC-VERIFY-021 - Boundary, ambient, exit-code, and entrypoint gates

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-1, NFR-2, AC-V10 (no runtime edges)
**Test Type(s)**: Static, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/boundaries/**`, `scripts/checks/{ambient-globals,forbidden-literals,exit-code-literals,workspace-entrypoints}.ts`
**Tags**: @backend

**Preconditions**:

- The new and extended modules are inside the existing scan scopes; no new dependency-cruiser rule is expected (per the spec).
- The `runtime-apis-confinement` rule's allowed locations and the pre-change boundary-rule set for comparison.

**Steps**:

1. Run `bun test tests/boundaries`; assert green over `packages` with the new modules. Compare the dependency-cruiser rule-id set and the `runtime-apis-confinement` rule's allowed locations against the test-local pinned pre-change sets: a new rule or an added allowlist location fails; the fixture-coverage meta-check also fails any rule without a failing fixture.
2. Run `ambient-globals`; assert zero findings, and assert a temp probe with `Date.now`, `Math.random`, or `process.env` fails naming file, line, and kind.
3. Run `exit-code-literals`; assert zero failures; assert the new modules contain no exit digits and `packages/cli/src/projection.ts` remains the only owner; a temp probe with `exitCode: 2` fails.
4. Run `workspace-entrypoints`; assert no undeclared package-name import or subpath edge; the new modules use existing subpaths only.
5. Run `forbidden-literals`; assert green over `packages/**`; assert the new modules add no literal.
6. Assert the boundary fixture-coverage meta-check is green; no rule lost its failing fixture.
7. Run `pnpm check`; assert exit `0`, including the suites above.

**Expected Outcome**:

- All boundary, ambient, literal, exit-code, and entrypoint gates are green; no new runtime location or rule is introduced; seeded violations are caught; the aggregate gate passes.

## 6. Environments and Test Data

### 6.1 Environments

| Environment | Requirements | Notes |
|-------------|--------------|-------|
| Local dev (delivery) | Bun pinned by `.bun-version`; pnpm pinned by `packageManager` | All verify suites are hermetic and in-process |
| CI (GitHub Actions, `ubuntu-latest`) | Frozen-lockfile install; pinned Bun/pnpm; existing `ts-*` jobs | Authoritative for structure, checks, boundary, corpus, and aggregate gates |
| Temp fixture trees | `mkdtemp` under the OS temp directory | Malformed, overlay, corpus-copy, state, and mutation fixtures never write the live tree |
| In-process test process | Bun runtime; injected brand, clock, run id, fs/state root, and streams | No child processes for any verify suite; fixed output facts for byte assertions |

### 6.2 Test Data

| Data | Source / shape | Lifecycle |
|------|----------------|-----------|
| Full classification fixtures | `tests/fixtures/verify/classification/full/**`: complete, eleven single-missing, multi-missing, reversed-key-order twin | Read-only; builder asserts each mutation |
| LITE classification fixtures | `tests/fixtures/verify/classification/lite/**`: complete with non-LITE null/absent, six single-missing, wrong-typed non-LITE control | Read-only; builder asserts each mutation |
| Overlay fixtures | Declaration + verified registry histories built with `appendPhaseTransition`; O1..O9 and P1/P2 | Generated in temp roots per test; no live-tree writes |
| Malformed fixtures | `tests/fixtures/verify/malformed/**`: unparseable, missing top-level/entry/collection keys, wrong-typed values, non-timestamp values, unknown/wrong-typed variant, co-occurrence pairs; each with a `planted-payload-verify-*` canary | Read-only; builder asserts the omission/mutation |
| Target and grammar fixtures | `tests/fixtures/verify/target/**`, `tests/fixtures/verify/grammar/**` | Read-only |
| State fixtures | Torn ledger (flip/framing/sequence), schema mismatch, corrupt transition payload, permission denial; built with `tests/fixtures/state/harness.ts` | Generated in temp roots; canaries planted; detection-disabled control |
| Real-corpus fixtures | `doc/changes/2026-10/2026-10-31--GH-179--pm-notes-registry-lint-phase-transitions/chg-GH-179-pm-notes.yaml`; `doc/changes/2026-10/2026-10-29--GH-170--monorepo-scaffold-toolchain/chg-GH-170-pm-notes.yaml`; `doc/changes/2026-10/2026-10-29--GH-171--branding-seam-working-name/chg-GH-171-pm-notes.yaml` | Read in place, read-only; digests asserted before/after; mutations only in temp copies |
| Bash enum reference | `scripts/deliver-ticket.sh` usage line | Read-only at test time; mutations only in memory/temp copies |
| Spec table reference | `doc/changes/2026-10/2026-10-31--GH-177--verify-change-exit-taxonomy/chg-GH-177-spec.md` C-4 table and derivation paragraph | Read-only at test time |
| Error table | `ERROR_TABLE`, `DOMAIN_KINDS`, and the documented table in `doc/spec/features/feature-result-contract.md` | Read-only at test time; drift fails sync; mutation copies only |
| Baseline oracle | The pre-existing error-table rows and the pinned taxonomy mapping, held in the test files | Read-only; the verifier row is the only addition |

### 6.3 Isolation Strategy

- Every synthetic fixture and mutation test uses a fresh `mkdtemp` root; no test writes the live repository tree, `dist/`, or the user's real state directory. A clean-tree assertion after the suite is part of the aggregate gate.
- Verify suites inject brand, paths, clock, run id, filesystem/state facts, and streams; they never read `$HOME`, the wall clock, or an ambient environment where purity is asserted.
- The corpus test reads committed files read-only and injects a fresh state root; temp-copy mutation controls are the only writable copies.
- State fixtures are built from verified bytes and mutated by a named operation; a detection-disabled control must expose the planted value, proving the fixture is live.
- Error-table, spec-table, bash-enum, and taxonomy mutation tests operate on in-memory values or temp copies; the unchanged control runs in the same suite.

## 7. Automation Plan and Implementation Mapping

All TCs are automated. Locations follow the spec's QA table and the repository testing strategy; delivery planning may rename helper files but must preserve each TC's behaviour, assertions, identities, and AC mapping.

| TC ID | Test file / artefact | Execution command | Control / mutation | Status |
|-------|----------------------|-------------------|--------------------|--------|
| TC-VERIFY-001 | `tests/behaviour/verify-change-classification.test.ts` + `tests/fixtures/verify/classification/full/**` | `bun test tests/behaviour/verify-change-classification.test.ts` | eleven single-missing fixtures; multi-missing ordering; restored/complete controls; canary sweep | To Implement |
| TC-VERIFY-002 | same + full-complete fixture | same | three registry evidence states; exact key set; other-ref-only store; replay control | To Implement |
| TC-VERIFY-003 | same + LITE fixtures | same | six per-phase omissions; LITE complete null/absent controls; non-LITE wrong-type control; full-variant gate | To Implement |
| TC-VERIFY-004 | same + partial-identity fixtures | same | absent vs declared-incomplete; mixed absence precedence; restored controls | To Implement |
| TC-VERIFY-005 | same + `tests/fixtures/state/harness.ts` | same | O1..O9 overlay/presence fixtures; P1/P2 projection contradictions; declaration-only/registry-required/projection-reading controls | To Implement |
| TC-VERIFY-006 | `tests/behaviour/verify-corpus.test.ts` | `bun test tests/behaviour/verify-corpus.test.ts` | GH-179/GH-170/GH-171 preconditions and digests; temp-copy mutation controls | To Implement |
| TC-VERIFY-007 | `tests/behaviour/verify-change-rejections.test.ts` + `tests/fixtures/verify/malformed/**` | `bun test tests/behaviour/verify-change-rejections.test.ts` | every malformed class; co-occurrence ordering; canary; restored/valid controls | To Implement |
| TC-VERIFY-008 | same + `tests/fixtures/verify/malformed/variant/**` | same | unknown vs wrong-type split; no-registry-read recorder; lite/full/absent controls | To Implement |
| TC-VERIFY-009 | same + `tests/fixtures/verify/target/**` | same | absent/malformed-shape refs; present/malformed-target controls; no-registry-read recorder | To Implement |
| TC-VERIFY-010 | `tests/behaviour/verify-change-state.test.ts` + `tests/fixtures/state/harness.ts` | `bun test tests/behaviour/verify-change-state.test.ts` | torn/schema/payload/permission fixtures; wrapping store; valid-store control; detection-disabled control | To Implement |
| TC-VERIFY-011 | `tests/behaviour/verify-change-rejections.test.ts` + grammar fixtures | same | handler vs parser grammar; zero-read recorder; valid-invocation control | To Implement |
| TC-VERIFY-012 | `tests/behaviour/verify-envelope.test.ts`, `tests/golden/helpers.ts` | `bun test tests/behaviour/verify-envelope.test.ts` | exhaustive matrix; `assertEnvelopeContract`; `projectExitCode`; human mode | To Implement |
| TC-VERIFY-013 | `tests/behaviour/verify-envelope.test.ts` + classification fixtures | same | exact full/LITE summaries; independent missing-set oracle; reversed key order; success arrays | To Implement |
| TC-VERIFY-014 | `tests/behaviour/verify-envelope.test.ts`, `tests/structure/verify-imports.test.ts` | corresponding `bun test` | byte digests; recording/throwing seams; ambient stubs; AST import scan; seeded-write and mutating-phase controls | To Implement |
| TC-VERIFY-015 | `tests/behaviour/verify-envelope.test.ts` | `bun test tests/behaviour/verify-envelope.test.ts` | replay across all classes; fresh-root replay; reversed key order; input-change control | To Implement |
| TC-VERIFY-016 | `tests/structure/delivery-result-contract.test.ts` | `bun test tests/structure/delivery-result-contract.test.ts` | live bash extraction; in-memory mutations; missing-reference fail-closed control | To Implement |
| TC-VERIFY-017 | same | same | totality; classes; mapping; reachable subset; exit projection; in-memory mutation controls | To Implement |
| TC-VERIFY-018 | same + the change spec | same | table parser/comparer; mutation controls; digest read-only assertion | To Implement |
| TC-VERIFY-019 | `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts`, `scripts/checks/error-table-sync.ts` | `bun run scripts/checks/error-table-sync.ts`; `bun test tests/checks/error-table-sync.test.ts`; `bun test tests/structure/error-table.test.ts` | new-row round-trip; both drift directions; kind removal; existing-row baseline; kind-only AST scan | Existing – Update |
| TC-VERIFY-020 | `tests/structure/verify-imports.test.ts` (new), `tests/structure/cli-edge-seam.test.ts`, `tests/structure/content-inventory.test.ts`, `tests/structure/error-table.test.ts`, `tests/structure/inventory.json` | corresponding `bun test` | contracts/domain/state/command detectors; single-home scan; edge composition; inventory/allowances; failing fixtures and seeded violations | To Implement (new suite) + Existing – Update |
| TC-VERIFY-021 | `tests/boundaries/**`, existing checks | `bun test tests/boundaries`; `bun run scripts/checks/{ambient-globals,forbidden-literals,exit-code-literals,workspace-entrypoints}.ts`; `pnpm check` | existing negative fixtures; seeded violations; rule-id/allowlist baseline diff; fixture-coverage meta-check | Existing – Update |

**Execution order.**

1. Enum, taxonomy, spec table, and error-table binding: TC-VERIFY-016, TC-VERIFY-017, TC-VERIFY-018, TC-VERIFY-019.
2. Tier, purity, inventory, and boundary gates: TC-VERIFY-020, TC-VERIFY-021.
3. Classification and overlay: TC-VERIFY-001, TC-VERIFY-002, TC-VERIFY-003, TC-VERIFY-004, TC-VERIFY-005.
4. Rejections and grammar: TC-VERIFY-007, TC-VERIFY-008, TC-VERIFY-009, TC-VERIFY-011.
5. State failures: TC-VERIFY-010.
6. Real corpus: TC-VERIFY-006.
7. Envelope/exit, summary, read-only, determinism: TC-VERIFY-012, TC-VERIFY-013, TC-VERIFY-014, TC-VERIFY-015.
8. Aggregate and non-regression: `pnpm check`, `git diff --check`, `git status --porcelain`.

**Wiring.** The new behaviour suites are discovered by root `bun test`; no new CI job topology is introduced. The error-table sync check stays in the existing `ts-invariants` wiring. The new structure suite is discovered by `bun test tests/structure`. The boundary rules extend to the new modules automatically; no rule is added. Documentation reconciliation gates run in phase 7: `git diff --check`, YAML parse for changed `.yaml` files, markdown/link review, the error-table sync check for the reconciled result-contract table, forbidden-literal registration for any new current-truth feature doc that names the binary, and `bash scripts/.tests/test-doc-distribution.sh` for any changed redistributable guide or template (for example `doc/guides/change-lifecycle.md`).

**Evidence commands** (run and record in the change/PR; never record unrun results as passing):

```
pnpm install --frozen-lockfile
bun test tests/structure/delivery-result-contract.test.ts
bun test tests/structure/verify-imports.test.ts
bun test tests/structure/content-inventory.test.ts
bun test tests/structure/error-table.test.ts
bun test tests/behaviour/verify-change-classification.test.ts
bun test tests/behaviour/verify-change-rejections.test.ts
bun test tests/behaviour/verify-change-state.test.ts
bun test tests/behaviour/verify-envelope.test.ts
bun test tests/behaviour/verify-corpus.test.ts
bun test tests/checks/error-table-sync.test.ts
bun test tests/boundaries
bun run scripts/checks/error-table-sync.ts
bun run scripts/checks/ambient-globals.ts
bun run scripts/checks/forbidden-literals.ts
bun run scripts/checks/exit-code-literals.ts
bun run scripts/checks/workspace-entrypoints.ts
pnpm check
bash scripts/.tests/test-doc-distribution.sh
git diff --check
git status --porcelain
```

**Open-PR DoD evidence checklist.** All fourteen ACs have a passing traceable TC; all seven NFR thresholds measured; the eleven-token enum equals the bash usage enum (11/11, set and order) and the spec table token-for-token; the taxonomy is 11/11 total with one valid projection class and one valid derivation class per token and the reachable subset exactly four; the rejection matrix covers every verify-reachable identity with non-zero exits, error-only envelopes, and no `fallback.internal`; the incomplete full and LITE fixtures name every missing phase in required-set order; the overlay fixtures prove both precedence directions, no-evidence for absent records, and projection-not-evidence; the real corpus is read-only and pinned; zero writes/fences/network/spawns and byte-identical replays; the new `verify` kind/row round-trips with two-way sync and no existing-row changes; tier/data-only/single-home/handler-purity/inventory/brand/ambient/exit-literal/boundary gates green; no existing gate weakened; the new feature doc and reconciled docs registered; a minor changeset recorded; an open unmerged PR targets `main-tools`. No merge or owner acceptance is claimed by this plan.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Risk | Impact | Probability | Mitigation |
|----|------|--------|-------------|------------|
| RSK-T1 | A rejection fixture is inert, so verify passes without proving detection | H | M | Every malformed fixture asserts its omission/mutation and carries a planted canary; restored/valid controls run in the same test; no negative control may pass silently |
| RSK-T2 | A negative assertion is vacuous because the run failed for a different reason | H | M | Every negative asserts the exact identity, exact exit, error-only envelope, no `data`, no exit `0`, and the absence of the wrong sibling identity and `fallback.internal` together |
| RSK-T3 | State fixtures do not exercise the real read path | H | M | Fixtures are built from verified bytes with the real state harness, mutated by named operations, carry canaries, and a detection-disabled control must expose the planted value |
| RSK-T4 | The bash enum extraction silently degrades or skips when the reference moves | H | M | The extractor fails closed; missing/empty/mutated references fail; mutation controls prove set/order sensitivity; no skip path |
| RSK-T5 | The taxonomy drifts among the contracts data, the spec table, and the current-truth doc | M | M | TC-016/017/018 bind bash → data → spec table; phase 7 reconciles the current-truth feature doc and the error-table sync keeps the result contract honest |
| RSK-T6 | The read-only proof is vacuous because the recorder is never exercised | H | L | The recorder must observe the expected reads; a mutating `phase` control must record writes/fences; a seeded-write control must trip the digest check |
| RSK-T7 | The corpus fixture drifts because GH-179/GH-170/GH-171 change | M | L | The test asserts the fixture preconditions (completion map, parse failure) before classifying; a changed corpus fails loudly and forces a deliberate test-plan update |
| RSK-T8 | A one-sided overlay implementation passes | H | M | Directional controls: declaration-only fails the reopen case; registry-required fails the absent-record case; projection-reading fails P1/P2 |
| RSK-T9 | LITE under-declaration hides an unfinished heavyweight phase | H | M | Absent `variant` is tested as full; each LITE phase has its own omission fixture; the full-variant `dor_check` control proves the relaxation is variant-gated |
| RSK-T10 | Grammar validation is accidentally ordered after a read | H | M | Every grammar case asserts zero target and registry reads; a valid invocation through the same recorder proves the recorder is live |
| RSK-T11 | The permission fixture is platform-conditional and gets skipped silently | M | L | POSIX uses a real mode violation; win32 uses the existing ACL branch; the identity/exit assertions run on both, and a conditional is recorded, not silently skipped |
| RSK-T12 | `state.level.unsupported` is fabricated as a verify fixture or ignored | M | L | GAP-2: it is unreachable by verify; its totality is TC-019's table round-trip, and no fake verify fixture is introduced |

### 8.2 Assumptions

- **A-T1 — Spec binding.** The spec is the single source of truth for identities, tokens, summaries, evidence keys, and exits. Delivery planning may choose helper/file names but may not rebind a pinned value.
- **A-T2 — In-process harness.** Every verify behaviour test uses `runCli` with injected dependencies; no verify suite spawns a child process. No packed probe is added because no package subpath or manifest changes (§1.2).
- **A-T3 — Delivery-bound spellings.** Runtime type names, internal helper names, the reachable-subset export name (if any), and the exact lint `detail` punctuation are delivery-bound; the four-token reachable subset is nonetheless asserted as the set of tokens whose derivation class is `verify`.
- **A-T4 — Plan absent.** GAP-1: the implementation plan must map its phases onto these TCs and must not reshape them; any later plan or implementation that alters a TC's behaviour, assertion, or AC mapping reopens this test plan.
- **A-T5 — `state.level.unsupported`.** It is documented as total but unreachable on the local read path; TC-019 proves its table totality, and TC-012 does not fabricate a verify fixture for it (GAP-2).
- **A-T6 — Detail-segment presence.** C-6 makes the trailing `; detail=` segment optional overall. For `lint.notes.malformed` and `lint.keys.missing` the tests assert that, when present, it names the safe location and stays one line; for `state.*` the tests assert AC-V7's exact three-segment prefix and accept at most one trailing `detail=<row summary>` (optional); for `partial`, unknown variant, missing target, and handler grammar the tests require its absence (explicitly pinned by C-6). The parser-level `fallback.invocation` path is outside the verify classification tuple because the handler never runs; it is asserted for identity, exit, and error-only envelope only (AC-V14). This reconciles AC-V7's exact summary with C-6's optional detail without weakening either.
- **A-T7 — Corpus preconditions.** The three real fixtures' content is pinned by AC-V11 and asserted before classification: GH-179's eleven completions and absent variant, GH-170's two `null` completions plus opaque keys, GH-171's parse failure. A corpus change is a deliberate test-plan event, not a silent update.
- **A-T8 — Bash reference path.** `scripts/deliver-ticket.sh` is the normative enum reference through the M1-S9 dual-run period; if it moves, the binding test fails closed and must be updated deliberately.
- **A-T9 — Version impact.** The spec declares no `version_impact`; `minor` is recorded because the change is additive (one command, contracts data, one error row). The owner may amend at PR review.
- **A-T10 — `overlaidPhases` order.** C-6 pins the field and its membership, not its ordering; the tests assert set equality and replay determinism (OQ-T3).
- **A-T11 — `recordCount` semantics.** C-6 names the field but does not define whether it is store-level or per-change; the tests assert a non-negative integer and rely on `present`/`verifiedEmpty`/`transitionCount` for meaning (OQ-T2).

### 8.3 Open Questions

| ID | Question | Context | Status | Owner |
|----|----------|---------|--------|-------|
| OQ-T1 | What is the exact export name of the M0-S8-reachable subset, if one is declared? | The four tokens are derivable as the taxonomy entries whose derivation class is `verify`; TC-017 uses that derivation and does not require a separate symbol. | Open — delivery-bound, non-blocking | @plan-writer / @coder |
| OQ-T2 | Is evidence `recordCount` the verified store's record count or the change's record count? | C-6 lists both `recordCount` and `transitionCount`; the tests assert `transitionCount` per change and treat `recordCount` as a non-negative integer (A-T11). | Open — delivery-bound, non-blocking | @plan-writer / @coder |
| OQ-T3 | Is `overlaidPhases` ordered by the required set? | C-6 pins membership, not order; the tests assert set equality and byte-identical replays (A-T10). A required-set order is acceptable and would also pass. | Open — delivery-bound, non-blocking | @coder |
| OQ-T4 | What exact punctuation does the lint `detail` segment use? | C-6 pins that it carries the finding detail and safe location and stays one line; the tests assert the location and safety, not a specific separator (A-T3, A-T6). | Open — delivery-bound, non-blocking | @coder |
| OQ-T5 | Does the current-truth feature doc become the long-term oracle for the C-4 table? | AC-V8 binds the change spec; GAP-5 records that the phase-7 doc is reconciled but not silently substituted as the test oracle. | Open — documentation-phase, non-blocking | @doc-syncer |

**Recorded gaps, not silently adjusted:**

1. **Plan absent** — GAP-1/A-T4; the plan must map onto these TCs.
2. **`state.level.unsupported` unreachable** — GAP-2/A-T5; table totality, not a fabricated verify fixture.
3. **Delivery-bound spellings** — GAP-3/A-T3/OQ-T1/OQ-T4; identities, summaries, tokens, exits, and evidence keys are pinned.
4. **Platform-conditional permission** — GAP-4/RSK-T11; both platform branches assert the same identity and exit.
5. **Change-spec table binding** — GAP-5/OQ-T5; the spec is the AC-V8 oracle, and the phase-7 doc is reconciled separately.

No AC is left without a TC.

## 9. Plan Revision Log

| Version | Date (UTC) | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-10-31T05:30:00Z | Change Test Plan Writer | Initial plan: 21 TCs (TC-VERIFY-001..021). All fourteen ACs (AC-V1..V14) and all seven NFRs mapped; full/LITE incomplete fixtures one per required phase; exact summary grammar and reversed-key-order determinism; declaration/registry overlay in both directions with presence-tolerant reads and projection-not-evidence; malformed classes pinned to one identity each; registry failures with the platform/user exit split; grammar before reads; exhaustive envelope/exit matrix with `assertEnvelopeContract`; 11/11 bash-enum binding and a total taxonomy with the exact reachable subset; spec-table agreement; the new `verify` row with two-way sync and untouched existing rows; tier/data-only/single-home/inventory/brand/ambient/exit-literal/boundary gates; the GH-179/GH-170/GH-171 corpus read in place; read-only/network-free/spawn-free/deterministic proofs with seeded controls. Spec gaps, delivery-bound spellings, and the AC-V7/C-6 detail optionality are recorded, not silently reinterpreted. |

## 10. Test Execution Log

| TC ID / gate | Run Date (UTC) | Result | Notes / command / HEAD |
|---|---|---|---|
| Not run | — | Planned | This writer ran no builds or tests and implemented no code. The executor records per-TC evidence, commands, HEAD, and pushed-HEAD CI results here; unrun evidence must never be recorded as passing. |
