---
id: chg-GH-243-test-plan
status: Proposed
created: 2026-11-06T23:30:00Z
last_updated: 2026-11-06T23:55:00Z
owners: [engineering]
service: delivery-os
labels: [m1, status, digest, attention-state]
version_impact: minor
summary: "M1-S10 status collector expansion: prove the shipped `delivery.status.v1` digest grows additively from six sections to nine without weakening any existing invariant. Reconciled to spec v1.1. The plan pins the closed ten-code finding registry with the three-value severity set (including the dormant `lane.idle-no-reason` that must never be emitted), per-section per-code grouping with exact observation counts, unique deduplicated member identities and `evidenceRef` as the first member (the pinned case: four failed primary-branch runs become one `ci.red-on-main` finding, count 4, four members), the total rank key severity → count desc → code → first occurrence, the eight-finding/eight-member caps with their truncation and the defensive findings cap proven at the pure aggregation layer, no-evidence-no-claim (a failed or unresolved read emits no finding), the three named tri-state hygiene assertions (epic membership, story points, in-sprint) under presence-as-required semantics — absence-as-violation inside a source-declared available signal, unknown only from the availability gate, satisfied for conforming values, with the mapped signals taken from the existing bounded page (normalized labels and the additive milestone), owner-gate age and `slaState` reused from the M1-S5 evaluator with unknown age escalating and never rendering zero or fresh, parked conditions under the existing detail cap plus the grouped `parked.stale-no-condition` case, the declared-but-dormant lanes attention-state vocabulary (`delivering`, `idle-with-reason`, `idle-no-reason`), the spend (M1-S19) and blockers (M1-S16) named placeholders, the ready-to-merge action list with queue-ready classification and `?` under unknown review signals, the extended human grammar within raised 32-line/6144-byte bounds pinned byte-identically, the unchanged 65 536-byte machine bound re-verified by an all-caps corpus case, the unchanged 3-read/1-fold/1-resolve budget, determinism, read-only posture, zero new error identities, evidence hygiene, and six-section non-regression under DEC-16's enumerated optional-field allowlist. 42 named TCs cover all 23 acceptance criteria, all 10 NFRs, all 13 data-model elements, and all 9 spec risks; every iteration-1 gap is resolved by DEC-13..DEC-18 except the pending implementation-plan mapping."
links:
  change_spec: ./chg-GH-243-spec.md
  implementation_plan: ./chg-GH-243-plan.yaml
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - M1-S10: status collector expansion — attention-state digest with stable finding codes

## 1. Scope and Objectives

This change extends a shipped, heavily pinned surface, so the tests must protect two things at once. **First, the attention layer must be true.** Every emitted finding carries a code from the closed ten-code registry and a severity from the closed three-value set; identical observations coalesce into exactly one finding per section and code with an exact observation count and a bounded list of unique member identities; findings rank by a total, permutation-independent key; a failed or unresolved read emits no finding at all, because findings are observed-evidence claims (DEC-18); hygiene assertions report three named states where a violation is the *absence of a conforming value inside a source-declared available signal* and unknown comes only from the availability gate (DEC-13); owner-gate ages come from the delivered M1-S5 evaluator with unknown age escalating rather than fabricating zero; parked conditions are projected when recorded and never invented; ready-to-merge reuses the queue-ready classification and renders `?` rather than a number it cannot verify; and placeholders declare absence in-band instead of disappearing. Four failed runs on the primary branch must render as **one job**, not four (AC-F2-1), and `lane.idle-no-reason` must exist in the registry while never appearing in any output (AC-F7-1).

**Second, the shipped digest must not regress.** Sections 1–6 keep their ids, order, state derivation, required fields, counts, item identities, evidence and rank keys; the human grammar changes only by the declared tracker fragments and the three new lines plus the rollup; the read budget, exit codes, read-only posture, error-table rows, configuration keys, and package boundaries are untouched. The only machine-shape changes inside sections 1–6 are DEC-16's enumerated optional-field allowlist (`findings[]` on every section, hand-back `age`/`ageUnknownReason`/`slaState`, hygiene per-assertion tri-state counts, parked `condition`, lanes attention-state declaration fields), and the plan asserts that allowlist as the *only* delta so "additive" cannot drift into "re-typed" (DEC-1, DEC-16, §8.5).

The plan is deliberately adversarial about the failure modes this story exists to prevent: a fabricated all-clear (failed read rendered green or zero for a new section, or a finding claimed from a failure), a fabricated signal (invented condition, approval, age, or lane state), a misread absence (an undeclared signal treated as a violation instead of unknown), silent vocabulary drift (a finding without a registry code, a retired code still emitted, a renamed severity), and unbounded growth (an uncapped findings array, member list, or action list). Every negative carries a restored control; every cap has an under-cap, at-cap, and over-cap case; every pinned datum is mutation-controlled; the corpus completeness meta-check and the golden fixtures are the deterministic oracle.

### 1.1 In Scope

- Finding-code registry and severity vocabulary as closed contract data: the ten shipped codes, the three severities, the per-code defaults, the code→surface map, and the dormant `lane.idle-no-reason` (F-1, DM-1, DM-2, NFR-8, Appendix A).
- Every finding in every fixture state carrying a registry code and a registry-declared severity, with zero free-form finding identities and no unregistered code (AC-F1-1, NFR-8).
- Per-section per-code grouping: one finding per code, exact observation `count` (which may exceed the member count when identities repeat), unique deduplicated member identities in the section's fixed rank order, `evidenceRef` holding the first deduplicated member, and per-section truncation (F-2, AC-F2-1, AC-F2-2, DM-4, NFR-1, DEC-17).
- Grouping generality: the pinned four-red-runs case plus 0/1/2/3/4/9/20-run controls, so the assertion cannot pass on a hard-coded four (AC-F2-1).
- Defensive findings cap: the shipped ten-code registry cannot reach eight distinct codes in one section (tracker maximum seven), so `STATUS_MAX_FINDINGS_PER_SECTION = 8` is pinned as headroom and its enforcement is proven at the pure aggregation layer with a permitted test-only registry extension, while a real-input control asserts that no legal input is truncated (AC-F2-4, DEC-15, DM-11).
- No-evidence-no-claim: a failed or unresolved read emits no finding for its section; the `unknown`/`unavailable` state and evidence reasons carry the failure, and no `ci.red-on-main` (or any other) claim is fabricated from a failure (AC-F2-5, DEC-18).
- Total findings rank key: severity, then count descending, then code ascending, then first occurrence in fixed source order; permutation invariance (AC-F2-3, NFR-6).
- Existing findings becoming code-carrying with unchanged trigger, family counts, and rank behaviour: `tracker.stalled-ticket`, `tracker.hygiene.missing-title`, `tracker.hygiene.missing-labels` (F-1, F-4, Appendix A).
- Three named hygiene assertions (`epic-membership`, `story-points`, `in-sprint`) as named surfaces with tri-state per-item counts (violations, unknown, satisfied), grouped violations as the matching code, satisfied producing no output, and assertion-unknown aggregated on the family exactly as stall unknown-activity is counted (AC-F4-1, DM-7).
- Absence-as-violation within a source-declared available signal: an item carrying no conforming value violates — no `epic`/`epic:` label, no `points:` label or an unparseable integer suffix, no mapped milestone — emitted per code and grouped (AC-F4-2, DEC-13).
- Satisfied arm: items carrying conforming values (`epic`/`epic:` label, `points:` label with a parseable non-negative integer, mapped milestone) record satisfied, emit no finding, and contribute to no violation count (AC-F4-4).
- Mapped-signal provenance: epic and story points map the already-normalized label set through declared label-convention contract data; in-sprint maps the additively normalized milestone from the same bounded tracker page; declared per-assertion availability travels with the tracker read, so unknown is driven by declaration and never inferred from absence (F-4a, DM-13, DEC-14).
- Source-declared unavailability, including the mixed case: the undeclared assertion is all-unknown with `signal-unavailable` and zero violations while the declared assertions evaluate independently, never an observed-empty or all-satisfied assertion, and distinguishable from an observed-empty open-item population (AC-F4-3).
- Owner-hand-back additive age fields: observed age from the provider-native timestamp only, the declared unknown-age markers read by reference from the M1-S5 contract, and `slaState` from the delivered pure evaluator over the injected clock — no new thresholds, no policy duplication, no decision records written (F-5, DM-8, DEC-6, ADR-0004, NFR-7).
- `tracker.owner-gate-escalated` grouping over escalated and default-applied gates, including unknown-age gates, and the tracker human fragment `gates <n|?> escalated` (AC-F5-1, AC-F5-2).
- Parked conditions: recorded condition projected on the item under the existing detail cap; absence rendered as absence; free-form notes never projected (F-6, DM-9).
- `parked.stale-no-condition` grouping for unknown-age entries with no recorded condition, with both negative controls (condition present; parseable age present) (AC-F6-2, DEC-12).
- Lanes section exactly as shipped (capability `queue-lane-engine`, expected story `M1-S17`, reason `engine-not-delivered`, zero items/counts, note), the attention-state vocabulary declared as the closed set `delivering`, `idle-with-reason`, `idle-no-reason` (DEC-17), and `lane.idle-no-reason` never emitted in any mode or fixture (AC-F7-1, DEC-7).
- Spend placeholder (index 8, capability, expected story `M1-S19`, `engine-not-delivered`, zero items, note, human line) and blockers placeholder (index 9, expected story `M1-S16`, human line) (AC-F8-1, AC-F9-1, DM-6, DEC-8).
- Ready-to-merge section: merge-ready requires an observed approval on a non-draft open pull request; everything else including unknown review is `review-pending`; merge-ready ranks above review-pending, then the queue-ready numeric-aware ref keys; the declared derivation row (`observed`/`degraded`/`unknown`/`unavailable`, never `not-delivered`); `reviewState` and the `?` human marker; item cap and truncation; zero new reads (F-3, AC-F3-1, AC-F3-2, DM-5, Appendix C, DEC-5, RSK-8).
- Fixed nine-section order, additive summary counts (grouped findings total, placeholder count exactly 2 — `spend` and `blockers`, lanes excluded per DEC-17) with the existing observed/degraded contribution rule, and placeholders contributing zero (DM-3, DM-12).
- Extended human grammar line-for-line: nine section lines in fixed order, optional header, attention rollup with three-group preview and `+N` (grouped findings beyond the preview, never raw observations), exact tracker fragments, no titles/payloads/secrets/timestamps/ANSI; deterministic from data only (AC-F10-1, DM-10, DEC-17).
- Raised declared human bounds: 32 lines as defensive headroom (the extended grammar's worst case is 11 lines) and 6144 bytes as the operative enforced bound, pinned by golden fixtures plus a max-length stress case; the old 24/4096 values retired with no stale clamp (NFR-2, DM-11, Appendix B, DEC-17).
- Unchanged machine bound 65 536 bytes with every new surface at cap, verified by a committed all-caps corpus case with exact truncation markers (AC-NFR-2, NFR-1, NFR-3, RSK-7).
- Corpus completeness meta-check extended to nine sections × five states including the new derivation row, the absence-based hygiene violation cases, the satisfied-arm cases, the no-evidence-no-claim case, and the grouping cases, failing by case name on corrupted state, count, identity, code, severity, member, or truncation flag (AC-NFR-1, NFR-10).
- Golden fixtures for the extended grammar regenerated deliberately once in this change, reviewed, and byte-compared; never rewritten by the suite, and never modified by a blanket update path (AC-F10-1, NFR-10, DEC-16, §8.5).
- Unchanged read budget (≤3 network reads, 1 park fold, 1 config resolve), zero new reads for the mapped hygiene signals (same bounded page, additive milestone normalization), no pagination/retry, no provider engine call (AC-NFR-3, NFR-4, DM-13).
- Determinism (identical injected inputs → identical machine and human bytes; order-independent rank keys), read-only posture (zero writes/fences/state mutations/child processes; no SLA decision record), and evidence hygiene (unique identities, counts, codes only; no titles, payloads, secrets) (NFR-6, NFR-7, NFR-9).
- Six-section and consumer non-regression under DEC-16's enumerated optional-field allowlist: sections 1–6 keep ids, order, state derivation, required fields, states, counts, item identities, evidence, and rank keys; the only delta is the allowlist (`findings[]` on every section, hand-back `age`/`ageUnknownReason`/`slaState`, hygiene tri-state counts, parked `condition`, lanes declaration fields); the five unchanged human section lines stay byte-identical; brief, queue ready, and verify gates stay green with no contract edit (DEC-1, DEC-16, §8.5, RSK-1).
- Opt-in, non-aggregate live smoke asserting structural invariants only for the nine-section digest.

### 1.2 Out of Scope & Known Gaps

- [OUT] `--watch` or any live/streaming subscription; the flag is rejected as an unknown invocation exactly as today (NG-1, DEC-10).
- [OUT] Exit-code change, including exit-1-on-actionable-finding; successful runs exit 0 with degraded sections in-band, and no test asserts an actionable-finding exit (NG-2, DEC-9).
- [OUT] Lane or queue engine behaviour, lane state computation, liveness signal consumption, and idle-with-reason emission (NG-3, M1-S17/M1-S15).
- [OUT] Spend telemetry/aggregation/rendering and the typed blocker channel: only the named placeholder shape is tested (NG-4, NG-5).
- [OUT] Open-pull-request-head CI collection; only checkout-HEAD CI is exercised (NG-8).
- [OUT] Comment conformance, unmapped custom-field conformance, and any assertion over unmapped data (NG-9, ADR-0006).
- [OUT] `queue ready` surface/payload/ranking changes — reused read-only and asserted unchanged (NG-6).
- [OUT] Schema-version bump, section reorder, field removal, or re-typing (NG-7, DEC-1).
- [OUT] New error-table rows, domain kinds, configuration keys, packages, subpaths, runtime-API locations, state-schema changes, writes, fences, or child processes (NG-10, §21).
- [OUT] Owner-gate SLA threshold, comparator, or policy changes; the evaluator and PDR-0003 map are consumed as-is.
- [OUT] Real GitHub credentials or network calls in default CI; the corpus/golden/matrix fixtures are the oracle.
- [GAP-1 — implementation-plan mapping — PENDING] The implementation plan is authored in `delivery_planning` (phase 4) and does not exist yet. It must map all `TC-ATT-001..042` onto phases without reshaping any TC's behaviour, states, reasons, codes, bounds, assertions, or AC/NFR mapping. Any later plan or implementation that changes a pinned contract reopens this test plan.
- [GAP-2 — findings-per-section cap — RESOLVED IN SPEC v1.1 (DEC-15, AC-F2-4)] The cap stays 8 as declared **defensive headroom**: the shipped ten-code registry routes at most seven distinct codes to one section (tracker). Spec v1.1 permits the test-only registry extension at the pure aggregation layer, so this plan proves enforcement there and asserts with a real-input control that no legal input is truncated. TC-ATT-008.
- [GAP-3 — hygiene violation model — RESOLVED IN SPEC v1.1 (DEC-13)] Absence-as-violation is pinned: within a signal the source declares mapped-and-available, an item with no conforming value violates — `epic-membership` = no `epic`/`epic:` label; `story-points` = no `points:` label or an unparseable integer suffix; `in-sprint` = no mapped milestone. Unknown comes **only** from the availability gate. The iteration-1 "supplied-but-non-conforming" reading is superseded and removed from this plan. TC-ATT-012/041.
- [GAP-4 — hygiene signal provenance — RESOLVED IN SPEC v1.1 (F-4a, DM-13, DEC-14)] Signals map fields the existing bounded tracker page already returns: the normalized label set (epic token `epic`/`epic:`; points token `points:` with a parseable non-negative integer) and the page's milestone, additively normalized on the work-item view; declared per-assertion availability travels with the tracker read. No new endpoint, scope, package, or pagination. Corpus fixtures supply mapped labels and milestones so violation and satisfied arms are artifact-reachable; production stays all-unknown where a mapping is not declared. TC-ATT-011/012/013/041.
- [GAP-5 — member identity dedup and representative naming — RESOLVED IN SPEC v1.1 (DEC-17)] Members are unique identities deduplicated and ordered by the section's fixed ranking; `evidenceRef` is the representative and holds the first deduplicated member; `count` is the exact observation total and may exceed the member count when identities repeat. TC-ATT-005/006/007.
- [GAP-6 — `placeholderSectionCount` scope — RESOLVED IN SPEC v1.1 (DEC-17)] Exactly the two delivered placeholders (`spend`, `blockers`); the lanes section is a shipped declared-gap section and is excluded. TC-ATT-021.
- [GAP-7 — attention rollup `+N` unit — RESOLVED IN SPEC v1.1 (DEC-17)] `<n>` is the total grouped findings across sections and `+N` counts grouped findings beyond the previewed three, never raw observations. TC-ATT-027.
- [GAP-8 — human line bound vs structural maximum — RESOLVED IN SPEC v1.1 (DEC-17)] 32 lines is defensive headroom (worst case 11: optional header + nine section lines + rollup); 6144 bytes is the operative enforced bound, pinned by golden fixtures plus a max-length stress case. TC-ATT-028.
- [GAP-9 — CI finding scope on a non-primary branch — RESOLVED BY DEC-18; residual consequence is declared scope] No-evidence-no-claim is now named (DEC-18, AC-F2-5): a failed or unresolved CI read emits no finding. The separate consequence that a *successful* read on a non-primary checkout yields no CI finding follows from Appendix A's primary-branch trigger scope; it is asserted as declared behaviour (section `failed`, zero CI findings) and no `ci.red-on-feature` code is invented. TC-ATT-006/042.
- [GAP-10 — sections 1–6 "unchanged in shape" vs additive fields — RESOLVED IN SPEC v1.1 (DEC-16)] "Shape unchanged" now means ids, order, state derivation, and required fields are frozen; the only permitted delta is the enumerated optional-field allowlist (findings[] on every section; hand-back `age`/`ageUnknownReason`/`slaState`; hygiene tri-state counts; parked `condition`; lanes declaration fields). This plan's additive-delta allowlist and backward-compatibility type probe are aligned to it. TC-ATT-003/037.
- [GAP-11 — lane attention-state vocabulary — RESOLVED IN SPEC v1.1 (DEC-17)] The closed vocabulary literals are `delivering`, `idle-with-reason`, `idle-no-reason`; `lane.idle-no-reason` remains dormant and never emits before the engine lands. TC-ATT-018.
- [GAP-12 — naming and delivery-bound spellings — RESOLVED IN SPEC v1.1 (DEC-17)] Contract-name convention is pinned: camelCase payload fields, kebab-case section/assertion ids, lowercase dotted finding codes, SCREAMING_SNAKE constants. Module/file/export names, the placeholder marker key, and human line padding remain delivery-bound; every vocabulary, cap, bound, marker, and assertion is pinned. TC-ATT-001/003.

## 2. References

- **Change specification**: [chg-GH-243-spec.md](./chg-GH-243-spec.md) v1.1 — F-1..F-10 plus F-4a, AC-F1-1..AC-F10-1 and AC-NFR-1..3 (23 ACs), NFR-1..NFR-10, DM-1..DM-13, RSK-1..RSK-9, DEC-1..DEC-18 (§8.3 extended human grammar; Appendix A finding-code registry; Appendix B bounds and bound roles; Appendix C ready-to-merge derivation row; Appendix D ticket-AC traceability). Iteration 2 (DEC-13..DEC-18) pins the hygiene violation model, mapped-signal provenance, the defensive findings cap, the sections 1–6 allowlist, the minor readings, and no-evidence-no-claim.
- **Ticket**: GH-243 — M1-S10: status collector expansion (four verbatim ACs; pinned decisions: stable codes, grouped/deduplicated/ranked findings, named placeholders, in-band partial collection).
- **PM notes**: [chg-GH-243-pm-notes.yaml](./chg-GH-243-pm-notes.yaml) — three binding decisions (no exit-code change, no `--watch`, lanes declared-not-delivered), the pinned-decision record, and the phase-7 documentation-risk list.
- **Implementation plan**: `./chg-GH-243-plan.yaml` — authored in phase 4; not yet present (GAP-1).
- **Shipped surface spec**: [feature-status-digest.md](../../../spec/features/feature-status-digest.md) — six fixed sections and five states, evidence/counts/truncation model, declared bounds table, derivation matrix, tracker families, CI classification, lanes gap, providers, parked work, machine envelope and human grammar, error-identity reuse, QA strategy and fixture model, corpus completeness meta-check, golden-never-rewritten rule, opt-in live smoke.
- **Reused classification**: [feature-queue-ready.md](../../../spec/features/feature-queue-ready.md) — close-class vocabulary (`merge-ready`, `review-pending`), observed-approval-on-non-draft definition, deterministic numeric-aware ref rank keys, unknown review state never merge-ready.
- **Reused SLA**: [feature-owner-gate-sla.md](../../../spec/features/feature-owner-gate-sla.md) and `packages/core/src/contracts/owner-gate-sla.ts` / `packages/core/src/domain/owner-gate-sla.ts` — age from the provider-native timestamp, two unknown-age markers, `escalated`/`default-applied`/`fresh`, declared `>=` comparator and thresholds, pure `evaluateOwnerGateSla`, zero digest-side writes.
- **Consumers**: [feature-brief.md](../../../spec/features/feature-brief.md) (same collector state, sections consumed by id), [feature-verify-gates.md](../../../spec/features/feature-verify-gates.md) (reuses `STATUS_CI_RESULTS`, `STATUS_OWNER_ATTENTION_LABELS`, `STATUS_SOURCE_PIPELINE_LIMIT` by reference).
- **Architecture decisions**: [ADR-0003](../../../decisions/ADR-0003-oss-monorepo-structure.md) (tiers and runtime-API locations), [ADR-0004](../../../decisions/ADR-0004-workitem-activity-timestamp-additive-v1.md) (absent activity timestamp is unknown, never fabricated), [ADR-0006](../../../decisions/ADR-0006-workitem-custom-fields-and-comment-omission-representation.md) (custom-field omission and assignee-non-signal; absence is unknown **at the source-declaration level** — DEC-13 names the assertions as the consumer that makes item-level absence inside a declared, available signal a convention violation).
- **Testing strategy**: [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) — `bun:test`, `tests/{structure,behaviour,golden,checks,boundaries}`, permanent-suite rules (no branch-diff assertions; goldens regenerated deliberately, never blanket-rewritten), module→test mapping.
- **TypeScript rules**: [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md) — strict typing, purity, ports and adapters, error contract, `bun:test` authoring.
- **Existing evidence model** (extended, not replaced): `tests/structure/{status-contract,status-imports,content-inventory}.test.ts` + `tests/structure/inventory.json`; `tests/behaviour/{status-command,status-section-states,status-tracker,status-changes-ci,status-providers-parked,status-repository,status-negative-controls,status-readonly-determinism,status-output,status-corpus,status-performance,status-live}.test.ts`; `tests/golden/status-digest.test.ts`; `tests/fixtures/status/{harness.ts,matrix/cases.ts,corpus/**,golden/**}`; provider read side `tests/behaviour/providers/{github-collection,github-trap}.test.ts` and `tests/structure/trap-catalog.test.ts`; consumer baselines `tests/{structure/brief-contract,behaviour/brief-*,golden/brief,behaviour/queue-ready-*,golden/queue-ready,behaviour/verify-gates-*,golden/verify-gates}.test.ts`.

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Criterion (abbreviated) | TC ID(s) | Status |
|-------|--------------------------|----------|--------|
| AC-F1-1 | Every finding carries a registry `code` and a closed-set `severity`; zero free-form identities | TC-ATT-001, TC-ATT-005 | Covered |
| AC-F2-1 | Four failed primary-branch runs → exactly one `ci.red-on-main`, `count: 4`, four bounded unique members, deterministic `evidenceRef` | TC-ATT-006 | Covered |
| AC-F2-2 | More same-code observations than the member cap, including repeated identities → exact `count`, at most the cap of unique members in fixed ranking order, `evidenceRef` = first deduplicated member, drop declared | TC-ATT-007 | Covered |
| AC-F2-3 | Mixed severities/counts rank severity → count desc → code ascending → first occurrence, stable under permutation | TC-ATT-009 | Covered |
| AC-F2-4 | A test-only registry extension at the pure aggregation layer producing more distinct codes than the cap renders exactly eight findings in rank order with the drop declared | TC-ATT-008 | Covered |
| AC-F2-5 | A failed or unresolved CI read emits no finding; `unknown` state and evidence reasons carry the failure; no fabricated `ci.red-on-main` | TC-ATT-042 | Covered |
| AC-F3-1 | One observed-approval non-draft PR is `merge-ready` and ranks above all `review-pending`; numeric-aware ref keys | TC-ATT-022 | Covered |
| AC-F3-2 | Unknown/unavailable review signals → `review-pending` with unknown marker, section `degraded`, merge-ready renders `?` | TC-ATT-023, TC-ATT-024 | Covered |
| AC-F4-1 | Three named assertions (`epic-membership`, `story-points`, `in-sprint`) with declared-available fixtures render tri-state counts | TC-ATT-011 | Covered |
| AC-F4-2 | No conforming value inside a declared-available signal → violation: no `epic`/`epic:` label, no `points:` label or unparseable integer, no mapped milestone; each emitted as its code and grouped | TC-ATT-012 | Covered |
| AC-F4-3 | Undeclared signal, including the mixed case → that assertion all-unknown with `signal-unavailable` and zero violations while declared assertions evaluate independently | TC-ATT-013 | Covered |
| AC-F4-4 | Conforming values (`epic`/`epic:` label, `points:` integer, mapped milestone) → satisfied, no finding, no violation count | TC-ATT-041 | Covered |
| AC-F5-1 | Hand-back older than 24 h carries age and `slaState: escalated`, counted by the finding and by `gates <n> escalated` | TC-ATT-014 | Covered |
| AC-F5-2 | Absent/unparseable timestamp → declared unknown-age marker, `escalated`, never zero or fresh | TC-ATT-015 | Covered |
| AC-F6-1 | Recorded parked condition rendered under the detail cap; absent condition never invented | TC-ATT-016 | Covered |
| AC-F6-2 | Unknown-age parked entry with no condition contributes to grouped `parked.stale-no-condition` | TC-ATT-017 | Covered |
| AC-F7-1 | Lanes section reports shipped not-delivered evidence, vocabulary present as contract data, `lane.idle-no-reason` never emitted | TC-ATT-018 | Covered |
| AC-F8-1 | Spend section `not-delivered` naming capability and M1-S19 with zero items; human `spend` line renders | TC-ATT-019 | Covered |
| AC-F9-1 | Blockers section `not-delivered` naming capability and M1-S16 with zero items; human `blockers` line renders | TC-ATT-020 | Covered |
| AC-F10-1 | Human mode matches the extended grammar line-for-line (nine lines + optional header + grouped attention rollup), within 32 defensive lines / 6144 operative bytes, byte-identical to golden | TC-ATT-026, TC-ATT-027, TC-ATT-028, TC-ATT-034 | Covered |
| AC-NFR-1 | Corpus meta-check requires nine sections × every derivation-row state plus the absence-based hygiene, satisfied-arm, no-evidence, and grouping cases; corruption fails by case name | TC-ATT-033 | Covered |
| AC-NFR-2 | All new surfaces at cap serialize within 65 536 bytes with exact truncation markers, verified by an all-caps corpus case | TC-ATT-029 | Covered |
| AC-NFR-3 | At most 3 network reads, 1 park fold, 1 config resolve; zero new reads for new sections, findings, and mapped hygiene signals | TC-ATT-030 | Covered |

**Ticket-AC traceability (verbatim, binding).**

| Ticket AC | Covered by | How the plan proves it |
|---|---|---|
| 1. Each new collector is artifact-verified and bounded | TC-ATT-007, TC-ATT-008, TC-ATT-025, TC-ATT-028, TC-ATT-029, TC-ATT-033, TC-ATT-034 | Corpus + golden extension (nine sections, five states, grouping, absence-based hygiene, all-caps), a cap and truncation case on every new item surface (members, findings, ready items), the raised human bounds with an operative byte case, and the all-caps 64 KiB case |
| 2. Ticket-hygiene assertions are covered by name (epic membership, story points, in-sprint state) | TC-ATT-011, TC-ATT-012, TC-ATT-013, TC-ATT-041 | Named assertion surfaces with tri-state counts; absence-as-violation for each named convention under declared availability; satisfied arm; undeclared-signal all-unknown path; mapped provenance from the existing page |
| 3. Every finding carries a stable finding code | TC-ATT-001, TC-ATT-005, TC-ATT-010, TC-ATT-036, TC-ATT-042 | Closed registry pinned as contract data; a corpus-wide sweep asserts every emitted finding's code ∈ registry and severity = registry default; no free-form identity and no finding from a failed read can pass |
| 4. Ready-to-merge ranks as an action list | TC-ATT-022, TC-ATT-023, TC-ATT-025 | merge-ready first, then queue-ready rank keys, capped and truncated; degraded/unknown inputs render `?` rather than a fabricated number |

**Capability coverage** (no capability unlinked): F-1 → TC-ATT-001, 005, 010; F-2 → 006, 007, 008, 009, 042; F-3 → 022, 023, 024, 025; F-4 → 011, 012, 013, 041; F-4a → 004, 012, 013, 041 (and the read-budget proof in 030); F-5 → 014, 015; F-6 → 016, 017; F-7 → 018; F-8 → 019, 021; F-9 → 020, 021; F-10 → 026, 027, 028, 034.

All 23 ACs are covered by at least one scenario; none is TODO and none is deferred. Section 3.1's forward map is mirrored by each scenario's `Related IDs` line and by the reverse map in §5.1.

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

The specification declares no `API-#` and no endpoint (§8.1) and no event (§8.2): the digest writes no records, and the SLA decision record remains the board's owned write, explicitly *not* performed here.

| Interface / data model | Description | TC ID(s) | Status |
|------------------------|-------------|----------|--------|
| DM-1 — finding-code registry | Closed code → default severity + meaning map, declared beside the existing bounds and label sets | TC-ATT-001, TC-ATT-005, TC-ATT-018, TC-ATT-036 | Covered |
| DM-2 — severity vocabulary | Closed `high`/`medium`/`low` set as contract data | TC-ATT-001, TC-ATT-005 | Covered |
| DM-3 — section set 6 → 9 | Fixed order with sections 1–6 frozen in id, order, state derivation, and required fields; only DEC-16's optional-field allowlist may be added | TC-ATT-003, TC-ATT-021, TC-ATT-037 | Covered |
| DM-4 — section `findings[]` | Optional additive per-section array `{code, severity, count, members[], evidenceRef}`; unique deduplicated members in rank order; `evidenceRef` = first member; count = exact observation total; capped at 8 as defensive headroom; overflow declared; failed read emits no finding | TC-ATT-005, TC-ATT-007, TC-ATT-008, TC-ATT-009, TC-ATT-042 | Covered |
| DM-5 — ready-to-merge section | Uniform section shape; item fields `ref`, `class`, `sourceRef`, `targetRef`, `reviewState`, `ciResult`; declared state row | TC-ATT-022, TC-ATT-023, TC-ATT-024, TC-ATT-025 | Covered |
| DM-6 — placeholder section shape | `not-delivered` + capability + expectedStory + `engine-not-delivered` + note; zero items/counts | TC-ATT-018, TC-ATT-019, TC-ATT-020, TC-ATT-021 | Covered |
| DM-7 — hygiene assertion counts | Additive tri-state counts for `epic-membership`, `story-points`, `in-sprint`, gated by the declared per-assertion availability; violation = absence of a conforming value inside a declared-available signal; existing title/label findings unchanged but coded | TC-ATT-010, TC-ATT-011, TC-ATT-012, TC-ATT-013, TC-ATT-041 | Covered |
| DM-8 — hand-back additive fields | `age`, `ageUnknownReason`, `slaState` | TC-ATT-014, TC-ATT-015 | Covered |
| DM-9 — parked `condition` | Additive optional item field bounded by the existing detail cap | TC-ATT-016, TC-ATT-017 | Covered |
| DM-10 — extended human grammar | Exact lines, tracker fragments, rollup; golden-pinned | TC-ATT-026, TC-ATT-027, TC-ATT-028, TC-ATT-034 | Covered |
| DM-11 — bounds additions | Findings 8, members 8, ready items 8; human lines 32, bytes 6144; machine 65 536 unchanged | TC-ATT-002, TC-ATT-007, TC-ATT-008, TC-ATT-025, TC-ATT-028, TC-ATT-029 | Covered |
| DM-12 — summary additions | Grouped findings total and placeholder-section count (exactly 2: `spend`, `blockers`; lanes excluded) under the observed/degraded contribution rule | TC-ATT-021, TC-ATT-003 | Covered |
| DM-13 — hygiene mapped-signal extension | Declared per-assertion availability on the tracker read plus per-item mapped values from the same bounded page: normalized label set (epic `epic`/`epic:`; points `points:` + non-negative integer) and the additively normalized milestone; no new endpoint, package, subpath, or pagination; production all-unknown where undeclared | TC-ATT-004, TC-ATT-012, TC-ATT-013, TC-ATT-041, TC-ATT-030 | Covered |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement | TC ID(s) | Status |
|--------|-------------|----------|--------|
| NFR-1 | Every new item surface bounded with explicit truncation (findings 8, members 8, ready 8) | TC-ATT-007, TC-ATT-008, TC-ATT-025, TC-ATT-029 | Covered |
| NFR-2 | Human bounds: 32 lines defensive headroom (worst case 11), 6144 bytes operative — enforced and golden-pinned plus a max-length stress case | TC-ATT-002, TC-ATT-028, TC-ATT-034 | Covered |
| NFR-3 | Serialized `data` ≤ 65 536 bytes with all additive surfaces at cap | TC-ATT-029 | Covered |
| NFR-4 | Read budget unchanged: ≤3 network reads, 1 park fold, 1 config resolve, zero retries | TC-ATT-030 | Covered |
| NFR-5 | Aggregation ≤50 ms over cap-sized inputs with the enlarged output | TC-ATT-039 | Covered |
| NFR-6 | Determinism: identical inputs → identical bytes; rank keys total and order-independent | TC-ATT-009, TC-ATT-032 | Covered |
| NFR-7 | Read-only: zero writes, fences, mutations, network writes, child processes; no SLA records | TC-ATT-004, TC-ATT-031 | Covered |
| NFR-8 | Code stability: closed registry; 100% of findings coded; zero free-form identities | TC-ATT-001, TC-ATT-005 | Covered |
| NFR-9 | Evidence hygiene: identities, counts, codes only; no titles/payloads/secrets/free text | TC-ATT-036 | Covered |
| NFR-10 | Artifact verification: corpus 9×5 meta-check plus byte-identical golden grammar pins | TC-ATT-033, TC-ATT-034 | Covered |

All ten NFRs are covered and measured; none is TODO or deferred.

## 4. Test Types and Layers

| Layer / evidence level | Runner / invocation | Location | Covers |
|------------------------|--------------------|----------|--------|
| Structure — findings/placeholder contract binding (`structure`) | `bun test tests/structure/status-findings-contract.test.ts` | new `tests/structure/status-findings-contract.test.ts`, `tests/structure/inventory.json` | TC-ATT-001, TC-ATT-018 |
| Structure — extended contract and bounds (`structure`) | `bun test tests/structure/status-contract.test.ts` | extended `tests/structure/status-contract.test.ts` | TC-ATT-002, TC-ATT-003 |
| Structure — purity/tier/inventory (`structure`) | `bun test tests/structure/status-imports.test.ts`, `bun test tests/structure/content-inventory.test.ts`, `bun test tests/boundaries` | extended structure suites; unchanged rules | TC-ATT-004 |
| Behaviour — findings layer (`behaviour`) | `bun test tests/behaviour/status-findings.test.ts` | new file + `tests/fixtures/status/harness.ts` builders + `matrix/cases.ts` | TC-ATT-005, TC-ATT-006, TC-ATT-007, TC-ATT-009, TC-ATT-010 |
| Behaviour — no-evidence-no-claim (`behaviour`, `negative-control`) | `bun test tests/behaviour/status-findings.test.ts`, `bun test tests/behaviour/status-negative-controls.test.ts` | new case in the findings suite + extended negative matrix | TC-ATT-042 |
| Behaviour — hygiene assertions (`behaviour`) | `bun test tests/behaviour/status-hygiene.test.ts` | new file + absence-based and satisfied-arm corpus fixtures | TC-ATT-011, TC-ATT-012, TC-ATT-013, TC-ATT-041 |
| Behaviour — owner-gate age (`behaviour`) | `bun test tests/behaviour/status-owner-gate-age.test.ts` | new file + injected-clock fixtures | TC-ATT-014, TC-ATT-015 |
| Behaviour — parked conditions (`behaviour`) | `bun test tests/behaviour/status-parked-conditions.test.ts` | new file + corpus fixtures | TC-ATT-016, TC-ATT-017 |
| Behaviour — ready-to-merge (`behaviour`) | `bun test tests/behaviour/status-ready-to-merge.test.ts` | new file + queue-ready comparison harness | TC-ATT-022, TC-ATT-023, TC-ATT-024 |
| Behaviour — placeholders and totality (`behaviour`) | `bun test tests/behaviour/status-placeholders.test.ts`, `bun test tests/behaviour/status-section-states.test.ts` | new file; extended `status-section-states.test.ts` | TC-ATT-019, TC-ATT-020, TC-ATT-021, TC-ATT-025 |
| Behaviour — caps and truncation (`behaviour`, `negative-control`) | `bun test tests/behaviour/status-findings-bounds.test.ts` | new file + `tests/fixtures/status/matrix/bounds/**` | TC-ATT-008, TC-ATT-007 (over-cap half), TC-ATT-025 (over-cap half) |
| Behaviour — human grammar and rollup (`behaviour`, `golden`) | `bun test tests/behaviour/status-output.test.ts` | extended `status-output.test.ts` | TC-ATT-026, TC-ATT-027, TC-ATT-028 |
| Behaviour — machine bound (`behaviour`, `corpus`) | `bun test tests/behaviour/status-output.test.ts`; corpus case `all-caps-bound` | extended file + `tests/fixtures/status/corpus/all-caps-bound/**` | TC-ATT-029 |
| Behaviour — read budget (`behaviour`) | `bun test tests/behaviour/status-performance.test.ts` | extended `status-performance.test.ts` | TC-ATT-030 |
| Behaviour — read-only and determinism (`behaviour`) | `bun test tests/behaviour/status-readonly-determinism.test.ts` | extended file + `guarded` store from `tests/behaviour/verify-support.ts` | TC-ATT-031, TC-ATT-032 |
| Corpus (`corpus`) | `bun test tests/behaviour/status-corpus.test.ts` | extended `status-corpus.test.ts` + `tests/fixtures/status/corpus/**` | TC-ATT-033, plus AC-NFR-2 oracle |
| Golden (`golden`) | `bun test tests/golden/status-digest.test.ts` | extended file + `tests/fixtures/status/golden/**` | TC-ATT-034 |
| Behaviour — negative controls (`negative-control`) | `bun test tests/behaviour/status-negative-controls.test.ts` | extended `status-negative-controls.test.ts` + named control matrix | TC-ATT-035, TC-ATT-036 |
| Behaviour — non-regression (`behaviour`) | `bun test tests/behaviour/status-*.test.ts`, `bun test tests/golden/status-digest.test.ts` | existing suites, unchanged expectations | TC-ATT-037 |
| Consumer non-regression (`behaviour`, `structure`) | `bun test tests/{structure,behaviour,golden}/brief*.test.ts`, `queue-ready*.test.ts`, `verify-gates*.test.ts` | existing suites | TC-ATT-038 |
| Performance (`performance`) | `bun test tests/behaviour/status-performance.test.ts` | extended performance suite + cap-sized fixtures | TC-ATT-039 |
| Live smoke (`live-smoke`, opt-in, not in aggregate) | `bun test tests/behaviour/status-live.test.ts` with the test-only switch and a resolvable credential | extended `status-live.test.ts` | TC-ATT-040 |
| Provider read side (unchanged) | `bun test tests/behaviour/providers/{github-collection,github-trap}.test.ts`; `bun test tests/structure/trap-catalog.test.ts` | existing suites | supports TC-ATT-006, TC-ATT-030 (no new endpoint, no new trap entry) |
| Aggregate | `pnpm check`; `git diff --check`; `git status --porcelain` | repo root | all TCs |

### 4.1 In-Process Status Harness Contract (binding for every behaviour TC)

1. **One harness, no spawned processes.** Every behaviour test builds the `status` command definition through `createStatusCommandDefinition` and calls `runStatusCli` in process (`tests/fixtures/status/harness.ts`), injecting brand, clock, repository facts, the three reads, provider facts, local context, and streams. No status suite spawns a child process.
2. **Injected facts and time.** Facts are built with `makeWorkItem`, `makeDeliveryRequest`, `pipelineRunRead`, `providerConfig`, `parkView`, `localContext` and the new builders. The clock is `NOW_MS` unless a case advances it deliberately. No test reads `$HOME`, the wall clock, the real state directory, the network, or the ambient environment where purity is asserted.
3. **Deterministic identities.** Fixed run id, fixed `generatedAt`, `SYNTHETIC_BRAND`, and fixed SHA/owner/name placeholders so machine and human bytes are comparable across runs and across fixtures.
4. **One oracle per case.** Every case asserts (a) the section state and evidence reasons, (b) counts, (c) ordered item identities, (d) findings tuples (code, severity, exact count, unique member identities in rank order, `evidenceRef` = first member), (e) the truncation flag/omitted count, and (f) the human fragment where the case touches grammar. A case asserting only "rendered" is insufficient.
5. **Recording seams.** The transport records every request (method, URL, `per_page`) and throws on an unfixtured URL or a second page; provider-engine `resolve`/`quota` stubs record calls; a child-process sentinel proves zero spawns; a guarded state store (`guardStore`) records `append`/`acquireFence` and throws on a mutation a read-only case forbids.
6. **One registry, never mutated.** Contract data is imported, not duplicated. Mutation controls use deep copies in memory or temp module copies; the shipped registry, bounds, and grammar literals are never edited by a test. The single exception the spec permits is the **test-only registry extension** injected at the pure aggregation layer for the defensive findings-cap case (DEC-15); it lives in the test tree, is never exported to production, and the production registry is re-read and asserted unchanged.
7. **No handler stream writes.** The handler returns the digest; the CLI edge renders. Tests assert the handler writes nothing and rendering performs zero extra reads.
8. **Mapped hygiene signals are injected, not discovered.** Fixtures supply the declared per-assertion availability on the tracker read result and the mapped values (labels, milestone) on the items. A test never derives a hygiene signal from a title, an assignee, an unmapped field, or the absence of a declaration; the shipped GitHub-slice availability variant is exercised explicitly.

### 4.2 Non-Vacuity Contract (binding for every negative, matrix, boundary, and bound scenario)

- Every negative fixture carries a distinctive `planted-status-*` canary (title, body, note, condition, or provider payload) and the builder asserts the intended fact is present before the digest is built; the canary must not appear in stdout, stderr, the payload, evidence, findings, or human text.
- Every negative is paired with a restored control reaching the expected success shape through the same invocation path.
- Every unknown case is paired with a zero case (unknown age vs `0h`; unknown review vs observed review; undeclared assertion signal vs observed-empty population), so the two representations cannot collapse.
- Every hygiene arm is paired with its neighbours in the same suite: absence (violation) vs declared-conforming (satisfied) vs undeclared (unknown) for the *same* item shape, so a regression that moves one item between arms fails by name.
- Every cap fixture has under-cap, at-cap, and over-cap controls in the same test; the under-cap control must carry no truncation mark and `omitted: 0`. Member-cap fixtures include a repeated identity so `count > members.length` is exercised rather than asserted by construction.
- Every pinned datum (code, severity, cap, human bound, marker, reason, class, rank key) is mutation-controlled and fails by name; the unmutated control is green.
- Every read-only assertion is paired with a seeded write the guard detects; every no-live-call assertion is paired with a guard that would throw on a call.
- Every determinism assertion is paired with a changed-fact control producing different bytes, and with a permutation twin producing identical bytes.
- Every golden assertion is paired with a changed-fact control that fails the comparison, and with a read-only control proving the suite cannot rewrite the golden.

### 4.3 Evidence Levels (declared ladder used by every TC)

| Level | Meaning |
|---|---|
| `structure` | Contract data, constants, bounds, purity, tier, inventory, error-identity and literal checks; no digest is rendered |
| `behaviour` | In-process aggregation/render over injected facts with per-case section, item, and finding oracles |
| `golden` | Byte-for-byte comparison against committed machine and human fixtures, with a live mutation control |
| `corpus` | Committed case corpus plus the completeness meta-check, failing by case name |
| `performance` | Measured latency and read-count bounds with warm-up, median, and a deliberately expensive control |
| `negative-control` | Named negative matrix where each case must fail the invariant, paired with a restored control |
| `live-smoke` | Opt-in, credentialed, structural-invariants-only; outside the aggregate check |

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Impact | Priority | Evidence level | AC / NFR |
|-------|-------|------|--------|----------|----------------|----------|
| TC-ATT-001 | Finding-code registry, severity set, and code→surface map pinned as closed contract data | Regression | Critical | High | structure | AC-F1-1, DM-1, DM-2, NFR-8 |
| TC-ATT-002 | Declared bounds additions and raised human bounds bind exactly | Regression | Critical | High | structure | DM-11, NFR-1, NFR-2, Appendix B |
| TC-ATT-003 | Section set 6 → 9 additive; schema version stays `delivery.status.v1`; no removal, re-type, or reorder | Regression | Critical | High | structure | DM-3, DEC-1, AC-F10-1 |
| TC-ATT-004 | Extended modules are pure, tier-clean, inventory-registered; no new package or subpath | Regression | Critical | High | structure | NFR-7, ADR-0003, §16 |
| TC-ATT-005 | Every emitted finding carries a registry code and registry severity; zero free-form identities | Regression | Critical | High | corpus + behaviour | AC-F1-1, NFR-8 |
| TC-ATT-006 | Pinned grouping: four failed primary-branch runs → one `ci.red-on-main`, count 4, four members | Happy Path | Critical | High | behaviour | AC-F2-1, F-2, DEC-3 |
| TC-ATT-007 | Member cap: exact observation count, unique deduplicated members, `evidenceRef`, declared drop | Corner Case | Critical | High | behaviour | AC-F2-2, NFR-1, DM-4, DEC-17 |
| TC-ATT-008 | Defensive findings-per-section cap enforced at the pure aggregation layer | Corner Case | Important | Medium | behaviour | AC-F2-4, NFR-1, DM-4, DEC-15 |
| TC-ATT-009 | Total findings rank key and permutation invariance | Regression | Critical | High | behaviour | AC-F2-3, NFR-6 |
| TC-ATT-010 | Existing findings become code-carrying with unchanged trigger, counts, and rank behaviour | Regression | Critical | High | behaviour | F-1, F-4, DM-7, Appendix A |
| TC-ATT-011 | Three named hygiene assertions with tri-state per-item counts under declared availability | Happy Path | Critical | High | behaviour | AC-F4-1, DM-7, DEC-13 |
| TC-ATT-012 | Absence-as-violation per assertion: no `epic`/`epic:` label, no/invalid `points:` label, no milestone | Negative | Critical | High | behaviour | AC-F4-2, DEC-13, DM-13 |
| TC-ATT-013 | Undeclared signal (including mixed) → that assertion all-unknown with `signal-unavailable` | Negative | Critical | High | behaviour + corpus | AC-F4-3, DEC-13, DEC-14 |
| TC-ATT-014 | Owner-gate age, `slaState`, escalated finding, and tracker `gates <n>` fragment | Happy Path | Critical | High | behaviour | AC-F5-1, DM-8, DEC-6 |
| TC-ATT-015 | Unknown gate age: declared marker, escalated, never zero or fresh | Corner Case | Critical | High | behaviour | AC-F5-2, ADR-0004 |
| TC-ATT-016 | Parked condition projected under the detail cap; absence never invented | Happy Path | Important | High | behaviour | AC-F6-1, DM-9 |
| TC-ATT-017 | `parked.stale-no-condition` grouping with both negative controls | Edge Case | Important | High | behaviour + corpus | AC-F6-2, DEC-12 |
| TC-ATT-018 | Lanes section unchanged; closed vocabulary declared; dormant code never emitted | Regression | Critical | High | structure + behaviour | AC-F7-1, DEC-7, DEC-17 |
| TC-ATT-019 | Spend placeholder section and human line | Happy Path | Important | High | behaviour + corpus | AC-F8-1, DM-6 |
| TC-ATT-020 | Blockers placeholder section and human line | Happy Path | Important | High | behaviour + corpus | AC-F9-1, DM-6 |
| TC-ATT-021 | Nine-section totality, placeholder count exactly 2, grouped findings total, zero contribution | Regression | Critical | High | behaviour + structure | DM-3, DM-12, DEC-17 |
| TC-ATT-022 | Ready-to-merge classification and ranking above review-pending, zero new reads | Happy Path | Critical | High | behaviour | AC-F3-1, DM-5, DEC-5, RSK-8 |
| TC-ATT-023 | Unknown/unavailable review signals: `review-pending`, degraded, `merge-ready ?` | Negative | Critical | High | behaviour + corpus | AC-F3-2, NFR-9 |
| TC-ATT-024 | Ready-to-merge derivation row complete; never `not-delivered`; verified-empty is a real zero | Regression | Critical | High | behaviour + structure | AC-F3-2, Appendix C, DM-5 |
| TC-ATT-025 | Ready-to-merge item cap and truncation; merge-ready never dropped behind review-pending | Corner Case | Important | High | behaviour | NFR-1, DM-5 |
| TC-ATT-026 | Extended human grammar line-for-line: nine lines, optional header, tracker fragments | Happy Path | Critical | High | behaviour + golden | AC-F10-1, DM-10 |
| TC-ATT-027 | Attention rollup: zero case, 1–3 groups, `+N` grouped findings, severity order | Edge Case | Important | High | behaviour | F-10, DM-10, DEC-17 |
| TC-ATT-028 | Human bounds: 32 defensive lines, 6144 operative bytes, max-length stress, stale clamp retired | Regression | Critical | High | behaviour + golden | NFR-2, DM-11, DEC-17 |
| TC-ATT-029 | Machine bound 65 536 bytes with all new surfaces at cap, via the all-caps corpus case | Corner Case | Critical | High | corpus + behaviour | AC-NFR-2, NFR-3, RSK-7 |
| TC-ATT-030 | Read budget unchanged: 3 network reads, 1 park fold, 1 config resolve, zero new reads | Regression | Critical | High | performance | AC-NFR-3, NFR-4, DEC-5, DM-13 |
| TC-ATT-031 | Read-only posture: zero writes, fences, mutations, child processes, SLA records | Regression | Critical | High | behaviour | NFR-7, §21 |
| TC-ATT-032 | Determinism: byte-identical output across repeated and permuted runs | Regression | Critical | High | behaviour | NFR-6, AC-F2-3 |
| TC-ATT-033 | Corpus completeness meta-check extended to nine sections × five states and the new case classes | Regression | Critical | High | corpus | AC-NFR-1, NFR-10, G-8 |
| TC-ATT-034 | Golden fixtures regenerated deliberately once, byte-identical, never rewritten by the suite | Regression | Critical | High | golden | AC-F10-1, NFR-10 |
| TC-ATT-035 | Expanded negative controls: failed new-section reads never green/zero; nothing fabricated | Negative | Critical | High | negative-control | AC-F2-5, AC-F3-2, AC-F5-2, AC-F7-1, NFR-1 |
| TC-ATT-036 | Evidence hygiene: unique identities, counts, codes only; no titles, payloads, secrets | Negative | Critical | High | negative-control | NFR-9, §20, §21 |
| TC-ATT-037 | Six-section non-regression against DEC-16's enumerated optional-field allowlist | Regression | Critical | High | behaviour + golden | DEC-1, DEC-16, §8.5 |
| TC-ATT-038 | Consumer compatibility: brief, command registry, queue ready, verify gates | Regression | Important | High | behaviour + structure | RSK-1, RSK-9, §8.5 |
| TC-ATT-039 | Aggregation ≤50 ms over enlarged cap-sized inputs | Regression | Important | Medium | performance | NFR-5 |
| TC-ATT-040 | Opt-in live smoke: nine-section structural invariants only | Happy Path | Minor | Low | live-smoke | QA strategy, NFR-1/2/9 |
| TC-ATT-041 | Hygiene satisfied arm: conforming epic/points values and mapped milestone satisfy, silently | Happy Path | Critical | High | behaviour | AC-F4-4, DM-7, DM-13 |
| TC-ATT-042 | No-evidence-no-claim: failed or unresolved CI read emits no finding | Negative | Critical | High | behaviour + negative-control | AC-F2-5, DEC-18, DM-4 |

All forty-two TCs are automated except TC-ATT-040, which is opt-in and outside the aggregate check. Every TC is non-vacuous per §4.2; the controls are named inside each scenario.

### 5.2 Scenario Details

#### TC-ATT-001 - Finding-code registry, severity set, and code→surface map pinned as closed contract data

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, DM-1, DM-2, NFR-8, DEC-2, Appendix A
**Test Type(s)**: Structure, Contract
**Automation Level**: Automated
**Evidence Level**: structure
**Target Layer / Location**: `tests/structure/status-findings-contract.test.ts`, `tests/structure/inventory.json`
**Tags**: @backend @golden

**Preconditions**:

- The registry module exports only `as const` data and types, imported through the shared contracts subpath.
- Appendix A is the read-only oracle; a deep-copy mutation harness exists; the live registry is never mutated.
- The status contracts module remains data-only per the existing `status-contract.test.ts` detector.

**Steps**:

1. Assert the registry's key set is exactly the ten Appendix A codes in declared order: `ci.red-on-main`, `tracker.owner-gate-escalated`, `tracker.stalled-ticket`, `tracker.hygiene.missing-title`, `tracker.hygiene.missing-labels`, `tracker.hygiene.epic-membership`, `tracker.hygiene.story-points`, `tracker.hygiene.in-sprint`, `lane.idle-no-reason`, `parked.stale-no-condition`.
2. Assert each entry carries a default severity and a non-empty meaning; assert per-code defaults are `high`, `high`, `medium`, `low`, `low`, `low`, `low`, `low`, `medium`, `low` respectively.
3. Assert the severity vocabulary is exactly `["high","medium","low"]` in declared order and that no entry declares a severity outside it.
4. Assert every code matches the declared namespaced lowercase dotted form (`<surface>.<finding>`, optional third segment for the hygiene family); assert no code contains whitespace, uppercase, or a free-form sentence.
5. Assert `lane.idle-no-reason` is present with severity `medium` and is marked dormant (the declared dormant marker or dormant code list); assert it is the only dormant code.
6. Assert the code→trigger-surface map declares each code's owning section and that all ten codes map to declared section ids (`ci`, `tracker`, `lane-or-queue`/lanes, `parked-work`); assert no code maps to a non-existent section.
7. Assert the registry module is data-only and registered in `tests/structure/inventory.json` with no executable allowance beyond declarations.
8. Mutation controls on a deep copy: drop a code, add an eleventh code, rename a code, change a severity to `critical` or `info`, remove the dormant marker, point a code at an undeclared section — each must fail the corresponding assertion by name; the unmutated registry is green.

**Expected Outcome**:

- The closed ten-code registry, three-value severity set, declared defaults, dormant declaration, and surface map are pinned as contract data. Any drift fails by name, and a code that is not in the registry cannot be emitted by a type-correct implementation.

#### TC-ATT-002 - Declared bounds additions and raised human bounds bind exactly

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-1, NFR-2, DM-11, Appendix B, DEC-11
**Test Type(s)**: Structure, Contract
**Automation Level**: Automated
**Evidence Level**: structure
**Target Layer / Location**: extended `tests/structure/status-contract.test.ts`, `tests/structure/inventory.json`
**Tags**: @backend

**Preconditions**:

- The pre-change bounds table is the baseline; the spec's Appendix B is the oracle.
- The existing constants-binding test pattern (Appendix C vocabulary assertions plus per-constant mutation controls) is reused.

**Steps**:

1. Assert `STATUS_MAX_SECTION_FINDINGS = 8`, `STATUS_MAX_FINDING_MEMBERS = 8`, and `STATUS_MAX_READY_ITEMS = 8` (names delivery-bound; values pinned).
2. Assert `STATUS_MAX_HUMAN_LINES = 32` and `STATUS_MAX_HUMAN_BYTES = 6144`; assert the old values `24` and `4096` no longer appear as the digest's enforced bounds anywhere in the contracts or renderer.
3. Assert `STATUS_MAX_MACHINE_BYTES = 65536` is unchanged, and assert every pre-existing cap is unchanged: items per section 8, tracker family 4, evidence sources 6, reasons 6, provider entries 8, provider parks 8, pipeline runs 8, open pull requests 8, parked changes 8, source item limit 100, source pipeline limit 20, title 120, detail 160, stall threshold 14 days.
4. Assert the schema version constant is still `delivery.status.v1` and no version-like string was added or renamed.
5. Assert the constants are declared once in the contracts tier and are not duplicated in the domain, CLI, or fixtures (source scan for a duplicate numeric literal bound to a status cap).
6. Mutation controls: change each new value to 7, 9, 31, 6143, 6145, 65535, 65537 — each must fail by constant name; change a pre-existing cap and assert it fails by name; the unmutated set is green.

**Expected Outcome**:

- The new caps and raised human bounds are pinned exactly, the machine bound and every pre-existing cap are unchanged, and no duplicate or stale bound survives anywhere in the tree.

#### TC-ATT-003 - Section set 6 → 9 additive; schema version stays `delivery.status.v1`; no removal, re-type, or reorder

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: DM-3, DEC-1, DEC-16, DEC-17, NG-7, §8.5
**Test Type(s)**: Structure, Contract, Types
**Automation Level**: Automated
**Evidence Level**: structure
**Target Layer / Location**: extended `tests/structure/status-contract.test.ts`, `tests/types/**` backward-compatibility probe
**Tags**: @backend

**Preconditions**:

- The pre-change section-order constant and digest type are the baseline.
- A type-level probe written against the pre-change digest shape (sections 1–6 required fields only) exists as the backward-compatibility oracle.
- DEC-16's optional-field allowlist and DEC-17's naming convention are the read-only oracles.

**Steps**:

1. Assert the declared section order is exactly `["tracker","changes-and-prs","ci","lanes-or-queue","providers","parked-work","ready-to-merge","spend","blockers"]`; assert the first six entries equal the pre-change order.
2. Assert every section id is unique, kebab-case, and a member of the declared order; assert no alias, legacy id, or camelCase section id exists; assert finding codes are lowercase dotted and constants are SCREAMING_SNAKE (`STATUS_MAX_FINDINGS_PER_SECTION`, `STATUS_MAX_FINDING_MEMBERS`, `STATUS_MAX_READY_ITEMS`) while new payload fields are camelCase (`evidenceRef`, `ageUnknownReason`, `slaState`, `placeholderSectionCount`).
3. Assert the schema version is `delivery.status.v1` and the payload declares no `schemaVersionMinor`-style addition that would imply a bump.
4. Assert the pre-change digest fields are still present with the same names and types (`schemaVersion`, `generatedAt`, `repository`, `summary`, `sections`); assert sections 1–6 keep their state derivation and required fields, using the type probe: a consumer reading only sections 1–6 and their pre-change item fields compiles and typechecks.
5. Assert the sections 1–6 delta is **exactly** DEC-16's optional-field allowlist: optional `findings[]` on every section; tracker hand-back item `age`, `ageUnknownReason`, `slaState`; hygiene per-assertion tri-state counts; parked item `condition`; lanes attention-state declaration fields. Assert optional (not required) typing for every allowlisted field and no other field added inside sections 1–6.
6. Assert the new sections 7–9 use the uniform section shape (state, evidence, counts, items, truncation) with no bespoke key.
7. Mutation controls: reorder two sections, rename a section, drop `spend`, bump the schema version, remove a pre-change field, add an undeclared field to `tracker`, make an allowlisted field required instead of optional, rename `evidenceRef` to snake_case — each fails by name; the unmutated contract is green.

**Expected Outcome**:

- The nine-section order is pinned with sections 1–6 frozen in ids, order, state derivation, and required fields; the only delta is DEC-16's optional-field allowlist; naming follows DEC-17; additive growth is proven in both directions.

#### TC-ATT-004 - Extended modules are pure, tier-clean, inventory-registered; no new package or subpath

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-7, §16, §21, ADR-0003, DM-13, DEC-14
**Test Type(s)**: Structure, Boundaries
**Automation Level**: Automated
**Evidence Level**: structure
**Target Layer / Location**: extended `tests/structure/status-imports.test.ts`, `tests/structure/content-inventory.test.ts`, `tests/boundaries/**`, `scripts/checks/{ambient-globals,forbidden-literals,workspace-entrypoints}.ts`
**Tags**: @backend

**Preconditions**:

- The unchanged `.dependency-cruiser.cjs` rule set and the ambient-globals scope.
- Runtime sentinels for `Date.now`, `new Date`, `Math.random`, `fetch`, `process.env`, `node:fs`, `node:child_process`, `setTimeout`.
- The existing inventory `executable` allowance model.
- The existing adapter normalization module that already maps the bounded issue page.

**Steps**:

1. Assert the status contracts module (extended with the registry, severities, bounds, new section ids, mapped-signal availability) remains data-only and the domain module imports only the contracts tier and its own modules.
2. Assert the domain does not import the CLI edge, adapters, state layer, provider engine, config, or branding; assert the findings, hygiene, and ready-to-merge builders are part of the same pure domain module family.
3. Assert the hygiene mapped-signal projection lives in the existing adapter normalization (label conventions and the milestone field) and not in the domain; assert the milestone field is additive on the work-item view and the label conventions are contract data, not inline literals.
4. Assert the domain and renderer source contain no `Date.now`, `new Date`, `Math.random`, `process.env`, `fetch`, `node:fs`, `node:child_process`, `setTimeout`, `setInterval`, or `setImmediate`; the AST check fails by name on a seeded occurrence.
5. Assert the SLA evaluator and its unknown-age marker set are imported **by reference** from the M1-S5 contracts/domain, not re-implemented; a duplicated threshold literal (`86400000`, `259200000`, `24`, `72`) in status sources fails by name.
6. Assert no new package, subpath, or `workspaceImports` edge is added; no new adapter endpoint, request builder, or pagination helper exists; `bun run scripts/checks/workspace-entrypoints.ts` is green.
7. Assert every new or changed module is registered in `tests/structure/inventory.json`; an unregistered module fails.
8. Assert `bun run scripts/checks/ambient-globals.ts`, `bun run scripts/checks/forbidden-literals.ts`, and `bun test tests/boundaries` are green including the fixture-coverage meta-check; no rule is added or weakened.
9. Control: install a sentinel and run the full aggregation; no sentinel fires. Seed a `Date.now` occurrence in a temp copy and assert the purity check fails; add a second request builder in a temp adapter copy and assert the entrypoint/read-shape check fails.

**Expected Outcome**:

- The extended status surface is a pure function of injected facts, imports the SLA vocabulary by reference, maps hygiene signals inside the existing normalization with no new endpoint or location, adds no new package/subpath, and stays inside every existing boundary and ambient gate.

#### TC-ATT-005 - Every emitted finding carries a registry code and registry severity; zero free-form identities

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-1, F-1, DM-1, DM-2, DM-4, NFR-8, DEC-17, DEC-18
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Evidence Level**: corpus + behaviour
**Target Layer / Location**: `tests/behaviour/status-findings.test.ts`, `tests/behaviour/status-corpus.test.ts` (corpus-wide sweep), `tests/fixtures/status/{harness.ts,matrix/cases.ts}`
**Tags**: @backend @golden

**Preconditions**:

- The full corpus (`tests/fixtures/status/corpus/**`) and matrix (`matrix/cases.ts`) populations, both extended by this change.
- The registry imported as data; a fixed clock and `generatedAt`.
- A deliberate fixture that produces at least one finding in each emitting section (tracker, ci, parked-work), plus a fixture set including a repeated identity.

**Steps**:

1. For every corpus case and every matrix case, aggregate and assert: each section's `findings` array (when present) contains only objects whose key set equals the declared DM-4 set (`code`, `severity`, `count`, `members`, `evidenceRef`).
2. Assert every `code` is a member of the registry and every `severity` equals the registry default for that code; assert severity ∈ the closed three-value set.
3. Assert `count` is an integer ≥ 1 and equals the number of coalesced observations for that code in that section (recomputed from the fixture facts by the test, not read from the payload); assert `count` may exceed `members.length` only when identities repeat.
4. Assert `members` is a bounded array of **unique** identity-shaped values (run identity, work-item ref, `PREFIX-number` ref, or the declared entry identity) with no title, body, condition text, or free-form sentence; assert no identity appears twice; assert `length ≤ STATUS_MAX_FINDING_MEMBERS`.
5. Assert `evidenceRef` equals the first member of `members` (the first deduplicated identity in the section's fixed rank order), and that it is a declared evidence reference shape, never a payload or message.
6. Assert no finding is emitted for a section whose state is `unknown`, `unavailable`, or `not-delivered`; assert an `observed` or `degraded` section may emit findings. This is no-evidence-no-claim (DEC-18); the dedicated failure case is TC-ATT-042.
7. Assert the human text contains no finding identity that is absent from the machine payload, and that every human attention token is `<registry-code>×<count>`.
8. Negative controls: inject a test-only section fixture carrying a finding with code `"ci.something-else"` (unregistered) and assert the sweep fails by case name; inject a severity `"critical"` and assert it fails; remove `code` and assert it fails; repeat a member identity and assert the uniqueness assertion fails. Restore and assert green.

**Expected Outcome**:

- Across the whole corpus every finding is registry-coded and registry-severity-weighted, counts are recomputable and exact, members are identities only, and no failure path can emit a finding.

#### TC-ATT-006 - Pinned grouping: four failed primary-branch runs → one `ci.red-on-main`, count 4, four members

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-1, F-2, DEC-3, DEC-17, DEC-18, Appendix A
**Test Type(s)**: Integration, Unit
**Automation Level**: Automated
**Evidence Level**: behaviour
**Target Layer / Location**: `tests/behaviour/status-findings.test.ts`, `tests/fixtures/status/{harness.ts,corpus/four-red-runs-grouped/**}`
**Tags**: @backend

**Preconditions**:

- Checkout on the declared primary branch (`main`), resolved SHA, one bounded check-runs page with 20-run limit.
- A run builder producing failed runs with distinct numeric identities and pipeline names.
- Fixed clock and `generatedAt`.

**Steps**:

1. Build the pinned fixture: four failed runs on `main`. Aggregate and assert the CI section state is `observed`, the CI classification is `failed` (unchanged), and the section carries exactly **one** finding.
2. Assert the finding is `code: "ci.red-on-main"`, `severity: "high"`, `count: 4`, and `members` has exactly four unique entries equal to the four run identities in the CI section's fixed rank order (severity then descending numeric identity then pipeline name).
3. Assert `evidenceRef` equals the first member; assert no second `ci.red-on-main` finding exists anywhere in the digest.
4. Assert the human rollup shows one `ci.red-on-main×4` group, not four groups; assert the CI section line is unchanged (`ci observed failed (4/4 jobs)` form).
5. Generality controls: with 1, 2, 3, and 4 failed runs assert `count` equals the number of failed runs and `members.length` equals it; with 0 failed runs assert no `ci.red-on-main` finding and no truncation mark.
6. Scale control: with 9 and 20 failed runs assert one finding with exact `count` and capped members (TC-ATT-007 asserts the cap details).
7. Mixed control: two failed and two succeeded runs → still one finding with `count: 2`; a `pending`-only page → no finding; a failed **read** → no finding at all (AC-F2-5, proven in TC-ATT-042).
8. Branch control (Appendix A trigger scope): identical four failed runs with the checkout on a feature branch → CI section `failed`, **zero** CI findings, and no invented `ci.red-on-feature` code anywhere in payload or text.
9. Reversed input order: assert the same single finding, same count, same member order, and identical bytes.

**Expected Outcome**:

- Four red primary-branch runs are one job with an exact count and four identities, the grouping generalises to any count, and nothing is fabricated for non-primary checkouts.

#### TC-ATT-007 - Member cap: exact observation count, unique deduplicated members, `evidenceRef`, declared drop

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-2, F-2, NFR-1, DM-4, DEC-17
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Evidence Level**: behaviour
**Target Layer / Location**: `tests/behaviour/status-findings-bounds.test.ts`, `tests/fixtures/status/matrix/bounds/**`
**Tags**: @backend @golden

**Preconditions**:

- Under-cap (7 unique members), at-cap (8), over-cap (9, 12, 20) fixtures for one code in one section.
- A repeated-identity fixture: one observation identity appearing three times among the coalesced observations (for example a run identity re-observed across a re-run page entry), so `count > members.length` while the observation count stays exact.
- A second code in the same section so the section's `truncated` flag can be attributed correctly.
- The declared cap and the section's truncation/omitted model from the shipped contract.

**Steps**:

1. For 7 and 8 unique observations assert `count` equals the observation count, `members.length` is 7 and 8, all members are unique, `evidenceRef` equals the first member, `truncated` is `false`, and `omitted` is `0`.
2. For 9, 12, and 20 observations assert `count` stays exact (9, 12, 20), `members.length` is exactly 8, and the section's `truncated` flag is `true`.
3. Repeated-identity case: with the same identity observed three times plus seven other identities, assert `count: 10`, `members.length: 8`, the repeated identity appears **once** in `members`, and `count` is not reduced to the unique-identity count (DEC-17).
4. Assert the drop is declared: the section carries `truncated: true`; assert `counts.omitted` keeps its existing item-drop meaning and is not inflated by member drops; assert the member drop is visible through the exact `count` versus the capped `members.length` and through the declared member-drop marker where the delivery declares one.
5. Assert the rendered members are the first eight **unique** identities in the section's fixed rank order (not the first eight in source order, and not eight entries counting duplicates); assert `evidenceRef` is the first of them.
6. Assert the human grid renders the exact count in the rollup (`×20`) and marks any item-level truncation with the existing `+N`/`+more` marker; assert no member identity leaks into human text.
7. Determinism: repeat the 20-observation run and the repeated-identity run; assert the same members in the same order and the same `evidenceRef`.
8. Controls: an under-cap fixture in the same suite carries no mark; a fixture where a second code's members are under cap must not mark that finding as dropped; a test-only copy with the cap removed renders 20 members and fails the cap assertion; a test-only copy that deduplicates only after capping fails step 3.

**Expected Outcome**:

- The exact observation count survives deduplication and member truncation, the member list holds at most eight unique identities in rank order, `evidenceRef` is the first member, the drop is declared without corrupting the existing item `omitted` semantics, and every assertion is live.

**Notes / Clarifications**:

- DM-4 requires the member overflow to be declared via "the existing truncation marker" without redefining `counts.omitted`. Plan reading (delivery-bound, no spec conflict): `truncated` is the section marker for the member drop; `counts.omitted` keeps its shipped meaning of ranked **items** the cap dropped; the member drop is readable from the exact `count` versus the capped `members.length`. A delivery that instead adds a dedicated member-drop field is compatible with this plan provided `truncated` is set and `omitted` is not repurposed.

#### TC-ATT-008 - Defensive findings-per-section cap enforced at the pure aggregation layer

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-F2-4, F-2, NFR-1, DM-4, DM-11, DEC-15
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Evidence Level**: behaviour
**Target Layer / Location**: `tests/behaviour/status-findings-bounds.test.ts`, `tests/structure/status-findings-contract.test.ts`
**Tags**: @backend

**Preconditions**:

- The pure findings layer exposed for direct evaluation over a section's ranked observations (delivery-bound entry point).
- A **test-only registry extension** injected at the pure aggregation layer with ten codes routed to one synthetic section; it lives only in the test tree, is never exported to production, and the production registry is untouched.
- A real-input control that produces all seven reachable tracker codes.

**Steps**:

1. Assert `STATUS_MAX_FINDINGS_PER_SECTION = 8` and count the reachable distinct codes per section from the production registry: 7 (tracker), 1 (ci), 0 (lanes, dormant), 1 (parked work), 0 (ready), 0 (placeholders). Assert the declared roles (DEC-15, Appendix B): the cap is defensive headroom and no legal input can exceed it.
2. Evaluate the pure findings layer with the injected registry producing 10, 12, and 20 distinct codes in one section: assert exactly eight findings are emitted in rank order, the dropped ones are declared via the section's truncation marker, and the retained eight are the top eight under the rank key.
3. Assert the retained order equals the rank key applied to the full set (severity → count desc → code asc → first occurrence); assert no low-severity finding is retained while a high-severity one is dropped.
4. Real-input control: a tracker fixture producing all seven reachable codes asserts `findings.length === 7`, `truncated` is not set by the findings cap, and no finding is dropped.
5. Control: remove the cap in a test-only copy of the pure layer and assert 10 findings are emitted, failing the cap assertion (proves the assertion reads the constant).
6. Assert the production registry and digest type are unchanged by this test (no mutation leak): re-read the contract after the case and assert the ten-code key set and that no test-only code is exported through the contracts subpath.
7. Assert the injected extension is confined to the test tree: a structure scan finds no production import of the test-only registry, and the production build/typecheck sees only the ten shipped codes.

**Expected Outcome**:

- The defensive cap is enforced and ordered on an injected registry, while the real reachable maximum (7) is documented and never truncated. The cap's declared role as headroom is recorded and proven, never silently assumed.

#### TC-ATT-009 - Total findings rank key and permutation invariance

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-3, F-2, DEC-3, NFR-6
**Test Type(s)**: Integration, Unit
**Automation Level**: Automated
**Evidence Level**: behaviour
**Target Layer / Location**: `tests/behaviour/status-findings.test.ts`, `tests/fixtures/status/matrix/cases.ts`
**Tags**: @backend

**Preconditions**:

- A mixed fixture per section: multiple severities, multiple counts, several hygiene codes of equal severity, and one code with the largest count but the lowest severity.
- Reversed fact-order, reversed label-order, reversed PR-order, and reversed registry-iteration-order twins.
- Fixed clock and `generatedAt`.

**Steps**:

1. Assert the emitted findings order equals the sort of the expected tuples by severity rank (`high` < `medium` < `low`), then count descending, then code ascending, then declared first-occurrence index.
2. Assert the specific mixed case: a `high` count-1 finding ranks above a `medium` count-4 finding; among `low` codes with equal counts, the codes appear in ascending lexical order (`...epic-membership`, `...in-sprint`, `...missing-labels`, `...missing-title`, `...story-points`); a larger count within one severity ranks first.
3. Assert cross-section independence: each section's findings array is ordered by its own key; no global findings array exists.
4. Assert permutation invariance: aggregate the reversed facts and assert the findings arrays — codes, severities, counts, and member order — are identical, and the serialized `data` bytes are identical.
5. Assert registry-iteration-order independence: shuffle the registry map order and assert identical output.
6. Assert the comparator is total: for every pair of emitted findings exactly one of "before"/"after" holds; assert the fourth key (first occurrence) is exercised through the pure comparator with two synthetic equal-key findings in a test-only copy, and assert the production path never relies on array sort stability.
7. Control: change one finding's count across an ordering boundary and assert the order changes (proving the assertion is live); restore and assert the baseline order.

**Expected Outcome**:

- The findings order is the declared total key, independent of input order, registry iteration order, and sort stability, with the fourth key proven reachable on the comparator.

#### TC-ATT-010 - Existing findings become code-carrying with unchanged trigger, counts, and rank behaviour

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-4, DM-7, Appendix A, §8.5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Evidence Level**: behaviour
**Target Layer / Location**: extended `tests/behaviour/status-tracker.test.ts`, `tests/fixtures/status/corpus/**`
**Tags**: @backend

**Preconditions**:

- The pre-change tracker fixtures for `missing-title`, `missing-labels`, and stalls, with their expected family counts, ordered item identities, and rank behaviour recorded as the baseline.
- Items producing: a blank title, an empty label set, both, a stalled item, and a stall with unknown activity.

**Steps**:

1. Assert the blank-title item still produces the `missing-title` hygiene finding, now with code `tracker.hygiene.missing-title` and severity `low`; assert the item's family counts, family state, rank position, and cap behaviour are identical to the baseline.
2. Assert the empty-label item still produces `missing-labels` with code `tracker.hygiene.missing-labels`, severity `low`, and unchanged family behaviour.
3. Assert an item with both defects produces two findings with the correct codes, not one combined code.
4. Assert stalled items produce one grouped `tracker.stalled-ticket` finding with severity `medium`, `count` equal to the number of stalled items, and members equal to the stalled refs in the stall family's fixed rank order (oldest first, then unknown-activity refs).
5. Assert an item with unknown activity (absent/invalid `updatedAt`) produces **no** invented finding and remains visible in the stall family exactly as before.
6. Assert hygiene findings order within the tracker section by the rank key (equal severity and count → code ascending) and that the hidden title text never appears in a member, evidence, or human line.
7. Control: assert the pre-change tracked fixture's digest differs from the pre-change baseline **only** by the additive `findings[]` arrays and declared fields (cross-checked by TC-ATT-037); assert family states/counts/ids are unchanged.
8. Assert the new assertions reuse the shipped absence semantics rather than inventing a second model, at the behaviour level: the same empty-value item shape that makes `missing-labels` a violation (an item with no labels) also makes `epic-membership` a violation when its signal is declared available, and an item with conforming values produces neither finding — asserted with paired fixtures, not by inspecting implementation internals.

**Expected Outcome**:

- The three pre-existing findings are now code-carrying with identical triggers, counts, family semantics, and rank behaviour, and they establish the absence semantics the three new assertions reuse; any behaviour change fails the baseline comparison.

#### TC-ATT-011 - Three named hygiene assertions with tri-state per-item counts under declared availability

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F4-1, F-4, DM-7, DM-13, DEC-13
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Evidence Level**: behaviour
**Target Layer / Location**: `tests/behaviour/status-hygiene.test.ts`, `tests/fixtures/status/{harness.ts,corpus/hygiene-assertions-tri-state/**}`
**Tags**: @backend

**Preconditions**:

- A tracker population of open items where all three assertion signals are declared **available** on the tracker read result, covering for each assertion at least one violating (absence) and one satisfied (conforming) item, plus a closed and a canceled item that must be excluded.
- Mapped values supplied on the items: labels for epic/story points and a milestone for in-sprint (DM-13).
- A fixed clock and `generatedAt`.

**Steps**:

1. Assert the hygiene family exposes exactly three named assertion surfaces in declared order (`epic-membership`, `story-points`, `in-sprint`), each with integer `violations`, `unknown`, `satisfied` counts; assert no fourth assertion and no renamed or camelCase surface id.
2. Assert for each assertion the three counts sum to the open-item population under evaluation (open = delivery state neither `done` nor `canceled`); assert closed/canceled items are excluded from all three counts.
3. Assert the declared-available population yields `unknown: 0` for each assertion (unknown is available only from the availability gate, exercised in TC-ATT-013) and that at least one violation and one satisfied are counted, so the tri-state surface is not vacuous.
4. Assert each violating item produces the matching code (`tracker.hygiene.<assertion>`) grouped per F-2 with `count` = violation count and members = violating refs in the family's fixed rank order; assert satisfied items produce no output at all.
5. Assert the assertion-unknown count aggregates on the family exactly as stall unknown-activity is counted, and appears in the human tracker fragment (`hygiene <n> (<a> unknown)` where `n` = total hygiene findings and `a` = summed assertion-unknown; `a` is `0` here).
6. Assert the family state and the section state follow the existing derivation (assertion counts do not degrade an otherwise observed family); assert existing title/label findings continue alongside the new counts.
7. Assert the counts aggregate over the fully ranked family before the four-item cap, so a violating or satisfied item omitted by the cap is still counted.
8. Controls: an all-violating population yields `violations: N, unknown: 0, satisfied: 0`; an all-conforming population yields `0/0/N` (detail in TC-ATT-041); an observed-empty population yields `0/0/0` with the family observed; a test-only copy that adds a fourth assertion surface fails by name.

**Expected Outcome**:

- Three named assertions report complete tri-state counts over open items under declared availability, violations group into their codes, satisfied items are silent, unknown is zero here because the gate is open, and family/section semantics are unchanged.

#### TC-ATT-012 - Absence-as-violation by name: no `epic`/`epic:` label, no/invalid `points:` label, no milestone

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F4-2, F-4, F-4a, DEC-13, DM-13
**Test Type(s)**: Integration
**Automation Level**: Automated
**Evidence Level**: behaviour
**Target Layer / Location**: `tests/behaviour/status-hygiene.test.ts`, `tests/fixtures/status/corpus/hygiene-absence-violation/**`
**Tags**: @backend

**Preconditions**:

- All three assertion signals declared **available** on the tracker read result.
- Epic variants: no labels at all; labels without any `epic` token (`bug`, `m1`); label `epics` (not the token and not the prefix); controls `epic` and `epic:payments`.
- Story-point variants: no label; label `points:` with empty suffix; `points:abc`; `points:-1`; `points:3.5`; label `points` without a colon; controls `points:0` and `points:5`.
- In-sprint variants: no milestone; empty milestone; whitespace-only milestone; control: a present milestone value.
- The declared label-convention contract data (`epic`, `epic:`, `points:`) is the oracle and is read by the test, not hard-coded.

**Steps**:

1. For each epic violation variant assert `epic-membership.violations` increments by one, the item appears as a member of exactly one `tracker.hygiene.epic-membership` finding, and `satisfied` does not increment for that item; assert the exact-token controls (`epic`, `epic:payments`) increment `satisfied` instead.
2. For each story-point violation variant (absent, empty suffix, non-numeric, negative, non-integer, missing colon) assert a `tracker.hygiene.story-points` violation and member; assert `points:0` and `points:5` are satisfied — zero points is a conforming value, never an absence (AC-F4-2, DEC-13).
3. For each in-sprint violation variant assert a `tracker.hygiene.in-sprint` violation and member; assert the present-milestone control is satisfied.
4. Assert each assertion coalesces into exactly one finding per code with the exact violation `count` and unique ref members; assert severity `low` from the registry and `evidenceRef` = first member.
5. Assert a satisfying item appears in no finding and in no violation count; assert a violating item appears in exactly one finding per failing assertion (an item failing two conventions appears in two findings).
6. Assert the section and family states are unchanged by the violations (they are attention items, not degradation), and that the human tracker fragment counts the violations in `hygiene <n>`.
7. Assert the violation is decided only by the mapped value: mutate the title, body, assignee, and an unrelated label and assert every count is unchanged; a story-point-looking title with no mapped value stays a violation, never a satisfied item.
8. Controls: change the declared epic token to `theme` in a deep-copied contract and assert the same items flip between violation and satisfied (proving the test reads the contract); a test-only copy that maps "absent" to satisfied fails by name. The production contract is untouched.

**Expected Outcome**:

- Absence of a conforming value inside a declared, available signal is a violation for all three assertions, each emitted as its own named code and grouped; conforming values are satisfied; nothing is derived from titles, assignees, or unmapped fields.

#### TC-ATT-013 - Undeclared signal (including mixed) → that assertion all-unknown with `signal-unavailable`

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F4-3, F-4, F-4a, DM-7, DM-13, DEC-13, DEC-14, RSK-2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Evidence Level**: behaviour + corpus
**Target Layer / Location**: `tests/behaviour/status-hygiene.test.ts`, extended `tests/behaviour/status-section-states.test.ts`, `tests/fixtures/status/corpus/hygiene-all-unknown/**`
**Tags**: @backend

**Preconditions**:

- The tracker read result carries declared per-assertion availability additively; the four pre-change family keys stay required and unchanged.
- Population A: all three signals **undeclared** (`unavailable`), with items that would violate or satisfy if the signals were declared — proving the gate, not the data, decides.
- Population B (mixed): `epic-membership` and `story-points` declared available, `in-sprint` undeclared.
- The GitHub-slice availability variant and a restored all-available control.

**Steps**:

1. Assert the availability contract's four pre-change keys are unchanged and required; assert the three assertion-signal keys are additive, optional-declared, and use the closed `available`/`unavailable` vocabulary; assert availability travels on the tracker read result rather than being inferred from item content.
2. Population A: assert each assertion reports `violations: 0, unknown: N, satisfied: 0` where `N` is the open-item population, and that **no** hygiene assertion finding is emitted even though the items lack conforming values.
3. Assert the section/family evidence includes the closed reason `signal-unavailable` for the affected family and the section state follows the existing derivation; assert no new reason string is invented.
4. Population B (mixed): assert `in-sprint` is all-unknown with `signal-unavailable` while `epic-membership` and `story-points` evaluate **independently** and report their own violation/satisfied counts from the same items — the undeclared signal must not suppress or blank the declared ones.
5. Assert the shipped GitHub-slice declaration is explicit and truthful for each assertion signal: where the adapter maps the label/milestone convention it declares `available` and the assertion evaluates against item data; where it does not map it, it declares `unavailable` and the assertion is all-unknown with the reason. Assert no signal is declared available without a mapped field and none is declared unavailable while mapped (DM-13 truthfulness); assert the shipped declaration is contract data, not inferred at runtime.
6. Assert the all-unknown rendering is distinguishable from an empty population: the empty-population control carries `observed` and `0/0/0`, the unavailable case carries the reason and `unknown: N`; assert the human fragment keeps the `<a> unknown` marker.
7. Controls: restore availability for the same population and assert the counts become the presence-based violation/satisfied counts; a test-only copy that hard-codes `available` for all three assertions fails the mixed case by name.
8. Assert no additional network read or endpoint is introduced by the availability declaration (cross-checked by TC-ATT-030), and that the milestone normalization rides the same page.

**Expected Outcome**:

- Unknown comes only from the availability gate: an undeclared assertion is all-unknown with `signal-unavailable` and zero violations, while the declared assertions evaluate independently in the same digest, including the mixed case and the shipped GitHub path.

#### TC-ATT-014 - Owner-gate age, `slaState`, escalated finding, and tracker `gates <n>` fragment

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-1, F-5, DM-8, DEC-6, ADR-0004
**Test Type(s)**: Integration, Unit
**Automation Level**: Automated
**Evidence Level**: behaviour
**Target Layer / Location**: `tests/behaviour/status-owner-gate-age.test.ts`, `tests/fixtures/status/harness.ts`
**Tags**: @backend

**Preconditions**:

- Injected clock `NOW_MS` and hand-back items carrying `hand-back` or `human-input-needed` (case-insensitive), matching the delivered owner-gate definition.
- The M1-S5 contract imported for thresholds, comparator, states, and markers; the pure `evaluateOwnerGateSla` used by the builder.
- A guarded state store (no append expected).

**Steps**:

1. With a hand-back `updatedAt` 26 h before the clock, assert the item carries an observed age corresponding to 26 h, `slaState: "escalated"`, and no unknown-age marker.
2. Assert the tracker section emits one `tracker.owner-gate-escalated` finding with severity `high`, `count: 1`, and the item's ref as the member; assert the representative evidence is that ref.
3. Assert the human tracker line renders `gates 1 escalated` and that `1` equals the number of hand-backs whose `slaState` is `escalated` or `default-applied`.
4. Boundary control: read the declared comparator and threshold from the M1-S5 contract and assert the T−1 ms item is `fresh` (not counted), the T item is `escalated` (counted), and the T+1 ms item is `escalated` — never hard-code `>`, `>=`, or `24`.
5. Default-applied control: a hand-back whose evaluator result is `default-applied` is counted by the finding and by `gates <n>`; assert the digest does **not** write a decision record, does not name a default, and does not claim authority over the default application.
6. Grouping control: three escalated hand-backs yield one finding with `count: 3` and three ref members in the owner-hand-back family's fixed rank order (label group, then oldest `updatedAt`, then ref).
7. Assert a `fresh` hand-back produces no item marker and no finding; assert the item's pre-change fields (`ref`, label group, age-family item identity) are unchanged apart from the declared additive fields.
8. Assert the digest imports the SLA thresholds/markers by reference: a duplicated threshold or marker literal in status sources fails (cross-checked by TC-ATT-004).

**Expected Outcome**:

- Hand-back items carry a truthful age and SLA state from the delivered evaluator, escalated gates are visible in both the findings layer and the human fragment, and the digest neither writes records nor re-derives thresholds.

#### TC-ATT-015 - Unknown gate age: declared marker, escalated, never zero or fresh

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-2, F-5, DEC-6, ADR-0004, NFR-9
**Test Type(s)**: Integration
**Automation Level**: Automated
**Evidence Level**: behaviour
**Target Layer / Location**: `tests/behaviour/status-owner-gate-age.test.ts`, `tests/fixtures/status/corpus/owner-gate-unknown-age-escalated/**`
**Tags**: @backend

**Preconditions**:

- Absent variants: key missing, `undefined`, `null`, empty string, whitespace-only string.
- Unparseable variants: `"not-a-date"`, `"2026-13-45T99:99:99Z"`, `"yesterday"`.
- Controls: a parseable timestamp exactly at the clock (`0h` age) and one 1 h old.
- The M1-S5 unknown-age marker set imported by reference.

**Steps**:

1. For each absent variant assert the item's age is `null`, the marker equals the M1-S5 absent marker, `slaState` is `escalated`, and the item is present in both machine and human output.
2. For each unparseable variant assert age `null`, the marker equals the unparseable marker (distinct from the absent marker), and `slaState` is `escalated`.
3. Assert no unknown-age item is ever rendered with `0`, `0h`, `fresh`, or a fabricated duration, in machine or human mode; assert `gates <n>` counts it.
4. Assert the item contributes to the `tracker.owner-gate-escalated` finding with its ref as member and that the finding's `count` includes it.
5. Assert unknown-age gates are never default-applied and never produce a decision record; advance the clock by days and months and assert the state stays `escalated` with zero appends.
6. Assert the two markers never collapse: a fixture mixing one absent and one unparseable item renders both distinctly and the counts are separated.
7. Assert a parseable `0h` control is `fresh`, not escalated, and not counted — proving zero and unknown are different representations.
8. Control: a test-only contract copy that maps an unknown age to `fresh` fails the assertion by name.

**Expected Outcome**:

- Unknown age is a declared, distinct marker with `escalated` visibility in both layers, never zero, never fresh, never defaulted, and never collapsed with unparseable or with a real zero age.

#### TC-ATT-016 - Parked condition projected under the detail cap; absence never invented

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F6-1, F-6, DM-9, §20
**Test Type(s)**: Integration
**Automation Level**: Automated
**Evidence Level**: behaviour
**Target Layer / Location**: `tests/behaviour/status-parked-conditions.test.ts`, `tests/fixtures/status/corpus/parked-condition-present/**`
**Tags**: @backend

**Preconditions**:

- Local PM context `parked_changes` entries: one with a `condition`, one with a long condition (over `STATUS_MAX_DETAIL_CHARS`), one with a multibyte condition, one without a condition, one with unrelated free-form notes.
- A canary string in the free-form notes field.
- The existing detail cap and the existing parked-item projection model.

**Steps**:

1. Assert the entry with a recorded condition renders an additive `condition` field equal to the recorded value when under the cap.
2. Assert the long condition is bounded to `STATUS_MAX_DETAIL_CHARS` and that truncation is multibyte-safe (no split code point, valid UTF-8, byte length ≤ the declared bound).
3. Assert the entry without a condition carries **no** condition field (or the declared absent representation) and never an empty string, `"unknown"`, or a fabricated condition.
4. Assert the free-form notes field and the canary are never projected into the item, evidence, findings, or human text; assert the same for any undeclared `parked_changes` key.
5. Assert the item's pre-change fields (`workItemRef`, branch, changeFolder, reason, `parkedAt`, age) are unchanged, and the condition is the only additive field.
6. Assert the human parked line is unchanged (`parked <state> <n|?> parked changes (git-ignored local state)`) and contains no condition text.
7. Assert the parked section state and evidence are unchanged for the same facts; a malformed context still yields `unknown` with `local-context-malformed` and projects no conditions.
8. Controls: a context with `parked_changes` not an array (`unknown`, no conditions), a missing context (`unavailable`, no conditions), and an observed-empty array (`observed`, zero items, no conditions).

**Expected Outcome**:

- Conditions surface exactly when recorded, bounded and safe, never invented, never leaked from notes, and never rendered outside the machine item surface.

#### TC-ATT-017 - `parked.stale-no-condition` grouping with both negative controls

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F6-2, F-6, DEC-12, Appendix A
**Test Type(s)**: Integration
**Automation Level**: Automated
**Evidence Level**: behaviour + corpus
**Target Layer / Location**: `tests/behaviour/status-parked-conditions.test.ts`, `tests/fixtures/status/corpus/parked-stale-no-condition-grouped/**`
**Tags**: @backend

**Preconditions**:

- Parked entries: three with unknown age (no parseable `parkedAt`) and no condition; one with unknown age and a condition; one with a parseable old `parkedAt` and no condition; one with no `workItemRef` (identity fallback).
- A fixed clock.

**Steps**:

1. Assert exactly one `parked.stale-no-condition` finding with severity `low`, `count: 3`, and three members in the parked rank order (absent/invalid timestamps last, then numeric-aware `PREFIX-number`, then entries without a reference ordered by folder, branch, reason).
2. Assert the entry with unknown age **and** a condition does not contribute (first negative control).
3. Assert the entry with a parseable age and no condition does not contribute (second negative control), proving the trigger requires both unknown age and absent condition.
4. Assert the ref-less entry's member is the declared stable entry identity (folder/branch/reason-derived), never a title or free-form note; assert the member is deterministic across runs.
5. Assert the parked section state is unaffected by the finding (findings do not rewrite the section state) and no condition is invented for the contributing entries.
6. Assert a parked population of unknown-age entries **all** carrying conditions yields no finding, and an empty/`unavailable`/`unknown` parked section yields no finding.
7. Control: advance the clock so `parkedAt` is still absent — the finding persists with the same members (age never becomes parseable); supply a parseable `parkedAt` and assert the finding disappears.
8. Assert the human output never lists the finding's members (rollup shows only code and count).

**Expected Outcome**:

- Unknown-age conditionless parked entries group into one finding with exact count and stable identities, both negative controls hold, and no condition or identity is fabricated.

#### TC-ATT-018 - Lanes section unchanged; vocabulary declared; dormant code never emitted

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F7-1, F-7, DEC-7, DEC-17, DM-3
**Test Type(s)**: Structure, Contract, Integration
**Automation Level**: Automated
**Evidence Level**: structure + behaviour
**Target Layer / Location**: `tests/structure/status-findings-contract.test.ts`, `tests/behaviour/status-placeholders.test.ts`, `tests/fixtures/status/corpus/lanes-not-delivered-vocabulary/**`
**Tags**: @backend @golden

**Preconditions**:

- The shipped lanes section fixture and its pre-change expected values.
- The extended registry and the declared lane attention-state vocabulary.
- Every corpus case, matrix case, and golden fixture available for the never-emitted scan.

**Steps**:

1. Assert the lanes section is byte-identical to the pre-change expectation for the same facts: section id `lanes-or-queue`, state `not-delivered`, capability `queue-lane-engine`, expected story `M1-S17`, reason `engine-not-delivered`, source `queue-engine`, zero items, zero counts, and the shipped note.
2. Assert the declared attention-state vocabulary is exactly the closed set `["delivering","idle-with-reason","idle-no-reason"]` in declared order (DEC-17), with kebab-case ids, exposed as contract data; assert it is not configuration and has no ambient source.
3. Assert the lanes section's additive declaration fields name this vocabulary (and the expected engine story) without emitting any per-lane state; assert `lane.idle-no-reason` is present in the registry with severity `medium` and marked dormant.
4. Assert **no** lane state value, liveness value, idle-with-reason value, or `lane.idle-no-reason` code appears in any field of any corpus case, matrix case, or golden machine payload or human text; scan serialized bytes and human bytes for all three vocabulary literals and for the code.
5. Assert the lanes section is never `observed`, never has items, and never gains a finding; assert no section emits a lane-scoped finding.
6. Assert the human lanes line is unchanged: `lanes      not-delivered  no queue or lane engine in this release`.
7. Control: inject the code into a test-only digest copy and assert the never-emitted scan fails by case name; remove a member from the vocabulary in a temp contract copy and assert the closed-set assertion fails by name; add a fourth member and assert it fails.

**Expected Outcome**:

- The lanes section reports exactly the shipped declared gap, the closed three-literal vocabulary is pinned as inert contract data with the dormant code declared, and neither a lane state value nor the code is ever emitted.

#### TC-ATT-019 - Spend placeholder section and human line

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F8-1, F-8, DM-6, DEC-8, NG-4
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Evidence Level**: behaviour + corpus
**Target Layer / Location**: `tests/behaviour/status-placeholders.test.ts`, `tests/fixtures/status/corpus/placeholders-not-delivered/**`
**Tags**: @backend @golden

**Preconditions**:

- The declared placeholder section shape and the declared spend capability id and expected story (`M1-S19`).
- The closed reason set (which already contains `engine-not-delivered`).
- A fixture with otherwise fully observed sections.

**Steps**:

1. Assert section index 8 is `spend` with state `not-delivered`, the declared capability, `expectedStory: "M1-S19"`, reason `engine-not-delivered`, a non-empty note naming the delivering story, zero items, and zero counts (`observed: 0, unknown: 0, total: 0, omitted: 0`).
2. Assert the section emits no findings, no evidence failure code, and no new error identity; assert its source/outcome evidence uses the existing declared `not-delivered` outcome.
3. Assert the human line is exactly `spend      not-delivered  spend summary arrives with M1-S19` (padding read from the renderer's declared layout, text pinned byte-for-byte).
4. Assert the section never becomes `observed`, `degraded`, `unknown`, or `unavailable` under any of the corpus fixtures, including failed reads, missing credentials, and an unresolved binding (the placeholder is independent of reads).
5. Assert the placeholder contributes zero to `summary.actionable`, and to the summary state counts according to the declared rule (TC-ATT-021).
6. Assert no spend telemetry is implemented: no spend fields, no spend read, no spend config key, and no spend finding code exist anywhere.
7. Mutation controls: change `expectedStory` to `M1-S18`, drop the note, set state `observed`, add an item — each fails by name; the unmutated placeholder is green.

**Expected Outcome**:

- The spend capability gap is declared in-band in both modes, contributes nothing to actionability, and cannot silently drift into an implementation.

#### TC-ATT-020 - Blockers placeholder section and human line

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F9-1, F-9, DM-6, DEC-8, NG-5
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Evidence Level**: behaviour + corpus
**Target Layer / Location**: `tests/behaviour/status-placeholders.test.ts`, `tests/fixtures/status/corpus/placeholders-not-delivered/**`
**Tags**: @backend @golden

**Preconditions**:

- Same as TC-ATT-019, for blockers (`M1-S16`), with the typed questions/blockers channel explicitly not delivered.

**Steps**:

1. Assert section index 9 is `blockers` with state `not-delivered`, the declared capability, `expectedStory: "M1-S16"`, reason `engine-not-delivered`, a non-empty note, zero items, and zero counts.
2. Assert the human line is exactly `blockers   not-delivered  typed blockers arrive with M1-S16`.
3. Assert no blockers/typed-questions fields, reads, config keys, error rows, or finding codes exist; assert the section is independent of every read outcome.
4. Assert the section emits no findings and contributes zero to `summary.actionable`.
5. Assert both placeholders together are declared in the fixed order 8, 9, with no third placeholder and no reordering.
6. Mutation controls: change the story to `M1-S17`, set state `unavailable`, add an item, duplicate the section id — each fails by name.

**Expected Outcome**:

- The blockers capability gap is declared exactly, in order, and with no implementation leakage, symmetric with the spend placeholder.

#### TC-ATT-021 - Nine-section totality, placeholder count, findings total, placeholders contribute zero

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: DM-3, DM-12, DEC-17, F-8, F-9
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Evidence Level**: behaviour + structure
**Target Layer / Location**: extended `tests/behaviour/status-section-states.test.ts`, `tests/behaviour/status-placeholders.test.ts`
**Tags**: @backend

**Preconditions**:

- Every corpus case and matrix case, all reporting nine sections.
- A fixture with findings in observed and degraded sections and none in unknown/unavailable/not-delivered sections.
- The declared placeholder marker.

**Steps**:

1. For every case assert the digest carries exactly nine sections in the declared order, each with one state from the closed five-value set, evidence, counts, an items surface (or the tracker family surface), and a truncation flag; assert zero missing and zero extra sections.
2. Assert `summary` state counts sum to nine and that each state count equals the number of sections with that state.
3. Assert `summary.findingsTotal` equals the number of finding **groups** (findings, never observations) emitted by sections whose state is `observed` or `degraded`; assert a grouped finding counts once regardless of its `count`; assert findings in `unknown`/`unavailable`/`not-delivered` sections contribute zero (and never exist per TC-ATT-005/042).
4. Assert `summary.placeholderSectionCount` is exactly **2** — the delivered `spend` and `blockers` placeholders — and that the lanes section is excluded as a shipped declared-gap section (DEC-17); assert the exclusion is visible in the declared section kind data rather than hard-coded in the test.
5. Assert `summary.actionable` still sums rendered items of observed/degraded sections as shipped, and that placeholders contribute zero even though they are `not-delivered`.
6. Assert the footer/close of the machine payload contains no unbounded aggregate list (the summary is counts only).
7. Controls: remove a section in a test-only copy and assert the totality assertion fails by name; add a tenth section and assert it fails; mark a placeholder as a finding contributor and assert `findingsTotal` fails; count a grouped finding by `count` instead of as one group and assert `findingsTotal` fails; include lanes in the placeholder count and assert it fails.

**Expected Outcome**:

- Nine-section totality, per-state counts, findings total, and placeholder count are exact under the existing contribution rule, with placeholders provably contributing zero.

#### TC-ATT-022 - Ready-to-merge classification and ranking above review-pending, zero new reads

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-1, F-3, DM-5, DEC-5, RSK-8
**Test Type(s)**: Integration, Differential
**Automation Level**: Automated
**Evidence Level**: behaviour
**Target Layer / Location**: `tests/behaviour/status-ready-to-merge.test.ts`, `tests/fixtures/status/corpus/ready-merge-ready-ranked/**`
**Tags**: @backend

**Preconditions**:

- Open pull requests: a non-draft with an observed approval; a draft with an observed approval; a non-draft without approval; a non-draft with changes-requested; a closed and a merged request that must not render.
- Review availability `available`; the PR list read succeeded.
- The `queue ready` classification available for a differential comparison on the same facts.

**Steps**:

1. Assert the ready-to-merge section is index 7, state `observed`, and carries exactly the open pull requests as items with `ref`, `class`, `sourceRef`, `targetRef`, `reviewState`, and `ciResult` (key set pinned).
2. Assert the non-draft observed-approval PR is `merge-ready`; assert the draft approval, the no-approval, and the changes-requested PRs are all `review-pending`; assert closed/merged requests are absent.
3. Assert every `merge-ready` item ranks above every `review-pending` item; within each class assert the queue-ready key order: numeric-aware ref suffix, then source ref, then target ref. Assert the item order is a total order under any input permutation.
4. Assert the item carries no merge verdict: no "approved by status", no merge instruction, no authority claim; `merge-ready` names the observed classification and cites the observed evidence only (RSK-8).
5. Differential control: run the `queue ready` command over the same injected facts and assert the ready-to-merge set, classes, and relative order equal the queue-ready close-item classification for those PRs.
6. Assert the human line renders `ready      observed  <n> ready-to-merge (merge-ready <m>)` with numeric `n`/`m` when review signals are observed, and that `n`/`m` equal the machine items/classes.
7. Assert a verified-empty open-PR list with review signals available yields `observed`, zero items, and `merge-ready 0` (a real zero, not `?`).
8. Read-cost guard: assert the section performs zero additional reads (the transport records only the pre-existing PR list read; full budget asserted in TC-ATT-030).

**Expected Outcome**:

- Ready-to-merge is a first-class ranked action list using the queue-ready classification exactly, with merge-ready first, deterministic keys, no fabricated verdict, and no new read.

#### TC-ATT-023 - Unknown/unavailable review signals: `review-pending`, degraded, `merge-ready ?`

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-2, F-3, DM-5, NFR-9, Appendix C
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Evidence Level**: behaviour + corpus
**Target Layer / Location**: `tests/behaviour/status-ready-to-merge.test.ts`, `tests/fixtures/status/corpus/ready-review-unknown-degraded/**`
**Tags**: @backend

**Preconditions**:

- Review availability `unavailable` (`REVIEWS_UNAVAILABLE`-style) with a non-empty open-PR list; a second case where only one rendered item has an unknown review signal.
- A restored control with review signals observed and an observed approval.
- A failed PR read case and a no-binding case.

**Steps**:

1. With review signals unavailable assert every rendered item is `review-pending` with `reviewState: "unknown"`; assert no item is `merge-ready`.
2. Assert the section state is `degraded` and evidence carries `signal-unavailable` (plus `partial-evidence` where the declared model applies); assert it is never `observed`.
3. Assert the human line renders `merge-ready ?` and never `0` or a fabricated count; assert `ready degraded <n> ready-to-merge (merge-ready ?)` shape.
4. Assert the machine payload carries no number for merge-ready count in this state, or the declared `null`/absent representation — never `0`.
5. Partial case: one item with an unknown review signal among observed ones makes the section `degraded` and renders `merge-ready ?`; assert observed items keep their own `reviewState: "observed"` and classifications.
6. Failed PR read: assert section `unknown`, zero items, human `ready unknown ? ready-to-merge (merge-ready ?)` (or the declared unknown rendering), never `not-delivered`.
7. No binding: assert section `unavailable` and `?`; assert never `observed`.
8. Restored control: identical facts with review signals available and one observed approval yield `observed` with a numeric `merge-ready 1`, proving the `?` is not hard-coded.
9. Assert no approval is fabricated from CI success, draft status, conversation, or thread counts: a fixture with green CI and unknown review stays `review-pending`/unknown.

**Expected Outcome**:

- Any unverifiable approval renders as `?` with a degraded section and unknown item markers, never as zero, never as merge-ready, and never as `not-delivered`.

#### TC-ATT-024 - Ready-to-merge derivation row complete; never `not-delivered`; verified-empty is a real zero

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-2, DM-5, Appendix C, DEC-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Evidence Level**: behaviour + structure
**Target Layer / Location**: extended `tests/behaviour/status-section-states.test.ts`, `tests/fixtures/status/matrix/cases.ts`, extended `tests/structure/status-contract.test.ts`
**Tags**: @backend

**Preconditions**:

- Matrix cases for the new row: observed (review available, verified-empty and non-empty), degraded (review unavailable; partial source failure), unknown (PR read failed), unavailable (no repository binding).
- A fixture sweep across every corpus and matrix case (the `not-delivered` impossibility oracle).

**Steps**:

1. Assert the declared ready-to-merge row in the derivation matrix equals Appendix C: `observed` (list read succeeded with review signals available, verified-empty included), `degraded` (review signals unavailable on any rendered item, or a partial source failure), `unknown` (read failed or no usable evidence), `unavailable` (no repository binding), and explicitly not `not-delivered`.
2. Assert each matrix case yields the declared state and the declared primary reason; assert reasons come from the existing closed set (no new reason string).
3. Assert no fixture in the entire corpus/matrix sweep yields `not-delivered` for this section; assert the type/contract does not allow it for section 7 (a test-only assignment fails typecheck or the structure assertion).
4. Assert precedence: a read failure plus a missing binding resolves to `unknown` per the declared row, not `unavailable`, and the reason matches.
5. Assert the section's counts and `truncated` flag are present in every state, including `unknown`/`unavailable` with zero items.
6. Control: flip the declared row for one state in a test-only contract copy and assert the matrix assertion fails by name.

**Expected Outcome**:

- The new section's state derivation is exactly the declared row, covers every corpus fixture, and can never be `not-delivered`, with a real zero only in the observed verified-empty case.

#### TC-ATT-025 - Ready-to-merge item cap and truncation; merge-ready never dropped behind review-pending

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: NFR-1, DM-5, DM-11
**Test Type(s)**: Integration
**Automation Level**: Automated
**Evidence Level**: behaviour
**Target Layer / Location**: `tests/behaviour/status-findings-bounds.test.ts`, `tests/fixtures/status/matrix/bounds/**`
**Tags**: @backend @golden

**Preconditions**:

- 7, 8, 9, and 12 open pull requests with mixed classes.
- An over-cap fixture whose ninth-ranked item (in source order) is `merge-ready` and whose first is `review-pending`, so a naive slice would drop the urgent item.
- `STATUS_MAX_READY_ITEMS = 8`.

**Steps**:

1. Assert 7 and 8 items render with `truncated: false` and `omitted: 0`; assert 9 and 12 render exactly 8 items with `truncated: true` and `omitted` equal to the drop count.
2. Assert the retained items are the top eight under the class-then-ref key; assert no `merge-ready` item is ever dropped while a `review-pending` item is rendered.
3. Assert the over-cap fixture's dropped items are review-pending only, and that the merge-ready item (last in source order) is retained.
4. Assert the human line renders the truncation marker (`+N` or the declared marker) and that the merge-ready count reflects the rendered set consistently with the machine payload (declared reading: rendered-class counts, with `omitted` disclosing the drop).
5. Assert deterministic truncation: repeat the 12-item run and assert the same eight items and the same marker.
6. Controls: under-cap carries no mark; a fixture with nine merge-ready items reports `omitted: 1` and discloses that the dropped item is merge-ready (never hides urgency silently).

**Expected Outcome**:

- The action list is capped at eight with a declared drop, and truncation can never hide a merge-ready item behind a review-pending one without disclosure.

#### TC-ATT-026 - Extended human grammar line-for-line: nine lines, optional header, tracker fragments

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F10-1, F-10, DM-10, DEC-11
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Evidence Level**: behaviour + golden
**Target Layer / Location**: extended `tests/behaviour/status-output.test.ts`, `tests/fixtures/status/golden/human.txt`
**Tags**: @backend @golden

**Preconditions**:

- A fully observed fixture with an observed binding and resolved SHA (header present) and a fixed brand, clock, run id.
- A header-absent fixture (unavailable binding or unresolved SHA).
- The spec's §8.3 grammar block as the read-only oracle; layout literals read from the renderer's declared data.

**Steps**:

1. Assert the line sequence exactly: optional header, then `tracker`, `changes`, `ci`, `lanes`, `providers`, `parked`, `ready`, `spend`, `blockers`, then `attention`; assert one line per section and no extra blank or summary line.
2. Assert the header appears only when the binding is observed and the SHA resolved, uses the injected brand binary name, and is absent otherwise; assert no product literal.
3. Assert the tracker line carries the two declared fragments: `hand-backs <n> | gates <n|?> escalated | blocked <state> | stalls <n> (<u> unknown) | hygiene <n> (<a> unknown)`; assert `gates ?` only when the owner-hand-back family is unavailable.
4. Assert `changes`, `ci`, `lanes`, `providers`, and `parked` lines are byte-identical to the shipped grammar for the same facts.
5. Assert the `ready` line renders `<n|?> ready-to-merge (merge-ready <m|?>)` with `?` exactly in the unknown/unavailable cases and numeric otherwise; assert the `spend` and `blockers` lines are the pinned placeholder lines.
6. Assert the human text is derived from the digest only: mutate a digest field and assert the corresponding line changes; change a fact not represented in the digest and assert the text is unchanged; assert rendering performs zero extra reads.
7. Assert the text contains no raw payload, no item title, no secret, no timestamp, no ANSI escape, and no LLM prose; assert one trailing newline.
8. Controls: a fixture that violates the line order in a test-only renderer copy fails the grammar assertion by name; a missing section line fails; a fabricated zero (`merge-ready 0` while degraded) fails.

**Expected Outcome**:

- Human mode matches the declared extended grammar line-for-line for header-present and header-absent states, derives solely from digest data, and leaks nothing.

#### TC-ATT-027 - Attention rollup: zero case, 1–3 groups, `+N` grouped findings, severity order

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-10, DM-10, DEC-17, DM-12
**Test Type(s)**: Integration
**Automation Level**: Automated
**Evidence Level**: behaviour
**Target Layer / Location**: extended `tests/behaviour/status-output.test.ts`, `tests/fixtures/status/corpus/no-findings-attention-zero/**`, `tests/fixtures/status/corpus/mixed-attention-ranked/**`
**Tags**: @backend @golden

**Preconditions**:

- Fixtures producing 0, 1, 2, 3, 4, 6, and 9 finding **groups**, with at least one group whose exact `count` is greater than 1 and greater than the member cap.
- Mixed severities so the severity order matters.
- The declared `×` separator and the `+N` marker read from the renderer's declared literals.

**Steps**:

1. With zero findings assert the line is exactly `attention  0 findings ()`.
2. With 1, 2, and 3 groups assert the line lists every group in findings rank order as `<code>×<count>`, comma-separated, with no `+N`.
3. With 4, 6, and 9 groups assert exactly three groups are previewed in rank order followed by `+N`; assert `N` equals the number of omitted **grouped findings** (DEC-17: never raw observations) and that the three previewed codes are the highest-ranked ones.
4. Assert the same fixtures with multi-count groups: a fixture with 4 groups whose counts are 20/3/2/1 yields `+1`, not `+26` or `+22`; assert the rendered counts stay exact inside the preview.
5. Assert the preview never reorders by input order: reverse the source facts and assert identical rollup bytes.
6. Assert `<n>` (the total) equals the total grouped findings across sections and agrees with `summary.findingsTotal`; assert rendered groups + `N` = `<n>`.
7. Assert the rollup is one line, contains no member identity or item title, and does not expand the human output beyond the declared bounds (cross-checked by TC-ATT-028).
8. Controls: a test-only renderer that previews four groups fails the `+N` assertion; a renderer that counts observations instead of groups fails step 4; a rollup omitting a higher-ranked group in favour of a lower-ranked one fails step 3.

**Expected Outcome**:

- The attention line is a deterministic, severity-ordered three-group preview whose `+N` and `<n>` are counts of grouped findings, never observations, with a truthful `0 findings ()` case.

#### TC-ATT-028 - Human bounds: 32 defensive lines, 6144 operative bytes, max-length stress, stale clamp retired

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-2, DM-11, Appendix B, DEC-17
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Evidence Level**: behaviour + golden
**Target Layer / Location**: extended `tests/behaviour/status-output.test.ts`, extended `tests/golden/status-digest.test.ts`, `tests/fixtures/status/matrix/bounds/**`
**Tags**: @backend @golden

**Preconditions**:

- The legal maximum fixture (header present, all nine lines, max-length legal fields: long refs, long chain names, long brand name, max-length legal condition) and a multibyte variant.
- A **max-length stress case** (the spec's operative-bound pin): a fixture constructed to approach 6144 bytes with legal content.
- A hostile fixture with over-length declared detail/condition/ref values.
- The declared constants imported, not hard-coded.

**Steps**:

1. Assert the legal maximum output has exactly 11 lines (optional header + nine section lines + rollup) and is within 32 lines and 6144 UTF-8 bytes with no clamp marker; assert the 11-line count is the structural worst case (DEC-17), so 32 is defensive and is not presented as an operative limit.
2. Assert the max-length stress case renders within 6144 UTF-8 bytes and that its byte length is measured and recorded; assert the operative bound is the byte cap, not the line cap.
3. Assert the old `STATUS_MAX_HUMAN_LINES = 24` / `STATUS_MAX_HUMAN_BYTES = 4096` values no longer bind anywhere: assert by source scan that neither survives as a status human bound, and assert no renderer branch references them; a legal 11-line/5 KiB output is therefore not truncated.
4. Assert byte length is measured in UTF-8 bytes (multibyte fixture) and that any defensive clamp is multibyte-safe, never splitting a code point, and is marked with the declared marker.
5. Assert a hostile fixture exceeding 6144 bytes is either clamped with the declared marker or fails closed per the existing renderer contract; assert it never emits unmarked oversize output.
6. Assert line count and byte count are asserted for every golden variant and every corpus case (the corpus stores the expected bounds class).
7. Controls: a test-only renderer copy with the old 24/4096 constants clamps a legal 11-line/5 KiB output and fails step 1/3 (proving the assertion is live and the raise is real); a test-only renderer that treats the 32-line cap as operative and pads to it fails the structural-worst-case assertion.

**Expected Outcome**:

- The bound roles are enforced as declared: 11 structural lines with 32 defensive headroom, 6144 bytes as the operative bound proven by a max-length stress case, the retired values unable to clamp legal output, and hostile input clamped with a mark rather than emitted unbounded.

#### TC-ATT-029 - Machine bound 65 536 bytes with all new surfaces at cap, via the all-caps corpus case

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR-2, NFR-1, NFR-3, RSK-7
**Test Type(s)**: Integration, Corpus
**Automation Level**: Automated
**Evidence Level**: corpus + behaviour
**Target Layer / Location**: `tests/fixtures/status/corpus/all-caps-bound/**`, extended `tests/behaviour/status-output.test.ts`, extended `tests/behaviour/status-corpus.test.ts`
**Tags**: @backend @golden

**Preconditions**:

- An all-caps fixture: findings at the per-section cap with eight members each, ready-to-merge at eight items, four tracker families at four items each, six evidence sources, six reasons, eight pull requests, eight CI runs, eight provider entries, eight parks, eight parked items (one with a max-length condition), and max-length legal identities.
- Fixed clock and `generatedAt`.
- The declared `STATUS_MAX_MACHINE_BYTES = 65536`.

**Steps**:

1. Assert the serialized `data` byte length (UTF-8, `Buffer.byteLength` on the JSON of `data`, not the envelope) is ≤ 65 536 for the all-caps fixture, and record the measured size.
2. Assert every declared cap is at its limit in this fixture and every truncation marker is exact (`omitted` equals the drop count; `truncated` true only where items were dropped or a source was at limit).
3. Assert the fixture is a committed corpus case (`all-caps-bound`) whose expected sections, counts, and truncation flags are asserted by the corpus suite as well; assert the case name appears in the corpus completeness meta-check.
4. Assert the envelope total may exceed the bound (recorded, not capped) but `data` never does; assert the success envelope carries no `error`.
5. Assert a hostile variant with over-length identities either clamps with declared markers or fails classification, never emits oversize `data` unmarked.
6. Assert the measured headroom is not achieved by dropping a declared surface: assert all nine sections are present and every new surface is populated at cap in the fixture.
7. Control: a test-only copy with the bound raised to 1024 passes, proving the assertion reads the constant; restore and assert the all-caps fixture passes while a synthetic 65 537-byte payload fails.

**Expected Outcome**:

- A fully populated digest is proven to stay under 64 KiB with exact truncation, and that proof is a permanent, named corpus case rather than a one-off test.

#### TC-ATT-030 - Read budget unchanged: 3 network reads, 1 park fold, 1 config resolve, zero new reads

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR-3, NFR-4, DEC-5, DEC-14, DM-13, §21
**Test Type(s)**: Integration, Performance
**Automation Level**: Automated
**Evidence Level**: performance
**Target Layer / Location**: extended `tests/behaviour/status-performance.test.ts`
**Tags**: @backend

**Preconditions**:

- A recording transport with the declared page limits and a throwing guard for any second page or unfixtured URL.
- Counting provider-config resolve and park-fold recorders; a child-process sentinel.
- Fixtures: fully observed; findings-heavy (all new surfaces populated, including mapped hygiene labels and milestones); degraded; unavailable binding.

**Steps**:

1. Run the fully observed fixture and assert exactly three outbound GET reads: issues at `per_page=100`, pulls at `per_page=100`, check-runs at `per_page=20` for the resolved SHA; assert one config resolve and one logical park fold.
2. Run the findings-heavy fixture and assert the same three reads, one fold, one resolve — proving findings, hygiene assertions (including the mapped label and milestone projection), ready-to-merge, and placeholders add zero reads.
3. Assert the issues request is byte-identical to the pre-change request (same URL, query, `per_page`, no added field selector): the milestone and label mapping ride the existing page, not a widened one (DM-13, DEC-14).
4. Assert `--json` and human mode perform identical reads and one render each; assert the human path performs no read.
5. Assert zero pagination requests, zero retries, zero new endpoints/hosts/scopes, and zero provider-engine `resolve`/`quota` calls.
6. Assert the unavailable-binding fixture performs zero GitHub reads and still resolves config once and folds parks once where applicable.
7. Assert a failed read makes exactly one attempt and no retry.
8. Assert zero child processes (sentinel) and zero network writes (method recorder rejects non-GET).
9. Control: a deliberate second read of any URL trips the guard and fails; a non-GET attempt trips the method recorder; a widened issues request (extra `per_page`/field/endpoint) trips the request-shape assertion.

**Expected Outcome**:

- The read budget is exactly the shipped 3/1/1, unchanged by any new section, finding, assertion, mapped hygiene signal, or placeholder, with no retry, pagination, engine call, or child process.

#### TC-ATT-031 - Read-only posture: zero writes, fences, mutations, child processes, SLA records

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-7, §21, DEC-6
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Evidence Level**: behaviour
**Target Layer / Location**: extended `tests/behaviour/status-readonly-determinism.test.ts`, `tests/behaviour/verify-support.ts` (`guardStore`)
**Tags**: @backend

**Preconditions**:

- A guarded state store whose `append`, `acquireFence`, `releaseFence`, and any mutation throw and record.
- A fixture with escalated and default-applied owner gates (the states that would tempt a decision-record write).
- A guarded filesystem writer and a child-process sentinel.

**Steps**:

1. Run the digest over the escalated-gate fixture and assert zero state appends, zero fences acquired or released, and zero derived-document replacements.
2. Assert specifically that no `owner-gate.decision` record (or any SLA decision payload) is appended; assert the digest does not import the decision-write path.
3. Assert zero filesystem writes to the repository tree, the local state directory, `dist/`, or the home directory; assert a clean `git status --porcelain` after the suite.
4. Assert zero child processes and zero network writes (sentinel plus method recorder).
5. Assert the digest does not claim authority over default application: no default name, no `waivedBy`, no merge/close instruction in any section or human line.
6. Control: a seeded write through the guarded store is detected and fails the case (proving the guard is live); a deliberate fence acquisition trips it.
7. Assert the read-only contract holds for every corpus case (the corpus suite reuses the guard for a sampled subset and the aggregate run for all).

**Expected Outcome**:

- The extended digest remains read-only in the strongest sense: no writes, fences, state mutations, child processes, or SLA decision records, while still reporting escalated and default-applied gates.

#### TC-ATT-032 - Determinism: byte-identical output across repeated and permuted runs

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-6, AC-F2-3, F-2, F-10
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Evidence Level**: behaviour
**Target Layer / Location**: extended `tests/behaviour/status-readonly-determinism.test.ts`, `tests/golden/helpers.ts`
**Tags**: @backend @golden

**Preconditions**:

- A cap-sized mixed fixture with findings, hygiene counts, ready items, conditions, and placeholders; fixed run id, `generatedAt`, clock, brand, and registry.
- Permutation twins: reversed work items, reversed labels, reversed relations, reversed pull requests, reversed runs, reversed parks, reversed parked entries, reversed registry iteration order.
- A changed-fact control.

**Steps**:

1. Run `--json` twice and assert identical stdout bytes (including the fixed run id and timing); run human mode twice and assert identical bytes.
2. Run each mode over every permutation twin and assert identical bytes to the forward run.
3. Run 50 iterations in one process and assert the set of stdout hashes has size 1 for each mode.
4. Assert the only permitted differences between runs are the injected `runId`/`timing`; normalize them and assert `data` and human text are identical.
5. Assert order-independence of the rank keys explicitly: findings order, item order, member order, and rollup order are identical across permutations.
6. Assert the fixture is constant: changing one fact (a count across an ordering boundary, an approval removed, a condition added) produces different bytes, proving the equality is not vacuous.
7. Assert no wall-clock, locale, timezone, or environment dependence: change the real elapsed time and `TZ` between runs and assert identical bytes.

**Expected Outcome**:

- Identical injected inputs produce identical machine and human bytes across repeated runs, fact permutations, and registry iteration orders; only injected correlation fields vary.

#### TC-ATT-033 - Corpus completeness meta-check extended to nine sections × five states

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR-1, NFR-10, G-8, AC-F2-5, QA strategy
**Test Type(s)**: Integration, Corpus
**Automation Level**: Automated
**Evidence Level**: corpus
**Target Layer / Location**: extended `tests/behaviour/status-corpus.test.ts`, `tests/fixtures/status/corpus/**`
**Tags**: @backend @golden

**Preconditions**:

- The existing twelve committed corpus cases plus the new cases: `four-red-runs-grouped`, `hygiene-assertions-tri-state`, `hygiene-absence-violation` (absence-based violation per assertion), `hygiene-satisfied-arm` (conforming values), `hygiene-all-unknown` (undeclared signals, including the mixed availability case), `owner-gate-escalated-observed`, `owner-gate-unknown-age-escalated`, `parked-condition-present`, `parked-stale-no-condition-grouped`, `ready-merge-ready-ranked`, `ready-review-unknown-degraded`, `ready-read-failed-unknown`, `ci-read-failed-no-finding` (no-evidence-no-claim), `placeholders-not-delivered`, `lanes-not-delivered-vocabulary`, `mixed-attention-ranked`, `no-findings-attention-zero`, `all-caps-bound`.
- A throwing `fetch` guard; the fixture builder asserting each case's intended precondition.

**Steps**:

1. Assert every case declares expectations for all nine sections, and that the meta-check requires each section id to appear in every case.
2. Assert the meta-check requires every state in each section's declared derivation row: sections 1–6 as shipped; ready-to-merge `observed`/`degraded`/`unknown`/`unavailable`; lanes `not-delivered`; spend and blockers `not-delivered`. Assert a missing state fails naming the section and state.
3. Assert the meta-check requires the named case classes listed in the preconditions, including the absence-based violation case, the satisfied-arm case, the mixed-availability all-unknown case, and the no-evidence case; assert a missing case name fails naming it.
4. For each case assert the expected section state, reasons (ordered), counts, ordered item identities, findings tuples (code, severity, exact count, unique member identities, `evidenceRef`), and truncation flag/omitted count; for hygiene cases assert the per-assertion tri-state counts.
5. Assert corruption fails by case name: mutate expected state, count, ordered id, finding code, severity, member identity, `evidenceRef`, truncation flag, and a hygiene assertion count in a temp copy, one at a time; each must fail with the case name in the message.
6. Assert zero live calls on every case (the guard never fires; the transport records zero requests) and assert each case is deterministic across two runs.
7. Assert the corpus is read-only at test time: no case writes the live tree (`git status --porcelain` unchanged), and no test regenerates an expectation.
8. Control: remove one case and assert the meta-check fails naming the removed coverage; restore and assert green.

**Expected Outcome**:

- The committed corpus is the deterministic, complete oracle for nine sections and every declared state, including the absence-based hygiene arms, the satisfied arm, the mixed-availability unknown path, the no-evidence case, grouping, and degradation, and any corrupted or missing expectation fails by case name.

#### TC-ATT-034 - Golden fixtures regenerated deliberately once, byte-identical, never rewritten by the suite

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F10-1, NFR-10, AC-NFR-1, §22
**Test Type(s)**: Golden, Integration
**Automation Level**: Automated
**Evidence Level**: golden
**Target Layer / Location**: extended `tests/golden/status-digest.test.ts`, `tests/fixtures/status/golden/**`
**Tags**: @backend @golden

**Preconditions**:

- Committed goldens: the machine digest and human text for a fully observed header-present state, plus declared variants for a header-absent state and a degraded (`merge-ready ?`) state so AC-F10-1's "any fixture state" is pinned in more than one place.
- Fixed run id (`run-status-fixture`), fixed `generatedAt`, fixed clock, `SYNTHETIC_BRAND`.
- The pre-change golden as the additive-delta baseline.

**Steps**:

1. Run `--json` and assert the serialized envelope (fixed run id/clock) equals the committed machine golden bytes.
2. Run human mode and assert the text equals the committed human golden bytes for each declared variant; assert the nine section lines plus the rollup (and header where declared) in the expected order.
3. Assert the machine golden's `data` is ≤ 65 536 bytes and the human golden is within 32 lines (structural worst case 11) and ≤ 6144 UTF-8 bytes; assert the max-length stress variant is the operative byte-bound pin.
4. Assert the golden payload carries the expected nine sections, the declared findings tuples (unique members + `evidenceRef`), the hygiene tri-state counts, the ready classification, and no `error`; assert the human golden carries the declared fragments and markers and no titles/secrets/timestamps.
5. Assert the goldens differ from the pre-change baseline only by DEC-16's allowlist and the declared human delta: the three new section objects, `findings[]`, hand-back `age`/`ageUnknownReason`/`slaState`, hygiene tri-state counts, parked `condition`, lanes declaration fields, the two tracker fragments, and the three new lines plus rollup — never by a changed state, count, item identity, evidence, or rank order in sections 1–6.
6. Assert the suite is read-only: it never writes the golden files, and a mismatched golden in a temp copy fails the comparison instead of being overwritten; assert `git status --porcelain` is clean after the run.
7. Assert the regeneration is a deliberate, reviewed exception recorded in the change's revision log, and that no blanket `--update` path or suite-driven rewrite exists (§8.5).
8. Mutation controls: change one fact (a condition, an approval, a count across an ordering boundary, a hygiene arm) and assert each golden comparison fails; restore and assert green.

**Expected Outcome**:

- Machine and human output are pinned byte-for-byte in more than one state, the delta from the shipped golden is exactly DEC-16's allowlist plus the declared human delta, and the suite can never rewrite a golden.

#### TC-ATT-035 - Expanded negative controls: failed new-section reads never green/zero; nothing fabricated

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-5, AC-F3-2, AC-F5-2, AC-F7-1, DEC-18, NFR-1, QA strategy
**Test Type(s)**: Integration, Negative control
**Automation Level**: Automated
**Evidence Level**: negative-control
**Target Layer / Location**: extended `tests/behaviour/status-negative-controls.test.ts`
**Tags**: @backend

**Preconditions**:

- The shipped nine-control negative matrix as the base (failed tracker read, failed PR read, failed CI read, missing credential, unresolved SHA, unresolved binding, torn park store, missing default chain, unresolved chain), extended with new-section controls.
- `planted-status-*` canaries in titles, notes, conditions, and provider payloads.
- A restored control for every negative.

**Steps**:

1. Enumerate and assert the new named controls exist and are non-vacuous: PR read failed → ready `unknown`, zero items, `?`, never `observed`/`0`; review signals unavailable → ready `degraded`, `?`; no binding → ready `unavailable`, `?`; malformed local context → parked `unknown`, no invented conditions, no `parked.stale-no-condition` finding from a malformed source; absent `updatedAt` → unknown age, `escalated`, never `0h`/`fresh`; no approval → never `merge-ready`; lanes → never a lane state or the dormant code; spend/blockers → never `observed`; CI read failed/unresolved SHA → no `ci.red-on-main` (dedicated case in TC-ATT-042).
2. Assert each negative's exact state, primary reason, counts, item count, and marker; assert no negative yields a finding fabricated from the failure — no-evidence-no-claim (DEC-18, AC-F2-5): a failed read emits zero findings for its section.
3. Assert the canaries attached to every negative are absent from payload, evidence, findings, human text, stdout, and stderr.
4. Assert the restored control for each negative reaches the expected success shape through the same invocation path; assert the matrix is meta-checked for completeness (each new section and each new state has a named control, and the no-finding-from-failure control exists).
5. Assert a failed pull-request read with an absent PM context still yields `ready unknown` and `changes` per the shipped rules, and that neither section claims an all-clear.
6. Assert no negative path renders `merge-ready 0`, `ready 0`, or `attention 0 findings` when a section failed (the zero is only legal when observed with verified-empty evidence).
7. Control: delete one named negative from a temp copy and assert the completeness meta-check fails naming it; restore and assert green.

**Expected Outcome**:

- Every new section and every new fabrication risk has a named, non-vacuous negative with a restored control, and no failure path can produce a green, zero, invented finding, or invented claim.

#### TC-ATT-036 - Evidence hygiene: identities, counts, codes only; no titles, payloads, secrets, or literals

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-9, §20, §21, RSK-5
**Test Type(s)**: Integration, Contract, Checks
**Automation Level**: Automated
**Evidence Level**: negative-control
**Target Layer / Location**: extended `tests/behaviour/status-negative-controls.test.ts`, `tests/checks/{secret-read-boundary,forbidden-literals}.test.ts`, extended `tests/structure/status-contract.test.ts`
**Tags**: @backend

**Preconditions**:

- Fixtures with canaries in: work-item title, body (if present), comment, label value, parked free-form note, provider payload field, and one in-memory credential.
- Findings-producing facts so the canaries sit adjacent to real finding fields.
- The serialization redaction chokepoint and the unchanged secret-read allowlist.

**Steps**:

1. Assert every finding's members and evidence are identity-shaped only: run identity, work-item ref, `PREFIX-number`, or the declared entry identity; assert no title, body, comment, label value, condition, note, or free-form sentence appears in any member, count, code, severity, or evidence reference.
2. Assert the canaries and the credential are absent from the machine payload, the human text, stdout, stderr, evidence reasons, and finding fields.
3. Assert the human attention rollup carries only codes and counts; assert no item identity or title appears in human mode.
4. Assert a parked `condition` never appears in human text or in a finding member, only on the machine item.
5. Assert the secret-read allowlist has not grown and no new secret-read path exists; assert no new configuration key or ambient read was added.
6. Assert no finding identity is derived from a title (a fixture whose ref is absent and whose title is the only text does not fall back to the title; the declared fallback identity is used or the finding is not emitted).
7. Assert the redaction chokepoint covers a failure envelope in the same suites; assert the error summary/remediation is table prose, never a raw exception or provider body.
8. Control: place a canary in an undeclared extra field and assert it is not serialized; place a canary in an allowed field (the ref) and assert it is the only allowed occurrence.

**Expected Outcome**:

- Findings, evidence, and human text carry only declared identities, codes, severities, and counts; no content, credential, payload, or free-form text escapes any new surface.

#### TC-ATT-037 - Six-section non-regression with an explicit additive-delta allowlist

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: DEC-1, DEC-16, §8.5, NG-7, RSK-1
**Test Type(s)**: Regression, Contract
**Automation Level**: Automated
**Evidence Level**: behaviour + golden
**Target Layer / Location**: existing `tests/behaviour/status-{command,tracker,changes-ci,providers-parked,section-states,output,negative-controls,readonly-determinism,corpus}.test.ts`, `tests/golden/status-digest.test.ts`, `tests/structure/status-contract.test.ts`
**Tags**: @backend @golden

**Preconditions**:

- The pre-change expected values for sections 1–6 (states, reasons, counts, ordered identities, truncation, evidence) captured as the baseline, plus the pre-change digest golden.
- DEC-16's enumerated optional-field allowlist, pinned in the contract and reused by TC-ATT-003.
- A mutation control that changes a six-section field.

**Steps**:

1. Run every existing status behaviour, corpus, and golden suite and assert green with unchanged expectations for sections 1–6 (the suites are updated only where the DEC-16 allowlist and the three new section lines/goldens require it; no expectation for a six-section state, count, identity, evidence reason, state derivation, required field, or truncation flag may change).
2. Assert for identical facts that sections 1–6 keep the same state, reasons, counts, ordered items, and truncation flags as the baseline; assert the CI classification, tracker family order/caps, provider ordering, and parked ordering are unchanged.
3. Assert the machine delta is exactly DEC-16's allowlist: optional `findings[]` on every section; hand-back `age`/`ageUnknownReason`/`slaState`; hygiene per-assertion tri-state counts; parked `condition`; lanes attention-state declaration fields. Assert every allowlisted field is optional in the type contract, and that a diff with any other key, a required-field change, or a removed/re-typed key fails.
4. Assert the human delta is exactly: the tracker `gates ...` fragment and the `hygiene <n> (<a> unknown)` fragment, plus the three new lines and the rollup. Assert the `changes`, `ci`, `lanes`, `providers`, and `parked` lines are byte-identical to the pre-change golden.
5. Assert the schema version, error table, config key set, exit-code projection, section order, state derivation, and section ids 1–6 are unchanged (cross-checked by TC-ATT-003/038).
6. Assert the pre-change corpus cases still pass with their original expectations plus the allowlisted fields; assert no case was deleted or weakened to accommodate the change.
7. Control: change a six-section count/state/identity in a temp expectation and assert the suite fails; add an undeclared field to `tracker` and assert step 3 fails; make an allowlisted field required and assert the type probe fails.

**Expected Outcome**:

- The change is provably additive under DEC-16: sections 1–6 keep ids, order, state derivation, required fields, states, counts, evidence, and rank keys, and the only delta is the enumerated optional-field allowlist plus the declared human fragments; any other delta fails.

#### TC-ATT-038 - Consumer compatibility: brief, command registry, queue ready, verify gates

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: RSK-1, RSK-9, §8.5, §22, DEC-1
**Test Type(s)**: Integration, Structure
**Automation Level**: Automated
**Evidence Level**: behaviour + structure
**Target Layer / Location**: `tests/structure/{brief-contract,brief-imports,content-inventory}.test.ts`, `tests/behaviour/brief-*.test.ts`, `tests/golden/brief.test.ts`, `tests/behaviour/queue-ready-*.test.ts`, `tests/golden/queue-ready.test.ts`, `tests/behaviour/verify-gates-*.test.ts`, `tests/golden/verify-gates.test.ts`
**Tags**: @backend

**Preconditions**:

- The shipped consumer suites and goldens as the baseline.
- The command-registry content inventory and the status row's M1-S10 note.
- A fixture where the brief consumes the same collector state the digest reports.

**Steps**:

1. Run the brief structure, behaviour, corpus, and golden suites and assert green with unchanged output for the same facts; assert the brief projects digest sections by id and tolerates the three additional sections without error (no hard-coded six-section assumption).
2. Assert the brief's "same collector state" claim still holds for the fields it renders: any ready-to-merge or owner-gate-age anchor it consumes agrees with the digest's values for the same facts, or the mismatch is recorded as a documentation-sync obligation (phase 7) rather than silently accepted.
3. Assert the `queue ready` suites and golden are unchanged and that no status change altered its payload, classification, or ranking.
4. Assert the `verify gates` suites are unchanged and that the shared constants (`STATUS_CI_RESULTS`, `STATUS_OWNER_ATTENTION_LABELS`, `STATUS_SOURCE_PIPELINE_LIMIT`) are still consumed by reference in both directions.
5. Assert the content inventory names the status row's M1-S10 note exactly once and that no duplicate or stale row exists; assert the man-page reconciliation is recorded as a phase-7 obligation (RSK-9) and that no test asserts an undelivered `--watch`/exit-1 feature.
6. Assert no new configuration key or consumer-breaking field appears; assert the pre-change consumer type probe still typechecks.
7. Control: introduce a hard-coded six-section assumption in a temp brief copy and assert the compatibility case fails; restore and assert green.

**Expected Outcome**:

- The additive change leaves every shipped consumer working and provably agreeing with the digest where they share facts, with documentation drift recorded rather than hidden.

#### TC-ATT-039 - Aggregation ≤50 ms over enlarged cap-sized inputs

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: NFR-5, NFR-1, NFR-3
**Test Type(s)**: Performance, Integration
**Automation Level**: Automated
**Evidence Level**: performance
**Target Layer / Location**: extended `tests/behaviour/status-performance.test.ts`, `tests/fixtures/status/matrix/bounds/**`
**Tags**: @backend @perf

**Preconditions**:

- A cap-sized fixture (every new surface at cap: 8 findings with 8 members, 8 ready items, four family lists, 8 CI runs, 8 PRs, 8 parks, 8 parked items).
- An over-cap input (100 items per source, 20 runs, 12 PRs).
- `performance.now` around `aggregateStatus` and `renderStatusHuman` only (excluding reads), one warm-up, median of five.

**Steps**:

1. Warm up once, then assert the median aggregation + rendering time over the cap-sized fixture is ≤ 50 ms; record the measured value in the test output.
2. Repeat over the over-cap input and assert the cap is applied before rendering and the measurement stays within the bound.
3. Assert the measurement includes the findings grouping/ranking, hygiene assertions, ready classification, and both renderers.
4. Assert the measurement is live: a deliberately expensive control (quadratic member scan over the full observation set) exceeds the bound or is rejected by the cap scan.
5. Assert the measurement excludes I/O (reads asserted separately by TC-ATT-030) and is stable across three consecutive runs within a recorded tolerance.
6. Record the environment (runtime version, machine class) with the result; do not silently relax the 50 ms bound.
7. Assert the per-section work is linear in the capped population: doubling the raw input beyond the cap does not double the aggregation time (bounded-input assertion).

**Expected Outcome**:

- Aggregation and rendering over the enlarged at-cap output complete within 50 ms on the reference environment, and the measurement is reproducible, live, and linear over capped inputs.

#### TC-ATT-040 - Opt-in live smoke: nine-section structural invariants only

**Scenario Type**: Happy Path
**Impact Level**: Minor
**Priority**: Low
**Related IDs**: QA strategy, NFR-1, NFR-2, NFR-9
**Test Type(s)**: Integration, Manual-opt-in
**Automation Level**: Automated (opt-in, outside the aggregate check)
**Evidence Level**: live-smoke
**Target Layer / Location**: extended `tests/behaviour/status-live.test.ts` (test-only switch plus resolvable credential)
**Tags**: @backend @live

**Preconditions**:

- The test-only live switch enabled and a resolvable GitHub credential for a bound repository.
- No default-CI run: the suite is skipped without both.

**Steps**:

1. Run the command against the live repository and assert the envelope is a valid `CommandResult` with nine sections in the declared order and one state from the closed set per section.
2. Assert evidence is present per section, bounds hold (machine `data` ≤ 65 536 bytes; human ≤ 32 lines and ≤ 6144 bytes), and no secret, title, or payload appears in either mode.
3. Assert structural invariants only: ready-to-merge is never `not-delivered`; spend and blockers are always `not-delivered`; lanes is always `not-delivered`; the lanes declaration names the closed vocabulary `delivering`/`idle-with-reason`/`idle-no-reason` but no per-lane state value and no `lane.idle-no-reason` code appear; every emitted finding's code is in the registry and its severity equals the registry default; no finding is emitted for a section whose evidence declares a failed read (DEC-18).
4. Assert that no section rendered `observed` with zero items after a declared read failure, and that `merge-ready` is numeric only where review signals were observed (otherwise `?`).
5. Never pin volatile counts, refs, names, or timings; assert non-vacuity bounds only (`≥ 0`, structural presence).
6. Assert the live evidence artifact (if produced) is bounded, secret-free, and not committed by default.

**Expected Outcome**:

- The live smoke confirms the nine-section structural contract against real data without pinning volatile values, and stays opt-in and outside the aggregate gate.

#### TC-ATT-041 - Hygiene satisfied arm: conforming epic/points values and mapped milestone satisfy, silently

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F4-4, F-4, F-4a, DM-7, DM-13, DEC-13
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Evidence Level**: behaviour
**Target Layer / Location**: `tests/behaviour/status-hygiene.test.ts`, `tests/fixtures/status/corpus/hygiene-satisfied-arm/**`
**Tags**: @backend

**Preconditions**:

- All three assertion signals declared **available** on the tracker read result.
- Conforming variants: label `epic` (bare token), label `epic:payments` (prefix), label `points:0`, label `points:1`, label `points:42`, and a present milestone value.
- The same items also carry the unrelated labels a real ticket would have, plus one item with several conforming signals at once.

**Steps**:

1. For each conforming epic variant (`epic`, `epic:payments`) assert `epic-membership.satisfied` increments by one, `violations` does not increment, and **no** `tracker.hygiene.epic-membership` finding or member is emitted.
2. For each conforming points variant (`points:0`, `points:1`, `points:42`) assert `story-points.satisfied` increments and no finding is emitted; assert `points:0` is satisfied because zero is a parseable non-negative integer, not an absence.
3. For the present-milestone item assert `in-sprint.satisfied` increments and no `tracker.hygiene.in-sprint` finding is emitted.
4. Assert an item conforming on all three assertions contributes three satisfied increments and zero findings; assert the family emits no code for any satisfied item.
5. Assert satisfied items still count in the open-item population and are not silently dropped by the four-item render cap: the satisfied count is computed before the cap even when the item is omitted from the rendered list.
6. Assert the human tracker fragment does not render a satisfied item and that `hygiene <n>` counts only findings (violations), never satisfied items.
7. Controls: flip each conforming value to its violating counterpart in the same fixture and assert the satisfied count decreases while the violation finding appears (proving the arm is live, paired with TC-ATT-012); a test-only copy that emits a finding for satisfied items fails by name.

**Expected Outcome**:

- Conforming values are recorded as satisfied, produce no finding, contribute to no violation count, and remain visible in the family counts; the satisfied arm is proven live against its absence counterpart.

#### TC-ATT-042 - No-evidence-no-claim: failed or unresolved CI read emits no finding

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-5, F-2, DEC-18, DM-4, AC-F1-1
**Test Type(s)**: Integration, Negative control
**Automation Level**: Automated
**Evidence Level**: behaviour + negative-control
**Target Layer / Location**: `tests/behaviour/status-findings.test.ts`, extended `tests/behaviour/status-negative-controls.test.ts`, `tests/fixtures/status/corpus/ci-read-failed-no-finding/**`
**Tags**: @backend

**Preconditions**:

- Three CI failure modes: the check-runs read fails (classified adapter failure); the checkout SHA is unresolved; the pipeline read is unattempted (no binding).
- A control fixture with the same runs observed successfully on the primary branch.
- A `planted-status-*` canary in the provider payload of the failing read.

**Steps**:

1. For each failure mode assert the CI section state is `unknown` (or `unavailable` for the no-binding case), the evidence carries the classified reason (`read-failed`, `commit-unresolved`, or the shipped equivalent), and the section's `findings` array is absent or empty — **zero** CI findings.
2. Assert no `ci.red-on-main` code appears anywhere in the payload, evidence, human text, or rollup; assert the attention total is not incremented by the failure.
3. Assert the section can still render an honest zero where the shipped rules allow it only for observed verified-empty (`none` reported runs), and that `unknown` never renders `0` or `ok`/`green`/`success`.
4. Assert the failure yields no fabricated member, no fabricated count, and no finding for any other section.
5. Assert the parsed failure reason is bounded and classified (existing `failureCode`/`failureClass` identities only) and that the canary from the failed payload never appears.
6. Assert the human `ci` line renders the declared unknown form and the rollup stays truthful (`attention 0 findings ()` when this is the only would-be finding).
7. Controls: the observed-read control with four failed primary-branch runs emits exactly one `ci.red-on-main` with `count: 4` (TC-ATT-006); a test-only copy that derives a finding from a failure envelope fails by name; a fixture with a failed tracker read asserts the same no-finding rule for the tracker section, proving the rule is general, not CI-special-cased.
8. Assert this case is part of the corpus (`ci-read-failed-no-finding`) and the negative-control completeness meta-check.

**Expected Outcome**:

- A failed or unresolved CI read produces no finding at all: the failure is carried by the section's `unknown`/`unavailable` state and evidence, never converted into a red-branch claim, and the same rule holds for other sections.

## 6. Environments and Test Data

### 6.1 Environments

| Environment | Requirements | Notes |
|-------------|--------------|-------|
| Local dev (delivery) | Bun pinned by `.bun-version`; pnpm pinned by `packageManager` | All status suites are hermetic and in-process; no credentials or network |
| CI (GitHub Actions, `ubuntu-latest`) | Frozen-lockfile install; pinned Bun/pnpm; existing `ts-*` jobs | Authoritative for structure, behaviour, corpus, golden, performance, boundary, and aggregate gates |
| Temp fixture roots | `mkdtemp` under the OS temp directory (state harness, mutation copies) | Never writes the live tree, `dist/`, or the real local state directory |
| In-process digest process | Bun runtime; injected brand, clock, run id, transport, provider facts, local context, state store, streams | Fixed output facts for byte assertions; no child processes |
| Default CI | No credentials, no live switch, no network | Zero live calls; the throwing `fetch` guard proves it |
| Opt-in live smoke | Test-only switch under `tests/**` + resolvable credential | Not part of `pnpm check`; structural assertions only |

### 6.2 Test Data

| Data | Source / shape | Lifecycle |
|------|----------------|-----------|
| Existing status facts | `tests/fixtures/status/harness.ts` (`baseFacts`, `capSizedFacts`, `workItemRead`, `deliveryRequestRead`, `pipelineRunRead`, provider/local-context builders), `tests/fixtures/status/matrix/cases.ts` | Read-only; extended only additively |
| Findings fixtures | New builders for coalesced observations, run identities, grouped members, and mixed severities; under/at/over-cap sets | In-memory or committed under `tests/fixtures/status/matrix/bounds/**`; read-only |
| Hygiene fixtures | Open/closed/canceled items with mapped labels (`epic`, `epic:*`, `points:<int>`, and their absence/invalid forms) and milestones; declared per-assertion availability variants including the mixed case | Committed under `tests/fixtures/status/corpus/**` (`hygiene-assertions-tri-state`, `hygiene-absence-violation`, `hygiene-satisfied-arm`, `hygiene-all-unknown`); availability variants are deep copies |
| Owner-gate fixtures | Hand-backs at T−1 ms/T/T+1 ms and 26 h from the injected clock; absent and unparseable timestamp variants; default-applied variant | Read-only; expected ages derived from `NOW_MS` |
| Ready-to-merge fixtures | Non-draft/draft/closed/merged PRs with observed, changes-requested, and unknown review state; queue-ready comparison facts | Read-only; the differential comparison reuses the same facts |
| Parked fixtures | Entries with/without condition, over-cap condition, multibyte condition, unknown/parseable age, ref-less entry; notes canary | Read-only; malformed/missing context variants |
| Bounds fixtures | `matrix/bounds/{under-cap,at-cap,over-cap,cap-sized,hostile-length,multibyte}/**` including `all-caps-bound` | Read-only; mutated twins built in memory |
| Corpus | `tests/fixtures/status/corpus/<case>/case.json` (facts + expected sections/findings + expected truncation) | Read-only; completeness- and mutation-checked |
| Golden | `tests/fixtures/status/golden/{digest.json,human.txt}` plus declared state variants | Regenerated once, deliberately, in this change; read-only at test time |
| Contract mutation copies | Deep copies or temp module copies of the registry, bounds, grammar literals, and availability data | Created per test and discarded; production contracts never mutated |
| Consumer baselines | `tests/fixtures/{brief,queue-ready,verify-gates}/**` and their goldens | Read-only non-regression oracle; not regenerated by this change |
| Live smoke data | Real repository via a resolvable credential | Opt-in; never committed; no volatile value pinned |

### 6.3 Isolation Strategy

- Every synthetic fixture and mutation case uses a fresh `mkdtemp` root; no test writes the live repository tree, `dist/`, the real local state directory, or the user's home. A clean-tree assertion (`git status --porcelain`) is part of the aggregate gate.
- Status suites inject brand, clock, run id, transport, provider facts, local context, state store, and streams; they never read `$HOME`, the wall clock, the ambient environment where purity is asserted, or the network.
- The registry, bounds, grammar literals, availability declarations, and rank keys are injected as data; mutation controls use deep or temp copies, and the unmutated control runs in the same suite.
- Corpus and golden fixtures are read-only at test time; corruption and mutation controls operate on in-memory values or temp copies.
- The pre-change six-section baselines and the consumer goldens are the non-regression oracle and are not regenerated by this change; only the status digest/human goldens are regenerated, once, deliberately, and reviewed.

## 7. Automation Plan and Implementation Mapping

All TCs are automated (TC-ATT-040 is opt-in). Locations follow the spec's affected-components table and the shipped QA table's file structure; delivery planning may rename helper files but must preserve each TC's behaviour, states, reasons, codes, bounds, assertions, and AC/NFR mapping.

| TC ID | Test file / artefact | Execution command | Control / mutation | Status |
|-------|----------------------|-------------------|--------------------|--------|
| TC-ATT-001 | `tests/structure/status-findings-contract.test.ts`, `tests/structure/inventory.json` | `bun test tests/structure/status-findings-contract.test.ts` | registry key set/order/defaults; dormant marker; code→surface map; data-only detector; per-datum deep-copy mutations; inventory | To Implement |
| TC-ATT-002 | `tests/structure/status-contract.test.ts` (extended) | `bun test tests/structure/status-contract.test.ts` | 8/8/8 caps; 32/6144 human bounds; 65 536 unchanged; every pre-existing cap; per-constant mutations | Existing – Update |
| TC-ATT-003 | `tests/structure/status-contract.test.ts` (extended), `tests/types/**` backward probe | same; `pnpm typecheck` | nine-id order; schema version; pre-change required fields; DEC-16 allowlist and optionality; DEC-17 naming; reorder/rename/drop/bump/required mutations | Existing – Update + To Implement (type probe) |
| TC-ATT-004 | `tests/structure/status-imports.test.ts`, `tests/structure/content-inventory.test.ts`, `tests/boundaries/**` | corresponding `bun test`; `bun run scripts/checks/{ambient-globals,forbidden-literals,workspace-entrypoints}.ts` | domain-only imports; AST purity; SLA import by reference; DM-13 normalization placement; no new endpoint; inventory; boundary fixture coverage | Existing – Update |
| TC-ATT-005 | `tests/behaviour/status-findings.test.ts`, `tests/behaviour/status-corpus.test.ts` | corresponding `bun test` | corpus-wide code/severity/count/unique-member/`evidenceRef` sweep; unregistered-code, bad-severity, duplicate-member controls | To Implement + Existing – Update |
| TC-ATT-006 | `tests/behaviour/status-findings.test.ts`, `corpus/four-red-runs-grouped/**` | `bun test tests/behaviour/status-findings.test.ts` | 0/1/2/3/4/9/20-run controls; branch control; mixed result control; reversed order | To Implement |
| TC-ATT-007 | `tests/behaviour/status-findings-bounds.test.ts`, `matrix/bounds/**` | `bun test tests/behaviour/status-findings-bounds.test.ts` | 7/8/9/12/20 members; repeated identity (`count > members`); unique dedup; `evidenceRef`; omitted semantics; deterministic truncation; cap-removed control | To Implement |
| TC-ATT-008 | `tests/behaviour/status-findings-bounds.test.ts`, `tests/structure/status-findings-contract.test.ts` | corresponding `bun test` | reachable-max computation; test-only 10-code registry injection; top-8 retention; cap-removed control; no production/mutation leak | To Implement |
| TC-ATT-009 | `tests/behaviour/status-findings.test.ts` | same | mixed severity/count matrix; code-ascending ties; permutation twins; comparator totality; changed-count control | To Implement |
| TC-ATT-010 | `tests/behaviour/status-tracker.test.ts` (extended) | `bun test tests/behaviour/status-tracker.test.ts` | blank title/empty labels/both; stall grouping; unknown-activity no-finding; baseline family comparison | Existing – Update |
| TC-ATT-011 | `tests/behaviour/status-hygiene.test.ts`, `corpus/hygiene-assertions-tri-state/**` | `bun test tests/behaviour/status-hygiene.test.ts` | three named surfaces; tri-state sums; open-only; grouped codes; cap-before-count; all-violating/all-satisfied/empty controls; fourth-surface control | To Implement |
| TC-ATT-012 | `tests/behaviour/status-hygiene.test.ts`, `corpus/hygiene-absence-violation/**` | same | absence variants per assertion; conforming controls (`epic`, `points:0`, milestone); grouping; title/assignee immunity; label-token mutation; absence-as-satisfied control | To Implement |
| TC-ATT-013 | `tests/behaviour/status-hygiene.test.ts`, `status-section-states.test.ts` (extended), `corpus/hygiene-all-unknown/**` | corresponding `bun test` | additive availability keys; all-unknown counts; mixed-availability independence; `signal-unavailable`; GitHub-slice all-unknown; empty-population distinction; restored availability; hard-coded-availability control | To Implement + Existing – Update |
| TC-ATT-014 | `tests/behaviour/status-owner-gate-age.test.ts` | `bun test tests/behaviour/status-owner-gate-age.test.ts` | 26 h escalated; T−1/T/T+1 from contract; default-applied counted; grouped count; fresh control; no-record guard; duplicated-threshold control | To Implement |
| TC-ATT-015 | `tests/behaviour/status-owner-gate-age.test.ts`, `corpus/owner-gate-unknown-age-escalated/**` | same | absent/unparseable variants; two distinct markers; never 0/fresh; never defaulted; clock advance; `0h` control; unknown-as-fresh control | To Implement |
| TC-ATT-016 | `tests/behaviour/status-parked-conditions.test.ts`, `corpus/parked-condition-present/**` | `bun test tests/behaviour/status-parked-conditions.test.ts` | condition present/over-cap/multibyte/absent; notes canary; malformed/missing/empty contexts; human leak scan | To Implement |
| TC-ATT-017 | `tests/behaviour/status-parked-conditions.test.ts`, `corpus/parked-stale-no-condition-grouped/**` | same | three contributing entries; condition control; parseable-age control; ref-less identity; persistence; member privacy | To Implement |
| TC-ATT-018 | `tests/structure/status-findings-contract.test.ts`, `tests/behaviour/status-placeholders.test.ts`, `corpus/lanes-not-delivered-vocabulary/**` | corresponding `bun test` | shipped-section identity; closed three-literal vocabulary; never-emitted scan over all payloads/text; code-injection control; vocabulary add/remove controls | To Implement + Existing – Update |
| TC-ATT-019 | `tests/behaviour/status-placeholders.test.ts`, `corpus/placeholders-not-delivered/**` | same | section shape/indices; capability/story/reason/note; zero counts; human line; all-fixture state sweep; no spend implementation; mutations | To Implement |
| TC-ATT-020 | same | same | blockers shape/story; human line; no blockers implementation; ordering; mutations | To Implement |
| TC-ATT-021 | `tests/behaviour/status-section-states.test.ts` (extended), `tests/behaviour/status-placeholders.test.ts` | `bun test tests/behaviour/status-section-states.test.ts` | nine-section totality; state counts; findings total groups-only; placeholder count exactly 2; actionable zero contribution; section-removed/added and count-by-observations controls | Existing – Update + To Implement |
| TC-ATT-022 | `tests/behaviour/status-ready-to-merge.test.ts`, `corpus/ready-merge-ready-ranked/**` | `bun test tests/behaviour/status-ready-to-merge.test.ts` | class matrix; rank keys; queue-ready differential; no verdict; verified-empty real zero; zero-extra-read guard | To Implement |
| TC-ATT-023 | same, `corpus/ready-review-unknown-degraded/**` | same | unavailable/partial/failed/no-binding; `?`; unknown markers; no fabrication from CI/draft/threads; restored observed control | To Implement |
| TC-ATT-024 | `tests/behaviour/status-section-states.test.ts` (extended), `matrix/cases.ts`, `tests/structure/status-contract.test.ts` | corresponding `bun test` | full row; precedence; presence in every state; never `not-delivered`; row-mutation control | Existing – Update |
| TC-ATT-025 | `tests/behaviour/status-findings-bounds.test.ts` | `bun test tests/behaviour/status-findings-bounds.test.ts` | 7/8/9/12 items; merge-ready never dropped; deterministic truncation; under-cap control; nine-merge-ready disclosure control | To Implement |
| TC-ATT-026 | `tests/behaviour/status-output.test.ts` (extended), `tests/fixtures/status/golden/human.txt` | `bun test tests/behaviour/status-output.test.ts` | exact line order; header present/absent; tracker fragments; unchanged five lines; `ready`/`spend`/`blockers` lines; data-only render; no leak; order/zero mutations | Existing – Update |
| TC-ATT-027 | `tests/behaviour/status-output.test.ts` (extended), `corpus/{no-findings-attention-zero,mixed-attention-ranked}/**` | same | 0/1/2/3/4/6/9 groups; `+N` grouped findings; multi-count groups; rank order; `<n>` = findings total; observation-count and reorder controls | Existing – Update + To Implement |
| TC-ATT-028 | `tests/behaviour/status-output.test.ts` (extended), `tests/golden/status-digest.test.ts` (extended) | corresponding `bun test` | 11 structural lines; 32 defensive; 6144 operative max-length stress; UTF-8 multibyte; hostile clamp; retired 24/4096 source scan; old-bound and operative-line controls | Existing – Update |
| TC-ATT-029 | `corpus/all-caps-bound/**`, `tests/behaviour/status-output.test.ts`, `tests/behaviour/status-corpus.test.ts` | corresponding `bun test` | all surfaces at cap; `data` ≤ 65 536; exact markers; corpus case name; hostile variant; bound-raised/oversize controls | To Implement + Existing – Update |
| TC-ATT-030 | `tests/behaviour/status-performance.test.ts` (extended) | `bun test tests/behaviour/status-performance.test.ts` | three reads/one fold/one resolve; findings-heavy identical budget; DM-13 mapping on the same page; modes identical; no pagination/retry/new host; unavailable-binding zero reads; second-read, non-GET, widened-request controls | Existing – Update |
| TC-ATT-031 | `tests/behaviour/status-readonly-determinism.test.ts` (extended), `tests/behaviour/verify-support.ts` | `bun test tests/behaviour/status-readonly-determinism.test.ts` | guarded store zero appends/fences; no SLA record; zero fs writes; no child process; no default/waiver authority; seeded-write control | Existing – Update |
| TC-ATT-032 | same + `tests/golden/helpers.ts` | same | repeated runs; all permutation twins; 50-run hash set; changed-fact control; TZ/time control | Existing – Update |
| TC-ATT-033 | `tests/behaviour/status-corpus.test.ts` (extended), `tests/fixtures/status/corpus/**` | `bun test tests/behaviour/status-corpus.test.ts` | nine sections × row states; absence/satisfied/mixed/no-evidence named cases; per-case oracles; corruption-by-case-name mutations; zero live calls; read-only corpus; case-removal control | Existing – Update |
| TC-ATT-034 | `tests/golden/status-digest.test.ts` (extended), `tests/fixtures/status/golden/**` | `bun test tests/golden/status-digest.test.ts` | byte equality per state; bounds; additive-delta baseline; no rewrite path; changed-fact controls; deliberate regeneration record | Existing – Update |
| TC-ATT-035 | `tests/behaviour/status-negative-controls.test.ts` (extended) | `bun test tests/behaviour/status-negative-controls.test.ts` | new-section failure matrix; no-finding-from-failure; canaries; restored controls; completeness meta-check; fabricated-zero scan; case-removal control | Existing – Update |
| TC-ATT-036 | `tests/behaviour/status-negative-controls.test.ts`, `tests/checks/{secret-read-boundary,forbidden-literals}.test.ts`, `tests/structure/status-contract.test.ts` | corresponding `bun test` | identity-only members/evidence; canary and credential scans; human rollup privacy; condition leak; allowlist unchanged; title-fallback control | Existing – Update |
| TC-ATT-037 | existing `tests/behaviour/status-*.test.ts`, `tests/golden/status-digest.test.ts`, `tests/structure/status-contract.test.ts` | corresponding `bun test` | baseline comparison; DEC-16 allowlist and optionality; five unchanged human lines; unchanged schema/error/config/derivation; mutation control | Existing – Update (expectations only where the allowlist requires) |
| TC-ATT-038 | `tests/structure/{brief-contract,brief-imports,content-inventory}.test.ts`, `tests/behaviour/brief-*.test.ts`, `tests/golden/brief.test.ts`, `tests/behaviour/queue-ready-*.test.ts`, `tests/golden/queue-ready.test.ts`, `tests/behaviour/verify-gates-*.test.ts`, `tests/golden/verify-gates.test.ts` | corresponding `bun test` | brief six-section tolerance; shared-truth agreement; queue-ready/verify-gates unchanged; registry row once; six-section hard-code control | Existing – No Change (verified) + content update |
| TC-ATT-039 | `tests/behaviour/status-performance.test.ts` (extended), `matrix/bounds/cap-sized/**` | `bun test tests/behaviour/status-performance.test.ts` | warm-up + median ≤ 50 ms; over-cap input; expensive control; environment recorded; linearity check | To Implement |
| TC-ATT-040 | `tests/behaviour/status-live.test.ts` (extended) | opt-in only: `bun test tests/behaviour/status-live.test.ts` with the live switch and credential | structural invariants; no volatile counts; nine sections; placeholders; closed lane vocabulary with no lane state / dormant code; no finding from a failed read; bounds; secret-free | Existing – Update (opt-in) |
| TC-ATT-041 | `tests/behaviour/status-hygiene.test.ts`, `corpus/hygiene-satisfied-arm/**` | `bun test tests/behaviour/status-hygiene.test.ts` | conforming `epic`/`epic:*`/`points:0`/`points:N`/milestone; satisfied increments; no finding; cap-before-count; paired violating flip; satisfied-finding control | To Implement |
| TC-ATT-042 | `tests/behaviour/status-findings.test.ts`, `tests/behaviour/status-negative-controls.test.ts` (extended), `corpus/ci-read-failed-no-finding/**` | corresponding `bun test` | failed read / unresolved SHA / unattempted read; zero findings; unknown state and reasons; no fabricated `ci.red-on-main`; canary; restored observed control; generality to another section | To Implement + Existing – Update |

**Execution order.**

1. Contracts and baselines: TC-ATT-001, TC-ATT-002, TC-ATT-003, TC-ATT-004, TC-ATT-021 (structure half).
2. Findings layer: TC-ATT-005, TC-ATT-006, TC-ATT-007, TC-ATT-008, TC-ATT-009, TC-ATT-010, TC-ATT-042.
3. Hygiene: TC-ATT-011, TC-ATT-012, TC-ATT-013, TC-ATT-041.
4. Owner gates and parked work: TC-ATT-014, TC-ATT-015, TC-ATT-016, TC-ATT-017.
5. New sections and placeholders: TC-ATT-018, TC-ATT-019, TC-ATT-020, TC-ATT-021, TC-ATT-022, TC-ATT-023, TC-ATT-024, TC-ATT-025.
6. Rendering: TC-ATT-026, TC-ATT-027, TC-ATT-028.
7. Bounds, budget, posture, determinism: TC-ATT-029, TC-ATT-030, TC-ATT-031, TC-ATT-032.
8. Corpus, golden, negatives, non-regression, performance: TC-ATT-033, TC-ATT-034, TC-ATT-035, TC-ATT-036, TC-ATT-037, TC-ATT-038, TC-ATT-039.
9. Opt-in live smoke (not part of the aggregate): TC-ATT-040.
10. Aggregate: `pnpm check`; `git diff --check`; `git status --porcelain`.

All 42 TCs appear exactly once in this order.

**Wiring.** The new behaviour suites are discovered by root `bun test`; no new CI job topology is introduced. The new structure suite is discovered by `bun test tests/structure`; the backward-compatibility type probe is compiled by the existing typecheck. The corpus, golden, performance, boundary, ambient, forbidden-literal, secret-read, and entrypoint gates extend to the new modules automatically; no rule is added or weakened. Documentation reconciliation runs in phase 7 (status digest canonical spec, brief "same collector state" claim, owner-gate SLA and queue-ready reuse claims, command registry row, status man page), with `git diff --check`, YAML parse for changed `.yaml` files, markdown/link review, and `bash scripts/.tests/test-doc-distribution.sh` for any changed redistributable doc.

**Evidence commands** (run and record in the change/PR; never record unrun results as passing):

```
pnpm install --frozen-lockfile
bun test tests/structure/status-findings-contract.test.ts
bun test tests/structure/status-contract.test.ts
bun test tests/structure/status-imports.test.ts
bun test tests/structure/content-inventory.test.ts
bun test tests/structure/brief-contract.test.ts
bun test tests/structure/queue-ready-contract.test.ts
bun test tests/structure/verify-gates-contract.test.ts
bun test tests/structure/trap-catalog.test.ts
bun test tests/behaviour/status-findings.test.ts
bun test tests/behaviour/status-findings-bounds.test.ts
bun test tests/behaviour/status-hygiene.test.ts
bun test tests/behaviour/status-owner-gate-age.test.ts
bun test tests/behaviour/status-parked-conditions.test.ts
bun test tests/behaviour/status-ready-to-merge.test.ts
bun test tests/behaviour/status-placeholders.test.ts
bun test tests/behaviour/status-section-states.test.ts
bun test tests/behaviour/status-command.test.ts
bun test tests/behaviour/status-tracker.test.ts
bun test tests/behaviour/status-changes-ci.test.ts
bun test tests/behaviour/status-providers-parked.test.ts
bun test tests/behaviour/status-repository.test.ts
bun test tests/behaviour/status-negative-controls.test.ts
bun test tests/behaviour/status-readonly-determinism.test.ts
bun test tests/behaviour/status-output.test.ts
bun test tests/behaviour/status-corpus.test.ts
bun test tests/behaviour/status-performance.test.ts
bun test tests/golden/status-digest.test.ts
bun test tests/behaviour/brief-corpus.test.ts
bun test tests/golden/brief.test.ts
bun test tests/behaviour/queue-ready-corpus.test.ts
bun test tests/golden/queue-ready.test.ts
bun test tests/behaviour/verify-gates-corpus.test.ts
bun test tests/golden/verify-gates.test.ts
bun test tests/checks/secret-read-boundary.test.ts
bun test tests/checks/forbidden-literals.test.ts
bun test tests/boundaries
bun run scripts/checks/ambient-globals.ts
bun run scripts/checks/forbidden-literals.ts
bun run scripts/checks/exit-code-literals.ts
bun run scripts/checks/workspace-entrypoints.ts
pnpm check
git diff --check
git status --porcelain
```

**Open-PR DoD evidence checklist.** All 23 ACs have a passing traceable TC and all 10 NFRs are measured; the closed ten-code registry is pinned and mutation-tested with no free-form finding identity anywhere in the corpus; four red primary-branch runs are one `ci.red-on-main` with count 4 and four unique members plus `evidenceRef`, and the grouping generalises to 0/1/2/3/9/20; the findings cap is proven defensive at the pure layer with a permitted test-only registry extension while no legal input is truncated; a failed or unresolved read emits no finding (no-evidence-no-claim), asserted for CI and one other section; every cap (8 findings, 8 members, 8 ready items) is enforced with a declared drop and an under-cap control, and member deduplication keeps the exact observation count; the three hygiene assertions are named with tri-state counts, **absence inside a declared-available signal is a violation by name** for each convention, conforming values satisfy silently, and an undeclared signal (including the mixed case) is all-unknown with `signal-unavailable` while declared assertions evaluate independently; the mapped signals come from the existing bounded page (labels and additively normalized milestone) with zero new reads; owner-gate ages come from the delivered evaluator, unknown age escalates and never renders zero or fresh, and no SLA record is written; parked conditions surface under the cap and `parked.stale-no-condition` groups with both negative controls; the lanes section is unchanged with the closed `delivering`/`idle-with-reason`/`idle-no-reason` vocabulary declared and the dormant code never emitted; spend and blockers are named placeholders with pinned lines and a placeholder count of exactly 2; ready-to-merge ranks merge-ready first with deterministic keys and renders `?` under unknown review; the human grammar is line-for-line with the header optional and the rollup counting grouped findings; human output keeps 11 structural lines under a 32-line defensive cap and fits 6144 operative bytes including the max-length stress case, while machine `data` fits 65 536 bytes at full caps through the committed `all-caps-bound` case; the read budget stays 3/1/1 with zero new reads; output is deterministic and read-only; sections 1–6 keep ids, order, state derivation, required fields, states, counts, items, evidence, and rank keys with only DEC-16's optional-field allowlist and five byte-identical human lines; brief, queue ready, and verify gates are green; corpus completeness covers nine sections × five states plus the absence, satisfied, mixed-availability, and no-evidence cases and corruption fails by case name; goldens were regenerated once as a reviewed exception and are never rewritten by the suite. No merge or owner acceptance is claimed by this plan.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

**Specification risk coverage (RSK-1..RSK-9).** Every spec risk is exercised by at least one TC.

| Spec risk | Mitigating TC(s) |
|-----------|------------------|
| RSK-1 — brief projection drifts from the digest | TC-ATT-038, TC-ATT-037 |
| RSK-2 — hygiene assertions misread an *undeclared* signal as a violation (ADR-0006) | TC-ATT-011, TC-ATT-012, TC-ATT-013 (the gate is the availability declaration; item-level absence inside a declared signal is the intended violation) |
| RSK-3 — human digest growth erodes the session-start budget | TC-ATT-028, TC-ATT-027, TC-ATT-026 |
| RSK-4 — grouped findings hide actionable detail | TC-ATT-006, TC-ATT-007, TC-ATT-005 |
| RSK-5 — finding-code vocabulary drifts | TC-ATT-001, TC-ATT-005, TC-ATT-034 |
| RSK-6 — scope creep inside placeholders | TC-ATT-018, TC-ATT-019, TC-ATT-020 |
| RSK-7 — additive surfaces push the serialized digest toward 64 KiB | TC-ATT-029, TC-ATT-025, TC-ATT-008 |
| RSK-8 — ready-to-merge double-claims readiness | TC-ATT-022, TC-ATT-023 |
| RSK-9 — man-page/design-baseline drift (`--watch`, exit-1, `questions[]`) | TC-ATT-018, TC-ATT-035, TC-ATT-038 |

**Testing risks.**

| ID | Risk | Impact | Probability | Mitigation |
|----|------|--------|-------------|------------|
| RSK-T1 | A negative fixture is inert, so a fabricated all-clear passes | H | M | Every negative asserts exact state, reason, zero-item shape, and no fabricated finding, plus a restored control (§4.2) |
| RSK-T2 | The grouping test hard-codes four and cannot fail on a two- or nine-run regression | H | M | Count controls at 0/1/2/3/4/9/20 and a recomputed count oracle (TC-ATT-006/007) |
| RSK-T3 | Unknown and zero collapse (unknown age as `0h`, unknown review as `merge-ready 0`) | H | M | Paired zero/unknown representations in the same test (TC-ATT-015/023) |
| RSK-T4 | The three hygiene arms collapse into one another (absence read as unknown, undeclared read as violation, satisfied read as clean), so a regression passes | H | M | Same item shape run through absence/declared-conforming/undeclared in one suite; tri-state sums; restored-availability and label-token mutations; satisfied-finding control (TC-ATT-011/012/013/041) |
| RSK-T5 | The registry test passes because the fixture only emits one code | H | M | Corpus-wide sweep recomputing codes/counts from facts, plus a mixed-attention case (TC-ATT-005/006/009) |
| RSK-T6 | The findings cap is asserted but its defensive role is mistaken for a reachable limit | M | L | Cap exercised on the pure layer with the permitted test-only registry injection; real-input control shows 7 codes and no truncation; no production leak (TC-ATT-008, DEC-15) |
| RSK-T7 | Rank assertions pass on stable input order without a total key | H | M | Permutation twins and comparator-totality assertions (TC-ATT-009/032) |
| RSK-T8 | Truncation hides a merge-ready item or a high-severity finding | H | M | Over-cap fixtures place the urgent item last in source order and forbid its drop; repeated identities cannot consume member slots (TC-ATT-007/025) |
| RSK-T9 | Golden regeneration becomes a blanket rewrite | H | M | Read-only suite, single reviewed regeneration, DEC-16 allowlist baseline, changed-fact controls (TC-ATT-034/037) |
| RSK-T10 | The 64 KiB case passes only because surfaces were silently dropped | H | M | All-caps fixture asserts every surface at cap and all nine sections present (TC-ATT-029) |
| RSK-T11 | The 50 ms measurement is flaky on slow CI | M | M | Pure aggregation only, warm-up, median, environment recorded, bound not relaxed (TC-ATT-039) |
| RSK-T12 | "Additive" drifts into re-typing, a required field, or a hidden section-1–6 change | H | M | DEC-16 allowlist with optionality, type probe, five unchanged human lines, mutation control (TC-ATT-003/037) |
| RSK-T13 | Prerelease-time doc drift (man page, brief claim) is treated as green code | M | H | Consumer/documentation checks recorded as phase-7 obligations, no test asserts undelivered features (TC-ATT-038) |
| RSK-T14 | No-evidence-no-claim is special-cased to CI, so a failed tracker or PR read still fabricates a finding | H | M | TC-ATT-042 asserts the rule for CI plus one other section; TC-ATT-035 asserts zero findings for every failed new-section read |

### 8.2 Assumptions

- **A-T1 — Spec binding.** The spec v1.1 is the single source of truth for capabilities, 23 ACs, NFR-1..10, DM-1..13, DEC-1..18, the registry, the bounds, the grammar, and the hygiene mapping. Delivery planning may choose helper/file/export spellings but may not rebind a pinned value, code, severity, cap, bound, marker, label convention, or assertion.
- **A-T2 — Plan mapping.** GAP-1: the implementation plan (phase 4) must map all 42 TCs onto phases without reshaping them. If it alters a TC's behaviour, states, codes, bounds, or AC/NFR mapping, this test plan reopens.
- **A-T3 — In-process harness.** Every behaviour test uses `runStatusCli` with injected dependencies; no status suite spawns a child process or reads the ambient environment/network in default CI.
- **A-T4 — Contract data, never configuration.** The registry, severities, caps, bounds, rank keys, placeholder marker, lane vocabulary, and label conventions are contract data; tests mutate deep or temp copies only, and the shipped values are not operator-tunable at runtime.
- **A-T5 — Reuse by reference.** The SLA evaluator, thresholds, comparator, states, and unknown-age markers come from the M1-S5 modules; the queue-ready close classification and rank keys come from the queue-ready contracts. Status adds no second definition.
- **A-T6 — Mapped-signal provenance.** Hygiene signals are evaluated from the existing bounded tracker page: normalized labels through declared label conventions and the additively normalized milestone; declared per-assertion availability travels on the tracker read. Corpus fixtures supply mapped values so all three arms are reachable; the shipped GitHub path stays all-unknown where a mapping is not declared (DM-13, DEC-14).
- **A-T7 — Checkout-HEAD CI only.** The CI finding is scoped to the declared primary branch as observed through the checkout HEAD; open-PR-head CI is out of scope, and a successful read on a non-primary checkout produces no CI finding (Appendix A trigger scope). A failed or unresolved read produces no finding at all (DEC-18).
- **A-T8 — Naming and delivery-bound spellings.** DEC-17's naming convention is pinned: camelCase fields, kebab-case section/assertion ids, lowercase dotted codes, SCREAMING_SNAKE constants. Module/file/export names, the placeholder marker key, and human line padding remain delivery-bound.
- **A-T9 — No live evidence required.** The committed corpus, matrix, and golden are the deterministic oracle. The live smoke is optional, structural, and outside the aggregate gate.
- **A-T10 — One regeneration.** The status machine and human goldens are regenerated exactly once in this change as a reviewed exception, and are thereafter treated as immutable by the suite (§8.5).

### 8.3 Open Questions

No open question blocks delivery. Every iteration-1 gap is resolved in spec v1.1; the table records the resolution and the residual, non-blocking observation.

| ID | Question | Context | Status | Owner |
|----|----------|---------|--------|-------|
| OQ-T1 | Is the findings cap reachable? | GAP-2 → resolved: DEC-15 keeps 8 as defensive headroom; enforcement proven at the pure layer with a permitted test-only registry extension (AC-F2-4). | Resolved in spec v1.1 | — |
| OQ-T2 | What constitutes a hygiene violation? | GAP-3 → resolved: DEC-13 pins absence-as-violation inside a declared-available signal, with per-assertion conditions as contract data (AC-F4-2). | Resolved in spec v1.1 | — |
| OQ-T3 | Where do the hygiene signals come from? | GAP-4 → resolved: DEC-14/DM-13/F-4a map the existing page's labels and milestone with declared availability; zero new reads. | Resolved in spec v1.1 | — |
| OQ-T4 | Does `placeholderSectionCount` include lanes? | GAP-6 → resolved: DEC-17 pins exactly 2 (`spend`, `blockers`); lanes excluded. | Resolved in spec v1.1 | — |
| OQ-T5 | Does rollup `+N` count groups or observations? | GAP-7 → resolved: DEC-17 pins grouped findings beyond the three previewed. | Resolved in spec v1.1 | — |
| OQ-T6 | Why is the 32-line cap above the 11-line structural maximum? | GAP-8 → resolved: DEC-17 pins 32 as defensive headroom and 6144 bytes as the operative bound with a max-length stress case. | Resolved in spec v1.1 | — |
| OQ-T7 | What does a red non-primary checkout emit? | GAP-9 → resolved for failed reads by DEC-18/AC-F2-5. Residual: a *successful* read on a non-primary checkout emits no CI finding because Appendix A scopes `ci.red-on-main` to the primary branch; asserted as declared behaviour, no second code invented. | Resolved (declared scope); residual noted, non-blocking | @spec-writer (future code, if desired) |
| OQ-T8 | Which literals form the lane vocabulary? | GAP-11 → resolved: DEC-17 pins `delivering`, `idle-with-reason`, `idle-no-reason`. | Resolved in spec v1.1 | — |
| OQ-T9 | Does a member drop inflate `counts.omitted`? | GAP-5 → resolved: DEC-17 pins unique deduplicated members and `evidenceRef` = first member; `omitted` keeps its item meaning; the member drop is visible via exact `count` vs capped `members.length`. | Resolved in spec v1.1 | — |
| OQ-T10 | What CI tolerance applies to the 50 ms measurement? | RSK-T11. Warm-up + median + recorded environment; the spec bound is not silently relaxed. | Open — non-blocking, planning concern only | @plan-writer |

**Recorded gaps, not silently adjusted:**

1. **Implementation-plan mapping** — GAP-1/A-T2; pending phase 4; must map all 42 TCs without reshaping them.
2. **Residual CI scope observation** — OQ-T7; a successful non-primary checkout yields no CI finding by declared trigger scope; asserted, not treated as a defect and no code invented.
3. **CI timing tolerance** — OQ-T10; open, non-blocking, does not weaken the 50 ms bound.

Gaps GAP-2..GAP-12 are **resolved** in spec v1.1 by DEC-13..DEC-18 and are no longer carried as open readings; each resolution is restated against its TC in §1.2.

No AC and no NFR is left without a TC.

## 9. Plan Revision Log

| Version | Date (UTC) | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-11-06T23:30:00Z | Change Test Plan Writer | Initial plan: 40 TCs (TC-ATT-001..040). All 20 ACs (AC-F1-1..AC-F10-1, AC-NFR-1..3), all 10 NFRs, all 12 DMs, and all 9 spec risks mapped; the four ticket ACs traced verbatim. Pins the closed ten-code registry (including dormant `lane.idle-no-reason`), the three-value severity set, per-section per-code grouping with exact counts and bounded members (the pinned four-red-runs case plus 0/1/2/3/9/20 controls), the total rank key, the 8/8/8 caps with declared drops, the three named tri-state hygiene assertions with ADR-0006 unknown semantics and the all-unknown source-unavailable path, owner-gate ages and `slaState` reused from M1-S5 with unknown age escalating, parked conditions and `parked.stale-no-condition`, the declared-but-inert lanes vocabulary, the spend/blockers placeholders, the ready-to-merge action list with `?` under unknown review and a queue-ready differential, the extended human grammar and rollup within 32/6144, the unchanged 65 536-byte machine bound via an all-caps corpus case, the unchanged 3/1/1 read budget, determinism, read-only posture, evidence hygiene, six-section non-regression with an additive-delta allowlist, consumer compatibility, the 50 ms aggregation bound, and the opt-in live smoke. Thirteen recorded gaps with chosen readings (implementation-plan pending; unreachable findings cap; hygiene violation trigger; hygiene signal provenance; member dedup/representative naming; placeholder-count scope; rollup `+N` unit; human-line bound vs structural maximum; non-primary CI finding gap; "shape unchanged" vs additive fields; lane vocabulary literals; delivery-bound spellings; CI timing tolerance); no coverage silently weakened. |
| 1.1 | 2026-11-06T23:55:00Z | Change Test Plan Writer | Reconciled to spec v1.1 (DEC-13..DEC-18). (1) **Hygiene model reversed to absence-as-violation** (DEC-13): TC-ATT-012 is rewritten so an item with no conforming value inside a declared-available signal is a violation by name — no `epic`/`epic:` label; no `points:` label, empty suffix, non-numeric, negative, or non-integer; no mapped milestone — with `points:0` conforming; unknown now comes only from the availability gate (AC-F4-3), and the iteration-1 "supplied-but-non-conforming" reading is removed. AC-F4-2 now maps to TC-ATT-012, AC-F4-3 to TC-ATT-013 (rewritten to include the mixed-availability independence case), and the new AC-F4-4 to new **TC-ATT-041** (satisfied arm). (2) **Mapped-signal provenance** (F-4a, DM-13, DEC-14) added to TC-ATT-004/011/012/013/030/033/041 and the fixture model: labels through declared conventions and an additively normalized milestone, availability on the tracker read, zero new reads, corpus fixtures make all arms reachable. (3) **New AC-F2-4** maps to the existing TC-ATT-008, rewritten to the spec's defensive-headroom role (DEC-15) with the permitted test-only registry injection and no production leak. (4) **New AC-F2-5 / DEC-18** covered by new **TC-ATT-042** (no-evidence-no-claim for failed/unresolved CI reads, generalised to another section) and cross-referenced from TC-ATT-006/005/035. (5) **DEC-16 allowlist** replaces the earlier additive-delta wording in TC-ATT-003/034/037 and the six-section non-regression obligation, with optional-field typing and lanes declaration fields included. (6) **DEC-17 readings adopted**: unique deduplicated members and `evidenceRef` = first member (TC-ATT-005/006/007, including a repeated-identity case where `count > members.length`), placeholder count exactly 2 with lanes excluded (TC-ATT-021), rollup `+N` = grouped findings beyond the preview with multi-count arithmetic (TC-ATT-027), 32-line defensive vs 6144-byte operative with a max-length stress case (TC-ATT-028/034), lane vocabulary literals `delivering`/`idle-with-reason`/`idle-no-reason` (TC-ATT-018/040), and the contract naming convention (TC-ATT-003). (7) Corpus case names reconciled: `hygiene-absent-signal-unknown` replaced by `hygiene-absence-violation` + `hygiene-satisfied-arm`; `hygiene-all-unknown` retained with mixed availability; `ci-read-failed-no-finding` added. (8) Gap ledger and OQ table rewritten to resolved state citing DEC-13..DEC-18; only GAP-1 (implementation plan pending), the residual non-primary-branch scope observation, and the non-blocking CI timing tolerance remain. (9) Counts corrected: 23 ACs, 13 DMs, 42 TCs. No TC behaviour, state, code, bound, or AC/NFR mapping is left contradicting spec v1.1; no coverage weakened. |

## 10. Test Execution Log

| TC ID / gate | Run Date (UTC) | Result | Notes / command / HEAD |
|---|---|---|---|
| Not run | — | Planned | This writer ran no builds or tests and implemented no code. The executor records per-TC evidence, commands, HEAD, and pushed-HEAD CI results here; unrun evidence must never be recorded as passing. |
