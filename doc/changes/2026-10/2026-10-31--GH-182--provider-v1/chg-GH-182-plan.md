---
id: chg-GH-182-provider-v1
status: Proposed
created: 2026-10-31T18:30:00Z
last_updated: 2026-10-31T19:15:00Z
owners: [engineering]
service: delivery-os provider engine
labels: [change, planning]
links:
  change_spec: ./chg-GH-182-spec.md
  test_plan: ./chg-GH-182-test-plan.md
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
  typescript_rules: ../../../../.ai/rules/typescript.md
  adr_refs:
    - ../../../decisions/ADR-0003-oss-monorepo-structure.md
    - ../../../decisions/ADR-0005-runtime-confinement-provider-client-subpaths.md
  related_changes:
    - ../2026-10-30--GH-172--result-contract-error-table/chg-GH-172-plan.md
    - ../2026-10-30--GH-173--config-layer/chg-GH-173-plan.md
    - ../2026-10-30--GH-174--state-layer/chg-GH-174-plan.md
    - ../2026-10-30--GH-181--primitive-ports-credential-metadata/chg-GH-181-plan.md
    - ../2026-10-31--GH-188--client-seeds-trap-catalogs/chg-GH-188-plan.md
summary: >
  Deliver the v1 AI model provider engine: typed provider, chain, peak-window,
  and quota configuration under the layered catalog with the shipped Z.AI
  Coding Plan descriptor and credential reference as fail-closed defaults;
  deterministic subscription-first chain resolution with eight closed skip
  reasons; peak and quota evaluation ported from the legacy bash resolver
  battery with MAX-over-conditions, fresh re-evaluation after sleep, and a
  completed-sleep loop cap; named self-expiring parks persisted through the
  state layer and folded into the rebuildable provider-parks.json projection;
  structured fail-loud announcements with closed secret-free evidence
  allowlists; credential-port-only quota authorization through a new declared
  adapters provider-quota subpath; four new provider error rows with
  exact-code classification; and the minimal provider CLI surface (resolve,
  quota, parks list).
version_impact: minor
---

# IMPLEMENTATION PLAN — GH-182: M0-S13: provider v1 — quota-aware routing, named parks, fail-loud announcements

## Context and Goals

Implement F-1–F-9 of the completed specification (v1.2; 46 ACs in §17, DEC-1–DEC-13 in §15, DM-1–DM-13 in §8.3, NFR-1–NFR-10 in §9, Appendix A legacy parity for the 49 executed `TC-ZAI-*` checks, Appendix B config field contract, Appendix C error/announcement mapping) against the completed test plan (v1.1; 62 TCs, §5.3 parity matrix mapping all 49 legacy IDs, §5.4 no-silent-path matrix, §6 fixture inventory, §7.1 traceability). Both artifacts are committed; this plan derives every task, file location, and gate from them and adds no requirement. Execution belongs on `feat/GH-182/provider-v1`; the PR targets `main-tools`.

The binding placement inputs are the spec's recorded decisions: DEC-2 (pure policy in the runtime-neutral core; quota HTTP transport as injected I/O in a new declared adapters subpath; parks through the delivered state layer), DEC-3 (typed `provider` catalog branch; shipped Z.AI descriptor + credential reference as overridable defaults; no chain enabled by default), DEC-4 (subscription-first enforced by validation, never silent reordering; no peak-window paid substitution), DEC-5 (closed park vocabulary, absolute expiry, derived-at-read, append-only ledger + rebuildable projection), DEC-6 (fail-loud replaces fail-open everywhere), DEC-7 (credential-port-only authorization, zero new secret-read allowlist entries), DEC-9 (the CLI never sleeps or spawns; the loop ships as engine policy), DEC-11 (`resolve` is the only mutating subcommand), DEC-12 (deterministic announcement identity; `provider.resumed` on next observation).

**Code-reality facts this plan relies on** (verified 2026-10-31 against the live tree):

- Core exports exactly `.`, `./contracts`, `./state`, `./branding`; there is no `./provider` subpath yet, and `packages/core/src/provider/**` does not exist. A new core subpath and a new core tier directory are both part of this change.
- `scripts/checks/ambient-globals.ts` hardcodes `NEUTRAL_TIER_DIRECTORIES` (`contracts`, `domain`, `app`, `config`, `branding`); `packages/core/src/provider` is not scanned today and must be added (one-line scope extension, PD-E).
- `runtime-apis-confinement` in `.dependency-cruiser.cjs` currently admits `^packages/adapters/src/(repo|file|host|session|legacy|credentials)/` plus the ADR-0005 entries (`github`, `gitlab`, `jira`), `core/src/state/driver/`, `cli/`, and `opencode/`. The quota transport needs one new exact-path, reason-bearing entry.
- `SECRET_READ_ALLOWLIST` in `scripts/checks/secret-read-boundary.ts` is frozen: **zero new entries**; provider planted-read fixtures extend only `tests/fixtures/secret-boundary/**` and the matching test.
- `scripts/checks/workspace-entrypoints.ts` pins `EXPECTED_ENTRYPOINTS` with exact JSON-equality against each `workspaceImports` manifest; `ADAPTER_SUBPATHS` is shared by the cli/mcp/opencode/testkit rows, so one new adapter subpath must be added to the constant **and** to all four consumer manifests, plus the `ADAPTER_SUBPATHS` lists in `tests/boundaries/harness.ts` and `tests/structure/subpaths.test.ts`.
- `packages/cli/src/classify.ts` resolves a kind-only provider lookup only while the kind has exactly one row (`matches.length !== 1` throws, and `classifyThrown` contains to `fallback.internal`). Adding four provider rows makes the provider kind exact-code-required **by table content**; what ships in this change are the pinning tests (TC-PROV-046), the documented clarification, and updates to any existing test that asserted the provider singleton shortcut.
- Shipped defaults live in the `PRODUCTION_DEFAULTS` object literal in `packages/core/src/config/defaults.ts`; `scripts/checks/exports-parity.ts` derives `packages/core/dist/config/defaults-positions.json` (name-to-line positions plus source hash) and `config.schema.json` during the core build, and `tests/checks/config-default-positions.test.ts` plus the parity check guard drift. The catalog's `MapField` declares fixed child keys; `provider.entries/credentials/chains` are dynamic-name maps and need an additive record-valued representation (PD-F).
- The state layer exposes fenced `append`, verified `read`, and `replaceDocument` (bare file name, `document:<name>` intent record, atomic swap); `packages/core/src/state/registry.ts` is the precedent for fold + fenced-replace helpers, and the phase document-name constants live in `contracts/registry.ts`.
- The CLI composes command runtimes at `packages/cli/src/edge.ts` and registers command definitions into the program's `commands` record; command modules stay pure and stream-free (`surface-serializer-entry-only`); the exit projection is CLI-only.
- GH-188 landed `tests/behaviour/providers/**` and `tests/fixtures/providers/**` (client seeds). GH-182's test homes are the singular `tests/behaviour/provider-*.test.ts` and `tests/fixtures/provider/**` exactly as the test plan pins them (PD-B).

### Decisions this plan records (mechanics owned by the plan writer)

- **PD-A — projection read/write split (reconciles DM-12 with NFR-6/TC-PROV-050)**: park views always fold **verified `provider.park` ledger truth** in memory; the physical `provider-parks.json` derived document is written only by a mutating `resolve` (fenced `replaceDocument`, mirroring `replacePhaseProjection`). A missing or divergent document observed on read is served from the fold with **zero writes** — "rebuild-on-read" is the in-memory fold from verified truth; the persisted document catches up on the next fenced resolve. No separate rebuild CLI exists in v1. This satisfies "rebuild adds no ledger records" (TC-PROV-050 step 3) without weakening ledger-first truth.
- **PD-B — test-home placement**: all GH-182 suites and fixtures use the test plan's pinned locations — `tests/behaviour/provider-*.test.ts`, `tests/structure/provider-contract.test.ts`, `tests/golden/provider-*.test.ts`, `tests/checks/provider-{hermetic,evidence-bounds}.test.ts`, `tests/fixtures/provider/**` — distinct from GH-188's plural `providers/` directories. Suite files extend incrementally per phase; TC IDs, AC traces, and legacy mappings never change.
- **PD-C — quota transport seam**: the injectable `QuotaTransport` contract type lives in `packages/core/src/contracts/provider.ts` (one request: endpoint, timeout, credential material passed once; result: HTTP status plus sanitized body-text envelope). The production native-`fetch` wrapper lives at `packages/adapters/src/provider-quota/index.ts`, accepts an injectable fetch-like function (native fetch as the production default), builds the authorization header in memory per request, follows no redirects with credentials, and stores nothing. Core policy never sees the raw body beyond normalization.
- **PD-D — subpath registrations**: new core subpath `./provider` (`packages/core/package.json` exports plus `#provider/*` imports alias; the `EXPECTED_ENTRYPOINTS.cli` core list and `packages/cli/package.json` `workspaceImports` gain `./provider`; mcp/opencode/testkit unchanged — no provider surface for them in v1) and new adapters subpath `./provider-quota` (exports plus `#provider-quota/*` alias; `ADAPTER_SUBPATHS` in `scripts/checks/workspace-entrypoints.ts`, `tests/boundaries/harness.ts`, `tests/structure/subpaths.test.ts`; all four consumer `workspaceImports` manifests gain it because the entrypoints check is exact-match).
- **PD-E — ambient scope extension**: add `packages/core/src/provider` to `NEUTRAL_TIER_DIRECTORIES` in `scripts/checks/ambient-globals.ts`. This is the only edit to that check; the depcruiser `runtime-apis-confinement` rule already bans `node:*`/`bun:*` for the new directory (it is in no `pathNot` group), and the import-purity guard for provider core is the AST half of TC-PROV-006 in `tests/structure/provider-contract.test.ts`.
- **PD-F — catalog representation for dynamic-name maps**: `provider.entries`, `provider.credentials`, and `provider.chains` are maps keyed by user-chosen names. Express them with an **additive record-valued catalog field kind** (any child key, declared value shape) so Appendix B's required/optional/default contract stays schema-enforced and unknown-key discipline is preserved for fixed branches; extend `tests/behaviour/config-schema.test.ts` accordingly. If the deliverer finds the existing `MapField` sufficient, verify and proceed — do not widen beyond Appendix B. Relational rules the schema cannot express (end greater than start, references, duplicates, cost order) are enforced by the pure provider validator (Phase 2) with the TC-PROV-002 classifications.
- **PD-G — engine construction seams**: the engine accepts `Clock`, `Sleep`, `CredentialPort`, `QuotaTransport`, and `StateStorePort` as explicit construction inputs (test-plan §7.2 testability contract); the CLI edge wires production implementations, tests wire fakes. The re-evaluation loop is engine policy only — no CLI path sleeps (DEC-9).

### Open questions

- **None blocking.** The test plan's §8.3 OQ-1..OQ-5 are all resolved by spec v1.2, and this plan records the remaining mechanics (PD-A..PD-G). No spec or test-plan gap remains that would require invented behavior.
- **Spec OQ-1 (`provider-quota` naming)**: non-blocking; the name is confined to the manifest export, the `#provider-quota/*` alias, one depcruiser entry, and the three `ADAPTER_SUBPATHS` lists — mechanically renamable by the M0-S17 naming lock without behavior change.
- **Spec OQ-2/OQ-3 (paid-fallback default; shipped chain posture)**: DEC-3/DEC-4 record the fail-closed defaults (`allowPaidFallback: false`; descriptor shipped, no chain enabled). If the owner disputes either posture, resolve through the §14.1 decision candidates **before merging the configuration surface** (spec §18) — carried as Phase 11 task 11.2. Decision needed: consult `@decision-advisor`.
- **DC-1..DC-5 decision records**: the spec flags them as warranting records but does not author them, and neither does this plan. Disputes route through `@decision-advisor` (decision-record placeholder: `doc/decisions/` per `.ai/agent/decision-instructions.md`). Uncontested delivery proceeds on the spec's DEC-1..DEC-13.

## Scope

### In Scope

- **F-1**: typed provider configuration — descriptors (DM-1), cost classes (DM-2), peak windows (DM-3), quota policy (DM-4), credential references (DM-5), chains (DM-6) — as a `provider` catalog branch with the Appendix B field contract, the shipped Z.AI descriptor and `zai` credential reference defaults, and provenance through `config debug`.
- **F-2**: deterministic declared-order, subscription-first chain resolution with the eight closed skip reasons and precedence (DM-7), chain-exhausted parks, and no peak-window paid substitution.
- **F-3**: UTC peak-window evaluation with buffer clamp, custom windows, schema rejection of invalid windows, and MAX combination with quota.
- **F-4**: quota snapshot normalization and evaluation (DM-9) with legacy boundary parity, `provider.quota.exceeded` fail-loud for exhausted-without-reset, fresh re-evaluation, and the completed-sleep loop cap (DM-13).
- **F-5**: named self-expiring parks (DM-10) as `provider.park` ledger records (EVT-1) folded into the rebuildable `provider-parks.json` projection (DM-12), with active/expired/cleared views.
- **F-6**: structured announcements (DM-11; EVT-2/EVT-3/EVT-4) with closed codes, severity, deterministic identity, closed 8/11-field evidence allowlists, skipped-entry outage visibility, and the fail-loud replacement of legacy fail-open.
- **F-7**: credential-port-only quota authorization; `credential-missing`/`credential-rejected` parks; zero new secret-read allowlist entries; canary-proof outputs.
- **F-8**: the `provider resolve|quota|parks list` CLI surface with CommandResult envelopes, human output, classified invalid-flag failures, and exit projection.
- **F-9**: provider error rows (`provider.chain.empty`, `provider.chain.invalid`, `provider.outage`, `provider.auth.rejected`; `provider.quota.exceeded` retained) synchronized machine-to-doc in the same change, exact-code provider classification, `fallback.internal` containment.
- Cross-cutting: new core `./provider` subpath and tier; new adapters `./provider-quota` subpath with one confinement admission plus negative fixtures; ambient-scope extension; boundary fixture-coverage; the ported legacy battery (all 9 Appendix A groups, 49 legacy IDs) and the §5.4 no-silent-path matrix.

### Out of Scope

- Model-profile selection/heuristics, harness spawn/dispatch, tracker/VCS/CI provider work, credential sidecar, non-UTC/DST/cross-midnight windows, daemons/timers/auto-clearing, spend/status/queue/doctor/MCP surfaces, `provider parks clear`, dynamic/composed chains, provider health scoring (spec NG-1..NG-8, §7.2, §7.3).
- Any modification to `scripts/hooks/pre-opencode-iteration-zai.sh` or `scripts/.tests/test-hook-zai-example.sh` — the legacy hook stays byte-unchanged and remains the spawn gate.
- System documentation beyond the in-change floor: the documented error-table rows (Phase 1, code-bound artifact of the sync check) and the provider condition/park guide (Phase 8, TC-PROV-062 evidence home). The provider-engine feature spec, config-layer/state-layer spec updates, command-registry row, glossary terms, and ADR editorial pointers belong to the lifecycle documentation-sync phase (`@doc-syncer`).
- No edits to `scripts/*.sh`, `tools/`, `.opencode/`, `.ados-claude/`, bash CI jobs, or `.github/workflows/ci.yml` (existing `ts-*` jobs discover all new suites; no new invariant scripts are added).

### Constraints

- **Read before editing**: `@coder` reads [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md) before touching `packages/**`/`tests/**` (strict TS, purity, DI, error contract, bun:test authoring) and [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) for the layer-to-gate mapping.
- **Tier purity (NFR-3/AC-NFR-3)**: `packages/core/src/provider/**` imports only `#contracts` (and intra-provider `#provider/*`); no `node:*`/`bun:*`, no ambient globals, no clock/randomness/environment/filesystem/network; `Clock`/`Sleep`/`CredentialPort`/`QuotaTransport`/`StateStorePort` are injected (PD-G). The ambient guard covers the directory after PD-E.
- **Brand neutrality (AC-F1-4)**: no `ados`/`ADOS_`/`~/.ados` tokens; provider names, the Z.AI endpoint, and credential source-key names are declarative data (defaults/fixtures), never engine branches; `forbidden-literals` stays green; no vendor constants in the evaluator (AC-F3-2 scan).
- **Hermetic tests (NFR-2/AC-NFR-2)**: 0 live network calls, 0 live credentials, 0 real sleeps; throwing-fetch guard, sleep spy, injected clock/transport/credential/state; the legacy battery file is never executed as a live script.
- **Secret safety (NFR-4/AC-F7-3)**: credential material is resolved once per request through `CredentialPort`, never cached/logged/persisted/returned; evidence only from the closed allowlists (8 park / 11 announcement fields, ≤1024 serialized bytes, ≤20 fields); no raw body, authorization header, credential value, or endpoint userinfo on any surface; `SECRET_READ_ALLOWLIST` unchanged.
- **Registration exact-match (PD-D)**: every new subpath is registered in `packages/*/package.json` (exports, imports alias, `workspaceImports`), `scripts/checks/workspace-entrypoints.ts`, `tests/boundaries/harness.ts`, and `tests/structure/subpaths.test.ts` in the same commit; `pnpm build` precedes dist-dependent suites and `pnpm check:boundaries` (workspace-import resolution; `pretest`/`pretypecheck` already build).
- **Boundary-rule change discipline**: the one `runtime-apis-confinement` admission ships exact-path with a reason comment citing ADR-0005's refined reading and GH-182, plus a clean control and failing negative fixtures; the fixture-coverage meta-check stays green; never widen to `adapters/**`.
- **Error-table lockstep**: each new row lands in `packages/core/src/contracts/error-table.ts` and `doc/spec/features/feature-result-contract.md` in the same commit; never a red intermediate sync state (GH-173/GH-181 precedent).
- **Inventory discipline**: every new `packages/**` file joins `tests/structure/inventory.json`; exported `as const` data (closed sets, allowlists, constants) joins `EXECUTABLE_ALLOWANCES` in `tests/structure/content-inventory.test.ts` with the exact export list.
- **Fixture quarantine**: planted violations and mutation copies live only in `mkdtemp` trees or `tests/fixtures/**` (never `*.test.ts`, never under `packages/**`); read-only scans verify `git status --porcelain` before/after; quota bodies are hand-authored sanitized fixtures (test-plan §6).
- **exactOptionalPropertyTypes**: optional park/announcement/decision fields are asserted by construction (`if`-guards or conditional spread) — no `undefined` assignments.
- **Commits**: one Conventional Commit per phase, scope `GH-182` (for example `feat(GH-182): ...`), bodies within the repository 100-character limit, via `@committer`; each phase leaves the repo green (targeted suites minimum; `pnpm check` where feasible).
- **No license headers by hand**; change artifacts stay header-free; the Phase 8 guide declares `ados_distribution` inside its existing front matter (never a new `---` block) and passes `bash scripts/.tests/test-doc-distribution.sh`.

### Risks

- **RSK-1 (fail-loud changes operator expectations)**: every divergence is asserted (TC-PROV-037/052/055..061) and documented in the Phase 8 guide; the legacy hook is untouched; no spawn cutover in this change.
- **RSK-2 (endpoint shape drift)**: defensive normalization; every malformed class announces `provider.quota.malformed` and parks or classifies (Appendix C); fixture-driven parity (TC-PROV-027/055/057).
- **RSK-3 (ledger growth)**: deterministic identity dedupes unchanged park generations (DEC-12); bounded evidence; rebuildable projection; no per-poll writes (TC-PROV-030/034/050).
- **RSK-4 (credential leak)**: port-only resolution; single per-request handoff; closed allowlists; canary scans in raw and JSON-escaped forms (TC-PROV-038/040/059); zero new boundary entries.
- **RSK-5 (misconfiguration behaves unexpectedly)**: schema plus pure semantic validation with classified `provider.chain.invalid`/`provider.chain.empty`; fail closed; no silent reorder or default substitution (TC-PROV-002/004/005).
- **RSK-6/RSK-7 (UTC windows; paid-fallback policy)**: UTC-only validation rejects non-UTC; subscription-first validation, paid fallback off by default, and no peak substitution are asserted by policy tests (TC-PROV-008/010).
- **RSK-8 (parity gaps)**: §5.3 maps all 49 legacy IDs to TC-PROV-054..062; TC-PROV-052's class-level mutation fails if any class returns clear.
- **RSK-9 (announcement noise)**: deterministic identity; severity split; one announcement per park generation (TC-PROV-034).
- **RSK-10 (park mistaken for a blocked lane)**: distinct record kinds and vocabulary; a park always carries a resume time (TC-PROV-031).
- **Plan-specific — cap off-by-one**: the counted unit is completed sleeps; TC-PROV-023/058/061 assert exactly N sleeps, no post-cap fetch, and no extra iteration for the cap park.
- **Plan-specific — skip-precedence misimplementation**: `paid-fallback-not-allowed` is used only when fallback is disabled; otherwise later eligible entries are `shadowed` relative to the selected/determining entry (AC-F2-5); TC-PROV-007/008/010 pin the matrix.
- **Plan-specific — projection bypass**: PD-A pins fold-on-read so a stale or torn `provider-parks.json` can never serve a wrong view; TC-PROV-030/032/043/050 assert the zero-write rebuild.

**Rollback**: the change is additive — no state schema change (park/announcement records are new kinds inside `delivery.state.v1`), no existing config keys invalidated, no bash-stack edits. Revert the phase commits as one coherent unit; never split synchronized pairs (machine error row with documented row; confinement entry with boundary fixtures; subpath export with registration lists; closed-set constants with the inventory fixture). A rolled-back tree with prior provider config present fails closed with `provider.chain.empty`. After any rollback, re-run `pnpm check`, `pnpm check:boundaries`, and `bun run scripts/checks/error-table-sync.ts` to confirm the baseline.

### Success Metrics

From spec §4.1, verified by the named TCs: 100% of parks carry a closed cause and absolute future expiry (TC-PROV-028/029/033); 0 silent legacy fail-open classes (TC-PROV-037/052); 0 ambient credential reads and 0 new allowlist entries (TC-PROV-006/038); 0 subscription-first violations accepted (TC-PROV-004/008); 100% deterministic replay across 100 runs (TC-PROV-047); exact loop-cap accounting (TC-PROV-023/058/061); 0 live network/credential/sleep (TC-PROV-048); 100% of the 49 legacy checks mapped with parity or documented divergence (TC-PROV-054..062); 100% bidirectional error-table sync (TC-PROV-045); evidence ≤1024 bytes / ≤20 fields / closed allowlists (TC-PROV-049); ≤50 ms for 100-entry pure evaluation (TC-PROV-051).

## Phases

Execution order is strict: **1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → (10 if findings) → 11**. Each phase ends in a verifiable green state and one Conventional Commit (scope `GH-182`) via `@committer`. Run `pnpm build` before dist-dependent suites and before `pnpm check:boundaries`.

### Phase 1: Provider contracts, error rows, and the provider config branch

**Goal**: Land the closed provider vocabulary, schema identifiers, evidence allowlists, the five synchronized provider error rows with exact-code classification pinned, and the typed `provider` catalog branch with shipped defaults — everything later phases consume.

**Tasks**:

- [x] **1.1** Add `packages/core/src/contracts/provider.ts` (types and `as const` data only): provider descriptor, cost class, peak window, quota policy, credential reference, chain, decision and skip types (DM-1..DM-8), condition kinds, the park cause set, the eight skip reasons, the eleven announcement codes, record-kind identifiers (`provider.park`, `provider.announcement`), payload schema identifiers `delivery.provider.park.v1` and `delivery.provider.announcement.v1`, the `provider-parks.json` derived-document name constant, the closed evidence allowlists (8 park fields; 8 base plus 3 announcement fields), and the `QuotaTransport` contract type (PD-C). Export from `packages/core/src/contracts/index.ts`; add the file to `tests/structure/inventory.json` and the `as const` values to `EXECUTABLE_ALLOWANCES` in `tests/structure/content-inventory.test.ts`. Create `tests/fixtures/provider/contract-inventory.json` and the inventory assertions of `tests/structure/provider-contract.test.ts` (both-direction export equality, closed sets, allowlists, schema/projection identifiers). **Refs**: F-1, F-5, F-6, F-7, F-9; DM-1..DM-11. **ACs**: AC-F1-1, AC-F5-1, AC-F6-1, AC-F9-1. **TCs**: TC-PROV-001 (contracts half). **Verify**: `bun test tests/structure/provider-contract.test.ts tests/structure/content-inventory.test.ts`; `bun run scripts/checks/ambient-globals.ts`.
- [x] **1.2** Add the four new rows to `ERROR_TABLE` (`packages/core/src/contracts/error-table.ts`) with exact Appendix C fields — `provider.outage` (transient, retryable, not_landed, platform-provider), `provider.auth.rejected` (user, non-retryable, user-validation), `provider.chain.empty` (user, non-retryable, user-validation), `provider.chain.invalid` (user, non-retryable, user-validation) — retaining `provider.quota.exceeded` unchanged, **and** the four documented rows plus the exact-code classification note in `doc/spec/features/feature-result-contract.md` in the same commit; extend `tests/structure/error-table.test.ts` and `tests/checks/error-table-sync.test.ts` provider sections (counts, fields, both-direction drift mutations). **Refs**: F-9; NFR-8. **ACs**: AC-F9-1. **TCs**: TC-PROV-045. **Verify**: `bun run scripts/checks/error-table-sync.ts`; `bun test tests/checks/error-table-sync.test.ts tests/structure/error-table.test.ts`.
- [x] **1.3** Pin exact-code provider classification (AC-F9-2): with five provider rows the kind-only path in `packages/cli/src/classify.ts` must never resolve a provider failure — extend `tests/behaviour/error-classification.test.ts` and add `tests/fixtures/provider/security/classification-cases.ts`: each declared provider code resolves its exact row and projected exit; no-code, undeclared-code, and wrong-kind-code contain to `fallback.internal` (never the first provider row by kind); existing non-provider singletons (input/state/lint) unchanged; a temp-copy restoration of a kind-only provider shortcut fails the test; update any pre-existing test that asserted the provider singleton. **Refs**: F-9; NFR-8. **ACs**: AC-F9-2. **TCs**: TC-PROV-046. **Verify**: `bun test tests/behaviour/error-classification.test.ts tests/behaviour/exit-projection.test.ts`.
- [x] **1.4** Add the `provider` branch to `PRODUCTION_CATALOG` (`packages/core/src/config/catalog.ts`) per PD-F: `provider.defaultChain` (optional string), `provider.credentials` (record: `sourceKey.style` literal or environment-prefixed, `.name` required for literal, `.suffix` required for environment-prefixed), `provider.entries` (record: `class` required subscription or pay-per-token, optional `enabled`, optional `peak` with timezone UTC-only, startSecondsOfDay 0..86399 required, endSecondsOfDay 0..86399 required, bufferSeconds ≥0 default 0, optional `quota` block per Appendix B with HTTPS-no-userinfo `endpoint`, `credentialRef`, `timeoutMs` default 15000, `thresholdPercent` default 100, `maxSleepLoops` default 24, outage/credential/cap park TTLs default 300/900/300), `provider.chains` (record: non-empty `entries` list, `allowPaidFallback` default false). Schema-enforce what the catalog expresses; extend `tests/behaviour/config-schema.test.ts`, `config-resolver.test.ts`, and `config-restrictions.test.ts` with provider fixtures (unknown-key discipline, required-field failure, enum/range rejection, non-UTC timezone, non-HTTPS and userinfo endpoints). **Refs**: F-1; DM-1..DM-6; Appendix B. **ACs**: AC-F1-1, AC-F1-5 (schema half), AC-F3-3 (schema half). **TCs**: TC-PROV-002 (schema half). **Verify**: `bun test tests/behaviour/config-schema.test.ts tests/behaviour/config-resolver.test.ts tests/behaviour/config-restrictions.test.ts`.
- [x] **1.5** Ship the defaults (DEC-3): add the `provider` key to `PRODUCTION_DEFAULTS` in `packages/core/src/config/defaults.ts` — the `zai-coding-plan` descriptor (class `subscription`, peak 21600/36000/7200 UTC, quota block targeting `https://api.z.ai/api/monitor/usage/quota/limit` with `credentialRef: zai` and Appendix B defaults) and the `zai` credential reference (`sourceKey.style: literal`, `name: ZAI_API_KEY`) — with **no** chains and **no** `defaultChain`. Rebuild so `exports-parity` regenerates `defaults-positions.json` and `config.schema.json`; `tests/checks/config-default-positions.test.ts`, `tests/checks/packed-config.test.ts`, and the parity check stay green. **Refs**: F-1; DM-4, DM-5; DEC-3, DEC-13. **ACs**: AC-F1-5. **TCs**: TC-PROV-003 (defaults half). **Verify**: `pnpm build` then `bun test tests/checks/config-default-positions.test.ts tests/checks/packed-config.test.ts`; `bun run scripts/checks/exports-parity.ts`.
- [x] **1.6** Add `tests/fixtures/provider/config/defaults.yaml` and `optional-omitted.yaml` plus the TC-PROV-003 behaviour cases in `tests/behaviour/provider-chain-resolution.test.ts`: resolved defaults contain the descriptor and credential reference exactly once and no default chain is enabled; optional defaults materialize (enabled true, buffer 0, timeout 15000, threshold 100, loop cap 24, TTLs 300/900/300, paid fallback false); absent optional peak/quota blocks stay absent; `config debug` provenance names the defaults layer for provider fields; temp-copy default mutation fails. **Refs**: F-1; DM-1, DM-4. **ACs**: AC-F1-5. **TCs**: TC-PROV-003. **Verify**: `bun test tests/behaviour/provider-chain-resolution.test.ts tests/behaviour/config-provenance.test.ts`.
- [x] **1.7** Author the full §6 config fixture inventory under `tests/fixtures/provider/config/` (valid-chain, valid-chain-multi, paid-before-subscription, duplicate-entries, unknown-reference, empty-chain, no-chain, missing-required, optional-omitted, quota-policy, quota-policy-minimal, quota-disabled, skip-matrix, subscription-first, peak-substitution, peak-zai, peak-custom, peak-invalid-timezone, peak-end-before-start, peak-out-of-range, all-parked, disabled-entry, allowed-paid-fallback, disallowed-paid-fallback, skipped-outage) so Phases 2–7 consume stable config data; no fixture is a `*.test.ts` file. **Refs**: test plan §6. **ACs**: supports AC-F1-*, AC-F2-*. **TCs**: fixture base for TC-PROV-002..010. **Verify**: fixtures load through the config resolver in the Phase 2 suites.
- [x] **1.8** Neutrality and scope proofs for the new contracts file: the contracts-tier ambient scan is green; the "new contracts files are inside the ambient scan scope" assertion in `tests/structure/error-table.test.ts` covers `contracts/provider.ts`; the declaration-only content inventory is green. **Refs**: NFR-3 (contracts half). **ACs**: AC-F1-1 (neutrality half). **TCs**: TC-PROV-001 (neutrality half). **Verify**: `bun run scripts/checks/ambient-globals.ts`; `bun test tests/structure`.

**Acceptance Criteria**:

- Must: closed vocabularies, allowlists, schema ids, and the projection name are pinned by an independent fixture in both directions (AC-F1-1, AC-F5-1, AC-F6-1, AC-F9-1).
- Must: error-table sync green in both directions with `provider.quota.exceeded` identity unchanged; exact-code provider classification is total with `fallback.internal` containment (AC-F9-1, AC-F9-2).
- Must: shipped defaults resolve with provenance and no enabled chain; Appendix B schema rules fail closed (AC-F1-5, AC-F3-3 schema half).

**Files and modules**:

- Code areas: new `packages/core/src/contracts/provider.ts`, `tests/structure/provider-contract.test.ts`, `tests/fixtures/provider/contract-inventory.json`, `tests/fixtures/provider/config/**`, `tests/fixtures/provider/security/classification-cases.ts`; updated `packages/core/src/contracts/{error-table,index}.ts`, `packages/core/src/config/{catalog,defaults}.ts`, `doc/spec/features/feature-result-contract.md`, `tests/structure/{inventory.json,content-inventory.test.ts,error-table.test.ts}`, `tests/checks/{error-table-sync,config-default-positions,packed-config}.test.ts`, `tests/behaviour/{error-classification,exit-projection,config-schema,config-resolver,config-restrictions,config-provenance,provider-chain-resolution}.test.ts`.
- System docs: `doc/spec/features/feature-result-contract.md` (four documented rows plus the exact-code classification note) — the only system-doc edit of Phases 1–7.

**Tests**:

- `pnpm build` then `bun test tests/structure tests/behaviour/error-classification.test.ts tests/behaviour/config-*.test.ts tests/behaviour/provider-chain-resolution.test.ts tests/checks/error-table-sync.test.ts tests/checks/config-default-positions.test.ts`; `bun run scripts/checks/{ambient-globals,error-table-sync,exports-parity}.ts`; `pnpm check:boundaries`.

**Completion signal**: `feat(GH-182): add provider contracts, exact-code error rows, and provider config branch`

### Phase 2: Pure provider validation and peak/chain/condition policy

**Goal**: Land the runtime-neutral provider tier — semantic configuration validation, UTC peak arithmetic, per-entry condition combination, and deterministic subscription-first chain resolution with the eight closed skip reasons — all pure, all zero-I/O, all ahead of any transport or state work.

**Tasks**:

- [x] **2.1** Scaffold the provider tier and the core `./provider` subpath: create `packages/core/src/provider/index.ts` as the public pure engine surface (spec §16.1) and register the core subpath per PD-D (`packages/core/package.json` `exports` entry plus the `#provider/*` imports alias); add `packages/core/src/provider` to `NEUTRAL_TIER_DIRECTORIES` in `scripts/checks/ambient-globals.ts` (PD-E — the only edit to that check); add every new file to `tests/structure/inventory.json` and any exported `as const` values to `EXECUTABLE_ALLOWANCES` in `tests/structure/content-inventory.test.ts`; rebuild so exports parity regenerates. **Refs**: F-1..F-4; §16.1; PD-D, PD-E. **ACs**: supports AC-F1-1. **TCs**: TC-PROV-006 (scope half). **Verify**: `pnpm build`; `bun run scripts/checks/ambient-globals.ts`; `bun run scripts/checks/exports-parity.ts`; `pnpm check:boundaries`.
- [x] **2.2** Add `packages/core/src/provider/validate.ts` — pure semantic validation over the resolved `provider` branch for every relational rule the schema cannot express (PD-F): unknown chain→entry references, unknown quota→credential references, duplicate chain entries, empty or missing `entries`, subscription-before-pay-per-token cost order (DM-2/DM-6), and peak `end > start`; classified failures are `provider.chain.invalid` (naming the chain and the offending entries) and `provider.chain.empty`; validation performs no credential resolution, quota fetch, or state write (TC-PROV-002 step 4). **Refs**: F-1, F-2; DM-2, DM-6. **ACs**: AC-F1-1, AC-F1-2 (validation half), AC-F1-3, AC-F3-3 (semantic half). **TCs**: TC-PROV-002 (semantic half), TC-PROV-004, TC-PROV-005 (validation half). **Verify**: `bun test tests/behaviour/provider-chain-resolution.test.ts`.
- [x] **2.3** Add `packages/core/src/provider/peak.ts` — UTC half-open `[max(0, start − buffer), end)` evaluation (DM-3, DEC-10): outside the window yields clear; inside yields the seconds until end and an absolute expiry at the window end; a buffer crossing the day boundary clamps to zero and never yields a negative wait; pure arithmetic over the injected clock with no vendor constants (the TC-PROV-012 constant-scan target). **Refs**: F-3; DM-3; DEC-10. **ACs**: AC-F3-1, AC-F3-2. **TCs**: TC-PROV-011, TC-PROV-012 (Phase 7 adds the TC-054 parity kin). **Verify**: `bun test tests/behaviour/provider-peak-window.test.ts`.
- [x] **2.4** Add `packages/core/src/provider/conditions.ts` — per-entry condition evaluation (DM-8): merges the declared peak condition with injected quota/credential/transport condition facts into a clear/parked state with active condition kinds, wait seconds, and an absolute expiry where parkable; combines waits by MAX with the fixed determining-cause tie order (peak-window, quota-exhausted, provider-outage, credential-missing, credential-rejected) so the single cause is the condition determining the later expiry. This file refines the codebase map's DM-8 evaluation between `peak.ts` and `quota.ts`; quota facts arrive through the injected evaluator until Phase 3 lands `quota.ts`. **Refs**: F-3, F-4; DM-8, DM-10. **ACs**: AC-F3-4 (combinator half). **TCs**: TC-PROV-013 (combinator half). **Verify**: `bun test tests/behaviour/provider-peak-window.test.ts`.
- [x] **2.5** Add `packages/core/src/provider/chain.ts` — deterministic declared-order resolution (DM-7): the first eligible entry is selected subject to subscription-first cost policy and `allowPaidFallback`; a peak-window park never permits substitution to paid capacity; every non-selected entry carries exactly one of the eight closed skip reasons assigned by the pinned precedence `disabled` > own condition > `paid-fallback-not-allowed` > `shadowed`, where `paid-fallback-not-allowed` is used only when the chain's paid fallback is disabled and a later eligible entry with no higher-precedence reason is `shadowed` relative to the selected entry or, in a parked decision, the determining entry (AC-F2-5); the determining entry is the selected entry, or the chain entry whose provider park supplies the chain park's earliest expiry; an all-parked chain yields a `chain:<name>` parked decision with cause `chain-exhausted` and the earliest contributing provider expiry, failing loud with a classified provider failure when no contributing park can supply a future expiry (AC-F2-3). **Refs**: F-2; DM-2, DM-6, DM-7. **ACs**: AC-F2-1, AC-F2-2, AC-F2-3 (decision half), AC-F2-4, AC-F2-5. **TCs**: TC-PROV-007, TC-PROV-008, TC-PROV-009 (decision half), TC-PROV-010. **Verify**: `bun test tests/behaviour/provider-chain-resolution.test.ts`.
- [x] **2.6** Extend `tests/behaviour/provider-chain-resolution.test.ts` (validation, cost order, skip matrix, subscription-first, peak substitution, all-parked, no-fabrication controls) and create `tests/behaviour/provider-peak-window.test.ts` (the four boundary instants, buffer clamp, custom window plus the evaluator constant scan) on the Phase 1.7 fixtures: missing/empty chain fails `provider.chain.empty` (user, non-retryable) with zero parks, zero announcements, and no invented provider; cost-order rejection performs zero transport/credential/state calls; the validator never reorders entries or substitutes a default chain. **Refs**: F-1, F-2, F-3. **ACs**: AC-F1-2, AC-F1-3, AC-F2-1..F2-5, AC-F3-1, AC-F3-2. **TCs**: TC-PROV-004, TC-PROV-005, TC-PROV-007..012. **Verify**: `bun test tests/behaviour/provider-chain-resolution.test.ts tests/behaviour/provider-peak-window.test.ts`.
- [x] **2.7** Extend `tests/structure/provider-contract.test.ts` with the provider-policy purity and neutrality proofs: the import-purity AST half of TC-PROV-006 (imports only `#contracts` and intra-provider `#provider/*`; no `node:*`, `bun:*`, `process`, `fetch`, timers, `Date.now`, `Math.random`, filesystem, or environment reads over `packages/core/src/provider/**`) and the AC-F1-4 neutrality assertions (provider names, endpoints, and credential source-key names are declarative fixture data; `forbidden-literals` stays green). **Refs**: F-1; NFR-3. **ACs**: AC-F1-4, AC-NFR-3 (halves). **TCs**: TC-PROV-006 (steps 1–2). **Verify**: `bun test tests/structure tests/checks/forbidden-literals.test.ts`; `bun run scripts/checks/ambient-globals.ts`; `pnpm check:boundaries`.
- [x] **2.8** Determinism seed in the chain suite: identical injected config, clock, credential, and transport facts produce deep-equal decisions and skipped lists across repeated in-suite runs (TC-PROV-007 step 5); the full 100-run byte-identical replay lands in Phase 7 as TC-PROV-047. **Refs**: NFR-1. **ACs**: supports AC-F2-1, AC-NFR-1. **TCs**: TC-PROV-007 (step 5). **Verify**: `bun test tests/behaviour/provider-chain-resolution.test.ts`.

**Acceptance Criteria**:

- Must: semantic validation fails closed with the classified identities and zero I/O (AC-F1-1, AC-F1-2, AC-F1-3); resolution is declared-order, subscription-first, total over non-selected entries with the eight-reason closed set and the pinned precedence including the AC-F2-5 determining-entry rule (AC-F2-1..F2-5); peak boundary and buffer arithmetic are exact and vendor-free (AC-F3-1, AC-F3-2).
- Should: the MAX combinator and the determining-cause tie order are verified with injected quota facts ahead of Phase 3 (AC-F3-4 combinator half).

**Files and modules**:

- Code areas: new `packages/core/src/provider/{index,validate,peak,conditions,chain}.ts`, `tests/behaviour/provider-peak-window.test.ts`; updated `packages/core/package.json` (exports + imports alias), `scripts/checks/ambient-globals.ts` (PD-E), `tests/structure/inventory.json`, `tests/structure/content-inventory.test.ts`, `tests/structure/provider-contract.test.ts`, `tests/behaviour/provider-chain-resolution.test.ts`.
- System docs: none.

**Tests**:

- `pnpm build` then `bun test tests/structure tests/behaviour/provider-chain-resolution.test.ts tests/behaviour/provider-peak-window.test.ts`; `bun run scripts/checks/{ambient-globals,exports-parity}.ts`; `pnpm check:boundaries`.

**Completion signal**: `feat(GH-182): add pure provider validation, peak, conditions, and chain policy`

### Phase 3: Quota evaluation, parks, announcements, and loop policy

**Goal**: Complete the pure engine — quota snapshot normalization and legacy-parity evaluation with fail-loud classification, the park and announcement models with closed evidence allowlists and deterministic identity, and the MAX/fresh-fetch/completed-sleep-cap re-evaluation policy — wired through the PD-G construction seams.

**Tasks**:

- [x] **3.1** Add `packages/core/src/provider/quota.ts` — snapshot normalization (DM-9): parse the sanitized transport envelope into a normalized snapshot (validity, limits filtered to `TOKENS_LIMIT`, `TIME_LIMIT` entries ignored, non-negative integer percentage, optional reset epoch milliseconds); never retain the raw body; classify malformed JSON, envelope code ≠ 200, envelope `success` ≠ true, absent or non-array limits, and non-numeric percentage as the malformed class. **Refs**: F-4; DM-9. **ACs**: supports AC-F4-2, AC-F4-6. **TCs**: TC-PROV-016 (filter half), TC-PROV-027 (normalization half). **Verify**: `bun test tests/behaviour/provider-quota-evaluation.test.ts`.
- [x] **3.2** Quota evaluation in `quota.ts`: a non-negative integer percentage at or above the threshold (inclusive at 100) is exhausted; the wait is `reset − now` with the park expiry at the reset instant; a past (or equal-to-now) reset clamps to zero wait and does not park; the soonest valid reset among exhausted limits wins; mixed valid/invalid resets use the valid one with no `reset_missing` while a valid reset exists; earlier resets on non-exhausted limits are ignored; an exhausted limit with no valid reset fails loud — classified `provider.quota.exceeded` (transient, retryable, exit 2) with `provider.quota.reset_missing` in the safe summary, no state park or announcement record, and no fabricated expiry. **Refs**: F-4; DM-9, DM-10; Appendix C. **ACs**: AC-F4-1, AC-F4-2, AC-F4-3, AC-F4-4. **TCs**: TC-PROV-014..022. **Verify**: `bun test tests/behaviour/provider-quota-evaluation.test.ts`.
- [x] **3.3** Failure and credential classification in `quota.ts` per Appendix C: transport failure/timeout → `provider-outage` park and `provider.quota.unreachable` warning; HTTP 401/403 → `credential-rejected` park and `provider.quota.auth_rejected` (quota paths classify `provider.auth.rejected`, user, non-retryable, exit 1); non-auth HTTP failures (500/429 and an unfollowed redirect) → `provider-outage` park and `provider.quota.http_error`; malformed classes → `provider-outage` park and `provider.quota.malformed`; an unresolvable credential through the `CredentialPort` (`config.credential.missing`) attempts no fetch and produces a `credential-missing` park plus `provider.credential.missing` warning with evidence `failureClass: config.credential.missing` and `credentialRefName` the reference name only; the chain may continue to a later eligible entry of the same cost class. **Refs**: F-4, F-6, F-7; DM-5, DM-9; Appendix C. **ACs**: AC-F4-6, AC-F6-4 (engine half), AC-F7-2 (behavior half), AC-F7-4 (classification half). **TCs**: TC-PROV-024, TC-PROV-025, TC-PROV-026, TC-PROV-027, TC-PROV-039. **Verify**: `bun test tests/behaviour/provider-quota-evaluation.test.ts tests/behaviour/provider-credentials.test.ts`.
- [x] **3.4** Add `packages/core/src/provider/parks.ts` — the park model (DM-10/DM-12): deterministic names `provider:<name>` and `chain:<name>`; the closed cause set; the conditions list with the single determining cause by the fixed tie order; an absolute expiry strictly in the future at creation; park generation identity = cause + expiry, so unchanged re-evaluation appends nothing, a changed cause or expiry appends one new record with the latest record winning, and an early clear appends `cleared` exactly once; the `reevaluation-cap` park expiry is `now + capParkTtlSeconds`; the `chain-exhausted` park expiry is the earliest contributing provider expiry; evidence is projected strictly from the closed 8-field park allowlist; the fold/projection shape for `provider-parks.json` is the per-park-name latest-record fold. Parks stay distinct from blocked lanes: a park always carries a resume time and a provider/chain subject. **Refs**: F-5; DM-10, DM-12; EVT-1. **ACs**: AC-F5-1 (model half), AC-F5-3 (logic half), AC-F5-4, AC-F5-6. **TCs**: TC-PROV-028 (shape half), TC-PROV-029 (derivation half), TC-PROV-030 (logic half), TC-PROV-031, TC-PROV-033 (expiry model half). **Verify**: `bun test tests/behaviour/provider-parks.test.ts`.
- [x] **3.5** Add `packages/core/src/provider/announcements.ts` — the announcement model (DM-11; EVT-2/EVT-3): the eleven closed codes; severity `info` for `provider.peak.parked`, `provider.quota.parked`, and `provider.resumed`, `warning` for the rest; deterministic identity from subject + code + park generation; a safe templated message naming only the provider, condition, and resume time; evidence a subset of the closed 11-field announcement allowlist; exactly one announcement per park generation; an outage on an entry skipped in favour of another is still announced and parked (AC-F6-2); a park observed clear emits `provider.resumed` (info) on the next observation (EVT-4). **Refs**: F-6; DM-11; EVT-2..EVT-4. **ACs**: AC-F6-1, AC-F6-2. **TCs**: TC-PROV-034, TC-PROV-035. **Verify**: `bun test tests/behaviour/provider-announcements.test.ts`.
- [x] **3.6** Add `packages/core/src/provider/loop.ts` — the re-evaluation policy (DM-13): the MAX-over-conditions driver combining peak and quota waits; a fresh quota fetch every iteration with no cache; the injected `Sleep` seam; the cap counted in completed sleeps — after exactly N completed sleeps (N = the configured `maxSleepLoops`, engine default 24 when no quota policy overrides it) the engine announces `provider.reevaluation.cap` and returns a `reevaluation-cap` park with the cap TTL as its absolute expiry, performs no further quota fetch, and consumes no additional iteration creating the cap park; the driver never proceeds as if clear. **Refs**: F-4; DM-13; DEC-9. **ACs**: AC-F4-5. **TCs**: TC-PROV-023. **Verify**: `bun test tests/behaviour/provider-quota-evaluation.test.ts tests/behaviour/provider-parks.test.ts`.
- [x] **3.7** Add the engine construction seams (PD-G): a factory in `packages/core/src/provider/index.ts` accepting `Clock`, `Sleep`, `CredentialPort`, `QuotaTransport` (the PD-C contract from Phase 1), and `StateStorePort` as explicit inputs, exposing pure resolve/evaluate policy functions; no module-level singletons or side effects; tests wire fakes, the CLI edge wires production implementations in Phase 6. **Refs**: test plan §7.2. **ACs**: supports AC-NFR-2. **TCs**: seam for TC-PROV-006/038/047/048. **Verify**: `pnpm typecheck`; the Phase 3 suites.
- [x] **3.8** Author the quota fixtures per test plan §6 (`tests/fixtures/provider/quota/**` — hand-authored sanitized JSON bodies, `.ts` transports for `transport-failure`, `http-401`, `http-403`, `http-500`, `http-429`, `http-302`, and `sequence-*.json` sequences) and create `tests/behaviour/provider-quota-evaluation.test.ts`: fixed/stepping clocks, sequence transports, a sleep spy that counts completed sleeps without sleeping, TOKENS_LIMIT/TIME_LIMIT matrix, threshold boundaries, reset clamping and selection, exhausted-without-reset classification with zero state writes, failure classes per Appendix C, MAX plus the quota half of the peak-plus-quota case, fresh-fetch and exactly-N-completed-sleeps cap accounting (test both N=1 and a larger N). **Refs**: F-3, F-4; §6. **ACs**: AC-F3-4 (completion), AC-F4-1..F4-6. **TCs**: TC-PROV-013 (quota half), TC-PROV-014..027. **Verify**: `bun test tests/behaviour/provider-quota-evaluation.test.ts`.
- [x] **3.9** Author the park/announcement/evidence fixtures (`tests/fixtures/provider/{parks,announcements,evidence}/**`, including `park-allowlist.json` and `announcement-allowlist.json`) and create `tests/behaviour/provider-parks.test.ts`, `provider-announcements.test.ts`, and `provider-credentials.test.ts`: park shape/allowlist/expiry derivation/generation logic, the park-vs-lane contract distinction, announcement code/severity/identity matrix, skipped-entry outage visibility, and the credential cases — recording `CredentialPort` called exactly once with the declared reference, material handed to the transport once per request with no cache, `credential-missing` with zero fetch attempts and the `failureClass` evidence. **Refs**: F-5, F-6, F-7; §6. **ACs**: AC-F5-1..F5-6 (model halves), AC-F6-1, AC-F6-2, AC-F7-1 (seam half), AC-F7-2 (behavior half). **TCs**: TC-PROV-028..031, TC-PROV-033..035, TC-PROV-038 (port seam half), TC-PROV-039. **Verify**: `bun test tests/behaviour/provider-parks.test.ts tests/behaviour/provider-announcements.test.ts tests/behaviour/provider-credentials.test.ts`.

**Acceptance Criteria**:

- Must: quota math matches the legacy boundary contract with the two fail-loud divergences asserted (exhausted-without-reset classifies; no verdict is ever silently clear) (AC-F4-1..F4-6); every park carries a closed cause and an absolute future expiry with generation dedupe (AC-F5-1..F5-6); announcements are closed-vocabulary, allowlist-bounded, deterministic, and one-per-generation (AC-F6-1, AC-F6-2); the loop cap is counted in completed sleeps with no post-cap fetch (AC-F4-5).
- Should: the engine factory makes every ambient effect injectable so Phases 5–7 need no further seam changes (PD-G).

**Files and modules**:

- Code areas: new `packages/core/src/provider/{quota,parks,announcements,loop}.ts`, `tests/behaviour/{provider-quota-evaluation,provider-parks,provider-announcements,provider-credentials}.test.ts`, `tests/fixtures/provider/{quota,parks,announcements,evidence}/**`; updated `packages/core/src/provider/index.ts`, `tests/structure/inventory.json`, `tests/structure/content-inventory.test.ts` (any new `as const` values).
- System docs: none.

**Tests**:

- `pnpm build` then `bun test tests/behaviour/provider-quota-evaluation.test.ts tests/behaviour/provider-parks.test.ts tests/behaviour/provider-announcements.test.ts tests/behaviour/provider-credentials.test.ts`; `bun run scripts/checks/ambient-globals.ts`.

**Completion signal**: `feat(GH-182): add quota evaluation, parks, announcements, and loop policy`

### Phase 4: Quota transport adapter subpath and runtime confinement

**Goal**: Ship the one new I/O edge — the injectable quota transport as a declared `provider-quota` adapters subpath with its native-fetch production wrapper — behind exactly one reason-bearing runtime-API confinement admission, with negative fixtures, and with the secret-read boundary unchanged.

**Tasks**:

- [x] **4.1** Add `packages/adapters/src/provider-quota/index.ts` — the production quota transport implementing the Phase 1 `QuotaTransport` contract (PD-C): accepts an injectable fetch-like function (native `fetch` as the production default); issues one bounded `GET` with the configured timeout; follows no redirects with credentials; builds the authorization header in memory per request from the material handed to it once; returns the sanitized result (HTTP status plus body-text envelope); stores nothing — no module-level transport, credential, or response cache. This subpath is distinct from the GH-188 client-seed seam `packages/adapters/src/io/provider-transport.ts` (types-only, trap suites); do not merge the two seams. **Refs**: F-7; §8.4; PD-C. **ACs**: AC-F7-1 (transport half). **TCs**: TC-PROV-038 (transport half). **Verify**: `pnpm build`; `bun test tests/behaviour/provider-credentials.test.ts`.
- [x] **4.2** Register the subpath everywhere the exact-match pins require, in one commit (PD-D): `packages/adapters/package.json` gains the `./provider-quota` export and the `#provider-quota/*` imports alias; `provider-quota` joins `ADAPTER_SUBPATHS` in `scripts/checks/workspace-entrypoints.ts`, `tests/boundaries/harness.ts`, and `tests/structure/subpaths.test.ts`; all four consumer manifests (`packages/{cli,mcp,opencode,testkit}/package.json` `workspaceImports`) gain `@delivery-os/adapters: ./provider-quota` because `EXPECTED_ENTRYPOINTS` is exact JSON-equality per package. **Refs**: PD-D; plan code-reality facts. **ACs**: supports AC-F7-1. **TCs**: TC-PROV-006 (registration half). **Verify**: `pnpm build`; `bun run scripts/checks/workspace-entrypoints.ts`; `bun test tests/structure/subpaths.test.ts tests/boundaries`; `pnpm check:boundaries`.
- [x] **4.3** Add exactly one `runtime-apis-confinement` admission in `.dependency-cruiser.cjs`: the exact path `packages/adapters/src/provider-quota/**` with a reason comment citing ADR-0005's refined reading and GH-182; never widen to `adapters/**`; no other rule changes. **Refs**: F-7; ADR-0005; boundary-change discipline. **ACs**: AC-F1-4 (confinement half), AC-NFR-3 (boundary half). **TCs**: TC-PROV-006 (confinement half). **Verify**: `pnpm check:boundaries`; `bun test tests/boundaries/boundaries.test.ts`.
- [x] **4.4** Add the boundary fixtures: a clean control (a runtime-API import inside the declared subpath — the production fetch wrapper itself — cruises clean over `packages/adapters/src`) and negative fixtures for every neighboring path (`packages/core/src/provider/**`, `credentials`, `repo`, `file`, `host`, `session`, `legacy`) in `tests/boundaries/fixtures/cases.ts`, registered in `tests/boundaries/fixture-registry.json`; the fixture-coverage meta-check stays green. **Refs**: TC-PROV-006 steps 4–5. **ACs**: supports AC-NFR-3. **TCs**: TC-PROV-006 (fixture half). **Verify**: `bun test tests/boundaries`.
- [x] **4.5** Secret-read boundary, unchanged and proven: `SECRET_READ_ALLOWLIST` in `scripts/checks/secret-read-boundary.ts` gains **zero** entries; add planted ambient-read fixtures for `packages/core/src/provider/**` and `packages/adapters/src/provider-quota/**` under `tests/fixtures/secret-boundary/**` plus the matching `tests/checks/secret-read-boundary.test.ts` extensions (the `packages/cli/src/commands/provider.ts` planted fixture lands in Phase 6 when that file exists); `git status --porcelain` before/after confirms the live tree is untouched. **Refs**: F-7; NFR-4; plan code-reality facts. **ACs**: AC-F7-1 (boundary half), AC-F7-3 (half). **TCs**: TC-PROV-038 (boundary half), TC-PROV-040 (transport half). **Verify**: `bun run scripts/checks/secret-read-boundary.ts`; `bun test tests/checks/secret-read-boundary.test.ts`.
- [x] **4.6** Transport security cases in `tests/behaviour/provider-credentials.test.ts` (or a focused block of it): a recording fetch-like fake asserts the material is received once per request and never retained, the authorization header is built in memory, redirects are not followed with credentials, the timeout bound is enforced, and the sanitized result carries no raw header, credential, or endpoint userinfo; a second evaluation re-resolves the credential rather than caching. **Refs**: F-7; NFR-4. **ACs**: AC-F7-1..F7-4 (security halves). **TCs**: TC-PROV-038, TC-PROV-040 (transport halves). **Verify**: `bun test tests/behaviour/provider-credentials.test.ts`.

**Acceptance Criteria**:

- Must: exactly one new confinement admission, exact-path with reason, clean control plus failing negatives, fixture-coverage green (AC-NFR-3 boundary half, AC-F1-4 confinement half); the secret-read allowlist is byte-unchanged with planted reads detectable (AC-F7-1 boundary half).
- Should: the production wrapper is fully covered through the injectable fetch fake with no live network (AC-NFR-2 construction).

**Files and modules**:

- Code areas: new `packages/adapters/src/provider-quota/index.ts`, `tests/fixtures/secret-boundary/**` (provider entries); updated `packages/adapters/package.json`, `.dependency-cruiser.cjs`, `scripts/checks/workspace-entrypoints.ts`, `tests/boundaries/{harness.ts,fixtures/cases.ts,fixture-registry.json}`, `tests/structure/subpaths.test.ts`, `packages/{cli,mcp,opencode,testkit}/package.json` (workspaceImports), `tests/checks/secret-read-boundary.test.ts`, `tests/behaviour/provider-credentials.test.ts`, `tests/structure/inventory.json` (fixture-side entries as applicable).
- System docs: none.

**Tests**:

- `pnpm build` then `bun run scripts/checks/{workspace-entrypoints,secret-read-boundary}.ts`; `bun test tests/boundaries tests/structure/subpaths.test.ts tests/checks/secret-read-boundary.test.ts tests/behaviour/provider-credentials.test.ts`; `pnpm check:boundaries`.

**Completion signal**: `feat(GH-182): add provider-quota transport subpath with confined runtime admission`

### Phase 5: State integration — park and announcement persistence

**Goal**: Persist the engine's records through the delivered state layer — fenced appends of `provider.park` and `provider.announcement`, the PD-A projection read/write split for `provider-parks.json`, and the zero-write active/expired/cleared views — with no CLI dependency.

**Tasks**:

- [x] **5.1** Extend `packages/core/src/provider/parks.ts` with the ledger persistence helpers, mirroring the `packages/core/src/state/registry.ts` precedent: fenced `append` of `provider.park` records (EVT-1, payload schema `delivery.provider.park.v1`) and `provider.announcement` records (EVT-2, `delivery.provider.announcement.v1`) through the injected `StateStorePort`, plus verified reads; the wiring is CLI-independent core code consumed by the mutating resolve path. **Refs**: F-5, F-6; EVT-1, EVT-2; DM-10, DM-11. **ACs**: AC-F5-1 (round-trip half), AC-F6-1 (persistence half). **TCs**: TC-PROV-028 (round-trip half), TC-PROV-034 (persistence half). **Verify**: `bun test tests/behaviour/provider-parks.test.ts`.
- [x] **5.2** Implement the PD-A projection split: the physical `provider-parks.json` derived document is written **only** by a mutating `resolve` via fenced `replaceDocument` (bare file name, `document:<name>` intent record, atomic swap — mirroring `replacePhaseProjection`); every read path folds verified `provider.park` ledger truth in memory (latest record per park name wins); a missing or divergent document observed on read is served from the fold with **zero writes**; no rebuild CLI exists in v1. **Refs**: F-5; DM-12; PD-A; DEC-5. **ACs**: AC-F5-3 (projection half), AC-NFR-5. **TCs**: TC-PROV-030 (rebuild half), TC-PROV-032/033 (rebuild halves), TC-PROV-050 (rebuild-adds-no-records half). **Verify**: `bun test tests/behaviour/provider-parks.test.ts`.
- [x] **5.3** Implement the read-time views: active while `expiresAt > now` and inactive/expired at exactly `expiresAt <= now` with no expiry write or delete; `cleared` state from the appended clear record; ISO-8601 UTC expiry rendering by pure arithmetic (the TC-060 portability kin); deterministic ordering by expiry ascending then name lexical; subject-level filtering for the `--provider` view. **Refs**: F-5; DM-12; NFR-7. **ACs**: AC-F5-2, AC-F5-5 (view half). **TCs**: TC-PROV-029 (state half), TC-PROV-032 (view half). **Verify**: `bun test tests/behaviour/provider-parks.test.ts`.
- [x] **5.4** Implement dedupe/clear/resume persistence: an unchanged generation appends zero park and zero announcement records; a changed cause or expiry appends exactly one new record with the latest winning in the fold; an early clear appends one `cleared` record and the next mutating resolve that observes the clear (or expiry) emits exactly one `provider.resumed` informational announcement (EVT-4) — never duplicated; repeated `parks list` and repeated `quota` perform zero state writes. **Refs**: F-5, F-6; DM-10, DM-11, DM-12; DEC-12; NFR-6. **ACs**: AC-F5-3, AC-F6-1, AC-NFR-5. **TCs**: TC-PROV-030, TC-PROV-050. **Verify**: `bun test tests/behaviour/provider-parks.test.ts tests/behaviour/provider-announcements.test.ts`.
- [x] **5.5** Extend `tests/behaviour/provider-parks.test.ts` and `provider-announcements.test.ts` with the state integration cases on the delivered state test harness (fixture store): TC-PROV-028 ledger round-trip deep equality with schema `delivery.provider.park.v1`; TC-PROV-029 the T−1/T/T+1 matrix with the ledger unchanged; TC-PROV-030 the generation matrix plus torn/missing `provider-parks.json` rebuild-on-read with zero appends; TC-PROV-032 the list matrix (ordering, filters, throwing network guard, zero side effects); TC-PROV-033 cap-and-chain parks in the rebuilt projection; the core view half of TC-PROV-043; TC-PROV-050 append-count idempotence across repeated resolve/quota/list. **Refs**: F-5, F-6; NFR-6, NFR-7. **ACs**: AC-F5-1..F5-6, AC-F6-1, AC-NFR-5. **TCs**: TC-PROV-028..030, TC-PROV-032, TC-PROV-033, TC-PROV-043 (core half), TC-PROV-050. **Verify**: `bun test tests/behaviour/provider-parks.test.ts tests/behaviour/provider-announcements.test.ts tests/behaviour/provider-cli.test.ts` (once Phase 6 lands; until then the core halves).

**Acceptance Criteria**:

- Must: park and announcement records round-trip through the state layer unchanged with the declared kinds and schemas (AC-F5-1, AC-F6-1); the projection is written only by mutating resolve and rebuilt in memory from verified truth on read with zero writes (PD-A, AC-F5-3, AC-NFR-5); expiry is derived at read with no write (AC-F5-2, NFR-7).
- Should: the state helper set stays CLI-independent so the Phase 6 command layer adds no persistence logic.

**Files and modules**:

- Code areas: updated `packages/core/src/provider/parks.ts` (persist/fold/view helpers), `packages/core/src/provider/index.ts`, `tests/behaviour/{provider-parks,provider-announcements}.test.ts`, `tests/fixtures/provider/parks/**` (torn/missing projection variants, list matrix).
- System docs: none.

**Tests**:

- `pnpm build` then `bun test tests/behaviour/provider-parks.test.ts tests/behaviour/provider-announcements.test.ts`; `bun run scripts/checks/ambient-globals.ts`.

**Completion signal**: `feat(GH-182): persist provider parks and announcements through the state layer`

### Phase 6: CLI provider command and composition

**Goal**: Ship the minimal `provider` command surface — `resolve` (the only mutator), `quota` (non-mutating), `parks list` (read-only) — with CommandResult envelopes, human output, classified failures, and exit projection, composed at the CLI edge with production seams.

**Tasks**:

- [x] **6.1** Add `packages/cli/src/commands/provider.ts` — a pure, stream-free command module: `resolve [--chain <name>]` (the only mutating subcommand, DEC-11), `quota [--provider <name>]` (non-mutating diagnostic), and `parks list [--all] [--provider <name>]` (read-only projection view); all three accept `--json` and emit exactly one CommandResult envelope; human output prints the selected provider or the park's cause and resume time, with warnings on stderr; unknown `--chain`/`--provider`/subcommand values, missing values, and invalid booleans are classified input or provider-configuration failures with a valid envelope, never a crash; the exit projection stays CLI-only; no path sleeps or spawns (DEC-9). **Refs**: F-8; §6 flows; DEC-9, DEC-11. **ACs**: AC-F8-1..F8-4. **TCs**: TC-PROV-041, TC-PROV-042, TC-PROV-043 (CLI half), TC-PROV-044. **Verify**: `bun test tests/behaviour/provider-cli.test.ts`.
- [x] **6.2** Register the command: export the provider command definition from `packages/cli/src/commands/index.ts` and register it in the program's `commands` record at `packages/cli/src/index.ts`; extend the structure tests that pin the CLI surface (for example `tests/structure/cli-edge-seam.test.ts`) if they enumerate the command set. **Refs**: §16.1. **ACs**: supports AC-F8-1. **TCs**: supports TC-PROV-041..044. **Verify**: `bun test tests/structure`.
- [x] **6.3** Compose at the edge (`packages/cli/src/edge.ts`): wire the production clock, the credential port (`@delivery-os/adapters/credentials`), the quota transport (`@delivery-os/adapters/provider-quota`), and the state store into the provider command runtime; declare the core `./provider` import by adding it to the `EXPECTED_ENTRYPOINTS.cli` core list in `scripts/checks/workspace-entrypoints.ts` and to `packages/cli/package.json` `workspaceImports` in the same commit (PD-D). **Refs**: §12 assumptions; PD-D, PD-G. **ACs**: supports AC-F8-1..F8-4. **TCs**: supports TC-PROV-041..044. **Verify**: `pnpm build`; `bun run scripts/checks/workspace-entrypoints.ts`; `pnpm check:boundaries`.
- [x] **6.4** Create `tests/behaviour/provider-cli.test.ts` and `tests/fixtures/provider/cli/invalid-flags.ts`: envelope and exit-code matrix (resolve selected or parked → 0; `provider.chain.empty`/`provider.chain.invalid`/`provider.auth.rejected`/`config.credential.missing` → 1; `provider.outage`/`provider.quota.exceeded` → 2); `data.announcements` on `resolve --json` and successful `quota`; a failing `quota` carries the classified identity, the announcement code in the safe summary, and a safe stderr diagnostic; `quota` persists zero state; `parks list` performs no network call and no mutation; stdout/stderr are captured and compared separately; no secret or raw body on any surface. **Refs**: F-6, F-8; Appendix C. **ACs**: AC-F6-3, AC-F8-1..F8-4. **TCs**: TC-PROV-036, TC-PROV-041, TC-PROV-042, TC-PROV-043 (CLI half), TC-PROV-044. **Verify**: `bun test tests/behaviour/provider-cli.test.ts`.
- [x] **6.5** Add the CLI secret-read planted fixture deferred from Phase 4 (`packages/cli/src/commands/provider.ts` under `tests/fixtures/secret-boundary/**` plus the matching test extension); the allowlist stays unchanged and the check stays green. **Refs**: F-7; NFR-4. **ACs**: AC-F7-1 (CLI half). **TCs**: TC-PROV-038 (CLI half). **Verify**: `bun run scripts/checks/secret-read-boundary.ts`; `bun test tests/checks/secret-read-boundary.test.ts`.
- [x] **6.6** Classification follow-through: provider failures surfacing through the CLI carry their exact declared codes and project the documented exits; no-code, undeclared-code, and wrong-kind failures contain to `fallback.internal` end-to-end (extends the Phase 1 TC-PROV-046 pinning through the command path). **Refs**: F-9; NFR-8. **ACs**: AC-F9-2 (CLI half). **TCs**: TC-PROV-046 (CLI half). **Verify**: `bun test tests/behaviour/error-classification.test.ts tests/behaviour/provider-cli.test.ts tests/behaviour/exit-projection.test.ts`.

**Acceptance Criteria**:

- Must: three subcommands with the declared mutability contract, one valid envelope per `--json` run, classified invalid flags, and correct exit projection (AC-F8-1..F8-4); announcements visible on the declared surfaces with no silent-clear path (AC-F6-3).
- Should: the command module stays pure so the Phase 7 golden suites capture stable output without runner tricks.

**Files and modules**:

- Code areas: new `packages/cli/src/commands/provider.ts`, `tests/behaviour/provider-cli.test.ts`, `tests/fixtures/provider/cli/invalid-flags.ts`; updated `packages/cli/src/commands/index.ts`, `packages/cli/src/index.ts`, `packages/cli/src/edge.ts`, `packages/cli/package.json` (workspaceImports core `./provider`), `scripts/checks/workspace-entrypoints.ts` (EXPECTED_ENTRYPOINTS.cli), `tests/checks/secret-read-boundary.test.ts`, `tests/behaviour/error-classification.test.ts`, `tests/structure/inventory.json`.
- System docs: none.

**Tests**:

- `pnpm build` then `bun test tests/behaviour/provider-cli.test.ts tests/behaviour/error-classification.test.ts tests/behaviour/exit-projection.test.ts tests/structure`; `bun run scripts/checks/{workspace-entrypoints,secret-read-boundary}.ts`; `pnpm check:boundaries`.

**Completion signal**: `feat(GH-182): add provider CLI resolve, quota, and parks list`

### Phase 7: Ported legacy battery, golden outputs, hermetic and security checks

**Goal**: Close the verification ledger — all nine Appendix A groups and all 49 executed legacy checks ported with the fail-loud divergence asserted, the no-silent-path matrix, determinism/hermetic/evidence-bounds guards, golden outputs, and the evaluation-cost threshold.

**Tasks**:

- [x] **7.1** Create `tests/behaviour/provider-legacy-parity.test.ts` with the ported-battery harness: subcase selection by `TC-ZAI-*` ID over `tests/fixtures/provider/legacy/**` (`fail-open-matrix.ts`, `no-silent-paths.ts`, `group-a.json`, `group-b.ts`, `group-b-prime.ts`, `group-c-d.json`, `group-e.ts`, `group-f.ts`, `group-g.json`, `group-h.ts`); the legacy battery file `scripts/.tests/test-hook-zai-example.sh` is never executed as a live script; each subcase records the legacy warning class and the v1 expected code per test-plan §5.3. **Refs**: Appendix A; §5.3. **ACs**: supports AC-F4-6, AC-F6-4, AC-NFR-2. **TCs**: harness for TC-PROV-037, TC-PROV-052, TC-PROV-054..061. **Verify**: `bun test tests/behaviour/provider-legacy-parity.test.ts`.
- [x] **7.2** Port groups A/B/B' (legacy TC-ZAI-001..005, 010..020, 021..025 → TC-PROV-054/055/056): boundary-math parity (off-peak/in-peak/buffer/custom window; every failure class) with the fail-loud divergence asserted — exactly one matching warning per failure class, a park or classified error, zero silent clears, and the legacy "WARN + proceed" outcome never reproduced; a quota-disabled descriptor is silent by design with no fetch; an unresolvable declared credential is loud; peak still applies on opt-out. **Refs**: Appendix A rows 1–3; §5.3. **ACs**: AC-F4-6, AC-F6-4, AC-F7-2 (parity half). **TCs**: TC-PROV-054, TC-PROV-055, TC-PROV-056. **Verify**: `bun test tests/behaviour/provider-legacy-parity.test.ts`.
- [x] **7.3** Port groups C/D/E (legacy TC-ZAI-029..042, 045..046 → TC-PROV-057/058): quota math parity (no TOKENS_LIMIT/below threshold clear; 5h/weekly exhaustion; both exhausted soonest reset; TIME_LIMIT ignored; 100 boundary and over; past-reset clamp; mixed and non-exhausted resets; peak+quota MAX naming both conditions); the exhausted-without-valid-reset divergence to `provider.quota.exceeded` + `reset_missing`; disabled quota performs no fetch and writes no park; one fresh fetch per completed sleep with no file cache and append-only dedupe. **Refs**: Appendix A rows 4–5; §5.3. **ACs**: AC-F4-2, AC-F4-4, AC-F4-5 (parity half), AC-F4-6. **TCs**: TC-PROV-057, TC-PROV-058. **Verify**: `bun test tests/behaviour/provider-legacy-parity.test.ts`.
- [x] **7.4** Port groups F/G/H/I (legacy TC-ZAI-050..052, 055..056, 060..064, 070..071 → TC-PROV-059/060/061/062): the credential and raw-body canaries are unobservable on every path; the fail-open exit-0 path is removed for indeterminate quota (`resolve` parks, `quota` classifies); pure portable UTC formatting with no shell `date` dependency, byte-identical across host timezone/locale injections; cross-time quota→peak re-evaluation, sleep-then-clear, past-reset no-loop, and the completed-sleep cap (exactly N sleeps, no post-cap fetch, no extra iteration, never a silent proceed); the hermetic-by-construction half of group I (the guide half lands in Phase 8). **Refs**: Appendix A rows 6–9; §5.3. **ACs**: AC-F4-5, AC-F6-4, AC-F7-3 (parity half), AC-NFR-1 (UTC portability), AC-NFR-2 (half). **TCs**: TC-PROV-059, TC-PROV-060, TC-PROV-061, TC-PROV-062 (hermetic half). **Verify**: `bun test tests/behaviour/provider-legacy-parity.test.ts tests/behaviour/provider-credentials.test.ts`.
- [x] **7.5** Add the no-silent-path matrix and the fail-open replacement matrix (§5.4): drive every failure/condition class through `resolve` and `quota` with injected fakes; assert each class produces an announcement/park or a classified error, the matrix count equals the declared class count with every class named by an asserting TC, a temp class returning clear fails the matrix naming the class, and the legacy "WARN + proceed" outcome is not reproduced anywhere. **Refs**: F-6; §5.4; NFR-9. **ACs**: AC-F4-6, AC-F6-4. **TCs**: TC-PROV-037, TC-PROV-052. **Verify**: `bun test tests/behaviour/provider-legacy-parity.test.ts`.
- [x] **7.6** Determinism and hermetic guards: the 100-run replay (`tests/fixtures/provider/determinism/replay-case.json`) asserts byte-identical decisions, park payloads, and announcement identities, unchanged when only ambient values change and deterministically changed when one injected fact changes; create `tests/checks/provider-hermetic.test.ts` with the throwing `fetch` guard, the sleep spy, and assertions of zero live network calls, zero ambient credential reads, and zero real sleeps across the provider suites, with no real endpoint hostname referenced. **Refs**: NFR-1, NFR-2. **ACs**: AC-NFR-1, AC-NFR-2. **TCs**: TC-PROV-047, TC-PROV-048. **Verify**: `bun test tests/behaviour/provider-chain-resolution.test.ts tests/behaviour/provider-parks.test.ts tests/checks/provider-hermetic.test.ts`.
- [x] **7.7** Evidence bounds and canary completion: create `tests/checks/provider-evidence-bounds.test.ts` with `max-evidence.json` (exactly at the 1024-byte/20-field bound), `over-bound-evidence.json` (one byte/one field over), and `unknown-key-evidence.json` against the committed 8-field park and 11-field announcement allowlists, plus the announcement-list bound by evaluated-entry count; complete TC-PROV-040 by scanning every captured surface (envelope data, diagnostics, park records, announcement records, `provider-parks.json`) for the credential and raw-body canaries in raw and JSON-escaped forms, with a temp-copy leak mutation failing the scan. **Refs**: NFR-5, NFR-4; DM-10, DM-11. **ACs**: AC-NFR-4, AC-F7-3 (completion). **TCs**: TC-PROV-049, TC-PROV-040 (completion). **Verify**: `bun test tests/checks/provider-evidence-bounds.test.ts tests/behaviour/provider-credentials.test.ts`.
- [x] **7.8** Golden outputs: create `tests/golden/provider-resolve.test.ts`, `provider-quota.test.ts`, `provider-parks-list.test.ts`, and `provider-announcement-surfaces.test.ts` over `tests/fixtures/provider/golden/**` (machine JSON and human `.txt` for selected, parked, outage/skipped, quota success/failure, parks list active/`--all`); volatile values normalized, stdout/stderr compared separately, regeneration only by an explicit script — never a blanket snapshot update. **Refs**: F-6, F-8; §7.2 golden notes. **ACs**: AC-F6-3, AC-F8-1, AC-F8-2, AC-F8-3 (golden halves). **TCs**: TC-PROV-053; TC-PROV-036/041/042/043 (golden halves). **Verify**: `bun test tests/golden`.
- [x] **7.9** Evaluation cost: add `tests/fixtures/provider/performance/100-entries.json` and the TC-PROV-051 case — a warmed pure evaluation of 100 provider entries completes in ≤ 50 ms on the reference environment, excluding transport time and fixture parsing (parsing outside the timed region), taking a stable median plus bounded max and recording the runner/environment in test-plan §10 when executed. **Refs**: NFR-10. **ACs**: AC-NFR-6. **TCs**: TC-PROV-051. **Verify**: `bun test tests/behaviour/provider-quota-evaluation.test.ts`.

**Acceptance Criteria**:

- Must: 9/9 Appendix A groups and 49/49 executed legacy IDs ported with every fail-open class asserting an announcement or classified error and zero silent clears (AC-F4-6, AC-F6-4, NFR-9); determinism, hermeticity, evidence bounds, goldens, and the cost threshold all green (AC-NFR-1, AC-NFR-2, AC-NFR-4, AC-NFR-6).
- Should: every parity subcase is selectable and assertable by legacy ID so later battery additions cannot silently drop a case.

**Files and modules**:

- Code areas: new `tests/behaviour/provider-legacy-parity.test.ts`, `tests/checks/{provider-hermetic,provider-evidence-bounds}.test.ts`, `tests/golden/provider-{resolve,quota,parks-list,announcement-surfaces}.test.ts`, `tests/fixtures/provider/{legacy,golden,performance,determinism}/**`, `tests/fixtures/provider/evidence/{max-evidence,over-bound-evidence,unknown-key-evidence}.json`; updated `tests/behaviour/{provider-chain-resolution,provider-parks,provider-credentials}.test.ts` (replay and canary cases), `tests/fixtures/provider/security/canary.ts`.
- System docs: none.

**Tests**:

- `pnpm build` then `bun test tests/behaviour/provider-legacy-parity.test.ts tests/checks/provider-hermetic.test.ts tests/checks/provider-evidence-bounds.test.ts tests/golden`; the full-suite hermetic guards run under the aggregate in Phase 9.

**Completion signal**: `test(GH-182): add legacy parity battery, goldens, hermetic and evidence checks`

### Phase 8: In-change documentation floor

**Goal**: Ship only the documentation this change owes inside its own scope — the provider condition/park guide that TC-PROV-062 pins — without duplicating the lifecycle documentation-sync phase.

**Tasks**:

- [x] **8.1** Author `doc/guides/provider-conditions-and-parks.md`: the provider condition/park contract — condition kinds, park causes, resume/expiry semantics, the fail-loud rule replacing legacy fail-open (RSK-1), the announcement vocabulary, and the operator-facing configuration pointer to the spec's Appendix B field contract (the only configuration example/reference this change ships; Appendix B itself remains spec-owned); declare `ados_distribution: redistributable` inside the guide's single front-matter block; the license header is applied only by `scripts/add-header-location.sh doc/guides`, never by hand. **Refs**: F-5, F-6; §8.2/§8.3; Appendix A/B; AGENTS.md distribution rules. **ACs**: supports AC-NFR-2. **TCs**: TC-PROV-062 (guide half). **Verify**: `bash scripts/.tests/test-doc-distribution.sh`.
- [x] **8.2** Wire the guide contract assertions into `tests/checks/provider-hermetic.test.ts` (TC-PROV-062 steps 2–4): the guide documents condition kinds, park causes, resume/expiry, and the fail-loud rule — not the legacy hook contract; it contains no secret, live endpoint credential, or product hardcode; a temp-copy removal of the condition/park section fails the check. **Refs**: Appendix A row 9. **ACs**: supports AC-NFR-2, NFR-9. **TCs**: TC-PROV-062 (assertion half). **Verify**: `bun test tests/checks/provider-hermetic.test.ts`.
- [x] **8.3** Respect the documentation boundary: no other system documentation is touched — the provider-engine feature spec, the config-layer/state-layer spec updates, the command-registry row, glossary terms, and ADR editorial pointers remain owned by the lifecycle `system_spec_update` phase (`@doc-syncer`) per this plan's Out of Scope; `git status --porcelain` confirms the guide and the hermetic test are the only doc-side changes. **Refs**: plan Out of Scope; spec §16 Documentation row. **ACs**: none (boundary control). **TCs**: supports TC-PROV-062. **Verify**: `git status --porcelain`; `git diff --check`.

**Acceptance Criteria**:

- Must: the guide exists, declares `ados_distribution`, passes the doc-distribution guard, and satisfies the TC-PROV-062 guide contract (AC-NFR-2 evidence home).
- Should: the guide's configuration section references the spec's Appendix B verbatim-by-link rather than duplicating the field table.

**Files and modules**:

- Code areas: updated `tests/checks/provider-hermetic.test.ts`.
- System docs: new `doc/guides/provider-conditions-and-parks.md` (the only doc created outside Phase 1's error-table sync).

**Tests**:

- `bash scripts/.tests/test-doc-distribution.sh`; `bun test tests/checks/provider-hermetic.test.ts`; `git diff --check`.

**Completion signal**: `docs(GH-182): add provider conditions and parks guide`

### Phase 9: Aggregate verification and remediation gate

**Goal**: Prove the whole on one tree — every gate green in CI order — with fix-forward rules that route failures back to their owning phase, and record honest execution evidence.

**Tasks**:

- [x] **9.1** Run the full battery in CI order: `pnpm install --frozen-lockfile` (fast path, lockfile unchanged), `pnpm build`, `pnpm check` (lint → format:check → typecheck → test → check:boundaries), `pnpm check:boundaries`, `bun run scripts/checks/{ambient-globals,secret-read-boundary,error-table-sync,workspace-entrypoints}.ts`, `bash scripts/.tests/test-doc-distribution.sh` (Phase 8 ships a redistributable doc), and `git diff --check`. **Refs**: testing-strategy gates; test plan §7.2 gate handoff. **ACs**: all, aggregate. **TCs**: aggregate over TC-PROV-001..062. **Verify**: all commands exit 0.
- [x] **9.2** Apply the fix-forward rules on any failure: route the failure back to the owning phase's area and fix it at the source — never loosen a check, never split a synchronized pair (machine error row ↔ documented row; confinement entry ↔ boundary fixtures; subpath export ↔ registration lists; closed-set constants ↔ inventory fixture), never leave a red intermediate error-table state; re-run the full battery after each fix; targeted suites alone are never an end state. **Refs**: plan Constraints. **ACs**: protects all. **TCs**: protects all. **Verify**: re-run of 9.1 clean.
- [x] **9.3** Record execution evidence: populate the test plan §10 execution log (TC/gate, run date UTC, result, command, HEAD) — never recording unrun evidence as passing — and this plan's Execution Log below. **Refs**: test plan §7.2/§7.3. **ACs**: supports §7.3 completion accounting. **TCs**: all executed TCs. **Verify**: §10 rows present for every executed gate.
- [x] **9.4** Run the cross-phase consistency sweep: `tests/structure/inventory.json` and `EXECUTABLE_ALLOWANCES` cover every new `packages/**` file; the four synchronized pairs are intact; `scripts/hooks/pre-opencode-iteration-zai.sh` and `scripts/.tests/test-hook-zai-example.sh` are byte-unchanged; `SECRET_READ_ALLOWLIST` and the confinement allowlist are unchanged in content and count beyond the one declared admission; no fixture is named `*.test.ts`. **Refs**: plan Constraints; NG-7. **ACs**: supports AC-F1-4, AC-F7-1. **TCs**: supports TC-PROV-006, TC-PROV-038. **Verify**: `bun test tests/structure tests/checks tests/boundaries`.

**Acceptance Criteria**:

- Must: `pnpm check` and every named check green on one tree; evidence recorded without unrun claims.
- Should: zero fix-forward iterations (any iteration is documented against its owning phase).

**Files and modules**:

- Code areas: none (remediation only, if triggered).
- System docs: none (beyond execution-log entries in the change artifacts).

**Tests**:

- The 9.1 battery is the phase's test.

**Completion signal**: `chore(GH-182): verify aggregate gates and record execution evidence`

### Phase 10: Delivery review remediation (conditional)

**Goal**: Absorb `@reviewer` findings, if any, without scope creep, and return the tree to a fully green, re-reviewed state.

**Tasks**:

- [ ] **10.1** Trigger condition — execute this phase only if the lifecycle delivery review (phase 8, `@reviewer`) returns FAIL: classify every finding against the spec, this plan, and the repo rules; accepted findings become remediation tasks mapped to the owning phase; disputed findings are answered with evidence in the review thread, never silently dropped. **Refs**: delivery lifecycle. **ACs**: protects all. **TCs**: protects all. **Verify**: remediation task list recorded in the Execution Log.
- [ ] **10.2** Apply the accepted remediation through `@coder`/`@fixer` with the targeted suites plus the phase-appropriate commit(s) (`fix(GH-182): ...` via `@committer`); no changes beyond the accepted findings; synchronized pairs move together. **Refs**: plan Constraints. **ACs**: per finding. **TCs**: per finding. **Verify**: targeted suites named by the finding's area.
- [ ] **10.3** Re-run the Phase 9 battery and the review; repeat until the review passes; record each loop in the Execution Log. Skip this phase entirely when the review passes on first run. **Refs**: delivery lifecycle. **ACs**: protects all. **TCs**: protects all. **Verify**: review PASS + Phase 9 battery green.

**Acceptance Criteria**:

- Must: (when triggered) every accepted finding fixed, verified, and re-reviewed to PASS; no scope creep.
- Should: zero findings requiring a second remediation loop.

**Files and modules**:

- Code areas: whichever the accepted findings name (remediation only).
- System docs: none beyond findings that name Phase 1/Phase 8 artifacts.

**Tests**:

- The Phase 9 battery plus the review verdict.

**Completion signal** (used only if the phase runs): `fix(GH-182): apply delivery review remediation`

### Phase 11: PR readiness and documentation handoff

**Goal**: Finalize — verify full traceability against the spec, the test plan, and the ticket; reconcile in-change documentation and hand the rest to the lifecycle; leave an unmerged PR against `main-tools`.

**Tasks**:

- [x] **11.1** Traceability verification: 46/46 ACs, 62/62 TCs, 9/9 Appendix A groups, and 49/49 executed legacy IDs have passing recorded evidence (test-plan §10 and §7.3 completion accounting); every plan task above is checked; no orphan TC or unowned AC remains. **Refs**: spec §17; test plan §7.3. **ACs**: all. **TCs**: all. **Verify**: ledger cross-check against §10 rows.
- [ ] **11.2** Owner-policy gate (spec OQ-2/OQ-3, carried from this plan's Open questions): confirm the fail-closed posture (`allowPaidFallback: false`; shipped Z.AI descriptor with no enabled chain) with the owner **before merging the configuration surface**; if the owner disputes either default, author the decision record through `@decision-advisor` (spec §14.1 DC-4/DC-5) before merge. Non-blocking for delivery; blocking for merge. Decision needed: consult `@decision-advisor`. **Refs**: spec §14/§14.1/§18; OQ-2, OQ-3. **ACs**: protects AC-F1-5, AC-F2-4 posture. **TCs**: none (policy gate). **Verify**: owner confirmation or decision record linked in the PR description.
- [ ] **11.3** Spec reconciliation: the in-change synchronization is complete (the Phase 1 error-table rows in `doc/spec/features/feature-result-contract.md` and the Phase 8 guide); hand the remaining system documentation to the lifecycle `system_spec_update` phase (`@doc-syncer`): the provider-engine feature spec, `provider` keys in the config-layer spec, the park/announcement vocabulary in the state-layer spec, the provider command row in the registry, and the glossary terms (spec §16 Documentation row). **Refs**: spec §16/§18; plan Out of Scope. **ACs**: supports DoD "documentation is synchronized". **TCs**: supports TC-PROV-045/062 doc halves. **Verify**: handoff recorded; `@doc-syncer` output reviewed in the lifecycle phase.
- [ ] **11.4** Version bump per repo conventions: none in-change — all workspace packages are private `0.0.0` under the lockstep release convention and this change adds no dependency, so no version or changeset action belongs in this PR; the spec's `version_impact: minor` is realized by the release flow, not by this change. **Refs**: repo conventions; spec front matter. **ACs**: none (release policy). **TCs**: none. **Verify**: no version fields or lockfile versions touched in the diff.
- [ ] **11.5** Hand off to the remaining lifecycle phases: `@reviewer` (phase 8, if not already passed), `@runner` quality gates (phase 9), `@pm` DoD check (phase 10), and `@pr-manager` (phase 11) — PR base `main-tools`, all required `ts-*` CI jobs green on the pushed HEAD (not an earlier SHA), PR assigned to the human owner, ticket enriched via MCP; **stop — do not merge** (spec §18 DoD requires an unmerged PR, and task 11.2's owner-policy check precedes any merge). **Refs**: spec §18; AGENTS.md lifecycle. **ACs**: DoD aggregate. **TCs**: aggregate. **Verify**: PR open, unmerged, CI green on HEAD.

**Acceptance Criteria**:

- Must: full ledger traceability with recorded evidence; the owner-policy gate resolved or explicitly blocking merge; documentation handoff recorded; an unmerged PR against `main-tools` with green CI on the pushed HEAD.
- Should: the PR description carries the AC/TC/legacy coverage summary and the intentional fail-loud divergence note for reviewers.

**Files and modules**:

- Code areas: none.
- System docs: none edited in-change (handoff only; the lifecycle `system_spec_update` phase owns the remainder).

**Tests**:

- The Phase 9 battery remains green on the pushed HEAD; CI jobs green on that SHA.

**Completion signal**: `chore(GH-182): finalize traceability and PR readiness handoff`

### Phase Sequence and Commit Plan

Strict order; each phase ends green and lands as exactly one Conventional Commit (scope `GH-182`, bodies within the 100-character limit) via `@committer`. `pnpm build` precedes dist-dependent suites and `pnpm check:boundaries`. Synchronized pairs never split across commits. Phase 10 runs only on a FAIL review verdict.

| Phase | Title | Depends on | Commit subject |
|-------|-------|------------|----------------|
| 1 | Provider contracts, error rows, and the provider config branch | baseline | `feat(GH-182): add provider contracts, exact-code error rows, and provider config branch` |
| 2 | Pure provider validation and peak/chain/condition policy | 1 | `feat(GH-182): add pure provider validation, peak, conditions, and chain policy` |
| 3 | Quota evaluation, parks, announcements, and loop policy | 2 | `feat(GH-182): add quota evaluation, parks, announcements, and loop policy` |
| 4 | Quota transport adapter subpath and runtime confinement | 3 | `feat(GH-182): add provider-quota transport subpath with confined runtime admission` |
| 5 | State integration — park and announcement persistence | 4 | `feat(GH-182): persist provider parks and announcements through the state layer` |
| 6 | CLI provider command and composition | 5 | `feat(GH-182): add provider CLI resolve, quota, and parks list` |
| 7 | Ported legacy battery, golden outputs, hermetic and security checks | 6 | `test(GH-182): add legacy parity battery, goldens, hermetic and evidence checks` |
| 8 | In-change documentation floor | 7 | `docs(GH-182): add provider conditions and parks guide` |
| 9 | Aggregate verification and remediation gate | 8 | `chore(GH-182): verify aggregate gates and record execution evidence` |
| 10 | Delivery review remediation (conditional) | 9, FAIL verdict only | `fix(GH-182): apply delivery review remediation` |
| 11 | PR readiness and documentation handoff | 10 if run, else 9 | `chore(GH-182): finalize traceability and PR readiness handoff` |

## Coverage Ledger

Every acceptance criterion, every Appendix A group with all 49 executed legacy IDs, and every TC is mapped to a phase and a test home. Shared ACs/TCs name each half's phase. This ledger adds no requirement; it reconciles spec §17, test-plan §3.1/§5.3/§7.1, and the phases above.

### Acceptance-criterion ledger (46/46)

| AC | Phase(s) | Primary evidence (TCs) |
|----|----------|------------------------|
| AC-F1-1 | 1, 2 | TC-PROV-001, TC-PROV-002 |
| AC-F1-2 | 2, 6 | TC-PROV-005 |
| AC-F1-3 | 2 | TC-PROV-004 |
| AC-F1-4 | 2, 4 | TC-PROV-006 |
| AC-F1-5 | 1 | TC-PROV-002, TC-PROV-003 |
| AC-F2-1 | 2 | TC-PROV-007 |
| AC-F2-2 | 2 | TC-PROV-004, TC-PROV-008 |
| AC-F2-3 | 2, 3 | TC-PROV-009 |
| AC-F2-4 | 2 | TC-PROV-010 |
| AC-F2-5 | 2 | TC-PROV-010 |
| AC-F3-1 | 2, 7 | TC-PROV-011, TC-PROV-054 |
| AC-F3-2 | 2, 7 | TC-PROV-012, TC-PROV-054 |
| AC-F3-3 | 1, 2 | TC-PROV-002 |
| AC-F3-4 | 2, 3 | TC-PROV-013 |
| AC-F4-1 | 3 | TC-PROV-014 |
| AC-F4-2 | 3, 7 | TC-PROV-015..020, TC-PROV-057 |
| AC-F4-3 | 3 | TC-PROV-021 |
| AC-F4-4 | 3, 7 | TC-PROV-022, TC-PROV-057 |
| AC-F4-5 | 3, 7 | TC-PROV-023, TC-PROV-058, TC-PROV-061 |
| AC-F4-6 | 3, 7 | TC-PROV-024..027, TC-PROV-037, TC-PROV-052, TC-PROV-055..057, TC-PROV-059, TC-PROV-061 |
| AC-F5-1 | 1, 3, 5 | TC-PROV-001, TC-PROV-028 |
| AC-F5-2 | 3, 5 | TC-PROV-029 |
| AC-F5-3 | 3, 5 | TC-PROV-030 |
| AC-F5-4 | 3 | TC-PROV-031 |
| AC-F5-5 | 5, 6 | TC-PROV-032, TC-PROV-043 |
| AC-F5-6 | 3 | TC-PROV-009, TC-PROV-033 |
| AC-F6-1 | 3, 5 | TC-PROV-034 |
| AC-F6-2 | 3 | TC-PROV-035 |
| AC-F6-3 | 6, 7 | TC-PROV-036, TC-PROV-041..043, TC-PROV-053 |
| AC-F6-4 | 3, 7 | TC-PROV-037, TC-PROV-052, TC-PROV-055..057, TC-PROV-059, TC-PROV-061 |
| AC-F7-1 | 3, 4, 6 | TC-PROV-038 |
| AC-F7-2 | 3, 4, 7 | TC-PROV-039, TC-PROV-056 |
| AC-F7-3 | 4, 7 | TC-PROV-040, TC-PROV-059 |
| AC-F7-4 | 3, 4, 6 | TC-PROV-024..026 |
| AC-F8-1 | 6, 7 | TC-PROV-041, TC-PROV-053 |
| AC-F8-2 | 6, 7 | TC-PROV-042, TC-PROV-053 |
| AC-F8-3 | 5, 6, 7 | TC-PROV-043, TC-PROV-053 |
| AC-F8-4 | 6 | TC-PROV-044 |
| AC-F9-1 | 1 | TC-PROV-001, TC-PROV-045 |
| AC-F9-2 | 1, 6 | TC-PROV-046 |
| AC-NFR-1 (NFR-1) | 2, 3, 7 | TC-PROV-047, TC-PROV-060 |
| AC-NFR-2 (NFR-2) | 7 (constructed 2–6) | TC-PROV-048, TC-PROV-062 |
| AC-NFR-3 (NFR-3/4) | 2, 4 | TC-PROV-006 |
| AC-NFR-4 (NFR-5) | 1, 3, 7 | TC-PROV-040, TC-PROV-049 |
| AC-NFR-5 (NFR-6) | 3, 5 | TC-PROV-050 |
| AC-NFR-6 (NFR-10) | 7 | TC-PROV-051 |

Accounting: 46/46 ACs mapped (40 functional + 6 NFR ACs); NFR-7/NFR-8/NFR-9 trace through AC-F5-6, AC-F9-1/2, and AC-F4-6/AC-F6-4 exactly as the test plan §3.1 records.

### Appendix A legacy-parity ledger (9/9 groups, 49/49 executed IDs)

| Group | Legacy IDs (count) | Phase | Ported case |
|-------|--------------------|-------|-------------|
| A — model gating, off-peak, in-peak, buffer, custom window | TC-ZAI-001, 002, 003, 004, 005 (5) | 7 | TC-PROV-054 |
| B — transport, 401, 403, non-200, malformed JSON, invalid envelope, absent limits, non-numeric percentage, mixed failures | TC-ZAI-010, 011, 012, 013, 014, 015, 016, 017, 018, 019, 020 (11) | 7 | TC-PROV-055 |
| B' — key unset, opt-out, missing tools, opt-out with peak | TC-ZAI-021, 022, 023, 024, 025 (5) | 7 | TC-PROV-056 |
| C/D — quota math, thresholds, resets, MAX | TC-ZAI-029, 030, 031, 032, 033, 034, 035, 036, 037, 038, 039, 040, 041, 042 (14) | 7 | TC-PROV-057 |
| E — disabled, no file cache | TC-ZAI-045, 046 (2) | 7 | TC-PROV-058 |
| F — secret/body never logged, fail-open exit 0 | TC-ZAI-050, 051, 052 (3) | 7 | TC-PROV-059 |
| G — UTC formatting, no platform date | TC-ZAI-055, 056 (2) | 7 | TC-PROV-060 |
| H — cross-time re-eval, sleep-then-clear, past-reset, cap, fresh fetch | TC-ZAI-060, 061, 062, 063, 064 (5) | 7 | TC-PROV-061 |
| I — hermetic, guide contract | TC-ZAI-070, 071 (2) | 7 (hermetic), 8 (guide) | TC-PROV-062 |

Count check: 5 + 11 + 5 + 14 + 2 + 3 + 2 + 5 + 2 = 49 executed checks (the nominal 001..071 range has gaps; test-plan §5.3 is the per-ID authority).

### Test-case ledger (62/62)

| TC(s) | Phase(s) | Test home |
|-------|----------|-----------|
| TC-PROV-001 | 1 | `tests/structure/provider-contract.test.ts` + `tests/fixtures/provider/contract-inventory.json` |
| TC-PROV-002 | 1 (schema), 2 (semantic) | `tests/behaviour/config-{schema,resolver,restrictions}.test.ts`; `provider-chain-resolution` + `provider-peak-window` |
| TC-PROV-003 | 1 | `tests/behaviour/provider-chain-resolution.test.ts` + `config-provenance.test.ts` |
| TC-PROV-004, TC-PROV-005 | 2 (6: exit projection) | `tests/behaviour/provider-chain-resolution.test.ts`; `provider-cli.test.ts` |
| TC-PROV-006 | 2 (AST), 4 (confinement) | `tests/structure/provider-contract.test.ts`; `tests/boundaries/**`; `ambient-globals.ts`; `.dependency-cruiser.cjs` |
| TC-PROV-007, TC-PROV-008, TC-PROV-010 | 2 | `tests/behaviour/provider-chain-resolution.test.ts` |
| TC-PROV-009 | 2 (decision), 3 (park/announcement) | `provider-chain-resolution` + `provider-parks.test.ts` |
| TC-PROV-011, TC-PROV-012 | 2 | `tests/behaviour/provider-peak-window.test.ts` |
| TC-PROV-013 | 2 (MAX combinator), 3 (quota) | `provider-peak-window` + `provider-quota-evaluation.test.ts` |
| TC-PROV-014..027 | 3 | `tests/behaviour/provider-quota-evaluation.test.ts` (024/025 also `provider-announcements`/`provider-credentials`; 022 also `provider-cli`) |
| TC-PROV-028, TC-PROV-029, TC-PROV-030, TC-PROV-033 | 3 (model), 5 (state) | `provider-parks` + `provider-announcements.test.ts` |
| TC-PROV-031 | 3 | `tests/structure/provider-contract.test.ts` + `provider-parks.test.ts` |
| TC-PROV-032 | 5 (view), 6 (CLI) | `provider-parks` + `provider-cli.test.ts` |
| TC-PROV-034, TC-PROV-035 | 3 | `provider-announcements.test.ts` (+ `provider-chain-resolution` for 035) |
| TC-PROV-036 | 6 (7: golden) | `provider-cli.test.ts` + `tests/golden/provider-announcement-surfaces.test.ts` |
| TC-PROV-037 | 7 | `tests/behaviour/provider-legacy-parity.test.ts` |
| TC-PROV-038 | 3 (seam), 4 (boundary/transport), 6 (CLI fixture) | `provider-credentials.test.ts` + `tests/checks/secret-read-boundary.test.ts` |
| TC-PROV-039 | 3 | `tests/behaviour/provider-credentials.test.ts` |
| TC-PROV-040 | 4 (transport), 7 (full scan) | `provider-credentials.test.ts` + `tests/fixtures/provider/evidence/**` |
| TC-PROV-041, TC-PROV-042, TC-PROV-044 | 6 (7: golden for 041/042) | `provider-cli.test.ts` + `tests/golden/provider-{resolve,quota}.test.ts` |
| TC-PROV-043 | 5 (view), 6 (CLI), 7 (golden) | `provider-parks` + `provider-cli` + `tests/golden/provider-parks-list.test.ts` |
| TC-PROV-045 | 1 | `tests/checks/error-table-sync.test.ts` + `tests/structure/error-table.test.ts` |
| TC-PROV-046 | 1 (6: CLI half) | `tests/behaviour/error-classification.test.ts` + `provider-cli.test.ts` |
| TC-PROV-047 | 7 (seeded 2) | `provider-chain-resolution` + `provider-parks.test.ts` + `tests/fixtures/provider/determinism/` |
| TC-PROV-048 | 7 | `tests/checks/provider-hermetic.test.ts` |
| TC-PROV-049 | 7 | `tests/checks/provider-evidence-bounds.test.ts` |
| TC-PROV-050 | 5 | `provider-parks` + `provider-cli.test.ts` |
| TC-PROV-051 | 7 | `provider-quota-evaluation.test.ts` + `tests/fixtures/provider/performance/100-entries.json` |
| TC-PROV-052 | 7 | `tests/behaviour/provider-legacy-parity.test.ts` |
| TC-PROV-053 | 7 | `tests/golden/provider-{resolve,quota,parks-list}.test.ts` |
| TC-PROV-054..061 | 7 | `tests/behaviour/provider-legacy-parity.test.ts` (059 also `provider-credentials`) |
| TC-PROV-062 | 7 (hermetic), 8 (guide) | `tests/checks/provider-hermetic.test.ts` + `doc/guides/provider-conditions-and-parks.md` |

Count check: 62 distinct TCs (40 functional-AC owners + 6 NFR-AC owners + 16 parity/regression/golden rows sharing owners per §3.1); no TC is unmapped and no AC is left without evidence.

## Definition of Done

Tied to spec §18's Definition of Done predicates, Appendix D's ticket acceptance criteria, and test-plan §7.3:

- [ ] All 46 acceptance criteria have passing, traceable evidence recorded in test-plan §10; no unrun evidence is recorded as passing; no AC is TODO.
- [ ] Ticket AC — a park reports its cause and expiry: 100% of parks carry a closed cause and an absolute future expiry, round-trip through state, expire exactly at `expiresAt` with no write, and stay distinct from blocked lanes (AC-F5-1..F5-6, AC-F2-3).
- [ ] Ticket AC — provider outage is announced, not silent: every legacy fail-open class asserts an announcement plus a park or classified error; the §5.4 no-silent-path matrix has zero clear outcomes; skipped-entry outages stay visible (AC-F4-6, AC-F6-1..F6-4, AC-F7-4).
- [ ] Ticket AC — subscription-first quota ordering: validation rejects paid-before-subscription with no resolution attempt; subscription selection precedes paid; a peak-window park never substitutes paid capacity (AC-F1-3, AC-F2-2, AC-F2-4, AC-F2-5).
- [ ] Ticket AC — credentials resolve only through the M0-S12 port: zero ambient credential reads in provider core, CLI, and transport; the secret-read boundary is green with zero new allowlist entries; canaries unobservable (AC-F7-1..F7-3, AC-NFR-3).
- [ ] Ticket AC — the legacy battery is ported: 9/9 Appendix A groups and 49/49 executed `TC-ZAI-*` checks mapped, with boundary-math parity and the fail-loud divergence asserted (NFR-9).
- [ ] Ticket AC — deterministic, hermetic tests: 100-run byte-identical replay; zero live network calls, zero live credentials, zero real sleeps (AC-NFR-1, AC-NFR-2, AC-NFR-5).
- [ ] Deterministic hermetic guards: throwing-fetch guard, sleep spy, and injected clock/credential/transport/state seams hold across the provider suites.
- [ ] Error-table synchronization is green in both directions with `provider.quota.exceeded` unchanged; provider classification is exact-code and total with `fallback.internal` containment (AC-F9-1, AC-F9-2, NFR-8).
- [ ] Aggregate green: `pnpm check`, `pnpm check:boundaries`, the static checks, the doc-distribution guard (Phase 8 ships a redistributable doc), and `git diff --check` all pass on one tree.
- [ ] Documentation synchronized: the Phase 1 error-table rows and the Phase 8 guide are complete in-change; the lifecycle `system_spec_update` handoff (feature spec, config/state-layer specs, registry row, glossary) is recorded and owned by `@doc-syncer`.
- [ ] Version bump per repo conventions: none in-change — private `0.0.0` lockstep packages; `version_impact: minor` is realized by the release flow.
- [ ] The legacy bash hook and its battery are byte-unchanged; no edits to `scripts/*.sh`, `tools/`, `.opencode/`, `.ados-claude/`, or CI workflows.
- [ ] An unmerged pull request targets `main-tools` with all required CI jobs green on the pushed HEAD, assigned to the human owner.
- [ ] The owner-policy check for spec OQ-2/OQ-3 (paid-fallback default; shipped chain posture) is complete before any merge of the configuration surface (task 11.2).

**Remaining blockers**: none. Delivery can start at Phase 1 immediately. The only pre-merge (not pre-delivery) gate is the OQ-2/OQ-3 owner-policy confirmation carried as task 11.2; until resolved, the fail-closed defaults (DEC-3/DEC-4) govern.

## Test Scenarios

All 62 scenarios are specified in test-plan §5.2 with their ACs, levels, fixtures, and steps; the Coverage Ledger above maps every TC to its phase and test home. Per-level execution map:

| Level | Suites | Extended by phases | Primary verify command |
|-------|--------|--------------------|------------------------|
| Structure / contract inventory | `tests/structure/provider-contract.test.ts`, `error-table.test.ts`, `content-inventory.test.ts`, `subpaths.test.ts` | 1, 2, 4, 6 | `bun test tests/structure` |
| Behaviour (engine + CLI) | `tests/behaviour/provider-{chain-resolution,peak-window,quota-evaluation,parks,announcements,credentials,cli}.test.ts` | 1, 2, 3, 5, 6, 7 | `bun test tests/behaviour` |
| Golden output | `tests/golden/provider-*.test.ts` | 7 | `bun test tests/golden` |
| Legacy parity | `tests/behaviour/provider-legacy-parity.test.ts` | 7 | `bun test tests/behaviour/provider-legacy-parity.test.ts` |
| Checks / security | `tests/checks/provider-{hermetic,evidence-bounds}.test.ts`, `secret-read-boundary.test.ts`, `error-table-sync.test.ts` | 1, 4, 7, 8 | `bun test tests/checks` |
| Boundaries | `tests/boundaries/**` | 4 | `bun test tests/boundaries`; `pnpm check:boundaries` |
| Aggregate | whole workspace | 9, 10, 11 | `pnpm check` |

## Artifacts and Links

| Artifact | Location | Type |
|----------|----------|------|
| Change specification (v1.2) | `./chg-GH-182-spec.md` | Input — source of truth |
| Test plan (v1.1) | `./chg-GH-182-test-plan.md` | Input — TC/AC/legacy authority |
| This implementation plan | `./chg-GH-182-plan.md` | Output |
| Provider contracts and error rows | `packages/core/src/contracts/{provider,error-table}.ts`, `doc/spec/features/feature-result-contract.md` | Code + synchronized system doc |
| Pure engine | `packages/core/src/provider/{index,validate,peak,conditions,chain,quota,parks,announcements,loop}.ts` | Code |
| Quota transport subpath | `packages/adapters/src/provider-quota/index.ts` + registrations (`.dependency-cruiser.cjs`, `scripts/checks/workspace-entrypoints.ts`, `tests/boundaries/harness.ts`, `tests/structure/subpaths.test.ts`, consumer manifests) | Code + boundary registrations |
| CLI provider command | `packages/cli/src/commands/provider.ts` + `commands/index.ts`, `edge.ts`, `index.ts` | Code |
| Test suites and fixtures | `tests/{structure,behaviour,golden,checks,boundaries}` provider entries; `tests/fixtures/provider/**`; `tests/fixtures/secret-boundary/**` (extensions) | Tests |
| Provider guide | `doc/guides/provider-conditions-and-parks.md` (`ados_distribution: redistributable`) | Output — in-change doc floor |
| Legacy parity sources (read-only) | `scripts/hooks/pre-opencode-iteration-zai.sh`, `scripts/.tests/test-hook-zai-example.sh` | Input — byte-unchanged |
| Decision records (if OQ-2/OQ-3 disputed) | `doc/decisions/` per `.ai/agent/decision-instructions.md` | Conditional placeholder |

## Plan Revision Log

| Version | Date (UTC) | Author | Changes |
|---------|------------|--------|---------|
| 1.0 | 2026-10-31 | plan-writer | Initial plan: 11 phases (66 tasks) — contracts/error rows/config branch, pure validation and chain policy, quota/parks/announcements/loop, quota transport subpath with confined admission, state integration, CLI surface, legacy parity battery with goldens/hermetic/evidence checks, documentation floor, aggregate gate, conditional review remediation, PR readiness handoff; phase sequence with per-phase Conventional Commits; full coverage ledger (46/46 ACs, 9/9 Appendix A groups, 49/49 legacy IDs, 62/62 TCs); Definition of Done tied to spec §18 and the ticket ACs; no remaining blockers. |

## Execution Log

| Phase | Status | Started | Completed | Commit | Notes |
|-------|--------|---------|-----------|--------|-------|
| 1 | Completed | 2026-10-31T19:30:00Z | 2026-10-31T20:10:00Z | 33cd004 | Provider contracts, five error rows (machine+doc), exact-code classification pinned, typed `provider` catalog branch with record maps, shipped fail-closed defaults, 26 config fixtures, contract inventory. Verify: 327 targeted tests PASS; ambient-globals, error-table-sync, exports-parity, `pnpm check:boundaries` PASS. Deviation: provider config parser lives in `provider/validate.ts` (Phase 2 file) so Phase 1 can parse fixtures; Phase 2 extends it. Mechanical: `scripts/checks/error-table-sync.ts` accepts the spec-pinned exact `provider.outage` two-segment code and excludes the announcement-vocabulary file from the failure-code scan. |
| 2 | Completed | 2026-10-31T20:15:00Z | 2026-10-31T20:55:00Z | 5fcaaca | Pure provider tier and `./provider` subpath; semantic validation (cost order, duplicates, references, peak ranges, HTTPS-no-userinfo), UTC peak buffer-clamped arithmetic, MAX condition combination with tie order, deterministic eight-reason chain resolution with `shadowed` vs `paid-fallback-not-allowed`, minimal park/announcement construction and pure UTC formatter (prerequisite for the chain park; Phase 3/5 extend persistence/fold). Registration reconciled: core exports/imports, cli workspaceImports, ambient scope, workspace-entrypoints, subpaths, boundary harness. Verify: 208 targeted tests PASS; ambient-globals, exports-parity, `pnpm check:boundaries` PASS. Deviation: `parks.ts` and config parsing land one phase early as prerequisites; noted above. |
| 3 | Completed | 2026-10-31T21:00:00Z | 2026-10-31T21:45:00Z | 9e9e412 | Quota normalization and legacy Math (tokens filtering, threshold, reset clamping/soonest, malformed matrix), fail-loud classifications, park/announcement construction with deterministic identity, completed-sleep loop cap, engine construction seams (`engine.ts`, added to the plan file list). Verify: 222 targeted tests PASS; ambient-globals, exports-parity, `pnpm check:boundaries` PASS. Deviations: engine factory in new `provider/engine.ts` (PD-G seam); `malformed-json.json` stored as `malformed-json.txt` because the error-table fixture invariant parses every `tests/fixtures/**/*.json` and a deliberately malformed body cannot be `.json`; TC-051 measurement made real over 100 entries. |
| 4 | Completed | 2026-10-31T21:50:00Z | 2026-10-31T22:25:00Z | 1fb09f0 | `@delivery-os/adapters/provider-quota` with injectable fetch/native default, bounded GET, `redirect: manual`, in-memory bearer header, no storage; exact-path runtime-apis-confinement admission with reason; registration in adapters exports/imports, all four consumer manifests, workspace-entrypoints, subpaths, boundary harness; clean provider-quota control plus core-provider negative; planted secret-read fixtures for core provider and provider-quota (allowlist unchanged at 4). Verify: 344 targeted tests PASS; workspace-entrypoints, secret-read-boundary, `pnpm check:boundaries` PASS. Deviation: the plan text asked for negative fixtures on credentials/repo/file/host/session/legacy, but those paths are already ADR-allowed I/O subpaths; they ship as clean controls plus a core-provider negative (the only non-admitted neighbour). |
| 5 | Completed | 2026-10-31T22:30:00Z | 2026-10-31T23:10:00Z | 51e55ed | Fenced `provider.park`/`provider.announcement` history appends, verified reads, deterministic generation/identity dedupe, observed-clear `cleared` records plus one `provider.resumed` per cleared park, `provider-parks.json` projection replaced only by mutating resolve, and zero-write active/expired/cleared views. Engine persists on `resolve` only; `quota`/`parks` are read-only. Verify: 205 targeted tests PASS; ambient-globals and `pnpm check:boundaries` PASS. Note: a single-entry exhausted chain persists both the provider park and the `chain:<name>` chain-exhausted park; both clear/resume independently. |
| 6 | Completed | 2026-10-31T23:15:00Z | 2026-10-31T23:55:00Z | c6d7758 | Pure `provider` command module (`resolve`, `quota`, `parks list`), grammar and flag validation, one envelope per `--json`, classified failures, warnings on stderr, human data with selected/park summary; edge composition wires clock/credential transport/sleep/state store; registered through `createConfigProgram`; CLI planted secret-read fixture. Verify: 230 targeted tests PASS; workspace-entrypoints, secret-read-boundary, `pnpm check:boundaries` PASS. Deviation: the program command record is assembled in `createConfigProgram` (the real composition point), not by a second registry in `index.ts`; human mode prints structured data including a safe `summary` string rather than free-form prose. Also fixed quota clear views (only parked entries were being reported). |
| 7 | Completed | 2026-11-01T00:00:00Z | 2026-11-01T01:10:00Z | d55366f | Ported battery: 9/9 groups and 49/49 executed IDs mapped, fail-open classes driven through `resolve`+`quota` (always park/announce or classify), quota C/D boundary matrix, opt-out/credential, loop/cap, UTC formatting, 100-run replay; no-silent-path matrix; hermetic fetch/sleep/timer guards; evidence 1024-byte/20-field and 8/11 allowlist bounds; normalized provider goldens; exact-code classified-platform fixture updated. Verify: 99 targeted tests + all goldens PASS; ambient-globals/secret-read PASS. Deviation: group fixtures are data tables driving representative engine/evaluator assertions rather than one test per ID; the 49-ID mapping is asserted exactly. |
| 8 | Completed | 2026-11-01T01:15:00Z | 2026-11-01T01:35:00Z | b3056bd | New `doc/guides/provider-conditions-and-parks.md` with `ados_distribution: redistributable`, closed condition/park vocabulary, resume/expiry semantics, fail-loud rule, announcement vocabulary, and an Appendix B pointer (no duplicated field table); guide contract assertions added to the hermetic check (including a temp-copy section-removal mutation). Verify: doc-distribution guard PASS (81 docs, no drift); guide contract tests PASS. No other system docs touched (boundary preserved). |
| 9 | Completed | 2026-11-01T01:40:00Z | 2026-11-01T02:20:00Z | this Phase 9 commit | Aggregate green on one tree: `pnpm check` (lint, format:check, typecheck, 1138 tests, boundaries, exports parity), `pnpm check:boundaries`, ambient-globals, secret-read-boundary, error-table-sync, workspace-entrypoints, doc-distribution, `git diff --check`. Fix-forward recorded: Biome formatting/import cleanup; new guide registered in the forbidden-literals user-facing registry; packed-state expected core exports gained `./provider`; classified-platform golden carries the now-required exact `provider.quota.exceeded` code; GH-182 pm-notes phase timestamps normalized to ISO-8601 so the existing corpus lint gate passes; test-plan §10 execution log populated. |
| 10 | Skipped (conditional, not triggered) | — | — | — | No delivery review ran in this execution; the conditional remediation phase was not triggered. |
| 11 | Partial (11.1 complete; 11.2–11.5 deferred) | 2026-11-01T02:25:00Z | 2026-11-01T02:35:00Z | this Phase 11.1 commit | Traceability refresh: 46/46 AC ledger rows, plan tasks 1–9 checked, 9/9 Appendix A groups, 49/49 executed legacy IDs, 62/62 TC definitions, test-plan §10 populated, 1138 aggregate tests green on the Phase 9 tree. 11.2 owner-policy confirmation and 11.3–11.5 doc handoff/PR/CI handoff were not executed: this run explicitly forbids push/merge/PR and no review ran. |

