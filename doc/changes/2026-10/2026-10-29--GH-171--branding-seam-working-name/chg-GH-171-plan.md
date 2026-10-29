---
id: chg-GH-171-branding-seam-working-name
status: Updated
created: 2026-10-29T23:05:00Z
last_updated: 2026-10-29T23:59:00Z
owners: ["Juliusz Ćwiąkalski"]
service: delivery-os
labels: ["oss-tooling", "branding", "m0", "adr-0003"]
links:
  change_spec: ./chg-GH-171-spec.md
  test_plan: ./chg-GH-171-test-plan.md
  adr: ../../../decisions/ADR-0003-oss-monorepo-structure.md
  pm_notes: ./chg-GH-171-pm-notes.yaml
summary: >
  Deliver the M0-S2 branding seam per ADR-0003 C-3/DEC-8: a pure resolver in core ./branding
  deriving the full twelve-value DEC-8 set from one config-driven working name plus injected
  environment facts; BrandIdentity completed in core ./contracts; a CI-binding forbidden-literal
  scan over the full DEC-8 scope with the exact DEC-8 allowlist and a corpus-baseline-anchored
  docs scope (permanent registered membership); a legacy compatibility adapter
  in adapters ./legacy with a one-time per-process warning; the brand-neutral telemetry schema
  name delivery.event.v1 reserved; and the rename drill documented as a name-free procedure —
  with no public product name selected, proposed, or revealed anywhere.
version_impact: minor
---

# IMPLEMENTATION PLAN — GH-171: M0-S2: Branding seam and working name

## Context and Goals

This plan executes [chg-GH-171-spec.md](./chg-GH-171-spec.md) (v1.0) and is verified by [chg-GH-171-test-plan.md](./chg-GH-171-test-plan.md) (v1.1, 27 TCs). All product-shape decisions are resolved in the spec (DEC-1..DEC-7); none are re-opened here. The plan binds file paths, symbol names, derivation rules, scan matching semantics, check/registry layout, and task order — behavior targets come from the test plan and must not change (A-T1). Baseline: `main-tools` @ 32784af (GH-170 merged, PR #191).

**Goals**: G-1 one pure resolver producing all 12 DEC-8 values from config-driven data · G-2 neutral override swap with zero ambient reads in branding · G-3 full-scope, mutation-proven, CI-binding forbidden-literal scan · G-4 legacy compatibility with exactly-once warning · G-5 brand-neutral telemetry naming + documented rename drill · G-6 zero name reveals in any artifact.

**Binding owner constraint (every authoring step)**: NO hardcoded product token anywhere; no public product name, candidate name, or branded scope/URL may be selected, proposed, or revealed in ANY artifact of this change (code, comments, tests, fixtures, docs, commit messages, this plan). Synthetic names only (`.renamed-product`, `.alt-brand`, `.synthetic`, `example-product` from `tests/fixtures/branding/names.json`); the tokens `ados`, `ADOS_`, `~/.ados` appear ONLY in their DEC-8 framing (legacy adapter mapping, scan seed, scan-negative fixtures, quoted contract text). Every phase below repeats this rule where content is authored.

**Plan-stage decisions (D1..D9, binding for delivery)** — each is a technical/reversible decision delegated to delivery planning by spec §14 and test-plan OQ-T1..T4:

- **D1 — Scan matching semantics (OQ-T1, RSK-2/RSK-T1)**: test plan §4.1 verbatim — case-insensitive token match; a seed token matches when delimited from lowercase ASCII letters on BOTH sides. Delimiters: start/end of file, whitespace, punctuation, digit, slash, dot, underscore, hyphen, `~`, `@`, or an uppercase letter. Thus `ados`, `ADOS`, `Ados`, `ADOS_`, `~/.ados`, `ados-cli`, `ados_cli`, `x/ados/y`, `.ados`, `adosRuntime`, `my-ados`, `2ados`, `@ados/pkg` match; `avocados`, `mikados`, `paradosis`, `colorados`, `shadow`, `agentic-delivery-os` do not. The reported token is the seed-set literal. Reserved limitation: a fully lowercase embedded identifier (`myados`) is NOT matched — recorded residual risk (spec RSK-2 Low–Medium; test-plan §8.1 RSK-T1). The GH-170 seed set (`ados`, `ADOS_`, `~/.ados`) is preserved unchanged; matching is exported as a pure function so the committed corpora (TC-BRANDING-010) exercise it directly.
- **D2 — Hygiene subsumption (C-8, TC-BRANDING-013)**: the `.gitignore`-local token-scan block (section 2 `productTokens` loop) is REMOVED from `scripts/checks/ignore-rules.ts`; its four coverage classes, brand-free-glob assertion, rename simulation, and `git check-ignore` probes remain byte-intact. The full-scope scan's `.gitignore` class (whole file, every line) takes over token enforcement. Coverage delta is exactly the D1 reserved case (a lowercase embedding such as `myados` in a `.gitignore` line was catchable by the old substring scan, not by the delimiter rule) — accepted and recorded under RSK-2; the reverse delta is larger (the old scan only covered non-comment `.gitignore` lines and would false-positive on ordinary words). One registry (DM-3) owns tokens from now on; no second list grows at the freeze. New `tests/checks/ignore-rules.test.ts` proves the surviving assertions are load-bearing.
- **D3 — Changeset / version bump**: **no changeset file** (GH-170 precedent). All packages are `private: true` at `0.0.0`; `.changeset/config.json` sets `privatePackages: {version: false, tag: false}` — a changeset cannot version anything pre-freeze. Version impact **minor** is recorded in spec + this plan; the changesets fixed group owns versioning from the naming-freeze change (M4-S1). Nothing publishes, so there is no version number to bump.
- **D4 — Check/registry layout and wiring (revised v1.1 per DoR iter-1 finding 1)**: `scripts/checks/forbidden-literals.ts` (the check) + `scripts/checks/forbidden-literals.registry.json` (the single source: five scope classes with explicit file lists for classes 2–3, the seed set, the five DEC-8 allowlist entries, the fixed `corpusBaseline`, and the `registered` docs list). The registry records `corpusBaseline: "32784affbb8a1b82a57b6c4578a331b8bd99b4c4"` — the full 40-char commit SHA of `32784af` (the last pre-scan commit on `main-tools`, GH-170 merge); the full SHA is the canonical representation in registry and code (the short form is prose/display-only), and a branch, tag, or `HEAD`-relative expression is rejected by the registry-shape assertion. Class-5 membership is **permanent**: a doc registers once (reviewed) because it is absent at `corpusBaseline`, and it stays scanned on the merge commit and every successor commit — membership is never re-derived from a moveable comparison ref. The docs-scope meta-check asserts (user-facing docs absent at `corpusBaseline` ⊆ `registered`) ∧ (`registered` ⊆ docs present in the tree ∧ absent at `corpusBaseline`), and fails closed with a named error when the baseline is absent, non-SHA, or unreachable — a shallow clone fails BY DESIGN and never silently skips the docs class (RSK-T3). `corpusBaseline` advances ONLY in the future corpus-migration change (which migrates the interim registered docs into the pre-existing corpus and removes their entries in the same reviewed change); ordinary PRs never touch it (OQ-T5; TC-BRANDING-027 step 7 makes an accidental advance fail naming the swallowed doc). Registry is JSON (no new dependency — TC-BRANDING-025). Local wiring: root script `check:forbidden-literals` (extra scripts are permitted by `script-surface.ts`; the aggregate `check` chain stays exactly five steps). CI wiring: one additive `ts-forbidden-literals` job — NOT added to `ts-invariants` and NOT inserted into the aggregate chain. `TS_JOBS` in `scripts/checks/ci-topology.ts` gains the id; `ci-bindingness.ts` covers every `ts-*` job automatically. The job checks out with `fetch-depth: 0` AND runs an explicit baseline-fetch step (`git fetch --no-tags origin 32784affbb8a1b82a57b6c4578a331b8bd99b4c4`) so the fail-closed baseline check is always satisfiable in CI (RSK-T3, A-T5). *(Supersedes the v1.0 wording, which anchored class-5 membership to the moveable PR base via `--base origin/main-tools` with an added-vs-base bijection/orphan rule — self-breaking on `main-tools` immediately after merge and silently dropping merged docs from scan coverage; see test plan v1.1 §4.1/A-T2/RSK-T12/TC-BRANDING-027 and `readiness-review/readiness-iter-1.md` finding 1.)*
- **D5 — Derivation rules (A-T6/RSK-T6)**: fixed in Phase 2 (task 2.2 table), documented as the resolver module's doc-block (code-adjacent documentation) with an independent expectation table in `tests/fixtures/branding/derivation-cases.json`. Every rule is purely mechanical from the working name; the only non-name inputs are the two documented neutral-until-freeze constants (`@delivery-os` scope, `delivery` telemetry namespace) and the neutral scope org used by URL derivations, which flip mechanically at the freeze. No product token appears in any rule or output.
- **D6 — Drill-doc distribution class (OQ-T3 path + marker)**: the drill lives at `doc/guides/rename-drill.md` with `ados_distribution: internal`. Rationale: it is an ADOS-maintainer operational procedure (executed pre-release / on branding change of the product itself) — adopting projects never rename ADOS; precedent: `doc/guides/{tools-convention,adding-tool-support,ados-tools-system-dependencies}.md` are `internal`; `install.sh` marker-filters guides so `bash scripts/.tests/test-doc-distribution.sh` passes. DoR iter-1 minor finding 2 is resolved in test plan v1.1: TC-BRANDING-020 step 2 now asserts the plan-bound marker value (`internal`, a valid enum) plus a green `test-doc-distribution.sh`; an owner-approved one-word flip to `redistributable` at PR review still passes (valid enum; the install set is marker-derived).
- **D7 — Resolver contract shape**: `resolveBrandIdentity(input: ResolverInput): Result<BrandIdentity, BrandingInputError>` using the existing `core ./contracts` `Result` envelope (throw only for invariants). `ResolverInput = { readonly workingName: string; readonly override?: string }` — both fields are data; the resolver applies precedence internally (non-empty `override` wins over `workingName`; `override` present but empty/whitespace-only is a resolver-input error — TC-BRANDING-003 step 3). The neutral variable name `DELIVERY_OS_WORKING_NAME` is owned by the runtime-aware edge (fixture `tests/fixtures/branding/edge.ts` now; M0-S4 later), which maps `facts[DELIVERY_OS_WORKING_NAME]` → `input.override` and enforces record-shape hygiene (non-record facts and inherited properties are rejected/ignored via own-property reads at the edge) — branding source never mentions the variable (TC-BRANDING-007 step 4). No default parameter values anywhere on the resolver signature; output is `Object.freeze`d (a language builtin, not a banned ambient).
- **D8 — No new boundary rules (A-T9)**: the existing rules are the enforcers — `subpath-adapters-core-branding` (legacy adapter may not import branding), `tier-branding-only-contracts` (branding imports `./contracts` only), `ambient-env-branding` + `ambient-globals-neutral-tiers` (zero ambient reads/globals in branding). This change adds NO new depcruise rule, therefore no new negative fixtures or fixture-coverage registrations are required; TC-BRANDING-023 verifies the existing rules remain registered and firing. Verified against `tests/boundaries/fixtures/cases.ts`: fixtures probe synthetic `packages/core/src/branding/probe.ts` paths materialized in `mkdtemp` temp workspaces (the harness copies only the production `.dependency-cruiser.cjs`), so adding real branding source files does not affect the ambient guard or fixture harness.
- **D9 — Legacy adapter shape (A-T7)**: zero workspace imports (current names arrive as parameters; no `@delivery-os/*` import at all). `createLegacyCompat(options)` factory returning an isolated instance (own once-warning state) for unit tests; a default process-scoped instance (module-level once-guard) for production. The mapping entry point accepts an injected environment-facts record, current names `{ environmentPrefix, configDirectoryName }`, and an injected `warn` sink; a thin I/O wrapper (runtime APIs ARE allowed in `packages/adapters/src/legacy/` per the `runtime-apis-confinement` allowlist) supplies the real process environment and `console.warn` in production — testability favors injection (user-delegation note). Warning text names the legacy source and the mapped current name only — never values from the environment record (NFR-5/TC-BRANDING-015). Adapter literals are confined to the reviewed inventory (`tests/fixtures/legacy/literal-inventory.json`): the legacy prefix `ADOS_`, the legacy home config-dir segment `.ados`, separators, and name-free diagnostic strings.

**Open questions carried in**: none blocking. OQ-T1 (matching) resolved by D1; OQ-T2 (docs scope) resolved by test plan v1.1 A-T2 — baseline-anchored to the fixed `corpusBaseline` with permanent `registered` membership, adopted by D4; OQ-T5 (may the baseline advance) resolved by D4 — fixed; only the future corpus-migration change may advance it, in the same reviewed change that migrates the interim registered docs; OQ-T3 (drill path + marker) resolved by D6; OQ-T4 (schema-name reservation form) resolved as type-level literal types in `core ./contracts` (Phase 1) — no runtime constant, no content-inventory exception needed. Manual gates that stay with the owner: TC-BRANDING-026 name-freedom review at PR time; TC-BRANDING-020 step-9 clarity review.

**Risk handling (RSK-1/2/5 owned here; full spec §11 table honored by design)**:

- **RSK-1** ("config-driven" misread as needing M0-S4 first): Phase 2 delivers the seam contract as `ResolverInput` (DM-2) — working name + override as injected data at a fixture edge; no config-layer dependency exists or is implied. M0-S4 consumes the contract without reshaping (documented in the module doc-block).
- **RSK-2** (substring false positives / allowlist growth): D1 pins delimiter semantics with committed true/false-positive corpora and a vacuity probe (TC-BRANDING-010); the allowlist is exactly five registry entries with shape mutations failing (TC-BRANDING-011); D2 records the one coverage delta as accepted residual risk.
- **RSK-5** (scan accidentally advisory or topology-breaking): Phase 6 — `ts-forbidden-literals` is a binding job with `fetch-depth: 0` + explicit baseline fetch of the registry-recorded `corpusBaseline` commit; `continue-on-error`/job-removal/baseline-fetch-removal mutations fail `ci-bindingness`/`ci-topology`/the job assertion by name (TC-BRANDING-012, TC-BRANDING-027 CI half); the aggregate chain stays exactly five steps; bash job blocks stay byte-untouched (additions-only diff, verified by `ci-topology`).

## Scope

### In Scope

- F-1 pure resolver, full 12-value DEC-8 set, documented deterministic derivation rules, fail-closed input contract (Phase 2).
- F-2 `BrandIdentity` completed in `core ./contracts`; branding imports `./contracts` type-only (Phase 1).
- F-3 neutral override via injected facts at a fixture runtime-aware edge; zero ambient reads in branding (Phase 2).
- F-4 forbidden-literal scan at full DEC-8 scope with the docs class anchored to the fixed registry `corpusBaseline` (permanent `registered` membership), exact allowlist, seed registry, mutation evidence, hygiene subsumption, binding CI job (Phases 3 and 6).
- F-5 legacy adapter: mapping to parameter-supplied current names, exactly-once warning, secret-safe warning, no branding import, no new pre-freeze variables, confined literal inventory (Phase 4).
- F-6 brand-neutral telemetry schema reservation + producer-as-metadata rule (Phase 1).
- F-7 rename drill documented, self-contained, name-free, with execution obligation (Phase 5).
- F-8 boundary conformance + content-inventory deliberate extension + fixture-coverage meta-check re-verification (Phases 2, 4, 6; D8).
- All 27 TCs of the test plan in its runner split: `bun test` (structure/behaviour/checks-mutations), `bun run scripts/checks/*.ts` (invariants), existing bash suites run-only.
- Post-delivery spec-reconciliation inputs for `@doc-syncer` (Phase 7; first branding feature spec).

### Out of Scope

- Spec §7.2 in full: config layer (M0-S4), state drivers (M0-S5), result/error contract content (M0-S3), telemetry/MCP/CLI implementation, corpus migration, drill execution, naming freeze, publication, cloud, any change to `scripts/*.sh`, `tools/**`, `.opencode/**`, `.ados-claude/**`, or existing bash CI jobs (C-4/C-5/C-6/C-8). PR creation is a later lifecycle phase — no task here creates the PR.

### Constraints

- **No product token** (G-6/NFR-9): the binding owner constraint in Context and Goals governs every artifact; synthetic names only; the scan's delivered state must be green with zero literals outside the two allowlisted package subpaths.
- **Gates are binding**: no `continue-on-error`, `|| true`, `set +e`, `if: always()`, or `exit 0` wraps anywhere; failure output names rule, file, and token.
- **Aggregate untouched**: the GH-170 `check` chain stays exactly five steps; the scan joins as a named CI job + root script only (A-T8).
- **Additive CI**: `ci.yml` additions only — the seven bash job blocks and the fifteen existing `ts-*` jobs are byte-untouched; `ci-topology` diff-vs-base enforces additions-only.
- **Strict TS + Biome**: `tsconfig.base.json` flag set, ESM, Biome 2-space/100-col format; `bun:test` for tests; no new dependencies (TC-BRANDING-025; the license-registry fail-closed gate applies if violated).
- **No license headers on `doc/changes/**`** (repo rule); the NEW guide gets its header ONLY via `scripts/add-header-location.sh doc/guides` (agents never hand-add headers).
- **Workspace green per commit**: every phase commit leaves `pnpm check` green (feasible for all seven phases; verified per-phase test commands below).

### Risks

- **RSK-1**: closed by the D7 seam contract (Phase 2); no config-layer dependency.
- **RSK-2**: closed by D1 + D2 (corpora, registry shape mutations, recorded residual case).
- **RSK-5**: closed by Phase 6 (topology/bindingness mutations, fetch-depth 0 + explicit baseline fetch).
- RSK-3 (adapter becomes second seam): D9 confinement + TC-BRANDING-016/017/018 (no branding import, no new `ADOS_` variables, reviewed literal inventory) + the scan allowlist covering only the legacy subpath.
- RSK-4 (name leak): TC-BRANDING-008 scan + TC-BRANDING-026 manual owner gate at PR review.
- RSK-6 (drill drift): TC-BRANDING-020 anchors `RD-1..RD-11` battery rows + execution-obligation sentence; the drill is itself a scanned registered doc (permanent class-5 membership — TC-BRANDING-027).
- RSK-T1..T12 (test plan): mitigated by the committed corpora (T1), temp-tree-only mutations (all mutation TCs), child-process warning probes (T5), the independent derivation table (T6), the fixed `corpusBaseline` + permanent registry membership proven by the TC-BRANDING-027 lifecycle mutations (T12), and CI-as-authority for e2e observations (T2/T3).

### Success Metrics

Spec §4.1 table, verified by: 12/12 DEC-8 values from the resolver (TC-BRANDING-001/004); 0 name-derived values outside the resolver, 0 committed working-name literals (TC-BRANDING-021 + TC-BRANDING-008); 5/5 scan scope classes every PR, with registered docs still scanned on post-merge successor commits (TC-BRANDING-008/009/027); 0 escaping mutations (TC-BRANDING-009/010/011); 0 ambient reads in branding (TC-BRANDING-006); exactly 1 warning per process (TC-BRANDING-014); 0 new pre-freeze variables (TC-BRANDING-017); 0 boundary violations (TC-BRANDING-023); 0 regressions in existing gates (TC-BRANDING-024/025); 0 name reveals (TC-BRANDING-008/019/020 + TC-BRANDING-026 manual).

## Phases

> **Delivery model**: `@coder` executes each phase, then triggers `@committer` with the completion signal. One Conventional Commit per phase (scope `GH-171`; types below). Every phase re-runs `pnpm check` before committing; mutations in tests materialize temp trees only (`mkdtemp`), never the live workspace.

### Phase 1: Brand contract and telemetry reservation

**Goal**: F-2/F-6 — `BrandIdentity` defined once in `core ./contracts` with the full twelve-value DEC-8 set; the brand-neutral telemetry schema names reserved as type-level contract artifacts with the producer-as-metadata rule; the branding stub becomes a type-only consumer of `./contracts`.

**Tasks**:

> **No product token**: the type fields, the schema-name literals (`delivery.event.v1`, `delivery.metric.v1`), and every comment below are brand-free; `delivery` is the fixed neutral namespace, not a product name.

- [x] **1.1** Move and complete `BrandIdentity` into `packages/core/src/contracts/index.ts`: exactly the twelve readonly string properties from DM-1 — `productName`, `binaryName`, `packageScope`, `environmentPrefix`, `configDirectoryName`, `stateDirectoryName`, `mcpToolPrefix`, `telemetryNamespace`, `docsBaseUrl`, `repositoryUrl`, `releaseAssetPrefix`, `installPath` — no missing, no extra field; doc comment states "defined once in `./contracts`; consumed as parameters; never re-derived" (AC-F2-1, DM-1, TC-BRANDING-005).
- [x] **1.2** Reserve the telemetry schema names in `packages/core/src/contracts/index.ts` as type-level literal types: `TelemetryEventSchemaName = "delivery.event.v1"` and `TelemetryMetricSchemaName = "delivery.metric.v1"` (OQ-T4 resolved: type-level, no runtime constant, no content-inventory exception). The doc comment records EVT-1/EVT-2 and the producer-as-metadata rule verbatim: the schema name carries no producer identity; the producer name is branding metadata (`BrandIdentity.telemetryNamespace`), never part of a schema name; no emission path exists (AC-F6-1, EVT-1/EVT-2, TC-BRANDING-019).
- [x] **1.3** Replace the local stub in `packages/core/src/branding/index.ts`: delete the four-field local `BrandIdentity`; add `import type { BrandIdentity } from "#contracts";` and `export type { BrandIdentity };` — the subpath's ONLY workspace import, type-only. Keep the module doc comment (pure-resolver intent; no ambient read) (AC-F2-1, TC-BRANDING-005 step 4, TC-BRANDING-006 step 4).
- [x] **1.4** Author `tests/structure/branding-contract.test.ts` (TC-BRANDING-005 + TC-BRANDING-019): AST-assert exactly one `BrandIdentity` declaration repository-wide under `packages/**`, in `./contracts`, with exactly the twelve fields; branding imports it type-only and declares no local duplicate; temp-copy mutations (remove field / add extra / duplicate in branding) fail by name. Telemetry: assert the exact schema-name literals, no seed token / working-name value / interpolation in them, `telemetryNamespace` carried separately, the producer-metadata doc statement present, and no emission path (no telemetry SDK in any manifest, no emit/track/capture call, no new sink); mutations (brand-coupled schema name; fake emitter import) fail (AC-F2-1, AC-F6-1).

**Acceptance Criteria**:

- Must: AC-F2-1 (single twelve-field definition in `./contracts`; branding type-only import; tier matrix green), AC-F6-1.
- Should: zero `@ts-expect-error`; comments stay brand-free (TC-BRANDING-026 review).

**Affected code areas**:

- `packages/core/src/contracts/index.ts` (updated — `BrandIdentity` + schema-name literal types)
- `packages/core/src/branding/index.ts` (updated — local type removed, `#contracts` type-only import)
- `tests/structure/branding-contract.test.ts` (new)

**System docs to update**:

- none (spec reconciliation is Phase 7)

**Tests**:

- `pnpm typecheck` → exit 0 (strict; `verbatimModuleSyntax`-clean type-only import)
- `bun test tests/structure/branding-contract.test.ts` → green incl. mutations
- `bun test tests/boundaries`; `bun run scripts/checks/ambient-globals.ts` → green (types-only content keeps every existing rule green)
- `pnpm check` → exit 0

**Completion signal**: `feat(GH-171): move BrandIdentity to contracts with full DEC-8 set and neutral telemetry schema names`

---

### Phase 2: Pure resolver, derivation rules, and the injected override

**Goal**: F-1/F-3 (G-1/G-2) — the pure, total, fail-closed resolver derives all twelve DEC-8 values deterministically from one config-driven working name; the documented derivation rules (D5) are code-adjacent and independently fixture-tested; the neutral override swaps the full value set at the fixture edge with zero ambient reads in branding.

**Tasks**:

> **No product token**: every derivation below is mechanical from the input name plus the two documented neutral constants; synthetic names only in tests; the module contains NO default name, NO committed working-name literal, and does not mention `DELIVERY_OS_WORKING_NAME` (D7).

- [x] **2.1** Define the seam contract in `packages/core/src/branding/index.ts`: `ResolverInput = { readonly workingName: string; readonly override?: string }` and `BrandingInputError` (a small readonly discriminated error type local to branding) — documented as the DM-2 contract M0-S4 consumes without reshaping (RSK-1 closed; AC-F3-1, DM-2, TC-BRANDING-003/007).
- [x] **2.2** Implement `resolveBrandIdentity(input: ResolverInput): Result<BrandIdentity, BrandingInputError>` (D7) with the D5 derivation rules, each documented in the module doc-block table (the authoritative in-repo rule documentation):
  - `productName` = the supplied working name, as supplied (validated, not defaulted);
  - `binaryName` = **sanitize**(name): lowercase, every run of characters outside `[a-z0-9]` collapsed to one `-`, leading/trailing `-` stripped (`.renamed-product` → `renamed-product`);
  - `packageScope` = `@delivery-os` (fixed neutral constant until the freeze — Appendix A #3);
  - `environmentPrefix` = **snakeUpper**(name) + `_`: uppercase, non-`[A-Z0-9]` runs → `_`, edges stripped, trailing `_` appended (`example-product` → `EXAMPLE_PRODUCT_`; legacy correspondence `ADOS_` is read ONLY by the legacy adapter);
  - `configDirectoryName` = **dotDir**(name): the name if it already starts with `.`, else `.` + name (committed config path projection: `<repo>/.<name>/config.yaml` per DEC-4);
  - `stateDirectoryName` = **dotDir**(name) + `-state` (consumed by M0-S5);
  - `mcpToolPrefix` = **sanitize**(name) + `_` (tool names are this prefix + a canonical primitive ID from `./contracts` — projection only, primitive deferred to M0-S3);
  - `telemetryNamespace` = `delivery` (fixed brand-neutral constant — Appendix A #8; producer metadata, never part of schema names);
  - `docsBaseUrl` = `https://` + scopeOrg + `.github.io/` + **sanitize**(name) + `/`;
  - `repositoryUrl` = `https://github.com/` + scopeOrg + `/` + **sanitize**(name);
  - `releaseAssetPrefix` = **sanitize**(name) + `-`;
  - `installPath` = `~/` + **dotDir**(name) + `/bin/` + **sanitize**(name);
  - where scopeOrg = `packageScope` without `@` (=`delivery-os`, the same brand-free internal designation as the neutral workspace scope; the URL derivations flip mechanically when the scope flips at the freeze). Same input → same output; no ambient read, clock, randomness, or runtime API; output `Object.freeze`d; no default parameter values on the signature (AC-F1-1, NFR-1/NFR-2, TC-BRANDING-001/002/004).
- [x] **2.3** Implement fail-closed validation (TC-BRANDING-003): non-string, empty, whitespace-only, leading/trailing-whitespace, path-separator (`/`, `\`), control-character, or >64-character working name → `BrandingInputError` (deterministic, echo-free — errors never quote environment values); `override` present but empty/whitespace-only or non-string → `BrandingInputError`; a valid name with no override still succeeds (the error is about invalid input, not a required environment) (AC-F1-1, DM-2).
- [x] **2.4** Author fixtures: `tests/fixtures/branding/names.json` (synthetic-name registry: `.renamed-product`, `.alt-brand`, `.synthetic`, `example-product` — never a candidate name), `tests/fixtures/branding/derivation-cases.json` (the independent expectation table: every twelve-value row for every synthetic name, derived by hand from the task-2.2 documentation, not from an implementation run — RSK-T6), and `tests/fixtures/branding/edge.ts` (the runtime-aware-edge fixture: receives `(configuredName: string, facts: Record<string, string>)`, applies own-property hygiene on `facts`, maps `facts["DELIVERY_OS_WORKING_NAME"]` → `input.override`, calls the resolver; never reads `process.env`/`Bun.env` itself; imports the resolver by relative source path). Fixture files are never named `*.test.ts` (bunfig discovery rule) (AC-F3-1, DM-2, TC-BRANDING-007).
- [x] **2.5** Author `tests/behaviour/branding-resolver.test.ts` (TC-BRANDING-001..004, TC-BRANDING-007): completeness (twelve non-empty fields, two synthetic names), determinism (deep-equal repeat calls; distinct names → distinct sets; `Date.now`/`Math.random` stubbed to throw prove no ambient use), fail-closed matrix (task-2.3 cases; type-erasing cast for non-string; no default parameter on the signature corroborated), derivation-rule conformance (fixture table rows; committed config path projection `<repo>/.<name>/config.yaml`; MCP prefix documented; no output contains a seed literal), override swap (configured `example-product` + injected `DELIVERY_OS_WORKING_NAME=.renamed-product` fact → all twelve values reflect the override, none retain the configured name; `git status --porcelain` clean after fact-only change; override variable absent from branding source; precedence deterministic) (AC-F1-1, AC-F1-2, AC-F3-1).
- [x] **2.6** Author `tests/structure/branding-seam.test.ts` (TC-BRANDING-021): AST scan — no default value on the working-name parameter; no exported module-level string constant serving as a product name; no `BrandIdentity`-shaped object literal constructed under `packages/**` outside `packages/core/src/branding/**`; no DEC-8-field-named identifier/property assigned a string literal outside branding/contracts; no fixture-registry synthetic name committed in branding source; temp-copy mutations (stray `PRODUCT_NAME` constant in a surface package; twelve-field literal in `core/src/domain`) fail by name (AC-F1-2, NFR-2).
- [x] **2.7** Extend the content-inventory policy deliberately (TC-BRANDING-022 branding half): update `tests/structure/content-inventory.test.ts` from the global types-only rule to a **per-file executable allowlist** — `packages/core/src/branding/index.ts` gains "resolver" executable allowance; every other inventoried file stays types-only/`createRuntime`-only; the policy stays per-file (a global allow-all switch fails). `tests/structure/inventory.json` is unchanged (resolver lives in the already-inventoried `src/branding/index.ts`; no new package file). Temp-copy mutations (executable function in `core/src/domain/index.ts`; a second executable export in branding) fail with file + statement named; the no-engine/driver/command markers test remains untouched (AC-F8-1, NFR-7/NFR-8).

**Acceptance Criteria**:

- Must: AC-F1-1 (12/12 values, deterministic, fail-closed), AC-F1-2 (no outside derivation — automated half), AC-F3-1 (override without rebuild; zero ambient reads).
- Should: derivation doc-block doubles as the M0-S4 integration contract note; fixture table reviewed against the doc by a second reader (RSK-T6).

**Affected code areas**:

- `packages/core/src/branding/index.ts` (updated — resolver, input/error types, rule doc-block)
- `tests/fixtures/branding/{names.json,derivation-cases.json,edge.ts}` (new)
- `tests/behaviour/branding-resolver.test.ts`, `tests/structure/{branding-seam.test.ts}` (new)
- `tests/structure/content-inventory.test.ts` (updated — per-file executable policy)

**System docs to update**:

- none

**Tests**:

- `bun test tests/behaviour/branding-resolver.test.ts` → green
- `bun test tests/structure/{branding-seam,content-inventory}.test.ts` → green incl. mutations
- `bun run scripts/checks/ambient-globals.ts`; `bun test tests/boundaries` → green (branding stays ambient-free; `tier-branding-only-contracts` green)
- `pnpm check` → exit 0

**Completion signal**: `feat(GH-171): add pure branding resolver with documented derivation rules`

---

### Phase 3: Forbidden-literal scan, seed registry, and hygiene subsumption

**Goal**: F-4 local half (G-3) — the scan covers all five DEC-8 scope classes with the exact allowlist and D1 matching semantics, anchors the docs class to the fixed registry `corpusBaseline` with permanent `registered` membership, is green on the delivered tree, is mutation-proven per class (including the docs-scope lifetime), and owns the single seed registry (DM-3); the `.gitignore` token scan is subsumed without weakening the hygiene check (D2, C-8).

**Tasks**:

> **No product token**: the seed set is exactly the three already-public legacy tokens in their scan framing; the check's own source and the registry contain no token outside the seed list itself; the check reads repository content only (no network, no env-derived paths, no writes — TC-BRANDING-008 step 7).

- [x] **3.1** Create `scripts/checks/forbidden-literals.registry.json` (single source, DM-3): scope class 1 `packageTree` = `packages/` (tracked files, walker excludes `node_modules`/`dist` — same exclusion set as the content-inventory walker); class 2 `rootManifests` = `["package.json", "pnpm-lock.yaml"]`; class 3 `rootWorkspaceFiles` = `["pnpm-workspace.yaml", "tsconfig.json", "tsconfig.base.json", "biome.json", "commitlint.config.js", ".dependency-cruiser.cjs", ".bun-version", ".changeset/config.json", "bunfig.toml"]` (the ADR-named root set — NOT every root file; pre-existing corpus roots like `AGENTS.md`, `README.md`, `.opencode/**`, `.ados-claude/**` are out of scope per test plan §4.1); class 4 `ignoreRules` = `[".gitignore"]` (whole file, every line); class 5 `userFacingDocs` = `{ "corpusBaseline": "32784affbb8a1b82a57b6c4578a331b8bd99b4c4", "registered": [...] }` — the baseline is the full commit SHA of `32784af` (last pre-scan commit on `main-tools`, GH-170 merge; the canonical form in registry and code, never a branch/tag/`HEAD` expression, advanced only by the future corpus-migration change — D4), and `registered` is the explicit, reviewed list of docs under `doc/` minus `doc/changes/` + `doc/decisions/` exclusions that are **absent at `corpusBaseline`** (initially empty; the drill doc joins in Phase 5); membership is permanent once registered — a registered doc is scanned on every successor commit, never re-derived from a moveable ref (D4); `seedLiterals` = exactly `["ados", "ADOS_", "~/.ados"]`; `allowlist` = exactly the five DEC-8 entries: `packages/core/src/branding/`, `packages/adapters/src/legacy/`, `doc/decisions/`, `doc/changes/`, and a license/source-header line exemption (lines matching the standard header patterns — `Copyright`, `source:`, `Apache-2.0` comment lines — per DEC-8) (AC-F4-2, DM-3, TC-BRANDING-008 step 3).
- [x] **3.2** Implement `scripts/checks/forbidden-literals.ts`: read-only scan over the registry; matching exported as a pure function per D1 (delimiter set, case-insensitive, reported token = seed literal); allowlist applied per file path (classes) and per line (header exemption); on violation print every violation (`file`, `token`) in one run — not first-only — and exit non-zero (AC-F4-1 failure behavior, TC-BRANDING-009 step 8). Docs-scope meta-check (D4): no `--base` flag and no moveable-ref input exist — the baseline is resolved from the registry, validated as a full commit SHA, and verified reachable (`git cat-file -e <baseline>^{commit}`); an absent, non-SHA, or unreachable baseline (a shallow clone) fails closed with a named missing/invalid-baseline error — never silently skipping the docs class (RSK-T3, TC-BRANDING-009 step 9). Classify every doc under the user-facing roots as present or absent at the baseline commit, then assert the test-plan-v1.1 formula: (docs absent at baseline ⊆ `registered`) ∧ (`registered` ⊆ docs present in the tree ∧ absent at baseline) — failing names any unregistered doc absent at baseline and any registered entry missing from the tree or already present at the baseline (TC-BRANDING-008 steps 4–5). Registered docs are scanned on every run however many commits ago they were added — membership is permanent, not recomputed versus `HEAD` or any recent ref (TC-BRANDING-027).
- [x] **3.3** Author the matching corpora `tests/fixtures/forbidden-literals/true-positives.json` (all D1 true-positive forms) and `false-positives.json` (`avocados`, `mikados`, `paradosis`, `colorados`, `shadow`, `agentic-delivery-os`), and `tests/checks/forbidden-literals.test.ts`: (a) live-tree run `bun run scripts/checks/forbidden-literals.ts` (baseline resolved from the registry; the `corpusBaseline` commit reachable in the clone) exits 0 and reports 5/5 classes, naming the registered docs actually scanned (TC-BRANDING-008 — verified green today: `packages/**`, root manifests/workspace files, and `.gitignore` are token-free at the `corpusBaseline` commit; `registered` is empty until Phase 5); (b) five per-class true-positive mutations in temp trees (package file, root manifest, root workspace file, `.gitignore` line, registered doc absent at the temp baseline) each fail naming file + token; (c) docs-scope mutations (an unregistered doc absent at the temp baseline; an absent, non-SHA, or unreachable baseline) fail closed with named errors; (d) all three seed forms detected at least once across the matrix (AC-F4-1, AC-F4-2, NFR-3/NFR-4).
- [x] **3.4** Matching-semantics tests (TC-BRANDING-010): corpus assertions against the exported matcher (true positives all match; false positives all do not; `ADOS_HOME`/`ados_home` both match with the seed literal reported); vacuity probe — a deliberately wrong fixture entry in a temp corpus copy fails the corpus test; the reserved lowercase-embedding limitation is asserted (`myados` does NOT match) and cross-referenced to RSK-2 in a comment (AC-F4-2, RSK-2).
- [x] **3.5** Allowlist-exactness tests (TC-BRANDING-011): place a seed literal in each allowlisted location in a temp tree → clean (five controls, including the header-line exemption control); a non-allowlisted violation in the same tree still fails (no masking); registry-shape mutations in temp copies — sixth allowlist entry, removed entry, orphan seed token, sixth scope class — each fail the registry-shape test ("allowlist must be exactly the DEC-8 set") (AC-F4-2, AC-F5-1 scan half, NFR-3).
- [x] **3.6** Subsume the hygiene token scan (D2, TC-BRANDING-013): remove ONLY the `productTokens` loop (section 2) from `scripts/checks/ignore-rules.ts`; keep sections 1, 3, 4 (four coverage classes, brand-free glob + rename simulation, `git check-ignore` probes) byte-intact; update the header comment. Create `tests/checks/ignore-rules.test.ts`: live-tree exit 0 with the surviving assertions; temp-tree mutations prove the four coverage classes and rename survival remain load-bearing (a removed required pattern fails); a `.gitignore` seed literal (class-4 form) fails the full-scope scan; a doc-note records the D2 coverage delta. No other assertion, check, or bash file is touched (AC-F4-2, NFR-8, C-8).
- [x] **3.7** Wire locally: add root `package.json` script `check:forbidden-literals` = `bun run scripts/checks/forbidden-literals.ts` (satisfies the `ci-topology` wiring rule now; the CI job lands in Phase 6). The aggregate `check` chain is NOT modified (A-T8).
- [x] **3.8** Author the docs-scope lifecycle tests (TC-BRANDING-027) in `tests/checks/forbidden-literals.test.ts`, running exclusively against temp git repositories (never the live clone): model the doc lifetime — baseline commit `B` (a pre-existing user-facing doc, no drill doc), doc-add commit `D` (adds the drill doc and registers it), merge commit `M`, successor commit `S` (touches nothing under `doc/`); assert the scan is green at `M` and at `S` with the registered doc reported as scanned (membership NOT recomputed versus `HEAD` or any recent ref); assert the registry shape confers permanence (explicit full-SHA `corpusBaseline` + explicit `registered`; no code path deriving class-5 membership from a moveable ref); post-merge literal injection at `S` (a seed literal into the registered drill doc, nothing else changed) exits non-zero naming doc + token; scope-decay mutations fail by name — registered-entry deletion (the meta-check names the now-unregistered doc), baseline removal and baseline-as-moveable-ref (`main`, then `HEAD`; the registry-shape assertion names the baseline field), baseline advance to a commit at or after `D` (the meta-check names the registered doc as present at baseline); a shallow clone of the temp repo (baseline unreachable) fails closed with the named missing-baseline error; the live tree is untouched after the suite (`git status --porcelain` clean) (AC-F4-1, AC-F4-2, NFR-3, DM-3, RSK-T12; the CI half — baseline reachability on the runner — is verified in Phase 6 tasks 6.1/6.3/6.5).

**Acceptance Criteria**:

- Must: AC-F4-1 (five per-class failing mutations + docs-scope mutation, each naming file + token), AC-F4-2 (delivered state 5/5 classes green with the baseline-anchored docs class; exactly the five-entry allowlist honored), AC-F4-2/C-8 (hygiene subsumption without weakening), AC-F4-1/F4-2 docs-scope lifetime (TC-BRANDING-027: post-merge injection, entry removal, un-anchoring, baseline advance, and shallow clone all behave as specified — no silent scope decay).
- Should: scan runtime stays trivially fast (registry-driven, single pass); failure messages are one-line actionable (`file:token`).

**Affected code areas**:

- `scripts/checks/forbidden-literals.ts`, `scripts/checks/forbidden-literals.registry.json` (new)
- `scripts/checks/ignore-rules.ts` (updated — token block removed only)
- `tests/fixtures/forbidden-literals/{true-positives,false-positives}.json` (new)
- `tests/checks/{forbidden-literals,ignore-rules}.test.ts` (new)
- `package.json` (updated — one script added)

**System docs to update**:

- none

**Tests**:

- `bun run scripts/checks/forbidden-literals.ts` → exit 0, 5/5 classes (baseline resolved from the registry; the `corpusBaseline` commit must be reachable in the clone — D4)
- `bun test tests/checks/{forbidden-literals,ignore-rules}.test.ts` → green incl. every mutation and the TC-BRANDING-027 lifecycle cases
- `bun run scripts/checks/ignore-rules.ts` → exit 0 (four classes, glob, rename, probes)
- `pnpm check` → exit 0

**Completion signal**: `feat(GH-171): add full-scope forbidden-literal scan and subsume gitignore token check`

---

### Phase 4: Legacy compatibility adapter

**Goal**: F-5 (G-4) — the `adapters ./legacy` subpath maps the legacy environment prefix and legacy config directory to current names received as parameters, warns exactly once per process (zero when absent), never imports branding, introduces no new pre-freeze variables, and passes the scan under its allowlist entry with a reviewed literal inventory.

**Tasks**:

> **No product token**: the adapter's only name-like literals are the reviewed legacy mapping tokens (`ADOS_` prefix, `.ados` home-dir segment) — the DEC-8-sanctioned second home; every diagnostic string is name-free; current names exist only as parameters (D9).

- [x] **4.1** Implement `packages/adapters/src/legacy/index.ts` (D9): zero workspace imports. `createLegacyCompat({ current })` factory (isolated once-warning state) exposing a mapping entry point `resolveLegacy({ facts, homeDirectory })` that returns: mapped environment names (each own-property `ADOS_*` key of `facts` → `current.environmentPrefix + suffix`), the mapped config-directory path (`<homeDirectory>/.ados` → `<homeDirectory>/<current.configDirectoryName>`), and a `legacySourcesPresent` flag; emits exactly one warning through the injected `warn` sink on the first read that finds any legacy source (subsequent reads and additional sources stay silent for that instance). Also export a default process-scoped instance (module-level once-guard) whose thin wrapper reads the real environment and uses `console.warn` — runtime APIs are permitted in this subpath (`runtime-apis-confinement` allowlist) but all logic stays injectable (AC-F5-2, NFR-5).
- [x] **4.2** Warning discipline: the warning text names ONLY the legacy source kind (variable prefix / config directory) and the mapped current name — never variable values, never the environment record, never secret-looking content (NFR-5, TC-BRANDING-015).
- [x] **4.3** Author `tests/fixtures/legacy/warn-probe.ts` (child-process fixture, never `*.test.ts`): imports the adapter, injects a synthetic environment record + temp home directory (with/without the legacy config dir), performs one/two reads across one/two legacy sources, prints JSON `{ warnings: number, messages: string[] }`; a secret case seeds `ADOS_TOKEN=synthetic-secret-value`. The probe never reads the real process environment (AC-F5-2, TC-BRANDING-014 step 4, TC-BRANDING-015).
- [x] **4.4** Author `tests/behaviour/legacy-adapter.test.ts` (TC-BRANDING-014/015): fresh-factory unit counts (two reads → one warning; two different sources → still one; none → zero; mapping uses the SUPPLIED current names — two different current-name sets change the output with no code edit; mapping deterministic independent of warning state); child-process probes (default instance: legacy present → exactly one warning across two reads of two sources; absent → zero); secret safety (`synthetic-secret-value`, a second secret-looking value, and a user-like path segment never appear in the captured warning text; sink-only emission, no stack/object dump) (AC-F5-2, AC-F5-3 parameter half).
- [x] **4.5** Author `tests/fixtures/legacy/literal-inventory.json` (the reviewed inventory: legacy prefix, `.ados` segment, separators, empty string, name-free diagnostic strings) and `tests/structure/legacy-confinement.test.ts` (TC-BRANDING-016/017/018): AST zero-import scan for branding (alias + relative + `@delivery-os/core/branding` forms); no-new-variable scan — no `ADOS_`-prefixed literal or `process.env.ADOS_*`/`Bun.env.ADOS_*` read outside `packages/adapters/src/legacy/**` across `packages/**`, root manifests, root workspace files, `.github/workflows/**`, `.gitignore`, and registered new docs (tests fixtures, `doc/changes/**`, `doc/decisions/**` are the sanctioned framing locations); `DELIVERY_OS_WORKING_NAME` confined to the edge fixture/tests and absent from branding + the adapter; literal-inventory enumeration (every adapter string literal incl. template quasis is inventoried or explicitly structural; a synthetic non-legacy literal `candidate-brand` fails in a temp copy even though the scan allowlists the subpath); temp-copy mutations (branding import added to the adapter; `process.env.ADOS_NEW` in a surface package) fail by name (AC-F5-1 inventory half, AC-F5-3, NFR-6/NFR-7).
- [x] **4.6** Extend the content-inventory policy deliberately (TC-BRANDING-022 legacy half): `packages/adapters/src/legacy/index.ts` joins the per-file executable allowlist ("adapter" allowance) in `tests/structure/content-inventory.test.ts`; mutations (undeclared executable elsewhere) still fail (AC-F8-1, NFR-7/NFR-8).
- [x] **4.7** Verify scan behavior over the adapter: `bun run scripts/checks/forbidden-literals.ts` stays green (baseline from the registry; adapter subpath allowlisted — TC-BRANDING-011's control proven load-bearing on the live tree) (AC-F5-1 scan half).

**Acceptance Criteria**:

- Must: AC-F5-1 (scan green under the allowlist entry + confined inventory), AC-F5-2 (exactly-once/zero warning; parameter-supplied names), AC-F5-3 (no branding import; no new pre-freeze variables).
- Should: the factory/default split needs no test-only reset hook (A-T7); adapter stays small and mapping-only (RSK-3).

**Affected code areas**:

- `packages/adapters/src/legacy/index.ts` (updated — placeholder replaced by the adapter)
- `tests/fixtures/legacy/{warn-probe.ts,literal-inventory.json}` (new)
- `tests/behaviour/legacy-adapter.test.ts`, `tests/structure/legacy-confinement.test.ts` (new)
- `tests/structure/content-inventory.test.ts` (updated — legacy allowance)

**System docs to update**:

- none

**Tests**:

- `bun test tests/behaviour/legacy-adapter.test.ts` → green (child probes deterministic; RSK-T5 closed)
- `bun test tests/structure/{legacy-confinement,content-inventory}.test.ts` → green incl. mutations
- `bun test tests/boundaries` → `subpath-adapters-core-branding` fixtures still fire (D8)
- `bun run scripts/checks/forbidden-literals.ts` → exit 0
- `pnpm check` → exit 0

**Completion signal**: `feat(GH-171): add legacy compatibility adapter with one-time warning`

---

### Phase 5: Rename drill document

**Goal**: F-7 (G-5) — the rename drill exists as a self-contained, name-free new user-facing doc with its execution obligation, passes the forbidden-literal scan and the doc-distribution guard, and is registered in the scan's baseline-anchored docs scope with permanent membership (D4).

**Tasks**:

> **No product token**: the drill references "the CLI", "the runtime", "the product directory" generically; zero seed literals; zero candidate names (AC-F7-1, TC-BRANDING-020 step 4). The license header is added ONLY by the script — never hand-written.

- [x] **5.1** Author `doc/guides/rename-drill.md`: frontmatter with `ados_distribution: internal` (D6) inserted into the single frontmatter block; stable checklist anchors `RD-1..RD-11` covering the full DEC-8 battery — RD-1 temporary-copy replacement of branding values + the legacy mapping; RD-2 typecheck; RD-3 unit and integration tests; RD-4 boundary tests; RD-5 the forbidden-literal test; RD-6 binary build; RD-7 package publish dry-run; RD-8 MCP tool-list snapshot; RD-9 OpenCode tool-list snapshot; RD-10 the rename-survival assertions (root `.gitignore` still matches the renamed project-local config path; every root workspace file name-free or derived from branding); RD-11 the execution obligation stated verbatim: the drill must pass before release and whenever branding changes. Self-containment: gates and commands named directly; no links into `doc/changes/**`, `.ai/local/**`, or private artifacts (AC-F7-1, TC-BRANDING-020 steps 3–7).
- [x] **5.2** Add the license header via the script: `scripts/add-header-location.sh doc/guides` (agents never hand-add headers; the header lands inside the doc's existing structure per the script's own logic — no second `---` block, marker untouched).
- [x] **5.3** Register the doc: add `doc/guides/rename-drill.md` to `registered` in `scripts/checks/forbidden-literals.registry.json` — membership is conferred permanently at registration because the doc is absent at the fixed `corpusBaseline` (it remains scanned on the merge commit and every successor commit; TC-BRANDING-027 proves it); the meta-check now binds both directions: an unregistered doc absent at the baseline fails, and a registered entry missing from the tree or present at the baseline fails (AC-F7-1 scan half, DM-3).
- [x] **5.4** Author `tests/structure/rename-drill-doc.test.ts` (TC-BRANDING-020): asserts the doc exists at the bound path, is registered, declares a valid `ados_distribution` marker, is self-contained (no forbidden link targets), is name-free (no seed literal, no product/candidate name — generic terms present), contains all eleven `RD-*` battery rows with the required gate/command names, contains RD-10's two rename-survival assertions, and states the execution obligation; temp-copy mutations (remove one battery row; remove the obligation sentence) fail naming the missing piece (AC-F7-1).
- [x] **5.5** Run the doc guards: `bash scripts/.tests/test-doc-distribution.sh` (marker valid; internal-not-installed consistent with `install.sh` marker filtering) and the full scan with the registry-recorded baseline (the registered doc is now scanned as class 5 and must be clean) (AC-F7-1, NFR-9).

**Acceptance Criteria**:

- Must: AC-F7-1 (complete battery, config-glob + root-workspace assertions, execution obligation, name-free, passes the scan).
- Should: commands in the drill copy real gate names verbatim (RSK-6 drift resistance); manual clarity review recorded at PR time (TC-BRANDING-020 step 9).

**Affected code areas**:

- `doc/guides/rename-drill.md` (new)
- `scripts/checks/forbidden-literals.registry.json` (updated — one registered doc)
- `tests/structure/rename-drill-doc.test.ts` (new)

**System docs to update**:

- none (`doc/spec/**` reconciliation is Phase 7 / `@doc-syncer`)

**Tests**:

- `bash scripts/.tests/test-doc-distribution.sh` → exit 0
- `bun run scripts/checks/forbidden-literals.ts` → exit 0 (class 5 active with one registered doc)
- `bun test tests/structure/rename-drill-doc.test.ts` → green incl. mutations
- `pnpm check` → exit 0

**Completion signal**: `docs(GH-171): document the rename drill procedure`

---

### Phase 6: CI binding and boundary re-verification

**Goal**: F-4 CI half + F-8 (G-3, RSK-5) — the scan runs as a binding additive CI job with the registry-recorded `corpusBaseline` commit reachable (full-history checkout plus an explicit baseline-fetch step; shallow clones fail closed by design — D4, TC-BRANDING-027 step 8); topology and bindingness invariants stay green and fail on mutations; the full boundary suite and fixture-coverage meta-check confirm no unenforced rule and no regression.

**Tasks**:

> **No product token**: the job name and step text are brand-free; no bypass constructs anywhere (bindingness).

- [x] **6.1** Add the `ts-forbidden-literals` job to `.github/workflows/ci.yml` (additions only — the seven bash blocks and fifteen existing `ts-*` jobs byte-untouched): SHA-pinned `actions/checkout` with `fetch-depth: 0` (full history — or an equivalent full-history checkout; a shallow clone fails the fail-closed meta-check BY DESIGN), SHA-pinned `oven-sh/setup-bun` with `${{ env.BUN_VERSION }}`, `pnpm/action-setup` (same pins as the sibling jobs), `permissions: contents: read`, `pnpm install --frozen-lockfile`, an explicit baseline-fetch step `git fetch --no-tags origin 32784affbb8a1b82a57b6c4578a331b8bd99b4c4` (makes the registry-recorded `corpusBaseline` commit reachable; with `fetch-depth: 0` it is belt-and-braces and serves as the removable, mutation-tested baseline-availability step — RSK-T3/A-T5, TC-BRANDING-012 step 5, TC-BRANDING-027 step 8), then `bun run scripts/checks/forbidden-literals.ts` as the gate step (the docs-scope meta-check resolves the baseline from the registry — no ref argument). No `continue-on-error`, `|| true`, `set +e`, or `if: always()` (AC-F4-3, NFR-4).
- [x] **6.2** Update `TS_JOBS` in `scripts/checks/ci-topology.ts` to include `ts-forbidden-literals` (sixteen `ts-*` jobs; BASH_JOBS untouched; the additions-only diff-vs-base rule and the wiring rule — every `scripts/checks/*.ts` invoked by the aggregate or a named job/script — keep holding: the job text plus the Phase-3 root script both name `forbidden-literals`) (AC-F4-3, TC-BRANDING-012 step 3).
- [x] **6.3** Extend `tests/checks/ci-checks.test.ts` (TC-BRANDING-012): assert the job exists on the same triggers, invokes the scan, checks out full history (`fetch-depth: 0` or equivalent), fetches the registry-recorded baseline commit, and has no bypass construct; mutations in temp copies — `continue-on-error: true` injected (fails `ci-bindingness` naming job + line), job removed from `ci.yml` (fails `ci-topology` naming it), baseline-fetch step removed and a shallow `fetch-depth: 1` checkout without it (each fails the new assertion naming the missing baseline fetch — TC-BRANDING-012 step 5; the CI counterpart of TC-BRANDING-027 step 8's shallow-clone fail-closed) — all fail by name; assert the aggregate chain remains exactly five steps (`script-surface` green) and `ts-invariants` is byte-unchanged versus base (AC-F4-3, NFR-4/NFR-8).
- [x] **6.4** Boundary re-verification (TC-BRANDING-006/023, D8): `bun test tests/boundaries` — every existing negative fixture and ambient case still fires, controls stay clean; the fixture-coverage meta-check confirms every forbidden rule keeps ≥1 registered failing case at `severity: 'error'` and no orphan keys; assert the delivered tree adds NO new forbidden rule (rule-set diff vs base empty) so the existing `tier-branding-only-contracts`, `subpath-adapters-core-branding`, `ambient-env-branding`, `ambient-globals-neutral-tiers` are the sole enforcers; temp-copy mutations (a new rule without a fixture; deletion of the `subpath-adapters-core-branding` fixture family) fail the meta-check (AC-F8-1, NFR-7).
- [x] **6.5** Push-branch CI observation recorded: after the phase commit is pushed, record the `ts-forbidden-literals` job conclusion and the unchanged conclusions of the existing jobs in the execution log (CI is authoritative for TC-BRANDING-012 and the CI half of TC-BRANDING-027 — baseline reachable, docs class active on the runner; local equivalents do not complete AC-F4-3 — the merge-blocking observation gate mirrors the GH-170 R1.6 pattern).

**Acceptance Criteria**:

- Must: AC-F4-3 (binding additive job with the `corpusBaseline` always reachable — full-history checkout + explicit baseline fetch, shallow fails closed by design; topology + bindingness green and mutation-failing; existing jobs unchanged), AC-F8-1 (boundary suite + meta-check green; no unenforced new rule).
- Should: job runtime stays in the fast-loop budget (single scan + install); failure annotations name file + token for actionable triage; the recorded CI run doubles as the TC-BRANDING-027 CI half (baseline reachable, docs class active and green on the runner).

**Affected code areas**:

- `.github/workflows/ci.yml` (updated — one additive job)
- `scripts/checks/ci-topology.ts` (updated — `TS_JOBS` + job id)
- `tests/checks/ci-checks.test.ts` (updated — new assertions + mutations)

**System docs to update**:

- none

**Tests**:

- `bun run scripts/checks/ci-topology.ts`; `bun run scripts/checks/ci-bindingness.ts`; `bun run scripts/checks/ci-supply-chain.ts` → exit 0
- `bun test tests/checks` → green incl. the new mutations
- `bun test tests/boundaries` → green; `git diff origin/main-tools...HEAD -- .github/workflows/ci.yml` shows additions only
- `pnpm check` → exit 0

**Completion signal**: `ci(GH-171): bind forbidden-literal scan as an additive CI job`

---

### Phase 7: Finalize — full quality gates, version impact, spec reconciliation inputs

**Goal**: NFR-8 end-to-end + close-out — the full gate battery green (aggregate, all TS suites, boundary suite, affected bash suites incl. the doc-distribution guard, dependency/license/vulnerability), the version-impact/changeset decision recorded (D3), spec-reconciliation inputs prepared for `@doc-syncer`, and the DoD walkthrough completed.

**Tasks**:

> **No product token**: the execution report, DoD walkthrough, and every recorded fact stay brand-free (TC-BRANDING-026 evidence at PR review).

- [x] **7.1** Full gate battery (TC-BRANDING-024/025): `pnpm check` (five-step chain unchanged); `bun test tests/structure tests/behaviour tests/checks` + `bun test tests/boundaries`; `bun run scripts/checks/{forbidden-literals,ignore-rules,ambient-globals,workspace-entrypoints,ci-topology,ci-bindingness,ci-supply-chain,pin-equality,license-audit,vulnerability-gate}.ts` (the scan resolves its baseline from the registry — the `corpusBaseline` commit must be reachable in the clone); affected bash suites — `bash scripts/.tests/test-doc-distribution.sh` (doc distribution touched in Phase 5) and the CI-safe `bash scripts/.tests/test-*.sh` + `bash tools/.tests/test-*.sh` run; `pnpm install --frozen-lockfile` clean (lockfile unchanged — TC-BRANDING-025 zero new dependencies); `git status --porcelain` clean after everything (no live-tree mutation); `git diff --name-only origin/main-tools...HEAD -- scripts tools .opencode .ados-claude` contains only the new `scripts/checks/forbidden-literals*` files (no existing bash/tool/agent file changed) (AC-F4-3 CI half observed, NFR-8).
- [x] **7.2** Version impact + changeset decision (D3): record in this plan's Execution Log — version impact **minor**; no changeset file (GH-170 precedent; all packages private `0.0.0`; `privatePackages: {version:false, tag:false}`; the changesets fixed group owns versioning from the freeze change M4-S1; nothing publishes).
- [x] **7.3** Spec reconciliation inputs (lifecycle phase 7, `@doc-syncer` — NOT `@coder` delivery work; listed here so it cannot be lost): `doc/spec/features/feature-branding-seam.md` is the FIRST branding feature spec (none exists — first-spec-only rule, always-resolve); inputs: the seam contract (DM-1/DM-2), the D5 derivation-rule table, the scan contract (DM-3 + D1 matching + D2 subsumption), the legacy adapter rules, EVT-1/EVT-2, the drill obligation; glossary candidates (branding seam, working name, naming firewall, forbidden-literal scan, seed literal set, legacy compatibility adapter, rename drill, scope-of-claim — spec §23); AGENTS.md verified already-consistent (no rewrite expected); `.ai/rules/testing-strategy.md` gains the new check + suites in its module-to-test mapping. **A6 clause (binding for the handoff):** any future change that adds user-facing docs — including `doc/spec/**` authored via `@doc-syncer` — MUST register them in `scripts/checks/forbidden-literals.registry.json` in the same change; the docs-scope meta-check fails closed on an unregistered doc absent at `corpusBaseline`.
- [x] **7.4** DoD walkthrough: all 13 spec §17 ACs green with TC evidence (traceability table below); all plan tasks checked; NFR-1..NFR-9 verified; RSK-1..RSK-6 results recorded; TC-BRANDING-026 (manual name-freedom) and TC-BRANDING-020 step 9 (drill clarity) flagged as PR-time owner gates; protected files untouched.

**Acceptance Criteria**:

- Must: NFR-8 (aggregate + bash suites green, byte-untouched bash stack), all TCs executed/recorded, DoD reached.
- Should: execution report records per-phase commits, CI observations, and any deviations in the GH-170 format.

**Affected code areas**:

- none (verification + recording; report content committed into this plan's Execution Log)

**System docs to update**:

- `doc/spec/features/feature-branding-seam.md` (new — via `@doc-syncer`, lifecycle phase 7)
- `doc/overview/glossary.md`, `.ai/rules/testing-strategy.md`, AGENTS.md consistency check (via `@doc-syncer`)

**Tests**:

- The task-7.1 battery, all green, results recorded
- DoD walkthrough against the traceability table below

**Completion signal**: `chore(GH-171): record final verification, version impact, and spec reconciliation inputs`

---

## Test Scenarios

Full definitions: [chg-GH-171-test-plan.md](./chg-GH-171-test-plan.md) §5. **Traceability (phase → ACs → TCs)** — all 13 ACs and all 27 TCs covered; every task traces to at least one AC:

| Phase | Spec ACs satisfied | Test-plan TCs |
|-------|--------------------|---------------|
| 1 — Contracts + telemetry | AC-F2-1, AC-F6-1 | TC-BRANDING-005, TC-BRANDING-019 |
| 2 — Resolver + derivation | AC-F1-1, AC-F1-2, AC-F3-1 | TC-BRANDING-001, TC-BRANDING-002, TC-BRANDING-003, TC-BRANDING-004, TC-BRANDING-007, TC-BRANDING-021, TC-BRANDING-022 (branding half) |
| 3 — Scan + registry + subsumption | AC-F4-1, AC-F4-2 (AC-F5-1 scan half) | TC-BRANDING-008, TC-BRANDING-009, TC-BRANDING-010, TC-BRANDING-011, TC-BRANDING-013, TC-BRANDING-027 (docs-scope lifecycle implementation — task 3.8) |
| 4 — Legacy adapter | AC-F5-1, AC-F5-2, AC-F5-3 | TC-BRANDING-014, TC-BRANDING-015, TC-BRANDING-016, TC-BRANDING-017, TC-BRANDING-018, TC-BRANDING-022 (legacy half) |
| 5 — Rename drill doc | AC-F7-1 | TC-BRANDING-020 |
| 6 — CI binding + boundaries | AC-F4-3, AC-F8-1 | TC-BRANDING-006, TC-BRANDING-012, TC-BRANDING-023, TC-BRANDING-027 (CI half: baseline reachable on the runner, docs class active — tasks 6.1/6.3/6.5) |
| 7 — Finalize + gates | all (DoD), NFR-8 | TC-BRANDING-024, TC-BRANDING-025, CI observations; TC-BRANDING-026 (manual PR-time owner gate) |

**Ticket-AC mapping** (spec §17): AC-1 (every name-derived value traces to the seam) → Phases 1+2 (TC-001..007, 021) + Phase 4 confinement (TC-016); AC-2 (scan fails CI outside the allowlist) → Phases 3+6 (TC-008..013, TC-027); AC-3 (legacy adapter passes the scan) → Phases 3+4 (TC-011 controls, TC-018); AC-4 (legacy env/config read with a warning) → Phase 4 (TC-014..017).

**AC completeness check (13/13)**: AC-F1-1 ✓ P2 · AC-F1-2 ✓ P2 · AC-F2-1 ✓ P1 · AC-F3-1 ✓ P2 · AC-F4-1 ✓ P3 · AC-F4-2 ✓ P3 · AC-F4-3 ✓ P6 · AC-F5-1 ✓ P4 · AC-F5-2 ✓ P4 · AC-F5-3 ✓ P4 · AC-F6-1 ✓ P1 · AC-F7-1 ✓ P5 · AC-F8-1 ✓ P6.

## Artifacts and Links

| Artifact | Location | Type |
|----------|----------|------|
| Change specification (v1.0) | ./chg-GH-171-spec.md | Spec |
| Test plan (v1.1, 27 TCs) | ./chg-GH-171-test-plan.md | Test plan |
| Implementation plan | ./chg-GH-171-plan.md | Plan (this file) |
| PM notes | ./chg-GH-171-pm-notes.yaml | Notes |
| Authoritative decision | [ADR-0003 — OSS Tooling Monorepo Structure](../../../decisions/ADR-0003-oss-monorepo-structure.md) (C-3, DEC-4, DEC-8) | Decision record |
| Current-truth baseline | `doc/spec/features/feature-monorepo-scaffold-toolchain.md` | System spec |
| Brand contract | `packages/core/src/contracts/index.ts` (BrandIdentity ×12, `delivery.event.v1` / `delivery.metric.v1` literal types) | Updated (P1) |
| Branding seam | `packages/core/src/branding/index.ts` (resolver + documented derivation rules + input/error contract) | Updated (P2) |
| Legacy adapter | `packages/adapters/src/legacy/index.ts` (mapping, once-warning, injected sink) | Updated (P4) |
| Forbidden-literal scan | `scripts/checks/forbidden-literals.ts` + `scripts/checks/forbidden-literals.registry.json` (fixed `corpusBaseline` full SHA + permanent `registered` docs list — D4) | New (P3) |
| Hygiene check (subsumed) | `scripts/checks/ignore-rules.ts` (token block removed; classes/glob/probes intact) | Updated (P3) |
| Rename drill | `doc/guides/rename-drill.md` (`ados_distribution: internal`; header via script) | New (P5) |
| CI wiring | `.github/workflows/ci.yml` (`ts-forbidden-literals` job), `scripts/checks/ci-topology.ts` (`TS_JOBS`) | Updated (P6) |
| Test suites | `tests/behaviour/{branding-resolver,legacy-adapter}.test.ts`, `tests/structure/{branding-contract,branding-seam,legacy-confinement,rename-drill-doc,content-inventory}.test.ts`, `tests/checks/{forbidden-literals,ignore-rules,ci-checks}.test.ts` | New/updated (P1–P6) |
| Fixtures | `tests/fixtures/branding/{names.json,derivation-cases.json,edge.ts}`, `tests/fixtures/legacy/{warn-probe.ts,literal-inventory.json}`, `tests/fixtures/forbidden-literals/{true,false}-positives.json` | New (P2–P4) |
| Root manifest | `package.json` (`check:forbidden-literals` script; aggregate unchanged) | Updated (P3) |

## Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-10-29 | plan-writer | Initial plan — 7 phases; all 13 ACs and 26 TCs traced; decisions pinned: D1 matching semantics (test plan §4.1 delimiter rule verbatim; reserved lowercase-embedding case recorded), D2 hygiene subsumption (token block removed, four classes intact, coverage delta recorded), D3 no changeset (GH-170 precedent, minor impact recorded), D4 check/registry layout + `ts-forbidden-literals` job with `fetch-depth: 0` + base fetch, D5 twelve derivation rules (documented doc-block + independent expectation table), D6 drill doc `internal` at `doc/guides/rename-drill.md`, D7 `Result`-enveloped resolver with edge-owned `DELIVERY_OS_WORKING_NAME`, D8 no new boundary rules (existing rules are the enforcers; no new fixtures required), D9 legacy adapter shape (zero workspace imports, factory + default, injected warn). |
| 1.1 | 2026-10-29 | plan-writer | DoR iter-1 remediation (critical finding 1 — docs scope self-break/scope-decay; see `readiness-review/readiness-iter-1.md`): **D4 revised** from moveable PR-base membership (`--base origin/main-tools`, added-vs-base bijection) to the corpus-baseline design — registry records `corpusBaseline: "32784affbb8a1b82a57b6c4578a331b8bd99b4c4"` (full SHA canonical in code + registry), `registered` membership permanent, meta-check = (docs absent at baseline ⊆ registered) ∧ (registered ⊆ present in tree ∧ absent at baseline), fail-closed on absent/non-SHA/unreachable baseline (shallow clones fail by design), baseline advances only in the future corpus-migration change (OQ-T5); `--base origin/main-tools` removed from every scan invocation; CI job keeps `fetch-depth: 0` + explicit baseline-fetch step (task 6.1/6.3); tasks 3.1/3.2/3.3/4.7/5.3/5.5/7.1 + phase test commands aligned; **new task 3.8** slots TC-BRANDING-027 (phase 3 implementation; phase 6 CI baseline-reachability verification); TC count 26 → 27 incl. traceability tables; minor finding 2 (D6/TC-BRANDING-020 marker) noted resolved per test plan v1.1; 13/13 ACs still covered; phase structure, commit boundaries, derivation rules, and legacy adapter design unchanged from 666fc18. |

## Execution Log

| Phase | Status | Started | Completed | Commit | Notes |
|-------|--------|---------|-----------|--------|-------|
| 1 — Contracts + telemetry | DONE | 2026-10-30 | 2026-10-30 | f988fa5 | `bun test tests/structure/branding-contract.test.ts` 8 pass / 0 fail; `bun test tests/boundaries` 103 pass / 0 fail; `bun run scripts/checks/ambient-globals.ts` OK; `pnpm typecheck` exit 0; `pnpm check` exit 0 |
| 2 — Resolver + derivation | DONE | 2026-10-30 | 2026-10-30 | 98a45a5 | `bun test tests/behaviour/branding-resolver.test.ts tests/structure/branding-seam.test.ts tests/structure/content-inventory.test.ts` 28 pass / 0 fail; `bun test tests/boundaries` 103 pass / 0 fail; ambient + `pnpm check` exit 0 |
| 3 — Scan + registry + subsumption | DONE | 2026-10-30 | 2026-10-30 | 97f4378 | `bun run scripts/checks/forbidden-literals.ts` 5/5 classes, 0 violations; `bun test tests/checks/{forbidden-literals,ignore-rules}.test.ts` 24 pass / 0 fail (incl. TC-027 lifecycle + A7 orphan-entry/entry-removal); `bun run scripts/checks/ignore-rules.ts` exit 0; `pnpm check` exit 0 |
| 4 — Legacy adapter | DONE | 2026-10-30 | 2026-10-30 | da4237c | `bun test tests/behaviour/legacy-adapter.test.ts tests/structure/legacy-confinement.test.ts tests/structure/content-inventory.test.ts` 23 pass / 0 fail (A4: probe asserts captured console.warn output); `bun test tests/boundaries` 103 pass / 0 fail; scan exit 0; `pnpm check` exit 0 |
| 5 — Rename drill doc | DONE | 2026-10-30 | 2026-10-30 | e2a7329 | `bash scripts/.tests/test-doc-distribution.sh` exit 0; scan 5/5 classes with 1 registered doc; `bun test tests/structure/rename-drill-doc.test.ts` 5 pass / 0 fail; `pnpm check` exit 0. Deviation recorded: the mandated `ados_distribution:` marker line is exempted as a required document header in the single source-header allowlist entry (same five-entry allowlist; otherwise no new doc could pass the name-free scan). |
| 6 — CI binding + boundaries | DONE | 2026-10-30 | 2026-10-30 | f3fbc21 | `ci-topology` 16 TS jobs / 7 bash jobs; `ci-bindingness`, `ci-supply-chain` exit 0; `bun test tests/checks` 79 pass / 0 fail (incl. job removal, continue-on-error, shallow/no-baseline-fetch mutations); `bun test tests/boundaries` 103 pass / 0 fail; `pnpm check` exit 0. Task 6.5 (push-branch CI observation) deferred to PR-time: the delivery constraint forbids pushing; local equivalents cover the same assertions. |
| 7 — Finalize + gates | DONE | 2026-10-30 | 2026-10-30 | pending | Full battery green: `pnpm check`; 145 core tests; 103 boundary tests; ten checks; doc-distribution; all CI-safe bash suites; frozen install. See the delivery completion record below. |

### Delivery completion record (Phase 7)

**Version impact**: minor. **Changeset**: none. D3 applies (GH-170 precedent): all packages are private `0.0.0`, `.changeset/config.json` sets `privatePackages: {version: false, tag: false}`, the changesets fixed group owns versioning from the naming-freeze change (M4-S1), and nothing publishes, so there is no version to bump.

**Full gate battery (task 7.1, all green)**

| Gate | Result |
|------|--------|
| `pnpm check` (five-step aggregate unchanged) | exit 0 |
| `bun test tests/structure tests/behaviour tests/checks` | 145 pass / 0 fail |
| `bun test tests/boundaries` (all fixtures + fixture-coverage meta-check) | 103 pass / 0 fail |
| `forbidden-literals`, `ignore-rules`, `ambient-globals`, `workspace-entrypoints`, `ci-topology`, `ci-bindingness`, `ci-supply-chain`, `pin-equality`, `license-audit`, `vulnerability-gate` | exit 0 each |
| `bash scripts/.tests/test-doc-distribution.sh` | exit 0 |
| CI-safe bash suites (`find . -path '*/.tests/test-*.sh'` with the CI exclusions) | all pass |
| `pnpm install --frozen-lockfile` | up to date; `pnpm-lock.yaml` unchanged |
| `git diff --name-only origin/main-tools...HEAD -- scripts tools .opencode .ados-claude` | only `scripts/checks/{forbidden-literals.ts,forbidden-literals.registry.json,ignore-rules.ts,ci-topology.ts}`; no bash/tool/agent file changed |
| `git status --porcelain` after the phase commit | clean |

**Spec reconciliation inputs for `@doc-syncer` (task 7.3, lifecycle phase 7)**

- New feature spec: `doc/spec/features/feature-branding-seam.md` (first branding feature spec; always-resolve rule). Inputs: the seam contract (DM-1/DM-2), the D5 derivation table, the scan contract (DM-3 + D1 matching + D2 subsumption), the legacy adapter rules, EVT-1/EVT-2, and the drill obligation.
- Glossary candidates (spec §23): branding seam, working name, naming firewall, forbidden-literal scan, seed literal set, legacy compatibility adapter, rename drill, scope-of-claim.
- AGENTS.md verified already consistent (no rewrite expected); `.ai/rules/testing-strategy.md` gains the new check and suites in its module-to-test mapping.
- **A6 clause (binding for the handoff):** any future change that adds user-facing docs — including `doc/spec/**` authored via `@doc-syncer` — MUST register them in `scripts/checks/forbidden-literals.registry.json` in the same change; the docs-scope meta-check fails closed on an unregistered doc absent at `corpusBaseline`.

**DoD walkthrough (task 7.4) — 13/13 ACs evidenced**

| AC | Evidence | Verdict |
|----|----------|---------|
| AC-F1-1 | `tests/behaviour/branding-resolver.test.ts` (001/002/004: 12/12 values, determinism, fail-closed, derivation table) | PASSED |
| AC-F1-2 | `tests/structure/branding-seam.test.ts` (021) + live scan 0 literals | PASSED |
| AC-F2-1 | `tests/structure/branding-contract.test.ts` (005) + `tests/boundaries` tier rules | PASSED |
| AC-F3-1 | `branding-resolver.test.ts` (007 override via `tests/fixtures/branding/edge.ts`) + `branding-seam.test.ts` (no override variable in branding) | PASSED |
| AC-F4-1 | `tests/checks/forbidden-literals.test.ts` per-class mutations + TC-BRANDING-027 lifecycle (post-merge injection, entry removal, A7 orphan entry, un-anchoring, baseline advance, shallow clone) | PASSED |
| AC-F4-2 | Live scan 5/5 classes / 0 violations; allowlist exactness tests; `ignore-rules` regression suite | PASSED |
| AC-F4-3 | `ci-topology`/`ci-bindingness`/`ci-supply-chain` green + `tests/checks/ci-checks.test.ts` mutations (continue-on-error, job removal, baseline-fetch removal, shallow checkout, additions-only diff) | PASSED locally; push-branch CI observation deferred to PR-time (no push permitted) |
| AC-F5-1 | `tests/structure/legacy-confinement.test.ts` literal inventory + live scan green over the allowlisted legacy subpath | PASSED |
| AC-F5-2 | `tests/behaviour/legacy-adapter.test.ts` fresh-factory counts + child-process probes (explicit captured `console.warn`) | PASSED |
| AC-F5-3 | `legacy-confinement.test.ts` zero branding/workspace imports + no-new legacy variable scan | PASSED |
| AC-F6-1 | `branding-contract.test.ts` telemetry reservation, producer-as-metadata wording, no emission path | PASSED |
| AC-F7-1 | `tests/structure/rename-drill-doc.test.ts` + `test-doc-distribution.sh` + scan of the registered doc | PASSED |
| AC-F8-1 | `tests/boundaries` 103 pass (fixture-coverage meta-check included); no new forbidden rule; `content-inventory.test.ts` per-file policy | PASSED |

PR-time owner gates remain: TC-BRANDING-026 (artifact name-freedom) and TC-BRANDING-020 step 9 (drill clarity). Risk outcomes: RSK-1 closed by the DM-2 seam contract; RSK-2 accepted residual lowercase-embedding case recorded in the matcher and TC-010; RSK-3 confined by D9 + confinement tests; RSK-4 guarded by the scan and the owner gate; RSK-5 closed by binding topology/bindingness; RSK-6 handled by the drill's execution obligation.

**Deviations recorded**

1. The mandated `ados_distribution:` marker line contains the seed token; it is exempted as a required document header within the single source-header allowlist entry (the allowlist stays at five entries). Without this, no new user-facing doc could satisfy the name-free scan. The drill body and every non-header doc line remain scanned.
2. Task 6.5 (push-branch CI observation) is deferred to PR-time because this delivery run must not push. All local equivalents pass; AC-F4-3's CI half remains a merge-blocking observation at PR review.
3. Task 7.1's prose says the protected-path diff contains "only the new `forbidden-literals*` files"; the delivered diff also touches `scripts/checks/ignore-rules.ts` (D2 subsumption) and `scripts/checks/ci-topology.ts` (task 6.2), both required by the plan and permitted by test-plan TC-BRANDING-024 step 5 (new/changed `scripts/checks/*.ts`). No bash, `tools/`, `.opencode/`, or `.ados-claude/` file changed.
