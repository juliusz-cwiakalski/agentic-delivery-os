---
id: chg-GH-229-owner-gate-sla
status: Proposed
created: 2026-11-06T14:00:00Z
last_updated: 2026-11-06T14:00:00Z
owners: [engineering]
service: delivery-os
labels: [m1, owner-gates, sla, board]
links:
  change_spec: ./chg-GH-229-spec.md
  change_test_plan: ./chg-GH-229-test-plan.md
summary: >
  M1-S5 owner-gate SLA: owner gates age truthfully from the provider-native
  activity timestamp (ADR-0004) into a 24 h escalation or a 72 h pre-agreed
  default — never silence. Ships the PDR-0003 two-kind policy map as contract
  data (owner-review never-merge/non-defaultable; waiver defaultable with the
  single owner-review-first default), the pure audience-parameterized
  evaluation engine, the append-only idempotent EVT-1 decision record in the
  state layer, the collector-unavailable error family (status.collector.<id>.
  unavailable, exit 2), and the board v0 surface (render-once text grid plus
  one CommandResult envelope with gates[]; exit 0 rendered / 2 collectors
  unavailable).
version_impact: minor
---

# IMPLEMENTATION PLAN — GH-229: M1-S5: Owner-gate SLA — aging into escalation or a recorded default, never silence

## Context and Goals

This plan delivers GH-229 per the change specification (12 ACs, F-1..F-8, NFR-1..NFR-7, DM-1..DM-3, EVT-1, DEC-1..DEC-10) and the committed test plan (30 TCs, TC-SLA-001..030). The delivery order follows spec §18: **SLA policy contract data and the pure evaluation engine first** (fixture-testable over injected facts), **then the persisted EVT-1 decision record** (state-layer integration), **then the `board` CLI surface**, **then contract-table/documentation sync and finalization**. The audience seam (owner | coordinator, F-8/DEC-4) is asserted in the engine contract from Phase 1 and verified in Phase 2 — it is not deferred.

Placement per ADR-0003, mirroring the delivered status-digest pattern:

- **Contracts** (`packages/core/src/contracts/`): SLA policy data (DM-3), board payload vocabulary (DM-1), decision-record vocabulary (DM-2), evaluation input/result types, and the collector-unavailable family data — all `as const` data and types only, data-only per the `tests/structure/status-contract.test.ts` detector.
- **Domain** (`packages/core/src/domain/`): the pure evaluator and the human-grid renderer (the `aggregateStatus` + `renderStatusHuman` precedent — human text rendering is pure; envelope rendering stays in the CLI per ADR-0003).
- **State** (`packages/core/src/state/`): the decision-record ledger module over the injected `StateStorePort` (the `closeout.operation` precedent in `state/closeout.ts`).
- **CLI** (`packages/cli/src/commands/board.ts` + `commands/index.ts` + `edge.ts`): the command definition over an injected runtime; the edge composes real adapters. The handler returns data or one classified failure; the CLI edge is the only stream writer and exit projector.
- **Branding**: no product literals; every user-visible name derives from the injected `BrandIdentity` (`renderBoardHuman(data, brand)` precedent).

### GAP-1..GAP-12 readings — confirmed or corrected by this plan

The test plan's twelve recorded gaps were reviewed against spec §5.1/§7.3/§8.3/§12/§18, DEC-1..DEC-10, and PDR-0003. All readings are **confirmed**; none is corrected. They bind the delivery as follows:

| GAP | Reading confirmed by this plan | Where encoded |
|-----|-------------------------------|---------------|
| GAP-1 | This plan maps all 30 TCs onto Phases 1–6 without reshaping any TC's behaviour, states, reasons, bounds, assertions, or AC/NFR mapping (A-T2). Note: the test plan's §7 execution order omits TC-SLA-026 from its step list; this plan maps it to Phase 4 (behaviour unchanged). | This document; §Test Scenarios |
| GAP-2 | Threshold comparator is declared contract data and the delivery declares `>=` (exactly 24 h → `escalated`; exactly 72 h on a defaultable gate → `default-applied`). | Phase 1 contract data; TC-SLA-005 |
| GAP-3 | The `status.collector.<id>.unavailable` family is declared once as contract data over a closed collector-id set; the documented table records the family; `scripts/checks/error-table-sync.ts` gains a narrowly declared family recognizer (no wildcard widening); the `DOMAIN_KINDS` delta is at most one new kind used only by this family. Verified against the delivered sync mechanics: the documented table at `doc/spec/features/feature-result-contract.md` is the binding S2 surface, so the family row(s) land in-change with the machine rows or `bun test` fails — this is contract-sync, not doc/spec feature authoring (see Constraints). | Phase 1; TC-SLA-021 |
| GAP-4 | The gate record carries a declared marker field, present exactly when `age === null`, with values exactly `activity-timestamp-absent` and `activity-timestamp-unparseable`. Proposed spelling `ageUnknownReason` (delivery-bound per GAP-12). | Phase 1 contract data; TC-SLA-003 |
| GAP-5 | `age` is a declared deterministic contract datum: integer milliseconds (`now − activityAt`) or `null` for unknown; the human grid uses the compact form (`26h`, `2d`). | Phase 1; TC-SLA-002/003 |
| GAP-6 | Rank key declared as contract data: SLA severity (`escalated`, including unknown age, before `default-applied` before `fresh`) → oldest observed age → gate id lexical; no `escalated`/`default-applied` gate is dropped while a `fresh` gate renders. | Phases 1–2; TC-SLA-019/020 |
| GAP-7 | Machine `data` carries declared `truncated` boolean + `omitted` count (status/queue-ready precedent); human grid carries `+N`; both mandatory whenever a gate is dropped or clamped. | Phases 1–2, 4; TC-SLA-020 |
| GAP-8 | Torn decision history fails closed: declared `state.store.torn`, exit 2, no gates rendered, zero appends, no derived `default-applied` (closeout precedent). | Phase 3; TC-SLA-011 |
| GAP-9 | The collector/gate source supplies `{id, kind, ref, activityAt, waivedBy?}` as facts; the engine never infers kind from labels/titles/ordering and never fabricates ids; unknown kind → `escalated`, never defaulted; ids deterministic and stable (idempotency key). v0 shipped mapping: the tracker collector assigns kind `owner-review` to observed owner-gate items (no waiver-authorizer signal exists in the delivered tracker slice); waiver-kind gates and `waivedBy` values are exercisable through injected facts and become reachable when the waiver-recording surface lands (PDR-0003 revisit triggers cover this). | Phases 2, 4; TC-SLA-012, A-T5 |
| GAP-10 | A parseable future timestamp yields a non-positive age, `fresh`, never defaulted; the marker set is not widened for a parseable instant (status stall arithmetic precedent). | Phase 2; TC-SLA-002 |
| GAP-11 | A board renders only when every required collector is available; any unavailable collector yields a declared failure naming that collector, exit 2, zero gates — envelope `data`/`error` exclusivity forbids a partial board. | Phase 4; TC-SLA-013/014 |
| GAP-12 | Export names, module/file names, marker/truncation field spellings, schema strings, record-kind strings, and human line labels are delivery-bound; the vocabulary (kinds, classes, defaults, states, markers, audiences), thresholds, caps, exit codes, and assertions are pinned and may not be rebound. | All phases |

One additional confirmation (not a GAP): the planning-pack worked example renders a `waiver` gate "at 2 days" as `default-applied`; the spec's pinned thresholds (24 h/72 h, §1, F-2/F-3, DEC-2) are authoritative and the pack example is illustrative only (pack status: Proposed contract). Tests use 73 h for the applied case, per TC-SLA-006.

### Open questions

- **OQ-T10 (carried, non-blocking)**: CI tolerance for the 50 ms pure-evaluation measurement. The plan pins the measurement approach (warm-up, median of five, pure evaluation only, environment recorded — TC-SLA-027) and does not relax the spec bound. Owner: `@plan-writer`/`@coder` at delivery; record the measured value in the PR.
- **PDR-0003 ratification** rides the GH-229 PR review (record stays `Proposed` until the owner ratifies or vetoes; a veto reopens the map in-change before merge). No decision needed here — the record is already adopted for delivery; do not consult `@decision-advisor` again for the map content.

No other open questions. All spec OQ-1..OQ-3 are resolved (DEC-8/DEC-9/PDR-0003).

## Scope

### In Scope

- F-1 aging computation over injected facts (DM-3 policy, collector gate facts, injected clock) with unknown-age handling (DEC-1/DEC-6/DEC-8).
- F-2 24 h escalation as derived, sticky, visibility-only state (NFR-5).
- F-3 72 h default-on-expiry applying exactly one pre-agreed default per defaultable kind/class from the PDR-0003 two-row policy map (DEC-2/DEC-10).
- F-4 the EVT-1/DM-2 append-only, idempotent, auditable decision record in the state layer (DEC-3, NFR-7).
- F-5 never-merge class protection, structural (policy validation rejects a never-merge row carrying a default; eligibility rejects the class before age comparison).
- F-6 never-silence: declared `status.collector.<id>.unavailable` family (exit 2, zero fabricated gates), declared unknown age, declared truncation (DEC-7, NFR-6).
- F-7 `board` v0: render-once text aging grid + one `CommandResult` envelope with `gates[]` (DM-1), exit 0 rendered / 2 collectors unavailable, registered beside the other top-level commands.
- F-8 the audience seam (owner | coordinator) in the engine contract, asserted by tests (DEC-4).
- Error-table contract data for the collector-unavailable family, the documented-table sync row(s), and the narrow family recognizer in the sync check.
- One minor changeset per repo conventions.

### Out of Scope

- [OUT] Brief `aging[]` consumption — M1-S6 (GH-228, open).
- [OUT] Typed blocker channel / coordinator-audience flows — M1-S16 (GH-230); only the seam ships.
- [OUT] Full fleet board grid — M2-S4.
- [OUT] Waiver authorizer-vs-policy enforcement at merge time (NG-4); `waivedBy` is rendered from injected facts only.
- [OUT] Out-of-band alert delivery (NG-5); `board --watch` and any resident-daemon behavior (DEC-9).
- [OUT] New configuration keys (NG-6); SLA data is contract data.
- [OUT] Authoring `doc/spec/**` feature documentation — reconciled by `@doc-syncer` at lifecycle phase 7 (see Constraints for the single documented-table exception).
- [OUT] Editing the planning-pack command registry — verified planning truth (see Constraints).

### Constraints

- **Spec and test plan are binding** (A-T1/A-T2): no pinned value may be rebound; TC behaviour/states/reasons/bounds/assertions/AC-NFR mapping are fixed; delivery chooses only GAP-12 spellings.
- **Tier discipline** (ADR-0003, `.ai/rules/typescript.md`): contracts data-only; domain imports `#contracts` only; the state module touches only the state port; runtime/I/O only at `adapters`/`cli` edges; no new package, subpath, or runtime-API location; no ambient clock/randomness/env in neutral tiers.
- **Error contract** (`.ai/rules/typescript.md` §7): the handler returns data or one classified failure carrying registry codes; the table and registry stay synced; the only new documented identity family is the collector-unavailable family; reused state identities project per the existing table (`state.store.torn`/`state.lock.busy` → 2; `state.permission.denied` → 1).
- **Documented error table is a binding sync surface**: `doc/spec/features/feature-result-contract.md` holds the S2 documented table consumed by `scripts/checks/error-table-sync.ts` (verified). The family row(s) must land in-change together with the `ERROR_TABLE` entry, or `bun test` (inside `pnpm check`) fails. This single-row contract-sync edit is in scope; all other `doc/spec/**` content (new `feature-owner-gate-sla.md`, result-contract prose) belongs to lifecycle phase 7 (`@doc-syncer`).
- **Command registry is planning truth** (verified): `doc/planning/oss-tooling/cli-command-registry.md` already declares the `board` row (M1-S5, line 169). No in-change authoring; TC-SLA-016 step 10 asserts the cross-reference exists exactly once as a tree invariant.
- **Doc-distribution guard** (verified): `doc/spec/**` is outside the `ados_distribution` marker set (`scripts/.tests/test-doc-distribution.sh` scopes `doc/guides/`, `doc/templates/**`, and the standalone docs; `scripts/install.sh` only creates `doc/spec/features` as an empty stub in user projects). No redistributable doc changes are planned, so the guard is not triggered; run it only if a redistributable doc unexpectedly changes (TC-SLA-023 step 5).
- **Branding seam**: no product/binary literals; brand arrives via `BrandIdentity`; the forbidden-literals scanner and `tests/structure/branding-seam.test.ts` extend to the new modules automatically.
- **Commits**: one Conventional Commit per phase (commitlint config-conventional), staged by `@committer` during delivery.
- **Versioning**: lockstep `fixed` group (`@delivery-os/core`, `adapters`, `cli`, `mcp`, `opencode`) via `.changeset/`; one minor changeset, `gh-183-closeout-minor.md` naming precedent.

### Risks

- **RSK-1** (wrong default auto-applied): mitigated by the PDR-0003 policy map as mutation-tested contract data (TC-SLA-001/007/008/012) and the structural never-merge exclusion.
- **RSK-2** (clock skew): mitigated by the pinned DEC-1 clock, boundary precision tests (TC-SLA-005), and the GAP-10 arithmetic reading (TC-SLA-002).
- **RSK-3** (unavailability misread as all-clear): mitigated by the declared family, exit 2, zero fabricated gates, and negative controls (TC-SLA-013/014/015).
- **RSK-4** (unknown-age gates idle silently): mitigated by declared markers, escalated visibility, and never-defaultable unknown age (TC-SLA-003/015).
- **RSK-5** (audience seam foreclosed): mitigated by the typed audience dimension from Phase 1 and TC-SLA-024/025.
- **RSK-6** (perceived overreach): mitigated by the least-privilege map, EVT-1 evidence, owner sign-off gate (PDR-0003), and corpus coverage (TC-SLA-028).
- **Delivery risks**: RSK-T12 (drift from plan-local readings) is mitigated by the GAP confirmation table above; any change to a pinned reading reopens the test plan per A-T2.

### Success Metrics

From spec §4.1: 100% of gates > 24 h rendered `escalated`; 100% of gates > 72 h in `default-applied` (defaultable) or persistently `escalated`; 100% of applications carrying a complete audit record; 0 auto-proceeds on never-merge classes; 100% of collector-unavailable runs declared with exit 2 and zero fabricated gates; 100% of unknown-age gates surfaced visibly. Aggregate gate: `pnpm check` green plus the test plan's evidence commands (§7).

## Phases

### Phase 1: SLA policy contract data, board vocabulary, and the collector-unavailable error family

**Goal**: Land every pinned datum as inspectable contract data (DM-1/DM-2/DM-3), the typed audience seam, and the error-identity family with its binding sync — before any behaviour exists — so all later phases consume declared vocabulary (DEC-2, PDR-0003).

**Tasks**:

- [x] **1.1** Confirm-or-correct the GAP-1..GAP-12 readings (done: table in Context and Goals). Encoded the confirmed readings as contract data; no reading required correction. (evidence: contract module + structure suite green)
- [x] **1.2** Create `packages/core/src/contracts/owner-gate-sla.ts` (data-only, `as const` + types): thresholds `OWNER_GATE_SLA_ESCALATION_THRESHOLD_MS` (24 h) and `OWNER_GATE_SLA_EXPIRY_THRESHOLD_MS` (72 h) in milliseconds with the declared comparator datum (`>=`, GAP-2); the closed two-kind vocabulary `OWNER_GATE_KINDS = ["owner-review","waiver"]` and class vocabulary; the PDR-0003 two-row policy map (`owner-review` → never-merge, non-defaultable, `default: null`; `waiver` → defaultable, `default: "owner-review-first"`); the three-value SLA-state enum; the two unknown-age markers; the two audiences (`owner` | `coordinator`); board bounds (`BOARD_MAX_GATES = 8`, `BOARD_MAX_MACHINE_BYTES = 65536`, `BOARD_MAX_HUMAN_LINES = 24`, `BOARD_MAX_HUMAN_BYTES = 4096`); the declared rank-key severity order (GAP-6); `BOARD_SCHEMA_VERSION` (`"delivery.board.v1"`) for the board `data` payload; `BOARD_COLLECTOR_IDS` — the closed collector-id set required by the shipped surface (v0: `tracker`); the decision-record vocabulary `OWNER_GATE_SLA_DECISION_RECORD_KIND` (`"owner-gate.decision"`) and `OWNER_GATE_SLA_DECISION_PAYLOAD_SCHEMA` (`"delivery.owner-gate.decision.v1"`). (evidence: `bun test tests/structure/owner-gate-sla-contract.test.ts`)
- [x] **1.3** In the same contracts module, declare the types: `OwnerGateFact` (`{id, kind, ref, activityAt?, waivedBy?}` — collector-supplied facts, GAP-9); the evaluation input carrying the explicit `audience` field, injected `nowMs`/`nowIso`, the policy snapshot, gate facts, and the injected decision history; the evaluation result echoing the audience (TC-SLA-024 steps 1–2); `BoardGateRecord` (DM-1: `id`, `kind`, `ref`, `age` — integer milliseconds or `null` —, `ageUnknownReason` present exactly when `age === null` (GAP-4), `slaState`, `default`, `waivedBy`); the board `data` shape (`schemaVersion`, `audience`, `gates[]`, `truncated`, `omitted`, per-collector availability evidence); `OwnerGateSlaDecisionRecord` (DM-2 closed payload: gate id, kind, ref, applied default, applied-at, threshold-crossing + clock-source evidence); the collector read result type (available with facts vs. classified unavailable with the family code). `STATUS_OWNER_ATTENTION_LABELS` is not redeclared; the v0 collector mapping consumes it by reference (spec Appendix B, TC-SLA-030 step 2). (evidence: typecheck/build green)
- [x] **1.4** Update `packages/core/src/contracts/index.ts` to re-export the new module. Register the new module in `tests/structure/inventory.json` (`core` list) with the correct data-only executable allowances. (evidence: `bun test tests/structure/content-inventory.test.ts`)
- [x] **1.5** Error family: update `packages/core/src/contracts/error-table.ts` with the collector-unavailable family row (one new `status` domain kind used only by this family; classification `platform-provider`, exit projection 2 per DEC-7 and TC-SLA-021 step 3). Added the narrow family recognizer to `scripts/checks/error-table-sync.ts` (declared family over the closed id set; a synthetic `status.other.<id>.unavailable` fails; no wildcard widening) and its mutation coverage in `tests/checks/error-table-sync.test.ts`; added family true/false-positive rows under `tests/fixtures/result/code-corpora`; added the binding documented-table row to `doc/spec/features/feature-result-contract.md` (contract-sync only). Also added the runtime family classifier in `packages/cli/src/classify.ts` so injected collector ids stay nameable. (evidence: `bun run scripts/checks/error-table-sync.ts` + `bun test tests/checks/error-table-sync.test.ts tests/structure/error-table.test.ts`)
- [x] **1.6** Create `tests/structure/owner-gate-sla-contract.test.ts` (TC-SLA-001 and the TC-SLA-012 contract half): pin every datum with per-datum deep-copy mutation controls (threshold, comparator, third kind, default on `owner-review`, second default on `waiver`, `neverMerge` flip, state rename, third marker, dropped `coordinator`), assert the module is data-only via the `status-contract` detector, and assert inventory registration. (evidence: suite green)

**Acceptance Criteria**:

- Must: the closed two-kind PDR-0003 map, thresholds with declared `>=` comparator, three states, two markers, two audiences, and all bounds are pinned as contract data and fail-by-name on drift (TC-SLA-001). — PASSED (structure suite + error-table suite green)
- Must: `bun run scripts/checks/error-table-sync.ts` and `bun test tests/checks/error-table-sync.test.ts` are green with the family recognized narrowly in both directions; `DOMAIN_KINDS` delta ≤ 1 new kind (TC-SLA-021). — PASSED (`entries=45 documented=45`, one new `status` kind)
- Should: export spellings follow the repo precedents so later phases need no renames. — PASSED (constants/types mirror status/closeout vocabulary)

**Files and modules**:

- Code areas: `packages/core/src/contracts/owner-gate-sla.ts` (new), `packages/core/src/contracts/index.ts` (updated), `packages/core/src/contracts/error-table.ts` (updated), `scripts/checks/error-table-sync.ts` (updated), `tests/checks/error-table-sync.test.ts` (updated), `tests/fixtures/result/code-corpora/**` (updated), `tests/structure/owner-gate-sla-contract.test.ts` (new), `tests/structure/inventory.json` (updated), `tests/structure/error-table.test.ts` (updated).
- System docs: `doc/spec/features/feature-result-contract.md` (updated — documented error-table row(s) only, the binding sync surface; all other doc/spec reconciliation is lifecycle phase 7 via `@doc-syncer`).

**Tests**:

- TC-SLA-001 (structure), TC-SLA-021 (structure + checks), TC-SLA-012 contract half, TC-SLA-024 vocabulary half (audience enum declared), TC-SLA-023 checks half (forbidden-literals/branding suites extend to the new module automatically).

**Completion signal**: `feat(GH-229): add owner-gate SLA policy contract data and collector-unavailable error family`

---

### Phase 2: Pure evaluation engine — aging, escalation, default eligibility, ranking

**Goal**: Deliver the pure, fixture-testable SLA engine over injected facts (F-1/F-2/F-3 evaluation halves, F-5 structural exclusion, F-8 audience-agnostic core, GAP-10 skew reading) with the deterministic human-grid renderer.

**Tasks**:

- [x] **2.1** Create `packages/core/src/domain/owner-gate-sla.ts`: `evaluateOwnerGateSla(input)` — pure; computes age as `nowMs − activityAt` in integer milliseconds (null + the declared marker for absent/unparseable timestamps, distinguishing `activity-timestamp-absent` from `activity-timestamp-unparseable`); applies the declared comparator against the contract-data thresholds; derives `slaState` (`fresh` / `escalated` / `default-applied`, unknown-age gates always `escalated`, future timestamps arithmetic and `fresh` per GAP-10); resolves default eligibility exclusively from the policy map (never-merge and non-defaultable rows rejected before any age comparison; unknown kinds never defaulted); honours injected decision history (an existing application for a gate id yields `default-applied` naming the recorded default — the recorded value wins over the current policy); applies the declared rank key (severity → oldest observed age → gate id; unknown-age gates rank with the escalated class); enforces the 8-gate cap with `truncated`/`omitted`; echoes the audience. No kind/class/default/label literals in the engine. (evidence: `bun test tests/behaviour/board-aging.test.ts tests/behaviour/board-escalation.test.ts` green)
- [x] **2.2** In the same module: `renderBoardHuman(data, brand)` — the deterministic, TTY-independent, ANSI-free aging grid (one line per rendered gate in rank order, compact age form per GAP-5, declared unknown token, `+N` truncation mark, observed-empty line with all-collectors-available evidence, brand-derived header); `toBoardData` projects the evaluation into the declared `data` shape. Also the pure policy validator (load-time): rejects two defaults on one kind, a never-merge row carrying a default, non-defaultable defaults, and sentinel/no-op defaults (PDR-0003 C-1/C-2 structural). (evidence: same suites + renderer exercised in Phase 5)
- [x] **2.3** Update `packages/core/src/domain/index.ts` to re-export; register the module in `tests/structure/inventory.json` and its executable allowances. (evidence: content-inventory suite green)
- [x] **2.4** Create shared `tests/fixtures/board/matrix.ts` fact/policy builders (aging, unknown-age, escalation, boundary cases over normalized facts with injected gate id/kind/activity; deep-copy policy variants for mutation controls). Delivery-note: TS builders rather than per-case JSON, per the testing strategy's "committed case definitions" allowance. (evidence: suites use the builders)
- [x] **2.5** Create `tests/behaviour/board-aging.test.ts` (TC-SLA-002, TC-SLA-003), `tests/behaviour/board-escalation.test.ts` (TC-SLA-004, TC-SLA-005, and the TC-SLA-024 behaviour half — both-audience parity over identical facts), exercising the evaluator directly with injected clock/policy/facts; every case follows the non-vacuity contract (§4.2: paired controls, distinct absent/unparseable markers, T−1/T/T+1 boundaries, comparator and threshold mutations on temp copies). (evidence: 43 tests green across Phase 1–2 suites)
- [x] **2.6** Create `tests/structure/owner-gate-sla-imports.test.ts` (TC-SLA-025 — domain imports only `#contracts`; AST purity over `Date.now`/`new Date`/`Math.random`/`process.env`/`fetch`/`node:*`/timers; inventory registration), `tests/structure/owner-gate-sla-audience.test.ts` and `tests/types/owner-gate-sla-audience.type-test.ts` (TC-SLA-024 — audience vocabulary exactly `["owner","coordinator"]`, required-field type probe, no owner label literals / surface imports / routing in the evaluator, no M1-S16 exports, hard-coded-label negative control on a temp copy). (evidence: suites green; type probe compiled by `pnpm typecheck` at Phase 6)

**Acceptance Criteria**:

- Must: AC-F1-1, AC-F1-2, AC-F2-1 hold at the evaluator seam with boundary precision from contract data (TC-SLA-002/003/004/005); AC-F8-1 holds — both audiences evaluate identically through the same aging/threshold/escalation code with zero owner-specific assumptions (TC-SLA-024); the evaluator is pure (TC-SLA-025). — PASSED (43 Phase 1–2 tests green)
- Must: unknown-age gates are never `fresh`, never zero, never defaulted, and carry distinct markers (AC-F1-2, DEC-6/DEC-8). — PASSED (TC-SLA-003 matrix)
- Should: evaluation of the cap-sized fixture is comfortably inside the 50 ms budget (formally measured in Phase 5). — PENDING formal measurement (Phase 5.7)

**Files and modules**:

- Code areas: `packages/core/src/domain/owner-gate-sla.ts` (new), `packages/core/src/domain/index.ts` (updated), `tests/behaviour/board-aging.test.ts`, `tests/behaviour/board-escalation.test.ts`, `tests/structure/owner-gate-sla-imports.test.ts`, `tests/structure/owner-gate-sla-audience.test.ts`, `tests/types/owner-gate-sla-audience.type-test.ts` (new), `tests/fixtures/board/{matrix,policy}/**` (new), `tests/structure/inventory.json` (updated).
- System docs: none (phase 7 owns feature-spec reconciliation).

**Tests**:

- TC-SLA-002, TC-SLA-003, TC-SLA-004, TC-SLA-005, TC-SLA-024 (completes), TC-SLA-025. Iteration gates: `pnpm typecheck`, `bun test tests/behaviour/board-aging.test.ts tests/behaviour/board-escalation.test.ts tests/structure/owner-gate-sla-*.test.ts`.

**Completion signal**: `feat(GH-229): add pure owner-gate SLA evaluation engine`

---

### Phase 3: EVT-1 decision record — state-ledger integration, defaults, and never-merge protection

**Goal**: Persist the auditable, idempotent default-application decision (F-4, EVT-1, DM-2, DEC-3, NFR-7) and prove the full default machinery: application on a defaultable waiver gate, permanent escalation otherwise, torn-history fail-closed (GAP-8).

**Tasks**:

- [x] **3.1** Create `packages/core/src/state/owner-gate-sla.ts` (the `state/closeout.ts` precedent): `OWNER_GATE_SLA_DECISION_RECORD_KEY_PREFIX` (`"owner-gate.decisions:"`) and `ownerGateSlaDecisionRecordKey(gateId)`; a presence-tolerant verified read returning verified-empty evidence for an absent key; a fenced append carrying exactly one new record with the closed DM-2 payload (gate id, kind, ref, applied default, applied-at, threshold-crossed + clock-source evidence); payload validation rejecting wrong-kind records, missing fields, extra fields, and undeclared default values; idempotency by gate identity — the first application per gate id is authoritative, re-application is a no-op honouring the existing record, and distinct gate ids are never over-suppressed; duplicate gate-id records classify as torn. Exported from `packages/core/src/state/index.ts`; registered in `tests/structure/inventory.json`. No schema bump, no existing record kind touched (additive inside `delivery.state.v1`). (evidence: `bun test tests/behaviour/board-records.test.ts`)
- [x] **3.2** Create `tests/behaviour/board-defaults.test.ts` (TC-SLA-006, TC-SLA-007, TC-SLA-008, TC-SLA-012 behaviour half) and `tests/behaviour/board-records.test.ts` (TC-SLA-009, TC-SLA-010, TC-SLA-011) over `tests/fixtures/state/harness.ts` temp roots and the `guardStore` recorder: exactly-one-append and exactly-one-fence per application; append-only byte-prefix proof; durable reopen through a verified read; same-process and reopened-store replay no-ops; recorded-default-wins-over-changed-policy; stable ids under fact reversal; never-merge invariants across 10 advancing evaluations with the flipped-temp-policy liveness control; `waivedBy` never synthesized; torn/corrupted/checksum/wrong-kind/missing-field/undeclared-value histories classified as `state.store.torn` with zero appends and no derived `default-applied`; permission (`state.permission.denied`) and fence (`state.lock.busy`) faults per the existing table projections; first-sight 100 h gate applies exactly once; zero writes on read-only evaluations. (evidence: 37 tests green)
- [x] **3.3** Wire default application into the delivery seam consumed by Phase 4: the evaluator returns `decisionsToApply` (pure); `appendOwnerGateSlaDecision` is the only state-writing entry and Phase 4’s CLI composition calls it at the edge; the domain never touches the state port (TC-SLA-025 step 4). No CLI code in this phase — the contract split is fixed. (evidence: import/purity suite + state module boundary)

**Acceptance Criteria**:

- Must: AC-F3-1, AC-F3-2, AC-F4-1, AC-F5-1 hold end-to-end at the state seam: one complete EVT-1 record per application, idempotent replay, no invented default, never-merge never auto-proceeds at any age, only a recorded waiver supplies `waivedBy` (TC-SLA-006..011). — PASSED (board-defaults + board-records)
- Must: `STATE_SCHEMA_VERSION` unchanged; existing record kinds and derived documents untouched (TC-SLA-009 step 5). — PASSED (`delivery.state.v1`; no `documents.*` created)
- Must: torn/malformed history fails closed with the existing `state.*` identities and their contract exit projections (GAP-8, TC-SLA-011). — PASSED (torn/checksum/wrong-kind/missing-field/undeclared default, permission, fence)

**Files and modules**:

- Code areas: `packages/core/src/state/owner-gate-sla.ts` (new), `packages/core/src/state/index.ts` (updated), `tests/behaviour/board-defaults.test.ts`, `tests/behaviour/board-records.test.ts` (new), `tests/fixtures/board/{matrix/defaults,policy}/**` (new/extended), `tests/structure/inventory.json` (updated).
- System docs: none (state-layer feature spec reconciliation is phase 7; the record kind is additive).

**Tests**:

- TC-SLA-006, TC-SLA-007, TC-SLA-008, TC-SLA-009, TC-SLA-010, TC-SLA-011, TC-SLA-012 (completes). Iteration gates: `bun test tests/behaviour/board-defaults.test.ts tests/behaviour/board-records.test.ts`, `pnpm typecheck`.

**Completion signal**: `feat(GH-229): record owner-gate default-application decisions in the state ledger`

---

### Phase 4: `board` command surface — composition, collectors, never-silence

**Goal**: Ship the `board` v0 surface (F-6/F-7, DEC-7/DEC-9): render-once command with the injected-runtime harness path (`runCli`), declared collector unavailability with exit 2 and zero fabricated gates, envelope exclusivity under partial failure (GAP-11), and the v0 gate-fact mapping (GAP-9).

**Tasks**:

- [x] **4.1** Create `packages/cli/src/commands/board.ts`: `BoardCommandRuntime` — every read injected (tracker collector readers over normalized work items reusing the delivered status tracker read budget `STATUS_SOURCE_ITEM_LIMIT`, decision-history read + append via the Phase-3 state module, `nowIso`/`nowMs`); `createBoardCommandDefinition(runtime): CommandDefinition` with `flags: []`, `positionals: { max: 0 }`, `humanText` via `renderBoardHuman`; the handler collects gate facts (v0 mapping: owner-attention items → kind `owner-review`; the label set reused by reference), evaluates via the pure engine, performs at most one history read (only when a default is eligible) and the single fenced append when a default applies, and returns data or one classified failure (the family code naming the unavailable collector; `state.*` failures passed through classified). The handler performs no stream writes and chooses no exit code; no timer/loop (DEC-9). Updated `packages/cli/src/commands/index.ts`. (evidence: `bun test tests/behaviour/board-command.test.ts`)
- [x] **4.2** Compose the edge: updated `packages/cli/src/edge.ts` to wire `commands.board` beside `status`/`queue` — `createBoardCommandRuntime` reads the real GitHub tracker slice through `listWorkItems`, maps open owner-attention items to kind `owner-review`, reads/appends the state ledger, and injects `OWNER_GATE_SLA_POLICY`, clock, and fence tokens; registered in `tests/structure/inventory.json` and the executable allowances. (evidence: CLI build + content-inventory suite)
- [x] **4.3** Create `tests/fixtures/board/harness.ts` (the §4.1 in-process harness: injected brand/clock/run-id/collectors/policy/state store/streams over `runCli`) with available/failing collector builders (available-three, available-empty, failed, credential-unavailable, not-configured, two-collector partial are covered in the suites). (evidence: suites below)
- [x] **4.4** Create `tests/behaviour/board-command.test.ts` (TC-SLA-016, TC-SLA-023 behaviour half): `board` and `board --json` exit 0 with exactly one collector read; positionals/`--watch`/`--limit` rejected as `fallback.invocation` exit 1 with zero reads; write-free handler source scan; timer/unbounded-loop scan; command-registry cross-reference asserted exactly once (the existing planning-pack row — tree invariant, no authoring); synthetic-brand prefix and no product literal. (evidence: suite green)
- [x] **4.5** Create `tests/behaviour/board-collectors.test.ts` (TC-SLA-013, TC-SLA-014) and `tests/behaviour/board-never-silence.test.ts` (TC-SLA-015): declared family code per collector id, `assertEnvelopeContract` clean, no `data`/`gates[]` on failure, no all-clear token, one read attempt with no retry, distinguishable observed-empty success; per-collector naming with the synthetic second collector (ids data-derived); never-silence matrix over the full population × source conditions with the completeness meta-check and torn-store source. (evidence: suites green)
- [x] **4.6** Create `tests/behaviour/board-read-cost.test.ts` (TC-SLA-026 — mapped here by this plan; the test plan's §7 execution order omits it): exactly one tracker read at the delivered page limit, at most one verified decision-history read, zero appends/fences on read-only runs, one fence + one append when a default applies, no pagination/retry/new request kind/network write/child process, deliberate-second-read liveness control. (evidence: suite green)

**Acceptance Criteria**:

- Must: AC-F6-1, AC-F6-2, AC-F7-1 hold through `runCli`: one valid envelope with the declared `gates[]` record set and exit 0 when rendered; declared unavailability with exit 2, zero fabricated gates, and no partial board under partial failure (TC-SLA-013/014/015/016). — PASSED (board-collectors + board-never-silence + board-command)
- Must: the surface is exactly `board [--json]`; `--watch` and unknown input are rejected before any read (DEC-9, TC-SLA-016). — PASSED
- Must: read cost stays within the delivered tracker budget with at most one local verified state read (NFR-2, TC-SLA-026). — PASSED (one tracker read; one handler history read only when eligible)
- Should: the CLI registration diff is minimal and mirror-imaged on `status`/`queue`. — PASSED (definition + edge composition beside status/queue)

**Files and modules**:

- Code areas: `packages/cli/src/commands/board.ts` (new), `packages/cli/src/commands/index.ts` (updated), `packages/cli/src/edge.ts` (updated), `tests/fixtures/board/harness.ts`, `tests/fixtures/board/collectors/**` (new), `tests/behaviour/board-command.test.ts`, `tests/behaviour/board-collectors.test.ts`, `tests/behaviour/board-never-silence.test.ts`, `tests/behaviour/board-read-cost.test.ts` (new), `tests/fixtures/board/matrix/never-silence/**` (new), `tests/structure/inventory.json` (updated).
- System docs: none in-change. The command-registry row already exists (planning truth, verified); TC-SLA-016 step 10 pins it exactly once.

**Tests**:

- TC-SLA-013, TC-SLA-014, TC-SLA-015, TC-SLA-016, TC-SLA-026, TC-SLA-023 (completes). Iteration gates: `bun test tests/behaviour/board-command.test.ts tests/behaviour/board-collectors.test.ts tests/behaviour/board-never-silence.test.ts tests/behaviour/board-read-cost.test.ts`.

**Completion signal**: `feat(GH-229): add board command surface with declared collector unavailability`

---

### Phase 5: Output contracts, determinism, bounds, privacy, corpus, golden, performance, non-regression

**Goal**: Pin the full output contract (DM-1 machine + human parity), byte determinism, all four bounds with marks, privacy/brand neutrality, the committed corpus and golden snapshots, the 50 ms measurement, and additive non-regression.

**Tasks**:

- [x] **5.1** Create `tests/behaviour/board-output.test.ts` (TC-SLA-017, TC-SLA-018) over the mixed matrix: exact envelope top-level keys and declared `data` keys; per-gate closed key set with the marker exactly when `age === null`; value bindings (`default` non-null only under `default-applied`; `waivedBy` only from injected waiver facts); machine/human parity; unknown token; TTY/ANSI independence; brand header; observed-empty vs. unavailable distinction in both modes. (evidence: suite green)
- [x] **5.2** Create `tests/behaviour/board-determinism.test.ts` (TC-SLA-019) with the fixed run id `run-board-fixture`, clock `2026-11-06T12:00:00Z`, synthetic brand, reversed-fact and reversed-policy-order twins, 50-run hash set, changed-fact control, stable ids. (evidence: suite green)
- [x] **5.3** Create `tests/behaviour/board-bounds.test.ts` (TC-SLA-020) over under/at/over-cap, 100-gate, hostile-length, and multibyte fixtures built in-memory: caps and byte/line limits in both modes, every drop/clamp marked, rank-order never hides an escalated gate behind a fresh one, deterministic truncation. (evidence: suite green)
- [x] **5.4** Create `tests/behaviour/board-privacy.test.ts` (TC-SLA-022): canaries in title, body, comment, label value, raw payload, and credential absent from stdout/stderr/payload/grid/ledger; secret-read allowlist unchanged (four entries); thrown-secret containment; `ref` asserted as the allowed identity; declared-only EVT-1 key set. (evidence: suite green)
- [x] **5.5** Create `tests/behaviour/board-corpus.test.ts` (TC-SLA-028) over `tests/fixtures/board/corpus/*/case.json` with the completeness meta-check covering every named class, both kinds, both markers, never-merge, no-default, idempotency replay, collector-unavailable, partial failure, and bounds; zero-live-call throwing guard; per-case determinism; read-only tree assertion. (evidence: 10 corpus cases green)
- [x] **5.6** Create `tests/golden/board-grid.test.ts` (TC-SLA-029) with committed `tests/fixtures/board/golden/{envelope.json,grid.txt}` at the fixed run id/clock/brand and shipped policy; byte-for-byte equality in both modes; bounds asserted on the golden; changed-fact mutation controls; golden files read-only. (evidence: suite green)
- [x] **5.7** Create `tests/behaviour/board-performance.test.ts` (TC-SLA-027) over cap-sized and 100-gate fixtures: warm-up, median of five ≤ 50 ms for pure evaluation + ranking + rendering (collector/state I/O excluded), expensive-control liveness, environment recorded. Measured medians: cap-sized ≈0.1 ms, 100-gate ≈0.3 ms (`runtime=v26.3.0 platform=linux/x64`). (evidence: suite green; OQ-T10 value recorded)
- [x] **5.8** Non-regression (TC-SLA-030): existing `status`, `queue ready`, and `verify gates` suites remain unchanged and green in the aggregate run; `tests/structure/board-nonregression.test.ts` asserts the shared `STATUS_OWNER_ATTENTION_LABELS` reference, no duplicated literals, no SLA/board config key, unchanged envelope/state schema, and unchanged command modules. (evidence: structure suite + aggregate `pnpm check` in Phase 6.3)
- [x] **5.9** Fix any defects the pinning suites surface (rank instability, bound misses, marker leaks) inside the engine/renderer — no assertion weakening. Defects found and fixed were test-oracle assumptions (pretty-printed envelope parsing, 7-gate cap expectation), not engine defects. (evidence: all pinning suites green)

**Acceptance Criteria**:

- Must: AC-F7-2 and NFR-1..NFR-7 all measured and green: byte-identical output (TC-SLA-019/029), bounds enforced and marked (TC-SLA-020), privacy and brand neutrality (TC-SLA-022/023), corpus completeness (TC-SLA-028), 50 ms median (TC-SLA-027), non-regression (TC-SLA-030). — PASSED (163 board/contract/golden tests green; medians ≈0.1/0.3 ms)
- Must: `pnpm check` green end-to-end (lint, format, typecheck, tests, boundaries, exports parity). — PENDING Phase 6.3
- Should: the golden files are human-reviewable and normalized (no absolute paths, no unstable ordering). — PASSED (fixed run id/clock/brand; no paths)

**Files and modules**:

- Code areas: `tests/behaviour/board-output.test.ts`, `tests/behaviour/board-determinism.test.ts`, `tests/behaviour/board-bounds.test.ts`, `tests/behaviour/board-privacy.test.ts`, `tests/behaviour/board-corpus.test.ts`, `tests/behaviour/board-performance.test.ts`, `tests/golden/board-grid.test.ts` (new), `tests/fixtures/board/{matrix/mixed,bounds,privacy,corpus,golden}/**` (new), plus targeted fixes in `packages/core/src/domain/owner-gate-sla.ts` / `packages/cli/src/commands/board.ts` where a pinned assertion fails.
- System docs: none in-change.

**Tests**:

- TC-SLA-017, TC-SLA-018, TC-SLA-019, TC-SLA-020, TC-SLA-022, TC-SLA-027, TC-SLA-028, TC-SLA-029, TC-SLA-030. Full evidence command list per test plan §7.

**Completion signal**: `test(GH-229): pin board determinism, bounds, corpus, golden, and non-regression`

---

### Phase 6: Finalize and release — changeset, doc sync handoff, aggregate gates

**Goal**: Close the change: version bump per repo conventions, spec-reconciliation handoff, quality gates, and PR readiness (PDR-0003 ratification point).

**Tasks**:

- [x] **6.1** Version bump: added one minor changeset at `.changeset/gh-229-owner-gate-sla-minor.md` (naming per the `gh-183-closeout-minor.md` precedent) covering the lockstep `fixed` group bump triggered by the `@delivery-os/core` + `@delivery-os/cli` changes; no dependency additions, so no license-registry verdict is needed. (evidence: changeset file in tree)
- [x] **6.2** Spec reconciliation handoff (lifecycle phase 7 input, `@doc-syncer`): recorded below that a new current-truth feature spec `doc/spec/features/feature-owner-gate-sla.md` is expected (first-spec-only always-resolve per PM notes), the result-contract feature doc gains the family prose beyond the Phase-1 sync row, the state-layer feature doc gains the additive `owner-gate.decision` record kind, and the closeout spec needs no edit (it explicitly excludes owner-gate SLA mechanics). The command-registry row already exists (planning truth). This plan did not author any of that content. (evidence: handoff note below)
- [x] **6.3** Quality gates: ran and recorded `pnpm check` stages, `git diff --check`, `git status --porcelain`; no redistributable doc changed, so `scripts/.tests/test-doc-distribution.sh` is not triggered. Result: lint (warnings only), format:check, typecheck, boundaries, exports-parity, and 2682/2683 tests pass; the sole remaining local failure is `TC-RELEASE-001`, a pre-existing branch-diff test that compares `.changeset/` against `origin/main-tools`, which is two commits ahead (`GH-222`, `GH-226`); this is a stale-base artifact, not a GH-229 regression, and a PR merge checkout resolves it. The `ci-baseline-parity` environment test also requires a same-device `TMPDIR` locally (passes with `TMPDIR=$PWD/tmp/tmpdir`). (evidence: Phase 6 execution log)
- [x] **6.4** PR readiness: confirmed the Open-PR DoD evidence checklist from test plan §7 (all 12 ACs traceable and passing, all 7 NFRs measured, never-merge permanent regression green, exactly-one-record idempotency green, family-only error delta with sync green, non-regression green, changeset recorded, PR targets `main-tools`); the PDR-0003 policy-map diff is the `packages/core/src/contracts/owner-gate-sla.ts` `OWNER_GATE_SLA_POLICY_ROWS` hunk and must be surfaced in the PR description for owner ratification; the record flips to `Accepted` only on owner ratification at PR review. PR creation is the orchestrator's step. (evidence: checklist below)

**Acceptance Criteria**:

- Must: `pnpm check` green in a clean checkout; no undocumented error identity; exactly one changeset added; the PR description carries the policy-map diff and the PDR-0003 ratification note.
- Must: every AC and every TC in §Test Scenarios maps to at least one completed phase task with recorded evidence (unrun evidence is never recorded as passing).
- Should: measured 50 ms median recorded in the PR alongside the environment.

**Files and modules**:

- Code areas: `.changeset/gh-229-owner-gate-sla-minor.md` (new); no further code expected.
- System docs: none authored in-change; the phase-7 handoff list is recorded in the PR/change notes.

**Tests**:

- Full battery: `pnpm check` plus the test plan §7 evidence commands (structure, behaviour, golden, checks, boundaries, invariant scripts).

**Completion signal**: `chore(GH-229): finalize owner-gate SLA delivery with changeset and gate evidence`

---

## Test Scenarios

All 30 TCs from `chg-GH-229-test-plan.md` mapped onto phases (GAP-1/A-T2: no TC reshaped; TC-SLA-026 supplied with a phase by this plan because the test plan's §7 execution-order list omitted it — behaviour unchanged).

| TC ID | Scenario (abbreviated) | Phase(s) | AC / NFR |
|-------|------------------------|----------|----------|
| TC-SLA-001 | Policy contract data pinned (thresholds, comparator, kinds, classes, defaults, states, markers, audiences) | 1 | DM-3, DEC-2/8/10, NFR-5 |
| TC-SLA-002 | Aging from activity timestamp: fresh at 10 h, truthful arithmetic, skew corner | 2 | AC-F1-1 |
| TC-SLA-003 | Unknown age declared: absent vs unparseable, never fresh/zero/defaulted | 2 | AC-F1-2 |
| TC-SLA-004 | 24 h escalation: boundary, stickiness, resolve, visibility only | 2 | AC-F2-1, NFR-5 |
| TC-SLA-005 | Boundary precision at exactly 24 h / 72 h from contract data | 2 | AC-F2-1, AC-F3-1, NFR-5 |
| TC-SLA-006 | 72 h default application on a waiver gate with the EVT-1 record | 3 | AC-F3-1, AC-F4-1 |
| TC-SLA-007 | 72 h with no pre-agreed default: owner-review escalates indefinitely | 3 | AC-F3-2 |
| TC-SLA-008 | Never-merge protection: permanent no-auto-proceed, waiver-only override | 3 | AC-F5-1 |
| TC-SLA-009 | EVT-1 record content, durability, append-only history | 3 | AC-F4-1, EVT-1, DM-2, NFR-7 |
| TC-SLA-010 | Idempotency by gate identity: exactly one record, replay no-op | 3 | AC-F4-1, NFR-7 |
| TC-SLA-011 | State integrity: torn/malformed history classified, never truth | 3 | AC-F4-1, NFR-7 |
| TC-SLA-012 | Policy-as-data behaviour: unknown kind, temp-map mutation, no kind literals | 1 (contract half) + 3 (behaviour) | AC-F3-2, DM-3 |
| TC-SLA-013 | Collector unavailable: declared identity, zero gates, exit 2, no all-clear | 4 | AC-F6-1, NFR-6 |
| TC-SLA-014 | Per-collector declaration, partial-failure withholding | 4 | AC-F6-1 |
| TC-SLA-015 | Never-silence matrix across population × source conditions | 4 | AC-F6-2 |
| TC-SLA-016 | Command grammar: `--json` only, `--watch` rejected, write-free handler | 4 | AC-F7-1, DEC-9 |
| TC-SLA-017 | Machine envelope and `gates[]` record contract | 5 | AC-F7-1, DM-1 |
| TC-SLA-018 | Text aging grid: parity, unknown age, TTY independence | 5 | F-7, DM-1, NFR-1 |
| TC-SLA-019 | Determinism: byte-identical output, permutation invariance | 5 | AC-F7-2, NFR-1 |
| TC-SLA-020 | Bounds and truncation: caps, byte/line limits, marks, never-silence under truncation | 5 | NFR-4, AC-F6-2 |
| TC-SLA-021 | Error identity: family-only delta, sync green both directions | 1 | NFR-6, DEC-7 |
| TC-SLA-022 | Privacy: no credentials/payloads/titles/bodies in any output | 5 | DM-1, DM-2, §20/§21 |
| TC-SLA-023 | Brand neutrality: binary from configuration, no product literals | 1 (checks) + 4 (behaviour) | F-7, §21 |
| TC-SLA-024 | Audience seam and M1-S16 reuse without redesign | 1 (vocabulary) + 2 (evaluator) | AC-F8-1, DEC-4 |
| TC-SLA-025 | Pure domain core: no I/O, clock, randomness, ambient reads | 2 | §16/§21, NFR-1, ADR-0003 |
| TC-SLA-026 | Read cost: one collector read, bounded state reads, no new request kinds | 4 | NFR-2 |
| TC-SLA-027 | Performance: ≤ 50 ms pure evaluation, ranking, rendering | 5 | NFR-3 |
| TC-SLA-028 | Committed fixture corpus with completeness meta-check | 5 | all ACs (corpus oracle) |
| TC-SLA-029 | Golden board snapshot (machine + human) byte-for-byte | 5 | AC-F7-2, NFR-1, NFR-4 |
| TC-SLA-030 | Non-regression of `status`, `queue ready`, `verify gates`; shared definition by reference | 5 | F-1, F-6, §8.5, §12 |

Coverage cross-check: all 12 ACs (AC-F1-1..AC-F8-1), all 7 NFRs, DM-1..DM-3, EVT-1, and all 6 spec risks (RSK-1..RSK-6 per test plan §8.1) map to at least one task above; the aggregate gate (`pnpm check` + evidence commands) covers all TCs.

## Artifacts and Links

| Artifact | Location | Type |
|----------|----------|------|
| Change specification | `./chg-GH-229-spec.md` | Spec (source of truth) |
| Change test plan | `./chg-GH-229-test-plan.md` | Test plan (30 TCs, GAP-1..12, OQ-T1..T10) |
| PM notes | `./chg-GH-229-pm-notes.yaml` | Delivery state |
| Default-map decision | `doc/decisions/PDR-0003-owner-gate-sla-default-map.md` | Decision record (Proposed; ratifies at GH-229 PR review) |
| Placement decision | `doc/decisions/ADR-0003-oss-monorepo-structure.md` | ADR (tiers, runtime-API locations) |
| Clock semantics | `doc/decisions/ADR-0004-workitem-activity-timestamp-additive-v1.md` | ADR (absent = unknown) |
| Absence discipline | `doc/decisions/ADR-0006-workitem-custom-fields-and-comment-omission-representation.md` | ADR |
| TypeScript rules | `.ai/rules/typescript.md` | Binding rules |
| Testing strategy | `.ai/rules/testing-strategy.md` | Binding rules |
| Planning-pack board page | `doc/planning/oss-tooling/milestones/m1/commands/board.md` | Planning truth (proposed contract) |
| Command registry | `doc/planning/oss-tooling/cli-command-registry.md` | Planning truth (`board` row exists; not edited in-change) |
| Documented error table (sync surface) | `doc/spec/features/feature-result-contract.md` | doc/spec — one binding sync row in-change; rest at phase 7 |
| Changeset | `.changeset/gh-229-owner-gate-sla-minor.md` | Release (Phase 6) |

## Plan Revision Log

| Version | Date (UTC) | Author | Changes |
|---------|------------|--------|---------|
| 1.0 | 2026-11-06T14:00:00Z | plan-writer | Initial plan. Six phases per spec §18 order: (1) policy contract data + collector-unavailable family with binding error-table sync; (2) pure evaluation engine with audience seam asserted; (3) EVT-1 decision record + state integration + never-merge protection; (4) `board` command surface + collectors + never-silence + read cost; (5) output contracts, determinism, bounds, privacy, corpus, golden, performance, non-regression; (6) changeset, spec-reconciliation handoff, aggregate gates, PR readiness. All 30 TCs mapped without reshaping; GAP-1..12 readings confirmed (GAP-1 resolved by this plan; TC-SLA-026 phase supplied); verified: command registry is planning truth, `doc/spec` outside the doc-distribution marker set, documented error table is the binding S2 sync surface. |
| 1.1 | 2026-11-06T23:40:00Z | coder (recorded by pm) | Delivery additions recorded per DoR/remediation discipline: task 1.5 gained the runtime collector-unavailable family classifier in `packages/cli/src/classify.ts` (beyond the planned sync-only recognizer) so injected collector ids resolve to the declared family (TC-SLA-014); matrix/bounds/privacy fixtures use shared TypeScript builders (`tests/fixtures/board/matrix.ts`, `harness.ts`) instead of per-case JSON (corpus + golden remain committed JSON); existing structure fixtures updated (`port-contract-inventory.json`, `state-scope`, `cli-edge-seam`, `status-imports`); error-table counts recomputed post-merge (baseline 34 + 19 = 53 rows). |

## Phase 6 handoff and PR-readiness evidence

**Lifecycle phase 7 (`@doc-syncer`) input:** create `doc/spec/features/feature-owner-gate-sla.md` as the new current truth (first-spec-only always-resolve); extend `doc/spec/features/feature-result-contract.md` with the collector-unavailable family prose beyond the Phase-1 documented row; extend `doc/spec/features/feature-state-layer.md` with the additive `owner-gate.decision` record kind; the closeout spec needs no edit (it explicitly excludes owner-gate SLA mechanics); the `board` command-registry row already exists (planning truth, not edited).

**Open-PR DoD evidence checklist (test plan §7):**

- [x] All 12 ACs traceable and passing (TC-SLA-001..030 suites green).
- [x] All 7 NFRs measured (determinism, read cost, latency, bounds, precision, error identity, auditability).
- [x] Never-merge permanent regression green (`owner-review` never auto-proceeds).
- [x] Exactly-one-record idempotency green (same-process and reopened-store replay).
- [x] Family-only error delta green (one `status` kind + one documented family row; sync green both ways).
- [x] Non-regression green (`status`, `queue ready`, `verify gates` suites unchanged).
- [x] Changeset recorded (`.changeset/gh-229-owner-gate-sla-minor.md`).
- [x] PR target `main-tools` (orchestrator creates the PR).
- [ ] PDR-0003 policy-map diff surfaced in the PR description for owner ratification (orchestrator step; the diff is `OWNER_GATE_SLA_POLICY_ROWS` in `packages/core/src/contracts/owner-gate-sla.ts`).

## Execution Log

| Phase | Status | Started | Completed | Commit | Notes |
|-------|--------|---------|-----------|--------|-------|
| 1 — contract data + error family | Done | 2026-11-06 | 2026-11-06 | `c3ce670e` | Policy map, thresholds/comparator/states/markers/audiences/bounds, board + decision vocabulary, one `status` error kind, documented family row, narrow sync recognizer, contract structure suite. |
| 2 — pure evaluation engine | Done | 2026-11-06 | 2026-11-06 | `7da286cf` | Aging/unknown-age/escalation/default eligibility/rank/cap, policy validator, human renderer, purity + audience structure suites and type probe. |
| 3 — EVT-1 state ledger | Done | 2026-11-06 | 2026-11-06 | `3427fd5a` | Append-only `owner-gate.decision` record, closed payload validation, verified read, exactly-once idempotency, torn classification, defaults/never-merge/records suites. |
| 4 — `board` surface | Done | 2026-11-06 | 2026-11-06 | `5ff4c546` | `board [--json]` definition, injected runtime, edge composition, declared collector family failures, never-silence, read-cost suites. |
| 5 — output contracts/pinning | Done | 2026-11-06 | 2026-11-06 | `846554e8` | Output/parity, determinism, bounds, privacy, 10-case corpus, golden envelope/grid, 50 ms measurement, non-regression. |
| 6 — finalize/release | Partial | 2026-11-06 | 2026-11-06 | (this commit) | Changeset and handoff recorded. `pnpm check` stages: lint warnings-only, format PASS, typecheck PASS, tests 2682 pass / 1 fail (`TC-RELEASE-001` stale-base branch-diff), boundaries PASS, exports parity PASS. The sole failure is caused by the branch being two commits behind `origin/main-tools` (`GH-222`, `GH-226`); a PR merge checkout resolves it. Local `ci-baseline-parity` needs `TMPDIR=$PWD/tmp/tmpdir` (cross-device hardlink). |

**Phase 6 gate commands and results:**

- `pnpm lint` — exit 0, 34 warnings / 5 infos, 0 errors.
- `pnpm format:check` — PASS.
- `pnpm typecheck` — PASS (6 packages + `tests/types`).
- `TMPDIR=$PWD/tmp/tmpdir bun test` — 2682 pass, 4 skip, 1 fail (`TC-RELEASE-001` stale-base changeset diff).
- `pnpm check:boundaries` — PASS (dependency-cruiser, ambient globals, workspace entrypoints, secret-read boundary).
- `bun run scripts/checks/exports-parity.ts` — PASS.
- `git diff --check` — clean.
- `git status --porcelain` — only the intended Phase 6 artifacts (changeset, plan/pm-notes, formatted Phase 1–5 files).
- Doc-distribution guard — not triggered (no redistributable doc changed).
