---
id: chg-GH-179-pm-notes-registry-lint-phase-transitions
status: Proposed
created: 2026-10-31T02:10:00Z
last_updated: 2026-10-31T02:16:29Z
owners: [engineering]
service: delivery-os CLI and state tier
labels: [change, planning]
links:
  change_spec: ./chg-GH-179-spec.md
  test_plan: ./chg-GH-179-test-plan.md
  adr_refs:
    - ../../../decisions/ADR-0003-oss-monorepo-structure.md
  related:
    - ../../../spec/features/feature-state-layer.md
    - ../../../spec/features/feature-result-contract.md
    - ../../../planning/oss-tooling/cli-command-registry.md
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
summary: >-
  Deliver M0-S10 per spec v1.2: pm-notes schema vocabulary (typed-when-present
  keys, opaque extras, full/LITE variant enum with pinned per-variant required
  phase sets) and registry record vocabulary as data-only contracts; five
  additive lint error-table rows under a new lint domain kind shipped in-change
  with the documented table in the same phase; pure conformance rules in the
  core domain tier; the delivery registry as the first consumer of the GH-174
  state port (phase.transition ledger records, key-set assertions, atomically
  replaced derived per-change projection); a read-only lint command with named
  targets (pm-notes default, registry verified-empty pass, both) and a phase
  command family (list/complete/reopen) as the only schema-validated,
  idempotent write path for phase state with grammar validation before state
  inspection; the variant-era corpus fixture minus the GH-171 exclusion
  manifest as a permanent CI-borne suite; envelope/exit projection,
  determinism, tier/runtime confinement, and packed Node/Bun consumption
  asserted throughout.
version_impact: minor
---

# IMPLEMENTATION PLAN — GH-179: M0-S10: PM-notes and registry lint, and phase transitions

## Context and Goals

- **Work item**: [GH-179 — M0-S10: pm-notes and registry lint, and phase transitions](https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/179).
- **Inputs (authoritative, read in full by this pass)**:
  - [chg-GH-179-spec.md](./chg-GH-179-spec.md) — **v1.2** (2026-10-31): AC-L1..AC-L6, C-1..C-6, NFR-1..NFR-5, pinned LITE set, corpus boundary + exclusion manifest, revision log v1.1 (R1–R3e) and v1.2.
  - [chg-GH-179-test-plan.md](./chg-GH-179-test-plan.md) — **v1.0** (2026-10-31T03:45:00Z, 25 TCs): TC-LINT-001..010, TC-PHASE-001..009, TC-SYNC-007..009 (continuing the GH-172 sequence), TC-BOUND-001..003; §4.1 in-process harness contract and §4.2 non-vacuity contract are binding.
  - [delegation-plan-brief.md](./delegation-plan-brief.md) — PM delegation for this plan (delivery bindings, OQ pins, execution constraints).
- **Status**: Proposed (awaiting DoR gate, lifecycle phase 5).
- **Baseline**: `main-tools` with M0-S1..S5 merged (GH-170/171/172/173/174; GH-174 state layer: `DOMAIN_KINDS = ["provider", "input", "config", "state"]`, `createStateStore` + `StateStorePort`, `tests/fixtures/state/harness.ts`, packed-probe spawn exception). The CLI has exactly one command (`config`) composed through `commands/index.ts` + `edge.ts`. Execution belongs on `feat/GH-179/pm-notes-registry-lint-phase-transitions`; the PR targets `main-tools`.
- **No spec/test-plan inconsistency found.** The four delivery-bound spellings the test plan left open (GAP-3, A-T3) are pinned below and become binding; no TC behaviour, assertion, or AC mapping is reshaped (A-T1, A-T5).

**Goals** (spec §Business Context): schema/format conformance at write time surfaced as a read-only `lint` command · exactly one schema-validated, idempotent write path for phase state (`phase list|complete|reopen`) · variant honesty (absent `variant` = full; explicit LITE with six pinned required phases; opaque extras never inspected) · the delivery registry as the first GH-174 state-layer consumer so the ledger read by verify change (GH-177) is verified, classified, and never silently torn · five additive `lint.*` error identities with the documented table synchronized from the first phase boundary.

**Delivery model**: `@coder` executes phases 1–8 in order, each ending in exactly one Conventional Commit (inline committer discipline, D6) and a green phase gate. Phases 9–12 map to lifecycle phases 7–11 (doc sync, review, conditional fixes, finalize/release) and are PM-scheduled; `@coder` must not mark them complete by finishing implementation alone. Dependency order: **1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → (9–12 per lifecycle)**. The corpus fixture (Phase 4) deliberately precedes the phase command; its two write-path-dependent controls complete in Phase 6 (traceability table notes this).

This is **part 1 of 2** of the authoring pass: front matter, context, pinned resolutions, delivery bindings, the complete 25-TC traceability table, and Phases 1–6. Part 2 appends Phases 7–12, Scope (constraints, risks, success metrics), remaining open questions, artifacts, revision log, and the execution log skeleton.

## Pinned Open-Question Resolutions (binding for delivery)

The test plan left four spellings delivery-bound (OQ-T1/T2/T4/T5, GAP-3, A-T3/T4); the delegation brief directs this plan to pin them. Each pin preserves the pinned semantics (target meaning, evidence classes, identities, record fields — A-T1) and only fixes spelling/placement. Changing any pin later reopens this plan.

### PIN-1 — Lint target selector (resolves OQ-T1)

The `lint` command takes one positional change ref plus **additive boolean target flags**:

| Invocation | Target set | Semantics |
|---|---|---|
| `lint <ref>` | pm-notes (default; equivalent to `lint <ref> --pm-notes`) | Missing pm-notes file → `lint.target.missing`, exit 1 (C-3). |
| `lint <ref> --registry` | delivery registry | Absent store → explicit **verified-empty PASS**, exit 0 (R3b spelling preserved); torn/mismatch/key-set → classified `state.*`, exit 2. |
| `lint <ref> --pm-notes --registry` | both | Both targets checked; first failure by fixed target order (pm-notes, then registry) is the verdict. |

Grounding: the PM-notes decision record already used the `lint --registry` spelling (R3b), and the command registry pins `ados lint` as a flag-bearing surface while `phase` uses subcommands. `--json` rides the CommandResult envelope on every invocation (NFR-2). The selector is pure grammar: an unknown flag stays on the existing `fallback.invocation` path.

### PIN-2 — Exclusion manifest location and format (resolves OQ-T2)

The corpus exclusion manifest is a **committed test fixture**: `tests/fixtures/pm-notes/corpus-exclusions.json`,

```json
{
  "exclude": [
    "doc/changes/2026-10/2026-10-29--GH-171--branding-seam-working-name/chg-GH-171-pm-notes.yaml"
  ]
}
```

Rationale: the corpus boundary is a QA-fixture concept — the `lint` command validates named targets and never consumes the manifest, so contracts data would couple runtime vocabulary to a test-only concern. Format: repo-relative POSIX paths, one JSON object, key `exclude`. The TC-LINT-008 guard asserts the manifest names exactly one path today, that the path exists, and that the file is genuinely unparseable; a second entry or an entry naming a parseable file fails the guard (exclusions cannot grow silently).

### PIN-3 — Derived projection file name and shape (resolves OQ-T4)

The derived per-change phase-state projection is a state-port derived document (`replaceDocument({ name, content })`), not a record kind:

- **Name**: `phase-state.<REF>.json` (e.g. `phase-state.GH-179.json`; refs match `[A-Z]+-[0-9]+` so they are filename-safe).
- **Shape**: `{ "schemaVersion": "delivery.registry.v1", "changeRef": "<REF>", "phases": { "<phaseId>": { "started": <ISO string | null>, "completed": <ISO string | null> } } }`.
- **No timestamp/non-fold fields**: the projection is a pure fold of verified `phase.transition` records so rebuild equality (TC-PHASE-009 step 4) is byte-stable; re-completing a phase updates the folded values through a new record, never through in-place mutation of history.

### PIN-4 — Evidence field names (resolves OQ-T5)

One evidence vocabulary across the `lint` and `phase` surfaces (evidence classes themselves are pinned by the test plan; these are the field spellings):

- **No-op completion (row 2)**: `{ "outcome": "no-op", "basis": "already-completed", "completedAt": "<existing completion timestamp>" }` — cites the existing completion (AC-L2).
- **No-op reopen (row 5)**: `{ "outcome": "no-op", "basis": "not-completed", "phase": "<phaseId>" }` plus `"reason": "<supplied reason>"` echoed in evidence only.
- **Landing (rows 1/3/4/9)**: `{ "outcome": "landed" }` plus at most one advisory object.
- **Out-of-order advisory (row 6)**: `"advisory": { "class": "earlier-open", "phases": [<still-open earlier phase ids of the effective variant>] }`.
- **Outside-required-set advisory (row 9, lite)**: `"advisory": { "class": "outside-required-set", "phase": "<phaseId>", "variant": "<effective variant>" }`.
- **Verified-empty (absent registry under lint/phase list)**: the state layer's verified-empty evidence with `{ "class": "verified-empty", "target": "registry" }`.

### Derived pins (design decisions this plan adds; same binding force)

- **PIN-5 — Verdict aggregation**: lint rules run in the fixed order parse → keys/types → variant → phases and the verdict carries the **first finding's** single classified code (one error per envelope); within a finding, all offenders of that class are named (missing keys, missing phases — plural naming per TC-LINT-002/005).
- **PIN-6 — Idempotency basis**: the redundant-cell decision (already completed?) reads the **registry ledger fold** (authoritative, RSK-2), never the pm-notes declaration alone; the pm-notes document is separately schema-validated (staged, PIN-7) and updated on landing.
- **PIN-7 — Staged write-path validation (A-T9 reading)**: mutating `phase` invocations lint the **post-transition (staged) document** — parse the target, apply the intended entry change in memory, run the pure rules over the staged value — so completing an absent required phase legitimately satisfies required-phase presence (row 9) while unrelated defects still block with their own pinned code (TC-PHASE-006 step 5).
- **PIN-8 — Opaque-extras preservation**: pm-notes mutation uses the YAML **document-edit API at the CLI edge** (parse to a Document, set only the target entry's `started`/`completed`, serialize); the file is never round-tripped through a schema-typed re-serialization, so opaque phase keys, extra entry keys, and free-form values survive value-faithfully (NG-4, AC-L6).

## Delivery Bindings and Design Decisions

Binding for delivery (D1..D11); behaviour, pinned identities, and AC mapping come from the spec/test plan and may not change (A-T1).

- **D1 — Module layout (grounded in the real tree)**:
  - `packages/core/src/contracts/pm-notes.ts` (new): document/phase-entry/collection types; `PM_NOTES_VARIANT_VALUES = ["full", "lite"]` as const; `CANONICAL_PHASE_IDS` (the 11); `LITE_REQUIRED_PHASES` (the pinned six: `clarify_scope`, `specification`, `delivery`, `quality_gates`, `dod_check`, `pr_creation`); `PM_NOTES_REQUIRED_TOP_LEVEL_KEYS = ["change_id", "title", "delivery_mode", "phases"]`; typed-when-present optional keys (`milestone`, `story_code`, `variant`); per-variant required-phase sets as as-const data. Types/data only.
  - `packages/core/src/contracts/registry.ts` (new): `REGISTRY_SCHEMA_VERSION = "delivery.registry.v1"` (the `STATE_SCHEMA_VERSION` single-home precedent), `PHASE_TRANSITION_KIND = "phase.transition"`, the record payload type (changeRef, phaseId, operation `complete | reopen`, reason — reopen only, timestamp, outcome), and the PIN-3 projection document name/shape constants. Re-exported from `contracts/index.ts`.
  - `packages/core/src/domain/pm-notes-lint.ts` (new): pure rules over parsed document values; parse failures arrive as an input value; no file access, no parser invocation, no runtime APIs (NFR-1).
  - `packages/core/src/state/registry.ts` (new): the registry record module composing the **injected** GH-174 store port — append with the registry's declared key set, verified reads, atomically replaced derived projection. No new runtime-API location: `state/driver/runtime-edge.ts` remains the only one in core.
  - `packages/cli/src/commands/lint.ts`, `packages/cli/src/commands/phase.ts` (new): command definitions following the `config.ts` registration precedent; registered in `commands/index.ts`, composed in `edge.ts`; classification rides the existing `classify.ts` → `projection.ts` `{0, 1, 2}` chain; `--json` through the single serializer in `output/`.
  - `packages/adapters/src/file/pm-notes-parser.ts` (new): target read + YAML 1.2 core parse following the existing `yaml-parser.ts` pattern (the `yaml` 2.x dependency already lives in the adapters manifest), returning parsed values **or** a parse-failure value — composed by the lint/phase command definitions through the CLI edge. The CLI edge owns the composition; core receives parsed values or parse failures only (spec §Technical Architecture item 4).
- **D2 — Error rows ship in the SAME phase as the table change (GH-174 D3 precedent)**: `lint` joins `DOMAIN_KINDS` and the five C-6 rows land in `ERROR_TABLE` and in the documented table at `doc/spec/features/feature-result-contract.md` **in Phase 1**, so `scripts/checks/error-table-sync.ts` is green in both directions from the first phase boundary. Lifecycle phase 7 (`@doc-syncer`) reconciles the rest of the result-contract doc but never rewrites the documented-table section.
- **D3 — State-port composition, no new surfaces**: the registry uses only `StateStorePort` operations (`acquireFence`/`append`/`releaseFence`, `read`, `replaceDocument`); store identity, paths, and schema version arrive through the injected identity (workspace identifier scopes per-change record keys and projection names); no new driver kind, no new state subpath, no runtime API outside the existing driver edge. Storage failures surface with the existing `state.*` identities — zero new state rows.
- **D4 — CLI edge ownership and grammar ordering**: file reads, YAML parsing, pm-notes document writes, rendering, and the exit projection live at the CLI surface edge (with the adapters parser of D1); the grammar validations of C-4 (reopen reason required and non-empty; phase argument within `CANONICAL_PHASE_IDS`) reject with the existing `input.value.rejected` row **before** target resolution, state inspection, or mutation (AC-L3, rows 7–8).
- **D5 — Fixture hygiene (GH-174 CI lesson)**: every fixture tree is self-materializing under a fresh `mkdtemp` in the OS temp directory or a committed read-only fixture under `tests/fixtures/**`; **no fixture depends on a gitignored repo-relative scratch directory**. Corpus fixtures read committed `doc/changes/**` files read-only; boundary-drift and schema-mutation controls operate on temp copies only. `planted-payload-*` canaries, restored-or-valid controls, and the three-way no-op assertions (exit 0 + zero ledger delta + no entry change) are mandatory per test-plan §4.2.
- **D6 — Inline committer protocol for `@coder` (this runtime)**: `@coder` **cannot dispatch subagents** — committer discipline is executed **inline by `@coder`**: one Conventional Commit per plan phase (`feat(GH-179): …` / `test(GH-179): …` / `docs(GH-179): …`, body lines ≤ 100 chars), **explicit staging lists** (stage exactly the phase's files; never stage `.ai/local/`, `tmp/`, or untracked scratch), and `pnpm check` run inline with captured logs before each commit. The completion signals below are the commit messages. Phases are sized to fit a single ~10-minute delegation window; if a phase overruns, `@coder` stops at the last green task boundary and reports — it does not enlarge the commit.
- **D7 — Quality gates, no new CI jobs**: new tests join existing workspace suites discovered by root `bun test`; the error-table sync check stays in the existing `ts-invariants` wiring; the packed probe extends `tests/checks/packed-state.test.ts`; boundary/ambient/literal gates extend to the new paths **only by adding rules and fixtures** — never by weakening one. `ci-topology` must stay green with no `ci.yml` change; any discovered wiring need escalates to PM before editing CI.
- **D8 — Inventory and literal registration**: every new source file registers in `tests/structure/inventory.json` with per-file named executable allowances in the same phase; the new feature doc (`doc/spec/features/feature-pm-notes-lint-and-phase-transitions.md`, Phase 8) registers in `scripts/checks/forbidden-literals.registry.json` in the same change (GH-173/174 precedent); zero product literals — the binary name arrives via the injected brand.
- **D9 — Changeset**: minor for the publishable fixed group (`.changeset/pm-notes-lint-minor.md`, the `state-layer-minor.md` precedent); `testkit` stays excluded; nothing publishes in this change. Owner may amend at PR review (A-T7).
- **D10 — Evidence artifact**: `chg-GH-179-evidence.md` in this folder (GH-172/174 pattern: phase commits, per-phase green criteria, final gate consolidation, TC coverage, rollback instructions), authored in the final phase.
- **D11 — No closed key set anywhere in code**: the schema validates required keys and schema-declared value types only; every extra key (top-level, phase-map, entry-level) is structurally preserved and never inspected (NG-4, PIN-8). A closed-key assertion appearing in any suite is a defect, not a hardening.

## Traceability and Coverage

All 25 TCs are mapped; no TC is orphaned and no task exists without a TC or spec anchor. "Primary phase" = where the TC is implemented and first green; parenthesized halves land earlier/later by design (multi-phase TCs follow the GH-174 precedent). TC details, preconditions, and expected outcomes are authoritative in test-plan §5.2; the per-phase **Tests** blocks below name the TCs each phase implements.

| TC ID | Scenario (abbreviated) | AC / NFR | Primary phase(s) | Target layer / test file |
|---|---|---|---|---|
| TC-LINT-001 | Malformed syntax and non-conforming value types | AC-L1 | 2 (rules), 3 (command) | `tests/behaviour/pm-notes-lint-rejections.test.ts` + `tests/fixtures/pm-notes/malformed/**` |
| TC-LINT-002 | Missing required keys, top-level and entry-level | AC-L1 | 2 (rules), 3 (command) | same |
| TC-LINT-003 | Unknown variant versus wrong-typed variant | AC-L1 | 2 (rules), 3 (command) | same + `tests/fixtures/pm-notes/variant/**` |
| TC-LINT-004 | Target resolution: missing pm-notes vs verified-empty registry | AC-L1, AC-L5 | 3 | `tests/behaviour/pm-notes-lint.test.ts` |
| TC-LINT-005 | LITE required-phase omissions, one pinned phase at a time | AC-L1, AC-L4 | 2 (rules), 3 (command) | `tests/behaviour/pm-notes-lint.test.ts` + variant fixtures |
| TC-LINT-006 | Variant semantics and opaque keys | AC-L4, AC-L6 | 2 (rules + GH-170 control), 3 (command) | `tests/behaviour/pm-notes-lint.test.ts`, `tests/structure/pm-notes-contract.test.ts` |
| TC-LINT-007 | Variant-era corpus acceptance | AC-L6, NFR-4 | 4 | `tests/behaviour/pm-notes-corpus.test.ts` |
| TC-LINT-008 | Corpus boundary, exclusion manifest, opaque controls | AC-L6, NFR-4 | 4 (corpus + manifest), 6 (legacy write-path control + phase-half of schema-mutation control) | `tests/behaviour/pm-notes-corpus.test.ts` + `tests/fixtures/pm-notes/corpus-exclusions.json` |
| TC-LINT-009 | Lint determinism and read-only behaviour | NFR-3 | 3 | `tests/behaviour/pm-notes-lint-determinism.test.ts` |
| TC-LINT-010 | Lint envelope and exit projection | AC-L1, NFR-2 | 3 | `tests/behaviour/pm-notes-lint.test.ts`, `tests/golden/helpers.ts` (reuse) |
| TC-PHASE-001 | Matrix rows 1–3: complete landing, no-op, re-completion | AC-L2 | 6 | `tests/behaviour/phase-transitions.test.ts`, `phase-idempotency.test.ts` |
| TC-PHASE-002 | Matrix rows 4–5: reopen landing and no-op | AC-L2 | 6 | same |
| TC-PHASE-003 | Matrix row 6: out-of-order completion advisory | AC-L2 | 7 | `tests/behaviour/phase-transitions.test.ts` |
| TC-PHASE-004 | Matrix row 9: absent canonical phase entry creation | AC-L2 | 6 | `tests/behaviour/phase-transitions.test.ts` |
| TC-PHASE-005 | Matrix rows 7–8: grammar rejections before state inspection | AC-L3 | 7 | `tests/behaviour/phase-rejections.test.ts` |
| TC-PHASE-006 | Write-path lint blocks every malformed class | AC-L1 | 7 | `tests/behaviour/phase-write-path-lint.test.ts` |
| TC-PHASE-007 | Registry read safety and classified storage failures | AC-L5 | 5 | `tests/behaviour/phase-registry.test.ts` + `tests/fixtures/state/harness.ts` |
| TC-PHASE-008 | Phase surface: list, envelope and exit projection | NFR-2 | 7 | `tests/behaviour/phase-envelope.test.ts` |
| TC-PHASE-009 | Phase ledger records and derived projection | AC-L2, AC-L5 | 5 (registry level), 6 (command-level re-assertion) | `tests/behaviour/phase-registry.test.ts` |
| TC-SYNC-007 | Five lint identities round-trip | NFR-5 | 1 (table + classification chain), 3 (lint triggers), 7 (write-path triggers) | `tests/structure/error-table.test.ts`, `tests/behaviour/pm-notes-lint.test.ts` |
| TC-SYNC-008 | Bidirectional documented-table synchronization | NFR-5 | 1 | `scripts/checks/error-table-sync.ts`, `tests/checks/error-table-sync.test.ts` |
| TC-SYNC-009 | Lint containment and multi-row-kind ambiguity | NFR-5 | 1 | `tests/structure/error-table.test.ts`, `tests/behaviour/error-classification.test.ts` |
| TC-BOUND-001 | Tier, purity, runtime confinement and literals | NFR-1 | 1 (contracts half), 2/5 (tier detectors grow with the modules), 8 (complete) | `tests/structure/pm-notes-imports.test.ts`, `registry-imports.test.ts`, `tests/boundaries/**`, checks |
| TC-BOUND-002 | CLI edge ownership and command composition | NFR-1 | 3 (lint composition), 6 (phase composition), 8 (complete) | `tests/structure/cli-edge-seam.test.ts` (update) |
| TC-BOUND-003 | Packed core surface on Node and Bun | NFR-1 | 8 | `tests/checks/packed-state.test.ts` (update) |

Phases 9–12 (part 2) are gate phases — review, doc synchronization, conditional fixes, finalize/release — and introduce no new TCs; they re-run the consolidated battery and record evidence.

## Phases

### Phase 1: pm-notes and registry contract vocabulary; `lint` error identity; documented-table sync

**Goal**: Land the data-only schema and record vocabulary and the five `lint` error identities with the documented table synchronized in the same phase, so the bidirectional sync gate is green from the first commit boundary (D2).

**Tasks**:

- [x] **1.1** Author `packages/core/src/contracts/pm-notes.ts` (D1): document/phase-entry/collection types; `PM_NOTES_VARIANT_VALUES`, `CANONICAL_PHASE_IDS` (11), `LITE_REQUIRED_PHASES` (pinned six), `PM_NOTES_REQUIRED_TOP_LEVEL_KEYS`, optional typed-when-present keys, the phase-entry `started`/`completed` rule (timestamp string or `null`) scoped to canonical + effective-variant-required entries, and the effective-variant helper type (`variant` absent → `full`). Types and `as const` data only; re-export from `contracts/index.ts`; register in `tests/structure/inventory.json` with named allowances.
- [x] **1.2** Author `packages/core/src/contracts/registry.ts` (D1, PIN-3): `REGISTRY_SCHEMA_VERSION = "delivery.registry.v1"`, `PHASE_TRANSITION_KIND = "phase.transition"`, the transition payload type (changeRef, phaseId, operation, reason reopen-only, timestamp, outcome), the projection document-name constant (`phase-state.<REF>.json`) and fold shape. Re-export; inventory registration.
- [x] **1.3** Extend `packages/core/src/contracts/error-table.ts`: add `lint` to `DOMAIN_KINDS` and append the five C-6 rows verbatim (`lint.notes.malformed`, `lint.keys.missing`, `lint.variant.unknown`, `lint.phases.incomplete`, `lint.target.missing`) — all `user`, not retryable, `not_landed`, `user-validation`, with the spec's remediation hints. Existing rows untouched.
- [x] **1.4** Ship the documented rows in the same phase (D2): append the five rows to the documented table in `doc/spec/features/feature-result-contract.md`; `bun run scripts/checks/error-table-sync.ts` green in both directions with non-zero counts; the check is extended only if its lint handling demands it — never weakened.
- [x] **1.5** Extend `tests/structure/error-table.test.ts`, `tests/behaviour/error-classification.test.ts`, and `tests/checks/error-table-sync.test.ts` for `lint` (TC-SYNC-007 classification half, TC-SYNC-008 in full, TC-SYNC-009 in full): exactly five `lint` rows with exact fields; `classifyDomainKind("lint", CODE)` and `classifyThrown({ kind: "lint", code })` exact-code round-trips; kind-only `"lint"` ambiguous (throws for `classifyDomainKind`, contains via `fallback.internal` for thrown, never first-row); wrong/missing/mismatched/non-string codes contained; both-direction drift mutations (machine lint-row removal; `lint` removed from `DOMAIN_KINDS`; doc-only/missing/empty/duplicate/malformed documented rows) with unchanged-copy controls; `config`/`state` regressions unchanged.
- [x] **1.6** Contracts data-only structure assertions for the two new files (TC-BOUND-001 contracts half): only type/interface/import/export/`as const` declarations; the ambient guard covers the new paths by **adding** them to its scope; synthetic violation control proves the rule live.

**Acceptance Criteria**:

- Must: NFR-5 measurable at the first boundary (5/5 exact rows, 0 drift both directions, 100% containment, 0 ambiguous kind-only selections); C-1/C-2/C-5 vocabulary compiles under strict TS with zero runtime imports. — PASSED (83/83 focused tests; error-table-sync entries=26 documented=26; `pnpm check` exit 0).
- Should: `classifyDomainKind` needs no code change (exact-code lookup is generic since GH-173) — record in the execution log if any change was needed. — PASSED (no change needed).

**Files and modules**:

- Code areas: `packages/core/src/contracts/pm-notes.ts` (new), `packages/core/src/contracts/registry.ts` (new), `packages/core/src/contracts/error-table.ts` (updated), `packages/core/src/contracts/index.ts` (updated), `doc/spec/features/feature-result-contract.md` (updated — five documented rows, D2), `tests/structure/error-table.test.ts`, `tests/behaviour/error-classification.test.ts`, `tests/checks/error-table-sync.test.ts` (updated), `tests/structure/inventory.json` (updated), conditionally `scripts/checks/error-table-sync.ts` (lint references only, additive).
- System docs: `doc/spec/features/feature-result-contract.md` (documented lint rows — binding sync fixture; lifecycle phase 7 reconciles the rest of the doc, never this section).

**Tests**:

- TCs implemented: TC-SYNC-007 (classification half), TC-SYNC-008, TC-SYNC-009, TC-BOUND-001 (contracts half).
- `bun test tests/structure/error-table.test.ts tests/behaviour/error-classification.test.ts tests/checks/error-table-sync.test.ts` → green incl. every mutation control.
- `bun run scripts/checks/error-table-sync.ts` → exit 0, non-zero counts both directions.
- `pnpm check` → exit 0.

**Completion signal**: `feat(GH-179): add pm-notes and registry vocabulary with synchronized lint error rows`

---

### Phase 2: Pure pm-notes conformance rules and rejection-class fixtures

**Goal**: The schema/variant conformance rules of C-1–C-3 as pure functions over parsed document values, proven at rule level against every rejection class, variant semantics, and opaque-extra positive control — before any command surface exists.

**Tasks**:

- [x] **2.1** Author `packages/core/src/domain/pm-notes-lint.ts` (D1, PIN-5): rule families in fixed order — parse-failure input → `lint.notes.malformed` (never a thrown crash); required-key presence (top-level + applicable phase entries + collection `text`) → `lint.keys.missing` naming all offenders; value-type conformance of schema-declared keys (wrong-typed top-level values, non-timestamp `started`/`completed` on applicable entries, wrong-typed collection `type`/`date`, wrong-typed `variant`) → `lint.notes.malformed`; unknown `variant` value → `lint.variant.unknown`; effective-variant required-phase presence (full 11 by default; LITE six when declared) → `lint.phases.incomplete` naming all missing phases. Opaque keys (non-canonical phase ids, extra entry keys, extra top-level keys) are never inspected (D11). Findings carry the classified identity, the named location (key / phase id / collection entry), and evidence data; zero I/O, zero ambient reads, no parser invocation.
- [x] **2.2** Author the fixture families under `tests/fixtures/pm-notes/**` (D5): `malformed/**` (unparseable orphaned-indentation document mirroring the GH-171 defect class; wrong-typed top-level values; non-timestamp typed phase values; wrong-typed collection entries — each with a `planted-payload-*` canary and a builder asserting the planted mutation), `keys/**` (one fixture per required-key omission at both levels; optional-only omission control), `variant/**` (unknown values incl. `compressed`/`LITE`/`" lite"`; wrong types; `full`/`lite`/absent controls; the six single-omission LITE fixtures; two-phase omission), `opaque/**` (extra phase keys with sequence/string values, extra entry keys, non-canonical ids, the committed GH-170 pm-notes as the real control). Committed read-only; any restore-step case self-materializes under `mkdtemp`.
- [x] **2.3** Author the rule-level halves of `tests/behaviour/pm-notes-lint-rejections.test.ts` and `tests/behaviour/pm-notes-lint.test.ts` (TC-LINT-001, TC-LINT-002, TC-LINT-003, TC-LINT-005, TC-LINT-006 rule halves; YAML is parsed at the test seam and parsed values/parse failures are handed to the pure rules): exact one-code mapping per fixture with canary sweep over findings and evidence; restored/valid controls in the same tests; unquoted-date-scalar acceptance (YAML 1.2 core); LITE single-omission exact naming + restoration passing; absent-`variant`-means-full; opaque extras and GH-170 real shapes pass; applicable-entry failures still caught (`lint.keys.missing` for missing `started`/`completed`, `lint.notes.malformed` for wrong-typed timestamps) while identical shapes on opaque keys pass.
- [x] **2.4** Author `tests/structure/pm-notes-contract.test.ts` (TC-LINT-006 shape half, TC-BOUND-001 tier half): the vocabulary constants equal the pinned sets (11 canonical, 6 LITE, 4 required keys); `contracts/pm-notes.ts` is data-only; `domain/pm-notes-lint.ts` imports no `node:*`/`bun:*`, no adapters/branding/config/CLI (additive detector rules, fixtures included).

**Acceptance Criteria**:

- Must: every rejection class of C-6 maps to exactly one pinned code at rule level (NFR-5 precondition); PIN-5 ordering is asserted (multi-defect fixture yields the first family's code deterministically). — PASSED (54/54 focused tests; 793 tests in `pnpm check`; fixtures cover 001/002/003/005/006 rule halves with canary + restored controls).
- Should: rule-level tests avoid constructing `CommandResult` envelopes — envelope assertions belong to Phase 3; record any shared-helper extraction in the execution log. — PASSED (no envelopes at rule level; shared parse/fixture helper `tests/behaviour/pm-notes-lint-support.ts`).

**Files and modules**:

- Code areas: `packages/core/src/domain/pm-notes-lint.ts` (new), `packages/core/src/domain/index.ts` (updated, re-export), `tests/fixtures/pm-notes/**` (new), `tests/behaviour/pm-notes-lint.test.ts`, `tests/behaviour/pm-notes-lint-rejections.test.ts`, `tests/structure/pm-notes-contract.test.ts` (new), `tests/structure/inventory.json` (updated).
- System docs: none.

**Tests**:

- TCs implemented: TC-LINT-001/002/003/005/006 (rule halves), TC-LINT-006 (shape half complete), TC-BOUND-001 (domain-tier detector rules added).
- `bun test tests/behaviour/pm-notes-lint.test.ts tests/behaviour/pm-notes-lint-rejections.test.ts tests/structure/pm-notes-contract.test.ts` → green incl. controls.
- `pnpm run check:boundaries`; `bun run scripts/checks/ambient-globals.ts` → exit 0.
- `pnpm check` → exit 0.

**Completion signal**: `feat(GH-179): add pure pm-notes conformance rules with rejection-class fixtures`

---

### Phase 3: `lint` command — target resolution, envelope, determinism

**Goal**: The read-only `lint` command with the pinned selector grammar (PIN-1), edge-owned parsing (D1/D4), the full envelope/exit surface (NFR-2), and determinism/read-only proofs (NFR-3) — completing every command-level lint TC.

**Tasks**:

- [x] **3.1** Author `packages/adapters/src/file/pm-notes-parser.ts` (D1): locate + read + YAML 1.2 core parse of a change ref's pm-notes file against injected filesystem facts (no ambient reads), returning `{ ok: true, value } | { ok: false, parseFailure }` with a safe location; the `yaml-parser.ts` limits pattern (size/node/depth/alias caps) applies; parse failures carry no file bytes.
- [x] **3.2** Author `packages/cli/src/commands/lint.ts` (`createLintCommandDefinition`, the `config.ts` precedent; D4, PIN-1): positional ref + additive `--pm-notes`/`--registry` flags; pm-notes target → edge parse → pure rules; registry target → open the state store through the CLI edge with injected identity and read verified `phase.transition` records + the derived projection (absent store → verified-empty PASS; torn/mismatch/key-set → existing `state.*` identities); both-mode checks pm-notes then registry, first failure wins (PIN-1). Handlers return data/error, never write streams, never choose exit codes; brand binary name arrives via the injected brand (zero product literals).
- [x] **3.3** Register and compose: `commands/index.ts` exports the lint definition; `edge.ts` composes it beside `config` (same registration pattern). Lint failures ride the existing classification chain (`classify.ts`) and project to exit 1 (user category); registry storage failures keep their platform `state.*` projection (exit 2); `--json` through the single serializer, always (NFR-2).
- [x] **3.4** Complete the command-level halves of `pm-notes-lint.test.ts` and `pm-notes-lint-rejections.test.ts` through `runCli` with injected deps (test-plan §4.1: brand, injected clock, `newRunId`, secrets, program, injected paths/state root; no spawned processes): every rejection fixture → its exact pinned code, exit 1, valid single envelope, no `data`, canary sweep over stdout/stderr; positive controls exit 0 (TC-LINT-001/002/003/005/006 command halves).
- [x] **3.5** Author the target-resolution suite (TC-LINT-004): missing pm-notes → `lint.target.missing` exit 1 no mutation; absent registry → exit 0 with the explicit verified-empty evidence marker, asserted distinct from `lint.target.missing`; present-but-torn registry (fixture from the GH-174 harness) → `state.store.torn`, never a verified-empty pass; valid pm-notes + valid registry (both-mode) → pass. The four outcomes asserted distinct in one suite.
- [x] **3.6** Author `tests/behaviour/pm-notes-lint-determinism.test.ts` (TC-LINT-009, NFR-3): three replays per fixture → identical identity/category/evidence class/location; ambient stubs (environment, clock, randomness) that throw leave verdicts unchanged; AST ambient scan over contracts + domain; target-byte and state-directory digests before/after standalone lint → byte-identical, and a recording edge proves zero writes/appends/renames/truncations/index writes/fence acquisitions; a writing-control implementation (cache file) is caught by the digest/recorder.
- [x] **3.7** Author the lint envelope/exit suite additions (TC-LINT-010, TC-SYNC-007 trigger half): every invocation class (success; each of the five codes through its trigger; unknown-flag `fallback.invocation`) in `--json` and human modes → exactly one envelope, `assertEnvelopeContract` empty, documented error fields, exit ∈ {0, 1, 2} with user failures at 1, human success output, failure diagnostics on the error stream, single-serializer authorship.

**Acceptance Criteria**:

- Must: AC-L1's lint surface complete for the standalone path (every malformed class classified + exit 1 + zero writes); NFR-2 and NFR-3 fully measurable for `lint`; C-3 target semantics (missing pm-notes vs verified-empty registry vs torn) proven distinct. — PASSED (99/99 focused tests; 820 tests in `pnpm check`; torn registry oracle asserts exit 2 exactly).
- Should: the both-mode failure order (PIN-1) is asserted with a two-defect fixture (bad pm-notes + torn registry → pm-notes code). — PASSED (both-mode malformed pm-notes + torn registry fixture returns `lint.notes.malformed` at exit 1).

**Files and modules**:

- Code areas: `packages/adapters/src/file/pm-notes-parser.ts` (new), `packages/cli/src/commands/lint.ts` (new), `packages/cli/src/commands/index.ts` (updated), `packages/cli/src/edge.ts` (updated), `packages/cli/src/classify.ts`/`projection.ts` (extended only if the chain demands — additive), `tests/behaviour/pm-notes-lint.test.ts`, `pm-notes-lint-rejections.test.ts`, `pm-notes-lint-determinism.test.ts` (new/updated), `tests/golden/helpers.ts` (reused), `tests/structure/inventory.json` (updated).
- System docs: none (the command-registry row already names the surface; lifecycle phase 7 reconciles guides).

**Tests**:

- TCs implemented: TC-LINT-001..006 (command halves; TC-LINT-004 in full), TC-LINT-009, TC-LINT-010, TC-SYNC-007 (lint triggers), TC-BOUND-002 (lint composition half).
- `bun test tests/behaviour/pm-notes-lint.test.ts tests/behaviour/pm-notes-lint-rejections.test.ts tests/behaviour/pm-notes-lint-determinism.test.ts tests/behaviour/error-classification.test.ts` → green.
- `pnpm check` → exit 0.

**Completion signal**: `feat(GH-179): add lint command with target resolution, envelope, and determinism proofs`

---

### Phase 4: Variant-era corpus acceptance fixture and exclusion manifest

**Goal**: The AC-L6/NFR-4 corpus fixture — derived from folder dates plus the exclusion manifest (PIN-2), never a frozen file list — green over the committed boundary and proven live with drift, manifest, and schema-mutation controls.

**Tasks**:

- [x] **4.1** Commit the exclusion manifest `tests/fixtures/pm-notes/corpus-exclusions.json` (PIN-2, exactly the GH-171 pm-notes path) and author the corpus enumerator: select `doc/changes/*/*--*/chg-*-pm-notes.yaml` whose change-folder month is ≥ 2026-10, minus the manifest; membership assertions — non-empty; includes GH-170, GH-172, GH-173, GH-174, GH-181, **and GH-179's own pm-notes** (A-T8: the boundary includes this change's document, which must therefore conform); GH-171 excluded **only** by the manifest; legacy-era folders absent. (manifest + `tests/behaviour/pm-notes-corpus-support.ts` + membership tests green)
- [x] **4.2** Author `tests/behaviour/pm-notes-corpus.test.ts` — the acceptance half (TC-LINT-007): lint every boundary file through the command with the effective-variant default → zero failures, exit 0 each; per-file parseability, required keys with declared types, effective-variant required phases, opaque extras accepted (GH-170's sequence/string extras as the positive control); committed files read strictly read-only (D5).
- [x] **4.3** Author the boundary and manifest guards (TC-LINT-008 corpus half): in temp copies — a newly added variant-era file is picked up; a file moved to a `2026-09` folder leaves the set; a malformed injection and a missing-required-phase injection each fail the scan (the fixture is live); the manifest guard (exactly one entry; the path exists; the file is genuinely unparseable — a second entry, or an entry naming a parseable file, fails).
- [x] **4.4** Author the corpus half of the schema-mutation control (TC-LINT-008, GAP-5): in a temp copy, change the pinned LITE set inside the schema module → the corpus fixture re-evaluates and a previously passing lite document fails; assert the corpus test contains no hardcoded duplicate of the LITE set (it reads the schema constant). The phase-fixture half of this control completes in Phase 6.

**Acceptance Criteria**:

- Must: AC-L6 demonstrated — zero failures over the boundary minus the manifest, with "reject malformed" and "accept real files" both proven non-vacuous; NFR-4's boundary fixture permanent (it runs in the existing `ts-test`-wired suite; D7). — PASSED (15/15 focused tests; 6 corpus members GH-170/172/173/174/181/179, GH-171 manifest-only exclusion, malformed and missing-phase injections fail; `pnpm check` exit 0 with 835 tests).
- Should: the enumerator exposes its derived member list in the failure message so corpus drift is diagnosable from CI logs alone. — PASSED (failing-entry message carries the full `members:` list).

**Files and modules**:

- Code areas: `tests/fixtures/pm-notes/corpus-exclusions.json` (new), `tests/behaviour/pm-notes-corpus.test.ts` (new), `tests/structure/inventory.json` (updated if helper modules are added).
- System docs: none.

**Tests**:

- TCs implemented: TC-LINT-007 (full), TC-LINT-008 (corpus + manifest halves; legacy write-path and phase-half of the schema-mutation control complete in Phase 6).
- `bun test tests/behaviour/pm-notes-corpus.test.ts` → green incl. every temp-copy control.
- `pnpm check` → exit 0.

**Completion signal**: `test(GH-179): pin variant-era corpus acceptance fixture with exclusion manifest guards`

---

### Phase 5: Delivery registry over the state port

**Goal**: The registry record module composing the injected GH-174 store port (D3) — append-only `phase.transition` records with declared key sets, verified classified reads, and the atomically replaced derived projection (PIN-3) — with ledger-safety failures proven at registry level.

**Tasks**:

- [x] **5.1** Author `packages/core/src/state/registry.ts` (D1/D3): `appendPhaseTransition` (acquire fence → append one `phase.transition` record with the registry's declared key set and injected timestamp → release; failure paths leave `not_landed` semantics to the state layer and append nothing); `readChangeTransitions` (verified read with key-set assertions; torn/schema/key-set failures surface as the existing `state.*` identities; absent store → verified-empty); `replacePhaseProjection` / `rebuildPhaseProjection` (atomic `replaceDocument` of `phase-state.<REF>.json` with the pure ledger fold; rebuildable; PIN-3 shape). Imports `./contracts` and own state modules only; zero runtime APIs (the driver edge stays the only one).
- [x] **5.2** Author the registry-level suite `tests/behaviour/phase-registry.test.ts` — record/projection half (TC-PHASE-009): every landing append produces exactly one record of kind `phase.transition` with the pinned payload keys (reason present on reopen records only, absent on complete); append-only prefix snapshot (earlier lines byte-identical after later transitions; no in-place rewrite; no prune/delete surface); the verified fold equals the projection content; corrupt/delete the projection → rebuilds from ledger truth to the same fold; the projection is not itself a record kind (ledger kinds asserted `["phase.transition"]` only); no-op invocations at API level append nothing.
- [x] **5.3** Author the read-safety half (TC-PHASE-007): torn fixtures generated from verified bytes by named mutations (payload byte flip, framing break, sequence gap) with `planted-payload-*` canaries → exactly `state.store.torn` with a safe location (path + record position), zero values, no canary in raw or serialized output, never a verified-empty marker; schema-mismatch header/record → `state.schema.mismatch` with no coercion; absent declared key on read → `state.keys.missing` naming keys, no default substitution; absent registry → explicit verified-empty, distinct from torn; rebuild storage-I/O fault → exactly `state.write.failed` (transient, retryable, `not_landed`) with no stale read; a mutating append attempted over torn bytes is refused with zero records; detection-disabled control exposes the planted canary (fixtures proven live). Reuse `tests/fixtures/state/harness.ts` (temp roots, injected edge/clock, named faults — D5).
- [x] **5.4** Extend `tests/structure/registry-imports.test.ts` (TC-BOUND-001 state-tier half): the state-import detector covers `packages/core/src/state/registry.ts` — only `#contracts`/`./contracts` and own state modules; runtime APIs only in `state/driver/runtime-edge.ts`; negative + clean controls.

**Acceptance Criteria**:

- Must: AC-L5 at registry level (verified-only reads, classified `state.*` failures, zero value-returns from unverified bytes); C-5 record vocabulary exact; the projection fold-stable per PIN-3. — PASSED (15/15 registry tests + 4/4 import-tier tests; torn/framing/sequence/checksum mutations return `state.store.torn` with safe locations; schema/key-set verified-empty distinct; `pnpm check` exit 0 with 853 tests).
- Should: registry API returns the state layer's evidence untouched (verification classes, rebuild reports) so Phase 6/7 assertions can reuse it verbatim — record any evidence re-wrapping in the execution log. — PASSED (no re-wrapping: `PhaseTransitionsRead.evidence` and rebuild evidence are the store's `StateReadEvidence` values).

**Files and modules**:

- Code areas: `packages/core/src/state/registry.ts` (new), `packages/core/src/state/index.ts` (updated — re-export, no surface change to the GH-174 port), `tests/behaviour/phase-registry.test.ts` (new), `tests/structure/registry-imports.test.ts` (new), `tests/structure/inventory.json` (updated).
- System docs: none.

**Tests**:

- TCs implemented: TC-PHASE-007 (full), TC-PHASE-009 (registry level), TC-BOUND-001 (state-tier detector half).
- `bun test tests/behaviour/phase-registry.test.ts tests/structure/registry-imports.test.ts tests/behaviour/state-conformance.test.ts` → green (the last proves no GH-174 regression).
- `pnpm run check:boundaries`; `pnpm check` → exit 0.

**Completion signal**: `feat(GH-179): add delivery registry over the state port with derived phase projection`

---

### Phase 6: `phase` command I — grammar, landing/no-op transitions, entry creation

**Goal**: The `phase complete|reopen` write path end to end: grammar validation before state inspection (D4), staged write-path lint (PIN-7), ledger-authoritative idempotency (PIN-6), opaque-preserving document writes (PIN-8), and matrix rows 1–5 + 9.

**Tasks**:

- [x] **6.1** Author `packages/cli/src/commands/phase.ts` (`createPhaseCommandDefinition`, the `config.ts` precedent; D4): subcommands `list <ref>`, `complete <ref> <phase>`, `reopen <ref> <phase> <reason>`; **grammar first** — missing/empty reason and phase ids outside `CANONICAL_PHASE_IDS` reject with the existing `input.value.rejected` row before target resolution, state inspection, or mutation (rows 7–8 semantics; the ordering proof lands in Phase 7). Mutating flow: resolve + parse the pm-notes target at the edge (`lint.target.missing` when absent) → apply the intended entry change in memory (PIN-8 document-edit discipline) → run the pure rules over the **staged** document (PIN-7) → decide idempotency from the registry ledger fold (PIN-6) → on landing: append one `phase.transition` record, write the document (only the target entry's `started`/`completed` changed; opaque extras preserved), replace the projection. Injected clock for all timestamps; brand via injection; handlers never write streams or choose exits.
- [x] **6.2** Implement the transition outcomes (C-4 rows 1–5, 9; PIN-4 evidence): row 1 landing (entry completed with the injected timestamp; one record; operation `complete`); row 2 no-op success — exit 0, zero records, entry unchanged, `{outcome: "no-op", basis: "already-completed", completedAt}`; row 3 re-completion after reopen lands a new record; row 4 reopen landing with the exact reason recorded and surfaced; row 5 reopen-on-open (including absent-from-document phases) — exit 0, zero records, **no entry created**, `{outcome: "no-op", basis: "not-completed"}` with the reason echoed in evidence only; row 9 complete-on-absent canonical phase creates a valid `{started, completed}` entry and lands, with the `{class: "outside-required-set"}` advisory when the phase is outside the declared variant's required set.
- [x] **6.3** Register and compose: `commands/index.ts` + `edge.ts` (lint + phase alongside config); the state store opens through the CLI edge with injected identity; grammar rejections and lint failures ride the existing classification/projection chain (user → exit 1).
- [x] **6.4** Author `tests/behaviour/phase-transitions.test.ts` and `tests/behaviour/phase-idempotency.test.ts` (TC-PHASE-001, TC-PHASE-002, TC-PHASE-004; test-plan §4.1 harness — injected clock, temp state root, raw ledger access, §4.2 non-vacuity): rows 1–5 and 9 with exit code + ledger-record delta + evidence class asserted together; no-op cells additionally assert unchanged target bytes and no entry creation; row 9 asserts pre-invocation key absence, valid entry creation, one record, the outside-set advisory, its distinctness from the row-6 advisory shape, and the unrelated-missing-phase block (`review_fix` + `dor_check` both absent → completing `review_fix` fails `lint.phases.incomplete` naming `dor_check`, lands nothing); controls that append on no-op or append without creating the entry are caught; TC-PHASE-009 command-level re-assertion (record payload, fold = `phase list` state, prefix immutability through the command path).
- [x] **6.5** Complete the deferred TC-LINT-008 controls (write-path halves): a mutating phase invocation against the legacy-era fixture (pre-2026-10, missing `delivery_mode`) in a temp root fails `lint.keys.missing` naming `delivery_mode` — the schema binds legacy documents at write time though they sit outside the corpus; the phase-fixture half of the schema-mutation control (temp-copy LITE-set change → phase fixture re-evaluates).

**Acceptance Criteria**:

- Must: AC-L2 for rows 1–5 and 9 (every redundant cell: exit 0, zero additional records, no-op evidence); AC-L1's write-path blocking for the structural classes exercised here (unparseable, missing keys, missing target — the full per-class matrix completes in Phase 7 with TC-PHASE-006); NFR-2 for the mutation surface. — PASSED (13/13 phase transition/idempotency tests + 17/17 corpus tests; no-op cells assert exit 0 + zero transition delta + unchanged bytes; row 9 creates entries with the outside-set advisory; `pnpm check` exit 0 with 868 tests).
- Should: the document write preserves byte-layout of untouched regions where the YAML serializer allows it; value-faithfulness of opaque extras is the asserted invariant (PIN-8), not byte identity — record the achieved guarantee in the execution log. — PASSED (value-faithfulness asserted: the `full-open` delivery entry keeps `reopened`/`commits` and the `notes` extra key through a landing; untouched-region byte identity is not asserted).

**Files and modules**:

- Code areas: `packages/cli/src/commands/phase.ts` (new), `packages/cli/src/commands/index.ts` (updated), `packages/cli/src/edge.ts` (updated), `tests/behaviour/phase-transitions.test.ts`, `tests/behaviour/phase-idempotency.test.ts` (new), `tests/behaviour/pm-notes-corpus.test.ts` (updated — task 6.5 controls), `tests/fixtures/phase/**` (new; committed read-only full-11 and lite-6 documents per D5), `tests/structure/inventory.json` (updated).
- System docs: none.

**Tests**:

- TCs implemented: TC-PHASE-001, TC-PHASE-002, TC-PHASE-004 (full), TC-PHASE-009 (command-level re-assertion), TC-LINT-008 (write-path + schema-mutation phase halves — TC complete), TC-BOUND-002 (phase composition half).
- `bun test tests/behaviour/phase-transitions.test.ts tests/behaviour/phase-idempotency.test.ts tests/behaviour/pm-notes-corpus.test.ts` → green incl. every control.
- `pnpm check` → exit 0.

**Completion signal**: `feat(GH-179): add phase command write path with idempotent transitions and entry creation`

---

### Phase 7: `phase` command II — out-of-order advisory, grammar-before-state ordering, write-path lint matrix, phase envelope

**Goal**: Finish the nine-row idempotency matrix (rows 6–8) with the advisory evidence vocabulary (PIN-4), prove grammar validation precedes state inspection non-vacuously (D4, AC-L3), complete the staged write-path blocking matrix over every malformed class (PIN-7, AC-L1), and close the phase-surface envelope/exit projection (NFR-2) — the last command-level phase TCs.

**Tasks**:

- [ ] **7.1** Implement and assert matrix row 6 — the out-of-order advisory (TC-PHASE-003, C-4 row 6, PIN-4): extend `tests/behaviour/phase-transitions.test.ts` with a full-variant fixture where every phase earlier than `dod_check` is completed except `quality_gates`; `phase complete REF dod_check` → exit 0, one record, landed, advisory evidence `{ "class": "earlier-open", "phases": ["quality_gates"] }` naming exactly the still-open earlier phases of the effective variant; after `quality_gates` is completed then reopened, a later completion still names it (the advisory follows current phase state, never a one-time snapshot); the ordered control (all earlier phases completed) lands with no advisory; a lite fixture's advisory names only earlier open phases of the pinned LITE set (an open phase outside the set never appears); the out-of-order invocation is never rejected.
- [ ] **7.2** Prove grammar-before-state ordering (TC-PHASE-005, AC-L3, rows 7–8, D4): author `tests/behaviour/phase-rejections.test.ts` — row 7 (`phase reopen REF PHASE` with the reason missing and with an empty reason) and row 8 (`phase complete REF unknown_phase`; `phase reopen REF ci_remediation REASON` — a real corpus opaque key is not command-addressable) each against a valid target, a malformed target, and a missing target → exactly `input.value.rejected`, category `user`, `consequence: not_landed`, exit 1, zero ledger records, target bytes unchanged, never a `lint.*` or `state.*` code; a recording state/read seam asserts zero state inspections (grammar precedes target resolution and state inspection); positive controls (`reopen` with a reason on a completed phase; `complete` on a canonical open phase) succeed and mutate; a control that validates the reason after state inspection is caught — the missing-target case would return `lint.target.missing`, proving the ordering assertion live.
- [ ] **7.3** Complete the write-path staged-lint matrix (TC-PHASE-006, AC-L1, PIN-7): author `tests/behaviour/phase-write-path-lint.test.ts`, reusing the Phase 2/3 fixture families — every malformed class (unparseable, wrong-typed top-level value, non-timestamp typed value, missing top-level key, entry missing `started`/`completed`, unknown variant, LITE missing phase, missing pm-notes target) through `phase complete` and, where the fixture has a completed phase, `phase reopen`, with the mutating target chosen so it is not the defective or omitted phase (otherwise the staged entry change would legitimately repair the defect — A-T9); each returns exactly the pinned code the standalone lint returned for that fixture, exit 1, `not_landed`, a valid `--json` envelope, zero new `phase.transition` records, unchanged target bytes, no append, and any acquired fence released without an append; the valid control mutates with exactly one new record (the mutation path is live); the missing-target case fails `lint.target.missing` (not a state code); the unrelated-missing-phase case fails `lint.phases.incomplete` naming the omitted phase and lands nothing.
- [ ] **7.4** Close the phase-surface envelope and exit projection (TC-PHASE-008, NFR-2; TC-SYNC-007 write-path triggers): author `tests/behaviour/phase-envelope.test.ts` — `phase list REF` on a populated registry → exit 0, the derived per-change phase state (PIN-3 shape), zero ledger mutation; on the absent registry → verified-empty success with explicit evidence; success and failure invocations drawn from TC-PHASE-001/002/005/006/007 in `--json` and human modes → exactly one envelope, `assertEnvelopeContract` empty, no `data` on failure, documented error fields; exit matrix exact — success 0; `input.value.rejected`, `lint.*`, and user-category `state.*` failures 1; platform `state.*` failures (torn/schema/keys, read through `phase list` over the Phase 5 fixtures) 2; nothing outside `{0,1,2}`; human mode shows the same exits with failure diagnostics on the error stream; the unknown-command/flag path still returns `fallback.invocation`; the five lint codes round-trip through their write-path triggers with exact documented fields (TC-SYNC-007 complete).

**Acceptance Criteria**:

- Must: all nine matrix cells asserted (rows 6–8 complete the matrix); AC-L3's ordering proven non-vacuously (recording seam + wrongly-ordered control); AC-L1's write-path blocking complete for every malformed class with the same pinned identity as standalone lint; NFR-2 measurable across the whole `phase` surface.
- Should: advisory emission reuses the Phase 6 evidence plumbing — if a second advisory emitter is required, record the extraction in the execution log (PIN-4 is the single evidence vocabulary).

**Files and modules**:

- Code areas: `packages/cli/src/commands/phase.ts` (updated — advisory computation over the effective variant's required set; ordering guards if the Phase 7 proofs reveal a gap), `tests/behaviour/phase-transitions.test.ts` (updated — row 6), `tests/behaviour/phase-rejections.test.ts` (new), `tests/behaviour/phase-write-path-lint.test.ts` (new), `tests/behaviour/phase-envelope.test.ts` (new), `tests/golden/helpers.ts` (reused), `tests/structure/inventory.json` (updated).
- System docs: none (documented rows shipped in Phase 1; lifecycle phase 7 reconciles guides — Phase 11 here).

**Tests**:

- TCs implemented: TC-PHASE-003 (full), TC-PHASE-005 (full), TC-PHASE-006 (full), TC-PHASE-008 (full), TC-SYNC-007 (write-path trigger half — TC complete).
- `bun test tests/behaviour/phase-transitions.test.ts tests/behaviour/phase-rejections.test.ts tests/behaviour/phase-write-path-lint.test.ts tests/behaviour/phase-envelope.test.ts` → green incl. every control.
- `pnpm check` → exit 0.

**Completion signal**: `feat(GH-179): complete phase matrix with advisories, ordering proofs, and write-path lint`

---

### Phase 8: Boundary and structure completion, packed Node/Bun probe, feature doc, aggregate green

**Goal**: Close NFR-1 end to end — tier/purity/runtime/literal gates extended to every new path by adding rules and fixtures only (D7), the CLI seam proven, the packed `core` surface consumed on Node and Bun (the single spawned-process exception, GAP-2), the feature doc authored with its forbidden-literals registration (D8) — and the full aggregate battery green including GH-179's own pm-notes in the corpus.

**Tasks**:

- [ ] **8.1** Complete TC-BOUND-001: extend the boundary harness, import detectors, and ambient guard **by adding rules and fixtures only** (D7) to cover `contracts/pm-notes.ts`, `contracts/registry.ts`, `domain/pm-notes-lint.ts`, `state/registry.ts`, `adapters/src/file/pm-notes-parser.ts`, `commands/lint.ts`, `commands/phase.ts` — contracts data-only; domain pure (no `node:*`/`bun:*`, no adapters/branding/config/CLI imports; parser never invoked in domain); state imports only `#contracts`/`./contracts` and own modules; runtime APIs only in `state/driver/runtime-edge.ts` (D3); AST runtime-conditional scan over contracts + domain with a synthetic violation control; zero stream writes, `process.exit`, or exit-digit literals in core; forbidden-literal and exit-code-literal checks green with seeded-violation controls; the boundary fixture-coverage meta-check fails when one new fixture is deleted in a temp copy (every rule has a failing fixture and a clean control).
- [ ] **8.2** Complete TC-BOUND-002: update `tests/structure/cli-edge-seam.test.ts` — both commands registered in `commands/index.ts` and composed in `edge.ts` following the `config.ts` precedent; target files read and parsed at the CLI surface edge (the adapters parser composed by the CLI, never by core); contracts/domain receive parsed values or parse-failure inputs only; handlers return data/error without writing streams or choosing exits (the CLI edge owns rendering and the `{0,1,2}` projection); the brand binary name arrives through the injected brand — zero product literals in the new command files; a seeded core-imports-CLI violation is caught.
- [ ] **8.3** Author the feature doc `doc/spec/features/feature-pm-notes-lint-and-phase-transitions.md` (D8) describing the delivered surface — schema/variant vocabulary, `lint` command with the PIN-1 selector, `phase` command and the nine-row matrix, registry records and the PIN-3 projection, PIN-4 evidence vocabulary, the five error rows, the corpus boundary — and register it in `scripts/checks/forbidden-literals.registry.json` in the same change (GH-173/174 precedent). No `ados_distribution` marker is required: `doc/spec/**` sits outside the doc-distribution guard's scope (`doc/guides/`, `doc/templates/`, and the standalone docs).
- [ ] **8.4** Extend `tests/checks/packed-state.test.ts` (TC-BOUND-003, GAP-2): `pnpm build` first; pack `core`, install the tarball into an isolated consumer (hermetic HOME, `--ignore-workspace`, explicit cleanup); import `@delivery-os/core/contracts` and `@delivery-os/core/state` under Node and Bun; read runtime values (`PM_NOTES_VARIANT_VALUES`, `LITE_REQUIRED_PHASES`) so a type-only import cannot pass vacuously; perform a minimal append/read through the public state surface asserting the `phase.transition` record shape is accepted; assert no new subpath beyond the declared surfaces, no ambient read under stubbed environment/clock, and no unsupported dependency in the packed manifest; the non-existent-subpath negative probe fails resolution.
- [ ] **8.5** Aggregate green and self-corpus confirmation: run the full evidence battery — every focused suite from the traceability table, `bun test` (all layers), `pnpm run check:boundaries`, `bun run scripts/checks/{error-table-sync,ambient-globals,forbidden-literals,exit-code-literals,workspace-entrypoints}.ts`, `pnpm check`, `git diff --check`, `git status --porcelain` (clean tree) — and confirm the corpus boundary includes **GH-179's own pm-notes** (A-T8: `variant` absent → effective full, all 11 phases present) passing with zero failures.

**Acceptance Criteria**:

- Must: NFR-1 fully measured — 0 tier violations, 0 runtime-conditionals in contracts/domain, 0 runtime APIs outside the driver edge, 0 CLI rendering/exit decisions in core, 0 packed-surface failures on either runtime; no existing gate weakened (extensions only add rules and fixtures, D7); the feature doc authored and registered in the same change (D8).
- Should: `ci-topology` stays green with no `ci.yml` change; any discovered wiring need escalates to PM before touching CI (D7).

**Files and modules**:

- Code areas: `tests/boundaries/**` (updated — additive rules + fixtures), `tests/structure/cli-edge-seam.test.ts` (updated), `tests/structure/pm-notes-imports.test.ts`, `tests/structure/registry-imports.test.ts` (completions), `tests/structure/inventory.json` (updated), `tests/checks/packed-state.test.ts` (updated), `scripts/checks/forbidden-literals.registry.json` (updated — feature-doc row), `doc/spec/features/feature-pm-notes-lint-and-phase-transitions.md` (new).
- System docs: `doc/spec/features/feature-pm-notes-lint-and-phase-transitions.md` (new; Phase 11 reconciles it if post-review fixes drifted anything).

**Tests**:

- TCs implemented: TC-BOUND-001 (complete), TC-BOUND-002 (complete), TC-BOUND-003 (full) — with this phase, **all 25 TCs are green**.
- `bun test tests/structure tests/boundaries tests/checks/packed-state.test.ts` → green; `pnpm run check:boundaries` → exit 0; `bun run scripts/checks/ambient-globals.ts` → exit 0; `pnpm check` → exit 0.

**Completion signal**: `test(GH-179): complete boundary, packed Node/Bun probe, and aggregate gates with feature doc`

---

### Phase 9: Independent review support (lifecycle phase 8 — review_fix inputs; PM-scheduled, NOT `@coder`-executed)

**Goal**: Hand `@reviewer` a complete, reproducible audit package for the lifecycle review gate — read-only analysis of Phases 1–8; no new code, no new TCs.

**Tasks**:

- [ ] **9.1** Consolidate the review input pack: the per-phase commit list (the eight completion signals), per-phase green criteria with the captured `pnpm check` logs, the 25-TC coverage map (traceability table → suites → execution commands), and the pinned-decision index (PIN-1..PIN-8, D1..D11) so the reviewer can challenge spelling/placement decisions without reshaping TC behaviour, assertions, or AC mappings (A-T1).
- [ ] **9.2** Produce the scope and protected-path proof: `git diff --name-only origin/main-tools...HEAD` touches no `.opencode/**`, `.ados-claude/**`, `.ai/**`, `scripts/*.sh`, `tools/**`, or CI topology files (D7), and nothing outside this plan's Files-and-modules lists; each phase's staged set matched its explicit staging list (D6).
- [ ] **9.3** Record the verdict and route findings through the review artifact workflow (`review/review-iter-1.md` in this folder, the GH-174 pattern): implementation findings → Phase 10; any challenge to PIN-5..PIN-8 or a D-binding → PM/`@decision-advisor` (a decision record if accepted) — never a silent alternative.

**Acceptance Criteria**:

- Must: a traceable PASS or actionable findings against spec, test plan, and this plan, with no fabricated test or owner-approval claims; missing evidence or a failed negative control is unfinished work, never a downgraded severity.

**Files and modules**:

- Code areas: none (read-only analysis of Phases 1–8).
- System docs: none during analysis.

**Tests**:

- No new TCs; the reviewer re-runs questionable evidence via the recorded commands (and may ask `@runner`) rather than assuming a passing report.

**Completion signal**: independent verdict recorded in `review/review-iter-1.md`; PASS advances via Phase 10-not-required to Phase 11, findings activate Phase 10. (No code commit; PM-scheduled gate.)

---

### Phase 10: Post-review remediation (conditional; lifecycle phase 8 loop; PM-scheduled)

**Goal**: Close accepted review or gate findings without expanding scope or losing regressions; skipped with an explicit not-required record when Phase 9 returns PASS.

**Tasks**:

- [ ] **10.1** If findings exist: reproduce each through the relevant TC fixture or negative control first, and add the missing regression **before** the smallest fix; behavior outside the accepted lint/phase/registry slice stays unchanged.
- [ ] **10.2** Fix code, fixtures, and matching docs together: any error-table change carries its documented row in the same fix (sync stays green in both directions, D2); any accepted challenge to a PIN or D-binding is resolved through PM/`@decision-advisor` and recorded as a plan revision — never applied silently.
- [ ] **10.3** Re-run the affected focused suites, the full `pnpm check` battery, and the independent re-review until PASS; if no findings, record this phase not-required backed by the Phase 9 PASS — never claim fixes that were not executed.

**Acceptance Criteria**:

- Must: all accepted findings closed with the affected ACs still traceable and previously green suites still green; no unresolved blocker, waived check, or undocumented scope expansion.

**Files and modules**:

- Code areas: only affected Phase 1–8 files and their regression tests.
- System docs: lockstep with code when behavior changes (a documented row in the same commit as any table change).

**Tests**:

- Reproduce the failing TC cases and controls; re-run the full 25-TC evidence set before finalization.

**Completion signal**: reviewer PASS after fixes (`fix(GH-179): <finding remediation>` per accepted batch), or an explicit not-required record backed by the Phase 9 PASS. (PM-scheduled; conditional.)

---

### Phase 11: Documentation and spec synchronization (lifecycle phase 7 — system_spec_update; `@doc-syncer`; PM-scheduled)

**Goal**: Reconcile `doc/spec/**`, the planning registry, guides, and the glossary with the delivered implementation — every touchpoint the spec's Related section names, plus this change's own first feature-spec doc. (The canonical lifecycle orders system_spec_update before review; this plan schedules reconciliation after the review loop so docs reflect post-fix reality — the PM owns the actual gate ordering.)

**Tasks**:

- [ ] **11.1** `doc/spec/features/feature-pm-notes-lint-and-phase-transitions.md` (authored Phase 8 — this change's own feature-spec doc): verify against the final post-review implementation; correct any drift; keep the `scripts/checks/forbidden-literals.registry.json` row current.
- [ ] **11.2** `doc/spec/features/feature-result-contract.md`: the five documented lint rows are the binding sync fixture shipped in Phase 1 and are **never rewritten** here (D2); reconcile the remainder — envelope/exit invocation classes now include the `lint` and `phase` surfaces.
- [ ] **11.3** `doc/spec/features/feature-state-layer.md`: record the first consumer — the delivery registry's `phase.transition` records with declared key sets and the `replaceDocument`-based derived projection (`phase-state.<REF>.json`, PIN-3) as a consumption example of the GH-174 port.
- [ ] **11.4** `doc/spec/features/feature-monorepo-scaffold-toolchain.md`: extend the covered-path/tier-guard enumerations with the new modules (the GH-174 F5 reconciliation precedent).
- [ ] **11.5** `doc/planning/oss-tooling/cli-command-registry.md`: mark the `ados lint` and `ados phase` rows delivered — the PIN-1 target selector, `phase list|complete|reopen` grammar, and the lint-vs-verify terminology.
- [ ] **11.6** `doc/planning/oss-tooling/backlog.md` and `doc/planning/oss-tooling/backlog-ranking.md`: M0-S10 delivered (position 6 — delivered before verify change, GH-177).
- [ ] **11.7** `doc/guides/change-lifecycle.md`: the canonical 11 phases remain the `full` variant's set; add the LITE variant relationship and the operating-model note that lifecycle agents migrate onto `ados phase` (a note here — agent-prompt adoption itself stays out of scope, NG-2); the file keeps its existing `ados_distribution` marker.
- [ ] **11.8** `doc/overview/glossary.md`: add/refresh entries in the existing one-line table style — pm-notes schema, delivery registry, variant (`full`/`lite`), `phase.transition`, corpus boundary/exclusion manifest — each linked to the feature doc.
- [ ] **11.9** Cross-reference sweep: ADR-0003 is referenced, not rewritten (decision records are project-specific); every link touched by 11.1–11.8 resolves; no other `doc/spec/**` page claims lint/phase behavior that no longer holds.

**Acceptance Criteria**:

- Must: every Related-section touchpoint reconciled or explicitly recorded unchanged; the documented-table section byte-untouched; the sync check green after reconciliation; no cross-reference drift.
- Should: glossary entries stay single-sentence definitions per the existing table style.

**Files and modules**:

- Code areas: none.
- System docs: all nine paths above (updated; 11.1 verified).

**Tests**:

- `bun run scripts/checks/error-table-sync.ts` → exit 0, non-zero counts both directions, after the edits; `bash scripts/.tests/test-doc-distribution.sh` → green (no marker-bearing doc lost its marker); `pnpm check` → exit 0.

**Completion signal**: `docs(GH-179): reconcile system spec, planning, guides, and glossary with delivered lint and phase surfaces` (@doc-syncer; PM-scheduled)

---

### Phase 12: Finalize and release (lifecycle phases 9–11 — quality_gates, dod_check, pr_creation; PM-scheduled)

**Goal**: A fully gated, versioned, evidenced open-PR handoff; publishing, merge, and owner acceptance remain outside this change.

**Tasks**:

- [ ] **12.1** Version bump per repo conventions (D9): author `.changeset/pm-notes-lint-minor.md` for the publishable fixed group (lockstep `changesets-group` config; the `state-layer-minor.md` precedent); `testkit` excluded; no hand-bumped versions; nothing publishes in this change; the owner may amend at PR review (A-T7).
- [ ] **12.2** Evidence artifact (D10): author `chg-GH-179-evidence.md` in this folder — per-phase commits and green criteria, final gate consolidation (all 25 TCs with execution commands and HEAD), the TC coverage map, and rollback instructions: the change is fully additive, so a single-PR revert removes the contracts rows and vocabulary, domain rules, registry module, commands, tests/fixtures, feature doc and its registry row, changeset, and doc edits together; **never roll back one side of the error-table sync**; re-run baseline checks after any rollback.
- [ ] **12.3** Owner-facing PR handoff notes (both required): (1) the **GH-171 pm-notes** remains a known-unparseable historical artifact excluded solely by the corpus manifest — its repair is owner follow-up outside this change (AC-L6); (2) the **pinned LITE set is a reversible schema constant** the owner may amend at PR review (spec C-2), as may the `minor` version impact (A-T7); include the corpus boundary evidence (all variant-era documents pass; 21 of 35 legacy documents sit outside the corpus).
- [ ] **12.4** Final gate battery and PR handoff: run and record the ordered battery on the **pushed HEAD** (never an earlier SHA) — `pnpm install --frozen-lockfile` → `pnpm build` → focused suites → `bun test` (all layers) → `pnpm check` → boundary/ambient/literal/sync checks → `git diff --check` — then hand off to `@pr-manager` (lifecycle phase 11): PR targets `main-tools` from `feat/GH-179/pm-notes-registry-lint-phase-transitions`, assigned to the owner; **STOP at the open unmerged PR** — no merge, no owner-acceptance claim.

**Acceptance Criteria**:

- Must: the change-level Definition of Done (below) satisfied with current passing evidence; the minor changeset recorded; the evidence artifact complete; all required CI jobs green on the pushed HEAD; rollback coherent.
- Must: no task in any phase staged `.ai/local/`, `tmp/`, or untracked scratch (D6), and no protected path touched (the Phase 9 proof re-checked at handoff).

**Files and modules**:

- Code areas: `.changeset/pm-notes-lint-minor.md` (new), `chg-GH-179-evidence.md` (new); no product-code change unless a gate reopens Phase 10.
- System docs: final reconciliation verified against Phase 11; no speculative consumer documentation.

**Tests**:

- The full Phase 12.4 battery, exactly as consolidated in the evidence artifact.

**Completion signal**: `docs(GH-179): finalize evidence, changeset, and PR handoff notes`

---

## Execution Notes for `@coder` (this runtime)

- **No subagent dispatch**: `@coder` cannot dispatch subagents in this runtime. Committer and runner discipline for Phases 1–8 is executed **inline** (D6); Phases 9–12 are PM-scheduled lifecycle gates — `@coder` must never mark them complete by finishing implementation alone.
- **Inline committer protocol**: exactly one Conventional Commit per phase, message = the phase's completion signal (`feat(GH-179): …` / `test(GH-179): …` / `docs(GH-179): …`; body lines ≤ 100 chars). Stage with an **explicit file list** — exactly the phase's Files-and-modules entries; never stage `.ai/local/`, `tmp/`, or untracked scratch; verify the staged set with `git status --porcelain` before committing.
- **Inline quality gates**: run `pnpm check` before every phase commit and capture the log (e.g. `pnpm check 2>&1 | tee .ai/local/gh179-phase<N>-check.log` — `.ai/local/` is git-ignored ephemeral state: safe for logs, never staged). A red aggregate gate blocks the commit; fix it or stop at the last green task boundary and report (D6) — never enlarge a commit or split a phase across commits.
- **Fixture hygiene** (D5): committed fixtures under `tests/fixtures/**` are read-only; every other fixture tree self-materializes under a fresh `mkdtemp` root; corpus suites read committed `doc/changes/**` files read-only; drift, mutation, and boundary controls operate on temp copies only; the live tree stays clean after every suite run (`git status --porcelain` shows no test writes).
- **OS tmpdir sibling convention**: scratch roots are created as siblings inside the OS temp directory — `mkdtemp(path.join(os.tmpdir(), "gh179-<suite>-"))` — never inside the repository working tree and never under a gitignored repo-relative scratch path; remove each root in test teardown (`finally`/`afterEach`) so temp siblings cannot accumulate.
- **Evidence honesty**: record only executed evidence with command + HEAD; unrun results are never recorded as passing (test plan §7).

## Scope

### In Scope

- pm-notes schema vocabulary and registry record vocabulary as data-only contracts (C-1, C-2, C-5; Phase 1).
- The `lint` domain kind with five additive error-table rows plus the documented table, shipped in the same phase (C-6, NFR-5; Phase 1).
- Pure pm-notes conformance rules with every rejection-class fixture family (C-1–C-3, AC-L1/AC-L4; Phase 2).
- The read-only `lint` command — PIN-1 selector, target resolution, envelope/exit, determinism proofs (C-3, NFR-2/NFR-3; Phase 3).
- The variant-era corpus fixture with the exclusion manifest and boundary/manifest guards (AC-L6, NFR-4; Phases 4 and 6).
- The delivery registry over the GH-174 state port — `phase.transition` records, verified classified reads, derived projection (C-5, AC-L5; Phase 5).
- The `phase` command family — all nine matrix rows, staged write-path lint, advisories, grammar-before-state ordering (C-4, AC-L1–AC-L3; Phases 6–7).
- Tier/purity/runtime/literal boundary completion, the packed Node/Bun probe, the feature doc and its registration (NFR-1; Phase 8).
- Review support, conditional remediation, doc/spec/glossary reconciliation, minor changeset, evidence artifact, and PR handoff notes (Phases 9–12).

### Out of Scope

- NG-1: verify change (GH-177) — lint is document conformance, not evidence against reality.
- NG-2: agent prompt adoption of `ados phase` in `.opencode/` and `.ados-claude/` (an operating-model note in Phase 11 only).
- NG-3: registry expansion to retro/ceremony artifacts or memory lint; NG-5: decision-record/frontmatter/deploy-checklist lint or any policy beyond schema/format conformance.
- NG-4: a closed key set for pm-notes — extras stay opaque and never inspected (D11).
- Repair of the GH-171 pm-notes historical artifact (owner follow-up; excluded by manifest).
- Publishing, merge, or owner acceptance; any new CI job or check (D7); any cloud-product content (repo rule).

### Constraints

- D1–D11 are binding (module layout, same-phase error rows, state-port-only composition, CLI edge ownership and grammar ordering, fixture hygiene, inline committer protocol, no new CI jobs, inventory/literal registration, changeset, evidence artifact, no closed key set).
- Strict TypeScript, injected time/randomness/environment, runtime-API confinement, and `bun:test` authoring per [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md); suite layout and the gate battery per [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md).
- The in-process harness contract (test plan §4.1) binds every lint/phase behaviour suite; the packed probe is the single spawned-process exception (GAP-2); the non-vacuity contract (§4.2) binds every negative and no-op scenario.
- Phase gate = the phase's focused suites green plus `pnpm check` exit 0; boundary gates extend only by adding rules and fixtures (D7).

### Risks

Execution risks carried from the test plan (§8.1), each anchored to the phase/pin that mitigates it:

| ID | Risk | Impact | Probability | Mitigation (plan anchor) |
|----|------|--------|-------------|--------------------------|
| RSK-T1 | A rejection fixture is inert, so lint passes without proving detection | H | M | Canary + builder self-assertion per fixture; restored/valid controls in the same test (§4.2; Phases 2–3, 6–7) |
| RSK-T2 | No-op cells pass vacuously because the ledger is not inspected | H | M | Three-way assertion — exit 0 + zero ledger delta + no entry change — plus append-on-no-op controls (Phases 5–7) |
| RSK-T3 | Grammar validation is accidentally ordered after state inspection | H | M | Rows 7–8 against malformed/missing targets; recording state seam; wrongly-ordered control caught (Phase 7, D4) |
| RSK-T4 | The corpus fixture freezes a file list and drifts from the boundary | H | M | Enumerator derives from folder dates + manifest; add/move and schema-mutation controls (Phase 4, PIN-2) |
| RSK-T5 | The exclusion manifest grows silently and hides real corpus failures | H | L | Guard: exactly one path, the file exists and is genuinely unparseable; a second entry fails (Phase 4) |
| RSK-T6 | Torn registry fixtures do not exercise the real read path | H | M | Verified-bytes generation, named mutations, canaries, reads through `phase list` and the registry lint target; detection-disabled control (Phase 5) |
| RSK-T7 | Error-table sync becomes vacuous (missing rows, empty table, no counts) | H | L | Non-zero count assertions; both drift directions; kind removal; missing/unparseable table fails closed; unchanged control (Phase 1) |
| RSK-T8 | The packed probe is skipped or vacuously type-only | M | M | Runtime value read + minimal append/read under both runtimes; non-existent-subpath negative probe (Phase 8, GAP-2) |
| RSK-T9 | LITE omission is accepted by accident | H | M | Absent `variant` asserted as full; six single-omission fixtures naming each pinned phase (Phases 2–3) |
| RSK-T10 | Existing behaviour regresses while extending shared modules | M | M | Existing `config`/`state` suites, boundary gates, sync mutations, and `pnpm check` in the aggregate; no rule weakened (D7, Phase 8) |

Plan-level risks (spec §Risks and this plan's execution model):

| ID | Risk | Impact | Probability | Mitigation |
|----|------|--------|-------------|------------|
| RSK-P1 | Schema-vs-corpus drift: a legitimate real-world shape starts failing at write (spec RSK-1) | M | M | Schema pinned from the de-facto corpus; permanent CI corpus fixture (Phase 4); open key set (D11); reversible variant constant |
| RSK-P2 | Dual representation: a consumer reads the pm-notes declaration instead of the ledger (spec RSK-2) | H | M | PIN-6 ledger fold is the idempotency authority; rebuildable projection (PIN-3); declaration-vs-ledger cross-check deliberately deferred to verify change (GH-177) |
| RSK-P3 | Agents bypass `ados phase` with hand edits (spec RSK-3) | M | M | Non-conformant hand edits fail loudly at the next write/lint; operating-model note in Phase 11; prompt adoption is follow-up work |
| RSK-P4 | The five lint rows or the `lint` kind drift from the documented table (spec RSK-4) | M | L | D2 same-phase shipping; TC-SYNC-007..009; binding bidirectional CI check from the first boundary |
| RSK-P5 | LITE declared to dodge heavyweight gates on a change warranting full (spec RSK-5) | M | M | LITE must be explicit — omission never yields LITE; owner reviews LITE adoption at PR (Phase 12 note) |
| RSK-P6 | A phase overruns its ~10-minute delegation window (D6) | M | M | `@coder` stops at the last green task boundary and reports; never enlarges or splits the phase commit; PM reschedules the remainder |
| RSK-P7 | GH-179's own pm-notes drifts out of conformance mid-delivery (A-T8 corpus membership) | M | L | Any edit to `chg-GH-179-pm-notes.yaml` during delivery keeps the full-11 shape; the corpus gate re-runs in every `pnpm check` |

### Success Metrics

- NFR-5: 5/5 lint codes round-trip exactly; 0 documented-table drift in both directions; 0 containment escapes; 0 ambiguous kind-only selections.
- NFR-2: 100% envelope validity for every lint/phase invocation class; 100% single-serializer `--json`; 0 exits outside `{0,1,2}`; 0 user-category failures not projecting to 1.
- NFR-3: 0 lint verdict drift across replays; 0 ambient reads outside declared edges; 0 bytes written by standalone lint.
- NFR-4: 0 corpus failures over the boundary minus the manifest; 0 legitimate-shape regressions; 100% re-assertion on schema-module change.
- NFR-1: 0 tier violations; 0 runtime-conditionals in contracts/domain; 0 runtime APIs outside the driver edge; 0 packed-surface failures on Node or Bun.
- AC-L2: every redundant matrix cell — exit 0, zero additional ledger records, no-op evidence; AC-L1: every malformed class blocked at write with its pinned identity.
- Aggregate: all 25 TCs green with recorded evidence; `pnpm check` exit 0 on the pushed HEAD.

## Open Questions

Resolved by this plan (part 1 pins — binding for delivery; changing any pin reopens this plan):

| ID | Question | Status |
|----|----------|--------|
| OQ-T1 | Exact lint target selector spelling | **RESOLVED — PIN-1** (positional ref + additive `--pm-notes`/`--registry` flags; fixed failure order pm-notes → registry) |
| OQ-T2 | Corpus exclusion manifest location and format | **RESOLVED — PIN-2** (committed fixture `tests/fixtures/pm-notes/corpus-exclusions.json`; repo-relative POSIX paths under `exclude`) |
| OQ-T4 | Derived projection file name and shape | **RESOLVED — PIN-3** (`phase-state.<REF>.json`; pure fold of verified `phase.transition` records; byte-stable rebuild) |
| OQ-T5 | Evidence field names for no-op and advisories | **RESOLVED — PIN-4** (`outcome`/`basis`/`completedAt`/`phase`/`reason`; advisory classes `earlier-open` and `outside-required-set`; verified-empty marker) |

Resolved upstream (no plan action): OQ-T3 (packed-probe spawn exception, GAP-2), OQ-T6 (reason lives in the record + evidence, A-T6), OQ-T7 (staged post-transition validation, A-T9 — operationalized by PIN-7), and the spec's OQ-1 (opaque extra phase keys are lint-passing but not command-addressable — intended scope boundary).

Residual non-blocking notes:

- PIN-5..PIN-8 (verdict aggregation order, ledger-fold idempotency basis, staged write-path validation, opaque-preserving document edits) are plan-added design decisions; a reviewer may challenge them — route to PM/`@decision-advisor`, never apply silently (Phase 9.3).
- The pinned LITE set and the `minor` version impact are owner-amendable at PR review (spec C-2, A-T7) — carried in the Phase 12 handoff notes.
- GH-171 pm-notes repair remains owner follow-up (manifest-excluded; AC-L6).
- No new decision record (ADR/TDR) is required: D1/D3 follow ADR-0003 and the GH-174 state layer as built.

## Definition of Done

### Per-phase checklist

| Phase | Done means |
|-------|------------|
| 1 | Vocabulary + five rows + documented table landed together; sync check green both directions with non-zero counts; `pnpm check` exit 0; commit `feat(GH-179): add pm-notes and registry vocabulary with synchronized lint error rows` |
| 2 | Every rejection class mapped to exactly one pinned code at rule level; PIN-5 ordering asserted; boundary/ambient gates green; commit `feat(GH-179): add pure pm-notes conformance rules with rejection-class fixtures` |
| 3 | Command-level lint complete: selector, target resolution, determinism, envelope; commit `feat(GH-179): add lint command with target resolution, envelope, and determinism proofs` |
| 4 | Corpus fixture + manifest green with live drift/manifest controls; commit `test(GH-179): pin variant-era corpus acceptance fixture with exclusion manifest guards` |
| 5 | Registry over the port: verified reads, classified failures, fold-stable projection; commit `feat(GH-179): add delivery registry over the state port with derived phase projection` |
| 6 | Matrix rows 1–5 + 9 with three-way no-op proofs and opaque-preserving writes; commit `feat(GH-179): add phase command write path with idempotent transitions and entry creation` |
| 7 | Rows 6–8, write-path lint matrix, phase envelope complete; commit `feat(GH-179): complete phase matrix with advisories, ordering proofs, and write-path lint` |
| 8 | TC-BOUND-001/002/003 complete; feature doc registered; aggregate battery green; commit `test(GH-179): complete boundary, packed Node/Bun probe, and aggregate gates with feature doc` |
| 9 | Independent verdict recorded in `review/review-iter-1.md` (PM-scheduled) |
| 10 | Findings closed with regression-first evidence and re-review PASS — or explicit not-required backed by Phase 9 PASS (PM-scheduled) |
| 11 | All nine doc touchpoints reconciled; sync check green after edits; @doc-syncer commit recorded (PM-scheduled) |
| 12 | Changeset + evidence artifact + owner-facing notes + final battery on the pushed HEAD; open unmerged PR targeting `main-tools` (PM-scheduled) |

### Change-level DoD (open-PR gate)

- All **25 TCs green** with recorded per-TC evidence (execution commands + HEAD) in the test-plan execution log and `chg-GH-179-evidence.md`.
- **`pnpm check` aggregate green** (exit 0) on the pushed HEAD; **boundaries green** (`pnpm run check:boundaries`, ambient-globals, forbidden-literals, exit-code-literals) — no gate weakened, only extended by added rules/fixtures (D7).
- **Sync check green** in both directions with non-zero counts; the five documented lint rows exist exactly once in `doc/spec/features/feature-result-contract.md`.
- **Corpus fixture green**: zero failures over the variant-era boundary minus the exclusion manifest, GH-179's own pm-notes included (A-T8); the GH-171 exclusion justified and unable to grow silently.
- All six ACs traceable to passing TCs; all five NFR thresholds measured; all nine matrix rows exercised with every redundant cell proving exit 0 + zero records + no entry change.
- Feature doc authored and registered in the forbidden-literals registry; inventory registrations complete with named executable allowances.
- Minor changeset recorded (lockstep fixed group, `testkit` excluded); evidence artifact complete with rollback instructions and both owner-facing notes.
- No protected path touched (`.opencode/**`, `.ados-claude/**`, `.ai/**`, `scripts/*.sh`, `tools/**`, CI topology); nothing from `.ai/local/` or `tmp/` ever staged; PR open targeting `main-tools`, unmerged, assigned to the owner — no merge or owner-acceptance claimed by this plan.

## Artifacts and Links

| Artifact | Location | Role / handling |
|---|---|---|
| Change specification (v1.2) | [chg-GH-179-spec.md](./chg-GH-179-spec.md) | Source of requirements: AC-L1..L6, C-1..C-6, NFR-1..5, pinned LITE set, corpus boundary |
| Test plan (v1.0, 25 TCs) | [chg-GH-179-test-plan.md](./chg-GH-179-test-plan.md) | Source of TC IDs, §4.1 harness contract, §4.2 non-vacuity contract, execution order, evidence commands |
| This plan | `./chg-GH-179-plan.md` | The only file written by this authoring pass (two parts) |
| Delegation brief | [delegation-plan-brief.md](./delegation-plan-brief.md) | PM delegation: bindings, OQ pins, execution constraints |
| PM notes | `./chg-GH-179-pm-notes.yaml` | Corpus member (A-T8); `variant` absent → effective full; must keep conforming through delivery |
| pm-notes/registry vocabulary | `packages/core/src/contracts/{pm-notes,registry}.ts` | New; types and as-const data only (D1) |
| Error rows (machine + documented) | `packages/core/src/contracts/error-table.ts`, `doc/spec/features/feature-result-contract.md` | Five lint rows shipped in-change together (D2); the documented section is never rewritten by reconciliation |
| Lint rules / registry / commands | `packages/core/src/domain/pm-notes-lint.ts`, `packages/core/src/state/registry.ts`, `packages/cli/src/commands/{lint,phase}.ts`, `packages/adapters/src/file/pm-notes-parser.ts` | New implementation modules (D1, D3, D4) |
| Corpus exclusion manifest | `tests/fixtures/pm-notes/corpus-exclusions.json` | New (PIN-2); committed fixture; guarded against silent growth |
| Packed-consumer probe | `tests/checks/packed-state.test.ts` | Extended (TC-BOUND-003); the single documented spawn exception (GAP-2) |
| Feature doc | `doc/spec/features/feature-pm-notes-lint-and-phase-transitions.md` | New in Phase 8; registered in `scripts/checks/forbidden-literals.registry.json` (D8); reconciled in Phase 11 |
| Review records | `./review/review-iter-*.md` | New in Phase 9 (GH-174 pattern) if the review gate records findings |
| Release intent | `.changeset/pm-notes-lint-minor.md` | New in Phase 12 (D9); lockstep fixed group; no publishing in this change |
| Delivery evidence | `./chg-GH-179-evidence.md` | New in Phase 12 (D10; GH-172/174 pattern) |
| Referenced decisions & specs | [ADR-0003](../../../decisions/ADR-0003-oss-monorepo-structure.md), [feature-state-layer.md](../../../spec/features/feature-state-layer.md), [feature-result-contract.md](../../../spec/features/feature-result-contract.md) | Tier matrix and state/result contracts; referenced, not rewritten |

No new standalone delivery-infrastructure check or CI job is planned (D7). If execution genuinely needs one, escalate to PM — repository wiring/registration is mandatory and conflicts with current scope until resolved; no such addition is pre-authorized here.

## Plan Revision Log

| Version | Date (UTC) | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-10-31T02:16:29Z | Implementation Plan Writer | Initial twelve-phase plan authored in two parts. Part 1: front matter, context, PIN-1..PIN-8 pinned resolutions, bindings D1..D11, full 25-TC traceability, Phases 1–6. Part 2 (this append): Phases 7–8 (`@coder` completion — matrix rows 6–8 and ordering proofs, write-path lint, envelope; boundary/packed/feature-doc/aggregate green), lifecycle-mapped Phases 9–12 (review support, conditional remediation, doc/spec/glossary reconciliation across all nine Related-section touchpoints plus the feature doc, finalize with minor changeset, evidence artifact, and both owner-facing notes), `@coder` execution notes (inline committer protocol, fixture hygiene, OS-tmpdir sibling convention), Scope with RSK-T1..T10 + RSK-P1..P7, open questions resolved by PIN-1..PIN-4 with residual notes, per-phase and change-level Definition of Done, artifacts, and the execution-log skeleton. 12 phases, 58 tasks, 25 TCs — none orphaned. |

## Execution Log

| Phase | Status | Started | Completed | Commit | Notes |
|-------|--------|---------|-----------|--------|-------|
| Authoring | Complete | 2026-10-31T02:10:00Z | 2026-10-31T02:16:29Z | none | Two-part authoring pass: read the completed spec (v1.2), test plan (25 TCs), delegation brief, the structural template, and the GH-174 plan precedent; verified corpus membership of this change's pm-notes, the changeset/forbidden-literals/packed-probe precedents, and the glossary. Only this plan file was written; no code implemented, no builds or tests run, no git operations. Executors record per-phase evidence, commands, HEAD, and pushed-HEAD CI results here; unrun evidence must never be recorded as passing. |
| 1 | Complete | 2026-10-31T04:40:00Z | 2026-10-31T05:05:00Z | this commit | Contracts `pm-notes.ts`/`registry.ts`, `lint` kind + five rows, documented table rows shipped together; focused tests 83/83; `bun run scripts/checks/error-table-sync.ts` entries=26 documented=26; `pnpm check` exit 0 (739 tests). `classifyDomainKind` needed no change. |
| 2 | Complete | 2026-10-31T05:06:00Z | 2026-10-31T05:35:00Z | this commit | Pure `lintPmNotes` rules + committed fixtures; focused suites 54/54; `pnpm check` exit 0 (793 tests, boundaries green). Rule order parse → keys → types → variant → phases; opaque extras never inspected. |
| 3 | Complete | 2026-10-31T05:36:00Z | 2026-10-31T06:10:00Z | this commit | `pm-notes-parser` adapter, `lint` command with PIN-1 selector, target resolution, envelope/exit, determinism/read-only proofs; focused suites 99/99; `pnpm check` exit 0 (820 tests, boundaries green). DoR nit folded: TC-LINT-004 torn-registry asserts exit 2. |
| 4 | Complete | 2026-10-31T06:20:00Z | 2026-10-31T06:55:00Z | this commit | Corpus manifest + derived enumerator (`tests/behaviour/pm-notes-corpus-support.ts`); `pm-notes-corpus.test.ts` 15/15 with membership, live drift/manifest/schema-mutation controls; boundary members GH-170/172/173/174/181/179; GH-171 excluded only by manifest; `pnpm check` exit 0 (835 tests, boundaries green). |
| 5 | Complete | 2026-10-31T07:05:00Z | 2026-10-31T07:45:00Z | this commit | `state/registry.ts` composes the GH-174 port only: fenced append of one `phase.transition` per landing, verified key-set read, pure fold, atomic `replaceDocument` projection, rebuild from ledger truth; `phase-registry.test.ts` 15/15 + `registry-imports.test.ts` 4/4; `pnpm check` exit 0 (853 tests, boundaries green). Deviation note: the state layer's `replaceDocument` appends its own `document` intent record, so the literal "ledger kinds = [phase.transition]" assertion is scoped to append-only records (no registry-specific projection kind). |
| 6 | Complete | 2026-10-31T08:10:00Z | 2026-10-31T09:20:00Z | this commit | `phase` command (grammar-before-runtime, staged PIN-7 lint, ledger-fold idempotency, PIN-8 document edit) registered/composed; `phase-transitions` 8/8, `phase-idempotency` 5/5, corpus 17/17 incl. the two Phase 6 write-path controls; `pnpm check` exit 0 (868 tests, boundaries green). Two additive deviations: (1) `adapters/file/pm-notes-parser.ts` gained `readPmNotesText` + `stagePmNotesPhaseEntry` (the PIN-8 Document-edit API composed by the CLI edge; same adapter module, no new subpath); (2) `tests/structure/state-scope.test.ts` now allows exactly the documented GH-179 consumers (`cli/src/edge.ts`, `cli/src/commands/phase.ts`) — the GH-174 "no consumer" premise is superseded by C-5/D3, with the seeded-violation control still live. |
| 7 | Not started | — | — | — | |
| 8 | Not started | — | — | — | |
| 9 | Not started | — | — | — | PM-scheduled (lifecycle phase 8 inputs). |
| 10 | Not started | — | — | — | PM-scheduled; conditional on Phase 9 findings. |
| 11 | Not started | — | — | — | PM-scheduled (`@doc-syncer`, lifecycle phase 7). |
| 12 | Not started | — | — | — | PM-scheduled (lifecycle phases 9–11). |
