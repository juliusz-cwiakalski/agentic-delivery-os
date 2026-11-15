---
id: chg-GH-297-test-plan
status: Updated
version: 1.3
created: 2026-11-15
last_updated: 2026-11-16T01:15:00Z
owners: [Juliusz Ćwiąkalski]
service: delivery-os
labels: [milestone-m2, cli, board, multi-repository, shared-state-source]
version_impact: minor
summary: "Pin the full M2 board as comparisons a suite runs: four sections (LANES, GATES, ASKS, PARKED) projected from the one fact bundle `collectStatusFacts` plus the delivered lane fold, with `stateSource` equal on the board, status, and brief payloads; repository scope without state mixing (the default form asserted as its own criterion — scope `repository`, selection `current`, exactly the invoking key, zero host-index reads — plus `--project` narrowing with no other repository read, `--all` as host index union invoking checkout bounded to `BOARD_MAX_REPOSITORIES` (128) with a deterministic retained set and counted overflow, the root-absent rule, the `unbound` scope for an unbound or underivable invoking checkout at exit 0, and the `--all`+`--project` `fallback.invocation` refusal); the delivered owner-gate SLA preserved verbatim (24 h / 72 h with `>=` boundaries, the PDR-0003 two-row map, waiver recording, ranking, the per-repository cap of 8, and the idempotent append-only decision record); owner asks carrying computed age and the drawn-default join over the invocation's post-append decision set (`none` declared, never omitted, coordinator questions excluded, a ref-less ask carrying the delivered bare `ref: null` with no invented reason, and no second decision-history read); parked work carrying reason and `until` with the classified `owner-hold-no-expiry` absence, the host-wide `ownerHold` fact, and `provider-quota` parks excluded by declaration; production mounting (21 prompt-required families, root and family help, reference page serving the coverage check, coverage-inventory row); the declared envelope and 0/1/2 exit projection with no partial board; determinism, ordering, unique identities, the delivered and per-section bounds with counted omissions, the 128-repository cap with its retained-set rule, and the declared byte-guard drop order (`parked` → `asks` → `lanes` → `gates`, tail first, never the repository list); write discipline (the idempotent decision record and exactly two delivered store-opening side effects); purity and brand neutrality; the declared read-cost and 50 ms projection budget; the closed two-segment error-code allowlist widened by exactly the two board identities (53 → 55) with **all 23 count-pinning sites enumerated in spec Appendix D** asserted to move with the rows rather than discovered at delivery (138 table entries, 137 delivered rows, 2 board rows, 138 documented identities, allowlist paragraph 55, `BASELINE_ROWS.length + 102` → `+104`), a repo-wide no-leftover scan for 136/135/53/52 across the five named files, four-way agreement between classifier, sync check, structural mirror, and carrier, and a two-segment near-miss rejected instead of family-matched; and the aggregate gate. 29 acceptance criteria are bound to 48 test cases; every case names the AC it proves, and every AC has at least one case. No contract question remains open: all seven v1.0 findings are closed by DEC-13..DEC-19 and the v1.2 allowlist finding by DEC-20 (§14), and two test-methodology declarations remain in §3.5."
links:
  change_spec: ./chg-GH-297-spec.md
  implementation_plan: ./chg-GH-297-plan.yaml
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - M2-S4: Board (M2)

## 1. Scope and Objectives

The delivered board is a render-once gate grid over injected collectors, composed only when the edge is handed a board runtime. This change turns it into the fleet-coordination surface: four sections on one screen, from the same fact bundle `brief` and `status` project from, spanning managed repositories by repository key, mounted at the production entrypoint. The risk this plan is built around is not a missing feature — it is a board that **looks** complete while one of its independent truths is false. A section that renders zero rows because a read failed is a false all-clear on the surface the owner uses to decide where to intervene; a row that borrows another repository's holder, phase, or state is a mis-attribution the owner will act on; a fabricated `until`, `age`, or drawn default is a policy claim nobody recorded; an omission that is not counted — a dropped row or a dropped repository key — is a hidden workload; and a command that is composed but not prompt-required is exactly the M1 failure this story closes. Every one of those is therefore asserted as a comparison over payload bytes, ledger records, counters, and tree snapshots — never as a prose claim.

The v1.1 amendment replaced the plan's one genuine contract contradiction (an unbounded `repositories[]` under a 65 536-byte payload cap and a 2 000-record host index) with a bound: `BOARD_MAX_REPOSITORIES` = 128 included repositories, a deterministic retained set that always keeps the selected repository, the overflow counted in `omittedBySection.repositories`, and a declared byte-guard drop order for rows (`parked` → `asks` → `lanes` → `gates`) that never touches the repository list or the collector evidence. It also gave the default form its own criterion, made the lane phase-null cell total, pinned the ask `defaultState` join to the invocation's post-append decision set, named the grammar-refusal identity, declared `provider-quota` out of `parked[]`, and declared the delivered bare `ref: null`. This plan now asserts each of those as a rule rather than an assumption, and the seven review points are closed with nothing carried forward.

The v1.2 amendment closed one delivery-blocking detail the review found untested: the two new board identities join the **closed** two-segment error-code allowlist by exact declaration (53 → 55) in both the sync check and its structural mirror, with no `board.*` family and no pattern widening, and every identity count that follows moves with it (`ERROR_TABLE` 136 → 138, 135 → 137 delivered rows in the spend-exclusion assertion, exactly 2 `board` domain-kind rows, 136 → 138 documented identities, and the carrier's allowlist paragraph reconciled from 52 to 55 because the delivered 52-entry count omits `verify.narrowed-scope`). `TC-BOARD-053` owns that whole unit — set, counts, prose, and near-miss rejection — because an allowlist that is widened by convenience instead of by declaration is a gate that silently stops gating.

The v1.3 amendment replaced this plan's "four structural count assertions" shorthand with the exhaustion the change actually requires: **Appendix D enumerates 23 count-pinning sites across five files** — the four `136` entry assertions in the structural mirror plus its `53`, `135`, and `"136 identities"` pins; the dispatch-taxonomy header comment, test name, and length assertion; the verify-suite-map `sourceEntries`/`documentedRows` pair; the sync suite's four `BASELINE_ROWS.length + 102` sites plus its header-comment, test-name, `136`-read, and document-content pins; and the carrier's two `136` mentions and its 52-entry allowlist paragraph. `TC-BOARD-053` now asserts the site list as a list: every pin moves in the same commit as the rows, a repo-wide scan of those five files finds no leftover `136`/`135`/`53`/`52` identity-count pin, and classifier, sync check, structural mirror, and carrier agree on 138 / 137 / 55 / 2 / 138. The plan references Appendix D rather than copying it, so the specification stays the single locator authority.

The plan composes delivered seams rather than inventing new ones: the in-process board harness (`tests/fixtures/board/harness.ts`) for surface, payload, bounds, determinism, and write-audit cases; the real production composition harness over real temporary git checkouts and a real host index (`tests/fixtures/projects/production.ts`) for every repository-scope case, because the identity under test is the checkout's own git metadata and a synthetic scope would prove nothing; the delivered lane-fold and status-fact builders for the section populations; the delivered blocker ledger for asks; and the delivered park projection for parked work. Absence is proven three ways, per house discipline: a recording seam or armed guard, a zero counter, and a byte-or-record-count assertion on the durable tree.

The plan is adversarial about the failure shapes the spec's risk register names. **A board that cannot fail**: every degraded-source cell is paired with a readable twin and a mutant, so a "withhold" assertion cannot pass because the fixture never produced rows (`TC-BOARD-005`, `TC-BOARD-080`). **A shared-source claim asserted from code reading**: the equality is taken from three payloads in one process (`TC-BOARD-003`). **A multi-repository board that mixes state**: two repositories hold one ref and produce two rows carrying identical section ids and different repository keys, which fails any identity keyed by id alone (`TC-BOARD-012`, `TC-BOARD-083`). **A cap that silently hides a fleet**: a 129-repository world with the invoking key last must list 128 keys, keep the invoking key, and count the one it did not list — and a mutant that drops the invoking-key retention must fail (`TC-BOARD-064`, `TC-BOARD-084`). **A bounded screen that hides work**: every drop is counted, the byte guard drops only in the declared order, and the omitted count is cross-checked against the human `+N more` marker (`TC-BOARD-024`, `TC-BOARD-065`, `TC-BOARD-082`, `TC-BOARD-085`). **A mount that advertises a command that does not answer**: the prompt-set entry, the composition, both help entries, the reference page, the coverage row, and the unmounted-mutant are one unit (`TC-BOARD-040`..`TC-BOARD-043`).

This document is a verification map, not an execution claim. No case has been run against a new implementation at authoring time, and phase ownership belongs to `chg-GH-297-plan.yaml` (authored in phase 4). Where the specification leaves mechanism to delivery — the edge runtime seam shapes — the case asserts the declared property through the payload, the record, or an injected seam and **fails naming the missing contract** rather than skipping (`AMB-TP-2`).

### 1.1 In Scope

- The four sections and their declared order, row-field completeness (`repository`, `ref` or declared absence, `owner`, `ownerSource`), and the active-lane population with lease holder and a **total** phase classification (`phase-unrecorded` when no phase record exists, `phases-complete` when a record exists with nothing in progress, the open entry's id otherwise, latest-in-lifecycle-order when several are open) (F-1; AC-F1-1; DM-4, DM-9, DM-10; DEC-7, DEC-15).
- The one named shared state source: `stateSource` on the board, status, and brief payloads, the single declared constant, the `lanes` collector evidence per repository, and the closed collector-id set (F-2; AC-F2-1, AC-F2-2, AC-F2-3; DM-1, DM-7; DEC-3).
- Repository selection: the default form as its own criterion (scope `repository`, selection `current`, exactly the invoking `repoKey`, zero host-index reads, no other repository read), `--project` narrowing (including a key beyond the ascending cap) with no other repository read, `--all` as index-union-invoking-checkout with one index read, the root-absent rule, the absent-index non-error, the present-but-unreadable index refusal, the `unbound` scope for an unbound **or identity-underivable** invoking checkout, the `--all`/`--project` `scope: repository` rule, and the `--all`+`--project` plus valueless-`--project` `fallback.invocation` refusals (F-3; AC-F3-1..AC-F3-6; DM-7; DEC-5, DEC-14, DEC-17).
- The repository cap: `BOARD_MAX_REPOSITORIES` = 128 included repositories, the ascending retained-set rule with the selected repository always included, `omittedBySection.repositories`, `truncated`, and the bounded read set that follows from it (AC-F9-4; DM-11; NFR-4, NFR-5; DEC-13).
- The delivered owner-gate SLA preserved as the gates section: mapping, thresholds, `>=` boundaries, policy map, waiver recording, ranking, per-repository gate cap, collector-unavailable identities, and the idempotent append-only decision record (F-4; AC-F4-1, AC-F4-2, AC-F4-3; DM-3; DEC-2).
- Owner asks: the open owner-audience question population with computed age, the drawn-default join over the **post-append** decision set (`pending` / `applied` / `none`), coordinator exclusion, a ref-less ask carrying the delivered bare `ref: null` with no invented reason, the delivered ranking, the per-repository cap, and the single shared decision-history read (F-5; AC-F5-1, AC-F5-2, AC-F5-3; DM-5; DEC-4, DEC-16, DEC-19).
- Parked work: open lane park episodes with cause, `until`, preservation and provider profile, the classified `owner-hold-no-expiry` absence, latest-per-ref, the closed `peak-window`/`owner-hold` population with `provider-quota` declared out, and the host-wide `ownerHold` fact (F-6; AC-F6-1, AC-F6-2; DM-6; DEC-11, DEC-18; NG-9).
- Production mounting: the 21st prompt-required family, unconditional production composition, root and family help, the reference page serving the coverage check, the coverage-inventory row, and mounting isolation from every other family (F-7; AC-F7-1, AC-F7-2; DEC-10).
- Classified outcomes: the five-field envelope, the exact `0`/`1`/`2` projection, no partial board, the two new error identities under the new `board` domain kind with their in-boundary documentation and their exact two-segment allowlist widening (53 → 55, no family or pattern broadening, near-miss rejected), **every count-pinning site enumerated in spec Appendix D (23 sites across five files) moving to its declared post-change value in the same commit as the rows**, the repo-wide no-leftover scan for `136`/`135`/`53`/`52` over those five files, the four-way agreement between classifier, sync check, structural mirror, and carrier (138 entries / 137 delivered rows / 55 allowlist codes / 2 board rows / 138 documented identities), the delivered collector family and the delivered `fallback.invocation` grammar identity unchanged (F-8; AC-F8-1, AC-F8-2, AC-F8-3; DM-8; C-7, C-10, C-16; DEC-20).
- Determinism, ordering, identity uniqueness, delivered and per-section bounds, the declared byte-guard order, write discipline, purity, and brand neutrality (F-9; AC-F9-1, AC-F9-2, AC-F9-3, AC-F9-4; DM-11; NFR-2, NFR-4, NFR-6, NFR-7; DEC-13).
- Read cost (including the ask join's reuse of the single decision-history read), the 128-repository bound, the 50 ms projection budget, and the aggregate quality gate (AC-NFR5-1, AC-NFR9-1; NFR-5, NFR-8, NFR-9).
- Non-vacuity controls: false all-clear, fabricated value, silent omission, duplicate row and state mixing, unmounted command, repository-cap overflow, and byte-guard order — each with a paired positive twin and, where the pre-change code already exhibits the guarded behaviour, a named mutation.

### 1.2 Out of Scope & Known Gaps

- [OUT] Steering notes, receipts, TTLs, per-ask owner-drawn defaults, and batched ask resolution (M2-S5, GH-298; NG-1). The board's `drawnDefault` / `defaultState` pair is asserted as the *delivered* policy join only; no case drives a steering note.
- [OUT] Metrics, alarms, burn-rate, spend measurement, and the retro action registry (M2-S6, GH-299; M2-S10; NG-2).
- [OUT] Any group-scoped board, group enumeration, or member aggregation (NG-3). One case asserts the *absence* of group semantics (`TC-BOARD-013`); no case builds a group board.
- [OUT] `provider-quota` and other provider- or queue-level park conditions as board rows (NG-9, §7.2). One cell asserts the exclusion and that the delivered provider/queue surfaces still carry it (`TC-BOARD-033`); no case projects it onto the board.
- [OUT] A single-board fleet larger than `BOARD_MAX_REPOSITORIES` (128) included repositories (§7.2). The cap and its counted overflow are asserted (`TC-BOARD-064`, `TC-BOARD-084`); no case asserts that a 2 000-repository fleet is fully listed, because the contract says it is not.
- [OUT] New tracker read models, new state families, new event topics, write endpoints, and network writes (NG-4, NG-5). The board emits no event; no case subscribes to one.
- [OUT] Changing the delivered lane human output, the delivered gate-only payload semantics, or the delivered board bounds (NG-8). The lane human golden must stay byte-identical; the machine lane golden gains only `leaseHolder` (`TC-BOARD-006`, `TC-BOARD-063`).
- [OUT] Retiring `projects list --flat` or renaming any delivered command, field, or state artifact (NG-7).
- [OUT] Phase-7 current-truth documentation reconciliation (`@doc-syncer`) and the phase-8 review attestations. The only in-boundary documentation write is the error-table carrier (C-7), whose row presence, identity counts, and allowlist paragraph are asserted (`TC-BOARD-053`); the surrounding prose quality is review-owned.
- [OUT] Commit hygiene and PR posture as *tests* (NFR-10, DoD-18). They are recorded as gate/review evidence (`TC-BOARD-072`, §10), not asserted by a permanent suite.
- [GAP-T1 — "≥ 1 row in each section" needs a fixture that can fail] `AC-F1-1` requires at least one row per section; the case family supplies an all-four-populated case and four single-section-empty cases, so a board that silently drops a section is distinguishable from a board whose section is legitimately empty (`TC-BOARD-001`).
- [GAP-T2 — the 50 ms budget is measured, not assumed] `NFR-8` is a warm median of five over the pure projection and render with I/O excluded; the measurement prints every sample and the fixture's cap sizes. This mirrors the delivered board precedent (`TC-SLA-027`); a shared-CI spike would be visible, not hidden in an average (`TC-BOARD-071`).
- [GAP-T3 — edge runtime seam shapes are delivery-bound] The managed-set resolver, the phase read, the park classification, and the ask projection are consumed through injected seams the specification does not name. Cases assert payload, exit, and evidence; a case that cannot resolve its seam fails naming the missing contract (`AMB-TP-2`). Behaviours, identities, closed vocabularies, bounds, and AC traceability are not delivery-bound.
- [GAP-T4 — no pre-change byte baseline exists for the four-section screen] Determinism is asserted by paired runs and a committed golden, and the delivered gate-grid goldens are regenerated deliberately with a reviewed delta limited to declared additive fields (`TC-BOARD-060`, `TC-BOARD-063`).
- [GAP-T5 — the shared-source key lands in the same change as its consumer] If the shared-source phase lands after the board surface, `TC-BOARD-003` fails loudly rather than skipping; the equality has no fallback path.
- [GAP-T6 — the repository cap makes an at-scale world cheap to build] 129 seeded index entries are enough to prove the cap, the retained set, and the overflow count; no 2 000-repository fleet is constructed because the contract forbids listing one (`TC-BOARD-064`).

## 2. References

| Reference | Role in this plan |
|---|---|
| [`chg-GH-297-spec.md`](./chg-GH-297-spec.md) v1.3 | Binding source: F-1..F-9, **29 ACs** (`AC-F1-1`, `AC-F2-1..3`, `AC-F3-1..6`, `AC-F4-1..3`, `AC-F5-1..3`, `AC-F6-1..2`, `AC-F7-1..2`, `AC-F8-1..3`, `AC-F9-1..4`, `AC-NFR5-1`, `AC-NFR9-1`), DM-1..DM-11, NFR-1..NFR-10, DEC-1..DEC-20, NG-1..NG-9, §6 flows 1–6, §8.3 contract shape / ordering / scope resolution / exit projection, §14 (all review points closed, including OQ-8, OQ-9, OQ-10), §17.1 DoD-1..DoD-18, Appendix B (ticket AC mapping and the binding test-plan mapping note), Appendix C (C-1..C-16), **Appendix D (23 count-pinning sites, the binding locator list)**. |
| [`chg-GH-297-plan.yaml`](./chg-GH-297-plan.yaml) | To be authored in phase 4 (delivery_planning). Phase ownership of these cases is declared there, not here. |
| [`.ai/rules/testing-strategy.md`](../../../../.ai/rules/testing-strategy.md) | Test layers, module-to-test mapping, invariant-test authoring (no moving-base diffs; goldens regenerate only by explicit command; assert the value's meaning), and the aggregate gate. |
| [`.ai/rules/typescript.md`](../../../../.ai/rules/typescript.md) | Strict types, injected clock/environment, data-only contracts, pure domain, adapters own I/O, injected fakes over `mock.module`. |
| [M2 test scenarios](../../../planning/oss-tooling/milestones/m2/test-scenarios.md) | `SC-M2-S4-01` and `SC-M2-S4-02`, inherited by name and reconciled below; never restated. |
| [M2 board command page](../../../planning/oss-tooling/milestones/m2/commands/board.md) | The reference page the coverage check resolves; asserted for existence and `--help` / `--version` mentions (`TC-BOARD-042`). |
| [M2 contracts](../../../planning/oss-tooling/milestones/m2/contracts.md) | Shared-continuity and repository-naming authority behind `repositories[]` and the repository-key boundary. |
| [M2 entrypoint delta](../../../planning/oss-tooling/milestones/m2/entrypoint-delta.md) | The mounting pattern and the observed root listing the 21-family assertion extends. |
| [`feature-owner-gate-sla.md`](../../../spec/features/feature-owner-gate-sla.md) | Delivered gate payload, mapping, SLA, policy map, ranking, and bounds the gates section preserves. |
| [`feature-status-digest.md`](../../../spec/features/feature-status-digest.md), [`feature-brief.md`](../../../spec/features/feature-brief.md) | The shared fact bundle, the additive `stateSource` key, and the goldens updated with it. |
| [`feature-scheduling-engine.md`](../../../spec/features/feature-scheduling-engine.md) | The lane fold, lane states, park reasons, and the optional `leaseHolder` extension. |
| [`feature-projects.md`](../../../spec/features/feature-projects.md) | The host root, per-repository state scope, the `unbound` scope, and the host index (schema, 2 000-record bound, maintenance rule) the board's 128-repository cap reads from. |
| [`feature-blockers.md`](../../../spec/features/feature-blockers.md), [`feature-peak-pausing.md`](../../../spec/features/feature-peak-pausing.md) | The typed-question ledger and open-question view; the park projection and the classified `owner-hold` absence; the provider/queue surfaces that keep `provider-quota`. |
| [`feature-result-contract.md`](../../../spec/features/feature-result-contract.md) | The in-boundary error-table carrier (C-7), the delivered collector family rows, the delivered `fallback.invocation` containment identity, and the closed two-segment allowlist paragraph whose count is reconciled to 55 (DEC-20). |
| [`feature-cli-entrypoint.md`](../../../spec/features/feature-cli-entrypoint.md) | The prompt-required set and the "composed but not advertised is dropped" composition rule the mount changes. |
| **Delivered suites consumed as anchors** | `tests/behaviour/board-*.test.ts` (command, collectors, never-silence, records, defaults, escalation, aging, bounds, determinism, output, performance, privacy, read-cost, corpus, waiver-recording), `tests/golden/board-grid.test.ts`, `tests/behaviour/brief-*.test.ts`, `tests/behaviour/status-*.test.ts`, `tests/golden/status-digest.test.ts`, `tests/golden/brief.test.ts`, `tests/golden/lanes-list.test.ts`, `tests/behaviour/projects-*.test.ts`, `tests/behaviour/entrypoint-*.test.ts`, `tests/structure/entrypoint-bin.test.ts`, `tests/structure/events-production-composition.test.ts`, `tests/structure/daemon-production-composition.test.ts`, `tests/checks/help-guide-coverage.test.ts`, `tests/checks/reference-page-parity.test.ts`, `tests/checks/error-table-sync.test.ts`, `tests/structure/error-table.test.ts`, `tests/structure/board-nonregression.test.ts`. |
| **Delivered harness seams reused** | `tests/fixtures/board/{harness,matrix}.ts` + `tests/fixtures/board/corpus/**`; `tests/fixtures/projects/{production,state-scope,temp-repos,host-root,host-index}.ts`; `tests/fixtures/state/harness.ts`; `tests/fixtures/status/harness.ts`; `tests/fixtures/brief/{cases,harness}.ts`; `tests/fixtures/queue/{lanes,schedule,parks}/**`; `tests/fixtures/blockers/{harness,ranking}.ts`; `tests/fixtures/entrypoint/programs.ts`; `tests/golden/helpers.ts`; `tests/behaviour/verify-support.ts` (`guardStore`, `VerifyCallRecorder`). |

**Inherited scenario seeds.** The two planning seeds are inherited by name and mapped onto the criteria they already assert; neither body is restated. Both still pass unchanged under v1.1: `SC-M2-S4-02`'s world holds two repositories, far inside `BOARD_MAX_REPOSITORIES` (128), so the retained set is the full set, `omittedBySection.repositories` is `0`, and `truncated` is `false` — the seed is a positive control for the cap as well as the collision rule.

| Seed | Inherited as | Mapping to the spec's criteria | Cases |
|---|---|---|---|
| `SC-M2-S4-01` — the four sections from one state source, each row naming its ref and owner | The four-section + shared-source block, executed from one fixture repository | The seed's "four sections from the same state source" is `AC-F1-1` (sections, order, row fields) **plus** `AC-F2-1` (the payload equality). The seed's "each row names its ref and owner" is the row-field half of `AC-F1-1` and the provenance half materialised as `DM-10`'s `ownerSource`. The seed is satisfied when both cases are green together; neither case alone satisfies it. | `TC-BOARD-001` (sections, order, rows), `TC-BOARD-003` (payload equality) |
| `SC-M2-S4-02` — two managed repositories on one host, every lane under its repository key, total equal to the sum of per-repository boards with no duplication | The repository-scope block, executed over real checkouts and a real host index | The seed asserts exactly `AC-F3-1` (both keys listed; row count equals the sum of the *included* per-repository boards; no duplicate identity). `AC-F3-2` is the seed's hard edge — two repositories holding one ref — and is where the seed would otherwise pass on counts alone while rows overwrite each other. `AC-F3-1`'s parenthetical also makes the seed a cap control: two keys are within the 128 cap, so the full set is retained. The seed is satisfied when `AC-F3-1` holds, the same-ref collision cell is green, and the cap reports no omission. | `TC-BOARD-011` (`AC-F3-1`, cap-clean cell), `TC-BOARD-012` (`AC-F3-2`), `TC-BOARD-083` (identity invariant over the collision matrix), `TC-BOARD-084` (seed-as-cap-control) |

Reconciliation note: the seeds are the *minimum*; they do not cover selection edge cells, the `unbound` scope, the repository cap, the byte-guard order, the delivered SLA's preservation, asks, parked work, mounting, classification, bounds, write discipline, or purity. Those arrive as new cases and are marked as such in §3.4; the seed-derived cases carry the seed id in their `Related IDs` line.

## 3. Coverage Overview

Evidence classes used below: **Suite** (a committed assertion in `pnpm check`), **Suite + mutation** (a suite assertion whose detection power is proven by a named in-place mutation, used where the guarded property is already partially exhibited before the change), **Golden** (a byte-exact committed artifact), **Quality gate** (an execution record, not a permanent assertion), **Review-verified** (a diff/content inspection recorded in §10 and by the reviewer).

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Criterion (abridged) | TC ID(s) | Evidence class | Status |
|-------|----------------------|----------|----------------|--------|
| AC-F1-1 | A repository with an active lane, an open owner ask, an open gate, and a parked lane renders exactly `LANES`, `GATES`, `ASKS`, `PARKED` in that order; every row names its repository key, ref, and owner; `--json` carries all four arrays with ≥ 1 row each. (Ticket AC; `SC-M2-S4-01` inherited.) | TC-BOARD-001, TC-BOARD-002, TC-BOARD-006, TC-BOARD-007, TC-BOARD-010 | Suite | Covered |
| AC-F2-1 | `board.data.stateSource` equals `status.data.stateSource` and `brief.data.stateSource`, and equals the declared identity. (`SC-M2-S4-01` inherited.) | TC-BOARD-003 | Suite + Golden | Covered |
| AC-F2-2 | `lanes[]` is the delivered lane projection of the included repositories; `collectors[]` carries a `lanes` entry per included repository; no section names a source outside the shared bundle plus the lane fold. | TC-BOARD-002, TC-BOARD-004 | Suite | Covered |
| AC-F2-3 | An unreadable blocker ledger, park store, or gate source withholds the run with the declared identity at exit `2` naming the repository key; no section renders zero rows for that source. | TC-BOARD-005, TC-BOARD-052, TC-BOARD-080 | Suite | Covered |
| AC-F3-1 | `board --all` over two managed repositories lists both keys (both within the 128 cap, so the full set is retained), every lane under its own key, section counts equal to the sum of the **included** per-repository boards, zero duplicated identities. (`SC-M2-S4-02` inherited.) | TC-BOARD-011, TC-BOARD-016 | Suite | Covered |
| AC-F3-2 | Two managed repositories holding one ref produce two distinct rows carrying their own repository key, phase, holder, and state; no merge, no overwrite. | TC-BOARD-012, TC-BOARD-083 | Suite + mutation | Covered |
| AC-F3-3 | An unmanaged repository key is refused as `board.repository-unknown` at exit `1`; nothing is rendered. | TC-BOARD-013 | Suite | Covered |
| AC-F3-4 | `--project` for a managed key yields `selection: project`, `repositories[]` naming exactly that key **even when it sits beyond the ascending 128-key cap**, and no other repository's state read; `--all` with `--project` is refused with the delivered `fallback.invocation` at exit `1`. | TC-BOARD-014, TC-BOARD-064 | Suite | Covered |
| AC-F3-5 | A default-form invocation outside any work tree **or** whose invoking identity cannot be derived yields `scope: unbound`, empty `repositories[]`, empty sections, the delivered bounded warning, exit `0` — never an error, never a host-index fallback, never a claim about a repository; `--all` and `--project` are not covered by the unbound rule and report `scope: repository`. | TC-BOARD-015 | Suite | Covered |
| AC-F3-6 | A bound invoking checkout with no `--project` and no `--all` yields `scope: repository`, `selection: current`, `repositories[]` exactly the invoking `repoKey`, zero host-index reads, and no other repository's state read; an unbound or identity-underivable invoking checkout follows AC-F3-5. | TC-BOARD-010, TC-BOARD-015 | Suite | Covered |
| AC-F4-1 | Delivered SLA semantics: `fresh` under 24 h, `escalated` from 24 h (`>=`), `default-applied` at or after 72 h for a defaultable `waiver`; `owner-review` never-merge and non-defaultable; a recorded waiver surfaces with `waivedBy`; the delivered rank order holds. | TC-BOARD-020, TC-BOARD-022, TC-BOARD-023, TC-BOARD-063 | Suite | Covered |
| AC-F4-2 | A `waiver` gate crossing 72 h appends exactly one decision record and renders `default-applied` / `owner-review-first`; a second run appends nothing and renders the identical row. | TC-BOARD-021, TC-BOARD-031 | Suite | Covered |
| AC-F4-3 | The gate cap of 8 per repository, the per-section caps (lanes 20, asks 8, parked 8), the 65 536-byte `data` cap, the 24-line / 4 096-byte human cap, and the delivered field caps hold; every drop — by a per-section cap or by the byte guard — sets `truncated` and increments `omittedBySection` (the repository-list cap is AC-F9-4). | TC-BOARD-024, TC-BOARD-025, TC-BOARD-065, TC-BOARD-082 | Suite + mutation | Covered |
| AC-F5-1 | An open `owner`-audience question on a ref with a defaultable gate carries the delivered question fields, a computed `age`, `drawnDefault` equal to the policy default, and `defaultState` `pending` (or `applied` when a decision record exists, including one appended earlier in the same run). | TC-BOARD-030, TC-BOARD-031, TC-BOARD-081 | Suite | Covered |
| AC-F5-2 | A question on a ref with no defaultable gate carries `drawnDefault: null` with `defaultState: "none"` (never omitted); a ref-less ask carries the delivered bare `ref: null` with no invented reason field; a `coordinator`-audience question is not an ask. | TC-BOARD-032 | Suite | Covered |
| AC-F5-3 | An open owner ask on a ref whose defaultable gate crosses 72 h during the run: the gate renders `default-applied`, exactly one decision record is appended, and the ask row **in the same payload** carries `defaultState: "applied"` (post-append decision set, not a pre-run snapshot); a second run appends nothing and renders the identical ask row; no second decision-history read occurs for the ask join. | TC-BOARD-031, TC-BOARD-070 | Suite | Covered |
| AC-F6-1 | An open `peak-window` park and an open `owner-hold` park appear in `parked[]` with their causes; the peak row carries `until`, the owner-hold row carries `until: null` with `untilReason: "owner-hold-no-expiry"`; an open `provider-quota` park produces **no** `parked[]` row. | TC-BOARD-033, TC-BOARD-081 | Suite | Covered |
| AC-F6-2 | An active host-wide owner hold is carried on the payload with its source and sanitized reason, so an idle fleet is never an unexplained all-clear. | TC-BOARD-034 | Suite | Covered |
| AC-F7-1 | Root `--help` lists `board` among 21 families; `board --help` answers at exit `0` with summary, usage, options, examples, exit codes, and a see-also pointer. | TC-BOARD-040, TC-BOARD-041, TC-BOARD-043 | Suite + mutation | Covered |
| AC-F7-2 | The board reference page exists, mentions `--help` and `--version`, and the coverage inventory carries the board row; the check reports zero failures. | TC-BOARD-042 | Suite + mutation | Covered |
| AC-F8-1 | Every invocation uses the five-field envelope with all new keys under `data`; the exit code is exactly `0`, `1`, or `2` per §8.3; no failure envelope contains a partial board. | TC-BOARD-050, TC-BOARD-051, TC-BOARD-053 | Suite | Covered |
| AC-F8-2 | A present-but-unreadable host index, or an unreadable repository state location during `--all`, is `board.state-unavailable` at exit `2` with the failing repository key (or the index path) named and nothing rendered. | TC-BOARD-016, TC-BOARD-052, TC-BOARD-080 | Suite | Covered |
| AC-F8-3 | The closed two-segment allowlist contains exactly `board.repository-unknown` and `board.state-unavailable` and no other `board.*` code (53 → 55, exact declaration, no family or pattern widening); **every count-pinning site enumerated in Appendix D (23 sites across five files) moves to its declared post-change value in the same commit as the rows** — 136 → 138, 135 → 137, 53 → 55, `BASELINE_ROWS.length + 102` → `+104`, 52 → 55; a repo-wide scan of those five files finds no leftover identity-count pin at 136, 135, 53, or 52; the classifier, sync check, structural mirror, and carrier agree on 138 entries / 137 delivered rows / 55 allowlist codes / 2 board rows / 138 documented identities; and a near-miss two-segment `board.*` code is rejected by the check rather than accepted by family matching. | TC-BOARD-053 | Suite + mutation | Covered |
| AC-F9-1 | Two runs over unchanged facts produce byte-identical human text and machine `data` (timing and run id aside); every array follows repository-then-section order; every row identity is unique. | TC-BOARD-060, TC-BOARD-083 | Suite | Covered |
| AC-F9-2 | The only state mutation is the delivered idempotent decision record (≤ 1 per newly defaulted gate, 0 when present); no index maintenance, no prune, no edit or delete; exactly the two delivered store-opening side effects. | TC-BOARD-061 | Suite + mutation | Covered |
| AC-F9-3 | No LLM call, no non-GET provider request, no timer or daemon, and no hardcoded product or binary name. | TC-BOARD-062 | Suite | Covered |
| AC-F9-4 | An `--all` run over a managed set larger than `BOARD_MAX_REPOSITORIES` (128) lists exactly the 128 retained keys ascending with the invoking checkout present when bound, counts the unretained keys in `omittedBySection.repositories`, sets `truncated`, and drops rows only by the declared byte-guard order (`parked` → `asks` → `lanes` → `gates`, tail first) with every drop counted; the repository list and collector evidence are never dropped. | TC-BOARD-064, TC-BOARD-065, TC-BOARD-084, TC-BOARD-085 | Suite + mutation | Covered |
| AC-NFR5-1 | An `--all` run over two repositories performs at most the declared bounded read set per repository with no pagination and no retry, reads the host index once, and completes the pure projection and render of a cap-sized two-repository board within the 50 ms median budget. | TC-BOARD-010, TC-BOARD-016, TC-BOARD-070, TC-BOARD-071 | Suite (measured) | Covered |
| AC-NFR9-1 | `TMPDIR=$PWD/tmp/tmpdir pnpm check` is green before the PR opens. | TC-BOARD-072 | Quality gate | Covered |

All 29 acceptance criteria are mapped; none is unmapped, `TODO`, or AC-less. Capability coverage is transitive and complete: F-1 → 001, 002, 006, 007, 010; F-2 → 003, 004; F-3 → 010, 011, 012, 013, 014, 015, 016, 064; F-4 → 020, 021, 022, 023; F-5 → 030, 031, 032; F-6 → 033, 034; F-7 → 040, 041, 042, 043; F-8 → 005, 050, 051, 052, 053; F-9 → 007, 024, 025, 060, 061, 062, 063, 064, 065, 084, 085.

### 3.2 Interface Coverage (DM-#, command surface, registries)

The spec declares no `API-` or `EVT-` identifiers (§8.1, §8.2: no HTTP surface, no event, no message). The interfaces under test are the machine payload, the command grammar, the help and coverage registries, and the error table.

| Interface element | Observable contract | TC ID(s) |
|-------------------|---------------------|----------|
| DM-1 shared state-source identity | One declared constant; identical value on `board`, `status`, and `brief` `data`; the group-scoped status form does not carry it. | TC-BOARD-003 |
| DM-2 full board payload | `delivery.board.v1` unchanged; `data` carries `scope`, `selection`, `repositories[]`, `lanes[]`, `asks[]`, `parked[]`, `stateSource`, `ownerHold`, and `omittedBySection` (`repositories`, `lanes`, `gates`, `asks`, `parked`); delivered `gates[]`, `collectors[]`, `truncated`, `omitted` keep names and meanings, extended to cover every section and the repository list. | TC-BOARD-001, TC-BOARD-050, TC-BOARD-063, TC-BOARD-064 |
| DM-3 gate row extension | Delivered fields plus `repository`, `condition` (`kind:slaState`), `owner`, `ownerSource`; delivered names and types unchanged. | TC-BOARD-002, TC-BOARD-020, TC-BOARD-022 |
| DM-4 lane row and total phase classification | `repository`, `ref`, `laneId`, `state` (`delivering` \| `failed`), `phase` (the one open entry, latest in canonical lifecycle order when several are open) or `null` with `phaseUnknownReason` present exactly then (`phase-unrecorded` when no phase record exists, `phases-complete` when a record exists with nothing in progress), `holder`, optional `leaseId`, optional `reason`. | TC-BOARD-006 |
| DM-5 ask row and post-append join | `repository`, `id`, `type`, `ref` (string or the delivered bare `null`, no absence reason), `lane`, bounded `question`, `askedAt`, computed `age`, `status: open`, `owner`, `ownerSource`, `drawnDefault`, `defaultState` (`none` \| `pending` \| `applied`) over the invocation's post-append decision set. | TC-BOARD-030, TC-BOARD-031, TC-BOARD-032 |
| DM-6 parked row and closed population | `repository`, `ref`, `reason` (`peak-window` \| `owner-hold` only; `provider-quota` never a row), `until` or `null` with `untilReason`, optional `preservation`, optional `providerProfile`, `owner`, `ownerSource`. | TC-BOARD-033 |
| DM-7 selection, evidence, and the retained set | `repositories[]` (included keys, ascending, unique, ≤ 128, selected repository always included), `scope`, `selection`, `collectors[]` entries with the owning `repository`, `ownerHold` shape. | TC-BOARD-004, TC-BOARD-010, TC-BOARD-011, TC-BOARD-013, TC-BOARD-014, TC-BOARD-015, TC-BOARD-034, TC-BOARD-064 |
| DM-8 error identities, the grammar identity, and the exact allowlist | `board.repository-unknown` (user, exit 1); `board.state-unavailable` (platform, exit 2, naming the repository key or index path); both join the closed two-segment allowlist as exact members (53 → 55, no `board.*` family); grammar refusals are the delivered `fallback.invocation` at exit 1, with no `board.*` grammar code. | TC-BOARD-013, TC-BOARD-014, TC-BOARD-051, TC-BOARD-052, TC-BOARD-053 |
| DM-9 lane lease-holder extension | Optional `leaseHolder` present exactly when a live lease exists; payload identity, every delivered field, and the human lane text unchanged. | TC-BOARD-006, TC-BOARD-063 |
| DM-10 owner provenance | Closed `ownerSource` set (`lane-lease-holder`, `gate-waiver-authorizer`, `gate-audience`, `ask-audience`, `park-control`); `owner` null only when unrecorded; never inferred. | TC-BOARD-002, TC-BOARD-081 |
| DM-11 bounds, the repository cap, and the byte-guard order | Per repository gates 8, lanes 20, asks 8, parked 8; `BOARD_MAX_REPOSITORIES` = 128 with the declared retained-set rule and counted overflow; `data` ≤ 65 536; byte-guard drop order `parked` → `asks` → `lanes` → `gates`, tail first, never the repository list or `collectors[]`; human ≤ 24 lines / 4 096 bytes at ≤ 400 bytes per line; field caps 160/120/120/60/40. | TC-BOARD-024, TC-BOARD-025, TC-BOARD-064, TC-BOARD-065 |
| `BOARD_MAX_REPOSITORIES` constant | Declared as exactly `128`, distinct from the host index's 2 000-record bound, and the only repository cap in the payload path. | TC-BOARD-064, TC-BOARD-070 |
| Command grammar | Zero positionals; flags `--all`, `--project` (one value), `--json`; any other flag, any positional, `--all` + `--project`, and a valueless `--project` refused at exit `1` before any read with `fallback.invocation`. | TC-BOARD-014, TC-BOARD-050, TC-BOARD-051 |
| `repositories[]` / repository-key boundary | The list field is `repositories[]`; `repoKey` and the host index's `projectKey` keep their meanings; no board surface names or enumerates a group. | TC-BOARD-011, TC-BOARD-013 |
| Collector evidence | `collectors[]` carries `{collector, outcome, repository}`; the closed collector-id set stays exactly `{tracker, lanes}`; evidence is never dropped by the byte guard. | TC-BOARD-004, TC-BOARD-023, TC-BOARD-065 |
| Prompt-required composition | `board` is one member of the exact set the entrypoint composes (21 families); every other family's composition unchanged. | TC-BOARD-040, TC-BOARD-043 |
| `board --help`, `--version` | Served from the static help inventory at exit `0`; five declared sections; no state, git, network, or configuration read. | TC-BOARD-041 |
| Coverage inventory and reference page | `tests/fixtures/help-guide/coverage.json` carries the board command row and the M2 page path; the page exists and mentions `--help` and `--version`. | TC-BOARD-042 |
| Error-table registration | One new domain kind plus exactly two rows with category, retryability, consequence, and projection class; delivered collector and grammar identities keep identity, category, and exit. | TC-BOARD-053 |
| Closed two-segment allowlist and the Appendix D count pins | `RESERVED_TWO_SEGMENT_CODES` holds exactly 55 members in the sync check **and** its structural mirror, of which exactly 2 are `board.*` (the two declared codes) and no third; **all 23 count-pinning sites listed in spec Appendix D move in the same commit** — `tests/structure/error-table.test.ts` (4 × 136 → 138, 53 → 55, 135 → 137, `"136 identities"` → `"138 identities"`), `tests/structure/dispatch-attempts-taxonomy.test.ts` (header comment 135 → 137, test name 136 → 138, length 136 → 138), `tests/structure/verify-gates-suite-map-contract.test.ts` (`sourceEntries` and `documentedRows` 136 → 138), `tests/checks/error-table-sync.test.ts` (`BASELINE_ROWS.length + 102` → `+104` at its four sites, header comment 136 → 138, test name 136 → 138, the two 136 reads, and `"136 identities"`), and `doc/spec/features/feature-result-contract.md` (both 136 mentions, 52 → 55 allowlist paragraph); a repo-wide scan of those five files finds no leftover identity-count pin at 136, 135, 53, or 52; classifier, check, mirror, and carrier agree on 138 / 137 / 55 / 2 / 138; a two-segment near-miss (`board.repository-unknowns`, `board.state`) is not recognized by the scan and is not a valid code, and a three-segment lookalike (`board.state-unavailable.extra`, `board.other.thing`) resolves to no table row. | TC-BOARD-053 |
| Lane payload (delivered, extended) | `delivery.lanes.v1` identity and delivered fields unchanged; `leaseHolder` additive; human text byte-identical. | TC-BOARD-006, TC-BOARD-063 |
| Status and brief payloads (delivered, extended) | Exactly one new `data` key (`stateSource`); no delivered key renamed, removed, or re-semanted; goldens updated deliberately. | TC-BOARD-003, TC-BOARD-063 |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement (threshold) | TC ID(s) | Notes |
|--------|-------------------------|----------|-------|
| NFR-1 | 0 new top-level envelope keys; 0 `ok`/`command` fields inside `data`. | TC-BOARD-050, TC-BOARD-063 | Envelope contract validator plus an explicit key-set diff. |
| NFR-2 | 2 of 2 runs byte-identical in human text and JSON `data`; 0 order sources other than the declared keys. | TC-BOARD-060 | Permutation cells (index order, collector order, park order, readdir order). |
| NFR-3 | 0 duplicate `(repository, …)` identities; `--all` row count equals the sum of the **included** per-repository boards **before any byte-guard drop**, with every such drop counted; 2 repositories holding one ref produce 2 rows. | TC-BOARD-011, TC-BOARD-012, TC-BOARD-060, TC-BOARD-065, TC-BOARD-083 | Count equality computed from independently executed per-repository boards; the byte-guard cell is separate so a guard-induced count change is not mistaken for a mixing bug. |
| NFR-4 | `data` ≤ 65 536 bytes; human ≤ 24 lines / 4 096 bytes; ≤ 400 bytes per line; `repositories[]` ≤ 128 with the selected repository always included and the overflow counted; byte guard drops `parked` → `asks` → `lanes` → `gates`, tail first, and never the repository list or `collectors[]`; `truncated` true whenever any row or repository is dropped. | TC-BOARD-024, TC-BOARD-025, TC-BOARD-064, TC-BOARD-065, TC-BOARD-082 | Byte measurement is on the serialized `data`, not the envelope. |
| NFR-5 | ≤ 1 tracker page (100) + 1 delivery-request page (100) + 1 CI page (20) + 1 blocker + 1 queue ledger + 1 park + 1 local-context + 1 spend + ≤ 1 phase per active lane (≤ 20) + ≤ 1 decision-history per repository **including the ask join, which performs no second read**; 1 host-index read per `--all`/`--project`, 0 for the default form; ≤ 128 included repositories from a 2 000-record index. | TC-BOARD-010, TC-BOARD-016, TC-BOARD-031, TC-BOARD-064, TC-BOARD-070 | Counters on the delivered seams; the cap cell also proves the unlisted repositories are not read. |
| NFR-6 | ≤ 1 appended decision record per newly defaulted gate, 0 when one exists; 0 index maintenance, 0 prune, 0 edits/deletes; exactly the 2 delivered store-opening side effects. | TC-BOARD-021, TC-BOARD-031, TC-BOARD-061 | Tree snapshot plus index-access counters plus the ledger record count. |
| NFR-7 | 0 LLM calls; 0 non-GET provider requests; 0 timers/loops; 0 hardcoded product or binary names. | TC-BOARD-062 | Spawn recorder, transport method assertion, module scan, brand-seam swap. |
| NFR-8 | Warm median of 5 runs ≤ 50 ms for the pure projection and render, I/O excluded. | TC-BOARD-071 | Every sample printed with the fixture's cap sizes. |
| NFR-9 | `TMPDIR=$PWD/tmp/tmpdir pnpm check` green before the PR opens. | TC-BOARD-072 | Recorded in §10 and pm-notes `notes:`. |
| NFR-10 | Conventional subjects via the commit primitive; every body/footer line ≤ 100 characters. | TC-BOARD-072 (recorded) | Verified by the phase-9 range lint gate and CI `ts-commitlint`; PM-owned, not a permanent assertion here (C-8). |

### 3.4 Coverage-Matrix Integrity

- **Counts.** 29 ACs → 48 cases. Every AC appears in at least one row of §3.1; every case appears in at least one row (no orphan). Every case id appears exactly once in §5.1, exactly once in §5.2, and exactly once in §7.
- **Seed-derived cases** carry their seed id: `TC-BOARD-001`, `TC-BOARD-003` (`SC-M2-S4-01`); `TC-BOARD-011`, `TC-BOARD-012`, `TC-BOARD-083`, `TC-BOARD-084` (`SC-M2-S4-02`). All other cases are new in this plan and are marked so in §9.
- **Seed survival under v1.1.** Both seeds execute worlds of two repositories, far inside `BOARD_MAX_REPOSITORIES` (128): `repositories[]` is the full set, `omittedBySection.repositories` is `0`, and `truncated` is `false`. `TC-BOARD-011` asserts that cell explicitly, so a cap implementation that always reports an omission cannot pass the seed.
- **DoD binding.** DoD-1 → 001/002/003; DoD-2 → 003; DoD-3 → 010/011/012/013/014/015/016 (+064 for the capped `--all` and the beyond-cap `--project`); DoD-4 → 011/012/083; DoD-5 → 020–025; DoD-6 → 030/031/032; DoD-7 → 033/034; DoD-8 → 006; DoD-9 → 024/025/064/065/082 (+084/085 mutants); DoD-10 → 060/083; DoD-11 → 061; DoD-12 → 062; DoD-13 → 040–043; DoD-14 → 053 (rows, allowlist 53 → 55, all 23 Appendix D sites moved, repo-wide no-leftover scan, four-way agreement 138/137/55/2/138, near-miss rejection); DoD-15 → 070/071; DoD-16 → this section; DoD-17 → 072; DoD-18 → §10 (PR record, PM-owned).
- **No moving-base assertions.** No case asserts a diff against `origin/main-tools`. Where the spec asks for "unchanged" (delivered gate fields, lane human text, other families' composition) the case asserts a tree invariant: a committed golden, a closed key set, or a set-equality against a declared constant.
- **Negative controls are first-class.** Every block carries at least one paired control: a readable twin for each degraded cell, a positive value twin for each fabricated-value cell, an at-cap twin beside every over-cap cell, an at-128 twin beside the 129-repository world, and a single-repository twin beside every multi-repository cell. Block I cases are the mutant proofs; they are not duplicates of block A–H cases because they assert *detection power* rather than the property itself.

### 3.5 Declared test-methodology substitutions

**No contract question remains open.** The seven points raised at the v1.0 test-plan review are closed by spec v1.1 (§14, DEC-13..DEC-19): the repository bound (`BOARD_MAX_REPOSITORIES` = 128, counted overflow, byte-guard order), the default-form criterion (`AC-F3-6`), the lane phase-null totality, the post-append `defaultState` join (`AC-F5-3`), the `fallback.invocation` grammar identity, the `provider-quota` exclusion (NG-9), and the delivered bare `ref: null`. The plan's former `AMB-TP-3/4/6/7` and `OQ-TP-1..OQ-TP-7` are retired by that amendment; each now names a case that asserts the rule. The DoR iteration-1 finding is closed the same way by spec v1.2 (DEC-20, C-16, OQ-8), and the iteration-2 findings by spec v1.3: the closed two-segment allowlist widening, the 23 count-pinning sites of Appendix D, the repo-wide no-leftover scan, and the classifier/check/mirror/carrier agreement are asserted in `TC-BOARD-053`, so no allowlist or count question is carried into delivery.

Two methodology substitutions remain, and they are about how a property is measured, not about what the contract says:

| ID | Substitution | Where handled |
|----|--------------|---------------|
| `AMB-TP-1` | **The four-section human allocation is asserted as a maximum plus marker arithmetic, not as a fixed line layout.** `DEC-9` allocates lanes 6 / gates 6 / asks 4 / parked 3 plus one header and four section lines. The case asserts those as maximum row counts and the `+N more` marker's arithmetic; it does not pin a line layout, so a future layout change that keeps the budget and the counts passes. | `TC-BOARD-025` |
| `AMB-TP-2` | **Edge runtime seam shapes are delivery-bound.** The managed-set resolver, the phase read, the park classification, and the ask projection are consumed through injected seams the specification does not name. Cases assert payload, exit, and evidence; a case that cannot resolve its seam fails naming the missing contract rather than skipping. Behaviours, identities, closed vocabularies, bounds, and AC traceability are not delivery-bound. | all behaviour cases |

## 4. Test Types and Layers

- **Structure / boundary (contract-level), `bun:test` under `tests/structure/`** — payload key sets and additive discipline, the closed `ownerSource` vocabulary, the closed collector-id set, the closed phase-reason set, `BOARD_MAX_REPOSITORIES === 128` as a distinct declared constant, the `board` domain kind and its exactly-two rows, the closed two-segment allowlist as an exact 55-member set with exactly two `board.*` members and rejected two-segment near misses, all 23 Appendix D count pins moved (including the dispatch-taxonomy and verify-suite-map suites and the sync suite's `+102 → +104` arithmetic), the repo-wide no-leftover scan, the four-way agreement, `PROMPT_REQUIRED_COMMANDS` membership and count, the help inventory entry, and the module inventory registration. No I/O beyond the committed tree and the exported predicates; imports the contracts and declarations directly. Cases: `TC-BOARD-002` (vocabulary half), `004`, `022`, `040` (set half), `050` (envelope half), `053` (rows, allowlist, counts, near-miss), `063`, `064` (constant half).
- **Behaviour (in-process CLI composition), `bun:test` under `tests/behaviour/`** — the majority of the plan, over `runCli` with the injected board harness: sections, rows, selection, SLA preservation, idempotency, asks, parked work, envelopes, exits, determinism, bounds, the byte guard, write audit, purity, read cost, performance. Cases: `001`–`007`, `010`–`015`, `020`–`025`, `030`–`034`, `050`–`052`, `060`–`062`, `064`, `065`, `070`, `071`, `080`–`083`.
- **Behaviour over the real production composition, `bun:test` under `tests/behaviour/`** — creates real temporary git checkouts, a per-test host root, a real host index, and the real `createProductionComposer`; the only injected facts are the remote origin, the transport, and the recording seams. This is mandatory wherever the assertion depends on the checkout identity, the host index, the `unbound` scope, or the 128-repository cap, because those inputs are git metadata or index records. Cases: `010`, `011`, `012`, `014`, `015`, `016`, `061`, `064`.
- **Behaviour with a seeded index, `bun:test` under `tests/behaviour/`** — a 129-entry (and one 200-entry) host index whose roots exist, so the cap, the retained set, the overflow count, and the "unlisted repositories are not read" rule are exercised without constructing 129 real checkouts. Only the index rows and the directory existence are seeded; the invoking checkout is real. Cases: `064`, `084`.
- **Golden, `bun:test` under `tests/golden/` with artifacts in `tests/fixtures/**/golden/`** — the four-section screen and its machine envelope (new), the status and brief digests with the additive `stateSource` (regenerated deliberately), the lanes machine payload with `leaseHolder` (regenerated; the human lane text must stay byte-identical). Cases: `003` (status/brief goldens), `006` (lane goldens), `060` (four-section golden).
- **Checks (guards), `bun:test` under `tests/checks/`** — help/guide coverage, reference-page parity, error-table doc sync, prompt conformance, and the content inventory, all run inside `pnpm check`. Cases: `042`, `053` (sync half).
- **Measured bounds, `bun:test` with counters and printed context** — read counts, byte sizes, line counts, repository counts, and the 50 ms median. Every measurement prints the fixture size and the samples so an over-budget run is diagnosable rather than merely red. Cases: `024`, `025`, `064`, `065`, `070`, `071`.
- **Mutation / non-vacuity controls** — in-place mutations executed in a temporary copy of the tree (the delivered `error-table-sync` and boundary-fixture pattern): drop the prompt-set entry, drop a counted omission, key identities by id alone, widen a section cap, enable index maintenance, delete a documentation row, plant a two-segment `board.*` near miss in a scanned corpus, omit the widening from the checker copy, widen the checker to a `board.` prefix, and leave a non-mirror count site stale (dispatch-taxonomy header, test name, or length; verify-suite-map `sourceEntries`/`documentedRows`; or a sync-suite `+102` arithmetic site), drop the invoking-key retention from the repository cap, remove the cap entirely, reverse the byte-guard order, drop from `repositories[]` to fit, and drop without counting. Cases: `043`, `053`, `061`, `082`, `083`, `084`, `085`, `025`.
- **Not used:** `mock.module` substitution of the modules under test; live network; live credentials; real sleeps or timers; the live tree or `$HOME` as state; child-process CLI invocations where an in-process `runCli` composition proves the same property. Fakes are injected ports (clock, transport, tracker read, store, spawn) — never a mock of the board projection, the gate evaluator, or the lane fold.
- **Boundaries:** no new cross-package edge is expected (the board lives in the existing `cli` command family and the existing `core` contracts/domain tiers). `check:boundaries` runs inside the aggregate gate; if delivery declares a new `workspaceImports` edge, the fixture-coverage meta-check requires its negative fixture in the same change.

## 5. Test Scenarios

TC IDs use the `BOARD` feature prefix and follow the specification's capability blocks: `001`–`007` four sections and the shared source; `010`–`016` repository scope; `020`–`025` the delivered SLA preserved; `030`–`034` owner asks and parked work; `040`–`043` production mounting; `050`–`053` envelope, exits, and error identities; `060`–`065` determinism, bounds, the repository cap, the byte guard, write discipline, purity, additivity; `070`–`072` read cost, responsiveness, quality gate; `080`–`085` cross-cutting non-vacuity controls. A new sequence appends at the end of its block; an id is never reused.

### 5.1 Scenario Index

| TC ID | Title | Type | Impact | Priority | AC / NFR |
|---|---|---|---|---|---|
| TC-BOARD-001 | Four sections in declared order from one repository, with ≥ 1 row in each array | Happy Path | Critical | High | AC-F1-1; F-1; DM-2..DM-6; `SC-M2-S4-01` |
| TC-BOARD-002 | Every row names its repository key, ref or declared absence, and owner with a closed `ownerSource` | Happy Path | Critical | High | AC-F1-1, AC-F2-2; DM-3..DM-6, DM-10 |
| TC-BOARD-003 | `stateSource` is one declared identity on the board, status, and brief payloads | Contract | Critical | High | AC-F2-1; F-2; DM-1; `SC-M2-S4-01` |
| TC-BOARD-004 | The lanes section's provenance is named as the `lanes` collector per repository; no other source exists | Contract | Critical | High | AC-F2-2; F-2; DM-7 |
| TC-BOARD-005 | An unreadable gate, ask, or park source withholds the board instead of rendering zero rows | Negative | Critical | High | AC-F2-3; F-8 |
| TC-BOARD-006 | The lane section is the active-lane view with recorded holder and a total phase classification | Corner Case | Critical | High | AC-F1-1; DM-4, DM-9; DEC-7, DEC-15 |
| TC-BOARD-007 | The human screen is ANSI-free, TTY-independent, clamped, and carries no forbidden content | Negative | Critical | Medium | AC-F1-1; F-1, F-9; §20/§21 |
| TC-BOARD-010 | The default form is the invoking checkout: scope repository, selection current, zero index reads | Happy Path | Critical | High | AC-F1-1, AC-F3-6, AC-NFR5-1; DM-7; NFR-5; DEC-14 |
| TC-BOARD-011 | `--all` is the index union the invoking checkout, ascending and unique, counts equal to the sum | Happy Path | Critical | High | AC-F3-1; NFR-3; DM-7; `SC-M2-S4-02` |
| TC-BOARD-012 | Two repositories holding one ref produce two distinct rows with their own phase, holder, and state | Corner Case | Critical | High | AC-F3-2; NFR-3; DM-4; `SC-M2-S4-02` |
| TC-BOARD-013 | An unmanaged key, including a group key, is `board.repository-unknown` at exit 1 | Negative | Critical | High | AC-F3-3; F-3, F-8; DM-8; NG-3 |
| TC-BOARD-014 | `--project` narrows without reading another repository; grammar violations are `fallback.invocation` | Happy Path | Critical | High | AC-F3-4; DM-7, DM-8; DEC-17 |
| TC-BOARD-015 | The `unbound` scope covers an unbound or identity-underivable checkout: empty board, one warning, exit 0 | Corner Case | Critical | High | AC-F3-5, AC-F3-6; F-3, F-8; DM-7; DEC-14 |
| TC-BOARD-016 | Managed-set edge cells: absent index, vanished root, unreadable and unparseable index | Corner Case | Critical | High | AC-F3-1, AC-F8-2, AC-NFR5-1; NFR-5 |
| TC-BOARD-020 | The delivered SLA matrix is preserved, boundary cells included, with the delivered ranking | Regression | Critical | High | AC-F4-1; F-4; DM-3; DEC-2 |
| TC-BOARD-021 | Default application appends exactly one decision record per repository and is idempotent | Regression | Critical | High | AC-F4-2; NFR-6; DM-3 |
| TC-BOARD-022 | The gate row is extended, not re-semanted: `condition`, `repository`, `owner`, `ownerSource` | Contract | Critical | High | AC-F4-1; DM-3; §8.5 |
| TC-BOARD-023 | The delivered collector-unavailable identities and their exit 2 projection are preserved | Regression | Critical | High | AC-F4-1, AC-F2-3, AC-F8-1; DM-8 |
| TC-BOARD-024 | Machine bounds and field caps hold, and every drop is counted | Corner Case | Critical | High | AC-F4-3; DM-11; NFR-4 |
| TC-BOARD-025 | The 24-line budget is allocated across the four sections with `+N more` markers | Corner Case | Important | High | AC-F4-3; DM-11; DEC-9; AMB-TP-1 |
| TC-BOARD-030 | An owner ask carries the delivered fields, a computed age, and the pending drawn default | Happy Path | Critical | High | AC-F5-1; F-5; DM-5; DEC-4 |
| TC-BOARD-031 | The same-run post-append join renders `applied` with one record and no second history read | Corner Case | Critical | High | AC-F5-1, AC-F5-3, AC-F4-2; DM-5; NFR-5, NFR-6; DEC-16 |
| TC-BOARD-032 | `none` is declared, a ref-less ask keeps the bare `null`, coordinator questions are excluded | Negative | Critical | High | AC-F5-2; F-5; DM-5; DEC-4, DEC-19 |
| TC-BOARD-033 | Parked work carries reason and `until`; `provider-quota` is not a parked row | Happy Path | Critical | High | AC-F6-1; F-6; DM-6; DEC-11, DEC-18; NG-9 |
| TC-BOARD-034 | The host-wide owner hold is carried once, sanitized, and never fabricates a row | Corner Case | Critical | High | AC-F6-2; F-6; DM-7; DEC-11 |
| TC-BOARD-040 | `board` is the 21st prompt-required family, composed by production, listed in root help | Happy Path | Critical | High | AC-F7-1; F-7; DEC-10 |
| TC-BOARD-041 | `board --help` answers at exit 0 with the five declared sections and no side effect | Happy Path | Important | High | AC-F7-1; F-7 |
| TC-BOARD-042 | The reference page and the coverage-inventory row satisfy the help coverage check | Contract | Critical | High | AC-F7-2; F-7 |
| TC-BOARD-043 | Mounting changes no other family, and the unmounted mutant is detected | Regression | Critical | High | AC-F7-1; F-7; RSK-5 |
| TC-BOARD-050 | Every outcome uses the five-field envelope with all new keys under `data` | Contract | Critical | High | AC-F8-1; NFR-1; DM-2, DM-8 |
| TC-BOARD-051 | Grammar refusals happen before any read and never render a partial board | Negative | Critical | High | AC-F8-1; F-8; DEC-17 |
| TC-BOARD-052 | `board.state-unavailable` names the failing repository key and renders nothing | Negative | Critical | High | AC-F8-2, AC-F2-3; DM-8 |
| TC-BOARD-053 | The `board` kind, its two rows, the exact two-segment allowlist widening, and all 23 Appendix D count pins | Contract | Critical | High | AC-F8-1, AC-F8-2, AC-F8-3; DM-8; C-7, C-16; DEC-20; Appendix D |
| TC-BOARD-060 | Two runs are byte-identical; order and identity are declared and permutation-proof | Corner Case | Critical | High | AC-F9-1; NFR-2, NFR-3 |
| TC-BOARD-061 | The only write is the idempotent decision record, plus the two delivered side effects | Negative | Critical | High | AC-F9-2; NFR-6; DEC-6 |
| TC-BOARD-062 | No LLM, no non-GET request, no timer or daemon, no product literal | Negative | Critical | High | AC-F9-3; NFR-7 |
| TC-BOARD-063 | The payload is extended additively and nothing delivered is renamed or re-semanted | Regression | Critical | High | AC-F2-1, AC-F4-1, AC-F9-1; DM-2, DM-9; §8.5; C-1 |
| TC-BOARD-064 | The repository list is capped at 128 with a deterministic retained set and counted overflow | Corner Case | Critical | High | AC-F9-4, AC-F3-4; F-3, F-9; DM-7, DM-11; NFR-4, NFR-5; DEC-13; RSK-9 |
| TC-BOARD-065 | The byte guard drops rows in the declared order and never the repository list or collector evidence | Corner Case | Critical | High | AC-F9-4, AC-F4-3; F-9; DM-11; NFR-3, NFR-4; DEC-13 |
| TC-BOARD-070 | The declared read set, one index read, no pagination or retry, and the 128-repository bound | Corner Case | Critical | High | AC-NFR5-1, AC-F5-3; NFR-5 |
| TC-BOARD-071 | The pure projection and render of a cap-sized two-repository board fit 50 ms median | Corner Case | Important | Medium | AC-NFR5-1; NFR-8 |
| TC-BOARD-072 | The aggregate quality gate is green before the PR opens | Quality gate | Critical | High | AC-NFR9-1; NFR-9, NFR-10; C-8 |
| TC-BOARD-080 | False all-clear control matrix: every degraded cell withholds; its readable twin renders | Negative | Critical | High | AC-F2-3, AC-F8-2; NFR-4; RSK-1 |
| TC-BOARD-081 | Fabricated-value control matrix: age, default, `until`, holder, phase, and owner are never invented | Negative | Critical | High | AC-F5-1, AC-F5-2, AC-F6-1, AC-F1-1; DM-4..DM-6, DM-10; RSK-8 |
| TC-BOARD-082 | Silent-omission control: an uncounted drop fails, and `truncated` is set exactly when a drop occurs | Negative | Critical | High | AC-F4-3; NFR-4; DM-11; RSK-1 |
| TC-BOARD-083 | Duplicate-row and state-mixing control: identities survive a collision matrix | Negative | Critical | High | AC-F3-2, AC-F9-1; NFR-3; `SC-M2-S4-02` |
| TC-BOARD-084 | Repository-cap overflow control: a 129-repository world with the invoking key last | Negative | Critical | High | AC-F9-4, AC-F3-1; NFR-4, NFR-5; DEC-13; RSK-9; `SC-M2-S4-02` |
| TC-BOARD-085 | Byte-guard order control: dropping `gates` before `parked`, or from `repositories[]`, is detected | Negative | Critical | High | AC-F9-4, AC-F4-3; NFR-4; DEC-13 |

### 5.2 Scenario Details

#### TC-BOARD-001 - Four sections in declared order from one repository, with ≥ 1 row in each array

**Objective**: Prove the board is a four-section surface, not a gate grid with extra keys — asserted on the rendered text order and on the four machine arrays in one run.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-1, F-1, DM-2..DM-6, SC-M2-S4-01
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-sections.test.ts` (new); `tests/fixtures/board/harness.ts` extended with the four-section runtime seams
**Tags**: @backend, @behaviour

**Preconditions**:
- One bound checkout under a per-test host root; injected clock, run id, and synthetic brand.
- Fixture facts: one `delivering` lane, one `fresh` `owner-review` gate, one open `owner`-audience question on a ref that also holds a defaultable `waiver` gate, and one open `peak-window` park.

**Steps**:
1. Run `board` (text) and `board --json` over the same fixture.
2. Assert the text renders the header line followed by the section labels `LANES`, `GATES`, `ASKS`, `PARKED` in that order, and that every row line contains the repository key, the ref, and the owner token.
3. Assert `data.schemaVersion` is `delivery.board.v1`, `data.audience` is `owner`, `data.scope` is `repository`, `data.selection` is `current`, and `data.repositories` equals `[invoking key]`.
4. Assert `lanes`, `gates`, `asks`, `parked` each have at least one row.
5. Empty each source in turn (four further cells) and assert the section label is still rendered in place with zero rows — the board never silently drops a section.

**Expected Outcome**:
- Four sections in the declared order, in both modes, with the machine arrays populated from one run.
- A section with no rows still renders its label, so "four sections" and "≥ 1 row" are independently observable.

**Notes / Clarifications**:
- This case is `SC-M2-S4-01`'s section-and-row half; the seed's state-source half is `TC-BOARD-003`. Neither alone satisfies the seed.

#### TC-BOARD-002 - Every row names its repository key, ref or declared absence, and owner with a closed `ownerSource`

**Objective**: Prove `owner` is a recorded identity or a declared audience token with an explicit provenance, and that a missing ref is a declared value — never an empty string, a placeholder, an inferred principal, or an invented reason field.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-1, AC-F2-2, F-1, F-2, DM-3, DM-4, DM-5, DM-6, DM-10, DEC-19
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-rows.test.ts` (new); `tests/structure/board-contract.test.ts` (new) for the closed vocabulary
**Tags**: @backend, @behaviour

**Preconditions**:
- A fixture with one row of each family: a lane with a live lease, a `waiver` gate with a recorded authorizer, an `owner-review` gate with no waiver, an owner-audience ask with a ref, an owner-audience ask with `ref: null`, and an owner-hold park with no recorded principal.

**Steps**:
1. Assert every lane row carries `ownerSource: "lane-lease-holder"`, every waived gate `"gate-waiver-authorizer"`, every non-waived gate `"gate-audience"`, every ask `"ask-audience"`, and every parked row `"park-control"`.
2. Assert the structural closed set: the exported `ownerSource` constant equals the five declared members, in both directions of set equality.
3. Assert a row whose source records no principal carries `owner: null` with its token — not a fabricated name, not the lane's branch name, not the git user.
4. Assert the ref-less ask carries `ref: null` and never `""`, `"-"`, `"unknown"`, or the lane string copied into `ref`; its key set is exactly `DM-5`'s, with no `refUnknownReason` or any other absence-reason field (DEC-19).
5. Assert every row in every array carries a non-empty `repository` equal to a member of `repositories[]`.

**Expected Outcome**:
- Provenance is closed and explicit on all four arrays; nulls are declared rather than filled, and no absence reason is invented.

#### TC-BOARD-003 - `stateSource` is one declared identity on the board, status, and brief payloads

**Objective**: Turn "board, brief, and status share one state source" from a documentation claim into a runtime equality taken from three payloads, and prove the identity has exactly one home in code.
**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-1, F-2, DM-1, SC-M2-S4-01
**Test Type(s)**: Integration, Contract, Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-shared-source.test.ts` (new); extends `tests/structure/status-contract.test.ts` and `tests/structure/brief-contract.test.ts`; goldens `tests/fixtures/status/golden/digest.json`, `tests/fixtures/brief/golden/envelope.json`
**Tags**: @backend, @behaviour, @golden

**Preconditions**:
- One fact bundle expressed both as the status/brief facts and as the board's four-section fixture (same refs, same clock).
- The board, status, and brief run in one process through their delivered in-process command definitions.

**Steps**:
1. Run `board --json`, `status --json`, and `brief --json` over the same facts and assert `board.data.stateSource === status.data.stateSource === brief.data.stateSource`, and that the value equals the declared shared-source identity.
2. Assert the key-set delta of the status `data` payload against the delivered key set is exactly `{stateSource}`, and the same for brief — no delivered key renamed, removed, or re-semanted.
3. Assert the group-scoped status form (`status --project` with a group key) does not carry `stateSource`, so only the repository-scoped digest asserts the claim.
4. Assert the status and brief goldens carry the key (deliberate regeneration).
5. Structural: scan the source tree and assert the identity literal appears in exactly one module (the contracts constant), and that the board, status, and brief all import it. Three independently spelled literals would satisfy step 1 by accident; the scan is what makes the equality non-accidental.

**Expected Outcome**:
- Three payloads agree on one value that is declared once; the goldens are updated with the additive key and nothing else.

#### TC-BOARD-004 - The lanes section's provenance is named as the `lanes` collector per repository; no other source exists

**Objective**: Prove the fourth section's provenance is explicit in `collectors[]` and that the closed collector-id set was not widened to hide a second state layer.
**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-2, F-2, DM-7
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-collectors.test.ts` (extended); `tests/structure/board-contract.test.ts` (new)
**Tags**: @backend, @behaviour

**Preconditions**:
- Two included repositories (via the selection fixture) so per-repository evidence is observable.

**Steps**:
1. Assert `collectors[]` contains exactly one `tracker` entry and exactly one `lanes` entry per included repository, each carrying `{collector, outcome, repository}` with `outcome: "available"` on a produced board.
2. Assert the structural closed set: the exported collector-id constant equals exactly `["tracker", "lanes"]` (both directions), so a third collector cannot be introduced to name a second read model.
3. Assert no section's provenance is unnamed: source-scan the board command and its domain module for tracker-client construction, a second store open, or a direct state read, and assert none exists outside the delivered seams.
4. Assert the payload carries no alternative source token (`source`, `readingFrom`, `factsFrom`) anywhere in `data`.

**Expected Outcome**:
- Four sections, two named collectors, one shared bundle — and no unnamed source.

#### TC-BOARD-005 - An unreadable gate, ask, or park source withholds the board instead of rendering zero rows

**Objective**: Prove the fail-closed rule at the section level: a source that cannot be read removes the whole board, not just its section, so a degraded read can never look like a healthy empty fleet.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-3, F-8, NFR-4, RSK-1
**Test Type(s)**: Integration, Negative
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-never-silence.test.ts` (extended) and `tests/behaviour/board-sections.test.ts` (new)
**Tags**: @backend, @behaviour

**Preconditions**:
- A readable baseline fixture that renders rows in all four sections.
- Three degraded variants: unreadable blocker ledger, unreadable park store, unreadable gate source.

**Steps**:
1. For each degraded variant, run `board --json` and assert exit `2`, the declared identity, and the failing repository key in the summary.
2. Assert the envelope carries no `data` key and stdout contains no section label.
3. Run the readable twin and assert exit `0` with rows — the fixture is proven able to produce a board.
4. Assert no variant yields a section with zero rows and exit `0`.

**Expected Outcome**:
- Every degraded source withholds the board with a classified identity at exit `2`; the readable twin renders.

**Notes / Clarifications**:
- The matrix is completed and mutation-checked in `TC-BOARD-080`; this case owns the three source cells the AC names.

#### TC-BOARD-006 - The lane section is the active-lane view with recorded holder and a total phase classification

**Objective**: Prove the lanes section is the delivered fold's active subset, that the holder is the recorded lease holder (never inferred), and that the phase classification is total and closed — including the cell a record exists with nothing in progress.
**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-1, F-1, DM-4, DM-9, DEC-7, DEC-15, C-11
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-lanes.test.ts` (new); extends `tests/golden/lanes-list.test.ts` (machine golden gains `leaseHolder`; human golden unchanged); `tests/structure/board-contract.test.ts` for the closed token set
**Tags**: @backend, @behaviour, @golden

**Preconditions**:
- Lane-fold fixture with one lane in each delivered state: `delivering` (live lease held by a recorded principal), `failed`, `idle-with-reason`, `parked`, `merge-ready`, `in-review`.
- Phase fixtures, one per cell: (a) no phase-state projection document at all; (b) a projection with no phase entries and no `phase.transition` records; (c) a record whose entries are all completed; (d) one open entry; (e) two open entries whose canonical lifecycle order is known.

**Steps**:
1. Assert `lanes[]` contains only the `delivering` and `failed` lanes, each with `repository`, `ref`, `laneId`, and `state`.
2. Assert the `delivering` lane carries `holder` equal to the recorded lease holder and `leaseId` present; assert `failed` carries `holder: null` and no `leaseId`.
3. Assert the phase cells: (a) and (b) → `phase: null` with `phaseUnknownReason: "phase-unrecorded"`; (c) → `phase: null` with `"phases-complete"`; (d) → the open entry's id; (e) the open entry latest in canonical lifecycle order.
4. Assert `phaseUnknownReason` is present **exactly** when `phase` is null, and that the closed token set has exactly the two declared members (both directions of set equality).
5. Assert the delivered lane representation is otherwise unchanged: the machine golden gains only `leaseHolder`, and the human lane text is byte-identical to the committed golden.

**Expected Outcome**:
- Active lanes carry recorded provenance; absent phase and holder are classified by a total rule, never inferred.

#### TC-BOARD-007 - The human screen is ANSI-free, TTY-independent, clamped, and carries no forbidden content

**Objective**: Prove the screen is safe to render from hostile tracker content: no escape sequences, no forged section headers, no secrets, and the same bytes regardless of stream kind.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Medium
**Related IDs**: AC-F1-1, F-1, F-9, NFR-4, §20, §21
**Test Type(s)**: Integration, Negative
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-output.test.ts` (extended)
**Tags**: @backend, @behaviour

**Preconditions**:
- A fixture whose question text, lane id, and ref contain adversarial content: an ANSI escape, a newline, the literal line `PARKED`, and a 500-character string.
- An injected secrets list containing a canary token, which is also embedded in a question text.

**Steps**:
1. Assert the output contains no `\u001b`, no other control characters, and no line beginning with a forged section label originating from row content (exactly four label lines, all at their declared positions).
2. Assert every line is at most 400 bytes and the whole screen is at most 24 lines / 4 096 bytes.
3. Assert the secrets canary does not appear anywhere in stdout or stderr.
4. Assert the same bytes whether the stream is presented as a TTY-like sink or a buffer sink.
5. Assert the row identifiers rendered in text equal the row identifiers present in `--json`.

**Expected Outcome**:
- Hostile content is clamped and neutralised; the two modes describe the same rows.

**Notes / Clarifications**:
- The header-forgery bait is what makes the label-order assertion in `TC-BOARD-001` non-vacuous.

#### TC-BOARD-010 - The default form is the invoking checkout: scope repository, selection current, zero index reads

**Objective**: Prove the board's primary invocation: the selection is derived from the checkout identity, reads no host index, and reaches no other repository's state — asserted as its own criterion (`AC-F3-6`), not inferred from a section or a read-cost clause.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-6, AC-F1-1, AC-NFR5-1, F-3, DM-7, NFR-5, DEC-14, C-15
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-selection-default.test.ts` (new) over the real production composition
**Tags**: @backend, @behaviour

**Preconditions**:
- Two real checkouts (`createRepository` + identity markers) inside a per-test host root; the host index records both.
- `workingDirectory` = checkout A.

**Steps**:
1. Run `board --json` from A and assert `scope: "repository"`, `selection: "current"`, and `repositories` equals exactly `[A's repository key]`.
2. Assert the host-index access counters show **zero reads** and zero writes for this invocation.
3. Assert B's store is never opened: its read counter is zero and no row carries B's key.
4. Assert the rows are A's facts only, including the case where A and B hold the same ref (A's row only).
5. Assert `omittedBySection.repositories` is `0` and `truncated` is `false` — the default form is a one-repository board and never reports a cap omission.

**Expected Outcome**:
- Scope, selection, key set, and read posture are all the declared default: the invoking checkout, no index, no foreign read.

**Notes / Clarifications**:
- `DEC-14` makes this the criterion's owning case; the read-cost half remains `AC-NFR5-1` so a future read regression is attributed to the read budget rather than to selection. The unbound and identity-underivable halves live in `TC-BOARD-015`.

#### TC-BOARD-011 - `--all` is the index union the invoking checkout, ascending and unique, counts equal to the sum

**Objective**: Prove the fleet view is a bounded union with no duplicated rows and that its counts are exactly the sum of the per-repository boards.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-1, NFR-3, DM-7, DM-11, SC-M2-S4-02
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-selection-all.test.ts` (new) over the real production composition
**Tags**: @backend, @behaviour

**Preconditions**:
- Two real checkouts A and B with distinct keys; the host index records both; `workingDirectory` = A.
- Each checkout holds distinct rows in each section.

**Steps**:
1. Run the default board in A and in B separately; record each section's count.
2. Run `board --all --json` from A.
3. Assert `selection: "all"`, `repositories` equals both keys ascending and unique, and every row's `repository` is a member of it.
4. Assert each section's count equals the sum of the two per-repository counts (no byte-guard drop at this fixture size), and that all row identities within each array are unique.
5. Assert the host index is read exactly once for the invocation.
6. Cap-clean cell (`SC-M2-S4-02` as a positive control): assert `omittedBySection.repositories` is `0` and `truncated` is `false` — two keys are far inside the 128 cap, so a cap implementation that always reports an omission fails here.
7. Union cell: run `--all` from a third checkout C whose key is already recorded; assert C appears once (the index record wins, no duplicate).

**Expected Outcome**:
- Both keys listed, counts equal to the sum, no duplicate identity, one index read, no spurious cap omission.

**Notes / Clarifications**:
- This case is `SC-M2-S4-02`'s listing-and-count half; `TC-BOARD-012` supplies the collision half the seed's count assertion cannot detect, and `TC-BOARD-084` proves the seed would fail if the cap mis-retained the invoking key.

#### TC-BOARD-012 - Two repositories holding one ref produce two distinct rows with their own phase, holder, and state

**Objective**: Prove that a shared ref is not a shared row: every same-ref pair in every section stays distinct and carries its own repository-scoped evidence.
**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-2, NFR-3, DM-3, DM-4, DM-5, DM-6, SC-M2-S4-02
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-selection-all.test.ts` (same suite, collision cells) over the real production composition
**Tags**: @backend, @behaviour

**Preconditions**:
- Two real checkouts, A and B, both holding `GH-244`:
  - A: lane `delivering` with holder `holder-a` and phase `delivery`; gate `GH-244:owner-review` fresh with a recorded waiver authorizer; question `q-1` on `GH-244`; park `peak-window` on `GH-244` with an `until`.
  - B: lane `failed` with no lease and `phases-complete`; gate `GH-244:owner-review` escalated with no waiver; question `q-1` on `GH-244`; park `owner-hold` on `GH-244`.

**Steps**:
1. Run `board --all --json`.
2. Assert `lanes` has two rows whose `ref` equals `GH-244`, one per repository, with A's row `state: delivering`, `holder: "holder-a"`, `phase: "delivery"` and B's row `state: failed`, `holder: null`, `phase: null` + `phases-complete`.
3. Assert `gates` has two rows with the **same** `id` (`GH-244:owner-review`) and different `repository`, different `slaState`, and different `waivedBy`.
4. Assert `asks` has two rows with the same question id `q-1` and different `repository`, each with its own `drawnDefault`/`defaultState` join.
5. Assert `parked` has two rows whose `ref` equals `GH-244`, one `peak-window` with a non-null `until` and one `owner-hold` with `until: null` + `untilReason`.
6. Assert no row's field is borrowed across repositories: A's holder never appears on B's row, and B's `phases-complete` never appears on A's row.

**Expected Outcome**:
- Eight same-ref rows, each under its own repository key, none merged or overwritten.

**Notes / Clarifications**:
- The identical gate and question ids are deliberate: they make an identity keyed by id alone collide. `TC-BOARD-083` proves the detection power with a mutation.

#### TC-BOARD-013 - An unmanaged key, including a group key, is `board.repository-unknown` at exit 1

**Objective**: Prove `--project` resolves against the managed set only, and that the board has no group vocabulary even when a group with a matching key exists on the host.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-3, F-3, F-8, DM-7, DM-8, NG-3
**Test Type(s)**: Integration, Negative
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-selection-project.test.ts` (new)
**Tags**: @backend, @behaviour

**Preconditions**:
- Managed set of one checkout; a project-group configuration on the same host whose group key is not a repository key.
- Recorded read counters on the invoking store and the host index.

**Steps**:
1. Run `board --project` with an unmanaged key and `--json`; assert exit `1`, `error.code === "board.repository-unknown"`, no `data`, no section label, and zero store/index reads beyond what selection resolution requires.
2. Run `board --project` with the configured group key; assert the identical refusal (the group key is not a repository key).
3. Assert no board surface names a group: `data` contains no `groups`, `groupKey`, `members`, or `memberKeys` key, and `board --help` contains no group vocabulary.

**Expected Outcome**:
- One refusal identity for any key outside the managed set; the group surface never leaks into the board.

**Notes / Clarifications**:
- The group configuration in the fixture is what makes step 2 meaningful; without it the case would pass on a nonexistent key.

#### TC-BOARD-014 - `--project` narrows without reading another repository; grammar violations are `fallback.invocation`

**Objective**: Prove narrowing is real (no foreign read), that the two scope flags are mutually exclusive before any source is touched, and that every grammar refusal keeps the delivered containment identity.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-4, F-3, F-8, DM-7, DM-8, DEC-17, C-10
**Test Type(s)**: Integration, Negative
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-selection-project.test.ts` (same suite, narrowing and refusal cells)
**Tags**: @backend, @behaviour

**Preconditions**:
- Two managed checkouts A and B; `workingDirectory` = A; read counters on both stores.

**Steps**:
1. Run `board --project` with B's repository key from A; assert `selection: "project"`, `repositories` equals exactly B's key, every row carries B's key, and A's store read counter is zero.
2. Run `board --all --project` with B's key; assert exit `1`, `error.code === "fallback.invocation"` (the delivered constant, not a `board.*` code), no `data`, no section label, and every read counter zero.
3. Run `board --project` with no value; assert the same identity and the same zero-read posture.
4. Repeat the refusal cell for an unknown flag and for a positional argument; assert the same identity and the same zero-read posture.
5. Assert the error table contains no `board.*` grammar identity, so a new one would fail the case.

**Expected Outcome**:
- Narrowing reads one repository only; every grammar violation is refused before any read with the delivered containment identity.

**Notes / Clarifications**:
- A key beyond the ascending 128-key cap is still a valid `--project` target; that cell is `TC-BOARD-064` so the cap rule has one owner.

#### TC-BOARD-015 - The `unbound` scope covers an unbound or identity-underivable checkout

**Objective**: Prove the out-of-tree invocation is a declared scope, not an error and not a claim about a repository — including the case where a directory exists but its checkout identity cannot be derived.
**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-5, AC-F3-6, F-3, F-8, DM-7, DEC-14
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-selection-unbound.test.ts` (new) over the real production composition
**Tags**: @backend, @behaviour

**Preconditions**:
- Cell 1: a working directory inside no git work tree (`nonCheckoutDirectory`), named like a plausible repository to bait a path-derived key.
- Cell 2: a directory that looks like a checkout but whose identity cannot be derived (its `.git` common directory is unreadable), so the derivation fails rather than returning a key.
- Cell 3: a per-test host root with a populated host index and an `--all` / `--project` invocation from a non-checkout directory.

**Steps**:
1. Cell 1: run `board --json`; assert exit `0`, `scope: "unbound"`, `repositories: []`, and each of the four arrays empty.
2. Assert exactly one bounded warning is attached on the error stream, naming the unbound scope, that it never enters `data`, and that it never changes the exit code.
3. Assert no repository key was derived from the directory name, no host-index fallback occurred (index read counter zero), and no `board.state-unavailable` or `board.repository-unknown` appears.
4. Cell 2: assert the identical unbound outcome — an underivable identity is unbound, never an error and never a fabricated key.
5. Cell 3: run `--all` and `--project` from the non-checkout directory; assert both report `scope: "repository"` (not `unbound`), resolve their set from the managed index, and exit `0` — or, when the managed set is empty, `repositories: []` with `scope: "repository"`.
6. Control: with a host-wide owner hold active, `ownerHold.active` is `true` while the sections stay empty and the exit stays `0`.

**Expected Outcome**:
- An empty, honestly labelled board at exit `0` in both unbound cells; a warning that cannot be mistaken for a failure; and `--all`/`--project` never mislabelled as unbound.

#### TC-BOARD-016 - Managed-set edge cells: absent index, vanished root, unreadable and unparseable index

**Objective**: Pin the four managed-set boundary cells so "every managed repository" cannot silently mean "every entry, including dead ones" or "nothing, because the index is missing".
**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-1, AC-F8-2, AC-NFR5-1, F-3, F-8, NFR-5, DM-8
**Test Type(s)**: Integration, Negative
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-selection-all.test.ts` (edge cells) over the real production composition
**Tags**: @backend, @behaviour

**Preconditions**:
- Host fixtures: (a) no host index at all; (b) an index with three entries where one root has been deleted; (c) a present-but-unreadable index (mode `000`); (d) a present-but-unparseable index (`not-json`).

**Steps**:
1. Cell (a): run `--all` and `--project` with the invoking key; assert exit `0`, `repositories` equals the invoking checkout alone, no error identity, and one index read attempt that resolves to "absent".
2. Cell (b): run `--all`; assert `repositories` has exactly two keys (the live ones), the vanished key is absent, exit is `0`, and the count is neither three nor one.
3. Cells (c) and (d): run `--all`; assert exit `2`, `board.state-unavailable`, the summary naming the index path, and nothing rendered.
4. Assert exactly one index read per `--all` run in every cell.
5. Cross-reference cell: an index with more than 128 live records is not an error; the retained-set rule applies and is asserted by `TC-BOARD-064`, so this case asserts only that exit stays `0` and the index is read once.

**Expected Outcome**:
- Absent ≠ corrupt; a dead root is not a board repository; an unreadable index fails closed naming the path; a large index is not a failure.

#### TC-BOARD-020 - The delivered SLA matrix is preserved, boundary cells included, with the delivered ranking

**Objective**: Prove the gates section is the delivered mechanism, not a re-derivation: same thresholds, same inclusive boundaries, same never-merge rule, same ranking, same cap.
**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F4-1, F-4, DM-3, DEC-2, C-3
**Test Type(s)**: Integration, Regression
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-gates-sla.test.ts` (new, or `board-escalation`/`board-aging` extended)
**Tags**: @backend, @behaviour

**Preconditions**:
- Gate fixture at the delivered ages: 1 h, 23 h 59 m, exactly 24 h, 24 h + 1 ms, exactly 72 h (`waiver`), 72 h − 1 ms (`waiver`), 1 000 h (`owner-review`), an absent-activity gate, and an unparseable-activity gate.
- One recorded authorized waiver with `waivedBy`.

**Steps**:
1. Assert `slaState` per age, with both sides of each boundary: `fresh` under 24 h, `escalated` from exactly 24 h, `default-applied` at exactly 72 h for `waiver`.
2. Assert `owner-review` never reaches `default-applied` at any age and never carries a `default`.
3. Assert the authorized `waiver` surfaces as `waiver` with its `waivedBy`, and its `condition` token is the literal `waiver` joined by a colon to its SLA state.
4. Assert the rank order: severity (`escalated`, `default-applied`, `fresh`), then descending age, unknown age before known age within a class, then id ascending.
5. Assert the per-repository gate cap of 8 with the overflow counted.

**Expected Outcome**:
- Every delivered SLA property holds unchanged; both sides of each inclusive boundary are proven.

#### TC-BOARD-021 - Default application appends exactly one decision record per repository and is idempotent

**Objective**: Prove silence is impossible without unbounded writing: one append the first time, nothing afterwards, scoped per repository.
**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F4-2, F-4, NFR-6, DM-3, DEC-6
**Test Type(s)**: Integration, Regression
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-defaults.test.ts` (extended) and `tests/behaviour/board-defaults-idempotency.test.ts` (new)
**Tags**: @backend, @behaviour

**Preconditions**:
- A `waiver` gate at 73 h in two repositories (A and B), each with its own store and ledger.
- A pre-seeded decision record for an unrelated gate in A.

**Steps**:
1. Run `board --all`; assert exactly one decision record in A's ledger for the expired gate and one in B's, each naming its own gate and ref.
2. Assert the rendered row for each is `default-applied` with `default: "owner-review-first"`.
3. Run again; assert zero further appends, byte-identical rows, and an unchanged ledger record count in both stores.
4. Assert the append is fenced and scoped: no record lands in the host root and no repository's record appears in the other's ledger.
5. Control cell: a run whose gates are all fresh performs zero history reads and zero appends.

**Expected Outcome**:
- One record per newly defaulted gate per repository, idempotent on replay, never cross-scoped.

#### TC-BOARD-022 - The gate row is extended, not re-semanted: `condition`, `repository`, `owner`, `ownerSource`

**Objective**: Prove the gate record is a strict superset of the delivered record, so an M1 consumer keeps reading valid gate records.
**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F4-1, F-4, DM-3, §8.5, C-1
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/board-contract.test.ts` (new); `tests/structure/owner-gate-sla-contract.test.ts` (extended)
**Tags**: @backend, @structure

**Preconditions**:
- The delivered gate record key set (eight fields) and the extended key set.

**Steps**:
1. Assert the delivered key set is a subset of the new key set, and that the removed-key set is empty.
2. Assert each delivered field keeps its name and type, and each new field (`repository`, `condition`, `owner`, `ownerSource`) is additive.
3. Assert `condition` equals `kind + ":" + slaState` for every row, including two different kinds in one repository.
4. Assert `id` keeps its delivered shape: the ref, a colon, then the kind.
5. Assert a delivered-shape validator parses the extended record without error.

**Expected Outcome**:
- The gate record extended additively; `condition` is derived from the row's own fields, not from a lookup table.

#### TC-BOARD-023 - The delivered collector-unavailable identities and their exit 2 projection are preserved

**Objective**: Prove the two failure families are not conflated: a collector failure keeps the delivered family identity, while a source read failure uses the new identity.
**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F4-1, AC-F2-3, AC-F8-1, F-4, F-8, DM-8
**Test Type(s)**: Integration, Negative
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-collectors.test.ts` (extended)
**Tags**: @backend, @behaviour

**Preconditions**:
- Failing collectors for each declared id and each delivered reason (`failed`, `credential-unavailable`, `not-configured`).

**Steps**:
1. For each collector id, assert exit `2` and the code exactly matching the delivered collector family shape for that id.
2. Assert no partial board and no zero-row section.
3. Assert the code is not `board.state-unavailable` — the two families stay distinguishable.
4. Assert the documented family row shape still matches the prefix/suffix constants and the closed id set.

**Expected Outcome**:
- Delivered collector identities preserved with their exit row; the new identity reserved for source and index failures.

#### TC-BOARD-024 - Machine bounds and field caps hold, and every drop is counted

**Objective**: Prove the bounded screen is truthful: caps do not silently widen, and every dropped row is counted.
**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F4-3, F-9, DM-11, NFR-4, C-6
**Test Type(s)**: Integration, Measured
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-bounds.test.ts` (extended for per-section caps and `omittedBySection`)
**Tags**: @backend, @behaviour

**Preconditions**:
- An at-cap fixture (2 repositories × 8 gates, 20 lanes, 8 asks, 8 parks) and an over-cap fixture (2 × 100 gates, 30 lanes, 20 asks, 20 parks).
- Over-cap field values for each capped field (id/kind/ref/question 500 chars, owner 400, reason 400, phase 200, until 80).

**Steps**:
1. Serialize `data` and assert UTF-8 length ≤ 65 536 in both fixtures; measure `data`, not the envelope.
2. Assert per-repository row counts are at most 8/20/8/8 in the over-cap fixture, so the per-section caps are the declared ones and not wider.
3. Assert `truncated` is `false` for the at-cap fixture and `true` for the over-cap fixture.
4. Assert `omitted` equals the sum of the five `omittedBySection` counters and that each dropped row is accounted for.
5. Assert every capped field is clamped to its declared limit and that clamping is applied to the projected value, not to the stored record.

**Expected Outcome**:
- Caps hold, drops are counted, `truncated` is set exactly when a drop occurs, and every section's omission is individually stated.

**Notes / Clarifications**:
- The repository-list cap and the byte-guard row order are `AC-F9-4` and are asserted in `TC-BOARD-064`/`TC-BOARD-065`; this case deliberately keeps to the per-section and field caps so a failure is attributable.

#### TC-BOARD-025 - The 24-line budget is allocated across the four sections with `+N more` markers

**Objective**: Prove "one screen" is achieved by a declared allocation rather than by widening the delivered bound.
**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F4-3, F-9, DM-11, DEC-9, AMB-TP-1
**Test Type(s)**: Integration, Measured
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-bounds.test.ts` (human allocation cells)
**Tags**: @backend, @behaviour

**Preconditions**:
- A fixture with 7 lanes, 7 gates, 5 asks, and 4 parks in one repository (one over each human allocation).

**Steps**:
1. Assert the rendered screen is at most 24 lines and 4 096 bytes, with no line over 400 bytes.
2. Assert each section renders at most its allocation: lanes 6, gates 6, asks 4, parked 3.
3. Assert each section's label line carries a `+N more` marker whose `N` equals that section's machine `omittedBySection` value.
4. Assert the allocation is a cap, not a fixed layout: a fixture with 2/2/1/1 rows renders 2/2/1/1 rows with no marker.

**Expected Outcome**:
- The 24-line budget is respected with an explicit, counted omission per section.

**Notes / Clarifications**:
- `AMB-TP-1`: the case asserts the allocation as a maximum and the marker's arithmetic; it does not pin a line layout.

#### TC-BOARD-030 - An owner ask carries the delivered fields, a computed age, and the pending drawn default

**Objective**: Prove the ask row is the delivered open-question view joined to the delivered policy, with age computed rather than copied.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-1, F-5, F-4, DM-5, DEC-4
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-asks.test.ts` (new)
**Tags**: @backend, @behaviour

**Preconditions**:
- One open `owner`-audience question asked 26 h before the injected clock on ref `GH-500`, and a defaultable `waiver` gate on `GH-500` that has not yet crossed 72 h.
- A second question whose stored record carries a bogus `age` field to bait a copy.

**Steps**:
1. Assert the ask row's key set equals `DM-5` exactly (`repository`, `id`, `type`, `ref`, `lane`, `question`, `askedAt`, `age`, `status`, `owner`, `ownerSource`, `drawnDefault`, `defaultState`) — and carries no absence-reason field.
2. Assert `age` equals the injected-clock delta for `askedAt` (26 h in ms), not the bogus stored value.
3. Assert `drawnDefault` equals the delivered policy default for the gate on that ref, `defaultState` is `pending`, and `status` is `open`.
4. Assert `question` is bounded and `type` is a member of the delivered closed question-type set.

**Expected Outcome**:
- The ask row is the delivered view plus the policy join; `age` is computed and `pending` is the honest pre-expiry state.

#### TC-BOARD-031 - The same-run post-append join renders `applied` with one record and no second history read

**Objective**: Prove the join observes the invocation's **post-append** decision set: a default this run applied is visible on this run's ask row, from the single history read, without a second append on replay.
**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-3, AC-F5-1, AC-F4-2, F-5, DM-5, NFR-5, NFR-6, DEC-16, C-12
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-asks.test.ts` (same suite, same-run cells)
**Tags**: @backend, @behaviour

**Preconditions**:
- Cell 1: a pre-seeded decision record for `GH-501`, with an open owner question on `GH-501`.
- Cell 2: a `waiver` gate on `GH-502` at 73 h plus an open owner question on `GH-502`, with no pre-existing record and no pre-expiry record.
- The harness recorder counts `readDecisions`, `appendDecision`, and fence acquisitions.

**Steps**:
1. Cell 1: assert the ask on `GH-501` carries `defaultState: "applied"` and an unchanged `drawnDefault`.
2. Cell 2, one run: assert the gate row is `default-applied`, the ledger gained exactly one record, and the ask row **in the same payload** carries `defaultState: "applied"` — not `pending`.
3. Assert the run performed exactly **one** decision-history read and that the ask join added none (recorder count unchanged between the gate read and the ask projection).
4. Cell 2 replay: assert the second run appends nothing, renders the identical ask row, and still performs exactly one history read.
5. Assert a record for a *different* ref does not mark this ask applied.

**Expected Outcome**:
- `applied` tracks the end-of-run decision set; one append and one history read per repository; replay is byte-identical.

**Notes / Clarifications**:
- `DEC-16` pins the ordering. A pre-run snapshot would render `pending` in step 2, which is the exact false statement the decision rejects.

#### TC-BOARD-032 - `none` is declared, a ref-less ask keeps the bare `null`, coordinator questions are excluded

**Objective**: Prove `none` is a value that states silence will not resolve the ask, that a ref-less question carries the delivered bare `null` with no invented reason, and that the population is owner-audience only.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-2, F-5, DM-5, DEC-4, DEC-19, C-14
**Test Type(s)**: Integration, Negative
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-asks.test.ts` (same suite, `none` and exclusion cells)
**Tags**: @backend, @behaviour

**Preconditions**:
- Owner questions: one on a ref with no defaultable gate; one with `ref: null`; one answered (closed).
- A `coordinator`-audience question on a ref that *does* hold a defaultable gate (the bait).
- Twelve owner questions on ten refs to exercise the per-repository cap of 8 and the ranking.

**Steps**:
1. Assert the undefaultable ask carries `drawnDefault: null` **and** `defaultState: "none"`, both keys present (`Object.hasOwn`), never omitted.
2. Assert the ref-less owner question is present with `ref: null`, `drawnDefault: null`, `defaultState: "none"`, and no `refUnknownReason` or any other invented absence-reason field; the row's key set is exactly `DM-5`'s.
3. Assert the coordinator question's id is absent from `asks` even though its ref has a defaultable gate; assert it is still visible through the delivered blockers surface (the exclusion is board-specific, not a lost question).
4. Assert the answered question is absent (`status` is `open` only).
5. Assert the ask order equals the delivered shared ranking for the same population, repository-major, and that the cap of 8 is applied with the overflow counted.

**Expected Outcome**:
- `none` is declared, the bare `null` is carried verbatim, coordinator questions never become asks, and ranking and cap are the delivered ones.

#### TC-BOARD-033 - Parked work carries reason and `until`; `provider-quota` is not a parked row

**Objective**: Prove parked work is the delivered open-episode projection with an honest absence where no expiry exists, that the population is the two declared lane causes, and that the exclusion of the provider condition is a declared rule rather than a silent omission.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F6-1, F-6, DM-6, DEC-11, DEC-18, NG-9, C-13
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-parked.test.ts` (new)
**Tags**: @backend, @behaviour

**Preconditions**:
- Open `peak-window` park on `GH-601` with a recorded window end, preservation classification, and provider profile.
- Open `owner-hold` park on `GH-602` with no expiry, and a record carrying `createdAt`/`releasedAt` values to bait a synthesized `until`.
- Open `provider-quota` park on `GH-605` with a recheck time (the exclusion bait).
- Two episodes for `GH-603` (an older and a newer), a closed episode for `GH-604`, and three local PM-context parked entries.

**Steps**:
1. Assert the peak row carries `reason: "peak-window"`, `until` equal to the recorded window end, `preservation`, and `providerProfile`.
2. Assert the owner-hold row carries `until: null` with `untilReason: "owner-hold-no-expiry"` and that neither `createdAt` nor `releasedAt` leaked into `until`.
3. Assert `GH-603` yields exactly one row (the newer episode) and `GH-604` yields none.
4. Assert the closed cause set holds exactly `["peak-window", "owner-hold"]` (both directions of set equality) and that the `provider-quota` park produces **no** `parked[]` row and no `lanes` row.
5. Assert the exclusion is declared, not silent: `omittedBySection.parked` counts only drops from the declared population (it is not incremented for the quota park), and the quota condition is still visible on the delivered provider/queue surface (control read).
6. Assert `owner`/`ownerSource` are populated per `DM-10` and that a park with no recorded principal carries `owner: null`, not a fabricated name.

**Expected Outcome**:
- Two causes, one row per ref, no fabricated expiry, and a declared — tested — population boundary.

#### TC-BOARD-034 - The host-wide owner hold is carried once, sanitized, and never fabricates a row

**Objective**: Prove an idle fleet under hold is explained by a payload fact rather than by an empty screen.
**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F6-2, F-6, DM-7, DEC-11
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-parked.test.ts` (owner-hold cells)
**Tags**: @backend, @behaviour

**Preconditions**:
- Cell 1: no hold. Cell 2: hold via environment. Cell 3: hold via host-root marker with a 500-character reason containing a secret-looking token.

**Steps**:
1. Cell 1: assert `ownerHold` is exactly `{active: false}` — no `source`, no `reason`.
2. Cell 2: assert `{active: true, source: "env"}` and no invented `reason`.
3. Cell 3: assert `{active: true, source: "marker"}` with a reason clamped to the declared bound and redacted per the delivered hold contract.
4. Assert the hold is carried once at the payload's top level, not per row, and that it creates no `parked` row and no lane.
5. Control cell: hold active with zero work in the repository renders all four sections empty at exit `0`, so the hold is visible while the empty sections stay truthful.

**Expected Outcome**:
- One sanitized host-wide fact, shape-exact when inactive, and no fabricated work.

#### TC-BOARD-040 - `board` is the 21st prompt-required family, composed by production, listed in root help

**Objective**: Prove the mount is complete at the composition seam: the command is in the exact set the entrypoint composes and appears in the root listing.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F7-1, F-7, DEC-10, RSK-5
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/board-mounting.test.ts` (new); extends `tests/behaviour/entrypoint-help.test.ts` and `tests/structure/events-production-composition.test.ts` / `daemon-production-composition.test.ts` (family-count assertions 20 → 21)
**Tags**: @backend, @structure

**Preconditions**:
- The prompt-required declaration and the production composer over a per-test host root.

**Steps**:
1. Assert `PROMPT_REQUIRED_COMMANDS` has exactly 21 members, contains `"board"` exactly once, and still contains all 20 previously declared members (set equality on the declared constant).
2. Run root `--help` through the real entrypoint with the production composer; assert `board` appears as a family row and the five help sections are intact.
3. Assert the composition is unconditional: the composed program contains `board` with no injected board runtime supplied by the test.
4. Assert `board --help` reaches the help handler rather than a `fallback.internal` failure.

**Expected Outcome**:
- The 21st family is declared, composed without a test-supplied runtime, and advertised.

**Notes / Clarifications**:
- Asserting the declared count (21) is asserting this change's contract, not a moving value; the existing suites' literal 20 assertions are updated in the same change.

#### TC-BOARD-041 - `board --help` answers at exit 0 with the five declared sections and no side effect

**Objective**: Prove the reachable command self-describes completely and that help is a pure data lookup.
**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F7-1, F-7
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-help.test.ts` (new)
**Tags**: @backend, @behaviour

**Preconditions**:
- Empty environment, no state root, no git checkout, recording counters on the store/transport/spawn seams.

**Steps**:
1. Run `board --help`; assert exit `0` and the five sections (`summary`, `Usage:`, `Options:`, `Examples:`, `Exit codes:`, `See also:`) are present.
2. Assert the options list contains `--all`, `--project` (with a value placeholder), and `--json`; assert the exit-code section lists `0`, `1`, and `2` with their meanings.
3. Assert `seeAlso` includes the M2 board reference page.
4. Assert zero state, git, network, configuration, and spawn activity.
5. Run `--version`; assert exit `0` and the brand-derived version output.

**Expected Outcome**:
- Complete, side-effect-free help for the new family.

#### TC-BOARD-042 - The reference page and the coverage-inventory row satisfy the help coverage check

**Objective**: Prove the mount's documentation unit is complete and that the check is bidirectional.
**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F7-2, F-7
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/help-guide-coverage.test.ts` and `tests/checks/reference-page-parity.test.ts` (extended); artifacts `doc/planning/oss-tooling/milestones/m2/commands/board.md`, `tests/fixtures/help-guide/coverage.json`
**Tags**: @structure

**Preconditions**:
- The M2 board page and the coverage inventory.

**Steps**:
1. Assert `runHelpGuideCoverage()` returns no failures.
2. Assert the M2 board page exists, names the command, and contains `--help` and `--version`.
3. Assert `tests/fixtures/help-guide/coverage.json` lists `board` in `commands` and the page path in `referencePages`.
4. Assert `coverage.commands` set-equals `PROMPT_REQUIRED_COMMANDS`.
5. Mutation: delete the board row from a temporary copy of the inventory and assert the parity check fails naming the missing page/command.

**Expected Outcome**:
- Zero coverage failures, and the check demonstrably fails when the row is removed.

#### TC-BOARD-043 - Mounting changes no other family, and the unmounted mutant is detected

**Objective**: Prove the mount is exactly one family, and that the root-help assertion would fail if the prompt-set entry were absent.
**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F7-1, F-7, RSK-5
**Test Type(s)**: Integration, Structural
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/board-mounting.test.ts` (isolation cells) and `tests/structure/entrypoint-bin.test.ts` (extended)
**Tags**: @backend, @structure

**Preconditions**:
- The declared help inventory and the delivered command map.

**Steps**:
1. Assert the delta to the prompt-required set is exactly `board`: every other member is unchanged in name and order, and no other family's help entry text changed.
2. Assert the entrypoint still drops non-prompt commands (`config`, `provider`, `db`, `watchdog`) and now keeps `board`.
3. Mutation: in a temporary copy of `packages/cli/src`, remove `"board"` from the prompt-required declaration; assert root `--help` omits the family and an invocation of `board` fails closed through the delivered internal containment identity — the exact pre-change behaviour.
4. Restore; assert the live assertion passes.

**Expected Outcome**:
- One family added, nothing else touched, and the mount assertion proven live.

#### TC-BOARD-050 - Every outcome uses the five-field envelope with all new keys under `data`

**Objective**: Prove envelope continuity and the exact exit projection, table row by table row.
**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F8-1, NFR-1, F-8, DM-2, DM-8
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-envelope.test.ts` (new); `packages/testkit/src/result-conformance` (`assertEnvelopeContract`)
**Tags**: @backend, @behaviour

**Preconditions**:
- One fixture per §8.3 row: produced board, unmanaged key, grammar violation (including a valueless `--project`), collector unavailable, source unreadable.

**Steps**:
1. For the produced board, assert `assertEnvelopeContract` returns `[]`, the five delivered envelope fields are present, and no new top-level key exists.
2. Assert every new payload key lives under `data` and that `data` contains no `ok` or `command` field.
3. For each failure row, assert `ok: false`, an `error` object with the declared `code` (`board.repository-unknown`, `fallback.invocation`, the delivered collector family shape for the failing collector, `board.state-unavailable`), no `data`, and the exact exit code from the table.
4. Assert the set of observed exit codes is exactly `{0, 1, 2}` and that no row yields another code.

**Expected Outcome**:
- The envelope is untouched and the exit projection is exactly as declared.

#### TC-BOARD-051 - Grammar refusals happen before any read and never render a partial board

**Objective**: Prove containment happens before the first source read, so a refused invocation cannot half-render.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F8-1, F-8, DM-8, DEC-17, C-10
**Test Type(s)**: Integration, Negative
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-command.test.ts` (extended)
**Tags**: @backend, @behaviour

**Preconditions**:
- Recording counters on every read seam (store, tracker, transport, index).

**Steps**:
1. For each violation — positional argument, unknown flag (`--watch`, `--limit`), `--all` with `--project`, `--project` with no value — assert exit `1`, `fallback.invocation`, no `data`, and no section label on stdout.
2. Assert every read counter is zero for every violation.
3. Assert the refusal names the offending token on the error stream (the delivered containment behaviour).
4. Assert no `board.*` grammar identity exists in the error table, so a new one would fail the case.

**Expected Outcome**:
- Refusals precede reads; no partial board is possible on a grammar failure; the delivered identity is reused rather than forked.

#### TC-BOARD-052 - `board.state-unavailable` names the failing repository key and renders nothing

**Objective**: Prove the new platform identity carries the diagnostic the owner needs — which repository failed — without leaking a partial fleet.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F8-2, AC-F2-3, F-8, DM-8
**Test Type(s)**: Integration, Negative
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-errors.test.ts` (new)
**Tags**: @backend, @behaviour

**Preconditions**:
- Two repositories; one healthy, one degraded per cell: repository state location unreadable (`chmod 000`), required source read failing, lane/phase read failing.

**Steps**:
1. For each cell, assert exit `2` and `error.code === "board.state-unavailable"`.
2. Assert the error summary names the failing repository key (not "unknown", not the invoking key when a different repository failed).
3. Assert nothing is rendered: no `data`, no section label, and the healthy repository's key does not appear in stdout.
4. Assert no retry occurred (the failing read is attempted once).

**Expected Outcome**:
- One platform identity, one named failing repository, and no partial fleet screen.

#### TC-BOARD-053 - The `board` kind, its two rows, the exact two-segment allowlist widening, and all 23 Appendix D count pins

**Objective**: Prove the error-taxonomy change is complete and bidirectional — the two rows exist, the **closed** two-segment allowlist gains exactly those two codes in both the sync check and its structural mirror, **every one of the 23 count-pinning sites enumerated in spec Appendix D moves to its declared post-change value in the same commit**, a repo-wide scan of the five named files finds no leftover identity-count pin, the classifier/check/mirror/carrier agree on the same five numbers, and a near-miss two-segment `board.*` code is rejected instead of family-matched. This is the gate-critical half of the ACL: an allowlist widened by convenience stops gating, and a single stale count site anywhere in the five files turns the gate red at best and lies at worst.
**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F8-3, AC-F8-1, AC-F8-2, F-8, DM-8, C-7, C-16, DEC-20, Appendix D (D-1..D-23)
**Test Type(s)**: Unit, Contract, Mutation
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/error-table.test.ts`, `tests/structure/dispatch-attempts-taxonomy.test.ts`, `tests/structure/verify-gates-suite-map-contract.test.ts`, `tests/checks/error-table-sync.test.ts` (all extended); carrier `doc/spec/features/feature-result-contract.md`; production seams `scripts/checks/error-table-sync.ts` (`RESERVED_TWO_SEGMENT_CODES`, `scanReferences`, `runSyncCheck`), `packages/core/src/contracts/error-table.ts`, `packages/cli/src/classify.ts`
**Tags**: @backend, @structure

**Preconditions**:
- The delivery of the new rows, the two allowlist members, all 23 Appendix D pins, and their documentation in the same change boundary.
- Appendix D read as the binding locator list: the file plus the quoted expression identifies each site; the spec's baseline line numbers are the search anchor, not the contract.
- The delivered baseline values, read as literals so a silent drift is red rather than conventional: allowlist 53, `ERROR_TABLE` 136, delivered (non-spend) 135, documented identities 136, `BASELINE_ROWS.length + 102`, carrier allowlist paragraph 52 (reconciled to 55, not 54).

**Steps**:
1. Assert the domain-kind declaration gains `"board"` exactly once and that no other kind changes; assert `ERROR_TABLE` gains exactly two rows: `board.repository-unknown` (user category, exit `1`) and `board.state-unavailable` (platform category, exit `2`), each with retryability, consequence, and projection class.
2. Assert the delivered `status.collector.tracker.unavailable` and `.lanes.unavailable` rows keep their codes, category, and exit; only their explanatory wording generalizes. Assert no `board.*` grammar row was added and that `fallback.invocation` keeps its category and exit `1` (DEC-17).
3. Allowlist, exact set (mirror): assert `RESERVED_TWO_SEGMENT_CODES` has exactly **55** members; assert the `board.`-prefixed members are exactly `["board.repository-unknown", "board.state-unavailable"]` (both directions of set equality, so a third `board.*` member fails); assert the 53 delivered members are unchanged; assert `isValidCode` is true for both board codes and false for `board.repository-unknowns`, `board.state`, `board.`, and `board.state-unavailable-typo`.
4. Allowlist, exact set (check): assert `scanReferences` recognizes exactly the two board codes as recognized references in a document that references them, and recognizes **no other** `board.*` code — including a planted `board.repository-unknowns` and `board.other-thing` — so the check's own set is proven set-based and not family-based.
5. **Appendix D site-by-site movement (D-1..D-23), grouped by file, each group asserted as a group so a single stale pin fails the case:**
   - **`tests/structure/error-table.test.ts`** (D-1..D-7): the four `expect(entries).toHaveLength(...)` entry pins read **138**; the allowlist pin reads **55**; the delivered-row pin in the spend-exclusion assertion reads **137**; the document pin reads `"138 identities"`.
   - **`tests/structure/dispatch-attempts-taxonomy.test.ts`** (D-8..D-10): the header comment states **137** identities; the test name states **138** identities; the `expect(entries).toHaveLength(...)` assertion reads **138**.
   - **`tests/structure/verify-gates-suite-map-contract.test.ts`** (D-11..D-12): `result.counts.sourceEntries` and `result.counts.documentedRows` both read **138**.
   - **`tests/checks/error-table-sync.test.ts`** (D-13..D-21): all four `BASELINE_ROWS.length + 102` sites read **`+ 104`**, including the failure-message interpolation; the header comment states **138**; the test name states **138** entries and **138** documented rows; the two explicit `sourceEntries`/`documentedRows` reads in that test read **138**; the document-content assertion reads `"138 identities"`.
   - **`doc/spec/features/feature-result-contract.md`** (D-22..D-23): both documented-identity mentions state **138** (neither states 136), and the closed two-segment allowlist paragraph states **55** (not 52, not 54) with a `board` entry of **2** whose enumeration sums to 55.
6. **No-leftover scan**: read the five named files and assert no remaining identity-count pin at **136**, **135**, **53**, or **52** — i.e. every residual occurrence of those tokens in those files is either absent or matched by a declared non-count pattern (a byte/character/line-length number, an array index or offset, or a cited spec/commit reference), and the scan reports the residual list it accepted so an undeclared leftover cannot hide behind the pattern. Assert the accepted-residual list is small and named, not a wildcard, and assert in particular that no `+ 102` arithmetic survives in the sync suite after the move.
7. **Four-way agreement**: assert the classifier resolves both board codes; the sync check reports **138** `sourceEntries` and **138** `documentedRows`; the structural mirror asserts **138** entries / **137** delivered rows / **55** allowlist codes / **2** board rows; and the carrier declares **138** identities with the allowlist at **55**. Assert all four surfaces were read in the same run of the same tree, so agreement is a comparison rather than four independent hopes.
8. Three-segment lookalikes: assert `board.state-unavailable.extra` and `board.other.thing` resolve to no table row (`resolveAppErrorCode` not ok / `classifyDomainKind("board", …)` throws), so a structurally-shaped code cannot ride the new kind in.
9. Mutation A (near-miss rejection is enforced end-to-end): in a temporary copy of the tree, plant a two-segment `board.repository-unknowns` reference in a scanned corpus and assert `runSyncCheck` fails naming that code; a family-matching allowlist would have accepted it and stayed green.
10. Mutation B (documentation drift): delete one `board` documentation row in a temporary copy and assert `error-table-sync` fails naming the code.
11. Mutation C (the widening must land in the check too): copy the tree and `scripts/checks/error-table-sync.ts` into a temp root, remove the two board codes from that copy's allowlist, import the copy from its temp path, and assert its `scanReferences` no longer recognizes them and its `runSyncCheck` reports the documented board rows as unrecognized references — so updating only the structural mirror is red.
12. Mutation D (family widening is what the set assertion forbids): in the same temp-copy form, replace the copy's set-membership test with a `board.` prefix acceptance and assert its `scanReferences` now recognizes `board.other-thing` — the exact behaviour the production near-miss assertion rejects, which is why the exact-set assertion is the load-bearing control rather than a count alone.
13. Mutation E (a **non-mirror** count site left stale is caught): in a temporary copy, revert exactly one Appendix D site outside the structural mirror — case (i) the dispatch-taxonomy header comment back to `135`, case (ii) its test name back to `136`, case (iii) its length assertion back to `136`, case (iv) `verify-gates-suite-map-contract`'s `sourceEntries` back to `136`, case (v) the sync suite's `+104` arithmetic back to `+102`, case (vi) the carrier's allowlist paragraph back to `52` — and assert the corresponding assertion group from step 5 fails naming that file and site. This is the arm that proves the plan tests the 23-site list rather than only the mirror: any one file left stale is detected.
14. Mutation F (count drift inside the mirror): leave the mirror's allowlist at 53 or its entry pin at 136 and assert the mirror's own literal assertions fail (`55 ≠ 53`, `138 ≠ 136`, `137 ≠ 135`).

**Expected Outcome**:
- One kind, two rows, exactly two allowlist members at 55, **every Appendix D pin moved** (D-1..D-23 across the five files), a no-leftover scan with a small declared residual list, four-way agreement on 138 / 137 / 55 / 2 / 138, and near-miss codes rejected on every path (allowlist, scan, table lookup) — with a mutant proving a single stale non-mirror site is caught.

**Notes / Clarifications**:
- The `52 → 55` reconciliation is deliberate and is not an arithmetic slip: the carrier's 52-entry paragraph omits the delivered `verify.narrowed-scope` identity, so 53 delivered + 2 board = 55 (DEC-20). A case that asserted 54 would encode the existing undercount.
- The site list is **referenced** from spec Appendix D (D-1..D-23) rather than copied row-for-row: the spec is the single locator authority, and this plan pins the *assertion groups* (per file, per pin class) that make a stale site fail. Step 5's grouping and step 13's per-file mutants together cover all 23 ids; a site that no group covers would leave its group green, which is why the groups are asserted as units.
- Mutations C–F are what make the invariant testable rather than conventional: the check-side omission (C) proves the widening cannot live in only one file, the family widening (D) proves the near-miss assertion is what forbids breadth, the non-mirror stale site (E) proves the 23-site list is actually exercised beyond the mirror, and the mirror drift (F) proves the literal expectations are non-vacuous by construction.

#### TC-BOARD-060 - Two runs are byte-identical; order and identity are declared and permutation-proof

**Objective**: Prove determinism and that ordering is driven only by the declared keys, not by collector, provider, filesystem, or index return order.
**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F9-1, F-9, NFR-2, NFR-3
**Test Type(s)**: Integration, Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-determinism.test.ts` (extended) and `tests/golden/board-full.test.ts` (new)
**Tags**: @backend, @behaviour, @golden

**Preconditions**:
- A two-repository cap-sized fixture at a fixed clock, run id, and synthetic brand.
- Permutation harness: reorder the host-index entries, reverse collector resolution, reverse park order, and reverse directory-read order.

**Steps**:
1. Run `board` and `board --json` twice each; assert byte-identical stdout in each mode (envelope timing and run id pinned by injection).
2. Assert `repositories` ascends, `lanes`/`parked` order by repository then ref, `gates` by repository then the delivered rank key, `asks` by repository then the delivered blocker rank key.
3. Assert every identity is unique within its array (lanes/parked by `(repository, ref)`, gates/asks by `(repository, id)`).
4. Run each permutation and assert identical bytes.
5. Assert the repository list is the deterministic retained set for its size (full set at two keys, ascending and unique) and that no cap omission appears.
6. Control: remove one row and assert the bytes differ (the comparer is content-sensitive).

**Expected Outcome**:
- Byte-identical repeats, declared order, unique identity, permutation independence, and a deterministic repository list.

#### TC-BOARD-061 - The only write is the idempotent decision record, plus the two delivered side effects

**Objective**: Prove the read-only claim with a tree snapshot and counters: no index maintenance, no prune, no edit or delete.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F9-2, F-9, NFR-6, DEC-6
**Test Type(s)**: Integration, Measured
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-write-discipline.test.ts` (new); uses `tests/fixtures/projects/host-root.ts` snapshots, `tests/behaviour/verify-support.ts` `guardStore`, and the host-index counters
**Tags**: @backend, @behaviour

**Preconditions**:
- Two-repository host with an existing host index and pre-existing store artifacts.
- `snapshotTree` before and after each run; index-access counters.

**Steps**:
1. Run a no-default board; assert the host root (index file and every artifact under `projects/`) is byte-and-mtime identical apart from the two permitted side effects (create-once marker outside the host root; removal of a leftover store `*.tmp` sibling), and the index counters show zero writes.
2. Run a board with one expired defaultable gate; assert exactly one changed artifact — that repository's decision ledger — with exactly one new record.
3. Assert no repository's ledger gained a record it should not have, and that the index revision did not advance.
4. Assert the store guard records no `replaceDocument`, no delete, and no prune path.
5. Mutation: enable index maintenance for the board in a temporary copy and assert the snapshot assertion fails naming the index file.

**Expected Outcome**:
- One declared write, two declared side effects, everything else untouched — proven by bytes, not by call counts alone.

#### TC-BOARD-062 - No LLM, no non-GET request, no timer or daemon, no product literal

**Objective**: Prove the board is a bounded pure projection: no model, no write request, no timer, and no hardcoded name.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F9-3, F-9, NFR-7
**Test Type(s)**: Integration, Structural
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-purity.test.ts` (new) and `tests/structure/branding-seam.test.ts` (extended scan)
**Tags**: @backend, @structure

**Preconditions**:
- Spawn recorder, transport recorder, and the forbidden-literal fixture set.

**Steps**:
1. Run a full `--all` board; assert zero spawns, zero session activity, and zero child processes.
2. Assert every recorded provider request is a GET (no method other than `GET`, no write path).
3. Assert the board modules contain no `setInterval`, `setTimeout`, `setImmediate`, or daemon composition, and that the run completes on an injected clock without advancing real time.
4. Assert the screen header carries the brand's binary name and that no working-name literal appears in the board modules (forbidden-literal scan, both true-positive and false-positive fixture sets).
5. Control: swap the synthetic brand and assert the header changes — proving the name is read from the seam.

**Expected Outcome**:
- Purity holds on every axis, with the brand seam demonstrably the only name source.

#### TC-BOARD-063 - The payload is extended additively and nothing delivered is renamed or re-semanted

**Objective**: Prove the `delivery.board.v1` identity and every delivered key survive, including the delivered lane payload and the status/brief payloads.
**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-1, AC-F4-1, AC-F9-1, F-2, F-4, F-9, DM-2, DM-9, §8.5, C-1
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/board-contract.test.ts` (additivity cells) and `tests/structure/board-nonregression.test.ts` (extended)
**Tags**: @backend, @structure

**Preconditions**:
- The delivered payload identities and the delivered key sets for board, status, brief, and lanes.

**Steps**:
1. Assert the board schema identity is unchanged and the delivered key set is a subset of the new one, with an empty removed/renamed set.
2. Assert every new board key is additive and every extended array keeps its delivered element identity; `omittedBySection` gains the `repositories` member without changing the four row members' meaning.
3. Assert `delivery.status.v1` and `delivery.brief.v1` keep their identities with exactly one added `data` key, and `delivery.lanes.v1` keeps its identity with only `leaseHolder` added.
4. Assert no state schema version, record kind, key prefix, or store layout changed, and that no migration or seeding occurs.
5. Assert the delivered board corpus still passes, updated only for the declared additive fields.

**Expected Outcome**:
- Additive in both directions; no delivered consumer breaks.

#### TC-BOARD-064 - The repository list is capped at 128 with a deterministic retained set and counted overflow

**Objective**: Turn the old contradiction into a bounded, deterministic, counted rule: at most 128 included repositories, the selected repository always present, the overflow stated — and the unlisted repositories not read.
**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F9-4, AC-F3-4, F-3, F-9, DM-7, DM-11, NFR-4, NFR-5, DEC-13, C-6, RSK-9
**Test Type(s)**: Integration, Measured
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-repository-cap.test.ts` (new) over the real production composition with a seeded host index; constant half in `tests/structure/board-contract.test.ts`
**Tags**: @backend, @behaviour

**Preconditions**:
- A seeded host index of 129 live checkouts (roots exist), keys sortable and padded so the ascending order is unambiguous.
- Cell (a): invoking checkout whose key sorts inside the first 128.
- Cell (b): invoking checkout whose key sorts **last** (the 129th) — the negative-control world.
- Cell (c): `--all` from a non-checkout directory with the same index (unbound invocation).
- Cell (d): `--project` targeting the 129th key.
- Read counters per seeded repository store.

**Steps**:
1. Assert the declared constant is exactly `128` and is distinct from the host index's 2 000-record bound (two separate declarations, two separate values).
2. Cell (a): assert `repositories` has 128 entries, ascending and unique, the invoking key present, `omittedBySection.repositories === 1`, `truncated === true`, and `omitted` equal to the sum of all five section counters.
3. Cell (b): assert 128 entries with the invoking key present, the first 127 ascending keys retained plus the invoking key re-sorted into place, and `omittedBySection.repositories === 1`; assert the retained set **differs** from cell (a)'s (the invoking-key rule is not "first 128 always").
4. Cell (c): assert the first 128 ascending keys are retained (no invoking key to add), `omittedBySection.repositories === 1`, and `scope: "repository"` — an unbound invocation is not an unbound board.
5. Cell (d): assert `repositories` is exactly the single requested key (beyond-cap keys are reachable), `selection: "project"`, and no omission.
6. Assert the unretained repositories' stores were never opened (read counters zero) and that only the retained set contributed rows and `collectors[]` evidence.
7. At-cap control: a 128-entry world yields 128 keys, `omittedBySection.repositories === 0`, and `truncated === false`.
8. Overflow arithmetic: a 200-entry world yields 128 retained keys and `omittedBySection.repositories === 72`.

**Expected Outcome**:
- The cap, the retained-set rule, the selected-key guarantee, the counted overflow, and the read bound all hold — and an exactly-at-cap world reports no omission.

**Notes / Clarifications**:
- This case owns the cap and the beyond-cap `--project` cell so `TC-BOARD-014` stays focused on narrowing and grammar. `TC-BOARD-084` proves the retained-set rule is load-bearing by mutation.

#### TC-BOARD-065 - The byte guard drops rows in the declared order and never the repository list or collector evidence

**Objective**: Prove the payload cap is enforced by a declared order rather than an arbitrary one, and that the two structures a reader needs to interpret the board are never sacrificed to fit it.
**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F9-4, AC-F4-3, F-9, DM-11, NFR-3, NFR-4, DEC-13, C-6
**Test Type(s)**: Integration, Measured
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-byte-guard.test.ts` (new); fixtures in `tests/fixtures/board/byte-guard/`
**Tags**: @backend, @behaviour

**Preconditions**:
- Fixture 1 (at the cap): a two-repository board whose serialized `data` is just under 65 536 bytes, with all four sections populated and long-but-legal field values (160-character refs/questions, 120-character owners).
- Fixture 2 (all four sections over-full): the same shape scaled so every section must lose rows.
- Fixture 3 (rows fit): a smaller payload where the guard must not fire at all.
- Fixture 4 (worst case): maximal repository list at 128 keys plus maximal row sections.

**Steps**:
1. Assert the serialized `data` is ≤ 65 536 UTF-8 bytes in every fixture after the guard runs.
2. Assert the order invariant: for the ordered list `[parked, asks, lanes, gates]`, if a later section lost any row then every earlier section lost **all** of its rows; and within one section the surviving rows are the declared-order prefix (tail-first dropping).
3. Assert each drop increments `omitted` and that section's `omittedBySection` counter, and that `truncated` is `true`.
4. Assert `repositories[]` and `collectors[]` are identical to the pre-guard projection in every fixture, including fixture 4 — they are never dropped.
5. Assert fixture 3 drops nothing (`truncated === false`, all counters `0`), so the guard is not permanently firing.
6. Print per-section drop counts and the final byte size into the test output for diagnosis.

**Expected Outcome**:
- The cap holds, the drop order is exactly `parked` → `asks` → `lanes` → `gates` (tail first), every drop is counted, and the repository list and collector evidence survive.

#### TC-BOARD-070 - The declared read set, one index read, no pagination or retry, and the 128-repository bound

**Objective**: Prove the fleet read is bounded and predictable, and that the repository bound is the board's own 128-repository cap rather than the 2 000-record host-index bound.
**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR5-1, AC-F5-3, F-3, NFR-5, DEC-13
**Test Type(s)**: Integration, Measured
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-read-cost.test.ts` (extended for the multi-repository read set)
**Tags**: @backend, @behaviour, @perf

**Preconditions**:
- Two-repository `--all` fixture with counting wrappers on every delivered read seam; active lanes at the cap; one failing read to test retry absence.
- A seeded host index at a practical size (64 entries) whose roots exist, and one 200-entry index for the bound cell.

**Steps**:
1. Per repository, assert exactly: 1 tracker page of ≤ 100 items, 1 delivery-request page of ≤ 100, 1 CI page of ≤ 20, 1 blocker ledger read, 1 queue-ledger read, 1 park read, 1 local-context read, 1 spend read, ≤ 1 phase read per active lane (≤ 20), ≤ 1 decision-history read.
2. Assert the decision-history read is **one per repository** even when an ask joins to it — the join adds no second read (`AC-F5-3`'s read-cost clause).
3. Assert exactly one host-index read for `--all` and for `--project`, and zero for the default form.
4. Assert no pagination (no second page request on a full page) and no retry (the failing read is attempted once and fails closed).
5. Assert one tracker-client construction per included repository over the shared transport.
6. Assert the repository bound is the declared `BOARD_MAX_REPOSITORIES` (128), not the host index's 2 000-record bound: the two constants differ, and the 200-entry index run performs read sets for at most 128 repositories.

**Expected Outcome**:
- The declared read set holds per repository, the index is read once, the ask join adds no read, and the operative bound is the 128-repository cap.

#### TC-BOARD-071 - The pure projection and render of a cap-sized two-repository board fit 50 ms median

**Objective**: Prove the budget on the real cap-sized board rather than on an empty one.
**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-NFR5-1, F-9, NFR-8
**Test Type(s)**: Performance, Measured
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-performance.test.ts` (extended)
**Tags**: @backend, @perf

**Preconditions**:
- A cap-sized two-repository fixture (8 gates, 20 lanes, 8 asks, 8 parks per repository); I/O excluded (pure projection + render).

**Steps**:
1. Warm up, then measure five iterations of projection + render on the injected clock.
2. Assert the median is ≤ 50 ms and print every sample, the fixture's section sizes, and the runtime.
3. Assert the measured path touches no store, transport, or spawn seam.

**Expected Outcome**:
- The budget holds and the measurement is diagnosable when it does not.

#### TC-BOARD-072 - The aggregate quality gate is green before the PR opens

**Objective**: Record the single aggregate gate as the change's completion evidence.
**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR9-1, NFR-9, NFR-10, C-8
**Test Type(s)**: Manual (execution record)
**Automation Level**: Semi-automated
**Target Layer / Location**: repository root; evidence recorded in §10 and `chg-GH-297-pm-notes.yaml` `notes:`
**Tags**: @gate

**Preconditions**:
- `tmp/tmpdir` present (git-ignored, repo-local).

**Steps**:
1. Run `TMPDIR=$PWD/tmp/tmpdir pnpm check` at the delivered HEAD and record the exit code.
2. Run `git diff --check` and record the result.
3. Record the phase-9 range lint gate verdict (`./scripts/lint-commit-range.sh --base` with the delivery base) as a PM-owned entry; it is not re-implemented here.
4. Record all three in §10 with the command line and a one-line result summary.

**Expected Outcome**:
- One recorded aggregate run at the pushed HEAD; no partial or narrowed battery is recorded as green.

**Notes / Clarifications**:
- `NFR-10` (commit hygiene) has no AC and is verified by the range lint gate and CI `ts-commitlint`; it is recorded here rather than asserted by a permanent suite.

#### TC-BOARD-080 - False all-clear control matrix: every degraded cell withholds; its readable twin renders

**Objective**: Prove the withhold rule across every source, and prove the assertion can fail — the exact inversion of a board that renders a reassuring empty screen.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-3, AC-F8-2, F-8, NFR-4, RSK-1
**Test Type(s)**: Integration, Negative
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-never-silence.test.ts` (extended into a closed matrix)
**Tags**: @backend, @behaviour

**Preconditions**:
- A closed case list, one entry per degradable source: tracker collector, lanes collector, blocker ledger, park store, gate source, repository state location, host index.

**Steps**:
1. For each entry, assert the run withholds with its declared identity and exit, and renders no section label, no `data`, and no zero-row section.
2. For each entry, run the readable twin and assert exit `0` with at least one row in the affected section — the fixture can produce a board.
3. Assert a legitimately empty *available* repository renders four empty sections at exit `0` — "empty because nothing exists" must remain distinguishable from "empty because the read failed".
4. Assert matrix completeness: every listed source appears exactly once and the case count equals the list length.

**Expected Outcome**:
- Zero cells where a failure yields a zero-row section, a `truncated: false` board with no rows, or exit `0`; every cell paired with a positive twin.

#### TC-BOARD-081 - Fabricated-value control matrix: age, default, `until`, holder, phase, and owner are never invented

**Objective**: Prove no field is filled by a plausible fallback, using baits where a fallback would look right.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-1, AC-F5-2, AC-F6-1, AC-F1-1, DM-4, DM-5, DM-6, DM-10, RSK-8
**Test Type(s)**: Integration, Negative
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-provenance.test.ts` (new)
**Tags**: @backend, @behaviour

**Preconditions**:
- Seven bait cells, each with a positive twin where the value *is* recorded:
  - age: gate with unparseable activity; ask whose record carries a stale `age`.
  - default: `owner-review` gate on the ask's ref (never defaultable).
  - `until`: owner-hold park whose record carries `createdAt`/`releasedAt`.
  - holder: lane with no lease whose branch name contains a username.
  - phase: lane with no phase record whose lane id encodes a phase-like token.
  - owner: rows whose audience token or lease is unrecorded.
  - repository: a cap-truncated run whose omitted key must never appear as a row owner or repository value.

**Steps**:
1. For each bait, assert the field is `null` (or its classified value) and that the tempting fallback value does not appear anywhere in the row or the screen.
2. For each positive twin, assert the recorded value does appear — the same assertion can pass and fail on the same field.
3. Assert `default` is never derived for a never-merge kind, and `until` is never synthesized from a neighboring timestamp.
4. Assert `owner` is never sourced from the git user, branch name, lane id, or audience token of a different family; `phase` is never derived from a lane id or branch name.
5. Assert the classified phase tokens are the only null reasons rendered (no third token, no bare `null` without a reason).

**Expected Outcome**:
- Seven nulls, seven recorded twins, and zero invented values.

#### TC-BOARD-082 - Silent-omission control: an uncounted drop fails, and `truncated` is set exactly when a drop occurs

**Objective**: Prove omission accounting is arithmetic, not decoration — for per-section caps and for the repository list.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F4-3, F-9, NFR-4, DM-11, RSK-1
**Test Type(s)**: Integration, Mutation
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-bounds.test.ts` (omission arithmetic cells)
**Tags**: @backend, @behaviour

**Preconditions**:
- A fixture where one section drops rows and another does not, so both `truncated` states are exercised in one run.
- A 129-repository fixture where the repository counter drops exactly one key.

**Steps**:
1. Assert `omitted` equals `sum(omittedBySection)` across all five counters and each section's human `+N more` equals its machine count.
2. Assert `truncated` is `true` exactly when at least one counter (row or repository) is greater than zero.
3. Assert a section that dropped nothing reports `0` and carries no marker, and that the repository counter is `0` when no key was dropped.
4. Mutation: in a temporary copy, drop one row without incrementing its section count and assert the case fails identifying the section and the missing count; repeat by dropping a repository key without incrementing the repository counter.

**Expected Outcome**:
- Every drop is counted — row or repository — the flag tracks the counters, and an uncounted drop is detected.

#### TC-BOARD-083 - Duplicate-row and state-mixing control: identities survive a collision matrix

**Objective**: Prove row identity is `(repository, …)`, not the section's own id, so a shared ref cannot make two repositories' work collapse into one row.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-2, AC-F9-1, F-3, F-9, NFR-3, SC-M2-S4-02
**Test Type(s)**: Integration, Mutation
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-identity.test.ts` (new)
**Tags**: @backend, @behaviour

**Preconditions**:
- A matrix of four cells over real checkouts: one repository; two repositories holding different refs; two repositories holding one ref; three repositories where two share a ref.

**Steps**:
1. For each cell, assert the exact identity set per section and that no identity repeats.
2. Assert the same-ref cells yield one row per repository with identical section ids and distinct `repository` values.
3. Assert each `--all` section count equals the sum of the per-repository boards for that cell, measured **before** any byte-guard drop (the fixtures are small enough that no guard fires; assert `truncated === false`).
4. Mutation: in a temporary copy, key one section's identity by id alone and assert the case fails naming the duplicate.

**Expected Outcome**:
- Four cells, exact identity sets, sum equality before any guard, and a mutation that proves the identity rule is load-bearing.

#### TC-BOARD-084 - Repository-cap overflow control: a 129-repository world with the invoking key last

**Objective**: Prove the retained-set rule is load-bearing, that the overflow is counted rather than hidden, and that the two-repository seed still passes under the cap.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F9-4, AC-F3-1, NFR-4, NFR-5, DEC-13, RSK-9, SC-M2-S4-02
**Test Type(s)**: Integration, Mutation
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-repository-cap.test.ts` (control cells) + `tests/behaviour/board-identity.test.ts` (seed control)
**Tags**: @backend, @behaviour

**Preconditions**:
- The 129-entry seeded index from `TC-BOARD-064`, including the invoking-key-last cell.
- Three temporary-copy mutants of the retained-set rule: (M1) "first 128 ascending" with no invoking-key retention; (M2) no cap at all; (M3) cap applied but the overflow not counted and `truncated` not set.

**Steps**:
1. Seed control (`SC-M2-S4-02` under the cap): a two-repository world yields two keys, `omittedBySection.repositories === 0`, `truncated === false`, and both keys retained — the seed passes under the cap, so the cap cannot be implemented as "always drop something".
2. Mutant M1: assert `TC-BOARD-064` cell (b) fails because the invoking key is absent, and assert the retained set equals the naive first 128 (proving the two sets differ in the unmutated run).
3. Mutant M2: assert the length assertion fails (129 keys), `omittedBySection.repositories` stays `0`, and the serialized `data` exceeds 65 536 in the worst-case fixture — so an unbounded list breaks the delivered cap.
4. Mutant M3: assert the `truncated`/counter assertions fail while the length assertion still passes — a cap without accounting is caught even though the list looks right.
5. Restore and assert the unmutated run passes every step of `TC-BOARD-064`.

**Expected Outcome**:
- The unmutated rule keeps the invoking checkout, counts the overflow, and sets `truncated`; each mutant fails on a different assertion, so no single assertion is carrying the case.

#### TC-BOARD-085 - Byte-guard order control: dropping `gates` before `parked`, or from `repositories[]`, is detected

**Objective**: Prove the declared drop order is load-bearing and that the never-drop guarantees are enforced, not incidental.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F9-4, AC-F4-3, NFR-4, DEC-13
**Test Type(s)**: Integration, Mutation
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-byte-guard.test.ts` (control cells)
**Tags**: @backend, @behaviour

**Preconditions**:
- The all-four-sections-over-full fixture from `TC-BOARD-065`.
- Three temporary-copy mutants of the guard: (M1) reversed order `gates` → `lanes` → `asks` → `parked`; (M2) drop from `repositories[]` (and `collectors[]`) to fit instead of from rows; (M3) drop rows head-first within a section instead of tail-first.

**Steps**:
1. Mutant M1: assert the order invariant fails naming the sections, and assert the run still fits the byte cap — so the failure is about order, not size.
2. Mutant M2: assert the never-dropped assertion fails (repository-list length or collector count changes), proving the guard cannot achieve the cap by shrinking the fleet list.
3. Mutant M3: assert the prefix assertion fails (a kept row is out of declared order), proving tail-first is asserted and not merely described.
4. Restore and assert the unmutated run passes every step of `TC-BOARD-065`.

**Expected Outcome**:
- Order, direction, and the never-drop guarantees are each individually proven by a failing mutant.

## 6. Environments and Test Data

- **Environments.** One hermetic local environment: `bun test` over per-test temporary roots. No staging, no external system. Every dependency is an in-process injected port, except the real git checkouts the identity cases require (`git init` under `mkdtemp` in the repo-local temp base) and the seeded host-index rows the cap cases require.
- **State isolation.** Host roots and homes are created under the approved temp base (`createHostFixture`), never `$HOME` and never the live tree; the delivered fixture guard rejects the live workspace and the real home-derived state directory before anything is written.
- **Clock and identifiers.** Injected clock, run id, and fence tokens throughout; no wall-clock reads and no real sleeps. Ages, thresholds, and boundaries are computed from the fixture clock so a case states only its delta.
- **Fixtures.** Live under `tests/fixtures/**` and are never named `*.test.ts`. New or extended: `tests/fixtures/board/harness.ts` (four-section runtime seams), `tests/fixtures/board/sections.ts` (lane/ask/park/ownerHold builders), `tests/fixtures/board/selection.ts` (managed-set fixtures), `tests/fixtures/board/repository-cap.ts` (129- and 200-entry seeded index rows with padded sortable keys), `tests/fixtures/board/byte-guard/{at-cap,over-full,fits,worst-case}.ts` (payloads sized against the 65 536-byte cap), `tests/fixtures/board/corpus/**` (one directory per boundary class, `case.json` with `expect`), and extensions to `tests/fixtures/projects/{production,state-scope,host-index,temp-repos,host-root}.ts` for the multi-repository and cap cells.
- **Reused delivered fixtures.** `tests/fixtures/status/harness.ts` (`baseFacts`, `capSizedFacts`), `tests/fixtures/brief/{cases,harness}.ts`, `tests/fixtures/queue/{lanes,schedule,parks}/**`, `tests/fixtures/blockers/{harness,ranking}.ts`, `tests/fixtures/state/harness.ts`, `tests/fixtures/entrypoint/programs.ts`, `tests/golden/helpers.ts`, `tests/behaviour/verify-support.ts`.
- **Seeded-index discipline.** The cap fixtures seed index rows and create the referenced directories only; they never run a store-opening command per repository, so a 129-repository world costs milliseconds. The invoking checkout in those cases is a real checkout, so the retained-set rule is exercised against a real key.
- **Goldens.** Committed artifacts for the four-section screen (`tests/fixtures/board/golden/full-envelope.json`, `full-grid.txt`), the status digest (`tests/fixtures/status/golden/digest.json`), the brief envelope (`tests/fixtures/brief/golden/envelope.json`), and the lane payload (`tests/fixtures/queue/golden/lanes-list.json`). Each has a `regenerate.ts` beside it; regeneration is explicit and its diff must show only the declared delta. The lane **human** golden must not change.
- **Determinism data.** Permutation fixtures are derived from one canonical fixture by reversing index entries, collector resolution, park order, and directory-read order, so byte equality is the only assertion.
- **Isolation and cleanliness.** Every suite constructs its own store, host root, and checkouts and disposes them in `finally`; no cross-suite shared state; mutation copies are temp-tree copies, never in-place edits of the live tree.
- **Aggregate gate.** `TMPDIR=$PWD/tmp/tmpdir pnpm check` with `tmp/tmpdir` present (the repo-local TMPDIR lesson); narrow suites (`bun test tests/behaviour/board-*.test.ts`) while iterating.

## 7. Automation Plan and Implementation Mapping

Every case is automated under `bun test` except `TC-BOARD-072`, which is an execution record. All new suites are **To Implement**; rows marked **Existing – Update** extend delivered suites or goldens in place. Delivery owns exact module paths and seam shapes (`AMB-TP-2`); the files below follow repo convention, and a case that cannot resolve its seam **fails naming the missing contract** rather than skipping. Aggregate verification: `TMPDIR=$PWD/tmp/tmpdir pnpm check`.

| TC ID | Suite / file | Command | Injection / fixture requirements | Status |
|---|---|---|---|---|
| TC-BOARD-001 | `tests/behaviour/board-sections.test.ts` | `bun test tests/behaviour/board-sections.test.ts` | Four-section harness; per-section empty cells; injected clock/run id/brand | To Implement |
| TC-BOARD-002 | `tests/behaviour/board-rows.test.ts` + `tests/structure/board-contract.test.ts` | `bun test tests/behaviour/board-rows.test.ts tests/structure/board-contract.test.ts` | One row per family; `ownerSource` closed-set constant; bare-null ask row | To Implement |
| TC-BOARD-003 | `tests/behaviour/board-shared-source.test.ts` (extends status/brief contract suites) | `bun test tests/behaviour/board-shared-source.test.ts tests/structure/status-contract.test.ts tests/structure/brief-contract.test.ts` | Shared fact bundle for three in-process commands; status/brief goldens | To Implement + Existing – Update (goldens) |
| TC-BOARD-004 | `tests/behaviour/board-collectors.test.ts` + `tests/structure/board-contract.test.ts` | `bun test tests/behaviour/board-collectors.test.ts` | Two included repositories; collector-id closed set; source scan | Existing – Update + To Implement |
| TC-BOARD-005 | `tests/behaviour/board-never-silence.test.ts` + `board-sections.test.ts` | `bun test tests/behaviour/board-never-silence.test.ts` | Degraded ledger/park/gate variants with readable twins | Existing – Update |
| TC-BOARD-006 | `tests/behaviour/board-lanes.test.ts` + `tests/golden/lanes-list.test.ts` | `bun test tests/behaviour/board-lanes.test.ts tests/golden/lanes-list.test.ts` | Lane fold in all six states; lease fixture; five phase cells; lane goldens (machine regenerated, human unchanged) | To Implement + Existing – Update (golden) |
| TC-BOARD-007 | `tests/behaviour/board-output.test.ts` | `bun test tests/behaviour/board-output.test.ts` | Adversarial content fixture; secrets canary; TTY and buffer sinks | Existing – Update |
| TC-BOARD-010 | `tests/behaviour/board-selection-default.test.ts` | `bun test tests/behaviour/board-selection-default.test.ts` | Real two-checkout host; production composition; index-access counters | To Implement |
| TC-BOARD-011 | `tests/behaviour/board-selection-all.test.ts` | `bun test tests/behaviour/board-selection-all.test.ts` | Two real checkouts; index records; per-repository boards for the sum; cap-clean cell | To Implement |
| TC-BOARD-012 | `tests/behaviour/board-selection-all.test.ts` (collision cells) | `bun test … --filter same-ref` | Same-ref A/B fixture with identical gate and question ids | To Implement |
| TC-BOARD-013 | `tests/behaviour/board-selection-project.test.ts` | `bun test … --filter unknown-key` | Unmanaged key; group configuration on the host; read counters | To Implement |
| TC-BOARD-014 | `tests/behaviour/board-selection-project.test.ts` (narrowing + refusal cells) | `bun test … --filter project-scope` | Two managed checkouts; counters on both stores; valueless `--project` cell | To Implement |
| TC-BOARD-015 | `tests/behaviour/board-selection-unbound.test.ts` | `bun test tests/behaviour/board-selection-unbound.test.ts` | Non-checkout directory; underivable-identity checkout; warning capture; `--all`/`--project` scope cells | To Implement |
| TC-BOARD-016 | `tests/behaviour/board-selection-all.test.ts` (edge cells) | `bun test … --filter managed-set` | Absent / sparse-dead / unreadable / unparseable index fixtures | To Implement |
| TC-BOARD-020 | `tests/behaviour/board-gates-sla.test.ts` | `bun test tests/behaviour/board-gates-sla.test.ts` | Boundary-age matrix; waiver authorizer; ranking fixture | To Implement |
| TC-BOARD-021 | `tests/behaviour/board-defaults-idempotency.test.ts` | `bun test tests/behaviour/board-defaults-idempotency.test.ts` | Two-repository ledgers; pre-seeded record; replay cell; fence recorder | To Implement |
| TC-BOARD-022 | `tests/structure/board-contract.test.ts` (extends `owner-gate-sla-contract`) | `bun test tests/structure/board-contract.test.ts` | Delivered vs extended gate key sets; delivered-shape validator | To Implement + Existing – Update |
| TC-BOARD-023 | `tests/behaviour/board-collectors.test.ts` | `bun test … --filter collector-unavailable` | Failing collectors for both ids and all reasons | Existing – Update |
| TC-BOARD-024 | `tests/behaviour/board-bounds.test.ts` | `bun test tests/behaviour/board-bounds.test.ts` | At-cap and over-cap two-repository fixtures; over-cap field values | Existing – Update |
| TC-BOARD-025 | `tests/behaviour/board-bounds.test.ts` (human allocation cells) | `bun test … --filter human-allocation` | 7/7/5/4 fixture and 2/2/1/1 control | Existing – Update |
| TC-BOARD-030 | `tests/behaviour/board-asks.test.ts` | `bun test tests/behaviour/board-asks.test.ts` | Owner question 26 h old; pre-expiry defaultable gate; bogus stored age | To Implement |
| TC-BOARD-031 | `tests/behaviour/board-asks.test.ts` (same-run cells) | `bun test … --filter same-run-applied` | Pre-seeded record; same-run append; replay; decision-history read recorder | To Implement |
| TC-BOARD-032 | `tests/behaviour/board-asks.test.ts` (`none` and exclusion cells) | `bun test … --filter none-coordinator` | Undefaultable ref; ref-less question; answered question; coordinator bait; 12-question cap fixture | To Implement |
| TC-BOARD-033 | `tests/behaviour/board-parked.test.ts` | `bun test tests/behaviour/board-parked.test.ts` | Peak, owner-hold and `provider-quota` parks; duplicate ref; closed episode; PM-context entries; provider-surface control read | To Implement |
| TC-BOARD-034 | `tests/behaviour/board-parked.test.ts` (owner-hold cells) | `bun test … --filter owner-hold` | No hold / env hold / marker hold with an over-long reason and a secret canary | To Implement |
| TC-BOARD-040 | `tests/structure/board-mounting.test.ts` (extends entrypoint/daemon/events composition suites) | `bun test tests/structure/board-mounting.test.ts tests/behaviour/entrypoint-help.test.ts` | Prompt-required constant; production composer over a temp host; root help capture | To Implement + Existing – Update (20 → 21 assertions) |
| TC-BOARD-041 | `tests/behaviour/board-help.test.ts` | `bun test tests/behaviour/board-help.test.ts` | Empty environment; counters on store/transport/spawn | To Implement |
| TC-BOARD-042 | `tests/checks/help-guide-coverage.test.ts`, `tests/checks/reference-page-parity.test.ts` | `bun test tests/checks/help-guide-coverage.test.ts tests/checks/reference-page-parity.test.ts` | M2 board page; coverage inventory; temp-copy mutation | Existing – Update |
| TC-BOARD-043 | `tests/structure/board-mounting.test.ts` (isolation) + `tests/structure/entrypoint-bin.test.ts` | `bun test tests/structure/board-mounting.test.ts tests/structure/entrypoint-bin.test.ts` | Help inventory delta; temp-copy prompt-set mutation | Existing – Update + To Implement |
| TC-BOARD-050 | `tests/behaviour/board-envelope.test.ts` | `bun test tests/behaviour/board-envelope.test.ts` | One fixture per §8.3 row; `assertEnvelopeContract` | To Implement |
| TC-BOARD-051 | `tests/behaviour/board-command.test.ts` | `bun test tests/behaviour/board-command.test.ts` | Grammar violations incl. valueless `--project`; zero-read counters | Existing – Update |
| TC-BOARD-052 | `tests/behaviour/board-errors.test.ts` | `bun test tests/behaviour/board-errors.test.ts` | Degraded repository cells with a healthy twin; unreadable modes | To Implement |
| TC-BOARD-053 | `tests/structure/error-table.test.ts`, `tests/structure/dispatch-attempts-taxonomy.test.ts`, `tests/structure/verify-gates-suite-map-contract.test.ts`, `tests/checks/error-table-sync.test.ts` | `bun test tests/structure/error-table.test.ts tests/structure/dispatch-attempts-taxonomy.test.ts tests/structure/verify-gates-suite-map-contract.test.ts tests/checks/error-table-sync.test.ts` | New rows; allowlist exact set (55) in both files; **all 23 Appendix D pins (D-1..D-23)** moved and asserted per file group; repo-wide no-leftover scan for 136/135/53/52 with a named residual list; four-way agreement 138/137/55/2/138; carrier 138 + paragraph 55; near-miss probes; six temp-copy mutation arms (corpus near miss, deleted doc row, check-side omission, family widening, stale non-mirror site per file, mirror drift) | Existing – Update |
| TC-BOARD-060 | `tests/behaviour/board-determinism.test.ts` + `tests/golden/board-full.test.ts` | `bun test tests/behaviour/board-determinism.test.ts tests/golden/board-full.test.ts` | Two-repository cap-sized fixture; permutation harness; committed golden | Existing – Update + To Implement |
| TC-BOARD-061 | `tests/behaviour/board-write-discipline.test.ts` | `bun test tests/behaviour/board-write-discipline.test.ts` | `snapshotTree`/`snapshotDifferences`; host-index counters; `guardStore`; temp-copy mutation | To Implement |
| TC-BOARD-062 | `tests/behaviour/board-purity.test.ts` + `tests/structure/branding-seam.test.ts` | `bun test tests/behaviour/board-purity.test.ts tests/structure/branding-seam.test.ts` | Spawn/transport recorders; forbidden-literal sets; brand swap | To Implement + Existing – Update |
| TC-BOARD-063 | `tests/structure/board-contract.test.ts` + `tests/structure/board-nonregression.test.ts` | `bun test tests/structure/board-contract.test.ts tests/structure/board-nonregression.test.ts` | Delivered key sets for board/status/brief/lanes; board corpus | To Implement + Existing – Update |
| TC-BOARD-064 | `tests/behaviour/board-repository-cap.test.ts` + `tests/structure/board-contract.test.ts` (constant) | `bun test tests/behaviour/board-repository-cap.test.ts` | 129-entry and 200-entry seeded index; invoking-key-last cell; unbound `--all`; beyond-cap `--project`; per-store read counters | To Implement |
| TC-BOARD-065 | `tests/behaviour/board-byte-guard.test.ts` | `bun test tests/behaviour/board-byte-guard.test.ts` | Four payload fixtures sized against 65 536 bytes; per-section drop counts | To Implement |
| TC-BOARD-070 | `tests/behaviour/board-read-cost.test.ts` | `bun test tests/behaviour/board-read-cost.test.ts` | Counting wrappers on every delivered read seam; 64- and 200-entry seeded indexes; failing-read cell | Existing – Update |
| TC-BOARD-071 | `tests/behaviour/board-performance.test.ts` | `bun test tests/behaviour/board-performance.test.ts` | Cap-sized two-repository fixture; warm-up + five samples; context printing | Existing – Update |
| TC-BOARD-072 | — (execution record) | `TMPDIR=$PWD/tmp/tmpdir pnpm check`; `git diff --check` | `tmp/tmpdir` present; result recorded in §10 and pm-notes | Manual (recorded) |
| TC-BOARD-080 | `tests/behaviour/board-never-silence.test.ts` (closed matrix) | `bun test … --filter degraded-matrix` | Seven degradable sources with twins; completeness check | Existing – Update |
| TC-BOARD-081 | `tests/behaviour/board-provenance.test.ts` | `bun test tests/behaviour/board-provenance.test.ts` | Seven bait cells with seven recorded twins | To Implement |
| TC-BOARD-082 | `tests/behaviour/board-bounds.test.ts` (omission arithmetic) | `bun test … --filter omission-arithmetic` | Mixed dropped/undropped sections; 129-repository counter cell; two temp-copy mutation arms | Existing – Update |
| TC-BOARD-083 | `tests/behaviour/board-identity.test.ts` | `bun test tests/behaviour/board-identity.test.ts` | Four-cell real-checkout matrix; pre-guard count comparison; temp-copy id-only keying mutation | To Implement |
| TC-BOARD-084 | `tests/behaviour/board-repository-cap.test.ts` (control cells) | `bun test … --filter cap-controls` | 129-entry index; three temp-copy cap mutants (M1/M2/M3); two-repository seed control | To Implement |
| TC-BOARD-085 | `tests/behaviour/board-byte-guard.test.ts` (control cells) | `bun test … --filter guard-controls` | Over-full fixture; three temp-copy guard mutants (M1/M2/M3) | To Implement |

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| Risk | Mitigation in this plan |
|---|---|
| **R-TP-1 — A green board hides a degraded source (RSK-1).** The single most damaging failure on this surface is an empty section that reads as "nothing to do". | Every degraded cell withholds at exit `2`, is paired with a readable twin, and is mutation-checked (`TC-BOARD-005`, `TC-BOARD-052`, `TC-BOARD-080`). The distinction between "empty because nothing exists" (exit `0`, four empty sections) and "empty because the read failed" is asserted explicitly. |
| **R-TP-2 — Multi-repository reads mix state (RSK-2, RSK-3).** Same-ref rows and same section ids are the exact conditions under which a row collapses. | Collision fixtures carry identical gate and question ids across repositories and distinct phases, holders, and states (`TC-BOARD-012`); the identity rule is proven load-bearing by mutation (`TC-BOARD-083`); `--all` counts are compared to two independently executed per-repository boards before any guard drop (`TC-BOARD-011`, `TC-BOARD-083`). |
| **R-TP-3 — The mount advertises a command that cannot answer (RSK-5).** | The mount is asserted as one unit: prompt-set membership and count, production composition without a test-supplied runtime, root help, family help, reference page, coverage row, and the unmounted mutant (`TC-BOARD-040`..`TC-BOARD-043`). |
| **R-TP-4 — The SLA is silently re-implemented (RSK-4, C-3).** A parallel evaluator would pass a "states look right" test and still fork policy. | The gate case asserts both sides of every inclusive boundary, the never-merge rule, the delivered ranking, and the cap (`TC-BOARD-020`), plus idempotent append scoped per repository (`TC-BOARD-021`) and strict key-set additivity (`TC-BOARD-022`, `TC-BOARD-063`). |
| **R-TP-5 — Provenance drift: a rendered value the engine never recorded (RSK-8).** | Seven bait cells with seven recorded twins (`TC-BOARD-081`), plus the closed `ownerSource`, phase-reason, and park-cause vocabularies (`TC-BOARD-002`, `TC-BOARD-006`, `TC-BOARD-033`). |
| **R-TP-6 — Timing and volume claims degrade into flaky or vacuous measurements.** | The 50 ms case prints every sample and asserts the fixture is cap-sized (`TC-BOARD-071`); read counts are asserted as counts, never wall-clock, where a count is available (`TC-BOARD-070`). |
| **R-TP-7 — Cap-induced blind spot (RSK-9).** An `--all` over more than 128 managed repositories lists only the retained set, so a reader could believe the fleet is smaller than it is. | The cap is asserted with its retained-set rule, the invoking-key guarantee, the counted overflow, `truncated`, and the unread-repository counter (`TC-BOARD-064`); three mutants prove the rule and the accounting are load-bearing (`TC-BOARD-084`); `--project` reaches a key beyond the cap (`TC-BOARD-064` cell d). |
| **R-TP-8 — The byte guard silently reshapes the board.** A guard that drops the wrong rows, or drops the repository list to fit, would keep `data` small while destroying the screen's meaning. | The declared order, the tail-first direction, the per-section counts, and the never-drop guarantees for `repositories[]`/`collectors[]` are asserted on four sized fixtures and by three mutants (`TC-BOARD-065`, `TC-BOARD-085`). |
| **R-TP-9 — Delivered goldens are regenerated broadly and hide a regression.** | Every golden has an explicit regeneration script; the diff must show only the declared delta, and the lane *human* golden must not change at all (`TC-BOARD-003`, `TC-BOARD-006`, `TC-BOARD-060`). |
| **R-TP-10 — The closed allowlist is widened by convenience, or one of the 23 count pins is left stale.** A two-segment identity that arrives by family matching instead of exact declaration turns the sync gate into a convention; a single stale pin — in the mirror, the dispatch-taxonomy suite, the verify-suite-map suite, the sync suite's `+102` arithmetic or its header/name prose, or the carrier — lets an undeclared row in or makes the prose contradict the table; updating only one file leaves the surfaces disagreeing in whichever direction is not exercised. | Exact-set assertions on both sides (55 members; `board.*` members exactly 2; 53 delivered members unchanged); **all 23 Appendix D sites asserted per file group**; a repo-wide no-leftover scan for 136/135/53/52 with a small named residual list; four-way agreement 138 / 137 / 55 / 2 / 138 read from one tree; and six mutants, including one that reverts a single non-mirror site (dispatch-taxonomy header/name/length, verify-map reads, sync `+104` arithmetic, or the carrier paragraph 52) — all in `TC-BOARD-053`. |

### 8.2 Assumptions

- The delivered GH-229 board baseline (mapping, SLA, policy map, decision record, ranking, bounds), the GH-237 lane/queue fold and park projection, the GH-230 typed-question ledger and views, the GH-288 state scope and host index, and the GH-309 naming boundary are stable and reusable as-is; this plan consumes them and adds only the optional `leaseHolder`, the two additive `data` keys, the `repositories` counter, and the cap.
- The in-process board harness, the production-composition harness over real checkouts, `guardStore`, the tree-snapshot helpers, and the help/error-table check harnesses are reusable without redesign; the four-section and cap seams are additions to those harnesses, not replacements.
- `git` is available to the identity, selection, and write-audit suites (spec §12 assumption). A missing `git` fails those suites loudly rather than skipping them.
- Seeding host-index rows plus the referenced directories is sufficient to exercise the 128-repository cap, the retained-set rule, and the read bound; the invoking checkout in those cases is a real checkout (spec §12: the index admits up to 2 000 records while a board includes at most 128).
- Only GitHub is exercised as a tracker; an unconfigured or uncredentialed tracker is the delivered collector-unavailable classification (`TC-BOARD-023`), never a fabricated empty fleet.
- Exact suite file names, seam shapes, and helper names are delivery-bound (`AMB-TP-2`); behaviours, identities, closed vocabularies, bounds, and AC traceability are not.
- `stateSource` is an identity token, not a payload schema id; adding it to brief and status is contract-legal and asserted as exactly one added `data` key (`TC-BOARD-003`, `TC-BOARD-063`).

### 8.3 Open Questions

**None.** All seven points raised at the v1.0 test-plan review are closed by spec v1.1 (§14, DEC-13..DEC-19); the DoR iteration-1 finding is closed by DEC-20 (§14, OQ-8); and the DoR iteration-2 findings are closed by spec v1.3 — OQ-9 (the partial count story) by the exhaustive Appendix D, and OQ-10 (the envelope-shape wording) by correction with no decision record added. Each now has a normative rule, an owning AC or contract row, and a case that asserts it: repository bounds → `TC-BOARD-064`/`065`/`084`/`085`; default-form criterion → `TC-BOARD-010`/`015`; phase-null totality → `TC-BOARD-006`; same-invocation `applied` ordering → `TC-BOARD-031`; grammar identity → `TC-BOARD-014`/`051`/`053`; `provider-quota` exclusion → `TC-BOARD-033`; ask bare `ref: null` → `TC-BOARD-002`/`032`; the two-segment allowlist widening and the 23-site Appendix D count enumeration, its no-leftover scan, and its four-way agreement → `TC-BOARD-053`. The two entries in §3.5 are test-methodology declarations (how a property is measured), not contract questions, and neither blocks delivery.

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|---------|---------|
| 1.0 | 2026-11-15 | @test-plan-writer | Initial test plan against spec v1.0. 25 ACs bound to 44 cases in nine blocks: sections and shared source 001–007, repository scope 010–016, delivered SLA 020–025, asks and parked 030–034, mounting 040–043, envelope/exits/errors 050–053, determinism/write/purity/additivity 060–063, read cost/responsiveness/gate 070–072, non-vacuity controls 080–083. Inherited `SC-M2-S4-01` (→ 001, 003) and `SC-M2-S4-02` (→ 011, 012, 083) by name with their mapping stated. Seven substitute assertions and one bounds contradiction registered in §3.5; seven open questions logged in §8.3; no TODO rows, no unmapped AC, no orphan case. |
| 1.1 | 2026-11-15 | @test-plan-writer | Realigned to spec v1.1 (DEC-13..DEC-19, §14 closed). Added `AC-F3-6` (mapped to `TC-BOARD-010` with `AC-NFR5-1` retained for the read-cost half, per Appendix B), `AC-F5-3` (mapped to `TC-BOARD-031` and `TC-BOARD-070`) and `AC-F9-4`. Added four cases: `TC-BOARD-064` (128-repository cap, retained set, counted overflow, beyond-cap `--project`), `TC-BOARD-065` (declared byte-guard order, tail first, never the repository list or collector evidence), `TC-BOARD-084` (cap-overflow mutant world with the invoking key last, plus the seed-as-cap-control) and `TC-BOARD-085` (byte-guard-order and never-drop mutants). Updated mappings for `AC-F3-1` (included-set counts, cap-clean cell), `AC-F3-4` (`repositories[]` exactly the key beyond the cap; `fallback.invocation`), `AC-F3-5` (underivable identity; `--all`/`--project` scope), `AC-F4-3` (per-section caps and byte-guard drops; repository cap delegated to `AC-F9-4`), `AC-F5-1`/`AC-F5-2` (post-append `applied`; bare `ref: null`), `AC-F6-1` (`provider-quota` produces no row), `AC-F9-1`, `NFR-3`/`NFR-4`/`NFR-5`. Retired `AMB-TP-3/4/6/7` and `OQ-TP-1..OQ-TP-7`; §3.5 now carries only two methodology declarations (`AMB-TP-1`, `AMB-TP-2`) and §8.3 records no open question. 28 ACs bound to 48 cases; §5.1, §5.2 and §7 id sets identical. |
| 1.2 | 2026-11-16 | @test-plan-writer | DoR iteration-1 F3 remediation, realigned to spec v1.2 (DEC-20, C-16, OQ-8 closed). Added `AC-F8-3` and extended `TC-BOARD-053` (same id; no new id, no orphan) to own the whole gate-critical unit: `RESERVED_TWO_SEGMENT_CODES` at exactly **55** in both `scripts/checks/error-table-sync.ts` and its structural mirror with exactly two `board.*` members and the 53 delivered members unchanged; the four table-length assertions at **138** plus a scan proving none is left at 136; **137** delivered rows in the spend-exclusion assertion and exactly **2** board rows; the carrier at **138** documented identities with the allowlist paragraph reconciled **52 → 55** and an enumeration that sums to it; two-segment near misses (`board.repository-unknowns`, `board.state`) rejected by the allowlist and by `scanReferences`, and three-segment lookalikes resolving to no row; five temp-copy mutation arms (planted near miss in a scanned corpus, deleted documentation row, check-side omission of the widening, family widening to a `board.` prefix, count drift across the table and the mirror). Updated §3.1 (29 ACs), §3.2 (DM-8 and a dedicated allowlist/counts row), §3.3 unchanged, §3.4 (DoD-14 binding), §4 (structure and mutation bullets), §5.1, §5.2, §7, §8.1 (new R-TP-10), §8.3 (OQ-8 recorded closed). Case count unchanged at 48; 29 ACs bound; §5.1, §5.2 and §7 id sets identical. |
| 1.3 | 2026-11-16 | @test-plan-writer | DoR iteration-2 remediation, realigned to spec v1.3 (Appendix D, OQ-9/OQ-10 closed). `TC-BOARD-053` now owns the **23 count-pinning sites of Appendix D (D-1..D-23)** instead of the "four structural assertions" shorthand: per-file assertion groups for `tests/structure/error-table.test.ts` (4 × 136 → 138, 53 → 55, 135 → 137, `"136 identities"` → `"138 identities"`), `tests/structure/dispatch-attempts-taxonomy.test.ts` (header comment 135 → 137, test name 136 → 138, length 136 → 138), `tests/structure/verify-gates-suite-map-contract.test.ts` (`sourceEntries`/`documentedRows` 136 → 138), `tests/checks/error-table-sync.test.ts` (`+102` → `+104` at the four arithmetic/message sites, header comment 136 → 138, test name 136 → 138, the two 136 reads, `"136 identities"`), and `doc/spec/features/feature-result-contract.md` (both 136 mentions, 52 → 55 allowlist paragraph). Added a repo-wide no-leftover scan for 136/135/53/52 across those five files with a small declared residual list, a four-way agreement assertion (classifier / sync check / structural mirror / carrier → 138 entries, 137 delivered rows, 55 allowlist codes, 2 board rows, 138 documented identities) read from one tree, and two further mutation arms: a **non-mirror** stale site reverted per file (dispatch-taxonomy header/name/length, verify-map reads, sync `+104` arithmetic, carrier paragraph 52) and mirror drift. Updated §1.1, §2 (spec v1.3, Appendix D), §3.1 (AC-F8-3 criterion text), §3.2 (allowlist/Appendix D row names all five files and their pin classes), §3.4 (DoD-14 binding), §4 (structure and mutation bullets), §5.1, §5.2, §7, §8.1 (R-TP-10 now covers 23 pins and the non-mirror mutant), §8.3 (§3.5 prelude too), §9, and the summary — which references Appendix D rather than duplicating it. Case count unchanged at 48; 29 ACs bound; §5.1, §5.2 and §7 id sets identical. |

## 10. Test Execution Log

No case has been executed against a new implementation at authoring time; this plan is a verification map. Results are recorded here as delivery proceeds.

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| — | — | — | No executions yet. |
| TC-BOARD-072 | — | Pending | `TMPDIR=$PWD/tmp/tmpdir pnpm check` and `git diff --check` are recorded here at the final delivery phase; the phase-9 range lint gate verdict is recorded by `@pm`. |
