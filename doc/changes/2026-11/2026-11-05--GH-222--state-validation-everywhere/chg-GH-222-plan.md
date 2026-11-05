---
id: chg-GH-222-state-validation-everywhere
status: Proposed
created: 2026-11-05T20:30:00Z
last_updated: 2026-11-05T20:30:00Z
owners: [engineering]
service: delivery-os
labels: [m1, state-layer]
links:
  change_spec: ./chg-GH-222-spec.md
  test_plan: ./chg-GH-222-test-plan.md
summary: >
  Guarantee that every state boundary classifies torn or unknown data instead of silently
  reading it as empty, and that self-corruption salvage and disk exhaustion are classified,
  data-preserving, fail-closed events: boundary validation at every state read/write boundary,
  an explicit guided tail-salvage operation (truncate to last valid frame, classified salvage
  record, quarantined post-tear bytes), index rebuild from the ledger alone including after
  salvage, fail-closed storage exhaustion, reusable artifact-boundary contracts for later
  registries, and two additive error-table rows plus one refined remediation kept in
  bidirectional sync (DEC-5).
version_impact: minor
---

# IMPLEMENTATION PLAN — GH-222: M1-S2: State validation everywhere

## Context and Goals

This plan delivers the spec (`chg-GH-222-spec.md` v1.1) on top of the delivered M0-S5 state layer
(`doc/spec/features/feature-state-layer.md`): classification at every state boundary, explicit
guided tail salvage with quarantine, provable index rebuild from the log alone, fail-closed
storage exhaustion, and reusable artifact-boundary contracts so the retro registry (M1-S8) and
ceremony artifacts (M2-S3) are born validated. All open questions in the spec are resolved
(OQ-1 library-only per DEC-4; OQ-2 terminal-tail-only salvage per DEC-2; OQ-3 error-code
dispositions pinned as DEC-5).

Decisions fixed by this plan (delivery-level, per the test plan's delegation):

- **Fault-point names (OQ-T1)**: the salvage write steps get the pre-commit points
  `salvage-quarantine-write` (quarantine persistence) and `salvage-ledger-write` (the ledger
  commit that truncates and appends the salvage record) — the names the test plan already uses
  in TC-GH222-017 and ASM-3. The pre-commit seam per salvage write step is binding.
- **Exhaustion seam**: today the test edge raises an untyped `{ point }` fault and every write
  error collapses into `state.write.failed`. DEC-5 requires pre-commit storage exhaustion to
  classify `state.storage.exhausted` while non-ENOSPC write errors keep `state.write.failed`
  (TC-GH222-017, DEC-5 case 3). Phase 2 introduces an exhaustion-classified failure form at the
  driver edge (runtime-error classification) and maps it in the facade; the harness raises the
  same form for the ASM-3 pre-commit points.
- **Salvage operation shape**: a new explicit port operation (facade `state/index.ts`, types in
  `contracts/state.ts`), fence-required (DEC-5 case 3 keeps `state.lock.busy` for salvage fence
  contention), quarantine written before the ledger commit and removed again if the ledger
  commit fails (TR-2: no observable intermediate state under a mid-operation fault), exact
  symbol names fixed at delivery (test plan ASM-6 style; tests bind to behaviour).
- **Salvage ordering under exhaustion**: quarantine first → ledger truncate+append second.
  Exhaustion at either point fails `state.storage.exhausted` with the ledger byte-identical and
  no quarantine artifact presented as evidence; the retry yields exactly one salvage record and
  exactly one quarantine artifact (TC-GH222-017).

DEC-5 error-table call-outs (all rows declared in BOTH the machine table
`packages/core/src/contracts/error-table.ts` and the documented table
`doc/spec/features/feature-result-contract.md`, consequence `not_landed`, bidirectional sync
check binding — NFR-6, AC-F5-2):

- **Phase 1 introduces** the new rows `state.storage.exhausted` (transient, retryable,
  remediation names storage exhaustion) and `state.store.unknown` (non-retryable, undeclared
  record kind or payload schema at a validated boundary, distinct from version-scoped
  `state.schema.mismatch`), and **refines the `state.write.failed` remediation text** (scoped to
  storage errors other than exhaustion; write-or-rebuild-did-not-land semantics unchanged).
- **Phase 1 also refines the `state.store.torn` remediation text** to point at inspection and
  salvage as an explicit separate operation — required by spec §22 (maintenance) and asserted by
  TC-GH222-001/010 ("guidance mentions salvage as an explicit separate operation"); the current
  hint names neither. Identity, category, retryability, and consequence are unchanged. See the
  open question below.
- Phases 2–3 introduce the *behaviour* behind the codes (classification at write boundaries,
  salvage failure dispositions) but add no further rows: salvage on a mid-record tear reuses
  `state.store.torn`; salvage/quarantine writes under exhaustion reuse `state.storage.exhausted`;
  other salvage/quarantine write failures including quarantine-preservation failures reuse
  `state.write.failed`; fence contention reuses `state.lock.busy` (DEC-5 case 3).

Open questions (none blocking; owners per the test plan §8.3):

- OQ-T2 (conformance matrix): whether `tests/fixtures/state/driver-map.json` /
  `tests/behaviour/state-conformance.test.ts` enumerate operations such that salvage must be
  added — decided and recorded in the execution log during Phase 5 (add under TC-GH222-007/008
  ids, not new ids).
- OQ-T3 (second salvage on a clean ledger): outside the nine ACs; if delivery lands a behaviour,
  a new TC-GH222-024 is added in a test-plan revision instead of extending TC-GH222-007.
- **For DoR attention (spec-internal tension, resolved in-plan)**: spec §8.5 states the change
  "refines only the remediation guidance text of `state.write.failed`", while spec §22 and
  TC-GH222-001/010 require torn-read guidance to point at salvage. This plan treats §22 as
  binding for a remediation-text-only refinement of `state.store.torn` (both tables, same
  commit, same sync check; no identity/semantics change). If the DoR gate disagrees, the
  alternative is carrying the salvage pointer in read evidence rather than the table row — a
  one-task change inside Phase 1/2. Decision needed: consult `@decision-advisor` only if the
  gate rejects the in-plan resolution.

## Scope

### In Scope

- F-1/F-2: boundary validation and torn/unknown classification at every state read/write
  boundary — exercised on the delivery registry and on artifact kinds standing in for the retro
  registry and ceremony artifacts.
- F-3: explicit guided tail salvage — truncate to last valid frame, classified salvage record
  (EVT-1, DM-1), quarantine of post-tear bytes (DM-2), salvage evidence report (DM-3);
  terminal-tail-only, mid-record tears refuse with zero byte mutation (DEC-2).
- F-4: index rebuild from the ledger alone — absent, corrupt, divergent, and post-salvage index
  (NFR-5).
- F-5: fail-closed storage exhaustion at the append, derived-document replace, and salvage write
  boundaries, injected at the ASM-3 pre-commit points only; `state.storage.exhausted` with
  `not_landed`, no partial frame or partial document (NFR-4).
- F-6: reusable artifact-boundary contracts (DM-4) exercised on artifact kinds; no retro
  pipeline or ceremony runner behavior (DEC-1).
- DEC-5 error-table dispositions: two additive rows + refined remediation(s), both tables,
  binding bidirectional sync (NFR-6, AC-F5-2), plus corpora/golden updates in the same change.
- The 23 automated cases TC-GH222-001..023 from `chg-GH-222-test-plan.md`.

### Out of Scope

- [OUT] Retro pipeline (M1-S8) and ceremony runner (M2-S3) behavior (spec NG-1).
- [OUT] A user-facing `state` CLI command surface (spec NG-3, DEC-4; all coverage at the library
  boundary).
- [OUT] Automatic or read-triggered repair of any kind (spec NG-2; NFR-7 asserted by tests).
- [OUT] Backup, restore, migration, prune/compaction (spec NG-4); quarantine disposition policy
  changes (forever-retention holds).
- [OUT] Real disk conditions; scheduler/queue (M1-S17) and agent-integration work.
- [OUT] A state schema-version bump; salvage records and artifact declarations are additive
  within `delivery.state.v1` (spec NG-6, §19).
- [OUT] Windows ACL execution; permission assertions stay POSIX-conditional (test plan §1.2).

### Constraints

- State tier imports `./contracts` and its own modules only; runtime APIs (filesystem,
  permissions, SQLite binding, clock) live only in `packages/core/src/state/driver/runtime-edge.ts`.
- The public port exposes no driver discriminant; no call site branches on a driver kind.
- Salvage is an explicit port operation, never read-triggered; reads are side-effect-free with
  respect to ledger bytes (NFR-7).
- Quarantine artifacts are store-managed files under the store's least-privilege permission
  contract (POSIX `0600` file / `0700` directory applied at creation, verified on open; Windows
  ACL per the existing platform contract), placed outside the documents and index namespaces,
  and never served as content.
- Evidence names store paths, record positions, and counts — never payload content or checksum
  bytes (canary-swept by tests).
- Record-kind and payload-schema additions are additive within the existing schema version; no
  bump, no migration.
- Both error tables change in the same phase that introduces the codes, with
  `bun run scripts/checks/error-table-sync.ts` passing at zero drift in that phase's commit.
- Storage exhaustion is modelled only at the ASM-3 pre-commit points (`append-before-flush`,
  `replace-before-temp`, `replace-after-temp-write`, `replace-rename`, `salvage-quarantine-write`,
  `salvage-ledger-write`); `append-after-flush`, `replace-after-rename`, `fence-after-acquire`,
  and `index-rebuild-write` keep their existing contracts (`state.write.failed` for a failed
  index rebuild, TC-GH222-013).
- Strict TypeScript per `.ai/rules/typescript.md` (no `any`/`!`/unjustified casts; `import type`;
  `#`-alias imports; ports in contracts); tests are `bun:test` under `tests/**` per
  `.ai/rules/testing-strategy.md`; helpers live in `tests/fixtures/state/harness.ts`, never
  `*.test.ts`.
- Every commit stays green: each phase lands its implementation and its tests together and passes
  its verification commands before committing.

### Risks

- **RSK-1** (spec): salvage destroys recoverable data if triggered on the wrong store/state —
  explicit guided invocation only, fence-required, post-tear bytes quarantined never discarded,
  evidence reports extents; TC-GH222-007/008/009.
- **RSK-2**: error-table drift between machine and documented tables — both tables in the same
  Phase 1 commit, binding sync check, non-vacuity mutations (TC-GH222-018/019).
- **RSK-3**: a partial-write path escapes disk-full coverage — fail-closed asserted at every
  write boundary (append, replace, salvage quarantine, salvage ledger) via named pre-commit
  points; TC-GH222-015/016/017.
- **RSK-5**: salvage mistaken for automatic repair — TC-GH222-010/011 assert byte-side-effect-free
  reads and mid-record refusal; guidance text distinguishes classification from salvage.
- **TR-2** (test plan): salvage ordering leaves an intermediate state under a mid-operation
  fault — quarantine-first ordering with rollback on ledger-commit failure; TC-GH222-017 asserts
  whole-ledger byte identity and a clean retry.
- **TR-5**: new codes break suites enumerating the seven state codes — corpora/goldens updated in
  Phase 1, trigger sweep extended deliberately to nine in Phase 5.

### Success Metrics

| Metric | Target |
|--------|--------|
| Ticket acceptance criteria demonstrated by automated state-tier tests | 5 of 5 (all 9 spec ACs) |
| Reads returning silent zeros on torn or unknown-schema stores | 0 |
| Partial frames or partial derived documents observable under injected disk-full faults | 0 |
| Pre-tear records lost or altered by salvage | 0 (byte-identical prefix) |
| Post-tear bytes silently served as content after salvage | 0 (100% quarantined) |
| Error-table drift between machine and documented tables | 0 (bidirectional sync check passes) |
| Read-triggered ledger byte mutations | 0 |

## Phases

### Phase 1: Contracts, vocabulary, and synced error tables

**Goal**: Land the DEC-5 vocabulary — the two additive error-table rows, the refined remediation
text(s), the salvage and artifact-boundary contract types, and the salvage fault points — with
both error tables updated in the same commit and the bidirectional sync check passing. Types and
data only; no behavior yet.

**Tasks**:

- [x] **1.1** `packages/core/src/contracts/state.ts`: extend `StateFailureCode` with
  `state.storage.exhausted` and `state.store.unknown`; add the salvage port-operation types
  (evidence report per DM-3: truncation position, quarantine path and extent, record counts;
  outcome types; request shape) and the artifact-boundary declaration types (DM-4: declared
  record kinds, payload-schema declarations with required fields / closed vocabularies / record
  identity, classification behavior). Types and data only, runtime-neutral.
- [x] **1.2** `packages/core/src/contracts/error-table.ts`: add the DEC-5 rows —
  `state.storage.exhausted` (`domainKind: state`, category transient, retryable, `not_landed`,
  remediation naming storage exhaustion and that the ledger remains at the last valid frame) and
  `state.store.unknown` (`domainKind: state`, non-retryable, `not_landed`, remediation pointing
  at declaring the kind/schema at the boundary or using a compatible tool version). Nine `state`
  rows total.
- [x] **1.3** Refine remediation guidance text only: `state.write.failed` (scoped to storage
  errors other than exhaustion; write-or-rebuild-did-not-land semantics unchanged — DEC-5) and
  `state.store.torn` (points at inspection and salvage as an explicit separate operation — spec
  §22, TC-GH222-001/010). Identity, category, retryability, consequence unchanged.
- [x] **1.4** `doc/spec/features/feature-result-contract.md`: mirror every Phase-1 machine-table
  change (two new rows + refined remediations) in the documented table, same commit.
- [x] **1.5** `packages/core/src/state/edge.ts`: add `"salvage-quarantine-write"` and
  `"salvage-ledger-write"` to `StateEdgeFaultPoint` (OQ-T1 names fixed; both pre-commit).
- [x] **1.6** Corpora and goldens: add the two new `state` codes and the refined remediations to
  `tests/fixtures/result/code-corpora/**`; deliberately regenerate any golden envelope fixture
  that enumerates the seven state codes (never a blanket rewrite).
- [x] **1.7** **TC-GH222-018** (rows/sync half) and **TC-GH222-019** (full): extend
  `tests/checks/error-table-sync.test.ts` (row assertions for both tables; non-vacuity
  mutations — drop `state.store.unknown` documented-only, drop `state.storage.exhausted`
  machine-only, mutate the refined `state.write.failed` remediation one-side-only, insert
  phantom `state.store.unknown-schema`, restore-and-pass) and `tests/structure/error-table.test.ts`
  (row shape). The nine-code trigger sweep half of TC-GH222-018 lands in Phase 5.
- [x] **1.8** `tests/structure/state-contract.test.ts`: update the expected contract surface for
  the new salvage/artifact-boundary types (data-only, runtime-neutral).

**Task evidence (2026-11-05)**: all eight tasks landed in one commit. Contract surface in
`contracts/state.ts` + `contracts/index.ts`; both error tables carry `state.storage.exhausted`,
`state.store.unknown`, the `state.write.failed` exhaustion carve-out, and the `state.store.torn`
salvage pointer (`bun run scripts/checks/error-table-sync.ts`: entries=43 documented=43, exit 0).
Deliberate fixture/baseline updates in the same commit: `true-positives.json` (two new codes), the
frozen `BASELINE_ROWS` oracle (41→43 rows; `BASELINE_ROWS + 9`; the two refined rows repinned),
`tests/fixtures/ports/v1-contract-inventory.json` (new contract exports), and
`tests/structure/content-inventory.test.ts` (executable allowance for the new contracts constants).
`tests/behaviour/error-classification.test.ts` (TC-STATE-018 row identity suite) moves to the nine
rows here because it enumerates the live table and would otherwise fail before Phase 5.

**Acceptance (Phase 1)**: both tables declare the two rows with `not_landed` and matching refined
remediations; sync check zero drift — PASSED (entries=43 documented=43, exit 0). No existing row's
identity/category/consequence changed — PASSED (frozen baseline oracle + TC-GH222-019 negative
controls). Corpora/goldens updated in the same commit — PASSED (105/105 targeted tests).

**Acceptance Criteria**:

- Must: both error tables declare `state.storage.exhausted` and `state.store.unknown` with
  consequence `not_landed`; the refined remediations match in both tables;
  `bun run scripts/checks/error-table-sync.ts` exits 0 with zero drift (AC-F5-2, NFR-6).
- Must: no existing row's identity, category, or consequence changes (spec §8.5).
- Should: corpora/goldens updated in the same commit so every existing enumerating suite stays
  green (TR-5).

**Files and modules**:

- Code areas: `packages/core/src/contracts/state.ts` (updated), `packages/core/src/contracts/error-table.ts`
  (updated), `packages/core/src/state/edge.ts` (updated), `doc/spec/features/feature-result-contract.md`
  (updated — error-table rows only), `tests/fixtures/result/code-corpora/**` (updated),
  `tests/checks/error-table-sync.test.ts` (updated), `tests/structure/error-table.test.ts` (updated),
  `tests/structure/state-contract.test.ts` (updated).
- System docs: `doc/spec/features/feature-result-contract.md` (error-table rows; prose
  reconciliation deferred to Phase 6 per lifecycle phase 7).

**Tests**:

- TC-GH222-018 (machine/documented row assertions + sync check; trigger sweep in Phase 5).
- TC-GH222-019 (non-vacuity negative controls).

**Verification**:

```bash
bun run scripts/checks/error-table-sync.ts
bun test tests/checks/error-table-sync.test.ts tests/structure/error-table.test.ts tests/structure/state-contract.test.ts
bun test tests/behaviour/state-error-classification.test.ts   # seven-code sweep stays green
git diff --check
```

**Completion signal**: `feat(GH-222): declare state.storage.exhausted and state.store.unknown with synced error tables`

---

### Phase 2: Tear topology, exhaustion seam, and fail-closed write boundaries

**Goal**: Make every write boundary classify storage exhaustion fail-closed
(`state.storage.exhausted`, ledger at the last valid frame, no partial frame or document) and
extend torn-classification coverage with the no-value/no-empty-set/guidance assertions, plus the
pure ledger tear-topology helpers salvage needs. The exhaustion-vs-generic-write-failure seam is
established at the driver edge.

**Tasks**:

- [x] **2.1** `packages/core/src/state/ledger.ts` (pure): tear-topology helpers — classify a tear
  as terminal (torn-tail) vs mid-record (non-terminal, parseable frames after the break), compute
  the last-valid-frame byte offset and the post-tear extent, and build the salvage record
  envelope (EVT-1/DM-1: tear position, quarantine reference, record counts; additive record kind
  within `delivery.state.v1`; never payload content or checksum bytes). Unit-tested with byte
  strings, no filesystem.
- [x] **2.2** `packages/core/src/state/driver/runtime-edge.ts` + `tests/fixtures/state/harness.ts`:
  classify ENOSPC-family write failures into a distinguishable exhaustion failure form (runtime
  error classification at the edge — the only runtime-API location); the test edge raises that
  same exhaustion-shaped form for the ASM-3 pre-commit points (`append-before-flush`,
  `replace-before-temp`, `replace-after-temp-write`, `replace-rename`) while other armed points
  and non-ENOSPC errors keep the generic write-failure form. Tests keep asserting `edge.raised`.
- [x] **2.3** `packages/core/src/state/index.ts`: map the exhaustion form at the append and
  derived-document replace pre-commit points to `state.storage.exhausted` (consequence
  `not_landed`, remediation from the Phase-1 row, ledger/document at the last valid state);
  every other write error keeps `state.write.failed`; a failed index rebuild keeps
  `state.write.failed` (ASM-3 carve-out). Note: `replaceDocument` still lands its ledger-first
  intent record before the document replace (existing DEC-8 contract; TC-GH222-016 accepts the
  ledger-first record — the document target must stay at the previous version).
- [x] **2.4** **TC-GH222-001, TC-GH222-002, TC-GH222-003**: extend
  `tests/behaviour/state-torn.test.ts` — framing break/truncated tail, sequence gap/duplicate/
  reset, checksum mismatch (pure-ledger half via the ledger case): classified torn with store
  path and record position, guidance pointing at inspect/salvage, no values and no empty record
  set, byte-identity after reads, no canary/checksum text, indexed read classifies identically.
- [x] **2.5** **TC-GH222-005**: extend `tests/behaviour/state-evidence.test.ts` — evidence
  hygiene (path/position only), verified-empty distinctness (`verifiedEmpty: true` never shaped
  like torn), falsy-value exactness regression pointer, `state.keys.missing` on a non-empty
  key-set against an absent store.
- [x] **2.6** **TC-GH222-015, TC-GH222-016**: new `tests/behaviour/state-storage-exhausted.test.ts`
  — append under `append-before-flush` exhaustion (byte-identical ledger, not `state.write.failed`,
  disarm-and-retry lands exactly one record at the next sequence); derived-document replace under
  `replace-before-temp` / `replace-after-temp-write` / `replace-rename` exhaustion plus the
  absent-target fixture (target stays version 1 or absent, no partial document, retry lands
  atomically; `replace-after-rename` never used as a disk-full model).
- [x] **2.7** **TC-GH222-012, TC-GH222-013**: extend `tests/behaviour/state-index.test.ts` —
  rebuild from the ledger alone with the index absent (`reason: "missing"`) and corrupt
  (`reason: "corrupt"`); divergent index (altered/deleted/phantom row) rebuilds, reports
  (`reason: "divergent"`), converges stably, compared against the `jsonl` verified-scan oracle;
  forced `index-rebuild-write` fault fails `state.write.failed` and never serves stale truth.

**Task evidence (2026-11-05)**: `ledger.ts` gains `analyzeTear` (terminal vs mid-record
topology, UTF-8 prefix offset, post-tear extent, discarded frames) and `buildSalvageRecord`;
`storage-error.ts` (new, runtime-neutral) carries the distinguishable exhaustion form;
`driver/runtime-edge.ts` re-raises ENOSPC-family (`ENOSPC`/`EDQUOT`/`EFBIG`) storage failures in
that form for every storage write; `index.ts` maps the form to `state.storage.exhausted` at the
append and derived-document replace boundaries while every other write error keeps
`state.write.failed` (a failed index rebuild keeps `state.write.failed` — ASM-3). The harness adds
the opt-in `armExhaustion` seam so existing generic-fault contracts stay unchanged. No new error
rows.

**Acceptance (Phase 2)**: append/replace exhaustion → `state.storage.exhausted`, `not_landed`,
ledger byte-identical with the same count/last sequence, target document at the previous version
or absent — PASSED (TC-GH222-015/016, 5 tests). Torn classification with path/position/guidance
and no values across `read`/`readRecords`/`checkIntegrity` on both driver kinds, zero byte and
listing change — PASSED (TC-GH222-001/002/003). Absent/corrupt/divergent indexes rebuild from the
ledger alone and converge with the `jsonl` oracle — PASSED (TC-GH222-012/013). Exhaustion form is
distinguishable at the edge — PASSED (`armExhaustion` raises it; generic faults keep
`state.write.failed`).

**Acceptance Criteria**:

- Must: injected exhaustion at the append and replace pre-commit boundaries fails
  `state.storage.exhausted` with `not_landed`, remediation naming storage exhaustion, ledger at
  the last valid frame, no partial frame and no observable partial document; the ledger still
  verifies with the same record count and last sequence (AC-F5-1 append/replace half, NFR-4).
- Must: torn fixtures classify `state.store.torn` before any value returns with path, position,
  and guidance; no values and no empty record set are served (AC-F2-1, AC-F1-1 torn half, NFR-1).
- Must: absent/corrupt/divergent indexes rebuild from verified ledger truth alone, converge with
  the verified scan, and report the rebuild (AC-F4-1 non-salvage half, NFR-5).
- Should: the exhaustion failure form is distinguishable from generic write failures in the edge
  contract so Phase 3 salvage can reuse it without new rows.

**Files and modules**:

- Code areas: `packages/core/src/state/ledger.ts` (updated), `packages/core/src/state/driver/runtime-edge.ts`
  (updated), `packages/core/src/state/index.ts` (updated), `tests/fixtures/state/harness.ts`
  (updated — exhaustion-shaped faults at ASM-3 points),
  `tests/behaviour/state-torn.test.ts` (updated), `tests/behaviour/state-evidence.test.ts`
  (updated), `tests/behaviour/state-storage-exhausted.test.ts` (new), `tests/behaviour/state-index.test.ts`
  (updated).
- System docs: none (reconciliation in Phase 6).

**Tests**:

- TC-GH222-001, TC-GH222-002, TC-GH222-003 (torn classification extensions).
- TC-GH222-005 (evidence hygiene and verified-empty distinctness).
- TC-GH222-015, TC-GH222-016 (exhaustion at append and replace boundaries).
- TC-GH222-012, TC-GH222-013 (rebuild from the ledger alone; divergence convergence).

**Verification**:

```bash
bun test tests/behaviour/state-torn.test.ts tests/behaviour/state-evidence.test.ts
bun test tests/behaviour/state-storage-exhausted.test.ts
bun test tests/behaviour/state-index.test.ts
bun test tests/behaviour/state-keys.test.ts tests/behaviour/state-atomic-replace.test.ts   # regressions
git diff --check
```

**Completion signal**: `feat(GH-222): fail state writes closed under storage exhaustion`

---

### Phase 3: Explicit guided tail salvage with quarantine

**Goal**: Deliver the salvage port operation (F-3): truncate to the last valid frame, append the
classified salvage record as durable truth, quarantine the post-tear bytes outside the read
path, return the DM-3 evidence report — terminal-tail-only, fence-required, fail-closed under
exhaustion, with the no-automatic-repair invariants asserted.

**Tasks**:

- [x] **3.1** `packages/core/src/state/index.ts` (facade): the explicit salvage operation
  (symbol name fixed at delivery; library surface only — NG-3). Store-version verdict precedes
  any destructive step (mirror `repairTornTail`); requires an acquired fence handle
  (`state.lock.busy` on contention — DEC-5 case 3); uses the Phase-2 tear-topology helpers:
  a mid-record (non-terminal) tear fails `state.store.torn` naming the position with zero byte
  mutation and no salvage performed (DEC-2, AC-F3-3); only a terminal/torn-tail tear salvages.
- [x] **3.2** Quarantine write (pre-commit point `salvage-quarantine-write`): persist the exact
  post-tear bytes as a store-managed file outside the `documents.<workspace>/` and index
  namespaces; deterministic per-tear naming so a retried salvage produces exactly one artifact;
  POSIX `0600` applied at creation and verified (Windows ACL per the existing platform branch);
  DM-2.
- [x] **3.3** Ledger commit (pre-commit point `salvage-ledger-write`): truncate the ledger at the
  last valid frame and append the salvage record (sequence = kept records + 1, existing schema
  version, self-describing payload: tear position, quarantine reference, counts — never payload
  content or checksum bytes; EVT-1/DM-1). Ordering: quarantine first; if the ledger commit
  fails, remove the quarantine artifact so nothing landed (TR-2). Exhaustion at either point →
  `state.storage.exhausted` with the whole ledger byte-identical and no quarantine artifact
  presented as evidence; a non-ENOSPC quarantine/ledger write failure → `state.write.failed`
  with nothing landed (DEC-5 case 3). Return the DM-3 evidence report (truncation position,
  quarantined extent and path, record counts); never claim an index rebuild that did not occur.
- [x] **3.4** Index discipline: salvage does not treat the index as truth and does not mutate it;
  post-salvage index divergence is resolved by rebuild on the next indexed read (F-4).
- [x] **3.5** `tests/fixtures/state/harness.ts`: add the salvage helpers — ledger-prefix digest,
  quarantine path resolution, tail-byte capture, salvage invocation.
- [x] **3.6** **TC-GH222-007, TC-GH222-008, TC-GH222-009**: new
  `tests/behaviour/state-salvage.test.ts` — happy path (truncate + salvage record + quarantine +
  evidence), byte-for-byte pre-tear preservation (falsy values, canary, remove-salvage-record
  reproduces the original prefix), quarantine integrity (bytes equal the original tail, extent
  matches artifact length, canary absent from every documented read outcome, `0600` POSIX bits,
  outside served documents, foreign-permission fixture detected).
- [x] **3.7** **TC-GH222-010, TC-GH222-011**: new
  `tests/behaviour/state-salvage-invariants.test.ts` — reads never repair (ledger + directory
  digests unchanged across `readRecords`/`read`/`checkIntegrity`/indexed read, twice each; no
  index created on a torn read; guidance mentions salvage as a separate operation); mid-record
  tear refuses salvage (`state.store.torn`, whole-ledger byte identity including parseable
  post-break records, no quarantine, no salvage record, no residue).
- [x] **3.8** **TC-GH222-014**: new `tests/behaviour/state-index-post-salvage.test.ts` — stale,
  deleted, and corrupt index over a salvaged ledger all rebuild from the log alone and converge
  with the `jsonl` verified scan (pre-tear records + salvage record; quarantine contributes no
  rows; deleting the index again reproduces the result; no torn verdict).
- [x] **3.9** **TC-GH222-017** (salvage half): extend
  `tests/behaviour/state-storage-exhausted.test.ts` — exhaustion at `salvage-quarantine-write`
  and `salvage-ledger-write` (ledger byte-identical, still torn at the same position, no partial
  quarantine presented, retry yields exactly one salvage record + one artifact with the original
  tail bytes); a seeded non-ENOSPC quarantine-preservation failure stays `state.write.failed`
  with the ledger unchanged.

**Task evidence (2026-11-05)**: public symbol `salvage(handle)` on `StateStorePort`; evidence
report fields `ledgerPath`, `truncationOffset`, `quarantinedBytes`, `quarantinePath`,
`keptRecords`, `discardedFrames`, `sequence`. Quarantine directory
`quarantine.<workspace>/tail-<position>-<prefixBytes>-<tailBytes>.bytes` (deterministic per tear,
outside `documents.<workspace>/` and the index namespace, `0600` verified, verified on open). The
store-version header verdict precedes every destructive step; a mid-record topology refuses
before any write; the quarantine is written before the ledger commit, removed when the commit
fails, and a failing commit restores the pre-salvage ledger bytes (TR-2). **OQ-T3 note**: salvage
on a clean ledger is a reported no-op (`salvaged: false`) mirroring `repairTornTail`; recorded for
a future `TC-GH222-024` test-plan revision rather than extending TC-GH222-007.

**Acceptance (Phase 3)**: terminal-tail salvage truncates, appends the classified record,
quarantines the exact post-tear bytes, and reports position/extent/counts — PASSED
(TC-GH222-007/008/009, 5 tests). Reads never mutate and never repair; mid-record salvage refuses
with byte identity, no quarantine, no residue — PASSED (TC-GH222-010/011, 6 tests). Post-salvage
index rebuild converges with the verified scan and quarantined bytes never enter it — PASSED
(TC-GH222-014, 1 test). Exhaustion at either salvage write step leaves the ledger byte-identical
with a clean retry; non-ENOSPC stays `state.write.failed` — PASSED (TC-GH222-017, 3 tests).
Quarantine artifacts carry `0600` and stay manually recoverable — PASSED (POSIX assertion in
TC-GH222-009; Windows ACL not claimed on Linux).

**Acceptance Criteria**:

- Must: salvage on a torn tail truncates to the last valid frame, appends the classified salvage
  record as durable ledger truth, quarantines the post-tear bytes never served as content, and
  returns evidence naming the truncation position and quarantined extent (AC-F3-1, EVT-1,
  DM-1..3, NFR-2, NFR-3).
- Must: reads on a torn store never mutate bytes and never repair (AC-F3-2, NFR-7); salvage on a
  mid-record tear fails `state.store.torn` with zero bytes changed (AC-F3-3).
- Must: post-salvage ledgers rebuild their index from the log alone and converge with the
  verified scan (AC-F4-1 salvage half, NFR-5).
- Must: exhaustion at either salvage write step fails `state.storage.exhausted` with the ledger
  unchanged and a clean retry (AC-F5-1 salvage half, NFR-4).
- Should: quarantine artifacts remain manually recoverable (test postcondition) and carry the
  store permission contract.

**Files and modules**:

- Code areas: `packages/core/src/state/index.ts` (updated — salvage operation),
  `packages/core/src/state/ledger.ts` (only if envelope-building adjustments emerge),
  `tests/fixtures/state/harness.ts` (updated), `tests/behaviour/state-salvage.test.ts` (new),
  `tests/behaviour/state-salvage-invariants.test.ts` (new),
  `tests/behaviour/state-index-post-salvage.test.ts` (new),
  `tests/behaviour/state-storage-exhausted.test.ts` (updated).
- System docs: none (reconciliation in Phase 6; the store-layout quarantine row is a doc-sync
  deliverable).

**Tests**:

- TC-GH222-007, TC-GH222-008, TC-GH222-009 (salvage happy path, preservation, quarantine).
- TC-GH222-010, TC-GH222-011 (no-automatic-repair invariants).
- TC-GH222-014 (post-salvage rebuild).
- TC-GH222-017 (salvage write exhaustion).

**Verification**:

```bash
bun test tests/behaviour/state-salvage.test.ts tests/behaviour/state-salvage-invariants.test.ts
bun test tests/behaviour/state-index-post-salvage.test.ts tests/behaviour/state-storage-exhausted.test.ts
bun test tests/behaviour/state-permissions.test.ts tests/behaviour/state-fence.test.ts   # quarantine perms, salvage fence contention
bun run scripts/checks/error-table-sync.ts   # still zero drift
git diff --check
```

**Completion signal**: `feat(GH-222): add explicit guided tail salvage with quarantine`

---

### Phase 4: Reusable boundary validation and artifact-boundary contracts

**Goal**: Generalize boundary validation into a reusable mechanism (F-1/F-6, DM-4): declared
schemas, record identities, and classification behavior for artifact-kind boundaries, with the
four distinct verdicts (valid, verified-empty, torn, unknown) and write refusal of nonconforming
records — exercised on stand-in kinds for the retro registry and ceremony artifacts. The raw
port stays kind-agnostic (ASM-4).

**Tasks**:

- [x] **4.1** New `packages/core/src/state/artifact-boundary.ts` (imports contracts + own modules
  only; composes the store port like `registry.ts`/`closeout.ts`): the declarative
  artifact-boundary contract — declared record kinds, payload-schema declarations (required
  fields, closed vocabularies, record identity), and the classification behavior: reads validate
  before any value returns (valid → values + evidence; verified-empty → explicit empty evidence
  satisfying only an empty key-set declaration; torn → `state.store.torn` passthrough with
  path/position/guidance; undeclared kind or payload-schema violation at the boundary →
  `state.store.unknown` with remediation, never a silent zero or empty list); writes admit only
  schema-conforming records — an undeclared kind, schema-violating payload, or missing required
  field fails `state.store.unknown` with `not_landed` and zero mutation (no default filled in).
  The declaration is reusable data: applying it to a second, differently named kind requires no
  code changes.
- [x] **4.2** `packages/core/src/state/index.ts`: export the boundary factory and types on the
  `core/state` subpath.
- [x] **4.3** **TC-GH222-020, TC-GH222-021, TC-GH222-022**: new
  `tests/behaviour/state-artifact-boundary.test.ts` — the verdict matrix (four verdicts,
  pairwise distinct, no defaults; declaration applied to a second kind; suite imports no retro
  or ceremony runtime module); the retro-registry stand-in kind (conforming round-trip incl. a
  falsy field; missing-required-field and wrong-typed-field writes refused with digest
  stability; undeclared kind read classified); the ceremony-artifact stand-in kind (malformed
  JSON → torn; out-of-vocabulary value and missing identity → `state.store.unknown`; undeclared
  sibling kind → unknown; refused writes leave ledger/documents unchanged).
- [x] **4.4** **TC-GH222-006**: new `tests/behaviour/state-boundary-validation.test.ts` —
  write-boundary refusals (undeclared kind, schema-violating payload, missing required field)
  fail classified `state.store.unknown` with `not_landed`; ledger digest unchanged; verified
  read returns exactly the pre-existing records and evidence count.
- [x] **4.5** **TC-GH222-004**: new `tests/behaviour/state-unknown.test.ts` — undeclared kind and
  undeclared payload schema → `state.store.unknown` with path/position/remediation and no value;
  version mismatch stays `state.schema.mismatch` (not overloaded); verified-empty is pairwise
  distinct from both; test names make explicit that the raw store port stays kind-agnostic and
  "undeclared" is boundary-relative (ASM-4).
- [x] **4.6** Structure guards: update `tests/structure/state-contract.test.ts` (contract
  surface), `tests/structure/state-imports.test.ts` / `tests/structure/state-scope.test.ts`
  (new module stays inside the state tier; no runtime API outside the driver edge), and run
  `tests/checks/packed-state.test.ts` (new exports on the packed `core/state` subpath).

**Acceptance Criteria**:

- Must: artifact-boundary reads classify valid / verified-empty / torn / unknown distinctly
  before any value returns; undeclared kind or schema classifies `state.store.unknown`;
  version-scoped mismatch stays `state.schema.mismatch`; no default or zero substitution
  (AC-F1-1, AC-F6-1, DM-4, NFR-1).
- Must: nonconforming writes fail classified with `not_landed` and zero ledger mutation
  (AC-F1-1 write half).
- Must: no retro pipeline or ceremony runner behavior is exercised, imported, or required
  (DEC-1, NG-1).
- Should: the declaration mechanism is proven reusable on a second kind in the same suite
  (TC-GH222-020).

**Files and modules**:

- Code areas: `packages/core/src/state/artifact-boundary.ts` (new), `packages/core/src/state/index.ts`
  (updated — exports), `tests/behaviour/state-artifact-boundary.test.ts` (new),
  `tests/behaviour/state-boundary-validation.test.ts` (new), `tests/behaviour/state-unknown.test.ts`
  (new), `tests/structure/state-contract.test.ts` / `state-imports.test.ts` / `state-scope.test.ts`
  (updated).
- System docs: none (reconciliation in Phase 6).

**Tests**:

- TC-GH222-020, TC-GH222-021, TC-GH222-022 (verdict matrix; retro and ceremony stand-ins).
- TC-GH222-006 (write-boundary schema validation).
- TC-GH222-004 (unknown vs schema mismatch vs verified-empty).

**Task evidence (2026-11-05)**: `createArtifactBoundary(store, declaration)` is the exported
factory (`core/state`); declarations are plain data (`recordKeyPrefix`, `kinds[]` with
`kind`, optional `payloadSchema`, `identityField`, typed `fields`, optional closed
`vocabularies`). A boundary owns its `recordKeyPrefix` namespace and ignores unrelated consumer
records, so the raw store port stays kind-agnostic (ASM-4). Reads validate schema identifier,
required fields/types, identity, and vocabularies before returning; writes validate identically
before delegating to `store.append`, so a refusal mutates nothing. Stand-in declarations live in
`tests/fixtures/state/artifact-declarations.ts`.

**Acceptance (Phase 4)**: four verdicts distinct with no default substitution — PASSED
(TC-GH222-020, TC-GH222-004). Undeclared kind/schema → `state.store.unknown`; version mismatch
stays `state.schema.mismatch` — PASSED (TC-GH222-004). Nonconforming writes fail `not_landed`
with byte-identical ledger — PASSED (TC-GH222-006/021/022). No retro/ceremony runtime behaviour
imported or required — PASSED (import-scan test; no such state modules exist). Reuse on a second
kind — PASSED (ceremony stand-in).

**Verification**:

```bash
bun test tests/behaviour/state-artifact-boundary.test.ts tests/behaviour/state-unknown.test.ts tests/behaviour/state-boundary-validation.test.ts
bun test tests/structure/state-contract.test.ts tests/structure/state-imports.test.ts tests/structure/state-scope.test.ts
bun test tests/checks/packed-state.test.ts
git diff --check
```

**Completion signal**: `feat(GH-222): add reusable validated artifact-boundary contracts`

---

### Phase 5: Delivery-registry wiring and the nine-code trigger sweep

**Goal**: Exercise the generalized boundary validation on the delivery registry consumer
(F-1/F-2 regression proof) and complete the error-table trigger sweep: exactly nine `state`
  codes, each driven through its real trigger — closing TC-GH222-018 and every remaining AC
  landing.

**Tasks**:

- [x] **5.1** `packages/core/src/state/registry.ts`: declare the `phase.transition` boundary
  (kind + payload schema + record identity) through the Phase-4 mechanism, so the delivery
  registry's reads and writes are validated boundaries (F-1); the presence-tolerant read keeps
  its presence tolerance (`present: false` for an absent store or per-change record) without
  swallowing torn classification.
- [x] **5.2** **TC-GH222-023**: extend `tests/behaviour/phase-registry.test.ts` — valid-store
  behavior unchanged (history folds exactly, projection rebuildable, evidence counts stable,
  falsy/empty values not defaulted, no spurious rebuild/repair reports); torn store yields a
  classified torn failure (never an empty history, never `present: false`, never a produced or
  replaced `phase-state.<REF>.json`); absent per-change record stays explicit no-evidence; no
  read mutates ledger or derived documents.
- [x] **5.3** **TC-GH222-018** (trigger-sweep half): extend
  `tests/behaviour/state-error-classification.test.ts` from seven to exactly nine codes —
  `state.storage.exhausted` triggered through the Phase-2 seam, `state.store.unknown` through
  the Phase-4 boundary — every code classified with `not_landed` and the canary sweep over each
  rendered failure (no payload, no checksum bytes).
- [x] **5.4** OQ-T2 decision: inspect `tests/fixtures/state/driver-map.json` and
  `tests/behaviour/state-conformance.test.ts`; if the conformance matrix enumerates operations,
  add salvage coverage under the existing TC-GH222-007/008 ids (normalized shape per the
  matrix's convention); record the decision in the execution log either way.

**Acceptance Criteria**:

- Must: the delivery registry's verified reads and torn classification are preserved; torn is
  never served as empty history or absent evidence (AC-F1-1, AC-F2-1 registry half).
- Must: exactly nine `state` rows are declared in both tables, every one triggerable and
  classified with `not_landed`; no code is a table-only identity (AC-F5-2 completion, NFR-6).
- Should: the conformance matrix decision is recorded with its rationale (OQ-T2).

**Files and modules**:

- Code areas: `packages/core/src/state/registry.ts` (updated), `tests/behaviour/phase-registry.test.ts`
  (updated), `tests/behaviour/state-error-classification.test.ts` (updated),
  `tests/fixtures/state/driver-map.json` + `tests/behaviour/state-conformance.test.ts` (updated
  only if the OQ-T2 decision requires it).
- System docs: none (reconciliation in Phase 6).

**Tests**:

- TC-GH222-023 (delivery-registry regression).
- TC-GH222-018 (nine-code trigger sweep completion — rows/sync half landed in Phase 1).

**Task evidence (2026-11-05)**: `PHASE_TRANSITION_BOUNDARY` declares `phase.transition` under
`phase.transitions:` with the change-ref identity, required top-level fields, and closed
`operation`/`outcome` vocabularies. Registry reads use the boundary (latest artifact per key) for
both strict and presence-tolerant variants; writes go through the boundary so a nonconforming
payload never reaches the ledger. **OQ-T2 decision**: the conformance matrix
(`tests/fixtures/state/driver-map.json` + `tests/behaviour/state-conformance.test.ts`) enumerates
*case ids* (`open-empty-store`, `append-and-read`, …) and a driver-kind map, not operation names;
salvage is not an operation the case shape can express (`CaseOutcome` has no salvage evidence),
so no matrix change is required and none was made. **Boundary classification change** (spec
AC-F1-1): a top-level `phase.transition` payload that loses a declared field now classifies
`state.store.unknown` at the boundary, while nested transition entries that lose a declared field
remain `state.keys.missing`; the GH-179 regression fixtures were updated to assert both
outcomes explicitly (TC-VERIFY-010/012, phase-envelope). **Phase-3 repair note**: the Phase-3
commit's verification block did not include `tests/behaviour/state-ledger.test.ts`, whose exact
port-surface assertion needed `salvage` added; repaired here (expected operation list) and the
full behaviour tier now runs green apart from the pre-existing pm-notes corpus defect below.

**Acceptance (Phase 5)**: verified registry reads and torn classification preserved; torn never
served as empty history or `present: false` — PASSED (TC-GH222-023, 4 tests). Exactly nine state
rows, all triggerable, each `not_landed`, canary-swept — PASSED (TC-GH222-018 trigger sweep,
10 tests in `state-error-classification.test.ts`). Conformance-matrix decision recorded — PASSED
(OQ-T2 above). Full behaviour tier: 1438 pass, 4 skip (platform-conditional), 1 fail —
`tests/behaviour/pm-notes-corpus.test.ts` fails on a pre-existing duplicate `completed` key in
`chg-GH-222-pm-notes.yaml` (committed by the PM; parses with `Map keys must be unique` at HEAD).
Outside this change's write scope; carried to Phase 6 evidence.

**Verification**:

```bash
bun test tests/behaviour/phase-registry.test.ts tests/behaviour/state-error-classification.test.ts
bun test tests/behaviour          # full behaviour tier
bun run scripts/checks/error-table-sync.ts
git diff --check
```

**Completion signal**: `feat(GH-222): exercise boundary validation on the delivery registry`

---

### Phase 6: Finalize — full gate battery, changeset, spec reconciliation

**Goal**: Prove the whole change with the aggregate gate and the test plan §7.2 evidence battery,
add the release changeset per repo conventions, and reconcile the system spec with the delivered
behavior.

**Tasks**:

- [x] **6.1** Full gate battery (test plan §7.2): aggregate `pnpm check` (lint → format:check →
  typecheck → test → check:boundaries); binding `bun run scripts/checks/error-table-sync.ts`
  (exit 0, zero drift) plus `bun test tests/checks/error-table-sync.test.ts`; full behaviour
  tier `bun test tests/behaviour`; boundary/static `bun test tests/structure tests/boundaries`
  (no new package/subpath edge is expected; run because imports/exports changed) and
  `git diff --check`; packed surface `bun test tests/checks/packed-state.test.ts`. Record any
  SQLite-binding skip in the test execution log with the reason (a skip is not a pass; no Linux
  run claims Windows ACL verification).
- [x] **6.2** Version bump per repo conventions: add the lockstep changeset (minor —
  `version_impact: minor`); never bump versions by hand (changesets owns it).
- [x] **6.3** Spec reconciliation (lifecycle phase 7, executed by `@doc-syncer`; scoped here so
  the plan's final phase includes it): `doc/spec/features/feature-state-layer.md` — the salvage
  operation and its safety model, the quarantine artifact and its store-layout row, the
  exhaustion classification at write boundaries, the reusable boundary-validation/artifact
  contracts, the nine-code failure identity, and the EVT-1/DM-1..4 vocabulary;
  `doc/spec/features/feature-result-contract.md` — prose around the rows that landed in Phase 1
  (rows themselves already synced). No `doc/business/**` content (engineering repo).
- [x] **6.4** Populate the test plan §10 execution log and this plan's Execution Log (per-phase
  commits, suite results, skips, and the OQ-T2 decision record); leave no unchecked plan task.

**Acceptance Criteria**:

- Must: `pnpm check` green; every §7 targeted suite green; sync check zero drift (AC-F5-2 end
  state).
- Must: every TC-GH222-001..023 case executed with pass or an explicitly recorded skip; all nine
  spec ACs demonstrated (ticket AC traceability: AC1→AC-F2-1, AC2→AC-F6-1, AC3→AC-F3-1,
  AC4→AC-F4-1, AC5→AC-F5-1).
- Must: changeset added per lockstep conventions; system spec reconciled with delivered
  behavior.
- Should: execution logs complete enough that the DoD check and review phases need no
  re-derivation.

**Task evidence (2026-11-05)**:

- 6.1 — lint, `format:check`, and `typecheck` pass; `pnpm test` runs 2482 tests: 2477 pass, 4
  platform skips, 1 fail. The single failure is the pre-existing, PM-owned
  `tests/behaviour/pm-notes-corpus.test.ts` defect (duplicate `completed` key in
  `chg-GH-222-pm-notes.yaml` at HEAD; `yaml` rejects it at parse time). Because `pnpm check`
  stops at `test`, the remaining stages were run explicitly and pass: `pnpm check:boundaries`
  (145 modules / 317 deps, ambient-globals 47 files, workspace entrypoints, secret-read boundary)
  and `bun run scripts/checks/exports-parity.ts` (5 publishables). `TMPDIR` is set to a
  repo-local directory so the hermetic-clone baseline test avoids a cross-device hardlink
  failure on this host (environment-only; it passes with the workaround).
- 6.2 — `.changeset/gh-222-state-validation-minor.md` (minor, lockstep across the five
  publishables); no hand-bumped versions.
- 6.3 — `feature-state-layer.md` reconciles the nine-code identity, boundary validation, guided
  salvage and quarantine, fail-closed exhaustion, evidence model, store layout, module map, and
  retention; `feature-result-contract.md` prose explains the two additive rows and the two
  text-only refinements. No `doc/business/**` content.
- 6.4 — test plan §10 populated with all 23 cases, the SQLite availability note (no skip), and
  the pre-existing pm-notes defect; this Execution Log records per-phase commits and the OQ-T2
  decision. Every plan task is checked.

**Acceptance (Phase 6)**: `pnpm check` — **NOT fully green**: every code/test gate passes except
the pre-existing pm-notes corpus failure described above (outside the change's write scope). §7
targeted suites and sync check — PASSED. All TC-GH222-001..023 executed PASS; nine spec ACs
demonstrated (AC-F1-1, AC-F2-1, AC-F3-1..3, AC-F4-1, AC-F5-1, AC-F5-2, AC-F6-1) — PASSED.
Changeset + spec reconciliation — PASSED.

**Files and modules**:

- Code areas: none (evidence and release artifacts only).
- System docs: `doc/spec/features/feature-state-layer.md` (updated),
  `doc/spec/features/feature-result-contract.md` (updated, prose), `.changeset/` (new changeset).

**Tests**:

- The full §7.2 battery (see Verification).

**Verification**:

```bash
pnpm check
bun run scripts/checks/error-table-sync.ts
bun test tests/checks/error-table-sync.test.ts
bun test tests/behaviour tests/structure tests/boundaries tests/checks/packed-state.test.ts
git diff --check
```

**Completion signal**: `chore(GH-222): add changeset and finalize state-validation delivery evidence`

---

### Phase 7: Code Review Remediation (Iteration 1)

**Goal**: Close review finding F-1 (review-iter-1.yaml): salvage must refuse a ledger
whose FIRST integrity break is mid-record even when the ledger additionally ends in a
truncated tail — zero byte mutation before any refusal, per AC-F3-3 / DEC-2. One
low-severity test-quality fix rides the same commit.

**Tasks**:

- [x] **7.1** `packages/core/src/state/ledger.ts` (`analyzeTear`, truncated-tail
  branch): before classifying topology `terminal`, verify the complete-lines prefix
  (the text up to the last LF) — when that prefix is not itself verified/empty, return
  topology `mid-record` at the prefix's first-break position so salvage refuses before
  any write (F-1; empirical repro: digest changed + quarantine + salvage record
  appended, then `state.store.torn` with `not_landed`). Note the M0-S5
  `repairTornTail` shares the coarse-variant root (`index.ts`); guard it the same way
  or record a follow-up ticket — pre-existing behavior, outside this change's ACs.
  — Done: the prefix is verified with `verifyLedger`; a torn prefix yields
  `topology: "mid-record"` at the prefix's first break (schema-in-prefix returns
  `undefined`, so callers refuse without writing). `repairTornTail` took the
  same-way guard via `analyzeTear` (refuses `state.store.torn` at the mid-record
  position with zero byte mutation; pure-terminal truncation keeps its exact
  truncation point, `removedBytes`, and report shape).
- [x] **7.2** Extend `tests/behaviour/state-salvage-invariants.test.ts`
  (TC-GH222-011): a mid-record break (framing or checksum at record ~2/3 with a
  parseable frame after it) COMBINED with a truncated final tail (no trailing LF) →
  salvage fails `state.store.torn` naming the mid-record position, whole-ledger byte
  identity (digest + buffer equals), no quarantine directory, no `state.salvage`
  record, and a subsequent verified read reports the same tear position.
  — Done: combined fixture (record 3 checksum break + unterminated fragment);
  refusal at record 3 while the coarse read reports the tail at 6, bytes/digest
  identical, no quarantine artifact, no salvage record, same tear on re-read.
  Sibling test pins that the same seed with a clean prefix still salvages.
  `tests/behaviour/state-torn.test.ts` gains the matching `repairTornTail` refusal
  regression (TC-STATE-010).
- [x] **7.3** `tests/behaviour/state-unknown.test.ts`: replace the tautological
  `new Set([...]).size === 4` distinctness assertion with a behavioral assertion (or
  remove it) — review finding F-2 (low).
  — Done: the Set-of-literals block is gone; four real operations (absent-store
  boundary read, undeclared-kind read, v999-header read, unterminated-ledger read)
  now produce the four outcomes and the test asserts the exact outcome list.
- [x] **7.4** Verification: `bun test tests/behaviour/state-salvage.test.ts
  tests/behaviour/state-salvage-invariants.test.ts
  tests/behaviour/state-storage-exhausted.test.ts tests/behaviour/state-unknown.test.ts
  tests/behaviour/state-index-post-salvage.test.ts tests/behaviour/state-torn.test.ts`;
  full behaviour tier `bun test tests/behaviour`; `bun run
  scripts/checks/error-table-sync.ts`; `git diff --check`. Record results in the
  Execution Log and update this phase's task evidence.
  — Done: 52/52 targeted, 1442 pass / 4 platform skips / 0 fail full behaviour tier,
  sync check entries=43 documented=43 exit 0, `git diff --check` clean; aggregate
  `pnpm check` green apart from the pre-existing branch-sync changeset assertion
  (see Execution Log). Non-vacuity proven by reverting only the `ledger.ts` fix:
  the new regression fails on byte identity and passes restored.

**Task evidence (2026-11-05)**: `analyzeTear`'s truncated-tail branch now verifies the
complete-lines prefix before returning `terminal`; a torn prefix returns topology
`mid-record` at the prefix's first break (a prefix schema mismatch returns `undefined`,
so callers refuse without writing). `repairTornTail` reuses `analyzeTear` as the same-way
guard. Regression tests: combined-shape refusal (position 3 vs coarse tail 6, byte
identity, no quarantine, no salvage record, stable re-read), clean-prefix sibling salvage,
and `repairTornTail` combined-shape refusal. F-2 vacuous Set assertion replaced with four
operation-produced outcomes. Non-vacuity: reverting only `ledger.ts` makes the combined-shape
test fail on byte identity (mutation reproduced exactly as reviewed).

**Acceptance (Phase 7)**: combined mid-record + truncated tail refuses `state.store.torn`
with zero ledger byte mutation, no quarantine artifact, no salvage record — PASSED
(TC-GH222-011 regression). Existing salvage/exhaustion/index/unknown/torn suites stay green
— PASSED (52/52 targeted, 1442/1446 full behaviour tier with 4 platform skips). Vacuous
distinctness assertion gone — PASSED.

**Acceptance Criteria**:

- Must: salvage on the combined mid-record + truncated-tail shape refuses
  `state.store.torn` with zero ledger byte mutation, no quarantine artifact, and no
  salvage record (AC-F3-3 holds on every tear topology; DEC-2).
- Must: all existing salvage/exhaustion/index/unknown/torn suites stay green (no
  regression on the terminal-tail happy path or the single-damage mid-record refusal).
- Should: the vacuous distinctness assertion is gone (F-2).

**Files and modules**:

- Code areas: `packages/core/src/state/ledger.ts` (updated — analyzeTear truncated-tail
  branch), `packages/core/src/state/index.ts` (updated — `repairTornTail` guard),
  `tests/behaviour/state-salvage-invariants.test.ts` (updated),
  `tests/behaviour/state-torn.test.ts` (updated — `repairTornTail` guard regression),
  `tests/behaviour/state-unknown.test.ts` (updated).
- System docs: none — `doc/spec/features/feature-state-layer.md` already states the
  correct invariant; the code was wrong, not the doc.

**Tests**:

- TC-GH222-011 extension (combined tear-topology regression; rides the existing id
  per OQ-T3 precedent — no new TC id needed for a refusal-shape extension).

**Verification**:

```bash
bun test tests/behaviour/state-salvage.test.ts tests/behaviour/state-salvage-invariants.test.ts
bun test tests/behaviour/state-storage-exhausted.test.ts tests/behaviour/state-unknown.test.ts
bun test tests/behaviour/state-index-post-salvage.test.ts tests/behaviour/state-torn.test.ts
bun test tests/behaviour
bun run scripts/checks/error-table-sync.ts
git diff --check
```

**Completion signal**: `fix(GH-222): refuse salvage on mid-record tears with truncated tails`

---

## Test Scenarios

Coverage matrix — every TC-GH222-\* id maps to the phase and task that implements it; every AC
lands through at least one phase. TC-GH222-018 intentionally spans two phases: its rows/sync
half lands with the tables (Phase 1) and its nine-code trigger sweep completes once both new
codes are triggerable (Phase 5); committing the sweep earlier would not be green.

| TC ID | Scenario | Phase (task) | AC |
|-------|----------|--------------|----|
| TC-GH222-001 | Framing break and truncated tail classify as torn | 2 (2.4) | AC-F1-1, AC-F2-1 |
| TC-GH222-002 | Sequence gap, duplicate, reset classify as torn | 2 (2.4) | AC-F1-1, AC-F2-1 |
| TC-GH222-003 | Checksum mismatch classifies as torn | 2 (2.4) | AC-F1-1, AC-F2-1 |
| TC-GH222-004 | Undeclared kind/schema → `state.store.unknown`; version mismatch distinct | 4 (4.5) | AC-F1-1 |
| TC-GH222-005 | Classification evidence hygiene; verified-empty distinctness | 2 (2.5) | AC-F1-1, AC-F2-1 |
| TC-GH222-006 | Write-boundary schema validation refuses nonconforming records | 4 (4.4) | AC-F1-1 |
| TC-GH222-007 | Salvage happy path: truncate, record, quarantine, evidence | 3 (3.6) | AC-F3-1 |
| TC-GH222-008 | Salvage preserves pre-tear records byte-for-byte | 3 (3.6) | AC-F3-1 |
| TC-GH222-009 | Post-tear bytes quarantined, never served as content | 3 (3.6) | AC-F3-1 |
| TC-GH222-010 | Reads never repair: torn reads byte-side-effect-free | 3 (3.7) | AC-F3-2 |
| TC-GH222-011 | Salvage on mid-record tear refuses, zero byte mutation | 3 (3.7) | AC-F3-3 |
| TC-GH222-012 | Rebuild from ledger alone: absent and corrupt index | 2 (2.7) | AC-F4-1 |
| TC-GH222-013 | Divergent index rebuild converges and is reported | 2 (2.7) | AC-F4-1 |
| TC-GH222-014 | Post-salvage ledger rebuilds index from log alone | 3 (3.8) | AC-F4-1 |
| TC-GH222-015 | Append under injected exhaustion is fail-closed | 2 (2.6) | AC-F5-1 |
| TC-GH222-016 | Derived-document replace under exhaustion keeps previous version | 2 (2.6) | AC-F5-1 |
| TC-GH222-017 | Salvage write under exhaustion leaves ledger unchanged | 3 (3.9) | AC-F5-1 |
| TC-GH222-018 | Both tables declare new rows; sync zero drift; nine-code trigger sweep | 1 (1.7) + 5 (5.3) | AC-F5-2 |
| TC-GH222-019 | Error-table sync non-vacuous for new/refined rows | 1 (1.7) | AC-F5-2 |
| TC-GH222-020 | Artifact-boundary verdict matrix (four verdicts, reusable) | 4 (4.3) | AC-F1-1, AC-F6-1 |
| TC-GH222-021 | Retro-registry stand-in: violations and unknowns classified | 4 (4.3) | AC-F6-1 |
| TC-GH222-022 | Ceremony-artifact stand-in: malformed and unknown classified | 4 (4.3) | AC-F6-1 |
| TC-GH222-023 | Delivery registry verified reads and torn classification preserved | 5 (5.2) | AC-F1-1, AC-F2-1 |

Acceptance-criteria landing: AC-F1-1 → Phases 2, 4, 5; AC-F2-1 → Phases 2, 5; AC-F3-1 → Phase 3;
AC-F3-2 → Phase 3; AC-F3-3 → Phase 3; AC-F4-1 → Phases 2, 3; AC-F5-1 → Phases 2, 3; AC-F5-2 →
Phases 1, 5; AC-F6-1 → Phase 4. Interface coverage: EVT-1, DM-1 → Phase 3; DM-2, DM-3 → Phase 3;
DM-4 → Phase 4. NFR coverage: NFR-1 → 2, 4; NFR-2, NFR-3 → 3; NFR-4 → 2, 3; NFR-5 → 2, 3;
NFR-6 → 1, 5; NFR-7 → 3.

## Artifacts and Links

| Artifact | Location | Type |
|----------|----------|------|
| Change specification (v1.1) | `./chg-GH-222-spec.md` | Spec |
| Test plan (23 cases) | `./chg-GH-222-test-plan.md` | Test plan |
| Implementation plan (this file) | `./chg-GH-222-plan.md` | Plan |
| PM notes / decisions | `./chg-GH-222-pm-notes.yaml` | Notes |
| Current system truth (state layer) | `doc/spec/features/feature-state-layer.md` | System spec (reconciled in Phase 6) |
| Error-table contract (documented table) | `doc/spec/features/feature-result-contract.md` | System spec (rows in Phase 1; prose in Phase 6) |
| TypeScript workspace rules | `.ai/rules/typescript.md` | Rules |
| Testing strategy | `.ai/rules/testing-strategy.md` | Rules |
| Error-table sync check | `scripts/checks/error-table-sync.ts` (+ `tests/checks/error-table-sync.test.ts`) | Binding check |
| State test harness | `tests/fixtures/state/harness.ts` | Fixture |

## Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-05 | @plan-writer | Initial plan: 6 phases (contracts/error tables → tear topology + exhaustion seam → salvage → boundary/artifact contracts → registry wiring + nine-code sweep → gates/changeset/spec reconciliation); all 23 TC ids mapped; DEC-5 rows + refined remediations pinned to Phase 1 with both tables and the sync check; OQ-T1 fault-point names fixed (`salvage-quarantine-write`, `salvage-ledger-write`); spec §22 vs §8.5 tension on the `state.store.torn` remediation text flagged for DoR with the in-plan resolution |
| 1.1 | 2026-11-05 | @reviewer | Appended Phase 7 (Code Review Remediation, iteration 1): review finding F-1 — analyzeTear's truncated-tail shortcut misclassifies a mid-record break + truncated tail as terminal, so salvage mutates bytes then fails `state.store.torn` claiming `not_landed` (AC-F3-3/DEC-2 violation, empirically reproduced); tasks 7.1–7.4 add the prefix-verification fix, a combined-shape TC-GH222-011 regression, the F-2 vacuous-assertion cleanup, and the verification block |
| 1.2 | 2026-11-05 | @coder | Phase 7 execution record: `repairTornTail` took the same-way `analyzeTear` guard (plan 7.1 option) with a `state-torn.test.ts` regression, so that file joins the Phase 7 code areas; no follow-up ticket needed |

## Execution Log

| Phase | Status | Started | Completed | Commit | Notes |
|-------|--------|---------|-----------|--------|-------|
| 1 — Contracts, vocabulary, and synced error tables | Done | 2026-11-05 | 2026-11-05 | 0684212d | `error-table-sync` entries=43 documented=43 exit 0; targeted suites 105 pass (error-table-sync, error-table, state-contract), state-error-classification 8 pass; `git diff --check` clean. Deliberate baseline regeneration: `BASELINE_ROWS + 9`, frozen state rows repinned to the refined texts. Fixtures updated: corpora, contract export inventory, content inventory. |
| 2 — Tear topology, exhaustion seam, and fail-closed write boundaries | Done | 2026-11-05 | 2026-11-05 | 2ba51d72 | Verification block: torn+evidence 34 pass; storage-exhausted 5 pass; index 10 pass; keys+atomic-replace 13 pass regressions. Broader regression sweep (state-fence, state-permissions, state-error-classification, state-conformance, content-inventory, state-imports, state-scope, packed-state) 48 pass. No SQLite skip needed on this runtime. New module `state/storage-error.ts` registered in the inventory + executable allowance. |
| 3 — Explicit guided tail salvage with quarantine | Done | 2026-11-05 | 2026-11-05 | fac0e764 | Verification block: salvage + invariants 11 pass; post-salvage + storage-exhausted 9 pass; permissions + fence 18 pass; `error-table-sync` entries=43 documented=43 exit 0. Broader sweep (15 suites incl. torn/evidence/index/keys/atomic-replace/error-classification/conformance/registry/content-inventory/imports/scope/contract/packed-state) 130 pass; verify suites 59 pass. OQ-T3: clean-ledger salvage is a reported no-op (TC-GH222-024 candidate). |
| 4 — Reusable boundary validation and artifact-boundary contracts | Done | 2026-11-05 | 2026-11-05 | d09cf619 | Verification block: artifact-boundary + unknown + boundary-validation 15 pass; state-contract/imports/scope 22 pass; packed-state 1 pass; content-inventory 6 pass; `git diff --check` clean. New module `state/artifact-boundary.ts` registered in the inventory + executable allowance. |
| 5 — Delivery-registry wiring and the nine-code trigger sweep | Done | 2026-11-05 | 2026-11-05 | 5d854030 | Verification block: phase-registry + error-classification 28 pass; full behaviour tier 1438 pass / 4 platform skips / 1 pre-existing pm-notes corpus failure (duplicate `completed` key, PM-owned, outside scope); structure+boundaries+packed-state 521 pass; sync check entries=43 documented=43 exit 0; `git diff --check` clean. OQ-T2: matrix enumerates cases, not operations → no change. Repaired Phase-3 port-surface assertion (`state-ledger.test.ts`) and updated GH-179 corrupt-payload expectations to the new boundary classification. |
| 6 — Finalize: gate battery, changeset, spec reconciliation | Done (with one pre-existing out-of-scope failure) | 2026-11-05 | 2026-11-05 | (this commit) | lint + format:check + typecheck pass; `pnpm test` 2477 pass / 4 platform skips / 1 fail (pre-existing PM-owned pm-notes duplicate `completed` key, HEAD defect, outside scope); `pnpm check:boundaries` pass; `exports-parity` pass; sync check entries=43 documented=43 exit 0; error-table-sync tests 54 pass; `git diff --check` clean. Changeset `.changeset/gh-222-state-validation-minor.md` (minor, lockstep). System spec reconciled (state layer + result-contract prose). Test plan §10 populated. |
| 7 — Code Review Remediation (Iteration 1) | Done | 2026-11-05 | 2026-11-05 | (this commit) | F-1: `analyzeTear` verifies the complete-lines prefix before `terminal`; a torn prefix yields `mid-record` at the prefix break. `repairTornTail` gained the same-way guard (pure-terminal truncation unchanged). TC-GH222-011 combined-shape regression + clean-prefix sibling + `repairTornTail` combined-shape regression; F-2 tautology replaced by four operation-produced outcomes. Verification: targeted 6-file block 52 pass; full behaviour tier 1442 pass / 4 platform skips / 0 fail; sync check entries=43 documented=43 exit 0; `git diff --check` clean; `pnpm check` green through lint/format/typecheck/test except one pre-existing branch-sync assertion (`privacy-release` TC-RELEASE-001 expects `.changeset/gh-221-watchdog-lane-contracts-minor.md`, which exists on `origin/main-tools` one commit ahead of this branch; reproduced at HEAD with the Phase 7 diff stashed — not caused by this phase, PM resolves at PR branch sync); `pnpm check:boundaries` pass (145 modules / 317 deps). Non-vacuity: with only the `ledger.ts` fix reverted the new regression fails on byte identity. |
| — | Not started | — | — | — | Later phases (review_fix, quality_gates, dod_check, pr_creation) are PM-orchestrated and outside this run's scope. |
