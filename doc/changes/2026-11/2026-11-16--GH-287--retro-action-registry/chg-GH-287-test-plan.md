---
id: chg-GH-287-test-plan
status: Updated
created: 2026-11-16T18:00:00Z
last_updated: 2026-11-16T22:15:00Z
owners: [engineering]
service: "delivery-os retro learning plane (retro action registry, follow-through enforcement, and board actions surface)"
labels: [change, m2, retro, board, learning-plane]
version_impact: minor
summary: "Traceable verification of M2-S10 retro action registry and follow-through: five-field filing with the verification artifact refused all-or-nothing with `retro.action-incomplete` naming the missing or contract-non-conforming field (SC-M2-S10-01 pinned, `actions[]` stays empty), the full action record (owner, closed verb vocabulary, measurable outcome, real tracker entry, due date, verification artifact, outcome verifier with a non-null delayed metric window, rollback condition), aging derived deterministically on the injected clock from the one pinned basis — time open since the recorded filing timestamp — with due dates feeding only the miss counter (nudge at 14 days, escalation at 30 days or a second missed due date, threshold-1 and threshold+1 rendering differently), explicit closure only — done with artifact closing the artifact plane, deprioritized with reason and superseded with successor closing both planes in the one decision — with the artifact-versus-outcome distinction (SC-M2-S10-02 pinned: `data.artifactClosure == \"closed\"`, `data.outcomeClosure == \"open\"` with a non-null verification window), `retro.closure-incomplete` for every incomplete attempt and for the already-closed-plane state conflict naming the plane and its existing closure, the fixed contract-data WIP limit of 3 enforced as a `retro.wip-limit-exceeded` filing refusal naming window/count/limit with no row landed, the additive board actions surface beside the owner asks following the delivered shared-source/bounded/counted-omission/byte-guard/deterministic patterns, artifact-verified follow-through as the asserted first phase of every R4+ retro and the retro report's follow-through fold gaining its producer with no new top-level report key, the three additive exact `retro` error rows in two-way sync (4->7, no family widening), and the NFR battery (byte-identical determinism with zero model calls, bounded output, aging exactness, offline hermeticity with no skip-as-pass, fenced-write discipline, read cost, privacy, error-table binding)."
links:
  change_spec: ./chg-GH-287-spec.md
  implementation_plan: ./chg-GH-287-plan.yaml   # phase 4; validated (tier full, 9 phases); TC mapping 39/39 single-homed (GAP-1 resolved)
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - M2-S10: Retro action registry and follow-through (M2)

## 1. Scope and Objectives

This change turns retro follow-through from a rendered list into enforced, recorded truth: an action registry that refuses vague filings, ages commitments deterministically, closes them only through explicit decisions that separate *the guard exists* from *the metric moved*, bounds each improvement window to three open actions, and surfaces the resulting obligations on the board beside the owner asks. The registry also becomes the producer the delivered ceremony runner and `retro report` were already reading.

Five properties are load-bearing and each is tested independently so weakening one cannot pass behind another.

**First, filing is all-or-nothing and the refusal is mechanical.** A filing missing any contract member — including the verification artifact, the measurable outcome, the outcome verifier window, or the rollback condition — lands nothing, exits 1, and names the missing field from `retro.action-incomplete` (AC-F1-1, the pinned SC-M2-S10-01). A field that is present but non-conforming to its contract *rule* (team-owned owner, unverifiable verb, placeholder tracker entry) is incomplete for filing purposes: the same refusal identity applies, names the offending field, and invents no fourth identity (AC-F1-2, DEC-8). `actions[]` is asserted empty after every refusal, not merely "unchanged by convention".

**Second, aging is derived and exact on one pinned basis.** Nudge at 14 days open since the recorded filing timestamp, escalation at 30 days open or on a second missed due date (two due-date lapse events; due dates feed only the miss counter), evaluated on the injected clock at the exact day boundary — 13 days renders `current`, 14 renders `nudged`, 29 renders `nudged`, 30 renders `escalated` — with zero ambient clock reads and no stored aging state (AC-F3-1, NFR-3, DEC-3, DEC-9). The aging basis is pinned to time open since filing and asserted from *one* declared constant so a fixture that mixes filing-date and due-date bases fails.

**Third, closure is explicit-only on two planes.** Every closure without an explicit decision or the route's justification is refused with `retro.closure-incomplete` and transitions nothing (AC-F4-1); a done-with-artifact closure records `artifactClosure == "closed"` and leaves `outcomeClosure == "open"` with a non-null verification window (AC-F4-2, the pinned SC-M2-S10-02); an elapsed window without an evidence-citing decision never closes the outcome plane (AC-F4-3, DEC-4). The deprioritized and superseded routes close both planes in the one explicit decision — the recorded reason or superseding action reference is each plane's justification, and the verification window is mooted by the decision, not by time (AC-F4-4, DEC-11) — while a closure decision targeting an already-closed plane is a state conflict: refused under the same identity, naming the plane and its existing closure, with no second closure record (AC-F4-5, DEC-11). The WIP limit is a refusal, never a warning: a fourth filing into a full window exits 1 with `retro.wip-limit-exceeded` naming window, count and limit, and the window's count/limit are disclosed wherever the window is reported (AC-F5-1, DEC-6).

**Fourth, the surfaces stay honest and additive.** The board's actions surface renders beside the asks with every row's identity, repository, owner, level, age and aging state, in deterministic order, under the delivered per-repository caps, counted omissions, and byte-guard drop order (AC-F6-1, NFR-2) — byte-identically on repeat renders (AC-F6-2). Every R4+ retro's *first* phase is artifact-verified follow-through over registry records, with verdicts assigned from artifact evidence and never from an owner claim (AC-F7-1); the same registry, contract, aging and closure discipline serve every level with no per-level fork (AC-F7-2). The registry becomes the producer behind the retro report's delivered `followThrough[]` fold without adding a top-level report key (DEC-10). Nothing delivered is removed or re-semanted.

**Fifth, the battery.** Determinism and purity, bounded output, fenced-write discipline, read cost, privacy, offline hermeticity (skips never count as a pass), error-table two-way sync, and a disabling-mutant meta-suite over every honesty rule above run as one cross-cutting battery, and the delivered suites whose pinned assertions legitimately change are declared up front in §4.4 rather than discovered mid-delivery.

This is a design and verification map, not an execution claim: no suite was run while authoring it.

### 1.1 In Scope

- Filing gate over the five-field contract plus the verification artifact: all-or-nothing, refusal names the missing or offending field, no action row created, `actions[]` unchanged (F-1, AC-F1-1, AC-F1-2, DM-1, SC-M2-S10-01, DEC-8).
- Owner rule (named agent role or human; team-owned and ownerless refused), closed verifiable-verb vocabulary (add, remove, change, test, deploy; "review"/"improve" refused), real tracker entry, due date (F-1, AC-F1-2, DEC-8).
- Full action record: five fields, verification artifact reference, retro level, improvement window, filing date from the injected clock, outcome verifier with a non-null delayed metric window, rollback condition (F-2, AC-F2-1, DM-1).
- Aging ladder derived at read/render time from the one pinned basis — time open since the recorded filing timestamp: 14-day nudge, 30-day escalation, second-missed-due-date escalation (two due-date lapse events, due dates feeding only the miss counter), exact boundary behaviour, no stored mutability, no scheduler (F-3, AC-F3-1, DM-2, NFR-3, DEC-3, DEC-9, NG-6).
- Explicit closure: three artifact-closure routes (done + artifact, deprioritized + reason, superseded + successor), `retro.closure-incomplete` refusals naming what is missing, no transition on refusal (F-4, AC-F4-1, DM-3).
- Artifact-closure versus outcome-closure separation; pinned `artifactClosure`/`outcomeClosure` states with the non-null verification window; the done route closing the artifact plane only; the deprioritized and superseded routes closing both planes in the one decision with the window mooted by the decision, not by time (F-4, AC-F4-2, AC-F4-3, AC-F4-4, DM-3, SC-M2-S10-02, DEC-4, DEC-11).
- Already-closed-plane state conflict: a closure decision targeting a closed plane refused exit 1 under `retro.closure-incomplete` naming the plane and its existing closure, with no second closure record (F-4, AC-F4-5, DM-3, DEC-11).
- Improvement WIP limit: fixed contract-data value 3, refusal at the limit with `retro.wip-limit-exceeded` naming window/count/limit, no row landed, deprioritize/supersede as the deliberate slot-freeing routes, count/limit disclosure (F-5, AC-F5-1, DM-5, DEC-6).
- Board actions surface beside the owner asks: per-row identity, repository, owner, level, age, aging state; deterministic order; per-repository caps with counted omissions; byte-guard participation; shared-source discipline; read-only posture (F-6, AC-F6-1, AC-F6-2, DM-4, NFR-2, RSK-4).
- Follow-through enforcement: registry as the producer behind the delivered ceremony runner's asserted follow-through-first phase (verdicts applied/partial/violated-with-consequence from artifact evidence) and behind `retro report`'s delivered `followThrough[]` fold (verified/unverified/unknown), across every retro level, with no new top-level report key (F-7, AC-F7-1, AC-F7-2, DEC-10, §8.5).
- Ceremony handoff → filing flow: declared actions hand off to filing; an unfiled handoff never passes as applied; a verified-empty registry is an explicit success (§19, RSK-3).
- Own validated state-store boundary with additive `retro.action` / `retro.action-closure` record kinds under `retro.actions:` / `retro.action-closures:` prefixes, delivered retro-registry boundary unchanged, doctor store verdict (DEC-7, DM-1, DM-3, §10).
- Three additive exact two-segment error rows under the delivered `retro` domain kind, machine/documented/classifier two-way sync, no family or pattern widening, delivered four rows unchanged (AC-N8-1, NFR-8, DEC-5).
- NFR battery: determinism and zero model calls (NFR-1); bounded output and bounded free text (NFR-2); aging exactness (NFR-3); offline hermeticity with no skip-as-pass (NFR-4); fenced-write discipline with zero background writes (NFR-5); read cost and one bounded registry read per invocation (NFR-6); privacy and redaction composition (NFR-7); error-table binding (NFR-8).
- Test evidence for the pinned scenarios SC-M2-S10-01 and SC-M2-S10-02 and every binding acceptance criterion, offline on committed fixtures and fixture-seeded temp stores.

### 1.2 Out of Scope & Known Gaps

- [OUT] Communication analytics — unanswered asks, ask aging, escalation rates (NG-1, DEC-1). No test asserts them; the exclusion is stated in the PR description instead.
- [OUT] The failure-to-regression-test compiler (NG-2, DEC-2). No test asserts it.
- [OUT] Changes to the retro evidence pipeline's collection grammar, collector sources, truth checks, sidecar, chain construction, or level-registry statuses (NG-3). Those suites are asserted *unchanged* (TC-ACTION-037), never extended.
- [OUT] Changes to ceremony declarations, agendas, note schema, or the asserted follow-through-first position (NG-4). The ceremony suite is asserted unchanged; the registry is a read/write counterpart.
- [OUT] Metrics, alarms, dashboards, closure-rate/time-to-close presentation (NG-5, M2-S6).
- [OUT] Schedulers, daemons, timers, background nudging, or any background write (NG-6, DEC-3, NFR-5). Tested only as absence of such a path.
- [OUT] Automatic or implied closure on any plane (NG-7), team-owned/ownerless actions (NG-8), backlog or import of historical actions (NG-9), cross-repository action aggregation beyond delivered board selection forms (NG-10), memory-promotion/lesson-lifecycle/decision-retro-loop changes (NG-11).
- [OUT] New event topics/kinds or MCP tools (§7.2). No test expects one.
- [OUT] Real tracker access at filing (NFR-4). Tracker corroboration is exercised through the delivered read integration's injected seam only, with the unreachable case asserted as disclosed state.
- [GAP-1 — RESOLVED: implementation-plan mapping — plan authored and validated] `chg-GH-287-plan.yaml` now exists and validates under the full tier (`verdict=valid`, `readyForDevelopment=true`, 9 declared phases). Its TC→PHASE MAP owns `TC-ACTION-001..039` 39/39 single-homed — Phase 1: 1, Phase 2: 8, Phase 3: 10, Phase 4: 1, Phase 5: 0, Phase 6: 5, Phase 7: 4, Phase 8: 9, Phase 9: 1 — with no TC id, behavior, oracle, fixture, identity, exit, bound, or AC/NFR mapping reshaped, and it declares the plan-level refinements named in GAP-4 and GAP-6 in its PLAN-LEVEL REFINEMENTS block. Closing OQ-T1. The reopen clause stands: any later plan that changes a pinned contract reopens this test plan.
- [GAP-2 — delivery-bound, non-blocking: registry fixture inventory] The committed fixtures carry retro evidence, board facts, ceremony notes, doctor state, and a state harness (`tests/fixtures/state/harness.ts`), but no action-registry fixture set. Delivery adds `tests/fixtures/action/` (action row builders, closure row builders, window/limit fixtures, aging clock plan, registry store seeder composing the artifact-boundary declaration) with one shape per file and provenance, plus the board fixture's actions inventory in `tests/fixtures/board/sections.ts`.
- [GAP-3 — delivery-bound, non-blocking: NFR-6 is runner-dependent] The 50 ms warm-median board budget depends on runner capacity. The CI oracle is **bounded work** (one bounded registry read per invocation, pure projection, no per-row re-reads, no network) plus a soft local budget in the `tests/behaviour/board-performance.test.ts` pattern; a reference measurement is recorded in §10 and never reported as a passing threshold.
- [GAP-4 — delivery-bound, non-blocking: exact command grammar and data keys] DEC-7 leaves the exact verb grammar as a plan-level refinement (`retro action file|close|list` is illustrative) and the spec pins only `data.artifactClosure`, `data.outcomeClosure`, `error.code` values, and the `actions[]` emptiness. Tests therefore assert through declared contract constants plus the pinned literals; the grammar and the list surface's data key for `actions[]` are pinned at delivery with the contract suite (TC-ACTION-036) and never re-derived in each test.
- [GAP-5 — RESOLVED: contract-rule refusal identity for AC-F1-2 — spec-pinned by DEC-8] The spec (v1.2) now pins that a field present but non-conforming to its contract rule — a team owner, an unverifiable verb, a placeholder tracker entry — is incomplete for filing purposes: the filing is refused with the one filing identity `retro.action-incomplete`, naming the offending field, and no fourth identity is introduced. This plan binds those refusals to that identity in matrix R-09..R-11 and asserts the offending field is named; nothing was invented and no spec change remains open. Closing OQ-T3.
- [GAP-6 — delivery-bound, non-blocking: render prose and section label] The exact human label and wording of the board actions surface (a fifth label beside `ASKS` or a sub-block under it) and the refusal/detail prose are not spec-pinned. Assertions use the declared contract constants and goldens; the surface's placement beside the asks and its additive nature are asserted regardless (see OQ-T4).

## 2. References

- **Change specification**: [chg-GH-287-spec.md](./chg-GH-287-spec.md) — v1.2; 15 ACs (AC-F1-1, AC-F1-2, AC-F2-1, AC-F3-1, AC-F4-1..5, AC-F5-1, AC-F6-1..2, AC-F7-1..2, AC-N8-1), F-1..F-7, DM-1..DM-5, NFR-1..NFR-8, DEC-1..DEC-11, RSK-1..RSK-7, NG-1..NG-11, §14 OQ-1..OQ-3 (resolved), Appendix B (pinned scenarios verbatim), Appendix C (concept constraints).
- **Ticket**: GH-287 — M2-S10: Retro action registry and follow-through (M2) (https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/287). Its six ACs decompose per spec §17: incomplete filing refused (AC-F1-1, AC-F1-2), R4+ opens artifact-verified (AC-F7-1), aging visible on the board (AC-F3-1, AC-F6-1), no closure without decision + artifact/reason (AC-F4-1), actions carry outcome verifier and rollback condition (AC-F2-1), artifact-versus-outcome closure distinguished (AC-F4-2, AC-F4-3, AC-F4-4).
- **PM record**: [chg-GH-287-pm-notes.yaml](./chg-GH-287-pm-notes.yaml) — DEC-5/DEC-6/DEC-7 adjudications and the plan-writer ripples (exact verb grammar, payload schema ids, error-row metadata, doctor verdict name, help-guide coverage + M2 reference page), DEC-1/DEC-2 scope exclusions, delivery conventions (`TMPDIR=$PWD/tmp/tmpdir pnpm check`, PR targets `main-tools`), and the host PATH/`pnpm -r build` transport fact. The reopened-specification pins DEC-8..DEC-11 are recorded in the spec's decision log and document history (v1.2).
- **Implementation plan**: [chg-GH-287-plan.yaml](./chg-GH-287-plan.yaml) — authored in `delivery_planning` and validated under the full tier (9 phases: contract/error rows, boundary+filing+WIP, aging+closure, boundary damage/doctor, CLI verb group, board actions surface, follow-through producers, honesty battery, docs/release). Its TC→PHASE MAP owns `TC-ACTION-001..039` 39/39 single-homed without reshaping any TC's behavior, oracle, identity, exit, bound, or AC/NFR mapping, and its PLAN-LEVEL REFINEMENTS block declares the GAP-4 grammar/data-key and GAP-6 surface-shape refinements (GAP-1 resolved, OQ-T1 closed).
- **Testing strategy**: [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) — layers, module→test mapping, `bun:test`, permanent-suite invariant rules, `pnpm check` aggregate gate, invariant-test authoring rules.
- **TypeScript rules**: [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md) — strict typing, purity, ports and adapters, the error contract, `bun:test` authoring.
- **Milestone pack (planning truth)**: [doc/planning/oss-tooling/milestones/m2/test-scenarios.md](../../../planning/oss-tooling/milestones/m2/test-scenarios.md) SC-M2-S10-01/02 (verbatim); [contracts.md](../../../planning/oss-tooling/milestones/m2/contracts.md) (telemetry.v1 advisory consumption at the story's declared edge); [README.md](../../../planning/oss-tooling/milestones/m2/README.md) (the S10 consumption row).
- **Concept authority**: `concepts/retrospectives.md` — five-field contract and verb vocabulary, aging ladder, explicit-closure rule, outcome verifier, rollback condition, artifact-versus-outcome closure, WIP range, board surface beside asks, follow-through-first agenda (quoted in spec Appendix C).
- **Current system truth — retro plane**: [feature-retro-pipeline.md](../../../spec/features/feature-retro-pipeline.md) — levels R1-R6, evidence sidecar, keyed chain, `delivery.retro.report.v1` with the four-key data shape and the `followThrough[]` fold (`verified`/`unverified`/`unknown`), the four `retro` error rows, "enforcement is later work".
- **Current system truth — ceremony runner**: [feature-ceremony-runner.md](../../../spec/features/feature-ceremony-runner.md) — `retro-evidence-pass` over the four sub-R1 levels, the asserted follow-through-first phase, the `applied`/`partial`/`violated-with-consequence` verdict vocabulary, the declared-actions handoff naming M2-S10 as the receiver.
- **Current system truth — board**: [feature-board.md](../../../spec/features/feature-board.md) — `delivery.board.v1` four sections (lanes, gates, asks, parked), `delivery.status-facts.v1` shared source, per-section caps, counted omissions (`truncated`, per-section counters), byte guard with a fixed drop order, repository-then-section ordering, one idempotent decision append, ask `age` in milliseconds.
- **Current system truth — contract, state, doctor, telemetry**: [feature-result-contract.md](../../../spec/features/feature-result-contract.md) (envelope, exit projection, redaction chokepoint, error table and its two-way sync), [feature-state-layer.md](../../../spec/features/feature-state-layer.md) (validated artifact boundaries, fenced appends, verified reads, `state.*` failures), `feature-doctor.md` (closed areas, store verdicts, evidence source ids), [feature-telemetry-v2.md](../../../spec/features/feature-telemetry-v2.md) (advisory spend evidence for outcome verifiers).
- **Contracts and seams consumed**: `packages/core/src/contracts/retro.ts` (`RETRO_LEVELS`, `RETRO_*_RECORD_KEY_PREFIX`, `RETRO_REGISTRY_DECLARATION`, `RETRO_REPORT_SCHEMA`, `RetroReportData`, `RetroFollowThroughEntry`), `packages/core/src/contracts/ceremony.ts` (`CEREMONY_FOLLOW_THROUGH_VERDICTS`, declared actions in the note schema), `packages/core/src/contracts/owner-gate-sla.ts` (`BOARD_SCHEMA_VERSION`, board vocabularies), `packages/core/src/contracts/status.ts` (`delivery.status-facts.v1` sections and labels), `packages/core/src/contracts/error-table.ts` (`ERROR_TABLE`, `DOMAIN_KINDS`), `packages/core/src/contracts/doctor.ts` (`DOCTOR_AREAS`, store facts), `packages/core/src/state/artifact-boundary.ts` (the reusable validated boundary factory), `packages/core/src/state/retro-registry.ts` (delivered sibling boundary and the "exactly three" declaration), `packages/cli/src/commands/retro.ts` (the delivered `collect|report` grammar).
- **Delivered evidence to extend (never replace)**: `tests/behaviour/action-*.test.ts` (new, this change); `tests/behaviour/{board-sections,board-asks,board-aging,board-bounds,board-byte-guard,board-determinism,board-never-silence,board-shared-source,board-write-discipline,board-performance,board-privacy,board-read-cost,board-repository-cap,board-command,board-help}.test.ts`; `tests/behaviour/retro-{report,report-determinism,levels,registry,privacy,hermetic,performance,output,telemetry-evidence}.test.ts`; `tests/behaviour/ceremony-flow-retro-levels.test.ts`, `ceremony-flow-retro.test.ts`; `tests/behaviour/doctor-{state,report,output,readonly-determinism}.test.ts`; `tests/structure/{board-contract,board-nonregression,board-mounting,retro-contract,retro-imports,error-table,content-inventory,cli-edge-seam,state-scope,doctor-contract}.test.ts`; `tests/checks/{error-table-sync,help-guide-coverage,help-guide-coverage-mutants,reference-page-parity,ceremony-hermetic,exit-code-literals,forbidden-literals,privacy-literals,doc-conformance,planning-truth}.test.ts`; `tests/golden/{board-full,board-grid,retro/cases.json,doctor-output}.test.ts`; fixtures `tests/fixtures/{state/harness.ts,board/harness.ts,board/sections.ts,board/matrix.ts,retro/harness.ts,ceremony/builtins.ts,ceremony/notes/,doctor/harness.ts,help-guide/coverage.json,result/code-corpora/*.json}` (ceremony note builders live in the `tests/fixtures/ceremony/notes/` directory; the runner writes notes to `.ai/memory/ceremony/<encoded scopeKey>.md`).
- **Closest delivered precedents**: [chg-GH-291-test-plan.md](../2026-11-12--GH-291--telemetry-v2/chg-GH-291-test-plan.md) (honesty battery, non-vacuity contract, mutant meta-suite, additive-row error discipline, drift/GAP declaration) and [chg-GH-297-test-plan.md](../2026-11-12--GH-297--board-surface/chg-GH-297-test-plan.md) (board shared source, bounds, byte guard, deterministic ordering, counted omissions — the patterns the actions surface extends).

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Criterion (abbreviated) | TC ID(s) | Status |
|-------|--------------------------|----------|--------|
| AC-F1-1 | **Pinned SC-M2-S10-01** — an action missing its measurable outcome is refused: exit 1, `error.code == "retro.action-incomplete"` naming `measurableOutcome`, `actions[]` stays empty, no row created | TC-ACTION-001, TC-ACTION-002, TC-ACTION-027, TC-ACTION-033 | Covered |
| AC-F1-2 | All five fields present but a contract rule violated (team owner, unverifiable verb "review"/"improve", placeholder tracker entry) → the one filing identity `retro.action-incomplete`, naming the offending field, no row created, no fourth identity (DEC-8) | TC-ACTION-003, TC-ACTION-005, TC-ACTION-035 | Covered |
| AC-F2-1 | A conforming filing records owner (agent role or human), closed-vocabulary verb, measurable outcome, real tracker entry, due date, verification artifact reference, outcome verifier with a non-null delayed metric window, and rollback condition | TC-ACTION-004 | Covered |
| AC-F3-1 | An open action past a threshold (14 days open since the recorded filing timestamp — the pinned basis, 30 days open, or a second missed due date: two due-date lapse events) carries the nudge/escalated state on evaluation and on the board; a day-before-threshold action renders the lower state (DEC-9) | TC-ACTION-006, TC-ACTION-007, TC-ACTION-008, TC-ACTION-017, TC-ACTION-033 | Covered |
| AC-F4-1 | A closure attempt without an explicit decision, or lacking the route's justification (artifact / reason / successor), is refused: exit 1, `error.code == "retro.closure-incomplete"` naming what is missing, no transition | TC-ACTION-009, TC-ACTION-012, TC-ACTION-033, TC-ACTION-035 | Covered |
| AC-F4-2 | **Pinned SC-M2-S10-02** — artifact complete + outcome window open → `artifactClosure == "closed"`, `outcomeClosure == "open"` with a non-null verification window | TC-ACTION-010, TC-ACTION-012 | Covered |
| AC-F4-3 | Artifact closure closed + elapsed verification window + no explicit evidence-citing outcome decision → `outcomeClosure` stays open (never from elapsed time or artifact closure alone) | TC-ACTION-011, TC-ACTION-013 | Covered |
| AC-F4-4 | Closing on the deprioritized or superseded route closes **both** `artifactClosure` and `outcomeClosure` in the one explicit decision — the recorded reason or the superseding action reference carried on the closure record is that plane's justification, the verification window is mooted by the decision and not by time, and elapsed time closes no plane on any route (DEC-11) | TC-ACTION-038, TC-ACTION-012 | Covered |
| AC-F4-5 | A closure decision targeting an already-closed plane is refused as a state conflict: exit 1, `error.code == "retro.closure-incomplete"` naming the plane and its existing closure decision — distinct in detail from the missing-justification refusal — and no second closure record is created (DEC-11) | TC-ACTION-039, TC-ACTION-035 | Covered |
| AC-F5-1 | A filing into a window at its declared WIP limit (3 open) is refused: exit 1, `error.code == "retro.wip-limit-exceeded"` naming window, open count and limit; no row created, excess never recorded | TC-ACTION-014, TC-ACTION-015, TC-ACTION-016, TC-ACTION-033 | Covered |
| AC-F6-1 | The board renders the actions surface beside the owner asks with each row's identity, repository, owner, level, age and aging state, in deterministic order with counted omissions under the delivered bounds | TC-ACTION-017, TC-ACTION-019, TC-ACTION-020, TC-ACTION-021, TC-ACTION-033 | Covered |
| AC-F6-2 | Two successive board invocations over unchanged stored actions render byte-identical machine data and human screen | TC-ACTION-018, TC-ACTION-027 | Covered |
| AC-F7-1 | A window/project (R4+) retro opens with artifact-verified follow-through over the registry's recorded actions; verdicts from verification-artifact evidence, never owner status claims | TC-ACTION-022, TC-ACTION-023, TC-ACTION-025, TC-ACTION-033 | Covered |
| AC-F7-2 | Actions filed from any level (closeout, session, incident, window, project) are served by the same registry, contract, aging and closure discipline with no per-level fork | TC-ACTION-023, TC-ACTION-024, TC-ACTION-037 | Covered |
| AC-N8-1 | The three new identities round-trip in the machine table, the documented table and the classifier in both directions, with no family or pattern widening | TC-ACTION-026, TC-ACTION-036 | Covered |

**Ticket-AC traceability (verbatim, binding).**

| Ticket AC | Covered by | How the plan proves it |
|---|---|---|
| "an action without all five fields cannot be filed" | TC-ACTION-001, TC-ACTION-002, TC-ACTION-003, TC-ACTION-005 | The filing matrix R-01..R-11: every member absent in turn, every contract rule violated in turn, each with a paired accepted control and a zero-row store assertion |
| "every R4+ retro opens with artifact-verified follow-through" | TC-ACTION-022, TC-ACTION-023, TC-ACTION-025 | Asserted first-phase position on the delivered declaration; verdict assignment driven by an artifact oracle where the owner claim contradicts the artifact; retro report fold fed by registry records; ceremony handoff → filing flow |
| "aging is visible on the board" | TC-ACTION-006, TC-ACTION-007, TC-ACTION-017 | Injected-clock boundary ladder plus the board row's age/aging-state assertion in the actions surface |
| "no action closes without an explicit decision and artifact or reason" | TC-ACTION-009, TC-ACTION-012, TC-ACTION-013, TC-ACTION-038, TC-ACTION-039 | Closure matrix C-01..C-14 asserting the refusal identity, the missing member, the both-plane effects of each route, the state-conflict refusal, and an unchanged store |
| "actions carry outcome verifiers and rollback conditions" | TC-ACTION-004 | Record-shape assertion of the non-null delayed metric window and the rollback condition at filing |
| "closure distinguishes artifact closure from outcome closure" | TC-ACTION-010, TC-ACTION-011, TC-ACTION-013, TC-ACTION-038 | The pinned two-plane states, the explicit-only outcome rule on the done route, the both-plane closure of the deprioritized/superseded routes, and the no-implicit-closure mutants |

**Capability coverage** (no capability unlinked): F-1 → TC-ACTION-001..005; F-2 → TC-ACTION-004; F-3 → TC-ACTION-006..008, 017; F-4 → TC-ACTION-009..013, 038, 039; F-5 → TC-ACTION-014..016; F-6 → TC-ACTION-017..021; F-7 → TC-ACTION-022..025, 037.

All 15 acceptance criteria map to at least one automated case and none carries a TODO. Both pinned milestone scenarios are dedicated cases with their verbatim assertions: SC-M2-S10-01 in TC-ACTION-001 and SC-M2-S10-02 in TC-ACTION-010; the two acceptance criteria added by the reopened specification (AC-F4-4, AC-F4-5) are dedicated cases in TC-ACTION-038 and TC-ACTION-039.

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

The specification declares no HTTP endpoint (§8.1: N/A) and adds no event topic or event kind (§8.2: registry mutations are validated records through the state layer, no message surface).

| Interface / data model | Description | TC ID(s) | Status |
|------------------------|-------------|----------|--------|
| CLI — filing surface (`action` verb group in the `retro` family, DEC-7) | Invocation-gated entry points over the registry; grammar-additive inside the delivered family, no new family | TC-ACTION-001..005, 014, 036 | Covered |
| CLI — closure surface | Explicit closure invocation carrying route, decision reference and justification; a repeat decision on a closed plane is a state-conflict refusal | TC-ACTION-009..013, 038, 039 | Covered |
| CLI — list/report surface exposing `actions[]` | The recorded actions array the pinned scenario asserts empty; per-row identity, owner, level, window, age, aging state, closure planes | TC-ACTION-001, 002, 016, 017 | Covered |
| DM-1 — Action record (`retro.action`) | Five fields, verification artifact, level, window, filing date, outcome verifier with delayed metric window, rollback condition | TC-ACTION-004, 034 | Covered |
| DM-2 — Aging state (derived) | `current` / `nudged` / `escalated` computed at read/render time from the recorded filing timestamp (the pinned basis), never stored as mutable state | TC-ACTION-006, 007, 008, 017 | Covered |
| DM-3 — Closure record (`retro.action-closure`) | Route, decision reference, required justification (reason or superseding action reference), `artifactClosure` and `outcomeClosure` planes with the non-null window while outcome closure is open; done closes the artifact plane, deprioritized/superseded close both planes in the one decision | TC-ACTION-010, 011, 012, 013, 034, 038, 039 | Covered |
| DM-4 — Actions board rows | Per-row identity, repository, action reference, owner, level, age, aging state under the payload's declared identity with counted omissions | TC-ACTION-017, 019, 021 | Covered |
| DM-5 — Window WIP disclosure | Declared limit (3), open count, disclosure wherever the window is reported | TC-ACTION-014, 015, 016 | Covered |
| Consumed — ceremony declared-actions handoff (§8.5, NG-4 unchanged) | The registry is the receiving counterpart; declarations, agendas and note schema unchanged | TC-ACTION-025, 037 | Covered |
| Produced — retro report `followThrough[]` fold | The registry becomes the production reader; entries carry action, verdict (`verified`/`unverified`/`unknown`), artifact reference and registry provenance; no new top-level report key (DEC-10) | TC-ACTION-023, 037 | Covered |
| Storage — own validated boundary (`retro.actions:`, `retro.action-closures:`) | Fenced appends, verified reads, `state.*` classification for damage, doctor store verdict | TC-ACTION-029, 034 | Covered |
| External — tracker read corroboration (§8.4) | Read-only corroboration of referenced entries; unreachable tracker keeps the entry as recorded data with its corroboration state disclosed | TC-ACTION-003, 034 | Covered |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR | Requirement (threshold) | TC ID(s) | Status |
|-----|--------------------------|----------|--------|
| NFR-1 | Byte-identical repeat renders for identical stored actions, injected clock and injected run id; zero model calls on any render or verification path | TC-ACTION-018, TC-ACTION-027 | Covered |
| NFR-2 | Machine `data` ≤ 65,536 UTF-8 bytes; per-repository row caps with counted omissions (`truncated` + per-section counters); byte-guard drop order participation; free-form text (measurable outcome, closure reason) bounded | TC-ACTION-019, TC-ACTION-028 | Covered |
| NFR-3 | Nudge at exactly 14 days open since the recorded filing timestamp, escalation at 30 days open or the second missed due date (two due-date lapse events), evaluated on the injected clock at the day boundary; threshold−1 and threshold+1 differ; zero ambient clock reads | TC-ACTION-006, TC-ACTION-007, TC-ACTION-008, TC-ACTION-027 | Covered |
| NFR-4 | 100% of new tests offline on committed fixtures and fixture-seeded stores; zero live tracker, network, credential, or harness-store access; no spawned processes; a skip never counts as a pass | TC-ACTION-032, TC-ACTION-025 | Covered |
| NFR-5 | Every mutation is an explicit invocation-gated fenced append; zero background writes; no update-in-place; no delete; zero writes on read/render paths | TC-ACTION-029, TC-ACTION-034 | Covered |
| NFR-6 | Board actions projection composes within the delivered board budget (50 ms warm median, I/O excluded), one bounded registry read per invocation, no per-row re-reads | TC-ACTION-030 | Covered by bounded work in CI plus a non-CI reference measurement (GAP-3) |
| NFR-7 | Records and renders carry references, identities, roles, dates and bounded text only — never prompt text, transcripts, diffs, tool output, or credentials; redaction chokepoint composes on every render path | TC-ACTION-031 | Covered |
| NFR-8 | New identities round-trip in machine and documented tables with the classifier; no family or pattern widening; the reserved exact-code allowlist grows only as binding rules require, in this change | TC-ACTION-026, TC-ACTION-036 | Covered |

### 3.4 Gap Check (coverage-matrix integrity)

- **Uncovered ACs**: none. All 15 are mapped; none carries a TODO.
- **Orphan TCs**: none. Every TC names at least one AC, DM, or NFR in §5.1 and §5.2.
- **Uncovered NFRs**: none. NFR-6's wall-clock half is reference-only (GAP-3); its CI-verifiable bounded-work half is asserted.
- **Uncovered DMs**: none (DM-1..DM-5 all mapped).
- **Gap status**: GAP-1 (plan mapping) is resolved — `chg-GH-287-plan.yaml` exists, validates under the full tier (9 phases), owns `TC-ACTION-001..039` 39/39 single-homed without reshaping any TC, and declares the GAP-4/GAP-6 refinements (OQ-T1 closed); GAP-5 (AC-F1-2 identity binding) is resolved — the spec pins it in DEC-8 and this plan binds matrix R-09..R-11 to it, so nothing is delivery-bound or open there; GAP-2 (fixture inventory), GAP-3 (NFR-6 measurement), GAP-4 (grammar/data keys) and GAP-6 (render prose and section label) are delivery-bound and non-blocking, each with a named oracle and owner. No AC or assertion carries a TODO.
- **Intentional duplicate coverage**: AC-F1-1 spans four TCs because the pinned single-field refusal, the exhaustive member matrix, the determinism/purity of the refusal path, and the mutant guard fail independently. AC-F3-1 spans five because the boundary arithmetic, the second-miss rule, the single-basis rule, the board rendering, and the mutant guard are separately falsifiable. AC-F4-4 spans two because the both-plane route effects and their recorded provenance are asserted once on the route matrix and once on a dedicated case with its own mutant. AC-F6-1 spans five because the surface's presence, its bounds, its shared source, its never-silence behaviour, and the mutant guard fail independently. AC-F7-1 spans four because the first-phase assertion, the fold producer, the handoff flow, and the mutant guard are distinct guarantees.
- **Spec traceability assertions that cannot be proven as written**: none remain. The two previously recorded slips are closed in spec v1.2: the stray `NFR-8` links were removed from AC-F1-1 and AC-F5-1 (their Linked columns now read F-1 and F-1/F-2/DEC-6), so OQ-T5 is closed and no requirement was added or dropped. `AC-F1-1`/`AC-F5-1` behaviors stay bound to F-1/F-2 (and DM-1/DM-5) here, and the error-table obligation to AC-N8-1 and TC-ACTION-026.
- **Spec-named behavior bound to an existing AC/NFR** (no dedicated AC by design):

| Behavior | Spec source | Bound AC/NFR | Where |
|---|---|---|---|
| Every refusal names the missing member or the offending field; none is generic | §10 | AC-F1-1, AC-F1-2, AC-F4-1, AC-F4-5, AC-F5-1 | TC-ACTION-001, 002, 003, 009, 014, 035, 039 |
| Aging states, window counts and WIP disclosures render in-band; a dropped/clamped row is always counted | §10 | AC-F3-1, AC-F5-1, AC-F6-1, NFR-2 | TC-ACTION-016, 019, 035 |
| Every invocation lands its delivered command-audit record; an audit-write failure is a diagnostic and never changes the outcome | §10 | AC-F6-1, NFR-5 | TC-ACTION-035 |
| Closure records carry decision reference and justification, so provenance is inspectable from records alone | §10 | AC-F4-1, AC-F4-4, DM-3 | TC-ACTION-012, 038 |
| Doctor gains an action-registry store verdict | §10, DEC-7 | NFR-5, DM-1/DM-3 | TC-ACTION-034 |
| An empty registry is a verified-empty success, never an error or fabricated content | §19 | AC-F7-1 | TC-ACTION-023, 025 |
| Unreachable tracker keeps the referenced entry as recorded data with corroboration state disclosed | §8.4 | AC-F1-2, AC-F7-1 | TC-ACTION-003, 034 |
| Artifact rot degrades to declared unverified/unknown verdicts, never fabricated, and aging continues | RSK-1 | AC-F7-1, AC-F3-1 | TC-ACTION-022, 023 |
| Delivered four board sections, caps and semantics unchanged; extension additive | §8.5 | AC-F6-1, AC-F7-2 | TC-ACTION-020, 037 |
| Planning-page maintenance (backlog M2-S10 markers, status snapshot, ownership lines) | §7.1, §16 | docs layer | §4 layer table (manual content check) |

## 4. Test Types and Layers

| Layer | Runner / invocation | Location | Covers |
|-------|--------------------|----------|--------|
| Contract and vocabulary | `bun test tests/structure` | `tests/structure/action-contract.test.ts` (new); `tests/structure/{retro-contract,board-contract,error-table,doctor-contract}.test.ts` (update) | TC-ACTION-004 (vocabulary half), TC-ACTION-026, TC-ACTION-036 |
| Boundary, purity and confinement | `bun test tests/structure tests/boundaries`; `bun run scripts/checks/{ambient-globals,exit-code-literals,forbidden-literals}.ts` | `tests/structure/action-imports.test.ts` (new); `tests/structure/{content-inventory,naming-boundary,state-scope,board-nonregression,cli-edge-seam,board-mounting}.test.ts` (update) | TC-ACTION-027 (static half), TC-ACTION-032 (static half), TC-ACTION-036 |
| Error identity and sync | `bun test tests/checks tests/structure`; `bun run scripts/checks/error-table-sync.ts` | `tests/checks/error-table-sync.test.ts`, `tests/structure/error-table.test.ts`, `tests/fixtures/result/code-corpora/*.json` (update) | TC-ACTION-026, TC-ACTION-036 |
| Behaviour — filing | `bun test tests/behaviour` | `tests/behaviour/action-filing.test.ts` (new) | TC-ACTION-001..005 |
| Behaviour — aging | `bun test tests/behaviour` | `tests/behaviour/action-aging.test.ts` (new) | TC-ACTION-006..008 |
| Behaviour — closure | `bun test tests/behaviour` | `tests/behaviour/action-closure.test.ts` (new) | TC-ACTION-009..013, 038, 039 |
| Behaviour — WIP limit | `bun test tests/behaviour` | `tests/behaviour/action-wip-limit.test.ts` (new) | TC-ACTION-014..016 |
| Behaviour — board surface | `bun test tests/behaviour` | `tests/behaviour/board-actions.test.ts` (new); `tests/behaviour/board-{sections,asks,aging,bounds,byte-guard,determinism,never-silence,shared-source,repository-cap,write-discipline,read-cost,performance,privacy}.test.ts` (update) | TC-ACTION-017..021 |
| Behaviour — follow-through | `bun test tests/behaviour` | `tests/behaviour/action-follow-through.test.ts`, `tests/behaviour/action-ceremony-handoff.test.ts` (new); `tests/behaviour/retro-report.test.ts`, `tests/behaviour/ceremony-flow-retro-levels.test.ts` (update) | TC-ACTION-022..025 |
| Behaviour — store boundary and doctor | `bun test tests/behaviour` | `tests/behaviour/action-store-boundary.test.ts` (new); `tests/behaviour/doctor-{state,report}.test.ts` (update) | TC-ACTION-034 |
| Behaviour — honesty battery | `bun test tests/behaviour` | `tests/behaviour/action-{determinism,bounds,write-discipline,read-cost,performance,privacy,disclosure,audit}.test.ts` (new) | TC-ACTION-027..031, 035 |
| Golden | `bun test tests/golden` | `tests/golden/board-full.test.ts`, `tests/golden/board-grid.test.ts`, `tests/golden/retro/cases.json` + its suite, `tests/golden/doctor-output.test.ts` (update) | TC-ACTION-010, 017, 019, 023, 034 |
| Mutant meta-suite | `bun test tests/checks` | `tests/checks/action-mutants.test.ts` (new; extends the `spend-mutants`/`ceremony-mutants` pattern) | TC-ACTION-033 |
| Hermeticity | `bun test tests/checks` | `tests/checks/action-hermetic.test.ts` (new; the `ceremony-hermetic`/`telemetry-hermetic` pattern) | TC-ACTION-032 |
| Documentation/help surface and planning pages | Manual + static content check (testing strategy layer 2) | `tests/checks/{help-guide-coverage,reference-page-parity,doc-conformance,planning-truth}.test.ts`; `tests/fixtures/help-guide/coverage.json`; the M2 retro-family reference page | TC-ACTION-036; §1.1 docs items |
| Aggregate and non-regression | `TMPDIR=$PWD/tmp/tmpdir pnpm check` (pm-notes delivery convention) | repo root; unchanged gates (`lint → format:check → typecheck → test → check:boundaries`) | TC-ACTION-037 and every TC's regression half |

### 4.1 Fixture and Harness Contract (binding for every action TC)

1. **No real state directory, tracker, network, credential, or spawned process.** Every suite imports the production modules and injects fakes plus a per-test temp root created through `tests/fixtures/state/harness.ts` (`makeTempRoot`, `openStore`, `makeIdentity`, `removeRoot`, `createTestEdge`) or the domain harnesses (`tests/fixtures/board/harness.ts` for board projections, `tests/fixtures/retro/harness.ts` for the retro fold, `tests/fixtures/doctor/harness.ts` for the store verdict). No suite reads `$HOME`, opens a socket, resolves a credential, or spawns a child process (NFR-4).
2. **A skip never counts as a pass.** No `test.skip`, `describe.skip`, `test.todo`, or conditional early return in a permanent suite; the hermetic scan (`tests/checks/action-hermetic.test.ts`) fails on a planted skip and on any skip in the new suites (TC-ACTION-032), mirroring `tests/checks/ceremony-hermetic.test.ts`.
3. **One temp registry per case, seeded through the production write seam.** Action and closure rows are appended through the artifact-boundary declaration the production writers use (or fixture builders composing it), so every read validates records the production writer could have produced. The registry store is never the live state directory; no case writes outside its `mkdtemp` root.
4. **Injected clock is the only time source, and the basis is the filing timestamp.** A fixed `NOW_MS` per case; aging cases advance the injected clock by explicit day offsets *since the recorded filing timestamp* (13/14/29/30/31 days, first/second miss) and never call `Date.now()`. The aging basis is time open since filing — one declared contract constant (DEC-9) — and due dates feed only the miss counter (two recorded due-date lapse events). Filing dates and due dates are literal fixture constants. The ambient-globals guard plus a runtime read-recorder prove zero ambient clock reads on the aging, list, board, and report paths (NFR-3).
5. **Injected ids, fence tokens, and brand.** Run ids and fence tokens are fixed sequences (`run-action-*`, `fence-action-*`); the brand is the synthetic brand constant from `tests/golden/helpers.ts`. Ordering fixtures use non-time-sortable action ids so a sortability assumption fails.
6. **Independent oracles.** Expected aging states, WIP counts, row ordering, omission counters, and byte lengths are computed in each test from hand-written fixture constants — never by calling the production classifier and never by re-summing the same array the production code sums. Verdict expectations come from an artifact oracle (`verifyArtifact(ref)`), so an owner claim that contradicts the artifact is a falsifiable fixture.
7. **Recorded arguments over inference.** Where an AC concerns what a seam receives (which registry source the board read, whether a write was attempted, whether a model call or a socket open was attempted), the test asserts the recorded argument or the recorded absence (the `VerifyCallRecorder`/`guardStore` pattern).
8. **Fixture privacy.** Every new fixture passes `tests/checks/fixture-privacy.test.ts`: synthetic owners, synthetic tracker/artifact references, no real tickets, credentials, or personal data. Fixtures live in `tests/fixtures/action/` with one shape per file and provenance, and the board fixture's actions inventory in `tests/fixtures/board/sections.ts` (GAP-2).

### 4.2 Non-Vacuity Contract (binding for every refusal, absence, bound and formula case)

1. **A planted positive is asserted before the refusal or absence.** Before asserting `retro.action-incomplete`, a paired conforming filing lands exactly one row; before asserting `actions[]` empty, the same fixture with the field present shows one row; before asserting truncation, an under-cap render is asserted untruncated.
2. **A paired control runs in the same test.** Every refused filing beside an accepted one; every refused closure beside an accepted one; every at-limit window beside an under-limit window; every escalated action beside a current one; every degraded registry read beside a healthy read.
3. **A disabling mutant must fail the suite (TC-ACTION-033).** Temp copies of the production modules (the `tests/golden/redaction.test.ts` import pattern) each disable one honesty rule. Each mutant must produce the prohibited observable on the unchanged fixture; a suite that passes with the mutant fails.
4. **Ordering and permutation invariance are asserted, not assumed.** The same action set seeded in shuffled order must produce identical list order, board order and omission counters; a fixture whose expected order depends on append order fails.
5. **Bounds are measured, never assumed.** Byte bounds are measured on serialized UTF-8 bytes with a positive measured length asserted first; row counts by counting rendered rows; free-text bounds by measuring the stored string, not by trusting the input length.
6. **No assertion depends on a moving base.** Every assertion reads the current tree, a committed fixture, or an isolated temp copy; no diff against `origin/main-tools` appears in the permanent suite (testing-strategy §Invariant-test authoring).

### 4.3 Oracles

**Filing refusal matrix** (binding for AC-F1-1, AC-F1-2, DEC-8). `code` is asserted equal to the closed identity; `field` is asserted present in the error detail/envelope. A field that is present but violates its contract rule is refused under the same identity as a missing field (DEC-8).

| ID | Fixture | `error.code` | Named field | Store effect |
|---|---|---|---|---|
| R-01 | action missing `measurableOutcome` (**SC-M2-S10-01 verbatim**) | `retro.action-incomplete` | `measurableOutcome` | exit 1; `actions[]` empty; zero rows |
| R-02 | missing owner | `retro.action-incomplete` | `owner` | exit 1; zero rows |
| R-03 | missing verifiable verb | `retro.action-incomplete` | `verb` | exit 1; zero rows |
| R-04 | missing tracker entry | `retro.action-incomplete` | tracker field | exit 1; zero rows |
| R-05 | missing due date | `retro.action-incomplete` | due-date field | exit 1; zero rows |
| R-06 | missing verification artifact | `retro.action-incomplete` | verification-artifact field | exit 1; zero rows |
| R-07 | missing outcome verifier / its delayed metric window | `retro.action-incomplete` | outcome-verifier field | exit 1; zero rows |
| R-08 | missing rollback condition | `retro.action-incomplete` | rollback field | exit 1; zero rows |
| R-09 | team-owned owner | `retro.action-incomplete` (spec-pinned, DEC-8; no fourth identity) | `owner` | exit 1; zero rows |
| R-10 | unverifiable verb `review` / `improve` | `retro.action-incomplete` (spec-pinned, DEC-8) | `verb` | exit 1; zero rows |
| R-11 | placeholder tracker entry | `retro.action-incomplete` (spec-pinned, DEC-8) | tracker field | exit 1; zero rows |
| R-12 | conforming action (control) | — | — | exit 0; exactly one row; `actions[]` length 1 |

Never: a partially-valid row landing, a generic refusal that does not name the field, a fabricated field default, or `actions[]` becoming non-empty after a refusal.

**Aging boundary matrix** (binding for AC-F3-1, NFR-3, DEC-3, DEC-9). `B` is the aging basis — the action's recorded filing timestamp, one declared contract constant, time open since filing (DEC-9). Days are counted from `B`; due dates feed only the second-miss counter and never the 14/30-day thresholds. Injected clock only.

| ID | Clock / recorded dates | Expected aging state | Never |
|---|---|---|---|
| A-01 | `B` (day 0 of time open) | `current` | Any pre-emptive nudge |
| A-02 | `B` + 13 days (threshold−1) | `current` | Off-by-one nudge |
| A-03 | `B` + 14 days (exact boundary) | `nudged` | `current` at the threshold |
| A-04 | `B` + 15 days (threshold+1) | `nudged` | Silent difference from A-03 |
| A-05 | `B` + 29 days | `nudged` | Premature escalation |
| A-06 | `B` + 30 days (exact boundary) | `escalated` | `nudged` at the threshold |
| A-07 | `B` + 31 days | `escalated` | Any state beyond the declared vocabulary |
| A-08 | first due-date lapse event, 5 days open since `B` | the days-based state only (`current`/`nudged`), never `escalated` | Escalating on a single miss |
| A-09 | second due-date lapse event, 5 days open since `B` | `escalated` regardless of elapsed days | Requiring 30 days as well |
| A-10 | clock advanced then rewound to an earlier instant | state follows the injected clock | A stored/monotonic aging value that cannot go back |
| A-11 | same stored action evaluated twice at the same clock | identical state, zero writes | Any write on the read path |

Basis purity: the basis is the recorded filing timestamp, and a fixture whose filing date and due dates would straddle the threshold differently must produce exactly one state, proving one basis is used (DEC-9; RSK-6). Moving a due date without adding a lapse event changes no days-based state, proving due dates feed only the miss counter. A mutant that mixes bases fails (TC-ACTION-033).

**Closure matrix** (binding for AC-F4-1, AC-F4-2, AC-F4-3, AC-F4-4, AC-F4-5, DEC-4, DEC-5, DEC-11).

| ID | Attempt | `error.code` / outcome | Named missing member | Store effect |
|---|---|---|---|---|
| C-01 | close with no explicit decision | `retro.closure-incomplete` | decision reference | exit 1; no closure record; planes unchanged |
| C-02 | `done` without an artifact | `retro.closure-incomplete` | artifact | exit 1; no transition |
| C-03 | `deprioritized` without a reason | `retro.closure-incomplete` | reason | exit 1; no transition |
| C-04 | `superseded` without a successor | `retro.closure-incomplete` | successor action reference | exit 1; no transition |
| C-05 | outcome closure with a decision that cites no verifier evidence | `retro.closure-incomplete` | evidence citation | exit 1; `outcomeClosure` stays `open` |
| C-06 | outcome closure citing evidence outside the declared window | `retro.closure-incomplete` | in-window evidence | exit 1; `outcomeClosure` stays `open` |
| C-07 | `done` with artifact (**SC-M2-S10-02 verbatim**) | exit 0 | — | `artifactClosure == "closed"`, `outcomeClosure == "open"`, non-null verification window |
| C-08 | `deprioritized` with reason | exit 0 | — | closure record carries route + decision + reason; **both** `artifactClosure == "closed"` and `outcomeClosure == "closed"` in the one decision, the reason serving as each plane's justification; the verification window is mooted by the decision, never by elapsed time (AC-F4-4, DEC-11) |
| C-09 | `superseded` with successor | exit 0 | — | closure record carries route + decision + the **superseding action reference**; both planes close in the one decision (AC-F4-4, DEC-11); the successor reference resolves to a recorded action |
| C-10 | `done` artifact closed, window elapsed, no outcome decision | exit 0 read | — | `outcomeClosure` remains `open` (AC-F4-3); the decision, not time, is the only closer |
| C-11 | explicit outcome decision citing in-window verifier evidence (done route) | exit 0 | — | `outcomeClosure == "closed"`; decision reference recorded |
| C-12 | paired control: a fully conforming action before any closure | read | — | both planes open; no closure record |
| C-13 | repeat closure targeting an already-closed **artifact** plane | `retro.closure-incomplete` | plane plus its existing closure decision (state conflict) | exit 1; no second closure record; planes unchanged (AC-F4-5, DEC-11) |
| C-14 | repeat outcome decision targeting an already-closed **outcome** plane | `retro.closure-incomplete` | plane plus its existing closure decision (state conflict) | exit 1; no second closure record; planes unchanged (AC-F4-5, DEC-11) |

Never: an implicit closure from elapsed time on any route, a closure landing on a refused attempt, a second closure record on an already-closed plane, a closure record without provenance, or `outcomeClosure` following `artifactClosure` as a side effect on the `done` route.

**Exit and identity oracle** (binding for GAP-4, AC-N8-1).

| Condition | Identity | Projection class | Exit | TC |
|---|---|---|---|---|
| Missing contract member at filing | `retro.action-incomplete` | user-validation | 1, zero rows | 001, 002 |
| Contract-rule violation at filing | `retro.action-incomplete` (spec-pinned, DEC-8; no fourth identity) | user-validation | 1, zero rows | 003, 005 |
| Filing into a window at its limit | `retro.wip-limit-exceeded` | user-validation | 1, zero rows | 014 |
| Closure without decision/justification, or outcome closure without in-window evidence | `retro.closure-incomplete` | user-validation | 1, no transition | 009, 013 |
| Closure decision on an already-closed plane (state conflict) | `retro.closure-incomplete` naming the plane and its existing closure | user-validation | 1, no second record | 039 |
| Torn / wrong-kind / malformed registry record | the delivered `state.*` rows | platform-provider | 2 | 034 |
| Permission violation on the registry store | `state.permission.denied` (delivered) | user-validation | 1 | 034 |
| Success (filing, closure, list, board, report) | — | success | 0 | all acceptance TCs |

**Invariants.** Exit is a pure function of the projection class. The delivered four `retro` identities keep their codes, category, consequence and projection unchanged; the three additive rows are exact two-segment codes under the same `retro` domain kind. One identity covers both the missing/offending-field discriminant and the already-closed-plane state conflict, distinguished by the detail they name (DEC-8, DEC-11). Machine consumers branch on the code and read the detail, never the exit alone.

### 4.4 Delivered-Suite Drift Register (declared, not discovered)

Each row is an assertion in a delivered suite that this change legitimately moves, or a delivered suite that gains additive assertions. The plan-writer declares these in `chg-GH-287-plan.yaml`; the coder updates them deliberately (goldens regenerated by explicit command, never blanket rewrite) and names them in the commit body. Rows marked **pin-change** must be justified against the spec section named.

| # | Delivered suite / fixture | Pinned assertion today | Why it moves | Disposition |
|---|---|---|---|---|
| D-1 | `tests/structure/error-table.test.ts` (TC-RETRO-004) | `retro` domain has `toHaveLength(4)` and codes equal `RETRO_ROWS` | 4 → 7 additive exact rows (DEC-5, AC-N8-1, NFR-8) | **pin-change**: 7; the delivered four literals stay byte-unchanged; add the three new literals |
| D-2 | `tests/structure/error-table.test.ts` domain-kind inventory | multi-row kind list and per-kind counts | `retro` becomes a 7-row kind; no new domain kind | **pin-change**: count only |
| D-3 | `tests/checks/error-table-sync.test.ts` + `tests/fixtures/result/code-corpora/{true,false}-positives.json` | doc/code two-way sync over the current corpus | three new codes must appear in the documented table, the machine table and the corpora | **fixture-add**: add three code entries; add an included/excluded pair proving no family widening |
| D-4 | `doc/spec/features/feature-result-contract.md` retro rows | exactly four `retro.` rows in the documented table | three additive rows (DEC-5) | **pin-change**: 7 rows; phase-7 reconciliation owns it, the sync check proves it |
| D-5 | `tests/structure/board-contract.test.ts` `DATA_KEYS` | exactly 15 payload keys | the actions surface adds a payload member (AC-F6-1) | **pin-change**: 16 (or more if the omission counters gain a named member); delivered keys unchanged |
| D-6 | `tests/behaviour/board-sections.test.ts` (TC-BOARD-001) | human label sequence `LANES, GATES, ASKS, PARKED` | the actions surface renders beside the asks (AC-F6-1, OQ-T4) | **pin-change**: the declared label joins the sequence at its declared position; the four delivered labels keep their order and semantics |
| D-7 | `tests/golden/board-full.test.ts`, `tests/golden/board-grid.test.ts` | board goldens | actions section and omission counters | **golden-regenerate** (explicit command): both goldens gain the actions rows for the fixture |
| D-8 | `tests/behaviour/board-{bounds,byte-guard,repository-cap,never-silence}.test.ts` | per-section caps, omission counters, byte-guard drop order | a new bounded section and a new drop-order step (AC-F6-1, NFR-2) | **additive assertions**: delivered section caps unchanged; new section cap and counters asserted |
| D-9 | `tests/behaviour/board-{determinism,purity,performance,read-cost,privacy,shared-source,write-discipline}.test.ts` | delivered board invariants | the new surface must obey the same invariants | **additive assertions**: no delivered assertion relaxed; one bounded registry read added to the read-count oracle |
| D-10 | `tests/structure/board-nonregression.test.ts` | additive-surface proof for the delivered board | the surface gained a member | **additive assertions**: prove the four delivered sections' caps/semantics/order unchanged and the payload identity kept |
| D-11 | `tests/behaviour/retro-report.test.ts` (TC-RETRO-035) | `Object.keys(report.data).sort()` equals exactly the four keys | the fold gains its producer | **unchanged — no move**: DEC-10 pins that `retro report`'s `data` gains no new top-level key; the registry feeds the delivered `followThrough[]` fold, so the exact-four-keys assertion stands. Provenance added inside fold entries is asserted additively in TC-ACTION-023; a registry-derived top-level key would be a spec violation, not a drift row (OQ-T7 closed) |
| D-12 | `tests/behaviour/retro-report.test.ts` (TC-RETRO-036) | injected-reader fold yields `verified`/`unverified` and never invents entries | the production reader becomes registry-backed | **additive assertions**: keep the injected-reader contract; add a registry-sourced case (verified + unverified + unknown + verified-empty) with no invented entry |
| D-13 | `tests/golden/retro/cases.json` + its suite | retro report golden cases | registry-backed follow-through cases | **golden-add**: new cases; existing cases stay valid |
| D-14 | `tests/behaviour/doctor-state.test.ts` ("the state detail names the delivery and retro registry stores") | store names in the state check's evidence | doctor gains an action-registry store verdict (DEC-7, §10) | **pin-change**: the detail names the action-registry store too |
| D-15 | `tests/behaviour/doctor-report.test.ts` (checks length / dropped-area mutation) and `tests/golden/doctor-output.test.ts` | area count, store facts, output golden | new store fact only (the area list is unchanged) | **pin-change if a store count/detail assertion moves; golden-regenerate** |
| D-16 | `tests/structure/doctor-contract.test.ts` | closed area list, evidence source ids, store fact shape | a store verdict may add an evidence source id | **pin-change only if an id is added**, otherwise unchanged |
| D-17 | `tests/structure/cli-edge-seam.test.ts` (TC-RETRO-006 and the human-text declaration list) | retro command's exported surface, grammar assertions, `positionals.max`, human renderer declaration | an `action` verb group joins the delivered `retro` family (DEC-7) | **pin-change**: grammar assertions and the positional bound; the exported symbol and the "no new command family" property stay asserted |
| D-18 | `tests/behaviour/retro-output.test.ts`, `retro-collect.test.ts` | unknown-subcommand refusal fixtures and `collect`/`report` grammar | subcommand guard widens to the `action` group | **additive assertions**: the `collect`/`report` behaviours are unchanged; a new unknown-subcommand control proves the guard stays closed |
| D-19 | `tests/fixtures/help-guide/coverage.json` + `tests/checks/help-guide-coverage.test.ts` | reference-page inventory and per-command coverage | the retro family's extended surface needs a reconciled reference page; §16 asks for a new M2 page root while the M1 snapshot stays byte-unchanged | **fixture-add**: add the M2 reference page row; the `retro` command row stays; every coverage assertion passes |
| D-20 | `tests/checks/help-guide-coverage-mutants.test.ts`, `tests/checks/reference-page-parity.test.ts` | coverage/parity mutation proofs | the new page must match its `--help` surface | **additive assertions**: planted-page mutation still fails; parity covers the new page |
| D-21 | `tests/structure/content-inventory.test.ts` + `tests/structure/inventory.json` | committed source inventory equals the actual file set | new modules and the new boundary declaration | **fixture-add**: register every new file; no allowlist widening |
| D-22 | `tests/structure/{retro-contract,retro-imports}.test.ts` | delivered retro-registry boundary "exactly three" record kinds; module boundary imports | the new boundary is a sibling; the delivered declaration is unchanged | **no delivered pin change**; additive import/inventory assertions for the new sibling boundary |
| D-23 | `tests/structure/state-scope.test.ts`, `tests/checks/packed-state.test.ts` | state scope/prefix declarations | `retro.actions:` / `retro.action-closures:` prefixes declare a new boundary | **fixture-add / additive assertions** |
| D-24 | `tests/checks/{exit-code-literals,forbidden-literals,privacy-literals,doc-conformance}.test.ts` | no exit literals outside the projection, forbidden literals, privacy literals, current-truth phrase table | new modules and docs; docs must stop describing enforcement as "later work" after this change | **additive**; the doc-conformance phrase table update is deliberate and phase-7-owned |
| D-25 | `tests/checks/planning-truth.test.ts`, `tests/checks/milestone-{artifacts,sweep}.test.ts` | backlog/status markers and ownership lines | §7.1 planning-page maintenance | **additive**: M2-S10 markers move; asserted invariants unchanged |
| D-26 | `tests/checks/ceremony-hermetic.test.ts` | skip/network/live-tree scan over ceremony suites | the scan's suite list gains the action suites (or a sibling `action-hermetic` owns them) | **additive**: no skip, no spawn, no socket, no `$HOME`, no live-tree write |
| D-27 | `tests/behaviour/board-command.test.ts`, `board-help.test.ts` | help/legend and command output | the actions surface appears in help/legend text | **pin-change**: help/legend golden-adjacent assertions |
| D-28 | `tests/fixtures/board/sections.ts`, `tests/fixtures/board/matrix.ts` | fixture row builders | actions rows must be seedable | **fixture-add**: an actions inventory beside asks/parked rows |

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Priority | AC Coverage |
|-------|-------|------|-------|----------|-------------|
| TC-ACTION-001 | **SC-M2-S10-01**: incomplete filing refused, field named, `actions[]` empty | Negative | Behaviour/Golden | Critical | AC-F1-1 |
| TC-ACTION-002 | Filing is all-or-nothing for every contract member | Corner Case | Behaviour | Critical | AC-F1-1 |
| TC-ACTION-003 | Contract-rule refusals: team owner, unverifiable verb, placeholder tracker | Negative | Behaviour | Critical | AC-F1-2, AC-F7-1 |
| TC-ACTION-004 | Conforming action record carries every member plus outcome verifier and rollback condition | Happy Path | Unit/Behaviour | Critical | AC-F2-1, DM-1 |
| TC-ACTION-005 | Closed verifiable-verb vocabulary is exact and refuses near-misses | Edge Case | Contract/Behaviour | High | AC-F1-2 |
| TC-ACTION-006 | Aging boundary ladder: 13/14/29/30 days open since the filing timestamp on the injected clock | Corner Case | Behaviour | Critical | AC-F3-1, NFR-3 |
| TC-ACTION-007 | Second missed due date escalates regardless of elapsed days | Edge Case | Behaviour | Critical | AC-F3-1, NFR-3 |
| TC-ACTION-008 | One aging basis, recorded dates only, zero ambient clock reads | Regression | Behaviour/Structure | Critical | AC-F3-1, NFR-3, DM-2 |
| TC-ACTION-009 | Closure refusals: no decision, missing artifact/reason/successor, incomplete outcome evidence | Negative | Behaviour | Critical | AC-F4-1 |
| TC-ACTION-010 | **SC-M2-S10-02**: artifact closed, outcome open, non-null verification window | Happy Path | Behaviour/Golden | Critical | AC-F4-2, DM-3 |
| TC-ACTION-011 | Outcome closure never follows elapsed time or artifact closure | Negative | Behaviour | Critical | AC-F4-3 |
| TC-ACTION-012 | Three explicit routes with recorded provenance and their declared plane effects | Happy Path | Behaviour | High | AC-F4-1, AC-F4-2, AC-F4-4, DM-3 |
| TC-ACTION-013 | Explicit outcome closure citing in-window verifier evidence | Happy Path | Behaviour | High | AC-F4-3, AC-F4-1 |
| TC-ACTION-014 | **WIP limit refusal**: window at 3 refuses a fourth filing, naming window/count/limit | Negative | Behaviour | Critical | AC-F5-1, DM-5 |
| TC-ACTION-015 | Deprioritize/supersede free a slot; count and limit disclosed | Edge Case | Behaviour | High | AC-F5-1, DM-5 |
| TC-ACTION-016 | WIP disclosure renders wherever the window is reported | Regression | Behaviour | High | AC-F5-1, DM-5 |
| TC-ACTION-017 | Board actions surface beside the asks with full rows and aging states | Happy Path | Behaviour/Golden | Critical | AC-F6-1, DM-4, AC-F3-1 |
| TC-ACTION-018 | Two successive board renders are byte-identical (machine and human) | Regression | Behaviour | Critical | AC-F6-2, NFR-1 |
| TC-ACTION-019 | Board bounds: per-repository cap, counted omissions, byte-guard participation | Corner Case | Behaviour | High | AC-F6-1, NFR-2 |
| TC-ACTION-020 | Actions surface reads one named source; no second state vocabulary; read-only | Regression | Behaviour/Structure | High | AC-F6-1 |
| TC-ACTION-021 | Empty and degraded registry are explicit, never silent | Negative | Behaviour | High | AC-F6-1, DM-4 |
| TC-ACTION-022 | R4+ retro opens with artifact-verified follow-through; artifact beats owner claim | Happy Path | Integration | Critical | AC-F7-1 |
| TC-ACTION-023 | Retro report fold gains its producer; verified/unverified/unknown; verified-empty | Happy Path | Integration | Critical | AC-F7-1, AC-F7-2 |
| TC-ACTION-024 | One registry serves every retro level with no per-level fork | Regression | Integration | High | AC-F7-2 |
| TC-ACTION-025 | Ceremony declared-actions handoff reaches filing; unfiled never passes as applied | Integration | Integration | Critical | AC-F7-1, RSK-3 |
| TC-ACTION-026 | Three new error rows round-trip; delivered four unchanged; no widening | Regression | Contract/Checks | Critical | AC-N8-1, NFR-8 |
| TC-ACTION-027 | Determinism and purity: byte-identical, zero model calls, no ambient clock/random | Regression | Behaviour/Structure | Critical | NFR-1, NFR-3 |
| TC-ACTION-028 | Bounded output: `data` ≤ 65,536 bytes; free text bounded; nothing silently clipped | Corner Case | Behaviour | High | NFR-2 |
| TC-ACTION-029 | Fenced-write discipline: invocation-gated appends, no update-in-place, no background write | Regression | Behaviour | Critical | NFR-5 |
| TC-ACTION-030 | Read cost: one bounded registry read, pure projection, within budget | Performance | Behaviour | Medium | NFR-6 |
| TC-ACTION-031 | Privacy: references and bounded text only; redaction composes on every new path | Regression | Behaviour/Checks | High | NFR-7 |
| TC-ACTION-032 | Offline hermetic posture; a skip never counts as a pass | Regression | Checks | Critical | NFR-4 |
| TC-ACTION-033 | Mutant meta-suite over every honesty rule | Regression | Checks (mutation) | Critical | AC-F1-1, AC-F3-1, AC-F4-1, AC-F4-4, AC-F4-5, AC-F5-1, AC-F6-1, AC-F7-1 |
| TC-ACTION-034 | Own validated boundary and doctor action-registry store verdict; damage classifies | Happy Path/Negative | Behaviour | High | NFR-5, DM-1, DM-3 |
| TC-ACTION-035 | Refusals named, disclosures in-band, command audit per invocation (audit failure diagnostic) | Regression | Behaviour | High | AC-F1-2, AC-F3-1, AC-F4-1, AC-F4-5, AC-F5-1 |
| TC-ACTION-036 | Conformance: contract constants, brand neutrality, additive command surface, help/reference inventory | Regression | Structure/Checks | High | AC-F7-2, AC-N8-1, AC-F4-2 |
| TC-ACTION-037 | Delivered retro, ceremony, board and error-table behavior unchanged (additive proof) | Regression | Behaviour/Structure | Critical | AC-F7-2, AC-F6-1, AC-N8-1 |
| TC-ACTION-038 | Deprioritized/superseded close both planes in the one decision; the window is mooted by the decision, not time | Happy Path | Behaviour | Critical | AC-F4-4, DM-3 |
| TC-ACTION-039 | Repeat closure on an already-closed plane refused as a state conflict naming plane and existing closure | Negative | Behaviour | Critical | AC-F4-5, DM-3 |

### 5.2 Scenario Details

#### TC-ACTION-001 - SC-M2-S10-01: incomplete filing refused, field named, `actions[]` empty

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, DM-1, NFR-8
**Test Type(s)**: Contract, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: filing surface + registry state boundary; `tests/behaviour/action-filing.test.ts` (matrix R-01)
**Tags**: @offline, @action-registry, @refusal

**Preconditions**:

- A temp state root with the action-registry boundary declared; a fixed injected clock, run id, fence token and synthetic brand.
- Fixture action missing `measurableOutcome`; every other member valid (owner, verb, tracker entry, due date, verification artifact, outcome verifier, rollback condition).

**Steps**:

1. Invoke the filing surface with the incomplete action (`--json`).
2. Assert `exitCode == 1`, `error.code == "retro.action-incomplete"`, and that the error detail names `measurableOutcome` (exact pinned token).
3. Read the registry store and the list surface; assert zero action records and `data.actions` equal to `[]`.
4. Run the paired conforming control (same fixture with `measurableOutcome` present); assert exit 0 and exactly one row, and `data.actions` length 1.

**Expected Outcome**:

- The pinned scenario holds verbatim: exit 1, `retro.action-incomplete` naming `measurableOutcome`, `actions[]` stays empty. The paired control proves the assertion is not vacuous.

**Postconditions**:

- Temp store discarded; no writes outside the temp root; no live state directory touched.

**Notes / Clarifications**:

- The exact list-surface data key is a plan-level refinement (GAP-4); the emptiness obligation is bound to the declared contract constant and to `data.actions` once declared.

#### TC-ACTION-002 - Filing is all-or-nothing for every contract member

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-2, AC-F1-1, DM-1
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: filing validation; `tests/behaviour/action-filing.test.ts` (matrix R-02..R-08, R-12)
**Tags**: @offline, @action-registry, @refusal

**Preconditions**:

- One fixture per absent member (owner, verb, tracker entry, due date, verification artifact, outcome verifier window, rollback condition), each otherwise conforming; a paired fully conforming control.

**Steps**:

1. File each single-omission fixture; assert exit 1, `retro.action-incomplete`, and the named field equals the omitted member.
2. After each refusal, assert the store row count is the control's count (zero before the control, one after), proving no partial row landed.
3. Assert the error detail never describes a partially valid row (no field values echoed beyond the named member).
4. File the control; assert one complete row.

**Expected Outcome**:

- Every member is enforced independently; refusals land nothing, and the recorded `actions[]` is unchanged in every case.

#### TC-ACTION-003 - Contract-rule refusals: team owner, unverifiable verb, placeholder tracker

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-2, AC-F7-1, DEC-8, §8.4
**Test Type(s)**: Behaviour, Integration
**Automation Level**: Automated
**Target Layer / Location**: filing validation; `tests/behaviour/action-filing.test.ts` (matrix R-09..R-11)
**Tags**: @offline, @action-registry, @refusal

**Preconditions**:

- Fixtures: team-owned owner (`ownerKind: "team"` or equivalent), unverifiable verbs `review` and `improve`, and a placeholder tracker entry (synthetic non-existent id / obviously placeholder literal). A conforming control with a human owner and an agent-role owner, and with a tracker entry the injected tracker read corroborates as real.

**Steps**:

1. File each violating fixture; assert exit 1, `error.code == "retro.action-incomplete"` (spec-pinned by DEC-8: a field present but non-conforming to its contract rule is incomplete for filing purposes), and that the error detail names the offending field.
2. Assert no action row is created in each case, and that no identity other than the declared three is ever produced.
3. File two conforming controls — one human owner, one agent-role owner — and assert both land.
4. Configure the injected tracker read to report the entry unreachable; assert the conforming filing still lands and the record discloses the corroboration state rather than trusting or fabricating reachability.

**Expected Outcome**:

- Team-owned actions are invalid, the verb vocabulary is enforced, placeholder tracker entries are refused, and each refusal names the offending field under the single filing identity. No fourth error identity is introduced (DEC-8). An unreachable tracker is disclosed state, not an invented verdict.

#### TC-ACTION-004 - Conforming action record carries every member plus outcome verifier and rollback condition

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-1, DM-1, DEC-7
**Test Type(s)**: Unit, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: action record contract + store round-trip; `tests/behaviour/action-filing.test.ts`; `tests/structure/action-contract.test.ts`
**Tags**: @offline, @action-registry, @record

**Preconditions**:

- A conforming fixture with literal values for owner, verb, measurable outcome, tracker entry, due date, verification artifact, outcome-verifier window and rollback condition; fixed injected clock and ids.

**Steps**:

1. File the action; assert exit 0.
2. Read the stored `retro.action` record through the verified read.
3. Assert every member is present with its literal fixture value, including the retro level, improvement window and the filing date equal to the injected clock (not wall time).
4. Assert the outcome-verifier window is non-null (start/end or duration as declared) and the rollback condition is non-empty.
5. Assert the record passes the boundary's own validation on read-back (schema id, identity field, closed vocabularies).

**Expected Outcome**:

- The stored record is exactly the five fields plus artifact reference, level, window, injected-clock filing date, non-null outcome-verifier window and rollback condition. No member is absent, null or defaulted.

**Notes / Clarifications**:

- Field names are plan-level refinements (GAP-4); assertions use the declared contract constants and the record schema, never ad-hoc literals.

#### TC-ACTION-005 - Closed verifiable-verb vocabulary is exact and refuses near-misses

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1, AC-F1-2, DEC-8
**Test Type(s)**: Contract, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: contract vocabulary + filing validation; `tests/structure/action-contract.test.ts`; `tests/behaviour/action-filing.test.ts`
**Tags**: @offline, @action-registry, @vocabulary

**Preconditions**:

- The declared verb constant; fixtures carrying each of add/remove/change/test/deploy, plus near-misses (a case variant, a whitespace variant, an inflected form) and the two named forbidden verbs.

**Steps**:

1. Assert the declared vocabulary equals exactly the five verbs in declared order (contract suite).
2. File each of the five; assert exit 0 and the verb round-trips byte-identically (no normalization).
3. File each near-miss and each forbidden verb; assert exit 1 with `error.code == "retro.action-incomplete"` naming the verb field (DEC-8), no row.
4. Assert the vocabulary has a single declaration site (structural scan), so a second copy cannot drift.

**Expected Outcome**:

- Only the five declared verbs are accepted; near-misses and "review"/"improve" are refused; one home for the vocabulary.

#### TC-ACTION-006 - Aging boundary ladder: 13/14/29/30 days open since the filing timestamp on the injected clock

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1, DM-2, NFR-3, DEC-3, DEC-9
**Test Type(s)**: Behaviour, Unit
**Automation Level**: Automated
**Target Layer / Location**: aging projection; `tests/behaviour/action-aging.test.ts` (matrix A-01..A-07, A-11)
**Tags**: @offline, @action-registry, @aging

**Preconditions**:

- One stored open action with a literal recorded filing timestamp (`B`) and literal due dates; the declared nudge and escalation constants read from the contract, not hardcoded.

**Steps**:

1. Evaluate at `B` + 0, 13, 14, 15, 29, 30 and 31 days of time open since the filing timestamp by advancing only the injected clock.
2. Assert `current` at 0 and 13, `nudged` at 14 and 15 and 29, `escalated` at 30 and 31.
3. Assert threshold−1 and threshold value differ at both thresholds (the spec's exactness obligation), and assert a due date moved without a recorded lapse event changes no days-based state.
4. Evaluate twice at the same clock instant; assert identical output and zero writes.

**Expected Outcome**:

- The ladder is exact at both boundaries on the one pinned basis (time open since the recorded filing timestamp, DEC-9), monotone across the offsets, and derived without any write or ambient time read.

#### TC-ACTION-007 - Second missed due date escalates regardless of elapsed days

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1, DM-2, NFR-3, DEC-9
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: aging projection; `tests/behaviour/action-aging.test.ts` (matrix A-08, A-09)
**Tags**: @offline, @action-registry, @aging

**Preconditions**:

- An action whose record carries two due-date lapse events (a due date missed once, rescheduled, then missed a second time), all within 5 days open since the filing timestamp; a paired single-lapse action at the same elapsed days.

**Steps**:

1. Evaluate the single-lapse action at 5 days open; assert it is not escalated (state follows days open only).
2. Evaluate the two-lapse action at the same 5 days open; assert `escalated`.
3. Assert the escalation reason names the second miss (closed vocabulary from the declared constant) and that only the lapse counter — not the due date value itself — drove it.
4. Vary the days open (0, 5, 40) on the two-lapse action; assert escalation holds in all three.

**Expected Outcome**:

- The second missed due date is an independent escalation trigger; one lapse is not, and due dates feed only the miss counter (DEC-9).

#### TC-ACTION-008 - One aging basis, recorded dates only, zero ambient clock reads

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1, DM-2, NFR-3, DEC-9, RSK-6, §21
**Test Type(s)**: Behaviour, Contract
**Automation Level**: Automated
**Target Layer / Location**: aging projection + purity guard; `tests/behaviour/action-aging.test.ts`; `tests/structure/action-imports.test.ts`
**Tags**: @offline, @action-registry, @purity

**Preconditions**:

- The declared aging-basis constant; a fixture whose recorded filing timestamp and due dates would produce different states under a due-date basis; an ambient-clock read recorder.

**Steps**:

1. Assert the declared aging basis is the action's recorded filing timestamp — the one basis constant pinned by DEC-9 — and construct the straddling fixture; assert exactly one declared state, proving a single basis.
2. Assert the basis constant has one declaration home (structural scan) and is imported, not duplicated.
3. Assert due dates feed only the miss counter: vary a due date without adding a lapse event and assert no days-based state change; add a second lapse event and assert escalation (DEC-9).
4. Record ambient clock reads across aging, list and board paths; assert the recorded count is zero.
5. Assert the aging output is a pure function of the recorded filing timestamp + lapse counter + injected clock + constants (same inputs twice → identical output).

**Expected Outcome**:

- Aging arithmetic is deterministic, single-basis on time open since filing, and free of ambient time; due dates only move the miss counter. A mutant that mixes bases or reads the wall clock fails (TC-ACTION-033).

#### TC-ACTION-009 - Closure refusals: no decision, missing artifact/reason/successor, incomplete outcome evidence

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, DM-3, DEC-5
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: closure surface + store; `tests/behaviour/action-closure.test.ts` (matrix C-01..C-06)
**Tags**: @offline, @action-registry, @closure

**Preconditions**:

- A stored open action; one closure attempt fixture per missing element: no decision reference; `done` without artifact; `deprioritized` without reason; `superseded` without successor; outcome closure with a decision citing no verifier evidence; outcome closure citing evidence outside the declared window.

**Steps**:

1. Attempt each closure; assert exit 1 and `error.code == "retro.closure-incomplete"` naming the missing member.
2. After each attempt, read the action and assert both closure planes are unchanged and no `retro.action-closure` record exists.
3. Assert the paired conforming closures (C-07..C-09) exit 0, proving the refusal is not a blanket refusal.

**Expected Outcome**:

- Every incomplete closure is refused with the named missing member and transitions nothing; the paired controls land.

#### TC-ACTION-010 - SC-M2-S10-02: artifact closed, outcome open, non-null verification window

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-2, DM-3, DEC-4
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: closure record + read surface; `tests/behaviour/action-closure.test.ts`; `tests/golden/retro/cases.json`
**Tags**: @offline, @action-registry, @closure, @golden

**Preconditions**:

- A stored open action with a complete verification artifact and an open (non-elapsed) outcome window.

**Steps**:

1. Close on the `done` route with the artifact and an explicit decision reference; assert exit 0.
2. Assert the read/closure payload exposes `data.artifactClosure == "closed"` and `data.outcomeClosure == "open"` (pinned literals).
3. Assert the verification window is non-null and equals the filed window (not recomputed, not widened).
4. Assert a `retro.action-closure` record exists carrying the route, decision reference and artifact.

**Expected Outcome**:

- The pinned scenario holds verbatim: artifact plane closed, outcome plane open with its non-null window. Nothing about elapsed time changes the outcome plane.

#### TC-ACTION-011 - Outcome closure never follows elapsed time or artifact closure

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-3, DM-3, DEC-4, NG-7
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: outcome-plane projection; `tests/behaviour/action-closure.test.ts` (matrix C-10, C-12)
**Tags**: @offline, @action-registry, @closure

**Preconditions**:

- A `done`-route artifact-closed action whose verification window elapses under the injected clock (the only route where the outcome plane stays open, DEC-11); a paired action with no artifact closure.

**Steps**:

1. Advance the injected clock past the verification window.
2. Assert `outcomeClosure` remains `open` and no closure record appears.
3. Assert the read discloses the window as elapsed without converting it to a verdict.
4. Assert artifact closure alone (C-10) never mutates the outcome plane.

**Expected Outcome**:

- Elapsed time produces disclosure, never closure; the implicit-closure mutant fails (TC-ACTION-033).

#### TC-ACTION-012 - Three explicit routes with recorded provenance and their declared plane effects

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-4, AC-F4-1, AC-F4-2, AC-F4-4, DM-3, DEC-11, §10
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: closure routes; `tests/behaviour/action-closure.test.ts` (matrix C-07..C-09)
**Tags**: @offline, @action-registry, @closure

**Preconditions**:

- Three stored open actions and three closure fixtures: done + artifact, deprioritized + reason, superseded + successor.

**Steps**:

1. Close each; assert exit 0 and one `retro.action-closure` record each.
2. Assert each record carries route, decision reference and its required justification; the superseded route records the **superseding action reference** on the closure record and that reference resolves to a recorded action (DEC-11).
3. Assert the declared plane effects: the `done` route closes the artifact plane only, leaving `outcomeClosure == "open"` with its non-null window; the `deprioritized` and `superseded` routes close **both** planes in that same decision, the reason or the superseding reference serving as each plane's justification, with the window mooted by the decision and not by elapsed time (AC-F4-4, DEC-11).
4. Assert provenance is inspectable from the records alone (no reliance on the current CLI output).

**Expected Outcome**:

- All three routes are explicit, justified and self-describing; nothing closes without provenance, and each route's plane effects match DEC-11 — `done` closes the artifact plane only, while `deprioritized` and `superseded` close both planes in the one decision.

#### TC-ACTION-013 - Explicit outcome closure citing in-window verifier evidence

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-4, AC-F4-3, AC-F4-1, DM-3, DEC-4
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: outcome closure; `tests/behaviour/action-closure.test.ts` (matrix C-11)
**Tags**: @offline, @action-registry, @closure

**Preconditions**:

- A `done`-route action with its artifact plane closed and a non-elapsed outcome window (the only route that leaves the outcome plane open, DEC-11); verifier evidence fixtures inside and outside the window.

**Steps**:

1. Close the outcome plane with an explicit decision citing in-window evidence; assert exit 0, `outcomeClosure == "closed"`, and the decision reference recorded.
2. Attempt the same with out-of-window evidence; assert `retro.closure-incomplete` and no transition (C-06).
3. Assert the evidence citation is stored (reference only, no free-form transcript) and readable.

**Expected Outcome**:

- Outcome closure happens only through an evidence-citing decision inside the declared window.

#### TC-ACTION-014 - WIP limit refusal names window, count and limit

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1, DM-5, DEC-6
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: filing validation + window projection; `tests/behaviour/action-wip-limit.test.ts`
**Tags**: @offline, @action-registry, @wip

**Preconditions**:

- A window seeded with exactly three open actions; a fourth conforming filing fixture; the declared limit constant (3) read from the contract.

**Steps**:

1. File the fourth action; assert exit 1 and `error.code == "retro.wip-limit-exceeded"`.
2. Assert the error names the window, the open count (3) and the limit (3, the declared constant).
3. Assert the store still holds exactly three rows and `actions[]` length 3 — the excess is never recorded.
4. Run the paired control: a window with two open actions accepts the third (exit 0, count 3).

**Expected Outcome**:

- The limit is a refusal, not a warning; the message carries the three required facts; no row lands.

#### TC-ACTION-015 - Deprioritize/supersede free a slot; count and limit disclosed

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, AC-F5-1, AC-F4-4, DM-5, DEC-6, DEC-11, RSK-2
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: window projection; `tests/behaviour/action-wip-limit.test.ts`
**Tags**: @offline, @action-registry, @wip

**Preconditions**:

- A full window (3 open) from TC-ACTION-014.

**Steps**:

1. Deprioritize one action with a reason; assert the action closes on both planes (AC-F4-4, DEC-11), the window's open count becomes 2, and a new filing is accepted (exit 0).
2. Separately, supersede one action with a declared successor; assert the action closes on both planes with the superseding reference recorded, the count is recomputed per the declared open-action rule, and a filing is accepted.
3. Assert the disclosure names the count and the limit constant in both states (full and freed).

**Expected Outcome**:

- Deliberate routes free slots; counts are derived from the records, never from a stored counter that could drift.

#### TC-ACTION-016 - WIP disclosure renders wherever the window is reported

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, AC-F5-1, DM-5, §10
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: list/report/board disclosures; `tests/behaviour/action-wip-limit.test.ts`
**Tags**: @offline, @action-registry, @disclosure

**Preconditions**:

- Two windows: one full, one with one open action.

**Steps**:

1. Render the list surface for both; assert each window's count and the declared limit appear.
2. Render the board actions surface for both; assert the same two facts appear per window.
3. Assert a window with zero open actions still discloses count 0 and the limit (non-silence).

**Expected Outcome**:

- The disclosure is in-band on every surface that reports a window; no surface omits the limit.

#### TC-ACTION-017 - Board actions surface beside the asks with full rows and aging states

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-1, AC-F3-1, DM-4, NFR-2
**Test Type(s)**: Behaviour, Integration
**Automation Level**: Automated
**Target Layer / Location**: board projection + render; `tests/behaviour/board-actions.test.ts`; `tests/golden/board-full.test.ts`
**Tags**: @offline, @board, @action-registry

**Preconditions**:

- The board harness with an injected registry source seeded with actions spanning `current`, `nudged` and `escalated` states at a fixed clock, across two repositories; the delivered four sections also populated.

**Steps**:

1. Render the board (`--json` and human); assert exit 0 and the delivered payload identity unchanged.
2. Assert the actions surface is present beside the asks and each row carries identity, repository, action reference, owner, level, age and aging state.
3. Assert ordering is deterministic repository-then-section-then-declared-row order.
4. Assert the delivered four sections still render with their labels and rows.

**Expected Outcome**:

- The actions surface is additive and complete; every row names its owner; aging states match the injected clock; nothing delivered is displaced.

#### TC-ACTION-018 - Two successive board renders are byte-identical

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-2, NFR-1
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: board determinism; `tests/behaviour/board-determinism.test.ts` (update)
**Tags**: @offline, @board, @determinism

**Preconditions**:

- A cap-sized fixture with actions, asks, lanes, gates and parked rows; injected clock, run id and brand; the same stored records for both invocations.

**Steps**:

1. Render twice in one process with identical injected inputs; assert the two machine payloads are byte-identical.
2. Assert the two human screens are byte-identical.
3. Assert zero model calls and zero network attempts on both renders (recorded).
4. Shuffle the seeding order and re-render; assert the same bytes, proving order derives from the declared sort, not append order.

**Expected Outcome**:

- Byte-identical repeat renders across machine and human; determinism does not depend on insertion order.

#### TC-ACTION-019 - Board bounds: cap, counted omissions, byte-guard participation

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-6, AC-F6-1, NFR-2, DM-4
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: board bounds + byte guard; `tests/behaviour/board-bounds.test.ts`, `tests/behaviour/board-byte-guard.test.ts`, `tests/behaviour/board-repository-cap.test.ts` (update)
**Tags**: @offline, @board, @bounds

**Preconditions**:

- A repository with more actions than its per-repository cap; a total board payload deliberately above the byte budget; an under-cap control.

**Steps**:

1. Render the under-cap control; assert `truncated` is false and counters are zero (positive control first).
2. Render the over-cap fixture; assert `truncated` is true, published rows equal the cap, and the per-section omission counter names the exact dropped count for the actions section.
3. Push the payload over the byte budget; assert the declared drop order removes the declared last item and every dropped row is counted.
4. Assert the four delivered sections' counters behave as before.

**Expected Outcome**:

- Bounds are measured and every omission is counted; the actions surface participates in the declared drop order and never drops silently.

#### TC-ACTION-020 - Actions surface reads one named source; no second state vocabulary; read-only

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-6, AC-F6-1, RSK-4, §8.5
**Test Type(s)**: Behaviour, Contract
**Automation Level**: Automated
**Target Layer / Location**: board source seam; `tests/behaviour/board-shared-source.test.ts` (update); `tests/structure/board-nonregression.test.ts` (update)
**Tags**: @offline, @board, @structure

**Preconditions**:

- The board harness with a recorded source reader; the delivered payload identity literal.

**Steps**:

1. Render; assert the actions rows come from the declared named source (recorded argument), not from a second ad-hoc read or a re-derived vocabulary.
2. Assert the aging/level/state vocabulary tokens reuse the declared constants (structural scan finds one home per token).
3. Assert the board performs no write on render (`board-write-discipline` pattern) and only the one delivered idempotent decision append remains possible.
4. Assert the payload identity and the four delivered section semantics are unchanged.

**Expected Outcome**:

- One source, one vocabulary, read-only render; a second state vocabulary fails the structural scan.

#### TC-ACTION-021 - Empty and degraded registry are explicit, never silent

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-6, AC-F6-1, DM-4, §10, §19, RSK-3
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: board never-silence; `tests/behaviour/board-never-silence.test.ts` (update)
**Tags**: @offline, @board, @degradation

**Preconditions**:

- An empty registry; a registry whose store read fails (torn / permission); a healthy control with one action.

**Steps**:

1. Render with an empty registry; assert the actions surface still renders its label with zero rows and explicit zero counters — never omitted.
2. Render with a failed registry read; assert the board discloses the classified source state (the delivered unavailable/unknown vocabulary) and exit 0, with no fabricated rows and no silent section.
3. Assert the healthy control renders its row, proving the disclosure path is not the only path.

**Expected Outcome**:

- Absence and degradation are explicit; the surface never disappears and never invents content.

#### TC-ACTION-022 - R4+ retro opens with artifact-verified follow-through; artifact beats owner claim

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-1, RSK-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: ceremony `retro-evidence-pass` + registry follow-through; `tests/behaviour/action-follow-through.test.ts`; `tests/behaviour/ceremony-flow-retro-levels.test.ts` (update)
**Tags**: @offline, @ceremony, @action-registry

**Preconditions**:

- The delivered builtin declaration for `retro-evidence-pass`; registry records for a window level; an artifact oracle that resolves some references and rejects others; an owner claim that contradicts a failed artifact.

**Steps**:

1. Assert the declared agenda's first phase remains the follow-through phase (the delivered asserted position, unchanged).
2. Run the retro over the registry; assert each open action is inspected against its artifact, not against the owner's claim.
3. Assert verdicts: resolvable artifact → `applied`; partially resolvable → `partial`; failed artifact with the owner claiming success → `violated-with-consequence`.
4. Assert every verdict names its artifact reference and that no verdict is assigned without one (unverifiable degrades, never fabricates).

**Expected Outcome**:

- Artifact evidence governs; an owner claim that contradicts the artifact cannot yield `applied`. Artifact rot degrades to a declared verdict (RSK-1).

#### TC-ACTION-023 - Retro report fold gains its producer

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-1, AC-F7-2, DEC-10, §8.5, §19
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `retro report` fold; `tests/behaviour/retro-report.test.ts` (update)
**Tags**: @offline, @retro, @action-registry

**Preconditions**:

- A fixture-seeded registry with one verified-artifact action, one unverifiable action, one unknown-artifact action; the delivered injected-reader seam preserved; an empty-registry case.

**Steps**:

1. Keep the injected-reader fold assertions green (delivered contract preserved).
2. Add the registry-sourced case: assert entries carry `{action, verdict, artifactRef}` plus their registry provenance (DEC-10), with `verified`/`unverified`/`unknown` assigned from the artifact oracle.
3. Assert no entry is invented for an action that has no record.
4. Run the empty-registry case; assert an empty `followThrough` with evidence refs and exit 0 (verified-empty is a success, never an error).
5. Assert `data` carries exactly its four shipped top-level keys — the registry producer adds no new top-level key (DEC-10, D-11 unchanged) — and that registry-derived provenance appears only inside the delivered `followThrough[]` entries.

**Expected Outcome**:

- The fold has a real producer, entries are evidence-derived and carry registry provenance inside the delivered fold, the report's four top-level keys are unchanged, and the empty case is an explicit success.

#### TC-ACTION-024 - One registry serves every retro level with no per-level fork

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-7, AC-F7-2, F-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: registry level coverage; `tests/behaviour/action-cross-level.test.ts`
**Tags**: @offline, @action-registry, @levels

**Preconditions**:

- Filing fixtures for each served level: change (R1 closeout), session, incident, window, project; one shared temp store.

**Steps**:

1. File one conforming action per level; assert all land in the same boundary under the same record kind and key prefix.
2. For each level, run the same aging evaluation and one closure route; assert identical semantics (no per-level branch).
3. Assert a refusal (incomplete, WIP, closure) produces the same identity regardless of level.
4. Assert the declared level vocabulary is the only level home (structural scan) and R6 stays declared-but-unscheduled.

**Expected Outcome**:

- One contract, one aging, one closure discipline; level is recorded data, never a behavior fork.

#### TC-ACTION-025 - Ceremony declared-actions handoff reaches filing; unfiled never passes as applied

**Scenario Type**: Integration
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-1, RSK-3, NG-4
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: ceremony note handoff → filing surface; `tests/behaviour/action-ceremony-handoff.test.ts`; `tests/fixtures/ceremony/builtins.ts`
**Tags**: @offline, @ceremony, @action-registry

**Preconditions**:

- A ceremony note carrying declared actions in the delivered handoff shape (the delivered `openActions` fixture seam with `verificationArtifact`); an empty registry.

**Steps**:

1. Run the ceremony; assert the handoff section lists the declared actions and that the ceremony itself writes no registry record (delivered posture unchanged).
2. File one declared action through the filing surface; assert it lands with its level and window.
3. Run the follow-through over the registry; assert the unfiled declared action is not counted as `applied` or as recorded, while the filed one is.
4. Assert the empty registry before filing yields a verified-empty follow-through, never a fabricated one.

**Expected Outcome**:

- The handoff is the declaration of record and filing is the accountability step; an unfiled action cannot masquerade as follow-through.

#### TC-ACTION-026 - Three new error rows round-trip; delivered four unchanged

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-N8-1, NFR-8, DEC-5
**Test Type(s)**: Contract, Checks
**Automation Level**: Automated
**Target Layer / Location**: error table, documented table, classifier; `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts` (update)
**Tags**: @offline, @error-table, @structure

**Preconditions**:

- The machine table; the documented table in `doc/spec/features/feature-result-contract.md`; the classifier; the reserved exact-code allowlist; the corpora.

**Steps**:

1. Assert the `retro` domain holds exactly seven rows: the delivered four byte-unchanged plus the three additive exact two-segment codes.
2. Assert each new row has a complete metadata set (domain kind, category, retryable, consequence, remediation hint, projection class, summary) and the declared projection class.
3. Classify each new code through the domain classifier and through thrown-error classification; assert the same row comes back (both directions).
4. Run the two-way sync check: machine ⇄ documented table, both directions, with no family/pattern widening and the allowlist grown only by the three exact codes.
5. Assert removing a documented row or adding a doc-only row fails the sync check (mutation control already in the suite).

**Expected Outcome**:

- 4 → 7 rows, exact and bidirectional; no new domain kind; no widening.

#### TC-ACTION-027 - Determinism and purity: byte-identical, zero model calls, no ambient clock/random

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-1, NFR-3, AC-F1-1, AC-F6-2
**Test Type(s)**: Behaviour, Contract
**Automation Level**: Automated
**Target Layer / Location**: all render/validation paths; `tests/behaviour/action-determinism.test.ts`; `tests/structure/action-imports.test.ts`
**Tags**: @offline, @determinism, @purity

**Preconditions**:

- Cap-sized fixtures for list, board and report; injected clock, run id, brand and ids; recorders for model calls, ambient globals, socket opens and spawn attempts.

**Steps**:

1. Render each surface twice; assert byte-identical output.
2. Assert the model-call recorder is empty on every path.
3. Assert the ambient-globals guard reports nothing for the new modules and the runtime recorder sees zero `Date.now`/`Math.random`/environment reads on the deterministic paths.
4. Assert refusal paths are deterministic too: the same incomplete filing twice yields the identical error envelope (no timestamps or ids that vary).

**Expected Outcome**:

- Every new path is pure and repeatable; zero model calls anywhere.

#### TC-ACTION-028 - Bounded output and bounded free text

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: NFR-2
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: enumeration payload + record fields; `tests/behaviour/action-bounds.test.ts`
**Tags**: @offline, @action-registry, @bounds

**Preconditions**:

- A fixture with a maximum-length measurable outcome and a maximum-length closure reason; an over-long pair; a cap-sized list; a small control.

**Steps**:

1. Measure the serialized UTF-8 byte length of the small control first (positive measured length asserted).
2. Render the cap-sized list; assert `data` ≤ 65,536 bytes and that any truncation is marked (`truncated`) with counted omissions.
3. Attempt filing with an over-long measurable outcome and an over-long closure reason; assert a classified refusal naming the field's bound (never silent clipping).
4. Assert stored free text equals the input when within bounds (no normalization, no truncation).

**Expected Outcome**:

- Bounds are measured and enforced at the boundary; nothing is silently clipped and every omission is counted.

#### TC-ACTION-029 - Fenced-write discipline

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-5, §21, DEC-7
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: state-boundary writes; `tests/behaviour/action-write-discipline.test.ts`
**Tags**: @offline, @state, @write-discipline

**Preconditions**:

- A guarded store recorder; a reader-only surface set (list, board, report).

**Steps**:

1. File, close and supersede each once; assert exactly one fenced append per explicit invocation with the injected fence token.
2. Assert list/board/report produce zero appends and zero mutations.
3. Assert no update-in-place and no delete path exists (structural scan plus recorded argument absence).
4. Assert a torn/failed append surfaces its `state.*` classification and leaves the store consistent (no partial record).

**Expected Outcome**:

- Writes are explicit, fenced and counted; reads never write; lifecycle transitions are appended, never mutated.

#### TC-ACTION-030 - Read cost: one bounded registry read, pure projection

**Scenario Type**: Performance
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: NFR-6
**Test Type(s)**: Performance, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: board projection; `tests/behaviour/action-read-cost.test.ts`, `tests/behaviour/board-performance.test.ts` (update)
**Tags**: @offline, @performance, @board

**Preconditions**:

- A cap-sized board with a full actions surface; a recorded reader; the delivered board budget.

**Steps**:

1. Render the board once with the reader recorder attached; assert exactly one bounded registry read for the invocation and no per-row re-read.
2. Record a warm-median duration over repeated in-process renders (I/O excluded) and compare against the declared budget (GAP-3: bounded-work oracle is the CI gate; the duration is a reference measurement).
3. Assert the read is bounded (one read of the declared prefix range, not a scan across families).

**Expected Outcome**:

- One bounded read per invocation and a pure projection; no per-row amplification.

#### TC-ACTION-031 - Privacy and redaction composition

**Scenario Type**: Regression
**Impact Level**: High
**Priority**: High
**Related IDs**: NFR-7, §20
**Test Type(s)**: Behaviour, Checks
**Automation Level**: Automated
**Target Layer / Location**: records and renders; `tests/behaviour/action-privacy.test.ts`; `tests/checks/privacy-literals.test.ts` (update)
**Tags**: @offline, @privacy

**Preconditions**:

- Fixtures with synthetic secrets deliberately placed in adjacent fields (a canary credential literal in a tracker URL fragment, a canary token in an artifact reference) and a clean control.

**Steps**:

1. File, close, list, board-render and report the canary fixtures; assert no canary literal appears in any record, envelope or rendered row.
2. Assert the redaction chokepoint composes on each new render path (recorded invocation).
3. Assert the record carries only references, identities, roles, dates and bounded text.
4. Assert the clean control renders its text unchanged (proving redaction is targeted, not a blanket strip).

**Expected Outcome**:

- Secrets never survive into records or renders; the chokepoint is on every path.

#### TC-ACTION-032 - Offline hermetic posture; a skip never counts as a pass

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-4
**Test Type(s)**: Checks
**Automation Level**: Automated
**Target Layer / Location**: repo scans; `tests/checks/action-hermetic.test.ts` (new; `ceremony-hermetic` pattern)
**Tags**: @offline, @hermetic, @checks

**Preconditions**:

- The suite list for the new and touched action suites; the existing scan helpers.

**Steps**:

1. Scan the suites for `test.skip(`, `describe.skip(`, `.todo(`, socket opens, `spawn`/`exec` of product commands, `$HOME` reads, live state-directory writes, and real tracker/credential access; assert zero findings.
2. Assert the temp-root discipline: every suite constructs its root through the state harness and removes it.
3. Plant a skip and a socket open in a mutation copy; assert both are detected (the scan is non-vacuous).
4. Assert no suite depends on a credential or network being present (it would fail with a named reason, not skip).

**Expected Outcome**:

- New tests are offline by construction; a skip or a live dependency fails the scan rather than passing silently.

#### TC-ACTION-033 - Mutant meta-suite over every honesty rule

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-1, AC-F3-1, AC-F4-1, AC-F4-4, AC-F4-5, AC-F5-1, AC-F6-1, AC-F7-1, DEC-9, DEC-11, RSK-1
**Test Type(s)**: Checks (mutation)
**Automation Level**: Automated
**Target Layer / Location**: temp mutant copies of the production modules; `tests/checks/action-mutants.test.ts`
**Tags**: @offline, @mutants, @checks

**Preconditions**:

- The `spend-mutants`/`ceremony-mutants` import pattern; one mutant per honesty rule.

**Steps**:

1. For each mutant, run the owning suite against the mutant copy on the unchanged fixture and assert the prohibited observable appears (the mutation is detected).
2. Mutants: (a) accept a filing missing a member; (b) default a missing field instead of refusing; (c) invent a verb outside the vocabulary; (d) off-by-one on the nudge threshold; (e) off-by-one on the escalation threshold; (f) drop the second-miss rule; (g) store aging state instead of deriving it; (h) read the wall clock on an aging path; (i) mix aging bases (count days past a due date instead of days open since filing); (j) close without a decision; (k) let artifact closure close the outcome plane on the done route; (l) treat an elapsed window as outcome-closed; (m) warn instead of refusing at the WIP limit; (n) record the excess row after refusing; (o) infer a board owner instead of naming it; (p) drop rows without counting the omission; (q) use a second state vocabulary; (r) assign a follow-through verdict from an owner claim; (s) invent a follow-through entry with no record; (t) order the board rows by append order; (u) close only the artifact plane on the deprioritized/superseded route; (v) moot the outcome plane by elapsed time instead of by the closure decision; (w) accept a repeat closure on an already-closed plane and append a second closure record.
3. Assert every mutant fails with a named reason; assert the unmutated module passes the same suite (non-vacuity).

**Expected Outcome**:

- Every honesty rule is falsifiable; a regression that weakens one cannot pass behind another.

#### TC-ACTION-034 - Own validated boundary and doctor store verdict

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: NFR-5, DM-1, DM-3, DEC-7, §10
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: store boundary + doctor; `tests/behaviour/action-store-boundary.test.ts`; `tests/behaviour/doctor-state.test.ts` (update)
**Tags**: @offline, @state, @doctor

**Preconditions**:

- A temp store with the action-registry boundary declared; healthy, verified-empty, torn, wrong-kind and permission-denied stores; the doctor harness.

**Steps**:

1. Assert the boundary declares exactly the two record kinds under the two `retro.` prefixes and validates payloads on read and write; a malformed record is `state.store.unknown`, never served.
2. Assert the delivered retro-registry boundary still declares exactly its three kinds (unchanged).
3. Assert wrong-kind/torn/permission stores classify with the delivered `state.*` identities and exit 2/1 respectively.
4. Run doctor; assert the state check includes an action-registry store verdict in each condition (verified, verified-empty, torn, permission) with the delivered store-verdict pattern.

**Expected Outcome**:

- The registry is a first-class validated boundary with its own doctor visibility; damage is classified, never silently trusted.

#### TC-ACTION-035 - Refusals named, disclosures in-band, command audit per invocation

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F1-2, AC-F3-1, AC-F4-1, AC-F4-5, AC-F5-1, §10, DEC-8, DEC-11
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: envelopes, renders, audit seam; `tests/behaviour/action-disclosure.test.ts`, `tests/behaviour/action-audit.test.ts`
**Tags**: @offline, @disclosure, @audit

**Preconditions**:

- One fixture per refusal class (filing member, filing contract rule, WIP, closure missing justification, closure state conflict) and one per disclosure surface (list, board, report); a failing audit writer.

**Steps**:

1. For each refusal, assert the envelope names the specific missing/invalid member — or, for an already-closed-plane state conflict, the plane and its existing closure decision — never a generic message, and carries the exact code.
2. Assert aging state, window count/limit and omission counters render in-band on every surface that shows the data.
3. Assert every invocation (file, close, list, board, report) lands one command-audit record with runId, timing and claimed identity.
4. Configure the audit writer to fail; assert the command's outcome and exit are unchanged and the failure is a diagnostic.

**Expected Outcome**:

- No generic refusal, no hidden state, one audit record per invocation, and an audit failure never changes the outcome.

#### TC-ACTION-036 - Conformance: constants, brand neutrality, additive command surface, docs inventory

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F7-2, AC-N8-1, AC-F4-2, §16, DEC-7, GAP-4, OQ-T4
**Test Type(s)**: Contract, Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: contracts, CLI seam, docs inventory; `tests/structure/action-contract.test.ts`, `tests/structure/cli-edge-seam.test.ts` (update), `tests/checks/{help-guide-coverage,reference-page-parity,doc-conformance}.test.ts`
**Tags**: @offline, @structure, @docs

**Preconditions**:

- The declared contract constants (verb vocabulary, aging thresholds, WIP limit, record kinds, key prefixes, refusal identities, closure routes, layout keys); the help/guide coverage inventory; the M2 reference page root.

**Steps**:

1. Assert each contract constant has exactly one declaration home with the declared value (limit 3, 14 and 30 days, three identities, three routes).
2. Assert the `action` verb group is additive inside the `retro` family: `retro collect` and `retro report` keep their grammar and semantics, no new command family appears in the prompt-required set, and the exported CLI symbol set is unchanged.
3. Assert brand neutrality: no product/binary literal in new modules, schemas or user-facing strings.
4. Assert the help surface documents the extended retro family (`--help` golden/help test) and the reference-page inventory + parity checks pass, with the M1 snapshot byte-unchanged.
5. Manual content check: planning pages (`doc/planning/oss-tooling/` backlog markers, status snapshot, M2 ownership lines) updated per convention.

**Expected Outcome**:

- One home per constant, additive command surface, brand-neutral naming, and a documented surface that matches the shipped grammar.

#### TC-ACTION-037 - Delivered retro, ceremony, board and error-table behavior unchanged

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F7-2, AC-F6-1, AC-N8-1, §8.5, NG-3, NG-4
**Test Type(s)**: Behaviour, Contract
**Automation Level**: Automated
**Target Layer / Location**: delivered suites (unchanged assertions must pass); `tests/structure/board-nonregression.test.ts` (update)
**Tags**: @offline, @regression

**Preconditions**:

- The delivered suites listed in §2; the additive changes in place.

**Steps**:

1. Run the delivered retro evidence-pipeline suites with their unchanged assertions; assert green and assert the collected-grammar/truth-check/sidecar/chain source modules are byte-unchanged.
2. Run the ceremony suites; assert declarations, agenda order, note schema and the asserted follow-through-first position are unchanged.
3. Run the board suites; assert the four delivered sections, caps, semantics, payload identity and the one idempotent decision append are unchanged.
4. Assert the delivered four `retro` error rows keep their codes, category, consequence and projection class.
5. Assert `delivery.retro.report.v1` keeps its identity and exactly its four shipped top-level `data` keys (DEC-10), with the fold's entries readable.

**Expected Outcome**:

- The change is strictly additive: delivered contracts remain valid on upgrade, and the only moved pins are the D-row declarations in §4.4.

#### TC-ACTION-038 - Deprioritized/superseded close both planes in the one decision

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-4, DM-3, DEC-4, DEC-11
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: closure plane effects; `tests/behaviour/action-closure.test.ts` (matrix C-08, C-09)
**Tags**: @offline, @action-registry, @closure

**Preconditions**:

- Two stored open actions with complete verification artifacts and open (non-elapsed) outcome windows; a deprioritize fixture with a literal reason and a supersede fixture naming a recorded successor action; fixed injected clock, run id and fence tokens.
- A paired `done` control on a third action — the DEC-11 discriminator, since `done` closes the artifact plane only.

**Steps**:

1. Close the first action on the `deprioritized` route with an explicit decision reference and reason; assert exit 0 and exactly one `retro.action-closure` record.
2. Assert `data.artifactClosure == "closed"` **and** `data.outcomeClosure == "closed"` after that one decision, with the recorded reason serving as each plane's justification and the verification window mooted by the decision rather than by elapsed time.
3. Close the second action on the `superseded` route with the successor reference; assert both planes closed, and that the superseding action reference is stored on the closure record and resolves to a recorded action.
4. Advance the injected clock well past each window; assert no plane changes and no further closure record appears — time is never the closer.
5. Run the paired `done` control; assert it leaves `outcomeClosure == "open"` with its non-null window (SC-M2-S10-02), proving the both-plane effect is a route property, not a blanket rule.
6. Re-run the refusal controls: `deprioritized` without a reason and `superseded` without a successor are still refused before any plane closes (C-03, C-04).

**Expected Outcome**:

- The one explicit decision is the closure justification for both planes on the deprioritized and superseded routes; the window is mooted by the decision and never by time; the done route remains artifact-only. A mutant closing only the artifact plane, or mooting the outcome plane by elapsed time, fails (TC-ACTION-033).

**Postconditions**:

- Temp store discarded; both actions and their closure records exist only in the temp root.

**Notes / Clarifications**:

- The "mooted" window state is asserted as a recorded consequence of the decision, deliberately distinct from the open/elapsed states the done route uses; the exact token comes from the declared contract constant (GAP-4), never an ad-hoc literal.

#### TC-ACTION-039 - Repeat closure on an already-closed plane refused as a state conflict

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-5, DM-3, DEC-5, DEC-11
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: closure validation; `tests/behaviour/action-closure.test.ts` (matrix C-13, C-14)
**Tags**: @offline, @action-registry, @closure

**Preconditions**:

- One action artifact-closed on the `done` route (artifact plane closed, outcome plane open with a non-null window) and one action closed on both planes via `deprioritized`; a paired still-open action as the positive control.

**Steps**:

1. Attempt a second closure targeting the already-closed artifact plane; assert exit 1, `error.code == "retro.closure-incomplete"`, and that the detail names the plane and its existing closure decision.
2. Attempt a repeat outcome decision on the already-closed outcome plane of the both-plane-closed action; assert the same identity, with the plane and the existing closure decision named.
3. Assert the detail is a distinct discriminant from the missing-decision/justification cases — it names a plane plus an existing closure, not a missing input — while the code stays the one declared identity.
4. Assert no second `retro.action-closure` record exists in either case, the store is byte-unchanged, and each plane keeps its prior state.
5. Run the paired control: the still-open action closes normally (exit 0), proving the refusal is not a blanket closure refusal.

**Expected Outcome**:

- A closure decision on an already-closed plane is refused as a state conflict under the declared closure identity, naming the plane and its existing closure, and appends nothing; no fourth identity appears (DEC-5, DEC-11). A mutant that accepts the repeat and appends a second closure record fails (TC-ACTION-033).

**Postconditions**:

- Temp store discarded; no writes outside the temp root.

**Notes / Clarifications**:

- DEC-11 requires the state conflict to be a discriminant distinct **in detail** from the missing-decision/justification refusal, so the assertion pins the named plane and the existing closure reference, never the code alone.

## 6. Environments and Test Data

- **Runner**: `bun test` (or `pnpm test`) for `tests/**/*.test.ts`; `bun run scripts/checks/*.ts` for repository invariants; `pnpm check` (`lint → format:check → typecheck → test → check:boundaries`) as the aggregate gate. Delivery runs the aggregate with `TMPDIR=$PWD/tmp/tmpdir` per the pm-notes convention.
- **Environments**: local dev and CI only. No staging, no real tracker, no provider, no network. The reference measurement for NFR-6 (GAP-3) is a local, non-CI note.
- **Isolation**: one `mkdtemp` root per case via `tests/fixtures/state/harness.ts`; stores created, seeded and removed per test; the live tree and the user's real state directory are never read or written. Board/retro/doctor domain harnesses create their own temp state.
- **Test data**: committed fixtures only. `tests/fixtures/action/` (new, GAP-2) holds action row builders (with recorded filing timestamps and due-date lapse records), closure row builders carrying route and plane effects (artifact-only for `done`, both planes for `deprioritized`/`superseded`, plus the superseding action reference), window/limit fixtures, the aging clock plan and the registry store seeder; `tests/fixtures/board/sections.ts` gains an actions inventory; `tests/fixtures/ceremony/builtins.ts` supplies the declarations and the `tests/fixtures/ceremony/notes/` directory supplies the note builders for the declared-actions handoff (notes land under `.ai/memory/ceremony/<encoded scopeKey>.md` per the ceremony runner spec; the fixture layer only builds the note bodies); `tests/fixtures/retro/harness.ts` supplies the report fold substrate; `tests/fixtures/doctor/harness.ts` supplies store conditions; `tests/fixtures/result/code-corpora/*.json` gains the three codes.
- **Determinism inputs**: fixed `NOW_MS` per case (aging cases use explicit day offsets since the recorded filing timestamp, plus a fixed set of due-date lapse events), fixed run-id and fence-token sequences, synthetic brand, non-time-sortable action ids for ordering fixtures.
- **Fixture privacy**: synthetic owners, tracker references and artifact references only; the fixture-privacy scan runs over every new fixture.
- **Gates**: no suite may skip; a conditional environment probe fails with a named reason rather than skipping; no assertion reads a moving base branch.

## 7. Automation Plan and Implementation Mapping

| TC ID | Test file(s) | Execution | Status |
|-------|--------------|-----------|--------|
| TC-ACTION-001 | `tests/behaviour/action-filing.test.ts` | `bun test tests/behaviour/action-filing.test.ts` | To Implement |
| TC-ACTION-002 | `tests/behaviour/action-filing.test.ts` | same | To Implement |
| TC-ACTION-003 | `tests/behaviour/action-filing.test.ts` | same | To Implement |
| TC-ACTION-004 | `tests/behaviour/action-filing.test.ts`, `tests/structure/action-contract.test.ts` | `bun test tests/behaviour/action-filing.test.ts tests/structure/action-contract.test.ts` | To Implement |
| TC-ACTION-005 | `tests/structure/action-contract.test.ts`, `tests/behaviour/action-filing.test.ts` | same | To Implement |
| TC-ACTION-006 | `tests/behaviour/action-aging.test.ts` | `bun test tests/behaviour/action-aging.test.ts` | To Implement |
| TC-ACTION-007 | `tests/behaviour/action-aging.test.ts` | same | To Implement |
| TC-ACTION-008 | `tests/behaviour/action-aging.test.ts`, `tests/structure/action-imports.test.ts` | `bun test tests/behaviour/action-aging.test.ts tests/structure/action-imports.test.ts` | To Implement |
| TC-ACTION-009 | `tests/behaviour/action-closure.test.ts` | `bun test tests/behaviour/action-closure.test.ts` | To Implement |
| TC-ACTION-010 | `tests/behaviour/action-closure.test.ts`, `tests/golden/retro/cases.json` | `bun test tests/behaviour/action-closure.test.ts tests/golden` | To Implement |
| TC-ACTION-011 | `tests/behaviour/action-closure.test.ts` | same as 009 | To Implement |
| TC-ACTION-012 | `tests/behaviour/action-closure.test.ts` | same as 009 | To Implement |
| TC-ACTION-013 | `tests/behaviour/action-closure.test.ts` | same as 009 | To Implement |
| TC-ACTION-014 | `tests/behaviour/action-wip-limit.test.ts` | `bun test tests/behaviour/action-wip-limit.test.ts` | To Implement |
| TC-ACTION-015 | `tests/behaviour/action-wip-limit.test.ts` | same | To Implement |
| TC-ACTION-016 | `tests/behaviour/action-wip-limit.test.ts` | same | To Implement |
| TC-ACTION-017 | `tests/behaviour/board-actions.test.ts`, `tests/golden/board-full.test.ts` (update) | `bun test tests/behaviour/board-actions.test.ts tests/golden` | To Implement + Existing–Update |
| TC-ACTION-018 | `tests/behaviour/board-determinism.test.ts` (update) | `bun test tests/behaviour/board-determinism.test.ts` | Existing – Update |
| TC-ACTION-019 | `tests/behaviour/board-{bounds,byte-guard,repository-cap}.test.ts` (update) | `bun test tests/behaviour` | Existing – Update |
| TC-ACTION-020 | `tests/behaviour/board-shared-source.test.ts`, `tests/structure/board-nonregression.test.ts` (update) | `bun test tests/behaviour/board-shared-source.test.ts tests/structure/board-nonregression.test.ts` | Existing – Update |
| TC-ACTION-021 | `tests/behaviour/board-never-silence.test.ts` (update) | `bun test tests/behaviour/board-never-silence.test.ts` | Existing – Update |
| TC-ACTION-022 | `tests/behaviour/action-follow-through.test.ts` (new), `tests/behaviour/ceremony-flow-retro-levels.test.ts` (update) | `bun test tests/behaviour/action-follow-through.test.ts tests/behaviour/ceremony-flow-retro-levels.test.ts` | To Implement + Existing–Update |
| TC-ACTION-023 | `tests/behaviour/retro-report.test.ts` (update) | `bun test tests/behaviour/retro-report.test.ts` | Existing – Update |
| TC-ACTION-024 | `tests/behaviour/action-cross-level.test.ts` | `bun test tests/behaviour/action-cross-level.test.ts` | To Implement |
| TC-ACTION-025 | `tests/behaviour/action-ceremony-handoff.test.ts` | `bun test tests/behaviour/action-ceremony-handoff.test.ts` | To Implement |
| TC-ACTION-026 | `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts`, `tests/fixtures/result/code-corpora/*.json` (update) | `bun test tests/structure/error-table.test.ts tests/checks/error-table-sync.test.ts`; `bun run scripts/checks/error-table-sync.ts` | Existing – Update |
| TC-ACTION-027 | `tests/behaviour/action-determinism.test.ts`, `tests/structure/action-imports.test.ts` | `bun test tests/behaviour/action-determinism.test.ts tests/structure/action-imports.test.ts`; `bun run scripts/checks/ambient-globals.ts` | To Implement |
| TC-ACTION-028 | `tests/behaviour/action-bounds.test.ts` | `bun test tests/behaviour/action-bounds.test.ts` | To Implement |
| TC-ACTION-029 | `tests/behaviour/action-write-discipline.test.ts` | `bun test tests/behaviour/action-write-discipline.test.ts` | To Implement |
| TC-ACTION-030 | `tests/behaviour/action-read-cost.test.ts`, `tests/behaviour/board-performance.test.ts` (update) | `bun test tests/behaviour/action-read-cost.test.ts tests/behaviour/board-performance.test.ts` | To Implement + Existing–Update |
| TC-ACTION-031 | `tests/behaviour/action-privacy.test.ts`, `tests/checks/privacy-literals.test.ts` (update) | `bun test tests/behaviour/action-privacy.test.ts tests/checks/privacy-literals.test.ts` | To Implement + Existing–Update |
| TC-ACTION-032 | `tests/checks/action-hermetic.test.ts` | `bun test tests/checks/action-hermetic.test.ts` | To Implement |
| TC-ACTION-033 | `tests/checks/action-mutants.test.ts` | `bun test tests/checks/action-mutants.test.ts` | To Implement |
| TC-ACTION-034 | `tests/behaviour/action-store-boundary.test.ts`, `tests/behaviour/doctor-state.test.ts` (update), `tests/golden/doctor-output.test.ts` (update) | `bun test tests/behaviour/action-store-boundary.test.ts tests/behaviour/doctor-state.test.ts tests/golden` | To Implement + Existing–Update |
| TC-ACTION-035 | `tests/behaviour/action-disclosure.test.ts`, `tests/behaviour/action-audit.test.ts` | `bun test tests/behaviour/action-disclosure.test.ts tests/behaviour/action-audit.test.ts` | To Implement |
| TC-ACTION-036 | `tests/structure/action-contract.test.ts`, `tests/structure/cli-edge-seam.test.ts`, `tests/checks/{help-guide-coverage,reference-page-parity,doc-conformance}.test.ts`, `tests/fixtures/help-guide/coverage.json` | `bun test tests/structure/action-contract.test.ts tests/checks/help-guide-coverage.test.ts tests/checks/reference-page-parity.test.ts`; manual docs check | To Implement + Existing–Update + Manual Only (planning pages) |
| TC-ACTION-037 | delivered suites per §2; `tests/structure/board-nonregression.test.ts` (update) | `bun test tests/behaviour tests/structure`; `pnpm check` | Existing – Update |
| TC-ACTION-038 | `tests/behaviour/action-closure.test.ts` | `bun test tests/behaviour/action-closure.test.ts` | To Implement |
| TC-ACTION-039 | `tests/behaviour/action-closure.test.ts` | same as 038 | To Implement |

**Mocking and injection requirements**: no module is globally mocked; every dependency is injected through the existing runtime seams — state port, tracker read, clock, run-id factory, fence tokens, brand, board repository loader, ceremony note provider, doctor evidence providers. Mutant suites use temp copies, never in-place edits.

**Non-regression gate**: `TMPDIR=$PWD/tmp/tmpdir pnpm check` green before the PR, including `check:boundaries` and the invariant checks; the branch-range commit-message gate runs in phase 9 per the lifecycle.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Risk | Impact | Mitigation |
|----|------|--------|------------|
| TR-1 | The plan-level grammar/data-key refinements (GAP-4) drift between the filing surface, the closure surface and the board, so tests pin three different vocabularies | M | One contract module owns every constant; TC-ACTION-036 asserts a single declaration home; tests import constants rather than literals; the pinned literals (`data.artifactClosure`, `data.outcomeClosure`, the three codes) are asserted verbatim |
| TR-2 | The delivered board/retro/doctor suites' pinned assertions move without declaration, so the change looks like a regression | M | §4.4 is the declared drift register; D-rows are named in the plan and the commit body; goldens regenerate by explicit command only |
| TR-3 | Aging tests drift to a "days past due" implementation even though DEC-9 pins days open since the recorded filing timestamp, so a due-date interpretation passes while the spec says otherwise | M | TC-ACTION-008 asserts the basis constant *is* the recorded filing timestamp, exercises the straddling fixture and proves due dates move only the miss counter; the mutant that counts days past due fails (TC-ACTION-033) |
| TR-4 | Board determinism tests pass because the fixture happens to be small; ordering/cap interactions go untested | M | TC-ACTION-018 shuffles seeding order; TC-ACTION-019 uses an over-cap, over-budget fixture with a positive under-cap control first |
| TR-5 | Follow-through tests pass using the owner's claim because the artifact oracle is not discriminating | H | TC-ACTION-022 uses a contradicting owner claim and the mutant "verdict from owner claim" (TC-ACTION-033) must fail; no verdict without an artifact reference |
| TR-6 | Error-table 4→7 growth breaks the reserved exact-code binding silently | M | TC-ACTION-026 asserts both directions plus the delivered four byte-unchanged; the sync suite's doc-removal/extra-row mutation controls stay non-vacuous |
| TR-7 | Hermeticity erodes because the tracker corroboration case reaches the real integration | M | All tracker reads injected; TC-ACTION-032 scans for socket/spawn/credential/`$HOME` and fails on a planted violation |
| TR-8 | NFR-6 is asserted as a wall-clock claim and flakes in CI | M | Bounded-work oracle is the gate; duration is a recorded reference measurement (GAP-3) |
| TR-9 | A skip or a conditional early return silently removes a pinned scenario from the run | H | TC-ACTION-032 fails on any skip; the pinned scenarios are named cases in dedicated suites (TC-ACTION-001, TC-ACTION-010) |
| TR-10 | Closure plane effects diverge by route — the outcome plane silently staying open on a deprioritized/superseded action (re-creating the never-closed drift and leaving a dead action counted against WIP) — or a repeat closure appending a second record | H | TC-ACTION-038 asserts both planes close in the one decision and that the done route stays artifact-only; TC-ACTION-039 asserts the state-conflict refusal with an unchanged store and no second record; mutants (u)–(w) in TC-ACTION-033 must fail |

### 8.2 Assumptions

- The delivered ceremony runner keeps its asserted follow-through-first position, verdict vocabulary and declared-actions handoff unchanged; the registry is the receiving producer (spec §12, NG-4).
- The delivered board keeps its payload identity, four sections, caps, byte guard and selection forms; the actions surface is additive under the payload (spec §8.5).
- The delivered retro evidence pipeline's fold is driven by an injected reader that the registry can implement without grammar or schema changes, and the registry producer adds no new top-level `retro report` data key — additions stay confined to entries inside the delivered `followThrough[]` fold (spec §8.5, DEC-10).
- The delivered state layer's artifact-boundary factory supports a sibling boundary with two new record kinds under new prefixes without a schema-version bump (DEC-7).
- The injected clock convention governs all aging computations, and no ambient time read exists in any evaluation path (DEC-3).
- Tracker corroboration uses the delivered read integration; a reachable tracker is the default for "real tracker entry" and unreachable is disclosed (spec §8.4, §12).
- Fixture builders can append through the same boundary the production writer uses, so read-back validation is meaningful.
- The three new error identities are exact two-segment codes under the `retro` domain kind and no new domain kind is introduced (DEC-5); the already-closed-plane refusal is a detail-level discriminant under the one closure identity, not a fourth code (DEC-11).
- The deprioritized and superseded routes close both closure planes in the one explicit decision, the done route closes the artifact plane only, and the supersede route records the superseding action reference on the closure record (DEC-11).

### 8.3 Open Questions

| ID | Question | Blocking? | Owner / Next step |
|----|----------|-----------|-------------------|
| OQ-T1 | The implementation plan (`chg-GH-287-plan.yaml`) was authored in phase 4 and must map TC-ACTION-001..039 onto phases without reshaping any contract, and declare the plan-level refinements before delivery. | No — resolved | Resolved in `delivery_planning`: the plan validates under the full tier (9 phases) with `TC-ACTION-001..039` mapped 39/39 single-homed and the GAP-4/GAP-6 refinements declared in its PLAN-LEVEL REFINEMENTS block (GAP-1). This test plan reopens if a pinned contract moves |
| OQ-T2 | Exact command grammar and the list surface's data key for `actions[]` are plan-level refinements (GAP-4). | No — bound via constants | `@plan-writer`; then TC-ACTION-036 pins them with the contract suite. The retro report's top-level key question is settled separately by DEC-10 (no new key) |
| OQ-T3 | AC-F1-2 requires "a classified error naming the offending field" for a team owner, an unverifiable verb and a placeholder tracker entry, while DEC-5 declares exactly three identities and forbids a fourth. | No — resolved | Resolved in spec v1.2 by DEC-8: a present-but-non-conforming field is incomplete for filing purposes and is refused under `retro.action-incomplete` naming the offending field. This plan binds matrix R-09..R-11 to that identity (TC-ACTION-003, TC-ACTION-005); nothing is left to confirm and no fourth identity is added |
| OQ-T4 | The board actions surface's human label and placement (a fifth label beside `ASKS` or a sub-block inside the asks section) are not spec-pinned; the delivered board test pins the exact label sequence (D-6). | No | `@plan-writer` declares the shape; TC-ACTION-017/036 assert "beside the asks, additive, four delivered sections unchanged" either way (GAP-6) |
| OQ-T5 | Spec AC-F1-1 and AC-F5-1 list `NFR-8` (error-table binding) in their Linked column although their criteria do not concern error-table binding. | No — resolved | Resolved in spec v1.2: the stray `NFR-8` links were removed (the Linked columns now read F-1 and F-1/F-2/DEC-6). No requirement was added or dropped; the error-table obligation stays with AC-N8-1 and TC-ACTION-026 |
| OQ-T6 | "Days past the aging basis": the spec records both filing date and due date and pins the basis once as contract data without naming which date drives the 14/30-day thresholds (RSK-6). | No — resolved | Resolved in spec v1.2 by DEC-9: the basis is time open since the recorded filing timestamp, and due dates feed only the second-miss counter. TC-ACTION-006..008 bind that basis; the boundary ladder follows it |
| OQ-T7 | Whether the retro report gains any additive top-level `data` key from the registry producer, which would move the delivered exact-four-keys assertion (D-11). | No — resolved | Resolved in spec v1.2 by DEC-10: no new top-level key; the registry feeds the delivered `followThrough[]` fold and provenance stays inside its entries. D-11 is declared "unchanged — no move" and TC-ACTION-023 asserts it |
| OQ-T8 | Outcome closure of a deprioritized or superseded action, and repeat closure attempts on an already-closed plane, are not specified. | No — resolved | Resolved in spec v1.2 by DEC-11, with AC-F4-4 and AC-F4-5 added: the deprioritized/superseded decision closes both planes and the repeat closure is a state-conflict refusal. TC-ACTION-038 and TC-ACTION-039 own the two cases; matrix C-08/C-09 and C-13/C-14 bind them |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-16 | @test-plan-writer | Initial test plan for GH-287 (M2-S10): 37 TCs covering the 13 binding ACs and 8 NFRs, both pinned scenarios as dedicated cases (TC-ACTION-001, TC-ACTION-010), the filing/aging/closure/WIP oracles, the board actions surface and bounds, follow-through enforcement and the fold producer, the additive error rows (4→7), the honesty battery, and the declared delivered-suite drift register (§4.4) with GAP-1..GAP-6 and OQ-T1..OQ-T8 |
| 1.1 | 2026-11-16 | @test-plan-writer | Reconciled with spec v1.2 (reopened specification phase). DEC-8 pins the contract-rule refusal under the one filing identity → GAP-5 resolved, OQ-T3 closed, matrix R-09..R-11 restated as spec-pinned; DEC-9 pins the aging basis as time open since the recorded filing timestamp with due dates feeding only the miss counter → OQ-T6 closed, the A-matrix and TC-ACTION-006..008 rebound to the timestamp; OQ-T5 closed (the spec removed the stray `NFR-8` links from AC-F1-1/AC-F5-1); DEC-10 pins no new top-level `retro report` data key → OQ-T7 closed, D-11 declared "unchanged — no move", TC-ACTION-023/037 assert exactly the four keys; DEC-11 pins both-plane closure on the deprioritized/superseded routes, the already-closed-plane state-conflict refusal and the recorded superseding reference → OQ-T8 closed, C-08/C-09 restated, C-13/C-14 added, TC-ACTION-012 step 3 rewritten, mutants (u)–(w) added. Added AC-F4-4 and AC-F4-5 as dedicated cases TC-ACTION-038 and TC-ACTION-039. Now 39 TCs covering 15 ACs |
| 1.2 | 2026-11-16 | @test-plan-writer | DoR remediation (readiness iteration 1 → 2), editorial only — no TC, oracle, matrix or scenario changed. GAP-1/OQ-T1, the frontmatter `implementation_plan` link and the §2 plan reference now record the plan as authored and validated (`verdict=valid`, `readyForDevelopment=true`, tier full, 9 phases) with `TC-ACTION-001..039` owned 39/39 single-homed and the GAP-4/GAP-6 refinements declared, keeping the reopen-if-a-pinned-contract-moves clause; §3.4 gap status reconciled. Drift register D-23 path split to the delivered locations (`tests/structure/state-scope.test.ts`, `tests/checks/packed-state.test.ts`). §2 ticket-AC decomposition adds AC-F4-4 to the artifact-versus-outcome AC, matching spec §17's decomposition and the 15-AC set. Ceremony note substrate citations corrected from `ceremony/notes.ts` to the delivered `tests/fixtures/ceremony/notes/` directory in §2 and §6 |

## 10. Test Execution Log

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| — | — | Not run | This plan is a design and verification map; execution happens in the delivery phase. NFR-6 reference measurement (GAP-3) recorded here when taken. |

**Planned aggregate evidence (populate at delivery):**

| Command | Result | Notes |
|---------|--------|-------|
| `bun test tests/behaviour tests/structure tests/checks tests/golden` | pending | targeted suites first, then broad |
| `bun run scripts/checks/error-table-sync.ts` | pending | 4→7 rows, both directions |
| `bun run scripts/checks/help-guide-coverage.ts` | pending | extended retro surface documented |
| `TMPDIR=$PWD/tmp/tmpdir pnpm check` | pending | aggregate gate before the PR |
