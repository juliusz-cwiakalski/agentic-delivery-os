---
id: chg-GH-388-test-plan
status: Proposed
version: 1.0
created: 2026-11-23
last_updated: 2026-11-23
owners: ["Juliusz Ćwiąkalski"]
service: "verify gates command composition and the merge gate-verification ledger seam (CLI composition over the core merge-ledger state family)"
labels: [change, defect, m4, cli, merge, verify-gates]
version_impact: minor
summary: "Pin the GH-388 correction as the tests that would have caught it: the shipped production verify-gates composition supplies the delivered fenced, post-append-verified merge.gate-verification append (spec F-1/DEC-1), so a shipped `verify gates <ref>` run on a clean PR exits 0 with the byte-identical report and the ledger gains exactly ONE new record — the composition-level regression pin that fails on the shipped-default no-op append and passes once the real append is supplied (the existing injected-seam proofs exercise the handler, never the shipped wiring); `merge <ref>` then lands with no `--dry-run` anywhere (AC-T1-1); with no prior record, merge refuses `merge.state-unverified` exit 2 `state=absent` exactly as delivered with option (B) asserted absent — zero verification appends, zero gate evaluations, no landing — and the remediation sequence converges (AC-T2-1); the refusal's remediation is pinned byte-exactly to `verify gates <ref>` + the merge re-run, never a non-working step (AC-T3-1); a fixture ledger seeded by a shipped verify-gates run proves record resolution by persisted identity (key `merge.gate-verification:<changeRef>`, payload changeRef + headSha) and envelope acceptance under total identity equality (schema version + full declared id sequence, order included), with the three refusal mutations (head H′ / age at-or-above bound / one-id identity delta) refusing with the declared reasons and never consuming, exactly one record per non-refused evaluation on both the single-target and cross-repository paths, and a narrowed-scope refusal appending neither record nor capsule event (AC-T4-1); a failing battery recorded by a shipped run refuses merge through the delivered identity with the `recorded` attribution, tracker-freshness refuses at the probe per the delivered transition rule, and a clean recorded battery with a corroborating probe lands (AC-T4-2); and the whole surface stays non-regressed — 0-byte golden delta across the full outcome matrix (pass; each fail reason class; unavailable; narrowed-scope refusal; config refusals; cross-repository member evaluation), 0 added provider reads and 0 added configuration reads, secret-free records and outputs, and the five delivered gates' regression fixtures unchanged (AC-T5-1) — all over committed hermetic fixtures and injected transports with zero live network calls; goldens are captured pre-change first and enforced byte-identical, never regenerated (the spec declares no output change)."
links:
  change_spec: ./chg-GH-388-spec.md
  implementation_plan: ./chg-GH-388-plan.yaml   # phase-4 artifact; not present when this plan was written
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - M4-S24: verify gates must persist the verification merge consumes (M4)

## 1. Scope and Objectives

The defect is one composition wiring point: the verify-gates command handler constructs the complete `merge.gate-verification` record and calls its append seam on both the single-target and cross-repository paths, but the shipped production composition never supplies that seam, and the composition default is a no-op — the record is computed and dropped. `merge` therefore finds `state=absent`, refuses `merge.state-unverified` at exit 2, and its remediation sends the operator down a sequence that provably cannot converge: the record appears only after an undocumented `merge --dry-run` pre-step (observed end to end on PR #387, spec Appendix C). The delivered proof of the append exercises the seam, never the shipped wiring — every existing verification-record test injects the append into the fixture runtime, routing around exactly the code where the defect lives.

This plan therefore proves the correction where the defect lives — at the shipped production composition — and pins the consumption, identity, remediation, and non-regression properties the spec declares. The highest-risk failure modes each get an adversarial arm rather than a prose claim: the shipped-default composition silently dropping the record again (TC-VGATES-071 — the regression that would have caught GH-388: it fails on the shipped default and passes only with the real append supplied), option (B) quietly reintroduced as a merge-side verification composition (TC-MERGE-041 — zero appends, zero gate evaluations, no landing on the absence refusal), a remediation edit that drops the producing command or names a non-working step (TC-MERGE-042 — byte-exact equality, not containment), a projection-or-superset identity tolerance creeping into the envelope (TC-MERGE-043/TC-MERGE-044 — total equality of the full declared id sequence, order included, with the three declared refusal mutations), a recorded failing verdict silently passed (TC-MERGE-045), and a silent output or read-budget change smuggled in with the wiring (TC-VGATES-073/074/075 — byte-identical goldens across the full outcome matrix, 0 added provider and configuration reads, secret-free posture).

This is a verification map, not an execution claim: nothing here was run against a new implementation at authoring time, and phase ownership belongs to `chg-GH-388-plan.yaml`, authored in phase 4 after this plan. All six acceptance criteria (AC-T1-1, AC-T2-1, AC-T3-1, AC-T4-1, AC-T4-2, AC-T5-1) — and through spec Appendix B, ticket AC-1 … AC-5 — are covered by at least one named case; every case traces to exactly one spec AC; there are no TODO rows, no orphan cases, and no open questions blocking coverage. No acceptance criterion was found untestable as written.

### 1.1 In Scope

- The shipped production verify-gates composition's persistence: `verify gates <ref>` over injected transports and a real state store exits 0 with the byte-identical report and appends exactly one fenced, post-append-verified `merge.gate-verification` record per full battery evaluation (single-target and cross-repository member paths); the append is silent.
- The composition-level regression pin: a test that fails on the shipped-default composition (append seam absent → no record) and passes with the fix (real append supplied), including the append-fault negative control (a classified state failure, never consumable evidence).
- Merge consumption of the verify-gates record: the native sequence `verify gates <ref>` → `merge <ref>` lands a clean PR with no `--dry-run` anywhere; the freshness envelope accepts the battery-surface record under total identity equality; the three declared refusal mutations refuse with their reasons and never consume.
- The absence path: `merge.state-unverified` exit 2 `state=absent` as delivered, option (B) asserted absent (zero verification appends, zero gate evaluations, no landing), and the remediation sequence converging.
- The remediation byte-pin: the `merge.state-unverified` row's `remediationHint`, the committed error-table baseline fixtures, and the documented row carry the working sequence byte-exactly — producing command and consuming re-run present, no non-working step (in particular no `--dry-run` as a required pre-step).
- Recorded-verdict consumption: a failing battery recorded by a shipped run refuses merge through the delivered identity with the `recorded` attribution (not-green `ci-green`; a failing battery-only built-in through the per-gate family); `tracker-freshness` refuses at the probe per the delivered transition rule; a clean recorded battery with a corroborating probe lands.
- Persistence counting and refusal no-append: exactly one record per non-refused evaluation (repeat runs, member-projected records), a narrowed-scope refusal appending neither record nor capsule event, a configuration refusal (which precedes evaluation) appending nothing.
- Non-regression: 0-byte golden delta across the full outcome matrix with the append wired (pass; each fail reason class; unavailable; narrowed-scope refusal; config refusals; cross-repository member evaluation); 0 added provider reads and 0 added configuration reads on the verify-gates and merge paths; secret-free records and outputs under the delivered privacy allowlist; the five delivered gates' regression fixtures passing unchanged.
- The golden-capture procedure: pre-change goldens captured first at the branch point for every matrix cell lacking a committed golden; byte-identity enforced thereafter; no regeneration (the spec declares no output change).

### 1.2 Out of Scope & Known Gaps

- **The injected-seam matrix (delivered, stays authoritative).** `tests/behaviour/merge-verification-record.test.ts` (TC-MERGE-005/006) proves the handler appends exactly one fenced record per evaluation and classifies an append failure — with the seam injected. This plan does not re-run that matrix; it adds the shipped-composition layer the injected proofs route around (TC-VGATES-071/072) and cites TC-MERGE-005/006 as the handler-level rule source (Existing – No Change).
- **The freshness envelope over hand-built records (delivered, stays authoritative).** TC-MERGE-007..011 pin accept, age/head/set refusals, the at-bound boundary, and the exit-2 state-unverified split over the fixture record builder. TC-MERGE-043/044 re-express the accept and the three mutations over a record the shipped handler produced; they do not re-pin the delivered mutation matrix (cited as Existing – No Change).
- **Custom declared `merge.gates` surface parity.** Deferred fail-closed (spec §7.3, OQ-1, RSK-2, NG-9, DEC-5): all ACs are declared over the shipped default set. The `gates-stale` set-delta refusal under a custom declared set is delivered behaviour (TC-MERGE-010's identity family); no case here drives a custom declared set through verify gates. Deliberately uncovered by this plan.
- **`merge --dry-run` behaviour.** Unchanged (NG-6): its delivered suite (TC-MERGE-028) stays authoritative. This plan asserts only its unchangedness (the golden matrix and the dry-run cell of the counting matrix) and that it never appears in the required landing sequence (TC-MERGE-040, TC-MERGE-042).
- **`verify deploy`.** Untouched (NG-4); its delivered suites and goldens stay authoritative and are exercised only by the aggregate gate.
- **Capsule `gate.outcome` append semantics.** Unchanged (NG-5): writer, kind, event key, payload, disclosure. TC-VGATES-072 asserts the delivered append-counting posture around it (the narrowed refusal appends neither record nor capsule event); it does not re-pin the capsule contract.
- **Ledger mutation, migration, back-fill, seeding.** Not tested because not to exist (NG-10, G-6): asserted absent by construction — every case grows the ledger only through the delivered fenced append; no delete/rewrite/repair call is reachable from any case's path. The delivered state-layer suites remain authoritative for the append contract itself.
- **Waiver and transaction ledgers, landing mechanism, convergence/replay, refusal taxonomy beyond record consumption.** Unchanged (NG-7); delivered suites stay authoritative. New cases assert zero transaction/waiver records and ≤1 landing call on their paths as byproducts, not as re-pins.
- **New error-table rows, record kinds, keys, schemas, envelope keys, exit codes.** None exist (NG-3); the delivered structure suites (`error-table`, `merge-refusal-rows`, `merge-contract`, `verify-gates-contract/exports/imports`) and `tests/checks/error-table-sync.test.ts` stay authoritative and fail on any vocabulary addition. TC-MERGE-042 pins the one existing row's content, not a new row.
- **Documentation reconciliation.** Phase-7 obligation (spec §22, DEC-6): the two feature specifications, the engine-first operations guidance, and the merge/verify-deploy test specification are reconciled there. No doc assertions belong to this plan except TC-MERGE-042's documented-row clause, which pins the remediation sentence the row already carries (the delivered containment pins stay; the byte-exact obligation is new).
- **Live network paths.** Never covered: default runs make no live network calls — fixtures and injected transports only, guarded per case. `tests/checks/verify-gates-no-live-calls.test.ts` (TC-VGATES-059) and `tests/checks/merge-deploy-no-live-calls.test.ts` (TC-MERGE-039) stay authoritative.
- **Changeset format, branch targeting, phase mechanics.** Delivery-phase concerns declared in the spec (§18); owned by the implementation plan; not test scenarios.

## 2. References

- Change specification: `./chg-GH-388-spec.md` — §1 summary and DEC-1..DEC-6 (mechanism, identity rule, silent append, remediation pin, default-set scope, docs strategy), §5.1 capability details (F-1..F-5), §6 flows (the four declared sequences), §8.2/§8.3 (EVT-1/EVT-2, DM-1..DM-3), §9 NFRs, §10 (the counting and no-append invariants are pinned by tests, not runtime counters), §16 affected components, §17 acceptance criteria, Appendix A code-truth findings (the broken seam, the identity truth, the remediation truth), Appendix B ticket traceability, Appendix C observed evidence.
- PM notes: `./chg-GH-388-pm-notes.yaml` — the intake clarify-scope divergence note (the observed ledger asymmetry), the identity-seam briefing and its RESOLVED correction (Appendix A's code truth), the phase-7 documentation impacts, and the operational conventions (harness binary `delivery-os`, gate evidence `TMPDIR=$PWD/tmp/tmpdir`, commits via the commit primitive, PR targets `main-tools`).
- Testing strategy: `.ai/rules/testing-strategy.md` — bun:test under `tests/**/*.test.ts`, hermetic fixture conventions, permanent-suite invariant rules (never assert a branch diff; goldens updated deliberately by explicit command, never blanket-rewritten; assert meaning, not growing counts), aggregate gate `pnpm check`.
- Current-truth feature specifications: `doc/spec/features/feature-verify-gates.md` (persistence and the battery surface), `doc/spec/features/feature-merge-verify-deploy.md` (freshness envelope, recorded-or-probe consumption, newest-record-wins), `doc/spec/features/feature-result-contract.md` (the `merge.state-unverified` row and its remediation sentence).
- Test specification: `doc/quality/test-specs/test-spec-merge-verify-deploy.md` — the delivered coverage rows this plan extends (state-write discipline, verify-gates non-regression, composition reachability, classification fidelity, no live calls); it gains the new coverage rows in phase 7.
- Delivered prior art this plan builds on:
  - `tests/behaviour/merge-verification-record.test.ts` (TC-MERGE-005/006) — the injected-seam append proof and the fence/post-append-verified edge assertions the new production-level cases mirror at the shipped composition.
  - `tests/behaviour/merge-freshness.test.ts` (TC-MERGE-007..011) — the envelope accept/refuse/boundary/state-unverified conventions and the clock-offset seeding technique.
  - `tests/behaviour/merge-production-composition.test.ts` (TC-ENGINE-050..053, TC-MRG-049..055) — the production-composition harness pattern: the real `createProductionComposer` over a real temp checkout with only transport, credential, configuration-filesystem, and spawn seams injected; TC-MRG-051's rendered `merge.state-unverified` refusal cell.
  - `tests/fixtures/merge/production-composition.ts` — the harness this plan extends with the verify-gates arms (clean-PR provider replies, pm-notes materialization, CI workflow materialization, state-store wrap for append faults).
  - `tests/golden/verify-gates.test.ts` (TC-VGATES-044/045/052/063) + `tests/fixtures/verify-gates/golden/` — the committed byte-pinned goldens (success data, machine envelope, human report, failure summary) and the replay-equality convention.
  - `tests/fixtures/verify-gates/corpus/` (`cases.json` + `fixtures/*.json`) — the committed outcome-matrix fixture family (pass, each fail reason class, unavailable, credential-unavailable, head-unresolved, narrowed shapes) the golden matrix rides.
  - `tests/behaviour/verify-gates-narrowed-scope.test.ts` (TC-SNARR-001..005) — the narrowed-scope refusal's exit, closed error key set, and byte-pinned header.
  - `tests/behaviour/verify-gates-read-budget.test.ts` (TC-VGATES-051) — the recording-seam read-budget and zero-spawn technique.
  - `tests/behaviour/merge-probe.test.ts` (TC-MERGE-015/016/032) — the tracker-freshness transition refusal, the probe's evidence rules, and the merge read-budget proof.
  - `tests/behaviour/merge-required-job-probe.test.ts` (TC-F3-002..006) — the `recorded`/`probe` attribution contract and the `merge.gate.<gate-id>.failed` family.
  - `tests/behaviour/merge-privacy.test.ts` (TC-MERGE-034) — the privacy scan over outputs and records.
  - `tests/golden/merge.test.ts` (TC-MERGE-036/037), `tests/behaviour/merge-dry-run.test.ts` (TC-MERGE-028), `tests/golden/cross-repository-members.test.ts` — the merge goldens, the dry-run cell, and the member-surface golden.
  - `tests/fixtures/verify-gates/cases/harness.ts` + `facts.ts` — the fixture verify runtime (`combinedRuntime`/`gatesRuntime`), its injectable `appendVerification` seam, and the fixed battery facts (GH-178, EXPECTED_JOBS, the GH-384-style fixture discipline).
  - `tests/fixtures/cross-repository/facts.ts` — `memberGatesRuntime`, `greenMemberReads`, and the member fixture world for the cross-repository path.
  - `tests/fixtures/state/harness.ts` (`makeAuditStore`, `ledgerText`, `removeRoot`) — the real state store fixture the append runs against.
- Ticket: juliusz-cwiakalski/agentic-delivery-os issue #388 (M4-S24), with its five verbatim ACs traced 1:1 through spec Appendix B.

## 3. Coverage Overview

Every AC maps to at least one named case, and every case traces to exactly one AC; no AC is TODO. Case IDs continue the delivered series, re-verified in the delivered tree immediately before authoring this plan (grep across `tests/`): the delivered maxima are **TC-VGATES-070** (`tests/behaviour/verify-gates-ci.test.ts`) and **TC-MERGE-039** (`tests/checks/merge-deploy-no-live-calls.test.ts`). The next free ids are therefore TC-VGATES-071+ and TC-MERGE-040+. This plan consumes **TC-VGATES-071..075** (the verify-gates-side series, new persistence suite plus golden/budget/privacy extensions) and **TC-MERGE-040..046** (the merge-side series across the delivered merge suites). The `TC-MRG` sub-series inside `merge-production-composition.test.ts` is deliberately not consumed — it belongs to GH-366's resolution-read cells.

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Criterion (compressed) | TC ID(s) | Status |
|-------|------------------------|----------|--------|
| AC-T1-1 | Shipped production `verify gates <ref>` (injected transports, real state store) on a clean PR: exit 0, byte-identical report, exactly ONE new fenced `merge.gate-verification` record; then `merge <ref>` lands with no `--dry-run` anywhere | TC-VGATES-071, TC-MERGE-040 | Covered |
| AC-T2-1 | `merge <ref>` with no prior record refuses `merge.state-unverified` exit 2 `state=absent` as delivered; option (B) asserted absent (zero appends, zero gate evaluations, no landing); the remediation sequence converges and lands | TC-MERGE-041 | Covered |
| AC-T3-1 | The remediation names `verify gates <ref>` + the merge re-run, never a non-working step; pinned byte-exactly, failing on any wording that drops the producing command, drops the re-run, or adds a step that cannot resolve the refusal | TC-MERGE-042 | Covered |
| AC-T4-1 | Record resolved by persisted identity (key + payload changeRef + headSha) against the merge read; envelope accepts (head equal, age below bound, identity equal — schema version + full declared id sequence, order included); the three mutations (head H′ / age at-or-above bound / one-id identity delta) refuse with the declared reasons and never consume; exactly one record per non-refused evaluation; a narrowed-scope refusal appends neither record nor capsule event | TC-MERGE-043, TC-MERGE-044, TC-VGATES-072 | Covered |
| AC-T4-2 | A failing battery recorded by a shipped run refuses merge through the delivered identity with the `recorded` attribution; `tracker-freshness` refuses at the probe per the delivered transition rule; a clean recorded battery with a corroborating probe lands | TC-MERGE-045, TC-MERGE-046 | Covered |
| AC-T5-1 | 0-byte golden delta across the full outcome matrix; 0 added provider reads and 0 added configuration reads; privacy/secret-free posture unchanged; the five gates' regression fixtures unchanged | TC-VGATES-073, TC-VGATES-074, TC-VGATES-075 | Covered |

Functional capability roll-up:

| F-# | Capability | TC ID(s) |
|-----|------------|----------|
| F-1 | Verify-gates record persistence at the shipped composition (exactly one per non-refused evaluation; none on refusals; append silent; append failure classified, never consumable) | TC-VGATES-071, TC-VGATES-072 |
| F-2 | Merge consumption: envelope accepts a battery-surface record; recorded verdicts participate (refuse with `recorded`, re-probe green, tracker-freshness fresh); the native sequence lands | TC-MERGE-040, TC-MERGE-041, TC-MERGE-045, TC-MERGE-046 |
| F-3 | Identity reconciliation: total equality of schema version + full declared id sequence, order included; projections select payload, never identity | TC-MERGE-043, TC-MERGE-044 |
| F-4 | Remediation truthfulness, byte-pinned | TC-MERGE-042 |
| F-5 | Verify-gates non-regression: goldens, read budget, bounds, privacy, five-gate fixtures | TC-VGATES-073, TC-VGATES-074, TC-VGATES-075 |

Ticket acceptance-criteria traceability (via spec Appendix B):

| Ticket AC | Spec criterion | TC ID(s) |
|-----------|----------------|----------|
| Ticket AC-1 (after `verify gates` on a clean PR, `merge` lands, no `--dry-run` pre-step) | AC-T1-1 | TC-VGATES-071, TC-MERGE-040 |
| Ticket AC-2 (with no prior verification, `merge` lands only under the declared mechanism's fail-closed path — (B) rejected) | AC-T2-1 | TC-MERGE-041 |
| Ticket AC-3 (the refusal remediation names the working sequence, pinned by a test) | AC-T3-1 | TC-MERGE-042 |
| Ticket AC-4 (a fixture pins the persisted record's identity — changeRef + headSha — against the merge read) | AC-T4-1 | TC-MERGE-043, TC-MERGE-044, TC-VGATES-072 |
| Ticket AC-5 (`verify gates` remains bounded and secret-free, no regression of its five gates) | AC-T5-1 | TC-VGATES-073, TC-VGATES-074, TC-VGATES-075 |

### 3.2 Interface Coverage (EVT-#, DM-#)

No HTTP endpoints exist or change (spec §8.1) — nothing to cover there, by absence. The event and data-model elements:

| ID | Element | TC ID(s) / note |
|----|---------|-----------------|
| EVT-1 | `merge.gate-verification` (schema `delivery.merge.gate-verification.v1`, keyed `merge.gate-verification:<changeRef>`): the producer set gains the shipped verify-gates run; shape, key, counting, and read tolerance unchanged; dry-run keeps its merge-applicable record | TC-VGATES-071 (record shape, schema, key, fence, payload members), TC-VGATES-072 (counting, member-projected shape), TC-MERGE-040 (produced and consumed), TC-MERGE-043 (resolution by key + payload identity); TC-MERGE-028 (delivered dry-run cell, Existing – No Change) |
| EVT-2 | `gate.outcome` capsule event: unchanged (NG-5); the record append precedes it on the delivered paths; the narrowed refusal appends neither | TC-VGATES-072 (both postures asserted with the recording capsule port); delivered capsule suites (Existing – No Change) |
| DM-1 | Verification record payload: change ref, head SHA, verification time, gate-set identity, per-gate verdicts with bounded citations, tracker posture — reused verbatim, no new member | TC-VGATES-071 (members asserted exactly against the delivered schema), TC-VGATES-075 (secret-free posture over the produced records) |
| DM-2 | Gate-set identity as the binding rule: schema version + full declared (or shipped-default) entry-id sequence from the shared resolver; projections never bind identity | TC-MERGE-043 (exact-equality accept incl. order), TC-MERGE-044 (the one-id delta refuses with the set delta) |
| DM-3 | Ledger discipline: append-only, fenced, post-append-verified; absent/torn/unreadable/incompatible classification feeds the delivered state-failure mapping | TC-VGATES-071 (append-fault negative control → classified failure, never consumable), TC-MERGE-041 (absent arm); torn/unreadable/incompatible delivered by TC-MERGE-011 and the state-layer suites (Existing – No Change) |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR-# | Requirement | TC ID(s) / note |
|-------|-------------|-----------------|
| NFR-1 | Read budgets unchanged on every path: 0 added provider reads, 0 added configuration reads; delivered budgets hold exactly | TC-VGATES-074 (instrumented counting on the verify-gates and merge paths, structural call counts, never wall-clock); TC-MERGE-046 (the probe's delivered read budget on the consumption path); delivered TC-VGATES-051 and TC-MERGE-032 stay authoritative (see §8.2 for the zero-writes interplay) |
| NFR-2 | Verify-gates output bytes unchanged: 0-byte golden delta across the full outcome matrix; the append produces no output effect | TC-VGATES-073 (the matrix, append wired, byte-equality against committed and pre-change-captured goldens); TC-VGATES-071 (the production run's report against the committed success goldens) |
| NFR-3 | Merge landing-path latency unchanged in composition: no new read or recomposition between envelope and landing decision | TC-VGATES-074 (the merge path's call-count shape unchanged with consumption in place); delivered TC-MERGE-032 (Existing – No Change) |
| NFR-4 | Output and record bounds hold: the persisted record satisfies delivered record validation; every bounded cap unchanged | TC-VGATES-071 (the record passes the delivered record validation on append — the post-append-verified read is that validation); delivered bounds suites (`merge-bounds` TC-MERGE-033, `verify-gates-members-bounds`, the machine-envelope cap in TC-VGATES-044) stay authoritative (Existing – No Change) |
| NFR-5 | Secret-free evidence: 0 secret-bearing members across records and outputs; privacy allowlist unchanged | TC-VGATES-075 (canary scan over shipped-produced records — single-target and member-projected — and all outputs); delivered TC-MERGE-034 and TC-MERGE-005's payload canary stay authoritative |

## 4. Test Types and Layers

- **Behaviour tests (primary):** `bun:test`, `tests/behaviour/*.test.ts`. The shipped-composition persistence and counting cases (new suite), the production merge-consumption cells, the freshness arms over the shipped-produced record, the recorded-verdict consumption cells, the read-budget proof, and the privacy scan live here, per the testing strategy's module-to-test mapping (`packages/**` → `bun test tests/structure tests/behaviour`).
- **Golden tests:** `tests/golden/*.test.ts` — the outcome-matrix byte-identity arms extend the delivered verify-gates golden suite; the committed goldens under `tests/fixtures/verify-gates/golden/` are the pre-change oracle. The pre-change capture entry is a fixture module, never named `*.test.ts`, following the delivered explicit-capture-entry convention.
- **Structure/contract tests (guarding; one extension):** `tests/structure/*.test.ts` — TC-MERGE-042's byte-exact remediation pin extends `merge-refusal-rows.test.ts`; the delivered error-table, merge-contract, and verify-gates contract suites pin the closed vocabulary and fail on any addition (no new cases needed there).
- **Hermeticity guards (no new cases):** `tests/checks/verify-gates-no-live-calls.test.ts` (TC-VGATES-059) and `tests/checks/merge-deploy-no-live-calls.test.ts` (TC-MERGE-039) stay authoritative; every production-composition case additionally installs the throwing no-network guard per case (the delivered TC-ENGINE pattern).
- **Static/diff checks (always):** `git diff --check`; naming and placement review against the `tests/behaviour` conventions; fixtures never named `*.test.ts` so they are not discovered as suites.
- **Aggregate gate:** `pnpm check` (lint → format:check → typecheck → test → boundaries) is the pre-review proof battery (spec §18); narrow suites are used while iterating. Gate evidence uses the declared scratch-directory override (`TMPDIR=$PWD/tmp/tmpdir`).
- **Performance:** no wall-clock assertions anywhere. The read budgets are proven structurally through instrumented call counts on the injected transport and configuration-resolution seams (the delivered TC-VGATES-051/TC-MERGE-032 technique).

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Priority | AC Coverage |
|-------|-------|------|-------|----------|-------------|
| TC-VGATES-071 | Shipped-composition persistence: one fenced record, byte-identical report, append-fault negative control | Happy Path + Negative | suite | High | AC-T1-1 |
| TC-VGATES-072 | Persistence counting: one per evaluation on both paths; narrowed and config refusals append nothing | Corner Case | suite | High | AC-T4-1 |
| TC-VGATES-073 | 0-byte golden delta across the full outcome matrix with the append wired | Regression | suite | High | AC-T5-1 |
| TC-VGATES-074 | Read budgets unchanged with the append wired: 0 added provider and configuration reads | Corner Case | suite | High | AC-T5-1 |
| TC-VGATES-075 | Secret-free records and outputs; five-gate regression fixtures unchanged | Regression | suite | High | AC-T5-1 |
| TC-MERGE-040 | The native sequence lands: `verify gates` → `merge`, no `--dry-run` anywhere | Happy Path | suite | High | AC-T1-1 |
| TC-MERGE-041 | Absence fail-closed, option (B) asserted absent, remediation converges | Negative | suite | High | AC-T2-1 |
| TC-MERGE-042 | The `merge.state-unverified` remediation pinned byte-exactly | Regression | suite | High | AC-T3-1 |
| TC-MERGE-043 | Identity fixture: the shipped record resolved by persisted identity and accepted | Happy Path | suite | High | AC-T4-1 |
| TC-MERGE-044 | The three refusal mutations refuse with declared reasons and never consume | Negative | suite | High | AC-T4-1 |
| TC-MERGE-045 | A recorded failing battery refuses with the `recorded` attribution | Negative | suite | High | AC-T4-2 |
| TC-MERGE-046 | `tracker-freshness` at the probe; a clean recorded battery with a corroborating probe lands | Edge Case | suite | High | AC-T4-2 |

### 5.2 Scenario Details

#### TC-VGATES-071 - Shipped-composition persistence: one fenced record, byte-identical report, append-fault negative control

**Scenario Type**: Happy Path (primary arm) + Negative (append-fault control)
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-T1-1, EVT-1, DM-1, DM-3, NFR-2, NFR-4, DEC-1, DEC-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: new suite `tests/behaviour/verify-gates-persistence.test.ts`; fixture family `tests/fixtures/verify-gates/production-composition.ts` (the production-composition harness extended with verify-gates arms, reusing `createProductionComposer`, the temp-checkout/host helpers, and `createNoNetworkGuard` from the delivered merge fixture)
**Tags**: @backend, @cli, @state, @regression

**Preconditions**:

- The production-composition harness builds one real temp checkout per arm: the integration base plus a feature branch with one commit (full-SHA head `H`), its own state root and configuration filesystem, the recording GitHub transport, the credential port, and the spawn seams injected — the delivered TC-ENGINE pattern. Nothing else is injected: the verify-gates runtime is the one the shipped `createProductionComposer` composes, seams and defaults included.
- The checkout carries a complete pm-notes document for `<ref>` (materialized from the delivered complete-base classification fixture) and a CI workflow declaring the expected job names, so the lifecycle and `ci-green` gates evaluate green over the injected provider replies.
- The provider replies compose the clean-PR posture: open, non-draft, mergeable, targeting the integration base, green check-run page over `H`, resolved request detail, work item without owner-attention labels, positive commit and changed-file counts.
- A throwing no-network guard is installed for the duration of every arm; the shipped default gate set is in force (no declared `merge.gates` configuration).

**Steps**:

1. Run `verify gates <ref> --json` through the production composer.
2. Assert exit 0; assert the machine envelope's `data` equals the committed success-data golden and the human (non-JSON) stdout equals the committed human-success golden — byte-equality against files captured before this change (NFR-2 at the production layer; DEC-3's silent append: the appended record produces no line, field, or exit difference).
3. Read the ledger through the delivered per-change-ref verified read; assert exactly one record: schema `delivery.merge.gate-verification.v1`, key `merge.gate-verification:<ref>`, `changeRef == <ref>`, `headSha == H`, the fixed verification instant, the full shipped-default identity (schema version plus the six-id sequence in resolver order), five per-gate verdicts with bounded citations, and the observed tracker posture (DM-1 members asserted exactly — no new member, no missing member).
4. Assert the fence discipline ran: the fence was acquired and released and the post-append verified read observed the record (the delivered edge assertions of TC-MERGE-005, mirrored through the real store's behaviour).
5. Assert the capsule `gate.outcome` event was appended once on the delivered path (EVT-2 posture).
6. Negative control: rebuild the harness with the state store wrapped so the verification append faults (the delivered `stateStoreWrap` seam); run `verify gates <ref>` again; assert the run fails with the classified state-failure identity at its declared exit — never silence, never a green exit — and that the ledger contains no consumable record.
7. Continuation of the control: run `merge <ref>` on the faulted fixture; assert it refuses `merge.state-unverified` (the failed append is never consumable evidence).

**Expected Outcome**:

- The shipped composition persists the record it computes: exactly one new fenced, post-append-verified record per the clean evaluation, with the report byte-identical to the committed goldens (AC-T1-1's verify half).
- Pre-fix, this case fails at step 3: the shipped-default composition supplies no append seam, the ledger holds no record. Post-fix it passes. This is the composition-level regression pin that would have caught GH-388 — the existing TC-MERGE-005 cannot fail the way this case can, because its seam is injected.
- The append-fault control proves the classified-failure discipline at the shipped wiring: a faulted append is a run failure, never a consumable record (DM-3, RSK-5's answer).

**Postconditions**:

- Temp roots removed; the no-network guard restored with zero recorded calls.

**Notes / Clarifications**:

- This case does not re-run TC-MERGE-005's injected-seam matrix; it exercises the code the injection routes around. The two layers are complementary and both stay in the suite.
- The byte-equality arms compare against committed pre-change goldens; the capture procedure is fixed in §6. No golden regeneration is authorized by this plan (§6, §8.1).

#### TC-VGATES-072 - Persistence counting: one per evaluation on both paths; narrowed and config refusals append nothing

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-T4-1, EVT-1, EVT-2, NFR-4, DEC-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-persistence.test.ts` (same new suite); the member arm reuses the cross-repository fixture world (`memberGatesRuntime`, `greenMemberReads`) with a recording append seam and recording capsule port; the refusal arms reuse the narrowed-scope and gate-set-refusal fixture shapes
**Tags**: @backend, @cli, @state

**Preconditions**:

- A recording `appendVerification` seam and a recording capsule port are supplied to the runtime under test (counting without changing behaviour), over a real fixture state store — so the counts are assertions, not accidents of a no-op default.
- The narrowed arm declares a suite map that narrows the battery (the delivered narrowing fixture shapes of TC-SNARR); the config arm forces a gate-set resolution failure (the delivered refusal code class) that precedes evaluation.

**Steps**:

1. Run the shipped production `verify gates <ref>` twice in sequence on the same store; count the appended records after each run.
2. Run the cross-repository member evaluation (green member reads) through the shipped composition with the recording seams; read back the member record.
3. Drive the narrowed-scope refusal with the recording seams; read back records and capsule events.
4. Drive the configuration refusal with the recording seams; read back records and capsule events.

**Expected Outcome**:

- Exactly one new record per full battery evaluation: one after the first run, exactly one more after the second (two total for `<ref>`; newest-record-wins unchanged) — the delivered TC-MERGE-005 counting, proven at the shipped composition.
- The member evaluation appends exactly one record in the delivered member-projected shape (member discriminator dropped, order and count preserved); the identity is member-independent (RSK-6's counting pin).
- The narrowed-scope refusal appends **neither record nor capsule event** (EVT-2's declared posture; AC-T4-1's counting tail). The config refusal — which precedes evaluation — appends nothing and raises no capsule event.
- A recording seam turns today's trivially-true no-append (the fixture default no-op) into a real assertion; any future ordering change that appends on a refusal path fails here.

**Postconditions**:

- Temp roots removed; recorder counts left asserted in the run.

**Notes / Clarifications**:

- TC-SNARR-001..005 remain the narrowed refusal's exit/header authority (Existing – No Change); this case owns only the append counting on that path.

#### TC-VGATES-073 - 0-byte golden delta across the full outcome matrix with the append wired

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-T5-1, NFR-2, DEC-3
**Test Type(s)**: Integration + committed golden comparison
**Automation Level**: Automated
**Target Layer / Location**: `tests/golden/verify-gates.test.ts` (delivered suite — extend); capture entry `tests/fixtures/verify-gates/golden/matrix-golden-run.ts` (never named `*.test.ts`) with captured cell goldens under `tests/fixtures/verify-gates/golden/`, mirroring the delivered explicit-capture-entry convention; matrix cells ride the committed corpus family (`tests/fixtures/verify-gates/corpus/`)
**Tags**: @backend, @cli, @golden, @regression

**Preconditions**:

- The pre-change goldens exist first (procedure in §6): every committed golden (success data, machine envelope, human report, failure summary, replay) stays read-only; every outcome-matrix cell lacking a committed golden is captured at the branch point before the composition is edited, via the explicit capture entry, and committed.
- The append is wired for every matrix cell: the delivered real append (`appendMergeGateVerification` over a fixture store) supplied to the runtime, so byte-identity is proven with persistence live, not with the append suppressed.
- The matrix cells: pass; each fail reason class (per-gate reason vocabulary over the corpus); unavailable (read-failed and credential-unavailable cells); narrowed-scope refusal; each config refusal; cross-repository member evaluation (against the member surface's committed golden).

**Steps**:

1. Run each matrix cell through the runtime with the real append wired; capture human stdout, machine envelope, and exit code.
2. Compare human bytes, machine envelope bytes (including envelope keys and ordering), verdicts, citations, and exits against the committed/captured pre-change goldens — exact byte equality per cell.
3. Run the cross-repository member cell; compare against the member surface's committed golden bytes.
4. Re-run the pass and fail cells; assert replay byte-equality (the delivered replay convention).

**Expected Outcome**:

- 0-byte delta on every cell: the append is silent (DEC-3, NFR-2). Any byte difference is a defect in the change, not a golden-update trigger — the spec declares no output change, so no regeneration is authorized (§6, §8.1).
- The goldens demonstrate the full delivered outcome matrix is covered, not just the happy path: fail reason classes, unavailable, narrowed, config, and member cells are each byte-pinned.

**Postconditions**:

- The captured goldens are committed state; the fixture store roots removed.

**Notes / Clarifications**:

- The delivered golden cases (TC-VGATES-044/045/052/063) and TC-SNARR's byte-pinned header stay authoritative; this case adds the append-wired dimension and the cells without committed goldens. It does not duplicate their matrices.

#### TC-VGATES-074 - Read budgets unchanged with the append wired: 0 added provider and configuration reads

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-T5-1, NFR-1, NFR-3
**Test Type(s)**: Integration (instrumented)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-read-budget.test.ts` (delivered suite — extend), over the recording transport and a counting configuration-resolution seam; the merge-path arm reuses the production harness's recorded transport calls
**Tags**: @backend, @cli, @perf

**Preconditions**:

- The recording transport records every provider request (method, URL); the counting configuration seam records every configuration-document resolution attempt; the state store is the real fixture store so the fenced append's delivered read-before/read-after ride the append contract rather than a suppressed path.

**Steps**:

1. Run the shipped `verify gates <ref>` (pass cell) with the append wired; read the transport and configuration counters.
2. Run the fail and unavailable cells; read the counters (the refusal paths must not add reads either).
3. Run `merge <ref>` over a shipped-produced record (the TC-MERGE-040 posture) under the recording transport; read the counters against the delivered merge budget.

**Expected Outcome**:

- Verify-gates: at most one page or item per provider source, no pagination, one bounded configuration-document resolution attempt — the delivered budget exactly, with 0 added provider requests and 0 added configuration reads versus the delivered baseline (NFR-1).
- The state append's read-before and read-after are the delivered fenced-append contract (DM-3), not new reads in the NFR-1 sense; they are counted and asserted to match the append contract's shape, never conflated with provider or configuration reads.
- Merge: the delivered budget holds with the battery-surface record consumed — no new read, no recomposition between envelope and landing decision (NFR-3).
- All bounds are asserted structurally through call counts; no wall-clock assertion exists anywhere in the plan.

**Postconditions**:

- Temp roots removed.

**Notes / Clarifications**:

- Delivered TC-VGATES-051 and TC-MERGE-032 remain the budget authorities (Existing – No Change); see §8.2 for the zero-writes scoping note that keeps TC-VGATES-051 green and meaningful after the fix.

#### TC-VGATES-075 - Secret-free records and outputs; five-gate regression fixtures unchanged

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, AC-T5-1, NFR-5, DM-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-privacy.test.ts` (delivered suite — extend; the record-privacy frame is TC-MERGE-034's), over the fixture verify runtime with the real append and planted-canary facts
**Tags**: @backend, @cli, @privacy, @regression

**Preconditions**:

- The fixture facts carry planted canary material in every provider payload field the delivered privacy rules exclude from records and outputs (titles, bodies, comments, raw payload fragments, credential-shaped strings) — the delivered canary technique of TC-MERGE-005/TC-MERGE-034.
- Records are produced by the shipped handler path (single-target and member-projected) with the real append, then read back from the store.

**Steps**:

1. Run `verify gates` (pass and fail cells) with the canary facts; serialize every produced record and every output (human stdout, machine envelope, refusal summaries).
2. Scan each serialization for the canary material.
3. Read the member-projected record back and scan it identically.
4. Run the delivered five-gate regression fixture suites unchanged (the CI, lifecycle, owner-composition, parity-squash, and members suites, plus the corpus driver) as the unchanged-behaviour clause.

**Expected Outcome**:

- Zero canary hits in any record or any output: the persisted record carries identity, counts, verdicts, reasons, and posture labels only (NFR-5; the delivered privacy allowlist unchanged — no allowlist member added or widened).
- The five gates' delivered regression fixtures pass unchanged: the battery's verdict rules, reason vocabularies, citation shape and bounds, ordering, and output caps are untouched by the persistence change (F-5; ticket AC-5).

**Postconditions**:

- Temp roots removed.

**Notes / Clarifications**:

- The unchanged-fixture clause is satisfied by the delivered suites staying green in the aggregate gate; this case owns the produced-record privacy scan that no delivered suite performs (TC-MERGE-005's canary covers one injected-seam record; this case covers the shipped-produced records on both paths).

#### TC-MERGE-040 - The native sequence lands: `verify gates` → `merge`, no `--dry-run` anywhere

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-2, F-3, AC-T1-1, EVT-1, NFR-1, NFR-2, DEC-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-production-composition.test.ts` (delivered suite — extend), over the extended production harness (the TC-VGATES-071 fixture family) so both commands run through the one shipped composer against one real state store
**Tags**: @backend, @cli, @state, @regression

**Preconditions**:

- The production harness composes the clean-PR posture of TC-VGATES-071 (open non-draft mergeable PR, green CI at `H`, no owner labels, complete pm-notes, expected job names), the shipped default gate set, and a recording transport that also answers the landing path (the delivered landing reply convention).
- The harness records the argv of every command invocation, so the absence of `--dry-run` is an assertion, not a narrative.

**Steps**:

1. Run `verify gates <ref>` through the production composer; assert exit 0 and the byte-identical report.
2. Record the verification count (exactly one record, from TC-VGATES-071's shape assertions).
3. Run `merge <ref>` — plain, no flags — through the same composer on the same store.
4. Assert the merge exits 0 with `result=merged` and the provider squash SHA.
5. Assert the sequence properties: no invocation's argv contains `--dry-run`; no `merge.state-unverified` refusal occurred anywhere in the sequence; the verification count is still exactly one (the landing consumed the record; merge appended no verification of its own); the transaction record exists once; the landing call count is ≤ 1 at the expected head.

**Expected Outcome**:

- The documented native sequence lands a clean PR: the envelope accepts the verify-gates record, the probe corroborates, the landing proceeds (AC-T1-1's merge half; ticket AC-1's positive branch).
- Pre-fix, step 3 refuses `merge.state-unverified` and step 4 fails — the sequence property is the defect's end-to-end expression, pinned as executable proof.

**Postconditions**:

- Harness disposed; no-network guard restored with zero calls.

**Notes / Clarifications**:

- TC-MERGE-046(b) separately pins the probe-corroboration reading of the recorded verdicts (which verdicts the landing decision consumed and the probe's budget); this case owns the sequence-level properties (no dry-run, no refusal, one record, landing). The overlap is one healthy landing; the assertions do not duplicate.

#### TC-MERGE-041 - Absence fail-closed, option (B) asserted absent, remediation converges

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-4, AC-T2-1, DM-3, DEC-1, NG-8
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-production-composition.test.ts` (delivered suite — extend; the delivered TC-MRG-051 cell is the rendered-refusal precedent this case extends with the absence assertions and the convergence sequence)
**Tags**: @backend, @cli, @state

**Preconditions**:

- A fresh production harness whose ledger holds no verification record for `<ref>`; the recording transport counts every provider request by kind; the ledger bytes are captured before the refusal.

**Steps**:

1. Run `merge <ref>`; assert exit 2 with `merge.state-unverified` and `state=absent` (the delivered identity and split — TC-MERGE-011's classes, TC-MRG-051's rendering).
2. Assert option (B) is absent: the ledger grew by zero verification records across the refusal; the transport recorded zero check-run/CI evaluation reads (no gate evaluation composed); zero landing calls; zero transaction and waiver records; nothing landed.
3. Assert the refusal is the declared fail-closed path and nothing else: no verification of any kind was fabricated by merge (NG-8; DEC-1's rejection of option (B)).
4. Follow the remediation exactly: run `verify gates <ref>`, then `merge <ref>` — no other step.
5. Assert the sequence converges and lands per TC-MERGE-040's properties.

**Expected Outcome**:

- The absence refusal is exactly as delivered, and the refusal path composes nothing: zero appends, zero gate evaluations, no landing (AC-T2-1's option-(B) absence clause — the ticket's alternative branch resolved by the declared mechanism, never by an undocumented pre-step).
- The remediation sequence converges: one verify-gates run, then the merge lands — the operator instruction is executable as written.
- Torn, unreadable, and incompatible state reads keep their delivered classifications (DM-3) — delivered by TC-MERGE-011 and the state-layer suites (Existing – No Change); this case owns the absent arm's composition absence.

**Postconditions**:

- Harness disposed.

**Notes / Clarifications**:

- The zero-gate-evaluations assertion is deliberately transport-level (no check-run page on the refusal path): it fails any future change that composes a merge-side verification when no record exists — the exact option-(B) regression this pin exists to catch.

#### TC-MERGE-042 - The `merge.state-unverified` remediation pinned byte-exactly

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-T3-1, DEC-4
**Test Type(s)**: Structure/contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/merge-refusal-rows.test.ts` (delivered suite — extend; upgrades the delivered containment pin to byte-exact equality); baseline fixtures `tests/fixtures/events/error-table-baseline.json` and `tests/fixtures/supervise/error-table-baseline.json`; documented row in `doc/spec/features/feature-result-contract.md`
**Tags**: @backend, @structure, @regression

**Preconditions**:

- The declared byte-exact string is the delivered remediation hint: `Produce the verification with `verify gates <ref>` for the same work item, then re-run; the verification state is absent, torn, or incompatible.` (spec DEC-4: the shipped text already names the working sequence; the change's obligation is the pin).

**Steps**:

1. Assert the machine row's `remediationHint` equals the declared string byte-exactly (equality, not containment).
2. Assert the string's required properties structurally: it names the producing command with the same-work-item target (`verify gates <ref>` … `for the same work item`), names the consuming re-run (`then re-run`), and contains no `--dry-run` and no other step that cannot resolve an absent verification.
3. Assert both committed error-table baseline fixtures carry the same bytes for the row (the sync stays byte-true in both directions).
4. Assert the documented row carries the same sentence (the delivered containment pins stay; the documented form is the sentence the machine row holds).
5. Negative controls (asserted as the pin's failure modes): a wording that drops the producing command, drops the re-run, or inserts a non-working step (for example naming `merge --dry-run` as a required pre-step) differs from the pinned bytes and therefore fails step 1 — the pin's mutation sensitivity is demonstrated by the equality assertion plus the explicit `not.toContain("--dry-run")` guard.

**Expected Outcome**:

- The remediation can never silently drift to a sequence that cannot resolve the refusal: any edit to the hint — dropping `verify gates <ref>`, dropping the re-run, or adding a `--dry-run` pre-step — breaks the byte-equality and the structural guards (AC-T3-1; ticket AC-3).
- The rendered text-mode refusal carries the same producing command and re-run (delivered TC-MRG-051 containment, cited; the byte-exact obligation lands on the row, the baselines, and the documented sentence).

**Postconditions**:

- None (read-only over committed contracts).

**Notes / Clarifications**:

- This is the one place the plan asserts documentation content, because the row's remediation is itself the specified behaviour (F-4) — not a phase-7 documentation obligation.

#### TC-MERGE-043 - Identity fixture: the shipped record resolved by persisted identity and accepted

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-3, AC-T4-1, EVT-1, DM-1, DM-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-freshness.test.ts` (delivered suite — extend); seeding through the fixture verify runtime with the delivered real append over the merge harness's store (the handler constructs the record; the append and the read are real)
**Tags**: @backend, @state

**Preconditions**:

- The merge harness's store is seeded by running the verify-gates handler (`combinedRuntime` with `appendVerification` bound to `appendMergeGateVerification` over the harness's store) for `<ref>` at the harness head `H` — a record the shipped handler produced, not the fixture record builder TC-MERGE-007 seeds with.
- The harness clock is at its fixed instant; the record's age is below the declared bound.

**Steps**:

1. Seed the record (step 0 above); assert one record exists under the declared key.
2. Run `merge <ref>`; capture the envelope.
3. Assert the record was resolved by its persisted identity against the merge read: the read resolved the newest record under key `merge.gate-verification:<ref>`, with payload `changeRef == <ref>` and `headSha == H`.
4. Assert the envelope accepted: asserted head equals the recorded head, age below the bound, and the recorded gate-set identity equals the effective identity — schema version equal and the id sequence exactly equal to the shared resolver's full shipped-default sequence, order included (array equality, not set equality).
5. Assert the landing proceeded (transaction recorded, landing call at `H`).

**Expected Outcome**:

- The battery-surface record is fully consumable evidence: resolved by key and payload identity, accepted by the envelope under total identity equality — no projection, superset, or delta tolerance involved (F-3, DM-2; ticket AC-4's identity fixture).
- The acceptance requires no new tolerance rule: both producers resolve through the one shared resolver, so the identities are exactly equal under the shipped default (DEC-2's code-grounded claim, pinned).

**Postconditions**:

- Harness cleaned up.

**Notes / Clarifications**:

- TC-MERGE-007 (delivered accept over a hand-built record) stays authoritative for the envelope's freshness arithmetic; this case's new content is that the accepted record is the one the shipped handler constructs — identity, payload, and posture included.

#### TC-MERGE-044 - The three refusal mutations refuse with declared reasons and never consume

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-T4-1, DM-2, DM-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-freshness.test.ts` (delivered suite — extend), over the TC-MERGE-043 shipped-record fixture
**Tags**: @backend, @state

**Preconditions**:

- Three arms, each starting from the shipped-record fixture of TC-MERGE-043: (a) the merge resolves a different head `H'` (the harness's second head); (b) the clock advances to the bound and beyond (the at-bound arm included, per the delivered boundary convention); (c) the ledger additionally holds a record whose gate-set identity differs by one id (one built-in id dropped from the sequence — the minimal identity delta), appended through the delivered append.

**Steps**:

1. Arm (a): run `merge <ref>`; capture the refusal identity and evidence.
2. Arm (b): run `merge <ref>` at-bound and over-bound; capture both.
3. Arm (c): run `merge <ref>`; capture the refusal and its set delta.
4. For every arm, assert zero consumption: no landing call, no transaction record, no waiver record, no state change.

**Expected Outcome**:

- Arm (a) refuses with the head-sha reason naming both SHAs; arm (b) refuses with the age reason naming the age and the bound (at-bound belongs to refusal — the delivered boundary holds for the shipped record too); arm (c) refuses `merge.gates-stale` with the gate-set reason and the set delta inline — the corresponding declared reason for each mutation, and the record is never consumed (AC-T4-1's mutation clause).
- The order-inclusion clause of the identity rule is enforced in TC-MERGE-043's accept arm (exact array equality); the one-id drop here is the named minimal mutation that must refuse.

**Postconditions**:

- Harness cleaned up per arm.

**Notes / Clarifications**:

- TC-MERGE-008/009/010 pin these mutations over hand-built records and stay authoritative for the envelope's reason vocabulary and evidence shape; this case pins that the shipped-produced record refuses through the same declared reasons — the fixture AC demands, not a re-run of the delivered matrix.

#### TC-MERGE-045 - A recorded failing battery refuses with the `recorded` attribution

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-T4-2, EVT-1, RSK-4
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-required-job-probe.test.ts` (delivered suite — extend; the `recorded`/`probe` attribution and the `merge.gate.<gate-id>.failed` family are its delivered frame)
**Tags**: @backend, @cli, @state

**Preconditions**:

- Two arms, each seeded by a shipped verify-gates run over red facts at head `H` within the freshness envelope: (a) a not-green `ci-green` battery verdict; (b) a failing battery-only built-in (the lifecycle-finalization fail shape from the corpus family).

**Steps**:

1. Arm (a): seed the record from the red `ci-green` run; run `merge <ref>`; capture the refusal.
2. Arm (b): seed the record from the failing battery-only run; run `merge <ref>`; capture the refusal.
3. For each arm, assert zero landing calls, zero transaction records, and exactly one attribution value on the finding.

**Expected Outcome**:

- Arm (a) refuses through the delivered identity for `ci-green` with the `recorded` attribution naming the gate id and the recorded reason — the persisted verdict is truthful evidence, never silently passed (RSK-4's answer: the taxonomy shift is tested, not discovered).
- Arm (b) refuses through the `merge.gate.<gate-id>.failed` family with the recorded evidence (the battery-only verdicts are live refusal evidence where previously no record existed to read).
- Each finding names exactly one attribution — `recorded`, never `probe` — because the persisted verdict already reported the finding (the delivered attribution contract, now exercised by battery-surface records).

**Postconditions**:

- Harness cleaned up per arm.

**Notes / Clarifications**:

- The delivered attribution suites stay authoritative for the attribution vocabulary and the probe-side (`probe`) cases; this case adds the recorded-fail battery surface, which no delivered case produces (dry-run records carry no battery-only verdicts).

#### TC-MERGE-046 - `tracker-freshness` at the probe; a clean recorded battery with a corroborating probe lands

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-2, AC-T4-2, NFR-1, RSK-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-probe.test.ts` (delivered suite — extend; TC-MERGE-015/016 are the delivered tracker-transition and CI-regression probe rules this case extends to battery-surface records)
**Tags**: @backend, @cli, @state

**Preconditions**:

- Arm (a): a shipped verify-gates run with a clean battery whose recorded tracker posture precedes a fresh tracker transition observed at the probe (the delivered transition fixture shape).
- Arm (b): a shipped verify-gates run with a clean battery and a probe that corroborates (work item and check-run page green at `H`), with the probe reads counted.

**Steps**:

1. Arm (a): seed the clean record; run `merge <ref>`; capture the refusal identity and its age evidence.
2. Arm (b): seed the clean record; run `merge <ref>`; capture the landing and the probe read counts.
3. Arm (b) assertion detail: the recorded verdicts were consumed (the envelope read the verify-gates record) and the probe corroborated at the delivered budget.

**Expected Outcome**:

- Arm (a): `tracker-freshness` refuses per the delivered transition rule — the recorded posture is judged against the fresh probe observation, with the transition named and its age inline (the delivered TC-MERGE-015 rule, now driven by a battery-surface record).
- Arm (b): the landing proceeds with the probe corroborating the recorded greens at the delivered read budget — one work-item read and one check-run page, no additional reads (NFR-1 on the consumption path).
- The newest-record-wins rule stays coherent across producers: a later dry-run record consumed instead is the delivered semantics (RSK-3) — covered by the delivered TC-MERGE-005/TC-MERGE-028 interplay (Existing – No Change), not re-pinned here.

**Postconditions**:

- Harness cleaned up per arm.

**Notes / Clarifications**:

- TC-MERGE-040 owns the sequence-level landing properties; this case owns the probe-level consumption semantics over recorded verdicts.

## 6. Environments and Test Data

- **Runner and layout.** `bun test` over `tests/**/*.test.ts` (bun:test, never Jest/Vitest); fixtures under `tests/fixtures/**`, never named `*.test.ts`; the aggregate gate `pnpm check` is the pre-review battery (spec §18). Gate evidence uses the declared scratch-directory override `TMPDIR=$PWD/tmp/tmpdir`.
- **Hermeticity.** Default runs make no live network calls on any path: provider access rides injected recording transports, credentials ride injected ports, and every production-composition case installs the throwing no-network guard (zero recorded calls asserted). No ambient store is read: every case builds its own temp state root (`makeAuditStore`/`createVerifyState` conventions) and removes it in `finally`. Clocks are fixed (the harness clock seams); run ids are fixed; outputs are therefore deterministic and replay-comparable.
- **Fixture families.**
  - *Production verify-gates harness* (new; extends `tests/fixtures/merge/production-composition.ts`): real temp checkout (base + feature branch, full-SHA head), complete pm-notes materialized for the fixture ref, CI workflow declaring the expected job names, clean-PR provider replies, configuration filesystem and spawn seams injected, `stateStoreWrap` for append faults. Both `verify gates` and `merge` run through the one shipped `createProductionComposer`.
  - *Fixture verify runtime with real append* (exists; `combinedRuntime` + `appendMergeGateVerification` over a fixture store): the TC-MERGE-005 pattern, reused for the freshness seeding (TC-MERGE-043/044), the golden matrix arms (TC-VGATES-073), and the privacy canary (TC-VGATES-075).
  - *Outcome-matrix corpus* (exists; `tests/fixtures/verify-gates/corpus/`): pass, each fail reason class, unavailable, credential-unavailable, head-unresolved, narrowed shapes — the golden matrix's cell family.
  - *Cross-repository member world* (exists; `tests/fixtures/cross-repository/facts.ts`): `memberGatesRuntime`, `greenMemberReads`, member constants — the member arm of the counting and golden cases.
  - *Narrowed-scope shapes* (exists; TC-SNARR fixtures): the declared suite-map narrowing for the no-append arm.
  - *Error-table baselines* (exist; `tests/fixtures/events/error-table-baseline.json`, `tests/fixtures/supervise/error-table-baseline.json`): the byte-pin's committed mirrors.
- **Golden-capture procedure (binding).**
  1. **Capture pre-change goldens first.** Before any edit to the production composition, run the explicit capture entry (`tests/fixtures/verify-gates/golden/matrix-golden-run.ts`) at the branch point and commit the captured cell goldens for every outcome-matrix cell that lacks a committed golden (fail reason classes, unavailable, narrowed, config, member cells). The committed goldens (success data, machine envelope, human report, failure summary) are already the pre-change oracle and are not touched.
  2. **Enforce byte-identity, never regenerate.** The suites compare live bytes to the committed/captured goldens. The spec declares no output change (DEC-3, NFR-2: 0-byte delta), so no regeneration is authorized by this plan; a byte mismatch is a defect to fix in the change, not an oracle to update. Regenerating a golden requires a spec-declared output change and an explicit review decision (the testing strategy's golden rule).
  3. **Capture entries are explicit, not blanket.** The capture entry is a dedicated module, run deliberately, writing only the cells it owns — never a snapshot-rewrite command over the golden directory.
- **Isolation.** Every case owns its store root and checkout; no case reads the live repository ledger, the real `doc/changes/` capsule state, or any live provider; the recorded landing path lands nothing real (the provider reply is injected).

## 7. Automation Plan and Implementation Mapping

Execution commands (narrow, while iterating): `bun test tests/behaviour/verify-gates-persistence.test.ts`, `bun test tests/golden/verify-gates.test.ts`, `bun test tests/behaviour/verify-gates-read-budget.test.ts`, `bun test tests/behaviour/merge-privacy.test.ts`, `bun test tests/behaviour/merge-production-composition.test.ts`, `bun test tests/behaviour/merge-freshness.test.ts`, `bun test tests/behaviour/merge-required-job-probe.test.ts`, `bun test tests/behaviour/merge-probe.test.ts`, `bun test tests/structure/merge-refusal-rows.test.ts`. Full battery: `pnpm check`.

| TC ID | Test file to create or update | Mocking requirements | Implementation status |
|-------|-------------------------------|----------------------|------------------------|
| TC-VGATES-071 | Create `tests/behaviour/verify-gates-persistence.test.ts`; extend `tests/fixtures/verify-gates/production-composition.ts` (verify-gates harness arms) | Injected transport/credentials/config-fs/spawn; real state store; no-network guard; committed success goldens | To Implement |
| TC-VGATES-072 | Extend `tests/behaviour/verify-gates-persistence.test.ts`; reuse `tests/fixtures/cross-repository/facts.ts` | Recording `appendVerification` seam + recording capsule port; real fixture store; narrowed and config-refusal fixture shapes | To Implement |
| TC-VGATES-073 | Extend `tests/golden/verify-gates.test.ts`; add capture entry `tests/fixtures/verify-gates/golden/matrix-golden-run.ts` + captured cell goldens | Real append over fixture store for every cell; corpus family; member golden | To Implement (capture entry + arms; suite extension) |
| TC-VGATES-074 | Extend `tests/behaviour/verify-gates-read-budget.test.ts` | Recording transport; counting configuration-resolution seam; real fixture store | Existing – Update |
| TC-VGATES-075 | Extend `tests/behaviour/merge-privacy.test.ts` | Planted canary facts; real append; member read-back | Existing – Update |
| TC-MERGE-040 | Extend `tests/behaviour/merge-production-composition.test.ts` | Production harness (TC-VGATES-071 family); landing reply; argv recording | Existing – Update |
| TC-MERGE-041 | Extend `tests/behaviour/merge-production-composition.test.ts` | Fresh store; transport kind-counting; ledger byte capture | Existing – Update |
| TC-MERGE-042 | Extend `tests/structure/merge-refusal-rows.test.ts` | None (committed contracts and baselines) | Existing – Update |
| TC-MERGE-043 | Extend `tests/behaviour/merge-freshness.test.ts` | Fixture verify runtime + real append over the merge harness store; fixed clock | Existing – Update |
| TC-MERGE-044 | Extend `tests/behaviour/merge-freshness.test.ts` | Second head; clock offsets (at-bound/over-bound); one-id-delta record via delivered append | Existing – Update |
| TC-MERGE-045 | Extend `tests/behaviour/merge-required-job-probe.test.ts` | Red-facts shipped runs (corpus shapes); recording landing port | Existing – Update |
| TC-MERGE-046 | Extend `tests/behaviour/merge-probe.test.ts` | Tracker-transition fixture; counted probe reads | Existing – Update |

Existing suites cited as authoritative with no change planned (they must stay green in the aggregate gate and are part of AC-T5-1's unchanged-fixture clause): TC-MERGE-005/006 (`merge-verification-record`), TC-MERGE-007..011 (`merge-freshness` delivered cases), TC-MERGE-015/016/032 (`merge-probe`), TC-MERGE-028 (`merge-dry-run`), TC-MERGE-033/034/036/037/039, TC-MRG-049..055, TC-VGATES-044/045/051/052/059/063/070, TC-SNARR-001..005, the member suites (`verify-gates-members*`, `cross-repository-members` golden), and the structure suites (`merge-contract`, `merge-imports`, `merge-refusal-rows` delivered cases, `verify-gates-contract/exports/imports`, `error-table`, `tests/checks/error-table-sync.test.ts`). The closed merge-suite population test (`merge-suite-obligations`, TC-F1-014) is unaffected: extensions only add markers to existing suites, and its inventories are containment checks.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

- **Golden-regeneration temptation (RSK-1's test-side mirror).** The wiring touches the composition; a failing golden comparison invites "just regenerate". Mitigation: the capture procedure (§6) is binding — pre-change capture first, byte-identity enforced, regeneration unauthorized by this plan; a mismatch is a change defect. The delivered goldens carry mutation controls and stay read-only at test time.
- **TC-VGATES-051's zero-writes clause vs the new append.** The delivered read-budget suite guards the store against mutation on the registry-read path, and its header claims "zero writes". Post-fix, the *shipped* path writes one record — but the fixture runtime's `appendVerification` default stays a no-op that never touches the store, so the fixture-level guard remains truthful. The production-level budget proof (TC-VGATES-074) allows exactly the one fenced append and counts it as the append contract, never as a provider or configuration read. If delivery finds TC-VGATES-051's guard composed onto a path the fix wires, the guard's scoping is reconciled without weakening the read-budget clause — and the reconciliation is recorded in the plan revision log.
- **Suite-map narrowing interference in production-harness runs.** Verify gates reads a declared suite map; a temp checkout with no committed configuration resolves `undeclared`, so no narrowing applies and the battery runs full. The narrowed arm is driven only by the explicit narrowing fixtures. Assumption stated here so a surprise narrowing in a production-arm run is diagnosed as a fixture leak, not a gate regression.
- **Closed merge-suite population.** `merge-suite-obligations` enumerates sixteen merge suites; extensions add markers only. Risk is nil unless a new *merge-named* suite is added — this plan adds none (the new suite is verify-gates-named, outside that population).
- **Member-path record consumption (RSK-6).** The member-projected record's shape is delivered; the counting pin (TC-VGATES-072) covers the member path and the identity rule is member-independent. Residual: low; the consumption arms use single-target records, matching AC-T4's declared fixture.
- **Clock and head control for the mutation arms.** The delivered harness seams (fixed clock, second head) already provide the control the three mutations need; no new timing or wall-clock mechanism is introduced, so no flakiness surface is added.

### 8.2 Assumptions

- The defect is composition wiring only; the handler already constructs the correct record (spec §12, Appendix A) — the plan asserts record contents rather than re-deriving them.
- GH-366's merge transaction, envelope, `merge.state-unverified` row, and the merge-applicable `ci-green` default are delivered on-base (`f531c057`); the delivered merge suites cited above are green at the branch point.
- All ACs are exercised over the shipped default gate set (DEC-5); no case declares a custom `merge.gates` configuration.
- The fixture runtime's `appendVerification` default remains injection-only (the fixture harness is not the production composition); the delivered fixture-level pins keep their meaning after the fix.
- The production harness's injected replies can express the clean-PR posture within the delivered reply vocabulary (the dry-run healthy reply already exists; the verify-gates arms add the workflow/pm-notes materialization and the green check-run page over `H`).

### 8.3 Open Questions

- None blocking coverage. OQ-1 (declared-custom-set surface parity) is deferred by the spec (§7.3) and deliberately uncovered here; its fail-closed behaviour is delivered and pinned by the delivered envelope suites. No acceptance criterion depends on an unresolved question.

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-23 | @test-plan-writer (GLM-5.3-Flash) | Initial plan: 12 cases (TC-VGATES-071..075, TC-MERGE-040..046) covering all six spec ACs (and through Appendix B, ticket AC-1..AC-5); composition-level regression pin added as the suite the injected-seam proofs could not provide; golden-capture procedure fixed to pre-change capture with byte-identity enforcement and no regeneration; TC-id series state re-verified in the delivered tree (maxima TC-VGATES-070, TC-MERGE-039). |

## 10. Test Execution Log

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
