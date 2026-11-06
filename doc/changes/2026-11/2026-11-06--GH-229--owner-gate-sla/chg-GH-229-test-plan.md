---
id: chg-GH-229-test-plan
status: Updated
created: 2026-11-06T10:00:00Z
last_updated: 2026-11-06T16:00:00Z
owners: [engineering]
service: delivery-os
labels: [m1, owner-gates, sla, board]
version_impact: minor
summary: "M1-S5 owner-gate SLA: prove that every owner gate ages truthfully from the provider-native activity timestamp (ADR-0004) into a 24 h escalation or a 72 h pre-agreed default, and that silence is impossible. The plan pins the closed two-kind policy map from PDR-0003 (owner-review = never-merge, non-defaultable, permanent visible escalation; waiver = defaultable with the single default owner-review-first, which reclassifies proceed posture, never authorizes a merge, and never populates waivedBy), the exactly-once append-only EVT-1 decision record in the state layer (idempotent by gate identity, torn history classified and never served as truth), the unknown-age representation (age null plus the declared activity-timestamp-absent / activity-timestamp-unparseable marker, never fresh, never zero, never defaulted), the never-silence collector contract (status.collector.<id>.unavailable, zero fabricated gates, exit 2, no silent all-clear), and the board v0 surface (render-once text grid plus one CommandResult envelope with gates[]; exit 0 rendered / 2 collectors unavailable; 8 rendered gates, 65 536-byte machine and 24-line/4 096-byte human bounds with every drop marked; byte-identical output; no --watch; injected clock and no background timer). It also pins the audience seam (owner | coordinator) as a testable contract, the pure-domain/no-I/O core, read-cost and 50 ms performance, the single new error-identity family, privacy and brand neutrality, and non-regression of status, queue ready, and verify gates. 30 named TCs cover all 12 acceptance criteria, all 7 NFRs, all 3 data-model elements, EVT-1, and all 6 spec risks."
links:
  change_spec: ./chg-GH-229-spec.md
  implementation_plan: ./chg-GH-229-plan.md
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - M1-S5: Owner-gate SLA — aging into escalation or a recorded default, never silence

## 1. Scope and Objectives

This change adds the first consequence to owner-gate age: a truthful SLA clock, a 24-hour escalation, a 72-hour pre-agreed default, and a `board` surface that makes every gate's posture visible. The tests must prove four things at once. **First, the clock never lies:** age derives only from a present, parseable provider-native activity timestamp against an injected clock; absent or unparseable evidence yields a declared unknown age (`age: null` plus `activity-timestamp-absent` or `activity-timestamp-unparseable`), never a fabricated age, never zero, and never `fresh` (DEC-1, DEC-6, DEC-8, ADR-0004/ADR-0006). **Second, the consequence is safe:** 24 h is visibility only; 72 h applies at most one pre-agreed default, only to a defaultable class, and never to a never-merge class; the only shipped default is `owner-review-first` on a `waiver` gate, which reclassifies proceed posture and never authorizes a merge and never synthesizes `waivedBy` (PDR-0003, DEC-10, AC-F5-1). **Third, every decision is auditable and exactly once:** default application appends one EVT-1 decision record to the state layer, readable later through a verified read, idempotent by gate identity, with a torn or malformed history classified rather than served as truth (DEC-3, NFR-7, §21). **Fourth, silence is structurally impossible:** collector unavailability is declared as `status.collector.<id>.unavailable` (`<id>` is the declared collector-id slot, not a template placeholder), fabricates no gates, and exits 2; no failure path may render an empty all-clear; gates with unknown age remain visible as `escalated`; truncation is explicit and ranked so an SLA-urgent gate is never hidden behind a fresh one (F-6, AC-F6-1, AC-F6-2, NFR-4).

The plan is deliberately adversarial about the two failure modes the ticket exists to prevent. The first is **silent idling**: a gate past 24 h or 72 h that is rendered `fresh`, omitted without a mark, or replaced by a zero-gate success. Every negative is paired with a restored control, and the never-silence matrix is meta-checked for completeness. The second is **unauthorized proceed**: a never-merge gate auto-proceeded, a default invented at runtime, a second record appended on re-evaluation, or expiry treated as waiver authority. AC-F5-1 is a permanent regression test (a tree invariant, never a branch-diff assertion), and the policy-map binding tests fail by name if the map is silently widened.

The plan also pins the seams that later stories depend on: the audience dimension (`owner` | `coordinator`) is a typed input, not an owner-specific code path (AC-F8-1); the SLA mechanism is pure over injected facts, with no wall clock, randomness, I/O, or ambient environment; and the new surfaces are additive, leaving `status`, `queue ready`, and `verify gates` behaviour unchanged.

### 1.1 In Scope

- SLA aging over the normalized open-work-item population carrying `hand-back` or `human-input-needed` (case-insensitive), reusing the delivered owner-gate definition; age from the optional provider-native activity timestamp; open items only; gate identity supplied by the collector (F-1, AC-F1-1, DEC-1, ADR-0004).
- Unknown age for both causes — timestamp absent (`missing`, `null`, empty/whitespace) and timestamp present but unparseable — with `age: null`, a distinct declared marker, `slaState: escalated`, visibility in both modes, and permanent exclusion from default application (F-1, F-6, AC-F1-2, DEC-6, DEC-8).
- 24 h escalation: boundary semantics declared in contract data, derived on every evaluation, sticky until resolve (label removed, item closed/canceled), visibility only, no state write (F-2, AC-F2-1, NFR-5).
- 72 h default-on-expiry: one default per defaultable kind/class, applied as a proceed decision, `slaState: default-applied` naming the default; no-default and never-merge kinds continue `escalated` (F-3, AC-F3-1, AC-F3-2, PDR-0003, DEC-10).
- Never-merge protection as a permanent regression: `owner-review` never auto-proceeds at any age; a recorded waiver with an authorized principal is the only override evidence; expiry alone is never authority; the default never synthesizes `waivedBy` (F-5, AC-F5-1, §21).
- The append-only EVT-1 decision record: declared payload fields (gate id, kind, ref, default, applied-at, threshold/clock evidence), additive record kind, no schema bump, durable verified read, append-only byte history, zero writes on a no-op evaluation (F-4, EVT-1, DM-2, DEC-3, NFR-7, §21).
- Idempotency by gate identity: exactly one record per application; re-evaluation is a no-op that honours the existing record; distinct gate identities are not over-suppressed; gate ids are deterministic across identical facts (F-4, AC-F4-1, NFR-7).
- State integrity: torn ledger, malformed decision payload, permission denial, and fence contention are classified with existing `state.*` identities; unverified history is never served as truth and never causes a duplicate or fabricated default; the applied default is fail-closed when history cannot be verified (EVT-1, DM-2, §21).
- Collector unavailability and partial failure: the declared `status.collector.<id>.unavailable` family, the affected collector id, zero fabricated gates, exit 2, no partial board that could read as a complete one, and a paired available-empty success control (F-6, AC-F6-1, DEC-7, NFR-6).
- The never-silence matrix: every gate past a threshold is `escalated` or `default-applied` on every evaluation, under every source condition, including unknown age and unknown kind (F-2, F-3, F-6, AC-F6-2).
- `board` v0 surface: command grammar (`board [--json]`, no positionals, no `--watch`), one success envelope with a declared `data` schema and `gates[]` records (id, kind, ref, age, slaState, default, waivedBy), a deterministic text aging grid, exit 0 rendered / 2 collectors unavailable / 1 invocation error, render-once with no timer (F-7, DM-1, AC-F7-1, DEC-9).
- Determinism: identical injected collector facts, clock, policy data, brand, and run id produce byte-identical machine and human output; fact-order permutations do not change the gate order; output is TTY-independent (F-7, AC-F7-2, NFR-1).
- Bounds and explicit truncation: 8 rendered gates, `data` ≤ 65 536 UTF-8 bytes, human ≤ 24 lines / 4 096 UTF-8 bytes, every dropped or clamped case marked, and SLA-urgent gates ranked ahead of fresh gates so truncation cannot hide an escalation (NFR-4, AC-F6-2).
- Error-identity stability: the collector-unavailable family is the only new documented identity; all other failures reuse existing table rows and the two fallback entries; the documented-table sync check stays green in both directions; no code is reused as a `failureClass` (NFR-6, §8.5).
- Privacy and brand neutrality: no credentials, raw provider payloads, titles, bodies, comments, or free-form text in the board payload, decision record, human grid, or diagnostics; the binary name comes from branding configuration and no product literal is committed (F-7, DM-1, DM-2, §20, §21).
- The audience seam: aging, threshold evaluation, and escalation state carry an explicit `owner` | `coordinator` audience; the mechanism contains no owner-specific label, surface, or routing assumption; a coordinator-audience consumer can be added without changing the SLA math or redesigning the engine (F-8, AC-F8-1, DEC-4).
- Pure domain core and tier discipline: evaluation over injected facts with no I/O, clock, randomness, environment, filesystem, network, or child processes; contracts data-only; domain imports only contracts; no new runtime-API location, package, or subpath (ADR-0003, §16, §21).
- Read cost and performance: one bounded collector read per invocation, at most one verified decision-history read when a default is eligible, no pagination, no retries, no new outbound request kind, zero writes on a no-op run; pure evaluation, ranking, and rendering ≤ 50 ms on the reference environment (NFR-2, NFR-3).
- Additive non-regression: `status`, `queue ready`, and `verify gates` are unchanged; the owner-gate label set and definition are reused by reference, not duplicated; no new configuration keys, no envelope change, no existing state record kind or schema modified (§8.5, §12).
- Committed fixtures, corpus, and golden evidence with zero live calls in default CI (testing strategy).

### 1.2 Out of Scope & Known Gaps

- [OUT] Brief `aging[]` consumption — M1-S6 (GH-228). The board is the only SLA surface tested here (NG-2, DEC-5).
- [OUT] The typed blocker channel, coordinator-audience flows, question/answer rendering, and any M1-S16 (GH-230) behavior. Only the seam is tested (NG-1, F-8, DEC-4).
- [OUT] The full fleet board grid (lanes, owner asks, parked work on one screen) — M2-S4. Only the owner-gate aging grid is tested (NG-3, DEC-5).
- [OUT] Waiver authorizer-vs-policy enforcement at merge time; `waivedBy` is rendered from injected facts, not verified here (NG-4).
- [OUT] Push, email, chat, webhook, or any out-of-band alert delivery; escalation is visible on the board only (NG-5).
- [OUT] New configuration keys for thresholds, defaults, or gate sets; these are contract data (NG-6, DEC-2).
- [OUT] `board --watch` or any resident-daemon behavior; v0 is render-once and the flag is rejected as an unknown invocation (DEC-9).
- [OUT] Live GitHub/E2E testing. Every board suite is hermetic and in-process; no default-CI live call is made (testing strategy).
- [OUT] Backfill or migration. The decision-event kind is new and append-only; a gate already past 72 h on first sight is evaluated and recorded on that first run, which is tested, but no historical data is rewritten (§19).
- [GAP-1 — implementation-plan mapping — PENDING] The implementation plan is authored in `delivery_planning` (phase 4) and does not exist yet. It must map all 30 TCs onto delivery phases without reshaping any TC's behaviour, states, reasons, bounds, assertions, or AC/NFR mapping. Any later plan or implementation that changes a pinned contract reopens this test plan.
- [GAP-2 — threshold comparator not pinned — RESOLVED IN THIS PLAN, contract-declared] The spec says a gate "crosses" 24 h / 72 h without stating `>` versus `>=`. Chosen reading: the comparator is declared contract data, and the delivery declares `>=` (a gate at exactly 24 h is `escalated`; a defaultable gate at exactly 72 h is `default-applied`). Rationale: with millisecond arithmetic a strict `>` would make the boundary unreachable at the declared value and would delay every SLA by one tick. The tests read the declared comparator and assert both sides, so the reading is executable and a spec-author override is a data edit plus an assertion update (OQ-T1).
- [GAP-3 — collector-unavailable family representation in the error table — RESOLVED IN THIS PLAN, contract-declared] `status.collector.<id>.unavailable` is parameterized by collector id, while the delivered table and sync check recognize exact declared codes. Chosen reading: the family is declared once as contract data with a closed collector-id set; the documented table records the family; the sync check gains a narrowly declared family recognizer (no pattern widening); the `DOMAIN_KINDS` delta is at most one new kind, used only by this family; every emitted code is a member of the declared set. The tests assert this both ways and fail an undocumented family code or a widened pattern (OQ-T2, NFR-6).
- [GAP-4 — unknown-age marker field name — delivery-bound] DEC-8 pins the two marker values but not the field that carries them; DM-1 does not list a marker field. Chosen reading: the gate record carries a declared field, present exactly when `age === null`, with values exactly `activity-timestamp-absent` and `activity-timestamp-unparseable`; the field name is delivery-bound but the behaviour is pinned. Tests read the declared field name from the contracts module rather than hard-coding a spelling (OQ-T3).
- [GAP-5 — `age` representation — delivery-bound] The planning-pack example renders `"26h"` / `"2d"`, while a machine contract could carry integer milliseconds. Chosen reading: the representation is a declared, deterministic contract datum; `null` means unknown; a known age corresponds to `now − activityTimestamp`; the human grid uses the compact form. Tests derive the expected value from the declared datum and do not pin a spelling beyond the contract (OQ-T3). The pack's `"2d"` is an age-rendering example only: it never implies a 48 h default, because the pinned expiry is 72 h (F-3, DEC-2) and the pack's worked example is flagged as internally inconsistent in spec v1.1 Appendix A (see §2 and TC-SLA-018).
- [GAP-6 — board gate rank key — RESOLVED IN THE SPEC (v1.1), plan reading confirmed] Spec v1.1 elevates the rank key into the contract (F-7, DM-1): gates are ranked deterministically by severity grouping (an `escalated` or `default-applied` gate is never hidden behind a `fresh` one; unknown age ranks with the escalated class), then oldest age, then gate id, and truncation is marked so clamped output can never silently drop a non-fresh gate. This plan's reading is that key expressed as a total order — `escalated` (including unknown age) before `default-applied` before `fresh`, then oldest observed age, then gate id lexical — making the intra-group ordering of the non-fresh group explicit; the key is declared contract data and asserted by permutation invariance. Consequence pinned by this plan: no `escalated` or `default-applied` gate may be dropped while a `fresh` gate is rendered (OQ-T4).
- [GAP-7 — machine truncation marking — RESOLVED IN THE SPEC (v1.1), spelling delivery-bound] NFR-4 and DM-1 now require explicit truncation marking (`truncated` with an `omitted` count) so clamped output can never silently drop a non-fresh gate. This plan's reading is unchanged: `data` carries a declared `truncated` boolean and `omitted` count (status/queue-ready precedent), and the human grid carries `+N`; both are mandatory whenever a gate is dropped or clamped. Field names are delivery-bound; the mark is not (OQ-T5).
- [GAP-8 — torn decision history behaviour not pinned] §21 requires a torn store to be classified, never served as truth. Chosen reading: fail closed — the run declares the existing `state.store.torn` identity, exits 2, renders no gates (the declaration is the surface, exactly as with collector unavailability), appends zero records, and never derives `default-applied` from unverified history; this follows the delivered closeout precedent (`readCloseoutHistory` → classified failure → no apply) and keeps the audit invariant ("exactly one record per application") absolute (OQ-T6).
- [GAP-9 — gate kind and gate id provenance not pinned] The spec fixes the closed kind vocabulary but not how a work item becomes an `owner-review` or `waiver` gate. Chosen reading: the collector/gate source supplies `{id, kind, ref, activityAt, waivedBy?}` as facts; the SLA mechanism never infers kind from labels, titles, or ordering and never fabricates an id; an unknown/undeclared kind is never defaulted, remains `escalated`, and is visibly declared. Gate ids are deterministic and stable for identical facts; stability is asserted because idempotency depends on it (OQ-T7).
- [GAP-10 — future activity timestamp (clock skew) not addressed] Chosen reading: a parseable timestamp later than the injected clock yields a non-positive age, is `fresh` (not escalated), and is never defaulted; DEC-8's two-value marker set is not widened for a parseable instant, and this matches the delivered status stall arithmetic (`floor((now − updatedAt)/day)` with no special case). RSK-2 already accepts clock-skew risk for the age clock (OQ-T8).
- [GAP-11 — partial collector unavailability on the surface — RESOLVED BY ENVELOPE EXCLUSIVITY] F-6 speaks of "the affected gates"; DEC-7 says a rendered board exits 0 and an unavailable collector exits 2; the envelope forbids both `data` and `error`. Chosen reading: a board is rendered only when every required collector is available; any unavailable collector yields a declared failure naming that collector, exit 2, and zero gates — never a partial grid that could read as a complete picture. The per-collector mechanism is still tested with two injected collectors so a hard-coded single id cannot pass (OQ-T9).
- [GAP-12 — delivery-bound spellings] Contract export names, module/file names, the unknown-marker field, the truncation fields, the board `data` schema-version string, the decision record kind and payload schema string, and human line labels are delivery-bound. The vocabulary (kinds, classes, defaults, states, markers, audiences), thresholds, caps, exit codes, and assertions are pinned and may not be rebound.

## 2. References

- **Change specification**: [chg-GH-229-spec.md](./chg-GH-229-spec.md) — F-1..F-8, AC-F1-1..AC-F8-1 (12), NFR-1..NFR-7, DM-1..DM-3, EVT-1, RSK-1..RSK-6, DEC-1..DEC-10, OQ-1..OQ-3 (resolved), §19 (no backfill), §20 (privacy), §21 (security), Appendix A (board contract).
- **Decision record**: [PDR-0003 — Owner-gate SLA initial pre-agreed default map](../../../decisions/PDR-0003-owner-gate-sla-default-map.md) — `owner-review` (never-merge, non-defaultable, permanent visible escalation) and `waiver` (defaultable, default `owner-review-first`), closed two-kind vocabulary, owner-signed extension, `waivedBy` never synthesized by expiry.
- **Architecture decisions**: [ADR-0003](../../../decisions/ADR-0003-oss-monorepo-structure.md) (package tiers and runtime-API locations); [ADR-0004](../../../decisions/ADR-0004-workitem-activity-timestamp-additive-v1.md) (optional provider-native `updatedAt`, absent means activity unknown, never fabricated); [ADR-0006](../../../decisions/ADR-0006-workitem-custom-fields-and-comment-omission-representation.md) (absence-not-fabrication discipline).
- **Testing strategy**: [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) — `bun:test`, `tests/{structure,behaviour,checks,boundaries,golden,types}`, `scripts/checks/*.ts` mutation tests, `pnpm check`, permanent-suite rules.
- **TypeScript rules**: [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md) — strict typing, purity, ports and adapters, error contract, `bun:test` authoring.
- **Result contract**: [feature-result-contract.md](../../../spec/features/feature-result-contract.md) — envelope, documented error table, classification chain, `{0,1,2}` projection, single redaction chokepoint, bidirectional sync.
- **State layer**: [feature-state-layer.md](../../../spec/features/feature-state-layer.md) — append-only schema-versioned JSONL ledger, verified reads, verified-empty evidence, torn-state classification, single-writer fences, atomic derived-document replace, additive record kinds, `closeout.operation` append/coverage-verify precedent.
- **Status digest**: [feature-status-digest.md](../../../spec/features/feature-status-digest.md) — owner hand-back family, `STATUS_OWNER_ATTENTION_LABELS`, `updatedAt` absent-means-unknown, thresholds-as-contract-data, caps/truncation precedent.
- **Queue ready**: [feature-queue-ready.md](../../../spec/features/feature-queue-ready.md) — the shared `no-owner-gate` definition and tri-state evidence discipline.
- **Verify gates**: [feature-verify-gates.md](../../../spec/features/feature-verify-gates.md) — the `owner-gate` merge gate over the same labels and the gate-class/never-merge context.
- **Planning pack**: `doc/planning/oss-tooling/milestones/m1/commands/board.md` (proposed board contract, exit status, errors, worked example) and `doc/planning/oss-tooling/cli-command-registry.md` (`board` row, M1-S5). The worked example is illustrative only and is recorded in spec v1.1 Appendix A as internally inconsistent on two points: its `waiver` gate "at 2 days" is `escalated` under the pinned 72 h expiry (F-3, DEC-2) rather than `default-applied`, and its `waivedBy: owner` on a default-applied gate contradicts DEC-10. This plan reproduces neither: there is no 2 d / 48 h defaulted fixture anywhere (48 h is `escalated`; the defaulted fixture is 3 d — exactly 72 h — at the declared `>=` boundary), and every `default-applied` gate renders `waivedBy: null` (TC-SLA-006, TC-SLA-018).
- **Existing mechanisms**: `tests/fixtures/status/harness.ts` (`makeWorkItem`, injected clock, normalized facts); `tests/fixtures/state/harness.ts` (temp store, identity, edge faults, ledger inspection); `tests/behaviour/{state-torn,state-evidence,closeout-idempotency}.test.ts` (state-integrity, verified-read, and exactly-once patterns); `tests/behaviour/{status-negative-controls,verify-gates-owner-composition}.test.ts` (negative-control and owner-gate composition patterns); `tests/behaviour/verify-support.ts` (`guardStore` mutation recorder); `tests/golden/helpers.ts` (`runCli`, synthetic brand, fixed run id/clock, buffer sinks); `packages/testkit/src/result-conformance.ts` (`assertEnvelopeContract`); `tests/structure/{error-table,status-contract,queue-ready-contract,verify-gates-contract,subpaths,content-inventory,branding-seam}.test.ts`; `tests/checks/{error-table-sync,secret-read-boundary,forbidden-literals}.test.ts`; `scripts/checks/{error-table-sync,ambient-globals,forbidden-literals,exit-code-literals,workspace-entrypoints}.ts`; `tests/boundaries/**`.
- **Ticket**: GH-229 — M1-S5: Owner-gate SLA.

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Criterion (abbreviated) | TC ID(s) | Status |
|-------|--------------------------|----------|--------|
| AC-F1-1 | An open owner-gate item with a parseable activity timestamp 10 h old yields a computed age, `slaState: fresh`, and no escalation or default | TC-SLA-002 | Covered |
| AC-F1-2 | An owner-gate item with absent or unparseable activity timestamp has a declared unknown age (never fabricated, never zero), is visibly listed, and is never `fresh` | TC-SLA-003, TC-SLA-015 | Covered |
| AC-F2-1 | A gate whose observed age has crossed 24 h is `escalated` and remains `escalated` on every subsequent evaluation until it resolves | TC-SLA-004, TC-SLA-005, TC-SLA-015 | Covered |
| AC-F3-1 | A gate with exactly one pre-agreed default whose age has crossed 72 h applies that default as a proceed decision, becomes `default-applied` naming it, and persists an EVT-1 record | TC-SLA-005, TC-SLA-006, TC-SLA-009 | Covered |
| AC-F3-2 | A gate with no pre-agreed default whose age has crossed 72 h continues `escalated`, invents no default, and stays visible | TC-SLA-007, TC-SLA-012, TC-SLA-015 | Covered |
| AC-F4-1 | A default application is readable later through a verified read with gate id, default, and application time; a re-evaluation creates no second record | TC-SLA-006, TC-SLA-009, TC-SLA-010, TC-SLA-011 | Covered |
| AC-F5-1 | A never-merge gate past 72 h receives no auto-applied proceed default; escalation continues; only a recorded waiver by an authorized principal is override evidence | TC-SLA-008, TC-SLA-015 | Covered |
| AC-F6-1 | A failing/unavailable tracker collector is declared as `status.collector.<id>.unavailable`, fabricates no gate, and exits 2 — never silent, never a rendered zero | TC-SLA-013, TC-SLA-014 | Covered |
| AC-F6-2 | Every owner gate older than the SLA thresholds appears `escalated` or `default-applied` on every evaluation — the never-silence criterion holds for every gate | TC-SLA-015, TC-SLA-020 | Covered |
| AC-F7-1 | With mixed SLA states and all collectors available, `board --json` returns exactly one `CommandResult` whose `data` carries `gates[]` with id, kind, ref, age, slaState, default, waivedBy, exit 0 | TC-SLA-016, TC-SLA-017 | Covered |
| AC-F7-2 | Identical injected collector facts, clock, and policy data across two invocations yield byte-identical output in either mode | TC-SLA-019, TC-SLA-029 | Covered |
| AC-F8-1 | Aging, threshold evaluation, and escalation state carry an explicit audience dimension (owner \| coordinator) with no owner-specific assumption baked into the mechanism, so a coordinator consumer can be added without redesign | TC-SLA-024 | Covered |

**Capability coverage** (no capability left unlinked): F-1 → TC-SLA-002, TC-SLA-003, TC-SLA-005; F-2 → TC-SLA-004, TC-SLA-005, TC-SLA-015; F-3 → TC-SLA-006, TC-SLA-007, TC-SLA-012; F-4 → TC-SLA-006, TC-SLA-009, TC-SLA-010, TC-SLA-011; F-5 → TC-SLA-008; F-6 → TC-SLA-003, TC-SLA-013, TC-SLA-014, TC-SLA-015; F-7 → TC-SLA-016, TC-SLA-017, TC-SLA-018, TC-SLA-019, TC-SLA-020; F-8 → TC-SLA-024.

**TC → AC traceability**: every scenario's `Related IDs` line and the Scenario Index (§5.1) carry the reverse direction; this table carries the forward direction. All 12 ACs are covered; no AC is deferred and no AC is TODO.

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

The specification declares no `API-#` and no HTTP endpoint (§8.1). The machine interfaces are EVT-1 and DM-1..DM-3; the collector-unavailability identity is an error-contract interface added by NFR-6.

| Interface / data model | Description | TC ID(s) | Status |
|------------------------|-------------|----------|--------|
| EVT-1 — default-application decision record | Append-only state record carrying gate id, kind, ref, applied default, application timestamp, and evidence context; idempotent by gate identity; readable through verified reads | TC-SLA-006, TC-SLA-009, TC-SLA-010, TC-SLA-011, TC-SLA-022 | Covered |
| DM-1 — gate SLA record (board payload) | Per gate: `id`, `kind`, `ref`, `age` (observed or declared unknown), `slaState` (`fresh` \| `escalated` \| `default-applied`), `default`, `waivedBy`, plus the declared unknown-age marker when `age` is null | TC-SLA-017, TC-SLA-018, TC-SLA-020, TC-SLA-022 | Covered |
| DM-2 — default-application decision event payload | Declared closed payload: gate id, kind, ref, default, applied-at, threshold-crossing evidence; no title, body, comment, credential, or free-form text | TC-SLA-009, TC-SLA-022 | Covered |
| DM-3 — SLA policy-as-data | Closed vocabulary: 24 h escalation, 72 h expiry, gate kinds (`owner-review`, `waiver`), gate classes with never-merge flags, defaultability, the single `owner-review-first` default, the three-value SLA-state enum, the two unknown-age markers, the two audiences, and the declared comparator | TC-SLA-001, TC-SLA-005, TC-SLA-012, TC-SLA-024 | Covered |
| Collector-unavailable error family | `status.collector.<id>.unavailable` over a closed collector-id set, projected as exit 2; the only new documented identity family | TC-SLA-013, TC-SLA-014, TC-SLA-021 | Covered |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement | TC ID(s) | Status |
|--------|-------------|----------|--------|
| NFR-1 | Determinism: identical injected facts produce byte-identical board output in text and machine modes | TC-SLA-019, TC-SLA-025, TC-SLA-029 | Covered |
| NFR-2 | Read cost: reuse the delivered tracker reads; no pagination, retries, or new outbound request kinds | TC-SLA-026 | Covered |
| NFR-3 | Latency: pure evaluation, ranking, and rendering ≤ 50 ms on the reference environment | TC-SLA-027 | Covered |
| NFR-4 | Bounds: 8 rendered gates, machine ≤ 65 536 bytes, human ≤ 24 lines / 4 096 bytes, every drop or clamp marked | TC-SLA-020, TC-SLA-029 | Covered |
| NFR-5 | SLA precision: thresholds evaluated against an injected clock on every invocation; boundary semantics pinned in contract data; no background timer | TC-SLA-004, TC-SLA-005, TC-SLA-016, TC-SLA-019 | Covered |
| NFR-6 | Error-identity stability: only the collector-unavailable family is new; all other failures reuse table rows and the two fallbacks; sync stays green | TC-SLA-021 | Covered |
| NFR-7 | Auditability and idempotency: exactly one record per application; re-evaluation is a no-op | TC-SLA-009, TC-SLA-010, TC-SLA-011 | Covered |

All seven NFRs are covered. No NFR is marked TODO or deferred.

## 4. Test Types and Layers

| Layer | Runner / invocation | Location | Covers |
|-------|--------------------|----------|--------|
| Structure — policy/contract binding | `bun test tests/structure/owner-gate-sla-contract.test.ts` | `tests/structure/owner-gate-sla-contract.test.ts`, `tests/structure/inventory.json` | TC-SLA-001, TC-SLA-012 (contract half) |
| Structure — purity/tier/imports | `bun test tests/structure/owner-gate-sla-imports.test.ts` | `tests/structure/owner-gate-sla-imports.test.ts` (pattern from `verify-imports.test.ts`/`status-imports.test.ts`) | TC-SLA-025 |
| Structure — audience seam | `bun test tests/structure/owner-gate-sla-audience.test.ts`; typecheck of `tests/types/owner-gate-sla-audience.type-test.ts` | `tests/structure/owner-gate-sla-audience.test.ts`, `tests/types/owner-gate-sla-audience.type-test.ts` | TC-SLA-024 |
| Behaviour — aging and unknown age | `bun test tests/behaviour/board-aging.test.ts` | `tests/behaviour/board-aging.test.ts`, `tests/fixtures/board/matrix/**` | TC-SLA-002, TC-SLA-003 |
| Behaviour — escalation and boundaries | `bun test tests/behaviour/board-escalation.test.ts` | `tests/behaviour/board-escalation.test.ts`, `tests/fixtures/board/matrix/**` | TC-SLA-004, TC-SLA-005 |
| Behaviour — defaults and never-merge | `bun test tests/behaviour/board-defaults.test.ts` | `tests/behaviour/board-defaults.test.ts`, `tests/fixtures/board/policy/**` | TC-SLA-006, TC-SLA-007, TC-SLA-008, TC-SLA-012 |
| Behaviour — records and state integrity | `bun test tests/behaviour/board-records.test.ts` | `tests/behaviour/board-records.test.ts`, `tests/fixtures/state/harness.ts`, `tests/behaviour/verify-support.ts` | TC-SLA-009, TC-SLA-010, TC-SLA-011 |
| Behaviour — collector unavailability | `bun test tests/behaviour/board-collectors.test.ts` | `tests/behaviour/board-collectors.test.ts`, `tests/fixtures/board/collectors/**` | TC-SLA-013, TC-SLA-014 |
| Behaviour — never-silence matrix | `bun test tests/behaviour/board-never-silence.test.ts` | `tests/behaviour/board-never-silence.test.ts`, `tests/fixtures/board/matrix/**` | TC-SLA-015 |
| Behaviour — command surface | `bun test tests/behaviour/board-command.test.ts` | `tests/behaviour/board-command.test.ts`, `tests/fixtures/board/harness.ts` | TC-SLA-016 |
| Behaviour — machine and human output | `bun test tests/behaviour/board-output.test.ts` | `tests/behaviour/board-output.test.ts`, `tests/fixtures/board/bounds/**` | TC-SLA-017, TC-SLA-018 |
| Behaviour — determinism | `bun test tests/behaviour/board-determinism.test.ts` | `tests/behaviour/board-determinism.test.ts`, `tests/golden/helpers.ts` | TC-SLA-019 |
| Behaviour — bounds and truncation | `bun test tests/behaviour/board-bounds.test.ts` | `tests/behaviour/board-bounds.test.ts`, `tests/fixtures/board/bounds/**` | TC-SLA-020 |
| Behaviour — privacy | `bun test tests/behaviour/board-privacy.test.ts` | `tests/behaviour/board-privacy.test.ts`, `tests/fixtures/board/privacy/**` | TC-SLA-022 |
| Behaviour — read cost | `bun test tests/behaviour/board-read-cost.test.ts` | `tests/behaviour/board-read-cost.test.ts` | TC-SLA-026 |
| Behaviour — performance | `bun test tests/behaviour/board-performance.test.ts` | `tests/behaviour/board-performance.test.ts`, `tests/fixtures/board/bounds/cap-sized/**` | TC-SLA-027 |
| Behaviour — corpus | `bun test tests/behaviour/board-corpus.test.ts` | `tests/behaviour/board-corpus.test.ts`, `tests/fixtures/board/corpus/**` | TC-SLA-028 |
| Golden — board snapshot | `bun test tests/golden/board-grid.test.ts` | `tests/golden/board-grid.test.ts`, `tests/fixtures/board/golden/**` | TC-SLA-029 |
| Checks — error table / secrets / literals | `bun run scripts/checks/error-table-sync.ts`; `bun test tests/checks/{error-table-sync,secret-read-boundary,forbidden-literals}.test.ts` | existing suites/checks plus the family corpus | TC-SLA-021, TC-SLA-022, TC-SLA-023 |
| Structure — branding seam | `bun test tests/structure/branding-seam.test.ts`; `bun run scripts/checks/forbidden-literals.ts` | existing suites/checks | TC-SLA-023 |
| Existing surfaces — non-regression | `bun test tests/behaviour/status-*.test.ts`; `bun test tests/behaviour/queue-ready-*.test.ts`; `bun test tests/behaviour/verify-gates-*.test.ts`; `bun test tests/golden/{status-digest,queue-ready,verify-gates}.test.ts` | existing suites | TC-SLA-030 |
| Boundaries / ambient / entrypoints | `bun test tests/boundaries`; `bun run scripts/checks/{ambient-globals,forbidden-literals,exit-code-literals,workspace-entrypoints}.ts` | existing harnesses; no new rule | TC-SLA-023, TC-SLA-025 |
| Aggregate and non-regression | `pnpm check`; `git diff --check`; `git status --porcelain` | repo root | all TCs |

### 4.1 In-Process Board Harness Contract (binding for every board behaviour TC)

1. **One harness, no spawned processes.** Every behaviour test builds the `board` command definition with injected dependencies (brand, clock, run-id factory, secrets, program, collector readers, policy snapshot, state store) and calls `runCli(argv, streams, deps)` in process, following `tests/golden/helpers.ts` and the `runCli` contract in `packages/cli/src/index.ts`. No board suite spawns a child process.
2. **Injected facts and time.** Collector facts are normalized `WorkItem`-shaped values built with `tests/fixtures/status/harness.ts` (`makeWorkItem`) plus the supplied gate id/kind/activity facts. The clock, run id, brand, policy snapshot, state store, and streams are injected. No test reads `$HOME`, the wall clock, the real state directory, the network, or the ambient environment where purity is asserted.
3. **Self-materializing fixtures.** Normalized facts are committed under `tests/fixtures/board/**` or built in a fresh `mkdtemp` root from the state harness; no test writes the live tree, `dist/`, or the real local state directory.
4. **One oracle per case.** Every case asserts (a) the exit code, (b) the envelope shape or human lines, (c) each gate's identity, kind, ref, age/marker, `slaState`, `default`, and `waivedBy`, (d) the decision-record count and payload for applied defaults, and (e) the declared truncation mark where applicable. A case that asserts only "rendered" is not sufficient.
5. **Recording seams.** Collector readers record call order and count; the state-store wrapper (reuse `guardStore` from `tests/behaviour/verify-support.ts`) records `readRecords`/`append`/`acquireFence`/`releaseFence` and throws on a mutation a read-only case forbids; a throwing `fetch` guard proves zero live calls.
6. **Fixed output facts.** Where byte equality is asserted, the harness injects a fixed run id (for example `run-board-fixture`), a fixed clock tick (for example `2026-11-06T12:00:00Z`), and a synthetic brand (`tests/golden/helpers.ts`), so the envelope and human text are comparable byte-for-byte.
7. **No handler stream writes.** The board handler returns data or a classified failure; the CLI edge is the only writer. Tests assert no write occurs outside the edge's single serialization path.
8. **Policy snapshots, not ambient reads.** The SLA policy map is injected as data. A test that needs a different map passes a deep copy; the production contract is never mutated.

### 4.2 Non-Vacuity Contract (binding for every negative, matrix, boundary, and bound scenario)

- Every negative fixture carries a distinctive `planted-board-*` canary in a title, body, comment, label, or provider payload; the builder asserts the intended fact is present before the board runs, and the canary must not appear in stdout, stderr, the payload, the record, or the human grid.
- Every negative is paired with a restored-or-valid control that reaches the expected success shape through the same invocation path.
- Every unknown-age case is paired with a valid-timestamp control; every absent case is paired with an unparseable case so the two markers cannot collapse into one.
- Every cap/truncation fixture has an under-cap and an over-cap/over-limit control in the same test; the under-cap control must not be marked truncated.
- Every contract-binding test mutation-controls each pinned datum (threshold, comparator, kind, class flag, default, enum value, audience, marker) in a temp copy and asserts the mutation fails by name; the unmutated control is green.
- Every never-merge and never-silence assertion is proven live: mutating the policy to make the class defaultable changes the observed outcome, proving the test reads the map rather than a hard-coded expectation.
- Every read-only assertion is paired with a seeded-write control that the guarded store detects; every no-live-call assertion is paired with a guard that would throw on a call.
- Every determinism assertion is paired with a changed-fact control that produces different bytes, proving the equality is not a constant.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Impact | Priority | AC / NFR |
|-------|-------|------|--------|----------|----------|
| TC-SLA-001 | SLA policy contract data pinned: thresholds, comparator, kinds, classes, defaults, states, markers, audiences | Regression | Critical | High | DM-3, DEC-2, DEC-8, DEC-10, NFR-5 |
| TC-SLA-002 | Aging from the provider-native activity timestamp: fresh at 10 h, truthful arithmetic, skew corner | Happy Path | Critical | High | AC-F1-1, F-1, DEC-1 |
| TC-SLA-003 | Unknown age declared: absent vs unparseable, never fresh, never zero, never defaulted | Corner Case | Critical | High | AC-F1-2, F-1, F-6, DEC-6, DEC-8 |
| TC-SLA-004 | 24 h escalation: boundary, stickiness, resolve, visibility only | Regression | Critical | High | AC-F2-1, F-2, NFR-5 |
| TC-SLA-005 | Threshold boundary precision at exactly 24 h and 72 h from contract data | Corner Case | Critical | High | AC-F2-1, AC-F3-1, NFR-5 |
| TC-SLA-006 | 72 h default application on a defaultable waiver gate, with the EVT-1 record | Happy Path | Critical | High | AC-F3-1, AC-F4-1, F-3, F-4, EVT-1 |
| TC-SLA-007 | 72 h with no pre-agreed default: owner-review escalates indefinitely, nothing invented | Regression | Critical | High | AC-F3-2, F-3, F-6, PDR-0003 |
| TC-SLA-008 | Never-merge protection: permanent no-auto-proceed regression and waiver-only override | Regression | Critical | High | AC-F5-1, F-5, §21 |
| TC-SLA-009 | EVT-1 record content, durability, and append-only history | Happy Path | Critical | High | AC-F4-1, F-4, EVT-1, DM-2, NFR-7 |
| TC-SLA-010 | Idempotency by gate identity: exactly one record, re-evaluation is a no-op | Regression | Critical | High | AC-F4-1, F-4, NFR-7 |
| TC-SLA-011 | State integrity: torn or malformed history classified, never served as truth | Negative | Critical | High | AC-F4-1, EVT-1, NFR-7, §21 |
| TC-SLA-012 | Policy-as-data behaviour: unknown kind, temp-map mutation, no kind literals in the engine | Regression | Critical | High | AC-F3-2, F-3, DM-3, DEC-2, DEC-10 |
| TC-SLA-013 | Collector unavailable: declared identity, zero fabricated gates, exit 2, never a silent all-clear | Negative | Critical | High | AC-F6-1, F-6, DEC-7, NFR-6 |
| TC-SLA-014 | Per-collector declaration and partial-failure withholding (no misleading partial board) | Negative | Critical | High | AC-F6-1, F-6, DEC-7 |
| TC-SLA-015 | Never-silence matrix: every gate past thresholds is escalated or default-applied on every evaluation | Regression | Critical | High | AC-F1-2, AC-F2-1, AC-F3-2, AC-F5-1, AC-F6-2 |
| TC-SLA-016 | `board` command grammar and surface: `--json` only, `--watch` rejected, write-free handler | Happy Path | Critical | High | AC-F7-1, F-7, DEC-9 |
| TC-SLA-017 | Board machine envelope and `gates[]` record contract | Happy Path | Critical | High | AC-F7-1, F-7, DM-1 |
| TC-SLA-018 | Board text aging grid: parity with machine, unknown age, TTY-independent determinism | Happy Path | Important | High | F-7, DM-1, NFR-1 |
| TC-SLA-019 | Determinism: byte-identical output and permutation invariance | Regression | Critical | High | AC-F7-2, NFR-1, NFR-5 |
| TC-SLA-020 | Bounds and truncation: caps, byte/line limits, marks, never-silence under truncation | Corner Case | Critical | High | NFR-4, AC-F6-2 |
| TC-SLA-021 | Error identity: only the collector-unavailable family is new; sync stays green | Regression | Critical | High | NFR-6, DEC-7 |
| TC-SLA-022 | Privacy: no credentials, payloads, titles, or bodies in any board or record output | Negative | Critical | High | F-7, DM-1, DM-2, §20, §21 |
| TC-SLA-023 | Brand neutrality: binary name from configuration, no product literals | Regression | Important | High | F-7, §21 |
| TC-SLA-024 | Audience seam (owner \| coordinator) and M1-S16 reuse without redesign | Regression | Critical | High | AC-F8-1, F-8, DEC-4 |
| TC-SLA-025 | Pure domain core: no I/O, clock, randomness, or ambient reads | Regression | Critical | High | §16, §21, NFR-1 |
| TC-SLA-026 | Read cost: one collector read, bounded state reads, no new request kinds | Regression | Important | High | NFR-2, §21 |
| TC-SLA-027 | Performance: ≤ 50 ms pure evaluation, ranking, and rendering | Regression | Important | Medium | NFR-3 |
| TC-SLA-028 | Committed fixture corpus with completeness meta-check | Regression | Critical | High | all ACs (corpus oracle) |
| TC-SLA-029 | Golden board snapshot (machine + human) byte-for-byte | Regression | Important | High | AC-F7-2, NFR-1, NFR-4 |
| TC-SLA-030 | No regression of `status`, `queue ready`, and `verify gates`; shared owner-gate definition by reference | Regression | Critical | High | F-1, F-6, §8.5, §12 |

All thirty TCs are automated. TC-SLA-029 is a golden suite with a mutation control; TC-SLA-027 is a measured performance suite. Every TC is non-vacuous per §4.2; the controls are named in each scenario.

### 5.2 Scenario Details

#### TC-SLA-001 - SLA policy contract data pinned: thresholds, comparator, kinds, classes, defaults, states, markers, audiences

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: DM-3, DEC-2, DEC-8, DEC-10, NFR-5, PDR-0003
**Test Type(s)**: Structure, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/owner-gate-sla-contract.test.ts`, `tests/structure/inventory.json`
**Tags**: @backend @golden

**Preconditions**:

- The SLA policy module exports its vocabulary as `as const` data in the contracts tier (names delivery-bound).
- The change spec §5.1/§12, DEC-2/DEC-8/DEC-10, and PDR-0003 are the read-only oracles.
- A deep-copy harness for mutation controls; the live contract is never mutated.

**Steps**:

1. Assert the escalation threshold equals 24 hours and the expiry threshold equals 72 hours in the declared unit; assert both are declared together with an explicit comparator datum (not implied by an operator buried in code).
2. Assert the gate-kind vocabulary is exactly `["owner-review","waiver"]` in declared order and the class vocabulary is exactly the two corresponding classes; assert the vocabulary is closed (no third kind).
3. Assert the policy table's rows: `owner-review` → class `owner-review`, `neverMerge: true`, `defaultable: false`, `default: null`; `waiver` → class `waiver`, `neverMerge: false`, `defaultable: true`, `default: "owner-review-first"`.
4. Assert exactly one default exists in the whole map; assert no row carries more than one default; assert no row carries a sentinel/no-op default.
5. Assert the SLA-state enum is exactly `["fresh","escalated","default-applied"]` in declared order; assert the unknown-age marker set is exactly `["activity-timestamp-absent","activity-timestamp-unparseable"]`; assert the audience set is exactly `["owner","coordinator"]`.
6. Assert the contracts module is data-only (no executable statements beyond declarations/`as const`) using the detector from `tests/structure/status-contract.test.ts`; assert the module is registered in `tests/structure/inventory.json` with the correct executable allowances.
7. Mutation controls on a deep copy: change the escalation threshold, change the comparator, add a third kind, give `owner-review` a default, add a second default to `waiver`, flip `neverMerge` on `owner-review`, rename a state, add a third marker, drop `coordinator`; each mutation must fail the corresponding assertion; the unmutated control is green.

**Expected Outcome**:

- The closed two-kind map from PDR-0003 is pinned as data: 24 h / 72 h with an explicit comparator, `owner-review` non-defaultable and never-merge, `waiver` defaultable with the single `owner-review-first` default, three SLA states, two unknown markers, two audiences. Any drift fails by name.

#### TC-SLA-002 - Aging from the provider-native activity timestamp: fresh at 10 h, truthful arithmetic, skew corner

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, DEC-1, ADR-0004, NFR-5
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-aging.test.ts`, `tests/fixtures/board/matrix/**`
**Tags**: @backend

**Preconditions**:

- Injected clock fixed at `2026-11-06T12:00:00Z`.
- Open `WorkItem` facts carrying `hand-back` or `human-input-needed`, with an injected deterministic gate id/kind and `activityAt` (the normalized `updatedAt`).
- Gate A: activity 10 h before the clock, kind `owner-review`; Gate B: activity exactly at the clock; Gate C: activity 2 h after the clock (skew); Gate D: an item with the same ref but a different `createdAt`, title, label order, and fact order.
- A guarded state store (no append expected).

**Steps**:

1. Evaluate Gate A and assert `age` corresponds to 10 h (`now − activityAt`), `slaState: "fresh"`, `default: null`, `waivedBy: null`, no unknown marker.
2. Assert no escalation and no default are emitted for Gate A: `slaState` is not `escalated`/`default-applied`, the state append count is `0`, and no EVT-1 record exists.
3. Evaluate Gate B and assert age `0` (not null, not absent) and `slaState: "fresh"`; this distinguishes a real zero age from the unknown-age `null` representation.
4. Evaluate Gate C (future timestamp) and assert the age is the arithmetic difference (non-positive), `slaState: "fresh"`, no unknown marker, no default, and zero records; this is the pinned clock-skew reading (GAP-10).
5. Evaluate Gate D and assert its age is identical to Gate A's, proving the clock is `activityAt` and not title, creation time, label order, or list position.
6. Advance the injected clock by 1 h and assert Gate A's age increases by exactly 1 h and remains `fresh`; assert the wall clock is never consulted (purity suite covers the AST assertion).
7. Control: a gate with a missing `activityAt` is `escalated` with `age: null` (TC-SLA-003), proving `fresh` requires observed evidence.

**Expected Outcome**:

- A 10 h gate is `fresh` with a truthful age, no escalation, no default, and no record; zero age is distinguished from unknown; a future timestamp is arithmetic (non-positive, fresh, never defaulted); facts unrelated to the activity timestamp cannot change the age.

#### TC-SLA-003 - Unknown age declared: absent vs unparseable, never fresh, never zero, never defaulted

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-6, AC-F1-2, DEC-6, DEC-8, ADR-0004, ADR-0006
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-aging.test.ts`, `tests/fixtures/board/matrix/unknown-age/**`
**Tags**: @backend

**Preconditions**:

- Injected clock fixed; a valid-timestamp control gate.
- Absent-form variants: key missing, `undefined`, `null`, empty string, whitespace-only string.
- Unparseable-form variants: `"not-a-date"`, `"2026-13-45T99:99:99Z"`, `"yesterday"`.
- Two kinds: a defaultable `waiver` gate and a non-defaultable `owner-review` gate, both far past 72 h by any reasonable reading (for example an item known to be old but with no timestamp), plus the same gates with valid old timestamps as controls.
- A guarded state store.

**Steps**:

1. For each absent-form variant, assert `age: null`, the declared unknown marker equals `activity-timestamp-absent`, `slaState: "escalated"`, and the gate is present in both the machine and human output.
2. For each unparseable-form variant, assert `age: null`, the marker equals `activity-timestamp-unparseable`, `slaState: "escalated"`, and the gate is present in both modes.
3. Assert the two markers are distinct in the payload and that a fixture containing one of each renders both distinctly; assert no other marker value is accepted.
4. Assert every unknown-age gate is never `fresh`, never rendered with a zero/non-null age, and never omitted without a truncation mark.
5. Assert unknown-age gates are never default-applied: evaluate the waiver-kind unknown-age gate repeatedly with the clock advanced by days and months; assert `slaState` stays `escalated`, `default: null`, and the append count is `0`.
6. Assert the unknown-age gate is ranked with the escalated class and is not dropped behind a fresh gate under truncation (TC-SLA-020 asserts the general rule).
7. Controls: the valid-timestamp twin of each gate is `fresh` (10 h) or `default-applied` (waiver, 73 h); the absent/unparseable distinction disappears if the implementation collapses the markers, which the assertions catch.
8. Assert no fabricated timestamp is derived from comments, ordering, `createdAt`, or the run time (the facts contain a tempting `createdAt` and comment canaries).

**Expected Outcome**:

- Absent and unparseable activity evidence both yield `age: null` with distinct declared markers, `slaState: escalated`, and visibility in both modes; none is fresh, zero, defaulted, or silently dropped.

#### TC-SLA-004 - 24 h escalation: boundary, stickiness, resolve, visibility only

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-1, NFR-5
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-escalation.test.ts`, `tests/fixtures/board/matrix/escalation/**`
**Tags**: @backend

**Preconditions**:

- Injected clock; a `waiver` gate and an `owner-review` gate with activity at 24 h − 1 ms, exactly 24 h, 24 h + 1 ms, 25 h, 48 h, and 10 d.
- Guarded state store and an append recorder.

**Steps**:

1. Assert 24 h − 1 ms is `fresh`; exactly 24 h is `escalated` (the declared `>=` comparator, GAP-2); 24 h + 1 ms and later are `escalated`.
2. Re-evaluate the 25 h gate three times with the clock advanced to 26 h, 48 h, and 10 d; assert it remains `escalated` on every evaluation and never regresses to `fresh`.
3. Assert escalation is visibility only: the append count is `0`, no decision record exists, and the board exits `0` for a rendered board with no expired defaultable gate.
4. Resolve the gate by removing the owner-attention label and re-evaluate; assert the gate is absent from the board. Repeat with the item's delivery state changed to `done` and to `canceled`; assert absence in each case.
5. Assert the escalation state is derived and not persisted: a new gate with the same `ref` but a new gate id and 1 h age starts `fresh`; no durable escalation flag exists in the state store.
6. Assert re-adding the label with the original old activity returns the gate to `escalated` (derived fresh each evaluation, no stale cache).
7. Controls: a 1 h gate is `fresh`; the 24 h fixture with the threshold mutated to 25 h in a temp policy copy is `fresh` at 24 h (proves the boundary reads contract data).

**Expected Outcome**:

- Escalation begins at the declared boundary, is recomputed on every evaluation, stays escalated until the gate resolves, ends only on resolve, and writes nothing.

#### TC-SLA-005 - Threshold boundary precision at exactly 24 h and 72 h from contract data

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-3, AC-F2-1, AC-F3-1, NFR-5, DM-3
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-escalation.test.ts`, `tests/fixtures/board/matrix/boundary/**`
**Tags**: @backend

**Preconditions**:

- Contract data exposes both thresholds and the comparator (TC-SLA-001).
- A defaultable `waiver` gate with activity at 71 h 59 m 59.999 s, exactly 72 h, and 72 h + 1 ms.
- An `owner-review` gate at the same instants.
- Guarded state store with append/fence recorders.

**Steps**:

1. Assert the thresholds are expressed in the declared unit (milliseconds) and not floored to whole days: a 71 h 59 m 59.999 s gate is not defaulted; exactly 72 h follows the declared comparator.
2. For the escalation threshold, assert T − 1 ms is not escalated, exactly T is escalated under the declared `>=`, and T + 1 ms is escalated.
3. For the expiry threshold on the defaultable gate, assert T − 1 ms is `escalated` with no record, exactly T is `default-applied` with exactly one record under the declared `>=`, and T + 1 ms is `default-applied` with exactly one record (not two).
4. Repeat steps 2–3 on the `owner-review` gate: exactly T and T + 1 ms remain `escalated` with zero records.
5. Advance the injected clock by 1 ms around each boundary and assert the state flips deterministically in both directions of the fixture; assert no rounding, no truncation to days, and no dependence on the wall clock.
6. Mutation control: set the declared comparator to `>` in a temp policy copy and assert the exactly-T expectations invert accordingly; set the threshold to 25 h/73 h and assert the boundary moves. The production contract remains untouched.
7. Assert no background timer is needed: the same result is produced by a single invocation after a large clock jump (for example from 23 h to 73 h), with no intermediate evaluation.

**Expected Outcome**:

- Boundary behaviour is exact, declared in contract data, read from the injected clock, and exercised at T − 1 ms / T / T + 1 ms for both thresholds; a single invocation after a clock jump produces the correct terminal state.

#### TC-SLA-006 - 72 h default application on a defaultable waiver gate, with the EVT-1 record

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-4, AC-F3-1, AC-F4-1, DM-2, EVT-1, DEC-3, DEC-10
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-defaults.test.ts`, `tests/fixtures/board/matrix/defaults/**`
**Tags**: @backend @golden

**Preconditions**:

- A `waiver`-kind gate with a parseable activity timestamp 73 h old; the shipped policy map (one default, `owner-review-first`).
- A temp state root with a verified empty ledger and an injected fence.
- Guarded store with append/fence recorders; injected clock fixed.

**Steps**:

1. Evaluate the gate and assert `slaState: "default-applied"`, `default: "owner-review-first"`, and `waivedBy: null` (expiry is never waiver authority and must not synthesize the authorizer).
2. Assert the application is a recorded decision, not a merge: no tracker write, no merge call, no `waivedBy` synthesis, and no claim that a merge landed.
3. Assert exactly one ledger append and exactly one fence acquisition; assert the payload fields are the declared closed set (gate id, kind, ref, applied default, applied-at equal to the injected clock, threshold-crossed evidence, clock-source evidence) and contain no title, body, comment, credential, or free-form text.
4. Assert the age remains the truthful observed age and is not reset to zero by the application.
5. Re-read the record through the verified state read and assert it is the same record (identity, default, timestamp, evidence).
6. Assert `data.gates[]` renders the gate exactly once with the applied default and `slaState: default-applied`.
7. Control: the same gate at 71 h 59 m is `escalated`, `default: null`, with zero appends and zero records.

**Expected Outcome**:

- A defaultable expired gate applies its single pre-agreed default as a proceed decision, becomes `default-applied` naming it, records exactly one complete EVT-1 event, and never fabricates `waivedBy` or a merge.

#### TC-SLA-007 - 72 h with no pre-agreed default: owner-review escalates indefinitely, nothing invented

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-6, AC-F3-2, DM-3, PDR-0003, DEC-10
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-defaults.test.ts`, `tests/fixtures/board/matrix/defaults/**`
**Tags**: @backend

**Preconditions**:

- An `owner-review` gate at 73 h, 7 d, 30 d, and 1 year.
- The shipped policy map; a guarded state store.

**Steps**:

1. Evaluate each age and assert `slaState: "escalated"`, `default: null`, `waivedBy: null`, zero appends, and zero records.
2. Advance the clock in steps to one year and re-evaluate; assert the gate remains `escalated` and visible on every evaluation, with no default invented at any point.
3. Assert the engine never falls back to another kind's default: the `waiver` default `owner-review-first` does not appear on the `owner-review` gate; assert no policy lookup defaults to the first declared row.
4. Assert the policy row itself declares `defaultable: false` and `default: null`, so "no default" is an explicit policy statement rather than a missing entry.
5. Positive control: a `waiver` gate at the same age is `default-applied` with one record, proving the difference is the kind/class policy, not the age or the renderer.
6. Assert the gate is visibly declared as permanently escalated (the human line and the machine record both carry `escalated` and a null default); no all-clear token appears.

**Expected Outcome**:

- A gate with no pre-agreed default never receives an invented one; it stays `escalated` and visible forever, with zero records, while a defaultable gate at the same age proceeds.

#### TC-SLA-008 - Never-merge protection: permanent no-auto-proceed regression and waiver-only override

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1, §21, PDR-0003, DEC-10
**Test Type(s)**: Unit, Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-defaults.test.ts`, `tests/fixtures/board/policy/**`
**Tags**: @backend @golden

**Preconditions**:

- Never-merge gates (`owner-review` class) at 72 h, 73 h, 7 d, 30 d, and 365 d.
- A recorded-waiver fact carrying `waivedBy: "owner"` on one gate; a control gate with no waiver.
- A temp policy copy in which `owner-review` is flipped to `neverMerge: false` and given a default (used only to prove the test is live).
- Guarded store with append recorder.

**Steps**:

1. For every never-merge age, assert `slaState` is never `default-applied`, `default` is always `null`, the append count is `0`, and no decision record exists.
2. Repeat the evaluations 10 times with the clock advancing across days and months; assert the invariants hold on every evaluation and the gate is always visible.
3. Assert the only override evidence is a recorded waiver: the waived gate renders `waivedBy: "owner"` while `slaState` remains `escalated` and `default` remains `null`; a default application on any gate never populates `waivedBy`.
4. Assert expiry alone is never authority: a never-merge gate past 72 h with no waiver has `waivedBy: null` and is not rendered as approved, overridden, or merged.
5. Assert the policy table structurally excludes the class from default machinery: the row has `neverMerge: true` and `defaultable: false`, and the evaluator's default-eligibility check rejects a never-merge class before any age comparison.
6. Mutation control: evaluate the same gates against the temp policy copy; assert the copied map *would* apply a default (proving the test reads policy data and the production invariant is not a constant). The production map is untouched and the production assertion remains green.
7. Assert no code path applies a default from age alone: a synthetic gate whose kind is unknown but whose class is flagged never-merge is also never defaulted.

**Expected Outcome**:

- No never-merge gate is ever auto-proceeded at any age or repetition count; escalation continues visibly; only a recorded waiver with an authorizer appears as override evidence; expiry alone never authorizes and never populates `waivedBy`.

**Notes / Clarifications**:

- Authorization policy — whether a waiver authorizer is actually authorized for the class — is out of scope per NG-4 and is not evaluated by the board. This TC asserts the evidence binding (only a recorded waiver supplies `waivedBy`) and the no-auto-proceed invariant, not the merge-time authorization decision.

#### TC-SLA-009 - EVT-1 record content, durability, and append-only history

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, EVT-1, DM-2, DEC-3, NFR-7, §21
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-records.test.ts`, `tests/fixtures/state/harness.ts`
**Tags**: @backend @golden

**Preconditions**:

- A temp store root, injected identity, mutable test clock, and the state harness (`makeIdentity`, `openStore`, `ledgerText`, `ledgerLines`).
- One defaultable expired gate; a title/body/comment canary and a planted credential in the injected facts (in memory only).
- A baseline snapshot of existing record kinds and the state schema version.

**Steps**:

1. Apply the default and assert exactly one LF-terminated JSON line was appended; capture the ledger bytes before and after and assert the before bytes are an exact prefix of the after bytes (no rewrite).
2. Assert the ledger record carries a schema version, a record kind, a store-scoped key, a contiguous sequence, and a checksum; assert the record kind is additive and no existing kind was modified.
3. Assert the decoded payload keys are exactly the declared EVT-1 set: gate id, gate kind, work-item ref, applied default, applied-at (injected clock), and the evidence context (threshold crossed, clock source). Assert no title, body, comment, credential, raw provider payload, or free-form text is present.
4. Reopen the store with a new store instance and the same identity and read the history through the verified read; assert the record is durable and identical.
5. Assert `STATE_SCHEMA_VERSION` is unchanged, no migration/backfill occurred, and no derived document (for example `provider-parks.json`) was replaced by the application.
6. Assert the privacy canaries and the planted credential never appear in the ledger bytes.
7. Assert the read path returns verified-empty evidence before the first application and a verified record after it; an absent key is an empty verified history, never a zeroed record.

**Expected Outcome**:

- The application appends exactly one complete, durable, append-only EVT-1 record with the declared fields and no sensitive content; existing kinds, schema version, and derived documents are untouched.

#### TC-SLA-010 - Idempotency by gate identity: exactly one record, re-evaluation is a no-op

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, NFR-7, EVT-1, DEC-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-records.test.ts`, `tests/fixtures/state/harness.ts`
**Tags**: @backend

**Preconditions**:

- A defaultable expired gate with a stable injected gate id.
- Two invocations in one process and two separate store instances over the same temp root (process-boundary replay).
- A temp policy copy whose default name is changed after the first application.

**Steps**:

1. Apply the default once; assert the ledger contains exactly one EVT-1 record and the append count is `1`.
2. Re-evaluate the same gate in the same process with the same clock; assert `slaState: "default-applied"` naming the recorded default, append count `0`, and the ledger line count unchanged.
3. Close the store, reopen it with a new instance, and evaluate again; assert the same no-op result and exactly one record.
4. Assert the applied `default` rendered is the *recorded* default, not the temp policy's changed value (the existing record is honoured).
5. Evaluate two distinct gate identities supplied by the collector (for example the same work-item ref under two different gate kinds, when the collector emits both); assert two records exist, one per gate id, proving idempotency is keyed by gate identity rather than by ref alone.
6. Assert gate ids are stable: run the same facts twice in reverse order and assert identical gate ids, identical record keys, and exactly one record per gate.
7. Control: a gate with a new id and a 73 h age applies a new default and records once; a gate at 71 h records nothing.
8. Assert the post-append coverage read sees the expected record count; a deliberately duplicated append in a test-only path is detected as a torn count, not silently accepted (the negative control for step 1).

**Expected Outcome**:

- Exactly one record exists per applied gate identity; every subsequent evaluation is a no-op that honours the existing record; distinct gate identities are not over-suppressed; gate ids are stable.

#### TC-SLA-011 - State integrity: torn or malformed history classified, never served as truth

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: EVT-1, DM-2, NFR-7, AC-F4-1, §21
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-records.test.ts`, `tests/fixtures/state/harness.ts`
**Tags**: @backend @golden

**Preconditions**:

- Temp store roots with: a truncated final line, a corrupted line, a checksum mismatch, a wrong-kind record under the owner-gate key, a payload missing a required field, a payload with an undeclared default value, and a valid control.
- Injected edge faults for permission denial and fence contention.
- Guarded store recording reads, appends, and fences.

**Steps**:

1. For each torn/malformed case, assert the verified read fails with `state.store.torn`, the board run exits `2`, the failure is declared (no `data`/`gates[]`), and the outcome is never an empty verified history.
2. Assert zero appends and zero fences in every torn case; assert no `default-applied` gate is derived from unverified history and no replacement record is written.
3. Assert the failure does not read as an empty verified history (which would cause a duplicate application): the code is a classified failure, not `verified-empty`, and the run does not silently continue with zero records.
4. Permission denial: assert the existing `state.permission.denied` identity and the contract's projection (user-validation, exit `1`), no in-memory fallback, and no append.
5. Fence contention: assert the existing `state.lock.busy` identity, exit `2`, no apply, and no duplicate.
6. Read-only invocation (no expired defaultable gate): assert zero fences and zero appends; assert the verified decision-history read count is at most `1` and no write occurs.
7. First-sight migration case: a gate already 100 h old on an empty store applies the default and records exactly once on the first run; a second run is a no-op with one record (no backfill, no second record).
8. Non-vacuity: build the corrupted bytes with the state harness, then disable detection in a test-only copy and assert the planted duplicate/corruption becomes observable; the production detection path classifies it.

**Expected Outcome**:

- Torn, malformed, and fence-contended histories are classified with the existing `state.*` identities and their contract exit projections (torn/lock → `2`, permission → `1`), cause no fabricated or duplicate default, and never render an empty history; the first-sight old gate applies exactly once.

#### TC-SLA-012 - Policy-as-data behaviour: unknown kind, temp-map mutation, no kind literals in the engine

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-2, DM-3, DEC-2, DEC-10, PDR-0003
**Test Type(s)**: Unit, Structure, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-defaults.test.ts`, `tests/structure/owner-gate-sla-contract.test.ts`, `tests/fixtures/board/policy/**`
**Tags**: @backend

**Preconditions**:

- A gate whose kind is not in the shipped map (for example `owner-review-v2`), 100 h old; a shipped-kind control.
- Deep-copy policy variants: `owner-review` made defaultable with a default; `waiver` default removed; a third kind added with its own default; a policy with two defaults on one kind.
- The engine module source and an AST/grep detector for kind literals.

**Steps**:

1. Evaluate the unknown-kind gate and assert `slaState: "escalated"`, `default: null`, zero records, and visibility; assert no fallback to any declared default and no inferred kind from labels/title/ordering.
2. Evaluate against the variant where `owner-review` is defaultable: assert the engine applies the copied default (proving the map is read as data), while the shipped map continues to produce `escalated`. Restore the copy.
3. Evaluate against the variant where `waiver` has no default: assert `escalated`, no record, no invented default; restore the copy.
4. Evaluate against the variant with a third kind and its default: assert the engine handles it without code change; assert the production contract binding test (TC-SLA-001) still rejects a third kind in the shipped map.
5. Assert a policy with two defaults on one kind fails validation at load time (at most one default per kind); assert a never-merge kind with a default fails validation.
6. Assert the domain engine contains zero literal kind names (`owner-review`, `waiver`), zero class names, and zero default names; those appear only in the contracts module. Mutation control: add a kind literal branch to a temp engine copy and assert the detector fails.

**Expected Outcome**:

- Default eligibility is data-driven, one default per kind at most, an unknown kind is never defaulted, and the engine contains no hard-coded kind or default names.

#### TC-SLA-013 - Collector unavailable: declared identity, zero fabricated gates, exit 2, never a silent all-clear

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-1, DEC-7, NFR-6, AC-F6-2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-collectors.test.ts`, `tests/fixtures/board/collectors/**`
**Tags**: @backend @golden

**Preconditions**:

- A tracker collector that throws a classified read failure; a tracker collector that reports an unavailable credential; a tracker collector with an injected not-configured condition.
- An available collector returning three owner gates; an available collector returning zero owner gates.
- `assertEnvelopeContract`; a throwing `fetch` guard; a guarded state store.

**Steps**:

1. Run `board --json` with the failing collector and assert exactly one failure envelope, `assertEnvelopeContract` returns `[]`, the error code matches `status.collector.<id>.unavailable` for the declared collector id, and the exit code is `2`.
2. Assert the failure envelope has no `data` and therefore no `gates[]`; assert no gate id, ref, or state is fabricated from the failed source.
3. Assert the output contains no all-clear token: no `fresh`, no `0 gates`, no `no owner gates`, no `ok`; assert the failure diagnostic names the collector and is written to the error stream, not as a rendered grid.
4. Repeat for the credential-unavailable and not-configured variants; assert the same family and exit `2`, and assert the family id is the declared collector id (not an empty or literal placeholder).
5. Assert exactly one read attempt per invocation and no retry loop (a second collector call throws); assert zero state appends.
6. Paired controls: the available collector with three gates exits `0` with three truthful gates; the available collector with zero gates exits `0` with an empty `gates[]` plus explicit all-collectors-available evidence (an observed-empty, never a failure).
7. Assert the empty-success and the unavailable-failure are distinguishable in both modes: machine by `data` vs `error`, human by a rendered grid vs a diagnostic and exit `2`.
8. Negative scan: assert the failure path does not contain the empty-success evidence tokens and the empty-success path does not contain the unavailability family.

**Expected Outcome**:

- An unavailable collector yields a declared `status.collector.<id>.unavailable` failure, exit `2`, zero gates, and no all-clear; an available collector with zero gates yields a distinguishable observed-empty success with exit `0`.

#### TC-SLA-014 - Per-collector declaration and partial-failure withholding (no misleading partial board)

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-1, DEC-7
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-collectors.test.ts`, `tests/fixtures/board/collectors/**`
**Tags**: @backend

**Preconditions**:

- Two required collectors injected: collector `tracker` available with two gates, collector `coordination` failing (a synthetic second collector proving the mechanism is not hard-coded to one id).
- A control with both collectors available.
- `assertEnvelopeContract`.

**Steps**:

1. Run the board with the partial failure and assert exit `2`, one failure envelope, and an error code that names the failing collector `coordination` (member of the declared family), not `tracker`.
2. Assert no `data`/`gates[]` is rendered: the available collector's two gates are not presented as a complete board, and no gate is fabricated for the failed collector.
3. Assert the failure summary/remediation does not claim "no owner gates" or a partial count; the declaration identifies the failed collector so an operator can distinguish a partial picture from a full one.
4. Repeat with the failing collector id changed to `tracker` and the available one `coordination`; assert the error names `tracker`, proving the id is data-derived and the mechanism is collector-agnostic.
5. Control: both collectors available → exit `0`, the board renders the union of gates with per-collector available evidence.
6. Control: both unavailable → exit `2`, zero gates, and a deterministic error across two runs (repeat and compare); no partial board.
7. Assert the failure path performs zero appends and zero retries; assert the available collector's read is not repeated to "fill in" the failed one.

**Expected Outcome**:

- The unavailability declaration is per collector, data-derived, and never rendered as a partial board; the surface withholds the grid and exits 2, leaving no ambiguity between a partial and a complete picture.

#### TC-SLA-015 - Never-silence matrix: every gate past thresholds is escalated or default-applied on every evaluation

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-3, F-6, AC-F1-2, AC-F2-1, AC-F3-2, AC-F5-1, AC-F6-2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-never-silence.test.ts`, `tests/fixtures/board/matrix/never-silence/**`
**Tags**: @backend @golden

**Preconditions**:

- A matrix of gate cases covering every class: fresh (1 h, 23 h 59 m 59.999 s); escalation boundary (24 h, 24 h + 1 ms); mid (48 h, 71 h); expiry boundary (72 h, 72 h + 1 ms); long (7 d, 30 d, 365 d); kinds `owner-review` and `waiver`; unknown age absent and unparseable; unknown kind; a recorded waiver; a never-merge class flagged through a temp policy.
- Source conditions: all collectors available, partial failure, all unavailable, torn decision store.
- A completeness meta-check listing every named class.

**Steps**:

1. For every available-source case, assert every gate with observed age ≥ 24 h (and every unknown-age gate) is `escalated` or `default-applied`, never `fresh`; every gate < 24 h is `fresh`.
2. Assert every gate ≥ 72 h on a defaultable class is `default-applied` with exactly one record; every gate ≥ 72 h on a non-defaultable or never-merge class is `escalated` with zero records; every unknown-age gate is `escalated` with zero records.
3. Assert no gate disappears between evaluations: the rendered identities plus the declared omitted count account for the whole population on every run.
4. Repeat each evaluation three times with the same clock and assert identical states; advance the clock and assert monotonic progression (`fresh` → `escalated` → `default-applied` only for defaultable classes), never a regression.
5. Assert every failure-source case is declared (exit `2`, no `data`) and never a success with zero gates and no declaration; scan for all-clear tokens across the whole matrix.
6. Assert the matrix covers every named class and every AC-F6-2 case; fail if a class has no case (meta-assertion in the fixture builder).
7. Control: remove one case and assert the completeness meta-check fails; mutate a state expectation and assert the cell fails.

**Expected Outcome**:

- Across the full population and every source condition, no gate past a threshold is ever silent, fresh, or omitted unmarked; the matrix is complete and meta-checked.

#### TC-SLA-016 - `board` command grammar and surface: `--json` only, `--watch` rejected, write-free handler

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-1, DEC-9, NFR-5
**Test Type(s)**: Unit, Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-command.test.ts`, `tests/fixtures/board/harness.ts`
**Tags**: @backend @cli

**Preconditions**:

- The `board` command definition composed with injected collectors, policy, clock, brand, run id, and streams.
- A counting collector recorder and throwing output sinks for the handler.
- A fully available fixture with three gates.

**Steps**:

1. Run `runCli(["board"], streams, deps)` and assert exit `0`, a rendered text grid, and exactly one collector read.
2. Run `runCli(["board","--json"], ...)` and assert exit `0`, exactly one `CommandResult` envelope on stdout, and the same gate set/states as step 1.
3. Run `runCli(["board","extra"], ...)` and assert `fallback.invocation`, exit `1`, no `data`, and zero collector reads.
4. Run `runCli(["board","--watch"], ...)` and `runCli(["board","--json","--watch"], ...)`; assert `fallback.invocation`, exit `1`, zero reads, and a diagnostic that names the unknown flag (v0 is render-once per DEC-9).
5. Run `runCli(["board","--limit","5"], ...)` and assert the same rejection with zero reads.
6. Assert the command definition declares no command-specific flags and no positionals; `--json` is the only global switch; assert no `--watch` metadata exists.
7. Assert the handler performs no stdout/stderr write (throwing sinks on the handler, passing sinks on the edge) and returns data or a classified failure only.
8. Assert no timer/loop exists in the command module: AST scan for `setInterval`, `setTimeout`, `setImmediate`, and an unbounded `while`; assert exactly one render call per invocation.
9. Positive control: re-run `["board"]` after the rejected invocations and assert exit `0` and three gates.
10. Assert the command-registry and man-page surfaces cross-reference the delivered `board` exactly once (the M1-S5 row); a missing or duplicate row fails the content check.

**Expected Outcome**:

- The surface is exactly `board [--json]`, rejects positionals, unknown flags, and `--watch` before any read, is write-free and exit-free in the handler, and renders once with no timer.

#### TC-SLA-017 - Board machine envelope and `gates[]` record contract

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-1, DM-1, NFR-1
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-output.test.ts`, `tests/fixtures/board/matrix/mixed/**`
**Tags**: @backend @golden

**Preconditions**:

- A mixed population: `fresh` owner-review, `escalated` owner-review at 26 h, `default-applied` waiver at 3 d (72 h, at the declared `>=` expiry boundary) with `owner-review-first`, unknown-age absent, unknown-age unparseable, a waived gate with `waivedBy: "owner"`, and a 73 h owner-review with `default: null`.
- Fixed run id/clock/brand; `assertEnvelopeContract`.

**Steps**:

1. Run `--json board`; assert stdout parses as exactly one JSON document with one trailing newline and no extra output.
2. Assert exit `0`, `assertEnvelopeContract` returns `[]`, the envelope top-level keys are exactly `{schemaVersion, runId, exitCode, timing, data}`, and no `error` key exists; assert `runId` is a non-empty opaque string and `timing.totalMs` is a non-negative integer.
3. Assert `data.schemaVersion` equals the declared board schema string; assert `data` carries `gates[]` and the declared truncation/omitted fields (see GAP-7).
4. For every gate, assert the key set equals the declared DM-1 set plus the declared marker field when `age` is null; assert no undeclared field.
5. Assert `kind` is a member of `["owner-review","waiver"]`; `slaState` is a member of the three-value enum; `age` is null exactly when the unknown marker is present; `default` is `null` or `owner-review-first` and is non-null only when `slaState` is `default-applied`; `waivedBy` is `null` unless a recorded waiver fact was injected.
6. Assert the mixed population yields exactly the expected per-gate tuples, in the declared rank order, with exactly one gate per id and no duplicates.
7. Assert the payload contains no human prose, no title, no raw provider payload, and no duplicate gate data outside `gates[]`.
8. Negative controls: a gate with a non-null `default` but `slaState: escalated` fails; an unknown-age gate with a non-null `age` fails; a `waivedBy` synthesized by default application fails; a second envelope on stdout fails.

**Expected Outcome**:

- One valid envelope carries a declared board `data` shape with a complete, closed `gates[]` record per gate; values are truthful, defaults and waivers are correctly bound, and unknown age is represented by `age: null` plus the marker.

#### TC-SLA-018 - Board text aging grid: parity with machine, unknown age, TTY-independent determinism

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-7, DM-1, NFR-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-output.test.ts`, `tests/fixtures/board/matrix/mixed/**`
**Tags**: @backend @golden

**Preconditions**:

- The same mixed population as TC-SLA-017 (including the `default-applied` waiver gate at 3 d — exactly 72 h, at the declared `>=` expiry boundary — and the `escalated` owner-review gate at 26 h); a synthetic brand with `binaryName: "example-product"`.
- Fixed run id/clock; buffer streams.

**Steps**:

1. Run human mode and assert an optional header plus exactly one line per rendered gate in the declared rank order, and a summary/truncation line when applicable.
2. Parse each gate line and assert it carries id, kind, ref, age (or the declared unknown token), `slaState`, `default`, and `waivedBy`; assert the values equal the `--json` record for the same gate.
3. Assert the unknown-age lines render the declared unknown token and never `0h`, `fresh`, or a fabricated duration.
4. Assert an owner-review gate at 26 h renders `escalated` with a null default; a waiver gate at 3 d (72 h, the declared `>=` expiry boundary) renders `default-applied` with `owner-review-first` and `waivedBy: null`; the waived gate renders `waivedBy: owner`.
5. Assert the grid contains no ANSI/color escape sequences and no TTY-dependent branch; run the same facts with different environment/stream metadata and assert byte-identical output.
6. Assert the header (when present) uses the injected brand binary name, and that no product literal appears.
7. Assert the human output contains no title, body, comment, credential, or raw payload; assert the human line count and byte length are within the NFR-4 bounds for this cap-sized fixture.
8. Control: an empty-population fixture (zero gates, collectors available) renders an explicit observed-empty line plus evidence, not a failure; a collector-unavailable fixture renders a diagnostic and exits `2`, never an empty grid.

**Expected Outcome**:

- The text grid is a deterministic, brand-neutral, TTY-independent rendering of the same facts as the machine payload, with unknown age and waiver authorizers stated truthfully and no sensitive content.

**Notes / Clarifications**:

- Fixture provenance: the planning pack's worked example shows a waiver gate "at 2 days" as `default-applied`; that is below the pinned 72 h expiry and is a pack-internal inconsistency flagged as non-normative in spec v1.1 Appendix A. This plan therefore uses a 3 d (exactly 72 h) fixture — the same `>=` boundary asserted by TC-SLA-005 step 3 and consistent with the 73 h happy path in TC-SLA-006. A 48 h / 2 d gate is `escalated` with `default: null`, never `default-applied`; no fixture in this plan may be read as 2 d → defaulted.

#### TC-SLA-019 - Determinism: byte-identical output and permutation invariance

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-2, NFR-1, NFR-5
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-determinism.test.ts`, `tests/golden/helpers.ts`
**Tags**: @backend @golden

**Preconditions**:

- A cap-sized mixed fixture (8 gates) with fixed run id (`run-board-fixture`), fixed clock (`2026-11-06T12:00:00Z`), fixed brand, and fixed policy.
- A reversed-order twin of the collector facts and a reversed-iteration-order twin of the policy map.
- A changed-fact control (one gate's age crosses a threshold).

**Steps**:

1. Run `--json board` twice with identical injected facts and assert the stdout bytes are identical (including the fixed run id/timing).
2. Run human mode twice and assert the stdout bytes are identical.
3. Run each mode on the reversed collector facts and assert the gate order, records, and bytes are identical to the forward run.
4. Run with the policy map's iteration order reversed and assert identical eligibility, order, and bytes.
5. Run 50 iterations in one process and assert the set of stdout hashes has size `1` for each mode.
6. Assert the only permitted differences between two runs are the injected `runId`/`timing` values; normalize them and assert `data` and the human grid are identical.
7. Assert no wall clock, randomness, locale, or environment dependence: the purity suite asserts the AST, and this test asserts that changing the real elapsed time between runs does not change bytes.
8. Control: the changed-fact fixture (age moved from 23 h 59 m 59.999 s to 24 h) produces different bytes and a different `slaState`, proving the equality assertion is live.
9. Assert gate ids are stable across the forward and reversed runs; a regenerated id would change the record key and fail this assertion.

**Expected Outcome**:

- Identical injected facts produce byte-identical machine and human output across repeated runs, fact permutations, and policy iteration orders; only injected correlation/timing fields may vary.

#### TC-SLA-020 - Bounds and truncation: caps, byte/line limits, marks, never-silence under truncation

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-4, AC-F6-2, DM-1, F-7
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-bounds.test.ts`, `tests/fixtures/board/bounds/**`
**Tags**: @backend @golden

**Preconditions**:

- Under-cap (7), at-cap (8), over-cap (9, 12, 100) fixtures; a hostile-length fixture with very long gate ids/refs; a cap-sized legal fixture.
- A rank-order fixture where the 9th gate is `escalated` and the first is `fresh`.
- A UTF-8 multibyte fixture for byte-bound checks.

**Steps**:

1. Assert 7 and 8 gates render without a truncation mark and `omitted` is `0`; assert 9 renders 8 and marks `+1`; 12 marks `+4`; 100 marks `+92`; assert the machine `omitted` equals the drop count and `truncated` is `true`.
2. Assert the dropped gates are those below the rendered ones in the declared rank key (GAP-6); assert no `escalated` or `default-applied` gate is dropped while a `fresh` gate is rendered; assert an unknown-age gate (escalated) renders ahead of a fresh gate.
3. Assert the machine `data` is ≤ 65 536 UTF-8 bytes for the legal cap-sized fixture and for the hostile fixture; assert an over-limit clamp is declared/marked, never silent.
4. Assert the human grid is ≤ 24 lines and ≤ 4 096 UTF-8 bytes for the legal and hostile fixtures; assert any defensive line/field drop is marked (`+N` or the declared marker) and never splits a UTF-8 code point.
5. Assert every dropped or clamped case is marked in both modes (machine `truncated`/`omitted`, human `+N`); assert the under-cap controls carry no mark.
6. Assert truncation is deterministic: repeat the 100-gate run and assert the same 8 gates and the same marker.
7. Controls: remove the cap in a test-only copy and assert 12 gates render (the cap assertion fails); remove the marker and assert the marking assertion fails; a 65 537-byte hostile payload must either be clamped with a mark or rejected, never emitted unmarked.

**Expected Outcome**:

- All four bounds are enforced and measured, every drop/clamp is marked in both modes, and truncation never hides an SLA-urgent gate behind a fresh one.

#### TC-SLA-021 - Error identity: only the collector-unavailable family is new; sync stays green

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-6, DEC-7, §8.5, §22
**Test Type(s)**: Structure, Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts`, `scripts/checks/error-table-sync.ts`, `tests/fixtures/result/code-corpora`
**Tags**: @backend @golden

**Preconditions**:

- A baseline snapshot of `ERROR_TABLE` codes, `DOMAIN_KINDS`, and the documented table before the change.
- A declared closed collector-id set and the family pattern in the contracts tier.
- True/false-positive corpus rows for the family.

**Steps**:

1. Assert the set of documented codes added by this change is a subset of the `status.collector.<id>.unavailable` family for ids in the declared set; assert no other code was added.
2. Assert every board-emitted error code is either a family member or an existing table row (for example `fallback.invocation`, `fallback.internal`, `state.store.torn`, `state.schema.mismatch`, `state.permission.denied`, `state.lock.busy`, `state.write.failed`); assert zero undocumented codes.
3. Assert the family classifies to `platform-provider` and projects exit `2`; `fallback.invocation` projects `1`; `fallback.internal` projects `2`; the reused `state.store.torn` and `state.lock.busy` rows project `2`; the reused `state.permission.denied` row projects `1` (user-validation), and the board never overrides a table projection.
4. Assert the documented table and the machine table agree in both directions via `bun run scripts/checks/error-table-sync.ts` and that the family recognizer is narrowly declared (no generic wildcard widening); assert a synthetic `status.other.<id>.unavailable` fails.
5. Assert the `DOMAIN_KINDS` delta is at most one new kind (the family's kind) and that the kind is used only by the family; assert no other row uses it.
6. Assert no `failureClass` anywhere in the board evidence or record is an error-table code; assert a known code used as a class fails the check.
7. Mutation controls: emit an undocumented family code → sync fails by name; emit a family code with an empty id → fails; add a `status.*` code outside the family → fails; remove a documented family row → fails.
8. Assert the error-table sync check is read-only (`git status --porcelain` unchanged).

**Expected Outcome**:

- The only new documented identity is the closed collector-unavailable family; every board failure reuses it or an existing row/fallback; classification and sync are green in both directions with narrow, mutation-tested recognition.

#### TC-SLA-022 - Privacy: no credentials, payloads, titles, or bodies in any board or record output

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, DM-1, DM-2, §20, §21
**Test Type(s)**: Integration, Contract, Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-privacy.test.ts`, `tests/fixtures/board/privacy/**`, `tests/checks/secret-read-boundary.test.ts`
**Tags**: @backend @golden

**Preconditions**:

- Facts containing distinctive canaries in a title, a body, a comment, a free-text label value, a raw provider payload field, and an injected credential (in memory only); the gate ref itself is a legitimate work-item ref.
- A success run and a failure run (collector unavailable) with a planted secret in an injected value.
- A record application with the same canaried facts.

**Steps**:

1. Run the board in both modes and assert every canary and the credential are absent from stdout, stderr, the machine payload, and the human grid.
2. Assert the only gate fields present are the declared DM-1 set plus the unknown marker; assert no title, body, comment, raw payload, or free-text label value crosses the boundary.
3. Assert the gate `ref` is the work-item ref (allowed) and not the title; assert a title canary cannot be reached through `ref`.
4. Assert the decision record payload contains only the declared EVT-1 fields; assert the canaries and credential are absent from the ledger bytes.
5. Assert a failure envelope with a planted secret in an injected value is redacted by the single serialization chokepoint; assert the same redaction covers the human diagnostic.
6. Assert the secret-read allowlist has not grown (four entries) and no new secret-read path exists.
7. Assert the error `summary`/`remediationHint` is table prose or a bounded declaration, never a raw exception message or provider body.
8. Control: a canary placed in an undeclared extra field is rejected at the payload boundary (extra keys are not serialized); the unmutated declared payload is unaffected.

**Expected Outcome**:

- Board output, the human grid, diagnostics, and the decision record carry only declared identifiers and policy values; no credential, raw payload, title, body, comment, or free-form text escapes.

#### TC-SLA-023 - Brand neutrality: binary name from configuration, no product literals

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-7, §21
**Test Type(s)**: Structure, Checks, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/branding-seam.test.ts`, `tests/checks/forbidden-literals.test.ts`, `tests/behaviour/board-command.test.ts`
**Tags**: @backend @golden

**Preconditions**:

- A synthetic brand (`productName`/`binaryName: "example-product"`, `environmentPrefix: "EXAMPLE_PRODUCT_"`, `configDirectoryName: ".example-product"`).
- The forbidden-literal scanner's registered scopes.
- A temp module copy with an injected product literal for the mutation control.

**Steps**:

1. Run the board with the synthetic brand and assert any header, usage line, or diagnostic prefix uses `example-product`; assert the literal `ados`/`ADOS_`/`~/.ados` appears nowhere.
2. Assert the binary name is read from `BrandIdentity.binaryName` (or the injected brand dependency), not a constant; a second brand with a different name changes the output prefix.
3. Assert the command name `board` is brand-neutral and no product-specific path or environment variable is read.
4. Assert `bun run scripts/checks/forbidden-literals.ts` is green for the new modules and the new current-truth doc that names the binary.
5. Assert the new docs are registered for doc distribution per their class; run `bash scripts/.tests/test-doc-distribution.sh` if a redistributable guide or template changes.
6. Mutation control: inject a product literal into a temp module copy and assert the forbidden-literal check fails; the unmutated tree is green.

**Expected Outcome**:

- No product or binary literal is committed; every user-visible name is derived from the injected brand; the forbidden-literal and doc-distribution gates are green.

#### TC-SLA-024 - Audience seam (owner | coordinator) and M1-S16 reuse without redesign

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-1, DEC-4
**Test Type(s)**: Structure, Contract, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/owner-gate-sla-audience.test.ts`, `tests/types/owner-gate-sla-audience.type-test.ts`, `tests/behaviour/board-escalation.test.ts`
**Tags**: @backend

**Preconditions**:

- The SLA evaluation input/result contract and the pure evaluator.
- The same gate facts evaluated with `audience: "owner"` and `audience: "coordinator"`.
- The board surface composition, which selects the owner audience.
- A temp evaluator copy that hard-codes an owner-attention label for the negative control.

**Steps**:

1. Assert the audience vocabulary is exactly `["owner","coordinator"]` and the evaluation input carries an explicit audience field (type probe compiles; a required-field rewrite fails typecheck).
2. Assert the evaluation result/state carries or echoes the audience it evaluated, so a consumer can tell which audience the aging was computed for.
3. Evaluate identical facts under both audiences and assert identical age, threshold outcome, and `slaState`; assert neither audience is rejected and neither changes the SLA math in v0.
4. Assert the board surface selects `audience: "owner"` as the only owner-specific binding; assert the pure evaluator contains no owner label literals (`hand-back`, `human-input-needed`), no board/surface import, no routing, and no owner-specific branch.
5. Assert no M1-S16 behavior is pre-built: no blocker-channel types, commands, or coordinator rendering are exported; only the seam exists.
6. Assert a coordinator-audience consumer can be added without changing aging/threshold/escalation code: call the pure evaluator directly with coordinator facts and assert a complete, valid result (gate states; any default application follows the declared map for that gate kind, not the audience).
7. Negative control: the temp evaluator copy with a hard-coded owner label fails the structure assertion; the unmutated evaluator is green.
8. Record the review criterion: a reviewer can point to (a) the audience field in the input contract, (b) the audience-agnostic evaluation, (c) the surface-only owner binding, and (d) the absence of owner assumptions in the mechanism.

**Expected Outcome**:

- The mechanism carries an explicit, typed audience dimension; the only owner-specific binding is the surface selection; coordinator-audience facts evaluate through the same aging, threshold, and escalation logic with no redesign.

#### TC-SLA-025 - Pure domain core: no I/O, clock, randomness, or ambient reads

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: §16, §21, NFR-1, ADR-0003
**Test Type(s)**: Structure, Boundaries
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/owner-gate-sla-imports.test.ts`, `tests/boundaries/**`, `scripts/checks/{ambient-globals,workspace-entrypoints}.ts`
**Tags**: @backend

**Preconditions**:

- The new contracts, domain, CLI command, and state-record modules.
- The unchanged `.dependency-cruiser.cjs` rule set and the ambient-globals scope.
- Runtime sentinels for `Date.now`, `new Date`, `Math.random`, `fetch`, `process.env`, `node:fs`, and `node:child_process`.

**Steps**:

1. Assert the pure evaluator imports only the contracts tier and standard type-only helpers; assert it imports no adapter, CLI, state, provider, config, or branding module.
2. Assert the evaluator source contains no `Date.now`, `new Date`, `Math.random`, `process.env`, `fetch`, `node:fs`, `node:child_process`, `setTimeout`, `setInterval`, or `setImmediate`; the AST check fails by name on a seeded occurrence.
3. Assert runtime purity: evaluate with sentinels installed and assert none fires; the clock and policy are injected values.
4. Assert the contracts module is data-only and the new record kind module is the only place that touches the state port; the CLI composition (not the domain) performs the append.
5. Assert no new runtime-API location, package, subpath, or `workspaceImports` edge is added (ADR-0003); run `bun run scripts/checks/workspace-entrypoints.ts`.
6. Assert `bun run scripts/checks/ambient-globals.ts` is green for the new modules and `bun test tests/boundaries` passes including the fixture-coverage meta-check; no rule is added or weakened.
7. Assert the module is registered in `tests/structure/inventory.json`; an unregistered new module fails.

**Expected Outcome**:

- The SLA evaluation is a pure function of injected facts; no ambient read, clock, randomness, I/O, child process, new package, or new runtime-API location exists.

#### TC-SLA-026 - Read cost: one collector read, bounded state reads, no new request kinds

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: NFR-2, §21, F-6
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-read-cost.test.ts`
**Tags**: @backend

**Preconditions**:

- A recording transport/collector with a declared page limit and a throwing guard for any second page or unfixtured URL.
- Counting provider-engine/quota stubs and a child-process sentinel.
- A guarded state store; a fixture with no expired default (read-only) and one with an expired default (one append).

**Steps**:

1. Run the board and assert exactly one tracker read at the declared existing page limit; assert no pagination request, no retry attempt, and no new request kind.
2. Assert at most one verified decision-history read per invocation; assert zero appends/fences on the read-only fixture and exactly one fence + one append on the expired-default fixture.
3. Assert zero network writes, zero provider-engine `resolve`/`quota` calls, zero quota HTTP requests, and zero child processes (sentinel).
4. Assert text mode and `--json` mode perform the same reads and exactly one render each; no extra read on either path.
5. Assert a collector-unavailable run makes exactly one failed attempt and no retry.
6. Positive control: a deliberate second read or a non-GET request trips the guard, proving the recorder is live.
7. Assert the read budget is the delivered tracker budget, not a widened one; compare against the status collector's declared limit.

**Expected Outcome**:

- The board reuses the delivered tracker read budget, adds at most one local verified state read, performs no pagination/retry/new request kind/network write, and writes only the single recorded decision when a default applies.

#### TC-SLA-027 - Performance: ≤ 50 ms pure evaluation, ranking, and rendering

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: NFR-3, F-7
**Test Type(s)**: Performance, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-performance.test.ts`, `tests/fixtures/board/bounds/cap-sized/**`
**Tags**: @backend @perf

**Preconditions**:

- A cap-sized fixture (8 rendered gates) and an over-cap 100-gate input.
- A monotonic `performance.now` around the pure evaluation + ranking + rendering only; a warm-up run.
- A deliberately expensive control (an unbounded O(n²) sort over a temp list).

**Steps**:

1. Warm up once, then take the median of five runs of the pure evaluation + ranking + rendering over the cap-sized facts and assert the median is ≤ 50 ms; record the measured value in the test output.
2. Repeat over the 100-gate input and assert the cap is applied before rendering and the measurement remains within the bound.
3. Assert the measurement excludes collector I/O and state I/O (measured separately) and includes the rank sort and both renderers.
4. Assert the measurement is live: the expensive control exceeds the bound or is rejected by the cap scan, proving the timing assertion is not vacuous.
5. Record the environment (runtime version, machine class) alongside the result; CI tolerance is OQ-T10 and does not silently relax the 50 ms spec bound.

**Expected Outcome**:

- Pure SLA evaluation, ranking, and rendering complete within 50 ms on the reference environment for cap-sized and over-cap inputs; the measurement is reproducible and live.

#### TC-SLA-028 - Committed fixture corpus with completeness meta-check

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: all ACs (corpus oracle), NFR-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-corpus.test.ts`, `tests/fixtures/board/corpus/**`
**Tags**: @backend @golden

**Preconditions**:

- A committed corpus under `tests/fixtures/board/corpus/*/case.json`, each case declaring the injected facts, policy variant, expected gates (identity, state, age/marker, default, waivedBy), expected record count, expected exit, and expected truncation mark.
- A throwing `fetch` guard and a zero-live-call transport recorder.
- The fixture builder that asserts each case's intended precondition.

**Steps**:

1. Assert the corpus covers every AC class, every SLA state, both unknown-age causes, both gate kinds, the never-merge case, the no-default case, the idempotency replay, the collector-unavailable and partial-failure cases, and every bound class; fail if a named class has no case.
2. For each case, build the injected facts, run the board, and assert the expected exit, gates, marker, default, `waivedBy`, record count, and truncation mark.
3. Assert zero live network calls on every corpus case: the throwing guard is installed and never triggered; the transport records zero requests.
4. Assert each case is deterministic: run it twice and compare bytes.
5. Mutation controls: corrupt one expected state in a temp copy and assert the suite fails; remove one case and assert the completeness meta-check fails.
6. Assert the corpus is read-only at test time and no case writes the live tree (`git status --porcelain` unchanged).

**Expected Outcome**:

- The committed corpus is the deterministic oracle for the whole feature, covers every named class, makes zero live calls, and is completeness- and mutation-checked.

#### TC-SLA-029 - Golden board snapshot (machine + human) byte-for-byte

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F7-2, NFR-1, NFR-4, F-7
**Test Type(s)**: Golden, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/golden/board-grid.test.ts`, `tests/fixtures/board/golden/**`
**Tags**: @backend @golden

**Preconditions**:

- A cap-sized golden case with fixed run id (`run-board-fixture`), fixed clock (`2026-11-06T12:00:00Z`), fixed brand, and the shipped policy map.
- Committed golden `--json` envelope and human grid files.

**Steps**:

1. Run `--json board` and assert the serialized envelope (with the fixed run id/clock) equals the committed golden bytes.
2. Run human mode and assert the grid equals the committed golden bytes.
3. Assert the machine `data` is ≤ 65 536 bytes and the human text is ≤ 24 lines and ≤ 4 096 bytes.
4. Assert the golden payload contains the expected mixed states and no `error`; assert the human grid has one line per rendered gate.
5. Mutation controls: change one input fact (age across a threshold, a waiver authorizer, a gate kind) and assert the golden comparison fails; restore and assert it passes.
6. Assert the golden files are read-only at test time and no test rewrites them.

**Expected Outcome**:

- The full board output is pinned byte-for-byte at a cap-sized fixture in both modes, within bounds, and the snapshot is proven live by mutation.

#### TC-SLA-030 - No regression of `status`, `queue ready`, and `verify gates`; shared owner-gate definition by reference

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-6, AC-F6-2, §8.5, §12
**Test Type(s)**: Regression, Structure, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/status-*.test.ts`, `tests/behaviour/queue-ready-*.test.ts`, `tests/behaviour/verify-gates-*.test.ts`, `tests/golden/{status-digest,queue-ready,verify-gates}.test.ts`, `tests/structure/{status-contract,queue-ready-contract,verify-gates-contract}.test.ts`
**Tags**: @backend @golden

**Preconditions**:

- The pre-change goldens/corpora for `status`, `queue ready`, and `verify gates`.
- The shared owner-attention label constant and the owner-gate definitions.
- The pre-change configuration key set and envelope schema.

**Steps**:

1. Run the existing `status`, `queue ready`, and `verify gates` behaviour, corpus, and golden suites and assert they are green with unchanged expected output for the same facts.
2. Assert the SLA module imports `STATUS_OWNER_ATTENTION_LABELS` (or the shared contract) by reference and does not duplicate the label set; a duplicated literal fails the structure assertion.
3. Assert `status`'s owner hand-back family, ranking, and cap are unchanged; assert adding the board did not alter the digest for the same facts.
4. Assert `queue ready`'s `no-owner-gate` condition and `verify gates`' `owner-gate` condition are unchanged; assert the owner-gate definition is the same closed label set.
5. Assert no new configuration key, no envelope schema change, and no existing state record kind/schema change; assert the board's `data` shape is additive and the `CommandResult` envelope is unchanged.
6. Mutation control: duplicate the label set in the SLA module and assert the structure test fails; mutate a `status` golden and assert the non-regression suite fails.

**Expected Outcome**:

- The new SLA surface is additive: `status`, `queue ready`, and `verify gates` behave exactly as before for identical facts; the owner-gate definition and label set are reused by reference; no config, envelope, or existing state contract changes.

## 6. Environments and Test Data

### 6.1 Environments

| Environment | Requirements | Notes |
|-------------|--------------|-------|
| Local dev (delivery) | Bun pinned by `.bun-version`; pnpm pinned by `packageManager` | All board suites are hermetic and in-process |
| CI (GitHub Actions, `ubuntu-latest`) | Frozen-lockfile install; pinned Bun/pnpm; existing `ts-*` jobs | Authoritative for structure, checks, boundary, corpus, golden, and aggregate gates |
| Temp fixture roots | `mkdtemp` under the OS temp directory (state harness) | State ledgers, torn copies, and mutation fixtures never write the live tree |
| In-process test process | Bun runtime; injected brand, clock, run id, collectors, policy, state store, and streams | No child processes for any board suite; fixed output facts for byte assertions |
| Default CI | No credentials, no live switch, no network | Zero live calls; the throwing `fetch` guard proves it |

### 6.2 Test Data

| Data | Source / shape | Lifecycle |
|------|----------------|-----------|
| Aging / unknown-age fixtures | `tests/fixtures/board/matrix/unknown-age/**`, built with `makeWorkItem`-style facts plus gate id/kind/activity | Read-only; each case carries its delta and expected marker |
| Boundary fixtures | `tests/fixtures/board/matrix/boundary/**` at T − 1 ms / T / T + 1 ms for both thresholds | Read-only; comparator read from contract data |
| Default / never-merge fixtures | `tests/fixtures/board/matrix/defaults/**`, `tests/fixtures/board/policy/**` | Read-only; policy variants are deep copies used only in mutation controls |
| Collector fixtures | `tests/fixtures/board/collectors/**` (available, empty, failed, unconfigured, credential-unavailable, two-collector partial) | Read-only; a throwing guard proves no live fallback |
| Bounds fixtures | `tests/fixtures/board/bounds/{under-cap,at-cap,over-cap,cap-sized,hostile-length,multibyte}/**` | Read-only; reversed and mutated twins built in memory |
| State fixtures | Temp roots from `tests/fixtures/state/harness.ts`; torn, malformed, permission-denied, fence-busy, and valid ledgers | Created and removed per test; never the live state directory |
| Corpus | `tests/fixtures/board/corpus/*/case.json` (facts + expected output + expected records) | Read-only; completeness meta-checked |
| Golden | `tests/fixtures/board/golden/{envelope.json,grid.txt}` at fixed run id/clock/brand | Read-only; mutations only in temp copies |
| Error-table corpus | `tests/fixtures/result/code-corpora` plus the family true/false positives | Read-only; drift fails sync |
| Privacy canaries | `tests/fixtures/board/privacy/**` (title, body, comment, label, payload, credential) | Read-only, synthetic; never real credentials |
| Existing suites | `tests/fixtures/status/**`, `tests/fixtures/queue-ready/**`, `tests/fixtures/verify-gates/**`, `tests/fixtures/result/envelopes/**` | Read-only baseline for non-regression |

### 6.3 Isolation Strategy

- Every synthetic fixture and mutation test uses a fresh `mkdtemp` root; no test writes the live repository tree, `dist/`, the real local state directory, or the user's home. A clean-tree assertion after the suite is part of the aggregate gate.
- Board suites inject brand, paths, clock, run id, collector facts, policy, state store, transport, and streams; they never read `$HOME`, the wall clock, the ambient environment where purity is asserted, or the network.
- State ledgers are built from verified bytes with the real state harness and mutated by a named operation; a detection-disabled control exposes the planted value, proving the fixture is live.
- Corpus and golden fixtures are read-only at test time; corruption/mutation controls run on in-memory values or temp copies, and the unmutated control runs in the same suite.
- The policy map is injected as data; mutation controls use deep copies and never touch the production contract.
- The existing goldens/corpora for `status`, `queue ready`, and `verify gates` are the non-regression oracle and are not regenerated by this change.

## 7. Automation Plan and Implementation Mapping

All TCs are automated. Locations follow the spec's affected-components table and the repository testing strategy; delivery planning may rename helper files but must preserve each TC's behaviour, states, reasons, bounds, assertions, and AC/NFR mapping.

| TC ID | Test file / artefact | Execution command | Control / mutation | Status |
|-------|----------------------|-------------------|--------------------|--------|
| TC-SLA-001 | `tests/structure/owner-gate-sla-contract.test.ts`, `tests/structure/inventory.json` | `bun test tests/structure/owner-gate-sla-contract.test.ts` | constant/vocabulary binding; per-datum deep-copy mutations; inventory registration | To Implement |
| TC-SLA-002 | `tests/behaviour/board-aging.test.ts` + `tests/fixtures/board/matrix/**` | `bun test tests/behaviour/board-aging.test.ts` | 10 h fresh; zero age; future skew; irrelevant-fact control; clock advance | To Implement |
| TC-SLA-003 | same + `matrix/unknown-age/**` | same | absent variants vs unparseable variants; distinct markers; never defaulted; valid-timestamp controls | To Implement |
| TC-SLA-004 | `tests/behaviour/board-escalation.test.ts` + `matrix/escalation/**` | `bun test tests/behaviour/board-escalation.test.ts` | 24 h boundary; repeated evaluations; resolve by label and state; no-write guard; threshold mutation | To Implement |
| TC-SLA-005 | same + `matrix/boundary/**` | same | T−1/T/T+1 for 24 h and 72 h; comparator/threshold mutations; clock jump | To Implement |
| TC-SLA-006 | `tests/behaviour/board-defaults.test.ts` + `matrix/defaults/**` | `bun test tests/behaviour/board-defaults.test.ts` | waiver 73 h applied; record fields; `waivedBy` null; 71 h59m control | To Implement |
| TC-SLA-007 | same + `matrix/defaults/**` | same | owner-review at 73 h/7 d/30 d/1 y; zero records; waiver positive control | To Implement |
| TC-SLA-008 | same + `tests/fixtures/board/policy/**` | same | 10 repetitions, clock advance; waiver-only override; flipped-map mutation proves liveness | To Implement (permanent regression) |
| TC-SLA-009 | `tests/behaviour/board-records.test.ts` + state harness | `bun test tests/behaviour/board-records.test.ts` | append-only prefix; payload key set; durable reopen; canaries; schema/kind baseline | To Implement |
| TC-SLA-010 | same + state harness | same | same-process and reopen replay; changed-policy-after-apply; distinct ids; stable-id reversal | To Implement |
| TC-SLA-011 | same + state harness | same | torn/corrupt/checksum/wrong-kind/missing-field/undeclared-default; permission/fence faults; read-only and first-sight controls | To Implement |
| TC-SLA-012 | `tests/behaviour/board-defaults.test.ts` + `tests/structure/owner-gate-sla-contract.test.ts` | corresponding `bun test` | unknown kind; temp-map add/remove/third-kind; one-default validation; kind-literal detector | To Implement |
| TC-SLA-013 | `tests/behaviour/board-collectors.test.ts` + `tests/fixtures/board/collectors/**` | `bun test tests/behaviour/board-collectors.test.ts` | failed/credential/not-configured; no-data/no-all-clear scan; available-three and available-empty controls | To Implement |
| TC-SLA-014 | same + collectors fixtures | same | two collectors, each failing in turn; no partial board; both-available and both-unavailable controls; no retry | To Implement |
| TC-SLA-015 | `tests/behaviour/board-never-silence.test.ts` + `matrix/never-silence/**` | `bun test tests/behaviour/board-never-silence.test.ts` | full population × source conditions; repeated evaluations; monotonic clock; completeness meta-check; case removal/mutation | To Implement |
| TC-SLA-016 | `tests/behaviour/board-command.test.ts` + `tests/fixtures/board/harness.ts` | `bun test tests/behaviour/board-command.test.ts` | parser rejections incl. `--watch`; zero-read recorder; write-free handler; timer AST scan; valid control | To Implement |
| TC-SLA-017 | `tests/behaviour/board-output.test.ts` + `matrix/mixed/**` | `bun test tests/behaviour/board-output.test.ts` | exact envelope/data keys; per-gate tuples; invalid default/waiver/age controls | To Implement |
| TC-SLA-018 | same + mixed fixtures | same | machine/human parity; unknown token; waiver authorizer; TTY/ANSI checks; brand prefix; bounds | To Implement |
| TC-SLA-019 | `tests/behaviour/board-determinism.test.ts` + `tests/golden/helpers.ts` | `bun test tests/behaviour/board-determinism.test.ts` | 50 identical runs; reversed facts/policy; changed-fact control; stable ids | To Implement |
| TC-SLA-020 | `tests/behaviour/board-bounds.test.ts` + `tests/fixtures/board/bounds/**` | `bun test tests/behaviour/board-bounds.test.ts` | under/at/over-cap; 100-gate rank test; hostile length; UTF-8; machine/human bounds; marker controls | To Implement |
| TC-SLA-021 | `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts`, `scripts/checks/error-table-sync.ts`, `tests/fixtures/result/code-corpora` | `bun run scripts/checks/error-table-sync.ts`; `bun test tests/checks/error-table-sync.test.ts`; `bun test tests/structure/error-table.test.ts` | baseline delta; family recognition; classification; mutation controls; read-only sync | Existing – Update |
| TC-SLA-022 | `tests/behaviour/board-privacy.test.ts`, `tests/fixtures/board/privacy/**`, `tests/checks/secret-read-boundary.test.ts` | corresponding `bun test` | canaries in every disallowed field; success and failure redaction; allowlist count 4; extra-field rejection | To Implement + Existing – Update |
| TC-SLA-023 | `tests/structure/branding-seam.test.ts`, `tests/checks/forbidden-literals.test.ts`, `tests/behaviour/board-command.test.ts` | corresponding `bun test`; `bun run scripts/checks/forbidden-literals.ts` | synthetic brand; second-brand prefix change; product-literal mutation; doc distribution | Existing – Update |
| TC-SLA-024 | `tests/structure/owner-gate-sla-audience.test.ts`, `tests/types/owner-gate-sla-audience.type-test.ts`, `tests/behaviour/board-escalation.test.ts` | corresponding `bun test`; typecheck | audience enum/type probe; owner/coordinator parity; no owner literals; no M1-S16 exports; hard-coded-label mutation | To Implement |
| TC-SLA-025 | `tests/structure/owner-gate-sla-imports.test.ts`, `tests/boundaries/**`, `scripts/checks/{ambient-globals,workspace-entrypoints}.ts` | corresponding `bun test`/`bun run` | domain-only imports; AST purity; runtime sentinels; inventory; boundary fixture coverage | To Implement + Existing – Update |
| TC-SLA-026 | `tests/behaviour/board-read-cost.test.ts` | `bun test tests/behaviour/board-read-cost.test.ts` | one tracker read; one state read; no pagination/retry/new kind; read-only vs one append; deliberate-second-read control | To Implement |
| TC-SLA-027 | `tests/behaviour/board-performance.test.ts` + cap-sized fixtures | `bun test tests/behaviour/board-performance.test.ts` | warm-up + median ≤ 50 ms; 100-gate input; expensive control; environment recorded | To Implement |
| TC-SLA-028 | `tests/behaviour/board-corpus.test.ts` + corpus | `bun test tests/behaviour/board-corpus.test.ts` | completeness meta-check; expected outputs; zero-live guard; corruption/removal controls | To Implement |
| TC-SLA-029 | `tests/golden/board-grid.test.ts` + golden | `bun test tests/golden/board-grid.test.ts` | byte-for-byte envelope + grid; bounds; changed-fact controls; read-only golden | To Implement |
| TC-SLA-030 | `tests/behaviour/status-*`, `queue-ready-*`, `verify-gates-*`; existing goldens; contract suites | corresponding `bun test` | existing corpora/goldens; shared-label identity; duplicated-label mutation; config/envelope/state baseline | Existing – No Change (verified) |

**Execution order.**

1. Contracts, policy data, and structure baselines: TC-SLA-001, TC-SLA-021, TC-SLA-023, TC-SLA-024 (structure half), TC-SLA-025.
2. Pure aging and escalation: TC-SLA-002, TC-SLA-003, TC-SLA-004, TC-SLA-005.
3. Default application, never-merge, and policy behaviour: TC-SLA-006, TC-SLA-007, TC-SLA-008, TC-SLA-012.
4. State records and idempotency: TC-SLA-009, TC-SLA-010, TC-SLA-011.
5. Board surface: TC-SLA-016, TC-SLA-017, TC-SLA-018.
6. Collector unavailability, read cost, and never-silence: TC-SLA-013, TC-SLA-014, TC-SLA-015, TC-SLA-026 (executed with the board surface and collectors in delivery Phase 4, task 4.6).
7. Determinism, bounds, privacy: TC-SLA-019, TC-SLA-020, TC-SLA-022.
8. Corpus, golden, performance, non-regression: TC-SLA-028, TC-SLA-029, TC-SLA-027, TC-SLA-030.
9. Aggregate: `pnpm check`; `git diff --check`; `git status --porcelain`; optional live evidence is not part of this plan.

All 30 TCs (TC-SLA-001..030) appear exactly once in the order above. TC-SLA-026's phase is owned by the delivery plan (Phase 4, task 4.6); its earlier absence from this list is corrected here, so the delivery plan's GAP-1 note recording that omission is superseded.

**Wiring.** The new behaviour suites are discovered by root `bun test`; no new CI job topology is introduced. The new structure suites are discovered by `bun test tests/structure`; the type probe is compiled by the existing typecheck. The error-table sync check stays in the existing `ts-invariants` wiring with the family recognizer added narrowly. The boundary, ambient, forbidden-literal, secret-read, and entrypoint gates extend to the new modules automatically; no rule is added or weakened. Documentation reconciliation runs in phase 7: `git diff --check`, YAML parse for changed `.yaml` files, markdown/link review, the error-table sync check for the added family row(s), forbidden-literal registration for the new current-truth doc that names the binary, and `bash scripts/.tests/test-doc-distribution.sh` for any changed redistributable guide or template.

**Evidence commands** (run and record in the change/PR; never record unrun results as passing):

```
pnpm install --frozen-lockfile
bun test tests/structure/owner-gate-sla-contract.test.ts
bun test tests/structure/owner-gate-sla-imports.test.ts
bun test tests/structure/owner-gate-sla-audience.test.ts
bun test tests/structure/error-table.test.ts
bun test tests/structure/status-contract.test.ts
bun test tests/structure/queue-ready-contract.test.ts
bun test tests/structure/verify-gates-contract.test.ts
bun test tests/structure/branding-seam.test.ts
bun test tests/structure/subpaths.test.ts
bun test tests/structure/content-inventory.test.ts
bun test tests/behaviour/board-aging.test.ts
bun test tests/behaviour/board-escalation.test.ts
bun test tests/behaviour/board-defaults.test.ts
bun test tests/behaviour/board-records.test.ts
bun test tests/behaviour/board-collectors.test.ts
bun test tests/behaviour/board-never-silence.test.ts
bun test tests/behaviour/board-command.test.ts
bun test tests/behaviour/board-output.test.ts
bun test tests/behaviour/board-determinism.test.ts
bun test tests/behaviour/board-bounds.test.ts
bun test tests/behaviour/board-privacy.test.ts
bun test tests/behaviour/board-read-cost.test.ts
bun test tests/behaviour/board-performance.test.ts
bun test tests/behaviour/board-corpus.test.ts
bun test tests/golden/board-grid.test.ts
bun test tests/behaviour/status-command.test.ts
bun test tests/behaviour/status-corpus.test.ts
bun test tests/behaviour/queue-ready-corpus.test.ts
bun test tests/behaviour/verify-gates-corpus.test.ts
bun test tests/golden/status-digest.test.ts
bun test tests/golden/queue-ready.test.ts
bun test tests/golden/verify-gates.test.ts
bun test tests/checks/error-table-sync.test.ts
bun test tests/checks/secret-read-boundary.test.ts
bun test tests/checks/forbidden-literals.test.ts
bun test tests/boundaries
bun run scripts/checks/error-table-sync.ts
bun run scripts/checks/ambient-globals.ts
bun run scripts/checks/forbidden-literals.ts
bun run scripts/checks/exit-code-literals.ts
bun run scripts/checks/workspace-entrypoints.ts
pnpm check
git diff --check
git status --porcelain
```

**Open-PR DoD evidence checklist.** All 12 ACs have a passing traceable TC and all 7 NFRs are measured; the closed two-kind policy map is pinned and mutation-tested; `owner-review` never auto-proceeds at any age (permanent regression) and `waiver` applies `owner-review-first` exactly once with a complete EVT-1 record; `waivedBy` is never synthesized by expiry; unknown age is `age: null` plus a distinct absent/unparseable marker, never fresh/zero/defaulted; collector unavailability is declared as `status.collector.<id>.unavailable`, fabricates no gates, exits 2, and has no silent all-clear path; the board returns one envelope with the declared `gates[]` record and a deterministic text grid; bounds (8 gates, 65 536 bytes, 24 lines/4 096 bytes) are live with every drop marked and SLA-urgent gates ranked first; output is byte-identical across repeated and permuted runs; the audience seam is typed and owner-agnostic; the domain is pure and tier-clean; read cost and 50 ms performance are measured; only the collector-unavailable identity family is new and sync is green; no secrets, titles, bodies, payloads, or product literals escape; `status`, `queue ready`, and `verify gates` are unchanged; docs are reconciled and a minor changeset is recorded; an open unmerged PR targets `main-tools`. No merge or owner acceptance is claimed by this plan.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

**Specification risk coverage (RSK-1..RSK-6).** Every spec risk is exercised by at least one TC.

| Spec risk | Mitigating TC(s) |
|-----------|------------------|
| RSK-1 — a wrong default is auto-applied to an owner gate | TC-SLA-001, TC-SLA-007, TC-SLA-008, TC-SLA-012 |
| RSK-2 — the activity clock over/under-states staleness | TC-SLA-002, TC-SLA-005, TC-SLA-019 |
| RSK-3 — collector unavailability misread as "no gates" | TC-SLA-013, TC-SLA-014, TC-SLA-015 |
| RSK-4 — absent timestamps quietly sit outside the SLA | TC-SLA-003, TC-SLA-015 |
| RSK-5 — the audience seam is foreclosed | TC-SLA-024, TC-SLA-025 |
| RSK-6 — defaults perceived as tool overreach | TC-SLA-001, TC-SLA-006, TC-SLA-008, TC-SLA-028 |

**Testing risks.**

| ID | Risk | Impact | Probability | Mitigation |
|----|------|--------|-------------|------------|
| RSK-T1 | A negative fixture is inert, so a false all-clear passes | H | M | Every negative asserts the exact exit, code, and zero-gate shape plus a restored/valid control (§4.2) |
| RSK-T2 | "Unknown age" is asserted only by "not fresh" and a collapse of absent/unparseable passes | H | M | Both causes and both markers are asserted distinctly; a side-by-side fixture prevents collapse (TC-003) |
| RSK-T3 | The never-merge test is vacuous because it hard-codes the expected outcome | H | M | A flipped temp policy must produce a default, proving the test reads policy data (TC-008) |
| RSK-T4 | Idempotency is asserted by counting appends but not by replaying across a process/store boundary | H | M | Same-process and reopened-store replays, stable gate ids, and a duplicate-append control (TC-010) |
| RSK-T5 | Torn-state handling silently treats a failed read as an empty history | H | M | Every torn case asserts the classified failure, zero appends, and no `default-applied` derived from unverified bytes (TC-011) |
| RSK-T6 | Bounds are asserted by sampling and miss a drop/clamp path | M | M | Under/at/over-cap, 100-gate, hostile-length, and UTF-8 fixtures run together; both modes assert marks (TC-020) |
| RSK-T7 | Truncation hides an escalated gate behind a fresh one | H | M | Rank-order fixture with the escalated gate last in input order; assertion forbids the drop (TC-020) |
| RSK-T8 | The determinism test passes because the fixture is constant | M | L | Changed-fact control and 50-run hash set (TC-019) |
| RSK-T9 | The new error family widens the table/sync unboundedly | M | M | Narrow family recognizer, closed id set, and mutation controls for undocumented/out-of-family codes (TC-021) |
| RSK-T10 | A privacy canary is placed in an allowed field, making the scan vacuous | M | M | Canaries target only disallowed fields; `ref` is asserted as the allowed identity (TC-022) |
| RSK-T11 | The 50 ms measurement is flaky on slow CI | M | M | Measure the pure evaluation only, warm up, take a median, record the environment; the spec bound is not silently relaxed (OQ-T10) |
| RSK-T12 | Delivery drifts from the pinned readings (comparator, rank key, truncation marking) | M | M | Comparator is plan-declared; rank key and truncation marking are spec-pinned (v1.1 F-7/DM-1/NFR-4) and refined here. All three are pinned with mutation controls and OQs owned by `@plan-writer`/`@spec-writer`; any change updates the assertion deliberately |

### 8.2 Assumptions

- **A-T1 — Spec binding.** The spec is the single source of truth for capabilities, acceptance criteria, NFRs, DM-1..DM-3, EVT-1, and the policy map. Delivery planning may choose helper/file/spelling names but may not rebind a pinned value.
- **A-T2 — Plan mapping.** GAP-1: the implementation plan is authored in phase 4 and must map all 30 TCs onto phases without reshaping them. If it alters a TC's behaviour, state, or AC/NFR mapping, this test plan reopens.
- **A-T3 — In-process harness.** Every board behaviour test uses `runCli` with injected dependencies; no board suite spawns a child process or reads the ambient environment/network in default CI.
- **A-T4 — Policy snapshots.** The SLA policy is injected data; tests mutate deep copies only. The shipped map is the PDR-0003 two-row map and is not operator-tunable at runtime.
- **A-T5 — Gate facts.** The collector supplies gate id, kind, ref, activity timestamp, and optional waiver authorizer; the SLA mechanism never infers kind from labels or titles and never fabricates an id (GAP-9). Gate ids are stable for identical facts.
- **A-T6 — State substrate.** The delivered state layer's verified reads, fences, checksums, and torn-state classification are the substrate; the change adds one record kind and no schema bump.
- **A-T7 — Single required collector in v0.** The shipped surface consumes the tracker collector. The two-collector partial-failure test injects a second collector to prove the mechanism is not hard-coded to one id; it does not require a second shipped collector (GAP-11).
- **A-T8 — Delivery-bound spellings.** Export names, module/file names, marker/truncation/age field names, schema strings, record kind/payload schema strings, and human labels are delivery-bound (GAP-12). The vocabulary, thresholds, caps, exits, and assertions are pinned.
- **A-T9 — No live evidence.** This plan requires no live GitHub run; the committed corpus and golden are the deterministic oracle. Any future live smoke is a separate, opt-in, structural check.

### 8.3 Open Questions

| ID | Question | Context | Status | Owner |
|----|----------|---------|--------|-------|
| OQ-T1 | Is the threshold comparator `>=` or `>`? | GAP-2. This plan pins `>=` and requires the comparator to be declared contract data. | Resolved in this plan (contract-declared) — confirm at plan review | @plan-writer / @spec-writer |
| OQ-T2 | How is the parameterized `status.collector.<id>.unavailable` family represented in `ERROR_TABLE` and the documented table? | GAP-3. This plan pins a declared family with a closed id set, a narrow sync recognizer, and a domain-kind delta of at most one. | Resolved in this plan; implementation detail at delivery | @plan-writer / @spec-writer |
| OQ-T3 | What are the `age` representation and the unknown-age marker field name? | GAP-4/GAP-5. This plan pins the behaviour (`null` + distinct markers; age = `now − activityAt`) and leaves the spellings delivery-bound. | Resolved in behaviour; spelling delivery-bound | @plan-writer / @coder |
| OQ-T4 | What is the board gate rank key? | GAP-6. The spec now pins severity grouping → oldest age → gate id (v1.1 F-7/DM-1); this plan pins the same key as a total order (severity → oldest age → id) and forbids dropping an escalated gate while a fresh one renders. | Resolved — spec-pinned in v1.1; plan refinement confirmed | @plan-writer |
| OQ-T5 | How is machine truncation marked? | GAP-7. The spec now requires `truncated`/`omitted` marking (v1.1 NFR-4/DM-1); this plan pins a declared `truncated`/`omitted` pair plus human `+N`; field names are delivery-bound. | Resolved — spec-pinned in v1.1; spelling delivery-bound | @plan-writer / @coder |
| OQ-T6 | What does the board do when the decision history is torn? | GAP-8. This plan pins fail-closed with `state.store.torn`, exit 2, no gates rendered, zero appends, no derived `default-applied`, following the closeout precedent. | Resolved in this plan | @spec-writer |
| OQ-T7 | Where do gate id and gate kind come from? | GAP-9. This plan pins collector-supplied facts, stable ids, and unknown-kind escalation with no default. | Resolved in this plan; confirm at plan review | @plan-writer / @spec-writer |
| OQ-T8 | How is a future activity timestamp (clock skew) treated? | GAP-10. This plan pins arithmetic (non-positive age, fresh, never defaulted), matching the status stall precedent. | Resolved in this plan | @spec-writer |
| OQ-T9 | Is a partial collector failure rendered as a partial board? | GAP-11. The envelope's `data`/`error` exclusivity and DEC-7 force withholding the board (exit 2, no gates). | Resolved by contract consistency | @spec-writer |
| OQ-T10 | What CI tolerance applies to the 50 ms pure-evaluation measurement? | RSK-T11. The plan measures the pure evaluator with a warm-up and median and records the environment; the spec bound is not silently relaxed. | Open — non-blocking | @plan-writer |

**Recorded gaps, not silently adjusted:**

1. **Implementation-plan mapping** — GAP-1/A-T2; pending phase 4; the plan must map all 30 TCs without reshaping them.
2. **Threshold comparator** — GAP-2/OQ-T1; `>=` pinned, contract-declared, both sides tested.
3. **Collector-unavailable family representation** — GAP-3/OQ-T2; declared family with a closed id set and narrow recognition.
4. **Unknown-age marker field and age representation** — GAP-4/GAP-5/OQ-T3; behaviour pinned, spellings delivery-bound.
5. **Gate rank key** — GAP-6/OQ-T4; severity → age → id pinned as a total order, with the never-hide-an-escalation rule; spec v1.1 (F-7/DM-1) pins the key, this plan refines the intra-group order.
6. **Machine truncation marking** — GAP-7/OQ-T5; `truncated`/`omitted` required by spec v1.1 (NFR-4/DM-1), spellings delivery-bound.
7. **Torn-history behaviour** — GAP-8/OQ-T6; fail-closed pinned (declared `state.store.torn`, exit 2, no gates rendered, zero appends).
8. **Gate kind/id provenance** — GAP-9/OQ-T7; collector-supplied facts pinned.
9. **Future timestamp** — GAP-10/OQ-T8; arithmetic pinned.
10. **Partial collector unavailability** — GAP-11/OQ-T9; withheld board pinned by envelope exclusivity.
11. **Delivery-bound spellings** — GAP-12/A-T8; vocabulary pinned, spellings not.
12. **CI timing tolerance** — OQ-T10; open, non-blocking, does not weaken the 50 ms bound.

No AC and no NFR is left without a TC.

## 9. Plan Revision Log

| Version | Date (UTC) | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-11-06T10:00:00Z | Change Test Plan Writer | Initial plan: 30 TCs (TC-SLA-001..030). All 12 ACs (AC-F1-1..AC-F8-1), all 7 NFRs, all 3 DMs, EVT-1, and all 6 spec risks mapped. Pins the PDR-0003 two-kind policy map (owner-review never-merge/non-defaultable; waiver defaultable with the single `owner-review-first`), unknown age (`age: null` + absent/unparseable markers, never fresh/zero/defaulted), 24 h escalation and 72 h default application with boundary precision from contract data, the append-only idempotent EVT-1 record and torn-state fail-closed classification, the never-silence collector contract with no silent all-clear, the board v0 envelope/grid/determinism/bounds surface, the audience seam, the pure domain core, read cost and 50 ms performance, the single new error-identity family, privacy/brand neutrality, and additive non-regression. Twelve recorded gaps with chosen readings (implementation-plan pending, comparator, family representation, marker/age spellings, rank key, truncation marking, torn history, gate kind/id provenance, future timestamp, partial unavailability, delivery-bound spellings, CI timing); no coverage silently weakened. |
| 1.1 | 2026-11-06T16:00:00Z | Change Test Plan Writer | DoR iteration-1 remediation (test-planning findings 1 and 7). (1) TC-SLA-018 fixture re-dated: the machine/human parity case now asserts a waiver gate at 3 d — exactly 72 h, the declared `>=` expiry boundary — as `default-applied`, replacing the planning pack's "2 d" (48 h) reading, which is below the pinned 72 h expiry and contradicted F-3/DEC-2, TC-SLA-005, and TC-SLA-006. The pack's worked example is now recorded as a known pack-internal inconsistency (age below threshold; `waivedBy` on a default-applied gate contradicts DEC-10) in §2 (references), GAP-5, and the TC-SLA-018 notes, cross-referenced to spec v1.1 Appendix A; TC-SLA-017's mixed-population definition names the same 3 d fixture. Swept for inherited readings: every remaining 48 h / "2 d" occurrence is `escalated` or a rendering example, none defaulted; TC-SLA-005's boundary matrix is unchanged and correct (71 h 59 m 59.999 s escalated, exactly 72 h applied). (2) TC-SLA-026 added to the §7 execution order (batch 6, delivery Phase 4 task 4.6) so all 30 TCs appear exactly once in the index; the delivery plan's GAP-1 note about the omission is superseded. (3) Spec v1.1 elevation of the rank key and truncation marking into F-7/DM-1/NFR-4 reflected in GAP-6, GAP-7, OQ-T4, OQ-T5, RSK-T12, and the recorded-gaps list; the pinned readings and every assertion are unchanged. No TC behaviour, state, reason, bound, assertion, or AC/NFR mapping changed; no coverage weakened. |

## 10. Test Execution Log

| TC ID / gate | Run Date (UTC) | Result | Notes / command / HEAD |
|---|---|---|---|
| Not run | — | Planned | This writer ran no builds or tests and implemented no code. The executor records per-TC evidence, commands, HEAD, and pushed-HEAD CI results here; unrun evidence must never be recorded as passing. |
