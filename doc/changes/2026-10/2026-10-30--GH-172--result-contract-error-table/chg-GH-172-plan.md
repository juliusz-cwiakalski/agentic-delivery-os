---
id: chg-GH-172-result-contract-error-table
status: Proposed
created: 2026-10-30T02:50:00Z
last_updated: 2026-10-30T02:50:00Z
owners: ["Juliusz Ćwiąkalski"]
service: delivery-os
labels: ["oss-tooling", "contracts", "cli", "m0", "adr-0003"]
links:
  change_spec: ./chg-GH-172-spec.md
  test_plan: ./chg-GH-172-test-plan.md
  pm_notes: ./chg-GH-172-pm-notes.yaml
  survey: ./survey-agent-facing-error-design.md
  adr: ../../../decisions/ADR-0003-oss-monorepo-structure.md
  man_page_v0: ../../../planning/oss-tooling/cli-command-registry.md
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
summary: >
  Deliver the M0-S3 trust substrate per spec v1.1: the CommandResult envelope
  (schemaVersion delivery.result.v1, runId, exitCode, timing, exactly one of
  data or error) in core ./contracts beside the unchanged generic Result<T,E>;
  the machine-readable internal error table as single source (domain.reason.detail
  codes, category, retryable, consequence with unknown first-class, action-first
  hints, projection classes) including the two DEC-13 containment entries
  fallback.invocation and fallback.internal; the classification chain and the
  {0,1,2} exit-code projection confined to the standalone CLI; runCli(argv,
  streams) as the deterministic, in-process, injectable command surface whose
  --json machine output is always a valid envelope even for broken commands;
  a single redaction chokepoint on the serialization path; golden suites for
  success, failure, broken-command, and planted-secret outcomes; the documented
  error table shipped in-change at doc/spec/features/feature-result-contract.md
  with a binding two-directional sync check; and a call-site exit-literal ban —
  all under the binding M0-S2 constraint of zero product tokens, with brand
  values flowing as BrandIdentity parameters at the runtime-aware edge.
version_impact: minor
---

# IMPLEMENTATION PLAN — GH-172: M0-S3: Result contract and error table

## Context and Goals

This plan executes [chg-GH-172-spec.md](./chg-GH-172-spec.md) (v1.1) and is verified by [chg-GH-172-test-plan.md](./chg-GH-172-test-plan.md) (v1.1, 38 TCs). All product-shape decisions are resolved in the spec (DEC-1..DEC-13); none are re-opened here. Behavior targets come from the test plan and must not change (A-T1); this plan binds file paths, symbol names, fixture layout, check wiring, and task order. Baseline: `main-tools` @ `b3a00a9` (M0-S1 + M0-S2 merged). Active branch `feat/GH-172/result-contract-error-table` carries four artifact commits (spec, test plan, spec amendment, test-plan touch-up) and zero source changes — everything below is greenfield surface.

**Goals** (spec G-1..G-9): one `CommandResult` envelope · one failure model (the error table as single source) · self-describing errors for agents · exit codes as a CLI-only {0,1,2} projection of the table · a testable `runCli(argv, streams)` surface · `--json` output always valid (broken commands contained) · secrets never in output (one redaction chokepoint) · documented codes stay true (binding sync check) · full M0-S1/M0-S2 constraint conformance.

**Binding owner constraint (every authoring step)**: NO hardcoded product token anywhere; no public product name is selected, proposed, or revealed in ANY artifact of this change. Brand-dependent strings (binary name, environment prefix in usage/diagnostic text) flow as `BrandIdentity` parameters at the runtime-aware edge; the M0-S2 forbidden-literal scan is live and binding on every artifact. Synthetic brand values only (`example-product`, `.renamed-product`).

**Plan-stage decisions (D1..D12, binding for delivery)** — each is a technical, reversible decision delegated to delivery planning by spec §14 ("Remaining mechanics... owned by delivery planning") and test-plan OQ-T3/OQ-T4 plus the A-T assumptions:

- **D1 — Redaction placeholder policy (resolves OQ-T3)**: each registered secret **value is replaced with the fixed placeholder `[redacted]`**, wherever it occurs — string values, object keys, and substrings embedded inside larger strings (URLs/DSNs), at any nesting depth — applied to the envelope payload before serialization and to human diagnostics on the error channel, then asserted byte-level on both streams (raw and unescaped-decoded). Justification: (a) the TC-REDACT-003 corpus plants secrets as substrings (URL-embedded, JSON keys, escaped values) — field removal cannot express "remove the secret inside this URL while keeping the field", so removal would need a second mechanism for substrings; one uniform replacement policy covers every corpus form; (b) shape preservation is asserted (TC-REDACT-001 steps 3–4) — the placeholder keeps sibling structure and non-secret values byte-identical, where removal would change shape; (c) golden honesty — the placeholder makes the chokepoint's firing visible in the golden (position legible, value gone) instead of silently shrinking fields; (d) an agent reading a present-but-redacted field learns "a value existed and was secret" without leakage. Golden consequence: secret-case goldens contain literal `[redacted]` at each planted position; byte-exact equality includes the placeholder; the over-redaction guard (realistic non-secret control payload round-trips byte-identically) proves replacement is targeted. Recorded edge: two distinct registered secrets planted as keys in the same object collapse to one placeholder key — accepted; the corpus plants at most one secret key per object level.
- **D2 — Enforcement vehicle for CLI confinement (resolves OQ-T4)**: split by concern. **Import-graph and ambient bans become three new dependency-cruiser rules** with failing negative fixtures + clean controls in `tests/boundaries` (the repo's GH-171 `ambient-env-branding` precedent): `ambient-env-cli` (no `process.env`/`Bun.env` anywhere in `packages/cli/src/**` — no exception path ships in this change, since the edge receives environment facts as injected data), `surface-serializer-entry-only` (only the surface entry `packages/cli/src/index.ts` may import the serialization module), `surface-projection-cli-only` (the projection module may not be imported from `core`/`adapters`/`mcp`/`opencode`). **Intra-module content and ordering facts become one AST structure test** `tests/structure/cli-edge-seam.test.ts` with `mkdtemp` temp-copy mutations (the TC-EXIT-003 step-2 and TC-REDACT-004 step-1 allowance for structure scans): no stream write (`stream.write`, `console.*`, `process.stdout/stderr`) outside the serialization module, and the single write call site occurs after the redaction call in source order. Rationale: dependency-cruiser owns the graph (path rules, fixture harness, registry at `severity: error`) but cannot assert intra-file statement order; the AST guard is the established vehicle for content bans that must name file and line. AC-F9-1's "every new forbidden rule ships a failing negative fixture" is satisfied in both vehicles: depcruise rules via `tests/boundaries` fixtures, the AST scans via equivalent temp-copy mutations.
- **D3 — Module and file binding (resolves the test plan's † names)**: `packages/core/src/contracts/result.ts` (envelope + error-object types, enums, `RESULT_SCHEMA_VERSION` const, `AppErrorCode` type), `packages/core/src/contracts/error-table.ts` (entry type, `DOMAIN_KINDS`, `ERROR_TABLE`, the two fallback code constants), re-exported from the existing `contracts/index.ts`; `packages/cli/src/classify.ts` (classification chain), `packages/cli/src/projection.ts` (exit projection — the only permitted home for the digits), `packages/cli/src/output/serialize.ts` (redaction chokepoint + serialization + the single stream-write call site), `packages/cli/src/edge.ts` (designated runtime-aware edge: production defaults for clock/runId, secret-set registration from injected environment facts, brand parameter assembly), `packages/cli/src/index.ts` (`runCli` + dispatch + containment); `packages/testkit/src/result-conformance.ts` (`assertEnvelopeContract`, `RULES`, golden loader); `scripts/checks/error-table-sync.ts` and `scripts/checks/exit-code-literals.ts`; test files and fixture layout exactly as bound in test-plan §4/§5. `packages/cli/src/commands/index.ts` stays placeholder (NG-1 — no command registry ships).
- **D4 — Seed table content**: the initial `ERROR_TABLE` carries exactly the two DEC-13 fallback entries plus **two seed domain entries** — one per failure projection class, required by TC-RESULT-003's precondition (synthetic commands must resolve through one `user-validation` and one `platform-provider` entry) and by classification totality (TC-CLASSIFY-001 enumerates declared domain kinds): `provider.quota.exceeded` (domainKind `provider`; category `transient`; retryable `true`; consequence `not_landed`; projection `platform-provider`; the spec's own canonical example) and `input.value.rejected` (domainKind `input`; category `user`; retryable `false`; consequence `not_landed`; projection `user-validation`). Remediation hints are action-first and secret-free (authored in Phase 2, reviewed under TC-REVIEW-001). `fallback` is the reserved two-segment namespace (A-T11); domain-kind namespaces at v1 are exactly `provider` and `input`. Field values are plan-stage bindings reviewable at DoR/PR without behavior change.
- **D5 — Timing shape and unit**: `timing` is `{ totalMs: number }` — integer milliseconds, the total run duration derived from the injected clock's start/end ticks; present on every envelope including zero-delta runs (a present `0`, never omitted). Production default clock (edge-only) computes an integer-ms delta. Golden cases use the distinct injected deltas 13/7/0/2 ms per test-plan §5.2 TC-RESULT-004.
- **D6 — `runId` production default**: an opaque non-empty string from `crypto.randomUUID()` produced only inside the designated edge module, always injectable via deps; contracts carry the field only (DEC-8). Determinism suites inject fixed ids and stub ambient sources to throw.
- **D7 — Void success payload**: `data: {}` (an explicit empty object), `error` key absent (A-T2 confirmed; no delivery rebind needed).
- **D8 — Documented-table format** (the sync check's S2 surface): `doc/spec/features/feature-result-contract.md` contains a fixed heading (`## Documented error table`) followed by exactly one Markdown table whose header columns are, in order: `Code | Domain kind | Category | Retryable | Consequence | Remediation hint | Projection class | Summary` — one row per entry. The sync check parses this section strictly: wrong header, malformed row, missing/empty/unparseable section all fail closed (never skip) — feeding TC-SYNC-003.
- **D9 — No changeset file** (verified): all packages are `private: true` at `0.0.0` and `.changeset/config.json` sets `privatePackages: {version: false, tag: false}` — a changeset cannot version anything pre-freeze; `changesets-group.ts` validates only the config shape; GH-171 D3 set the same precedent. `version_impact: minor` is recorded in spec + this plan; the lockstep fixed group owns versioning from the naming-freeze change. Nothing publishes, so there is no version number to bump.
- **D10 — No `ADOS_DELIVERY_SCRIPTS` registration** (verified): `scripts/install.sh`'s array holds only the five lifecycle wrapper scripts installed into adopter projects; none of the existing twenty `scripts/checks/*.ts` invariants is registered. The two new checks are repo-internal workspace invariants like their siblings — no `install.sh` change.
- **D11 — No `ados_distribution` marker on the new feature doc** (verified against `scripts/.tests/test-doc-distribution.sh`): the drift-guard scan set is `doc/guides/**`, `doc/templates/**` (incl. blueprints and `*.yaml`), and the five standalone docs (`doc/documentation-handbook.md`, `doc/00-index.md`, `doc/decisions/README.md`, `doc/decisions/00-index.md`, `.ai/rules/README.md`). `doc/spec/**` is outside the marker-required set, so `doc/spec/features/feature-result-contract.md` ships without a marker.
- **D12 — One confined runtime allowance in the CLI tier** (the single unavoidable tier registration, stated per repo constraint): ambient clock/id defaults live only in `packages/cli/src/edge.ts`; if the existing `ambient-globals`/`runtime-apis-confinement` tier scope requires it, the Phase 6 rule update adds exactly that one path allowance. Justification: the edge is runtime-aware by design (ADR-0003); every default is injectable, determinism suites stub ambient sources to throw, and no other CLI module gains any ambient or runtime-API access (`ambient-env-cli` ships with no exception path). No `packages/adapters`/`mcp`/`opencode` rule or registration changes.

**Phase-order note**: the delegation sketch placed goldens last; this plan delivers the golden harness **with** the `runCli` surface (Phase 3) because containment and envelope integrity are golden-proven (TC-CONTAIN-001..003, TC-RESULT-002..004 are the golden layer) — authoring the harness once avoids writing the same assertions twice as unit tests and then as fixtures. Every phase remains independently green.

**Open questions carried in**: none blocking. OQ-T3 resolved by D1; OQ-T4 resolved by D2. Manual gates that stay with the owner: TC-REVIEW-001 (hint quality, evolution discipline, gate integrity, dynamic-access review) at PR review.

**Risk handling** (spec §11 owned here; test-plan RSK-T1..T13 honored by construction): RSK-1 (contract cascades to M0-S4+) → man-page-v0 field set + survey verdicts fixed in spec, `schemaVersion` evolution channel from day one, DoR gate before delivery; RSK-2 (docs/code drift) → Phase 5 binding two-directional sync check with non-vacuity and fail-closed mutations (TC-SYNC-001..005); RSK-3 (redaction bypass) → D1/D2 single chokepoint + exclusivity rules + planted-secret goldens with vacuity controls (TC-REDACT-001..004); RSK-4 (exit-code folklore) → CLI-only projection module + the exit-literal invariant with per-form mutations (TC-EXIT-002); RSK-5 (crash escapes containment) → top-level containment wrapping all handler execution + hostile-body goldens (TC-CONTAIN-003); RSK-6 (brand leak) → parameters-only brand seam + live scan + `ambient-env-cli` (TC-RUNCLI-004, TC-BOUNDARY-003); RSK-7 (`unknown` overuse) → explicit consequence on every entry + allowlist fixture (TC-TABLE-002); RSK-8 (scope creep) → NG-1/NG-2 enforced by phase file lists; no command implementation ships.

## Scope

### In Scope

- F-1 `CommandResult` envelope types + testkit conformance validator (Phase 1).
- F-2/F-3 error table as machine-readable single source (two fallback entries + D4 seeds), classification chain, F-4 exit projection confined to the CLI (Phase 2).
- F-5 `runCli(argv, streams, deps)` — injectable, deterministic, in-process; F-6 top-level containment; serialization with the F-7 redaction chokepoint on the write path; golden harness and outcome goldens (Phase 3).
- F-7 proofs: planted-secret goldens, no-partial-leak sweep, chokepoint exclusivity, edge/brand seam structure tests, fixture hygiene (Phase 4).
- F-8 documented error table shipped in-change + binding two-directional sync check + call-site exit-literal invariant with mutation suites (Phase 5).
- F-9 boundary rules with negative fixtures, CI fast-loop wiring (existing `ts-invariants` job), inventory/allowance updates, full regression consolidation (Phase 6).
- Finalization: evidence, gate list, version-bump decision (D9), spec-reconciliation inputs for `@doc-syncer` (Phase 7).
- All 38 TCs of the test plan in its runner split: `bun test` (structure/behaviour/golden/checks-mutations), `bun run scripts/checks/*.ts` (invariants), existing bash suites run-only.

### Out of Scope

- Spec §7.2 in full: command implementations and command registration (`config` is M0-S4), command-name lock (M0-S17), layered configuration (M0-S4), state drivers (M0-S5), phase/lint (M0-S10), db admin (M0-S11), adapter ports (M0-S12), telemetry emission (reserved names untouched), MCP/opencode result conventions, human terminal UX (non-`--json` stdout shape unasserted — OQ-T5), survey promotion into the distributable doc set, cloud anything, and any change to the bash stack, `.opencode/**`, `.ados-claude/**`, existing gates (no weakening, C-8). PR creation is a later lifecycle phase — no task here creates the PR.
- No new runtime dependencies (the fail-closed license registry applies if violated).

### Constraints

- **No product token** (NFR-9): the binding owner constraint governs every artifact; synthetic brand values only; `tests/**` is outside the M0-S2 scan, so TC-BOUNDARY-004 fixture hygiene closes that gap for the new fixtures.
- **Runtime neutrality** (NFR-1): `core` `./contracts` gains types and `as const` data only — no I/O, no ambient environment/clock/randomness, no function bodies (TC-TABLE-004); classification, projection, serialization, and redaction live in `cli` (F-2) with the single D12 edge allowance.
- **Gates are binding**: no `continue-on-error`, `|| true`, `set +e`, or `exit 0` wraps; check failures name the offending code, surface, file, and line.
- **Aggregate untouched; CI additive**: the five-step `pnpm check` chain is unchanged; the two new checks join the existing `ts-invariants` step list by name — `TS_JOBS` and bash job ids unchanged; `ci.yml` additions-only vs `origin/main-tools` (A-T6, TC-SYNC-006).
- **Strict TS + Biome + depcruise**: `tsconfig.base.json` flag set, Biome 2-space/100-col, tier matrices green with negative fixtures for every new forbidden rule; `bun:test`; mutation tests materialize `mkdtemp` temp trees only.
- **Commit discipline**: exactly one Conventional Commit per phase (`feat(GH-172): …` / `docs(GH-172): …`); body lines ≤ 100 chars (ts-commitlint error severity); every phase leaves `pnpm check` green.
- **No license headers** on `doc/changes/**` or `doc/spec/**` (repo rule); no hand-added headers anywhere.

### Risks

- **RSK-1** (wrong shape cascades): spec-fixed field set + `schemaVersion` channel + DoR gate review before delivery; goldens make any later drift loud.
- **RSK-2**: closed by Phase 5 (binding bidirectional sync + fail-closed doc parsing + non-vacuity counts).
- **RSK-3**: closed by D1/D2 (single chokepoint, exclusivity rules, write-order assertion) + Phase 4 goldens with vacuity controls.
- **RSK-4**: closed by Phase 2 projection totality + Phase 5 exit-literal invariant with per-form mutations.
- **RSK-5**: closed by Phase 3 top-level containment + hostile-body goldens (throws, rejections, malformed results, partial-payload assembly).
- **RSK-6**: closed by the live scan + `ambient-env-cli` + Phase 4 brand-seam tests (brand text reflects injected identity; no ambient brand derivation).
- **RSK-7**: closed by TC-TABLE-002's `unknown`-consequence allowlist (both fallback entries are the baseline; new `unknown` uses fail by name).
- **RSK-8**: closed by phase file lists — no `commands/` implementation, no registry, no config/state surface.
- **RSK-T1..T13** (test plan): injected-determinism goldens with no masking (T1); vacuity controls on redaction and containment (T2); guard with self-test + static AST + survival assertions (T3); non-vacuity + fail-closed (T4); recognition corpora incl. reserved schema names and the `fallback` namespace (T5); in-change documented table bound from merge time (T6); edge-registered secret set as declared input contract (T7); explicit scan scope boundary with no allowlist (T8); guard scoped to `runCli` invocations only (T9); standing rules + TC-REVIEW-001 manual half (T10); hermetic in-process suites (T11); per-file executable allowances with mutation proof (T12); TC-BOUNDARY-004 fixture-hygiene test with seed-literal mutation (T13).

### Success Metrics

Spec §4.1 table, verified by: 100% of `--json` outcomes parse as valid envelopes (golden suites) · 0 field-contract violations · 100% failure envelopes carry `timing` · 0 emitted codes without exactly one documented entry and vice versa (sync check) · 0 planted-secret marker occurrences on any stream · 0 exit codes outside {0,1,2} or not table-derived · 0 call-site exit literals (invariant) · 0 `runCli` tests requiring a spawned process · 0 forbidden product tokens · 0 tier/boundary violations per PR · 0 regressions in existing gates, bash jobs, or the aggregate check.

## Phases

> **Delivery model**: `@coder` executes each phase, then triggers `@committer` with the completion signal. One Conventional Commit per phase (scope `GH-172`; types below; body lines ≤ 100 chars if a body is used). Every phase re-runs `pnpm check` before committing; mutations materialize `mkdtemp` temp trees only, never the live workspace. The execution log below is updated as phases complete.

### Phase 1: Envelope contracts and conformance validator

**Goal**: F-1 (G-1) — the `CommandResult` envelope and envelope-error types declared once in `core` `./contracts` (types + one `as const` constant, runtime-neutral, `Result<T, E>` untouched), plus the dev-only testkit conformance validator with a rule↔negative-case bijection so envelope validity is mechanically checkable from day one.

**Tasks**:

> **No product token**: `delivery.result.v1` is the fixed brand-neutral schema-name lineage value — not a product name; every comment below is brand-free.

- [ ] **1.1** Author `packages/core/src/contracts/result.ts`: `RESULT_SCHEMA_VERSION = "delivery.result.v1"` (single `as const` declaration, the only home — the CLI consumes it, never duplicates the literal); types `CommandResultError` (DM-2: `code: AppErrorCode`, `category`, `retryable`, `consequence`, `remediationHint`, optional non-empty `summary` — nothing else), enums `ErrorCategory` (`user|platform|transient|permanent`), `ErrorConsequence` (`landed|not_landed|unknown`), `ProjectionClass` (`success|user-validation|platform-provider`), `AppErrorCode` (branded string type documented with the `domain.reason.detail` format and the reserved `fallback` two-segment exception), `RunTiming` (D5: `{ readonly totalMs: number }`), and the discriminated envelope union `CommandResult` = success (`schemaVersion`, `runId`, `exitCode`, `timing`, `data` — `error` key absent by construction) | failure (`…`, `error` — `data` key absent); void success typed as `data: {}` (D7). Module statements are type/interface/import declarations plus the one `as const` constant (TC-TABLE-004 shape, TC-BOUNDARY-001).
- [ ] **1.2** Re-export from `packages/core/src/contracts/index.ts` (type-only except the constant); `Result<T, E>` unchanged.
- [ ] **1.3** Author `packages/testkit/src/result-conformance.ts`: `assertEnvelopeContract(parsed: unknown): Violation[]` over plain parsed JSON + exported `RULES` with stable rule ids (exact top-level key set per outcome; mandatory fields present; data/error exclusivity — absent key, not `undefined`; `exitCode ∈ {0,1,2}`; error-object key set and enum validity; `schemaVersion === "delivery.result.v1"`; `runId` non-empty opaque; `timing.totalMs` a non-negative number; rejects empty/non-object). Imports only `@delivery-os/core`/`core/contracts` types — never `@delivery-os/cli` (`testkit-no-surface-import`).
- [ ] **1.4** Author `tests/structure/result-contract.test.ts` — TC-RESULT-001 (exact key sets on success/failure literals; rejection corpus: both/neither `data`+`error`, each mandatory field missing in turn, each rejection names the field; void success `data: {}`; the v1 key set recorded in a conformance fixture so an unexpected sixth key fails until deliberately updated) and TC-RESULT-005 (`schemaVersion` exactly `delivery.result.v1`, brand-neutral, declared once and consumed — AST: no second literal, no id/clock facility in contracts — `randomUUID`/`Date.now`/`Math.random`/`crypto`/timers; `runId` opaque and injected-equal in constructed envelopes). TC-RESULT-006 lands here with inline representative envelopes for its step-1 acceptance; the golden-file sweep of the same rule set is added in Phase 3 when goldens exist (rule bijection: every declared rule id exercised by ≥1 negative case and vice-versa; empty/non-object refused).
- [ ] **1.5** Register new files in `tests/structure/inventory.json` and extend the `EXECUTABLE_ALLOWANCES` map in `tests/structure/content-inventory.test.ts` per file with explicitly named exports: `core/src/contracts/result.ts` → `["RESULT_SCHEMA_VERSION"]`; `testkit/src/result-conformance.ts` → `["assertEnvelopeContract", "RULES"]` (RSK-T12 discipline — never a global switch).

**Acceptance Criteria**:

- Must: AC-F1-1 (type-level field contract + exclusivity + void success), AC-F2-1 first clause (`Result` unchanged; `CommandResult` separate; contracts I/O-free), validator rule-completeness (TC-RESULT-006).
- Should: zero `@ts-expect-error`; module doc comments state the DEC-1 relationship (`Result` = internal computation result; `CommandResult` = command-surface envelope).

**Affected code areas**:

- `packages/core/src/contracts/result.ts` (new)
- `packages/core/src/contracts/index.ts` (updated — re-exports)
- `packages/testkit/src/result-conformance.ts` (new)
- `tests/structure/result-contract.test.ts` (new)
- `tests/structure/inventory.json`, `tests/structure/content-inventory.test.ts` (updated — inventory + allowances)

**System docs to update**:

- none (the documented error table ships in Phase 5; full feature-doc reconciliation is lifecycle phase 7)

**Tests**:

- `bun test tests/structure/result-contract.test.ts` → green incl. the rule bijection and rejection corpus
- `bun run scripts/checks/ambient-globals.ts` → exit 0 (contracts stay inside the ambient-neutral scope)
- `pnpm check` → exit 0

**Completion signal**: `feat(GH-172): add CommandResult envelope contract and testkit conformance validator`

---

### Phase 2: Error table, classification chain, and exit projection

**Goal**: F-2/F-3/F-4 — the machine-readable error table as single source in `core` `./contracts` (D4: two DEC-13 fallback entries + two seed entries), the total deterministic classification chain and the {0,1,2} exit projection in `cli`, with the structure/behaviour suites that make table shape, identity, containment semantics, and projection totality mechanical.

**Tasks**:

> **No product token**: entry codes, hints, and summaries are brand-free prose; `fallback.invocation`/`fallback.internal` are spec-fixed identifiers (DEC-13).

- [ ] **2.1** Author `packages/core/src/contracts/error-table.ts`: `ErrorTableEntry` type (DM-3: `code`, `domainKind`, `category`, `retryable`, `consequence`, `remediationHint`, `projectionClass`, optional `summary`), `DOMAIN_KINDS` const (`["provider", "input"]`), `FALLBACK_INVOCATION_CODE = "fallback.invocation"` / `FALLBACK_INTERNAL_CODE = "fallback.internal"` constants, and `ERROR_TABLE` (`as const`, D4 seed set): `fallback.invocation` (category `user`, `retryable: false`, consequence `unknown`, projection `user-validation`, caller-directed action-first hint), `fallback.internal` (category `platform`, `retryable: false`, consequence `unknown`, projection `platform-provider`, hint directing the caller to diagnostics), `provider.quota.exceeded` (transient/retryable/`not_landed`/platform-provider), `input.value.rejected` (user/non-retryable/`not_landed`/user-validation). Data and types only — no functions (TC-TABLE-004).
- [ ] **2.2** Author `packages/cli/src/classify.ts` (pure, total, deterministic): `classifyDomainKind(kind)` → exactly one entry (every declared kind resolves; never a containment entry); `resolveAppErrorCode(code)` → exactly one entry, with "unresolvable" reported distinctly — no silent containment on lookup (TC-TABLE-003 step 5); `classifyThrown(value)` → entry: errors carrying an undeclared/unknown kind, thrown non-`Error` values (string/undefined/plain object), rejected promises, and malformed results → `fallback.internal`; resolved error objects take `category`/`retryable`/`consequence`/`remediationHint` from the entry with no per-call-site override; carries no thrown message/stack content into the error object (optional non-identifying `summary` only).
- [ ] **2.3** Author `packages/cli/src/projection.ts`: `projectExitCode(projectionClass)` → `success: 0`, `user-validation: 1`, `platform-provider: 2`; unknown/undefined input rejected, never defaulted; pure (throwing clock/env stubs prove it); the only module in the repository permitted to contain exit-code digit literals (§4.6 permitted home).
- [ ] **2.4** Author `tests/structure/error-table.test.ts` — TC-TABLE-001 (full row shape, enum validity, exactly one projection class, explicit `consequence` on every entry, non-empty non-vacuous count), TC-TABLE-002 (+ `tests/fixtures/result/unknown-consequence-allowlist.json`: exactly two fallback entries with fixed DEC-13 values; no third containment entry; every non-fallback `unknown` use allowlisted or fails by name; both resolve through the ordinary path), TC-TABLE-003 (format `^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){2,}$` with the two-segment `fallback` exception; uniqueness; total functional resolution; negative identity corpus: `404`, `provider.quota`, uppercase, leading digit, URI, `HTTP_404`, any `fallback.*` beyond the two), TC-TABLE-004 (single declaration — no second table in `cli` or entry-shaped literal sets in fixtures; contracts declarations-only incl. no `node:*`/`bun:*` imports; `Result` structural expectation fixture; envelope not replaced by `Result` at the surface), TC-BOUNDARY-001 (new contracts files enumerated inside the ambient scope; temp-copy probes `Date.now()`/`Math.random()`/`process.env.X`/`readFileSync` each fail naming file, line, kind; no side-effect statements; each of `Result`/`CommandResult` declared exactly once with no runtime helper exported alongside).
- [ ] **2.5** Author `tests/behaviour/error-classification.test.ts` — TC-CLASSIFY-001 (enumerate `DOMAIN_KINDS`; round-trip kind → entry → code; never containment; no override; symbolic/hierarchical/numeric-free; 10× determinism; temp-copy unmapped-kind mutation fails naming the kind) and TC-CLASSIFY-002 (undeclared kind, thrown string/undefined/plain object → `fallback.internal` with fixed DEC-13 fields; broken invocation routed to `fallback.invocation` — distinct populations; thrown message carrying stack-like text, an absolute path, and a planted marker appears nowhere in the error object; determinism).
- [ ] **2.6** Author `tests/behaviour/exit-projection.test.ts` — TC-EXIT-001 (exact class→code mapping; every table entry projects into {0,1,2}; totality incl. rejection of unknown/undefined; success → 0 without an entry; purity under throwing stubs) and the TC-EXIT-003 structure-scan half (exit derivation exists only under `packages/cli/**`; `core`/`./contracts` declares classes, never numbers; `exitCode` is produced by the projection from the resolved class, not read as a numeric table field; temp-copy numeric map in contracts fails by name). The cross-package boundary-rule half lands in Phase 6.
- [ ] **2.7** Inventory + per-file allowances: `core/src/contracts/error-table.ts` → `["DOMAIN_KINDS", "ERROR_TABLE", "FALLBACK_INVOCATION_CODE", "FALLBACK_INTERNAL_CODE"]`; `cli/src/classify.ts` → `["classifyDomainKind", "resolveAppErrorCode", "classifyThrown"]`; `cli/src/projection.ts` → `["projectExitCode"]`.

**Acceptance Criteria**:

- Must: AC-F2-2, AC-F3-1, AC-F3-2 (both clauses — explicit consequence is structural via TC-TABLE-001 step 4), AC-F4-1 derivation half, AC-F2-1 contracts-neutrality half.
- Should: hints read action-first ahead of the TC-REVIEW-001 manual pass; no `@ts-expect-error`.

**Affected code areas**:

- `packages/core/src/contracts/error-table.ts` (new); `packages/core/src/contracts/index.ts` (updated)
- `packages/cli/src/classify.ts`, `packages/cli/src/projection.ts` (new)
- `tests/structure/error-table.test.ts`, `tests/behaviour/error-classification.test.ts`, `tests/behaviour/exit-projection.test.ts` (new)
- `tests/fixtures/result/unknown-consequence-allowlist.json` (new)
- `tests/structure/inventory.json`, `tests/structure/content-inventory.test.ts` (updated)

**System docs to update**:

- none (Phase 5 authors the documented table)

**Tests**:

- `bun test tests/structure/error-table.test.ts tests/behaviour` → green incl. mutations
- `bun run scripts/checks/ambient-globals.ts`; `pnpm run check:boundaries` → exit 0
- `pnpm check` → exit 0

**Completion signal**: `feat(GH-172): declare error table with fallback containment, classification, and exit projection`

---

### Phase 3: runCli surface, serialization, containment, and outcome goldens

**Goal**: F-5/F-6 (G-5/G-6) — `runCli(argv, streams, deps)` as the deterministic in-process command surface with top-level containment and the always-valid machine channel; the serialization module with the redaction chokepoint already on the write path (D1) and the single-pass write; the golden harness (testkit loader + `tests/golden` discovery) and the outcome goldens for success, void, classified failure, timing, broken invocations, and hostile bodies; the no-spawn guard with self-test.

**Tasks**:

> **No product token**: usage/diagnostic strings render brand values only from the injected `BrandIdentity` (synthetic values in fixtures); argv and command names in fixtures are synthetic (`synthetic.ok` etc.).

- [ ] **3.1** Author `packages/cli/src/edge.ts`: the designated runtime-aware edge — production dependency assembly: default clock (integer-ms start/end ticks, D5), default `runId` source (`crypto.randomUUID()`, D6), secret-set registration from injected environment facts (an env record handed in as data; **no ambient `process.env`/`Bun.env` read ships in this change** — the real reader arrives with the first real command, M0-S4), and `BrandIdentity` passed through as a parameter (never resolved ambiently). All defaults injectable; the module is the only candidate for the D12 ambient allowance (applied in Phase 6 only if the guard's scope demands it).
- [ ] **3.2** Author `packages/cli/src/output/serialize.ts`: the redaction chokepoint (`redact(envelope, secretSet)` applying D1 — replace every registered-secret occurrence with `[redacted]` in string values, object keys, and embedded substrings, recursively, pre-serialization; the same treatment for human diagnostics), serialization to exactly one JSON document with one trailing `\n`, and the single stream-write call site occurring **after** the redaction call in source order; the envelope is fully assembled before the single write (no partial/fragment streaming). No other module in the delivered surface writes to any stream.
- [ ] **3.3** Author `runCli` in `packages/cli/src/index.ts`: signature `runCli(argv, streams, deps)` — argv in; injected stdout/stderr stream-like sinks out; `deps` = brand identity, clock, runId source, secret set, and the synthetic command program (A-T8: commands injected as pure handlers, no registry — `packages/cli/src/commands/index.ts` stays placeholder). `--json` flag handling; unknown command / unknown flag / missing value / conflicting flags → contained via `fallback.invocation` (exit 1); handler-level throws, rejections, and malformed results → `fallback.internal` (exit 2), all inside one top-level containment wrapper that guarantees exactly one valid envelope per run; `timing` from the clock ticks on every path; machine envelope → stdout via the serializer; human diagnostics (if any) → stderr; the numeric exit code returned (never `process.exit`). Brand text in usage/unknown-command strings renders from the injected identity.
- [ ] **3.4** Extend `packages/testkit/src/result-conformance.ts` with the golden case loader (discovers `tests/fixtures/result/envelopes/{case}/` from disk; a case with no golden fails rather than skips) — allowance updated (add `loadGoldenCases`).
- [ ] **3.5** Author the golden fixture set `tests/fixtures/result/envelopes/**` (layout per §4.1: `argv.json`, `injected.json` — clock ticks, runId, brand identity, program id —, `stdout.json`, optional `stderr.txt`, `meta.json` with `outcome` and `secrets`): `success-data`, `success-void`, `classified-user`, `classified-platform`, `broken-unknown-command`, `broken-unknown-flag`, `broken-missing-value`, `broken-conflicting-flags`, `unknown-failure`, plus `tests/fixtures/result/programs/**` (ok-data, ok-void, classified-user, classified-platform, unknown-kind, sync-throw, thrown-non-Error, rejected-promise, throw-after-partial-assembly, malformed-result). Every dynamic value injected (fixed ticks with deltas 13/7/0/2, fixed ids `run-fixture-####`, synthetic brands); no product token, host path, username, timestamp, or real credential.
- [ ] **3.6** Author the golden suites: `tests/golden/envelope-success.test.ts` (TC-RESULT-002: exit 0; byte-exact single-document stdout incl. trailing newline; `schemaVersion`/`runId`/`timing` equal injected values; `data` equals fixture payload; `error` absent; stderr empty; fixture hygiene sweep), `tests/golden/envelope-failure.test.ts` (TC-RESULT-003: classified entries project exit 1/2; error object is a pure table projection, no extra keys, no raw message; TC-CONTAIN-002: no stack-frame markers/absolute paths/`Error:`-prefixes/raw message text on stdout; diagnostics only on stderr; vacuity control — temp-copy serializer appending a stack fails), `tests/golden/timing.test.ts` (TC-RESULT-004: present on all four paths; distinct deltas; changed delta changes only `timing`; zero delta emits a present `0`), `tests/golden/broken-command.test.ts` (TC-CONTAIN-001: every broken shape → exactly one valid envelope resolving to `fallback.invocation` with DEC-13 fields, exit 1, timing present, no crash/non-JSON/parser-error leakage, surface returns; TC-CONTAIN-003: hostile programs → `fallback.internal`, exit 2, no partial-write fragment, single-pass serializer order mutation fails, determinism on the containment path; TC-RUNCLI-003: channel split — one JSON document, no envelope bytes on stderr, no diagnostic text on stdout, stdout valid with stderr dropped entirely, non-`--json` runs assert only exit code + internal envelope).
- [ ] **3.7** Author `tests/behaviour/run-cli.test.ts` — TC-RUNCLI-001 (guard installed per test: throws on `Bun.spawn`/`spawnSync`, `node:child_process` `exec*`/`spawn*`/`fork`, `process.exit`, writes to real `process.stdout/stderr`; guard self-test performs one forbidden call and asserts the throw; `runCli` returns numeric exit, writes nothing to real streams; static AST: delivered surface modules + new test files contain no child-process import, no `Bun.spawn*`, no `process.exit`; failing command does not terminate the test process) and TC-RUNCLI-002 (5× sequential + 5× interleaved/shuffled identical runs → byte-identical stdout/stderr/exit; anti-vacuity: different argv differs, different id changes only `runId`; `Date.now`/`performance.now`/`Math.random`/`crypto.randomUUID` stubs that throw — `runCli` completes with identical bytes; changed clock delta changes only `timing`).
- [ ] **3.8** Add the TC-RESULT-006 golden-file sweep to `tests/structure/result-contract.test.ts` (helper accepts all delivered goldens with zero violations) and register new files in the inventory (`cli/src/output/serialize.ts` → `["redact", "serializeEnvelope"]`, `cli/src/edge.ts` → `["createProductionDependencies", "registerEdgeSecrets"]`, `cli/src/index.ts` → `["runCli"]`; testkit allowance + `loadGoldenCases`). `bunfig.toml` root discovery already picks up `tests/golden/**` (A-T7) — no change.

**Acceptance Criteria**:

- Must: AC-F1-3, AC-F1-2, AC-F5-1, AC-F5-2, AC-F6-1, AC-F6-2 (non-secret half); NFR-2/NFR-4/NFR-8 over the delivered cases.
- Should: goldens carry the golden-change discipline note (update only with a deliberate contract change recorded in the revision log — no `--update` path exists anywhere).

**Affected code areas**:

- `packages/cli/src/edge.ts`, `packages/cli/src/output/serialize.ts` (new); `packages/cli/src/index.ts` (updated — `runCli`)
- `packages/testkit/src/result-conformance.ts` (updated — golden loader)
- `tests/golden/{envelope-success,envelope-failure,timing,broken-command}.test.ts`, `tests/behaviour/run-cli.test.ts` (new); `tests/structure/result-contract.test.ts` (updated)
- `tests/fixtures/result/envelopes/**`, `tests/fixtures/result/programs/**` (new)
- `tests/structure/inventory.json`, `tests/structure/content-inventory.test.ts` (updated)

**System docs to update**:

- none

**Tests**:

- `bun test tests/behaviour/run-cli.test.ts tests/golden` → 100% of discovered cases byte-match; 0 unparseable stdout; 0 secret-marker occurrences
- `bun test tests/structure` → green (golden-file sweep added)
- `pnpm check` → exit 0

**Completion signal**: `feat(GH-172): add runCli surface with serialization, containment, and outcome goldens`

---

### Phase 4: Redaction proofs and the brand/edge seam

**Goal**: F-7 (G-7) — the planted-secret goldens on both payload kinds and both streams with vacuity controls and the no-partial-leak sweep; the edge-registered secret set as the declared redaction input (A-T4); chokepoint exclusivity and ambient-brand confinement as structure tests; fixture hygiene for the new fixture tree.

**Tasks**:

- [ ] **4.1** Author the secret fixtures: `tests/fixtures/result/envelopes/secret-success/**` (planted `planted-fake-*` values at top level, nested, array element, object key) and `secret-failure/**` (planted value in the optional `summary` and a free-form detail field), plus `tests/fixtures/result/redaction/cases.json` (whole token; embedded in URL/DSN; JSON key; split across adjacent nested strings; repeated across fields; a value requiring JSON/unicode escaping; and the over-redaction control payload of realistic non-secret values — URLs, dotted identifiers, version strings).
- [ ] **4.2** Author `tests/golden/redaction.test.ts` — TC-REDACT-001 (success payloads: zero `planted-fake-` occurrences in raw stdout/stderr; payload shape survives with `[redacted]` at planted positions per D1; non-secret siblings unchanged; byte-equal goldens; vacuity control — temp-copy serializer with redaction disabled leaks the marker and fails), TC-REDACT-002 (failure payloads: same zero-marker guarantee; table-derived fields untouched; hint still non-empty action-first; human stderr channel redacted identically), TC-REDACT-003 (sweep: every corpus case × both paths; zero markers in raw AND unescaped-decoded bytes of both streams; control payload round-trips byte-identically; repeated runs identical).
- [ ] **4.3** Author `tests/structure/cli-edge-seam.test.ts` — TC-RUNCLI-004 (brand text reflects the injected synthetic identity; AST scan: no `process.env`/`Bun.env` in CLI modules outside the designated edge; the edge receives its environment facts as injected data — test replaces the reader and observes the registered secret set change; temp-copy mutation adding `process.env.SOMETHING` in a command module fails by name; control copy confined to the edge stays clean; no product-token literal anywhere in new CLI code), TC-REDACT-004 (import-edge assertion that only the surface entry imports the serializer — corroborated by the Phase 6 depcruise rule, asserted here structurally; AST: no `stream.write`/`console.*`/`process.stdout`/`process.stderr` outside `serialize.ts`; the single write call site occurs after the redaction call in source order — order-swap temp-copy mutation fails; hints/summaries are static table data with no runtime interpolation — AST assertion; `console.log(payload)` injection in a command module fails naming file and line).
- [ ] **4.4** Author `tests/structure/result-fixtures.test.ts` — TC-BOUNDARY-004: walk every new fixture and test file; none of the seed literals (`ados`, `ADOS_`, `~/.ados`) appears; brand values synthetic; planted values match `^planted-fake-[a-z0-9-]+$`; goldens carry no absolute path, username, hostname, wall-clock timestamp, or machine id; temp-copy injection of a seed literal into a golden fails naming file and token; fixtures valid JSON where applicable and never named `*.test.ts`.
- [ ] **4.5** No new package sources; inventory unchanged except any fixture-path allowances the content-inventory test requires (verify and update per file if the fixture walk demands it).

**Acceptance Criteria**:

- Must: AC-F7-1 (both payload kinds, both streams, zero marker occurrences, vacuity-proven), AC-F7-2 automated half (chokepoint exclusivity, write ordering, secret-free hints by construction), AC-F9-1 brand-seam half, NFR-5.
- Should: redaction determinism asserted (repeated runs identical) — already in TC-REDACT-003 step 5.

**Affected code areas**:

- `tests/golden/redaction.test.ts`, `tests/structure/cli-edge-seam.test.ts`, `tests/structure/result-fixtures.test.ts` (new)
- `tests/fixtures/result/envelopes/secret-{success,failure}/**`, `tests/fixtures/result/redaction/cases.json` (new)

**System docs to update**:

- none

**Tests**:

- `bun test tests/golden/redaction.test.ts tests/structure/cli-edge-seam.test.ts tests/structure/result-fixtures.test.ts` → green incl. vacuity and mutation controls
- `pnpm check` → exit 0

**Completion signal**: `feat(GH-172): prove redaction chokepoint and confine brand reads to the edge seam`

---

### Phase 5: Documented error table and binding invariant checks

**Goal**: F-8 + the NFR-7 call-site half — the documented error table shipped in-change (the sync check's S2 surface), the two-directional binding sync check, and the exit-code-literal invariant, each with its full mutation suite and corpora; both checks join CI in Phase 6.

**Tasks**:

- [ ] **5.1** Author `doc/spec/features/feature-result-contract.md` (new; NO `ados_distribution` marker — D11): the feature summary (what the envelope and table are, the classification chain, the projection, `runCli`, containment, redaction — code-adjacent current truth as of this change) and the documented error table in the exact D8 format (`## Documented error table`, one Markdown table, header `Code | Domain kind | Category | Retryable | Consequence | Remediation hint | Projection class | Summary`, one row per entry derived from `ERROR_TABLE`). Phase 7 of the lifecycle (doc-syncer) later completes the surrounding feature doc without rewriting this section (RSK-T6).
- [ ] **5.2** Author `scripts/checks/error-table-sync.ts` per §4.4: reads `ERROR_TABLE`/`DOMAIN_KINDS` from the `core ./contracts` surface; S1 = `packages/cli/src/**` + `packages/core/src/contracts/**` excluding the table module; S2 = the D8 section of `feature-result-contract.md` (strict parse; missing/empty/unparseable fails closed); S3 = `tests/fixtures/result/**`; recognition = `^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){2,}$` whose first segment is a declared domain kind, plus the two fixed `fallback` identifiers (any other `fallback.*` fails); assertions: code uniqueness, format validity, table↔doc bijection (exactly-once each side, fallback rows included — no containment exemption), totality over declared domain kinds, deterministic resolution; non-zero count reporting (vacuous green is a failure); read-only over the tree; failures exit non-zero naming code, surface, and line.
- [ ] **5.3** Author `scripts/checks/exit-code-literals.ts` per §4.6: scans `packages/cli/src/**` (+ the other surface packages) — forbidden: numeric assignment to an `exitCode` property outside `packages/cli/src/projection.ts`; `process.exit(n)` anywhere in the delivered surface; a numeric literal other than 0/1/2 in any projection table; hardcoded exit codes in command modules; permitted: the digits inside the single projection module and numeric values inside `tests/**` (scope boundary stated in the report); read-only; failures name file, line, literal.
- [ ] **5.4** Author `tests/checks/error-table-sync.test.ts` — TC-SYNC-001 (delivered state: exit 0; non-zero counts for entries, documented rows, recognized references; bijection; read-only `git status --porcelain` unchanged; failure-message shape inspected via the mutated copies), TC-SYNC-002 (drift A: unregistered code in a CLI module / in an error fixture, in temp copies — non-zero exit naming code, surface, line; reports distinguishable by surface label; no silent containment fallback; live tree untouched), TC-SYNC-003 (drift B: documented-but-not-in-source row; row with a removed column fails on parse strictness; missing doc file fails closed; the in-change artifact remains the bound S2 target after any reconciliation; phantom `fallback.legacy` row fails — exactly two reserved `fallback` members), TC-SYNC-004 (drift C: deleted documented row; new source entry without a row; duplicated row fails exactly-once; each fallback row deletion reported — no exemption), TC-SYNC-005 (+ `tests/fixtures/result/code-corpora/{true,false}-positives.json`: duplicate codes fail naming both positions; malformed source codes fail; false-positive corpus clean — `delivery.result.v1`, `delivery.event.v1`, `delivery.metric.v1`, semvers, dotted filenames, hostnames, prose; true-positive corpus flagged; foreign-namespace codes fail with a named error).
- [ ] **5.5** Author `tests/checks/exit-code-literals.test.ts` — TC-EXIT-002: delivered tree exits 0 with reported scope/file counts; mutations (a) `exitCode: 2` in a command module, (b) `process.exit(1)`, (c) numeric `3` in a projection table row — each fails naming file, line, literal; (d) control `exitCode: derived` inside the projection module stays clean; scope boundary asserted (tests excluded, report states it); read-only; CI-name invocation asserted in Phase 6.
- [ ] **5.6** Register both checks nowhere yet (CI wiring is Phase 6); confirm `script-surface.ts` stays green (checks are `scripts/checks/*.ts` invariants — no root script added, aggregate unchanged, A-T6).

**Acceptance Criteria**:

- Must: AC-F8-1 in full (both drift directions against the in-change artifact, non-vacuous, fail-closed), AC-F4-1 call-site half (TC-EXIT-002), NFR-6, NFR-7 scan half.
- Should: check failure messages name code/surface/file/line so an agent can place the fix without archaeology (spec §10).

**Affected code areas**:

- `scripts/checks/error-table-sync.ts`, `scripts/checks/exit-code-literals.ts` (new)
- `tests/checks/error-table-sync.test.ts`, `tests/checks/exit-code-literals.test.ts` (new)
- `tests/fixtures/result/code-corpora/{true,false}-positives.json` (new)
- `doc/spec/features/feature-result-contract.md` (new — documented table + feature summary; no marker per D11)

**System docs to update**:

- `doc/spec/features/feature-result-contract.md` (new, in-change — lifecycle phase 7 reconciles the surrounding doc later)

**Tests**:

- `bun run scripts/checks/error-table-sync.ts` → exit 0, non-zero counts
- `bun run scripts/checks/exit-code-literals.ts` → exit 0, reported scope
- `bun test tests/checks/error-table-sync.test.ts tests/checks/exit-code-literals.test.ts` → 100% of drift/forbidden-form mutations exit non-zero naming the offender; controls clean
- `pnpm check` → exit 0

**Completion signal**: `feat(GH-172): author documented error table with binding sync and exit-literal checks`

---

### Phase 6: Boundary rules, CI wiring, and regression consolidation

**Goal**: F-9 — the standing enforcement layer: three new depcruise rules with failing negative fixtures and clean controls, the D12 edge allowance if required, both invariant checks wired into the existing `ts-invariants` step (no new job topology), content-inventory completeness, and the full no-regression evidence pack.

**Tasks**:

- [ ] **6.1** Add the D2 depcruise rules to `.dependency-cruiser.cjs`: `ambient-env-cli` (no `process.env`/`Bun.env` in `packages/cli/src/**` — no exception path), `surface-serializer-entry-only` (only `packages/cli/src/index.ts` may import `packages/cli/src/output/serialize.ts`), `surface-projection-cli-only` (`packages/cli/src/projection.ts` not importable from `core`/`adapters`/`mcp`/`opencode`); apply D12 — if the existing `runtime-apis-confinement`/ambient tier scope flags the edge defaults, add exactly the `packages/cli/src/edge.ts` path allowance (the single unavoidable tier registration, D12 justification; no other package's rules change).
- [ ] **6.2** Register the negative fixtures + clean controls in `tests/boundaries/fixtures/cases.ts` and `fixture-registry.json` at `severity: error`: `ambient-env-cli-command-probe` (probe: `process.env.X` read in `packages/cli/src/commands/probe.ts` → violation) + clean control; `surface-serializer-command-import` (probe: command module imports the serializer → violation) + `surface-serializer-entry-clean` (surface entry imports it → clean); `surface-projection-mcp-import` (probe: `packages/mcp/src/probe.ts` imports the projection module → violation) + control. Assert the fixture-coverage meta-check fails naming any rule whose fixture is deleted (TC-BOUNDARY-002 incl. rule-list superset and no severity downgrade).
- [ ] **6.3** Wire both checks into `.github/workflows/ci.yml` by adding exactly two lines to the existing `ts-invariants` step list (`bun run scripts/checks/error-table-sync.ts`, `bun run scripts/checks/exit-code-literals.ts`); assert via `tests/checks/ci-checks.test.ts` — TC-SYNC-006: invoked by name from `ts-invariants`; `TS_JOBS` unchanged; no new job id; `ci-topology` wiring rule green and `ci.yml` additions-only vs `origin/main-tools`; `ci-bindingness` reports no bypass construct; the aggregate five-step chain unchanged and the new checks NOT inserted into it; a drift mutation yields non-zero exit (the failure CI would surface). Also asserts the TC-EXIT-002 step-7 CI-name invocation.
- [ ] **6.4** Regression consolidation — TC-BOUNDARY-005: `pnpm check` green; `bash scripts/.tests/test-*.sh` and `bash tools/.tests/test-*.sh` green; `git diff --name-only origin/main-tools...HEAD` shows no modification to existing bash scripts, tools, agent/command definitions, or `.ados-claude/**` (the diff for `scripts` intentionally contains only the two new checks); `ci-supply-chain`/`license-audit`/`vulnerability-gate` green; no added package in `pnpm-lock.yaml`; inventory lists every new source file with per-file named allowances (mutation: an undeclared executable export fails naming the file); no `.skip`/`.todo`/`.only`/`--filter`/`--passWithNoTests` in new test files and zero skipped tests; no existing test deleted or weakened (any intentional update recorded in the plan revision log). Run TC-BOUNDARY-003 evidence: forbidden-literal scan exit 0, five scope classes, registry untouched.
- [ ] **6.5** Complete the TC-EXIT-003 boundary-rule half: mcp/opencode/adapters import probes fail under `surface-projection-cli-only`; assert the exit-projection structure facts hold repository-wide.

**Acceptance Criteria**:

- Must: AC-F9-1 in full; NFR-10; TC-SYNC-006 green; `TS_JOBS` and bash job ids byte-unchanged.
- Should: failure messages from the new rules name the offending path/import precisely.

**Affected code areas**:

- `.dependency-cruiser.cjs` (updated — three new rules + possible single D12 allowance)
- `tests/boundaries/fixtures/cases.ts`, `tests/boundaries/fixture-registry.json` (updated)
- `tests/checks/ci-checks.test.ts` (updated)
- `.github/workflows/ci.yml` (updated — two added lines inside the existing `ts-invariants` step; additions-only)

**System docs to update**:

- none (scaffold/branding feature docs unchanged — no package-surface change beyond files already inventoried; verify at execution and record any needed touch in the revision log)

**Tests**:

- `bun test tests/boundaries` → green incl. fixture-coverage meta-check
- `bun run scripts/checks/ci-topology.ts`; `bun run scripts/checks/ci-bindingness.ts`; `bun run scripts/checks/forbidden-literals.ts`; `bun run scripts/checks/ambient-globals.ts` → exit 0
- `pnpm check` → exit 0; `bash scripts/.tests/test-*.sh`; `bash tools/.tests/test-*.sh` → green
- `git diff --name-only origin/main-tools...HEAD -- scripts tools .opencode .ados-claude` → only the two new `scripts/checks/*.ts` files under `scripts`

**Completion signal**: `feat(GH-172): enforce result contract boundaries and wire checks into CI fast loop`

---

### Phase 7: Finalize, evidence, and release reconciliation

**Goal**: close-out — the full evidence pack recorded, the version-bump decision applied per repo conventions (D9: none pre-freeze), spec-reconciliation inputs prepared for `@doc-syncer` (lifecycle phase 7), and the manual-review hand-off (TC-REVIEW-001) staged. No source-code tasks; if review phases later request fixes, they flow through `@reviewer` → `@coder` remediation, not this plan.

**Tasks**:

- [ ] **7.1** Run and record the complete evidence command list (see Phase Gate Consolidation below) in the change folder/PR description: all suites, both invariants, boundary/ambient/forbidden-literal scans, topology/bindingness/supply-chain, aggregate, bash suites, tree-cleanliness.
- [ ] **7.2** Version bump per repo conventions: **no changeset, no bump** (D9 — packages private at 0.0.0, `privatePackages.version: false`; lockstep fixed group owns versioning from the naming-freeze change). Record `version_impact: minor` in the change record.
- [ ] **7.3** Spec reconciliation inputs for `@doc-syncer`: the documented table section at `doc/spec/features/feature-result-contract.md` is already sync-checked and must NOT be rewritten (RSK-T6); reconciliation completes the surrounding feature doc (envelope field contract per Appendix A, classification chain, projection confinement, `runCli` guarantees, redaction guarantee and its documented GAP-3 limitation — redaction covers edge-registered values only, `consequence` semantics, evolution discipline DEC-9); check whether `feature-monorepo-scaffold-toolchain.md` needs a surface note (only if package surfaces changed beyond new files — expected: no).
- [ ] **7.4** Stage the TC-REVIEW-001 manual-review checklist (hint phrasing action-first and non-identifying; DEC-13 fallback values; no unjustified `unknown`; no `schemaVersion` change; no auto-golden-update path; dynamic-access stream-write review; no gate weakened; no product name in any artifact) into the PR description for the human reviewer.
- [ ] **7.5** Update this plan's Execution Log and the change-folder artifacts to reflect phase completions; confirm `git status --porcelain` clean.

**Acceptance Criteria**:

- Must: all 38 TCs executed with recorded results (37 automated green; TC-REVIEW-001 staged for PR review); every phase's completion signal present in git history (one commit per phase); `pnpm check` green at HEAD.
- Should: evidence includes suite durations (RSK-T11 soft target: added suites well under a minute on `ubuntu-latest`).

**Affected code areas**:

- none (artifact-only: change-folder docs, PR description)

**System docs to update**:

- none by this phase (lifecycle phase 7 performs the reconciliation using task 7.3's inputs)

**Tests**:

- `pnpm check` → exit 0; full evidence list below → all green; `git status --porcelain` → clean

**Completion signal**: `docs(GH-172): finalize result contract evidence, gates, and release reconciliation`

---

### Phase Gate Consolidation — quality_gates run list

The lifecycle `quality_gates` phase (`@runner`, with `@fixer` on failure) runs exactly this list; every entry must be green at HEAD:

```
bun test                                                    # all layers incl. tests/golden (root discovery)
pnpm lint && pnpm format:check && pnpm typecheck            # Biome + strict TS solution
pnpm run check:boundaries                                   # depcruise + ambient-globals + workspace-entrypoints
bun run scripts/checks/ambient-globals.ts
bun run scripts/checks/forbidden-literals.ts
bun run scripts/checks/error-table-sync.ts                  # new (GH-172)
bun run scripts/checks/exit-code-literals.ts                # new (GH-172)
bun run scripts/checks/ci-topology.ts
bun run scripts/checks/ci-bindingness.ts
bun run scripts/checks/ci-supply-chain.ts
bun run scripts/checks/license-audit.ts
bun run scripts/checks/vulnerability-gate.ts
pnpm check                                                  # the unchanged five-step aggregate
bash scripts/.tests/test-*.sh
bash tools/.tests/test-*.sh
git status --porcelain                                      # clean — mutation suites never wrote the tree
git diff --name-only origin/main-tools...HEAD -- scripts tools .opencode .ados-claude
```

## Test Scenarios

All 38 TCs map to phases and acceptance criteria (test-plan §3.1 is the authority; phases below are where each TC is implemented and first green):

| TC ID | Scenario (abbreviated) | Phase | ACs |
|-------|------------------------|-------|-----|
| TC-RESULT-001 | Envelope field contract, data/error exclusivity, void success | 1 | AC-F1-1 |
| TC-RESULT-002 | Success envelope golden under `--json` | 3 | AC-F1-3, AC-F1-1 |
| TC-RESULT-003 | Classified-failure golden with timing, pure table projection | 3 | AC-F1-2, AC-F3-1, AC-F6-2 |
| TC-RESULT-004 | Timing present/measured on all four paths | 3 | AC-F1-2 |
| TC-RESULT-005 | `schemaVersion` fixed/brand-neutral; `runId` opaque, edge-generated | 1 | AC-F1-1, AC-F2-1 |
| TC-RESULT-006 | Conformance validator rule-complete, not vacuous | 1 (+3 golden sweep) | NFR-2, NFR-3 |
| TC-TABLE-001 | Full row shape, enums, exactly one projection class, non-vacuous | 2 | AC-F2-2 |
| TC-TABLE-002 | Fallback entries: DEC-13 fields, `unknown` reserved/allowlisted | 2 | AC-F3-2 |
| TC-TABLE-003 | Code identity: format, uniqueness, single resolution, corpus | 2 | AC-F3-1 |
| TC-TABLE-004 | Table declared once, runtime-neutral; `Result` unchanged | 2 | AC-F2-1 |
| TC-CLASSIFY-001 | Classification chain total, deterministic, round-trip | 2 | AC-F3-1 |
| TC-CLASSIFY-002 | Unclassifiable/non-`Error` → `fallback.internal`; broken → `fallback.invocation` | 2 | AC-F3-2, AC-F6-2 |
| TC-EXIT-001 | Projection exhaustive, total, confined to {0,1,2} | 2 | AC-F4-1 |
| TC-EXIT-002 | No exit-code literal at any call site (check + mutations) | 5 (+6 CI assert) | AC-F4-1 |
| TC-EXIT-003 | Projection exists only in the standalone CLI | 2 (structure) + 6 (rule) | AC-F4-1 |
| TC-RUNCLI-001 | In-process, returns exit code, spawns nothing (guard + self-test) | 3 | AC-F5-1, AC-F5-2 |
| TC-RUNCLI-002 | Determinism under identical argv/streams/clock/id; throwing stubs | 3 | AC-F5-2 |
| TC-RUNCLI-003 | Channel split: envelope on stdout, diagnostics on stderr | 3 | AC-F6-2, AC-F5-1 |
| TC-RUNCLI-004 | Brand strings as `BrandIdentity` parameters at the edge | 4 | AC-F9-1 |
| TC-CONTAIN-001 | Broken-invocation goldens: valid envelope, `fallback.invocation`, exit 1 | 3 | AC-F6-1 |
| TC-CONTAIN-002 | No stack traces/raw diagnostics on the machine channel | 3 | AC-F6-2 |
| TC-CONTAIN-003 | Hostile command bodies cannot escape containment | 3 | AC-F6-1, AC-F6-2 |
| TC-REDACT-001 | Planted secret in success payload never reaches a stream | 4 | AC-F7-1 |
| TC-REDACT-002 | Planted secret in failure error object never reaches a stream | 4 | AC-F7-1 |
| TC-REDACT-003 | No-partial-leak sweep across forms, nesting, encodings | 4 | AC-F7-1 |
| TC-REDACT-004 | Single serialization chokepoint; no other stream write path | 4 (+6 rule) | AC-F7-2 |
| TC-SYNC-001 | Delivered state bidirectionally consistent, non-vacuous | 5 | AC-F8-1 |
| TC-SYNC-002 | Drift A: emitted/referenced code without an entry fails | 5 | AC-F8-1 |
| TC-SYNC-003 | Drift B: documented entry missing from source fails; fail-closed doc | 5 | AC-F8-1 |
| TC-SYNC-004 | Drift C: source entry missing from documented table fails | 5 | AC-F8-1 |
| TC-SYNC-005 | Identity hygiene: duplicates, malformed codes, true/false corpora | 5 | AC-F8-1 |
| TC-SYNC-006 | Sync check binds in the existing CI fast loop | 6 | AC-F8-1, NFR-10 |
| TC-BOUNDARY-001 | Contracts tier runtime-neutral for the new files | 2 | AC-F2-1, AC-F9-1 |
| TC-BOUNDARY-002 | Tier matrix green; new rules have failing fixtures + controls | 6 | AC-F9-1, AC-F7-2 |
| TC-BOUNDARY-003 | Forbidden-literal scan green; registry untouched | 6 | AC-F9-1 |
| TC-BOUNDARY-004 | Fixture hygiene: brand-neutral, fakes only, no tokens | 4 | NFR-9, NFR-5 |
| TC-BOUNDARY-005 | No regression, no gate weakening, inventory deliberate | 6 (+7 evidence) | AC-F9-1 |
| TC-REVIEW-001 | Manual contract review (hint quality, evolution, gate integrity) | 7 (staged) → PR | AC-F7-2, AC-F9-1 |

Ticket-AC rollup (spec §17): T-AC1 (unit + golden tests) → Phases 1–4; T-AC2 (broken command under `--json` emits a valid envelope) → Phase 3; T-AC3 (secrets never in output) → Phase 4; T-AC4 (codes resolve to documented entries) → Phase 5 (+6 CI binding).

## Artifacts and Links

| Artifact | Location | Type |
|----------|----------|------|
| Change specification (v1.1) | ./chg-GH-172-spec.md | Spec |
| Test plan (v1.1, 38 TCs) | ./chg-GH-172-test-plan.md | Test plan |
| PM notes | ./chg-GH-172-pm-notes.yaml | Notes |
| Companion survey | ./survey-agent-facing-error-design.md | Research (companion, not distributable) |
| Envelope contract | `packages/core/src/contracts/result.ts` | Code (new) |
| Error table single source | `packages/core/src/contracts/error-table.ts` | Code (new) |
| Classification chain | `packages/cli/src/classify.ts` | Code (new) |
| Exit projection (only permitted digit home) | `packages/cli/src/projection.ts` | Code (new) |
| Serializer + redaction chokepoint | `packages/cli/src/output/serialize.ts` | Code (new) |
| Designated runtime-aware edge | `packages/cli/src/edge.ts` | Code (new) |
| `runCli` surface | `packages/cli/src/index.ts` | Code (updated) |
| Conformance validator + golden loader | `packages/testkit/src/result-conformance.ts` | Code (new) |
| Unit/structure/behaviour suites | `tests/structure/**`, `tests/behaviour/**` | Tests (new/updated) |
| Golden suites + fixtures | `tests/golden/**`, `tests/fixtures/result/**` | Tests (new) |
| Invariant checks | `scripts/checks/error-table-sync.ts`, `scripts/checks/exit-code-literals.ts` | Checks (new) |
| Check mutation suites + corpora | `tests/checks/**`, `tests/fixtures/result/code-corpora/**` | Tests (new/updated) |
| Boundary rules + fixtures | `.dependency-cruiser.cjs`, `tests/boundaries/**` | Config/tests (updated) |
| CI wiring (two lines, `ts-invariants`) | `.github/workflows/ci.yml` | CI (updated, additions-only) |
| Inventory + allowances | `tests/structure/inventory.json`, `tests/structure/content-inventory.test.ts` | Tests (updated) |
| Documented error table (in-change, sync-checked) | `doc/spec/features/feature-result-contract.md` | System doc (new; no marker per D11) |
| ADR-0003 (constraints C-4..C-8) | ../../../decisions/ADR-0003-oss-monorepo-structure.md | Decision record |
| Man-page v0 (planning truth) | ../../../planning/oss-tooling/cli-command-registry.md | Planning doc (unchanged) |
| Testing strategy | ../../../../.ai/rules/testing-strategy.md | Rule (unchanged) |

## Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-10-30 | @plan-writer | Initial plan: 7 phases (envelope contracts → error table/classification/projection → runCli+containment+goldens → redaction+edge seam → documented table+invariant checks → boundaries+CI+regression → finalize/evidence). OQ-T3 resolved as D1 (fixed `[redacted]` placeholder, value/key/substring replacement); OQ-T4 resolved as D2 (three depcruise rules with fixtures + one AST structure test with temp-copy mutations). D3–D12 bind modules, seed table, timing/runId/void-payload shapes, doc-table format, changeset/install.sh/marker/runtime-allowance decisions (all verified against the repo). All 38 TCs mapped to phases and ACs; per-phase single-commit discipline with ≤100-char lines; full quality-gates run list consolidated. |

## Execution Log

| Phase | Status | Started | Completed | Commit | Notes |
|-------|--------|---------|-----------|--------|-------|
| 1 | Pending | — | — | — | Envelope contracts + conformance validator |
| 2 | Pending | — | — | — | Error table + classification + projection |
| 3 | Pending | — | — | — | runCli + serialization + containment + goldens |
| 4 | Pending | — | — | — | Redaction proofs + brand/edge seam |
| 5 | Pending | — | — | — | Documented table + sync/exit-literal checks |
| 6 | Pending | — | — | — | Boundary rules + CI wiring + regression |
| 7 | Pending | — | — | — | Finalize + evidence + reconciliation inputs |
