---
id: chg-GH-226-machine-readable-plan-schema
status: Proposed
created: 2026-11-05T20:26:30Z
last_updated: 2026-11-05T20:26:30Z
owners: [engineering]
service: delivery-os-cli
labels: [change, m1, delivery-engine]
links:
  change_spec: ./chg-GH-226-spec.md
  test_plan: ./chg-GH-226-test-plan.md
summary: >
  Delivery plans become a versioned, machine-readable (YAML) declared artifact:
  per-phase declared scope (files, packages, folders), done-artifacts, repo leases
  and build-weight class, declared producer/consumer interactions, and ceremony tier
  as data. Delivers the `plan` command family — `validate` (schema plus
  ready-for-development verdict), `diff` (declared scope versus actual branch diff),
  `overlap` (sequence-versus-parallel with overlapping paths named) — integrates a
  plan target into `lint`, and flips the plan-writer output format while legacy
  markdown plans stay readable during the transition.
version_impact: minor
---

# IMPLEMENTATION PLAN — GH-226: M1-S13: Machine-readable delivery plan schema

## Context and Goals

This plan delivers spec `chg-GH-226-spec.md` (13 capabilities F-1..F-13, 11 ACs, DEC-1..DEC-7, NFR-1..NFR-7) against the test design in `chg-GH-226-test-plan.md` (30 scenarios TC-DPLAN-001..030). Delivery plans stop being prose consumed only by LLMs and become computable data: parallelism is decided mechanically, the ready-for-development gate is grounded in a validated plan, and ceremony tiers are declared per plan instead of hardcoded. Scheduling, lanes, and lane-join verification remain downstream consumers (M1-S17, M2-S3) — this change makes their input computable.

Delivery follows the spec §18 layering: pure, data-first contracts and verdict logic first; command surfaces next; lint integration; then the atomic writer flip with template, prompts, and regenerated plugin output; finalize last. Every phase is independently committable and leaves `pnpm check` green. Tests land **with** the code they verify, never after (test-plan §7 suite ordering is respected inside each phase).

Layering (per `.ai/rules/typescript.md`, verified against the tree): schema types and additive error identities in `packages/core/src/contracts/`; pure verdict logic in `packages/core/src/domain/` (precedents: `pm-notes-lint.ts`, `queue-ready.ts`, `verify-gates.ts`); YAML parsing through the existing `packages/adapters/src/file/yaml-parser.ts` precedent; command definitions in `packages/cli/src/commands/` (I/O-free, injected runtimes, handlers never choose exit codes — precedents `lint.ts`, `queue.ts`); exit projection and wiring in `packages/cli/src/edge.ts`/`index.ts`; text-mode serialization in `packages/cli/src/output/serialize.ts`. No new packages, no new dependencies, no new CI jobs.

### Open question resolutions (OQ-1..OQ-8 from test plan §8.3)

Each OQ is pinned by the task that owns it (cited inline in the phases below). OQ-3 and OQ-8 route to review with a working default that is implemented, not blocked on.

| OQ | Resolution pinned by this plan | Owner / routing |
|----|-------------------------------|-----------------|
| OQ-1 | Unsupported/forward schema version is classified as `plan.schema.invalid` naming the `schemaVersion` field — no separate version identity (Phase 1). | Pinned; `@coder` implements, `@reviewer` verifies via TC-DPLAN-003 fixture expectation row. |
| OQ-2 | A dedicated additive identity `plan.artifact.missing` covers "no plan artifact at all", registered and registry-synced like every `plan.*` row (Phase 1); detail names the ref and the missing artifact class (Phase 2). | Pinned by `@coder` (test plan authorizes a dedicated identity if registered). |
| OQ-3 | Working default: DEC-1 applies — legacy-format verdict is a negative verdict, exit 1 with `readyForDevelopment=false`, classified `plan.format.legacy-markdown`. **Route to review**: `@reviewer`/`@pm` confirm; any change updates TC-DPLAN-011 and test-plan §8.3 together, never one of them (Phase 2). | Review-routed with DEC-1 default. |
| OQ-4 | When both `chg-<ref>-plan.yaml` and `chg-<ref>-plan.md` exist, the YAML plan wins (machine-readable is authoritative); the verdict payload discloses the artifact actually read; the precedence rule is documented in the unified change convention guide (Phases 2, 6). | Pinned by `@coder` + guide update. |
| OQ-5 | An `overlappingPaths` entry is the most concrete shared descriptor: the concrete repository path when either plan declares it concretely, otherwise the shared pattern string (e.g. `packages/core/src/contracts/**`); entries sorted lexicographically; never a bare "overlap" without a name (Phase 3). | Pinned by `@coder`; frozen by TC-DPLAN-015 fixtures. |
| OQ-6 | Stable reason vocabulary of two values: `shared-contract-files` when a declared interaction (contract file or generated code) drives the sequence verdict; `shared-paths` for plain scope intersection with no declared interaction (Phase 3). | Pinned by `@coder`; vocabulary is a stability surface. |
| OQ-7 | The lint plan target reports the shared `plan.*` identities for non-conformant documents (with location), not a new `lint.plan.*` family; unreadable documents reuse the existing lint-surface unreadable class (exit 2 per lint(1)) (Phases 1, 5). | Pinned; `@reviewer` verifies registration/sync via TC-DPLAN-028. |
| OQ-8 | Working default: unknown build-weight class is accepted and echoed as opaque data — no classification this change; the known-weight vocabulary belongs to the scheduler story (M1-S17), and inventing it now would create a built-in default set. **Route to review**: `@reviewer` confirms; if classification lands instead, add the fixture to the TC-DPLAN-003 corpus per test-plan §8.3 (Phase 2). | Review-routed with opaque-echo default. |

No decision records are required: OQ-3 and OQ-8 are review confirmations of defaults already consistent with DEC-1 and the spec's anti-goal on built-in defaults. If review overturns either, record the outcome in the change artifacts and update the affected tasks/tests in the same commit.

## Scope

### In Scope

- The versioned YAML plan schema and verdict payload types: F-1 (document, `chg-<ref>-plan.yaml` per DEC-7), F-2 (per-phase scope with package/folder wildcards), F-3 (typed done-artifact slots), F-4 (leases and build-weight class), F-5 (producer/consumer interactions), F-6 (tier/variant as data), F-7 (planning lease-free / delivery lease-taking classes).
- Pure verdict logic: schema validation with classified errors naming phase and field, tier resolution and echo, lease-class reporting, legacy-format detection, absent-artifact classification, overlap computation with producer-first ordering, declared-versus-actual diff classification, deterministic bounded output (F-8, F-9, F-10, F-13).
- The `plan` command family `validate`/`diff`/`overlap` with the standard envelope, DEC-1 exit semantics, and machine/text output (F-8, F-9, F-10).
- The ready-for-development verdict and gate refusal computed by `plan validate` (F-12, DEC-2, DEC-6).
- The plan lint target added to the existing `lint` surface (F-11).
- The migration path: writer flip in `.opencode/agent/plan-writer.md`, `.opencode/command/write-plan.md`, consuming guidance in `.opencode/command/run-plan.md` and `.opencode/agent/coder.md`, template YAML representation, regenerated `.ados-claude/` output committed together, plan naming in the unified change convention guide (F-13, DEC-7, RSK-6, RSK-7).
- Fixture corpus, golden files, and performance case covering TC-DPLAN-001..030 including seeded scenarios SC-M1-06 (exit reconciled per DEC-1) and SC-M1-07 (gate refusal per DEC-2/DEC-6).
- Additive `plan.*` error identities with registry binding (DM-8).

### Out of Scope

- Scheduler, queue scheduling, lanes, daemon, dispatch, lane execution (M1-S17); `queue add` park-behind-valid-plan warning is the recorded integration point (DEC-2) and the shipped `queue ready` surface is unchanged.
- Commit primitive and phase-transition commits (M1-S14).
- Ceremony runner / tier engine and escalation-trigger evaluation (M2-S3) — triggers round-trip as inert data (TC-DPLAN-006).
- Execution-time verification of done-artifacts; blocking enforcement of `plan diff` findings; removal of legacy markdown readability.
- Feature spec under `doc/spec/features/` and CLI command registry status row: authored/updated at the lifecycle `system_spec_update` phase (@doc-syncer) — noted in Phase 7, not planned here.
- N-way overlap and batch composition; lint auto-fix; new HTTP surfaces, external integrations, credentials, LLM/network in any verdict path.

### Constraints

- Purity (NFR-7, `.ai/rules/typescript.md`): schema = data + types in core contracts; verdict logic = pure functions in core domain taking plan values, injected ports, and injected time/ids/config only; command definitions I/O-free with injected runtimes; YAML parsing via the adapters precedent; exits projected only at the CLI edge.
- Determinism (NFR-1): byte-identical replay; sorted, stable list emission; goldens normalized (no `runId`, timestamps, absolute paths).
- Read-only posture (NFR-3): validate/diff/overlap and the lint plan target perform zero writes, fences, state mutations, spawns, and credential reads; bounded, declared read set per command (validate: one plan read; overlap: two; diff: plan read + diff read).
- Latency (NFR-2): p95 < 500 ms per invocation for plans up to 30 phases; no network, provider-engine, or LLM calls.
- Bounded output (NFR-4): deterministic truncation marker plus total count; truncation never changes the verdict.
- Error contract (NFR-5, DM-8): additive `plan.*` rows only; code table and registry synced in the same change; projection class user-validation (exit 1) for all plan verdict codes; no fallback-classified fixtures.
- Branding seam: no hardcoded product or binary names; synopses use `<binary>`.
- `.opencode/**` prompt changes ship with `scripts/build-claude-plugin.sh` regeneration, source and generated output in the same commit (RSK-6).
- Changed distributable docs keep their existing `ados_distribution` marker in existing frontmatter; `bash scripts/.tests/test-doc-distribution.sh` must pass (RSK-5).
- No license headers added by agents; `doc/changes/**` artifacts never carry headers.
- Conventional Commits per phase: `feat(GH-226)` for code phases, `docs(GH-226)` for the prompt/template/guide phase, `chore(GH-226)` for finalize.

### Risks

- **RSK-1** Schema drift between writer output and validator. Mitigated by: the contracts-layer schema is the single source for the validator, the fixtures, and the template representation (Phases 1, 2, 6); lint checks plans at write time (Phase 5); TC-DPLAN-029 verifies template and fixtures describe one shape.
- **RSK-2** In-flight markdown plans stranded by the flip. Mitigated by: legacy readability with classified transition verdict (Phase 2, TC-DPLAN-011/012); atomic flip (Phase 6).
- **RSK-3** Over/under-declared scope makes diff noisy. Mitigated by: wildcard granularity (Phase 1), observational diff (Phase 3), write-time lint (Phase 5).
- **RSK-4** Exit-1-on-sequence surprises script consumers. Mitigated by: DEC-1 pinned in Phase 4 projection and asserted by TC-DPLAN-013/022; verdict data always present so consumers branch on data. Review must reject any "fix" back to exit 0 without a decision-record change.
- **RSK-5** Docs/templates fail the distribution drift guard. Mitigated by: markers kept in Phase 6; guard run in Phase 6 and Phase 7 gates (TC-DPLAN-030).
- **RSK-6** Generated plugin drift. Mitigated by: same-commit regeneration (Phase 6), CI staleness check.
- **RSK-7** Consumer prompts briefly expect markdown while the writer emits YAML. Mitigated by: single-phase atomic flip of writer, template, and consumers (Phase 6); legacy bridge from Phase 2.
- Test-plan risks (§8.1) inherited: overlap false negatives (TC-DPLAN-015 precision corpus + non-vacuity guards), legacy rot (TC-DPLAN-012 corpus), fixture/validator drift (fixtures derived from the design-baseline plan example and template), performance flakiness (median sampling, logged context, explicit relaxation rule only in the test-plan execution log).

### Success Metrics

From spec §4.1 — verified by the cited scenarios:

- 100% of post-flip plans pass `plan validate` (TC-DPLAN-001, TC-DPLAN-029).
- Every run-in-sequence verdict names ≥1 overlapping path present in both declared scopes; 0 false-parallel fixtures (TC-DPLAN-013, TC-DPLAN-015).
- 100% of disjoint pairs answer `parallel` with an empty list (TC-DPLAN-014).
- 0 built-in default phase sets consulted; declared tier echoed verbatim; unknown tier → `plan.tier.unknown` (TC-DPLAN-004, TC-DPLAN-005, TC-DPLAN-006).
- 100% of rejectable plans classified with a `plan.*` code naming phase and field; 0 silent accepts (TC-DPLAN-002, TC-DPLAN-003, TC-DPLAN-028).
- 100% of unvalidatable-plan fixtures refused: `readyForDevelopment=false`, classified error, exit 1 (TC-DPLAN-009, TC-DPLAN-010).
- 100% of legacy plans answered with a classified transition verdict; 0 crashes; 0 silent schema-valid accepts (TC-DPLAN-011, TC-DPLAN-012).
- p95 < 500 ms for ≤30 phases; 0 network/LLM calls; 0 writes (TC-DPLAN-023, TC-DPLAN-026).

## Phases

### Phase 1: Plan Schema Contracts, Error Identities, and Fixture Harness Foundation

**Goal**: Land the data-first foundation — schema and verdict types in core contracts, the additive `plan.*` error identities with registry binding, the known-tier vocabulary, and the shared fixture harness — so every later phase builds on one source of truth.

**Tasks**:

- [x] **1.1** Define the plan schema types in `packages/core/src/contracts/` (F-1, F-2, F-3, F-4, F-5, F-6, F-7; DM-1..DM-6): versioned plan document (`schemaVersion` for additive evolution), per-phase scope (files, packages, folders with documented package/folder wildcard semantics), typed done-artifact slots (MR URL, pipeline id, deployed environment, tracker transition), repo leases and build-weight class (phase-level with plan-level default), declared interactions (contract files, generated code; producer/consumer), ceremony tier/variant as data (per-tier phase sets, escalation triggers), and phase lease classes (planning = lease-free, delivery = lease-taking). Wildcard and folder-boundary semantics (no prefix bleed; `src/plan/` ≠ `src/planner/`) are documented on the types — they are the comparison contract for Phases 2–3 (TC-DPLAN-015, TC-DPLAN-019).
- [x] **1.2** Define the verdict payload types (DM-7) in core contracts: validate (`verdict`, `perPhase` with scope/artifacts/leases/weight/interactions/tier, `readyForDevelopment`, `schemaVersion` echo, `artifact` disclosure field for OQ-4), overlap (`verdict`, `overlappingPaths`, `ordering`, `reason`), diff (per-path table `within`/`outside-declared`/`undeclared-missing`), plus the truncation-marker shape for bounded output (NFR-4).
- [x] **1.3** Add the additive error-table rows (DM-8, NFR-5): `plan.schema.invalid`, `plan.scope.undeclared-paths`, `plan.tier.unknown`, `plan.format.legacy-markdown` (spec-proposed transition identity, rides with the OQ-3 review confirmation), and `plan.artifact.missing` (**pins OQ-2**: dedicated identity for "no plan artifact at all"). Every row carries code, domain kind, category, retryability, consequence, remediation hint, and projection class user-validation (exit 1). **Pins OQ-1**: unsupported/forward schema version classifies as `plan.schema.invalid` naming the `schemaVersion` field — no separate version identity. **Pins OQ-7 (identity side)**: the lint plan target reuses the shared `plan.*` identities for non-conformant documents; no `lint.plan.*` family is added; unreadable documents keep the existing lint-surface unreadable class.
- [x] **1.4** Declare the known-tier vocabulary as core contracts data (a known-identifier set — explicitly not a default phase set, per the spec anti-goal): enough to classify TC-DPLAN-005's unknown tier; tier phase sets themselves always come from plan data.
- [x] **1.5** Scaffold the fixture harness under `tests/fixtures/plan/harness/` mirroring `tests/fixtures/queue-ready/harness.ts`: fixture loading from `tests/fixtures/plan/**`, an in-memory plan-read port, an in-memory diff-read port, read recorders, and counters for writes/spawns/credential reads. Fixtures never named `*.test.ts` (test-plan §6; TC-DPLAN-023 foundations).
- [x] **1.6** Register new modules: `tests/structure/inventory.json` entries and declared subpath exports for the new contracts modules (TC-DPLAN-027 steps 1–2).

**Acceptance Criteria**:

- Must: all `plan.*` identities are registered and round-trip the error-table/registry binding check with projection class exit 1 (TC-DPLAN-028).
- Must: schema types exist as data-first contracts with wildcard semantics documented; no default phase set or hardcoded eleven anywhere (spec §7.2 anti-goal).
- Should: harness compiles under strict TS with zero runtime API in neutral tiers (`pnpm check:boundaries` clean).

**Files and modules**:

- Code areas: `packages/core/src/contracts/` (new plan schema module(s), verdict payload types, `error-table.ts` additive rows), `tests/structure/inventory.json`, `tests/fixtures/plan/harness/` (new), package `exports` maps for new subpaths.
- System docs: none (deferred to Phase 7 reconciliation).

**Tests**:

- `bun test tests/structure/error-table.test.ts` + `tests/checks/error-table-sync.test.ts` — new `plan.*` rows registered, synced, projected to exit 1 (TC-DPLAN-028).
- `bun test tests/structure` — inventory/subpath registration; ambient-globals and secret-read guards over new contracts files (TC-DPLAN-027).
- `pnpm check:boundaries` — no new violations.

**Completion signal**: `feat(GH-226): plan schema contracts and error identities`

---

### Phase 2: Pure Validation Domain — Schema Verdict, Tier, Legacy Transition, Ready Gate

**Goal**: Implement the pure validate logic: classified schema verdicts naming phase and field, tier echo with no built-in default, done-artifact/lease/weight echo, legacy-format detection, absent-artifact classification, `readyForDevelopment`, and deterministic bounded payloads — with the full invalid/legacy/absent fixture corpora and their behaviour tests.

**Tasks**:

- [x] **2.1** Implement schema validation and classification in `packages/core/src/domain/` (pure; F-8, F-2): verdict `valid`/`invalid`; per-error codes naming phase identifier and missing/invalid field (man-page example shape: `phase = 6`, `missing = scope.files`); YAML parsing delegated through the injected parse port backed by the adapters precedent (`packages/adapters/src/file/yaml-parser.ts`); malformed input bounded (document size/depth) and classified, never a stack trace (spec §21). Covers the TC-DPLAN-003 corpus classes: unparseable YAML (`.yaml.txt` fixtures per pm-notes precedent), non-mapping top level, missing schema version, unsupported/forward version (**OQ-1** as pinned: `plan.schema.invalid` naming `schemaVersion`), phase missing scope, unknown scope key, wrong value types, malformed done-artifact slot, delivery phase declared lease-free, interaction target not owned by the phase.
- [x] **2.2** Implement tier resolution (F-6): echo the declared tier verbatim in plan-level/per-phase data; classify tier-less plans as invalid — never defaulted (TC-DPLAN-004 step 4's instrumented runtime proves no other read); unknown tier → `plan.tier.unknown` naming the tier field; per-tier phase sets and escalation triggers round-trip as inert data, zero evaluation (F-6 detail, TC-DPLAN-006).
- [x] **2.3** Implement per-phase echo (F-3, F-4, F-7): all four typed done-artifact slots echoed for every delivery phase; planning phases report none without failing validation or inventing placeholders; planning = lease-free, delivery = lease-taking; leases and weight class echoed verbatim per phase with the plan-level default applied once, never re-derived (**OQ-8 working default**: unknown weight class echoes as opaque data, no classification — review-routed per Context table).
- [x] **2.4** Implement `readyForDevelopment` (F-12, DEC-6): true exactly when the plan validates and scope is declared; invalid schema, unknown tier, or undeclared-scope violations force `readyForDevelopment=false`.
- [x] **2.5** Implement format detection and transition verdicts (F-13, NFR-6): legacy `chg-<ref>-plan.md` answered with `plan.format.legacy-markdown`, never `valid`, no crash, verdict names the markdown artifact path read (**OQ-4 domain side**: when both `-plan.yaml` and `-plan.md` exist, read the YAML and disclose the artifact read — determinism asserted by TC-DPLAN-012). **OQ-3 working default (review-routed)**: the legacy verdict is a DEC-1 negative verdict (`readyForDevelopment=false`, exit 1 projected in Phase 4); `@reviewer`/`@pm` confirm — a change updates TC-DPLAN-011 and test-plan §8.3 together.
- [x] **2.6** Implement absent-artifact classification (**OQ-2**): no plan artifact at all → `plan.artifact.missing` naming the ref and missing artifact class; no throw, no empty success (TC-DPLAN-010).
- [x] **2.7** Implement bounded-output shaping for validate payloads (NFR-4): deterministic truncation marker plus total count; truncation never changes the verdict.
- [x] **2.8** Author fixtures: `tests/fixtures/plan/valid/` (baseline, tier `full`, tier `lite`, wildcard-scope), `invalid/` (one defect per file + committed expectation table naming code, phase, field), `legacy/` (prose, headings/checklist, empty, YAML-fragment-under-`.md`, large/non-UTF8-safe, both-formats), `absent/`. Realistic refs `GH-306`/`GH-307`/`GH-308` per test-plan §6 discipline. Include non-vacuity guards: expectation table must match directory contents; legacy corpus includes ≥1 non-empty and ≥1 empty file.
- [x] **2.9** Land behaviour tests with the domain code: `tests/behaviour/plan-validate.test.ts` (TC-DPLAN-001 domain-level, TC-DPLAN-007, TC-DPLAN-008, TC-DPLAN-010), `plan-validate-rejections.test.ts` (TC-DPLAN-002, TC-DPLAN-003 via the real parse path — no parser mock), `plan-tier.test.ts` (TC-DPLAN-004, TC-DPLAN-005, TC-DPLAN-006), `plan-legacy.test.ts` (TC-DPLAN-011, TC-DPLAN-012).

**Acceptance Criteria**:

- Must: AC-F8-1 (domain half) — invalid schema → `plan.schema.invalid` naming phase and field, `verdict=invalid`, `readyForDevelopment=false` (exit asserted in Phase 4).
- Must: AC-F6-1 (domain half) — tier echoed verbatim, no built-in default consulted, unknown tier → `plan.tier.unknown`.
- Must: AC-F3-1 — done-artifacts echoed for every delivery phase; AC-F7-1 — lease split and lease/weight echo.
- Must: AC-F13-1 (domain half) — legacy plans classified, never silently schema-valid; AC-F12-1 (domain half) — `readyForDevelopment=false` on unvalidatable plans.
- Should: rejection corpus non-vacuous; zero fallback-classified fixtures.

**Files and modules**:

- Code areas: `packages/core/src/domain/plan-*.ts` (new pure modules, naming per test-plan §8.2 may be refined), `tests/fixtures/plan/{valid,invalid,legacy,absent}/` (new), `tests/behaviour/plan-{validate,validate-rejections,tier,legacy}.test.ts` (new).
- System docs: none.

**Tests**:

- `bun test tests/behaviour/plan-validate.test.ts tests/behaviour/plan-validate-rejections.test.ts tests/behaviour/plan-tier.test.ts tests/behaviour/plan-legacy.test.ts` (TC-DPLAN-001..006, 007, 008, 010, 011, 012).
- Re-run `bun test tests/structure` and `pnpm check:boundaries` for the new domain modules (TC-DPLAN-027).

**Completion signal**: `feat(GH-226): plan validation domain with classified verdicts and legacy transition`

---

### Phase 3: Pure Overlap and Diff Domain Logic

**Goal**: Implement the parallelism answer and the scope observation as pure functions: pairwise overlap with named paths and producer-first ordering, and declared-versus-actual diff classification with wildcard resolution — with the overlap/diff fixture corpora, expectation metadata, and bounded-output fixtures.

**Tasks**:

- [x] **3.1** Implement overlap computation in `packages/core/src/domain/` (F-10, F-2, F-5, DEC-5): `parallel` (empty `overlappingPaths`, present not omitted) or `run-in-sequence` (every overlapping path named, present in both declared scopes). **Pins OQ-5**: entries are the most concrete shared descriptor — the concrete path when either plan declares it concretely, otherwise the shared pattern string; lexicographically sorted. Resolve the near-miss shapes from TC-DPLAN-015 (same basename different directories, sibling directories `src/plan/` vs `src/planner/`, same path different phase numbers, wildcard-vs-file, wildcard-vs-wildcard, folder-vs-file-beneath) with zero false verdicts.
- [x] **3.2** Implement ordering and reason (F-5, F-10, NFR-1): a declared interaction wins — the plan whose declaration states production is reported first regardless of argument order, `reason=shared-contract-files`. **Pins OQ-6**: plain shared-path overlap without a declared interaction reports `reason=shared-paths`; ordering is deterministic and stable across replay and both argument orders; no `ordering`/`reason` emitted for a `parallel` verdict.
- [x] **3.3** Implement diff classification (F-9, F-2): declared scope versus an injected actual-diff port result; per-path table `within` / `outside-declared` / `undeclared-missing` (naming phase and path); out-of-scope findings carry `plan.scope.undeclared-paths`; wildcard and folder resolution with prefix boundaries (no `doc/guides/` absorbing `doc/guides-archive/`); each path appears exactly once; `--against <base>` is forwarded verbatim to the port with the documented default base when omitted.
- [x] **3.4** Take the repository-diff input through the existing read-only port; if the wiring requires a new allowed dependency edge, update the matrix and add a failing negative fixture plus the fixture-coverage meta-check in the same commit (test-plan §4 boundary rule; TC-DPLAN-027 step 4).
- [x] **3.5** Implement bounded-output shaping for overlap/diff payloads (NFR-4): truncation marker plus totals; a truncated sequence verdict still names ≥1 overlapping path; truncation never changes the verdict.
- [x] **3.6** Author fixtures with hand-computed expectation metadata: `tests/fixtures/plan/overlap/{sequence,parallel,precision,ordering,bounded}/` (the seeded SC-M1-06 world: `GH-306`/`GH-307` sharing `packages/core/src/contracts/queue.ts` plus one `doc/spec/features/` path), `diff/{within,outside,wildcards}/` (committed JSON actual-diff path lists, `--against` base echoed in metadata), oversized bounded fixtures. Precision corpus includes ≥1 expected-`parallel` and ≥1 expected-`run-in-sequence` pair (non-vacuity).
- [x] **3.7** Land behaviour tests with the domain code: `tests/behaviour/plan-overlap-sequence.test.ts` (TC-DPLAN-013 domain-level — asserts exit-1-verbatim data per DEC-1, not the seed's exit 0), `plan-overlap-parallel.test.ts` (TC-DPLAN-014, both argument orders), `plan-overlap-precision.test.ts` (TC-DPLAN-015), `plan-overlap-ordering.test.ts` (TC-DPLAN-016, both orders + replay), `plan-diff.test.ts` (TC-DPLAN-017, TC-DPLAN-018, TC-DPLAN-019), `plan-bounded-output.test.ts` (TC-DPLAN-025).

**Acceptance Criteria**:

- Must: AC-F10-1 — sequence verdict names every overlapping path present in both scopes (data half; exit in Phase 4).
- Must: AC-F10-2 — disjoint pairs answer `parallel` with an empty, present list; AC-F10-3 — producer-first ordering with shared-contract reason, stable across argument order.
- Must: AC-F9-1 (domain half) — `within`/`outside-declared`/`undeclared-missing` classification under `plan.scope.undeclared-paths`.
- Should: zero false-parallel and zero false-sequence verdicts across the precision corpus.

**Files and modules**:

- Code areas: `packages/core/src/domain/plan-overlap.ts`, `packages/core/src/domain/plan-diff.ts` (new, names per §8.2 refinement allowed), `.dependency-cruiser.cjs` (only if 3.4 requires an edge), `tests/fixtures/plan/{overlap,diff,bounded}/` (new), `tests/behaviour/plan-overlap-*.test.ts`, `plan-diff.test.ts`, `plan-bounded-output.test.ts` (new).
- System docs: none.

**Tests**:

- `bun test tests/behaviour/plan-overlap-sequence.test.ts tests/behaviour/plan-overlap-parallel.test.ts tests/behaviour/plan-overlap-precision.test.ts tests/behaviour/plan-overlap-ordering.test.ts tests/behaviour/plan-diff.test.ts tests/behaviour/plan-bounded-output.test.ts` (TC-DPLAN-013..019, TC-DPLAN-025).
- `pnpm check:boundaries` (negative fixture included if an edge was added).

**Completion signal**: `feat(GH-226): overlap and diff domain logic with named paths and producer ordering`

---

### Phase 4: `plan` Command Family — Definitions, Edge Projection, Envelope, and Gates Evidence

**Goal**: Expose `plan validate` / `plan diff` / `plan overlap` on the CLI surface with the standard envelope, DEC-1 exit projection, machine/text output, and the cross-cutting NFR evidence: envelope conformance, read-only posture, determinism goldens, and the performance case.

**Tasks**:

- [x] **4.1** Implement command definitions in `packages/cli/src/commands/` (F-8, F-9, F-10): `plan.ts` (or `plan-{validate,diff,overlap}.ts`) following the `lint.ts`/`queue.ts` precedent — handlers take injected runtimes (plan-read port, diff-read port), return data or error, never write streams and never choose exit codes; argument parsing `plan validate <ref>`, `plan diff <ref> [--against <base>]`, `plan overlap <refA> <refB>`.
- [x] **4.2** Wire the CLI edge (DEC-1, F-8/F-10 exit semantics): validate → 0 valid / 1 invalid-or-unvalidatable (including the OQ-3 legacy-verdict default); overlap → 0 parallel / 1 run-in-sequence (a verdict, not a failure); diff → 0 fully within / 1 classified findings; malformed invocation → 2. Verdict data is always present in the envelope so consumers branch on data, not exit alone. Extend `packages/cli/src/edge.ts`/`index.ts` registration; keep the existing `exit-code-literals` check green (handlers contain no numeric exit decision).
- [x] **4.3** Implement text-mode serialization in `packages/cli/src/output/serialize.ts`: `verdict=`, `overlapping=`, `reason=`, per-path diff table; path lists may be summarized in text while the machine payload stays authoritative (TC-DPLAN-013 text assertion).
- [x] **4.4** Extend the harness with command/edge runners returning data, envelope, and exit separately; wire `assertEnvelopeContract` from `packages/testkit/src/result-conformance`.
- [x] **4.5** Land command and envelope tests: extend `plan-validate.test.ts` / `plan-overlap-sequence.test.ts` with CLI-edge and text-mode invocations (TC-DPLAN-001, TC-DPLAN-013 through the edge); new `tests/behaviour/plan-envelope.test.ts` (TC-DPLAN-022) covering every outcome class — valid (0), invalid schema (1), sequence verdict (1), diff findings (1), lint non-conformant (1, added Phase 5), lint unreadable (2, added Phase 5), malformed invocation (2) — asserting envelope fields (`schemaVersion`, `runId`, `exitCode`, `timing`, exactly one of `data`/`error`) and error payload shape (code, category, retryability, consequence, remediation; no secret-shaped values).
- [x] **4.6** Land the ready-gate test (F-12, DEC-2, DEC-6): `tests/behaviour/plan-ready-gate.test.ts` (TC-DPLAN-009) — the SC-M1-07 world (phase 6 omits scope) refuses with `plan.schema.invalid` naming phase 6, `readyForDevelopment=false`, exit 1; plus the unchanged-control assertion: `queue ready` emits byte-identical output for the same fixture versus the recorded pre-change baseline with zero plan reads in the recorder; confirm no `queue add` surface is added.
- [x] **4.7** Land the read-only posture test (NFR-2, NFR-3): `tests/behaviour/plan-readonly.test.ts` (TC-DPLAN-023) — recording fakes for every port; drive every verdict path (validate valid/invalid/legacy/absent, diff, overlap sequence/parallel); assert the exact declared read set per command and zero writes/fences/mutations/spawns/credential reads/network/provider calls.
- [x] **4.8** Land determinism goldens (NFR-1): `tests/behaviour/plan-determinism.test.ts` + `tests/golden/plan/` (TC-DPLAN-024) — one validate, one diff, both overlap verdicts; normalized (no `runId`, timestamps, absolute paths); replay byte-identical including path-list and error ordering; shuffled declaration order in fixtures yields stable emission order; goldens regenerate only via an explicit script step.
- [x] **4.9** Land the performance case (NFR-2): `tests/behaviour/plan-performance.test.ts` (TC-DPLAN-026) with the committed generated 30-phase fixture `tests/fixtures/plan/valid/thirty-phases.yaml`; warm-up, several samples, assert median < 500 ms with Bun version and platform logged; assert exactly one plan read and no other port touched. Relaxation, if ever needed, is recorded with justification in test-plan §10 — never silently deleted.

**Acceptance Criteria**:

- Must: AC-F8-1, AC-F9-1, AC-F10-1, AC-F10-2 (exit halves) — projected exits per DEC-1 with verdict data always in the envelope (TC-DPLAN-022).
- Must: AC-F12-1 — gate refusal via `plan validate`: `readyForDevelopment=false`, classified error, exit 1; `queue ready` unchanged (TC-DPLAN-009).
- Must: read-only posture 0 violations across all fixtures (TC-DPLAN-023); byte-identical replay (TC-DPLAN-024); median < 500 ms for 30 phases (TC-DPLAN-026).
- Should: text-mode output stable and summarized; envelope tests reuse `assertEnvelopeContract` without duplicating existing suites.

**Files and modules**:

- Code areas: `packages/cli/src/commands/plan*.ts` (new), `packages/cli/src/edge.ts` (updated), `packages/cli/src/index.ts` (updated), `packages/cli/src/output/serialize.ts` (updated), `tests/fixtures/plan/harness/` (extended), `tests/behaviour/plan-{envelope,ready-gate,readonly,determinism,performance}.test.ts` (new), `tests/golden/plan/` (new), `tests/fixtures/plan/valid/thirty-phases.yaml` (new).
- System docs: none.

**Tests**:

- `bun test tests/behaviour/plan-*` — full family iteration suite.
- `pnpm typecheck` and the existing exit-projection/`exit-code-literals` checks stay green.

**Completion signal**: `feat(GH-226): plan command family with envelope, exits, and NFR evidence`

---

### Phase 5: Lint Plan Target Integration

**Goal**: Add the plan target to the existing `lint` command surface additively — write-time conformance with classified errors and locations — without touching the shipped pm-notes/registry targets.

**Tasks**:

- [x] **5.1** Extend `packages/cli/src/commands/lint.ts` with the plan target (F-11): `lint plan <ref>` reports `documents[]` entries (plan path, verdict, classified errors with a location identifying phase and field); conformant → exit 0; non-conformant → exit 1 with the shared `plan.*` identities (**OQ-7 application** as pinned in Phase 1); unreadable/undecodable document → exit 2 with the existing lint-surface unreadable class, distinguished from non-conformant (lint(1) contract). Reuse the Phase 2 domain validator — no second conformance implementation (RSK-1).
- [x] **5.2** Keep the surface additive: pm-notes default target and `--registry` behavior byte-identical to recorded baselines; the plan target joins the surface, nothing existing changes shape.
- [x] **5.3** Land lint tests: `tests/behaviour/plan-lint.test.ts` (TC-DPLAN-020) — conformant fixture → `verdict=valid`, empty errors, exit 0; non-conformant fixture → classified errors with locations, exit 1; pm-notes and registry targets byte-identical to baselines. Same file covers TC-DPLAN-021 — unreadable fixture → exit 2, classified error, `documents[]` entry names the document, no stack trace or partial verdict.
- [x] **5.4** Update the envelope outcome-class coverage: add the lint non-conformant (exit 1) and lint unreadable (exit 2) fixtures to `plan-envelope.test.ts` (TC-DPLAN-022 completion).

**Acceptance Criteria**:

- Must: AC-F11-1 — non-conformant plan reported with classified errors including location, exit 1; conformant plans exit 0; unreadable classified distinctly (TC-DPLAN-020, TC-DPLAN-021).
- Must: pm-notes and registry lint targets unchanged (byte-identical baselines); read-only posture holds for the plan target (NFR-3).
- Should: zero duplicated validation logic between `plan validate` and the lint target.

**Files and modules**:

- Code areas: `packages/cli/src/commands/lint.ts` (updated, additive), `tests/behaviour/plan-lint.test.ts` (new), `tests/behaviour/plan-envelope.test.ts` (extended).
- System docs: none.

**Tests**:

- `bun test tests/behaviour/plan-lint.test.ts tests/behaviour/plan-envelope.test.ts` (TC-DPLAN-020, TC-DPLAN-021, TC-DPLAN-022 completion).
- Full `bun test tests/behaviour/plan-*` and `pnpm check` before commit.

**Completion signal**: `feat(GH-226): lint plan target with classified write-time conformance`

---

### Phase 6: Writer Flip, Template, Prompts, Plugin Regeneration, and Naming Guide (Docs)

**Goal**: Flip the plan-writer output format to `chg-<ref>-plan.yaml` atomically — template, writer prompt, write-plan command, consuming prompts (run-plan, coder), regenerated plugin output committed together, and the naming/precedence documentation — so no surface still promises markdown authoring except explicit legacy readability (F-13, RSK-6, RSK-7).

**Tasks**:

- [x] **6.1** Update `doc/templates/implementation-plan-template.md` (F-1, F-13, RSK-1): add the YAML plan schema representation — schema version, per-phase scope (files/packages/folders with wildcard guidance), done-artifacts, leases, weight class, interactions, tier data, planning/delivery phase classes, and the `chg-<ref>-plan.yaml` file name. Keep the existing `ados_distribution` marker in the existing frontmatter (no new frontmatter block, no license header changes). The template and the Phase 2 fixtures must describe one shape (TC-DPLAN-029 step 1, TC-DPLAN-029 anti-drift risk).
- [x] **6.2** Flip the writer (F-13, DEC-7): `.opencode/agent/plan-writer.md` and `.opencode/command/write-plan.md` name `chg-<ref>-plan.yaml` as the current output format and describe legacy `chg-<ref>-plan.md` as the readable transition format, pointing legacy handling at the classified transition verdict.
- [x] **6.3** Flip the consumers atomically (RSK-7): `.opencode/command/run-plan.md` and `.opencode/agent/coder.md` consume YAML plans as the current format and handle legacy markdown plans through the transition verdict; no prompt claims behavior this change does not deliver (no scheduler, queue, ceremony engine) — TC-DPLAN-029 step 4.
- [x] **6.4** Update `doc/guides/unified-change-convention-tracker-agnostic-specification.md` (DEC-7, **OQ-4 documentation side**): document `chg-<ref>-plan.yaml` as the machine-readable plan and `chg-<ref>-plan.md` as the legacy format valid during the transition, including the precedence rule — YAML preferred when both exist — and verdict disclosure of the artifact read. Keep the existing `ados_distribution` marker.
- [x] **6.5** Regenerate and commit the plugin: run `./scripts/build-claude-plugin.sh --verbose`, verify with `git diff --exit-code -- .ados-claude` after staging, and commit prompt sources plus regenerated `.ados-claude/` output together in this phase's commit (RSK-6; TC-DPLAN-029 step 3).
- [x] **6.6** Verify docs drift-free (RSK-5; TC-DPLAN-030 steps 1, 3, 4): `bash scripts/.tests/test-doc-distribution.sh` and `git diff --check`; confirm headings/tables/fences render. Note: TC-DPLAN-030 step 2 (CLI command registry row) is verified at the lifecycle `system_spec_update` phase — the registry row update is deferred there by design (see Phase 7).
- [x] **6.7** Record the transition edge case: this change's own artifacts (`chg-GH-226-plan.md` et al.) remain markdown and are covered by legacy readability; the flip governs plans authored after merge.

**Acceptance Criteria**:

- Must: AC-F13-1 (flip half) — template, writer, and consumers describe exactly one current format; generated plugin current; no stale markdown-authoring promise outside explicit legacy-readability notes (TC-DPLAN-029).
- Must: naming and precedence documented in the unified change convention guide; changed distributable docs carry valid `ados_distribution` markers; distribution drift guard passes (TC-DPLAN-030 steps 1, 3, 4).
- Should: a single review pass verifies the atomic flip; prompt diffs are tight and current-state (no evolution narration).

**Files and modules**:

- Code areas: none.
- System docs: `doc/templates/implementation-plan-template.md` (updated), `.opencode/agent/plan-writer.md` (updated), `.opencode/command/write-plan.md` (updated), `.opencode/command/run-plan.md` (updated), `.opencode/agent/coder.md` (updated), `.ados-claude/**` (regenerated), `doc/guides/unified-change-convention-tracker-agnostic-specification.md` (updated). Deferred to lifecycle phase 7 (@doc-syncer): `doc/spec/features/` feature spec (new), `doc/planning/oss-tooling/cli-command-registry.md` plan-family status row.

**Tests**:

- `./scripts/build-claude-plugin.sh --verbose` then confirm committed-together output (TC-DPLAN-029 step 3).
- `bash scripts/.tests/test-doc-distribution.sh` and `git diff --check` (TC-DPLAN-030 step 4).
- Manual content review per TC-DPLAN-029 steps 1–2 and TC-DPLAN-030 step 1 (checklist recorded in the Execution Log).

**Completion signal**: `docs(GH-226): flip plan-writer output to the YAML plan schema`

---

### Phase 7: Finalize and Release — Gates, Version Bump, Spec Reconciliation

**Goal**: Close the change: full aggregate gates green, version bump per repo conventions, spec reconciliation dispatched to the doc-sync phase, and Definition-of-Done evidence recorded.

**Tasks**:

- [x] **7.1** Run the full gate battery: `pnpm check` (lint → format → typecheck → tests → boundaries + exports parity), `bash scripts/.tests/test-doc-distribution.sh`, plugin staleness (`git diff --exit-code -- .ados-claude`), `git diff --check`. Any failure routes to `@fixer` and re-runs (lifecycle phase 9).
- [x] **7.2** Add the changeset for the minor version bump per the lockstep `.changeset/` convention (no hand-edited package versions; changesets owns the bump). No new dependencies were added, so no license-registry verdict is required.
- [x] **7.3** Spec reconciliation (lifecycle phase 7 handoff): record for `@doc-syncer` — (a) author the feature spec under `doc/spec/features/` covering the plan family, the schema, and the naming/precedence rule; (b) update the CLI command registry `plan` family row to shipped status (TC-DPLAN-030 step 2 completes there); (c) reconcile `doc/spec/**` with the delivered verdict fields and error identities. This plan does not author those documents.
- [x] **7.4** Verify DoD against spec §17: all 11 ACs evidenced by their TC rows (see Test Scenarios below), all plan tasks checked, success-metrics table from spec §4.1 satisfied, Execution Log completed with per-phase commits and the TC-DPLAN-026 measured median (Bun version, platform). Confirm OQ-3 and OQ-8 review outcomes are recorded (or explicitly confirmed as defaults) before merge.

**Acceptance Criteria**:

- Must: `pnpm check`, distribution guard, and plugin staleness all green in a clean tree.
- Must: changeset present (minor); no manual version edits.
- Must: deferred documentation items (feature spec, registry row) explicitly recorded for the `system_spec_update` phase — not silently dropped.
- Should: Execution Log complete enough that `@pm`'s dod_check and `@reviewer` need no archaeology.

**Files and modules**:

- Code areas: `.changeset/` (new changeset file).
- System docs: deferred items listed for `@doc-syncer` (see task 7.3) — authored in lifecycle phase 7, not here.

**Tests**:

- Full `pnpm check`; `bash scripts/.tests/test-doc-distribution.sh`; `git diff --exit-code -- .ados-claude`; `git diff --check`.

**Completion signal**: `chore(GH-226): finalize release with changeset and gate evidence`

---

### Phase 8: Code Review Remediation (Iteration 1)

**Goal**: Close the review findings from `code-review/review-iter-1.yaml` — complete the F-13 consuming-prompt flip for the nine lifecycle prompts still locating only `chg-<ref>-plan.md` (F-1), pin the plan-phase completion-evidence convention (F-2), and land the low-severity documentation corrections (F-3..F-6). Code (contracts/domain/CLI/adapters/tests) needs no changes: the review re-ran the plan suites, structure suites, distribution guard, and plugin staleness check green at HEAD and confirmed OQ-3/OQ-8 defaults.

**Tasks**:

- [ ] **8.1** Route to `@toolsmith` (F-1, RSK-7, spec F-13): flip the nine residual prompts to the dual-format discovery rule already used by run-plan/coder — `chg-<workItemRef>-plan.yaml` is the current plan, YAML wins when both formats exist, legacy `chg-<workItemRef>-plan.md` stays readable via the classified `plan.format.legacy-markdown` verdict. Files: `.opencode/agent/reviewer.md` (~line 82 discovery; also the local-mode "Spec and Plan Audit" step 7 semantics), `.opencode/agent/pm.md` (~line 386 dod_check step), `.opencode/agent/readiness-reviewer.md` (~line 49 inputs), `.opencode/agent/doc-syncer.md` (~line 32), `.opencode/agent/test-plan-writer.md` (~line 50), `.opencode/command/review.md` (~line 38 + plan task-audit semantics), `.opencode/command/review-deep.md` (~line 39), `.opencode/command/sync-docs.md` (~lines 50, 171), `.opencode/command/write-test-plan.md` (~lines 46, 52). Where prompts parse task checkboxes, keep the checkbox flow for legacy markdown plans and add the YAML flow: plan audit / DoD verification compares declared `phases[]` scope against the diff (may use `plan diff`/`plan validate`) plus pm-notes completion evidence.
- [ ] **8.2** Route to `@toolsmith` (F-2): pin the plan-phase completion-evidence convention in `.opencode/command/run-plan.md`, `.opencode/agent/coder.md`, `.opencode/agent/pm.md`, and `.opencode/agent/reviewer.md`: per-plan-phase evidence is recorded in `chg-<ref>-pm-notes.yaml` (notes entry naming the plan phase id, commit hash, and test outcome) — the `phase` CLI command only transitions lifecycle phases and must not be cited for plan-phase progress; declared YAML scope is never mutated to record progress. Align the DoD-guide wording ("phase ledger and PM notes") if needed so plan phases vs lifecycle phases are unambiguous.
- [ ] **8.3** Route to `@toolsmith` (RSK-6, TC-DPLAN-029 step 3): regenerate `.ados-claude/` (`./scripts/build-claude-plugin.sh --verbose`), confirm `git diff --exit-code -- .ados-claude` after staging, run `bash scripts/.tests/test-doc-distribution.sh` and `git diff --check`; commit prompt sources and regenerated plugin output together.
- [ ] **8.4** Docs (F-5): in `doc/spec/features/feature-plan-schema.md` (integration section), correct the repository-diff claim: the actual-diff input is an embedder-injected `readDiff` port; no production diff reader ships in-tree (the repo adapter reads `.git` metadata only); an unconfigured composition answers exit 2 `input.value.rejected`. Keep the existing `ados_distribution` marker; re-run the distribution guard.
- [ ] **8.5** Change-artifact hygiene (F-3, F-4): correct plan task 4.2's exit text (malformed invocation projects exit 1 via `input.value.rejected` / user-validation per the shared error table; exit 2 stays the unreadable/platform class) and record the reconciliation in the Execution Log note for Phase 4; update `chg-GH-226-test-plan.md` §7 statuses to implemented/executed and §10 with the execution summary (suites green; TC-DPLAN-026 median 6.41 ms / p95 11.25 ms, re-verified at 2.40/4.59 ms; Bun 1.4.4 linux/x64) and add the p95 assertion to the TC-DPLAN-026 body per NFR-2.
- [ ] **8.6** Optional, low (F-6): add one sentence to `feature-plan-schema.md` (overlap section) documenting the conservative same-static-prefix approximation for package-pattern pairs (sequence-biased, never false-parallel), and optionally a `tests/fixtures/plan/overlap/precision/` fixture pinning it. Skip is acceptable if 8.4 lands; record the choice in the Execution Log.

**Acceptance Criteria**:

- Must: zero `.opencode` prompts locate only `chg-<ref>-plan.md` (grep-verified); reviewer/pm/readiness prompts handle both plan formats with the YAML plan authoritative; regenerated plugin current (staleness clean); distribution guard green (F-1).
- Must: plan-phase evidence convention named identically in run-plan, coder, pm, and reviewer prompts and consistent with the DoD guide (F-2).
- Must: feature-spec diff-reader wording matches the shipped seam (F-5); plan task 4.2 text and test-plan §7/§10 reconciled (F-3, F-4).
- Should: `pnpm check` green after the prompt/doc changes; no source-code changes required.

**Files and modules**:

- Code areas: none expected (prompt and documentation only; if 8.6 adds a fixture, its expectation row lands with it).
- System docs: `.opencode/**` (nine prompts), `.ados-claude/**` (regenerated), `doc/spec/features/feature-plan-schema.md`, this change folder's plan and test plan.

**Tests**:

- `./scripts/build-claude-plugin.sh --verbose` + `git diff --exit-code -- .ados-claude`; `bash scripts/.tests/test-doc-distribution.sh`; `git diff --check`; `pnpm check`.

**Completion signal**: `docs(GH-226): complete consuming-prompt flip and review remediation`

---

## Test Scenarios

All 30 scenarios from `chg-GH-226-test-plan.md` mapped to the phase that lands them (tests land with the code they verify; TC-DPLAN-001/013 domain halves in Phases 2–3, edge halves in Phase 4; TC-DPLAN-022 lint classes completed in Phase 5):

| TC ID | Scenario (short) | Phase | AC / F / NFR |
|-------|------------------|-------|--------------|
| TC-DPLAN-001 | Valid plan validates and is ready for development | 2 (domain), 4 (edge/text) | AC-F8-1 control, F-1, F-8 |
| TC-DPLAN-002 | Invalid schema classified naming phase and field | 2 | AC-F8-1 |
| TC-DPLAN-003 | Rejection corpus classified, none silently accepted | 2 | AC-F8-1, NFR-5 (OQ-1 fixture row) |
| TC-DPLAN-004 | Tier echoed verbatim; no built-in default | 2 | AC-F6-1 |
| TC-DPLAN-005 | Unknown tier → `plan.tier.unknown` | 2 | AC-F6-1 |
| TC-DPLAN-006 | Tier phase sets and triggers inert | 2 | AC-F6-1, F-6 |
| TC-DPLAN-007 | Done-artifacts echoed per delivery phase | 2 | AC-F3-1 |
| TC-DPLAN-008 | Lease split and lease/weight echo | 2 | AC-F7-1 (OQ-8 default asserted as echo-only) |
| TC-DPLAN-009 | Ready gate refuses unvalidatable plan (SC-M1-07) | 4 | AC-F12-1, DEC-2, DEC-6 |
| TC-DPLAN-010 | Missing plan artifact classified, never a crash | 2 | AC-F12-1 (OQ-2 identity) |
| TC-DPLAN-011 | Legacy markdown transition verdict | 2 | AC-F13-1 (OQ-3 default) |
| TC-DPLAN-012 | Legacy corpus readable, never schema-valid | 2 | AC-F13-1, NFR-6 (OQ-4 determinism) |
| TC-DPLAN-013 | Overlap sequence, paths named, producer first (SC-M1-06) | 3 (domain), 4 (edge/text) | AC-F10-1, AC-F10-3, DEC-1, DEC-5 |
| TC-DPLAN-014 | Disjoint plans parallel, empty list | 3 | AC-F10-2 |
| TC-DPLAN-015 | Overlap precision, no false verdicts | 3 | AC-F10-1, F-2 (OQ-5 frozen) |
| TC-DPLAN-016 | Ordering symmetric, declared, deterministic | 3 | AC-F10-3, NFR-1 (OQ-6 vocabulary) |
| TC-DPLAN-017 | Diff classifies declared vs actual | 3 | AC-F9-1 |
| TC-DPLAN-018 | Diff fully within exits 0, honours `--against` | 3, 4 (exit) | AC-F9-1, F-9 |
| TC-DPLAN-019 | Diff resolves wildcards, no prefix bleed | 3 | AC-F9-1, F-2 |
| TC-DPLAN-020 | Lint plan conformance with locations | 5 | AC-F11-1 (OQ-7 application) |
| TC-DPLAN-021 | Lint plan classifies unreadable (exit 2) | 5 | AC-F11-1, NFR-5 |
| TC-DPLAN-022 | Envelope valid on failure; exits at the edge | 4 (lint classes in 5) | DEC-1, NFR-5, SC-M1-19 |
| TC-DPLAN-023 | Read-only; no network/spawn/credentials | 4 | NFR-2, NFR-3 |
| TC-DPLAN-024 | Byte-identical replay vs goldens | 4 | NFR-1 |
| TC-DPLAN-025 | Oversized payloads truncate deterministically | 3 | NFR-4 |
| TC-DPLAN-026 | 30-phase validate under latency/read bound | 4 | NFR-2 |
| TC-DPLAN-027 | Purity, layering, registration invariants | 1, 2, 3 (per-phase), 7 (final) | NFR-7 |
| TC-DPLAN-028 | Error identities registered and synced | 1 | DM-8, NFR-5 (OQ-1/OQ-2/OQ-7 rows) |
| TC-DPLAN-029 | Writer flip, template, prompts ship together | 6 | AC-F13-1, F-1, F-13, RSK-6 |
| TC-DPLAN-030 | Naming and distribution markers drift-free | 6 (steps 1, 3, 4); step 2 at doc-sync | F-13, DM-1, DEC-7 (OQ-4 documented) |

## Artifacts and Links

| Artifact | Location | Type |
|----------|----------|------|
| Change specification | `./chg-GH-226-spec.md` | Input (source of truth) |
| Test plan | `./chg-GH-226-test-plan.md` | Input (TC/AC coverage source) |
| This implementation plan | `./chg-GH-226-plan.md` | Output |
| PM notes | `./chg-GH-226-pm-notes.yaml` | Context |
| Tracker ticket | https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/226 | Tracker |
| Plan schema + verdict types | `packages/core/src/contracts/` (new modules) | Code (Phase 1) |
| Error-table additive rows | `packages/core/src/contracts/error-table.ts` | Code (Phase 1) |
| Validation domain logic | `packages/core/src/domain/plan-*.ts` | Code (Phases 2–3) |
| `plan` command family | `packages/cli/src/commands/plan*.ts`, `edge.ts`, `index.ts`, `output/serialize.ts` | Code (Phase 4) |
| Lint plan target | `packages/cli/src/commands/lint.ts` | Code (Phase 5) |
| Fixture corpus + harness + goldens | `tests/fixtures/plan/**`, `tests/golden/plan/` | Test assets (Phases 1–4) |
| Behaviour/structure tests | `tests/behaviour/plan-*.test.ts`, `tests/structure/`, `tests/boundaries/` | Tests (Phases 1–5) |
| Implementation plan template | `doc/templates/implementation-plan-template.md` | Doc (Phase 6) |
| Writer/consumer prompts | `.opencode/agent/plan-writer.md`, `.opencode/command/write-plan.md`, `.opencode/command/run-plan.md`, `.opencode/agent/coder.md` | Docs (Phase 6) |
| Generated plugin output | `.ados-claude/**` | Regenerated (Phase 6) |
| Change convention guide | `doc/guides/unified-change-convention-tracker-agnostic-specification.md` | Doc (Phase 6) |
| Changeset (minor) | `.changeset/` | Release (Phase 7) |
| Feature spec + registry row | `doc/spec/features/`, `doc/planning/oss-tooling/cli-command-registry.md` | Deferred to lifecycle phase 7 (@doc-syncer) |

## Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-05 | plan-writer | Initial plan from the completed GH-226 spec and test plan: 7 phases (contracts → validation domain → overlap/diff domain → CLI family → lint target → writer flip docs → finalize), OQ-1..OQ-8 pinned with OQ-3/OQ-8 routed to review, all 30 TCs mapped to phases, tests landing with their code. |
| 1.1 | 2026-11-05 | reviewer | Appended Phase 8 remediation from review iteration 1 (`code-review/review-iter-1.yaml`, verdict FAIL): F-1 nine lifecycle prompts still locate only `chg-<ref>-plan.md` (fix-in-change via @toolsmith); F-2 plan-phase evidence convention unpinned (phase command is lifecycle-only); F-3..F-6 low-severity doc corrections; OQ-3/OQ-8 defaults confirmed; TC-DPLAN-026 p95 hard-assert judged matching NFR-2. Code phases 1–7 unchanged and green. |

## Execution Log

| Phase | Status | Started | Completed | Commit | Notes |
|-------|--------|---------|-----------|--------|-------|
| 1 | Completed | 2026-11-05T22:04Z | 2026-11-05T22:12Z | 90c10ae9 | Plan schema contracts, additive `plan.*` and lint-unreadable identities, fixture harness foundation; `bun test tests/structure` 390 pass. |
| 2 | Completed | 2026-11-05T22:13Z | 2026-11-05T22:27Z | 9546258d | Pure validation domain, tier/artifact/lease echo, legacy transition, absent classification, valid/invalid/legacy corpora; 26 behaviour tests pass. |
| 3 | Completed | 2026-11-05T22:28Z | 2026-11-05T22:40Z | 4c8cc233 | Overlap and diff domain with named descriptors, producer-first ordering, wildcard boundaries, bounded output; 43 plan behaviour tests pass. |
| 4 | Completed | 2026-11-05T22:41Z | 2026-11-05T23:02Z | a5b028ab | Plan CLI family, edge exit projection, text mode, envelope/read-only/determinism/perf suites; 79 plan tests pass. TC-DPLAN-026: median 6.41 ms, p95 11.25 ms (Bun 1.4.4, linux/x64), 30 phases, one plan read. |
| 5 | Completed | 2026-11-05T23:03Z | 2026-11-05T23:12Z | e434f3ff | Additive lint plan target; non-conformant exit 1, unreadable exit 2, pm-notes/registry unchanged; plan-lint + envelope 22 pass. |
| 6 | Completed | 2026-11-05T23:13Z | 2026-11-05T23:24Z | 474bada9 | Writer flip, YAML template, run-plan/coder consumption guidance, naming/precedence in the guide, `.ados-claude` regenerated in the same commit. TC-DPLAN-029/030 manual review: one current format, legacy note explicit, no scheduler/queue/ceremony promises; distribution guard no drift (81 docs), `git diff --check` clean. This change's own `chg-GH-226-plan.md` stays markdown and is covered by legacy readability; the flip governs plans authored after merge. |
| 7 | Completed | 2026-11-05T23:25Z | 2026-11-05T23:35Z | this commit | Full `pnpm check` green; distribution guard no drift; plugin staleness clean; `git diff --check` clean; minor lockstep changeset `.changeset/gh-226-plan-schema-minor.md`. Deferred to `system_spec_update` (@doc-syncer): author the plan-family feature spec under `doc/spec/features/`, update the CLI command registry `plan` row to shipped, reconcile `doc/spec/**` with the delivered verdict fields and identities. OQ-3/OQ-8 remain review-routed working defaults (DEC-1 legacy verdict exit 1; unknown weight class echoed opaquely). |
