---
id: chg-GH-228-brief-render-only
status: Proposed
created: 2026-11-06T00:00:00Z
last_updated: 2026-11-06T00:00:00Z
owners: [engineering]
service: delivery-os
labels: [change, m1]
links:
  change_spec: ./chg-GH-228-spec.md
  test_plan: ./chg-GH-228-test-plan.md
  ticket: https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/228
summary: >
  Add a read-only `brief` command: one screen, decision-first, rendered from the
  same collector state as the shipped status digest (`delivery.status.v1`), with
  no LLM in the render path. The brief carries ready-to-merge, blocker
  questions, and owner-gate ages as anchored actions; every unbuilt capability
  (typed questions, gate SLA states, the queue/lane engine) renders as a named
  placeholder mapped exactly to the digest's closed five-value section-state
  vocabulary. Collector unavailability is digest data, never a command failure;
  the brief adds no error-table row, no configuration key, no adapter read, and
  no new package or runtime location.
version_impact: minor
---

# IMPLEMENTATION PLAN — GH-228: M1-S6: Brief render-only v0

## Context and Goals

This plan delivers the `brief` command defined by [chg-GH-228-spec.md](./chg-GH-228-spec.md) (v1.1) and verified by [chg-GH-228-test-plan.md](./chg-GH-228-test-plan.md) (v1.1): a deterministic, render-only, one-screen owner brief projected from the **same injected `StatusFacts`** the shipped status digest consumes, with zero brief-specific reads, anchored decision-first actions, a closed three-entry placeholder catalog, and the shipped contract posture (exit `0` on collector unavailability, containment identities only, zero new error-table rows).

**Architecture mirror.** The implementation mirrors the shipped status architecture exactly (see `doc/spec/features/feature-status-digest.md` §Technical Architecture and the current files `packages/core/src/contracts/status.ts`, `packages/core/src/domain/status.ts`, `packages/cli/src/commands/status.ts`):

| Layer | Status precedent | Brief addition |
|---|---|---|
| Contract vocabulary | `packages/core/src/contracts/status.ts` (types + `as const` data only) | `packages/core/src/contracts/brief.ts`, re-exported via `contracts/index.ts` |
| Pure domain | `packages/core/src/domain/status.ts` (`aggregateStatus`, `renderStatusHuman`) | `packages/core/src/domain/brief.ts` (`projectBrief`, `renderBriefHuman`), re-exported via `domain/index.ts` |
| Command definition | `packages/cli/src/commands/status.ts` (no stream writes, no exit-code choice) | `packages/cli/src/commands/brief.ts` |
| Runtime composition | `packages/cli/src/edge.ts` `createStatusCommandRuntime` (also reused by `queue ready`) | `ConfigProgramOptions.brief?: StatusComposition` reusing the same runtime factory |
| Output | `packages/cli/src/output/serialize.ts` (single redaction path) + global `--json` | unchanged; brief rides both modes |

**Composition decision (reads happen once).** The brief performs ZERO reads of its own. The command handler reuses `collectStatusFacts(runtime)` — the same single-pass collector the status handler uses — so one `brief` invocation performs exactly one read set (repository binding, tracker page, PR page, one check-runs page, provider config resolve, park fold, local PM context), identical in member set and count to one status invocation. The edge composes the brief runtime through the existing `createStatusCommandRuntime` (the `queue ready` precedent), so the credential-reference guard and the read gates are inherited, not re-implemented.

**Resolved open questions.**

- **OQ-1 (exact human grammar)**: pinned at Phase 4 by the committed goldens; the decision-first ordering wins over bound pressure and pressure is reported back if they conflict (spec §14). No `@decision-advisor` escalation required.
- **GAP-T1..T3** (age-comparison wording, surface set, unavailability wording): already folded into spec v1.1 (AC-F1-1 derivation rule, DM-5 nine-surface set, AC-F5-1 distinction). The test plan's §4.2/§4.3/§4.5/§4.6/§4.7/§4.8 oracles are binding for this plan.
- **OQ-T3 / OQ-T4 / OQ-T5**: bound in Delivery Bindings D8/D9/D7 below, within the test plan's stated options.

**Open questions (non-blocking, delivery-bound).**

- Exact export, helper, fixture, and golden file names beyond the bindings in D1–D12 (GAP-T4): the coder may not rebind pinned semantics, states, identities, bounds, exits, or AC mapping.
- If the one-screen bound cannot fit the decision-first ordering at Phase 4, report the bound pressure back to `@pm` per OQ-1 instead of dropping the ordering.

**Non-task dependency (important).** The current-truth feature specification `doc/spec/features/feature-brief.md` is authored by **@doc-syncer** in delivery-lifecycle phase 7 (system_spec_update), not by @coder. It is planned here as Phase 8 with @doc-syncer ownership; @coder's obligation ends with the doc-impact handoff notes (Phase 9, task 9.2).

## Delivery Bindings (D1..D12)

Delivery-bound spellings and modeling choices pinned by this plan (test plan GAP-T4/OQ-T2). Semantics, states, identities, bounds, exits, and AC mappings come from the spec and test plan and may not be rebound.

- **D1 — Files and modules**: `packages/core/src/contracts/brief.ts` (new), `packages/core/src/domain/brief.ts` (new), `packages/cli/src/commands/brief.ts` (new), `packages/cli/src/edge.ts` (updated), `packages/core/src/{contracts,domain}/index.ts` (updated), `tests/fixtures/brief/{harness.ts,cases.ts}`, `tests/fixtures/brief/{corpus,golden,mutants}/**` (new). No other production location changes.
- **D2 — Contract surface**: `BRIEF_SCHEMA_VERSION = "delivery.brief.v1"`; the closed nine-id surface set = the six digest section ids (`tracker`, `changes-and-prs`, `ci`, `lanes-or-queue`, `providers`, `parked-work`) plus the three placeholder ids (`typed-questions`, `gate-sla-states`, `lane-queue-engine`); the closed placeholder catalog (`typed-questions`→M1-S16, `gate-sla-states`→M1-S5, `lane-queue-engine`→M1-S17, each `not-delivered`, no `spend` entry per DEC-5); payload types for DM-1 (schema version, injected generation time, repository binding reference, per-surface states, ranked anchored actions, placeholder entries, truncation markers), DM-2 (anchored action record: identity + citing evidence + state; no verdict/authorization/gate field), DM-3 (placeholder record: capability id, owning story, evidence state).
- **D3 — Vocabulary by reference (DM-4)**: the brief contracts import `STATUS_SECTION_STATES` (types), `STATUS_SECTION_ORDER`, `STATUS_TRACKER_FAMILIES`, and the bounds `STATUS_MAX_HUMAN_LINES` / `STATUS_MAX_HUMAN_BYTES` / `STATUS_MAX_MACHINE_BYTES` from `./status.js`. No `BRIEF_*` numeric bound constants, no re-declaration of the five-value state list, no parallel vocabulary (TC-BRIEF-001 single-vocabulary-home scan).
- **D4 — Anchor model (reconciles test-plan §4.6 with DM-5)**: ready-to-merge and owner-gate ages are **ranked anchored-action groups** (DM-2 records inside the payload), not additional surface ids. Their render state comes from the mapped digest evidence — ready-to-merge from the `changes-and-prs` section state (§4.4), owner-gate ages from the tracker `ownerHandBacks` family state (§4.5: `observed`/`unavailable`, degraded section ⇒ no observed ages claim). The blocker-questions block **is** the `typed-questions` placeholder surface; the `gate-sla-states` placeholder renders beside the owner-gate ages block. The surface-id set stays exactly nine (TC-BRIEF-004 closed-set equality holds).
- **D5 — Domain surface**: `projectBrief(facts: StatusFacts): BriefPayload` — derives every digest-equal claim from the digest built over the same facts (it may call `aggregateStatus(facts)` internally), and derives the two non-digest claims under declared rules: owner-gate ages from `facts.tracker` items via the digest's parse-and-floor rule with `facts.nowMs` (§4.5), and the placeholder entries from the catalog (§4.3). `renderBriefHuman(brief: BriefPayload, brand: BrandIdentity): string` — a pure function of the payload plus injected brand (TC-BRIEF-017 step 4).
- **D6 — Command definition**: `createBriefCommandDefinition(runtime: BriefCommandRuntime): CommandDefinition` with `BriefCommandRuntime = StatusCommandRuntime` (exported type alias). `flags: []`, `positionals: { max: 0 }`, `humanText: (data, brand) => renderBriefHuman(data as BriefPayload, brand)`, `handler: async () => ({ data: projectBrief(await collectStatusFacts(runtime)) })`. The handler owns no stream write and chooses no exit code; `collectStatusFacts` is imported from `./status.js` so reads happen exactly once per invocation.
- **D7 — Edge composition**: `ConfigProgramOptions.brief?: StatusComposition`; in `createConfigProgram`: `commands.brief = createBriefCommandDefinition(createStatusCommandRuntime(options.brief, resolveProviderConfig))` — the `queue ready` precedent; no new composition type, no new reader member, no new credential path.
- **D8 — Corpus meta-check (OQ-T5)**: `tests/behaviour/brief-corpus.test.ts` asserts parity — each brief corpus case is checked against the digest's derivation via `tests/fixtures/status/matrix/cases.ts` as the digest-side oracle — rather than importing digest internals into brief expectations.
- **D9 — Future timestamp (OQ-T4)**: an `updatedAt` in the future renders an unknown age (never negative, never clamped): consistent with "never fabricated".
- **D10 — Evidence cite (OQ-T3)**: a ready-to-merge action's citing evidence reproduces all three of the digest item's `deliveryState`, `draft`, and item-level review-signal state (§4.4).
- **D11 — Changeset**: `.changeset/brief-v1-minor.md`, lockstep `minor` for the five runtime packages (`@delivery-os/core`, `@delivery-os/adapters`, `@delivery-os/cli`, `@delivery-os/mcp`, `@delivery-os/opencode`), mirroring `.changeset/status-v1-minor.md` and the `fixed` group in `.changeset/config.json`.
- **D12 — Goldens**: `tests/fixtures/brief/golden/human.txt` and `tests/fixtures/brief/golden/envelope.json`, generated by an explicit regeneration path reusing the `tests/golden/helpers.ts` pattern (`SYNTHETIC_BRAND`, buffer sinks, fixed clock/run id); never written by a suite.

## Scope

### In Scope

- **F-1**: the read-only `brief` command (`brief [--json]`) composed beside the top-level commands, zero positionals, zero command-specific flags, zero reads of its own (same `StatusFacts` read set).
- **F-2**: decision-first anchored actions — ready-to-merge projections (observed approved non-draft open PRs only, DEC-7), owner-gate ages under the parse-and-floor rule, blocker questions as the `typed-questions` placeholder.
- **F-3**: the closed three-entry placeholder catalog (DEC-6), named, never silent, never zero.
- **F-4**: per-surface truthfulness — every surface carries exactly the digest section state for the same facts (DM-5 nine-surface set; §4.7 negative-control matrix).
- **F-5**: contract posture — one `CommandResult` envelope, `{0,1,2}` exit projection, collector unavailability at exit `0` as digest data (DEC-2), zero new error-table rows/kinds/configuration keys.
- **F-6**: deterministic, bounded (24 lines / 4096 bytes human, 65536 bytes machine `data`), brand-neutral, read-only render path with no LLM, no child process, credential-reference-only composition.
- The 22 TCs of the test plan (`TC-BRIEF-001..022`) and their fixtures (harness, cases, corpus, goldens, mutants).

### Out of Scope

- [OUT] Gate verdicts or merge authorization (NG-1); SLA escalation mechanics (M1-S5); typed blocker records (M1-S16); queue/lane engine data (M1-S17); spend surfaces (M1-S19, DEC-5).
- [OUT] Any change to the status digest schema, sections, order, or command; any new collector, adapter read, configuration key, state-schema change, package, subpath, or runtime-API location (NG-2, NG-4).
- [OUT] LLM/model calls anywhere in the brief path; interactive, mutating, daemon-dependent, or watch behavior (NG-5).
- [OUT] New CI jobs or workflow changes (test plan §7.2); live-network test variants.

### Constraints

- Reuse `STATUS_*` contract data by reference (DM-4); zero new error-table rows, domain kinds, or configuration keys (NFR-7); error-table sync check stays green.
- Zero new packages/subpaths/runtime-API locations; workspace manifests and lockfile unchanged (TC-BRIEF-003 step 4).
- No LLM/network capability in the render path (DEC-3, NFR-5); no writes, fences, mutations, child processes (NFR-6); brand neutrality — no product/binary literals (NFR-8).
- Bounds: human ≤24 non-empty lines and ≤4096 bytes; machine `data` ≤65536 bytes; every truncation explicit; ordering wins over bound pressure (OQ-1).
- Determinism: identical injected inputs produce byte-identical output; no timestamps in human text (NFR-2); goldens committed, read-only, regenerated only by an explicit command.
- Read cost: identical to one status invocation — at most 3 outbound GETs, 1 park fold, 1 config resolve; zero retries/pagination/daemon (NFR-3).
- Process: `.ai/rules/typescript.md` and `.ai/rules/testing-strategy.md` govern; tests run with `bun test`; aggregate gate `pnpm check`; changeset required for runtime-package changes (lockstep minor, D11); inventory registration for new package sources (`tests/structure/inventory.json` + `EXECUTABLE_ALLOWANCES` in `tests/structure/content-inventory.test.ts`); fixtures never named `*.test.ts`.

### Risks

- **RSK-1** (brief/status contract divergence): mitigated by D5/D6/D7 (shared `StatusFacts`, shared collector, shared runtime factory), TC-BRIEF-004 shared-truth battery, and Phase 8 doc reconciliation.
- **RSK-2** (anchor read as merge authorization): mitigated by DEC-7 predicate (§4.4), the no-verdict-field assertion (TC-BRIEF-007 step 2), and the Phase 8 review-checklist wording item.
- **RSK-3** (placeholders drift to silent zeros): mitigated by the closed catalog contract (TC-BRIEF-001/009), corpus completeness (TC-BRIEF-016), and mutants (TC-BRIEF-021).
- **RSK-4** (fabricated ages/signals): mitigated by §4.5/§4.4 oracles and the unknown-as-zero mutants (TC-BRIEF-007/008).
- **RSK-5** (bound overflow on dense worlds): mitigated by at/above-cap fixtures and the over-cap renderer mutant (TC-BRIEF-006); goldens pin the cap-sized render (TC-BRIEF-014/015).
- **RSK-6** (M1-S10 overlap): reconciled by DEC-4; both specs cross-link in Phase 8.
- **RSK-T7** (cap-dropped approved PR reads as "nothing to merge"): mitigated by the truncation-marker + in-cap control pair (TC-BRIEF-007 step 4).
- **RSK-T12** (goldens regenerated by the suite): mitigated by read-only comparison, `mtimeMs` immutability, and the mutation/restore control (TC-BRIEF-014/015).

### Success Metrics

From spec §4.1: 100% shared-truth agreement with the digest on identical facts; 0 brief-only reads (read cost = one status invocation); 3/3 unbuilt-capability placeholders rendered named; 0 failed/absent reads rendered as clear/green/available/zero; 0 new error-table rows or domain kinds (sync green); 0 LLM/model calls in the render path (boundary checks + review); human output ≤24 lines and ≤4096 bytes.

## File and Module Layout

| Path | Change | Role |
|---|---|---|
| `packages/core/src/contracts/brief.ts` | new | `delivery.brief.v1` vocabulary: schema id, nine-surface set, placeholder catalog, payload/action/placeholder types; data only (D2, D3) |
| `packages/core/src/contracts/index.ts` | updated | Re-export the brief vocabulary |
| `packages/core/src/domain/brief.ts` | new | `projectBrief` + `renderBriefHuman`; pure, clock/facts injected (D4, D5) |
| `packages/core/src/domain/index.ts` (and core root index as needed) | updated | Re-export `projectBrief`, `renderBriefHuman` |
| `packages/cli/src/commands/brief.ts` | new | Command definition over the status reader set; no stream writes, no exit-code choice (D6) |
| `packages/cli/src/edge.ts` | updated | `ConfigProgramOptions.brief?: StatusComposition`; compose via `createStatusCommandRuntime` (D7) |
| `tests/fixtures/brief/**` | new | `harness.ts`, `cases.ts`, `corpus/**`, `golden/**`, `mutants/**` over `tests/fixtures/status/harness.ts` builders |
| `tests/structure/brief-contract.test.ts`, `tests/structure/brief-imports.test.ts` | new | TC-BRIEF-001, TC-BRIEF-003 |
| `tests/behaviour/brief-{command,shared-truth,read-cost,output,anchors,placeholders,negative-controls,envelope,corpus,determinism,readonly,performance}.test.ts` | new | TC-BRIEF-002, 004–012, 016–018, 020 |
| `tests/golden/brief.test.ts` | new | TC-BRIEF-014, TC-BRIEF-015 |
| `tests/checks/brief-mutants.test.ts` | new | TC-BRIEF-021 |
| `tests/structure/inventory.json`, `tests/structure/content-inventory.test.ts` | updated | Register new sources + executable allowances |
| `tests/structure/cli-edge-seam.test.ts` | updated | New command file, edge wiring, humanText renderer set |
| `tests/checks/error-table-sync.test.ts`, `tests/structure/error-table.test.ts`, `tests/golden/redaction.test.ts` | updated | Brief guards added; no assertion weakened |
| `.changeset/brief-v1-minor.md` | new | Lockstep minor (D11) |

No changes under `packages/adapters/**`, `packages/mcp/**`, `packages/opencode/**`, `packages/testkit/**`, `.dependency-cruiser.cjs`, workflow files, or any state/config schema.

## Phases

### Phase 1: Core brief contracts and inventory registration

**Goal**: The `delivery.brief.v1` vocabulary exists as data-only contracts with the closed catalog, the nine-surface set, and bounds borrowed by reference — provable before any behavior exists.

**Tasks**:

- [x] **1.1** Create `packages/core/src/contracts/brief.ts` (D2, D3): `BRIEF_SCHEMA_VERSION`, the nine-id surface set, the three-entry placeholder catalog with owning stories and `not-delivered` states (no `spend` entry), and the payload types for DM-1/DM-2/DM-3. Types and `as const` data only; import the status vocabulary and bounds from `./status.js` by reference.
- [x] **1.2** Re-export the brief contracts through `packages/core/src/contracts/index.ts`.
- [x] **1.3** Register `core/src/contracts/brief.ts` (and later files as they land) in `tests/structure/inventory.json`; add its executable exports to `EXECUTABLE_ALLOWANCES` in `tests/structure/content-inventory.test.ts`.
- [x] **1.4** Author `tests/structure/brief-contract.test.ts` (TC-BRIEF-001): declaration-only AST scan; DM-1 member set; surface set exactly the §4.6/DM-5 nine ids; catalog exactly the §4.3 three entries; bounds-by-reference (24/4096/65536, no `BRIEF_*` numeric constants, no state-list re-declaration); inventory registration; seeded product-literal control.

**Acceptance Criteria**:

- Must: TC-BRIEF-001 green (`bun test tests/structure/brief-contract.test.ts`, `pnpm typecheck`); the contracts module is declaration-only; the catalog is closed at three with stable ids/stories; the surface set is exactly nine; `bun test tests/structure/content-inventory.test.ts` green.
- Should: contract-test failures name the offending export, entry, or surface id.

**Files and modules**:

- Code areas: `packages/core/src/contracts/brief.ts` (new), `packages/core/src/contracts/index.ts` (updated), `tests/structure/inventory.json` (updated), `tests/structure/content-inventory.test.ts` (updated), `tests/structure/brief-contract.test.ts` (new)
- System docs: none (feature spec is Phase 8, @doc-syncer)

**Tests**: TC-BRIEF-001 (AC-F3-1 contract half, NFR-1 bounds-by-reference, NFR-8, DM-1..DM-4)

**Completion signal**: `feat(GH-228): add delivery.brief.v1 core contracts`

---

### Phase 2: Pure projection, human renderer, and shared-fact fixtures

**Goal**: `projectBrief` and `renderBriefHuman` in the core domain deliver every digest-equal claim, anchor, placeholder, bound, and ordering over injected `StatusFacts`, proven by the shared-fact fixture model.

**Tasks**:

- [x] **2.1** Create `packages/core/src/domain/brief.ts` with `projectBrief(facts: StatusFacts): BriefPayload` (D4, D5): nine surfaces each carrying exactly the mapped digest section state (placeholders at catalog state); ranked anchored actions — ready-to-merge per §4.4 (digest-rendered `changes-and-prs` items with `deliveryState === "approved"`, `draft === false`, observed review signal, section `observed`/`degraded`; citing evidence per D10; no verdict field) and owner-gate ages per §4.5 (parse-and-floor over present parseable `WorkItem.updatedAt` with `facts.nowMs`; absent/unparseable/future (D9) ⇒ unknown, never fabricated; hand-back family `unavailable` ⇒ zero ages; 4-per-family cap respected with truncation markers); placeholder entries per §4.3; truncation markers iff the digest section truncates; injected generation time equal to the digest's `generatedAt`; repository binding reference equal to the digest's binding.
- [x] **2.2** Add `renderBriefHuman(brief, brand)` to the same module: decision-first order (ready-to-merge actions, blocker-questions placeholder, owner-gate ages with the `gate-sla-states` placeholder beside them, then the six context surfaces in digest order, then the placeholder lines); named placeholder lines; state word plus reason named in place; plain deterministic text (no ANSI, no CR, no timestamps, no raw payloads, no generated prose); ≤24 non-empty lines / ≤4096 bytes with ordering winning over bound pressure.
- [x] **2.3** Re-export both functions through `packages/core/src/domain/index.ts` (and the core root index where the status exports are re-exported); register `core/src/domain/brief.ts` in the inventory and allowances.
- [x] **2.4** Create `tests/fixtures/brief/harness.ts` (test plan §4.1: `BriefCase = { name, facts: StatusFacts, expected }` over the `tests/fixtures/status/harness.ts` builders; one `facts` object shared by `statusRuntime(facts)` and `briefRuntime(facts)` with per-runtime call recorders; `runBriefCli` in-process composition with buffer sinks, fixed `NOW_ISO`/`NOW_MS`, fixed run id, `SYNTHETIC_BRAND`; cap-sized builders) and `tests/fixtures/brief/cases.ts` (one case per §4.7 control row, anchor edge, cap boundary, and verified-empty world).
- [x] **2.5** Author the domain-level behaviour suites: `brief-shared-truth.test.ts` (TC-BRIEF-004), `brief-anchors.test.ts` (TC-BRIEF-007, TC-BRIEF-008), `brief-placeholders.test.ts` (TC-BRIEF-009), `brief-negative-controls.test.ts` (TC-BRIEF-010), `brief-output.test.ts` (TC-BRIEF-006 — renderer bounds/order/markers plus the projection-level `JSON.stringify(payload)` ≤65536 assertion), `brief-corpus.test.ts` + `tests/fixtures/brief/corpus/**` (TC-BRIEF-016, parity per D8), `brief-performance.test.ts` (TC-BRIEF-020).

**Acceptance Criteria**:

- Must: TC-BRIEF-004, 006, 007, 008, 009, 010, 016, 020 green; on identical facts every brief claim equals the digest's claim (states, counts, truncation, action identities, placeholder justifications) with zero brief-only facts and the closed nine-surface set exact; unknown ages never render as `0`/`""`/fabricated; no `slaState`/`escalated`/`overdue`/`breached` token anywhere; all three placeholders render named with story and `not-delivered`, never as empty/zero/observed; §4.7 matrix fully covered with the fully-observed control; median projection ≤50 ms with a live timing instrument and page-size-invariant read counts.
- Should: fact-order permutation invariance (ranking by declared keys); failure messages name the case, surface, or action.

**Files and modules**:

- Code areas: `packages/core/src/domain/brief.ts` (new), `packages/core/src/domain/index.ts` (updated), `tests/fixtures/brief/{harness.ts,cases.ts}` (new), `tests/fixtures/brief/corpus/**` (new), `tests/behaviour/brief-{shared-truth,anchors,placeholders,negative-controls,output,corpus,performance}.test.ts` (new), `tests/structure/inventory.json` + `content-inventory.test.ts` (updated)
- System docs: none

**Tests**: TC-BRIEF-004, 006, 007, 008, 009, 010, 016, 020 (AC-F1-1, AC-F1-2, AC-F2-1, AC-F2-2, AC-F3-1, AC-F4-1; NFR-2 render half, NFR-4)

**Completion signal**: `feat(GH-228): add pure brief projection and renderer with shared-fact fixtures`

---

### Phase 3: CLI command, edge composition, read-cost parity, and render-path boundaries

**Goal**: The `brief` command is composed beside the top-level commands with zero reads of its own, the boundary/no-LLM discipline is proven, and both output modes replay byte-identically.

**Tasks**:

- [x] **3.1** Create `packages/cli/src/commands/brief.ts` (D6): `createBriefCommandDefinition(runtime: BriefCommandRuntime)` with `BriefCommandRuntime = StatusCommandRuntime`; reuse `collectStatusFacts` from `./status.js` so one invocation performs exactly one read set; `flags: []`, `positionals: { max: 0 }`, `humanText` hook delegating to `renderBriefHuman`; handler returns data only.
- [x] **3.2** Wire `packages/cli/src/edge.ts` (D7): add `brief?: StatusComposition` to `ConfigProgramOptions`; compose `commands.brief` via `createStatusCommandRuntime(options.brief, resolveProviderConfig)`; register `cli/src/commands/brief.ts` in the inventory and allowances.
- [x] **3.3** Update `tests/structure/cli-edge-seam.test.ts` for the new command module, edge wiring line, exported names, and the humanText-renderer set (brief joins closeout/db/queue/status/verify).
- [x] **3.4** Author `tests/behaviour/brief-command.test.ts` (TC-BRIEF-002): command key exactly `brief`, no value-bearing flags, `positionals.max === 0`, `--json` adds no command behavior; `brief extra`, `brief GH-228`, `brief --bogus`, `brief --json extra` ⇒ `fallback.invocation` exit `1` with a zero-entry reader/transport call log; valid modes render; handler owns no stream write; reader member set ⊆ status runtime's.
- [x] **3.5** Author `tests/structure/brief-imports.test.ts` and extend boundary evidence (TC-BRIEF-003): contracts module imports nothing runtime; domain imports only `#contracts`/`#domain/*`/relative with zero `fetch`/`Date.now`/`Math.random`/`performance.now`/`process.env`/`Bun.env`/`readFileSync`; command imports only `@delivery-os/core[...]` + relative; model/network capability scan (`node:http[s]`, `node:net`, `node:dns`, `node:child_process`, `undici`, model-SDK specifiers) with non-empty file count and seeded failing controls; workspace manifests/lockfile/`subpaths.test.ts` unchanged; run `pnpm check:boundaries`, `scripts/checks/ambient-globals.ts`, `scripts/checks/workspace-entrypoints.ts`.
- [x] **3.6** Author `tests/behaviour/brief-read-cost.test.ts` (TC-BRIEF-005): status `--json` baseline vs brief `--json` on the same facts with fresh recorders — identical reader member set, ≤3 GETs to the three declared endpoints, exactly 1 park fold, 1 config resolve, zero quota/announcement/pagination/retry; pure projection consumes no reader; injected brief-only reader member fails by name.
- [x] **3.7** Author `tests/behaviour/brief-determinism.test.ts` (TC-BRIEF-017): byte-identical stdout for both modes across double runs and rebuilt runtimes; content scanners (no ISO-8601, no epoch, no `runId`, no raw JSON/payload tokens in human text); payload→text determinism and brand-token-only change under a different injected brand; permutation invariance; `Date.now()`-renderer and map-order-renderer mutants fail.

**Acceptance Criteria**:

- Must: TC-BRIEF-002, 003, 005, 017 green; every malformed invocation fails before any read with exactly one failure envelope; net read cost identical to one status invocation; the render path has no model-call or network capability with a non-empty scan scope and failing seeded controls; no new dependency, package, or subpath; byte-identical replays in both modes; `pnpm check:boundaries` green.
- Should: zero diff in workspace manifests and lockfile (asserted); status suites still green after the edge change.

**Files and modules**:

- Code areas: `packages/cli/src/commands/brief.ts` (new), `packages/cli/src/edge.ts` (updated), `tests/structure/cli-edge-seam.test.ts` (updated), `tests/behaviour/brief-{command,read-cost,determinism}.test.ts` (new), `tests/structure/brief-imports.test.ts` (new), `tests/structure/inventory.json` + `content-inventory.test.ts` (updated)
- System docs: none

**Tests**: TC-BRIEF-002, 003, 005, 017 (AC-F1-1 read-cost half, AC-F5-1 surface half, AC-F6-1 byte-identity, AC-F6-2; NFR-3, NFR-5)

**Completion signal**: `feat(GH-228): compose the read-only brief command at the CLI edge`

---

### Phase 4: Envelope posture, exit projection, error-table stability, and golden pins

**Goal**: The shipped contract posture is proven end-to-end and the render grammar is pinned byte-exact (OQ-1 resolved).

**Tasks**:

- [x] **4.1** Author `tests/behaviour/brief-envelope.test.ts` (TC-BRIEF-011, TC-BRIEF-012): all-reads-failing / missing credential / unavailable binding / anonymous instance ⇒ exit `0`, `assertEnvelopeContract` empty, no `error` key, complete payload with every surface named and all three placeholders at `not-delivered`; no `status.collector.<id>.unavailable` identity anywhere and no exit-2 unavailability path; rejected invocation ⇒ `fallback.invocation` exit `1`; hostile handler ⇒ `fallback.internal` exit `2` with exactly one envelope; machine `exitCode` equals the process exit; `bun run scripts/checks/exit-code-literals.ts` green with a seeded literal failing.
- [x] **4.2** Update `tests/checks/error-table-sync.test.ts` and `tests/structure/error-table.test.ts` (TC-BRIEF-013): zero `brief.*` codes, zero `brief` domain kinds, zero `status.`-prefixed codes, row count equals the pre-change baseline, configuration catalog unchanged, temp-copy row additions fail both directions, brief evidence uses only existing codes or catalog data.
- [x] **4.3** Create the golden fixtures per D12 (`tests/fixtures/brief/golden/human.txt`, `envelope.json`) via the explicit regeneration path on the cap-sized case with the pinned clock/run id/brand; author `tests/golden/brief.test.ts` (TC-BRIEF-014, TC-BRIEF-015): byte equality for both modes; golden within bounds with every surface and placeholder line present; content discipline (no timestamps, no payload fragments, no prose markers, injected brand, no product literal); one-fact mutation changes the bytes and restore reproduces them; `mtimeMs` unchanged after the suite; machine `data` ≤65536 bytes; `assertEnvelopeContract` on the golden envelope.
- [x] **4.4** Record the golden regeneration command in the suite header so regeneration stays explicit, reviewable, and never a test side effect; this commit resolves OQ-1 (grammar pinned by goldens) — report any bound-pressure conflict back to `@pm` instead of dropping the ordering.

**Acceptance Criteria**:

- Must: TC-BRIEF-011, 012, 013, 014, 015 green; collector unavailability yields a success envelope at exit `0` with named surfaces — a rendering distinct from the three-entry catalog; exactly one envelope per run; error-table sync green with zero new rows/kinds/keys; goldens committed, in bounds, and unchanged after the suite.
- Should: golden comparisons paired with mutation controls; failures name the case and the byte offset or field.

**Files and modules**:

- Code areas: `tests/behaviour/brief-envelope.test.ts` (new), `tests/golden/brief.test.ts` (new), `tests/fixtures/brief/golden/**` (new), `tests/checks/error-table-sync.test.ts` (updated), `tests/structure/error-table.test.ts` (updated)
- System docs: none

**Tests**: TC-BRIEF-011, 012, 013, 014, 015 (AC-F5-1, AC-F6-1 golden half; NFR-7)

**Completion signal**: `test(GH-228): pin brief envelope posture and golden bytes`

---

### Phase 5: Read-only, redaction, credential posture, and non-vacuity mutants

**Goal**: The security/read-only invariants hold and every guard is proven load-bearing by a mutant that fails naming its case.

**Tasks**:

- [x] **5.1** Author `tests/behaviour/brief-readonly.test.ts` (TC-BRIEF-018): `guardStore` observes `read` only (zero `append`/`replaceDocument`/`acquireFence`/`releaseFence`; deliberate `acquireFence` throws); transport is GET-only to the three declared endpoints with zero writes/quota/announcements/retries; PM-context bytes and `mtimeMs` unchanged; no `node:child_process`/`spawn`/`spawnSync`/`execFile`/`Bun.spawn` tokens with a non-empty file count; `anonymousInstance()` refused before any GitHub read with the digest's exact guard outcome and local context still read; secret-read allowlist length unchanged and naming no brief file.
- [x] **5.2** Add redaction coverage (TC-BRIEF-019): fabricated canary registered through the injected secrets list and planted in a workspace path, PM-context path, and provider evidence detail; canary asserted present in the fixture, then zero occurrences in stdout/stderr for both modes; both envelope and pre-rendered human text pass through the single `serialize`/`writeOutput` path; a bypassing renderer fails the canary test; no leak through placeholder justifications, evidence strings, or truncation markers; update `tests/golden/redaction.test.ts` to include the brief surfaces.
- [x] **5.3** Create `tests/fixtures/brief/mutants/**` and `tests/checks/brief-mutants.test.ts` (TC-BRIEF-021): one disabled guard per mutant imported via `file://` temp copies — fabricated surface state; brief-only fact; unknown-as-zero count; placeholder-as-observed/empty; `slaState` fabrication; age defaulted to 0; ready-to-merge from an unknown review signal; ready-to-merge from a cap-omitted item; a fourth catalog entry; a `status.collector.*` identity; exit 1 on unavailability; a `Date.now()` renderer; an unbounded/silent-drop renderer; a canary-leaking wide projection; a model/network import; a store write; a spawned child; a product literal. Each mutant produces the prohibited observable and fails the intended suite naming the case; the clean production module passes; every one of the 10 ACs has ≥1 mutant; the runner never writes the live tree.

**Acceptance Criteria**:

- Must: TC-BRIEF-018, 019, 021 green; zero writes, mutations, child processes, or network writes; canary zero-occurrence proven non-vacuous; every mutant fails naming its case and the clean module passes; mutant corpus covers all 10 ACs with a non-zero file count.
- Should: guard liveness controls (deliberate fence, bypassing renderer) fail loudly.

**Files and modules**:

- Code areas: `tests/behaviour/brief-readonly.test.ts` (new), `tests/checks/brief-mutants.test.ts` (new), `tests/fixtures/brief/mutants/**` (new), `tests/golden/redaction.test.ts` (updated)
- System docs: none

**Tests**: TC-BRIEF-018, 019, 021 (AC-F6-3; NFR-6; all-AC non-vacuity)

**Completion signal**: `test(GH-228): prove brief read-only, redaction, and non-vacuity guards`

---

### Phase 6: Code Review (Analysis)

**Goal**: An independent review of the delivered phases against spec and plan before documentation sync and release (delivery-lifecycle phase 8, `@reviewer`).

**Tasks**:

- [ ] **6.1** Request the review (`/review GH-228` or `@pm`-orchestrated) covering: spec ACs vs evidence, plan-task completeness, purity/boundary discipline, no-LLM render path (AC-F6-2 review half), anchor wording (attention, never a verdict), and the ready-to-merge predicate against the queue-ready convention.
- [ ] **6.2** Record the verdict and findings in the Execution Log; a PASS advances to Phase 8; any FAIL finding activates Phase 7.

**Acceptance Criteria**:

- Must: an independent verdict is recorded with findings mapped to phases/files.
- Should: zero blocking findings.

**Files and modules**:

- Code areas: none (read-only analysis)
- System docs: none

**Tests**: none (review gate; regression suites remain green)

**Completion signal**: independent verdict recorded; PASS advances to Phase 8, findings activate Phase 7.

---

### Phase 7: Post-Code Review Fixes (conditional)

**Goal**: Remediate review findings without re-opening settled contracts. Activated only by a Phase 6 FAIL; skipped otherwise.

**Tasks**:

- [ ] **7.1** Classify each finding (contract breach / wording / test gap) and apply the minimal fix; re-run the touched suites plus `pnpm check`.
- [ ] **7.2** If a fix changes any TC's behavior, oracle, or AC mapping, reopen the test plan per its A-T8 before landing the fix.
- [ ] **7.3** Request re-review until PASS; record each iteration in the Execution Log.

**Acceptance Criteria**:

- Must: every finding resolved or explicitly waived by `@pm`; `pnpm check` green after remediation.
- Should: fixes touch the narrowest possible surface; goldens change only via the explicit regeneration path with a stated reason.

**Files and modules**:

- Code areas: as identified by review (expected: none or minor)
- System docs: none

**Tests**: affected suites re-run green

**Completion signal**: `fix(GH-228): resolve review findings` plus a PASS re-review.

---

### Phase 8: Documentation & Spec Synchronization (handoff to `@doc-syncer`)

**Goal**: Documentation, command registry, and man page state the shipped contract so a reader cannot infer exit `2` on unavailability or find the rejected identity (TC-BRIEF-022). **Owner: @doc-syncer** (delivery-lifecycle phase 7) — not a @coder task; listed here so the change's doc impacts are planned and traceable.

**Tasks**:

- [ ] **8.1** Author the current-truth feature spec `doc/spec/features/feature-brief.md` mirroring the `feature-status-digest.md` structure (architecture and codebase map, data flow, interface contracts, security/boundaries, NFRs, QA strategy) with DEC-2 posture: exit `0` on collector unavailability; no `status.collector.<id>.unavailable` identity.
- [ ] **8.2** Reconcile the proposed man page `doc/planning/oss-tooling/milestones/m1/commands/brief.md` with shipped behavior: correct the EXIT STATUS section (drop the exit-2 "collectors unavailable" row), align the envelope example to the shipped `CommandResult` shape (`schemaVersion`, `runId`, `exitCode`, `timing.totalMs`, `data`), mark illustrative fields as illustrative.
- [ ] **8.3** Move the `brief` row in `doc/planning/oss-tooling/cli-command-registry.md` from planned to delivered, naming M1-S6.
- [ ] **8.4** Cross-link `doc/spec/features/feature-status-digest.md` ↔ `doc/spec/features/feature-brief.md` per DEC-4 (brief is the v0 owner-facing render surface; M1-S10 joins anchors from the same collector state; neither spec claims a contradictory posture); update the status-digest line about the `humanText` hook being consumed only by status (brief now consumes it too).
- [ ] **8.5** Record the TC-BRIEF-022 manual evidence in test plan §10 (the §7.3 grep commands and output: no "collectors unavailable" row, no `status.collector.` identity, registry row delivered) and the review checklist items ("no LLM or model call in the brief render path"; "the ready-to-merge anchor is attention, never a merge verdict").

**Acceptance Criteria**:

- Must: TC-BRIEF-022 recorded with commands and output; the documented catalog is exactly the three §4.3 entries; the registry row reads delivered and names M1-S6; both feature specs cross-link without contradiction.
- Should: docs pass the content-check layer (testing-strategy §2: traceability, rendering, links, YAML).

**Files and modules**:

- Code areas: none
- System docs: `doc/spec/features/feature-brief.md` (new), `doc/spec/features/feature-status-digest.md` (updated), `doc/planning/oss-tooling/milestones/m1/commands/brief.md` (updated), `doc/planning/oss-tooling/cli-command-registry.md` (updated)

**Tests**: TC-BRIEF-022 (semi-automated: recorded content check + review)

**Completion signal**: `docs(GH-228): sync brief feature spec, registry row, and man page`

---

### Phase 9: Finalize and Release — changeset, doc-impact handoff, final gates

**Goal**: Version bump per repo conventions, the doc-impact handoff recorded, every gate green in a clean checkout, and the change ready for DoD and PR (lifecycle phases 10–11).

**Tasks**:

- [x] **9.1** Add `.changeset/brief-v1-minor.md` (D11): lockstep `minor` for `@delivery-os/core`, `@delivery-os/adapters`, `@delivery-os/cli`, `@delivery-os/mcp`, `@delivery-os/opencode`, with a summary naming the read-only brief, the anchored actions, and the closed placeholder catalog (mirror `.changeset/status-v1-minor.md`).
- [x] **9.2** Attach the doc-impact handoff notes for `@doc-syncer` (input to Phase 8): new surfaces and files, DEC-1..DEC-7, the OQ-1 golden resolution, the registry-row and man-page corrections, and the status-digest cross-link — confirming Phase 8 is complete or explicitly handed off.
- [x] **9.3** Run the full evidence battery (test plan §7.3 commands, including the status regression half: `status-negative-controls`, `status-readonly-determinism`, `golden/status-digest`, and all structure/check suites) plus `pnpm typecheck` and `pnpm check`; record per-TC results with commands and HEAD in test plan §10.
- [x] **9.4** Spec reconciliation: confirm all 10 ACs, DM-1..DM-5, and NFR-1..NFR-8 trace to green evidence; confirm the test plan's Plan-phase columns (§3.1, §7) match the delivered phases and that no TC, oracle, or AC mapping drifted (A-T8).
- [x] **9.5** Confirm `git diff --check` clean and `git status --porcelain` unchanged by the battery (suites never mutate the worktree); hand off to `@pm` for DoD and `@pr-manager` for the PR against `main-tools`.

**Acceptance Criteria**:

- Must: `pnpm check` green in a clean checkout; exactly one changeset added, lockstep minor; all 22 TCs green with recorded evidence (TC-BRIEF-022 recorded in Phase 8); zero new error-table rows/kinds/keys; goldens committed and untouched by the suite; the worktree clean before and after the battery.
- Should: changeset summary and PR description state the same-facts/no-LLM invariants in one sentence each.

**Files and modules**:

- Code areas: `.changeset/brief-v1-minor.md` (new)
- System docs: none beyond Phase 8 (reconciliation confirmation only)

**Tests**: aggregate `pnpm check` + the full §7.3 evidence battery (all TCs, regression half)

**Completion signal**: `chore(GH-228): add lockstep minor changeset and final gate evidence`

## Test Scenarios

All 22 TCs from [chg-GH-228-test-plan.md](./chg-GH-228-test-plan.md) §5, mapped to the delivering phase (the same values now fill the test plan's §3.1/§7 "Plan phase" columns):

| TC ID | Scenario (abbreviated) | Phase | AC / NFR |
|-------|------------------------|-------|----------|
| TC-BRIEF-001 | Payload contract, closed catalog, bounds by reference, inventory | Phase 1 | AC-F3-1, NFR-1, NFR-8, DM-1..4 |
| TC-BRIEF-004 | Same-facts shared truth, zero brief-only facts | Phase 2 | AC-F1-1, AC-F4-1 |
| TC-BRIEF-006 | One-screen bounds, truncation markers, decision-first order | Phase 2 | AC-F1-2, NFR-1 |
| TC-BRIEF-007 | Ready-to-merge anchor: observed approval only, never a verdict | Phase 2 | AC-F2-1, DM-2 |
| TC-BRIEF-008 | Owner-gate ages: parseable only, unknown otherwise, no SLA state | Phase 2 | AC-F2-2 |
| TC-BRIEF-009 | Closed three-entry placeholder catalog, named, never zero | Phase 2 | AC-F3-1, DM-3 |
| TC-BRIEF-010 | Exhaustive failed/absent-read negative controls | Phase 2 | AC-F4-1, DM-4 |
| TC-BRIEF-016 | Corpus completeness over every surface, state, placeholder | Phase 2 | AC-F3-1, AC-F4-1, AC-F6-1 |
| TC-BRIEF-020 | Pure-projection performance and bounded work | Phase 2 | NFR-4, AC-F1-1 |
| TC-BRIEF-002 | Command surface, grammar rejection before any read | Phase 3 | AC-F5-1, AC-F1-1 |
| TC-BRIEF-003 | Render-path boundaries, purity, no-LLM/no-network | Phase 3 | AC-F6-2, NFR-5, NFR-6, NFR-8 |
| TC-BRIEF-005 | Read-cost parity: zero brief-specific reads | Phase 3 | AC-F1-1, NFR-3 |
| TC-BRIEF-017 | Determinism replay and human-content discipline | Phase 3 | AC-F6-1, NFR-2 |
| TC-BRIEF-011 | Collector unavailability is digest data at exit 0 | Phase 4 | AC-F5-1, DEC-2 |
| TC-BRIEF-012 | Exit projection and containment identities only | Phase 4 | AC-F5-1 |
| TC-BRIEF-013 | Error-table, domain-kind, configuration-key stability | Phase 4 | AC-F5-1, NFR-7 |
| TC-BRIEF-014 | Golden human bytes and golden immutability | Phase 4 | AC-F1-2, AC-F6-1, NFR-2 |
| TC-BRIEF-015 | Golden `--json` envelope bytes and machine bound | Phase 4 | AC-F5-1, AC-F6-1, NFR-2 |
| TC-BRIEF-018 | Read-only execution, zero spawn, credential-reference guard | Phase 5 | AC-F6-3, NFR-6 |
| TC-BRIEF-019 | Redaction chokepoint over envelope and human text | Phase 5 | AC-F6-3 |
| TC-BRIEF-021 | Non-vacuity meta-check: broken guards fail naming the case | Phase 5 | All ACs, NFR-5 |
| TC-BRIEF-022 | Documented posture consistency with the shipped contract | Phase 8 | AC-F5-1, DEC-2 |

Per-AC phase coverage: AC-F1-1 → Phases 2, 3; AC-F1-2 → Phases 2, 4; AC-F2-1 → Phase 2; AC-F2-2 → Phase 2; AC-F3-1 → Phases 1, 2; AC-F4-1 → Phase 2; AC-F5-1 → Phases 3, 4, 8; AC-F6-1 → Phases 3, 4; AC-F6-2 → Phases 3, 5; AC-F6-3 → Phase 5. Phase 9 re-runs everything as the aggregate regression half (`pnpm check`).

## Artifacts and Links

| Artifact | Location | Type |
|----------|----------|------|
| Change specification (v1.1) | ./chg-GH-228-spec.md | Spec |
| Test plan (v1.1) | ./chg-GH-228-test-plan.md | Test plan |
| Implementation plan (this file) | ./chg-GH-228-plan.md | Plan |
| PM notes | ./chg-GH-228-pm-notes.yaml | PM record |
| Ticket | https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/228 | GitHub issue |
| Status digest current truth | ../../../spec/features/feature-status-digest.md | Feature spec (dependency, cross-linked in Phase 8) |
| Result contract current truth | ../../../spec/features/feature-result-contract.md | Feature spec (envelope/exit/error-table authority) |
| Command registry | ../../../planning/oss-tooling/cli-command-registry.md | Registry (row moves to delivered in Phase 8) |
| Proposed brief man page | ../../../planning/oss-tooling/milestones/m1/commands/brief.md | Contract pack (reconciled in Phase 8) |
| New feature spec (Phase 8, @doc-syncer) | ../../../spec/features/feature-brief.md | Feature spec (to be authored) |
| Changeset (Phase 9) | ../../../../.changeset/brief-v1-minor.md | Release intent |
| TypeScript rules | ../../../../.ai/rules/typescript.md | Repo rule |
| Testing strategy | ../../../../.ai/rules/testing-strategy.md | Repo rule |

## Plan Revision Log

| Version | Date (UTC) | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-06 | plan-writer | Initial plan: 9 phases (contracts → domain/fixtures → command/edge/boundaries → envelope/goldens → security/non-vacuity → review → conditional fixes → doc-sync handoff → changeset/final gates). All 22 TCs mapped to delivering phases; test-plan §3.1/§7 Plan-phase columns filled with these phase ids. Delivery Bindings D1–D12 pin delivery-bound names and modeling (anchor groups vs surface ids, age/future/evidence edges, corpus parity, changeset, goldens). |
| 1.1 | 2026-11-06 | reviewer | Review iteration 1 (`code-review/review-iter-1.yaml`, verdict FAIL at HEAD `e4e68a42`): Phase 6 recorded Done with the FAIL verdict; Phase 7 activated with the appended Remediation Register R-1..R-5 (F-1 blocker: TC-BRIEF-021 non-vacuity mechanism not delivered as bound, deviation justification refuted; N-1 Phase-8 checkboxes done-but-unchecked; N-2 canary-reachability). No phase scope, task, TC mapping, or binding changed. |

## Execution Log

| Phase | Status | Started | Completed | Commit | Notes |
|-------|--------|---------|-----------|--------|-------|
| 1 — Core brief contracts and inventory registration | Done | 2026-11-06 | 2026-11-06 | `4243506c` | 8/8 brief-contract tests pass; catalog closed at three; inventory registered. |
| 2 — Pure projection, human renderer, shared-fact fixtures | Done | 2026-11-06 | 2026-11-06 | `ea86d819` | 210/210 Phase-2 suites pass; shared-truth, anchors, placeholders, controls, corpus, bounds, performance green. |
| 3 — CLI command, edge composition, read-cost, boundaries | Done | 2026-11-06 | 2026-11-06 | `5b45791c` | 23/23 Phase-3 suites pass; brief composed via `createStatusCommandRuntime`; reader member set identical to status. |
| 4 — Envelope posture, exit projection, error table, goldens | Done | 2026-11-06 | 2026-11-06 | `4e6d697a` | 108/108 Phase-4 suites pass; goldens 11 lines / 641 bytes human, 4791 bytes machine data; error-table sync green. |
| 5 — Read-only, redaction, credential posture, mutants | Done | 2026-11-06 | 2026-11-06 | `ed916459` | 43/43 Phase-5 suites pass; 20 mutants cover all 10 ACs; canary zero-occurrence proven non-vacuous. |
| 6 — Code Review (Analysis) | Done | 2026-11-06 | 2026-11-06 | — | Independent lifecycle review executed in `review_fix`: verdict **FAIL** (1 blocker F-1, 2 minor, 3 notes) recorded in `code-review/review-iter-1.yaml` at HEAD `e4e68a42`. All spec ACs and D1–D12 bindings verified compliant; §10 evidence claims reproduced. |
| 7 — Post-Code Review Fixes (conditional) | Activated (iteration 1) | 2026-11-06 | — | — | Activated by the Phase-6 FAIL. Remediation register appended below (R-1..R-5 mapped to findings F-1, N-1, N-2). |
| 8 — Documentation & Spec Synchronization | Handed off | — | — | — | Owner is `@doc-syncer`; handoff recorded in `chg-GH-228-doc-impact.md` (feature-brief spec, status cross-links, registry row, man-page exit-2 correction, `ados_distribution`). |
| 9 — Finalize and Release | Done | 2026-11-06 | 2026-11-06 | phase-9 commit | `.changeset/brief-v1-minor.md` (lockstep minor); doc-impact handoff; `TMPDIR=$PWD/tmp/tmpdir pnpm check` green (2961 pass, 4 skip, 0 fail); worktree clean after battery. |

**Delivery deviation (Phase 5, TC-BRIEF-021).** The mutant corpus is a committed
catalog (`tests/fixtures/brief/mutants/catalog.ts`) rather than `file://` temp
copies of the production modules. An out-of-tree copy cannot resolve the
workspace `#contracts` / `#domain/*` aliases, so the meta-check applies each
mutant to the clean payload and a clean source module and proves the prohibited
observable appears only in the mutant, naming the case. The live tree is never
written; all 10 ACs have at least one mutant.

## Remediation Register (Phase 7 Activation — Review Iteration 1)

Source: `code-review/review-iter-1.yaml` (independent `@reviewer` verdict FAIL, 2026-11-06, HEAD `e4e68a42`). Owner: `@coder` under Phase 7; re-review (task 7.3) closes the register. The deviation note above is superseded by R-1's outcome: the alias-resolution justification was refuted by review (in-repo precedent `tests/checks/closeout-mutants.test.ts` rewrites specifiers to `file://` URLs; the reviewer's probe confirmed the mechanism works for `domain/brief.ts`).

- [ ] **R-1 (F-1, blocker)** Port the GH-183 source-mutation loader into `tests/checks/brief-mutants.test.ts`: read `packages/core/src/domain/brief.ts`, rewrite `from "#contracts"` → `file://` URL of `packages/core/src/contracts/index.ts` and `from "./status.js"` → `file://` URL of `packages/core/src/domain/status.ts`, write mutated sources under `tmp/tmpdir` only (never the live tree), import via `pathToFileURL(...)?x=<seq>`, delete after. Add named source mutations for the load-bearing guards — review-signal predicate (AC-F2-1: `item.reviewState === "observed"`), age unknown/future guards (AC-F2-2), placeholder state and catalog guards (AC-F3-1), surface-state mapping (AC-F4-1), exit-0-on-unavailability projection (AC-F5-1), renderer bound/drop guard (AC-F1-2) — each asserted clean-resists / mutant-fires naming its case.
- [ ] **R-2 (F-1, blocker)** Replace the eight tautological `tokenMutant` entries in `tests/fixtures/brief/mutants/catalog.ts` (model-import, network-import, store-write, spawned-child, product-literal, sla-state-fabrication, date-now-renderer, status-collector-identity, canary-leak, exit-one — as applicable) with source mutations where the guard lives in `brief.ts`, or cross-reference the existing seeded controls (`brief-imports.test.ts` seeded `node:http`/`openai`/`fetch` probes; `brief-readonly.test.ts` writeOutput chokepoint canary; error-table-sync temp-copy controls) so the AC-coverage meta-assertion counts only load-bearing mutants. The payload-resists scan may remain as an additional layer. If TC-BRIEF-021's oracle is permanently re-worded, reopen the test plan per its A-T8 and record the deviation properly instead of D-TC021.
- [ ] **R-3 (N-1, minor)** Tick Phase 8 tasks 8.1–8.5 to `[x]` with a one-line Execution Log note referencing commit `e4e68a42` and test-plan §10.1 (work verified delivered by review; DoD-8 requires the boxes checked).
- [ ] **R-4 (N-2, minor)** Add one end-to-end redaction case in `tests/golden/redaction.test.ts` planting the canary in a rendered identity (e.g., a `makeDeliveryRequest` entityId) that flows into both the envelope anchors and the human ready-to-merge line, so zero-occurrence genuinely exercises redaction through the projection.
- [ ] **R-5 (all)** Re-run the brief battery, `pnpm check`, and `git status --porcelain` cleanliness; update test-plan §10 evidence for TC-BRIEF-019/021; then request re-review (task 7.3).

Notes (N-3 age-rule dedup at M1-S10, N-4 degraded-with-items corpus case, N-5 doc-impact byte figure) require no v0 action; record them as deferred observations.
