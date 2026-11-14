---
id: chg-GH-310-test-plan
status: Updated
created: 2026-11-14
last_updated: 2026-11-14
owners: [Juliusz Ćwiąkalski]
service: delivery-os
labels: [milestone-m2, plan, verify-gates, closeout, queue, multi-repository, review-flow]
version_impact: minor
summary: "Verification strategy for M2-S19 cross-repository changes: the additive plan members[] declaration and its closed validation, one queue entry and lane per member ref, the shared definition of done with per-member CI corroboration and named blockers, member dependency ordering, the per-member closeout report, one executable review flow over the declared pull-request set, byte-identical single-repository parity, envelope and identity continuity, hermetic two-repository fixtures, determinism and bounds, and the gate battery."
links:
  change_spec: ./chg-GH-310-spec.md
  implementation_plan: ./chg-GH-310-plan.yaml
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - M2-S19: Cross-repository changes (M2)

## 1. Scope and Objectives

This change turns a change from one repository into one lifecycle over a declared member set. The behaviours this plan protects, in descending risk order: **member-less parity** (a plan declaring no `members[]` must stay byte-identical on every touched surface — plan, gates, closeout, queue — because the cross-repository path must be opt-in, RSK-5/NFR-8/AC-F7-1); **fail-closed verdict** (an unavailable or absent CI reading is never green and a partly landed change never reads as done — RSK-1/RSK-2/NFR-5/DEC-3/DEC-4); **closed member validation** (the plan schema must be strengthened, never weakened: duplicate keys, unknown dependencies, self edges, cycles, and over-bounds are classified `plan.schema.invalid`, never silently dropped — RSK-4/DEC-1); **one durable member identity** (the member ref `<canonicalChangeRef>@<repoKey>` is the only queue-identity extension and the delivered `<PREFIX>-<digits>` form canonicalizes exactly as before — RSK-3/DEC-2); and **bounded, attributed evidence** (member order is declared order, evidence order is the pinned landing rule, `blockingMembers[]` is never truncated, and every refusal reuses a delivered identity — NFR-2/NFR-6/NFR-7/RSK-7/RSK-8).

The motivating regressions are concrete: a two-repository change that reads `green` because only one member's CI was consulted; an unavailable CI read consumed as a pass; a member declaration silently ignored so a plan "validates" while the change is still single-repository; a member-ref extension that breaks delivered queue canonicalization, reconcile, or landing removal; a closeout that claims an unlanded member; and any byte drift in member-less output while the member path is added.

### 1.1 In Scope

- The plan declaration `members[]` (≤8 entries; `repoKey`, `slice`, `branch`, `pullRequest`, `dependsOn[]` ≤8, `gates` 1..16): valid echo through `plan validate`, negative classification through `plan validate` and `lint plan`, and every declared bound including the derived member-ref length (AC-F1-1..AC-F1-4; DM-1; DEC-1, DEC-9, DEC-10).
- The member queue representation: two entries keyed `<ref>@<repoKey>`, one lane each, per-member dependency edges, `dependency-open` readiness, per-member lease release and removal, and the extended member-ref canonicalization (AC-F2-1..AC-F2-4; DM-6; DEC-2, DEC-7).
- The shared definition of done: `data.definitionOfDone` (`status`, `members[]` with `gates.ci`/`verdict`, ordered `evidence[]`) and `data.blockingMembers[]`; per-member CI on each member's own pushed head; `unavailable`/`absent` never green; `green`/`blocked`/`incomplete` exit projection with data present (AC-F3-1..AC-F3-6; DM-2..DM-4; DEC-3, DEC-4, DEC-6, DEC-11).
- Member dependency ordering: `dependency-open` readiness, `queue.precondition.unmet` start refusal naming member and prerequisite, admission after the prerequisite lands, and `queue.dependency-cycle` for member-ref edge cycles (AC-F4-1, AC-F4-2; DEC-7).
- The closeout member report `data.members[]` with `repoKey`, `branch`, `cleanup`, `pullRequest`, `issueClosure`, `landed`; partial landing visibility; per-member landing removal; unsafe squash-safety refusal (AC-F5-1..AC-F5-4; DM-5; DEC-12, OQ-5).
- One review flow over the declared member pull-request set: stable `runId`, one verdict per member, `complete` semantics, duplicated-observation degradation, and member-set change detection (AC-F6-1..AC-F6-3; DM-7; DEC-8; OQ-3 pin).
- Single-repository parity for plan validate/lint/diff/overlap, verify gates, closeout (plan and apply), and queue/lanes, asserted against the pre-change goldens (AC-F1-3, AC-F5-4, AC-F7-1; NFR-8; clause C-1).
- Contract continuity: envelope shape, data-only keys, zero new error rows and domain kinds, read-only posture, bounded per-member reads, deterministic repeated runs, and the eight-member blocker-non-truncation bound (AC-NFR1-1, AC-NFR2-1, AC-NFR3-1, AC-NFR4-1; NFR-6/NFR-7 folded in as declared below).
- Hermetic, offline fixtures: two real local temporary member repositories per case from the delivered `tests/fixtures/projects/temp-repos.ts` seam, injected provider observations, zero live network, zero real second remote, zero credentials (AC-NFR3-1).
- The gate battery and commit hygiene (AC-NFR5-1), recorded as verification-only evidence.

### 1.2 Out of Scope & Known Gaps

- **No live multi-repository execution and no second real remote** (NG-1): every provider fact is an injected observation over local temporary repositories; a local bare origin is used only as a clone source where a clone is required and is never a network remote.
- **No merge authority and no merge transaction** (NG-2): the review-flow and closeout cases observe merges; nothing merges a pull request.
- **No global or group-scoped store, no new record kind** (NG-3, NFR-7): the member report is derived output. The absence of a store is asserted (Section 5, TC-XREV-005/TC-XCTR-003), never stubbed into existence.
- **No board, MCP, OpenCode/host, or tracker-adapter change** (NG-4, NG-5, NG-6): not tested; only the CLI envelope is the observable surface.
- **No per-member file scope, no member-aware `plan diff`/`plan overlap`** (NG-8): those surfaces are tested only for byte parity (TC-XPAR-001), never for member semantics.
- **No current-truth feature-spec amendment in delivery phases** (NG-9): phase 7 reconciliation is documentation evidence (DoD-13), not a test case.
- **Prior spec gaps are closed by spec v1.1** (see Section 8.3): the missing/empty member fields and the `repoKey` grammar are now AC-F1-5/AC-F1-6 (DEC-15); per-member lease release is AC-F2-5; the unresolvable declared gate identifier is AC-F3-7; bounded per-member reads and identity reuse are AC-NFR6-1/AC-NFR7-1; the `evidence[]` element shape is AC-F3-8 (DEC-16); the review-observation seam is AC-F6-4 (DEC-17); and `absent` has one definition (DEC-4) with AC-F3-4 aligned. The corresponding TCs are now fully AC-bound.
- **Quality-gate and PR posture are lifecycle evidence, not automated tests** (Section 8.4): TC-XGATE-001 is verification-only and excluded from the automated TC count; the PR staying open against `main-tools` is a phase-11 record.
- **No branch-diff assertions in permanent suites** (`.ai/rules/testing-strategy.md`): "no forbidden area changed" and "docs flip only in phase 7" remain review-time checks, not TCs.

## 2. References

- Change specification: `./chg-GH-310-spec.md` — 37 acceptance criteria AC-F1-1…AC-NFR7-1 (§17, spec v1.1); DoD-1…DoD-15 (§17.1); capabilities F-1…F-7 (§5); interfaces DM-1…DM-7 (§8.3); NFR-1…NFR-9 (§9); risks RSK-1…RSK-9 (§11); decisions DEC-1…DEC-17 (§15); open questions OQ-1…OQ-5 (§14, OQ-3 resolved-with-deferral); pinned literals (Appendix A, items 1–18); constraint register C-1…C-9 (Appendix C); ticket AC mapping (Appendix B).
- Implementation plan: `./chg-GH-310-plan.yaml` — **pending** (phase 4 of the lifecycle). This plan constrains it: the plan must (a) pin the exact suite file names in Section 7 (assertion contracts bind regardless of placement); (b) carry the fixture-root and gate-environment constraints in Section 6 into every phase boundary; (c) keep the parity phase's goldens pre-change (Section 6.4); (d) name the `ReviewObservation` seam per DEC-17; (e) carry the `evidence[]` element shape `{repoKey, pullRequest, landed, landingPosition?}` per DEC-16; (f) apply the DEC-15 member field grammar and required set.
- Repository testing strategy: `.ai/rules/testing-strategy.md` (bun:test under `tests/**/*.test.ts`; fixtures never named `*.test.ts`; invariant suites assert the current tree, never a moving-base diff; goldens regenerated only by explicit command with review-visible diffs; aggregate `pnpm check`).
- TypeScript test authoring rules: `.ai/rules/typescript.md` §9 (injected fakes over `mock.module`, deterministic tests, committed normalized goldens, assert the current tree).
- PM notes: `./chg-GH-310-pm-notes.yaml` — fixture decision (two local temporary repositories, injected observations, no live network), gate environment (measured `TMPDIR=/home/juliusz/tmp` and `commit.gpgsign=false`), delivery conventions (DEC-14), and the `PATH=$PWD/node_modules/.bin` lifecycle workaround.
- Milestone scenario seeds: `doc/planning/oss-tooling/milestones/m2/test-scenarios.md` §"M2-S19 Cross-repository changes" — SC-M2-S19-01…05, inherited **by name** (spec Appendix B); seed wording precision notes live in the owning TCs.
- Milestone contracts: `doc/planning/oss-tooling/milestones/m2/contracts.md` ("Cross-repository change plan shape", "Queue and lane representation") and `architecture.md` ("Cross-repository change", "Boundary invariants at M2 exit").
- Delivered baseline contracts: `doc/spec/features/feature-plan-schema.md`, `feature-verify-gates.md`, `feature-closeout.md`, `feature-scheduling-engine.md`, `feature-project-groups.md`, `feature-result-contract.md`.
- Fixture seam: `tests/fixtures/projects/temp-repos.ts` (`createRepository`, `createBareOrigin`, `seedOrigin`, `cloneRepository`, `addWorktree`, sanitized git environment, pinned `GIT_CEILING_DIRECTORIES`), `tests/fixtures/projects/groups.ts` (`createMemberCheckout` mints the durable `repoKey`), `tests/fixtures/projects/state-scope.ts` (`guardStateFixtureRoot`, `createHostFixture`, `nonCheckoutDirectory`, `realStateFingerprint`).
- Existing suites to extend: `tests/behaviour/plan-validate.test.ts`, `plan-validate-rejections.test.ts`, `plan-lint.test.ts`, `plan-readonly.test.ts`, `plan-determinism.test.ts`, `verify-gates-read-budget.test.ts`, `verify-gates-target.test.ts`, `queue-readiness.test.ts`, `queue-dep-cycle.test.ts`, `closeout-plan.test.ts`, `closeout-queue-removal-skips.test.ts`, `entrypoint-help.test.ts`; `tests/structure/envelope-contract.test.ts`, `error-table.test.ts`, `event-state-additivity.test.ts`; `tests/checks/error-table-sync.test.ts`, `fixture-sanitization.test.ts`; the goldens under `tests/golden/**` and `tests/fixtures/{verify-gates,closeout,queue}/golden/**`.
- Delivery baseline: branch point `main-tools` tip recorded in pm-notes (`404e9bf8` at intake) — the source of pre-change parity goldens (Section 6.4).

## 3. Coverage Overview

Every one of the 37 §17 acceptance criteria is covered; no AC is left TODO and no TC is orphaned. The reconciliation is explicit in §3.4: 37 ACs declared, 37 covered (36 by automated test code, 1 by gate evidence), 51 TCs declared (50 automated, 1 verification-only).

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Description (abbreviated) | TC ID(s) | Status |
|-------|---------------------------|----------|--------|
| AC-F1-1 | Two-member `members[]` validates, echoes verbatim in declared order, one spec/one plan, no per-member folder (SC-M2-S19-01) | TC-XPLAN-001, TC-XPLAN-005 | Covered |
| AC-F1-2 | Duplicate `repoKey`, unknown `dependsOn`, self edge, cycle, unknown member key → `plan.schema.invalid` naming `members[i].<field>`, lint locations, exit 1, nothing invalid echoed | TC-XPLAN-002, TC-XCTR-003 | Covered |
| AC-F1-3 | Member-less plan validate/lint/diff/overlap byte-identical, no `members` key | TC-XPAR-001 | Covered |
| AC-F1-4 | Over-bounds (>8 members, >8 edges, >16 gates, >64-char member ref) → `plan.schema.invalid`, exit 1 | TC-XPLAN-003 | Covered |
| AC-F1-5 | Missing required field (`repoKey`/`slice`/`branch`/`gates`), empty `slice`/`branch`, or empty `dependsOn` element → `plan.schema.invalid` naming `members[i].<field>` in validate and lint, no invented default, not echoed | TC-XPLAN-006, TC-XPLAN-004 | Covered |
| AC-F1-6 | `repoKey` outside the DEC-15 grammar → `plan.schema.invalid` naming `members[i].repoKey`; a matching `repoKey` is accepted and echoed verbatim | TC-XPLAN-007, TC-XPLAN-004 | Covered |
| AC-F2-1 | Exactly two member entries, own repository, own lane, no bare-ref entry, no cross-member lane | TC-XQUEUE-001, TC-XQUEUE-005 | Covered |
| AC-F2-2 | B depends on A unlanded → edge to A's member ref, B `not-ready`/`dependency-open`, A unaffected (SC-M2-S19-05) | TC-XQUEUE-002 | Covered |
| AC-F2-3 | A lands → exactly one removal for A's member ref reason `landed`, B retained, B readiness recomputed | TC-XQUEUE-003, TC-XQUEUE-005 | Covered |
| AC-F2-4 | Member ref canonicalizes and is accepted everywhere; delivered form unchanged; `ref-not-canonical` never applies to a member ref | TC-XQUEUE-004 | Covered |
| AC-F2-5 | Both members hold leases and A's lease is held by another holder → `queue release <ref>@<B>` releases exactly B's lease (`released`), both entries remain, A's lease/entry unchanged, A never blocks B's release | TC-XQUEUE-006, TC-XQUEUE-005 | Covered |
| AC-F3-1 | Both members' gates/CI pass on their own heads → `green`, one member entry each in order, `gates.ci: pass`, `verdict: pass`, empty blockers, both PRs in evidence, exit 0 (SC-M2-S19-03) | TC-XDOD-001 | Covered |
| AC-F3-2 | Member B fails a declared gate → `blocked`, `blockingMembers[]=[B]`, B `fail`, A `pass`, data present, exit 1 (SC-M2-S19-02) | TC-XDOD-002 | Covered |
| AC-F3-3 | CI unavailable → `gates.ci: unavailable`, `verdict: unknown` (never `pass`), blocker named, not `green`, exit 1 (SC-M2-S19-04) | TC-XDOD-003 | Covered |
| AC-F3-4 | CI truth cannot be established (no pushed head, no declared pull request, or no run for the head) while no member is negative/unavailable → `incomplete`, `gates.ci: absent` per DEC-4, blocker named, exit 1 | TC-XDOD-004 | Covered |
| AC-F3-5 | One member passes, the other unavailable → the unavailable member's `gates.ci` is never `pass`, verdict `unknown` (no cross-member reuse) | TC-XDOD-005 | Covered |
| AC-F3-6 | Partly landed: evidence landed first by ascending landing position, then unlanded in declared order, stable on repeat (SC-M2-S19-05) | TC-XDOD-007, TC-XBOUND-001 | Covered |
| AC-F3-7 | Unresolvable declared gate identifier → member `verdict: unknown` (never `pass`), blocker named, `blocked`, exit 1, and no gate record attributes `pass` to that identifier | TC-XDOD-008, TC-XDOD-006 | Covered |
| AC-F3-8 | Member with no declared `pullRequest` stays in `members[]` with `gates.ci: absent` and is omitted from `evidence[]`; every member with a PR appears with `repoKey`, `pullRequest`, `landed` (DEC-16) | TC-XDOD-009, TC-XDOD-007 | Covered |
| AC-F4-1 | Start on B while A unlanded → `queue.precondition.unmet` naming B and A, exit 1; admitted after A lands | TC-XDEP-001 | Covered |
| AC-F4-2 | Member-ref edge cycle → `queue.dependency-cycle`, exit 1; plan cycle → `plan.schema.invalid` before any queue write | TC-XDEP-002, TC-XPLAN-002, TC-XCTR-003 | Covered |
| AC-F5-1 | Both merged → two `data.members[]` entries in declared order with all six fields and `landed: true`; each landing removes only its entry (SC-M2-S19-01) | TC-XCLOSE-001, TC-XCLOSE-004 | Covered |
| AC-F5-2 | Only A merged → A `landed: true`, B `landed: false`; A removed, B retained or disclosed with a delivered skip reason; nothing claims B landed | TC-XCLOSE-002 | Covered |
| AC-F5-3 | Unsafe squash predicate → delivered refuse value, branch not deleted, `landed` only merge truth | TC-XCLOSE-003 | Covered |
| AC-F5-4 | Member-less closeout (plan and apply) → no `members` key; steps/outcomes/ledger/human output byte-identical | TC-XPAR-002 | Covered |
| AC-F6-1 | Two members, one observation each → one verdict per declared member in order, `complete: true`; second run identical `runId`, no added verdict | TC-XREV-001, TC-XREV-004, TC-XREV-005 | Covered |
| AC-F6-2 | Duplicated review observation → member `fail`, `complete: false`, still one entry | TC-XREV-002 | Covered |
| AC-F6-3 | Member set changed between runs → `runId` differs, no entry for a removed member | TC-XREV-003 | Covered |
| AC-F6-4 | One `ReviewObservation` per member through the verification composition → each verdict derives from its own observation only; a second observation yields `fail`/`complete: false`; no member is `pass` without a matching observation | TC-XREV-006, TC-XREV-002 | Covered |
| AC-F7-1 | Parity fixture set: member-less plan/gates/closeout/queue byte-identical with identical exits | TC-XPAR-003, TC-XPAR-001, TC-XPAR-002 | Covered |
| AC-NFR1-1 | Every envelope: five-field `delivery.result.v1`, new keys under `data`, zero `ok`/`command` top-level | TC-XCTR-001, TC-XCTR-005, TC-XREV-005 | Covered |
| AC-NFR2-1 | Repeated runs byte-identical (verdict/closeout/queue); eight-member report within the machine byte bound; blockers never truncated | TC-XBOUND-001, TC-XBOUND-002, TC-XBOUND-003, TC-XBOUND-004 | Covered |
| AC-NFR3-1 | Default suite: two real local temporary repositories, injected provider facts, zero live network/second remote/credentials | TC-XHERM-001, TC-XHERM-002 | Covered |
| AC-NFR4-1 | Plan validation writes nothing; full battery appends exactly one gate-verification record; closeout plan mode zero writes | TC-XCTR-002, TC-XCLOSE-004 | Covered |
| AC-NFR5-1 | `TMPDIR=/home/juliusz/tmp pnpm check` green; conventional subjects; body/footer ≤100 characters | TC-XGATE-001 (verification-only) | Covered (gate evidence) |
| AC-NFR6-1 | Counting transport: ≤1 open-PR page, ≤1 detail read, ≤1 check-run page per declared member; 0 retries, 0 pagination, and no call outside the declared member set | TC-XCTR-006, TC-XDOD-005 | Covered |
| AC-NFR7-1 | Error-table row count and domain-kind membership identical to pre-change; no new identity string; every exercised refusal resolves to a delivered identity | TC-XCTR-007, TC-XCTR-003 | Covered |

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

No HTTP endpoint and no new event kind exists (spec §8.1/§8.2: N/A). Member queue entries reuse the delivered `queue.graph` kinds (`entry`, `dependency-edge`, `release`, `remove`) keyed by the member ref; no new topic or kind. Data-model surfaces:

| ID | Element | TC ID(s) | Status |
|----|---------|----------|--------|
| DM-1 | Plan member declaration `members[]` (DEC-15 grammar: required `repoKey`/`slice`/`branch`/`gates`, optional `pullRequest`/`dependsOn`, ≤8, `dependsOn` ≤8, `gates` 1..16) and the `plan validate` echo | TC-XPLAN-001, TC-XPLAN-002, TC-XPLAN-003, TC-XPLAN-004, TC-XPLAN-005, TC-XPLAN-006, TC-XPLAN-007 | Covered |
| DM-2 | `data.definitionOfDone` (`status`, `members[]` with `repoKey`/`gates.ci`/`verdict`, `evidence[]`) plus `data.blockingMembers[]` | TC-XDOD-001…TC-XDOD-009, TC-XCTR-005 | Covered |
| DM-3 | Closed vocabularies: `gates.ci` (`pass`/`fail`/`unavailable`/`absent` per DEC-4), member `verdict` (`pass`/`fail`/`unknown`), `status` (`green`/`blocked`/`incomplete`) | TC-XDOD-003, TC-XDOD-004, TC-XDOD-005, TC-XDOD-006, TC-XDOD-008, TC-XDOD-009, TC-XCTR-005 | Covered |
| DM-4 | `evidence[]` entries `{repoKey, pullRequest, landed, landingPosition?}` (DEC-16), landing order and ties; pull-request-less members omitted from `evidence[]` while remaining in `members[]` | TC-XDOD-007, TC-XDOD-009, TC-XBOUND-004 | Covered |
| DM-5 | `closeout.data.members[]` six fields with delivered outcome values and merge-truth `landed` | TC-XCLOSE-001, TC-XCLOSE-002, TC-XCLOSE-003, TC-XCLOSE-004, TC-XPAR-002 | Covered |
| DM-6 | Member ref `<canonicalChangeRef>@<repoKey>` ≤64; one entry/lease/lane/edge-set/removal per member; per-member release; plain ref when no members | TC-XQUEUE-001…TC-XQUEUE-006, TC-XPLAN-003 | Covered |
| DM-7 | `data.reviewFlow` (`runId`, `complete`, `verdicts[]` with `pass`/`fail`/`unreviewed`); inputs are injected `ReviewObservation` `{repoKey, pullRequest, verdicts[]}` per DEC-17 | TC-XREV-001…TC-XREV-006, TC-XPAR-003 | Covered |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement | TC ID(s) | Status |
|--------|-------------|----------|--------|
| NFR-1 | Envelope continuity (five fields, keys under `data`, no `ok`/`command` top level) | TC-XCTR-001, TC-XCTR-005 | Covered |
| NFR-2 | Determinism, declared order, bounds, blocker never truncated | TC-XBOUND-001…TC-XBOUND-004, TC-XDOD-007 | Covered |
| NFR-3 | Offline/hermetic default tests (real local temp repos, injected facts) | TC-XHERM-001, TC-XHERM-002 | Covered |
| NFR-4 | Read-only posture (0 plan writes, 1 gate-verification append, 0 closeout plan-mode writes) | TC-XCTR-002, TC-XCLOSE-004 | Covered |
| NFR-5 | Unavailable/absent never green and always recorded | TC-XDOD-003, TC-XDOD-004, TC-XDOD-005 | Covered |
| NFR-6 | Bounded per-member reads (≤1 open-PR page, ≤1 detail, ≤1 check-run page per member; 0 retries, 0 pagination; no call outside the declared member set) | TC-XCTR-006, TC-XDOD-005, TC-XHERM-001 | Covered |
| NFR-7 | Identity reuse (0 new error rows, 0 new domain kinds) | TC-XCTR-007, TC-XCTR-003 | Covered |
| NFR-8 | Single-repository parity | TC-XPAR-001, TC-XPAR-002, TC-XPAR-003 | Covered |
| NFR-9 | Gate battery and commit hygiene | TC-XGATE-001 (verification-only) | Covered (gate evidence) |

### 3.4 Traceability Reconciliation

| Count | Value | Derivation |
|-------|-------|------------|
| ACs declared in §17 | 37 | AC-F1-1..6 (6) + AC-F2-1..5 (5) + AC-F3-1..8 (8) + AC-F4-1..2 (2) + AC-F5-1..4 (4) + AC-F6-1..4 (4) + AC-F7-1 (1) + AC-NFR1-1..AC-NFR7-1 (7) |
| ACs covered | 37 / 37 | Every AC row above names at least one TC; 0 TODO |
| ACs covered by automated test code | 36 / 37 | All except AC-NFR5-1 |
| ACs covered by gate evidence only | 1 / 37 | AC-NFR5-1 → TC-XGATE-001 (verification-only) |
| TCs declared | 51 | See §5.1 and §7 |
| TCs automated | 50 | All except TC-XGATE-001 |
| TCs verification-only | 1 | TC-XGATE-001 |
| Orphan TCs (no AC citation) | 0 | Each TC's Related IDs include at least one AC |
| TC IDs per family | XPLAN 7 · XQUEUE 6 · XDOD 9 · XDEP 2 · XCLOSE 4 · XREV 6 · XPAR 3 · XCTR 7 · XHERM 2 · XBOUND 4 · XGATE 1 | Sum 51 |

Spec v1.1 closed every prior gap: AC-F1-5/AC-F1-6 now own the missing-field and `repoKey`-grammar cases, AC-F2-5 owns per-member release, AC-F3-7 owns the unresolvable gate identifier, AC-F3-8 owns the evidence element and PR-less omission, AC-F6-4 owns the `ReviewObservation` seam, and AC-NFR6-1/AC-NFR7-1 own bounded reads and identity reuse. Every TC therefore cites a §17 criterion; no TC relies on a "nearest AC" exception any more.

## 4. Test Types and Layers

Per `.ai/rules/testing-strategy.md`, this is a TypeScript workspace behaviour change. Five layers apply:

- **Unit / pure-domain (bun:test):** plan member parsing and bounds, member-ref derivation/canonicalization, evidence and verdict derivation, review-flow digest, closeout member projection — exercised as pure functions through the domain exports with no I/O, no clock, no environment. Files: `tests/behaviour/plan-members*.test.ts`, `tests/behaviour/queue-member-ref.test.ts`, `tests/behaviour/closeout-members.test.ts` (domain half), `tests/behaviour/verify-gates-review-flow.test.ts` (pure half).
- **Behaviour / CLI integration (bun:test):** the observable CLI surfaces (`plan validate`, `lint plan`, `verify gates`, `closeout`, `queue`, `lanes`) through the delivered composition (`runCli`, `runVerify`) with an explicit fixture working directory, two real temporary member repositories, and injected provider/observation ports. Files: `tests/behaviour/*-members*.test.ts`, `tests/behaviour/cross-repository-{parity,determinism,readonly}.test.ts`.
- **Structure / contract (bun:test):** envelope shape, closed vocabularies, error-table and domain-kind identity reuse, consumer tolerance. Files: `tests/structure/cross-repository-contract.test.ts` plus extensions to `envelope-contract.test.ts`, `error-table.test.ts`, `event-state-additivity.test.ts`.
- **Golden / parity (bun:test):** committed normalized payloads for both the member form (new) and the member-less form (pre-change reference), compared byte-for-byte (Section 6.4). Files: `tests/golden/cross-repository-members.test.ts` plus the existing `tests/golden/{plan-text,verify-gates,closeout-envelope,closeout-human,queue-list,queue-plan,lanes-list}.test.ts` read unchanged for parity.
- **Checks / invariants (bun:test, `scripts/checks` adjacency):** hermeticity (network/no-spawn guards, sanitized git env, fixture `--show-toplevel` self-containment), fixture sanitization/privacy, error-table sync, exit-code literals. Files: `tests/checks/cross-repository-hermetic.test.ts`, extensions to `tests/checks/fixture-sanitization.test.ts`, `tests/checks/error-table-sync.test.ts`.
- **Gate-level (verification-only):** `TMPDIR=/home/juliusz/tmp GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=commit.gpgsign GIT_CONFIG_VALUE_0=false pnpm check` and `./scripts/lint-commit-range.sh --base <base>` recorded in pm-notes; no new test code.

Golden normalization convention: envelope `runId` and `timing` are the only keys normalized out (they are injected constants or clocks); a normalizer must be asserted to replace only those keys. Member-form `reviewFlow.runId` is a deterministic digest and **is pinned in the golden**, never normalized. Human output is compared as raw bytes. Exits are compared exactly.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Priority | AC Coverage |
|-------|-------|------|-------|----------|-------------|
| TC-XPLAN-001 | Two-member `members[]` validates, echoes verbatim in declared order, one spec/one plan (SC-M2-S19-01) | Happy Path | Automated | Critical | AC-F1-1 |
| TC-XPLAN-002 | Five member-declaration defects classify as `plan.schema.invalid` in validate and lint | Negative | Automated | Critical | AC-F1-2, AC-F4-2 |
| TC-XPLAN-003 | Member bounds rejected at the declared limits (members, edges, gates, member-ref length) | Negative | Automated | Critical | AC-F1-4 |
| TC-XPLAN-004 | Closed member field set: missing/empty fields and malformed `repoKey` are classified, never accepted | Negative | Automated | High | AC-F1-2, AC-F1-5, AC-F1-6 |
| TC-XPLAN-005 | Gate identifiers are shape-validated only; plan validation reads no configuration | Edge Case | Automated | High | AC-F1-1, AC-F3-7 |
| TC-XPLAN-006 | Required-field and empty-value defects: missing `repoKey`/`slice`/`branch`/`gates`, empty `slice`/`branch`, empty `dependsOn` element (AC-F1-5) | Negative | Automated | Critical | AC-F1-5 |
| TC-XPLAN-007 | `repoKey` grammar: non-matching rejected naming `members[i].repoKey`; matching accepted and echoed verbatim (AC-F1-6) | Negative | Automated | Critical | AC-F1-6 |
| TC-XQUEUE-001 | Two member entries, separate repositories and lanes, no bare-ref entry (SC-M2-S19-01) | Happy Path | Automated | Critical | AC-F2-1 |
| TC-XQUEUE-002 | Per-member dependency edge makes B `not-ready`/`dependency-open`, A unaffected (SC-M2-S19-05) | Happy Path | Automated | Critical | AC-F2-2 |
| TC-XQUEUE-003 | A lands: one removal for A's member ref with reason `landed`, B retained and re-evaluated | Happy Path | Automated | Critical | AC-F2-3 |
| TC-XQUEUE-004 | Member-ref canonicalization extended; delivered `<PREFIX>-<digits>` form unchanged | Contract | Automated | Critical | AC-F2-4 |
| TC-XQUEUE-005 | Per-member lease release keeps entries; no cross-repository lane | Edge Case | Automated | High | AC-F2-1, AC-F2-3, AC-F2-5 |
| TC-XQUEUE-006 | Per-member release: release B while A's lease is held elsewhere; exactly B released, both entries retained, A unchanged (AC-F2-5) | Happy Path | Automated | Critical | AC-F2-5 |
| TC-XDOD-001 | Both members pass: `green`, two ordered member entries, empty blockers, evidence both PRs, exit 0 (SC-M2-S19-03) | Happy Path | Automated | Critical | AC-F3-1 |
| TC-XDOD-002 | Member gate failure: `blocked`, blocker equals the failing member, exit 1 (SC-M2-S19-02) | Negative | Automated | Critical | AC-F3-2 |
| TC-XDOD-003 | Unavailable CI: `unavailable`/`unknown`, blocker named, never green, exit 1 (SC-M2-S19-04) | Negative | Automated | Critical | AC-F3-3 |
| TC-XDOD-004 | Absent evidence (no pushed head, no `pullRequest`, or no run): `incomplete`, `absent`, blocker named, exit 1 | Edge Case | Automated | Critical | AC-F3-4 |
| TC-XDOD-005 | No cross-member CI reuse; per-member reads are bounded and recorded | Negative | Automated | Critical | AC-F3-5, AC-NFR6-1 |
| TC-XDOD-006 | Unresolvable declared gate identifier → member `unknown`, status `blocked` | Negative | Automated | High | AC-F3-7 |
| TC-XDOD-007 | Evidence ordering is the pinned landing rule and stable on repeat (SC-M2-S19-05) | Edge Case | Automated | Critical | AC-F3-6, AC-F3-8, AC-NFR2-1 |
| TC-XDOD-008 | No invented gate verdict: no gate record attributes `pass` to an unresolved declared identifier (AC-F3-7) | Negative | Automated | Critical | AC-F3-7 |
| TC-XDOD-009 | Evidence element shape `{repoKey, pullRequest, landed, landingPosition?}` and PR-less omission (AC-F3-8) | Contract | Automated | Critical | AC-F3-8 |
| TC-XDEP-001 | Start on B is refused `queue.precondition.unmet` naming B and A; admitted after A lands | Negative | Automated | Critical | AC-F4-1 |
| TC-XDEP-002 | Member-ref cycle: queue mutation `queue.dependency-cycle`; plan cycle caught at validation | Negative | Automated | Critical | AC-F4-2 |
| TC-XCLOSE-001 | Both merged: two ordered member entries, six fields each, `landed: true`, per-member removal (SC-M2-S19-01) | Happy Path | Automated | Critical | AC-F5-1 |
| TC-XCLOSE-002 | Partial landing: A landed/B not, B retained or disclosed with a skip reason, nothing claims B landed | Edge Case | Automated | Critical | AC-F5-2 |
| TC-XCLOSE-003 | Unsafe squash predicate: delivered refuse value, branch not deleted, `landed` stays merge truth | Negative | Automated | Critical | AC-F5-3 |
| TC-XCLOSE-004 | Closeout plan mode reports members and writes nothing | Happy Path | Automated | High | AC-F5-1, AC-NFR4-1 |
| TC-XREV-001 | One review run: one verdict per member in order, `complete: true`, stable `runId` (SC-M2-S19-01) | Happy Path | Automated | Critical | AC-F6-1 |
| TC-XREV-002 | Duplicated review observation: `fail`, `complete: false`, one entry only | Negative | Automated | Critical | AC-F6-2 |
| TC-XREV-003 | Member set changed between runs: `runId` differs, no stale verdict entry | Edge Case | Automated | High | AC-F6-3 |
| TC-XREV-004 | Unobserved member: `unreviewed`, `complete: false`, one entry | Edge Case | Automated | High | AC-F6-1 |
| TC-XREV-005 | Review verdicts come from injected `ReviewObservation` values only; no store, command, or live call (DEC-17) | Contract | Automated | Critical | AC-F6-1, AC-NFR1-1 |
| TC-XREV-006 | `ReviewObservation` mapping: each verdict derives from that member's own observation; no `pass` without a matching observation (AC-F6-4) | Contract | Automated | Critical | AC-F6-4 |
| TC-XPAR-001 | Plan surfaces parity: member-less validate/lint/diff/overlap byte-identical, no `members` key | Regression | Automated | Critical | AC-F1-3 |
| TC-XPAR-002 | Closeout parity: member-less plan and apply byte-identical, no `members` key | Regression | Automated | Critical | AC-F5-4 |
| TC-XPAR-003 | Gates and queue parity: delivered report/projection and exits byte-identical, no member keys | Regression | Automated | Critical | AC-F7-1 |
| TC-XCTR-001 | Envelope continuity on every touched surface: five fields, keys under `data`, zero `ok`/`command` | Contract | Automated | Critical | AC-NFR1-1 |
| TC-XCTR-002 | Read-only posture: 0 plan writes, 1 gate-verification append, 0 closeout plan-mode writes | Negative | Automated | Critical | AC-NFR4-1 |
| TC-XCTR-003 | Identity reuse: 0 new error rows, 0 new domain kinds, delivered refusal identities only | Contract | Automated | Critical | AC-F1-2, AC-F4-2, AC-NFR7-1 |
| TC-XCTR-004 | Consumer tolerance: additive fields tolerated; members resolved by `repoKey`, steps by `stepId` | Contract | Automated | High | AC-F5-1, AC-NFR1-1 |
| TC-XCTR-005 | Closed vocabularies and pinned literals exported exactly once | Contract | Automated | High | AC-F1-1, AC-F3-3, AC-NFR1-1 |
| TC-XCTR-006 | Read budget per declared member: ≤1 page/detail/check-run each, 0 retries, 0 pagination, 0 out-of-set calls (AC-NFR6-1) | Contract | Automated | Critical | AC-NFR6-1 |
| TC-XCTR-007 | Error-table row count and domain-kind membership unchanged; no new identity string; every refusal resolves (AC-NFR7-1) | Contract | Automated | Critical | AC-NFR7-1 |
| TC-XHERM-001 | Default suite: two real temp member repos, injected facts, 0 network/second remote/credentials | Contract | Automated | Critical | AC-NFR3-1 |
| TC-XHERM-002 | Fixture isolation: no ambient `$HOME`, no daemon, not composed from this checkout, deterministic | Contract | Automated | Critical | AC-NFR3-1 |
| TC-XBOUND-001 | Gate report repeated-run byte-identical (incl. evidence order and `reviewFlow`) | Regression | Automated | Critical | AC-NFR2-1, AC-F3-6 |
| TC-XBOUND-002 | Closeout report repeated-run byte-identical (plan and apply) | Regression | Automated | Critical | AC-NFR2-1 |
| TC-XBOUND-003 | Queue and lanes projection repeated-run byte-identical | Regression | Automated | Critical | AC-NFR2-1 |
| TC-XBOUND-004 | Eight-member report within 65 536 bytes; `blockingMembers[]` never truncated | Edge Case | Automated | Critical | AC-NFR2-1 |
| TC-XGATE-001 | Gate battery and commit hygiene at delivered HEAD (verification-only) | Regression | Verification-only | Critical | AC-NFR5-1 |

### 5.2 Scenario Details

#### TC-XPLAN-001 - Two-member `members[]` validates, echoes verbatim in declared order, one spec/one plan

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, AC-F7-1, DM-1, DoD-1, DEC-1, SC-M2-S19-01
**Test Type(s)**: Integration (CLI) + Contract (echo shape)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/plan-members.test.ts`; echo golden in `tests/golden/cross-repository-members.test.ts`; fixtures in `tests/fixtures/cross-repository/{plan,two-members}.ts`
**Tags**: @bun, @behaviour, @plan, @member

**Preconditions**:

- Two real member checkouts created in one case root (`api`, `web`) with durable `repoKey`s minted by the delivered scope policy.
- One change folder containing exactly one spec and one plan; the plan declares `members[]` with two entries, each with `repoKey`, `slice`, `branch`, `pullRequest`, `dependsOn[]` (`web` → `api`), and `gates` (2–3 identifiers).

**Steps**:

1. Write the plan via the fixture builder and record the exact declared member objects.
2. Run `plan validate <ref> --json`.
3. Assert `verdict: valid`, `readyForDevelopment: true`, exit `0`.
4. Assert `data.members[]` has exactly two entries in declared order; each carries exactly the declared field names with the declared values (`pullRequest` included because declared); no extra/missing field.
5. Assert the member echo is byte-identical on a second run over the unchanged plan.
6. Assert the change folder inventory contains one `chg-<ref>-spec.md` and one `chg-<ref>-plan.yaml`; no per-member folder exists.

**Expected Outcome**:

- The declaration is parsed, validated, and echoed verbatim in declared order; one lifecycle artifact set exists (ticket AC1).

**Notes / Clarifications**:

- `slice` is descriptive only (OQ-1); the case includes a slice string that resembles a path and asserts it is echoed, never used as a scope matcher.

#### TC-XPLAN-002 - Five member-declaration defects classify as `plan.schema.invalid` in validate and lint

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-4, AC-F1-2, AC-F4-2, DM-1, DoD-2, DEC-1, DEC-7
**Test Type(s)**: Integration (CLI) + Contract (error identities/locations)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/plan-members.test.ts`; fixture table in `tests/fixtures/plan/members-invalid/`; extends `tests/behaviour/plan-validate-rejections.test.ts` patterns
**Tags**: @bun, @behaviour, @plan, @member, @negative

**Preconditions**:

- A valid two-member baseline plan (TC-XPLAN-001).

**Steps**:

1. For each of the five defect cases, one plan variant: duplicate `repoKey`; `dependsOn` naming no declared member; self edge; two-member dependency cycle; unknown member key inside an entry.
2. Run `plan validate <ref> --json`; assert verdict `invalid`, `readyForDevelopment: false`, exit `1`.
3. Assert the error is exactly the delivered `plan.schema.invalid` and its detail names `members[i].<field>` with the offending member position and field.
4. Assert no member is echoed as valid: `data.members[]` omits the invalid entry (or the payload contains no `members` echo for an invalid plan) and no member appears twice.
5. Run `lint plan <ref> --json`; assert the same defect set is reported with a document location (member index/field) and exit `1`.
6. Run every variant twice; assert identical payload bytes (deterministic classification).

**Expected Outcome**:

- Every declared defect is classified with the delivered identity, its member position and field, and a lint location; nothing invalid is echoed as valid.

**Notes / Clarifications**:

- AC-F4-2's plan-cycle half is proven here (the cycle never reaches a queue write); the queue half is TC-XDEP-002.
- Exact `location` field naming follows the delivered lint structure (`location.phase`/`location.field` extended with a member index); the plan pins the member-position field name.

#### TC-XPLAN-003 - Member bounds rejected at the declared limits

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-4, DM-1, DM-6, NFR-2, DEC-10
**Test Type(s)**: Integration (CLI) + Unit (derivation bound)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/plan-members-bounds.test.ts`; fixtures in `tests/fixtures/plan/members-bounds/`
**Tags**: @bun, @behaviour, @plan, @member, @bounds

**Preconditions**:

- The valid baseline plan; a synthetic canonical change ref long enough to make the derived member ref exceed 64 characters while remaining a valid canonical ref.

**Steps**:

1. Nine members (one over the eight cap) → `plan.schema.invalid` naming the ninth position and `members`; exit `1`.
2. One member with nine `dependsOn` entries → `plan.schema.invalid` naming `members[i].dependsOn`; exit `1`.
3. One member with seventeen `gates` → `plan.schema.invalid` naming `members[i].gates`; exit `1`.
4. A derived member ref of 65 characters (canonical ref + `@` + `repoKey`) → `plan.schema.invalid` naming `members[i].repoKey` (or the derived-ref field) and exit `1`.
5. Boundary acceptance pair: exactly 8 members, exactly 8 `dependsOn`, exactly 16 gates, and a derived member ref of exactly 64 characters each validate (`valid`, exit `0`), proving the bound is inclusive at the limit.
6. Assert every rejection uses only `plan.schema.invalid` and names the member position and field.

**Expected Outcome**:

- The same bound applies on the plan surface; a declaration cannot validate where it cannot be represented; at-bound values are accepted.

#### TC-XPLAN-004 - Closed member field set: missing/empty fields and malformed `repoKey` are classified

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1, AC-F1-2, AC-F1-5, AC-F1-6, DM-1, DoD-2, DEC-1, DEC-15
**Test Type(s)**: Integration (CLI) + Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/plan-members.test.ts`; `tests/structure/cross-repository-contract.test.ts` (field-set assertion)
**Tags**: @bun, @behaviour, @plan, @member, @negative

**Preconditions**:

- The valid baseline plan.

**Steps**:

1. Variants: missing `repoKey`; missing `slice`; empty `slice`; missing `branch`; empty `branch`; missing `gates`; empty `gates`; a `repoKey` that does not match the delivered `repoKey` grammar (e.g., uppercase, missing the eight-hex suffix, embedded space).
2. Run `plan validate` and `lint plan` for each variant.
3. Assert each is `plan.schema.invalid` naming the member position and field, verdict `invalid`, exit `1`; assert no variant passes.
4. Assert an entry with only the six declared field names is accepted, and any seventh (unknown) key is rejected as `plan.schema.invalid` (closed over member fields, DEC-1).

**Expected Outcome**:

- The member entry is closed: exactly the six declared fields, non-empty where required, `repoKey` shaped as a member repository key.

**Notes / Clarifications**:

- AC-F1-5 and AC-F1-6 now own the missing/empty-field and `repoKey`-grammar cases; this TC keeps the combined closed-field-set probe, while TC-XPLAN-006 and TC-XPLAN-007 assert each criterion's exact expectation and the lint location. `repoKey` must match the DEC-15 grammar `^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?-[0-9a-f]{8}$`; the required set is `repoKey`, `slice`, `branch`, `gates`, and `dependsOn` is optional but may not contain an empty element.

#### TC-XPLAN-005 - Gate identifiers are shape-validated only; plan validation reads no configuration

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1, AC-F1-1, AC-F3-7, DEC-1, DEC-9
**Test Type(s)**: Integration (CLI) + Unit (read poster)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/plan-members.test.ts`; read audit extends `tests/behaviour/plan-readonly.test.ts`
**Tags**: @bun, @behaviour, @plan, @member, @readonly

**Preconditions**:

- A plan whose member `gates` include an identifier the effective gate set does not declare (e.g., `custom-member-check`), plus a malformed gate identifier (empty string) for contrast.
- No configuration file present, then a configuration file present that would resolve a differently-named gate.

**Steps**:

1. Validate the plan with the unresolvable-but-well-formed gate identifier; assert `valid`, exit `0` (no configuration read, no rejection).
2. Run with the configuration file present and with it absent; assert the plan verdict is byte-identical (configuration is not consulted).
3. Validate the malformed gate identifier (empty/non-string); assert `plan.schema.invalid` naming `members[i].gates`.
4. Wrap the runtime with a configuration-read recorder; assert zero configuration reads during `plan validate`.

**Expected Outcome**:

- `plan validate` shape-checks only; capability resolution is deferred to `verify gates` (proven by TC-XDOD-006).

#### TC-XPLAN-006 - Required-field and empty-value defects are classified (AC-F1-5)

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-5, DM-1, DoD-2 (per §17.1 v1.1 coverage note), DEC-15
**Test Type(s)**: Integration (CLI) + Contract (error identity/location)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/plan-members.test.ts`; fixture table in `tests/fixtures/plan/members-required/`
**Tags**: @bun, @behaviour, @plan, @member, @negative

**Preconditions**:

- A valid two-member baseline plan (TC-XPLAN-001).

**Steps**:

1. One variant each: missing `repoKey`; missing `slice`; missing `branch`; missing `gates`; `slice: ""`; `branch: ""`; `gates: []`; `dependsOn: [""]`; `dependsOn` present but not an array.
2. Run `plan validate <ref> --json` for each variant; assert `invalid`, `readyForDevelopment: false`, exit `1`, and the error is `plan.schema.invalid` naming `members[i].<field>` with the offending position and field.
3. Run `lint plan <ref> --json` for each variant; assert the same defect with a document location (member index/field) and exit `1`.
4. Assert no default value is invented: the payload for a missing `slice`/`branch` does not echo a synthesised empty or fallback string, and the invalid entry is not echoed as valid.
5. Assert a correctly populated entry with `dependsOn` omitted (no edges) validates and echoes with no `dependsOn` key, proving optionality without a default.

**Expected Outcome**:

- Every missing required field and empty value is a classified `plan.schema.invalid` with its member position and field; nothing is defaulted.

**Notes / Clarifications**:

- The required set and the empty-string rule are DEC-15; `gates: []` is covered by the 1..16 lower bound as well as AC-F1-5's non-empty rule.
- The plan must pin the lint location's member-position field name (the same field as TC-XPLAN-002).

#### TC-XPLAN-007 - `repoKey` grammar: non-matching rejected, matching accepted and echoed (AC-F1-6)

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-6, DM-1, DoD-2 (per §17.1 v1.1 coverage note), DEC-15
**Test Type(s)**: Integration (CLI) + Unit (grammar predicate)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/plan-members.test.ts`; `tests/fixtures/plan/members-grammar/` fixture table
**Tags**: @bun, @behaviour, @plan, @member, @grammar

**Preconditions**:

- The valid two-member baseline; a fixture `repoKey` minted by `createMemberCheckout` (guaranteed to match the delivered grammar).

**Steps**:

1. Negative variants: missing the eight-hex suffix; uppercase prefix; leading hyphen; trailing hyphen; embedded space; only a basename with no suffix; a 9-hex suffix; an underscore. For each, run `plan validate`; assert `plan.schema.invalid` naming `members[i].repoKey` at exit `1`.
2. Run `lint plan` for each negative variant; assert the same identity with a location.
3. Positive boundary variants: a minimal matching key (`a-00000000`), a multi-segment key (`api-service-1a2b3c4d`), and the fixture's minted `repoKey`; assert `valid`, exit `0`, and `data.members[i].repoKey` equals the declared string verbatim (no normalisation, no lowercasing).
4. Assert the grammar is the single DEC-15 literal (the same regular expression as the delivered repo-key grammar), not a second vocabulary.

**Expected Outcome**:

- Only a key matching the delivered repo-key grammar is accepted; a matching key is echoed byte-for-byte.

**Notes / Clarifications**:

- The grammar is checked at authoring (DEC-15/AC-F1-6); group membership resolution still happens elsewhere and is not read by `plan validate`.

#### TC-XQUEUE-001 - Two member entries, separate repositories and lanes, no bare-ref entry

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-1, DM-6, DoD-3, DEC-2, SC-M2-S19-01
**Test Type(s)**: Integration (CLI) + Contract (identity)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-members.test.ts`; fixtures in `tests/fixtures/queue/members/`
**Tags**: @bun, @behaviour, @queue, @lanes, @member

**Preconditions**:

- A two-member plan with member `repoKey`s `apiKey` and `webKey`; two real member checkouts; the change queued through the delivered path.

**Steps**:

1. Queue the change and run `queue list --json`.
2. Assert exactly two entries with refs `<canonicalChangeRef>@<apiKey>` and `<canonicalChangeRef>@<webKey>`; no entry keyed by the bare change ref.
3. Assert each entry carries its own `repository` binding (each member's own repository key), never the other member's.
4. Run `lanes list --json`; assert one lane per member ref and no lane whose ref is the bare change ref or spans both members.
5. Assert declared order is preserved where the projection declares an order, and the projection is stable on a second read.

**Expected Outcome**:

- One entry and one lane per member, each bound to its own repository; no cross-repository lane.

#### TC-XQUEUE-002 - Per-member dependency edge makes B `not-ready`/`dependency-open`, A unaffected

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-4, AC-F2-2, DM-6, DoD-3, DEC-7, SC-M2-S19-05
**Test Type(s)**: Integration (CLI) + Unit (readiness)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-members.test.ts`; extends `tests/behaviour/queue-readiness.test.ts`
**Tags**: @bun, @behaviour, @queue, @member, @readiness

**Preconditions**:

- Member `web` declares `dependsOn: [apiKey]`; `api`'s pull request is unlanded; both entries exist.

**Steps**:

1. `queue list --json`: assert `web`'s entry's `deps` contains exactly `api`'s member ref and no other edge is invented.
2. Assert `web`'s entry state is `not-ready` and its blocking reasons include the delivered `dependency-open` naming `api`'s member ref.
3. Assert `api`'s entry is unaffected (no dependency blocking, its own readiness is independent).
4. `lanes list --json`: assert both lanes exist and the dependency is not materialized as a lane.
5. Repeat the read; assert byte-identical projection.

**Expected Outcome**:

- The declared edge is materialized on the member refs, readiness is per member, and the prerequisite member is not penalized.

#### TC-XQUEUE-003 - A lands: one removal for A's member ref with reason `landed`, B retained and re-evaluated

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-5, AC-F2-3, DM-6, DoD-3, OQ-5
**Test Type(s)**: Integration (CLI) + Contract (removal records)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-members-removal.test.ts`; extends `tests/behaviour/closeout-queue-removal.test.ts` / `closeout-queue-removal-skips.test.ts`
**Tags**: @bun, @behaviour, @queue, @member, @removal

**Preconditions**:

- Two member entries; an observed landing for `api`'s pull request only; `web` unlanded and dependent on `api`.

**Steps**:

1. Run the landing removal path with the injected landing observation for `api`.
2. Assert exactly one removal record exists, its `ref` is `api`'s member ref, and its reason is the delivered `landed`.
3. Assert no removal record exists for `web`'s member ref or the bare change ref.
4. Assert `web`'s entry is retained and its readiness is recomputed against the newly landed prerequisite (it no longer blocks on `dependency-open` if that was the only unmet edge).
5. Assert the whole mutation is recorded once: repeat the removal with the same observation and assert idempotence (no second removal).

**Expected Outcome**:

- A member lands independently; only its entry retires; the remaining member's readiness re-evaluates.

#### TC-XQUEUE-004 - Member-ref canonicalization extended; delivered form unchanged

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-4, DM-6, NFR-8, DEC-2
**Test Type(s)**: Unit (canonicalization) + Integration (add/read/remove/landing)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-member-ref.test.ts`; extends `tests/behaviour/queue-cli.test.ts` / `queue-graph.test.ts`
**Tags**: @bun, @unit, @queue, @member, @identity

**Preconditions**:

- Pure canonicalization export; a fixture queue harness for the CLI half.

**Steps**:

1. Unit: `<canonicalChangeRef>@<repoKey>` canonicalizes to itself and is accepted; lowercased/whitespace-padded variants normalize to the same member ref where the pin says so; an over-length member ref is `undefined`/refused.
2. Unit: the delivered form is unchanged — `GH-010` → `GH-10`, `pdev-7` → `PDEV-7` (or the delivered case rules verbatim), and over-length delivery refs remain refused.
3. Integration: add, read, remove, and landing-removal paths all accept the member ref and never emit `ref-not-canonical` for it.
4. Integration: the delivered bare-ref path still emits `ref-not-canonical` for a genuinely non-canonical ref.
5. Assert the member-ref grammar is derivable from `repoKey` alone (no extra field) and bounded by `QUEUE_MAX_REF_CHARS` (64).

**Expected Outcome**:

- Canonicalization is extended, never narrowed; the delivered form keeps its exact behavior; no delivered refusal is repurposed.

#### TC-XQUEUE-005 - Per-member lease release keeps entries; no cross-repository lane

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-2, AC-F2-1, AC-F2-3, AC-F2-5, DM-6, DoD-3, DEC-2
**Test Type(s)**: Integration (CLI)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-members.test.ts`; extends `tests/behaviour/queue-lease.test.ts` patterns
**Tags**: @bun, @behaviour, @queue, @lanes, @member

**Preconditions**:

- Two member entries; one held lease per member (single-flight per member ref).

**Steps**:

1. Claim/lease each member ref; assert two leases, one per member ref.
2. Release each member's lease in turn; assert both entries remain and each lane returns to idle, with no lease spanning both members.
3. Assert a second claim on one member ref is admitted while the other member's state is untouched (single-flight is per member ref, not per change).
4. Assert no lane record exists whose ref is the bare change ref.

**Expected Outcome**:

- Release drops leases but keeps entries; lanes are per member; admission is per member ref.

**Notes / Clarifications**:

- AC-F2-5 now owns the exact per-member release contract (one member's held lease never blocks another member's release); TC-XQUEUE-006 asserts that criterion's precise steps and results.

#### TC-XQUEUE-006 - Per-member release: release B while A's lease is held elsewhere (AC-F2-5)

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-5, DM-6, DoD-3 (per §17.1 v1.1 coverage note), DEC-2
**Test Type(s)**: Integration (CLI) + Contract (result vocabulary)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-members.test.ts`; extends the `tests/behaviour/queue-lease.test.ts` harness
**Tags**: @bun, @behaviour, @queue, @member, @release

**Preconditions**:

- A two-member change; both member entries hold a lease; member A's lease is held by another holder (a distinct holder/lease identity), member B's lease is held by the current holder.

**Steps**:

1. Run `queue release <changeRef>@<B>`.
2. Assert the result is the delivered `released` result and exactly B's lease is released.
3. Assert both entries remain present in `queue list` after the release.
4. Assert A's lease is unchanged (same holder, lease id, heartbeat/age semantics) and A's entry is untouched.
5. Assert A's held lease did not block B's release: no `lease-held`/precondition refusal appears for the cross-member case.
6. Assert no state was written for the bare change ref and no cross-repository lane/lease appears.
7. Retry the same release; assert the delivered idempotent/repeat result and that A is still unchanged.

**Expected Outcome**:

- Release addresses exactly one member ref; one member's lease state never blocks another member's release; both entries persist.

**Notes / Clarifications**:

- The release is keyed to the member ref, not the bare change ref (DEC-2); if the delivered release verb rejects the member form, that is a defect against AC-F2-4 and AC-F2-5 together.

#### TC-XDOD-001 - Both members pass: `green`, two ordered member entries, empty blockers, both PRs in evidence, exit 0

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1, DM-2, DM-3, DoD-4, DEC-11, SC-M2-S19-03
**Test Type(s)**: Integration (CLI) + Contract (report shape)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-members.test.ts`; golden in `tests/golden/cross-repository-members.test.ts`; facts in `tests/fixtures/cross-repository/facts.ts`
**Tags**: @bun, @behaviour, @gates, @member, @golden

**Preconditions**:

- A two-member plan; each member has a pushed head and a declared `pullRequest`; the injected facts make every declared gate pass on `api`'s head and on `web`'s head.

**Steps**:

1. Run `verify gates <ref> --json`.
2. Assert `data.definitionOfDone.status: green`; `members[]` has exactly two entries in declared order, each `{repoKey, gates.ci: "pass", verdict: "pass"}`; `data.blockingMembers[]` is empty.
3. Assert `data.evidence[]` carries both member pull requests and their `repoKey`s.
4. Assert exit `0` and that the report data is present.
5. Assert the committed member-form golden equals the serialized `data` (normalized only for envelope `runId`/`timing`).

**Expected Outcome**:

- `green` means every declared member passed on its own head; both pull requests are visible in landing order; exit 0.

#### TC-XDOD-002 - Member gate failure: `blocked`, blocker equals the failing member, exit 1

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-2, DM-2, DEC-3, DEC-11, SC-M2-S19-02
**Test Type(s)**: Integration (CLI)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-members.test.ts`
**Tags**: @bun, @behaviour, @gates, @member, @negative

**Preconditions**:

- `api` passes every declared gate; `web` fails exactly one declared gate; no unavailable reading.

**Steps**:

1. Run `verify gates <ref> --json`.
2. Assert `status: blocked`, `blockingMembers[]` equals exactly `[webKey]` (declared order preserved for multiple blockers).
3. Assert `web`'s member entry is `verdict: fail` and `api`'s is `verdict: pass`.
4. Assert the report data is present (not a failure envelope) and exit `1`.
5. Assert the failing gate is attributed to `web` only (no cross-member propagation).

**Expected Outcome**:

- A failing member blocks the shared definition of done and is named; the failing evidence stays with the member.

#### TC-XDOD-003 - Unavailable CI: `unavailable`/`unknown`, blocker named, never green, exit 1

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-3, DM-3, NFR-5, DEC-3, DEC-4, DEC-11, SC-M2-S19-04
**Test Type(s)**: Integration (CLI)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-members.test.ts`
**Tags**: @bun, @behaviour, @gates, @member, @fail-closed

**Preconditions**:

- Both members have pushed heads and declared pull requests; `api` passes; `web`'s check-run read fails with the classified provider failure (injected), i.e. a reading failure, not a failed run.

**Steps**:

1. Run `verify gates <ref> --json`.
2. Assert `web`'s `gates.ci: unavailable` and `verdict: unknown`; assert it is never `pass`.
3. Assert `blockingMembers[]` contains `webKey`; assert `status` is not `green` (must be `blocked`).
4. Assert report data present and exit `1`.
5. Repeat the run with the same unavailable fact; assert identical bytes (unavailability is deterministic).

**Expected Outcome**:

- An unreadable CI reading blocks as a classified outcome; absence of evidence never counts as a pass.

#### TC-XDOD-004 - Absent evidence: `incomplete`, `absent`, blocker named, exit 1

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-4, DM-2, DM-3, NFR-5, DEC-3, DEC-5, DEC-11
**Test Type(s)**: Integration (CLI)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-members-evidence.test.ts`
**Tags**: @bun, @behaviour, @gates, @member, @boundary

**Preconditions**:

- Two members; neither is negative and neither reading is unavailable. Variant A: `web` has no pushed head. Variant B: `web` declares no `pullRequest` (missing at authoring). Variant C: `web` has a pushed head but no run for that head.

**Steps**:

1. For each variant, run `verify gates <ref> --json`.
2. Assert `web`'s `gates.ci: absent`; assert its `verdict` is not `pass` (`unknown`).
3. Assert `data.definitionOfDone.status: incomplete`, `blockingMembers[]` contains `webKey`, data present, exit `1`.
4. Assert `api`'s entry is unaffected and remains `pass`.
5. Assert the difference from TC-XDOD-003 is observable in data (`incomplete` + `absent` vs `blocked` + `unavailable`).

**Expected Outcome**:

- Missing evidence is a first-class non-green state, distinct from a negative or unreadable one, and still names the blocker.

**Notes / Clarifications**:

- DEC-4 now gives one definition of `absent` — CI truth could not be established for any reason (no pushed head, no declared pull request, or no run for the head) — and AC-F3-4 is aligned to it. The `pullRequest`-less member's evidence omission is asserted separately in TC-XDOD-009 (DEC-16).

#### TC-XDOD-005 - No cross-member CI reuse; per-member reads are bounded and recorded

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-5, AC-F3-1 (read shape), AC-NFR6-1, NFR-5, DEC-4, DEC-10
**Test Type(s)**: Integration (CLI) + Contract (read budget)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-members.test.ts`; read budget extends `tests/behaviour/verify-gates-read-budget.test.ts`; guards from `tests/fixtures/verify-gates/cases/{network-guard,harness}.ts` and `tests/fixtures/result/no-spawn-guard.ts`
**Tags**: @bun, @behaviour, @gates, @member, @read-budget

**Preconditions**:

- A recording runtime wrapping every read seam with distinct heads per member; `api` passes, `web`'s reading is unavailable; each member has a distinct head SHA.

**Steps**:

1. Run `verify gates <ref> --json` through the recording runtime.
2. Assert `readOpenPullRequests` and `readDeliveryRequestDetail` are called at most once per member (≤2 each total), with each member's own pull-request identity; `readCheckRuns` is called at most once per member's own head SHA and never with another member's head.
3. Assert `web`'s `gates.ci` is never `pass` and its `verdict` is `unknown`; `api` remains `pass` (no cross-member reuse of a verdict).
4. Assert zero retries (no repeated call for the same source+identity) and no pagination beyond the delivered page limit (100).
5. Assert the no-network and no-spawn guards record zero calls.

**Expected Outcome**:

- Each member's CI verdict comes only from that member's head; the per-member read extension is bounded, retry-free, and pagination-free.

**Notes / Clarifications**:

- AC-NFR6-1 now owns the bounded-read criterion; TC-XCTR-006 asserts the exact call counts, the zero-retry/zero-pagination rule, and the no-out-of-set-call rule over a counting transport, while this TC focuses on per-member provenance and the absence of cross-member reuse.

#### TC-XDOD-006 - Unresolvable declared gate identifier → member `unknown`, status `blocked`

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1, F-3, AC-F3-7, DEC-3, DEC-4, DEC-9
**Test Type(s)**: Integration (CLI)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-members.test.ts`
**Tags**: @bun, @behaviour, @gates, @member, @negative

**Preconditions**:

- A two-member plan whose `web` member declares a well-formed gate identifier absent from the effective gate set; `api` passes; no member is negative or unavailable otherwise.

**Steps**:

1. Run `verify gates <ref> --json`.
2. Assert `web`'s `verdict: unknown` (never `pass`) and that its `gates.ci` remains a reading value (not fabricated).
3. Assert `status: blocked` and `blockingMembers[]` contains `webKey`; exit `1`.
4. Assert the unresolvable identifier is reported as that member's evidence, not as a command failure (no failure envelope).
5. Assert the plan itself validated earlier (TC-XPLAN-005), proving resolution belongs to `verify gates`.
6. Assert `blockingMembers[]` order follows declared order when a second member is also unresolved.

**Expected Outcome**:

- An unresolvable declared gate cannot pass silently; it degrades its member to `unknown` and blocks the change.

**Notes / Clarifications**:

- AC-F3-7 owns this behaviour. TC-XDOD-008 asserts the sibling guarantee that no gate record anywhere attributes `pass` to the unresolved identifier.

#### TC-XDOD-007 - Evidence ordering is the pinned landing rule and stable on repeat

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-6, AC-NFR2-1, DM-4, DoD-6, DEC-6, SC-M2-S19-05
**Test Type(s)**: Integration (CLI) + Unit (ordering)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-members-evidence.test.ts`
**Tags**: @bun, @behaviour, @gates, @member, @ordering

**Preconditions**:

- Three members declared `[api, web, docs]` with observed landing positions: `docs` landed at position 1, `api` landed at position 2, `web` unlanded.

**Steps**:

1. Evaluate the shared verdict; assert `evidence[]` order is `docs`, `api`, `web` (landed by ascending landing position, then unlanded in declared order).
2. Assert ties break by declared order: two members observed at the same landing position keep declared order.
3. Assert each entry carries exactly `{repoKey, pullRequest, landed}` plus `landingPosition` only when `landed` is true (DEC-16); assert `landingPosition` is 1-based, ascending across landed entries, and absent on unlanded entries.
4. Repeat over unchanged facts; assert the serialized evidence is byte-identical.
5. Reverse the input observation enumeration order (not the declared order); assert the evidence order is unchanged (ordering is derived, not input-order dependent).

**Expected Outcome**:

- The landing rule is deterministic, justified by an element value (`landingPosition`), and does not depend on observation enumeration order.

**Notes / Clarifications**:

- The element shape is pinned by DEC-16 and asserted in full by TC-XDOD-009, which also covers the PR-less omission (AC-F3-8).

#### TC-XDOD-008 - No invented gate verdict for an unresolved declared identifier (AC-F3-7)

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-7, DM-2, DM-3, DEC-4, DEC-9
**Test Type(s)**: Integration (CLI) + Contract (gate-record audit)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-members.test.ts`
**Tags**: @bun, @behaviour, @gates, @member, @fail-closed

**Preconditions**:

- A two-member plan where `web` declares one resolvable gate and one unresolvable identifier (well-formed, absent from the effective gate set); `api` passes all its gates.

**Steps**:

1. Run `verify gates <ref> --json`.
2. Enumerate every gate record in the report (`gates[]`/member evidence/`summary`) and assert no record carries a `pass` verdict for the unresolved identifier.
3. Assert the resolved gate's record is still reported normally for `web`, so the unresolved identifier does not erase readable evidence.
4. Assert `web`'s `verdict: unknown`, `status: blocked`, `blockingMembers[]` contains `webKey`, and exit `1`.
5. Assert no gate record invents a gate id, a reason, or a citation for the unresolved identifier (absence is represented as absence, never fabricated).
6. Repeat the run; assert identical bytes (no nondeterministic gate ordering).

**Expected Outcome**:

- An unresolved declared gate identifier never acquires a pass verdict or fabricated evidence anywhere in the report.

#### TC-XDOD-009 - Evidence element shape and pull-request-less omission (AC-F3-8)

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-8, DM-2, DM-4, DEC-4, DEC-16
**Test Type(s)**: Integration (CLI) + Contract (element shape)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-members-evidence.test.ts`; member-form golden in `tests/golden/cross-repository-members.test.ts`
**Tags**: @bun, @behaviour, @gates, @member, @evidence

**Preconditions**:

- Three declared members: `api` (landed at position 2), `web` (unlanded), `docs` (no declared `pullRequest`).

**Steps**:

1. Evaluate the shared verdict; assert `docs` appears in `definitionOfDone.members[]` with `gates.ci: absent` (DEC-4) and is omitted from `evidence[]`.
2. Assert every member with a declared pull request appears in `evidence[]` with exactly `repoKey`, `pullRequest`, and `landed`; `landingPosition` appears only on landed entries (none here except `api`).
3. Assert no placeholder entry, empty `pullRequest`, or `landed: false` entry is synthesised for `docs`.
4. Assert `evidence[].length` equals the number of declared members with a `pullRequest` (2), not the member count (3).
5. Assert `blockingMembers[]` still names `docs` (it is non-green evidence) while it is absent from `evidence[]`.
6. Pin the payload in the member-form golden (review-visible), with only envelope `runId`/`timing` normalised.

**Expected Outcome**:

- `evidence[]` enumerates pull requests only; a PR-less member stays a member with `absent` CI and never appears as fabricated evidence.

#### TC-XDEP-001 - Start on B is refused `queue.precondition.unmet` naming B and A; admitted after A lands

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, F-2, AC-F4-1, DEC-7
**Test Type(s)**: Integration (CLI)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-members-dependency.test.ts`
**Tags**: @bun, @behaviour, @queue, @member, @dependency

**Preconditions**:

- Two member entries; `web` depends on `api`; both declared; `api`'s pull request unlanded; a start path exists for the member ref (claim/dispatch/start as delivered).

**Steps**:

1. Attempt each available start path on `web`'s member ref; assert every attempt refuses with the delivered `queue.precondition.unmet` at exit `1`.
2. Assert the refusal message/identity names `web`'s member ref and the unlanded prerequisite `api`'s member ref.
3. Assert no lease/entry state changed on the refused attempt (fail-closed, zero appends).
4. Inject the landing observation for `api`; repeat the same start path on `web`; assert it is admitted.
5. Assert a start on `api` was never blocked by the edge (direction is consumer→producer only).

**Expected Outcome**:

- The declared edge alone never admits a dependent member; admission follows observable landing.

#### TC-XDEP-002 - Member-ref cycle: queue mutation `queue.dependency-cycle`; plan cycle caught at validation

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, F-1, AC-F4-2, DEC-7
**Test Type(s)**: Integration (CLI) + Unit (predicate)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-members-dependency.test.ts`; extends `tests/behaviour/queue-dep-cycle.test.ts`
**Tags**: @bun, @behaviour, @queue, @member, @cycle

**Preconditions**:

- Two member entries `api`, `web` with an existing `web → api` edge; the reverse edge would close a cycle. A separate plan variant declares `api ↔ web` in `dependsOn`.

**Steps**:

1. Add the reverse member-ref edge; assert refusal with the delivered `queue.dependency-cycle` at exit `1`; assert zero appends (ledger digest unchanged).
2. Assert the refusal names the existing path.
3. Validate the cyclic plan; assert `plan.schema.invalid` naming the member position (no queue write attempted; no queue state file created).
4. Assert the delivered non-member cycle behavior is unchanged (a bare-ref cycle still refuses with the same identity).

**Expected Outcome**:

- Cycles are refused at the earliest surface; the plan cycle never reaches a queue write; no new identity is minted.

#### TC-XCLOSE-001 - Both merged: two ordered member entries, six fields each, `landed: true`, per-member removal

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1, DM-5, DoD-8, DEC-12, SC-M2-S19-01
**Test Type(s)**: Integration (CLI) + Contract (report shape)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-members.test.ts`; golden in `tests/golden/cross-repository-members.test.ts`; fixtures extend `tests/fixtures/closeout/{request,branch,queue-removal}.ts`
**Tags**: @bun, @behaviour, @closeout, @member, @golden

**Preconditions**:

- Two members, each with a branch and a merged pull request observed by the injected provider facts; the delivered twelve-step plan is in apply mode with a fixed clock.

**Steps**:

1. Run `closeout <ref> --apply --json`.
2. Assert `data.members[]` has exactly two entries in declared order; each has exactly `repoKey`, `branch`, `cleanup`, `pullRequest`, `issueClosure`, `landed`.
3. Assert `cleanup` uses the delivered branch-cleanup outcome vocabulary and `issueClosure` the delivered transition outcome vocabulary; `landed: true` for both.
4. Assert the twelve step ids are unchanged and no new step id appears; per-member work rides `branch-cleanup`, `ticket-to-done`, `comment-resolution`.
5. Assert each member's landing produced exactly one removal for its own member ref with reason `landed`, and no removal for the bare change ref.

**Expected Outcome**:

- Both member pull requests are enumerated in landing order with per-member cleanup and issue closure; landing is merge truth; removal is per member.

#### TC-XCLOSE-002 - Partial landing: A landed/B not, B retained or disclosed with a skip reason, nothing claims B landed

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, F-2, AC-F5-2, DM-5, OQ-5
**Test Type(s)**: Integration (CLI)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-members.test.ts`; skip semantics extend `tests/behaviour/closeout-queue-removal-skips.test.ts`
**Tags**: @bun, @behaviour, @closeout, @member, @partial

**Preconditions**:

- `api` observed merged; `web` unmerged (variants: no merge truth; live lease held at landing; member ref not canonical in a hostile variant).

**Steps**:

1. Run `closeout <ref> --apply --json`.
2. Assert `api.landed: true` and `web.landed: false`; no field or step outcome claims `web` landed.
3. Assert `api`'s queue entry is removed; `web`'s entry is retained (or disclosed with the delivered skip reason `lease-held` / `no-merge-truth` / `state-unavailable`), and the skip is visible in data.
4. Assert the exit code is the delivered closeout exit and does not encode `web` as landed.
5. Assert a repeated apply over the same facts is idempotent (no duplicate removals, no second transition).

**Expected Outcome**:

- A partly landed change is visible and honest; a skipped removal is disclosed, never silently dropped.

#### TC-XCLOSE-003 - Unsafe squash predicate: delivered refuse value, branch not deleted, `landed` stays merge truth

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-3, DM-5, DoD-8
**Test Type(s)**: Integration (CLI)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-members.test.ts`; extends `tests/fixtures/closeout/branch.ts`
**Tags**: @bun, @behaviour, @closeout, @member, @safety

**Preconditions**:

- Two members both observed merged; `web`'s branch fails the delivered squash-safety predicate (e.g., unmerged commits not represented by the squash / diverged head).

**Steps**:

1. Run closeout in plan mode and apply mode.
2. Assert `web.cleanup` is the delivered refuse value (same value as the delivered single-repository surface); assert `api.cleanup` is the delivered success value.
3. Assert `web`'s branch still exists after apply; assert no destructive branch operation was attempted (spawn/recorded operations).
4. Assert `web.landed` remains `true` because merge truth is observed — safety refusal does not rewrite landing.

**Expected Outcome**:

- An unsafe cleanup refuses, does not delete, and does not distort merge truth.

#### TC-XCLOSE-004 - Closeout plan mode reports members and writes nothing

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, AC-F5-1, AC-NFR4-1, DM-5, DoD-12
**Test Type(s)**: Integration (CLI) + Contract (write audit)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-members.test.ts`; extends `tests/behaviour/closeout-plan.test.ts`; snapshot helpers from `tests/fixtures/projects/state-scope.ts`
**Tags**: @bun, @behaviour, @closeout, @member, @readonly

**Preconditions**:

- Two members with injected merge facts; a tree/host-root snapshot before the run.

**Steps**:

1. Snapshot the host root and queue/ledger state.
2. Run `closeout <ref> --json` (plan mode).
3. Assert `data.members[]` has two ordered entries with the six fields and `landed` resolved from merge truth.
4. Assert the host-root and state snapshots are identical (zero writes, zero ledger appends, zero queue removals).
5. Assert the mode is `plan` and the report is otherwise the delivered shape.

**Expected Outcome**:

- Plan mode is a pure projection: full member report, zero writes.

#### TC-XREV-001 - One review run: one verdict per member in order, `complete: true`, stable `runId`

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-1, DM-7, DoD-9, DEC-8, SC-M2-S19-01
**Test Type(s)**: Integration (CLI) + Contract (report shape)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-review-flow.test.ts`; golden in `tests/golden/cross-repository-members.test.ts`; observations in `tests/fixtures/cross-repository/review.ts`
**Tags**: @bun, @behaviour, @review, @member, @golden

**Preconditions**:

- Two declared members with declared pull requests; exactly one injected `ReviewObservation` per member (`pass` for `api`, `fail` for `web` as data, not as an expectation of the run).

**Steps**:

1. Run `verify gates <ref> --json`; assert `data.reviewFlow.verdicts[]` has exactly one entry per declared member in declared order with `repoKey`, `pullRequest`, and a verdict from `pass|fail|unreviewed`.
2. Assert `data.reviewFlow.complete: true` (every member has exactly one verdict).
3. Record `data.reviewFlow.runId`; run a second time over the unchanged member set; assert the same `runId` and that no verdict entry was added.
4. Reorder the declaration of the same member set (same pull-request identities) and assert the `runId` is unchanged (digest over the *sorted* identities).
5. Assert the golden matches the serialized `data`, with `reviewFlow.runId` pinned (not normalized).

**Expected Outcome**:

- One run covers the declared set with one verdict per member; an unchanged set is the same run.

#### TC-XREV-002 - Duplicated review observation: `fail`, `complete: false`, one entry only

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-2, DM-7, DEC-8
**Test Type(s)**: Integration (CLI)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-review-flow.test.ts`
**Tags**: @bun, @behaviour, @review, @member, @negative

**Preconditions**:

- Two members; `web` has two `ReviewObservation` values recorded (a duplicated observation); `api` has one.

**Steps**:

1. Run `verify gates <ref> --json`.
2. Assert `web`'s verdict is `fail` and `data.reviewFlow.complete: false`.
3. Assert `verdicts[]` still carries exactly one entry for `web` (no second entry, no duplicate key).
4. Assert `api`'s single entry is unaffected.
5. Assert the run does not silently pick one of the duplicated observations as a pass.

**Expected Outcome**:

- "No member reviewed twice" is mechanically enforced: duplication degrades to `fail` and incomplete coverage.

#### TC-XREV-003 - Member set changed between runs: `runId` differs, no stale verdict entry

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-6, AC-F6-3, DM-7, NFR-2, DEC-8
**Test Type(s)**: Integration (CLI)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-review-flow.test.ts`
**Tags**: @bun, @behaviour, @review, @member, @identity

**Preconditions**:

- Run A declares `[api, web]`; run B declares `[api]` (or `[api, web, docs]`); `ReviewObservation` values are supplied for declared members only.

**Steps**:

1. Run A and record `runId` and the verdict keys.
2. Run B over the changed set; assert `runId` differs from run A.
3. Assert `verdicts[]` contains no entry for a member that is no longer declared (no stale verdict is retained).
4. Assert `complete` reflects the new set only.
5. Run B a second time; assert B's `runId` is stable.

**Expected Outcome**:

- Run identity is bound to the declared set; changing the set starts a different run and never carries stale verdicts.

#### TC-XREV-004 - Unobserved member: `unreviewed`, `complete: false`, one entry

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-6, AC-F6-1 (definition of `complete`), DM-7, DEC-8
**Test Type(s)**: Integration (CLI)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-review-flow.test.ts`
**Tags**: @bun, @behaviour, @review, @member, @boundary

**Preconditions**:

- Two members; only `api` has a `ReviewObservation`.

**Steps**:

1. Run `verify gates <ref> --json`.
2. Assert `web`'s verdict is `unreviewed` and `data.reviewFlow.complete: false`.
3. Assert exactly one entry per declared member (two total), in declared order.
4. Assert `unreviewed` is never mapped to `pass`.

**Expected Outcome**:

- Missing review evidence is a classified non-pass state and makes coverage incomplete.

#### TC-XREV-005 - Review verdicts come from injected `ReviewObservation` values only; no store, command, or live call (DEC-17)

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-1, AC-F6-4, AC-NFR1-1, DEC-17, C-6, NG-3
**Test Type(s)**: Integration (CLI) + Contract (surface/state audit)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-review-flow.test.ts`; extends `tests/behaviour/entrypoint-help.test.ts`; state baseline `tests/structure/event-state-additivity.test.ts`
**Tags**: @bun, @behaviour, @review, @contract, @hermetic

**Preconditions**:

- The injected `ReviewObservation` set `{ repoKey, pullRequest, verdicts[] }` is the only review input; no review store exists; the no-network and no-spawn guards are installed.

**Steps**:

1. Run `verify gates <ref> --json` with the `ReviewObservation` set; assert `reviewFlow` is produced.
2. Remove/alter the observation set; assert `reviewFlow` changes accordingly (the block is a pure function of the injected observations — no hidden state).
3. Assert zero network calls and zero child processes (guards).
4. Assert no new state/ledger record is written (tree and ledger digest unchanged) and no new record kind appears in the state-additivity baseline.
5. Assert the root command family set is unchanged: there is no `review` command/family, and `verify gates` is the only surface that reports `reviewFlow`.
6. Assert no top-level envelope key was added (`reviewFlow` lives under `data`).

**Expected Outcome**:

- The DEC-17 seam is pinned as a test constraint: `ReviewObservation` values injected through the verification composition, no store, no command, no live call. The durable production carrier beyond the composition injection is deferred and non-blocking (OQ-3 resolved-with-deferral); if it is later added it must arrive through the same seam and this TC narrows, not disappears.

#### TC-XREV-006 - `ReviewObservation` mapping: per-member derivation and no pass without a matching observation (AC-F6-4)

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-4, DM-7, DoD-9 (per §17.1 v1.1 coverage note), DEC-8, DEC-17
**Test Type(s)**: Unit (mapping) + Integration (CLI)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-review-flow.test.ts`; observation fixture `tests/fixtures/cross-repository/review.ts`
**Tags**: @bun, @behaviour, @review, @member, @contract

**Preconditions**:

- Two declared members `[api, web]`; a `ReviewObservation` fixture builder producing `{ repoKey, pullRequest, verdicts[] }`.

**Steps**:

1. Supply exactly one observation per member with `api` = `["pass"]` and `web` = `["fail"]`; assert each member's `verdicts[]` entry equals the verdict derived from its own observation (`pass`, `fail`) and `complete: true`.
2. Supply `web` with a second observation; assert `web` is `fail`, `complete: false`, and exactly one `verdicts[]` entry remains (no duplicate, no second entry).
3. Supply no observation for `web`; assert `web` is `unreviewed` and `complete: false`, and assert it is never `pass`.
4. Swap the two observations' `repoKey`/`pullRequest` fields and assert the verdict follows the observation's own member identity (no positional matching).
5. Supply an observation whose `repoKey` names an undeclared member; assert it contributes no verdict entry and does not make that member appear.
6. Assert the input values are the documented `ReviewObservation` shape only (no extra required field) and no review store/command is consulted.

**Expected Outcome**:

- Each member's review verdict derives from its own `ReviewObservation`; duplication degrades to `fail`; absence is `unreviewed`; nothing is `pass` without a matching observation.

#### TC-XPAR-001 - Plan surfaces parity: member-less validate/lint/diff/overlap byte-identical, no `members` key

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-7, AC-F1-3, NFR-8, C-1, DoD-10
**Test Type(s)**: Golden / parity
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/cross-repository-parity.test.ts`; existing goldens read unchanged: `tests/golden/plan/validate-baseline.json`, `tests/golden/plan/{diff-outside,overlap-parallel,overlap-sequence}.json`, `tests/golden/plan-text.test.ts`
**Tags**: @bun, @golden, @parity, @plan

**Preconditions**:

- The parity fixture set of plans declaring **no** `members[]` (valid, invalid, legacy, tier variants) at the pre-change reference (Section 6.4).

**Steps**:

1. Run `plan validate` on each member-less fixture; assert parsed `data` deep-equals the committed pre-change golden and the serialized payload is byte-identical (only envelope `runId`/`timing` normalized, if present).
2. Assert the verdict contains no `members` key at any depth.
3. Run `lint plan`; assert the payload and exit are byte-identical to the pre-change golden.
4. Run `plan diff` and `plan overlap` on the committed fixtures; assert each matches its pre-change golden exactly.
5. Assert every exit code equals the pre-change exit.

**Expected Outcome**:

- The member-less plan surface is unchanged; the member path is opt-in.

#### TC-XPAR-002 - Closeout parity: member-less plan and apply byte-identical, no `members` key

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, F-7, AC-F5-4, NFR-8, C-1, DoD-10
**Test Type(s)**: Golden / parity
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/cross-repository-parity.test.ts`; existing goldens read unchanged: `tests/fixtures/closeout/golden/{envelope-data.json,human.txt}`, `tests/golden/{closeout-envelope,closeout-human,closeout-residue}.test.ts`
**Tags**: @bun, @golden, @parity, @closeout

**Preconditions**:

- A member-less single-repository closeout fixture with observed merge truth and a fixed clock.

**Steps**:

1. Plan mode: assert `data` has no `members` key and the serialized payload matches the pre-change golden; assert the human output matches `human.txt` byte-for-byte.
2. Apply mode: assert the twelve step ids, per-step outcomes, operation records (including their order), ledger records, and human output are byte-identical to the pre-change reference.
3. Assert the exit code is identical in both modes.
4. Assert no per-member operation or field leaks into the member-less path.

**Expected Outcome**:

- Closeout is unchanged for member-less changes in both modes: same data, same ledger, same human bytes.

#### TC-XPAR-003 - Gates and queue parity: delivered report/projection and exits byte-identical, no member keys

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-1, NFR-8, C-1, DoD-10
**Test Type(s)**: Golden / parity
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/cross-repository-parity.test.ts`; existing goldens read unchanged: `tests/fixtures/verify-gates/golden/{success-data.json,human-success.txt,failure-summary.txt}`, `tests/golden/verify-gates.test.ts`, `tests/fixtures/queue/golden/{queue-list,queue-plan,lanes-list}.json`, `tests/golden/{queue-list,queue-plan,lanes-list,lanes-show}.test.ts`
**Tags**: @bun, @golden, @parity, @gates, @queue

**Preconditions**:

- The parity fixture set: a member-less change with the delivered gate battery (pass and fail variants) and delivered queue entries/edges/lanes.

**Steps**:

1. Run `verify gates` on the member-less fixture; assert `data` has no `definitionOfDone`, no `blockingMembers`, and no `reviewFlow`; assert `data` matches `success-data.json` and human output matches `human-success.txt`; assert exit semantics identical.
2. Run the failure variant; assert the failure summary matches the pre-change golden and the exit is identical.
3. Run `queue list`, `queue plan`, `lanes list`; assert each `data` matches its pre-change golden and the exit is identical.
4. Assert the queue keeps exactly one entry keyed by the bare canonical ref, one lane, the delivered removal and skip semantics, and no member ref appears.
5. Assert no `members`/`definitionOfDone`/`blockingMembers`/`reviewFlow` key appears anywhere in the payloads.

**Expected Outcome**:

- The gate report and queue projections are unchanged for member-less changes; the cross-repository path never becomes the default.

#### TC-XCTR-001 - Envelope continuity on every touched surface

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: DM-2, DM-5, DM-7, AC-NFR1-1, NFR-1, C-1, DoD-11
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/cross-repository-contract.test.ts`; extends `tests/structure/envelope-contract.test.ts`
**Tags**: @bun, @structure, @contract, @envelope

**Preconditions**:

- Captured envelopes from the member-form behaviour runs (plan, gates, closeout, queue/lanes) in success and negative-verdict variants.

**Steps**:

1. For each envelope, assert `assertEnvelopeContract` returns no findings (existing `packages/testkit/src/result-conformance`).
2. Assert exactly the five top-level keys (`schemaVersion`, `runId`, `exitCode`, `timing`, and one of `data`/`error`).
3. Assert zero top-level `ok` or `command` fields.
4. Assert every new key (`members`, `definitionOfDone`, `blockingMembers`, `reviewFlow`, closeout `members`) lives under `data`.
5. Assert a data-bearing negative verdict (`blocked`, `incomplete`, invalid plan) carries `data` and no `error`.

**Expected Outcome**:

- Every touched surface keeps the delivered envelope; the negative verdicts are data-bearing, not failure envelopes.

#### TC-XCTR-002 - Read-only posture: 0 plan writes, 1 gate-verification append, 0 closeout plan-mode writes

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-4, AC-NFR4-1, DoD-12
**Test Type(s)**: Integration (CLI) + Contract (write audit)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/cross-repository-readonly.test.ts`; extends `tests/behaviour/plan-readonly.test.ts` and `tests/behaviour/verify-gates-read-budget.test.ts`
**Tags**: @bun, @behaviour, @readonly, @audit

**Preconditions**:

- A fixture host root with a queue/ledger store; tree + ledger snapshots; a guarded store that records every mutation/fence/repair call.

**Steps**:

1. Plan member validation: run `plan validate` on a valid and an invalid member plan; assert the plan file and every state/store file are byte-unchanged (zero writes on plan paths).
2. Full gate battery over a two-member plan: assert exactly one gate-verification record is appended (count the append calls and the ledger delta), no other write.
3. Closeout plan mode over a two-member plan: assert zero writes.
4. Assert no write path is invoked by the read surfaces (guarded store records only reads).
5. Repeat each run; assert append counts remain exactly one (no per-member multiplication of the gate-verification record).

**Expected Outcome**:

- Validation writes nothing, the battery appends exactly one record regardless of member count, and closeout plan mode is pure.

#### TC-XCTR-003 - Identity reuse: 0 new error rows, 0 new domain kinds, delivered refusal identities only

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-7, AC-NFR7-1, AC-F1-2, AC-F4-2, DEC-13, DoD-11
**Test Type(s)**: Contract / invariant
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/cross-repository-contract.test.ts`; extends `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts`, `tests/structure/event-state-additivity.test.ts` (baseline `tests/fixtures/events/state-additivity-baseline.json`)
**Tags**: @bun, @structure, @contract, @identity

**Preconditions**:

- The delivered error table and state-additivity baseline.

**Steps**:

1. Collect the error identities emitted by all member-form negative cases (plan defects, unmet precondition, edge cycle, unavailable/absent readings, closeout skips).
2. Assert the set is a subset of the delivered table; specifically no new row beyond `plan.schema.invalid`, `queue.precondition.unmet`, `queue.dependency-cycle` and the delivered closeout skip reasons.
3. Assert the bidirectional error-table sync check passes (documented rows ↔ emitted identities).
4. Assert the state-additivity baseline has zero additions: no new record kind, payload schema, key prefix, or state schema version.
5. Assert no new event kind/topic is declared.

**Expected Outcome**:

- The change adds capability without adding identity; the documented classification surface stays truthful.

#### TC-XCTR-004 - Consumer tolerance: additive fields tolerated; members resolved by `repoKey`, steps by `stepId`

**Scenario Type**: Contract
**Impact Level**: Important
**Priority**: High
**Related IDs**: §8.5, AC-F5-1, AC-NFR1-1, DEC-12
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/cross-repository-contract.test.ts`; consumer fixture extends `tests/fixtures/closeout/legacy-consumer.ts`
**Tags**: @bun, @structure, @contract, @closeout

**Preconditions**:

- A closeout member report and a gate member report with an extra unknown additive field injected into each member entry and each step.

**Steps**:

1. Feed the payload to the consumer fixture that resolves members by `repoKey` and steps by `stepId`.
2. Assert the consumer resolves every member and step and ignores the unknown fields.
3. Assert reordering members within declared order is rejected as a spec violation (declared order is guaranteed) while array position beyond that is never used as identity.
4. Assert a member entry missing a declared field is reported as a contract violation, not silently defaulted.

**Expected Outcome**:

- Additive extension is consumable; identity is by key, not position; missing declared fields are not invented.

#### TC-XCTR-005 - Closed vocabularies and pinned literals exported exactly once

**Scenario Type**: Contract
**Impact Level**: Important
**Priority**: High
**Related IDs**: DM-2, DM-3, DM-7, AC-F1-1, AC-F3-3, AC-NFR1-1, Appendix A
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/cross-repository-contract.test.ts`
**Tags**: @bun, @structure, @contract, @vocabulary

**Preconditions**:

- The contracts package exports.

**Steps**:

1. Assert the status set is exactly `green|blocked|incomplete`; `gates.ci` exactly `pass|fail|unavailable|absent`; member verdict exactly `pass|fail|unknown`; review verdict exactly `pass|fail|unreviewed`.
2. Assert the member counts are exported as `PLAN_MAX_MEMBERS=8`, `PLAN_MAX_MEMBER_DEPENDS_ON=8`, `PLAN_MAX_MEMBER_GATES=16`, `VERIFY_GATES_MAX_MEMBERS=8`, `CLOSEOUT_MAX_MEMBERS=8` (single source, no duplicated literal).
3. Assert the member-ref form and `QUEUE_MAX_REF_CHARS=64` are the only identity extension; no second member-identity literal exists.
4. Assert the vocabularies are closed (no open string type in the public contract) and every value appears in the documented pinned-literals register.

**Expected Outcome**:

- One vocabulary per concept, shared by plan/gates/closeout; widening it is a contract change, not an implementation detail.

#### TC-XCTR-006 - Read budget per declared member: bounded calls, no retries, no pagination, no out-of-set calls (AC-NFR6-1)

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-6, AC-NFR6-1, F-3, DEC-10, DoD-12 (per §17.1 v1.1 coverage note)
**Test Type(s)**: Integration (CLI) + Contract (call-counting transport)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-read-budget.test.ts` (extend); counting transport in `tests/fixtures/cross-repository/facts.ts`; guards from `tests/fixtures/verify-gates/cases/{network-guard,harness}.ts`
**Tags**: @bun, @behaviour, @gates, @read-budget, @contract

**Preconditions**:

- A counting transport wrapping every provider seam, recording source, identity, page size, and call count; a two-member plan with distinct member repositories/heads; no member outside the declared set is reachable.

**Steps**:

1. Run `verify gates <ref> --json` through the counting transport.
2. Assert at most one open-PR page per declared member (and no page request for an undeclared repository), at most one detail read per declared member, and at most one check-run page per declared member's pushed head.
3. Assert zero retries: no `(source, identity)` pair is requested twice, including after a classified failure for one member.
4. Assert zero pagination: no request carries a pagination cursor/continuation or exceeds the delivered page limit (100).
5. Assert every request's repository identity is in the declared member set; an injected "other repository" sentinel is never requested.
6. At the eight-member cap, assert the counts scale linearly (≤8 pages, ≤8 details, ≤8 check-run pages) and the report is still produced.

**Expected Outcome**:

- The per-member read extension is strictly bounded, retry-free, pagination-free, and scoped to declared members only.

#### TC-XCTR-007 - Error-table row count and domain-kind membership identical to pre-change (AC-NFR7-1)

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-7, AC-NFR7-1, DEC-13, DoD-11 (per §17.1 v1.1 coverage note)
**Test Type(s)**: Contract / invariant
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/cross-repository-contract.test.ts`; extends `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts`, `tests/structure/event-state-additivity.test.ts`
**Tags**: @bun, @structure, @contract, @identity

**Preconditions**:

- A committed pre-change snapshot of the error-table rows and the domain-kind membership (the existing error-table fixture and `tests/fixtures/events/state-additivity-baseline.json`).

**Steps**:

1. Compute the current error-table row identities and count; assert they equal the pre-change snapshot exactly (count and membership, not just a subset).
2. Assert no new identity string exists anywhere in the change's contracts (no `review.*`, `member.*`, `gates.member.*`, or similar invented code).
3. Assert the domain-kind membership is identical to the baseline: no new record kind, payload schema, key prefix, state schema version, event kind, or topic.
4. Exercise every refusal produced by the member-form negative cases (plan defects, unmet precondition, edge cycle, unavailable/absent readings, closeout skips) and assert each resolves to a delivered identity present in the snapshot.
5. Assert the bidirectional error-table sync check still passes in both directions.

**Expected Outcome**:

- The change adds capability with an identical classification surface: same row count, same membership, zero new identity strings.

#### TC-XHERM-001 - Default suite: two real temp member repos, injected facts, 0 network/second remote/credentials

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-3, AC-NFR3-1, NFR-6, C-7, RSK-6
**Test Type(s)**: Integration (CLI) + Contract (hermeticity)
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/cross-repository-hermetic.test.ts`; guards `tests/fixtures/verify-gates/cases/network-guard.ts`, `tests/fixtures/result/no-spawn-guard.ts`; seam `tests/fixtures/projects/temp-repos.ts`
**Tags**: @bun, @checks, @hermetic, @member

**Preconditions**:

- The new fixture module `tests/fixtures/cross-repository/two-members.ts`; guards installed on the composed runtime.

**Steps**:

1. Assert each case's two member repositories are real git repositories (`git rev-parse --git-dir` succeeds) created through the delivered `createRepository`/`cloneRepository` seam, each with its own `HEAD` SHA.
2. Assert the member branches and heads are real (`rev-parse HEAD` equals the injected pushed-head SHA).
3. Assert every provider fact (open PR, detail, check-runs, work item, merge truth, squash safety, review observation) arrives through an injected port — swapping the fact bundle changes the output; no HTTP client is constructed.
4. Assert the no-network guard records zero calls and the no-spawn guard records zero process spawns inside the evaluated surface (fixture setup is outside the guard window).
5. Assert zero credentials are read: no environment variable containing a token/secret is consulted; the fixture environment is the sanitized one.
6. Assert no real second remote exists: any bare origin is a local file path inside the case root and is never a network URL.

**Expected Outcome**:

- The acceptance path runs entirely offline over two real local repositories; nothing about the result depends on the network or credentials.

#### TC-XHERM-002 - Fixture isolation: no ambient `$HOME`, no daemon, not composed from this checkout, deterministic

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-3, AC-NFR3-1, testing-strategy isolation rules, C-7
**Test Type(s)**: Contract / invariant
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/cross-repository-hermetic.test.ts`; extends `tests/checks/fixture-sanitization.test.ts`; helpers `tests/fixtures/projects/state-scope.ts`
**Tags**: @bun, @checks, @hermetic, @isolation

**Preconditions**:

- A case root created under the gate's `TMPDIR` (`os.tmpdir()` → `/home/juliusz/tmp`), outside every git work tree.

**Steps**:

1. Assert the case root and its member repositories are outside the ADOS checkout and outside every git work tree: for each member repo, `git rev-parse --show-toplevel` equals that repo's own root (never `/home/juliusz/git/jaiship` or the ADOS worktree).
2. Assert `GIT_CEILING_DIRECTORIES` includes the case base (or the base is outside every work tree), so no fixture git command can discover a repository above it.
3. Assert `HOME` points at a per-case directory and the real home-derived state directory is never touched (`realStateFingerprint` unchanged).
4. Assert no live daemon is contacted: no socket is opened, no daemon state file is required; state reads are in-process.
5. Assert the composed CLI receives an explicit fixture `cwd`/project root and never composes from this repository's `process.cwd()`.
6. Assert no `mock.module` is used by the new suites (static scan of the suite sources / import audit); fakes are injected objects.
7. Run one representative case three times; assert identical output (deterministic fixtures, no cross-case ordering).

**Expected Outcome**:

- Every case is hermetic, workspace-independent, deterministic, and cannot leak into the operator's state or this repository.

#### TC-XBOUND-001 - Gate report repeated-run byte-identical (incl. evidence order and `reviewFlow`)

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-2, AC-NFR2-1, AC-F3-6, DoD-11
**Test Type(s)**: Golden / determinism
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/cross-repository-determinism.test.ts`
**Tags**: @bun, @behaviour, @determinism, @gates

**Preconditions**:

- A two-member plan with a partly landed evidence set; fixed injected clock/runId; the same fact bundle replayed.

**Steps**:

1. Run `verify gates <ref> --json` twice over unchanged facts; assert stdout, stderr, and exit are byte-identical.
2. Assert `evidence[]` order, `members[]` order, `blockingMembers[]` order, and `reviewFlow.verdicts[]` order are identical across runs.
3. Assert `reviewFlow.runId` is byte-identical across runs (stable digest, not normalized).
4. Assert the serialized report length is identical across runs.

**Expected Outcome**:

- The whole cross-repository report, including derived ordering and the review run identity, is reproducible.

#### TC-XBOUND-002 - Closeout report repeated-run byte-identical (plan and apply)

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-2, AC-NFR2-1, DoD-11
**Test Type(s)**: Golden / determinism
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/cross-repository-determinism.test.ts`; fixed-clock harness from `tests/fixtures/closeout/harness.ts`
**Tags**: @bun, @behaviour, @determinism, @closeout

**Preconditions**:

- Two-member closeout fixture (both merged; one unsafe branch variant) with a fixed clock and fixed injected provider facts.

**Steps**:

1. Plan mode twice; assert `data` and human output are byte-identical.
2. Apply mode twice over a fresh identical fixture; assert `data`, step operations/order, ledger records, and human output are byte-identical (the injected clock makes `recordedAt` stable).
3. Assert member order is declared order in both runs.
4. Assert the exit code is identical across runs.

**Expected Outcome**:

- The per-member closeout report and its ledger effects are reproducible; no ordering leaks from map/Set iteration.

#### TC-XBOUND-003 - Queue and lanes projection repeated-run byte-identical

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-2, AC-NFR2-1, DoD-11
**Test Type(s)**: Golden / determinism
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/cross-repository-determinism.test.ts`
**Tags**: @bun, @behaviour, @determinism, @queue

**Preconditions**:

- Two member entries, one dependent edge, one held lease, one parked lane; fixed clock.

**Steps**:

1. Run `queue list`, `queue ready`, `queue plan`, and `lanes list` twice each; assert `data` and stdout are byte-identical and exits identical.
2. Assert entry order, dependency order, and blocker order are stable.
3. Assert the member refs are stable across runs (derived, not generated).

**Expected Outcome**:

- Queue and lane projections are deterministic over unchanged state.

#### TC-XBOUND-004 - Eight-member report within 65 536 bytes; `blockingMembers[]` never truncated

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-2, AC-NFR2-1, DM-4, DEC-10, RSK-7
**Test Type(s)**: Integration (CLI) + Contract (bounds)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-members-bounds.test.ts`
**Tags**: @bun, @behaviour, @gates, @bounds, @member

**Preconditions**:

- A plan at the eight-member cap, each member declaring sixteen gates and the longest permitted pull-request identity; seven members blocked (fail/unavailable/absent mix) so all seven must be named.

**Steps**:

1. Run `verify gates <ref> --json`; assert `Buffer.byteLength(stdout, "utf8") <= VERIFY_GATES_MAX_MACHINE_BYTES` (65 536).
2. Assert `data.blockingMembers[]` contains all seven blocking `repoKey`s in declared order — no blocker is dropped by any bound.
3. Assert `data.definitionOfDone.members[]` still carries one entry per declared member (or, if any array truncates, an explicit truncation marker and total count appears while `blockingMembers[]` stays complete).
4. Assert a ninth member is rejected at plan time (ties to TC-XPLAN-003), so the report bound and the declaration bound are the same count.
5. Assert the human rendering does not hide a blocker either (the blocking member's key appears in the human report).

**Expected Outcome**:

- Bounds never hide a blocker: at the maximum representable member set the report fits the machine bound and every blocker remains named.

#### TC-XGATE-001 - Gate battery and commit hygiene at delivered HEAD (verification-only)

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-9, AC-NFR5-1, DEC-14, C-9, DoD-15
**Test Type(s)**: Gate / verification
**Automation Level**: Verification-only (not automated test code; not counted in the automated TC total)
**Target Layer / Location**: Repository root — aggregate gate + commit-message range gate; evidence recorded in `chg-GH-310-pm-notes.yaml`
**Tags**: @gate, @verification

**Preconditions**:

- The delivered HEAD on `feat/GH-310/cross-repository-changes`; the measured gate environment.

**Steps**:

1. Run `TMPDIR=/home/juliusz/tmp GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=commit.gpgsign GIT_CONFIG_VALUE_0=false pnpm check`; assert exit `0`, recording the command and result in pm-notes.
2. Run `./scripts/lint-commit-range.sh --base <base>`; assert `PASS` (or `SKIP` only when no commitlint configuration exists to mirror); a `FAIL` is remediated and re-run, and an `ERROR` is never recorded as a pass.
3. Inspect the change's commit subjects: conventional, scoped `GH-310`; every body/footer line ≤100 characters.
4. Assert the PR targets `main-tools` and stays open (phase-11 record; no merge).

**Expected Outcome**:

- The change is gate-green and commit-hygienic at the delivered HEAD; the evidence is recorded, not asserted by a unit test.

## 6. Environments and Test Data

### 6.1 Gate and fixture environment (measured, binding)

The following constraints were measured in this checkout and are recorded in `chg-GH-310-pm-notes.yaml`; every phase boundary and every new fixture must honor them.

- **Gate command:** `TMPDIR=/home/juliusz/tmp GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=commit.gpgsign GIT_CONFIG_VALUE_0=false pnpm check`.
- **`TMPDIR=/home/juliusz/tmp`** — same ext4 device as the checkout and outside every git work tree (the checkout's parent `/home/juliusz/git/jaiship` is itself an umbrella git work tree). Same-device placement keeps fixture copy/rename and repository creation on one filesystem.
- **`GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=commit.gpgsign GIT_CONFIG_VALUE_0=false`** — the host sets `commit.gpgsign=true` globally; gate-spawned commits would block on pinentry without this override.
- **Invalid bases:** `/tmp` and `/tmp/opencode` (tmpfs, a different device — cross-device rename/atomicity assumptions do not hold), and the repo-local `tmp/tmpdir` (inside a work tree; discovery and work-tree pollution risk). New cross-repository suites must not add fixtures under either.
- **New fixture base:** each case creates its root with `mkdtempSync(join(os.tmpdir(), "gh310-<label>-"))`, which resolves to the gate's `TMPDIR` (`/home/juliusz/tmp`). `guardStateFixtureRoot` admits it through its OS-temp-root branch. Once that base is approved, the existing state helpers may be given an explicit base (fixture-only extension if their hardcoded `APPROVED_BASE` blocks it).
- **Lifecycle commands:** prefix `PATH` with `$PWD/node_modules/.bin` (or invoke through `pnpm exec delivery-os`) per the pm-notes RETRO, so the commitlint probe resolves; this is execution guidance, not a test assertion.

### 6.2 Member repositories (hermetic, per case)

Every case constructs its two member repositories per case; nothing is shared across cases.

- **Seam:** `tests/fixtures/projects/temp-repos.ts` — `createRepository(parent, name)` (`git init` + one commit), `createBareOrigin`/`seedOrigin`/`cloneRepository` only where a clone is required, `git(cwd, args)` with the sanitized environment (`GIT_CONFIG_GLOBAL=/dev/null`, `GIT_CONFIG_SYSTEM=/dev/null`, `GIT_CONFIG_NOSYSTEM=1`, `GIT_TERMINAL_PROMPT=0`, `GIT_CEILING_DIRECTORIES` pinned).
- **Identity:** `tests/fixtures/projects/groups.ts` `createMemberCheckout(parent, name, host)` mints each member's durable `repoKey` through the delivered scope policy; tests use the returned key and never hardcode a key literal.
- **Heads:** each member branch is created and committed (`git checkout -b <branch>`, commit), and the pushed-head SHA is `git rev-parse HEAD`. The injected CI facts key on that SHA, so "read on each member's own pushed head" is a real assertion, not a constant.
- **Fixture module:** `tests/fixtures/cross-repository/two-members.ts` exports `createTwoMemberWorld(label)` returning `{ base, host, members: [{ repoKey, root, branch, pullRequest, headSha }], dispose }`; `dispose()` removes the tree. `plan.ts` writes the fixture plan; `facts.ts` builds per-member provider bundles; `review.ts` builds the review observation set; `goldens/` holds committed normalized payloads.
- **No live second remote:** any bare origin is a local file path inside the case root; no network URL and no credentials exist in any fixture.

### 6.3 Provider facts and no live daemon

- All provider facts are injected object members on the delivered runtime seams: `readOpenPullRequests`, `readDeliveryRequestDetail`, `readCheckRuns`, `readWorkItem`, `readGateSet` for `verify gates`; closeout request/detail, branch state, squash safety, and issue-transition ports for `closeout`; landing observations for queue removal. A missing bundle key models `unavailable`; an absent entry models `absent`.
- Review verdicts are injected `ReviewObservation` values `{ repoKey, pullRequest, verdicts[] }` through the verification composition that composes `verify gates` (DEC-17); there is no store, no command, and no live model call. A second observation for one member models the duplicated-observation case; a missing observation models `unreviewed`.
- Queue/lane state is read in-process; no resident daemon, socket, or daemon state file is required. No suite contacts a live daemon.

### 6.4 Pre-change reference for parity

The reference for AC-F1-3, AC-F5-4, AC-F7-1 is the **pre-change baseline**, not a post-change regeneration.

- **Primary reference (already committed):** `tests/golden/plan/validate-baseline.json`, `tests/golden/plan/{diff-outside,overlap-parallel,overlap-sequence}.json`, `tests/golden/plan-text.test.ts`; `tests/fixtures/verify-gates/golden/{success-data.json,human-success.txt,failure-summary.txt}` with `tests/golden/verify-gates.test.ts`; `tests/fixtures/closeout/golden/{envelope-data.json,human.txt}` with `tests/golden/closeout-*.test.ts`; `tests/fixtures/queue/golden/{queue-list,queue-plan,lanes-list,...}.json` with `tests/golden/{queue-list,queue-plan,lanes-list,lanes-show}.test.ts`. These files are **read unchanged** by the parity TCs; changing one is a failure of the parity proof unless the review records a deliberate, reasoned regeneration.
- **New member-less reference (only where no golden exists):** captured once at the branch base (`main-tools` tip recorded in pm-notes, `404e9bf8` at intake) **before any production code changes**, using the surface's explicit regeneration entrypoint (`tests/fixtures/closeout/golden/regenerate.ts`, `tests/golden/plan/regenerate.ts`) or a documented one-shot capture command; committed in the parity phase with the command recorded in pm-notes. Regeneration after the change is allowed only with a review-visible diff and a recorded reason.
- **Comparison method:** for machine payloads, compare `data` deep-equal and the serialized payload byte-for-byte (stable key order); for human surfaces, compare raw `stdout` bytes. Envelope `runId` and `timing` are the only permitted normalized keys, and the normalizer is asserted to replace only those keys. Exit codes are compared exactly. Absence of `members`/`definitionOfDone`/`blockingMembers`/`reviewFlow` is asserted explicitly at every depth.

### 6.5 Isolation and cleanup

- No ambient `$HOME`: host fixtures set `HOME` to a per-case directory and the brand-derived state override to a per-case host root; `realStateFingerprint` must be unchanged.
- No composition from this checkout: every command receives an explicit fixture `cwd`/project root; each member repo's `git rev-parse --show-toplevel` equals itself.
- No cross-case ordering: each case creates and disposes its own world; no shared mutable fixture, no ambient clock, no random identifiers outside the fixture's own deterministic seeds.
- Injected fakes over `mock.module`: no process-global mocking in new suites; module mocking is reserved for third-party edges and restored, per `.ai/rules/typescript.md` §9.

## 7. Automation Plan and Implementation Mapping

Proposed homes; the implementation plan pins exact names (the assertion contracts bind regardless of placement). Iteration: `bun test <path>`; final verification: TC-XGATE-001.

| TC ID | Test file | Execution command | Mocking requirements | Status |
|-------|-----------|-------------------|----------------------|--------|
| TC-XPLAN-001 | `tests/behaviour/plan-members.test.ts` + `tests/golden/cross-repository-members.test.ts` | `bun test tests/behaviour/plan-members.test.ts tests/golden/cross-repository-members.test.ts` | Fixture plan + two member checkouts; injected parser port only | To Implement |
| TC-XPLAN-002 | `tests/behaviour/plan-members.test.ts` + `tests/behaviour/plan-lint.test.ts` (extend patterns) | `bun test tests/behaviour/plan-members.test.ts` | Fixture plan table under `tests/fixtures/plan/members-invalid/` | To Implement |
| TC-XPLAN-003 | `tests/behaviour/plan-members-bounds.test.ts` | `bun test tests/behaviour/plan-members-bounds.test.ts` | Fixture plan table under `tests/fixtures/plan/members-bounds/` | To Implement |
| TC-XPLAN-004 | `tests/behaviour/plan-members.test.ts` | `bun test tests/behaviour/plan-members.test.ts` | Field-mutation table | To Implement |
| TC-XPLAN-005 | `tests/behaviour/plan-members.test.ts` + `tests/behaviour/plan-readonly.test.ts` (extend) | `bun test tests/behaviour/plan-members.test.ts tests/behaviour/plan-readonly.test.ts` | Config-read recorder | To Implement |
| TC-XPLAN-006 | `tests/behaviour/plan-members.test.ts` | `bun test tests/behaviour/plan-members.test.ts` | Required-field/empty-value fixture table under `tests/fixtures/plan/members-required/` | To Implement |
| TC-XPLAN-007 | `tests/behaviour/plan-members.test.ts` | `bun test tests/behaviour/plan-members.test.ts` | Grammar fixture table under `tests/fixtures/plan/members-grammar/` | To Implement |
| TC-XQUEUE-001 | `tests/behaviour/queue-members.test.ts` | `bun test tests/behaviour/queue-members.test.ts` | Fixture queue state under `tests/fixtures/queue/members/` | To Implement |
| TC-XQUEUE-002 | `tests/behaviour/queue-members.test.ts` + `tests/behaviour/queue-readiness.test.ts` (extend) | `bun test tests/behaviour/queue-members.test.ts tests/behaviour/queue-readiness.test.ts` | Readiness fact bundle | To Implement |
| TC-XQUEUE-003 | `tests/behaviour/queue-members-removal.test.ts` | `bun test tests/behaviour/queue-members-removal.test.ts` | Landing observation injection; ledger digest | To Implement |
| TC-XQUEUE-004 | `tests/behaviour/queue-member-ref.test.ts` | `bun test tests/behaviour/queue-member-ref.test.ts` | Pure exports + fixture queue harness | To Implement |
| TC-XQUEUE-005 | `tests/behaviour/queue-members.test.ts` | `bun test tests/behaviour/queue-members.test.ts` | Lease harness; no live daemon | To Implement |
| TC-XQUEUE-006 | `tests/behaviour/queue-members.test.ts` + `tests/behaviour/queue-lease.test.ts` (extend) | `bun test tests/behaviour/queue-members.test.ts tests/behaviour/queue-lease.test.ts` | Two-lease fixture; distinct holder identity; ledger digest | To Implement |
| TC-XDOD-001 | `tests/behaviour/verify-gates-members.test.ts` + `tests/golden/cross-repository-members.test.ts` | `bun test tests/behaviour/verify-gates-members.test.ts tests/golden/cross-repository-members.test.ts` | `gatesRuntime` overrides from `tests/fixtures/cross-repository/facts.ts` | To Implement |
| TC-XDOD-002 | `tests/behaviour/verify-gates-members.test.ts` | `bun test tests/behaviour/verify-gates-members.test.ts` | Gate-failure fact bundle | To Implement |
| TC-XDOD-003 | `tests/behaviour/verify-gates-members.test.ts` | `bun test tests/behaviour/verify-gates-members.test.ts` | Classified provider-failure fact | To Implement |
| TC-XDOD-004 | `tests/behaviour/verify-gates-members-evidence.test.ts` | `bun test tests/behaviour/verify-gates-members-evidence.test.ts` | Absent-head / no-run / missing-`pullRequest` bundles | To Implement |
| TC-XDOD-005 | `tests/behaviour/verify-gates-members.test.ts` + `tests/behaviour/verify-gates-read-budget.test.ts` (extend) | `bun test tests/behaviour/verify-gates-members.test.ts tests/behaviour/verify-gates-read-budget.test.ts` | Recording runtime, network/no-spawn guards | To Implement |
| TC-XDOD-006 | `tests/behaviour/verify-gates-members.test.ts` | `bun test tests/behaviour/verify-gates-members.test.ts` | Gate-set override excluding one identifier | To Implement |
| TC-XDOD-007 | `tests/behaviour/verify-gates-members-evidence.test.ts` | `bun test tests/behaviour/verify-gates-members-evidence.test.ts` | Landing-position fact bundle | To Implement |
| TC-XDOD-008 | `tests/behaviour/verify-gates-members.test.ts` | `bun test tests/behaviour/verify-gates-members.test.ts` | Mixed resolvable/unresolvable gate-set override | To Implement |
| TC-XDOD-009 | `tests/behaviour/verify-gates-members-evidence.test.ts` + `tests/golden/cross-repository-members.test.ts` | `bun test tests/behaviour/verify-gates-members-evidence.test.ts tests/golden/cross-repository-members.test.ts` | PR-less member bundle; committed golden | To Implement |
| TC-XDEP-001 | `tests/behaviour/queue-members-dependency.test.ts` | `bun test tests/behaviour/queue-members-dependency.test.ts` | Landing observation injection | To Implement |
| TC-XDEP-002 | `tests/behaviour/queue-members-dependency.test.ts` + `tests/behaviour/queue-dep-cycle.test.ts` (extend) | `bun test tests/behaviour/queue-members-dependency.test.ts tests/behaviour/queue-dep-cycle.test.ts` | Ledger digest; cycle fixture | To Implement |
| TC-XCLOSE-001 | `tests/behaviour/closeout-members.test.ts` + `tests/golden/cross-repository-members.test.ts` | `bun test tests/behaviour/closeout-members.test.ts tests/golden/cross-repository-members.test.ts` | Fixed clock; merged facts for both members | To Implement |
| TC-XCLOSE-002 | `tests/behaviour/closeout-members.test.ts` + `tests/behaviour/closeout-queue-removal-skips.test.ts` (extend) | `bun test tests/behaviour/closeout-members.test.ts tests/behaviour/closeout-queue-removal-skips.test.ts` | Partial-merge facts; held lease | To Implement |
| TC-XCLOSE-003 | `tests/behaviour/closeout-members.test.ts` | `bun test tests/behaviour/closeout-members.test.ts` | Squash-safety fact override; branch existence probe | To Implement |
| TC-XCLOSE-004 | `tests/behaviour/closeout-members.test.ts` + `tests/behaviour/closeout-plan.test.ts` (extend) | `bun test tests/behaviour/closeout-members.test.ts tests/behaviour/closeout-plan.test.ts` | Tree snapshot; fixed clock | To Implement |
| TC-XREV-001 | `tests/behaviour/verify-gates-review-flow.test.ts` + `tests/golden/cross-repository-members.test.ts` | `bun test tests/behaviour/verify-gates-review-flow.test.ts tests/golden/cross-repository-members.test.ts` | Injected review observation set | To Implement |
| TC-XREV-002 | `tests/behaviour/verify-gates-review-flow.test.ts` | `bun test tests/behaviour/verify-gates-review-flow.test.ts` | Duplicated observation bundle | To Implement |
| TC-XREV-003 | `tests/behaviour/verify-gates-review-flow.test.ts` | `bun test tests/behaviour/verify-gates-review-flow.test.ts` | Two member-set plans over the same observations | To Implement |
| TC-XREV-004 | `tests/behaviour/verify-gates-review-flow.test.ts` | `bun test tests/behaviour/verify-gates-review-flow.test.ts` | Partial observation bundle | To Implement |
| TC-XREV-005 | `tests/behaviour/verify-gates-review-flow.test.ts` + `tests/behaviour/entrypoint-help.test.ts` (extend) + `tests/structure/event-state-additivity.test.ts` (baseline unchanged) | `bun test tests/behaviour/verify-gates-review-flow.test.ts tests/behaviour/entrypoint-help.test.ts tests/structure/event-state-additivity.test.ts` | Network/no-spawn guards; root-family set assertion | To Implement |
| TC-XREV-006 | `tests/behaviour/verify-gates-review-flow.test.ts` | `bun test tests/behaviour/verify-gates-review-flow.test.ts` | `ReviewObservation` fixture builder `tests/fixtures/cross-repository/review.ts` | To Implement |
| TC-XPAR-001 | `tests/behaviour/cross-repository-parity.test.ts` + `tests/golden/plan-text.test.ts` (unchanged) | `bun test tests/behaviour/cross-repository-parity.test.ts tests/golden/plan-text.test.ts` | Committed pre-change goldens; normalizer asserted keys-only | To Implement + Existing – No Change |
| TC-XPAR-002 | `tests/behaviour/cross-repository-parity.test.ts` + `tests/golden/closeout-envelope.test.ts`, `tests/golden/closeout-human.test.ts` (unchanged) | `bun test tests/behaviour/cross-repository-parity.test.ts tests/golden/closeout-envelope.test.ts tests/golden/closeout-human.test.ts` | Fixed clock for apply mode; committed goldens | To Implement + Existing – No Change |
| TC-XPAR-003 | `tests/behaviour/cross-repository-parity.test.ts` + `tests/golden/verify-gates.test.ts`, `tests/golden/queue-list.test.ts`, `tests/golden/queue-plan.test.ts`, `tests/golden/lanes-list.test.ts` (unchanged) | `bun test tests/behaviour/cross-repository-parity.test.ts tests/golden/verify-gates.test.ts tests/golden/queue-list.test.ts tests/golden/queue-plan.test.ts tests/golden/lanes-list.test.ts` | Committed pre-change goldens | To Implement + Existing – No Change |
| TC-XCTR-001 | `tests/structure/cross-repository-contract.test.ts` + `tests/structure/envelope-contract.test.ts` (extend) | `bun test tests/structure/cross-repository-contract.test.ts tests/structure/envelope-contract.test.ts` | Captured envelopes from behaviour runs | To Implement + Existing – Update |
| TC-XCTR-002 | `tests/behaviour/cross-repository-readonly.test.ts` | `bun test tests/behaviour/cross-repository-readonly.test.ts` | Guarded store recorder; tree/ledger snapshots | To Implement |
| TC-XCTR-003 | `tests/structure/cross-repository-contract.test.ts` + `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts`, `tests/structure/event-state-additivity.test.ts` (extend) | `bun test tests/structure/cross-repository-contract.test.ts tests/structure/error-table.test.ts tests/checks/error-table-sync.test.ts tests/structure/event-state-additivity.test.ts` | Baseline fixtures unchanged | To Implement + Existing – Update |
| TC-XCTR-004 | `tests/structure/cross-repository-contract.test.ts` + `tests/fixtures/closeout/legacy-consumer.ts` (extend fixture) | `bun test tests/structure/cross-repository-contract.test.ts` | Unknown-field injected payloads | To Implement |
| TC-XCTR-005 | `tests/structure/cross-repository-contract.test.ts` | `bun test tests/structure/cross-repository-contract.test.ts` | Pure exports | To Implement |
| TC-XCTR-006 | `tests/behaviour/verify-gates-read-budget.test.ts` (extend) | `bun test tests/behaviour/verify-gates-read-budget.test.ts` | Counting transport; network/no-spawn guards; eight-member fixture | To Implement + Existing – Update |
| TC-XCTR-007 | `tests/structure/cross-repository-contract.test.ts` + `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts`, `tests/structure/event-state-additivity.test.ts` (extend) | `bun test tests/structure/cross-repository-contract.test.ts tests/structure/error-table.test.ts tests/checks/error-table-sync.test.ts tests/structure/event-state-additivity.test.ts` | Committed pre-change error-table/domain-kind snapshot | To Implement + Existing – Update |
| TC-XHERM-001 | `tests/checks/cross-repository-hermetic.test.ts` | `bun test tests/checks/cross-repository-hermetic.test.ts` | Network/no-spawn guards; sanitized env | To Implement |
| TC-XHERM-002 | `tests/checks/cross-repository-hermetic.test.ts` + `tests/checks/fixture-sanitization.test.ts` (extend) | `bun test tests/checks/cross-repository-hermetic.test.ts tests/checks/fixture-sanitization.test.ts` | Host fixture; `realStateFingerprint`; import audit | To Implement + Existing – Update |
| TC-XBOUND-001 | `tests/behaviour/cross-repository-determinism.test.ts` | `bun test tests/behaviour/cross-repository-determinism.test.ts` | Fixed injected clock/runId; replay | To Implement |
| TC-XBOUND-002 | `tests/behaviour/cross-repository-determinism.test.ts` | `bun test tests/behaviour/cross-repository-determinism.test.ts` | Fixed clock; fresh identical fixtures per apply run | To Implement |
| TC-XBOUND-003 | `tests/behaviour/cross-repository-determinism.test.ts` | `bun test tests/behaviour/cross-repository-determinism.test.ts` | Fixed clock; fixed queue state | To Implement |
| TC-XBOUND-004 | `tests/behaviour/verify-gates-members-bounds.test.ts` | `bun test tests/behaviour/verify-gates-members-bounds.test.ts` | Eight-member fact bundle; seven blockers | To Implement |
| TC-XGATE-001 | Aggregate gate + commit-message range gate | `TMPDIR=/home/juliusz/tmp GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=commit.gpgsign GIT_CONFIG_VALUE_0=false pnpm check` then `./scripts/lint-commit-range.sh --base <base>` | None | Verification-only — run, no new code |

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Testing risk | Mitigation |
|----|--------------|------------|
| TR-1 | Parity goldens are regenerated from post-change code, turning the parity proof into a tautology | TC-XPAR-001..003 read the committed pre-change goldens; any regeneration is review-visible and reasoned (Section 6.4) |
| TR-2 | Fixtures accidentally reach the network or the real `$HOME` (hermeticity erosion) | TC-XHERM-001/002 with network/no-spawn guards, sanitized git env, per-case `HOME`, `realStateFingerprint` |
| TR-3 | Cross-member fact reuse hides a per-member CI bug (a passing verdict read from the wrong head) | TC-XDOD-005 records every read with its head SHA and PR identity; distinct heads per member |
| TR-4 | The member-ref extension silently narrows delivered canonicalization | TC-XQUEUE-004 asserts the delivered form verbatim (`GH-010`→`GH-10`) alongside the member form; TC-XPAR-003 asserts the bare-ref queue projection |
| TR-5 | Bounds tests pass vacuously because the report is small | TC-XBOUND-004 uses the eight-member × sixteen-gate cap and seven blockers; asserts the machine byte length and complete blocker list |
| TR-6 | A later re-pin of DEC-15/DEC-16/DEC-17 silently weakens the cases that assert them | TC-XPLAN-006/007, TC-XDOD-009, TC-XREV-006 pin the grammar, evidence element, and `ReviewObservation` shape; §8.3 records the closure and the reconciliation rule forces a plan revision |
| TR-7 | Review-flow tests encode a store or command that the spec forbids | TC-XREV-005 asserts injected-only, no store, no command, no live call, and no new record kind; TC-XREV-006 pins the `ReviewObservation` input shape |
| TR-8 | `mock.module` used for the new surfaces makes suites order-dependent | Import audit in TC-XHERM-002 plus the injected-runtime pattern |
| TR-9 | Fixture roots land inside a git work tree and break repository discovery | Section 6.1 base rules; TC-XHERM-002 asserts each member repo's `--show-toplevel` equals itself |

### 8.2 Assumptions

- The delivered plan validator's tolerance of unknown top-level and per-phase keys is unchanged, so `members` becomes a validated key rather than a rejected one (spec §12).
- The delivered `VerifyGatesCommandRuntime` read seams (`readOpenPullRequests`, `readDeliveryRequestDetail`, `readCheckRuns`, `readWorkItem`, `readGateSet`) are sufficient for per-member corroboration; if a new port is required, it is additive and injected (spec §8.3/§8.4).
- `createMemberCheckout` (or its explicit-base extension) mints member `repoKey`s deterministically enough for stable goldens; tests use returned keys, never literals.
- The closeout harness's fixed clock is sufficient for deterministic `recordedAt` ledger records in apply mode.
- `absent` has one definition (DEC-4) covering no pushed head, no declared pull request, and no run for the head; AC-F3-4 and TC-XDOD-004 follow it.
- The `ReviewObservation` seam `{ repoKey, pullRequest, verdicts[] }` is injected through the existing verification composition (DEC-17); the durable production carrier beyond it is deferred and non-blocking (OQ-3 resolved-with-deferral), so no AC depends on a production writer.
- The `evidence[]` element is `{ repoKey, pullRequest, landed, landingPosition? }` with `landingPosition` 1-based and present only when `landed` is true (DEC-16).

### 8.3 Spec Gap Closure (SG-1..SG-7 closed by spec v1.1)

All seven gaps reported against spec v1.0 were closed additively in spec v1.1; no gap remains open and no AC is uncovered. This section is the closure record: gap → new criterion/decision → test cases.

| ID | Original gap (spec v1.0) | Closed by (spec v1.1) | TC coverage | Status |
|----|--------------------------|-----------------------|-------------|--------|
| SG-1 | No §17 AC for missing/empty member fields; the `repoKey` grammar was unpinned | DEC-15 with AC-F1-5 (required/empty fields, empty `dependsOn` element) and AC-F1-6 (`repoKey` grammar) | TC-XPLAN-006, TC-XPLAN-007 (TC-XPLAN-004 keeps the combined closed-field-set probe) | **Closed** |
| SG-2 | F-2's per-member lease release had no §17 AC | AC-F2-5 (release one member ref, `released`, entries retained, the other member's held lease unchanged and never blocking) | TC-XQUEUE-006 (TC-XQUEUE-005 keeps the general release/lane probe) | **Closed** |
| SG-3 | The unresolvable declared gate identifier had no §17 AC | AC-F3-7 (verdict `unknown`, blocker named, `blocked`, exit 1, no invented `pass`) | TC-XDOD-008, TC-XDOD-006 | **Closed** |
| SG-4 | NFR-6 (bounded reads) and NFR-7 (identity reuse) had no §17 ACs | AC-NFR6-1 (counting transport: ≤1 page/detail/check-run per member, 0 retries/pagination, no out-of-set call) and AC-NFR7-1 (row count and kind membership identical) | TC-XCTR-006, TC-XCTR-007 (TC-XDOD-005/TC-XCTR-003 keep the provenance/identity probes) | **Closed** |
| SG-5 | The review-observation carrier was unnamed (OQ-3 open) | DEC-17 with AC-F6-4: injected `ReviewObservation` `{repoKey, pullRequest, verdicts[]}` through the verification composition; no store/no command; durable production carrier deferred, non-blocking | TC-XREV-006, TC-XREV-005 | **Closed (seam pinned)**; durable carrier deferred |
| SG-6 | The `evidence[]` element shape was unpinned | DEC-16 with AC-F3-8: exactly `{repoKey, pullRequest, landed, landingPosition?}`; PR-less member omitted from `evidence[]` | TC-XDOD-009, TC-XDOD-007 | **Closed** |
| SG-7 | AC-F3-4 vs F-3/DEC-4 definitional tension for a missing `pullRequest` | DEC-4 states one `absent` definition (no head, no PR, or no run) and AC-F3-4 is aligned | TC-XDOD-004 | **Closed** |

**Residual (non-blocking) information.** OQ-3 remains residual only for a durable production carrier of review verdicts beyond the injected composition seam. No acceptance criterion depends on it; if a later change introduces one, it must supply the same `ReviewObservation` input, and TC-XREV-005/006 narrow rather than disappear.

**Reconciliation rule (binding).** If the implementation plan, a later decision, or a review pin differs from any value this plan asserts — bounds, member field names, `repoKey` grammar, `evidence[]` shape, `ReviewObservation` shape, exit projection, fixture base, or golden provenance — this test plan is revised **in the same change before the DoR gate** and never drifts silently. Every revision is recorded in Section 9 with the reason. A test that would need to change its expectation because the pin changed is a plan revision, not a test tweak.

### 8.4 Manual and Verification-Only Items (not counted as automated coverage)

| Item | AC | Why it is not automated | Evidence |
|------|----|-------------------------|----------|
| TC-XGATE-001 — aggregate gate battery | AC-NFR5-1 | It is command execution at the delivered HEAD, not test code; it is recorded per phase | Command + result recorded in `chg-GH-310-pm-notes.yaml` |
| Commit hygiene (conventional subjects, body/footer ≤100 chars) | AC-NFR5-1 | Branch-range review by nature (`.ai/rules/testing-strategy.md` forbids permanent branch-diff suites) | `./scripts/lint-commit-range.sh --base <base>` verdict + commit inspection, recorded in pm-notes |
| PR posture (targets `main-tools`, stays open) | DoD-15, DEC-14 | Lifecycle record, not a test | Phase-11 PR record in pm-notes |
| Current-truth doc reconciliation | DoD-13, NG-9 | Phase-7 documentation work | Doc diff review recorded in pm-notes |

These items are **excluded** from the 50 automated TCs and from the 36 automated AC count; AC-NFR5-1 remains covered by gate evidence.

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-14 | test-plan-writer (deepseek-flash) | Initial test plan from `chg-GH-310-spec.md` (29 ACs, DoD-1..15, DEC-1..14, OQ-3 residual, Appendix A/C), `chg-GH-310-pm-notes.yaml` (fixture and gate-environment decisions), the M2 scenario seeds SC-M2-S19-01..05 (inherited by name), and the delivered fixture/suite conventions (`tests/fixtures/projects/temp-repos.ts`, `tests/fixtures/{plan,verify-gates,queue,closeout}`, `tests/golden/**`). 43 TCs in 11 families; 29/29 ACs covered; 0 orphan TCs; spec gaps SG-1..SG-7 reported without editing the spec. |
| 1.1 | 2026-11-14 | test-plan-writer (deepseek-flash) | Additive update for spec v1.1 (29 → 37 ACs, DEC-15/16/17, DEC-4 single `absent`, OQ-3 resolved-with-deferral). Added 8 TCs with no renumbering: TC-XPLAN-006 (AC-F1-5), TC-XPLAN-007 (AC-F1-6), TC-XQUEUE-006 (AC-F2-5), TC-XDOD-008 (AC-F3-7), TC-XDOD-009 (AC-F3-8, DEC-16 element shape), TC-XREV-006 (AC-F6-4, DEC-17 `ReviewObservation`), TC-XCTR-006 (AC-NFR6-1), TC-XCTR-007 (AC-NFR7-1). Re-bound existing TCs to the new criteria (XPLAN-004, XQUEUE-005, XDOD-004/005/006/007, XREV-005, XCTR-003) without changing their assertions or IDs; updated §3 matrices/counts (37/37, 51 TCs), §5.1/§5.2, §6.3, §7, §8.1-§8.4, and recorded SG-1..SG-7 as closed. |

## 10. Test Execution Log

Populated during delivery (one row per execution batch; full evidence in `chg-GH-310-pm-notes.yaml`).

| TC ID(s) | Run Date | Command | Result | Notes |
|----------|----------|---------|--------|-------|
| — | — | — | Not run yet | Phase 6 (delivery) populates this log |
