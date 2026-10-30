---
id: chg-GH-174-state-layer
status: Updated
created: 2026-10-30T18:12:08Z
last_updated: 2026-10-30T18:30:22Z
owners: [engineering]
service: delivery-os state layer
labels: [change, planning]
links:
  change_spec: ./chg-GH-174-spec.md
  test_plan: ./chg-GH-174-test-plan.md
  adr_refs:
    - ../../../decisions/ADR-0003-oss-monorepo-structure.md
    - ../../../decisions/TDR-0003-config-parser-schema-and-acquisition.md
    - ../../../decisions/TDR-0004-state-storage-engine.md
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
summary: >
  Deliver the M0-S5 state layer per spec v1.1: one driver-neutral store port in
  core ./contracts (types) materialized in core ./state (facade plus both
  declared driver kinds), with an append-only schema-versioned JSONL ledger as
  durable truth and a disposable SQLite derived index; torn-state detection
  (framing, truncation, sequence, checksum, index divergence) classified as
  state.* result-contract failures and never silently read as zeros; key-set
  assertions with no default substitution; single-writer fences with explicit
  reported recovery; crash-safe atomic replace of derived documents; POSIX
  0700/0600 fail-closed permissions with a platform-conditional Windows ACL
  contract; the fourth `state` domain kind with seven exact-code rows shipped
  in-change in the documented table under the binding two-directional sync;
  storage-engine mechanics recorded as Proposed TDR-0004 during delivery.
  No CLI command, no configuration read, no consumer beyond tests.
version_impact: minor
---

# IMPLEMENTATION PLAN — GH-174: M0-S5: State layer

## Context and Goals

This plan executes [chg-GH-174-spec.md](./chg-GH-174-spec.md) (v1.1) and is verified by [chg-GH-174-test-plan.md](./chg-GH-174-test-plan.md) (v1.1, 25 TCs: TC-STATE-001..024 + TC-REVIEW-001). All product-shape decisions are resolved in the spec (DEC-1..DEC-10); none are re-opened here. Behavior targets come from the test plan and must not change (A-T1); this plan binds file paths, module layout, task order, per-phase verification, and the commit sequence. Baseline: `main-tools` with M0-S1..S4 merged (GH-170/171/172/173, PR #194). The `core ./state` subpath is a types-only placeholder (`StateDriverKind = "jsonl" | "sqlite"`); `DOMAIN_KINDS = ["provider", "input", "config"]`. Execution belongs on `feat/GH-174/state-layer`; the unmerged PR targets `main-tools`; the orchestrator verifies branch state before delivery.

**Goals** (spec G-1..G-8): one implementation-neutral port · durable JSONL ledger truth with disposable derived projections · torn state never silent · single-writer + atomic write discipline · classified state failure identity · least-privilege storage on both platform families · generalization-without-implementation (levels, workspace/fence identifiers) · boundary/branding/scope conformance.

**Plan-stage delivery bindings (D1..D8, binding for delivery; filenames follow test-plan A-T1 — behaviour and AC mapping may not change):**

- **D1 — Module layout**: `packages/core/src/contracts/state.ts` (new — store identity, record envelope, key-set declaration, fence handle types, level enum, evidence types, `STATE_SCHEMA_VERSION` single `as const` home; types/data only); re-exported from the existing contracts index. `packages/core/src/state/index.ts` (updated — driver-neutral facade plus the single public edge factory that accepts `StateDriverKind`; no other public operation or type discriminates by kind). `packages/core/src/state/ledger.ts` (new — framing/checksum/sequence verification core operating on bytes and injected edge data). `packages/core/src/state/driver/**` (new — the driver code: jsonl scan driver, sqlite index driver, and the production runtime edge for fs, lock backend, atomic replace, and the SQLite binding; the only location of runtime APIs in this change). The fault-injectable edge interface is declared as types in the state tier; production constructs the real edge, tests construct fakes (test-plan §4.3). Intra-package imports use the existing `#state/*` and `#contracts` aliases.
- **D2 — SQLite binding and runtime support matrix**: prefer runtime built-ins (`node:sqlite`, `bun:sqlite`) over any third-party dependency; TDR-0004 records the selection, the per-runtime support matrix, and the fallback strategy with local Node/Bun import experiments as evidence (the TDR-0003 local-experiment pattern). Tests assert the recorded matrix entry; an unsupported runtime is declared unsupported per the matrix — never a silent skip. If a third-party binding is genuinely required, the fail-closed license-registry gate applies in the same change (exact pin + lockfile + proposed registry rows incl. transitive closure, GH-173 task-1.3 pattern); owner acceptance stays at PR review.
- **D3 — Error rows ship in-change (GH-172 precedent)**: the seven state rows and the `state` kind land in `ERROR_TABLE`/`DOMAIN_KINDS` and in the documented table at `doc/spec/features/feature-result-contract.md` in Phase 1, so `scripts/checks/error-table-sync.ts` is green in both directions from the first phase boundary; doc reconciliation (lifecycle phase 7, `@doc-syncer`) never rewrites the documented-table section.
- **D4 — No new checks, no new CI jobs**: extend existing suites and existing checks only (`error-table-sync` reads the table dynamically; the forbidden-literals registry gains the new feature doc path — a registry JSON edit, GH-173 precedent, not a bash-stack change). `ci-topology` must stay green with no `ci.yml` change; any discovered wiring need escalates to PM before editing CI.
- **D5 — Changeset**: minor for the five publishable fixed-group packages (`.changeset/config.json`), `.changeset/state-layer-minor.md`, the GH-173 `config-layer-minor.md` precedent; `testkit` stays excluded; nothing publishes.
- **D6 — Evidence artifact**: `chg-GH-174-evidence.md` in this folder (GH-172 pattern: phase commits, per-phase green criteria, final gate consolidation, TC coverage, rollback instructions), authored in the final phase.
- **D7 — Conformance harness**: one suite (`tests/behaviour/state-conformance.test.ts`) with case definitions as data under `tests/fixtures/state/**`, a driver map built from the public edge factory, and the parity normalizer scoped to driver-neutral observables per test-plan §4.1 (the `sqlite` rebuild report is excluded from parity and asserted by TC-STATE-007). Anti-vacuity guards are map-relative: the zero-case guard is active from Phase 2; the single-kind-collapse guard asserts executed kinds against the current driver-map contents — a singleton map (`{jsonl}`, Phase 2) is detected with the divergent-driver control recorded pending/skipped-with-reason in evidence, and the full two-kind divergence control and parity apply once the map is `{jsonl, sqlite}` (Phase 3 onward), with end-state assertion strength unchanged. The case registry grows as behaviors land (Phases 2→5); the 2/2 parity gate is asserted from Phase 3 onward and re-asserted at every later phase boundary.
- **D8 — State-tier structure enforcement**: a new AST detector `tests/structure/state-imports.test.ts` (the `config-imports` pattern) enforces `#contracts`-plus-own-module imports across `packages/core/src/state/**` and runtime-API use only inside the declared driver edge, with synthetic negative controls. The `runtime-apis-confinement` state allowance in `.dependency-cruiser.cjs` is tightened from the whole `core/src/state/` tree to the driver edge in the same change, shipping with a new failing fixture + clean control (matrix update + fixture together, rules §4); no rule is weakened.

### Open questions

- **OQ-1 (spec, TDR candidate — resolved procedurally, not blocking):** storage-engine selections (JSONL framing/checksum, per-runtime SQLite binding + fallback, fence/staleness mechanics, index rebuild policy, atomic-replace technique, Windows ACL mechanism) are recorded as Proposed **TDR-0004** in Phase 1, before any driver task executes. Decision needed: consult `@decision-advisor` (via PM) if a discovered constraint conflicts with any spec §8 contract — do not silently adapt the contract or the selection.
- **OQ-2 (spec, documented limitation — non-blocking):** the Windows ACL half (AC-F8-2/TC-STATE-017) is platform-conditional; Linux CI records an explicit skip with reason and hard-gates the POSIX half. An owner-environment Windows verification run is recorded before any public-release readiness claim. Decision needed: consult `@decision-advisor` only if the owner wants that run scheduled inside this change.
- Test-plan OQ-T1..T6 are resolved canonically by spec v1.1 (§14): the NFR-9 packed-probe exception (AC-F9-3), the AC-F1-2 driver-neutral parity definition, and the pinned `state.write.failed` rebuild classification. DoR confirmation of the parity reading (OQ-T2) belongs to the readiness gate, not delivery.

No other product requirements or blocking coverage gaps were found. Everything below is delivery work, not work performed by this writer.

## Scope

### In Scope

- F-1 driver-neutral port and injected store identity: levels (`local` implemented; `project`/`global` declared and rejected classified), workspace scoping, determinism, zero derivation.
- F-2 append-only schema-versioned JSONL ledger truth: envelope, contiguous sequence, checksums, every mutation first a record, retention forever (no prune/delete/expiry surface).
- F-3 swappable index drivers: `jsonl` verified scan and `sqlite` derived disposable index with divergence detection, rebuild, reported evidence, and classified failed rebuild; one conformance suite over both kinds.
- F-4 torn-state detection (all Appendix A classes), verified-empty evidence, bounded torn-tail repair, mid-record refusal.
- F-5 key-set assertions on read; no default substitution.
- F-6 atomic replace of derived documents with crash-safety and stale-temporary handling.
- F-7 fence acquire/release/recover: contention, stale handles, crash-after-land staleness, explicit reported recovery, reads available while fenced.
- F-8 permissions: POSIX 0700/0600 creation + fail-closed enforcement; Windows ACL-equivalent behind the same port, platform-conditionally tested.
- F-9 the `state` domain kind with seven exact-code rows, containment, `not_landed` on every write-path failure, in-change documented rows, binding two-directional sync.
- F-10 boundary/branding/scope conformance: tier imports, runtime confinement, negative fixtures, forbidden-literal registration of the new feature doc, no CLI command, no config read, no caller beyond tests, packed Node/Bun probes.

### Out of Scope

- Spec §7.2 in full: any CLI/MCP/opencode surface or `state` command (M1-S2), any configuration read, any consumer beyond tests (M0-S6/S8/S10 own adoption), project/global level implementations, networked fences, cloud anything, retention/pruning/compaction beyond torn-tail repair, backup/restore (M3-S6), domain record schemas and their lint (M0-S10), session-database admin (M0-S11), telemetry emission, branding-seam changes, bash-stack or existing-gate changes, `.opencode/**`, `.ados-claude/**`, `scripts/*.sh`, `tools/**`, `.ai/local/**`, `tmp/**`. PR creation and merge are lifecycle phases, not tasks here.

### Constraints

- **Tier and runtime discipline**: the state tier imports `./contracts` only (via `#contracts`); runtime APIs live only in `packages/core/src/state/driver/**` (D1/D8); `adapters` may not import `core ./state` (existing rule, exercised by fixtures); branding never imported; `stateDirectoryName` arrives as an injected parameter; platform and clock/staleness sources arrive as injected edge parameters (fence staleness never reads a wall clock — TC-STATE-015).
- **Error-table lockstep**: machine rows, documented rows, and classification tests ship together in Phase 1; no intermediate red sync gate; classification for the multi-row `state` kind is exact-code only (config precedent); kind-only lookup stays ambiguous.
- **Strict TS + gates**: `tsconfig.base.json` flags (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`), Biome style, `bun:test`, no `any`/`!`/unjustified `as`; every phase leaves `pnpm check` (six stages) green; build precedes dist-dependent checks; every new source file registers in `tests/structure/inventory.json` with per-file named executable allowances in the same phase.
- **Commit discipline**: one Conventional Commit per phase via `@committer` (`feat(GH-174): …` / `docs(GH-174): …`), body lines ≤ 100 chars; the completion signals below are the commit messages.
- **Test hygiene**: all fixtures under temp roots (`mkdtemp`), planted `planted-payload-*` canaries only, no real HOME/state dirs, mutation tests edit copies only, no `.skip`/`.todo`/`.only`; the packed Node/Bun probe is the single documented spawn exception (GAP-2/OQ-T1) — every behaviour suite stays in-process.
- **No license headers** on change artifacts or `doc/spec/**`; agents never add headers.

### Risks

- **RSK-1 SQLite binding divergence across runtimes** (spec RSK-1): TDR-0004 matrix with local experiments (D2); built-in preference; jsonl scan stays the correctness baseline; packed Node/Bun probes assert the matrix; a genuinely required third-party dependency passes the fail-closed license gate in-change.
- **RSK-2 an untested corruption shape escapes detection** (spec RSK-2, RSK-T2): per-class fixture builders assert their mutation precondition; planted canaries make silent reads observable; detection-disabled and direct-write controls prove every fixture and assertion live.
- **RSK-3 Windows ACL unverifiable on Linux CI** (spec RSK-3, RSK-T5, GAP-1): platform-conditional test with recorded skip reason; documented platform contract behind the same port; structure assertion that the contract doc exists; owner-environment run recorded before public-release claims (OQ-2).
- **RSK-4 crash windows and stale fences** (spec RSK-4, RSK-T3/T4): deterministic fault-injectable runtime edge (named injection points, no sleeps, no real crashes); injected staleness source; explicit reported recovery; crash matrix covers the post-flush/pre-release window.
- **RSK-5 error-table drift or ambiguous classification** (spec RSK-5, RSK-T6): in-change documented rows (D3); both-direction drift mutations incl. state-row and `DOMAIN_KINDS` removal; non-zero count assertions.
- **RSK-6 wrong port shape cascades to M0-S6/S8/S10 and M1** (spec RSK-6): the DoR gate reviews this plan against spec + test plan before delivery; `delivery.state.v1` gives the breaking-change channel; the synthetic consumer (TC-STATE-023) exercises every operation through the public port only.
- **RSK-7 CI permission variance (umask / privileged runner)**: permission tests set umask explicitly in-test and assert exact stat bits; a CI filesystem that cannot express the modes is escalated, never silently softened; no widened-mode compensation accepted.
- **RSK-8 green-boundary regression pressure**: `pnpm check` re-run at every phase boundary; conformance parity re-asserted as the case registry grows; aggregate/bash suites run-only at Phase 7 and Phase 10.

### Success Metrics

Spec §4.1, verified by the 25 TCs: 5/5 injected torn classes detected and classified · 0 reads from unverified bytes · 0 silent-zero reads · 0 implementation-dependent call sites outside the state tier · 100% conformance parity over driver-neutral observables on both kinds · 0 partial target states across the crash-injection matrix · 0 double-writes and 0 silent fence steals · 7/7 state codes round-trip with documented rows, 0 sync drift · 100% POSIX creation matrix, 0 permissive continuations · 0 unclassified expected state failures · packed Node/Bun import green within the recorded matrix · all boundary/ambient/literal gates green · 0 regressions in existing gates, bash jobs, or the aggregate check.

## Phases

> **Delivery model**: `@coder` executes each phase, runs the phase gate, then triggers `@committer` with the completion signal. One Conventional Commit per phase; every phase re-runs `pnpm check` before committing. Dependency order: **1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → (9 if findings) → 10**. TDR-0004 (Phase 1) precedes all driver tasks. The conformance case registry grows in Phases 2–5 and parity is re-asserted at each boundary. After the coder's no-review implementation handoff, PM owns scheduling and evidence for Phases 8–10 through the lifecycle (independent review, delegated fixes/re-review, final gates, PR handoff); coder must not mark those phases complete merely by finishing implementation.

### Phase 1: Storage-engine TDR, dependency determination, and state failure identity

**Goal**: Record the engine selections as Proposed TDR-0004 before any driver work, settle the dependency question truthfully, and land the typed state vocabulary plus the fourth domain kind with both-direction sync green from the first boundary.

**Tasks**:

- [x] **1.1** Author `doc/decisions/TDR-0004-state-storage-engine.md` (Proposed, the TDR-0003 format: front matter, context, constraints, drivers, DACI, evidence pack, selections, consequences): JSONL framing and checksum algorithm; per-runtime SQLite binding and fallback strategy with the runtime support matrix (prefer `node:sqlite`/`bun:sqlite` built-ins; local Node/Bun import experiments as evidence; record Node/Bun versions tested); fence/lock mechanics and the staleness basis (injected, no wall clock); index rebuild policy and trigger; atomic-replace technique (temporary naming, cleanup, durability points); Windows ACL mechanism. If any selection conflicts with a spec §8 contract, stop and route through PM to `@decision-advisor` — decision needed before driver tasks; do not adapt the contract silently. — done: Proposed TDR-0004 with quoted Node v24.11.1 / Bun 1.4.4 probes; no spec §8 conflict found.
- [x] **1.2** Dependency determination per the TDR selection: if runtime built-ins suffice, record the no-new-dependency determination in the TDR (license-audit green, registry and lockfile unchanged); otherwise add the exact pinned runtime dependency to the core manifest, update `pnpm-lock.yaml`, and add truthful proposed registry rows incl. transitive closure to `doc/legal/dependency-licenses.yaml` (GH-173 task-1.3 pattern), with `license-audit.ts` and `vulnerability-gate.ts` green under proposed verdicts; owner acceptance remains a PR-review gate. — done: runtime built-ins only; no dependency, registry, or lockfile change; license-audit green.
- [x] **1.3** Author `packages/core/src/contracts/state.ts`: `StateLevel` (`local|project|global`), store identity (level, caller-supplied workspace identifier, fence namespace, schema version, concrete paths incl. the injected state directory), the record envelope (schema version, consumer record kind, store-scoped key, contiguous sequence, checksum, JSON-compatible payload), key-set declaration, fence handle types shaped so write operations are unrepresentable without the acquired handle (DEC-7), read/integrity evidence types (verification classes, verified-empty marker, rebuild/repair/recovery reports, safe locations naming paths and positions only), and `STATE_SCHEMA_VERSION = "delivery.state.v1"` as the single `as const` home. Types and data only; re-export from the contracts index; register in the inventory with named allowances. — done: contracts/state.ts re-exported; `STATE_SCHEMA_VERSION` single home; inventory allowance registered.
- [x] **1.4** Extend `packages/core/src/contracts/error-table.ts`: add `state` to `DOMAIN_KINDS` and append the seven spec §8.3 rows verbatim (`state.store.torn`, `state.schema.mismatch`, `state.keys.missing`, `state.lock.busy`, `state.permission.denied`, `state.write.failed`, `state.level.unsupported`) with exact category/retryable/consequence/projection/hint/summary; all seven carry `not_landed`. — done: `DOMAIN_KINDS` gains `state`; seven rows exact, all `not_landed`.
- [x] **1.5** Ship the documented rows in-change (D3): append the seven rows to the documented table in `doc/spec/features/feature-result-contract.md`; `bun run scripts/checks/error-table-sync.ts` green in both directions with non-zero counts; the check itself is extended only if its state handling demands it — never weakened. — done: `error-table-sync` green both directions (entries=20 documented=20, non-zero counts).
- [x] **1.6** Extend the classification/table/sync tests for `state`: seven exact-code round-trips (returned and thrown), kind-only `state` ambiguity containing via `fallback.internal` (never first-row), wrong/missing/mismatched-code containment, `provider`/`input`/`config` regressions, both-direction drift mutations (machine state-row removal; `state` removed from `DOMAIN_KINDS`; doc-only/malformed/duplicate rows) with unchanged-copy controls, in `tests/behaviour/error-classification.test.ts`, `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts` (TC-STATE-018 identity portion, TC-STATE-019 in full; trigger integration completes in Phase 7). — done: 19 + 21 + 28 focused tests green incl. ambiguity, containment, and both-direction drift mutations.

**Acceptance Criteria**:

- Must: AC-F9-1 for table/classification/containment/sync; NFR-6 measurable (7/7 exact rows, 0 drift, 100% containment, 0 ambiguous selections) before any state behavior depends on the identities.
- Should: the existing `classifyDomainKind(kind, code?)` chain needs no code change (exact-code already generic from GH-173) — if a change is needed, record why in the execution log.

**Affected code areas**:

- `packages/core/src/contracts/state.ts` (new), `packages/core/src/contracts/error-table.ts` (updated), `packages/core/src/contracts/index.ts` (updated)
- `doc/decisions/TDR-0004-state-storage-engine.md` (new), `doc/spec/features/feature-result-contract.md` (updated — seven documented rows)
- Conditionally: core manifest, `pnpm-lock.yaml`, `doc/legal/dependency-licenses.yaml`
- `tests/behaviour/error-classification.test.ts`, `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts` (updated); `tests/structure/inventory.json` (updated)

**System docs to update**:

- `doc/spec/features/feature-result-contract.md` (documented state rows, in-change, D3); TDR-0004 (new, Proposed)

**Tests**:

- `bun test tests/structure/error-table.test.ts tests/behaviour/error-classification.test.ts tests/checks/error-table-sync.test.ts` → green incl. mutations
- `bun run scripts/checks/error-table-sync.ts` → exit 0, non-zero counts; `bun run scripts/checks/license-audit.ts` + `vulnerability-gate.ts` → exit 0
- `pnpm check` → exit 0

**Completion signal**: `feat(GH-174): record storage-engine TDR, state vocabulary, and synchronized state error rows`

---

### Phase 2: Driver-neutral port, JSONL ledger truth, and key-set reads

**Goal**: The facade over injected identity, the append-only schema-versioned checksummed ledger per TDR-0004, verified scan reads with key-set assertions, the jsonl driver as the correctness baseline, the fault-injectable runtime edge, and the conformance harness skeleton.

**Tasks**:

- [x] **2.1** Author the facade and driver registry in `packages/core/src/state/index.ts`: open from the injected identity (deterministic; every name/path from parameters; no branding/config/ambient read); the single public edge factory accepting `StateDriverKind` — the only kind-discriminating surface; level handling (`local` opens; `project`/`global` fail `state.level.unsupported` with zero filesystem effects and no silent local substitution); replace the placeholder comment with the implemented subpath (the `StateDriverKind` export is preserved). — done: `createStateStore` opens from injected identity; `local` only; project/global fail `state.level.unsupported` with zero fs effects; `StateDriverKind` still exported.
- [x] **2.2** Author the runtime edge and fault seam: the injectable edge interface (file operations, lock backend, platform parameter, staleness/clock source — types in the state tier) with the production implementation in `packages/core/src/state/driver/runtime-edge.ts` (fs, lock files, permission application, atomic primitives); tests construct fault-injectable fakes with the named injection points of test-plan §4.3; no ambient environment/clock/randomness read anywhere in the state tier. — done: `state/edge.ts` types + `driver/runtime-edge.ts` production edge (fs, permissions, injected clock, built-in SQLite via `createRequire`); nine named fault points. The unfenced-write negative compile fixture lands in Phase 5 with the fence type (2.x Should).
- [x] **2.3** Author the ledger core per the TDR framing/checksum selection: envelope serialization, contiguous store-scoped sequence assignment, checksum computation over the payload, append-only writes (prefix bytes never rewritten), store header/schema-version handling, and the verification core (framing parse, terminal completeness, sequence continuity, checksum verification) used by every read path; workspace scoping of keys and sequences. — done: `state/ledger.ts` FNV-1a 64 framing/checksum/sequence/schema verifier; no I/O.
- [x] **2.4** Author the jsonl scan driver: read by verified ledger scan; key-set assertion semantics (missing declared keys fail `state.keys.missing` naming exactly the missing keys; present keys return recorded values exactly including falsy values; empty declaration succeeds with an empty result on a non-empty ledger); verified-empty evidence for an absent store at an initialized directory; no prune/delete/expiry operation exists on the port. — done: jsonl scan driver; key-set assertions, falsy values, verified-empty, no prune surface.
- [x] **2.5** Author `tests/behaviour/state-ledger.test.ts` and `tests/behaviour/state-keys.test.ts` (TC-STATE-004, TC-STATE-005, TC-STATE-011): envelope field inspection with independent checksum verification; prefix-snapshot append-only assertion; reopen/continuity; no-prune-surface type assertion; in-place-rewrite control; two workspace identifiers sharing one directory with the scoping-disabled control; key-set pass/fail with falsy payloads and the default-substitution control. — done: `state-ledger.test.ts` (6) + `state-keys.test.ts` (5) green incl. prefix snapshot, workspace scoping and substitution controls.
- [x] **2.6** Author `tests/structure/state-contract.test.ts` and the `tests/structure/state-scope.test.ts` skeleton (TC-STATE-001, TC-STATE-003, TC-STATE-023 structure half): identity determinism under ambient stubs that throw; differing inputs yield differing identity; no name/path default or brand derivation in the types; levels and unsupported rejection with the local-fallback control and a write recorder proving zero writes; no state CLI command and no config import (consumer scan completes in Phase 7). — done: `state-contract.test.ts` (8) + `state-scope.test.ts` (4) green incl. ambient-throw purity, level recorder, scope control.
- [x] **2.7** Land the conformance harness (D7): `tests/behaviour/state-conformance.test.ts` + `tests/fixtures/state/**` — case definitions as data, driver map from the public edge factory, parity normalizer over driver-neutral observables, fixture digest equality, map-relative anti-vacuity guards, the kind-branch AST scan for caller-side tests, and the initial case set (open, append, read, key-set pass/fail) executing against the `jsonl` binding; the `sqlite` binding and 2/2 parity assertions activate in Phase 3 through the same shared registry. The anti-vacuity guards are map-relative: the zero-case guard fails from Phase 2; the single-kind-collapse guard asserts executed kinds against the current driver-map contents — while the map has fewer than two entries (the Phase 2 singleton `{jsonl}`), the control detects the singleton map and marks the divergent-driver control pending/skipped-with-reason in the recorded evidence (a declared conditional, never a silent `.skip`); once two kinds are bound (Phase 3, map exactly `{jsonl, sqlite}`), it asserts the full two-kind divergence control and parity, with end-state assertion strength identical to the final-state guard — no phase boundary is self-red. — done: conformance harness with data cases, driver map, ledger digest equality, map-relative zero-case and single-kind guards; `sqlite` activation deferred to Phase 3 by design.

**Acceptance Criteria**:

- Must: AC-F1-1, AC-F1-3, AC-F1-4, AC-F2-1, AC-F5-1; the verified-scan foundation of AC-F4-x (verification core) and the identity determinism half of NFR-7.
- Should: the unfenced-write negative compile fixture (writes unrepresentable without a fence handle) is authored here or in Phase 5 — wherever the type shape stabilizes first; record where it landed.

**Affected code areas**:

- `packages/core/src/state/index.ts` (updated), `packages/core/src/state/ledger.ts` (new), `packages/core/src/state/driver/**` (new — jsonl driver, runtime edge)
- `tests/behaviour/state-{ledger,keys,conformance}.test.ts`, `tests/structure/state-{contract,scope}.test.ts`, `tests/fixtures/state/**` (new); inventory updated

**System docs to update**:

- none (the state feature doc ships in Phase 7)

**Tests**:

- `bun test tests/structure/state-contract.test.ts tests/structure/state-scope.test.ts tests/behaviour/state-ledger.test.ts tests/behaviour/state-keys.test.ts tests/behaviour/state-conformance.test.ts` → green incl. controls
- `bun run scripts/checks/ambient-globals.ts`; `pnpm run check:boundaries` → exit 0
- `pnpm check` → exit 0

**Completion signal**: `feat(GH-174): add driver-neutral state port with JSONL ledger truth and key-set reads`

---

### Phase 3: SQLite derived index and both-driver conformance parity

**Goal**: The indexed driver kind over the same ledger with disposable-index discipline, and the complete parity proof over driver-neutral observables on both declared kinds.

**Tasks**:

- [ ] **3.1** Author the sqlite driver per the TDR-0004 binding and runtime matrix: derived index maintenance over the ledger (the index is a disposable projection; the ledger never depends on it); bounded reads through the index returning identical observable results to the scan; binding acquisition through the runtime edge; a runtime outside the recorded matrix fails or is declared unsupported per the matrix — asserted, never silently skipped.
- [ ] **3.2** Implement index divergence handling on read: agreement check against the verified ledger; deleted or corrupted index → detected, rebuilt from the verified ledger, rebuild reported in read evidence, values equal ledger truth; rebuild storage-I/O failure → `state.write.failed` (transient, retryable, `not_landed`) per AC-F3-1 — never a silent stale read; ledger bytes unchanged by rebuild.
- [ ] **3.3** Author `tests/behaviour/state-index.test.ts` (TC-STATE-007): index-delete and index-corrupt variants; rebuild-fault injection; stale-index control proving a stale value would have been returned; `jsonl` control equivalence on the same ledger; ledger-byte snapshot equality across rebuild.
- [ ] **3.4** Activate both-kind parity (TC-STATE-002 complete over the current case set): driver map exactly `{jsonl, sqlite}`; fixture digest identical for both runs; executed-case count per kind equal and non-zero; field-by-field normalized comparison; the `sqlite`-only rebuild report excluded from parity and asserted separately; public-port type check (no `StateDriverKind` outside the edge factory); divergent-fake-driver control fails parity.
- [ ] **3.5** Record the runtime-matrix honesty probes for the dev runtime (Bun): the suite asserts the matrix entry and asserts that an undeclared skip fails; the Node half of the matrix assertion runs with the packed probe in Phase 7 (single spawn exception).

**Acceptance Criteria**:

- Must: AC-F3-1 in full; AC-F1-2 over the case set available at this boundary (open, append, read, key-set pass/fail, index-divergence-neutral reads); NFR-1 measurable from this phase on.
- Should: driver-specific diagnostics beyond the rebuild report (if any emerge) are documented as excluded-from-parity in the harness, not silently normalized away.

**Affected code areas**:

- `packages/core/src/state/driver/**` (updated — sqlite driver, binding acquisition), `packages/core/src/state/index.ts` (updated — registry)
- `tests/behaviour/state-{index,conformance}.test.ts`, `tests/fixtures/state/**` (updated); inventory updated

**System docs to update**:

- none (the matrix is recorded in TDR-0004; the feature doc ships in Phase 7)

**Tests**:

- `bun test tests/behaviour/state-index.test.ts tests/behaviour/state-conformance.test.ts` → green; parity 2/2 over the current case set; fake-driver control fails as designed
- `pnpm check` → exit 0

**Completion signal**: `feat(GH-174): add sqlite derived index driver with both-kind conformance parity`

---

### Phase 4: Torn-state detection, verified-empty evidence, and bounded repair

**Goal**: The full detection matrix with classified failures and safe locations, the verified-empty/torn distinction, schema-version mismatch, the explicit torn-tail repair, and the read/write evidence contract.

**Tasks**:

- [ ] **4.1** Complete the verification pipeline with classified failures on every read path (both drivers): framing break, truncated tail, sequence gap/duplicate/reset, checksum mismatch → `state.store.torn` with a safe location (store path + record position, never payload or checksum bytes); unsupported store/record schema version → `state.schema.mismatch` with zero values and no coercion, distinct from torn; detection always precedes value return; extend the conformance case set with torn-detection cases and re-assert parity 2/2.
- [ ] **4.2** Implement the verified-empty/torn distinction: absent store at an initialized directory → explicit verified-empty evidence satisfying only an empty declared key set (non-empty declaration → `state.keys.missing`); present-but-torn → `state.store.torn` with no verified-empty marker; the two verdicts never conflated; no empty collection, zero, or default substituted on any path.
- [ ] **4.3** Implement the explicit torn-tail repair operation: terminal truncation only — verify the damage is terminal, remove the incomplete tail, report the repair, leave survivors intact and the ledger verifying; mid-record corruption refuses with `state.store.torn` and changes nothing (byte equality); no auto-repair path exists.
- [ ] **4.4** Author the torn fixture builders and `tests/behaviour/state-torn.test.ts` (TC-STATE-006, TC-STATE-008, TC-STATE-009, TC-STATE-010): fixtures generated from intact ledgers by named mutations with construction-time mutation-precondition assertions and `planted-payload-*` canaries; the six ledger variants (truncated tail, framing break, gap, duplicate, reset, checksum flip); schema-mismatch store/record fixtures with the supported-version control; verified-empty vs torn declarations; repair/refusal with byte snapshots; intact, detection-disabled, auto-repair, and substitution controls — every negative control asserts detection, never an empty pass.
- [ ] **4.5** Author `tests/behaviour/state-evidence.test.ts` (TC-STATE-024, recovery-report assertion activates in Phase 5): verification classes performed; verified-empty marker only for the absent store; rebuild report only when a rebuild occurred; repair report only when repair ran; path/position-only content with the canary sweep over raw, JSON, and escaped forms; marker-omission and stale-evidence controls.

**Acceptance Criteria**:

- Must: AC-F4-1, AC-F4-2, AC-F4-3, AC-F2-2; NFR-2 (5/5 classes, 0 unverified-value reads, 0 silent-zero reads) and NFR-8.
- Should: torn fixtures are generated per run from committed builders (no binary fixtures committed), keeping the mutation preconditions reviewable.

**Affected code areas**:

- `packages/core/src/state/{ledger,index}.ts` (updated), `packages/core/src/state/driver/**` (updated)
- `tests/behaviour/state-{torn,evidence,conformance}.test.ts`, `tests/fixtures/state/torn/**` (new/updated); inventory updated

**System docs to update**:

- none

**Tests**:

- `bun test tests/behaviour/state-torn.test.ts tests/behaviour/state-evidence.test.ts tests/behaviour/state-conformance.test.ts` → green incl. every control; parity 2/2 with torn cases
- `pnpm check` → exit 0

**Completion signal**: `feat(GH-174): detect and classify torn state with verified-empty evidence and bounded repair`

---

### Phase 5: Write discipline — fence, atomic replace, staleness, recovery

**Goal**: Single-writer fences with lock tokens, structurally unfenced-write-free call shapes, contention and stale-handle classification, crash-after-land staleness with explicit reported recovery, and crash-safe atomic replace of derived documents.

**Tasks**:

- [ ] **5.1** Implement fence acquire/release through the runtime-edge lock backend: acquisition binds the caller-supplied token; a second acquisition while a live fence holds the store fails `state.lock.busy` (transient, retryable, `not_landed`); write operations accept the acquired fence handle as a type-level requirement (DEC-7 — unfenced writes unrepresentable); reads never require the fence and stay available while it is held.
- [ ] **5.2** Implement staleness and explicit recovery: a fence left held after a crashed writer is detectably stale via the injected staleness basis (TDR); writes through released, recovered, or lost handles fail `state.lock.busy` and nothing lands; recovery is an explicit, reported operation (recovery report in evidence); silent stealing is structurally impossible.
- [ ] **5.3** Implement atomic replace of derived documents: every mutation is first a ledger record (DEC-8); the new content is fully written to a same-directory temporary file and swapped by atomic rename per the TDR technique; a failed replace reports `state.write.failed` with `not_landed`; stale temporaries from interrupted replaces are cleaned or reported on the next store open and never read as content.
- [ ] **5.4** Author `tests/behaviour/state-atomic-replace.test.ts` (TC-STATE-012): the full injection matrix (before temporary creation; after temporary write/flush before rename; rename throws; after rename before cleanup; append: before flush; after flush before fence release); target content is observably the previous or the new version — never partial; direct-write partiality self-test control; stale-temporary handling; successful replace observable and ledger-first rebuildable.
- [ ] **5.5** Author `tests/behaviour/state-fence.test.ts` (TC-STATE-013, TC-STATE-014, TC-STATE-015): contention with retry-after-release and contiguous sequence; lock-disabled double-writer control; unfenced-write negative compile fixture; stale-handle matrix (released/recovered/lost) with the silent-steal control; crash-after-land via the post-flush/pre-release fault with injected staleness and the auto-steal control; reads available throughout; recovery report activates the TC-STATE-024 recovery assertion.
- [ ] **5.6** Extend the conformance case set with contention and atomic-replace cases; re-assert parity 2/2 over the complete registry.

**Acceptance Criteria**:

- Must: AC-F6-1, AC-F7-1, AC-F7-2, AC-F7-3; NFR-3 (0 partial states, 100% `not_landed` on write failures) and NFR-4 (0 double-writes, 0 silent steals, 100% `state.lock.busy`).
- Should: the fence handle type makes the misuse unrepresentable at compile time in consumer code, not merely rejected at runtime — the negative compile fixture proves it.

**Affected code areas**:

- `packages/core/src/state/{index,ledger}.ts` (updated), `packages/core/src/state/driver/**` (updated — lock backend, atomic replace)
- `tests/behaviour/state-{atomic-replace,fence,conformance,evidence}.test.ts` (new/updated); inventory updated

**System docs to update**:

- none

**Tests**:

- `bun test tests/behaviour/state-atomic-replace.test.ts tests/behaviour/state-fence.test.ts tests/behaviour/state-conformance.test.ts tests/behaviour/state-evidence.test.ts` → green incl. every fault point and control; parity 2/2 complete
- `pnpm check` → exit 0

**Completion signal**: `feat(GH-174): enforce single-writer fences, staleness recovery, and crash-safe atomic replace`

---

### Phase 6: Least-privilege permissions

**Goal**: POSIX 0700/0600 applied at creation independent of umask and enforced fail-closed on open; the Windows ACL-equivalent delivered behind the same port with the platform-conditional contract honestly recorded.

**Tasks**:

- [ ] **6.1** Implement permission application at creation through the runtime edge: state directory mode 0700 and every store-managed file (ledger, index, lock, temporaries) mode 0600, set explicitly and independent of the inherited umask; no widening to compensate for a hostile environment, ever.
- [ ] **6.2** Implement fail-closed enforcement on open: an existing violation (0755 directory and/or 0644 file) fails `state.permission.denied` (user, `not_landed`, exit-1 projection) with no permissive read/write/repair; restoring correct modes reopens cleanly; nothing is created outside the state root.
- [ ] **6.3** Implement the Windows ACL-equivalent behind the same port: the injected platform parameter drives the ACL mechanism selected in TDR-0004 (applied at creation, verified on open, fail-closed on violation); the documented platform contract ships with the feature doc in Phase 7 and its structure assertion lands with it.
- [ ] **6.4** Author the POSIX half of `tests/behaviour/state-permissions.test.ts` (TC-STATE-016): exact-bit `stat` assertions for the creation matrix under explicitly set restrictive and permissive umask values (in-test only); the violated-store matrix; restoration; the mode-ignoring control; if the CI filesystem cannot express the modes, escalate — never soften the exact-bit assertion.
- [ ] **6.5** Author the platform-conditional half (TC-STATE-017): on `win32` the executable assertions run against the real host; on non-Windows hosts the test is explicitly skipped with the recorded platform reason (the skip text names OQ-2); no Linux run claims Windows verification; the skip is a declared platform conditional, not a silent `.skip` — the suite asserts the conditional is recorded.

**Acceptance Criteria**:

- Must: AC-F8-1 in full; AC-F8-2 delivered behind the port with the platform-conditional test and recorded limitation; NFR-5 (100% matrix applied, 0 permissive continuations).
- Should: the permission checks run on every open (not only creation) so a later chmod outside the store is still caught — assert it.

**Affected code areas**:

- `packages/core/src/state/driver/runtime-edge.ts` (updated — permission application/enforcement, ACL branch)
- `tests/behaviour/state-permissions.test.ts` (new); inventory updated

**System docs to update**:

- none in this phase (the platform contract documents in Phase 7 with the feature doc)

**Tests**:

- `bun test tests/behaviour/state-permissions.test.ts` → green on Linux CI (POSIX half; Windows half skipped-with-reason); `pnpm check` → exit 0

**Completion signal**: `feat(GH-174): apply and enforce least-privilege state permissions with windows ACL contract`

---

### Phase 7: Documentation, failure-identity consolidation, packed probes, and boundary evidence

**Goal**: The state feature doc authored and registered; the seven codes driven through real triggers with the consequence/safety matrix consolidated; packed Node/Bun probes within the recorded matrix; state-tier structure enforcement and boundary fixtures; full aggregate regression.

**Tasks**:

- [ ] **7.1** Author `doc/spec/features/feature-state-layer.md` (current-truth implemented contract: injected identity and levels, ledger truth and envelope, driver kinds and the runtime support matrix, torn classes and repair, key-set semantics, fence discipline and recovery, atomic replace, permissions including the documented Windows platform contract and the Linux CI limitation, the evidence model, and a reference to the synchronized error rows) and register it in `scripts/checks/forbidden-literals.registry.json` (userFacingDocs scope) in the same change; zero product literals; add the structure assertion that the documented Windows platform contract exists and maps to the same port (TC-STATE-017 step 2).
- [ ] **7.2** Consolidate failure identity and evidence safety (TC-STATE-018 trigger completion, TC-STATE-020): drive all seven codes through their real triggers from Phases 2–6 (returned and thrown); the write-path consequence matrix asserts 100% `not_landed` (`state.write.failed`, `state.lock.busy`, `state.permission.denied`, and every other write-triggered state failure); read-path failures never claim a landed mutation; the safe-location canary sweep over raw, JSON, and escaped forms with the payload-including formatter control; missing-key names present where AC-F5-1 requires, payload/checksum bytes absent everywhere.
- [ ] **7.3** Author `tests/checks/packed-state.test.ts` (TC-STATE-021, the GH-173 packed-tarball pattern — the single documented spawn exception): real `pnpm pack` of core into an isolated consumer (`--ignore-workspace`, hermetic HOME/XDG roots, explicit cleanup); import `@delivery-os/core/state` and `/contracts` under Node and Bun; open/append/read a `jsonl` store through the public port in each runtime; `sqlite` loads and exercises per the recorded matrix (assert the matrix entry, never an undocumented skip); negative resolution probe against a non-existent state subpath; no ambient reads; no unsupported dependencies in the packed manifest; exports-parity stays green.
- [ ] **7.4** Ship state-tier structure enforcement and boundary evidence (TC-STATE-022, D8): `tests/structure/state-imports.test.ts` AST detector (contracts-and-own-modules imports across `packages/core/src/state/**`; runtime APIs only inside the driver edge; synthetic forbidden-import and runtime-API controls); tighten the `runtime-apis-confinement` state allowance in `.dependency-cruiser.cjs` to the driver edge with a new failing fixture + clean control in `tests/boundaries` (manifests mirroring production resolution, fixture-coverage meta-check, fixture-deletion self-test); verify the existing `subpath-adapters-core-state` rule has a manifest-mirroring fixture and add one if missing.
- [ ] **7.5** Complete foundation scope (TC-STATE-023): no state CLI command registered or implemented; no configuration import in the state tier; zero state consumers outside `core ./state` and `tests/**`; a synthetic consumer importing only the public port/contracts exercises every operation (open, append, read with key set, atomic replace, fence acquire/release/recover, integrity check, torn-tail repair) without config or branding; seeded-violation controls (injected CLI state command; injected config import) prove the scope test live.
- [ ] **7.6** Aggregate regression sweep: `pnpm check` all six stages green; forbidden-literals scan green with the new doc registered; ambient-globals, error-table-sync, workspace-entrypoints, license-audit, vulnerability-gate, ci-topology green with **no** `ci.yml` change (verify and record; escalate any wiring need to PM before editing); `bash scripts/.tests/test-*.sh` and `bash tools/.tests/test-*.sh` run-only green; `git diff --name-only origin/main-tools...HEAD` shows no changes under `.ai/local/`, `tmp/`, `.opencode/**`, `.ados-claude/**`, `scripts/*.sh`, `tools/**`.

**Acceptance Criteria**:

- Must: AC-F9-2, AC-F9-3, AC-F10-1, AC-F10-2; NFR-7 and NFR-9 with the single documented spawn exception; the doc registered and literal-clean; every new/changed boundary rule proven by a failing fixture and a clean control.
- Should: the feature doc states the runtime support matrix in prose identical in substance to TDR-0004 so reviewers need not cross-open the TDR for the summary.

**Affected code areas**:

- `scripts/checks/forbidden-literals.registry.json` (updated — doc registration), `.dependency-cruiser.cjs` (updated — state allowance tightened), `tests/boundaries/**` (updated — fixtures/registry)
- `tests/structure/state-imports.test.ts`, `tests/structure/state-scope.test.ts` (completed), `tests/behaviour/state-error-classification.test.ts`, `tests/behaviour/state-evidence.test.ts` (consolidated), `tests/checks/packed-state.test.ts` (new); inventory updated
- `doc/spec/features/feature-state-layer.md` (new)

**System docs to update**:

- `doc/spec/features/feature-state-layer.md` (new, registered); scaffold/branding/result-contract/glossary reconciliation belongs to lifecycle phase 7 (`@doc-syncer`) using this change's inputs — the documented error-table section must not be rewritten (D3)
- `.ai/rules/typescript.md` (the runtime-API allowlist line) — registered as a lifecycle-phase-7 (`@doc-syncer`) reconciliation input alongside the scaffold/branding/result-contract/glossary entries: D8 tightens the state runtime-API allowance from the whole `core/src/state/` tree to the driver edge, and the rules line must be reconciled to the tightened boundary in the same pass (no true-but-coarser allowance left behind)

**Tests**:

- `bun test tests/structure tests/behaviour tests/checks tests/boundaries` → green; `pnpm run check:boundaries` → exit 0
- `bun run scripts/checks/forbidden-literals.ts`; `bun run scripts/checks/ambient-globals.ts`; `bun run scripts/checks/error-table-sync.ts`; `bun run scripts/checks/license-audit.ts`; `bun run scripts/checks/vulnerability-gate.ts`; `bun run scripts/checks/ci-topology.ts` → exit 0
- `pnpm check` → exit 0; bash/tool suites green; protected-path diff check clean

**Completion signal**: `feat(GH-174): document state layer, probe packed runtimes, and enforce state boundaries`

---

### Phase 8: Code Review (Analysis)

**Goal**: Independently audit correctness, security, scope, and evidence against spec, test plan, and this plan without modifying implementation during analysis.

**Tasks**:

- [ ] **8.1** PM delegates independent analysis to `@reviewer` after the coder's no-review handoff: trace all 22 ACs and 25 TCs to code and non-vacuous test evidence; inspect ledger truth, torn-detection non-vacuity, key-set refusal, parity normalization, fence/atomicity discipline, permission fail-closed, and the exact-code classification against the spec rows.
- [ ] **8.2** Audit the trust properties: evidence safety (no payload/checksum leakage), safe locations, `not_landed` truthfulness, runtime-matrix honesty (no silent skips), TDR-0004 truthfulness (selections vs. shipped code), packed-consumer isolation, and gate integrity (no weakened rule, no bypass construct).
- [ ] **8.3** Record findings and verdict through the review artifact workflow; verify no out-of-scope changes (protected paths, bash stack, prompts, plugin, headers, credentials); route implementation findings to Phase 9 and any decision conflict to PM/`@decision-advisor` — never a silent alternative.

**Acceptance Criteria**:

- Must: a traceable PASS or actionable findings against spec/test plan/plan, with no fabricated test or owner-approval claims; missing evidence or a failed negative control is unfinished work, never a downgraded severity.

**Affected code areas**:

- none (read-only analysis of Phases 1–7)

**System docs to update**:

- none during analysis

**Tests**:

- Inspect evidence for TC-STATE-001..024 and the TDR; ask `@runner` to reproduce questionable evidence rather than assuming a passing report.

**Completion signal**: independent verdict recorded; PASS advances to Phase 10, findings activate Phase 9.

---

### Phase 9: Post-Code Review Fixes (conditional)

**Goal**: Close accepted review or gate findings without expanding scope or losing regressions.

**Tasks**:

- [ ] **9.1** If findings exist, reproduce each via the relevant TC/negative fixture and add the missing regression before making the smallest fix; preserve current behavior outside the accepted state-layer slice.
- [ ] **9.2** Fix code, fixtures, and matching docs together; any error-table change carries its documented row in the same fix (sync stays green); any engine-selection change is a TDR-0004 amendment recorded in the same fix; consult `@decision-advisor` through PM for selection or boundary changes.
- [ ] **9.3** PM delegates `@runner` repetition of affected focused suites and the full gate set, and independent re-review until PASS; if no findings, record this phase as not required with the Phase 8 PASS evidence — never claim fixes that were not executed.

**Acceptance Criteria**:

- Must: all accepted findings closed with affected ACs still traceable and previously green suites still green; no unresolved blocker, waived check, or undocumented scope expansion.

**Affected code areas**:

- only affected Phase 1–7 files and their regression tests; corresponding docs/TDR when behavior changes

**System docs to update**:

- corresponding state/result docs and TDR-0004 when behavior changes, lockstep with code

**Tests**:

- reproduce the failing TC cases and controls; re-run the full 25-TC evidence set before finalization

**Completion signal**: reviewer PASS after fixes, or an explicit not-required state backed by Phase 8 PASS.

---

### Phase 10: Finalize and Release

**Goal**: A fully gated, versioned, evidenced open-PR handoff; publishing/merge/adoption and owner acceptance remain outside this execution slice.

**Tasks**:

- [ ] **10.1** Add the minor changeset `.changeset/state-layer-minor.md` for the five publishable fixed-group packages (D5; `changesets-group` shape green; testkit excluded; no version hand-bumps, no publishing, no private-flag flips).
- [ ] **10.2** PM verifies spec §18's open-PR DoD: passing traceable evidence for all 22 ACs and measured evidence for all nine NFR thresholds; executable non-vacuous negative controls (torn fixtures, default substitution, local fallback, double-write/silent steal, crash matrix, permission violation); conformance parity 2/2 over driver-neutral observables; packed Node/Bun probes green within the recorded matrix; POSIX matrix green with the Windows limitation recorded; boundary/ambient/literal/sync/aggregate gates green; docs synchronized (state feature doc authored and registered, result-contract rows, reconciliation inputs for lifecycle phase 7).
- [ ] **10.3** Run and record the final ordered gate battery with evidence collection into `chg-GH-174-evidence.md` (D6 — phase commits, per-phase green criteria, final gate consolidation, TC coverage, rollback instructions): `pnpm install --frozen-lockfile` → `pnpm build` → focused TC suites → `bun test` (all layers) → `pnpm check` → boundary/ambient/literal/sync/license/vulnerability/ci-topology checks → bash/tool suites → `git diff --check` and staged-path whitespace preflight; all required CI jobs green on the **pushed HEAD**, not an earlier SHA; unrun evidence is never recorded as passing.
- [ ] **10.4** Include rollback instructions and scope proof in the handoff: fully additive substrate — a single-PR revert removes contracts rows + vocabulary, the state tier, tests/fixtures, docs/registry/changeset together; never roll back one side of the error-table sync; no operator data, bash stack, or upstream approved contract is touched; re-run baseline checks after any rollback.
- [ ] **10.5** Present Proposed TDR-0004, the runtime support matrix, any dependency-license rows, and the pending human determinations to the owner at PR review; PR targets `main-tools`; STOP at the open unmerged PR — no merge, no owner-acceptance claim.

**Acceptance Criteria**:

- Must: spec §18 open-PR DoD complete with current passing evidence; minor release intent recorded; specs reconciled per D3 constraints; all required CI jobs green on the pushed HEAD; rollback coherent.
- Must: no task in any phase touched `.ai/local/`, `tmp/`, `.opencode/**`, `.ados-claude/**`, `scripts/*.sh`, or `tools/**` (verified by the Phase 7 protected-path diff and re-checked at handoff).

**Affected code areas**:

- `.changeset/state-layer-minor.md` (new); `chg-GH-174-evidence.md` (new); no product-code change unless a gate reopens Phase 9

**System docs to update**:

- final reconciliation inputs recorded for lifecycle phase 7 (`@doc-syncer`); no speculative consumer documentation

**Tests**:

- the full Phase 10.3 gate battery, exactly as consolidated in the evidence file

**Completion signal**: `docs(GH-174): finalize state layer evidence, gates, and release reconciliation`

---

## Test Scenarios

All 25 TCs map to phases and acceptance criteria (test-plan §3.1/§5.1 are the authority; phases below are where each TC is implemented and first green). The conformance registry grows across Phases 2–5; TC-STATE-002 is therefore multi-phase by design.

| TC ID | Scenario (abbreviated) | AC | Primary phase(s) | Target layer / test file |
|---|---|---|---|---|
| TC-STATE-001 | Injected identity, zero derivation, ambient-stub determinism | AC-F1-1 | 1 (types), 2 | `tests/structure/state-contract.test.ts`, `tests/behaviour/state-conformance.test.ts` |
| TC-STATE-002 | Driver conformance parity, anti-vacuity, no kind discrimination | AC-F1-2 | 2 (harness), 3 (2/2), 4–5 (case growth) | `tests/behaviour/state-conformance.test.ts` + `tests/fixtures/state/**` |
| TC-STATE-003 | Levels; `state.level.unsupported`; no local fallback | AC-F1-3 | 2 | `tests/structure/state-contract.test.ts` |
| TC-STATE-004 | Workspace record scoping, shared directory | AC-F1-4 | 2 | `tests/behaviour/state-ledger.test.ts` |
| TC-STATE-005 | Append envelope, checksums, append-only order, no prune surface | AC-F2-1 | 2 | `tests/behaviour/state-ledger.test.ts` |
| TC-STATE-006 | Schema-version mismatch, no coercion, distinct from torn | AC-F2-2 | 4 | `tests/behaviour/state-ledger.test.ts`, `state-torn.test.ts` |
| TC-STATE-007 | Index divergence, rebuild, reported evidence, classified failure | AC-F3-1 | 3 | `tests/behaviour/state-index.test.ts` |
| TC-STATE-008 | Torn-class detection matrix (six ledger variants), canaries | AC-F4-1 | 4 | `tests/behaviour/state-torn.test.ts` + `tests/fixtures/state/torn/**` |
| TC-STATE-009 | Verified-empty versus torn, never conflated | AC-F4-2 | 4 | `tests/behaviour/state-torn.test.ts`, `state-keys.test.ts` |
| TC-STATE-010 | Terminal repair versus mid-record refusal | AC-F4-3 | 4 | `tests/behaviour/state-torn.test.ts` |
| TC-STATE-011 | Key-set assertion, falsy values, no default substitution | AC-F5-1 | 2 | `tests/behaviour/state-keys.test.ts` |
| TC-STATE-012 | Atomic-replace crash matrix, stale temporaries | AC-F6-1 | 5 | `tests/behaviour/state-atomic-replace.test.ts` |
| TC-STATE-013 | Fence contention, no double write, unfenced-write shape | AC-F7-1 | 5 | `tests/behaviour/state-fence.test.ts` |
| TC-STATE-014 | Stale-handle rejection, explicit reported recovery | AC-F7-2 | 5 | `tests/behaviour/state-fence.test.ts` |
| TC-STATE-015 | Crash-after-land stale fence, injected staleness | AC-F7-3 | 5 | `tests/behaviour/state-fence.test.ts` |
| TC-STATE-016 | POSIX permission matrix, exact bits, fail-closed | AC-F8-1 | 6 | `tests/behaviour/state-permissions.test.ts` |
| TC-STATE-017 | Windows ACL contract, platform-conditional with recorded skip | AC-F8-2 | 6 (+7 doc assertion) | `tests/behaviour/state-permissions.test.ts`, platform-contract doc |
| TC-STATE-018 | Seven exact identities, ambiguity, containment (triggers consolidated) | AC-F9-1 | 1 (table), 7 (triggers) | `tests/behaviour/state-error-classification.test.ts`, `tests/structure/error-table.test.ts` |
| TC-STATE-019 | Bidirectional table synchronization, drift mutations | AC-F9-1 | 1 | `scripts/checks/error-table-sync.ts`, `tests/checks/error-table-sync.test.ts` |
| TC-STATE-020 | Not-landed consequence matrix, safe locations, canary sweep | AC-F9-2 | 7 (failures built 2–6) | `tests/behaviour/state-error-classification.test.ts`, `state-evidence.test.ts` |
| TC-STATE-021 | Packed Node/Bun state surface within recorded matrix | AC-F9-3 | 3 (matrix), 7 (packed) | `tests/checks/packed-state.test.ts` |
| TC-STATE-022 | Boundary, runtime confinement, literal registration | AC-F10-1 | 2 (seam), 7 (complete) | `tests/boundaries/**`, `tests/structure/state-imports.test.ts`, checks |
| TC-STATE-023 | Foundation scope, no CLI/config/caller, synthetic consumer | AC-F10-2 | 2 (skeleton), 7 (complete) | `tests/structure/state-scope.test.ts`, `state-conformance.test.ts` |
| TC-STATE-024 | Read/write evidence contract, reports only when real | AC-F3-1, F4-1..3, F7-3 | 4 (+5 recovery) | `tests/behaviour/state-evidence.test.ts` |
| TC-REVIEW-001 | Independent review of proof, TDR, gates | AC-F10-1/2, NFR-9 | 8 → PR | PR review record |

Ticket-AC rollup (spec §17): ticket AC-1 (torn state never silently zeros) → TC-STATE-006/008/009/010/011/024 (Phases 2–5, 7); ticket AC-2 (no implementation-dependent call sites) → TC-STATE-002/007/021/022 (Phases 2–3, 7).

## Artifacts and Links

| Artifact | Location | Role / handling |
|---|---|---|
| Change specification (v1.1) | [chg-GH-174-spec.md](./chg-GH-174-spec.md) | Source of requirements, §8.3 rows, §18 DoD |
| Test plan (v1.1, 25 TCs) | [chg-GH-174-test-plan.md](./chg-GH-174-test-plan.md) | Source of TC IDs, §4.1–4.7 binding contracts, execution order |
| PM notes | [chg-GH-174-pm-notes.yaml](./chg-GH-174-pm-notes.yaml) | Read-only; clarify_scope record and scope guardrails |
| This plan | `./chg-GH-174-plan.md` | Only file written by this authoring pass |
| Proposed engine decisions | `doc/decisions/TDR-0004-state-storage-engine.md` | New in Phase 1; Proposed status; owner PR-review gate |
| Accepted architecture | [ADR-0003](../../../decisions/ADR-0003-oss-monorepo-structure.md) | Tier matrix, runtime-API confinement, subpath table |
| TDR precedent | [TDR-0003](../../../decisions/TDR-0003-config-parser-schema-and-acquisition.md) | Proposed-during-delivery pattern adopted by OQ-1 |
| State vocabulary + error rows | `packages/core/src/contracts/{state,error-table}.ts` | Types/data only; single `STATE_SCHEMA_VERSION` home |
| State implementation | `packages/core/src/state/**` (facade, ledger core, `driver/**`) | The only runtime-API location in this change |
| Documented error rows (in-change) | `doc/spec/features/feature-result-contract.md` | Seven state rows appended in Phase 1; sync binding; never rewritten by reconciliation |
| State feature doc | `doc/spec/features/feature-state-layer.md` | New in Phase 7; registered in the forbidden-literals registry in the same change |
| Dependency governance | `doc/legal/dependency-licenses.yaml`, manifests, lock | Only if the TDR selects a third-party binding (D2); proposed verdicts, fail-closed audit |
| Boundary rules + fixtures | `.dependency-cruiser.cjs`, `tests/boundaries/**` | State allowance tightened to the driver edge with fixtures (D8) |
| Packed-consumer probe | `tests/checks/packed-state.test.ts` | GH-173 tarball pattern; the single documented spawn exception |
| Release intent | `.changeset/state-layer-minor.md` | Five-publishable fixed group; no publishing in this plan |
| Delivery evidence | `./chg-GH-174-evidence.md` | New in Phase 10 (GH-172 pattern) |

No new standalone delivery-infrastructure check or CI job is planned (D4). If execution genuinely needs one, repository wiring/registration is mandatory and conflicts with current scope until PM resolves it; no such addition is pre-authorized here.

## Plan Revision Log

| Version | Date (UTC) | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-10-30T18:12:08Z | Implementation Plan Writer | Initial ten-phase, 51-task plan: TDR-0004-first ordering, in-change error rows (D3), driver layout and structure enforcement bindings (D1/D8), built-in SQLite preference with runtime matrix (D2), conformance registry growth 2→5 with 2/2 parity from Phase 3 (D7), packed probe as the single spawn exception, changeset and evidence bindings (D5/D6); all 25 TCs mapped to phases and ACs; per-phase single-commit discipline and full final gate battery. |
| 1.1 | 2026-10-30T18:30:22Z | Implementation Plan Writer | Targeted DoR iteration-1 remediation, non-blocking findings F4–F5 (delivery_planning reopened; `readiness-review/readiness-iter-1.md`; test plan amended to v1.1 in the same reopen cycle — plan task 3.2 already restates the pinned `state.write.failed`, so no TC-driven change was needed here). F4: task 2.7 and D7 single-kind-collapse guard made map-relative — zero-case guard active from Phase 2; while the driver map has fewer than two entries the control asserts against current map contents (singleton `{jsonl}` detected; divergent-driver control marked pending/skipped-with-reason in evidence); from Phase 3 (map `{jsonl, sqlite}`) the full two-kind divergence control and parity apply with unchanged end-state assertion strength, so no phase boundary is self-red. F5: `.ai/rules/typescript.md` (runtime-API allowlist line) registered as a Phase 7 / lifecycle-phase-7 doc reconciliation input alongside scaffold/branding/result-contract/glossary (D8 driver-edge tightening). Cross-reference refresh only: test-plan version labels v1.0 → v1.1 (Context and Goals, Artifacts and Links). No task or phase renumbering, no behavior change, TC references unchanged; the specification is untouched, while the test plan and PM notes were amended by their own authors in the same reopen cycle (test-plan v1.1 cross-reference refresh; PM-notes reopen and authorization records). |

## Execution Log

| Phase | Status | Started | Completed | Commit | Notes |
|---|---|---|---|---|---|
| Authoring | Complete | 2026-10-30T18:12:08Z | 2026-10-30T18:12:08Z | none | Read the completed spec (v1.1) and test plan (25 TCs), the GH-172/GH-173 plans, the template, TDR-0003, current `state` placeholder, `error-table.ts`, `.dependency-cruiser.cjs`, ambient guard scope, changeset config, license registry, and workspace rules. Only this plan written; no code implemented, no git/build/test operations. Executors record per-phase evidence, commands, HEAD, and pushed-HEAD CI results here; unrun evidence must never be recorded as passing. |
| 1 | Complete | 2026-10-30T19:45Z | 2026-10-30T19:52Z | dbab409 | TDR-0004 Proposed; state vocabulary; `state` kind + seven rows + documented rows; sync green both directions (`entries=20 documented=20`); focused suites 19/21/28 pass; `pnpm check` exit 0 (526 tests). |
| 2 | Complete | 2026-10-30T19:55Z | 2026-10-30T20:14Z | P2 | Facade + injected edge + JSONL ledger + jsonl scan driver + conformance skeleton; 6 ledger, 5 keys, 8 contract, 4 scope, 5 conformance tests green; `pnpm check` exit 0 (555 tests). |
