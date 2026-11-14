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

- The plan declaration `members[]` (≤8 entries; `repoKey`, `slice`, `branch`, `pullRequest`, `dependsOn[]` ≤8, `gates` 1..16 identifiers each a non-empty string of at most 64 characters): valid echo through `plan validate`, negative classification through `plan validate` and `lint plan`, an invalid verdict carrying no `members` key, and every declared bound including the derived member-ref length (AC-F1-1..AC-F1-6; DM-1; DEC-1, DEC-9, DEC-10, DEC-15).
- The member queue representation: two entries keyed `<ref>@<repoKey>`, one lane each, per-member dependency edges, `dependency-open` readiness, per-member lease release and removal, the additive `queue add` `data.members[]` `{ref, repoKey, lane}`, and the extended member-ref canonicalization (AC-F2-1..AC-F2-5; DM-6; DEC-2, DEC-7, DEC-21).
- The shared definition of done: `data.definitionOfDone` (`status`, `members[]` with `gates.ci`/`verdict`, ordered `evidence[]`), `data.blockingMembers[]`, the per-(member, gate) `gates[]` projection with its required `member` discriminator and matching `summary` counts (DM-9), the member verdict rule over both records and `gates.ci` (`pass` only when every record and `gates.ci` are `pass`; `fail` on any record or `gates.ci` `fail`; otherwise `unknown`), the change aggregation (`blocked` on any `fail`, any `gates.ci: unavailable`, or any synthetic unresolvable record; `incomplete` otherwise with a member `unknown`; `blocked` wins), the `overall` projection `green`→`pass` / `blocked`→`fail` / `incomplete`→`fail` with `overall: unknown` never emitted, data-bearing negative reports carrying `verify.gates.failed` through `overall: fail` only, the distinct `CrossRepositoryVerifyGatesReport`/`CrossRepositoryVerifyGateRecord` types discriminated by `definitionOfDone`, and `MemberLandingObservation` as the landing/merge carrier; per-member CI on each member's own pushed head; `unavailable`/`absent` never green (AC-F3-1..AC-F3-8; DM-2, DM-3, DM-4, DM-9, DM-10, DM-11; DEC-3, DEC-4, DEC-6, DEC-11, DEC-18, DEC-19).
- Member dependency ordering: `dependency-open` readiness, `queue.precondition.unmet` start refusal naming member and prerequisite, admission after the prerequisite lands, and `queue.dependency-cycle` for member-ref edge cycles (AC-F4-1, AC-F4-2; DEC-7).
- The closeout member report `data.members[]` with `repoKey`, `branch`, `cleanup`, `pullRequest`, `issueClosure`, `landed`; the exact mode-scoped mapping columns (plan cleanup `would-apply`/`satisfied`/`would-refuse`/`skipped-gap`; plan issue closure `would-apply`/`satisfied`/`skipped-noop`/`skipped-gap`; apply cleanup `applied`/`satisfied`/`refused`/`skipped-gap`; apply issue closure `applied`/`satisfied`/`skipped-noop`/`skipped-gap`), one value per field, never derived by parsing step `detail`; partial landing visibility; per-member landing removal; unsafe squash-safety refusal in plan (`would-refuse`) and apply (`refused`) modes (AC-F5-1..AC-F5-4; DM-5, DM-8; DEC-12, DEC-20, OQ-5, OQ-6).
- One review flow over the declared member set: stable `runId` digested over `repoKey` plus pull-request-or-empty marker, one verdict per member, `complete` semantics, duplicated-observation degradation, PR-less member-set change detection, and `unreviewed` for an unobserved member (AC-F6-1..AC-F6-4; DM-7; DEC-8, DEC-17; OQ-3 pin).
- Single-repository parity for plan validate/lint/diff/overlap, verify gates (including the literal `overall: "pass"`, the failure envelope, exits 1/2, and `gates[]` without `member`), closeout (plan and apply), and queue/lanes including the member-less `queue add` payload, asserted against the pre-change goldens (AC-F1-3, AC-F5-4, AC-F7-1; NFR-8; C-1; DEC-18, DEC-21).
- Contract continuity: envelope shape, data-only keys, zero new error rows and domain kinds, read-only posture, bounded per-member reads with no extra read for landing/merge truth, deterministic repeated runs, and the eight-member blocker-non-truncation bound (AC-NFR1-1, AC-NFR2-1, AC-NFR3-1, AC-NFR4-1, AC-NFR6-1, AC-NFR7-1; NFR-6, NFR-7; DEC-10, DEC-19).
- Hermetic, offline fixtures: two real local temporary member repositories per case from the delivered `tests/fixtures/projects/temp-repos.ts` seam, injected provider observations, zero live network, zero real second remote, zero credentials (AC-NFR3-1).
- The gate battery and commit hygiene (AC-NFR5-1), recorded as verification-only evidence.

### 1.2 Out of Scope & Known Gaps

- **No live multi-repository execution and no second real remote** (NG-1): every provider fact is an injected observation over local temporary repositories; a local bare origin is used only as a clone source where a clone is required and is never a network remote.
- **No merge authority and no merge transaction** (NG-2): the review-flow and closeout cases observe merges; nothing merges a pull request.
- **No global or group-scoped store, no new record kind** (NG-3, NFR-7): the member report is derived output. The absence of a store is asserted (Section 5, TC-XREV-005/TC-XCTR-003), never stubbed into existence.
- **No board, MCP, OpenCode/host, or tracker-adapter change** (NG-4, NG-5, NG-6): not tested; only the CLI envelope is the observable surface.
- **No per-member file scope, no member-aware `plan diff`/`plan overlap`** (NG-8): those surfaces are tested only for byte parity (TC-XPAR-001), never for member semantics.
- **No current-truth feature-spec amendment in delivery phases** (NG-9): phase 7 reconciliation is documentation evidence (DoD-13), not a test case.
- **Prior spec gaps and DoR findings are closed by spec v1.1–v1.3** (see Section 8.3): the missing/empty member fields and the `repoKey` grammar are AC-F1-5/AC-F1-6 (DEC-15); per-member lease release is AC-F2-5; the unresolvable declared gate identifier is AC-F3-7; bounded per-member reads and identity reuse are AC-NFR6-1/AC-NFR7-1; the `evidence[]` element shape is AC-F3-8 (DEC-16); the review-observation seam is AC-F6-4 (DEC-17); and `absent` has one definition (DEC-4). Spec v1.3 additionally pins the per-(member, gate) `gates[]`/`summary` projection (DM-9), the scoped `overall` pass/fail supersession (DEC-18), the `MemberLandingObservation` carrier (DM-10), and the declared-set `runId` digest (DEC-8). The corresponding TCs are fully AC-bound.
- **Quality-gate and PR posture are lifecycle evidence, not automated tests** (Section 8.4): TC-XGATE-001 is verification-only and excluded from the automated TC count; the PR staying open against `main-tools` is a phase-11 record.
- **No branch-diff assertions in permanent suites** (`.ai/rules/testing-strategy.md`): "no forbidden area changed" and "docs flip only in phase 7" remain review-time checks, not TCs.

## 2. References

- Change specification: `./chg-GH-310-spec.md` — 37 acceptance criteria AC-F1-1…AC-NFR7-1 (§17, spec v1.4); DoD-1…DoD-15 (§17.1); capabilities F-1…F-7 (§5); interfaces DM-1…DM-11 (§8.3); NFR-1…NFR-9 (§9); risks RSK-1…RSK-11 (§11); decisions DEC-1…DEC-21 (§15); open questions OQ-1…OQ-6 (§14, OQ-3 and OQ-6 resolved-with-deferral); pinned literals (Appendix A, items 1–26); constraint register C-1…C-9 (Appendix C); ticket AC mapping (Appendix B).
- Implementation plan: `./chg-GH-310-plan.yaml` — **revision 1.2 exists and is reconciled** with the preceding test-plan/spec revision (authored against v1.3, five delivery phases). It declares every §7 suite home in an owning phase scope, names the `queue-add-memberless.json` golden in phase 1 scope/obligation 1.0, and carries the DM-8/DM-9/DM-10 and DEC-18 scopes. Spec v1.4 is an additive pin set on the same contract surfaces (member-verdict aggregation, synthetic citation, report-type discrimination, mode-scoped closeout mapping); it adds no suite file and no phase, so it does not re-open plan scope. The only plan-side residuals are the iteration-2 non-blocking items N2 (phase-3 determinism-suite scope), N7 (phase-5 commit type), and N8 (suite-home count wording), owned by delivery_planning.
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
| AC-F1-2 | Duplicate `repoKey`, unknown `dependsOn`, self edge, cycle, unknown member key → `plan.schema.invalid` naming `members[i].<field>`, lint locations, exit 1, invalid verdict carries **no** `members` key | TC-XPLAN-002, TC-XCTR-003 | Covered |
| AC-F1-3 | Member-less plan validate/lint/diff/overlap byte-identical, no `members` key | TC-XPAR-001 | Covered |
| AC-F1-4 | Over-bounds (>8 members, >8 edges, >16 gates, >64-char member ref) → `plan.schema.invalid`, exit 1 | TC-XPLAN-003 | Covered |
| AC-F1-5 | Missing required field (`repoKey`/`slice`/`branch`/`gates`), empty `slice`/`branch`, or empty `dependsOn` element → `plan.schema.invalid` naming `members[i].<field>` in validate and lint, no invented default, not echoed | TC-XPLAN-006, TC-XPLAN-004 | Covered |
| AC-F1-6 | `repoKey` outside the DEC-15 grammar → `plan.schema.invalid` naming `members[i].repoKey`; a matching `repoKey` is accepted and echoed verbatim | TC-XPLAN-007, TC-XPLAN-004 | Covered |
| AC-F2-1 | `queue add` returns the delivered payload plus additive `data.members[]` `{ref, repoKey, lane}` in declared order; `queue list` then shows exactly two member entries, own repository, own lane, no bare-ref entry, no cross-member lane (DEC-21) | TC-XQUEUE-001, TC-XQUEUE-005 | Covered |
| AC-F2-2 | B depends on A unlanded → edge to A's member ref, B `not-ready`/`dependency-open`, A unaffected (SC-M2-S19-05) | TC-XQUEUE-002 | Covered |
| AC-F2-3 | A lands → exactly one removal for A's member ref reason `landed`, B retained, B readiness recomputed | TC-XQUEUE-003, TC-XQUEUE-005 | Covered |
| AC-F2-4 | Member ref canonicalizes and is accepted everywhere; delivered form unchanged; `ref-not-canonical` never applies to a member ref | TC-XQUEUE-004 | Covered |
| AC-F2-5 | Both members hold leases and A's lease is held by another holder → `queue release <ref>@<B>` releases exactly B's lease (`released`), both entries remain, A's lease/entry unchanged, A never blocks B's release | TC-XQUEUE-006, TC-XQUEUE-005 | Covered |
| AC-F3-1 | Both members' gates/CI pass → `green`, `overall: pass`, `gates[]` one record per (member, gate) with required `member` and all `pass`, `summary` equals record counts, each member `pass` because both its records and `gates.ci` are `pass`, empty blockers, both PRs in evidence, exit 0 (SC-M2-S19-03; DM-9, DM-11, DEC-18) | TC-XDOD-001 | Covered |
| AC-F3-2 | Member B fails a declared gate → `blocked`, `overall: fail` (the sole carrier of `verify.gates.failed`, no separate field, no error envelope), B's failing `gates[]` record has `member: B.repoKey`, `summary.failed` counts it, `blockingMembers[]=[B]`, B `fail`, A `pass`, data present, exit 1; records all `pass` but `gates.ci: fail` ⇒ B `fail`/blocked (SC-M2-S19-02; DM-9, DEC-18) | TC-XDOD-002 | Covered |
| AC-F3-3 | CI unavailable → `gates.ci: unavailable`, `verdict: unknown` (never `pass`, even when every declared record passes), `blockingMembers[]` names it, `blocked`, `overall: fail`, `summary.failed` stays 0 for its records, exit 1 (SC-M2-S19-04; DM-3, NFR-5, DEC-18) | TC-XDOD-003 | Covered |
| AC-F3-4 | CI truth cannot be established (no pushed head, no declared pull request, or no run) while no member is `fail` or `unavailable` and no synthetic unresolvable-identifier record exists → `incomplete`, `overall: fail` (never `unknown`), `gates.ci: absent`, `verdict: unknown`, `gates[]`/`summary` present, blocker named, exit 1 (DEC-4, DEC-18) | TC-XDOD-004 | Covered |
| AC-F3-5 | One member passes, the other's CI is unavailable even though its records pass → unavailable member `verdict: unknown`, `gates.ci` never `pass`, readable member `pass`, `blocked`, `overall: fail` (no cross-member reuse) | TC-XDOD-005 | Covered |
| AC-F3-6 | Partly landed: evidence landed first by ascending landing position, then unlanded in declared order, stable on repeat (SC-M2-S19-05) | TC-XDOD-007, TC-XBOUND-001 | Covered |
| AC-F3-7 | Unresolvable declared gate identifier → member `verdict: unknown`, exactly one synthetic `gates[]` record (`id` = declared id, required `member` = repoKey, `verdict: unknown`, delivered `read-failed` reason, `citation: identity:{changeRef}` only with `sources:[]`, `counts:[]`, `names:[]`, `reasons:["read-failed"]`, no provider source/name/branch/SHA), `summary.unknown` counts it once, blocker named, `blocked`, `overall: fail`, exit 1 | TC-XDOD-008, TC-XDOD-006 | Covered |
| AC-F3-8 | Member with no declared `pullRequest` stays in `members[]` with `gates.ci: absent` and is omitted from `evidence[]`; every member with a PR appears with `repoKey`, `pullRequest`, `landed` (DEC-16) | TC-XDOD-009, TC-XDOD-007 | Covered |
| AC-F4-1 | Start on B while A unlanded → `queue.precondition.unmet` naming B and A, exit 1; admitted after A lands | TC-XDEP-001 | Covered |
| AC-F4-2 | Member-ref edge cycle → `queue.dependency-cycle`, exit 1; plan cycle → `plan.schema.invalid` before any queue write | TC-XDEP-002, TC-XPLAN-002, TC-XCTR-003 | Covered |
| AC-F5-1 | Both merged, one `CrossRepositoryCloseoutObservation` per member → two ordered `data.members[]` entries; apply `cleanup` from `applied`/`satisfied`/`refused`/`skipped-gap` and apply `issueClosure` from `applied`/`satisfied`/`skipped-noop`/`skipped-gap`, exactly one value per field, derived from the member observation + own operations (never step `detail`), aggregate outcomes unchanged, `landed: true`, per-member removal (SC-M2-S19-01; DEC-12, DEC-20) | TC-XCLOSE-001, TC-XCLOSE-004 | Covered |
| AC-F5-2 | Only A merged, expressed through `CrossRepositoryCloseoutObservation` values → A `landed: true`, B `landed: false`; A removed, B retained or disclosed with a delivered skip reason; nothing claims B landed (DEC-20) | TC-XCLOSE-002 | Covered |
| AC-F5-3 | Unsafe squash predicate while the other member cleans normally → plan: unsafe `would-refuse`, other `would-apply`; apply: unsafe `refused`, other `applied`; branch kept, aggregate `branch-cleanup` outcome not rewritten, `landed` merge truth (DEC-12) | TC-XCLOSE-003 | Covered |
| AC-F5-4 | Member-less closeout (plan and apply) → no `members` key; steps/outcomes/ledger/human output byte-identical | TC-XPAR-002 | Covered |
| AC-F6-1 | Two members, one observation each → one verdict per declared member in order, `complete: true`; second run identical `runId`, no added verdict | TC-XREV-001, TC-XREV-004, TC-XREV-005 | Covered |
| AC-F6-2 | Duplicated review observation → member `fail`, `complete: false`, still one entry | TC-XREV-002 | Covered |
| AC-F6-3 | Member set changes between runs — including adding/removing a member with no `pullRequest` → `runId` differs (digest over sorted declared set with `repoKey` + pull-request-or-empty marker), no entry for a removed member, PR-less member is `unreviewed` | TC-XREV-003 | Covered |
| AC-F6-4 | One `ReviewObservation` per member through the verification composition → each verdict derives from its own observation only; a second observation yields `fail`/`complete: false`; no member is `pass` without a matching observation | TC-XREV-006, TC-XREV-002 | Covered |
| AC-F7-1 | Parity fixture set: member-less plan/gates/closeout/queue byte-identical with identical exits | TC-XPAR-003, TC-XPAR-001, TC-XPAR-002 | Covered |
| AC-NFR1-1 | Every envelope: five-field `delivery.result.v1`, new keys under `data`, zero `ok`/`command` top-level | TC-XCTR-001, TC-XCTR-005, TC-XREV-005 | Covered |
| AC-NFR2-1 | Repeated runs byte-identical (verdict/closeout/queue); eight-member report within the machine byte bound; blockers never truncated | TC-XBOUND-001, TC-XBOUND-002, TC-XBOUND-003, TC-XBOUND-004 | Covered |
| AC-NFR3-1 | Default suite: two real local temporary repositories, injected provider facts, zero live network/second remote/credentials | TC-XHERM-001, TC-XHERM-002 | Covered |
| AC-NFR4-1 | Plan validation writes nothing; full battery appends exactly one gate-verification record; closeout plan mode zero writes | TC-XCTR-002, TC-XCLOSE-004 | Covered |
| AC-NFR5-1 | `TMPDIR=/home/juliusz/tmp pnpm check` green; conventional subjects; body/footer ≤100 characters | TC-XGATE-001 (verification-only) | Covered (gate evidence) |
| AC-NFR6-1 | Counting transport: ≤1 open-PR page, ≤1 detail read, ≤1 check-run page per declared member; 0 retries, 0 pagination, no call outside the declared member set; `landed`/`landingPosition`/merge truth arrive as `MemberLandingObservation` entries and add no read (DEC-19, DM-10) | TC-XCTR-006, TC-XDOD-005, TC-XDOD-007 | Covered |
| AC-NFR7-1 | Error-table row count and domain-kind membership identical to pre-change; no new identity string; every exercised refusal resolves to a delivered identity | TC-XCTR-007, TC-XCTR-003 | Covered |

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

No HTTP endpoint and no new event kind exists (spec §8.1/§8.2: N/A). Member queue entries reuse the delivered `queue.graph` kinds (`entry`, `dependency-edge`, `release`, `remove`) keyed by the member ref; no new topic or kind. Data-model surfaces:

| ID | Element | TC ID(s) | Status |
|----|---------|----------|--------|
| DM-1 | Plan member declaration `members[]` (DEC-15 grammar: required `repoKey`/`slice`/`branch`/`gates`, optional `pullRequest`/`dependsOn`, ≤8, `dependsOn` ≤8, `gates` 1..16 identifiers each non-empty and ≤64 chars) and the `plan validate` echo; an invalid verdict carries no `members` key | TC-XPLAN-001, TC-XPLAN-002, TC-XPLAN-003, TC-XPLAN-004, TC-XPLAN-005, TC-XPLAN-006, TC-XPLAN-007 | Covered |
| DM-2 | `data.definitionOfDone` (`status`, `members[]` with `repoKey`/`gates.ci`/`verdict`, `evidence[]`) plus `data.blockingMembers[]` (every member not `pass`, declared order); required `gates[]` (per-(member, gate) records, DM-9) and `summary` (record counts) present on all statuses; `status` is `blocked` on any member `fail`, any `gates.ci: unavailable`, or any synthetic unresolvable record, `incomplete` otherwise when ≥1 member is `unknown`, `green` iff all are `pass`; report-level `overall` is `pass` for `green`, `fail` for `blocked`/`incomplete`; `overall: unknown` is never emitted (DEC-18) | TC-XDOD-001…TC-XDOD-009, TC-XCTR-005, TC-XCTR-007 | Covered |
| DM-3 | Closed vocabularies and the mechanical member rule: `gates.ci` (`pass`/`fail`/`unavailable`/`absent` per DEC-4); member `verdict` `pass` iff every declared record `pass` **and** `gates.ci: pass`, `fail` on any record `fail` or `gates.ci: fail`, otherwise `unknown`; `status` `green`/`blocked`/`incomplete` with `blocked` winning; report `overall` `pass`/`fail` only (DEC-18) | TC-XDOD-001, TC-XDOD-002, TC-XDOD-003, TC-XDOD-004, TC-XDOD-005, TC-XDOD-006, TC-XDOD-008, TC-XDOD-009, TC-XCTR-005 | Covered |
| DM-4 | `evidence[]` entries `{repoKey, pullRequest, landed, landingPosition?}` (DEC-16), landing order and ties; `landed`/`landingPosition`/merge truth come from injected `MemberLandingObservation` entries (DM-10, DEC-19); pull-request-less members omitted from `evidence[]` while remaining in `members[]` | TC-XDOD-007, TC-XDOD-009, TC-XBOUND-004 | Covered |
| DM-5 | `closeout.data.members[]` six fields with exactly one mode-scoped value per field — plan `cleanup` `would-apply`/`satisfied`/`would-refuse`/`skipped-gap`; plan `issueClosure` `would-apply`/`satisfied`/`skipped-noop`/`skipped-gap`; apply `cleanup` `applied`/`satisfied`/`refused`/`skipped-gap`; apply `issueClosure` `applied`/`satisfied`/`skipped-noop`/`skipped-gap` — derived from the member's `CrossRepositoryCloseoutObservation` plus its own operations, never from parsing step `detail`; aggregate step outcome never rewritten; merge-truth `landed` (DEC-12, DEC-20) | TC-XCLOSE-001, TC-XCLOSE-002, TC-XCLOSE-003, TC-XCLOSE-004, TC-XPAR-002 | Covered |
| DM-6 | Member ref `<canonicalChangeRef>@<repoKey>` ≤64; one entry/lease/lane/edge-set/removal per member; per-member release; `queue add` returns the delivered payload plus additive `data.members[]` `{ref, repoKey, lane}` in declared order (DEC-21); plain ref when no members | TC-XQUEUE-001…TC-XQUEUE-006, TC-XPLAN-003, TC-XPAR-003 | Covered |
| DM-7 | `data.reviewFlow` (`runId`, `complete`, `verdicts[]` with `pass`/`fail`/`unreviewed`); `runId` digests the sorted declared member set (`repoKey` + `pullRequest` or explicit empty marker), so adding/removing a PR-less member changes it (DEC-8); inputs are injected `ReviewObservation` values (DEC-17) | TC-XREV-001…TC-XREV-006, TC-XPAR-003 | Covered |
| DM-8 | `CrossRepositoryCloseoutObservation` `{repoKey, pullRequest, merged, headSha?, branch, issueClosure?}`, one per declared member through the closeout composition; no new port, provider operation, or store (DEC-20, OQ-6) | TC-XCLOSE-001, TC-XCLOSE-002, TC-XCLOSE-004 | Covered |
| DM-9 | `CrossRepositoryVerifyGateRecord` extends the delivered `VerifyGateRecord` with a **required** `member`; cross-repository `gates[]` one record per declared (member, gate) in member-declared then gate order, `summary` counts records; unresolvable identifier = exactly one `unknown` record with `reason: read-failed` and `citation` = `identity:{changeRef}` only, `sources:[]`, `counts:[]`, `names:[]`, `reasons:["read-failed"]` — no provider source/count/name/branch/SHA invented; member-less `gates[]` is the delivered `VerifyGateRecord[]` with no `member` (DM-11, DEC-18) | TC-XDOD-001, TC-XDOD-002, TC-XDOD-008, TC-XBOUND-004, TC-XPAR-003, TC-XCTR-007 | Covered |
| DM-10 | `MemberLandingObservation` `{repoKey, merged, headSha?, landingPosition?}`, one per declared member through the verification composition; `landingPosition` is a 1-based integer present only when `merged` is true; supplies `landed`/merge truth with no provider read, port, operation, or store (DEC-19) | TC-XDOD-007, TC-XDOD-009, TC-XCTR-006, TC-XHERM-001 | Covered |
| DM-11 | Distinct report types and the emitted union: delivered `VerifyGatesReport` is unchanged (`overall` literal `"pass"`, `gates[]: VerifyGateRecord[]` with no `member`, delivered envelope/exits); new `CrossRepositoryVerifyGatesReport` carries the same required delivered report fields plus `overall: "pass" \| "fail"`, `definitionOfDone`, `blockingMembers[]`, `reviewFlow`, and `gates[]: CrossRepositoryVerifyGateRecord[]`; the union is discriminated by the **presence of `definitionOfDone`** (DEC-18) | TC-XDOD-001, TC-XPAR-003, TC-XCTR-007 | Covered |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement | TC ID(s) | Status |
|--------|-------------|----------|--------|
| NFR-1 | Envelope continuity (five fields, keys under `data`, no `ok`/`command` top level) | TC-XCTR-001, TC-XCTR-005 | Covered |
| NFR-2 | Determinism, declared order, bounds, blocker never truncated | TC-XBOUND-001…TC-XBOUND-004, TC-XDOD-007 | Covered |
| NFR-3 | Offline/hermetic default tests (real local temp repos, injected facts) | TC-XHERM-001, TC-XHERM-002 | Covered |
| NFR-4 | Read-only posture (0 plan writes, 1 gate-verification append, 0 closeout plan-mode writes) | TC-XCTR-002, TC-XCLOSE-004 | Covered |
| NFR-5 | Unavailable/absent never green and always recorded | TC-XDOD-003, TC-XDOD-004, TC-XDOD-005 | Covered |
| NFR-6 | Bounded per-member reads (≤1 open-PR page, ≤1 detail, ≤1 check-run page per member; 0 retries, 0 pagination; no call outside the declared member set); landing/merge truth arrives as `MemberLandingObservation` and adds no read (DEC-19, DM-10) | TC-XCTR-006, TC-XDOD-005, TC-XDOD-007, TC-XHERM-001 | Covered |
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

Spec v1.1 closed every prior gap: AC-F1-5/AC-F1-6 now own the missing-field and `repoKey`-grammar cases, AC-F2-5 owns per-member release, AC-F3-7 owns the unresolvable gate identifier, AC-F3-8 owns the evidence element and PR-less omission, AC-F6-4 owns the `ReviewObservation` seam, and AC-NFR6-1/AC-NFR7-1 own bounded reads and identity reuse. Spec v1.2 added no ACs: DEC-18..DEC-21 pin literals inside existing criteria, asserted additively in TC-XDOD-001/002/004 (`overall`), TC-XDOD-007/TC-XCTR-006 (injected landing/merge truth, no extra read), TC-XCLOSE-001/002 (`CrossRepositoryCloseoutObservation`), and TC-XQUEUE-001/TC-XPAR-003 (`queue add` member payload). Spec v1.3 also adds no ACs: it pins the per-(member, gate) `gates[]`/`summary` projection (DM-9, now asserted in TC-XDOD-001/002/008/TC-XPAR-003), corrects the `overall` projection to `pass`/`fail` with `unknown` never emitted (TC-XDOD-001/002/004/TC-XPAR-003), names the `MemberLandingObservation` carrier (DM-10, TC-XDOD-007/TC-XCTR-006), and extends the `runId` digest to the declared set including PR-less members (TC-XREV-003). Spec v1.4 (DoR iteration-2) likewise adds no ACs: it pins the member-verdict rule over records **and** `gates.ci` plus the change aggregation (TC-XDOD-001/002/003/004/005), the synthetic unresolvable-record citation (TC-XDOD-008), the distinct `CrossRepositoryVerifyGatesReport`/`CrossRepositoryVerifyGateRecord` types discriminated by `definitionOfDone` (TC-XCTR-007/TC-XPAR-003), the mode-scoped closeout mapping (TC-XCLOSE-001/003), and the `overall: "fail"` classification carrier (TC-XDOD-002). Every TC therefore cites a §17 criterion; no TC relies on a "nearest AC" exception.

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
| TC-XPLAN-002 | Five member-declaration defects classify as `plan.schema.invalid` in validate and lint; invalid verdict carries no `members` key | Negative | Automated | Critical | AC-F1-2, AC-F4-2 |
| TC-XPLAN-003 | Member bounds rejected at the declared limits (members, edges, gates, member-ref length) | Negative | Automated | Critical | AC-F1-4 |
| TC-XPLAN-004 | Closed member field set: missing/empty fields and malformed `repoKey` are classified, never accepted | Negative | Automated | High | AC-F1-2, AC-F1-5, AC-F1-6 |
| TC-XPLAN-005 | Gate identifiers are shape-validated only (non-empty, ≤64 chars); plan validation reads no configuration | Edge Case | Automated | High | AC-F1-1, AC-F1-5, AC-F3-7 |
| TC-XPLAN-006 | Required-field and empty-value defects: missing `repoKey`/`slice`/`branch`/`gates`, empty `slice`/`branch`, empty `dependsOn` element (AC-F1-5) | Negative | Automated | Critical | AC-F1-5 |
| TC-XPLAN-007 | `repoKey` grammar: non-matching rejected naming `members[i].repoKey`; matching accepted and echoed verbatim (AC-F1-6) | Negative | Automated | Critical | AC-F1-6 |
| TC-XQUEUE-001 | `queue add` returns the delivered payload plus `data.members[]` `{ref, repoKey, lane}`; two entries, separate repositories and lanes, no bare-ref entry (SC-M2-S19-01; DEC-21) | Happy Path | Automated | Critical | AC-F2-1 |
| TC-XQUEUE-002 | Per-member dependency edge makes B `not-ready`/`dependency-open`, A unaffected (SC-M2-S19-05) | Happy Path | Automated | Critical | AC-F2-2 |
| TC-XQUEUE-003 | A lands: one removal for A's member ref with reason `landed`, B retained and re-evaluated | Happy Path | Automated | Critical | AC-F2-3 |
| TC-XQUEUE-004 | Member-ref canonicalization extended; delivered `<PREFIX>-<digits>` form unchanged | Contract | Automated | Critical | AC-F2-4 |
| TC-XQUEUE-005 | Per-member lease release keeps entries; no cross-repository lane | Edge Case | Automated | High | AC-F2-1, AC-F2-3, AC-F2-5 |
| TC-XQUEUE-006 | Per-member release: release B while A's lease is held elsewhere; exactly B released, both entries retained, A unchanged (AC-F2-5) | Happy Path | Automated | Critical | AC-F2-5 |
| TC-XDOD-001 | Both members pass: `green`, `overall: pass`, `gates[]` per (member, gate) with required `member`, matching `summary`, member `pass` only when records **and** `gates.ci` pass, empty blockers, both PRs in evidence, exit 0 (SC-M2-S19-03; DM-2, DM-3, DM-9, DM-11, DEC-18) | Happy Path | Automated | Critical | AC-F3-1 |
| TC-XDOD-002 | Member gate failure (record fail, or all records pass with `gates.ci: fail`): `blocked`, `overall: fail` is the sole `verify.gates.failed` carrier (no separate field, no error envelope), failing `gates[]` record carries `member`, exit 1; blocked wins over incomplete (SC-M2-S19-02; DM-3, DM-9, DEC-18) | Negative | Automated | Critical | AC-F3-2 |
| TC-XDOD-003 | Unavailable CI even when every record passes: `gates.ci: unavailable` ⇒ `unknown` (never `pass`), blocker named, `blocked`, `overall: fail`, `summary.failed` 0, exit 1 (SC-M2-S19-04; DEC-18) | Negative | Automated | Critical | AC-F3-3 |
| TC-XDOD-004 | Absent evidence (no pushed head, no `pullRequest`, or no run): `incomplete` only when no member is `fail`/`unavailable`/unresolvable, `overall: fail` (never `unknown`, never exit 2), `unknown`, blocker named, data present, exit 1 (DEC-18) | Edge Case | Automated | Critical | AC-F3-4 |
| TC-XDOD-005 | No cross-member CI reuse: unavailable member `unknown` even with all records passing, readable member `pass`, `blocked`/`overall: fail`; per-member reads bounded and recorded | Negative | Automated | Critical | AC-F3-5, AC-NFR6-1 |
| TC-XDOD-006 | Unresolvable declared gate identifier → member `unknown`, status `blocked` | Negative | Automated | High | AC-F3-7 |
| TC-XDOD-007 | Evidence ordering from `MemberLandingObservation` (1-based `landingPosition` only when merged), no extra read, stable on repeat (SC-M2-S19-05; DM-10, DEC-19) | Edge Case | Automated | Critical | AC-F3-6, AC-F3-8, AC-NFR2-1, AC-NFR6-1 |
| TC-XDOD-008 | One synthetic `gates[]` `unknown` record (`member`, declared id, `read-failed`, pinned empty citation) counted once; no provider citation and no `pass` (AC-F3-7; DM-9) | Negative | Automated | Critical | AC-F3-7 |
| TC-XDOD-009 | Evidence element shape `{repoKey, pullRequest, landed, landingPosition?}` and PR-less omission (AC-F3-8) | Contract | Automated | Critical | AC-F3-8 |
| TC-XDEP-001 | Start on B is refused `queue.precondition.unmet` naming B and A; admitted after A lands | Negative | Automated | Critical | AC-F4-1 |
| TC-XDEP-002 | Member-ref cycle: queue mutation `queue.dependency-cycle`; plan cycle caught at validation | Negative | Automated | Critical | AC-F4-2 |
| TC-XCLOSE-001 | Both merged via `CrossRepositoryCloseoutObservation`: apply-column `cleanup`/`issueClosure` values exactly from their closed sets, one per field, never from step `detail`; aggregate unchanged, `landed: true`, per-member removal (SC-M2-S19-01; DEC-12, DEC-20) | Happy Path | Automated | Critical | AC-F5-1 |
| TC-XCLOSE-002 | Partial landing via `CrossRepositoryCloseoutObservation`: A landed/B not, B retained or disclosed with a skip reason, nothing claims B landed (DEC-20) | Edge Case | Automated | Critical | AC-F5-2 |
| TC-XCLOSE-003 | Unsafe squash predicate: plan unsafe `would-refuse`/other `would-apply`; apply unsafe `refused`/other `applied`; aggregate unchanged, branch kept, `landed` merge truth (DEC-12) | Negative | Automated | Critical | AC-F5-3 |
| TC-XCLOSE-004 | Closeout plan mode writes nothing; member report observed as a supplement to AC-F5-1 | Happy Path | Automated | High | AC-NFR4-1, AC-F5-1 (supplement) |
| TC-XREV-001 | One review run: one verdict per member in order, `complete: true`, stable `runId` (SC-M2-S19-01) | Happy Path | Automated | Critical | AC-F6-1 |
| TC-XREV-002 | Duplicated review observation: `fail`, `complete: false`, one entry only | Negative | Automated | Critical | AC-F6-2 |
| TC-XREV-003 | Member set changed between runs, including a PR-less member: `runId` differs (repoKey + empty marker), no stale entry, PR-less member `unreviewed` (DEC-8) | Edge Case | Automated | High | AC-F6-3 |
| TC-XREV-004 | Unobserved member: `unreviewed`, `complete: false`, one entry | Edge Case | Automated | High | AC-F6-1 |
| TC-XREV-005 | Review verdicts come from injected `ReviewObservation` values only; no store, command, or live call (DEC-17) | Contract | Automated | Critical | AC-F6-1, AC-NFR1-1 |
| TC-XREV-006 | `ReviewObservation` mapping: each verdict derives from that member's own observation; no `pass` without a matching observation (AC-F6-4) | Contract | Automated | Critical | AC-F6-4 |
| TC-XPAR-001 | Plan surfaces parity: member-less validate/lint/diff/overlap byte-identical, no `members` key | Regression | Automated | Critical | AC-F1-3 |
| TC-XPAR-002 | Closeout parity: member-less plan and apply byte-identical, no `members` key | Regression | Automated | Critical | AC-F5-4 |
| TC-XPAR-003 | Member-less parity: delivered `VerifyGatesReport` keeps literal `overall: "pass"` and no `member` (static + runtime), failure envelope/exits 1-2 unchanged, member-less `queue add` byte-identical (DM-11, DEC-18, DEC-21) | Regression | Automated | Critical | AC-F7-1 |
| TC-XCTR-001 | Envelope continuity on every touched surface: five fields, keys under `data`, zero `ok`/`command` | Contract | Automated | Critical | AC-NFR1-1 |
| TC-XCTR-002 | Read-only posture: 0 plan writes, 1 gate-verification append, 0 closeout plan-mode writes | Negative | Automated | Critical | AC-NFR4-1 |
| TC-XCTR-003 | Identity reuse: 0 new error rows, 0 new domain kinds, delivered refusal identities only | Contract | Automated | Critical | AC-F1-2, AC-F4-2, AC-NFR7-1 |
| TC-XCTR-004 | Consumer tolerance: additive fields tolerated; members resolved by `repoKey`, steps by `stepId` | Contract | Automated | High | AC-F5-1, AC-NFR1-1 |
| TC-XCTR-005 | Closed vocabularies and pinned literals exported exactly once | Contract | Automated | High | AC-F1-1, AC-F3-3, AC-NFR1-1 |
| TC-XCTR-006 | Read budget per declared member: ≤1 page/detail/check-run each, 0 retries/pagination/out-of-set calls; `MemberLandingObservation` adds no read (AC-NFR6-1; DM-10, DEC-19) | Contract | Automated | Critical | AC-NFR6-1 |
| TC-XCTR-007 | Distinct report types discriminated by `definitionOfDone` (cross-repository required `member`/`overall: pass\|fail`; delivered literal `"pass"`, no `member`) plus error-table/domain-kind identity unchanged (DM-9, DM-11, AC-NFR7-1) | Contract | Automated | Critical | AC-NFR7-1, AC-F3-1 |
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
4. Assert the invalid verdict carries **no** `members` key at all (AC-F1-2) — never a partial or filtered member list — in both the validate payload and the lint document payload; assert no member appears twice.
5. Run `lint plan <ref> --json`; assert the same defect set is reported with a document location (member index/field) and exit `1`.
6. Run every variant twice; assert identical payload bytes (deterministic classification).

**Expected Outcome**:

- Every declared defect is classified with the delivered identity, its member position and field, and a lint location; an invalid verdict echoes no `members` key at all.

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
**Related IDs**: F-1, AC-F1-1 (primary), AC-F1-5 (malformed identifier), AC-F3-7 (resolution deferred to verify), DEC-1, DEC-9
**Test Type(s)**: Integration (CLI) + Unit (read poster)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/plan-members.test.ts`; read audit extends `tests/behaviour/plan-readonly.test.ts`
**Tags**: @bun, @behaviour, @plan, @member, @readonly

**Preconditions**:

- A plan whose member `gates` include an identifier the effective gate set does not declare (e.g., `custom-member-check`), plus malformed identifiers for contrast: empty string, non-string, and a 65-character string.
- No configuration file present, then a configuration file present that would resolve a differently-named gate.

**Steps**:

1. Validate the plan with the unresolvable-but-well-formed gate identifier; assert `valid`, exit `0` (AC-F1-1: a valid declaration is accepted because plan validation does not resolve capability).
2. Run with the configuration file present and with it absent; assert the plan verdict is byte-identical (configuration is not consulted — no AC owns a separate no-config rule, so this is a supplement to AC-F1-1/DEC-9, not an independent criterion).
3. Validate each malformed gate identifier (empty, non-string, 65 chars); assert `plan.schema.invalid` naming `members[i].gates` (AC-F1-5's non-empty rule and the pinned ≤64-character shape).
4. Wrap the runtime with a configuration-read recorder; assert zero configuration reads during `plan validate`.
5. Assert the deferral: the same identifier is not a plan defect, and TC-XDOD-006/008 prove it becomes that member's single `unknown` gate record at `verify gates` (AC-F3-7).

**Expected Outcome**:

- `plan validate` shape-checks only (non-empty, ≤64 characters) and never consults configuration; capability resolution is deferred to `verify gates`.

**Notes / Clarifications**:

- AC-F1-1 owns the accepted valid declaration; AC-F1-5 owns the malformed-identifier rejection; AC-F3-7 owns the verify-time `unknown` record. The zero-configuration-read assertion is a supplement to those criteria (no separate AC exists) and is marked as such so the coverage matrix stays honest.

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
**Related IDs**: F-2, AC-F2-1, DM-6, DoD-3, DEC-2, DEC-21, SC-M2-S19-01
**Test Type(s)**: Integration (CLI) + Contract (identity and add payload)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-members.test.ts`; golden-friendly payload assertions; fixtures in `tests/fixtures/queue/members/`
**Tags**: @bun, @behaviour, @queue, @lanes, @member

**Preconditions**:

- A two-member plan with member `repoKey`s `apiKey` and `webKey`; two real member checkouts; `web` declares `dependsOn: [apiKey]`; the change is added through `queue add`.

**Steps**:

1. Run `queue add <changeRef> --json`; assert the delivered `queue add` payload fields are unchanged (same shape/keys as the member-less payload) and that the additive `data.members[]` array carries exactly two entries `{ref, repoKey, lane}` in declared order, one per declared member.
2. Assert each `data.members[].ref` equals `<canonicalChangeRef>@<repoKey>`, each `repoKey` equals the declared key, and each `lane` is that member's own lane (no shared/bare-ref lane).
3. Assert the auto-declared dependency edge is reported through the delivered `edges[]` field (consumer `web` → producer `api`), with no new edge field invented.
4. Run `queue list --json`; assert exactly two entries with refs `<canonicalChangeRef>@<apiKey>` and `<canonicalChangeRef>@<webKey>`; no entry keyed by the bare change ref.
5. Assert each entry carries its own `repository` binding (each member's own repository key), never the other member's.
6. Run `lanes list --json`; assert one lane per member ref and no lane whose ref is the bare change ref or spans both members.
7. Assert declared order is preserved where the projection declares an order, and the projection is stable on a second read.

**Expected Outcome**:

- `queue add` returns the delivered payload plus the ordered member array; one entry and one lane per member, each bound to its own repository; no cross-repository lane.

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
**Related IDs**: F-3, AC-F3-1, DM-2, DM-3, DM-9, DM-11, DoD-4, DEC-11, DEC-18, SC-M2-S19-03
**Test Type(s)**: Integration (CLI) + Contract (report shape + type discrimination)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-members.test.ts`; golden in `tests/golden/cross-repository-members.test.ts`; facts in `tests/fixtures/cross-repository/facts.ts`
**Tags**: @bun, @behaviour, @gates, @member, @golden

**Preconditions**:

- A two-member plan (`api` with 3 declared gates, `web` with 2 => 5 declared pairs); each member has a pushed head and a declared `pullRequest`; the injected facts make every declared gate pass on `api`'s head and on `web`'s head, and every `gates.ci` is `pass`.

**Steps**:

1. Run `verify gates <ref> --json`.
2. Assert the report is the `CrossRepositoryVerifyGatesReport` shape, selected by the presence of `data.definitionOfDone` (DM-11): `definitionOfDone`, `blockingMembers[]`, `reviewFlow`, and the delivered required report fields are present; the report is not the delivered `VerifyGatesReport`.
3. Assert `data.definitionOfDone.status: green`; the report-level `overall` is `pass` (DEC-18); `members[]` has exactly two entries in declared order, each `{repoKey, gates.ci: "pass", verdict: "pass"}` — the verdict is `pass` only because **both** every record for that member and its `gates.ci` are `pass` (N1 rule); `data.blockingMembers[]` is empty.
4. Assert `data.gates[]` has exactly one record per declared (member, gate) pair (`api`'s 3 then `web`'s 2), in member-declared then gate order, every record `pass`, and every record carries the **required** `member` equal to its member `repoKey` (DM-9, `CrossRepositoryVerifyGateRecord`) — no record lacks a `member` and no record is a delivered `VerifyGateRecord` without one.
5. Assert `data.summary` equals the record counts: `gates: 5`, `passed: 5`, `failed: 0`, `unknown: 0` (DM-9).
6. Assert `data.evidence[]` carries both member pull requests and their `repoKey`s.
7. Assert exit `0` and that the report data is present (a success envelope, not an error envelope).
8. Assert the report never emits `overall: unknown` on any of the three cross-repository statuses (this case proves `pass`; TC-XDOD-002/004 prove `fail`; no case may produce `unknown`), and that `definitionOfDone.status` remains the authoritative three-way member verdict.
9. Assert the committed member-form golden equals the serialized `data` (normalized only for envelope `runId`/`timing`), pinning `gates[]` and `summary` as the report shape.

**Expected Outcome**:

- `green` means every declared member is `pass` on both its records and its CI reading; `gates[]` is the attributable per-(member, gate) projection with required `member` and matching `summary`; `overall` is `pass`; both pull requests are visible in landing order; exit 0. The single-repository equivalent (delivered `VerifyGatesReport`, literal `overall: "pass"`, no `member` field, static type preserved) is asserted in TC-XPAR-003 and TC-XCTR-007.

#### TC-XDOD-002 - Member gate failure: `blocked`, blocker equals the failing member, exit 1

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-2, DM-2, DM-3, DM-9, DM-11, DEC-3, DEC-11, DEC-18, SC-M2-S19-02
**Test Type(s)**: Integration (CLI) + Contract (report shape)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-members.test.ts`
**Tags**: @bun, @behaviour, @gates, @member, @negative

**Preconditions**:

- Variant A: `api` passes every declared gate and `gates.ci`; `web` fails exactly one declared gate record.
- Variant B: `web`'s records all pass but its `gates.ci` is `fail` (the CI conjunct of the member rule).
- Variant C: as A plus `docs` with absent CI, so a blocked and an incomplete member coexist.

**Steps**:

1. For each variant, run `verify gates <ref> --json`.
2. Assert `status: blocked` and the report-level `overall` is `fail` (DEC-18), `blockingMembers[]` equals `[webKey]` in variant A and contains `webKey` in variants B/C (declared order preserved for multiple blockers).
3. Assert `web`'s member entry is `verdict: fail` and `api`'s is `verdict: pass`; in variant B assert the `fail` comes from `gates.ci: fail` even though every `web` record is `pass` (N1 rule: `fail` on any record `fail` **or** `gates.ci: fail`).
4. Assert `data.gates[]` carries `web`'s failing record with `member: webKey` in variant A (and all-`pass` records in variant B); `data.summary` counts the failing record (`failed` ≥ 1) while `summary.gates` still equals the total declared (member, gate) pair count (DM-9).
5. Assert the report data is present (not a failure envelope) and the delivered `verify.gates.failed` classification is carried **solely by `overall: "fail"`** — there is no separate classification field and no error envelope (N9, DEC-18).
6. Assert the exit is `1`, the report never emits `overall: unknown`, and the exit is never `2` for this cross-repository report.
7. Assert the failing gate (or CI reading) is attributed to `web` only (no cross-member propagation).
8. In variant C, assert `status: blocked` (blocked wins over incomplete), `overall: fail`, `blockingMembers[]` contains `webKey` and `docsKey`, the `docs` records are `unknown`/`absent`-derived, and the exit is `1`.

**Expected Outcome**:

- A failing member (record fail or `gates.ci: fail`) blocks the shared definition of done; `overall: fail` is the sole classification carrier with data present and exit 1 (never `unknown`, never exit 2); the failing member is named and its record is attributable; `blocked` wins when an incomplete member coexists.

#### TC-XDOD-003 - Unavailable CI: `unavailable`/`unknown`, blocker named, never green, exit 1

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-3, DM-2, DM-3, NFR-5, DEC-3, DEC-4, DEC-11, DEC-18, SC-M2-S19-04
**Test Type(s)**: Integration (CLI) + Contract (member-verdict rule)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-members.test.ts`
**Tags**: @bun, @behaviour, @gates, @member, @fail-closed

**Preconditions**:

- Both members have pushed heads and declared pull requests; `api` passes its records and `gates.ci`; **every declared gate record for `web` passes**, but `web`'s check-run read fails with the classified provider failure (injected), i.e. a reading failure, not a failed run. `web`'s declared `gates` deliberately does not include a CI gate, proving the verdict rule uses `gates.ci` independently of the record list.

**Steps**:

1. Run `verify gates <ref> --json`.
2. Assert `web`'s `gates.ci: unavailable` and `verdict: unknown`; assert it is never `pass` even though every one of its declared records is `pass` — the CI conjunct of the N1 rule is what forces `unknown`.
3. Assert `web`'s `gates[]` records are all `pass` and `summary.failed` remains `0` for them; `summary.unknown` does not count a record (the unknown comes from `gates.ci`, not a gate record).
4. Assert `blockingMembers[]` contains `webKey`; assert `status: blocked`, `overall: fail`, report data present, and exit `1` (not `2`).
5. Assert the aggregation is mechanical: `blocked` because `gates.ci: unavailable`, independent of whether any record is `fail`.
6. Repeat the run with the same unavailable fact; assert identical bytes (unavailability is deterministic).

**Expected Outcome**:

- An unreadable CI reading makes its member `unknown` even when every declared record passes, and blocks the change (`blocked`, `overall: fail`, exit 1); absence of evidence never counts as a pass.

#### TC-XDOD-004 - Absent evidence: `incomplete`, `absent`, blocker named, exit 1

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-4, DM-2, DM-3, NFR-5, DEC-3, DEC-4, DEC-5, DEC-11, DEC-18
**Test Type(s)**: Integration (CLI) + Contract (exit projection + aggregation)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-members-evidence.test.ts`
**Tags**: @bun, @behaviour, @gates, @member, @boundary

**Preconditions**:

- Two members; no member is `fail`, no `gates.ci` is `unavailable`, and no member carries a synthetic unresolvable-identifier record. Variant A: `web` has no pushed head. Variant B: `web` declares no `pullRequest` (missing at authoring). Variant C: `web` has a pushed head but no run for that head.

**Steps**:

1. For each variant, run `verify gates <ref> --json`.
2. Assert `web`'s `gates.ci: absent` and its `verdict: unknown` (the record conjunct may be all `pass`; the absent CI forces `unknown`).
3. Assert `data.definitionOfDone.status: incomplete` **because** no member is `fail`, no `gates.ci` is `unavailable`, no synthetic unresolvable record exists, and `≥1` member is `unknown`; the report-level `overall` is **`fail`** (not `unknown`; DEC-18); `blockingMembers[]` contains `webKey`; the report data (including `gates[]` and `summary`) is present; the exit is `1`.
4. Assert the exit is **not `2`** and no `verify.gates.unavailable` error envelope is produced for this cross-repository report; the delivered unknown/exit-2 projection is reserved for the non-cross-repository path (asserted in TC-XPAR-003).
5. Assert `api`'s entry is unaffected and remains `pass`; `web`'s resolvable records remain `pass` (they are not rewritten to `unknown`), `summary.failed` is `0`, and `summary.unknown` counts only synthetic unresolvable records (none in these variants).
6. Assert the difference from TC-XDOD-003 is observable in data (`incomplete` + `overall: fail` + `absent` vs `blocked` + `overall: fail` + `unavailable`), with the three-way distinction living in `definitionOfDone.status` and `blocked` winning whenever a `fail`/`unavailable`/synthetic record is also present (TC-XDOD-002 variant C).

**Expected Outcome**:

- Missing evidence is a first-class non-green state, distinct from a negative or unreadable one: `incomplete` only when no blocking condition holds and at least one member is `unknown`; `overall` is `fail` with data present at exit 1, never `unknown` and never exit 2; the blocker is still named.

**Notes / Clarifications**:

- DEC-4 now gives one definition of `absent` — CI truth could not be established for any reason (no pushed head, no declared pull request, or no run for the head) — and AC-F3-4 is aligned to it. The `pullRequest`-less member's evidence omission is asserted separately in TC-XDOD-009 (DEC-16).

#### TC-XDOD-005 - No cross-member CI reuse; per-member reads are bounded and recorded

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-5, AC-F3-1 (read shape), AC-NFR6-1, DM-2, DM-3, NFR-5, DEC-4, DEC-10, DEC-18
**Test Type(s)**: Integration (CLI) + Contract (read budget + aggregation)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-members.test.ts`; read budget extends `tests/behaviour/verify-gates-read-budget.test.ts`; guards from `tests/fixtures/verify-gates/cases/{network-guard,harness}.ts` and `tests/fixtures/result/no-spawn-guard.ts`
**Tags**: @bun, @behaviour, @gates, @member, @read-budget

**Preconditions**:

- A recording runtime wrapping every read seam with distinct heads per member; `api` passes its records **and** `gates.ci`; `web`'s records all pass but its reading is unavailable; each member has a distinct head SHA.

**Steps**:

1. Run `verify gates <ref> --json` through the recording runtime.
2. Assert `readOpenPullRequests` and `readDeliveryRequestDetail` are called at most once per member (≤2 each total), with each member's own pull-request identity; `readCheckRuns` is called at most once per member's own head SHA and never with another member's head.
3. Assert `web`'s `gates.ci` is never `pass` and its `verdict` is `unknown` even though every one of its records is `pass`; `api` remains `pass` (no cross-member reuse of a verdict or of a CI reading).
4. Assert the change aggregation is mechanical: `status: blocked` because a member's `gates.ci` is `unavailable`, `overall: fail`, `blockingMembers[]` names `webKey` only, report data present, exit `1`.
5. Assert zero retries (no repeated call for the same source+identity) and no pagination beyond the delivered page limit (100).
6. Assert the no-network and no-spawn guards record zero calls.

**Expected Outcome**:

- Each member's CI verdict comes only from that member's head; an unavailable reading forces that member to `unknown` and the change to `blocked`/`overall: fail`; the per-member read extension is bounded, retry-free, and pagination-free.

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
**Related IDs**: F-3, AC-F3-6, AC-F3-8, AC-NFR2-1, AC-NFR6-1, DM-4, DM-10, DoD-6, DEC-6, DEC-16, DEC-19, SC-M2-S19-05
**Test Type(s)**: Integration (CLI) + Unit (ordering) + Contract (transport count)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-members-evidence.test.ts`; counting transport and `MemberLandingObservation` fixture in `tests/fixtures/cross-repository/facts.ts`
**Tags**: @bun, @behaviour, @gates, @member, @ordering, @read-budget

**Preconditions**:

- Three members declared `[api, web, docs]` with injected `MemberLandingObservation` values `{repoKey, merged, headSha, landingPosition?}`: `docs` merged at position 1, `api` merged at position 2, `web` unmerged.
- A counting transport wraps every provider seam and records each call.

**Steps**:

1. Evaluate the shared verdict; assert `evidence[]` order is `docs`, `api`, `web` (landed by ascending `landingPosition`, then unlanded in declared order).
2. Assert ties break by declared order: two merged members with the same `landingPosition` keep declared order.
3. Assert each entry carries exactly `{repoKey, pullRequest, landed}` plus `landingPosition` only when `landed` is true (DEC-16); assert `landingPosition` is a 1-based integer, ascending across landed entries, and absent on unmerged entries.
4. Assert `landed` and `landingPosition` are supplied by the injected `MemberLandingObservation` entries (DM-10, DEC-19), not obtained by an additional provider read: the transport records zero merge/landing-source calls, and the total call counts stay within one open-PR page, one detail read, and one check-run page per member.
5. Inject an unmerged observation that carries a `landingPosition` (a contract violation); assert it is rejected or ignored as a contract error rather than used to order evidence — `landingPosition` exists only when `merged` is true.
6. Repeat over unchanged facts; assert the serialized evidence is byte-identical.
7. Reverse the input observation enumeration order (not the declared order); assert the evidence order is unchanged (ordering is derived, not input-order dependent) and the call counts do not change.

**Expected Outcome**:

- The landing rule is deterministic, justified by a 1-based `landingPosition` present only for merged members, does not depend on observation enumeration order, and adds no provider read.

**Notes / Clarifications**:

- The carrier is `MemberLandingObservation` (DM-10/DEC-19), not the closeout observation. The element shape is pinned by DEC-16 and asserted in full by TC-XDOD-009, which also covers the PR-less omission (AC-F3-8). The no-extra-read assertion is the DEC-19 half of AC-NFR6-1; TC-XCTR-006 asserts the complete call budget.

#### TC-XDOD-008 - No invented gate verdict for an unresolved declared identifier (AC-F3-7)

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-7, DM-2, DM-3, DM-9, DM-11, DEC-4, DEC-9, DEC-18
**Test Type(s)**: Integration (CLI) + Contract (gate-record audit)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-members.test.ts`
**Tags**: @bun, @behaviour, @gates, @member, @fail-closed

**Preconditions**:

- A two-member plan where `web` declares one resolvable gate and one unresolvable identifier (well-formed, absent from the effective gate set); `api` passes all its gates.

**Steps**:

1. Run `verify gates <ref> --json`.
2. Assert `data.gates[]` carries exactly one synthetic record for the unresolved identifier: `id` equals the declared identifier, `member: webKey`, `verdict: unknown`, and the delivered `read-failed` reason (DM-9).
3. Assert the synthetic record's required `citation` is exactly the pinned empty-read shape: `identity: { changeRef }` only; `sources: []`; `counts: []`; `names: []`; `reasons: ["read-failed"]` — and assert no provider source, name list, branch, or SHA is attributed to the unresolved identifier (N3, DM-9).
4. Assert `data.summary.unknown` counts that record exactly once and `data.summary.passed` does not count it; assert `summary.gates` equals the total declared (member, gate) pair count and the per-verdict counts sum to `summary.gates`.
5. Enumerate every gate record in the report and assert no record carries a `pass` verdict for the unresolved identifier and no record lacks its required `member` discriminator.
6. Assert the resolved gate's record is still reported normally for `web`, so the unresolved identifier does not erase readable evidence.
7. Assert `web`'s `verdict: unknown`, `status: blocked`, `overall: fail`, `blockingMembers[]` contains `webKey`, and exit `1`.
8. Assert no gate record fabricates a provider citation or name list for the unresolved identifier: the only record for it is the pinned `read-failed` synthetic record above, never a fabricated pass or a real provider read.
9. Repeat the run; assert identical bytes (no nondeterministic gate ordering).

**Expected Outcome**:

- An unresolved declared gate identifier yields exactly one attributable `unknown` record (`member` + declared id + `read-failed` + the pinned empty citation), is counted once in `summary.unknown`, attributes no provider source/branch/SHA, and never acquires a pass verdict anywhere in the report.

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
**Related IDs**: F-5, AC-F5-1, DM-5, DM-8, DoD-8, DEC-12, DEC-20, OQ-6, SC-M2-S19-01
**Test Type(s)**: Integration (CLI) + Contract (report shape + mapping table)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-members.test.ts`; golden in `tests/golden/cross-repository-members.test.ts`; fixtures extend `tests/fixtures/closeout/{request,branch,queue-removal}.ts` and `tests/fixtures/cross-repository/closeout.ts`
**Tags**: @bun, @behaviour, @closeout, @member, @golden

**Preconditions**:

- Two members, each with a branch and a merged pull request; one injected `CrossRepositoryCloseoutObservation` per member `{repoKey, pullRequest, merged: true, headSha, branch, issueClosure?}` is supplied through the closeout composition (DEC-20); the delivered twelve-step plan is in apply mode with a fixed clock.
- Variants exercise each apply-column condition: branch deleted (normal), branch already absent, issue open, issue already closed, no tracked issue, and a provider/git gap.

**Steps**:

1. With only the `CrossRepositoryCloseoutObservation` entries supplied (no live provider read, no second merge source), run `closeout <ref> --apply --json`.
2. Assert the observation shape consumed is exactly `{repoKey, pullRequest, merged, headSha?, branch, issueClosure?}`, one entry per declared member, and that no new port, provider operation, or durable store is required for the report (DEC-20).
3. Assert `data.members[]` has exactly two entries in declared order; each has exactly `repoKey`, `branch`, `cleanup`, `pullRequest`, `issueClosure`, `landed`.
4. Assert each `cleanup` is exactly one value from the **apply** column `applied|satisfied|refused|skipped-gap` and each `issueClosure` is exactly one value from the **apply** column `applied|satisfied|skipped-noop|skipped-gap` — one value per field, from the correct closed set only (N5, DM-5).
5. Assert the observed condition implies the exact value: branch deleted ⇒ `cleanup: applied`; branch already absent ⇒ `cleanup: satisfied`; predicate unsafe ⇒ `refused` (TC-XCLOSE-003); gap ⇒ `skipped-gap`; issue open ⇒ `issueClosure: applied`; already closed ⇒ `satisfied`; no tracked issue ⇒ `skipped-noop`; tracker gap ⇒ `skipped-gap`.
6. Assert the values are derived from that member's `CrossRepositoryCloseoutObservation` plus its own closeout operations, **never by parsing step `detail`**: inject a misleading step `detail` entry whose text would imply a different value and assert the member value is unchanged (N5, DEC-12).
7. Assert the aggregate `branch-cleanup` and `ticket-to-done` step outcomes are unchanged by the member values (the member values never rewrite the aggregate), and `landed: true` for both.
8. Assert the twelve step ids are unchanged and no new step id appears; per-member work rides `branch-cleanup`, `ticket-to-done`, `comment-resolution`.
9. Assert each member's landing produced exactly one removal for its own member ref with reason `landed`, and no removal for the bare change ref.

**Expected Outcome**:

- Both member pull requests are enumerated in landing order; each `cleanup`/`issueClosure` is exactly one value from its apply-mode closed set, derived from the member observation plus its own operations (never step `detail`); aggregate outcomes are unchanged; merge truth comes only from the injected observation; the production carrier is not required (OQ-6 deferred, non-blocking).

#### TC-XCLOSE-002 - Partial landing: A landed/B not, B retained or disclosed with a skip reason, nothing claims B landed

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, F-2, AC-F5-2, DM-5, DM-8, OQ-5, OQ-6, DEC-20
**Test Type(s)**: Integration (CLI)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-members.test.ts`; skip semantics extend `tests/behaviour/closeout-queue-removal-skips.test.ts`; observation fixture `tests/fixtures/cross-repository/closeout.ts`
**Tags**: @bun, @behaviour, @closeout, @member, @partial

**Preconditions**:

- `api` observed merged and `web` observed unmerged, expressed through one `CrossRepositoryCloseoutObservation` per member `{repoKey, pullRequest, merged: false, headSha?, branch, issueClosure?}` supplied through the closeout composition (DEC-20); variants: `web` with no merge truth, a live lease held at landing, and a hostile non-canonical member ref.

**Steps**:

1. With only the `CrossRepositoryCloseoutObservation` entries supplied (no live provider read, no second merge source, no durable store), run `closeout <ref> --apply --json`.
2. Assert `api.landed: true` and `web.landed: false`; no field or step outcome claims `web` landed.
3. Assert `api`'s queue entry is removed; `web`'s entry is retained (or disclosed with the delivered skip reason `lease-held` / `no-merge-truth` / `state-unavailable`), and the skip is visible in data.
4. Assert the exit code is the delivered closeout exit and does not encode `web` as landed.
5. Assert the observation shape is consumed as declared (one entry per member, optional `headSha`/`issueClosure` tolerated) and that a production carrier beyond the composition injection is not required for the report (OQ-6 deferred, non-blocking).
6. Assert a repeated apply over the same facts is idempotent (no duplicate removals, no second transition).

**Expected Outcome**:

- A partly landed change is visible and honest; merge truth comes only from the injected observation; a skipped removal is disclosed, never silently dropped.

#### TC-XCLOSE-003 - Unsafe squash predicate: delivered refuse value, branch not deleted, `landed` stays merge truth

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-3, DM-5, DM-8, DoD-8, DEC-12, DEC-20
**Test Type(s)**: Integration (CLI) + Contract (mapping table)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-members.test.ts`; extends `tests/fixtures/closeout/branch.ts`
**Tags**: @bun, @behaviour, @closeout, @member, @safety

**Preconditions**:

- Two members both observed merged via `CrossRepositoryCloseoutObservation`; `web`'s branch fails the delivered squash-safety predicate (e.g., unmerged commits not represented by the squash / diverged head), while `api`'s branch is safe and present.

**Steps**:

1. Run closeout in plan mode; assert `web.cleanup` is exactly `would-refuse` and `api.cleanup` is exactly `would-apply` (not `applied`, not `satisfied`), each from the plan `cleanup` column `would-apply|satisfied|would-refuse|skipped-gap`; assert plan `issueClosure` values come only from `would-apply|satisfied|skipped-noop|skipped-gap`.
2. Run closeout in apply mode; assert `web.cleanup` is exactly `refused` and `api.cleanup` is exactly `applied`, each from the apply `cleanup` column `applied|satisfied|refused|skipped-gap`; assert apply `issueClosure` values come only from `applied|satisfied|skipped-noop|skipped-gap` (DEC-12, N5).
3. Assert exactly one value per field per member and that no member value falls outside its mode's closed column.
4. Inject a misleading step `detail` entry for `web` that would imply `satisfied`/`applied`; assert `web.cleanup` remains the refuse value and is not derived from parsing step `detail`.
5. Assert `web`'s branch still exists after apply; assert no destructive branch operation was attempted (spawn/recorded operations), while `api`'s branch cleanup proceeds.
6. Assert the aggregate `branch-cleanup` step outcome is not rewritten by either member value.
7. Assert `web.landed` remains `true` because merge truth is observed — safety refusal does not rewrite landing.

**Expected Outcome**:

- An unsafe cleanup refuses with the exact mode-specific value, does not delete the branch, leaves the other member's mode-correct value and the aggregate step outcome intact, never derives a value from step `detail`, and does not distort merge truth.

#### TC-XCLOSE-004 - Closeout plan mode writes nothing (member report observed as an AC-F5-1 supplement)

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, AC-NFR4-1 (primary; zero writes), AC-F5-1 (supplement: the six-field member report shape), DM-5, DM-8, DoD-12
**Test Type(s)**: Integration (CLI) + Contract (write audit)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/closeout-members.test.ts`; extends `tests/behaviour/closeout-plan.test.ts`; snapshot helpers from `tests/fixtures/projects/state-scope.ts`
**Tags**: @bun, @behaviour, @closeout, @member, @readonly

**Preconditions**:

- Two members with injected `CrossRepositoryCloseoutObservation` facts; a tree/host-root snapshot before the run.

**Steps**:

1. Snapshot the host root and queue/ledger state.
2. Run `closeout <ref> --json` (plan mode).
3. Assert `data.members[]` has two ordered entries with the six fields and `landed` resolved from merge truth — asserted as the AC-F5-1 report shape applied to plan mode, since AC-F5-1 itself names `--apply`.
4. Assert the host-root and state snapshots are identical (zero writes, zero ledger appends, zero queue removals) — this is the AC-NFR4-1 criterion.
5. Assert the mode is `plan` and the report is otherwise the delivered shape.

**Expected Outcome**:

- Plan mode is a pure projection: the AC-F5-1 member report shape is observable, and the AC-NFR4-1 zero-write rule holds.

**Notes / Clarifications**:

- AC-NFR4-1 owns the zero-write assertion; AC-F5-1 owns the six-field member report but names apply mode. The plan-mode member report is therefore explicitly marked a **supplement** to AC-F5-1, not an independent criterion; a spec revision that broadens AC-F5-1 to both modes would make this a primary citation.

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

#### TC-XREV-003 - Member set changed between runs: `runId` differs (including a PR-less member), no stale verdict entry

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-6, AC-F6-3, DM-7, NFR-2, DEC-8
**Test Type(s)**: Integration (CLI) + Unit (digest)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-review-flow.test.ts`
**Tags**: @bun, @behaviour, @review, @member, @identity

**Preconditions**:

- Run A declares `[api, web]` (both with pull requests); run B declares `[api]`; run C declares `[api, docs]` where `docs` has **no** declared `pullRequest`; run D declares `[api]` again but with a re-pointed `api` pull request.
- `ReviewObservation` values are supplied for declared members only; no observation exists for `docs`.

**Steps**:

1. Run A and record `runId` and the verdict keys.
2. Run B over the changed set; assert `runId` differs from run A.
3. Run C (adds the PR-less `docs`); assert `runId` differs from run B **because the digest covers the declared member set with `repoKey` + pull-request-or-empty marker** (DEC-8), not only pull-request identities.
4. Assert `docs`'s verdict entry is `unreviewed` (present in `verdicts[]`, one entry) and `complete: false`; assert no entry exists for `web` (no longer declared).
5. Run D (same `[api]` set with a re-pointed pull request); assert `runId` differs from run B (the digest covers the pull request identity too).
6. Run B a second time; assert B's `runId` is stable, and assert removing `docs` returns exactly B's `runId` (set identity is reversible and total over the declared set).

**Expected Outcome**:

- Run identity is bound to the total declared member set, including members with no pull request; adding/removing a PR-less member changes `runId`, the PR-less member reads `unreviewed`, and no stale verdict is retained.

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

#### TC-XPAR-003 - Gates, queue add, and queue projections parity: delivered payloads and exits byte-identical, no member keys

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-1, AC-F2-1, NFR-8, C-1, DoD-10, DM-11, DEC-18, DEC-21
**Test Type(s)**: Golden / parity + static type probe
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/cross-repository-parity.test.ts`; static probe `tests/types/cross-repository-report.type-test.ts`; existing goldens read unchanged: `tests/fixtures/verify-gates/golden/{success-data.json,human-success.txt,failure-summary.txt}`, `tests/golden/verify-gates.test.ts`, `tests/fixtures/queue/golden/{queue-list,queue-plan,lanes-list}.json`, `tests/golden/{queue-list,queue-plan,lanes-list,lanes-show}.test.ts`; new pre-change golden `tests/fixtures/queue/golden/queue-add-memberless.json`
**Tags**: @bun, @golden, @parity, @gates, @queue, @types

**Preconditions**:

- The parity fixture set: a member-less change with the delivered gate battery (pass, fail, and classified-unknown variants) and delivered queue entries/edges/lanes.
- The member-less `queue add` golden is captured from the pre-change baseline (`main-tools` tip `404e9bf8`) **before any member code lands** (Section 6.4) with only the envelope `runId`/`timing` normalized.

**Steps**:

1. Run `verify gates` on the member-less pass fixture; assert `data` has no `definitionOfDone`, no `blockingMembers`, and no `reviewFlow`; assert the report is the delivered `VerifyGatesReport` selected by the **absence** of `definitionOfDone` (DM-11); assert `overall` is the delivered literal `"pass"` at the type and value level (the widened `fail` value is never emitted here and the static literal type is not widened); assert `gates[]` is the delivered `VerifyGateRecord[]` with **no `member` field** and matches the delivered shape byte-identically; assert `data` matches `success-data.json` and human output matches `human-success.txt`; assert exit `0`.
2. Run the member-less failure fixture; assert the delivered failure envelope is unchanged (no `data`), the failure summary matches `failure-summary.txt`, and the exit is the delivered `verify.gates.failed` exit `1` — the cross-repository data-bearing `overall: fail` path is **not** used.
3. Run the member-less classified-unknown fixture; assert the delivered `verify.gates.unavailable` classification and exit `2` are unchanged, and that no `overall: "unknown"` widening or cross-repository report shape leaks into the member-less path.
4. Run `queue add` on the member-less fixture; assert the payload is byte-identical to `tests/fixtures/queue/golden/queue-add-memberless.json`: the delivered fields unchanged, **no `members` array**, no extra `edges[]` entry, and the same exit (DEC-21; AC-F2-1).
5. Run `queue list`, `queue plan`, `lanes list`; assert each `data` matches its pre-change golden and the exit is identical.
6. Assert the queue keeps exactly one entry keyed by the bare canonical ref, one lane, the delivered removal and skip semantics, and no member ref appears.
7. Assert no `members`/`definitionOfDone`/`blockingMembers`/`reviewFlow` key appears anywhere in the payloads, and that `member` appears in no gate record.
8. Static assertion in `tests/types/cross-repository-report.type-test.ts`: a value typed as the delivered `VerifyGatesReport` has `overall` assignable to the literal `"pass"` (and not to `"fail"`), while a value typed as `CrossRepositoryVerifyGatesReport` has `overall` `"pass" | "fail"`, a required `member` on every `gates[]` record, and `definitionOfDone` present; a member-less report value is not assignable to `CrossRepositoryVerifyGatesReport` and a cross-repository report is discriminated by `definitionOfDone` (N4, DM-11).

**Expected Outcome**:

- The member-less gate report keeps the delivered `VerifyGatesReport` type and value — literal `overall: "pass"` (static and runtime), no `member` field, failure envelope, exits 1/2 — while the cross-repository type is the distinct `CrossRepositoryVerifyGatesReport` with required `member` and `overall: pass|fail`; the two are discriminated by `definitionOfDone`, and the member-less `queue add`/queue projections stay byte-identical.

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
**Related IDs**: NFR-6, AC-NFR6-1, F-3, DM-4, DM-10, DEC-10, DEC-19, DoD-12 (per §17.1 coverage note)
**Test Type(s)**: Integration (CLI) + Contract (call-counting transport)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-read-budget.test.ts` (extend); counting transport and `MemberLandingObservation` fixture in `tests/fixtures/cross-repository/facts.ts`; guards from `tests/fixtures/verify-gates/cases/{network-guard,harness}.ts`
**Tags**: @bun, @behaviour, @gates, @read-budget, @contract

**Preconditions**:

- A counting transport wrapping every provider seam, recording source, identity, page size, and call count; a two-member plan with distinct member repositories/heads; injected `MemberLandingObservation` entries `{repoKey, merged, headSha?, landingPosition?}`; no member outside the declared set is reachable.

**Steps**:

1. Run `verify gates <ref> --json` through the counting transport.
2. Assert at most one open-PR page per declared member (and no page request for an undeclared repository), at most one detail read per declared member, and at most one check-run page per declared member's pushed head.
3. Assert zero retries: no `(source, identity)` pair is requested twice, including after a classified failure for one member.
4. Assert zero pagination: no request carries a pagination cursor/continuation or exceeds the delivered page limit (100).
5. Assert every request's repository identity is in the declared member set; an injected "other repository" sentinel is never requested.
6. Assert `landed`, `landingPosition`, and per-member merge truth arrive as `MemberLandingObservation` entries (DM-10) and add zero provider calls: the transport records no merge/landing source, no extra page, and no extra detail read (DEC-19); removing the injected observation leaves the call counts unchanged and only the evidence availability changes.
7. Assert `landingPosition` is 1-based and present only when `merged` is true (DM-10) and that no additional read is issued to derive it.
8. At the eight-member cap, assert the counts scale linearly (≤8 pages, ≤8 details, ≤8 check-run pages) and the report is still produced.

**Expected Outcome**:

- The per-member read extension is strictly bounded, retry-free, pagination-free, scoped to declared members only, and never widened by `MemberLandingObservation` landing/merge truth.

#### TC-XCTR-007 - Distinct report types and unchanged error/domain-kind identity (DM-9, DM-11, AC-NFR7-1)

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-7, AC-NFR7-1, AC-F3-1 (report type), DM-9, DM-11, DEC-13, DEC-18, DoD-11 (per §17.1 coverage note)
**Test Type(s)**: Contract / invariant + static type probe
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/cross-repository-contract.test.ts`; static probe `tests/types/cross-repository-report.type-test.ts`; extends `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts`, `tests/structure/event-state-additivity.test.ts`
**Tags**: @bun, @structure, @contract, @identity, @types

**Preconditions**:

- A committed pre-change snapshot of the error-table rows and the domain-kind membership (the existing error-table fixture and `tests/fixtures/events/state-additivity-baseline.json`).
- Captured member-form and member-less reports from the behaviour runs.

**Steps**:

1. Assert the distinct report types and the union discriminator (N4, DM-11): a report **without** `definitionOfDone` is the delivered `VerifyGatesReport` — `overall` is the literal `"pass"`, `gates[]` is `VerifyGateRecord[]` and carries no `member`; a report **with** `definitionOfDone` is `CrossRepositoryVerifyGatesReport` — `overall` is `"pass" | "fail"`, `gates[]` is `CrossRepositoryVerifyGateRecord[]` with a **required** `member`, and `blockingMembers[]`/`reviewFlow` are present. Assert `definitionOfDone` presence alone selects the type.
2. Static assertion in `tests/types/cross-repository-report.type-test.ts`: the delivered `VerifyGatesReport["overall"]` is assignable to `"pass"` and not to `"fail"`; `CrossRepositoryVerifyGatesReport["overall"]` is `"pass" | "fail"`; `CrossRepositoryVerifyGateRecord["member"]` is a required string; a `VerifyGatesReport` is not assignable to `CrossRepositoryVerifyGatesReport` and vice versa.
3. Compute the current error-table row identities and count; assert they equal the pre-change snapshot exactly (count and membership, not just a subset).
4. Assert no new identity string exists anywhere in the change's contracts (no `review.*`, `member.*`, `gates.member.*`, or similar invented code).
5. Assert the domain-kind membership is identical to the baseline: no new record kind, payload schema, key prefix, state schema version, event kind, or topic.
6. Exercise every refusal produced by the member-form negative cases (plan defects, unmet precondition, edge cycle, unavailable/absent readings, closeout skips) and assert each resolves to a delivered identity present in the snapshot.
7. Assert the bidirectional error-table sync check still passes in both directions.

**Expected Outcome**:

- The report union is statically and at runtime discriminated by `definitionOfDone`, with the delivered type's literal `"pass"` and no-`member` guarantees preserved, while the change adds no error-table row or domain kind and every refusal resolves to a delivered identity.

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
- `landed`, `landingPosition`, and per-member merge truth arrive as injected `MemberLandingObservation` values `{ repoKey, merged, headSha?, landingPosition? }`, one per declared member, through the verification composition (DM-10, DEC-19); `landingPosition` is a 1-based integer present only when `merged` is true. They are never obtained by an additional provider read. A counting transport in `tests/fixtures/cross-repository/facts.ts` records source/identity/page and asserts the zero-extra-read rule.
- Review verdicts are injected `ReviewObservation` values `{ repoKey, pullRequest, verdicts[] }` through the verification composition that composes `verify gates` (DEC-17); there is no store, no command, and no live model call. A second observation for one member models the duplicated-observation case; a missing observation models `unreviewed`.
- Per-member closeout merge truth, branch, and issue-closure facts are injected as `CrossRepositoryCloseoutObservation` values `{ repoKey, pullRequest, merged, headSha?, branch, issueClosure? }`, one per declared member, through the closeout composition (DEC-20); no new port, no provider operation, and no durable store are required. The durable production carrier is deferred and non-blocking (OQ-6).
- Queue/lane state is read in-process; no resident daemon, socket, or daemon state file is required. No suite contacts a live daemon.

### 6.4 Pre-change reference for parity

The reference for AC-F1-3, AC-F5-4, AC-F7-1 is the **pre-change baseline**, not a post-change regeneration.

- **Primary reference (already committed):** `tests/golden/plan/validate-baseline.json`, `tests/golden/plan/{diff-outside,overlap-parallel,overlap-sequence}.json`, `tests/golden/plan-text.test.ts`; `tests/fixtures/verify-gates/golden/{success-data.json,human-success.txt,failure-summary.txt}` with `tests/golden/verify-gates.test.ts`; `tests/fixtures/closeout/golden/{envelope-data.json,human.txt}` with `tests/golden/closeout-*.test.ts`; `tests/fixtures/queue/golden/{queue-list,queue-plan,lanes-list,...}.json` with `tests/golden/{queue-list,queue-plan,lanes-list,lanes-show}.test.ts`. These files are **read unchanged** by the parity TCs; changing one is a failure of the parity proof unless the review records a deliberate, reasoned regeneration.
- **New member-less reference (only where no golden exists):** captured once at the branch base (`main-tools` tip `404e9bf8`) **before any member code lands**, using the surface's explicit regeneration entrypoint (`tests/fixtures/closeout/golden/regenerate.ts`, `tests/golden/plan/regenerate.ts`) or a documented one-shot capture command; committed in the owning phase with the command recorded in pm-notes. The exact member-less `queue add` golden is **`tests/fixtures/queue/golden/queue-add-memberless.json`** (inspected: no equivalent committed add-payload golden exists under `tests/fixtures/queue/**`, so this new file is required by TC-XPAR-003); it captures the delivered `queue add` payload with the delivered fields only and no `data.members[]`, from the pre-change baseline at `404e9bf8`, and only the envelope `runId`/`timing` are normalized. Regeneration after the change is allowed only with a review-visible diff and a recorded reason.
- **Comparison method:** for machine payloads, compare `data` deep-equal and the serialized payload byte-for-byte (stable key order); for human surfaces, compare raw `stdout` bytes. Envelope `runId` and `timing` are the only permitted normalized keys, and the normalizer is asserted to replace only those keys. Exit codes are compared exactly. Absence of `members`/`definitionOfDone`/`blockingMembers`/`reviewFlow`, the literal `overall: "pass"`, the absence of any `member` field in `gates[]`, and the delivered failure-envelope/exit-1-2 behaviour are asserted explicitly.

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
| TC-XPLAN-002 | `tests/behaviour/plan-members.test.ts` + `tests/behaviour/plan-lint.test.ts` (extend patterns) | `bun test tests/behaviour/plan-members.test.ts` | Fixture plan table under `tests/fixtures/plan/members-invalid/`; assert no `members` key on the invalid verdict (AC-F1-2) | To Implement |
| TC-XPLAN-003 | `tests/behaviour/plan-members-bounds.test.ts` | `bun test tests/behaviour/plan-members-bounds.test.ts` | Fixture plan table under `tests/fixtures/plan/members-bounds/` | To Implement |
| TC-XPLAN-004 | `tests/behaviour/plan-members.test.ts` | `bun test tests/behaviour/plan-members.test.ts` | Field-mutation table | To Implement |
| TC-XPLAN-005 | `tests/behaviour/plan-members.test.ts` + `tests/behaviour/plan-readonly.test.ts` (extend) | `bun test tests/behaviour/plan-members.test.ts tests/behaviour/plan-readonly.test.ts` | Config-read recorder; gate-id shapes (empty/non-string/65 chars) | To Implement |
| TC-XPLAN-006 | `tests/behaviour/plan-members.test.ts` | `bun test tests/behaviour/plan-members.test.ts` | Required-field/empty-value fixture table under `tests/fixtures/plan/members-required/` | To Implement |
| TC-XPLAN-007 | `tests/behaviour/plan-members.test.ts` | `bun test tests/behaviour/plan-members.test.ts` | Grammar fixture table under `tests/fixtures/plan/members-grammar/` | To Implement |
| TC-XQUEUE-001 | `tests/behaviour/queue-members.test.ts` | `bun test tests/behaviour/queue-members.test.ts` | Fixture queue state under `tests/fixtures/queue/members/`; `queue add` payload assertion `{ref, repoKey, lane}` (DEC-21) | To Implement |
| TC-XQUEUE-002 | `tests/behaviour/queue-members.test.ts` + `tests/behaviour/queue-readiness.test.ts` (extend) | `bun test tests/behaviour/queue-members.test.ts tests/behaviour/queue-readiness.test.ts` | Readiness fact bundle | To Implement |
| TC-XQUEUE-003 | `tests/behaviour/queue-members-removal.test.ts` | `bun test tests/behaviour/queue-members-removal.test.ts` | Landing observation injection; ledger digest | To Implement |
| TC-XQUEUE-004 | `tests/behaviour/queue-member-ref.test.ts` | `bun test tests/behaviour/queue-member-ref.test.ts` | Pure exports + fixture queue harness | To Implement |
| TC-XQUEUE-005 | `tests/behaviour/queue-members.test.ts` | `bun test tests/behaviour/queue-members.test.ts` | Lease harness; no live daemon | To Implement |
| TC-XQUEUE-006 | `tests/behaviour/queue-members.test.ts` + `tests/behaviour/queue-lease.test.ts` (extend) | `bun test tests/behaviour/queue-members.test.ts tests/behaviour/queue-lease.test.ts` | Two-lease fixture; distinct holder identity; ledger digest | To Implement |
| TC-XDOD-001 | `tests/behaviour/verify-gates-members.test.ts` + `tests/golden/cross-repository-members.test.ts` | `bun test tests/behaviour/verify-gates-members.test.ts tests/golden/cross-repository-members.test.ts` | `gatesRuntime` overrides; `gates[]`/`summary`, required `member`, `overall: pass`, type discriminated by `definitionOfDone` (DM-9, DM-11, DEC-18) | To Implement |
| TC-XDOD-002 | `tests/behaviour/verify-gates-members.test.ts` | `bun test tests/behaviour/verify-gates-members.test.ts` | Record-fail + `gates.ci: fail` + blocked/incomplete bundles; `overall: fail` is the sole classification carrier (no field/envelope), exit 1 (DM-9, DEC-18) | To Implement |
| TC-XDOD-003 | `tests/behaviour/verify-gates-members.test.ts` | `bun test tests/behaviour/verify-gates-members.test.ts` | All-records-pass + unavailable-CI fact; member `unknown`, `blocked`, `overall: fail`, `summary.failed` 0 (N1, DEC-18) | To Implement |
| TC-XDOD-004 | `tests/behaviour/verify-gates-members-evidence.test.ts` | `bun test tests/behaviour/verify-gates-members-evidence.test.ts` | Absent-head / no-run / missing-`pullRequest` bundles; `incomplete` only with no blocking condition and ≥1 `unknown`; `overall: fail`, exit 1 (N1, DEC-18) | To Implement |
| TC-XDOD-005 | `tests/behaviour/verify-gates-members.test.ts` + `tests/behaviour/verify-gates-read-budget.test.ts` (extend) | `bun test tests/behaviour/verify-gates-members.test.ts tests/behaviour/verify-gates-read-budget.test.ts` | Recording runtime, guards; unavailable member `unknown` with all records passing ⇒ `blocked`/`overall: fail` (N1) | To Implement |
| TC-XDOD-006 | `tests/behaviour/verify-gates-members.test.ts` | `bun test tests/behaviour/verify-gates-members.test.ts` | Gate-set override excluding one identifier | To Implement |
| TC-XDOD-007 | `tests/behaviour/verify-gates-members-evidence.test.ts` | `bun test tests/behaviour/verify-gates-members-evidence.test.ts` | `MemberLandingObservation` bundle (1-based only when merged); counting transport asserts zero extra read (DM-10, DEC-19) | To Implement |
| TC-XDOD-008 | `tests/behaviour/verify-gates-members.test.ts` | `bun test tests/behaviour/verify-gates-members.test.ts` | Mixed resolvable/unresolvable override; synthetic record with `member`/`read-failed` and the pinned empty citation (`identity:{changeRef}`, empty sources/counts/names, `reasons:["read-failed"]`), `summary.unknown` once (N3, DM-9) | To Implement |
| TC-XDOD-009 | `tests/behaviour/verify-gates-members-evidence.test.ts` + `tests/golden/cross-repository-members.test.ts` | `bun test tests/behaviour/verify-gates-members-evidence.test.ts tests/golden/cross-repository-members.test.ts` | PR-less member bundle; committed golden | To Implement |
| TC-XDEP-001 | `tests/behaviour/queue-members-dependency.test.ts` | `bun test tests/behaviour/queue-members-dependency.test.ts` | Landing observation injection | To Implement |
| TC-XDEP-002 | `tests/behaviour/queue-members-dependency.test.ts` + `tests/behaviour/queue-dep-cycle.test.ts` (extend) | `bun test tests/behaviour/queue-members-dependency.test.ts tests/behaviour/queue-dep-cycle.test.ts` | Ledger digest; cycle fixture | To Implement |
| TC-XCLOSE-001 | `tests/behaviour/closeout-members.test.ts` + `tests/golden/cross-repository-members.test.ts` | `bun test tests/behaviour/closeout-members.test.ts tests/golden/cross-repository-members.test.ts` | Fixed clock; two observations; exact apply-column sets (`applied\|satisfied\|refused\|skipped-gap` / `applied\|satisfied\|skipped-noop\|skipped-gap`), no step-`detail` parsing, aggregate unchanged (N5, DEC-12) | To Implement |
| TC-XCLOSE-002 | `tests/behaviour/closeout-members.test.ts` + `tests/behaviour/closeout-queue-removal-skips.test.ts` (extend) | `bun test tests/behaviour/closeout-members.test.ts tests/behaviour/closeout-queue-removal-skips.test.ts` | Partial-merge `CrossRepositoryCloseoutObservation` entries; held lease; no carrier required (DEC-20) | To Implement |
| TC-XCLOSE-003 | `tests/behaviour/closeout-members.test.ts` | `bun test tests/behaviour/closeout-members.test.ts` | Squash-safety override; exact plan/apply columns (`would-refuse`/`would-apply` vs `refused`/`applied`), misleading step-`detail` injection, aggregate unchanged (N5, DEC-12) | To Implement |
| TC-XCLOSE-004 | `tests/behaviour/closeout-members.test.ts` + `tests/behaviour/closeout-plan.test.ts` (extend) | `bun test tests/behaviour/closeout-members.test.ts tests/behaviour/closeout-plan.test.ts` | Tree snapshot; fixed clock; AC-NFR4-1 primary, AC-F5-1 member shape as supplement | To Implement |
| TC-XREV-001 | `tests/behaviour/verify-gates-review-flow.test.ts` + `tests/golden/cross-repository-members.test.ts` | `bun test tests/behaviour/verify-gates-review-flow.test.ts tests/golden/cross-repository-members.test.ts` | Injected review observation set | To Implement |
| TC-XREV-002 | `tests/behaviour/verify-gates-review-flow.test.ts` | `bun test tests/behaviour/verify-gates-review-flow.test.ts` | Duplicated observation bundle | To Implement |
| TC-XREV-003 | `tests/behaviour/verify-gates-review-flow.test.ts` | `bun test tests/behaviour/verify-gates-review-flow.test.ts` | Member sets with/without a PR-less member; `runId` digest with empty marker; `unreviewed` entry (DEC-8) | To Implement |
| TC-XREV-004 | `tests/behaviour/verify-gates-review-flow.test.ts` | `bun test tests/behaviour/verify-gates-review-flow.test.ts` | Partial observation bundle | To Implement |
| TC-XREV-005 | `tests/behaviour/verify-gates-review-flow.test.ts` + `tests/behaviour/entrypoint-help.test.ts` (extend) + `tests/structure/event-state-additivity.test.ts` (baseline unchanged) | `bun test tests/behaviour/verify-gates-review-flow.test.ts tests/behaviour/entrypoint-help.test.ts tests/structure/event-state-additivity.test.ts` | Network/no-spawn guards; root-family set assertion | To Implement |
| TC-XREV-006 | `tests/behaviour/verify-gates-review-flow.test.ts` | `bun test tests/behaviour/verify-gates-review-flow.test.ts` | `ReviewObservation` fixture builder `tests/fixtures/cross-repository/review.ts` | To Implement |
| TC-XPAR-001 | `tests/behaviour/cross-repository-parity.test.ts` + `tests/golden/plan-text.test.ts` (unchanged) | `bun test tests/behaviour/cross-repository-parity.test.ts tests/golden/plan-text.test.ts` | Committed pre-change goldens; normalizer asserted keys-only | To Implement + Existing – No Change |
| TC-XPAR-002 | `tests/behaviour/cross-repository-parity.test.ts` + `tests/golden/closeout-envelope.test.ts`, `tests/golden/closeout-human.test.ts` (unchanged) | `bun test tests/behaviour/cross-repository-parity.test.ts tests/golden/closeout-envelope.test.ts tests/golden/closeout-human.test.ts` | Fixed clock for apply mode; committed goldens | To Implement + Existing – No Change |
| TC-XPAR-003 | `tests/behaviour/cross-repository-parity.test.ts` + `tests/types/cross-repository-report.type-test.ts` (new) + `tests/golden/verify-gates.test.ts`, `tests/golden/queue-list.test.ts`, `tests/golden/queue-plan.test.ts`, `tests/golden/lanes-list.test.ts` (unchanged) + `tests/fixtures/queue/golden/queue-add-memberless.json` (new) | `bun test tests/behaviour/cross-repository-parity.test.ts tests/golden/verify-gates.test.ts tests/golden/queue-list.test.ts tests/golden/queue-plan.test.ts tests/golden/lanes-list.test.ts` + `pnpm exec tsc -p tests/types/tsconfig.json` | Delivered literal `overall: "pass"` (static+runtime), no `member`, failure envelope/exits 1-2, member-less add golden from `404e9bf8` (N4, DM-11, DEC-18, DEC-21) | To Implement + Existing – No Change |
| TC-XCTR-001 | `tests/structure/cross-repository-contract.test.ts` + `tests/structure/envelope-contract.test.ts` (extend) | `bun test tests/structure/cross-repository-contract.test.ts tests/structure/envelope-contract.test.ts` | Captured envelopes from behaviour runs | To Implement + Existing – Update |
| TC-XCTR-002 | `tests/behaviour/cross-repository-readonly.test.ts` | `bun test tests/behaviour/cross-repository-readonly.test.ts` | Guarded store recorder; tree/ledger snapshots | To Implement |
| TC-XCTR-003 | `tests/structure/cross-repository-contract.test.ts` + `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts`, `tests/structure/event-state-additivity.test.ts` (extend) | `bun test tests/structure/cross-repository-contract.test.ts tests/structure/error-table.test.ts tests/checks/error-table-sync.test.ts tests/structure/event-state-additivity.test.ts` | Baseline fixtures unchanged | To Implement + Existing – Update |
| TC-XCTR-004 | `tests/structure/cross-repository-contract.test.ts` + `tests/fixtures/closeout/legacy-consumer.ts` (extend fixture) | `bun test tests/structure/cross-repository-contract.test.ts` | Unknown-field injected payloads | To Implement |
| TC-XCTR-005 | `tests/structure/cross-repository-contract.test.ts` | `bun test tests/structure/cross-repository-contract.test.ts` | Pure exports | To Implement |
| TC-XCTR-006 | `tests/behaviour/verify-gates-read-budget.test.ts` (extend) | `bun test tests/behaviour/verify-gates-read-budget.test.ts` | Counting transport; network/no-spawn guards; eight-member fixture; `MemberLandingObservation` adds zero reads (DM-10, DEC-19) | To Implement + Existing – Update |
| TC-XCTR-007 | `tests/structure/cross-repository-contract.test.ts` + `tests/types/cross-repository-report.type-test.ts` (new) + `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts`, `tests/structure/event-state-additivity.test.ts` (extend) | `bun test tests/structure/cross-repository-contract.test.ts tests/structure/error-table.test.ts tests/checks/error-table-sync.test.ts tests/structure/event-state-additivity.test.ts` + `pnpm exec tsc -p tests/types/tsconfig.json` | Report-type discrimination (N4) + committed pre-change identity snapshot | To Implement + Existing – Update |
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
| TR-10 | The cross-repository `gates[]`/`summary`/`overall` widening leaks into a member-less report, or `overall: unknown` is emitted by a cross-repository report | TC-XDOD-001/002/004 assert the cross-repository shape and the never-`unknown` rule; TC-XPAR-003 asserts literal `overall: "pass"`, no `member` field, the failure envelope, and exits 1/2 for member-less |
| TR-11 | The member-less `queue add` parity proof uses a post-change regenerated golden | §6.4 names `tests/fixtures/queue/golden/queue-add-memberless.json` and its capture point (`404e9bf8`, before member code); TC-XPAR-003 compares against it |

### 8.2 Assumptions

- The delivered plan validator's tolerance of unknown top-level and per-phase keys is unchanged, so `members` becomes a validated key rather than a rejected one (spec §12).
- The delivered `VerifyGatesCommandRuntime` read seams (`readOpenPullRequests`, `readDeliveryRequestDetail`, `readCheckRuns`, `readWorkItem`, `readGateSet`) are sufficient for per-member corroboration; if a new port is required, it is additive and injected (spec §8.3/§8.4).
- `createMemberCheckout` (or its explicit-base extension) mints member `repoKey`s deterministically enough for stable goldens; tests use returned keys, never literals.
- The closeout harness's fixed clock is sufficient for deterministic `recordedAt` ledger records in apply mode.
- `absent` has one definition (DEC-4) covering no pushed head, no declared pull request, and no run for the head; AC-F3-4 and TC-XDOD-004 follow it.
- The `ReviewObservation` seam `{ repoKey, pullRequest, verdicts[] }` is injected through the existing verification composition (DEC-17); the durable production carrier beyond it is deferred and non-blocking (OQ-3 resolved-with-deferral), so no AC depends on a production writer.
- The `evidence[]` element is `{ repoKey, pullRequest, landed, landingPosition? }` with `landingPosition` 1-based and present only when `merged` is true (DEC-16, DM-10); `landed`, `landingPosition`, and per-member merge truth come from `MemberLandingObservation` `{ repoKey, merged, headSha?, landingPosition? }` and add no provider read (DEC-19).
- The cross-repository report is the distinct `CrossRepositoryVerifyGatesReport` selected by the presence of `definitionOfDone` (DM-11); it keeps the delivered required fields and adds `overall: pass|fail`, `definitionOfDone`, `blockingMembers[]`, and `reviewFlow`. `gates[]` is `CrossRepositoryVerifyGateRecord[]` — one record per declared (member, gate) in member-declared then gate order with a **required** `member` = repoKey — and `summary` counts those records. An unresolvable identifier contributes exactly one `unknown` record with `read-failed` and the pinned empty citation (`identity:{changeRef}`, empty sources/counts/names, `reasons:["read-failed"]`), attributing no provider source/branch/SHA (DM-9, N3). A single-repository report is the delivered `VerifyGatesReport`: literal `overall: "pass"`, `VerifyGateRecord[]` with no `member` field, and the delivered static type preserved.
- The member verdict is mechanical over **both** its records and its CI reading: `pass` iff every declared record is `pass` **and** `gates.ci` is `pass`; `fail` if any record is `fail` **or** `gates.ci` is `fail`; otherwise `unknown` (so all-pass records with `unavailable`/`absent` CI are `unknown`, never `pass`) (N1, DM-3). The change aggregates: `blocked` iff any member is `fail`, any `gates.ci` is `unavailable`, or any synthetic unresolvable record exists; `incomplete` iff no such condition holds and at least one member is `unknown` (`absent` CI and an unestablished resolvable reading are its named instances); `green` iff every member is `pass`; `blocked` wins over `incomplete`, and `blockingMembers[]` names every member that is not `pass` (DM-2, DEC-3).
- The cross-repository `overall` is `pass` for `green` (exit 0) and `fail` for `blocked`/`incomplete` (exit 1); `overall: unknown` is never emitted, so the delivered classified-unknown/`verify.gates.unavailable` exit-2 path is untouched. The scoped supersession is exactly four behaviours and nothing else: (a) the distinct cross-repository report type with `overall: pass|fail`; (b) a data-bearing negative report whose delivered `verify.gates.failed` classification is carried by `overall: "fail"` itself — no separate classification field and no error envelope (N9); (c) `gates[]` records of the cross-repository type with a required `member`; (d) `overall: "unknown"` never emitted by that type, while command-level failures that prevent a report keep their delivered identities/exits (N10, DEC-18). The delivered `VerifyGatesReport` type/value/static literal/failure envelope/exits are unchanged for every report without `definitionOfDone`. `definitionOfDone.status` remains the authoritative three-way member verdict.
- The `CrossRepositoryCloseoutObservation` seam `{ repoKey, pullRequest, merged, headSha?, branch, issueClosure? }` supplies per-member merge/branch/issue-closure facts through the closeout composition (DEC-20); `cleanup`/`issueClosure` follow the pinned per-member precedence and never rewrite the aggregate step outcome (DEC-12); no new port, provider operation, or store is added, and the durable production carrier is deferred and non-blocking (OQ-6).
- `queue add` on a member plan returns the delivered payload unchanged plus the additive ordered `data.members[]` `{ref, repoKey, lane}`, with auto-declared edges in the delivered `edges[]`; a member-less plan returns the delivered payload byte-identically (DEC-21), proven against `tests/fixtures/queue/golden/queue-add-memberless.json` captured from `404e9bf8` before any member code lands.
- The review `runId` digests the sorted declared member set as `repoKey` + pull-request-or-empty marker, so adding/removing a PR-less member changes the identity (DEC-8, DM-7).

### 8.3 Spec Addition Closure (SG-1..SG-7 by v1.1; DEC-18..DEC-21 by v1.2; DoR-1 by v1.3; DoR-2 by v1.4)

All seven gaps reported against spec v1.0 were closed additively in spec v1.1; spec v1.2 pinned four literals; spec v1.3 closed the DoR iteration-1 blocking findings B1, B2, B5, B6 and the non-blocking test-plan observations; spec v1.4 closed the DoR iteration-2 findings N1, N3, N4, N5, N9, N10 and the N6 wording. No gap remains open, no AC is uncovered, and the TC count is unchanged. This section is the closure record: gap/finding/literal → criterion/decision → test cases.

| ID | Original gap (spec v1.0) | Closed by (spec v1.1) | TC coverage | Status |
|----|--------------------------|-----------------------|-------------|--------|
| SG-1 | No §17 AC for missing/empty member fields; the `repoKey` grammar was unpinned | DEC-15 with AC-F1-5 (required/empty fields, empty `dependsOn` element) and AC-F1-6 (`repoKey` grammar) | TC-XPLAN-006, TC-XPLAN-007 (TC-XPLAN-004 keeps the combined closed-field-set probe) | **Closed** |
| SG-2 | F-2's per-member lease release had no §17 AC | AC-F2-5 (release one member ref, `released`, entries retained, the other member's held lease unchanged and never blocking) | TC-XQUEUE-006 (TC-XQUEUE-005 keeps the general release/lane probe) | **Closed** |
| SG-3 | The unresolvable declared gate identifier had no §17 AC | AC-F3-7 (verdict `unknown`, blocker named, `blocked`, exit 1, no invented `pass`) | TC-XDOD-008, TC-XDOD-006 | **Closed** |
| SG-4 | NFR-6 (bounded reads) and NFR-7 (identity reuse) had no §17 ACs | AC-NFR6-1 (counting transport: ≤1 page/detail/check-run per member, 0 retries/pagination, no out-of-set call) and AC-NFR7-1 (row count and kind membership identical) | TC-XCTR-006, TC-XCTR-007 (TC-XDOD-005/TC-XCTR-003 keep the provenance/identity probes) | **Closed** |
| SG-5 | The review-observation carrier was unnamed (OQ-3 open) | DEC-17 with AC-F6-4: injected `ReviewObservation` `{repoKey, pullRequest, verdicts[]}` through the verification composition; no store/no command; durable production carrier deferred, non-blocking | TC-XREV-006, TC-XREV-005 | **Closed (seam pinned)**; durable carrier deferred |
| SG-6 | The `evidence[]` element shape was unpinned | DEC-16 with AC-F3-8: exactly `{repoKey, pullRequest, landed, landingPosition?}`; PR-less member omitted from `evidence[]` | TC-XDOD-009, TC-XDOD-007 | **Closed** |
| SG-7 | AC-F3-4 vs F-3/DEC-4 definitional tension for a missing `pullRequest` | DEC-4 states one `absent` definition (no head, no PR, or no run) and AC-F3-4 is aligned | TC-XDOD-004 | **Closed** |

**Spec v1.2 literal closure (no new ACs, no new TCs).** Four previously unpinned literals are now asserted inside existing cases:

| Decision | Pinned literal | Asserted additively in | Status |
|----------|----------------|------------------------|--------|
| DEC-18 | Report-level `overall`: `green`→`pass` (exit 0), `blocked`→`fail` (exit 1), `incomplete`→`fail` (exit 1); `unknown` never emitted; data-bearing negative report (v1.3 corrected the v1.2 `incomplete`→`unknown` pin) | TC-XDOD-001, TC-XDOD-002, TC-XDOD-004 | **Pinned (v1.3)** |
| DEC-19 | `landed`/`landingPosition` arrive as `MemberLandingObservation` `{repoKey, merged, headSha?, landingPosition?}` (1-based only when `merged`); no additional provider read; read budget unchanged | TC-XDOD-007, TC-XCTR-006 | **Pinned (v1.3 carrier)** |
| DEC-20 | `CrossRepositoryCloseoutObservation` `{repoKey, pullRequest, merged, headSha?, branch, issueClosure?}`, one per member through the closeout composition; no new port/store; durable carrier deferred (OQ-6) | TC-XCLOSE-001, TC-XCLOSE-002 | **Pinned** |
| DEC-21 | `queue add` returns the delivered payload plus additive `data.members[]` `{ref, repoKey, lane}` in declared order; edges via delivered `edges[]`; member-less payload byte-identical | TC-XQUEUE-001, TC-XPAR-003 | **Pinned** |

**Spec v1.3 DoR iteration-1 closure (no new ACs, no new TCs).** The four blocking findings and the test-plan non-blocking observations are resolved inside existing cases:

| Finding | Resolution in spec v1.3 | Asserted in | Status |
|---------|-------------------------|-------------|--------|
| B1 report contents | `gates[]` = one record per declared (member, gate) in member-declared then gate order, required `member` = repoKey, `summary` counts records, unresolvable identifier = exactly one `unknown` record (`read-failed` + pinned empty citation) (DM-9); member-less `gates[]` has no `member` | TC-XDOD-001, TC-XDOD-002, TC-XDOD-008, TC-XPAR-003 | **Closed** (N3 completed in v1.4) |
| B2 projections | DEC-18 is a distinct `CrossRepositoryVerifyGatesReport` with `overall` `pass` for `green`, `fail` for `blocked`/`incomplete`; `unknown` never emitted; negative report data-bearing with `verify.gates.failed` carried solely by `overall: "fail"`; delivered type/value/static literal/failure envelope/exits untouched; `blocked` wins over `incomplete` | TC-XDOD-001, TC-XDOD-002, TC-XDOD-004, TC-XPAR-003, TC-XCTR-007 | **Closed** (N4/N9/N10 completed in v1.4) |
| B5 carrier | `MemberLandingObservation` `{repoKey, merged, headSha?, landingPosition?}` (DM-10), `landingPosition` 1-based only when `merged`; no added read | TC-XDOD-007, TC-XCTR-006 | **Closed** |
| B6 runId | `runId` digests the sorted declared set as `repoKey` + pull-request-or-empty marker, so a PR-less member changes it (DEC-8, DM-7) | TC-XREV-003 | **Closed** |
| B7 invalid echo | Invalid verdict carries no `members` key at all (AC-F1-2) | TC-XPLAN-002 | **Closed** |
| B8 plan wording | §2 now references spec v1.4, plan revision 1.2 as reconciled (not pending), and the plan-side residual N2/N7/N8 accurately | §2 | **Closed** |
| B9 AC linkage | TC-XCLOSE-004 cites AC-NFR4-1 as primary with the member shape as an explicit AC-F5-1 supplement; TC-XPLAN-005 cites AC-F1-1/AC-F1-5/AC-F3-7 and marks the no-config assertion a supplement | TC-XCLOSE-004, TC-XPLAN-005 | **Closed** |
| B11 cleanup precedence | Mode-scoped per-member `cleanup`/`issueClosure` columns pinned, one value per field, derived from the observation + own operations, never step `detail` (DEC-12, AC-F5-1/AC-F5-3) | TC-XCLOSE-001, TC-XCLOSE-003 | **Closed** (N5 completed in v1.4) |
| B12 gate-id shape | Gate identifiers are non-empty strings of at most 64 characters (F-1/AC-F1-5) | TC-XPLAN-005 | **Closed** |
| B4 golden provenance | `tests/fixtures/queue/golden/queue-add-memberless.json` is declared in plan revision 1.2 phase 1 `scope.files`/obligation 1.0; §6.4 and TC-XPAR-003 name it, captured from `404e9bf8` before member code, envelope `runId`/`timing` normalized | TC-XPAR-003, §6.4 | **Closed** (plan reconciliation confirmed) |
| B3 plan scope | All §7 suite homes are declared in at least one phase scope (plan revision 1.2); the residual ownership mismatch is N2 (TC-XBOUND-001's determinism suite not in phase 3 scope) | Not a TC (plan change) | **Closed for suite-home presence**; N2 remains a plan item |
| B10 commit type | Phase-5 commit subject remains `docs(GH-310)` while the phase ships test suites/changeset (N7) | Not a TC (plan change) | **Open** — delivery_planning |

**Spec v1.4 DoR iteration-2 closure (no new ACs, no new TCs).** The six findings are resolved inside existing cases; N2/N7/N8 remain plan-side items:

| Finding | Resolution in spec v1.4 | Asserted in | Status |
|---------|-------------------------|-------------|--------|
| N1 member verdict aggregation | `pass` iff every declared record `pass` **and** `gates.ci: pass`; `fail` on any record `fail` or `gates.ci: fail`; otherwise `unknown`; change `blocked` on any `fail`/`gates.ci: unavailable`/synthetic record, `incomplete` otherwise with ≥1 `unknown` (`absent` is the named case), `blocked` wins; `blockingMembers[]` = every member not `pass` | TC-XDOD-001, TC-XDOD-002, TC-XDOD-003, TC-XDOD-004, TC-XDOD-005 | **Closed** |
| N3 synthetic citation | The unresolvable-identifier record's required `citation` is `identity:{changeRef}` only, `sources: []`, `counts: []`, `names: []`, `reasons: ["read-failed"]`; no provider source/name/branch/SHA | TC-XDOD-008 | **Closed** |
| N4 report types | Distinct `CrossRepositoryVerifyGatesReport`/`CrossRepositoryVerifyGateRecord` (required `member`, `overall: pass\|fail`) and unchanged delivered `VerifyGatesReport` (literal `"pass"`, no `member`), discriminated by `definitionOfDone`, with a static type probe | TC-XDOD-001, TC-XPAR-003, TC-XCTR-007 | **Closed** |
| N5 closeout mapping | Exact mode-scoped columns pinned (plan cleanup `would-apply`/`satisfied`/`would-refuse`/`skipped-gap`; plan issue closure `would-apply`/`satisfied`/`skipped-noop`/`skipped-gap`; apply cleanup `applied`/`satisfied`/`refused`/`skipped-gap`; apply issue closure `applied`/`satisfied`/`skipped-noop`/`skipped-gap`), one value per field, never step `detail` | TC-XCLOSE-001, TC-XCLOSE-003 | **Closed** |
| N6 stale §2/§8.3 | §2 references spec v1.4 and plan revision 1.2 as reconciled; the B3/B4/B8 rows state the actual closure and remaining plan items | §2, §8.3 | **Closed** |
| N9 classification carrier | A cross-repository negative report carries `verify.gates.failed` solely through `overall: "fail"` — no separate classification field, no error envelope | TC-XDOD-002 | **Closed** |
| N10 enumerated supersession | §8.5's additive-only claim is qualified by the four enumerated scoped behaviours: distinct report type/`overall: pass\|fail`; data-bearing negative report; required `member` on records; `overall: unknown` never emitted (delivered type/envelope/exits untouched) | §8.2 (this plan's restatement), TC-XPAR-003, TC-XCTR-007 | **Closed** |
| N2/N7/N8 | Plan-side residuals: TC-XBOUND-001 determinism-suite scope in phase 3 (N2), phase-5 commit type (N7), suite-home count wording (N8). No test-plan assertion owns them | Not TCs (plan changes) | **Deferred to delivery_planning** |

**Residual (non-blocking) information.** OQ-3 (durable review-verdict carrier) and OQ-6 (durable per-member closeout merge-truth carrier) remain residual beyond their injected composition seams. No acceptance criterion depends on either; if a later change introduces a carrier, it must supply the same `ReviewObservation`/`CrossRepositoryCloseoutObservation` input, and TC-XREV-005/006 and TC-XCLOSE-001/002 narrow rather than disappear.

**Reconciliation rule (binding).** If the implementation plan, a later decision, or a review pin differs from any value this plan asserts — bounds, member field names, `repoKey` grammar, `evidence[]` shape, `ReviewObservation`/`CrossRepositoryCloseoutObservation`/`MemberLandingObservation` shape, `gates[]`/`summary` projection, report `overall` mapping and exit projection, `runId` digest, `queue add` member payload, fixture base, or golden provenance/path — this test plan is revised **in the same change before the DoR gate** and never drifts silently. Every revision is recorded in Section 9 with the reason. A test that would need to change its expectation because the pin changed is a plan revision, not a test tweak.

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
| 1.2 | 2026-11-14 | test-plan-writer (deepseek-flash) | Additive update for spec v1.2 (DEC-18..DEC-21, DM-8, OQ-6; AC set unchanged at 37). No TC added, removed, or renumbered. Amended existing cases only: TC-XDOD-001/002/004 now assert `overall` `pass`/`fail`/`unknown` with the data-bearing report and exit codes (DEC-18); TC-XDOD-007 and TC-XCTR-006 now assert landing/merge truth is injected and adds no provider read (DEC-19); TC-XCLOSE-001/002 now name `CrossRepositoryCloseoutObservation` and assert no production carrier is required (DEC-20); TC-XQUEUE-001 and TC-XPAR-003 now assert the additive `queue add` `data.members[]` `{ref, repoKey, lane}` and the member-less byte-identical payload (DEC-21). Updated §2, §3.1-§3.3 descriptions/mappings (DM-8 added), §5.1 index titles, §6.3, §7 notes, §8.2-§8.3 pins, and this log. Counts unchanged: 37/37 ACs, 51 TCs (50 automated + 1 gate-only), 0 orphans. |
| 1.3 | 2026-11-14 | test-plan-writer (deepseek-flash) | Additive update for spec v1.3 DoR iteration-1 remediation (B1, B2, B5, B6 + non-blocking; AC set unchanged at 37, DEC count 21, DM-1..DM-10, RSK-1..RSK-11). No TC added, removed, or renumbered. Amended existing cases only: TC-XDOD-001/002/008 now assert the per-(member, gate) `gates[]` projection with the additive `member` discriminator and matching `summary` counts (DM-9), and TC-XPAR-003 asserts the member-less `gates[]` has no `member` field; TC-XDOD-001/002/004 assert the corrected `overall` projection (`green`→`pass`, `blocked`/`incomplete`→`fail`, `unknown` never emitted, data-bearing `verify.gates.failed`, exit 1, never exit 2) and the blocked-wins case, while TC-XPAR-003 pins the member-less literal `"pass"`, failure envelope, and exits 1/2; TC-XCLOSE-001/002 name the `MemberLandingObservation`/`CrossRepositoryCloseoutObservation` seams — TC-XDOD-007/TC-XCTR-006 name `MemberLandingObservation` with the 1-based-only-when-merged rule (DM-10); TC-XREV-003 covers PR-less member-set changes in the `runId` digest and the `unreviewed` entry (DEC-8); TC-XPLAN-002 pins the invalid verdict's absent `members` key; TC-XPLAN-005 pins the ≤64-char gate-id shape and re-cites AC-F1-1/AC-F1-5/AC-F3-7; TC-XCLOSE-001/003 pin the per-member cleanup/issue-closure precedence and the mode-specific refuse values; TC-XCLOSE-004 re-cites AC-NFR4-1 with the AC-F5-1 supplement. §6.4 names the member-less `queue add` golden `tests/fixtures/queue/golden/queue-add-memberless.json` captured from `404e9bf8` before member code, envelope `runId`/`timing` normalized. §2 now references plan revision 1.1 (no longer "pending") and §1.1 reflects the full 37-AC set; §3.1-§3.3, §5.1 index, §7 notes, §8.1-§8.3 updated. Counts unchanged: 37/37 ACs, 51 TCs (50 automated + 1 gate-only), 0 orphans. |
| 1.4 | 2026-11-14 | test-plan-writer (deepseek-flash) | Additive update for spec v1.4 DoR iteration-2 remediation (N1, N3, N4, N5, N9, N10 + N6; AC set unchanged at 37, DEC count 21, DM-1..DM-11). No TC added, removed, or renumbered. Amended existing cases only: TC-XDOD-003 now proves the N1 rule by making every declared `web` record `pass` while `gates.ci: unavailable` forces `unknown`, `blocked`, `overall: fail`, `summary.failed` 0, exit 1 (and does so without a CI gate in `gates`, so the fixture cannot mask the bug); TC-XDOD-001 states `pass` requires records **and** `gates.ci`, requires `member` on every record, and selects `CrossRepositoryVerifyGatesReport` by `definitionOfDone`; TC-XDOD-002 adds the all-records-pass/`gates.ci: fail` variant, the blocked-wins variant, and pins `overall: "fail"` as the sole `verify.gates.failed` carrier (N9); TC-XDOD-004 pins `incomplete` only when no `fail`/`unavailable`/synthetic record exists and ≥1 member is `unknown`, keeping resolvable records `pass`; TC-XDOD-005 pins the aggregation (`blocked` on unavailable CI, readable member `pass`, `blockingMembers[]` = `webKey`); TC-XDOD-008 pins the synthetic citation exactly (`identity:{changeRef}` only, empty sources/counts/names, `reasons:["read-failed"]`, no provider source/branch/SHA) (N3); TC-XCLOSE-001/003 assert the exact mode-scoped mapping columns (plan/apply `cleanup` and `issueClosure`), one value per field, and that no value is derived from parsing step `detail` (N5); TC-XPAR-003 and TC-XCTR-007 assert the distinct report types discriminated by `definitionOfDone` (delivered literal `"pass"`/no `member`; cross-repository required `member`/`overall: pass\|fail`) plus a static probe in `tests/types/cross-repository-report.type-test.ts` (N4). §2 now references spec v1.4 and plan revision 1.2 as reconciled; §8.2 restates the four-behaviour scoped supersession (N10); §8.3 B3/B4/B8 rows reflect the actual state and a v1.4 closure table records N1/N3/N4/N5/N6/N9/N10, with N2/N7/N8 left as plan-side items. §3.1/§3.2, §5.1 index, §7 notes, §9 updated. Counts unchanged: 37/37 ACs, 51 TCs (50 automated + 1 gate-only), 0 orphans. |

## 10. Test Execution Log

Populated during delivery (one row per execution batch; full evidence in `chg-GH-310-pm-notes.yaml`).

| TC ID(s) | Run Date | Command | Result | Notes |
|----------|----------|---------|--------|-------|
| — | — | — | Not run yet | Phase 6 (delivery) populates this log |
