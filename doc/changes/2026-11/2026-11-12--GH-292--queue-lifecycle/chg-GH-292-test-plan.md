---
id: chg-GH-292-test-plan
status: Proposed
version: 1.0
created: 2026-11-12
last_updated: 2026-11-12
owners: [engineering]
service: delivery-os queue lifecycle (scheduling engine, dispatch admission, closeout, event taxonomy, CLI help)
labels: [queue, scheduling-engine, dispatch-engine, closeout, events, taxonomy, contracts, cli, help, m2]
version_impact: minor
summary: "Prove the queue lifecycle as five mutations and one publication contract, not as prose: reason-bearing `queue remove` appends one `queue.removal` record and the fold's presence rule retires the entry without deleting anything; `closeout --apply` removes the landed ref with reason `landed` through an additive, fail-open `queueRemoval` block; `dep add`/`dep remove` edit exactly one edge while the delivered two-positional add stays byte-identical; a per-ref admission guard refuses a second session with `queue.single-flight` and `detail.holder` on dispatch, claim, and the injected daemon claim port, backed by the narrowed same-holder renewal; `queue reconcile` removes `done`/`canceled` entries with reason `reconciled` under a 100-entry, one-read-per-entry, fail-closed budget; and `queue.graph/remove` becomes an emitted kind with exactly `ref`, `reason`, `recordedAt`. All 45 acceptance criteria map to 59 named cases; the four remove-unemitted pins, the queue row pin (5 to 7), and the record-kind pin (5 to 6) move as two-sided equalities in the same delivery, never relaxed."
links:
  change_spec: ./chg-GH-292-spec.md
  implementation_plan: ./chg-GH-292-plan.yaml
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - Complete the queue lifecycle

## 1. Scope and Objectives

This change delivers five behaviours on one append-only ledger, so the first risk is not a missing feature but a lifecycle that looks complete while one half is false. **Removal must be an append, never an edit.** The removal record's kind, schema, key prefix, and closed reason vocabulary are pinned, and the fold's presence rule is proven by removal, re-declaration, and a byte-level record-set diff (`TC-QLC-001`, `TC-QLC-007`, `TC-QLC-009`). **No removal may orphan a running lane or a dependent.** A live lease refuses with the delivered `queue.precondition.unmet`/`lease-held` and names the holder; an active park is withdrawn with the delivered `released` record before the removal; and a dependent keeps its edge and is held `dependency-unobserved` (`TC-QLC-005`, `TC-QLC-006`, `TC-QLC-008`). **Automatic removal must converge and must never fail closeout.** Apply mode removes with `landed`, plan mode only discloses `would-remove`, no merge truth or an unreadable store or a live lease skips with a closed reason, and a re-run reports `satisfied` (`TC-QLC-020`..`TC-QLC-025`). **One ref must not run twice on any path.** The guard is proven on `dispatch run`, `queue claim`, and the composed daemon supervision claim, its refusal is inert, and the same-holder renewal narrowing is proven in both directions (`TC-QLC-040`..`TC-QLC-045`). **Reconcile must fail closed.** Only a positive `done`/`canceled` observation removes; an unreadable read removes nothing and returns the provider identity, and the run is bounded at 100 entries with one read each (`TC-QLC-050`..`TC-QLC-058`).

The plan is deliberately adversarial about the failure modes the spec names. **A removal that is really a deletion** fails `TC-QLC-009` and `TC-QLC-080`: they compare the complete record-key set and ledger bytes before and after, and require the derived document to be replaced only when intent truth changed. **A guard that only works on the queue path** fails `TC-QLC-040`..`TC-QLC-042`: the same refusal shape is asserted through three seams, and `TC-QLC-045` proves the refusal mutates nothing. **A renewal that silently rewrites the ref** fails `TC-QLC-044`: the lease's recorded ref is read after a same-holder different-ref claim, and the same-ref renewal must still say `renewed`. **A reconcile that removes on a failed read** fails `TC-QLC-053`: three provider failure classes each assert zero removals and the provider's own identity. **A declared kind with no producer** ends here: `TC-QLC-062` and `TC-QLC-064` move the four pins from `["queue.graph/remove"]` to `[]`, and `TC-QLC-063` fails if the emitted payload gains or loses a key.

This document is a verification map, not an execution claim: no command was run against a new implementation at authoring time. Delivery owns module paths, helper names, and injection seams the spec does not pin; where a case needs one, it names the seam and asserts the declared property through the public surface or an injected port. A case that cannot resolve its seam fails naming the missing contract rather than skipping. **All 45 acceptance criteria are covered, there are no TODO rows, and no case is an orphan.** One traceability gap is recorded rather than smoothed over: NFR-10's repeated-reconcile convergence has no dedicated acceptance criterion, so `TC-QLC-058` maps it to AC-F5-1 and §8.3 raises it as `OQ-T1`. Four criteria carry a named substitute/boundary assertion in §3.5.

### 1.1 In Scope

- Reason-bearing entry removal: the `--reason` grammar, the closed four-value vocabulary, every refusal, the append-only record, the presence rule, park withdrawal, non-cascading removal, re-declaration, payload, human text, and exits (F-1; AC-F1-1..AC-F1-8; DM-1..DM-5).
- Automatic `landed` removal inside `closeout --apply`: apply versus plan, merge truth, fail-open skips, idempotency, the additive block, and step-inventory invariance (F-2; AC-F2-1..AC-F2-5; DM-6; SC-M2-S15-01).
- `dep add` / `dep remove` over the delivered two-positional add: equivalence, `removed`/`noop`, ready-set recomputation, the `removed[]` delta, add-only cycle checking, grammar refusals, and unobserved producers (F-3; AC-F3-1..AC-F3-5; EVT-2; SC-M2-S15-04).
- Per-ref single-flight: dispatch, `queue claim`, the composed daemon claim port, stale-lease takeover, the same-holder renewal narrowing, `detail.holder`, and refusal purity (F-4; AC-F4-1..AC-F4-6; DM-7; SC-M2-S15-02).
- `queue reconcile`: `done`/`canceled` removal with `reconciled`, retained states, unreadable-tracker fail-closed, `--ref` scoping, not-found retention, the 100-entry cap and remainder, and F-1-equivalent removals (F-5; AC-F5-1..AC-F5-8; SC-M2-S15-03).
- `queue.graph` publication: one `remove` event with exactly three keys, the dependency-edge delta with monotonic sequence, the emitted declaration, and the bidirectional payload-key comparison (F-6; AC-F6-1..AC-F6-4; EVT-1, EVT-2).
- Mount and self-description: help entries, the corrected `queue dep` synopsis, help-guide coverage, reference-page parity, M1 page completeness, M2 page reconciliation, the seven-row queue error kind, and the declared flags (F-7; AC-F7-1..AC-F7-3; DM-8).
- Measured NFRs: fenced atomicity and refusal purity, the admission read cost, closeout cost and fail-open identity, the reconcile read budget, bounded output and privacy, additivity, and convergence (AC-NFR-1..AC-NFR-6; NFR-1..NFR-10).
- The deliberate pin migrations: the four `remove`-unemitted pins, the queue error-row pin (5 → 7), the queue record-kind pin (5 → 6), and the derived-document expectations, all updated as two-sided equalities (§7.1).

### 1.2 Out of Scope & Known Gaps

- [OUT] Any change to `queue release`, its park causes, its `until` rule, or its result vocabulary; release is asserted to still leave the entry in place (`TC-QLC-005` uses it only as a precondition-clearing step) (NG-1; spec §8.5).
- [OUT] Cascading removal, edge rewriting, or a graph-wide refusal while a dependent exists; `TC-QLC-008` asserts the opposite (NG-3, DEC-10).
- [OUT] A per-ref lease scope, a changed TTL, a changed stale-takeover rule, or a changed fence; `TC-QLC-043` and `TC-QLC-044` assert the delivered rules (NG-4).
- [OUT] Any tracker write: reconcile only reads; no case asserts a transition, label, assignee, or comment write (NG-5).
- [OUT] Scheduled, daemon-loop, or closeout-triggered reconciliation; `TC-QLC-050`..`TC-QLC-058` exercise the operator verb only (NG-6).
- [OUT] New `queue.graph` kinds, new payload fields, a taxonomy version bump, or new topics; `TC-QLC-062` asserts the declared set and version are unchanged (NG-7).
- [OUT] A new package, workspace subpath, provider adapter, or state schema version; `TC-QLC-085` asserts zero of each (NG-8).
- [OUT] A `queue graph` read verb, a removal-history read, or a reason-filtered listing (D-1, D-5; spec §7.2).
- [GAP-T1 — the daemon path is proven through the injected claim port, not a live production spawn] The production resident-daemon composition is supervise-only today (spec A-6). `TC-QLC-042` composes the delivered `runSupervisionCycle` with a supplied claim port and asserts the refusal shape and zero session; it does not claim a production daemon spawn exists. Owner: `@reviewer` confirms the composition binding at phase 8.
- [GAP-T2 — reconcile is proven at the declared tracker port plus the composition binding, not against live GitHub in the default suite] `TC-QLC-050`..`TC-QLC-056` inject a tracker read port with recorded observations and failures; `TC-QLC-084` asserts the declared credential-port use and `TC-QLC-085` asserts no new adapter/package is introduced. A live read is an opt-in smoke (`tests/conformance/live/run-live.ts` pattern), never part of `pnpm check`. The ticket criterion "without editing state files" is proven by the file-set/digest assertions (`TC-QLC-050`), not by watching an external editor.
- [GAP-T3 — NFR-10's repeated-reconcile convergence has no dedicated AC] AC-F2-5 covers repeated closeout, AC-F3-3 covers repeated `dep remove`, and no criterion states "a repeated reconcile over an already-reconciled ref removes nothing and exits 0". `TC-QLC-058` proves the behaviour and maps it to AC-F5-1; §8.3 records `OQ-T1` for the spec owner. This is a traceability gap, not a silently skipped requirement.
- [GAP-T4 — page prose is checked by required and forbidden tokens, not by semantic truth] `TC-QLC-071` and `TC-QLC-072` prove the presence of the delivered names, the absence of the duplicate identities and the old envelope, and the page-root resolution; sentence-level truth remains a review attestation by `@doc-syncer` and `@reviewer`.
- [GAP-T5 — absence claims need two observations] "No record appended", "no event published", "no session started", and "no derived document replaced" are each proven by (i) a recording fake or armed guard, (ii) a zero counter, and (iii) an unchanged record-key set, ledger digest, lane set, or event stream. A single passing assertion is never accepted as proof of an absence.
- [GAP-T6 — delivery-bound names] Removal record module, reconcile port name, closeout block seam, and projection helper names are delivery-bound. Kind `remove`, schema `delivery.queue.removal.v1`, key prefix `queue.removals:`, reason vocabulary, result vocabularies, error codes, exits, payload key sets, and AC traceability are not.

## 2. References

| Reference | Role in this plan |
|---|---|
| [`chg-GH-292-spec.md`](./chg-GH-292-spec.md) v1.0 | Binding source: F-1..F-7, **45 ACs** (AC-F1-1..AC-F1-8, AC-F2-1..AC-F2-5, AC-F3-1..AC-F3-5, AC-F4-1..AC-F4-6, AC-F5-1..AC-F5-8, AC-F6-1..AC-F6-4, AC-F7-1..AC-F7-3, AC-NFR-1..AC-NFR-6), DEC-1..DEC-15, DM-1..DM-8, EVT-1..EVT-3, NFR-1..NFR-10, RSK-1..RSK-10, OQ-1/OQ-2, §6 flows 1–5, §8 contracts, Appendix C (exit matrix), Appendix D (mutation → record → event), Appendix E (closed vocabularies). |
| [`chg-GH-292-plan.yaml`](./chg-GH-292-plan.yaml) (forthcoming) | Phase ownership and the implementation task map. This test plan is phase-3 output and does not depend on plan phase numbers; §7 maps every case to a suite and gate. |
| `doc/planning/oss-tooling/milestones/m2/test-scenarios.md` SC-M2-S15-01..04 | Mandatory scenario coverage: auto-removal after closeout, single-flight refusal naming the holder, reconciliation without hand editing, and the dependency-edge event. Mapped one-to-one in §3.1 and spec Appendix A. |
| `doc/planning/oss-tooling/milestones/m2/contracts.md` §Queue lifecycle mutations; §Event taxonomy v1 | Contract authority for the five lifecycle behaviours, the declared `remove` kind, and the dependency delta. |
| `doc/planning/oss-tooling/milestones/m2/architecture.md` §Queue auto-release after merge and closeout; §Single-flight refusal across dispatch paths; §Persistence and concurrency deltas | Shape authority for the closeout hook, the admission guard, the per-ref rule, and the append-only state discipline. |
| `doc/planning/oss-tooling/milestones/m2/commands/queue.md` | Planning page reconciled by F-7; its `queue.entry-unknown`, `queue.state-unavailable`, `queue.graph/removed`, and `{ ok, command }` example are the negative tokens in `TC-QLC-072`. |
| `doc/planning/oss-tooling/milestones/m1/commands/queue.md` | The page root the help-guide coverage check resolves; `TC-QLC-071` asserts every delivered queue verb is documented there. |
| `doc/spec/features/feature-scheduling-engine.md`, `feature-dispatch-engine.md`, `feature-closeout.md`, `feature-event-taxonomy.md`, `feature-result-contract.md`, `feature-state-layer.md` | Post-delivery reconciliation targets; their current wording supplies the delivered contracts the cases consume. |
| **Delivered contracts consumed under test** | `packages/core/src/contracts/queue.ts` (`QUEUE_RECORD_DECLARATIONS`, `QUEUE_GRAPH_DOCUMENT_NAME`, `QUEUE_GRAPH_SCHEMA`, queue error codes), `error-table.ts`, `state.ts` (`STATE_SCHEMA_VERSION`), `closeout.ts` (`CloseoutData` blocks), `dispatch.ts`, `taxonomy.ts`. |
| **Delivered seams consumed under test** | `packages/core/src/app/queue.ts` (`declareQueueEntry`, `claimQueueLease`, `releaseQueueLease`, `readQueueEntries`, `readQueueDependencies`, `readQueueParks`, `readQueueLeases`, `readQueueIncidents`, `readQueueGraph`), `packages/core/src/domain/queue-graph.ts` (`foldQueueGraph`), `packages/core/src/app/dispatch.ts` (`runDispatch`, `claimLease` port), `packages/core/src/app/daemon-lane.ts` (`runSupervisionCycle`), `packages/cli/src/commands/{queue,dispatch,closeout}.ts`, `packages/cli/src/daemon-compose.ts`, `packages/cli/src/help.ts`. |
| **Delivered suites that must keep passing** | `tests/behaviour/{queue-lease,queue-depend,queue-cli,queue-graph,queue-ready,queue-park,lanes,closeout-integration,closeout-plan,closeout-idempotency,dispatch-admission-preflight,dispatch-harness-lease,daemon-lane-supervision,events-dependency-delta,events-describe,events-emitted-kinds,events-subscribe-queue-graph}.test.ts`; `tests/structure/{queue-scheduling-contract,event-taxonomy-declaration,event-taxonomy-additive,event-taxonomy-drift,error-table,event-additivity-inventory}.test.ts`; `tests/golden/{queue-list,queue-plan,queue-ready,queue-envelope,queue-lease-conflict,closeout-envelope,events-reference-page}.test.ts`; `tests/checks/{error-table-sync,event-taxonomy-conformance,help-guide-coverage,reference-page-parity,exit-code-literals}.test.ts`. |
| **Precedent to mirror** | `tests/behaviour/queue-lease.test.ts` (real domain/state rows over `tests/fixtures/queue/leases/fence-harness`, armed append faults, fence handles), `tests/behaviour/events-dependency-delta.test.ts` (real projection over `tests/fixtures/events/event-harness`), `tests/behaviour/closeout-integration.test.ts` (real `createCloseoutComposition` with injected provider/git/state), `tests/behaviour/dispatch-admission-preflight.test.ts` (`runAdmission` recorder for spawns/resumes/attempts), `tests/fixtures/state/harness.ts` (`makeAuditStore`, `listStoreFiles`, `ledgerBytes`, `ledgerDigest`). |
| [`.ai/rules/testing-strategy.md`](../../../../.ai/rules/testing-strategy.md) | `bun:test` under `tests/**/*.test.ts`; fixtures are never `*.test.ts`; layers `tests/{structure,behaviour,golden,checks,boundaries,conformance}`; permanent suites assert the current tree; goldens regenerate only by explicit command; `pnpm check` is the aggregate gate; absences are proven by a failing check naming the offending field. |
| **TMPDIR caveat** | `.ai/memory/lessons/lesson-2026-001-ci-baseline-parity-tmpdir.md` — run the aggregate as `TMPDIR="$PWD/tmp/tmpdir" pnpm check`; the CI baseline-parity case runs `git clone --local`, which fails on a cross-device hardlink when `TMPDIR` is tmpfs. |

## 3. Coverage Overview

All 45 acceptance criteria map to at least one named case; no case is an orphan. The plan carries **59 cases**, block-structured by capability: `001`–`011` removal, `020`–`025` automatic removal, `030`–`036` dependency edges, `040`–`045` single-flight, `050`–`058` reconcile, `060`–`066` events, `070`–`075` mount/help/errors, `080`–`086` NFRs. A criterion whose wording spans two independent observables is covered by more than one case (AC-F1-1 by the mutation, append-only, and payload cases; AC-F4-1 by the dispatch case and the purity case; AC-F5-1 by the reconcile mutation, payload, and convergence cases). Six boundary classes are recorded in §3.5; four criteria carry a named substitute assertion and are counted as covered with the substitution stated.

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Criterion (condensed) | TC ID(s) | Status |
|---|---|---|---|
| AC-F1-1 | An observed entry removed with `--reason abandoned` exits `0`, reports `removed`/`abandoned`, appends one removal record, disappears from `list`/`plan`/`lanes`, and leaves no entry in the derived document | TC-QLC-001, TC-QLC-009, TC-QLC-010 | Covered |
| AC-F1-2 | Removal without `--reason` exits `1` with `queue.reason-missing`, appends zero records, leaves the entry present | TC-QLC-002, TC-QLC-011 | Covered |
| AC-F1-3 | An out-of-vocabulary reason or a missing flag value exits `1` with `input.value.rejected` and appends zero records | TC-QLC-003, TC-QLC-011 | Covered |
| AC-F1-4 | A ref with no entry, including one already removed, exits `1` with `queue.entry.unobserved` and appends zero records | TC-QLC-004, TC-QLC-011 | Covered |
| AC-F1-5 | A live repository lease refuses with `queue.precondition.unmet`, reason `lease-held`, holder named, zero appends; after `queue release` the same removal succeeds | TC-QLC-005, TC-QLC-011 | Covered |
| AC-F1-6 | An active park is withdrawn by a `queue.park` `released` record appended before the removal; no park is evaluated afterwards and no park vocabulary is added | TC-QLC-006 | Covered |
| AC-F1-7 | Re-declaring a removed ref restores the entry; the removal record is neither deleted nor rewritten | TC-QLC-007, TC-QLC-009 | Covered |
| AC-F1-8 | A dependent's edge set is unchanged, it is held `dependency-unobserved`, and the removal appended no record for another entry | TC-QLC-008 | Covered |
| AC-F2-1 | `closeout --apply` after an observed merge removes the entry with `landed`, reports `queueRemoval.outcome: removed`, and publishes a `remove` event | TC-QLC-020, TC-QLC-025 | Covered |
| AC-F2-2 | `closeout` without `--apply` appends nothing, leaves the entry, and reports `would-remove` | TC-QLC-021, TC-QLC-025 | Covered |
| AC-F2-3 | With no observed merged delivery request, `--apply` leaves the entry and reports `skipped`/`no-merge-truth` | TC-QLC-022 | Covered |
| AC-F2-4 | A live lease or unreadable queue state skips with `lease-held`/`state-unavailable`, and closeout's exit and every step outcome are identical to the same run without the hook | TC-QLC-023, TC-QLC-025 | Covered |
| AC-F2-5 | A closeout re-run over a removed ref and a closeout for a never-entered ref both exit `0`, append zero removal records, and report `satisfied` | TC-QLC-024, TC-QLC-086 | Covered |
| AC-F3-1 | `queue dep add A B` equals the delivered `queue dep A B` in payload and result, and one dependency record carries the folded edge set for `A` | TC-QLC-030, TC-QLC-036 | Covered |
| AC-F3-2 | `queue dep remove A B` exits `0` with `removed`, the edge is gone, readiness is recomputed, and one `dependency-edge` event carries `removed: ["B"]` | TC-QLC-031, TC-QLC-035, TC-QLC-036 | Covered |
| AC-F3-3 | Removing an absent edge exits `0` with `noop`, appends zero records, and publishes zero events | TC-QLC-032, TC-QLC-036, TC-QLC-086 | Covered |
| AC-F3-4 | A cycle-closing add is refused with `queue.dependency-cycle` naming the path and appends nothing; remove runs no cycle check and is never cycle-refused | TC-QLC-033 | Covered |
| AC-F3-5 | A non-canonical ref yields `input.value.rejected`; an unknown consumer yields `queue.entry.unobserved`; an unobserved producer is accepted and the edge retained | TC-QLC-034 | Covered |
| AC-F4-1 | `dispatch run` for a ref with an active lane exits `1` with `queue.single-flight`, `detail.holder` names the holder, no session starts, and no attempt/lease/lane/queue record is appended | TC-QLC-040, TC-QLC-045 | Covered |
| AC-F4-2 | `queue claim` for the same state returns the same identity, the same `detail.holder`, and the same zero-mutation outcome | TC-QLC-041 | Covered |
| AC-F4-3 | A composed daemon supervision cycle with a supplied claim port reports a `queue.single-flight` refusal and starts no session | TC-QLC-042 | Covered — substitute (GAP-T1) |
| AC-F4-4 | A lease at or over its TTL is not refused by the guard; the delivered stale-takeover path applies with its incident evidence | TC-QLC-043 | Covered |
| AC-F4-5 | A live lease for another ref under the same holder refuses `queue.lease-conflict` and keeps the lease's ref; the same ref under the same holder still returns `renewed` with no new session | TC-QLC-044 | Covered |
| AC-F4-6 | After any `queue.single-flight` refusal the record count, derived-document bytes, and lane set are identical | TC-QLC-045 | Covered |
| AC-F5-1 | A `done` work item leaves the queue with `reason: reconciled`, is listed in `removed[]`, exits `0`, and no state file is written outside the tool | TC-QLC-050, TC-QLC-058, TC-QLC-086 | Covered — port boundary (GAP-T2); repeated-reconcile note (GAP-T3) |
| AC-F5-2 | A `canceled` work item is removed with reason `reconciled` | TC-QLC-051 | Covered |
| AC-F5-3 | `backlog`, `ready`, `in-progress`, and `in-review` entries are retained, listed with their `deliveryState`, and append zero removal records | TC-QLC-052 | Covered |
| AC-F5-4 | An unreadable tracker read appends nothing, reports zero removals, and exits on the provider identity's projection with no `queue.*` identity | TC-QLC-053 | Covered |
| AC-F5-5 | `queue reconcile --ref GH-241` over five entries examines exactly one, leaves four untouched, and reports `checked: 1` | TC-QLC-054 | Covered |
| AC-F5-6 | A work item the tracker does not have is retained in `unobserved[]` and appends zero records | TC-QLC-055 | Covered |
| AC-F5-7 | Beyond the cap, at most 100 entries are examined, `truncated` is true, `remainder` is exact, and no entry beyond the cap is read or removed | TC-QLC-056 | Covered |
| AC-F5-8 | Every reconcile removal obeys the F-1 invariants and publishes exactly one `remove` event per removed ref | TC-QLC-057 | Covered |
| AC-F6-1 | Exactly one `remove` event appears, its `lane`/`ref` are the entry ref, its payload keys are exactly `ref`, `reason`, `recordedAt`, and `reason` is in the closed vocabulary | TC-QLC-060, TC-QLC-065 | Covered |
| AC-F6-2 | `dep remove` yields one `dependency-edge` event with `removed[]` naming the edge and a sequence above the lane's previous event; an absent-edge noop and every refused mutation publish zero events | TC-QLC-061, TC-QLC-066 | Covered |
| AC-F6-3 | `queue.graph/remove` is declared `emitted: true`, no kind is unemitted, version/topics/frames/ordering/overflow are unchanged, and `events describe` reports it as emitted | TC-QLC-062, TC-QLC-064, TC-QLC-066 | Covered |
| AC-F6-4 | The emitted-payload-key comparison fails on an undeclared key or a missing declared key, and every emitted kind's payload keys equal its declared list | TC-QLC-063 | Covered |
| AC-F7-1 | `queue --help` lists `remove`, `dep add`, `dep remove`, and `reconcile`; each verb help exits `0`; `--reason`/`--ref` are documented with vocabularies; the `dep` synopsis is the two-positional grammar | TC-QLC-070, TC-QLC-074 | Covered |
| AC-F7-2 | Help coverage and reference-page parity report zero failures; the M1 page documents every verb; the M2 page names the three delivered identities, contains neither duplicate identity, and shows no top-level `ok`/`command` | TC-QLC-071, TC-QLC-072 | Covered — substitute for prose truth (GAP-T4) |
| AC-F7-3 | The queue kind carries exactly seven rows in declared order, the delivered five unchanged plus `queue.reason-missing` and `queue.single-flight`, and every new path resolves to a declared row and its projected exit | TC-QLC-073, TC-QLC-075 | Covered |
| AC-NFR-1 | Every accepted mutation appends inside one fence, verifies each append, replaces the derived document only after verification, and a refusal leaves records, document bytes, and the file set unchanged | TC-QLC-080, TC-QLC-009, TC-QLC-011, TC-QLC-036 | Covered |
| AC-NFR-2 | One refused admission counts at most one additional whole-store read and appends zero lease/attempt/lane/queue records | TC-QLC-081, TC-QLC-045 | Covered |
| AC-NFR-3 | With and without the hook, closeout's step outcomes, exit, and operation count differ only by the queue block, with at most one fold and two appends added | TC-QLC-082, TC-QLC-023 | Covered |
| AC-NFR-4 | Reconcile performs at most 100 tracker reads, one bounded call per examined entry, with no retry, pagination, concurrent read, or read past the cap | TC-QLC-083, TC-QLC-056 | Covered |
| AC-NFR-5 | No new output, record, event, or log carries a credential, token, secret, provider payload, prompt, diff, or repository content; the detail is ≤128 characters and single line; reconcile lists are identifier/count/timestamp only | TC-QLC-084 | Covered — substitute for a byte-level secret scan (GAP-T5) |
| AC-NFR-6 | Zero packages, subpaths, adapters, and schema versions are added; exactly two error rows are added; both inventories equal the tree in both directions | TC-QLC-085 | Covered |

**Capability coverage**: F-1 → 001–011; F-2 → 020–025; F-3 → 030–036; F-4 → 040–045; F-5 → 050–058; F-6 → 060–066; F-7 → 070–075. Every F-# has at least one case; every case names at least one AC.

**Ticket scenario coverage**: SC-M2-S15-01 → `TC-QLC-020` (with `025` for the block and idempotency); SC-M2-S15-02 → `TC-QLC-040` (with `041`–`045` for the other paths and purity); SC-M2-S15-03 → `TC-QLC-050` (with `058` for the payload and convergence); SC-M2-S15-04 → `TC-QLC-031` (with `035` and `061` for the delta and sequence).

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

The specification declares no REST/HTTP or MCP surface (API-# is N/A). The interface is the queue CLI forms on the delivered `CommandResult` envelope, three event contracts, and eight data-model elements.

| Element | TC ID(s) | Observable assertion |
|---|---|---|
| EVT-1 `queue.graph/remove` | 001, 009, 020, 050, 057, 060, 062, 063, 064, 065, 066 | One event per applied removal; `lane` and `ref` equal the entry ref; payload keys exactly `ref`, `reason`, `recordedAt`; reason in the closed set; no `sequence` asserted by the mutation payload. |
| EVT-2 `queue.graph/dependency-edge` | 030, 031, 035, 036, 061, 066 | One event per applied edge edit; `removed[]` names the dropped edge on `dep remove`, `added[]` names it on add; `sequence` strictly greater than the lane's previous event; noop/refusal publish nothing. |
| EVT-3 unchanged kinds | 062, 063, 066 | Topic set, frame fields, ordering rule, overflow policy, and taxonomy version are unchanged; `entry`, `dependency-edge`, and `release` keep their declared payloads. |
| DM-1 removal record | 001, 009, 010, 085 | Kind `queue.removal`, schema `delivery.queue.removal.v1`, key prefix `queue.removals:<REF>`, identity `ref`, fields `schema`, `ref`, `reason`, `recordedAt` plus the additive caller principal; reason in the closed four values. |
| DM-2 presence rule | 001, 007, 009 | Entry present iff the latest entry record is later than the latest removal record; equal/absent with no removal means present; re-declaration restores; no record is deleted. |
| DM-3 park withdrawal | 006, 057 | A delivered `queue.park` with `recoveryState: "released"` is appended before the removal; no new park field, state, or cause. |
| DM-4 derived document | 001, 007, 009, 045, 080 | `queue-graph.json` (`delivery.queue.graph.v1`) reflects the fold; replaced atomically only when folded intent truth changed; a refusal leaves its bytes identical; a removal leaves other entries' edges unchanged. |
| DM-5 mutation payloads | 010, 035, 058 | Removal `data` keys exactly `ref`, `result`, `reason`, `readySet`, `event`, `degraded`; dependency-removal keys `ref`, `entry`, `edges`, `result`, `readySet`, `event`, `degraded`; reconcile keys exactly `result`, `checked`, `removed`, `retained`, `unobserved`, `readySet`, `truncated`, `remainder`, `degraded`. |
| DM-6 closeout block | 020, 021, 022, 023, 024, 025 | One additive non-step `queueRemoval` block with `outcome` in `removed|would-remove|satisfied|skipped`, `ref`, optional `reason`, optional `skipReason` in the closed four values; the step inventory is identical. |
| DM-7 refusal detail | 040, 041, 042, 045 | `detail.holder` is the live lease's holder, single line, ≤128 characters, identifiers only; no credential, session id, or payload. |
| DM-8 declared inventories | 062, 064, 073, 085 | Record-kind declaration 5 → 6; queue error rows 5 → 7; both fixtures equal the tree in both directions after the additions. |
| Appendix C exit matrix | 002, 003, 004, 005, 033, 034, 040, 053, 073, 075 | Every refusal resolves to one identity and one exit; `0` success, `1` refusal, `2` platform/state/provider; no other digit and no literal exit outside the projection module. |
| Appendix D source map | 001, 006, 020, 031, 050, 057, 060, 061, 066 | Each applied mutation maps to exactly its declared durable records and event; a refusal, noop, or skip maps to none. |
| Appendix E closed vocabularies | 001, 003, 010, 025, 035, 058, 062, 073 | Removal reasons `landed|abandoned|superseded|reconciled`; dependency results `added|updated|removed|noop`; reconcile `removed|noop`; closeout outcomes/skips as declared; queue error rows delivered five plus two. |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement (threshold) | TC ID(s) | Status |
|---|---|---|---|
| NFR-1 | Mutation atomicity: one fenced transaction, each append verified post-append, derived document replaced only after verification; refusal appends 0 records and changes 0 files | TC-QLC-080, TC-QLC-009, TC-QLC-011, TC-QLC-036 | Covered |
| NFR-2 | Guard cost: ≤1 additional whole-store read; 0 lease/attempt/lane/queue appends, 0 sessions, 0 sockets | TC-QLC-081, TC-QLC-045 | Covered |
| NFR-3 | Closeout auto-removal: ≤1 queue fold and 2 appends per apply, ≤1 read when no entry; exit and every step outcome identical with and without the hook | TC-QLC-082, TC-QLC-023 | Covered |
| NFR-4 | Reconcile budget: ≤100 entries, exactly 1 bounded read per examined entry, no retry/pagination/concurrent read, no read past the cap; `truncated` + exact `remainder` | TC-QLC-083, TC-QLC-056 | Covered |
| NFR-5 | Event completeness/ordering: each applied removal emitted exactly once on the first tick observing its record; `sequence` strictly increases per `(topic, lane)`; 0 events for refusal/noop/skip | TC-QLC-060, TC-QLC-061, TC-QLC-065, TC-QLC-066 | Covered |
| NFR-6 | Bounded output: removal exactly 3 payload fields; reconcile lists ≤100; refusal detail ≤128 chars single line; no unbounded field | TC-QLC-010, TC-QLC-035, TC-QLC-058, TC-QLC-084 | Covered |
| NFR-7 | Additive boundary: 0 new packages/subpaths/adapters, 0 schema-version changes, 2 new error rows; inventories equal the tree both ways | TC-QLC-073, TC-QLC-085 | Covered |
| NFR-8 | Credential/privacy: declared credential port only, 0 ambient reads, 0 command-line tokens; no credential, token, provider payload, prompt, diff, or repository content in any output/event/record/log | TC-QLC-084 | Covered — bounded scan (GAP-T5) |
| NFR-9 | Failure classification: every new failure resolves to one declared row and its projected exit; only `{0,1,2}`; no literal exit outside the projection | TC-QLC-075, TC-QLC-002, TC-QLC-003, TC-QLC-033, TC-QLC-053, TC-QLC-073 | Covered |
| NFR-10 | Convergence/idempotency: repeated closeout apply exits 0; repeated `dep remove` is noop; repeated reconcile removes nothing and exits 0 | TC-QLC-086, TC-QLC-024, TC-QLC-032, TC-QLC-058 | Covered — repeated-reconcile half mapped to AC-F5-1; `OQ-T1` records the missing AC |

### 3.4 Coverage-Matrix Integrity

| Check | Value | Verdict |
|---|---|---|
| Acceptance criteria in the specification | 45 (39 capability + 6 non-functional) | — |
| Acceptance criteria with at least one case | 45 | Pass |
| Acceptance criteria uncovered / TODO | 0 | Pass |
| Cases in this plan | 59 (`TC-QLC-001`..`TC-QLC-086`, block-structured) | — |
| Cases naming at least one AC (no orphans) | 59 | Pass |
| Cases that are manual-only | 0 | Pass |
| Cases with a substitute/boundary note (§3.5) | 4 criteria / 7 cases (AC-F4-3, AC-F5-1, AC-F7-2, AC-NFR-5); the reconcile block additionally carries the GAP-T2 port boundary | Declared |
| AC → TC direction present | §3.1 | Pass |
| TC → AC direction present | §5.1 and every §5.2 header | Pass |
| Cases appearing in the Automation Plan (§7) | 59 of 59 | Pass |
| Distribution (primary shape) | structure/contract, behaviour/integration, guard/checks, and measured NFR/regression cases distributed across the eight capability blocks | Pass |

### 3.5 Declared gaps, boundaries, and substitute assertions

| ID | What is asserted, and how | Cases | AC |
|---|---|---|---|
| **GAP-T1 — the daemon path is an injected claim port, not a production spawn** | The composed `runSupervisionCycle` receives a claim port; the case asserts the returned refusal identity, `detail.holder`, and zero executor starts. The production daemon composition remains supervise-only (A-6), so no case claims a live spawn. `TC-QLC-042` step 4 asserts the composition supplies exactly the delivered claim port and no second admission stage. | 042 | AC-F4-3 |
| **GAP-T2 — reconcile is verified at the declared tracker port and composition binding** | The default suite injects a recording tracker port with `done`, `canceled`, open states, `not-found`, and three failures. `TC-QLC-084` asserts the declared credential-port use and `TC-QLC-085` asserts no new adapter; a live GitHub read is an opt-in smoke and is excluded from `pnpm check`. "No state file is written outside the tool" is proven by a file-set/digest diff, not by monitoring an editor. | 050–058, 084, 085 | AC-F5-1..AC-F5-7 |
| **GAP-T3 — no dedicated AC for repeated-reconcile convergence (NFR-10)** | `TC-QLC-058` asserts a second reconcile over an already-reconciled ref reports `noop`, appends zero records, and exits `0`; it maps the behaviour to AC-F5-1 and records `OQ-T1` for the spec owner. This is raised, not hidden. | 058 | AC-F5-1; NFR-10 |
| **GAP-T4 — page prose is token-checked, not semantically proven** | `TC-QLC-071` asserts the M1 page resolves as the page root and names every delivered verb; `TC-QLC-072` asserts the M2 page's required names, forbidden duplicate identities, and absent top-level envelope fields. Sentence-level truth is a review attestation by `@doc-syncer`/`@reviewer`. | 071, 072 | AC-F7-2 |
| **GAP-T5 — absences need two observations** | Every "no append", "no event", "no session", "no replace", and "no read" assertion pairs a recording port or armed guard with a zero counter and an unchanged durable digest/record-key set. `TC-QLC-084` additionally scans outputs and records for secret-shaped and repository-content literals; it is a bounded-pattern scan, not a proof over arbitrary bytes. | 009, 011, 032, 036, 045, 066, 080, 084 | AC-NFR-1, AC-NFR-2, AC-NFR-5 |
| **GAP-T6 — delivery-bound names** | Removal module, reconcile port, closeout block seam, and projection helper names are delivery-bound. Contract values (kind, schema, key prefix, reason/result vocabularies, error codes, exits, payload key sets, event fields) are not. A case that cannot resolve a seam fails naming the missing contract; it never skips. | all | all |

## 4. Test Types and Layers

- **Unit / structure (contract-level), `bun:test` under `tests/structure/`** — removal record kind/schema/key/reason vocabulary, presence-rule fold, dependency grammar contract, error-row inventory, record-kind declaration, taxonomy declaration, payload-key comparators, additivity inventory. No I/O; imports the constants and pure folds directly.
- **Contract / conformance, `bun:test` under `tests/checks/` and `tests/golden/`** — help-guide coverage, reference-page parity, M2-page reconciliation tokens, error-table sync, exit-code literals, inventory both directions, exports parity, queue payload and text goldens, page goldens. These guards fail in both directions when the mount or a pin is incomplete.
- **Behaviour (integration over the delivered seams), `bun:test` under `tests/behaviour/`** — the queue CLI over `createConfigProgram`, the real state store with a temp root, the real event projection over `createEventHarness`, the real closeout composition with injected provider/git/state, dispatch admission through `runDispatch` and the injected claim/lease ports, and `runSupervisionCycle` with a supplied claim port. This is where the ticket's three criteria are proven.
- **Measured NFR, `bun:test` with recording ports and exact counters** — fenced append/replace counts, whole-store read counts, tracker read counts, spawn/resume/attempt counts, wall-clock-free operation counts, payload byte lengths, and refusal-detail lengths. Measurements are printed with the fixture shape and iteration count.
- **Not used:** `mock.module` substitution of the module under test, live network in the default suite, real sleeps, a real `$HOME` state directory, or a test that writes the live tree. Fakes are injected ports (tracker read, credential, clock, transport, executor) — never a mock of the fold, the projection, the closeout transaction, or the queue command.

## 5. Test Scenarios

TC IDs use the `QLC` feature prefix and follow the capability blocks: `001`–`011` removal; `020`–`025` automatic removal; `030`–`036` dependency edges; `040`–`045` single-flight; `050`–`058` reconcile; `060`–`066` events; `070`–`075` mount/help/errors; `080`–`086` NFRs. A new sequence appends at the end of its block; an ID is never reused for a different scenario. Every ID appears exactly once in §5.1, once in §5.2, and once in §7 — 59 in each.

### 5.1 Scenario Index

| TC ID | Title | Type | Impact | Priority | AC / NFR |
|---|---|---|---|---|---|
| TC-QLC-001 | A reasoned removal retires the entry from every read surface | Happy Path | Critical | Critical | AC-F1-1; F-1; DM-1, DM-2, DM-4; EVT-1; NFR-1 |
| TC-QLC-002 | Removal without a reason is refused and appends nothing | Negative | Critical | Critical | AC-F1-2; F-1; NFR-1, NFR-9 |
| TC-QLC-003 | An out-of-vocabulary or valueless reason is a grammar refusal | Negative | Critical | High | AC-F1-3; F-1, F-7; NFR-1, NFR-9 |
| TC-QLC-004 | Unknown and already-removed refs are unobserved refusals | Negative | Critical | Critical | AC-F1-4; F-1; DEC-8 |
| TC-QLC-005 | A live lease blocks removal until release | Negative | Critical | Critical | AC-F1-5; F-1; DEC-9; NFR-1 |
| TC-QLC-006 | An active park is withdrawn before the removal | Corner Case | Critical | High | AC-F1-6; F-1; DM-3; DEC-6 |
| TC-QLC-007 | Re-declaration restores a removed entry without deleting history | Happy Path | Critical | High | AC-F1-7; F-1; DM-2 |
| TC-QLC-008 | Removal does not cascade and leaves dependents held | Corner Case | Critical | High | AC-F1-8; F-1; DEC-10; RSK-1 |
| TC-QLC-009 | Removal is append-only and replaces the derived document only on truth change | Regression | Critical | Critical | AC-F1-1, AC-F1-7; F-1; DM-4; NFR-1 |
| TC-QLC-010 | The removal payload, human text, and exit projection are exact | Happy Path | Critical | High | AC-F1-1; F-1, F-7; DM-5; NFR-6, NFR-9 |
| TC-QLC-011 | Every removal refusal is append-free and byte-identical | Negative | Critical | Critical | AC-F1-2, AC-F1-3, AC-F1-4, AC-F1-5; NFR-1 |
| TC-QLC-020 | `closeout --apply` removes the landed ref and publishes `remove` | Happy Path | Critical | Critical | AC-F2-1; F-2, F-6; EVT-1; DM-6; SC-M2-S15-01 |
| TC-QLC-021 | Closeout plan mode discloses `would-remove` and appends nothing | Happy Path | Critical | High | AC-F2-2; F-2; DM-6; NFR-1 |
| TC-QLC-022 | A closeout without merge truth skips with `no-merge-truth` | Negative | Critical | High | AC-F2-3; F-2; DM-6; A-1 |
| TC-QLC-023 | Lease and unreadable-state skips preserve closeout's exit and steps | Negative | Critical | Critical | AC-F2-4; F-2; DM-6; NFR-3; RSK-5 |
| TC-QLC-024 | Closeout removal converges on re-run and on a never-entered ref | Edge Case | Critical | Critical | AC-F2-5; F-2; NFR-10; DEC-8 |
| TC-QLC-025 | The `queueRemoval` block is additive and the step inventory is unchanged | Happy Path | Important | High | AC-F2-1, AC-F2-2, AC-F2-4; DM-6; NFR-3 |
| TC-QLC-030 | `dep add` is byte-identical to the delivered two-positional add | Happy Path | Critical | Critical | AC-F3-1; F-3; NFR-8 |
| TC-QLC-031 | `dep remove` drops the edge, recomputes readiness, and emits `removed[]` | Happy Path | Critical | Critical | AC-F3-2; F-3, F-6; EVT-2; SC-M2-S15-04 |
| TC-QLC-032 | Removing an absent edge is a noop with no record and no event | Edge Case | Critical | High | AC-F3-3; F-3, F-6; NFR-10; DEC-15 |
| TC-QLC-033 | The cycle check is add-only and never refuses a removal | Negative | Critical | Critical | AC-F3-4; F-3; NFR-9 |
| TC-QLC-034 | Dependency grammar refusals hold and an unobserved producer is accepted | Negative | Critical | High | AC-F3-5; F-3; NFR-1 |
| TC-QLC-035 | Dependency mutation payloads name `readySet` and `event`, never a sequence | Happy Path | Critical | High | AC-F3-2; F-3; DM-5; NFR-6 |
| TC-QLC-036 | Every dependency edit is one append and preserves folded history | Regression | Critical | High | AC-F3-1, AC-F3-2, AC-F3-3; NFR-1 |
| TC-QLC-040 | `dispatch run` refuses a second session with `queue.single-flight` | Negative | Critical | Critical | AC-F4-1; F-4; DM-7; SC-M2-S15-02; NFR-2 |
| TC-QLC-041 | `queue claim` returns the same refusal and mutates nothing | Negative | Critical | Critical | AC-F4-2; F-4; DM-7 |
| TC-QLC-042 | The composed daemon claim port inherits the per-ref guard | Negative | Critical | High | AC-F4-3; F-4; A-6 |
| TC-QLC-043 | A stale lease takes over instead of refusing | Corner Case | Critical | High | AC-F4-4; F-4 |
| TC-QLC-044 | Same-holder different-ref refuses; same-ref still renews | Negative | Critical | Critical | AC-F4-5; F-4; DEC-13; RSK-3 |
| TC-QLC-045 | A guard refusal is byte-identical and its detail is bounded | Negative | Critical | Critical | AC-F4-6; F-4; DM-7; NFR-2, NFR-6 |
| TC-QLC-050 | A `done` entry is removed with `reconciled` | Happy Path | Critical | Critical | AC-F5-1; F-5; DM-1; SC-M2-S15-03 |
| TC-QLC-051 | A `canceled` entry is removed with `reconciled` | Happy Path | Critical | High | AC-F5-2; F-5; DEC-11 |
| TC-QLC-052 | Open delivery states are retained with their observed state | Happy Path | Critical | High | AC-F5-3; F-5; DEC-11 |
| TC-QLC-053 | An unreadable tracker removes nothing and returns the provider identity | Negative | Critical | Critical | AC-F5-4; F-5; NFR-4, NFR-9 |
| TC-QLC-054 | `--ref` examines exactly one entry | Happy Path | Critical | High | AC-F5-5; F-5; NFR-4 |
| TC-QLC-055 | A not-found work item is unobserved and retained | Edge Case | Critical | High | AC-F5-6; F-5; DEC-11 |
| TC-QLC-056 | The 100-entry cap reports `truncated` and an exact remainder | Corner Case | Critical | Critical | AC-F5-7; F-5; DM-5; NFR-4 |
| TC-QLC-057 | Reconcile removals obey every F-1 invariant and emit one event per ref | Regression | Critical | Critical | AC-F5-8; F-1, F-6; EVT-1 |
| TC-QLC-058 | The reconcile payload is exact and a repeated run is a noop | Edge Case | Critical | High | AC-F5-1; F-5; DM-5; NFR-10; GAP-T3 |
| TC-QLC-060 | One removal publishes one `remove` event with exactly three keys | Happy Path | Critical | Critical | AC-F6-1; F-6; EVT-1; DM-8; NFR-5 |
| TC-QLC-061 | The dependency delta carries `removed[]` with a monotonic sequence | Happy Path | Critical | Critical | AC-F6-2; F-6; EVT-2; NFR-5 |
| TC-QLC-062 | The declaration marks `remove` emitted and the non-emitted set empty | Happy Path | Critical | Critical | AC-F6-3; F-6; DM-8; DEC-14 |
| TC-QLC-063 | The emitted-payload-key comparison is bidirectional for every kind | Negative | Critical | Critical | AC-F6-4; F-6; NFR-7; RSK-7 |
| TC-QLC-064 | The four `remove`-unemitted pins move together, two-sided | Regression | Critical | Critical | AC-F6-3; F-6; DEC-14; RSK-7 |
| TC-QLC-065 | Each applied removal is emitted exactly once, in its own lane | Corner Case | Critical | High | AC-F6-1; F-6; NFR-5 |
| TC-QLC-066 | Refusals, noops, and skips publish zero events | Negative | Critical | Critical | AC-F6-2, AC-F6-3; NFR-5 |
| TC-QLC-070 | Help lists the new verbs and corrects the `dep` synopsis | Happy Path | Critical | Critical | AC-F7-1; F-7 |
| TC-QLC-071 | Help coverage, parity, and the M1 page are complete | Happy Path | Critical | Critical | AC-F7-2; F-7 |
| TC-QLC-072 | The M2 page is reconciled to delivered identities and envelope | Happy Path | Critical | High | AC-F7-2; F-7; DEC-2; GAP-T4 |
| TC-QLC-073 | The queue error kind is exactly seven rows with the five unchanged | Happy Path | Critical | Critical | AC-F7-3; F-7; NFR-7, NFR-9 |
| TC-QLC-074 | The new flags are declared and malformed values are grammar refusals | Negative | Critical | High | AC-F7-1; F-7; NFR-9 |
| TC-QLC-075 | Error-table sync and the `{0,1,2}` exit projection hold | Negative | Critical | Critical | AC-F7-3; F-7; NFR-9 |
| TC-QLC-080 | Every accepted mutation is one fenced, post-verified transaction | Regression | Critical | Critical | AC-NFR-1; NFR-1 |
| TC-QLC-081 | The admission guard costs at most one read and appends nothing | Performance | Critical | Critical | AC-NFR-2; NFR-2 |
| TC-QLC-082 | Closeout outcomes are identical and its appends are bounded | Performance | Critical | Critical | AC-NFR-3; NFR-3 |
| TC-QLC-083 | Reconcile performs one bounded read per entry and none past the cap | Performance | Critical | Critical | AC-NFR-4; NFR-4 |
| TC-QLC-084 | Output, records, and events are bounded and carry no secret | Negative | Critical | Critical | AC-NFR-5; NFR-6, NFR-8 |
| TC-QLC-085 | The additive boundary and both inventories hold | Regression | Critical | Critical | AC-NFR-6; NFR-7; NG-8 |
| TC-QLC-086 | All three mutation paths converge on re-run | Regression | Critical | High | AC-F2-5, AC-F3-3, AC-F5-1; NFR-10 |

### 5.2 Scenario Details

#### TC-QLC-001 - A reasoned removal retires the entry from every read surface

**Objective**: Prove the end-to-end removal contract: one append, a folded absence, and a consistent set of read surfaces.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F1-1, F-1, DM-1, DM-2, DM-4, EVT-1, NFR-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-remove.test.ts` (new); `tests/fixtures/queue/removal/harness.ts` (new); contract value assertions in `tests/structure/queue-removal-contract.test.ts` (new)
**Tags**: @backend, @queue, @contract

**Preconditions**:
- A temp state root with one observed entry `GH-241` in the invoking repository and no lease or park.
- The edge harness composes the real `createConfigProgram` over the store; the fold and the read commands are the delivered ones.

**Steps**:
1. Run `queue remove GH-241 --reason abandoned --json` through the edge harness and assert exit `0`.
2. Assert `data.result === "removed"`, `data.reason === "abandoned"`, `data.ref === "GH-241"`, and `data.event` deep-equals `{ topic: "queue.graph", kind: "remove" }`.
3. Read the raw records and assert exactly one record with kind `queue.removal`, record key `queue.removals:GH-241`, and payload `{ schema: "delivery.queue.removal.v1", ref: "GH-241", reason: "abandoned", recordedAt }`.
4. Run `queue list --json`, `queue plan --json`, `queue ready --json`, and `lanes --json`; assert no surface contains `GH-241` and no lane is projected for it.
5. Read the derived document `queue-graph.json` and assert `entries` contains no `GH-241`, while the document still declares `schema: "delivery.queue.graph.v1"`.
6. Re-read the ledger and assert the entry record is still present and byte-identical to its pre-removal bytes.

**Expected Outcome**:
- The removal is applied once, the entry is absent from the fold and every read surface, and no source record was deleted or edited.
- The derived document follows the folded intent truth and keeps its declared schema.

**Notes / Clarifications**:
- "Observed entry" means the fold sees it from a `queue.entry` record; the fixture seeds it through the production `declareQueueEntry` writer, not a hand-built ledger line.

#### TC-QLC-002 - Removal without a reason is refused and appends nothing

**Objective**: Make `queue.reason-missing` a real pre-append refusal, not a prose rule.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F1-2, F-1, NFR-1, NFR-9
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-remove-refusals.test.ts` (new); `tests/fixtures/queue/removal/harness.ts`
**Tags**: @backend, @queue, @errors

**Preconditions**:
- One observed entry `GH-241`; record-key set and ledger digest captured before the invocation.

**Steps**:
1. Run `queue remove GH-241 --json` (no `--reason`) and assert exit `1`.
2. Assert `error.code === "queue.reason-missing"` and that `error` carries the delivered table-derived `category`, `retryable`, `consequence`, `remediationHint`, and `summary`.
3. Assert the record-key set and ledger digest are unchanged and no `queue.removal` key exists.
4. Run `queue list --json` and assert `GH-241` is still present.

**Expected Outcome**:
- The refusal is classified, exits `1`, appends zero records, and leaves the entry present.
- No removal record is produced under any key.

#### TC-QLC-003 - An out-of-vocabulary or valueless reason is a grammar refusal

**Objective**: Prove the reason vocabulary is closed and that a missing flag value cannot fall through as a positional.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-3, F-1, F-7, NFR-1, NFR-9
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-remove-refusals.test.ts`; `tests/behaviour/queue-help-lifecycle.test.ts` (flag grammar)
**Tags**: @backend, @queue, @errors

**Preconditions**:
- One observed entry `GH-241`; vocabulary fixture lists `landed`, `abandoned`, `superseded`, `reconciled`.
- Cases: `--reason done`, `--reason ""`, `--reason` with no following value, `--reason abandoned --reason landed`.

**Steps**:
1. For each malformed reason form, run the corresponding `queue remove GH-241` invocation with that form and `--json`, and assert exit `1` with `error.code === "input.value.rejected"` (the delivered grammar identity).
2. Assert the summary names the offending reason or the missing value, not `queue.reason-missing`.
3. After each run assert zero appended records and the same ledger digest.
4. Run the four accepted reasons in sequence (re-seeding the entry between runs) and assert each exits `0` with the matching `data.reason`.

**Expected Outcome**:
- Only the closed four values are accepted; every other spelling, empty value, missing value, or duplicate flag is a grammar refusal at exit `1` with zero appends.
- `landed` and `reconciled` are accepted on the explicit verb, so neither is reserved to the automatic path.

#### TC-QLC-004 - Unknown and already-removed refs are unobserved refusals

**Objective**: Prove the explicit verb is deliberately not idempotent and reuses the delivered unknown-entry identity.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F1-4, F-1, DEC-8
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-remove-refusals.test.ts`
**Tags**: @backend, @queue, @errors

**Preconditions**:
- An empty queue for `GH-999`; a second case removes `GH-241` successfully first.

**Steps**:
1. Run `queue remove GH-999 --reason landed --json` and assert exit `1` with `error.code === "queue.entry.unobserved"`.
2. Remove `GH-241`, capture the record-key set, then run `queue remove GH-241 --reason landed --json` again.
3. Assert the second run exits `1` with `queue.entry.unobserved` and the record-key set is unchanged (no second removal record).
4. Assert `queue list` shows no `GH-241` after the second run.

**Expected Outcome**:
- Both an absent entry and an already-removed entry refuse with the delivered unknown-entry identity and append nothing.
- The asymmetry with closeout's `satisfied` is visible and intentional (DEC-8).

#### TC-QLC-005 - A live lease blocks removal until release

**Objective**: Prove removal never orphans a running lane and that the delivered release is the supported precondition-clearing verb.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F1-5, F-1, DEC-9, NFR-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-remove-lease.test.ts` (new); `tests/fixtures/queue/leases/fence-harness.ts`
**Tags**: @backend, @queue, @lease

**Preconditions**:
- One observed entry `GH-241`; a live lease for the repository with holder `lane-1`, ref `GH-241`, heartbeat age below TTL.

**Steps**:
1. Run `queue remove GH-241 --reason abandoned --json` and assert exit `1`.
2. Assert `error.code === "queue.precondition.unmet"`, the refusal names the blocking reason `lease-held`, and it names `lane-1`.
3. Assert zero appended records and that the lease record is unchanged.
4. Run `queue release GH-241 --holder lane-1 --json` and assert success; capture the new record count.
5. Re-run the same `queue remove` and assert exit `0`, `result: "removed"`, and exactly one new removal record relative to step 4.

**Expected Outcome**:
- A live lease refuses removal with the delivered precondition identity and names the holder; nothing is appended.
- Releasing first is sufficient and no removal path releases a lease on the caller's behalf.

#### TC-QLC-006 - An active park is withdrawn before the removal

**Objective**: Prove the park stops participating in the park pass, the recovery incidents, and the lane projection, without adding park vocabulary.
**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-6, F-1, DM-3, DEC-6
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-remove-park.test.ts` (new); `tests/fixtures/queue/parks/*` (reuse)
**Tags**: @backend, @queue, @park

**Preconditions**:
- One observed entry `GH-241` with a delivered active park (`recoveryState: "parked"`, a delivered cause and `until`), no live lease.

**Steps**:
1. Capture the ordered record keys of the ledger.
2. Run `queue remove GH-241 --reason abandoned --json` and assert exit `0`.
3. Assert the ledger order is: the existing park record(s), then one park record with `recoveryState: "released"` and the delivered park fields, then the `queue.removals:GH-241` record.
4. Run the park pass/read projection and assert no park is evaluated for `GH-241` and `lanes --json` shows no parked lane for it.
5. Read the park record schema and assert the field set and the cause/condition vocabularies equal the delivered ones (no new field, state, or cause).
6. Assert the pre-existing park history bytes are unchanged.

**Expected Outcome**:
- The withdrawal is appended before the removal, the park pass and lane projection stop seeing the ref, and no park vocabulary moved.
- The removal still appends exactly one removal record.

#### TC-QLC-007 - Re-declaration restores a removed entry without deleting history

**Objective**: Prove the presence rule is a fold predicate, not a tombstone, so re-declaration needs no special case.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-7, F-1, DM-2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-remove-redeclare.test.ts` (new)
**Tags**: @backend, @queue, @state

**Preconditions**:
- `GH-241` observed, removed with `abandoned`, and absent from the fold.

**Steps**:
1. Capture the removal record's bytes and record key.
2. Run `queue add GH-241 --json` with a later `recordedAt`, then `queue list --json`.
3. Assert `GH-241` is present in the fold and in `queue list`, and `queue ready`/`queue plan` evaluate it again.
4. Assert the latest `queue.entry` record timestamp is strictly later than the latest `queue.removal` record timestamp and the presence predicate therefore returns true.
5. Assert the original removal record is still present, byte-identical, and no deletion or rewrite occurred.
6. Assert the derived document again lists `GH-241` with its declared edges.

**Expected Outcome**:
- The entry is restored by a normal declaration, the removal record remains durable, and the derived document follows the fold.
- A store whose latest removal is later than the latest entry remains absent (the converse is asserted in `TC-QLC-001`).

#### TC-QLC-008 - Removal does not cascade and leaves dependents held

**Objective**: Prove removal is one edge-free append: no other entry's records move, and the dependent reports the truthful held reason.
**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-8, F-1, DEC-10, RSK-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-remove-nocascade.test.ts` (new)
**Tags**: @backend, @queue, @dependencies

**Preconditions**:
- Entries `A` (producer) and `B` (consumer with edge set `["A"]`); capture every record key and byte belonging to `B`, and its derived edge set.

**Steps**:
1. Remove `A` with `--reason superseded` and assert exit `0`.
2. Read `B`'s dependency records and folded edge set and assert they are byte-identical to the precondition (still `["A"]`).
3. Run `queue list --json` and `queue plan --json` and assert `B` is held with blocking reason `dependency-unobserved`.
4. Diff the record-key set: the only new keys are `A`'s removal (and, if present, `A`'s park withdrawal); no record was appended under `B`'s keys.
5. Run `queue dep remove B A` and assert `B`'s edge clears and its readiness is recomputed (the supported remedy exists).

**Expected Outcome**:
- Removal changes only `A`'s presence; `B`'s edges and records are untouched and its held state is visible.
- The supported remedy is the new `dep remove`, not a cascade.

#### TC-QLC-009 - Removal is append-only and replaces the derived document only on truth change

**Objective**: Prove the ledger is never edited and the derived document is not churned when intent truth is unchanged.
**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F1-1, AC-F1-7, F-1, DM-4, NFR-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-remove-append-only.test.ts` (new); `tests/fixtures/state/harness.ts` (`ledgerBytes`, `ledgerDigest`, `listStoreFiles`)
**Tags**: @backend, @queue, @state, @regression

**Preconditions**:
- Two observed entries, one park, one dependency record, and one lease history; capture the complete file set, each ledger file's bytes, and the derived document bytes.

**Steps**:
1. Run a refused removal (missing reason) and assert every file digest and the derived document bytes are unchanged.
2. Run an accepted removal for one ref and assert the only changed source file is the append-only ledger (a pure suffix append), every pre-existing record line is a byte-prefix of the new content, and no record key disappeared.
3. Assert the derived document bytes changed exactly once and now omit the removed ref.
4. Run a second accepted edge edit whose folded dependency set does not change (a repeat `dep add` on an already-declared edge, which the delivered path reports as `updated` or `noop`), and assert the derived document bytes and content are unchanged while any appended dependency record is verified.
5. Assert no temporary file, quarantine file, or rewrite artifact appears in the state directory.

**Expected Outcome**:
- Removal is an append; the derived document is replaced only on a real truth change and never on a refusal or noop.
- The complete durable record set is a superset of the precondition set, with no rewritten record.

#### TC-QLC-010 - The removal payload, human text, and exit projection are exact

**Objective**: Pin the observable machine and human shapes, including the exact key set and a bounded detail.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-1, F-1, F-7, DM-5, NFR-6, NFR-9
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/golden/queue-remove.test.ts` (new); `tests/fixtures/queue/removal/golden/remove-{success,refusals}.json` and `.txt` (new)
**Tags**: @backend, @queue, @golden

**Preconditions**:
- A deterministic fixture clock, refs, and ready set; the golden files are generated once by an explicit update command, never by blanket rewrite.

**Steps**:
1. Run `queue remove GH-241 --reason abandoned --json` and compare the envelope to the success golden; assert `Object.keys(data)` equals exactly `["ref","result","reason","readySet","event","degraded"]` (no `sequence`, no `mutation`).
2. Assert the envelope has exactly `schemaVersion`, `runId`, `exitCode`, `timing`, and `data` at top level, with no `ok`, `command`, or `warnings`.
3. Run the human form and compare byte-for-byte to the text golden; assert it names the ref, `removed`, the reason, and the ready set.
4. Run each refusal form and compare to the refusal goldens; assert the same five-field envelope plus `error` with the delivered `CommandResultError` fields.
5. Assert every exit is `0`, `1`, or `2` and that no literal exit digit is present outside the projection module (the exit-literal guard runs in `TC-QLC-075`).

**Expected Outcome**:
- The payload key set, envelope shape, text output, and exits are pinned; an added `sequence`, a legacy `mutation`, or a top-level `ok` fails.
- Every failure carries the table-derived error object.

#### TC-QLC-011 - Every removal refusal is append-free and byte-identical

**Objective**: Prove refusal purity across the whole refusal set in one adversarial control, not per-path by hope.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F1-2, AC-F1-3, AC-F1-4, AC-F1-5, NFR-1
**Test Type(s)**: Integration, Performance
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-remove-refusals.test.ts`; `tests/fixtures/state/harness.ts`
**Tags**: @backend, @queue, @purity

**Preconditions**:
- A recording state store wrapping the real store; one observed entry; a live-lease case and a no-entry case.

**Steps**:
1. For each refusal case (missing reason, invalid reason, unknown ref, already removed, live lease), snapshot the record-key set, ledger digest, derived-document bytes, file set, fence count, and append count.
2. Run the invocation and assert the documented identity and exit.
3. Assert append count deltas are `0`, replace count deltas are `0`, fence acquisitions are `0` for pre-fence refusals, and all snapshots match.
4. Assert no event frame is produced by a projection pass over the unchanged store.
5. Assert the entry state is unchanged in the fold for every case.

**Expected Outcome**:
- Every refusal is inert: zero appended records, zero file changes, zero derived-document replacements, zero events.
- A single refusal that appends or replaces fails the case.

#### TC-QLC-020 - `closeout --apply` removes the landed ref and publishes `remove`

**Objective**: Prove the ticket's first criterion end-to-end: landing retires the entry without manual action.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F2-1, F-2, F-6, EVT-1, DM-6, SC-M2-S15-01
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-queue-removal.test.ts` (new); `tests/fixtures/closeout/queue-removal.ts` (new); reuse `tests/fixtures/closeout/{cli,harness,github-client,temp-git}.ts`
**Tags**: @backend, @closeout, @queue, @events

**Preconditions**:
- One observed entry `GH-241`; an observed merged delivery request for `GH-241`; a complete closeout composition with injected provider, git, and state fakes; no live lease.

**Steps**:
1. Run `closeout GH-241 --apply --json` through the closeout harness and assert exit `0`.
2. Assert the closeout step outcomes equal the delivered expected list and that `data.queueRemoval` deep-equals `{ outcome: "removed", ref: "GH-241", reason: "landed" }` (plus no `skipReason`).
3. Read the ledger and assert exactly one `queue.removals:GH-241` record with `reason: "landed"` and a `recordedAt` after the closeout writes.
4. Read the fold and assert zero remaining queue entries for `GH-241`.
5. Run the event projection over the store and assert exactly one `queue.graph`/`remove` event for the lane/ref, after the existing closeout records.
6. Assert `queue list --json` no longer shows the entry.

**Expected Outcome**:
- The landed ref is removed automatically with `reason: "landed"`, the block reports it, and the event is published.
- No operator action beyond closeout is required.

#### TC-QLC-021 - Closeout plan mode discloses `would-remove` and appends nothing

**Objective**: Prove plan mode is a pure disclosure and cannot mutate the queue.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-2, F-2, DM-6, NFR-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-queue-removal-plan.test.ts` (new)
**Tags**: @backend, @closeout, @queue

**Preconditions**:
- Same facts as `TC-QLC-020`; capture record-key set, derived-document bytes, and step outcomes.

**Steps**:
1. Run `closeout GH-241 --json` without `--apply` and assert exit `0`.
2. Assert `data.mode === "plan"`, the step list is rendered, and `data.queueRemoval.outcome === "would-remove"` with `reason: "landed"`.
3. Assert record keys, derived-document bytes, fence acquisitions, and append counts are unchanged.
4. Assert the entry is still present in the fold and in `queue list`.
5. Assert no `queue.graph/remove` event is produced by a projection pass.

**Expected Outcome**:
- Plan mode reports the pending removal and changes nothing; a plan run can be repeated without convergence work.

#### TC-QLC-022 - A closeout without merge truth skips with `no-merge-truth`

**Objective**: Prove the trigger is the observed merged delivery request, not the mere existence of a queue entry.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-3, F-2, DM-6, A-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-queue-removal-skips.test.ts` (new)
**Tags**: @backend, @closeout, @queue

**Preconditions**:
- One observed entry `GH-241`; the provider reports the delivery request as open/unmerged; capture the ledger.

**Steps**:
1. Run `closeout GH-241 --apply --json` and assert the delivered closeout outcome for an unmerged request.
2. Assert `data.queueRemoval.outcome === "skipped"` and `data.queueRemoval.skipReason === "no-merge-truth"`.
3. Assert zero `queue.removal` records and the entry still present.
4. Assert the closeout step outcomes and exit are exactly those of the same fixture without the queue hook.

**Expected Outcome**:
- No merge truth means no removal; the block names the closed skip reason and the closeout result stands.

#### TC-QLC-023 - Lease and unreadable-state skips preserve closeout's exit and steps

**Objective**: Prove the fail-open branches of the automatic path, including the normal "still being dispatched" lease case.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F2-4, F-2, DM-6, NFR-3, RSK-5
**Test Type(s)**: Integration, Performance
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-queue-removal-skips.test.ts`
**Tags**: @backend, @closeout, @queue, @fail-open

**Preconditions**:
- Two variants: (a) a live lease on `GH-241`; (b) an armed unreadable/torn queue store. For each, a control run composes the same closeout facts with the queue-removal hook disabled.

**Steps**:
1. Run the hook-enabled apply and assert exit `0` (or the delivered closeout exit) and the exact step outcome list.
2. Assert `queueRemoval.outcome === "skipped"` with `skipReason === "lease-held"` in variant (a) and `"state-unavailable"` in variant (b).
3. Assert zero appended removal records in both variants.
4. Run the control without the hook and compare exit, step outcomes, and operation counts; assert they differ only by the queue block's read/fold (and by zero appends).
5. Assert no state repair, rewrite, or quarantine is performed by the queue hook.

**Expected Outcome**:
- The skip is reported with a closed reason, the entry remains, and closeout's exit and every step are identical to the no-hook control.
- An unreadable store is never "fixed" by the hook.

#### TC-QLC-024 - Closeout removal converges on re-run and on a never-entered ref

**Objective**: Prove the automatic path is idempotent, unlike the explicit verb, because closeout is re-runnable.
**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F2-5, F-2, NFR-10, DEC-8
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-queue-removal-idempotency.test.ts` (new)
**Tags**: @backend, @closeout, @queue, @idempotency

**Preconditions**:
- Run A: one entry, applied once (removed), then applied again. Run B: no queue entry for the ref, merge truth present.

**Steps**:
1. Apply run A twice and assert both exit `0`.
2. Assert the second run appends zero `queue.removal` records and reports `outcome: "satisfied"` (no `reason`, no `skipReason`).
3. Assert the first run's removal record is byte-identical after the second run.
4. Apply run B and assert exit `0`, zero removal records, and `outcome: "satisfied"`.
5. Assert the step outcomes in both runs equal the delivered list.

**Expected Outcome**:
- "No entry" is success for the automatic path and never an error; a re-run converges without a second record.

#### TC-QLC-025 - The `queueRemoval` block is additive and the step inventory is unchanged

**Objective**: Pin the block as a non-step disclosure and prove the step list did not grow.
**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F2-1, AC-F2-2, AC-F2-4, DM-6, NFR-3
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-queue-removal-block.test.ts` (new); `tests/structure/closeout-additive.test.ts` (extend); `tests/golden/closeout-envelope.test.ts` (extend fixture)
**Tags**: @backend, @closeout, @contract

**Preconditions**:
- Golden closeout envelopes for plan and apply from the delivered suite.

**Steps**:
1. Assert `data.steps` and every step's `id`, order, and outcome equal the delivered golden (no queue step).
2. Assert `data.queueRemoval` is present as a sibling of `telemetryCapture`, `residue`, and `capsule`, and is not inside `steps`.
3. Assert its key set is exactly `outcome`, `ref`, plus `reason` only when removed/would-remove and `skipReason` only when skipped.
4. Assert `outcome` and `skipReason` are members of the Appendix E vocabularies; an unknown value fails.
5. Run the closeout-envelope golden comparison for plan and apply.

**Expected Outcome**:
- The block is additive and closed; the step inventory is byte-identical to the delivered one.

#### TC-QLC-030 - `dep add` is byte-identical to the delivered two-positional add

**Objective**: Prove the explicit spelling is the same operation, not a near-copy with a different payload.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F3-1, F-3, NFR-8
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-dep-grammar.test.ts` (new); `tests/fixtures/queue/depend/grammar-cases.ts` (new)
**Tags**: @backend, @queue, @dependencies

**Preconditions**:
- Two observed entries `A` and `B` with no edge; two identical stores seeded from the same fixture.

**Steps**:
1. On store 1 run `queue dep A B --json`; on store 2 run `queue dep add A B --json`.
2. Assert both exit `0` and their `data` deep-equals (including `ref`, `entry`, `edges`, `result`, `event`, `degraded`).
3. Assert `result` is `added` (or `updated` when the folded edge set already contained the edge) in both.
4. Compare the appended `queue.dependency` records byte-for-byte (excluding only the record timestamp if the fixture advances it identically).
5. Assert one dependency record exists for `A` and its `edges[]` equals the folded set.

**Expected Outcome**:
- The two spellings are indistinguishable in payload, result, record, and event; no delivered key moved.

#### TC-QLC-031 - `dep remove` drops the edge, recomputes readiness, and emits `removed[]`

**Objective**: Prove the ticket's dependency scenario: an edge can leave, the consumer becomes ready, and the delta names the edge.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F3-2, F-3, F-6, EVT-2, SC-M2-S15-04
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-dep-remove.test.ts` (new); `tests/behaviour/events-dependency-delta.test.ts` (extend)
**Tags**: @backend, @queue, @dependencies, @events

**Preconditions**:
- `A` with edge set `["B"]`; `B` observed and otherwise ready; all other readiness conditions for `A` hold.

**Steps**:
1. Run `queue dep remove A B --json` and assert exit `0`, `result: "removed"`, and `edges` no longer contains `B`.
2. Assert exactly one new `queue.dependency` record carries the folded edge set for `A` (empty or unchanged others).
3. Run `queue ready --json`/`queue plan --json` and assert `A` is no longer held `dependency-unobserved` for that edge and appears in the ready set.
4. Run the event projection and assert one `queue.graph`/`dependency-edge` event with `kind: "dependency-edge"`, `lane: "A"`, `ref: "A"`, payload `removed: ["B"]`, and `edges` equal to the folded set.
5. Assert `data.readySet` contains `A` and `data.event` deep-equals `{ topic: "queue.graph", kind: "dependency-edge" }`.

**Expected Outcome**:
- The edge is gone, readiness is derived from the new graph, and the delta event names exactly the dropped edge.

#### TC-QLC-032 - Removing an absent edge is a noop with no record and no event

**Objective**: Prove the idempotent cleanup path, so a script can run the same removal twice.
**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-3, F-3, F-6, NFR-10, DEC-15
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-dep-remove.test.ts`
**Tags**: @backend, @queue, @dependencies, @idempotency

**Preconditions**:
- `A` with no edge to `B`; record-key set and event stream captured.

**Steps**:
1. Run `queue dep remove A B --json` and assert exit `0`, `result: "noop"`, and `data.readySet` is empty (or the delivered empty shape).
2. Assert zero appended dependency records and an unchanged ledger digest.
3. Assert a projection pass over the store emits zero `queue.graph` events.
4. Run the same command again and assert the same result and zero appends.

**Expected Outcome**:
- An absent edge is a noop at exit `0`, never a refusal; nothing is appended or published.

#### TC-QLC-033 - The cycle check is add-only and never refuses a removal

**Objective**: Prove the cycle predicate did not migrate to the removal path and that the existing path evidence is unchanged.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F3-4, F-3, NFR-9
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-dep-cycle.test.ts` (new); reuse `tests/fixtures/queue/graph/cycle/*`
**Tags**: @backend, @queue, @dependencies

**Preconditions**:
- `A` and `B` observed; `B` declares edge `A` through `queue dep B A` (valid); a second store is raw-seeded with both `A -> B` and `B -> A` to represent a legacy/foreign two-node cycle the verb would refuse to create.

**Steps**:
1. Run `queue dep add A B` where `B` already depends on `A`; assert exit `1`, `error.code === "queue.dependency-cycle"`, the summary names the existing path, and zero appends.
2. Assert the `dep` two-positional form refuses with the same identity and zero appends.
3. In the cycle-seeded store, run `queue dep remove A B` against the declared edge and assert exit `0`, `result: "removed"`, with no cycle check (the refusal code never appears).
4. Assert the removal appended exactly one dependency record and published one `dependency-edge` event; assert the other edge `B -> A` is untouched.

**Expected Outcome**:
- The cycle refusal remains an add-only predicate with the same evidence and exit; removal is never refused for a cycle reason.

#### TC-QLC-034 - Dependency grammar refusals hold and an unobserved producer is accepted

**Objective**: Prove the two canonical refs, the consumer's required entry, and the deliberately allowed unobserved producer.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-5, F-3, NFR-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-dep-grammar.test.ts`
**Tags**: @backend, @queue, @dependencies, @errors

**Preconditions**:
- `A` observed, `B` observed, `GH-999` has no entry; non-canonical cases `gh-1`, `GH-`, `GH-1x`.

**Steps**:
1. For each non-canonical ref in either position, run both `dep` forms and assert exit `1`, `error.code === "input.value.rejected"`, and zero appends.
2. Run `queue dep add GH-999 A` (unknown consumer) and assert `queue.entry.unobserved` and zero appends.
3. Run `queue dep add A GH-999` (known consumer, unobserved producer) and assert exit `0`, `result: "added"`, and the edge retained in the folded set.
4. Run `queue list --json`/`queue ready --json` and assert `A` is held `dependency-unobserved`.
5. Run `queue dep remove A GH-999` and assert the edge clears with `removed`.

**Expected Outcome**:
- Grammar and unknown-consumer refusals are classified and inert; an unobserved producer is accepted so readiness can report the truthful held reason.

#### TC-QLC-035 - Dependency mutation payloads name `readySet` and `event`, never a sequence

**Objective**: Pin the additive payload keys and the declared rule that a mutation never asserts a sequence.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-2, F-3, DM-5, NFR-6
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-dep-remove.test.ts`; `tests/golden/queue-dep-remove.test.ts` (new)
**Tags**: @backend, @queue, @contract

**Preconditions**:
- A deterministic dependency-removal case; delivered `queue dep` success golden for comparison.

**Steps**:
1. Assert the add payload keys equal the delivered set exactly (`ref`, `entry`, `edges`, `result`, `degraded`), with no `readySet`/`event` added to the delivered form.
2. Assert the remove payload keys equal exactly `ref`, `entry`, `edges`, `result`, `readySet`, `event`, `degraded`.
3. Assert `data.event` has exactly `topic` and `kind` and **no** `sequence`.
4. Assert `result` is in `added|updated|removed|noop` and no other value is accepted.
5. Compare the remove envelope to its golden.

**Expected Outcome**:
- The delivered add payload is untouched; the remove payload is additive; ordering remains the projection's, never the mutation's.

#### TC-QLC-036 - Every dependency edit is one append and preserves folded history

**Objective**: Prove the edge edit is one latest-wins record, not a rewrite, and that the fold keeps the declared history.
**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-1, AC-F3-2, AC-F3-3, NFR-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-dep-history.test.ts` (new); `tests/fixtures/state/harness.ts`
**Tags**: @backend, @queue, @state, @regression

**Preconditions**:
- `A` with edges `["B"]`; a second edge `C` added later; capture record keys and bytes.

**Steps**:
1. Add `C`, then remove `B`, and assert each accepted edit appended exactly one `queue.dependency` record for `A` and no other record.
2. Assert all earlier dependency records remain byte-identical and the fold returns the latest record's edge set (`["C"]`).
3. Assert the derived document lists `A`'s edges as `["C"]` once, with no duplicate edge.
4. Assert a refused add (cycle or grammar) appends zero records and leaves the fold unchanged.
5. Assert no dependency record is deleted, re-keyed, or rewritten.

**Expected Outcome**:
- Each edit is one append; history is durable; the folded edge set is the latest record's set; refusals are inert.

#### TC-QLC-040 - `dispatch run` refuses a second session with `queue.single-flight`

**Objective**: Prove the ticket's second criterion on the primary dispatch path and that the refusal is pre-session.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F4-1, F-4, DM-7, SC-M2-S15-02, NFR-2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-single-flight.test.ts` (new); `tests/fixtures/queue/single-flight/harness.ts` (new); reuse `tests/fixtures/dispatch/admission.ts`
**Tags**: @backend, @dispatch, @queue, @single-flight

**Preconditions**:
- A live lease for the repository with holder `lane-1`, ref `GH-241`, heartbeat age below TTL; a dispatch request for `GH-241`.
- The harness records spawns, resumes, lease claims, attempt records, lane records, and queue appends.

**Steps**:
1. Run the dispatch command through the production admission composition and assert exit `1`.
2. Assert `error.code === "queue.single-flight"` and `error.detail.holder === "lane-1"`.
3. Assert spawns `0`, resumes `0`, lease claims `0`, attempt records `0`, lane records `0`, and queue appends `0`.
4. Assert no session id is allocated and no socket is opened.
5. Run the same dispatch when the lease ref is a different ref under the same holder and assert the separate `lease-conflict` path (`TC-QLC-044`), not `single-flight`.

**Expected Outcome**:
- A second dispatch on one ref is refused before any session, with the holder named and zero side effects.
- The refusal shape is the classified queue identity, not a generic failure.

#### TC-QLC-041 - `queue claim` returns the same refusal and mutates nothing

**Objective**: Prove the second dispatch path inherits the guard through the same lease truth.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F4-2, F-4, DM-7
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-claim-single-flight.test.ts` (new); reuse `tests/fixtures/queue/cli/harness.ts` and `tests/fixtures/queue/leases/fence-harness.ts`
**Tags**: @backend, @queue, @single-flight

**Preconditions**:
- Same live lease and ref as `TC-QLC-040`; capture the record-key set and lane set.

**Steps**:
1. Run `queue claim GH-241 --holder lane-2 --json` and assert exit `1`, `error.code === "queue.single-flight"`, and `error.detail.holder === "lane-1"`.
2. Assert record-key set, ledger digest, derived-document bytes, and lane set are unchanged.
3. Assert no `queue.lease` record with operation `acquired` or `renewed` was appended.
4. Repeat with `--holder lane-1` (the live holder) and assert the same refusal, proving identity does not bypass the per-ref guard.
5. Assert a claim for a ref with no live lease still returns the delivered `claimed` result.

**Expected Outcome**:
- `queue claim` refuses with the same identity and detail as dispatch, and a same-holder re-claim of the active ref does not renew into a second admission.

#### TC-QLC-042 - The composed daemon claim port inherits the per-ref guard

**Objective**: Prove the third declared dispatch path gets the guard through the one injected claim port, without a new port.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F4-3, F-4, A-6
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-single-flight.test.ts` (new); reuse `tests/behaviour/daemon-lane-supervision.test.ts` harness patterns
**Tags**: @backend, @daemon, @queue, @single-flight

**Preconditions**:
- A live lease for `GH-241`; a composed `runSupervisionCycle` with an injected claim port that delegates to the delivered `claimQueueLease`, and an executor recorder.

**Steps**:
1. Run one supervision cycle whose next action names `GH-241`; assert the cycle returns a claim refusal carrying `queue.single-flight` and `detail.holder`.
2. Assert executor starts `0`, resumes `0`, and no lane record was appended.
3. Assert the cycle's other outcomes and exit are unchanged from a control cycle with no active lane.
4. Assert the composition supplies exactly the delivered claim port (no second admission stage or path branch) by inspecting the composed ports object.

**Expected Outcome**:
- The daemon path inherits the same refusal through the same port; no session starts and no new port exists.

#### TC-QLC-043 - A stale lease takes over instead of refusing

**Objective**: Prove the guard uses the delivered liveness predicate, so a crashed session cannot block the ref past its TTL.
**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F4-4, F-4
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-lease-takeover.test.ts` (new or extend `tests/behaviour/queue-lease.test.ts`)
**Tags**: @backend, @queue, @lease

**Preconditions**:
- A lease for `GH-241` with heartbeat age exactly at the TTL and one above it; no live holder process.

**Steps**:
1. Admit a dispatch/claim for `GH-241` and assert it is **not** refused with `queue.single-flight`.
2. Assert the result is the delivered `taken-over` operation and the lease record names the new holder/ref.
3. Assert the `lease-stale-takeover` incident evidence is appended exactly as delivered.
4. Assert exactly one `queue.lease` append and zero removal/queue-entry appends.
5. Repeat at one millisecond below TTL and assert `queue.single-flight` is returned instead.

**Expected Outcome**:
- At or over TTL is stale and takes over; below TTL is active and refuses. One liveness definition, no second opinion.

#### TC-QLC-044 - Same-holder different-ref refuses; same-ref still renews

**Objective**: Prove the disclosed narrowing in both directions and that a same-holder claim can no longer rewrite the lease's ref.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F4-5, F-4, DEC-13, RSK-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-lease-renewal-narrowing.test.ts` (new); reuse `tests/fixtures/queue/leases/fence-harness.ts`
**Tags**: @backend, @queue, @lease, @regression

**Preconditions**:
- A live lease for ref `A`, repository `R`, holder `H`, heartbeat below TTL.

**Steps**:
1. Claim ref `B`, repository `R`, holder `H`; assert exit `1` with `error.code === "queue.lease-conflict"`, naming `H` and the lease.
2. Read the live lease and assert its `ref` is still `A`, its holder is still `H`, and no `renewed` record was appended.
3. Claim ref `A`, repository `R`, holder `H`; assert result `renewed` and no new session (dispatch) or no second admission (claim).
4. Assert the renewal record's `ref` is `A` and its `acquiredAt`/`leaseId` are preserved as delivered.
5. Assert a same-holder claim for the same ref after a release returns `claimed`, not `renewed`.

**Expected Outcome**:
- Renewal is reachable only for the same `(repository, ref, holder)`; any other combination refuses with the delivered conflict identity and leaves the lease naming the running ref.

#### TC-QLC-045 - A guard refusal is byte-identical and its detail is bounded

**Objective**: Prove AC-F4-6 and DM-7 together: the refusal is inert and the holder evidence is bounded identifiers only.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F4-6, F-4, DM-7, NFR-2, NFR-6
**Test Type(s)**: Integration, Performance, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-single-flight-purity.test.ts` (new)
**Tags**: @backend, @queue, @purity, @privacy

**Preconditions**:
- A live lease; a recording store and projection; a snapshot of record count, derived-document bytes, lane set, event stream, and socket connections.

**Steps**:
1. Refuse a dispatch and a claim; assert both snapshots are identical (record count, document bytes, lane set, event count, socket count).
2. Assert `detail.holder` length is ≤128 and contains no newline, credential-shaped token, session id, prompt, diff, or repository path.
3. Assert the detail is a string (single line) and that `Object.keys(detail)` is exactly `["holder"]` where the envelope exposes a detail object; if the delivered shape renders it in the error text, assert the same tokens and bounds.
4. Assert the remediation hint is present and actionable (names the holder-lane concept).
5. Assert no attempt, lease, lane, queue, or capsule record was appended.

**Expected Outcome**:
- The refusal changes nothing observable and leaks nothing beyond the bounded holder identity.

#### TC-QLC-050 - A `done` entry is removed with `reconciled`

**Objective**: Prove the ticket's third criterion: a closed tracker item retires the entry without hand editing.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F5-1, F-5, DM-1, SC-M2-S15-03
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-reconcile.test.ts` (new); `tests/fixtures/queue/reconcile/harness.ts` (new)
**Tags**: @backend, @queue, @reconcile

**Preconditions**:
- One observed entry `GH-241`; the injected tracker port reports `deliveryState: "done"`; capture the file set and ledger digest.

**Steps**:
1. Run `queue reconcile --json` and assert exit `0`.
2. Assert `data.result === "removed"`, `data.removed` deep-equals `[{ ref: "GH-241", reason: "reconciled" }]`, and `data.checked === 1`.
3. Assert exactly one `queue.removals:GH-241` record with `reason: "reconciled"` and the entry absent from the fold.
4. Assert the file set changed only by the append-only ledger and the derived document; no state file was edited or rewritten outside the tool.
5. Assert `queue list --json`/`queue plan --json` no longer show the entry.

**Expected Outcome**:
- A positive `done` observation removes the entry with `reconciled`; the run exits `0` and writes no external state.

#### TC-QLC-051 - A `canceled` entry is removed with `reconciled`

**Objective**: Prove `canceled` is the second and only other stale state.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-2, F-5, DEC-11
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-reconcile.test.ts`
**Tags**: @backend, @queue, @reconcile

**Preconditions**:
- One observed entry whose tracker `deliveryState` is `canceled`; one whose native status is a cancelled alias normalised to `canceled`.

**Steps**:
1. Run `queue reconcile --json` and assert exit `0`, `result: "removed"`, and `removed[0].reason === "reconciled"`.
2. Assert one removal record with `reconciled`.
3. Repeat with a tracker-native cancelled value and assert the same normalised observation and removal.
4. Assert a `done` item in the same run is removed once, not twice.

**Expected Outcome**:
- `canceled` removes with the same reason and mechanics as `done`; the closed alias set is respected.

#### TC-QLC-052 - Open delivery states are retained with their observed state

**Objective**: Prove the negative half of the staleness rule: nothing but `done`/`canceled` removes.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-3, F-5, DEC-11, A-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-reconcile-retention.test.ts` (new)
**Tags**: @backend, @queue, @reconcile

**Preconditions**:
- Four entries with `backlog`, `ready`, `in-progress`, and `in-review`; capture record keys.

**Steps**:
1. Run `queue reconcile --json` and assert exit `0` and `result: "noop"`.
2. Assert `data.retained` deep-equals the four refs with their observed `deliveryState`, in a deterministic order.
3. Assert `data.removed` is empty and zero `queue.removal` records exist.
4. Assert all four entries are still present in the fold and in `queue list`.
5. Assert an absent assignee, label, missing plan, or old age does not change the outcome (add those facts to one entry and re-run).
6. Add one entry whose tracker kind has no read surface; assert it is retained and reported as an `unavailable`/unobserved observation, and zero removal records are appended for it (A-2).

**Expected Outcome**:
- Only `done`/`canceled` are stale; every open state, and a tracker kind with no read surface, is retained and reported; nothing else removes.

#### TC-QLC-053 - An unreadable tracker removes nothing and returns the provider identity

**Objective**: Prove reconcile fails closed and does not invent a queue identity for a provider failure.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F5-4, F-5, NFR-4, NFR-9
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-reconcile-unreadable.test.ts` (new); reuse `tests/fixtures/closeout/read-observation.ts` failure shapes
**Tags**: @backend, @queue, @reconcile, @errors

**Preconditions**:
- One `done` entry and one `ready` entry; the tracker port is programmed to fail with `provider.outage`, `provider.quota.exceeded`, and `provider.auth.rejected` in three runs.

**Steps**:
1. For each failure, run `queue reconcile --json` and assert exit `2` for outage/quota and exit `1` for auth.
2. Assert `error.code` is exactly the provider identity and **not** a `queue.*` code.
3. Assert zero removal records, zero derived-document replacements, and no partial `removed[]` in the payload.
4. Assert the `done` entry is still present after the failed run.
5. Assert the read counter is exactly one per examined entry (no retry) and that the failure stops the run.

**Expected Outcome**:
- Unreadable truth removes nothing and exits on the provider class; there is no partial success and no queue synonym.

#### TC-QLC-054 - `--ref` examines exactly one entry

**Objective**: Prove scope narrowing is real and per-repository, so a large queue can be swept in bounded runs.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-5, F-5, NFR-4
**Test Type(s)**: Integration, Performance
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-reconcile-scope.test.ts` (new)
**Tags**: @backend, @queue, @reconcile

**Preconditions**:
- Five entries in repository R, all `done`; a second repository S with one entry.

**Steps**:
1. Run `queue reconcile --ref GH-242 --json` and assert `checked === 1`, the tracker read count is `1`, and only `GH-242` is removed.
2. Assert the other four R entries and the S entry are untouched (records, fold presence, and read count).
3. Assert `removed` contains exactly `GH-242`.
4. Run without `--ref` and assert `checked === 5` and only R entries are examined (S is out of the per-repository scope).
5. Assert `--ref` for a ref in S from an R checkout does not examine S (scope is the invoking repository).

**Expected Outcome**:
- `--ref` examines exactly one entry with one read; no other repository's queue is touched.

#### TC-QLC-055 - A not-found work item is unobserved and retained

**Objective**: Prove a missing tracker item is not evidence that work landed.
**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-6, F-5, DEC-11
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-reconcile-unobserved.test.ts` (new)
**Tags**: @backend, @queue, @reconcile

**Preconditions**:
- One entry whose tracker read returns `not-found`; one `done` entry in the same run.

**Steps**:
1. Run `queue reconcile --json` and assert exit `0`.
2. Assert `data.unobserved` deep-equals `["GH-241"]` and the ref is absent from `removed` and `retained`.
3. Assert zero removal records for the unobserved ref and it is still present in the fold.
4. Assert the `done` entry is removed normally.
5. Assert the payload's `checked` counts both examined entries.

**Expected Outcome**:
- A not-found item is retained and reported unobserved; `abandoned` remains the operator's removal reason for a deleted item.

#### TC-QLC-056 - The 100-entry cap reports `truncated` and an exact remainder

**Objective**: Prove the bound is a hard cap with an honest remainder, not a silent truncation.
**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F5-7, F-5, DM-5, NFR-4
**Test Type(s)**: Integration, Performance
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-reconcile-bounds.test.ts` (new); fixture with 101+ seeded entries (generated, not committed as 101 literal records)
**Tags**: @backend, @queue, @reconcile, @bounds

**Preconditions**:
- 105 observed entries in one repository, deterministically ordered; all `done`; a read counter on the tracker port.

**Steps**:
1. Run `queue reconcile --json` and assert `data.checked === 100`, `data.truncated === true`, and `data.remainder === 5`.
2. Assert the tracker read count is exactly `100` and no read names an entry beyond the cap.
3. Assert exactly 100 removals and that the five beyond the cap remain present and untouched.
4. Run `--ref` for one beyond-cap entry and assert it is examined and removed, proving the documented narrowing path.
5. Assert `removed` and `retained` lists are each ≤100 entries.

**Expected Outcome**:
- At most 100 entries are examined, `truncated`/`remainder` are exact, and no beyond-cap entry is read or removed.

#### TC-QLC-057 - Reconcile removals obey every F-1 invariant and emit one event per ref

**Objective**: Prove reconcile is not a second removal implementation with weaker rules.
**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F5-8, F-1, F-6, EVT-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-reconcile-invariants.test.ts` (new)
**Tags**: @backend, @queue, @reconcile, @events

**Preconditions**:
- A `done` entry with an active park and a dependent `B`; a second `done` entry with no park; capture records.

**Steps**:
1. Run `queue reconcile --json` and assert two removals with `reconciled`.
2. For the parked ref, assert one `queue.park` `released` record precedes its removal; for the other, assert no park record.
3. Assert `B`'s edge set and records are unchanged and it is held `dependency-unobserved`.
4. Assert each removal appended exactly one removal record and no other entry's records.
5. Run the projection and assert exactly one `remove` event per removed ref, each in its own lane, with `reason: "reconciled"`.

**Expected Outcome**:
- Reconcile removals are ordinary F-1 removals: park withdrawal, no cascade, one append, one event per ref.

#### TC-QLC-058 - The reconcile payload is exact and a repeated run is a noop

**Objective**: Pin the reconcile result shape and record the NFR-10 convergence gap explicitly.
**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-1, F-5, DM-5, NFR-10, GAP-T3
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-reconcile-payload.test.ts` (new); `tests/golden/queue-reconcile.test.ts` (new)
**Tags**: @backend, @queue, @reconcile, @golden

**Preconditions**:
- A mixed fixture: one `done`, one `canceled`, one `ready`, one not-found; deterministic ordering and clock.

**Steps**:
1. Assert `Object.keys(data)` equals exactly `["result","checked","removed","retained","unobserved","readySet","truncated","remainder","degraded"]`.
2. Assert `removed[]` elements have exactly `ref` and `reason`; `retained[]` elements have exactly `ref` and `deliveryState`; `readySet[]` is derived and sorted deterministically.
3. Assert `result` is `removed` and the `noop` case (no stale entry) has an empty `removed[]`, `truncated: false`, `remainder: 0`.
4. Run a second reconcile over the already-reconciled refs and assert `result: "noop"`, zero removal records, and exit `0`.
5. Compare both envelopes to their goldens.

**Expected Outcome**:
- The payload is exact and bounded; a repeated run converges to a noop at exit `0`.
- `OQ-T1` records that NFR-10's repeated-reconcile half has no dedicated AC.

#### TC-QLC-060 - One removal publishes one `remove` event with exactly three keys

**Objective**: Prove EVT-1's payload and identity: `remove`, not `removed`, and exactly the declared fields.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F6-1, F-6, EVT-1, DM-8, NFR-5
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/events-remove.test.ts` (new); `tests/fixtures/events/event-harness.ts`
**Tags**: @backend, @events, @taxonomy

**Preconditions**:
- A real event harness over a temp store; one applied `queue remove --reason abandoned`; one subscriber to `queue.graph`.

**Steps**:
1. Step the projection and collect the `queue.graph` frames.
2. Assert exactly one frame has `kind === "remove"`.
3. Assert `lane === "GH-241"` and `ref === "GH-241"`, `sequence` is a positive integer, and `occurredAt` is the removal record's timestamp.
4. Assert `Object.keys(payload)` deep-equals `["ref","reason","recordedAt"]` and `payload.reason === "abandoned"`.
5. Assert no `removed` kind exists and the frame carries the eight declared envelope fields with no `cursor`.

**Expected Outcome**:
- One event, the declared kind, the declared lane/ref, and exactly the three declared payload keys.

#### TC-QLC-061 - The dependency delta carries `removed[]` with a monotonic sequence

**Objective**: Prove SC-M2-S15-04 and that the delivered delta shape needed no new field.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F6-2, F-6, EVT-2, NFR-5
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/events-dependency-delta.test.ts` (extend)
**Tags**: @backend, @events, @dependencies

**Preconditions**:
- A prior `entry` or `dependency-edge` event on lane `A` with a known sequence; then `dep remove A B`.

**Steps**:
1. Assert exactly one `dependency-edge` event follows the removal, with `lane: "A"` and `ref: "A"`.
2. Assert `payload.removed` deep-equals `["B"]`, `payload.added` is empty, and `payload.edges` equals the folded set.
3. Assert `sequence` strictly exceeds the lane's previous event and increments per `(topic, lane)`.
4. Assert a `dep add` on the same lane yields `added: ["C"]` with the next sequence.
5. Assert the payload key set is exactly the delivered `ref`, `edges`, `added`, `removed`, `recordedAt`.

**Expected Outcome**:
- The edge delta is the delivered contract with `removed[]` populated; sequence remains the projection's monotonic counter.

#### TC-QLC-062 - The declaration marks `remove` emitted and the non-emitted set empty

**Objective**: Move the declared truth: the kind is now emitted, no kind is unemitted, and nothing else in v1 moved.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F6-3, F-6, DM-8, DEC-14
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/event-taxonomy-declaration.test.ts` (extend); `tests/checks/event-taxonomy-conformance.test.ts` (extend); `tests/behaviour/events-describe.test.ts` (extend)
**Tags**: @backend, @contract, @events

**Preconditions**:
- The shipped declaration; the live `events describe queue.graph` surface.

**Steps**:
1. Assert `queue.graph.kinds.find(k => k.name === "remove").emitted === true`.
2. Assert the collection of kinds with `emitted: false` is exactly `[]` (deep equality, not length).
3. Assert the four kind names remain `entry`, `dependency-edge`, `release`, `remove` in declared order; the topic set, frame fields, `ordering: "sequence-per-lane"`, `overflow: "repoll"`, and `version: "v1"` are unchanged.
4. Assert `events describe queue.graph` text and `--json` report `remove` as emitted with `payloadFields` exactly `["ref","reason","recordedAt"]`; the text no longer prints a non-emitted line.
5. Assert the taxonomy version did not change and no new topic/kind/field exists.

**Expected Outcome**:
- `remove` is emitted, the non-emitted set is empty, and every other v1 declaration fact is untouched.
- The surface and the printed description agree with the declaration.

#### TC-QLC-063 - The emitted-payload-key comparison is bidirectional for every kind

**Objective**: Make the payload contract a failing comparison, not a claim: an extra or missing key must fail.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F6-4, F-6, NFR-7, RSK-7
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/event-taxonomy-additive.test.ts` (extend); `tests/structure/event-taxonomy-drift.test.ts` (extend); `tests/fixtures/events/drift-mutants.ts` (extend)
**Tags**: @backend, @contract, @mutation

**Preconditions**:
- A live projection case view covering every emitted kind, including a real removal record; the production comparator.

**Steps**:
1. Baseline: assert every emitted kind's projected payload key set equals its declared `payloadFields` exactly (both directions), for all thirteen declared emitted kinds (twelve delivered plus `remove`).
2. Mutant A: add `sequence` (or `mutation`) to a projected `remove` payload; assert the comparison reports a violation naming `queue.graph`/`remove` and the extra key.
3. Mutant B: delete `recordedAt` from the `remove` payload; assert a violation naming the missing key.
4. Mutant C: add an undeclared key to one delivered kind (`dependency-edge`) and assert the same failure, so the comparator is not special-cased to `remove`.
5. Assert the live declaration bytes are unchanged after the mutations.

**Expected Outcome**:
- The comparison is bidirectional and per kind; a hand-written payload that drifts in either direction fails naming the kind and key.

#### TC-QLC-064 - The four `remove`-unemitted pins move together, two-sided

**Objective**: Prove RSK-7/DEC-14: the pins are updated as equalities in one delivery, not relaxed or partially moved.
**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F6-3, F-6, DEC-14, RSK-7
**Test Type(s)**: Unit, Contract, Regression
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/event-taxonomy-declaration.test.ts`, `tests/structure/event-taxonomy-additive.test.ts`, `tests/checks/event-taxonomy-conformance.test.ts`, `tests/behaviour/events-describe.test.ts` (all extend)
**Tags**: @backend, @contract, @regression, @pins

**Preconditions**:
- The four delivered pin sites are enumerated in §7.1; each currently asserts the old truth.

**Steps**:
1. Declaration pin: assert the non-emitted list deep-equals `[]`; assert `remove.emitted === true`.
2. Additive pin: assert the emitted `(topic, kind)` set equals every declared kind (`emitted === true` for all) and that a `remove` event *is* observed after a real removal; assert the old `emitted === (kind !== "remove")` predicate is gone.
3. Conformance pin: assert the live surface reports `emitted: true` and the exact payload list; assert no "not emitted" text remains for `remove`.
4. Describe pin: assert the printed non-emitted list is empty and `remove` renders as an emitted kind.
5. Assert each pin uses equality (`toEqual`/`deepEqual`) on the full value, not `toContain`, a length check, or a subset; assert no pin is deleted or skipped.

**Expected Outcome**:
- All four pins move to the same new truth in the same delivery; a partial move or a relaxed assertion fails.

#### TC-QLC-065 - Each applied removal is emitted exactly once, in its own lane

**Objective**: Prove exactly-once emission under repeated projection ticks and per-ref lanes.
**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F6-1, F-6, NFR-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/events-remove.test.ts`; event harness
**Tags**: @backend, @events, @taxonomy

**Preconditions**:
- Two removals applied before a tick (explicit for `A`, reconcile for `B`); one subscriber.

**Steps**:
1. Step the projection once and assert exactly one `remove` event per ref, each in its own lane.
2. Step again with no new records and assert zero additional events.
3. Step after appending an unrelated record and assert no duplicate `remove` event.
4. Assert sequences increase within each lane independently and no order is asserted across lanes.
5. Assert the event's `recordedAt` is the durable removal record's timestamp, not the tick time.

**Expected Outcome**:
- Each durable removal is emitted once on the first observing tick; repeated ticks do not duplicate; lanes are independent.

#### TC-QLC-066 - Refusals, noops, and skips publish zero events

**Objective**: Prove the negative publication rule across every mutation path, not just the happy path.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F6-2, AC-F6-3, NFR-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/events-emitted-kinds.test.ts` (extend); `tests/behaviour/events-dependency-delta.test.ts` (extend)
**Tags**: @backend, @events, @purity

**Preconditions**:
- One store per case: refused removal, refused dependency add (cycle/grammar), noop `dep remove`, skipped closeout removal, and a no-change reconcile.

**Steps**:
1. For each case, run a full projection pass and assert zero `queue.graph` frames.
2. Assert the record count and derived-document bytes are unchanged.
3. Assert the emitted kind set over the whole fixture is exactly the declared emitted set — no phantom `entry`, `dependency-edge`, `release`, or `remove` frame appears for the refused/skipped case.
4. Assert no frame is emitted for a noop or skip even after a second tick.
5. Assert a subsequent real mutation on the same lane emits exactly one event with the next sequence.

**Expected Outcome**:
- Zero events for every refusal, noop, and skip; the first real mutation after them is still emitted once.

#### TC-QLC-070 - Help lists the new verbs and corrects the `dep` synopsis

**Objective**: Prove the family self-describes the delivered grammar, not the planned one.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F7-1, F-7
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-help-lifecycle.test.ts` (new); `tests/behaviour/entrypoint-help.test.ts` (extend); `packages/cli/src/help.ts`
**Tags**: @backend, @cli, @help

**Preconditions**:
- The shipped help surface; a captured stdout sink.

**Steps**:
1. Run `queue --help` and assert it lists `remove`, `dep add`, `dep remove`, and `reconcile`, while keeping the delivered verbs.
2. Run `queue remove --help`, `queue reconcile --help`, `queue dep --help`, `queue dep add --help`, and `queue dep remove --help`; assert each exits `0` and renders usage, options, and examples.
3. Assert `--reason` documents exactly the four values, and `--ref` is documented only for reconcile.
4. Assert the `queue dep` synopsis is the two-positional form (`queue dep <ref> <on-ref>`), with no `--on` option and no `--dep` option on `dep`.
5. Assert no help page claims `release` removes an entry; assert it still describes lease release and the optional park.

**Expected Outcome**:
- Every new verb is reachable and documented; the stale synopsis is gone; release's meaning is unchanged in help.

#### TC-QLC-071 - Help coverage, parity, and the M1 page are complete

**Objective**: Prove the mount is one unit: the page root resolves, the guards pass, and every delivered verb is documented.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F7-2, F-7
**Test Type(s)**: Contract
**Automation Level**: Semi-automated
**Target Layer / Location**: `tests/checks/queue-reference-page.test.ts` (new); `tests/checks/help-guide-coverage.test.ts` (existing, run); `tests/checks/reference-page-parity.test.ts` (existing, run); `tests/behaviour/entrypoint-help-coverage.test.ts` (extend); `doc/planning/oss-tooling/milestones/m1/commands/queue.md`
**Tags**: @backend, @docs, @help, @guards

**Preconditions**:
- The M1 page remains the resolved page root for `queue`; the coverage inventory and page-root mapping are current.

**Steps**:
1. Run `bun test tests/checks/help-guide-coverage.test.ts` and assert zero failures for the queue family.
2. Run `bun test tests/checks/reference-page-parity.test.ts` and assert parity holds with the queue inventory row.
3. Assert the resolved M1 page contains a synopsis entry for every delivered verb (`ready`, `list`, `plan`, `add`, `prioritize`, `dep`, `claim`, `release`, `remove`, `reconcile`) and the `dep add`/`dep remove` forms.
4. Assert the page names the reason vocabulary, the single-flight refusal, and the reconcile contract, and does not describe `release` as removal.
5. Record the review attestation for sentence-level truth in §10.

**Expected Outcome**:
- Guards report zero failures, parity holds, and the resolved page documents the full delivered surface.
- A missing verb or a missing inventory row fails a named check, not a prose review.

#### TC-QLC-072 - The M2 page is reconciled to delivered identities and envelope

**Objective**: Remove the second, unexecutable contract from the planning page.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F7-2, F-7, DEC-2, GAP-T4
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/m2-queue-page-reconciliation.test.ts` (new); `doc/planning/oss-tooling/milestones/m2/commands/queue.md`
**Tags**: @backend, @docs, @guards

**Preconditions**:
- The M2 page exists and is scanned by required/forbidden tokens; the page's v1 sections are non-empty (non-vacuity control).

**Steps**:
1. Assert the page names `queue.reason-missing`, `queue.single-flight`, and `queue.entry.unobserved`.
2. Assert the page contains neither `queue.entry-unknown` nor `queue.state-unavailable` as an error row (a token scan over the ERRORS table).
3. Assert no example envelope contains a top-level `ok` or `command` field; assert the examples carry `schemaVersion`, `runId`, `exitCode`, `timing`, and `data`/`error`.
4. Assert the page spells the event kind `queue.graph/remove` (not `removed`) and documents the outcome/skip vocabularies and the 100-entry cap.
5. Assert each scanned section resolves to a non-empty span before scanning, so a deleted page or renamed heading fails.

**Expected Outcome**:
- The planning page names only delivered identities and the delivered envelope; the duplicate identities and the old envelope cannot survive.

#### TC-QLC-073 - The queue error kind is exactly seven rows with the five unchanged

**Objective**: Move the error-row pin as a two-sided equality and prove the delivered rows did not change meaning.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F7-3, F-7, NFR-7, NFR-9
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/queue-scheduling-contract.test.ts` (extend); `tests/structure/error-table.test.ts` (extend); `tests/fixtures/queue/errors/references.json` (5 → 7)
**Tags**: @backend, @contract, @errors, @pins

**Preconditions**:
- The delivered five rows captured as literals in the fixture, in declared order.

**Steps**:
1. Assert `ERROR_TABLE.filter(e => e.domainKind === "queue").map(e => e.code)` deep-equals the seven-element fixture array in declared order: the delivered five, then `queue.reason-missing`, then `queue.single-flight`.
2. Assert `QUEUE_ERROR_CODES` deep-equals the same array.
3. Assert the five delivered rows' `category`, `projectionClass`, `retryable`, `consequence`, and `remediationHint` are byte-identical to their pre-change values.
4. Assert `queue.reason-missing` is `user-validation` with exit `1`, and `queue.single-flight` is `user-validation` with exit `1` and `retryable: true` (the AC-F7-3 wording; spec §5.1 F-7's "transient" label is recorded as `OQ-T5` and the AC governs until reconciled).
5. Assert no other queue row and no other domain row was added or removed.

**Expected Outcome**:
- Exactly seven rows in order; the delivered five are unreserved and unrewritten; the two new rows have the declared class and exit.

#### TC-QLC-074 - The new flags are declared and malformed values are grammar refusals

**Objective**: Prove the grammar knows the flags, so a bad value never falls through as a positional or an accidental success.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F7-1, F-7, NFR-9
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-help-lifecycle.test.ts`; `tests/behaviour/queue-remove-refusals.test.ts`
**Tags**: @backend, @cli, @errors

**Preconditions**:
- The queue command's declared flag inventory; cases: `--reason` with no value, `--ref` with no value, unknown `--color`, `--reason` before the ref, `--ref` on `remove`, and a third positional on `dep`.

**Steps**:
1. For each malformed case, run the invocation and assert exit `1` with `input.value.rejected` (or the delivered unknown-flag identity), and assert the summary names the flag or the offending token.
2. Assert zero appended records and no removal/reconcile side effect.
3. Assert `--reason` and `--ref` are in the declared `requiresValue`/flag inventory and are documented in help.
4. Assert `--ref` is rejected on verbs that do not declare it, and `--reason` is rejected on `release`.
5. Assert the two accepted spellings (`dep A B` and `dep add A B`) still succeed while a third positional fails.

**Expected Outcome**:
- Both flags are declared and require a value; malformed input is a classified grammar refusal with zero mutation.

#### TC-QLC-075 - Error-table sync and the `{0,1,2}` exit projection hold

**Objective**: Prove the documented table, the code table, and the exit projection are one truth in both directions.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F7-3, F-7, NFR-9
**Test Type(s)**: Contract, Mutation
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/error-table-sync.test.ts` (existing, extend corpus); `tests/checks/exit-code-literals.test.ts` (existing, run); `tests/structure/error-table.test.ts` (extend)
**Tags**: @backend, @errors, @guards

**Preconditions**:
- The documented `feature-result-contract.md` table and the code table; the code corpora fixture.

**Steps**:
1. Run the sync check against the live tree and assert zero drift.
2. Mutate a temp copy: add a queue row to the code only, then to the doc only; assert each direction fails naming the row.
3. Assert every queue refusal path in this change resolves to a row in the table and an exit from its `projectionClass`.
4. Assert the exit-literal guard finds no literal `0`/`1`/`2` outside the projection module and that no code path can return `3` or another digit.
5. Assert the new rows appear in the documented table with their class and consequence.

**Expected Outcome**:
- Code and docs agree in both directions; every new failure has one identity and one projected exit.

#### TC-QLC-080 - Every accepted mutation is one fenced, post-verified transaction

**Objective**: Prove NFR-1 mechanically, including verification failure handling.
**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-NFR-1, NFR-1
**Test Type(s)**: Integration, Performance
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-remove-atomicity.test.ts` (new); `tests/fixtures/state/harness.ts` (`armAppendFailure`, `withinFence`)
**Tags**: @backend, @queue, @state, @atomicity

**Preconditions**:
- A recording store; cases: accepted removal, accepted `dep remove`, accepted reconcile removal, refused removal, and an armed append/replace failure.

**Steps**:
1. For each accepted mutation assert exactly one fence acquisition, the appends occur inside the handle, and each append is read back and verified before the derived document replacement.
2. Assert the derived document replacement happens only after all appends verify; inject a verification mismatch and assert no replace occurs.
3. Assert a refused mutation performs zero appends, zero replaces, and zero fence acquisitions where the refusal is pre-fence.
4. Assert an armed append failure leaves the ledger at its pre-run digest and no partial record is visible to the fold.
5. Assert the failure is classified (state identity, exit `2`) and the process does not continue to the event publication step.

**Expected Outcome**:
- One fence, verified appends, replace-last; a failure cannot leave a visible half-mutation or a stale derived document.

#### TC-QLC-081 - The admission guard costs at most one read and appends nothing

**Objective**: Prove the guard's cost and blast radius with counters, not with an argument.
**Scenario Type**: Performance
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-NFR-2, NFR-2
**Test Type(s)**: Performance, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-single-flight-read-cost.test.ts` (new); counting store wrapper
**Tags**: @backend, @queue, @perf

**Preconditions**:
- A counting `StateStorePort`; a baseline admission with no other lane; a refusal case with one live lane.

**Steps**:
1. Count whole-store reads for the baseline admission and for the refused admission; assert the delta is ≤1.
2. Assert the count is constant across 1 vs N live lanes and across store size (two fixture sizes).
3. Assert lease/attempt/lane/queue append deltas are `0`, spawn/resume deltas are `0`, and socket connects are `0`.
4. Assert the guard reads the same liveness view the claim uses (one read, not a second per lease).
5. Print the counters and fixture shape with the test output.

**Expected Outcome**:
- At most one additional read, zero appends, zero sessions, zero sockets; the guard does not scan per-lane.

#### TC-QLC-082 - Closeout outcomes are identical and its appends are bounded

**Objective**: Prove the automatic removal is additive in cost and inert in outcome.
**Scenario Type**: Performance
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-NFR-3, NFR-3
**Test Type(s)**: Performance, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-queue-removal-cost.test.ts` (new)
**Tags**: @backend, @closeout, @queue, @perf

**Preconditions**:
- Two composed closeout runs over the same facts: one with the queue-removal port and one without; counting store and clock.

**Steps**:
1. Assert the step outcome list, exit code, and every non-queue `data` block are identical between the runs.
2. Assert the hook-enabled run adds at most one queue fold and at most two appends (park withdrawal + removal), and the no-entry case adds at most one read and zero appends.
3. Assert no second fence acquisition is added.
4. Assert the hook runs after the closeout writes (record order in the ledger), never before a step.
5. Print the operation deltas with the fixture shape.

**Expected Outcome**:
- Closeout's observable result is unchanged; the added cost is exactly the declared fold/read/append bound.

#### TC-QLC-083 - Reconcile performs one bounded read per entry and none past the cap

**Objective**: Prove the read budget and the absence of retry, pagination, and concurrency.
**Scenario Type**: Performance
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-NFR-4, NFR-4
**Test Type(s)**: Performance, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-reconcile-read-cost.test.ts` (new)
**Tags**: @backend, @queue, @reconcile, @perf

**Preconditions**:
- A recording tracker port; runs over 0, 1, 10, and 105 entries; one failing run at entry 7.

**Steps**:
1. Assert reads equal `min(entries, 100)` and exactly one call per examined entry.
2. Assert no call carries a page/cursor/since parameter and no call is issued after the first failure.
3. Assert no two calls overlap (the port rejects concurrent invocation) and the maximum in-flight count is `1`.
4. Assert a 105-entry run performs exactly 100 reads and zero reads for the remainder.
5. Print the call log with refs and counts.

**Expected Outcome**:
- Exactly one bounded read per examined entry, no retry, no pagination, no concurrency, and a hard stop at the cap.

#### TC-QLC-084 - Output, records, and events are bounded and carry no secret

**Objective**: Prove the new surfaces respect the privacy and size boundaries.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-NFR-5, NFR-6, NFR-8
**Test Type(s)**: Contract, Negative
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/queue-lifecycle-privacy.test.ts` (new); reuse `tests/checks/privacy-literals.test.ts` patterns
**Tags**: @backend, @queue, @privacy, @bounds

**Preconditions**:
- A fixture carrying a credential-shaped token, a session-id-shaped value, a prompt-like string, and a diff-like string in the ambient environment/provider payload; a real removal, reconcile, and refusal.

**Steps**:
1. Assert the removal payload has exactly the three declared event fields and the six declared data keys; assert `reconcile` lists are each ≤100 and carry only refs, delivery-state aliases, counts, and timestamps.
2. Assert `detail.holder` is ≤128 characters, single line, and matches an identifier pattern; assert no other new detail field exists.
3. Scan the envelopes, records, events, and logs for the seeded secret shapes; assert zero matches and that no repository path, prompt, diff, or provider payload appears.
4. Assert the reconcile credential is resolved through the declared port and that an ambient-only credential is never read (the port recorder sees the reference, not the token).
5. Assert a token passed on the command line is refused as grammar, never echoed.

**Expected Outcome**:
- All new output is bounded and identifier-only; no secret material reaches an output, record, event, or log.

#### TC-QLC-085 - The additive boundary and both inventories hold

**Objective**: Prove NG-8 mechanically: no package, subpath, adapter, or schema moved, and exactly two rows were added.
**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-NFR-6, NFR-7, NG-8
**Test Type(s)**: Unit, Contract, Boundary
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/queue-additivity.test.ts` (new); `tests/structure/event-additivity-inventory.test.ts` (extend baseline); `tests/boundaries/boundaries.test.ts` (run); `tests/structure/queue-scheduling-contract.test.ts` (extend)
**Tags**: @backend, @contract, @boundaries, @pins

**Preconditions**:
- Baseline manifests, `STATE_SCHEMA_VERSION`, and inventory fixtures from the delivered tree.

**Steps**:
1. Assert package manifests, workspace globs, and declared `workspaceImports` are unchanged; assert zero new package, subpath, or provider adapter.
2. Assert `STATE_SCHEMA_VERSION === "delivery.state.v1"` and no new record kind beyond the declared `queue.removal` addition; assert the queue record-kind declaration grows 5 → 6 by exact equality and no other kind moves.
3. Assert the error-row inventory grows 5 → 7 by exact equality and no other row moves.
4. Assert the export/inventory parity checks and file-set inventory equal the tree in both directions with the new modules/exports.
5. Run the boundary suite and assert no new cross-package edge or tier violation.

**Expected Outcome**:
- Additive in every dimension except the two declared inventories and the one new record kind; both inventories are exact in both directions.

#### TC-QLC-086 - All three mutation paths converge on re-run

**Objective**: Close the convergence contract where the spec gives it and flag where it does not.
**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-5, AC-F3-3, AC-F5-1, NFR-10
**Test Type(s)**: Integration, Regression
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-lifecycle-convergence.test.ts` (new)
**Tags**: @backend, @queue, @regression, @idempotency

**Preconditions**:
- A removed ref, an absent dependency edge, and an already-reconciled ref; one never-entered ref for closeout.

**Steps**:
1. Repeat `closeout --apply` and assert exit `0`, zero removal appends, `satisfied`.
2. Repeat `dep remove` and assert exit `0`, `noop`, zero appends, zero events.
3. Repeat `reconcile` and assert exit `0`, `noop`, zero removals, zero appends, zero events.
4. Assert each first-run record is byte-identical after the repeat and the derived document did not churn.
5. Record the `OQ-T1` note that step 3 maps to AC-F5-1 because no dedicated AC exists.

**Expected Outcome**:
- Every re-run converges without a second record or event; the one traceability gap is raised, not omitted.

## 6. Environments and Test Data

**Hermetic by default.** Every case runs in the local Bun test process against a temporary state root created by `tests/fixtures/state/harness.ts` (`makeTempRoot`, `makeAuditStore`, `openStore`) and removed in `afterEach`. No case reads or writes the live repository state, `$HOME`, a real daemon socket, or the network. The canonical local gate is `TMPDIR="$PWD/tmp/tmpdir" pnpm check`; the same `TMPDIR` is used for the narrow suites so the CI baseline-parity case does not hit a cross-device hardlink error.

**Fixture strategy.**

- **Case definitions are data, not test files.** `tests/fixtures/queue/removal/cases.ts`, `tests/fixtures/queue/reconcile/cases.ts`, `tests/fixtures/queue/single-flight/cases.ts`, and `tests/fixtures/queue/depend/grammar-cases.ts` export typed case arrays: reason/refusals, delivery-state matrices, holder/ref/TTL matrices, and add/remove/cycle cases. A case carries its inputs, the expected identity/result, and the expected record/event shape, so a new case is a data addition and not a new test body.
- **Seeding uses production writers.** Entries, dependencies, leases, and parks are seeded through `declareQueueEntry`, `claimQueueLease`, `releaseQueueLease`, and the delivered park path, not by hand-writing ledger lines, except where a case deliberately constructs a raw record to prove a fold rule (`TC-QLC-009`).
- **Clock and identifiers are injected.** `recordedAt`, lease heartbeats, and TTL boundaries come from a fixed test clock (`NOW_ISO`, `NOW_MS`) so ordering and staleness are deterministic. Record timestamps in goldens are fixed by the fixture; no test reads the wall clock for an assertion.
- **Reconcile uses an injected tracker read port.** `tests/fixtures/queue/reconcile/harness.ts` exports a recording port with programmable `deliveryState`, `not-found`, `provider.outage`, `provider.quota.exceeded`, and `provider.auth.rejected` outcomes, an exact call log, and an in-flight counter. The default suite never reaches GitHub. The composition binding to the declared credential reference is asserted structurally; a live read is an opt-in smoke and is excluded from `pnpm check` (GAP-T2).
- **Events use the real projection.** `tests/fixtures/events/event-harness.ts` (`createEventHarness`, `dataOf`) drives the real `createEventHarness` runtime over a temp store and a memory transport pair. The `remove` and `dependency-edge` cases observe the delivered projection, not a mock. The `tests/conformance/events/real-socket-subscribe.test.ts` pattern is reused only if a socket variant is needed; the default cases stay in-memory.
- **Closeout uses the delivered composition with injected provider/git/state.** `tests/fixtures/closeout/{cli,harness,github-client,temp-git}.ts` already provide a hermetic merged-request fixture, a temp git repository, and a provider double. `tests/fixtures/closeout/queue-removal.ts` adds the queue-removal port (enabled/disabled) and the skip variants. No case performs a real merge.
- **Golden data is committed and regenerated explicitly.** `tests/fixtures/queue/removal/golden/*` and `tests/fixtures/queue/reconcile/golden/*` are committed. They are regenerated only through the suite's documented update entry point, never by a blanket rewrite, and a golden diff is reviewed as a deliberate contract change.
- **Bulk fixtures are generated, not committed as literals.** The 105-entry reconcile fixture is produced by a fixture function with a deterministic ref sequence; the committed file carries the generator parameters and the expected counts, not 105 hand-written records.
- **Privacy fixtures are synthetic.** Seeded secret/prompt/diff shapes are generated by `tests/checks/privacy-support.ts` patterns, never copied from a real credential or ticket. `tests/checks/fixture-privacy.test.ts` keeps the fixture tree clean.

**Live smoke (opt-in only).** A live GitHub work-item read, if added, lives under `tests/conformance/live/` and follows the delivered `run-live.ts` entrypoint: it requires an explicitly provided credential reference and repository, refuses to run without them, and is never discovered by `bun test` or `pnpm check`. Its result is advisory and is not an acceptance gate for this change.

**Data cleanup.** Every temp root is removed in `finally`/`afterEach`; a failing case prints its temp path for diagnosis but does not leave it as a committed fixture. The aggregate gate runs the full suite twice in CI (normal and packed) and must leave the working tree clean.

## 7. Automation Plan and Implementation Mapping

Every case has an automated half in `bun:test`. `New` means a new suite under the declared layer; `Existing – Update` means the delivered suite gains cases or its pin moves. `TC-QLC-071` is semi-automated because its token and coverage assertions are automated while sentence-level page truth is review-attested. No case is manual-only.

| TC ID | Primary test file | Execution command | Status |
|---|---|---|---|
| TC-QLC-001 | `tests/behaviour/queue-remove.test.ts` | `bun test tests/behaviour/queue-remove.test.ts` | New |
| TC-QLC-002 | `tests/behaviour/queue-remove-refusals.test.ts` | `bun test tests/behaviour/queue-remove-refusals.test.ts` | New |
| TC-QLC-003 | `tests/behaviour/queue-remove-refusals.test.ts` | same | New |
| TC-QLC-004 | `tests/behaviour/queue-remove-refusals.test.ts` | same | New |
| TC-QLC-005 | `tests/behaviour/queue-remove-lease.test.ts` | `bun test tests/behaviour/queue-remove-lease.test.ts` | New |
| TC-QLC-006 | `tests/behaviour/queue-remove-park.test.ts` | `bun test tests/behaviour/queue-remove-park.test.ts` | New |
| TC-QLC-007 | `tests/behaviour/queue-remove-redeclare.test.ts` | `bun test tests/behaviour/queue-remove-redeclare.test.ts` | New |
| TC-QLC-008 | `tests/behaviour/queue-remove-nocascade.test.ts` | `bun test tests/behaviour/queue-remove-nocascade.test.ts` | New |
| TC-QLC-009 | `tests/behaviour/queue-remove-append-only.test.ts` | `bun test tests/behaviour/queue-remove-append-only.test.ts` | New |
| TC-QLC-010 | `tests/golden/queue-remove.test.ts` | `bun test tests/golden/queue-remove.test.ts` | New |
| TC-QLC-011 | `tests/behaviour/queue-remove-refusals.test.ts` | `bun test tests/behaviour/queue-remove-refusals.test.ts` | New |
| TC-QLC-020 | `tests/behaviour/closeout-queue-removal.test.ts` | `bun test tests/behaviour/closeout-queue-removal.test.ts` | New |
| TC-QLC-021 | `tests/behaviour/closeout-queue-removal-plan.test.ts` | `bun test tests/behaviour/closeout-queue-removal-plan.test.ts` | New |
| TC-QLC-022 | `tests/behaviour/closeout-queue-removal-skips.test.ts` | `bun test tests/behaviour/closeout-queue-removal-skips.test.ts` | New |
| TC-QLC-023 | `tests/behaviour/closeout-queue-removal-skips.test.ts` | same | New |
| TC-QLC-024 | `tests/behaviour/closeout-queue-removal-idempotency.test.ts` | `bun test tests/behaviour/closeout-queue-removal-idempotency.test.ts` | New |
| TC-QLC-025 | `tests/behaviour/closeout-queue-removal-block.test.ts` | `bun test tests/behaviour/closeout-queue-removal-block.test.ts` | New |
| TC-QLC-030 | `tests/behaviour/queue-dep-grammar.test.ts` | `bun test tests/behaviour/queue-dep-grammar.test.ts` | New |
| TC-QLC-031 | `tests/behaviour/queue-dep-remove.test.ts` | `bun test tests/behaviour/queue-dep-remove.test.ts` | New |
| TC-QLC-032 | `tests/behaviour/queue-dep-remove.test.ts` | same | New |
| TC-QLC-033 | `tests/behaviour/queue-dep-cycle.test.ts` | `bun test tests/behaviour/queue-dep-cycle.test.ts` | New |
| TC-QLC-034 | `tests/behaviour/queue-dep-grammar.test.ts` | same | New |
| TC-QLC-035 | `tests/behaviour/queue-dep-remove.test.ts` | same | New |
| TC-QLC-036 | `tests/behaviour/queue-dep-history.test.ts` | `bun test tests/behaviour/queue-dep-history.test.ts` | New |
| TC-QLC-040 | `tests/behaviour/dispatch-single-flight.test.ts` | `bun test tests/behaviour/dispatch-single-flight.test.ts` | New |
| TC-QLC-041 | `tests/behaviour/queue-claim-single-flight.test.ts` | `bun test tests/behaviour/queue-claim-single-flight.test.ts` | New |
| TC-QLC-042 | `tests/behaviour/daemon-single-flight.test.ts` | `bun test tests/behaviour/daemon-single-flight.test.ts` | New |
| TC-QLC-043 | `tests/behaviour/queue-lease-takeover.test.ts` | `bun test tests/behaviour/queue-lease-takeover.test.ts` | New |
| TC-QLC-044 | `tests/behaviour/queue-lease-renewal-narrowing.test.ts` | `bun test tests/behaviour/queue-lease-renewal-narrowing.test.ts` | New |
| TC-QLC-045 | `tests/behaviour/queue-single-flight-purity.test.ts` | `bun test tests/behaviour/queue-single-flight-purity.test.ts` | New |
| TC-QLC-050 | `tests/behaviour/queue-reconcile.test.ts` | `bun test tests/behaviour/queue-reconcile.test.ts` | New |
| TC-QLC-051 | `tests/behaviour/queue-reconcile.test.ts` | same | New |
| TC-QLC-052 | `tests/behaviour/queue-reconcile-retention.test.ts` | `bun test tests/behaviour/queue-reconcile-retention.test.ts` | New |
| TC-QLC-053 | `tests/behaviour/queue-reconcile-unreadable.test.ts` | `bun test tests/behaviour/queue-reconcile-unreadable.test.ts` | New |
| TC-QLC-054 | `tests/behaviour/queue-reconcile-scope.test.ts` | `bun test tests/behaviour/queue-reconcile-scope.test.ts` | New |
| TC-QLC-055 | `tests/behaviour/queue-reconcile-unobserved.test.ts` | `bun test tests/behaviour/queue-reconcile-unobserved.test.ts` | New |
| TC-QLC-056 | `tests/behaviour/queue-reconcile-bounds.test.ts` | `bun test tests/behaviour/queue-reconcile-bounds.test.ts` | New |
| TC-QLC-057 | `tests/behaviour/queue-reconcile-invariants.test.ts` | `bun test tests/behaviour/queue-reconcile-invariants.test.ts` | New |
| TC-QLC-058 | `tests/behaviour/queue-reconcile-payload.test.ts` + `tests/golden/queue-reconcile.test.ts` | `bun test tests/behaviour/queue-reconcile-payload.test.ts tests/golden/queue-reconcile.test.ts` | New |
| TC-QLC-060 | `tests/behaviour/events-remove.test.ts` | `bun test tests/behaviour/events-remove.test.ts` | New |
| TC-QLC-061 | `tests/behaviour/events-dependency-delta.test.ts` | `bun test tests/behaviour/events-dependency-delta.test.ts` | Existing – Update |
| TC-QLC-062 | `tests/structure/event-taxonomy-declaration.test.ts`, `tests/checks/event-taxonomy-conformance.test.ts`, `tests/behaviour/events-describe.test.ts` | `bun test tests/structure/event-taxonomy-declaration.test.ts tests/checks/event-taxonomy-conformance.test.ts tests/behaviour/events-describe.test.ts` | Existing – Update |
| TC-QLC-063 | `tests/structure/event-taxonomy-additive.test.ts`, `tests/structure/event-taxonomy-drift.test.ts` | `bun test tests/structure/event-taxonomy-additive.test.ts tests/structure/event-taxonomy-drift.test.ts` | Existing – Update |
| TC-QLC-064 | the four pin files named in §7.1 | `bun test tests/structure/event-taxonomy-declaration.test.ts tests/structure/event-taxonomy-additive.test.ts tests/checks/event-taxonomy-conformance.test.ts tests/behaviour/events-describe.test.ts` | Existing – Update |
| TC-QLC-065 | `tests/behaviour/events-remove.test.ts` | same as 060 | New |
| TC-QLC-066 | `tests/behaviour/events-emitted-kinds.test.ts`, `tests/behaviour/events-dependency-delta.test.ts` | `bun test tests/behaviour/events-emitted-kinds.test.ts tests/behaviour/events-dependency-delta.test.ts` | Existing – Update |
| TC-QLC-070 | `tests/behaviour/queue-help-lifecycle.test.ts`, `tests/behaviour/entrypoint-help.test.ts` | `bun test tests/behaviour/queue-help-lifecycle.test.ts tests/behaviour/entrypoint-help.test.ts` | New |
| TC-QLC-071 | `tests/checks/queue-reference-page.test.ts` (new), `tests/checks/help-guide-coverage.test.ts`, `tests/checks/reference-page-parity.test.ts`, `tests/behaviour/entrypoint-help-coverage.test.ts` | `bun test tests/checks/queue-reference-page.test.ts tests/checks/help-guide-coverage.test.ts tests/checks/reference-page-parity.test.ts tests/behaviour/entrypoint-help-coverage.test.ts` | Existing – Update |
| TC-QLC-072 | `tests/checks/m2-queue-page-reconciliation.test.ts` | `bun test tests/checks/m2-queue-page-reconciliation.test.ts` | New |
| TC-QLC-073 | `tests/structure/queue-scheduling-contract.test.ts`, `tests/structure/error-table.test.ts`, `tests/fixtures/queue/errors/references.json` | `bun test tests/structure/queue-scheduling-contract.test.ts tests/structure/error-table.test.ts` | Existing – Update |
| TC-QLC-074 | `tests/behaviour/queue-help-lifecycle.test.ts`, `tests/behaviour/queue-remove-refusals.test.ts` | `bun test tests/behaviour/queue-help-lifecycle.test.ts tests/behaviour/queue-remove-refusals.test.ts` | New |
| TC-QLC-075 | `tests/checks/error-table-sync.test.ts`, `tests/checks/exit-code-literals.test.ts` | `bun test tests/checks/error-table-sync.test.ts tests/checks/exit-code-literals.test.ts` | Existing – Update |
| TC-QLC-080 | `tests/behaviour/queue-remove-atomicity.test.ts` | `bun test tests/behaviour/queue-remove-atomicity.test.ts` | New |
| TC-QLC-081 | `tests/behaviour/queue-single-flight-read-cost.test.ts` | `bun test tests/behaviour/queue-single-flight-read-cost.test.ts` | New |
| TC-QLC-082 | `tests/behaviour/closeout-queue-removal-cost.test.ts` | `bun test tests/behaviour/closeout-queue-removal-cost.test.ts` | New |
| TC-QLC-083 | `tests/behaviour/queue-reconcile-read-cost.test.ts` | `bun test tests/behaviour/queue-reconcile-read-cost.test.ts` | New |
| TC-QLC-084 | `tests/checks/queue-lifecycle-privacy.test.ts` | `bun test tests/checks/queue-lifecycle-privacy.test.ts` | New |
| TC-QLC-085 | `tests/structure/queue-additivity.test.ts`, `tests/structure/event-additivity-inventory.test.ts`, `tests/boundaries/boundaries.test.ts` | `bun test tests/structure/queue-additivity.test.ts tests/structure/event-additivity-inventory.test.ts tests/boundaries` | Existing – Update |
| TC-QLC-086 | `tests/behaviour/queue-lifecycle-convergence.test.ts` | `bun test tests/behaviour/queue-lifecycle-convergence.test.ts` | New |

### 7.1 Deliberate pin migrations (two-sided, never relaxed)

The following pins fail after the behaviour lands. They are updated in the same delivery, as exact equalities. No pin is deleted, skipped, changed to `toContain`, reduced to a length check, or widened to a subset.

| Pin site | Old assertion | New assertion | Guarded by |
|---|---|---|---|
| `tests/structure/event-taxonomy-declaration.test.ts` | `expect(notEmitted).toEqual(["queue.graph/remove"])` | `expect(notEmitted).toEqual([])` and `remove.emitted === true` | TC-QLC-062, TC-QLC-064 |
| `tests/structure/event-taxonomy-additive.test.ts` | `expect(events.some(e => e.kind === "remove")).toBe(false)`; `expect(kind.emitted).toBe(kind.name !== "remove")` | A real removal's event **is** observed; `expect(kind.emitted).toBe(true)` for every declared kind; the emitted/declared set equality remains `toEqual` in both directions | TC-QLC-063, TC-QLC-064 |
| `tests/checks/event-taxonomy-conformance.test.ts` | `expect(remove).toEqual({ name: "remove", emitted: false, payloadFields: ["ref","reason","recordedAt"] })`; text contains `not emitted (declared; no v1 producer)` | `emitted: true`; the payload list is unchanged; the text reports it as emitted and the "not emitted" line is absent | TC-QLC-062, TC-QLC-064 |
| `tests/behaviour/events-describe.test.ts` | `expect(unemitted).toEqual(["remove"])`; the printed non-emitted list contains `remove` | `expect(unemitted).toEqual([])`; the printed non-emitted list is empty; `remove` renders as emitted with its field list | TC-QLC-062, TC-QLC-064 |
| `tests/fixtures/queue/errors/references.json` + `tests/structure/queue-scheduling-contract.test.ts` | `queueRows` has exactly the delivered five | `queueRows` deep-equals the delivered five **followed by** `queue.reason-missing` and `queue.single-flight`; the delivered five are byte-identical; `QUEUE_ERROR_CODES` equals the same array | TC-QLC-073 |
| `tests/fixtures/queue/state/kinds/record-kinds.json` + `tests/structure/queue-scheduling-contract.test.ts` | `QUEUE_RECORD_DECLARATIONS` has length 5 and the five kinds in order | Length 6 and the six kinds in declared order with `queue.removal` / `delivery.queue.removal.v1` / `queue.removals:` appended; the delivered five entries are byte-identical; `STATE_SCHEMA_VERSION` and the derived-document schema/name are unchanged | TC-QLC-073, TC-QLC-085 |
| `tests/golden/queue-{list,plan,ready,envelope}.test.ts` and `tests/fixtures/queue/golden/*` | Delivered golden outputs for a queue with no removals | The no-removal goldens are byte-identical; new removal cases get new golden files (no edit to the delivered ones) | TC-QLC-001, TC-QLC-009, TC-QLC-010 |

**Rule.** Each moved pin states the new truth as a complete value (`toEqual` on the array/object), so a future addition or removal fails. "Two-sided" means both the expected inventory and the actual tree are compared; an extra row and a missing row both fail, and the delivered rows are compared literally, not by count alone.

### 7.2 Gates and execution order

1. **Narrow structural/contract suites** while iterating: `bun test tests/structure/queue-scheduling-contract.test.ts tests/structure/queue-removal-contract.test.ts tests/structure/queue-additivity.test.ts tests/structure/event-taxonomy-declaration.test.ts tests/structure/event-taxonomy-additive.test.ts tests/structure/event-taxonomy-drift.test.ts tests/structure/error-table.test.ts`.
2. **Narrow behaviour suites** for the touched paths: the removal, closeout, dependency, single-flight, reconcile, events, and help suites named in §7.
3. **Guard and golden suites**: `bun test tests/checks/error-table-sync.test.ts tests/checks/event-taxonomy-conformance.test.ts tests/checks/help-guide-coverage.test.ts tests/checks/queue-reference-page.test.ts tests/checks/reference-page-parity.test.ts tests/checks/exit-code-literals.test.ts tests/checks/m2-queue-page-reconciliation.test.ts tests/checks/queue-lifecycle-privacy.test.ts` and `bun test tests/golden/queue-remove.test.ts tests/golden/queue-reconcile.test.ts`.
4. **Boundary suite**: `bun test tests/boundaries`.
5. **Aggregate**: `TMPDIR="$PWD/tmp/tmpdir" pnpm check`. This is the single completion gate (`lint → format:check → typecheck → test → check:boundaries`) and must pass with the working tree clean.
6. **Optional live smoke**: only with an explicit credentialed environment, never inside `pnpm check`; results are advisory and are not recorded as an acceptance pass.

**Golden policy.** Goldens are regenerated through the owning suite's documented update entry point, then reviewed as a contract diff. They are never regenerated by a blanket rewrite or a global `--update` across unrelated suites.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Risk | Mitigation |
|---|---|---|
| TR-1 | A removal test passes because the seed never produced an observed entry, so "absent after" is vacuous | Every removal case asserts the entry is present before the mutation and that the seed used the production writer; a missing seed fails the precondition. |
| TR-2 | An absence assertion (no append/no event/no session) passes because the recorder was not wired | The recorder is asserted non-zero on a positive control in the same case; a zero counter on a disconnected recorder fails the control. |
| TR-3 | The closeout harness masks a real step-outcome change | The with/without-hook comparison uses the delivered expected step list and the same facts; the control run is composed from the same factory, not a hand-built object. |
| TR-4 | The event projection tick makes exactly-once assertions time-dependent | The harness steps the projection manually with a fixed clock; there is no sleep or wall-clock wait. |
| TR-5 | Provider fixtures drift from the tracker's normalised aliases | The fixture carries the closed `deliveryState` set as data and `TC-QLC-052` asserts an unknown alias does not remove; `@doc-syncer` reconciles the feature page. |
| TR-6 | Over-pinning a delivery-bound field makes a valid implementation fail | Contract-pinned values are listed in each case; delivery-bound module/helper names are confined to the harness and §1.2 GAP-T6. |
| TR-7 | The 105-entry fixture is slow or order-dependent | Entries are generated deterministically in one temp store; the case asserts counts and reads, not wall-clock latency. |
| TR-8 | A pin is moved one-sided (old list replaced by a new list without a both-directions check) | §7.1 requires complete-value equality and an explicit extra/missing mutation in `TC-QLC-063` and `TC-QLC-085`. |

### 8.2 Assumptions

- **TA-1** Closeout can observe merge truth in the test composition exactly as it does in production (spec A-1); no case fabricates a merge outside the provider fixture.
- **TA-2** A queue entry's repository is resolvable from the per-repository state scope and, where present, the entry's `repository` field (spec A-3); the reconcile scope case uses one checkout per repository.
- **TA-3** The delivered projection can allocate a sequence for the removal family without a frame change (spec A-5); `TC-QLC-060` asserts the frame shape.
- **TA-4** The production daemon composition stays supervise-only (spec A-6); `TC-QLC-042` uses the injected claim port and does not assert a live spawn.
- **TA-5** The delivered state layer exposes an injected store port, a fence handle, and a recording wrapper sufficient for the counting/absence cases; the existing `tests/fixtures/state/harness.ts` is the seam.
- **TA-6** The delivered closeout composition accepts a queue-removal port (or an equivalent injected seam) so the with/without-hook comparison is possible without editing production code in the test.

### 8.3 Open Questions

| ID | Question | Blocking? | Owner | Disposition |
|---|---|---|---|---|
| OQ-T1 | NFR-10 states "a repeated reconcile over an already-reconciled ref removes nothing and exits 0", but no AC-F5-* criterion states it. Should AC-F5-9 be added, or is AC-F5-1 + NFR-10 sufficient? | No | `@spec-writer` / `@pm` | `TC-QLC-058` and `TC-QLC-086` prove the behaviour and map it to AC-F5-1; the gap is raised, not silently treated as covered. Recommendation: add a criterion at the next spec revision. |
| OQ-T2 | Is the `queue.precondition.unmet` removal refusal's holder evidence rendered in `error.detail` as an object or in the error text (the delivered lease-conflict shape uses a detail string)? | No (delivery-bound) | `@coder` / `@reviewer` | Assert the tokens (`lease-held`, holder) and the bound; do not pin the container beyond `detail.holder` where the spec declares it (DM-7). |
| OQ-T3 | Does the change add a live GitHub smoke for reconcile, or is the port-level proof sufficient for this milestone? | No | `@pm` / `@reviewer` | Default: port-level proof; a live smoke is opt-in and excluded from the aggregate. |
| OQ-T4 | If OQ-1/OQ-2 in the spec resolve toward "release-and-remove" or "refuse while a dependent exists", do `TC-QLC-005` and `TC-QLC-008` need to change? | Conditional | `@decision-advisor` / `@spec-writer` | The plan follows the recorded DEC-9/DEC-10 recommendations; a decision change reopens those two cases and this plan's revision log. |
| OQ-T5 | The spec's AC-F7-3 says `queue.single-flight` is `user-validation`, while spec §5.1 F-7's bullet says "transient". Which category is authoritative? | No | `@spec-writer` / `@pm` | `TC-QLC-073` pins the AC (`user-validation`, exit `1`, retryable `true`) and this question records the inconsistency; a spec correction reopens the pin. |

**AC that cannot be tested:** none. Every AC has at least one observable assertion. The nearest boundaries are GAP-T1 (daemon proven at the injected port, not a production spawn), GAP-T2 (tracker proven at the declared port, with an opt-in live smoke), GAP-T3 (repeated-reconcile convergence has no dedicated AC), and GAP-T4 (page prose is token-checked with review attestation). These are recorded as boundaries and traceability gaps, not skipped criteria.

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-11-12 | `@test-plan-writer` | Initial test plan for GH-292 / M2-S15. 45 acceptance criteria mapped to 59 automated cases across removal, automatic closeout removal, dependency edges, per-ref single-flight, reconciliation, event publication, mount/help/errors, and the six NFR criteria. Declares the four `remove`-unemitted pin migrations, the queue error-row pin (5 → 7), the record-kind pin (5 → 6), the hermetic fixture strategy, the opt-in live-smoke boundary, and the aggregate gate `TMPDIR="$PWD/tmp/tmpdir" pnpm check`. Raises `OQ-T1` (NFR-10's missing repeated-reconcile criterion) and `OQ-T5` (the `queue.single-flight` category wording conflict). |

## 10. Test Execution Log

No execution has been recorded at authoring time; this plan is phase-3 output. Results are recorded here per delivery run, with the exact command and the store/fixture shape.

| TC ID | Run Date | Result | Notes |
|---|---|---|---|
| — | — | Not run | Populated during delivery and the quality gate. |
