---
id: chg-GH-225-test-plan
status: Proposed
created: 2026-11-06T17:00:00Z
last_updated: 2026-11-06T17:00:00Z
owners: [engineering]
service: delivery-os
labels: [m1, merge, deploy-verification, gates]
version_impact: minor
summary: "M1-S4 merge and verify-deploy engine: prove that landing is a verified transaction in which the recorded gate verification is fresh (exists, within the declared bound, bound to the head SHA and the effective gate-set identity), that every refusal names its gate or condition with inline evidence and a remediation hint at exit 1 (exit 2 only for platform faults and state-unverified), that post-verification tracker and CI transitions are caught by the probe, that overrides are recorded waivers whose authorizer is verified against the declared class policy (fail-closed), that a behind-base request gets exactly one rebase-refresh with a classified conflict and no force path, that the squash landing and its post-landing steps are themselves verified with idempotent replay, that repo-declared gates are enforced as data while the shipped five-gate battery output stays byte-identical, that deploy verdicts derive from the job trace (created-never-ran and status-stale read unknown, never green), and that no daemon merge path exists. 49 named TCs cover all 18 ACs, all 9 NFRs, EVT-1..3, DM-1..5, all 8 spec risks, and the binding seed scenarios SC-M1-01..05."
links:
  change_spec: ./chg-GH-225-spec.md
  implementation_plan: null   # authored in delivery_planning (phase 4)
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - M1-S4: Merge and verify-deploy engine

## 1. Scope and Objectives

This change turns landing into one verified transaction and turns deploy verification into a trace read. The tests must prove five properties at once, and each has a failure mode the ticket exists to prevent.

**First, freshness is a recorded fact, not an assumption.** The gate-verification record (EVT-1/DM-1) is written by the declared-battery evaluation and consumed by `merge` (DEC-1). The envelope must refuse when the record is absent (state-unverified, exit 2), when its age has reached the declared bound (at-bound is stale), when the recorded head SHA differs from the current head, or when the recorded gate-set identity differs from the effective one (DEC-3). A merge that re-verified everything itself could never refuse for staleness, so the tests assert the *consumer* posture: exactly one verification read, zero silent re-evaluation of the full battery.

**Second, refusals are safe and legible.** Every refusal is a classified verdict — text `result=refused`, exit 1, the failed gate or condition named, evidence inline (age, bound, SHAs, transition age, conflicting paths), a remediation hint, and the durable delta asserted too (base HEAD, request state, record counts, mutation-call log). Exit 2 is reserved for platform faults and state-unverified; a stale-but-readable verification is never exit 2, and a missing record is never a stale-style exit 1. Scripted mode renders the shipped contract's failure shape (`error` + `runId`, no `data`), which is the spec's recorded refinement of the pack's `data`-shaped examples (DEC-4, Appendix A) — the tests pin that refinement and explicitly forbid the pack spelling.

**Third, authority never self-authorizes.** A waiver passes a gate only after its authorizer principal satisfies the gate class's declared policy; for never-merge classes that principal is the provider-resolved owner identity, and an unresolvable principal never authorizes (fail-closed). An unauthorized declaration records no waiver while the audit ledger still captures the attempt; an authorized waiver is recorded before any landing mutation and persists regardless of the final verdict. The probe, not the bound, catches a ticket that flipped to an owner-gated state two minutes after verification, and the refusal cites the transition and its age.

**Fourth, mutation is bounded and convergent.** Exactly one rebase-refresh attempt per invocation, no force vocabulary, a successful refresh voids the SHA-bound verification instead of being papered over, the squash landing advances the base branch by exactly one commit and is verified, an unverifiable landing is an honest `unknown`, a pre-mutation abort is a clean `merge.transaction-aborted`, and a re-run replays the recorded `merged` verdict without a second landing. `--dry-run` evaluates and records but lands nothing.

**Fifth, the shipped surface is preserved.** `verify gates` gains one fenced append while its verdicts, citations, ordering, and human output stay byte-identical (goldens unchanged); the five built-in gate ids stay reserved and mandatory; repo-declared gates are enforced like built-ins without a source change; the three new error rows families are documented and machine-declared in the same change; and no daemon code path can fire a merge.

### 1.1 In Scope

- The typed `merge` configuration branch: `merge.gate-freshness` (default 30 minutes, declared `>=` comparator, at-bound stale) and `merge.gates` (schema-versioned declared set), with origins and classified validation (F-1, DM-4, DEC-3, DEC-9).
- The declared gate registry: closed versioned recipe vocabulary, per-entry surface applicability (`battery` | `merge` | both), optional class binding, mandatory built-ins, reserved built-in ids, list-replacement semantics, unsupported versions refused (F-1, DEC-2, DEC-9).
- The gate-verification record (EVT-1/DM-1): ref, head SHA, verification time from the injected clock, gate-set identity, per-gate verdicts with bounded citations, tracker posture snapshot; appended by `verify gates` and `merge --dry-run`; fenced and verified post-append; append failure classified (F-2, AC-F2-4, NFR-7).
- The freshness envelope: record exists, age within bound, head SHA equal, gate-set identity equal; each violation is `merge.gates-stale` with age/bound/voiding reason inline; absent or unreadable state is `merge.state-unverified` at exit 2 (F-2, DEC-3, DEC-8).
- The refusal surface in text and scripted modes, including continuity keys (`result=`, `squash=`), the `error` + `runId` scripted shape, the agent-mode trim, and the exit projection for every new row (AC-F2-2, DEC-4, NFR-8).
- The post-verification probe: one tracker work-item read on posture, one bounded check-run page on the verified head, one request-detail read for base position; tracker transition and new red job refusals with inline evidence (F-3, AC-F3-1).
- Owner-gate classification as policy-as-data and merge authority, the waiver-kind mapping and real `waivedBy` against recorded waivers (GH-229 inertness flip, GAP-9 closure) (F-4, DM-5, DEC-11).
- Waiver verification and recording: waivable-gate and class-policy checks, owner-principal resolution, fail-closed on unresolvable principal, record-before-mutation, durability across a later refusal, `merge.waiver-unauthorized` and `merge.owner-gate-override-without-waiver` (F-5, EVT-2, DM-2, DEC-5).
- The single rebase-refresh path: one attempt, classified conflict naming paths, no force vocabulary, success voids the SHA binding and refuses `merge.gates-stale` with old→new SHA (F-7, DEC-6).
- The squash landing transaction: verified landing, post-landing branch deletion and closeout-ready recording declared with per-step status, `merge.landing-unverified` as consequence `unknown`, clean pre-mutation abort as `merge.transaction-aborted`, idempotent replay, `--dry-run` (F-8, EVT-3, DM-3, DEC-12).
- The coordinator-only boundary as a testable invariant plus the per-invocation audit record with claimed identity (AC-F8-3, NFR-6).
- `verify deploy <ref>`: deterministic target resolution, one bounded trace read, the verified/unknown/failed taxonomy, the closed reason vocabulary, status fields never evidence, artifacts present in trace evidence, created-never-ran unknown, exit semantics (F-6, DEC-10).
- Non-functional coverage: determinism, read budgets, output bounds, state-write discipline, error-identity stability, idempotency, privacy/redaction (NFR-1..9, §20).
- Non-regression of the shipped `verify gates` verdict bytes and of the GH-229 board/SLA contract (RSK-2, RSK-6, §8.5).
- The binding seed scenarios SC-M1-01..05 inherited with their Given/When/Then and machine-checkable assertions (§3.4).

### 1.2 Out of Scope & Known Gaps

- [OUT] Any daemon or dispatch code path that fires a merge; the daemon consumes the coordinator command later (NG-1, §7.2, M1-S18). Only the *absence* of such a path is asserted.
- [OUT] Closeout sweep execution — the transaction records closeout-ready state; the sweep itself is M1-S12 (NG-3).
- [OUT] The typed blocker channel, queue leases, lane state, coordinator supervision (NG-2, M1-S16/S17/S23).
- [OUT] Review approvals, unresolved threads, branch protection, or worktree cleanliness as gate kinds (NG-4, §7.2).
- [OUT] Deploy triggering, re-running, or scheduling; only the absence of trigger operations is asserted (NG-5).
- [OUT] Waiting-for-CI, automatic re-verification, retry loops, or watch semantics inside the transaction (NG-6).
- [OUT] New owner-gate kinds, classes, SLA thresholds, or default-map content beyond the waiver-authorization policy this change adds; GH-229 policy data is consumed unchanged (NG-7, DEC-11).
- [OUT] MCP or other host surfaces for the new commands (§7.2).
- [OUT] Live GitHub/E2E testing. Every suite is hermetic and in-process over injected facts, or over a real temporary git repository with no network; no default-CI live call exists (§6, testing strategy).
- [OUT] Historical backfill: no verification record, waiver, or transaction record is synthesised; merges without a record simply refuse state-unverified (§19).
- [GAP-1 — implementation plan — PENDING] `chg-GH-225-plan.yaml` is authored in `delivery_planning`. It must map all 49 TCs onto delivery phases without reshaping any TC's behaviour, records, reasons, exits, bounds, assertions, or AC/NFR/SC mapping. Any later plan or implementation that changes a pinned contract reopens this test plan.
- [GAP-2 — deploy reason ↔ error-identity mapping not pinned — RESOLVED IN THIS PLAN, contract-declared] F-6/DEC-10 name the reasons `pipeline-created-never-ran` and `status-stale`; DEC-7 names the rows `verify.deploy.trace-missing`, `verify.deploy.status-stale`, `verify.deploy.trace-failed`. No row is named after `pipeline-created-never-ran`, and no reason is named `trace-missing`. Chosen reading, pinned as one declared map in contract data and asserted bidirectionally: `status-stale` → `verify.deploy.status-stale`; a failed-step trace → `verify.deploy.trace-failed`; every unknown caused by *absent executed-step/artifact evidence* (including the zero-executed-steps instance, which keeps reason `pipeline-created-never-ran`) → `verify.deploy.trace-missing`. No fourth row and no fourth reason is invented; every row is reachable and every reason maps to exactly one row (TC-DEPLOY-002/005/007, OQ-T1).
- [GAP-3 — what "declared deploy steps and artifacts" means is not pinned] F-6 requires verified only when "the declared deploy steps executed successfully and the artifacts they produce present", but the specification does not name where the expectation set comes from (workflow/job definition read, provider capability, or configuration). Chosen reading, fail-closed: the target resolution yields a declared expectation set from delivered provider facts (or declared configuration where the provider exposes it), the trace is compared against it, and *no declared expectation ⇒ never `verified`* (the verdict degrades to unknown, never green). Tests read the declared expectation source from contract data rather than hard-coding a source; TC-DEPLOY-001 asserts a positive expectation, TC-DEPLOY-005/007 assert the fail-closed control (OQ-T2).
- [GAP-4 — deploy negative-verdict envelope shape not explicitly stated] DEC-4 resolves the refusal shape for *merge*. The identical conflict exists for deploy (the pack's example renders `data.verdict`; the delivered contract renders exit-1 failures as `error` + `runId`; the task brief pins the error shape for scripted failures). Chosen reading, applied consistently: negative deploy verdicts are classified errors at exit 1 with the `verify.deploy.*` identity, `runId` present, no `data` sibling; text mode keeps `verdict=unknown` / `verdict=failed` as continuity keys; the machine verdict identity is the classified code (no prose-as-identity, DM-2). Consequence recorded: SC-M1-05's `data.verdict == unknown` spelling is superseded by this shape while its observable semantics are preserved verbatim (§3.4, TC-DEPLOY-002, OQ-T3). The pack row needs reconciliation at phase 7, not a silent fork.
- [GAP-5 — `merge --dry-run` envelope semantics] F-2/glossary pin that dry-run evaluates the merge-applicable battery, records the verification, and lands nothing, but do not pin whether it also *reports* the freshness envelope over the pre-existing record. Minimal pinned reading: dry-run evaluates the merge-applicable battery, appends exactly one verification record, performs zero mutations, reports the battery verdict (exit 0 when every merge-applicable gate passes; classified refusal at exit 1 when one fails), and never renders `result=merged` or `squash=`. Whether the pre-existing record's envelope is additionally reported is delivery-bound and not asserted (TC-MERGE-028, OQ-T4).
- [GAP-6 — precedence between `merge.gates-stale` and `merge.gate.<gate-id>.failed`] SC-M1-02 accepts either code for the stale-with-new-red-job case and Appendix A separates envelope violations from gate-level violations, while F-3 attaches the new red job evidence to `ci-green`. Chosen reading: when the freshness envelope is violated, `merge.gates-stale` is the primary identity and carries the new red job as additional inline evidence; when the verification is fresh and the probe observes a new red job, the refusal is `merge.gate.ci-green.failed`. Both directions are asserted, and the recorded evidence fields are identical either way (TC-MERGE-008, TC-MERGE-016, OQ-T5).
- [GAP-7 — waiver declaration surface spelling] DEC-5 pins the behaviour (declaration names the gate and the authorizer; verification precedes recording) but not the flag/argument grammar. The grammar is delivery-bound and read from the command contract; the behaviour, record content, ordering, and refusal identities are pinned and may not be rebound (TC-MERGE-018/019/021, OQ-T6).
- [GAP-8 — platform-fault identity reuse] DEC-7 adds only the eleven named rows; a provider fault in `merge` or `verify deploy` must therefore reuse a delivered platform/state identity. Chosen reading: no new platform row; tests assert the *class* (platform, exit 2, classified) and that the emitted code is a declared row of the existing table, never a new `merge.*`/`verify.deploy.*` code for a fault (TC-MERGE-011, TC-DEPLOY-006, OQ-T7).
- [GAP-9 — built-in id override not pinned] DEC-9 makes the five built-ins mandatory but does not say whether a declared entry may reuse a built-in id with a different recipe. Chosen reading (fail-closed, consistent with RSK-3): built-in ids are reserved — an entry reusing one must declare the shipped recipe and applicability, otherwise the declaration is a classified configuration failure. A "redefine `ci-green` to always pass" declaration therefore cannot silently remove a safety gate (TC-MERGE-003, OQ-T8).
- [GAP-10 — `merge.landing-unverified` exit projection not pinned] The row is declared with consequence `unknown` (DEC-7) but its projection class is not stated, and DEC-8 reserves exit 2 for platform faults and state-unverified. Chosen reading: `merge.landing-unverified` projects exit 2 — the mutation already fired and its landed state is not established, which is the same "state unknown" class that justifies state-unverified; a clean refusal (exit 1) would invite a double-applying retry. Tests assert exit 2, consequence `unknown`, refusal to report success, and that a re-run re-verifies rather than re-lands (TC-MERGE-025, OQ-T9).
- [GAP-11 — `merge.transaction-aborted` exit projection not pinned] DEC-12 calls it "not landed, retryable". Chosen reading: exit 1 (a classified, retryable refusal; it is neither success nor a fault/unknown state). Tests assert exit 1 with `retryable: true` and `consequence: not_landed` (TC-MERGE-026, OQ-T9).
- [GAP-12 — `--dry-run` and waiver declarations] DEC-5 records a waiver "before any landing mutation"; a dry run has no landing mutation. Chosen reading: a dry run verifies and reports a declared override's authorization (authorized/unauthorized) but records no waiver and no transaction record; waiver recording is a landing-transaction act. A real merge with the same declaration records the waiver before its first mutation (TC-MERGE-028, TC-MERGE-018, OQ-T10).
- [GAP-13 — family-row slot validation for repo-declared gate ids] The `status.collector.<id>.unavailable` precedent validates the slot against a static closed id set; repo-declared gate ids are open by design (AC-F1-1). Chosen reading: the family row is declared once and its slot validator accepts any id present in the *effective declared gate set* (registry-validated) and rejects empty, malformed, or undeclared ids; the sync checker gains a narrow family recognizer with no pattern widening. Tests assert both the accepted declared id and the rejected undeclared id (TC-MERGE-014, OQ-T11).
- [GAP-14 — "no force path" is asserted structurally, and the technique is delivery-bound] The spec requires that force operations do not exist in the vocabulary. Chosen reading: assert the mutation adapter's operation union contains no force variant, scan the merge/deploy production modules for force constructs, and keep a fixture that the scan must flag as a mutation control; a passing scan without a failing control is treated as vacuous (TC-MERGE-022, OQ-T12).
- [GAP-15 — delivery-bound spellings] Contract export names, module/file names, record schema strings, record kind names, human line labels, evidence rendering of ages/bounds/SHAs, the closeout-ready marker field, the deploy expectation field names, and the audit identity field are delivery-bound. The vocabulary (gate ids, verdicts, reasons, classes, error codes, exits, comparator, caps, assertions) is pinned and may not be rebound (§8.2 A-T8).
- [GAP-16 — `verify deploy` never-run reason carried in a prose-free envelope] Because the failure envelope's error object has no `details` field and DM-2 forbids prose-as-identity, the machine-visible identity of a negative deploy verdict is its classified code; the `reason` datum is text-mode plus the code mapping. Consumers (M1-S20) must map codes, not parse prose. Asserted in TC-DEPLOY-007 and flagged in OQ-T3.

## 2. References

- **Change specification**: [chg-GH-225-spec.md](./chg-GH-225-spec.md) — F-1..F-8, AC-F1-1..AC-F8-3 (19), NFR-1..NFR-9, EVT-1..EVT-3, DM-1..DM-5, RSK-1..RSK-8, DEC-1..DEC-12, §20 (privacy), §21 (security), Appendix A (recorded refinements).
- **Seed scenarios (binding)**: [test-scenarios.md](../../../planning/oss-tooling/milestones/m1/test-scenarios.md) — SC-M1-01..05 with their Given/When/Then and machine-checkable assertions, inherited verbatim and extended in §3.4 and §5.2.
- **Shared pins (binding)**: the same file — clean refusal = `result=refused`, exit 1, classified error, remediation hint; exit 2 reserved for platform faults and state-unverified; every command re-run is safe; text-mode bash-continuity keys; `--json` emits the envelope with `data` or `error`.
- **Proposed command contracts**: `doc/planning/oss-tooling/milestones/m1/commands/merge.md` and `verify-deploy.md`; timing default (30 m, key `merge.gate-freshness`) in `doc/planning/oss-tooling/milestones/m1/contracts.md`. Both man pages' scripted examples are illustrative shorthand: the refusal/unknown wire shape is superseded by DEC-4 and recorded in spec Appendix A (see GAP-4).
- **Testing strategy**: [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) — `bun:test`, `tests/{structure,behaviour,checks,boundaries,golden,types}`, fixture-driven suites, permanent-suite rules, `pnpm check`.
- **TypeScript rules**: [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md) — strict typing, purity, ports and adapters, error contract, `bun:test` authoring.
- **Result contract**: [feature-result-contract.md](../../../spec/features/feature-result-contract.md) — envelope, documented error table, family-row mechanism, `{0,1,2}` projection, single redaction chokepoint, bidirectional sync.
- **State layer**: [feature-state-layer.md](../../../spec/features/feature-state-layer.md) — append-only schema-versioned JSONL, verified reads, verified-empty, fences, post-append verification, torn-state classification, additive record kinds.
- **Verify gates**: [feature-verify-gates.md](../../../spec/features/feature-verify-gates.md) — five built-in gate ids and order, cited verdicts, read budgets, deterministic request resolution; this change adds the record append while pinning its bytes.
- **Configuration layer**: [feature-config-layer.md](../../../spec/features/feature-config-layer.md) — typed branches, per-value origins, classified validation, list-replacement semantics.
- **Owner-gate SLA and policy**: [feature-owner-gate-sla.md](../../../spec/features/feature-owner-gate-sla.md) and [PDR-0003](../../../decisions/PDR-0003-owner-gate-sla-default-map.md) — the two-row kind/class map consumed unchanged, the inertness boundary this change flips (GAP-9).
- **Commit primitive**: [feature-commit-primitive.md](../../../spec/features/feature-commit-primitive.md) — atomic land-and-record, abort convergence, idempotent replay precedent, temporary-git-repo test harness.
- **Existing mechanisms to reuse**: `tests/fixtures/verify-gates/cases/{harness,facts,network-guard}.ts` (in-process CLI harness, fixed brand/clock/run id, no-live guard); `tests/fixtures/verify-gates/golden/**` (the pinned battery bytes); `tests/fixtures/state/harness.ts` (temp store, edge faults, ledger inspection); `tests/fixtures/commit/harness.ts` and `tests/behaviour/commit-support.ts` (real temp git repositories, durable-delta assertions); `tests/behaviour/verify-support.ts` (`guardStore` mutation recorder); `tests/golden/helpers.ts` (`runCli`, synthetic brand, fixed run id/clock, buffer sinks); `packages/testkit/src/result-conformance.ts` (`assertEnvelopeContract`); `tests/structure/{error-table,verify-gates-contract,config-contract,registry-imports,subpaths,branding-seam}.test.ts`; `tests/checks/{error-table-sync,verify-gates-no-live-calls,secret-read-boundary,forbidden-literals,exit-code-literals}.test.ts`; `scripts/checks/{error-table-sync,ambient-globals,forbidden-literals,exit-code-literals,workspace-entrypoints}.ts`; `tests/boundaries/**`.
- **Sibling plan at the same quality bar**: [chg-GH-229-test-plan.md](../../2026-11/2026-11-06--GH-229--owner-gate-sla/chg-GH-229-test-plan.md) — binding harness, non-vacuity contract, recorded-gap discipline.
- **Ticket**: GH-225 — M1-S4: Merge and verify-deploy engine.

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Criterion (abbreviated) | TC ID(s) | Status |
|-------|--------------------------|----------|--------|
| AC-F1-1 | A config-declared custom gate is evaluated and cited like a built-in on both surfaces and failing it refuses the merge, with no source change | TC-MERGE-002, TC-MERGE-001, TC-MERGE-004 | Covered |
| AC-F1-2 | A declared set omitting a built-in, or carrying an unsupported version/malformed entry, is refused as a classified configuration failure; the effective set is never silently reduced | TC-MERGE-003, TC-MERGE-001 | Covered |
| AC-F2-1 | A recorded verification older than the declared bound refuses with exit 1, `merge.gates-stale`, age/bound/new-red-job inline, re-run-verify-gates remediation, base HEAD and request state unchanged | TC-MERGE-008, TC-MERGE-009, TC-MERGE-012 | Covered |
| AC-F2-2 | Every merge refusal (stale, failed gate, unauthorized waiver, missing override, conflicted refresh) names the failed gate/condition with inline evidence and a remediation hint, never exits 0, and uses exit 2 only for platform faults and state-unverified | TC-MERGE-012, TC-MERGE-013, TC-MERGE-014, TC-MERGE-037 | Covered |
| AC-F2-3 | No verification record, or a torn/schema-incompatible state, yields `merge.state-unverified` at exit 2 — never a silent pass, never a stale-style refusal | TC-MERGE-011, TC-MERGE-014 | Covered |
| AC-F2-4 | A failed verification-record append is classified, the verdict is never landed evidence, and a later merge does not consume it as fresh | TC-MERGE-006, TC-MERGE-005 | Covered |
| AC-F3-1 | Gates verified 2 m ago, ticket then owner-gated: the refusal names `tracker-freshness` with the transition and its age, cites the owner-gate scan, and no merge occurs | TC-MERGE-015, TC-MERGE-016 | Covered |
| AC-F4-1 | The declared classification policy resolves a gate kind's class and waiver-authorization policy without inspecting logic, including from a refusal and the board | TC-MERGE-017, TC-MERGE-020 | Covered |
| AC-F5-1 | An override by a principal not authorized for the class refuses with exit 1, `merge.waiver-unauthorized`, naming gate/class/authorizer, and no waiver record exists afterward | TC-MERGE-019, TC-MERGE-021 | Covered |
| AC-F5-2 | An authorized override's waiver record is appended before any landing mutation, the gate passes under it, the record persists regardless of the final verdict, and an owner-gate failure with no declaration refuses `merge.owner-gate-override-without-waiver` | TC-MERGE-018, TC-MERGE-021 | Covered |
| AC-F6-1 | A trace showing the declared steps executed successfully and the produced artifacts present yields `verified` with the trace summary at exit 0 | TC-DEPLOY-001, TC-DEPLOY-010 | Covered |
| AC-F6-2 | Zero executed steps yields `unknown` with reason `pipeline-created-never-ran` at exit 1 (never green); a standalone or trace-contradicting status field yields `unknown` with reason `status-stale` | TC-DEPLOY-002, TC-DEPLOY-003, TC-DEPLOY-010 | Covered |
| AC-F6-3 | Failed steps yield `failed` with the failing step named at exit 1; a failing trace read is exit 2 with a platform identity, disjoint from the unknown verdict | TC-DEPLOY-004, TC-DEPLOY-006, TC-DEPLOY-007 | Covered |
| AC-F7-1 | A behind-base request whose refresh conflicts refuses at exit 1 with `merge.rebase-conflict` naming the conflicting paths, exactly one attempt, and no force operation in the vocabulary | TC-MERGE-022, TC-MERGE-012 | Covered |
| AC-F7-2 | A successful refresh voids the SHA-bound verification and refuses `merge.gates-stale` with the old→new SHA transition and the re-run remediation; the landing never proceeds on gates verified for another SHA | TC-MERGE-023, TC-MERGE-010 | Covered |
| AC-F8-1 | All merge-applicable gates passing: one squash commit lands, the landing is verified (SHA on base, request merged), branch deletion and closeout-ready recording are declared, and `result=merged` with the squash SHA exits 0 | TC-MERGE-024, TC-MERGE-036 | Covered |
| AC-F8-2 | A re-run over a recorded verified landing replays the verdict idempotently (exit 0, recorded squash SHA) with no second landing, no duplicate records, and no request mutation | TC-MERGE-027, TC-MERGE-026 | Covered |
| AC-F8-3 | No daemon code path fires a merge; every merge invocation appears in the audit ledger with its claimed identity when present | TC-MERGE-030, TC-MERGE-031 | Covered |

**Capability coverage** (no capability left unlinked): F-1 → TC-MERGE-001..004, TC-MERGE-038; F-2 → TC-MERGE-005..013; F-3 → TC-MERGE-015, TC-MERGE-016, TC-MERGE-032; F-4 → TC-MERGE-017, TC-MERGE-020; F-5 → TC-MERGE-018, TC-MERGE-019, TC-MERGE-021; F-6 → TC-DEPLOY-001..010; F-7 → TC-MERGE-022, TC-MERGE-023; F-8 → TC-MERGE-024..030.

**TC → AC traceability**: every scenario's `Related IDs` line and the Scenario Index (§5.1) carry the reverse direction. All 18 ACs are covered; no AC is deferred and no AC is TODO.

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

The specification declares no `API-#` and no HTTP endpoint (§8.1). The machine interfaces are EVT-1..3, DM-1..5, and the three new error-identity families.

| Interface / data model | Description | TC ID(s) | Status |
|------------------------|-------------|----------|--------|
| EVT-1 — gate-verification record | Appended by every full declared-battery evaluation (`verify gates`, `merge --dry-run`): ref, head SHA, verification time, gate-set identity, per-gate verdicts with bounded citations, tracker posture snapshot; fenced, verified post-append | TC-MERGE-005, TC-MERGE-006, TC-MERGE-028, TC-MERGE-038 | Covered |
| EVT-2 — waiver record | Appended only after authorizer verification, before any landing mutation: gate id, class, ref, authorizer principal, authorization time, bounded reason; durable regardless of the final verdict | TC-MERGE-018, TC-MERGE-019, TC-MERGE-020 | Covered |
| EVT-3 — transaction outcome record | Landing (and replayed already-merged detection): result, squash SHA, landing evidence, refresh attempts, waiver references, post-landing step statuses; idempotent by change | TC-MERGE-024, TC-MERGE-025, TC-MERGE-026, TC-MERGE-027, TC-MERGE-029 | Covered |
| DM-1 — gate-verification payload | `delivery.merge.gate-verification.v1`, store-scoped per change ref, additive with no schema bump | TC-MERGE-005, TC-MERGE-008, TC-MERGE-010 | Covered |
| DM-2 — waiver payload | `delivery.merge.waiver.v1`, additive, no schema bump; identity references only, no credentials | TC-MERGE-018, TC-MERGE-019 | Covered |
| DM-3 — transaction payload | `delivery.merge.transaction.v1`, additive, no schema bump; carries landing evidence and post-landing step statuses | TC-MERGE-024, TC-MERGE-026, TC-MERGE-027, TC-MERGE-029 | Covered |
| DM-4 — declared gate set | Schema-versioned list of entries: id (built-in ids reserved), recipe from the closed vocabulary, applicability (`battery` \| `merge` \| both), optional class binding; absent value yields the shipped default | TC-MERGE-001, TC-MERGE-002, TC-MERGE-003, TC-MERGE-004 | Covered |
| DM-5 — owner-gate classification policy | The PDR-0003 two-row map plus per-class waiver-authorization policy; readable without code inspection; consumed unchanged from GH-229 | TC-MERGE-017, TC-MERGE-019, TC-MERGE-020 | Covered |
| Error identities — `merge` domain (8 rows) | Family `merge.gate.<gate-id>.failed`, `merge.gates-stale`, `merge.waiver-unauthorized`, `merge.owner-gate-override-without-waiver`, `merge.rebase-conflict`, `merge.state-unverified`, `merge.landing-unverified`, `merge.transaction-aborted`; documented and machine-declared in the same change | TC-MERGE-014, TC-MERGE-008, TC-MERGE-011, TC-MERGE-019, TC-MERGE-021, TC-MERGE-022, TC-MERGE-025, TC-MERGE-026 | Covered |
| Error identities — `verify.deploy.*` (3 rows) | `verify.deploy.trace-missing`, `verify.deploy.status-stale`, `verify.deploy.trace-failed`; documented, machine-declared, exit-projected | TC-MERGE-014, TC-DEPLOY-002..007 | Covered |
| Deploy trace read (new bounded provider read kind) | Executed steps with outcomes plus produced artifacts; one bounded read per invocation, no retries, no pagination, no log bodies | TC-DEPLOY-001, TC-DEPLOY-008, TC-DEPLOY-009 | Covered |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement | TC ID(s) | Status |
|--------|-------------|----------|--------|
| NFR-1 | Determinism: identical injected facts produce byte-identical text and machine output, including refusal evidence | TC-MERGE-035, TC-MERGE-036, TC-MERGE-037, TC-DEPLOY-010 | Covered |
| NFR-2 | Read budget per merge invocation: one verification read, one work-item read, one check-run page, one request-detail read, bounded git reads; no retries or pagination; mutation reads only on declared paths | TC-MERGE-032 | Covered |
| NFR-3 | Read budget per deploy invocation: one bounded trace read, bounded step/artifact lists with explicit truncation marks, no retries or pagination | TC-DEPLOY-008, TC-DEPLOY-009 | Covered |
| NFR-4 | Output bounds: machine `data` ≤ 65 536 bytes; human transaction summary ≤ 24 lines / 4 096 bytes; evidence and path lists capped with `+N` marks | TC-MERGE-033, TC-DEPLOY-009 | Covered |
| NFR-5 | Freshness semantics: declared bound (default 30 m), age = injected now − recorded time, at-bound stale, the single recorded verification covers CI and tracker state | TC-MERGE-007, TC-MERGE-008, TC-MERGE-009, TC-MERGE-010, TC-MERGE-011 | Covered |
| NFR-6 | Coordinator-only boundary: no daemon code path fires a merge; the merge command is the only landing producer | TC-MERGE-030, TC-MERGE-031 | Covered |
| NFR-7 | State-write discipline: every merge-domain append is fenced and verified post-append; a failed append is classified and never treated as landed | TC-MERGE-005, TC-MERGE-006, TC-MERGE-018, TC-MERGE-024, TC-MERGE-026, TC-MERGE-029 | Covered |
| NFR-8 | Error-identity stability: every new code documented and declared in the same change; the family row resolves every recognized gate-id slot; sync stays green | TC-MERGE-014, TC-DEPLOY-007 | Covered |
| NFR-9 | Idempotency: every re-run converges; already-merged replays without a second landing; waiver authorization is deterministic per (record, class policy) | TC-MERGE-026, TC-MERGE-027, TC-MERGE-018, TC-MERGE-019, TC-DEPLOY-010 | Covered |

All nine NFRs are covered. No NFR is marked TODO or deferred.

### 3.4 Seed Scenario Coverage (SC-M1-01..05, binding)

Each seed is inherited with its Given/When/Then and machine-checkable assertions. The two recorded wire-shape refinements (refusal `error` envelope for merge; `verify.deploy.*` classified identity for deploy) are spec-level (DEC-4, DEC-8, Appendix A) and are applied without weakening any seed assertion of *behaviour*; SC-M1-05's `data.verdict` spelling is the one recorded divergence and is reconciled in GAP-4.

| Seed | Inherited assertion | Realised by | Extension |
|------|---------------------|-------------|-----------|
| SC-M1-01 — merge lands clean | `result=merged`, squash SHA printed, branch deleted, landing verified (SHA on base), closeout-ready recorded; base HEAD advanced by exactly one squash commit; PR state merged; `envelope data.result == merged`; exit 0 | TC-MERGE-024 (primary), TC-MERGE-036, TC-MERGE-027 | Post-landing per-step statuses, transaction-record fields, exactly-one-commit parent assertion, cleanup-failure non-flip (TC-MERGE-029), idempotent replay |
| SC-M1-02 — stale gates refused with inline evidence | refused, failed freshness/gate named, verification age and new red job inline, remediation re-run verify gates; exit 1; code `merge.gates-stale` or `merge.gate.<gate-id>.failed`; base HEAD unchanged; no PR state change | TC-MERGE-008 (primary), TC-MERGE-009, TC-MERGE-016, TC-MERGE-012, TC-MERGE-037 | At-bound boundary, SHA/set voiding, mutation-call log, audit record, identity precedence (GAP-6) |
| SC-M1-03 — post-verification tracker flip | refusal names `tracker-freshness` with the transition and its age; exit 1; no merge; refusal cites the owner-gate scan | TC-MERGE-015 (primary), TC-MERGE-012 | Probe read budget, unchanged-posture control, CI-transition sibling (TC-MERGE-016) |
| SC-M1-04 — repo-declared gate enforced without code | the custom gate is cited like a built-in; failing it refuses the merge; gate list includes the config-declared id; no source change was needed; refusal shape as SC-M1-02 | TC-MERGE-002 (primary), TC-MERGE-001, TC-MERGE-003, TC-MERGE-004 | "No source change" converted from review prose to a machine check (no custom-id literal in production source), mandatory-built-ins and reserved-id rules |
| SC-M1-05 — vacuous deploy reads unknown | unknown verdict with the trace showing zero steps; never green; exit 1 with a classified finding | TC-DEPLOY-002 (primary), TC-DEPLOY-003, TC-DEPLOY-001 | Status-stale sibling, trace-missing sibling, platform-fault exit 2, golden surface |

No seed is dropped, renamed, or weakened. The only divergence is the recorded wire-shape refinement in GAP-4, which preserves the seed's observable semantics (verdict unknown, zero steps shown, never green, exit 1, classified).

## 4. Test Types and Layers

| Layer | Runner / invocation | Location | Covers |
|-------|--------------------|----------|--------|
| Structure — gate registry and contract binding | `bun test tests/structure/merge-contract.test.ts` | `tests/structure/merge-contract.test.ts`, `tests/structure/inventory.json` | TC-MERGE-001, TC-MERGE-004 |
| Structure — purity, tier, imports, entrypoints | `bun test tests/structure/merge-imports.test.ts`; `bun test tests/boundaries`; `bun run scripts/checks/{ambient-globals,workspace-entrypoints}.ts` | `tests/structure/merge-imports.test.ts` (pattern from `verify-imports.test.ts`) | TC-MERGE-031, TC-MERGE-030 (boundary half) |
| Structure — deploy verdict vocabulary | `bun test tests/structure/verify-deploy-contract.test.ts` | new structure suite + inventory registration | TC-DEPLOY-007 |
| Structure — error table | `bun test tests/structure/error-table.test.ts` | existing suite extended | TC-MERGE-014 |
| Behaviour — declared gate set | `bun test tests/behaviour/merge-gate-set.test.ts` | `tests/behaviour/merge-gate-set.test.ts`, `tests/fixtures/merge/gate-sets/**` | TC-MERGE-002, TC-MERGE-003 |
| Behaviour — verification record | `bun test tests/behaviour/merge-verification-record.test.ts` | new suite, `tests/fixtures/state/harness.ts` | TC-MERGE-005, TC-MERGE-006 |
| Behaviour — freshness envelope | `bun test tests/behaviour/merge-freshness.test.ts` | new suite, `tests/fixtures/merge/verification-records/**` | TC-MERGE-007, TC-MERGE-008, TC-MERGE-009, TC-MERGE-010, TC-MERGE-011 |
| Behaviour — refusal surface | `bun test tests/behaviour/merge-refusal-surface.test.ts` | new suite, `tests/golden/helpers.ts` | TC-MERGE-012, TC-MERGE-013 |
| Behaviour — probe and read budget | `bun test tests/behaviour/merge-probe.test.ts` | new suite, `tests/fixtures/merge/probes/**` | TC-MERGE-015, TC-MERGE-016, TC-MERGE-032 |
| Behaviour — classification policy | `bun test tests/behaviour/merge-classification.test.ts` | new suite, `tests/fixtures/merge/policy/**` | TC-MERGE-017 |
| Behaviour — waivers | `bun test tests/behaviour/merge-waivers.test.ts` | new suite, `tests/fixtures/merge/waivers/**` | TC-MERGE-018, TC-MERGE-019, TC-MERGE-021 |
| Behaviour — board consumption of recorded waivers | `bun test tests/behaviour/board-waiver-recording.test.ts` | new suite, board fixtures + state harness | TC-MERGE-020 |
| Behaviour — rebase-refresh | `bun test tests/behaviour/merge-rebase.test.ts` | new suite, real temp git repos (`tests/fixtures/commit/harness.ts` pattern) | TC-MERGE-022, TC-MERGE-023 |
| Behaviour — landing and post-landing | `bun test tests/behaviour/merge-landing.test.ts` | new suite, temp git repos + provider fakes | TC-MERGE-024, TC-MERGE-025, TC-MERGE-029 |
| Behaviour — convergence and dry-run | `bun test tests/behaviour/merge-convergence.test.ts`; `bun test tests/behaviour/merge-dry-run.test.ts` | new suites, state + git harnesses | TC-MERGE-026, TC-MERGE-027, TC-MERGE-028 |
| Behaviour — coordinator boundary and audit | `bun test tests/behaviour/merge-coordinator-boundary.test.ts` | new suite, audit harness | TC-MERGE-030 |
| Behaviour — bounds, privacy, determinism | `bun test tests/behaviour/{merge-bounds,merge-privacy,merge-determinism}.test.ts` | new suites, `tests/fixtures/merge/{bounds,privacy}/**` | TC-MERGE-033, TC-MERGE-034, TC-MERGE-035 |
| Behaviour — deploy verdicts | `bun test tests/behaviour/verify-deploy-verdicts.test.ts` | new suite, `tests/fixtures/verify-deploy/traces/**` | TC-DEPLOY-001, TC-DEPLOY-002, TC-DEPLOY-003, TC-DEPLOY-004, TC-DEPLOY-005, TC-DEPLOY-006 |
| Behaviour — deploy budget and bounds | `bun test tests/behaviour/{verify-deploy-read-budget,verify-deploy-bounds}.test.ts` | new suites | TC-DEPLOY-008, TC-DEPLOY-009 |
| Golden — merge | `bun test tests/golden/merge.test.ts` | `tests/golden/merge.test.ts`, `tests/fixtures/merge/golden/**` | TC-MERGE-036, TC-MERGE-037 |
| Golden — deploy | `bun test tests/golden/verify-deploy.test.ts` | `tests/golden/verify-deploy.test.ts`, `tests/fixtures/verify-deploy/golden/**` | TC-DEPLOY-010 |
| Golden — shipped battery non-regression | `bun test tests/golden/verify-gates.test.ts` (unchanged goldens) | existing suite; harness gains a state store | TC-MERGE-038 |
| Checks — error-table sync | `bun run scripts/checks/error-table-sync.ts`; `bun test tests/checks/error-table-sync.test.ts` | existing check extended with the family recognizer | TC-MERGE-014 |
| Checks — no live calls, secrets, literals | `bun test tests/checks/{merge-deploy-no-live-calls,secret-read-boundary,forbidden-literals,exit-code-literals}.test.ts`; `bun run scripts/checks/{forbidden-literals,exit-code-literals}.ts` | new no-live suite + existing checks extended | TC-MERGE-039, TC-MERGE-034, TC-MERGE-030 |
| Existing surfaces — non-regression | `bun test tests/behaviour/verify-gates-*.test.ts`; `bun test tests/behaviour/board-*.test.ts`; `bun test tests/golden/{verify-gates,board-grid}.test.ts` | existing suites | TC-MERGE-038, TC-MERGE-020 |
| Aggregate | `pnpm check`; `git diff --check`; `git status --porcelain` | repo root | all TCs |

### 4.1 In-Process Harness Contract (binding for every merge and deploy TC)

1. **In-process command execution.** Every behaviour test builds the `merge` / `verify deploy` command definitions with injected dependencies and calls `runCli(argv, streams, deps)` in process, following `tests/fixtures/verify-gates/cases/harness.ts` and `tests/golden/helpers.ts`. Only the landing/rebase TCs may touch a real temporary git repository (one `mkdtemp` root per case, deterministic author/committer identity and dates); no suite spawns the product binary or reaches the network.
2. **Injected facts and time.** Clock, run id, brand, configuration snapshot, provider readers (work item, check-run page, request detail, deploy trace), repository owner principal, state store, git adapter, audit ledger, and streams are injected. No test reads `$HOME`, the wall clock, the ambient environment where purity is asserted, the real state directory, or the network.
3. **Recording seams.** Every provider reader records invocation count and order; the deploy trace reader records its single bounded read; the git adapter records every mutation operation and its order; `guardStore` from `tests/behaviour/verify-support.ts` records `readRecords`/`append`/`acquireFence`/`releaseFence` and throws on a mutation a read-only case forbids; the audit seam records one record per invocation.
4. **One oracle per case.** Every case asserts (a) the exit code, (b) the envelope shape or the exact human lines, (c) the classified identity and its structured fields, (d) the inline evidence fields (age, bound, SHAs, transition, paths, job id, step name), (e) the durable delta (record counts/payloads, base HEAD and commit count, branch presence, request state), and (f) the read/mutation call log. A case that asserts only "refused" is not sufficient.
5. **Fixed output facts.** Where byte equality is asserted, the harness injects a fixed run id (for example `run-merge-fixture`, `run-deploy-fixture`), a fixed clock tick (for example `2026-11-06T12:00:00Z`), and a synthetic brand, so text and machine bytes are comparable.
6. **No handler stream writes.** Handlers return data or a classified failure; the CLI edge is the only writer. Tests assert no write occurs outside the edge's single serialization path.
7. **Snapshots, not ambient reads.** The configuration snapshot, declared gate set, classification policy, and owner principal are injected data. Mutation controls use deep copies; production contracts are never mutated.
8. **No live fallback.** A throwing `fetch` guard (from `tests/fixtures/verify-gates/cases/network-guard.ts`) is installed for every behaviour case; a zero-call counter is asserted on the success and refusal paths alike.

### 4.2 Non-Vacuity Contract (binding for every negative, boundary, and bound scenario)

- Every negative is paired with a restored-or-valid control that reaches the expected outcome through the same invocation path (same facts, one delta).
- Every refusal asserts the durable delta, not only the code: base HEAD unchanged, commit count unchanged, branch still present, request state unchanged, zero transaction/waiver records, zero git mutation operations — and the audit record exists with the refusal exit.
- Every contract datum (bound, comparator, gate id, recipe, applicability, class, authorization policy, verdict, reason, error row, exit projection, cap) is mutation-controlled in a temp copy and must fail the corresponding assertion by name; the unmutated control is green.
- Every policy/classification assertion is proven live: mutating a temp copy of the map changes the observed outcome (for example, making `owner-review` authorizable by a non-owner principal turns a refusal into a pass), proving the test reads data rather than a hard-coded expectation.
- Every read-only/no-mutation assertion is paired with a seeded mutation that the guarded store or git recorder detects.
- Every no-live-call assertion is paired with a guard that would throw on a call, and a deliberate-call control proves the guard is live.
- Every determinism assertion is paired with a changed-fact control that produces different bytes, proving the equality is not a constant.
- Every privacy fixture plants a distinctive `planted-merge-*` canary in a disallowed field (title, body, comment, raw provider payload, log body, credential) and asserts the intended fact is present before the run; the canary must not appear in stdout, stderr, any record, the audit entry, or the human output, while an allowed field (`ref`, SHA, gate id, principal reference) is present.
- Every golden has a mutation control: a deliberately altered expected value fails, and the committed golden is never regenerated by blanket rewrite.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Impact | Priority | AC / NFR / SC |
|-------|-------|------|--------|----------|---------------|
| TC-MERGE-001 | Gate registry contract data pinned: ids, recipes, applicability, bound, comparator, schema versions | Regression | Critical | High | DM-4, F-1, DEC-2, DEC-9, NFR-5 |
| TC-MERGE-002 | Repo-declared gate cited like a built-in and enforced at merge, with no source change (SC-M1-04) | Happy Path | Critical | High | AC-F1-1, F-1, DM-4, SC-M1-04 |
| TC-MERGE-003 | Declared gate set refused: omitted built-in, reserved-id override, unsupported version, malformed entry | Negative | Critical | High | AC-F1-2, F-1, DEC-9, RSK-3 |
| TC-MERGE-004 | Surface applicability split: battery vs merge vs both, with the shipped battery set unchanged | Regression | Critical | High | F-1, DEC-2, DM-4 |
| TC-MERGE-005 | Verification record appended by every full battery evaluation (EVT-1/DM-1) | Happy Path | Critical | High | F-2, EVT-1, DM-1, NFR-7 |
| TC-MERGE-006 | Verification-record append failure classified; never consumable as fresh | Negative | Critical | High | AC-F2-4, EVT-1, NFR-7, RSK-2 |
| TC-MERGE-007 | Freshness envelope satisfied: within bound, same head, same gate set | Happy Path | Critical | High | F-2, AC-F2-1 (control), NFR-5 |
| TC-MERGE-008 | Freshness refusal: age exceeds bound with age/bound/new-red-job inline (SC-M1-02) | Negative | Critical | High | AC-F2-1, AC-F2-2, EVT-1, DM-1, SC-M1-02 |
| TC-MERGE-009 | Freshness boundary: at-bound is stale, one millisecond under is fresh | Corner Case | Critical | High | AC-F2-1, NFR-5, DEC-3 |
| TC-MERGE-010 | Freshness voiding bindings: head SHA mismatch and gate-set identity mismatch | Negative | Critical | High | AC-F2-1, AC-F7-2, DM-1, DM-4, RSK-3 |
| TC-MERGE-011 | State-unverified: absent, torn, unreadable, and schema-incompatible verification state (exit 2) | Negative | Critical | High | AC-F2-3, AC-F2-2, DEC-8 |
| TC-MERGE-012 | Text refusal surface: named gate/condition, inline evidence, remediation, continuity keys | Regression | Critical | High | AC-F2-2, DEC-4, SC-M1-02, SC-M1-03 |
| TC-MERGE-013 | Scripted refusal surface: `error` + `runId`, no `data`, agent-mode trim | Regression | Critical | High | AC-F2-2, DEC-4, Appendix A |
| TC-MERGE-014 | Exit projection and error-table parity for the 8 merge rows and 3 deploy rows | Regression | Critical | High | AC-F2-2, AC-F2-3, NFR-8, DEC-7 |
| TC-MERGE-015 | Post-verification tracker transition caught with transition and age (SC-M1-03) | Negative | Critical | High | AC-F3-1, F-3, SC-M1-03 |
| TC-MERGE-016 | Post-verification CI regression caught on the head SHA | Negative | Important | High | AC-F3-1, F-3, RSK-1 |
| TC-MERGE-017 | Owner-gate classification readable from declared policy and authoritative at merge | Regression | Critical | High | AC-F4-1, F-4, DM-5, RSK-6 |
| TC-MERGE-018 | Authorized waiver recorded before landing, gate passes, record persists | Happy Path | Critical | High | AC-F5-2, F-5, EVT-2, DM-2, NFR-9 |
| TC-MERGE-019 | Unauthorized or unresolvable authorizer refused; no waiver record; audit captures the attempt | Negative | Critical | High | AC-F5-1, F-5, DM-5, RSK-4 |
| TC-MERGE-020 | Board consumes recorded waivers: waiver-kind mapping and real `waivedBy` (GAP-9 flip) | Happy Path | Critical | High | AC-F4-1, F-4, DEC-11, RSK-6 |
| TC-MERGE-021 | Owner-gate failure with no override declaration refuses `merge.owner-gate-override-without-waiver` | Negative | Critical | High | AC-F5-2, F-5 |
| TC-MERGE-022 | Rebase conflict: classified refusal naming paths, exactly one attempt, no force path | Negative | Critical | High | AC-F7-1, F-7, DEC-6, RSK-5 |
| TC-MERGE-023 | Successful refresh voids the SHA binding and refuses `merge.gates-stale` (old→new SHA) | Edge Case | Critical | High | AC-F7-2, AC-F2-1, DEC-6 |
| TC-MERGE-024 | Squash landing verified with post-landing steps declared (SC-M1-01) | Happy Path | Critical | High | AC-F8-1, F-8, EVT-3, DM-3, SC-M1-01 |
| TC-MERGE-025 | Unverifiable landing is `merge.landing-unverified` with consequence `unknown` | Corner Case | Critical | High | F-8, EVT-3, DEC-7, RSK-1 |
| TC-MERGE-026 | Clean pre-mutation abort is `merge.transaction-aborted` and converges on re-run | Negative | Critical | High | F-8, EVT-3, DEC-12, NFR-7 |
| TC-MERGE-027 | Idempotent replay of a recorded landing: exit 0, same SHA, no second landing | Regression | Critical | High | AC-F8-2, DEC-12, NFR-9 |
| TC-MERGE-028 | `--dry-run` evaluates, records the verification, and lands nothing | Happy Path | Critical | High | F-2, F-8, EVT-1, DEC-1 |
| TC-MERGE-029 | Post-landing cleanup failure never flips the landing verdict and is never silent | Edge Case | Important | High | AC-F8-1, F-8, EVT-3 |
| TC-MERGE-030 | No daemon merge path; every invocation audited with its claimed identity | Regression | Critical | High | AC-F8-3, NFR-6, §21 |
| TC-MERGE-031 | Pure domain core, tier discipline, no new runtime API location | Regression | Critical | High | NFR-1, NFR-6, §16 |
| TC-MERGE-032 | Read budget: one read per provider source, no retries or pagination | Regression | Important | High | NFR-2, F-3, §8.4 |
| TC-MERGE-033 | Output bounds: 65 536-byte machine, 24-line/4 096-byte human, marked truncation | Corner Case | Critical | High | NFR-4 |
| TC-MERGE-034 | Privacy: no secrets, payloads, titles, or bodies in any output or record | Negative | Critical | High | §20, §21, NFR-4 |
| TC-MERGE-035 | Determinism: byte-identical output, including refusal evidence, under fixed facts | Regression | Critical | High | NFR-1 |
| TC-MERGE-036 | Golden: merge success text and machine envelope | Regression | Important | High | AC-F8-1, NFR-1, SC-M1-01 |
| TC-MERGE-037 | Golden: merge refusals in text, scripted, and agent-trimmed forms | Regression | Important | High | AC-F2-2, NFR-1, SC-M1-02 |
| TC-MERGE-038 | Verify-gates non-regression: record append while verdict bytes stay golden-identical | Regression | Critical | High | RSK-2, §8.5, EVT-1 |
| TC-MERGE-039 | No live calls on any default merge or deploy path | Regression | Critical | High | NFR-2, NFR-3, testing strategy |
| TC-DEPLOY-001 | Verified verdict from executed steps and produced artifacts | Happy Path | Critical | High | AC-F6-1, F-6, DEC-10 |
| TC-DEPLOY-002 | Created-never-ran pipeline reads unknown, never green (SC-M1-05) | Negative | Critical | High | AC-F6-2, F-6, DEC-10, SC-M1-05 |
| TC-DEPLOY-003 | Status fields are never evidence: standalone or contradicting status reads `status-stale`; an empty trace reads `pipeline-created-never-ran` | Negative | Critical | High | AC-F6-2, F-6, DEC-10, RSK-7 |
| TC-DEPLOY-004 | Failed trace reads `failed` with the failing step named | Negative | Critical | High | AC-F6-3, F-6, DEC-10 |
| TC-DEPLOY-005 | Absent trace evidence reads unknown at exit 1, distinct from a read fault | Corner Case | Critical | High | AC-F6-2, F-6, DEC-8 |
| TC-DEPLOY-006 | Trace read fault is exit 2 with a platform identity, disjoint from the unknown verdict | Negative | Critical | High | AC-F6-3, DEC-8 |
| TC-DEPLOY-007 | Closed verdict/reason vocabulary, reason→row map, and exit projection | Regression | Critical | High | NFR-8, AC-F6-2, AC-F6-3, DEC-10 |
| TC-DEPLOY-008 | Deterministic target resolution and one bounded trace read; never triggers a deploy | Regression | Important | High | NFR-3, F-6, NG-5 |
| TC-DEPLOY-009 | Bounded step/artifact evidence with explicit truncation marks; no log bodies | Corner Case | Important | Medium | NFR-3, NFR-4, §20 |
| TC-DEPLOY-010 | Golden: deploy verified/unknown/failed surfaces, trim, and determinism | Regression | Important | High | AC-F6-1, AC-F6-2, NFR-1 |

All 49 TCs are automated. TC-MERGE-036/037 and TC-DEPLOY-010 are golden suites with mutation controls; TC-MERGE-033/TC-DEPLOY-009 are measured bound suites. Every TC is non-vacuous per §4.2; the controls are named in each scenario.

### 5.2 Scenario Details

#### TC-MERGE-001 - Gate registry contract data pinned: ids, recipes, applicability, bound, comparator, schema versions

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, DM-4, DEC-2, DEC-9, NFR-5, RSK-3
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/merge-contract.test.ts`, `tests/structure/inventory.json`
**Tags**: @backend @contract

**Preconditions**:

- The gate-registry module exports its vocabulary as `as const` data in the contracts tier (names delivery-bound).
- Spec §5.1 (F-1), DEC-2, DEC-9, and the shipped `verify-gates` contract are the read-only oracles.
- A deep-copy mutation harness; the live contract is never mutated.

**Steps**:

1. Assert the built-in gate id list is exactly `["lifecycle-finalization","ci-green","push-parity","owner-gate","squash-preflight"]` in the shipped order.
2. Assert the default declared set is exactly those five entries (surface `battery`) plus one `tracker-freshness` entry (surface `merge`), and that its effective identity is the declared schema version plus the entry-id sequence.
3. Assert the entry shape: stable `id`, `recipe` from the closed versioned vocabulary, `surface` in `["battery","merge","both"]`, optional `class` binding; assert no additional field is required and no recipe outside the vocabulary is representable.
4. Assert the freshness contract data: key `merge.gate-freshness`, default 1800 s (30 m), and an explicit comparator datum that makes at-bound stale.
5. Assert the supported gate-set schema versions are a closed declared set and that an unsupported version is not representable as valid.
6. Assert the module is data-only (the detector used by `tests/structure/status-contract.test.ts`) and registered in `tests/structure/inventory.json`.
7. Mutation controls on deep copies: rename a built-in id; drop `tracker-freshness`; add a third surface value; add an undeclared recipe; change the default bound; invert the comparator; bump the schema version outside the supported set; each mutation fails the corresponding assertion by name, and the unmutated control is green.

**Expected Outcome**:

- The registry is pinned as data: five reserved built-in ids in shipped order, one merge-only `tracker-freshness`, a closed recipe vocabulary, a three-value applicability dimension, a declared 30-minute bound with a declared comparator, and a closed schema-version set. Any drift fails by name.

#### TC-MERGE-002 - Repo-declared gate cited like a built-in and enforced at merge, with no source change (SC-M1-04)

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-1, F-1, DM-4, SC-M1-04
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-gate-set.test.ts`, `tests/fixtures/merge/gate-sets/custom-workspace-gate/**`
**Tags**: @backend @api

**Preconditions**:

- Configuration snapshot declares the five mandatory built-ins plus a custom gate `workspace-tests` with a declarative recipe (a required-CI-job-by-name recipe) and surface `both`; the gate is **configuration only** — no source file names it.
- Facts: a fresh verification record and a check-run page in which the declared `workspace-tests` job is `failed`.
- Guarded state store and recorded provider readers.

**Steps**:

1. Run `verify gates GH-304` and assert `data.gates[]` contains an entry whose id is `workspace-tests`, positioned by declared order, cited like a built-in (same citation and evidence shape), and that the human output renders the same id.
2. Assert the built-in ids still appear in shipped relative order and that `tracker-freshness` does **not** appear on the battery surface.
3. Run `merge GH-304` and assert exit 1, a classified refusal whose code is `merge.gate.workspace-tests.failed`, evidence naming the job and its state, and a remediation hint.
4. Assert the durable delta: base HEAD unchanged, commit count unchanged, branch present, request state unchanged, zero transaction and waiver records, zero git mutation operations.
5. Machine-check "no source change": scan `packages/**` production sources for the literal `workspace-tests` and assert zero occurrences (the declaration is the only place the id exists); a control fixture that hard-codes the id in a temp copy is detected by the same scan.
6. Restored control: flip the declared job to `succeeded` in the facts and assert `verify gates` passes and `merge` lands (exit 0), proving the refusal came from the declared gate.

**Expected Outcome**:

- A gate added purely as configuration is evaluated, cited like a built-in, and enforced at merge; failing it refuses with the standard gate-refusal shape; no production source mentions the id. SC-M1-04's "asserted by review" becomes a machine check.

#### TC-MERGE-003 - Declared gate set refused: omitted built-in, reserved-id override, unsupported version, malformed entry

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-2, F-1, DEC-9, RSK-3, DM-4
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-gate-set.test.ts`, `tests/fixtures/merge/gate-sets/invalid/**`
**Tags**: @backend @config

**Preconditions**:

- Invalid declaration variants: (a) the five built-ins minus `ci-green`; (b) omitted `owner-gate`; (c) an entry reusing `ci-green` with a different recipe or surface (GAP-9); (d) an unsupported `schemaVersion`; (e) a malformed entry (unknown recipe, empty id, duplicate id, extra field, wrong type).
- A valid declared set that differs only in the mutated dimension, as the paired control.
- Zero-mutation recorders on provider, git, and state.

**Steps**:

1. For each invalid variant, run `verify gates` and assert a classified configuration failure: exit 1, a declared configuration/validation code from the existing table (no new `merge.*` row for config errors), the offending field or entry named, and the remediation hint.
2. Repeat with `merge` (and with `merge --dry-run`) and assert the same classified failure, exit 1, zero provider reads, zero state appends, zero git mutations, base HEAD unchanged.
3. Assert the effective gate set is never silently reduced: the report names the missing built-in or the unsupported version rather than evaluating a smaller set.
4. For the reserved-id override variant, assert the failure names `ci-green` and explains that built-in entries must keep their shipped recipe and surface (fail-closed reading, GAP-9); a mutation control that makes the same declaration valid flips the outcome.
5. Restored control: the paired valid declaration resolves, evaluates, and cites all declared entries.

**Expected Outcome**:

- Omission of a built-in, an unsupported version, a reserved-id override, or a malformed entry is a classified configuration failure with no evaluation and no mutation; the effective set is never silently reduced. AC-F1-2 holds in both directions.

#### TC-MERGE-004 - Surface applicability split: battery vs merge vs both, with the shipped battery set unchanged

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, DEC-2, DM-4, AC-F1-1
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/merge-contract.test.ts`, `tests/behaviour/merge-gate-set.test.ts`, `tests/fixtures/merge/gate-sets/applicability/**`
**Tags**: @backend

**Preconditions**:

- Declared set containing a `battery`-only gate `docs-links`, a `merge`-only gate `tracker-freshness` (default), and a `both` gate `workspace-tests`.
- Facts where `docs-links` fails and everything else passes; and the inverse.

**Steps**:

1. Assert the battery surface evaluates exactly the `battery` and `both` entries in declared order and never a `merge`-only entry.
2. Assert the merge surface evaluates exactly the `merge` and `both` entries and never a `battery`-only entry; a failing `battery`-only gate does not refuse a merge (documented consequence), while the same failure refuses `verify gates`.
3. Assert the default declaration (absent `merge.gates`) yields exactly the shipped five battery entries in shipped order plus `tracker-freshness` on the merge surface.
4. Assert `tracker-freshness` never appears in `verify gates` data or human output (default and declared sets).
5. Mutation control: move `tracker-freshness` to surface `both` in a temp copy and assert it now appears on the battery surface, proving the dimension is read from data.

**Expected Outcome**:

- Applicability is a declared dimension with both directions exercised; the default battery set is exactly the shipped five; the merge-only freshness entry never leaks into the shipped surface.

#### TC-MERGE-005 - Verification record appended by every full battery evaluation (EVT-1/DM-1)

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, EVT-1, DM-1, DEC-1, NFR-7
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-verification-record.test.ts`, `tests/fixtures/state/harness.ts`
**Tags**: @backend @state

**Preconditions**:

- Temp state root from the state harness; injected clock `2026-11-06T12:00:00Z`; fixed head SHA `9f21c0e`; declared gate-set identity.
- A passing battery run and a `merge --dry-run` run over the same facts.

**Steps**:

1. Run `verify gates` and assert exactly one record appended with schema `delivery.merge.gate-verification.v1`, carrying ref, head SHA, verification time equal to the injected clock, the declared gate-set identity (schema version plus entry ids), per-gate verdicts with bounded citations, and the observed tracker posture snapshot.
2. Assert the append is fenced and verified post-append (the store reports one fence acquire/release and a post-append read that matches the appended bytes).
3. Assert no other record kind, derived document, or audit-adjacent field changed; the prior ledger bytes are an exact prefix of the new bytes.
4. Run a second identical evaluation and assert a second record is appended (append-only history) and that the newest record is the one a consumer reads.
5. Run `merge --dry-run` and assert exactly one further record with the same shape (DEC-1).
6. Assert the record contains no title, body, comment, raw payload, or credential (cross-check with TC-MERGE-034).

**Expected Outcome**:

- Every full declared-battery evaluation appends exactly one fenced, verified verification record with the declared payload; history is append-only; dry-run records too. This is the age source the freshness envelope consumes.

#### TC-MERGE-006 - Verification-record append failure classified; never consumable as fresh

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-4, EVT-1, NFR-7, RSK-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-verification-record.test.ts`, state harness edge faults
**Tags**: @backend @state @negative

**Preconditions**:

- Injected state faults in turn: fence contention, permission denial, append write failure, post-append verification mismatch.
- A recorded instruction not to consume a partially written record.

**Steps**:

1. For each fault, run `verify gates` and assert a classified state failure (an existing `state.*` identity, exit 2, consequence reported), **not** a gate verdict change and not a silent success.
2. Assert the gate verdict bytes that were computed are untouched by the append failure (the failure is the invocation's outcome; RSK-2's "classified, not a verdict change" holds for any success path).
3. Assert no consumable verification record exists afterwards (verified-empty read) and that a subsequent `merge` returns `merge.state-unverified` at exit 2 rather than treating anything as fresh.
4. Assert zero landing mutations and zero transaction records.
5. Restored control: with the fault cleared, the same run appends one record and a later merge consumes it.

**Expected Outcome**:

- A failed append is classified, leaves no consumable evidence, and a later merge refuses state-unverified. AC-F2-4 is asserted through the consumer, not only the writer.

#### TC-MERGE-007 - Freshness envelope satisfied: within bound, same head, same gate set

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, DEC-3, NFR-5, AC-F2-1 (control)
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-freshness.test.ts`, `tests/fixtures/merge/verification-records/fresh/**`
**Tags**: @backend

**Preconditions**:

- Verification record 4 minutes old, head SHA equal to current head, gate-set identity equal to the effective set.
- Facts: tracker posture unchanged and all check-runs green; full happy-path runtime.

**Steps**:

1. Run `merge` and assert no `merge.gates-stale` and no `merge.state-unverified`; the transaction proceeds to the probe and lands.
2. Assert exactly one verification read (count from the state recorder) and zero re-evaluation of the full battery (provider-read counts stay within the probe budget of TC-MERGE-032).
3. Assert the refusal identities from TC-MERGE-008/010/011 do not appear on any stream.
4. Assert the durable success delta (one squash commit, branch gone, request merged) — enough to prove the envelope did not block; full landing detail is TC-MERGE-024.

**Expected Outcome**:

- A fresh, correctly bound verification passes the envelope and the transaction continues; this is the paired control for every envelope negative.

#### TC-MERGE-008 - Freshness refusal: age exceeds bound with age/bound/new-red-job inline (SC-M1-02)

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-1, AC-F2-2, EVT-1, DM-1, SC-M1-02, NFR-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-freshness.test.ts`, `tests/fixtures/merge/verification-records/stale/**`
**Tags**: @backend @negative

**Preconditions**:

- Verification record 31 minutes old against the default 30-minute bound; head SHA unchanged; gate-set identity unchanged.
- Probe facts: one new failing check-run `CI / test (18)` (fixture job id `44832`) on the head SHA that the recorded verification did not observe.
- Recorded git adapter and guarded state store.

**Steps**:

1. Run `merge GH-302` in text mode and assert `result=refused`, exit 1, and the failed condition named.
2. Assert the classified identity is `merge.gates-stale` (the envelope violation is primary when the age is out of bound, GAP-6) and that the evidence inline carries the verification age (31 m), the bound (30 m), and the new red job id, plus the head SHA.
3. Assert the remediation hint names re-running `verify gates`.
4. Assert the durable delta: base HEAD unchanged, commit count unchanged, branch present, request state unchanged, zero transaction and waiver records, zero git mutation operations (rebase, squash, deletion all zero).
5. Repeat in scripted mode and assert the error envelope shape of TC-MERGE-013 carries the same evidence.
6. Assert exactly one audit record with exit 1.

**Expected Outcome**:

- A verification older than the bound refuses at exit 1 with the age, the bound, and the new red job inline and a re-run remediation, changing nothing. SC-M1-02's assertions are reproduced exactly (its "either code" allowance is narrowed by the GAP-6 precedence rule, which the plan pins).

#### TC-MERGE-009 - Freshness boundary: at-bound is stale, one millisecond under is fresh

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-1, NFR-5, DEC-3
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-freshness.test.ts`, `tests/fixtures/merge/verification-records/boundary/**`
**Tags**: @backend @boundary

**Preconditions**:

- Records at exactly the bound (30 m), at bound − 1 ms, and at bound + 1 ms; identical head and set; otherwise identical facts.
- Comparator read from contract data, not hard-coded.

**Steps**:

1. Assert the record at exactly the bound is refused (`merge.gates-stale`, exit 1) — the boundary belongs to refusal.
2. Assert the record at bound − 1 ms passes the envelope and proceeds; assert the record at bound + 1 ms refuses.
3. Assert the evidence renders the declared bound value (not a literal copied into the test).
4. Mutation control: flip the comparator in a temp contract copy and assert the at-bound case changes outcome, proving the test reads the declared comparator.
5. Assert a clock jump of +1 h makes a previously fresh record stale with no other change.

**Expected Outcome**:

- At-bound is stale in both directions of the boundary, and the comparator is contract data proven live by mutation.

#### TC-MERGE-010 - Freshness voiding bindings: head SHA mismatch and gate-set identity mismatch

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-1, AC-F7-2, DM-1, DM-4, RSK-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-freshness.test.ts`, `tests/fixtures/merge/verification-records/{sha-mismatch,set-mismatch}/**`
**Tags**: @backend @negative

**Preconditions**:

- Case A: fresh record bound to head `9f21c0e`; current head `a1b2c3d` (no rebase in this case).
- Case B: fresh record bound to set identity `v1:[lifecycle-finalization,ci-green,push-parity,owner-gate,squash-preflight,tracker-freshness]`; effective set adds `workspace-tests` (all gates passing).
- Control: identical SHA and set.

**Steps**:

1. Case A: assert `merge.gates-stale`, exit 1, evidence carrying both SHAs (recorded and current) and the remediation to re-run verify gates on the current head.
2. Case B: assert `merge.gates-stale`, exit 1, evidence naming the set delta (added/removed entry ids) and the remediation.
3. Assert both cases leave the durable state untouched (zero mutations, zero transaction/waiver records) and write one audit record each.
4. Assert the control passes and lands.
5. Mutation control: change only the recorded set identity in a temp copy and assert the mismatch appears; change only the SHA and assert the SHA reason appears (the two voiding reasons are distinguishable in evidence).

**Expected Outcome**:

- A verification is valid only for the head and the gate set it was recorded against; either mismatch refuses with the voiding reason inline, and a declared-set edit voids prior verifications even when every gate passes.

#### TC-MERGE-011 - State-unverified: absent, torn, unreadable, and schema-incompatible verification state (exit 2)

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-3, AC-F2-2, DEC-8, DEC-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-freshness.test.ts`, state harness (absent, torn, permission, version fixtures)
**Tags**: @backend @state @negative

**Preconditions**:

- Variants: (a) verified-empty store (no record for the ref); (b) torn ledger; (c) unreadable ledger (permission denied); (d) schema-incompatible record version; (e) record present but for a different ref.
- Control: one valid record for the ref.

**Steps**:

1. For each variant, run `merge` and assert exit 2 with `merge.state-unverified`, platform category, and a remediation hint that names producing a verification (`verify gates`).
2. Assert the outcome is **not** a stale-style exit-1 refusal and **not** a silent pass: the text mode does not print `result=merged`, and no landing mutation occurs.
3. Assert the evidence names which condition held (absent vs unreadable/torn vs incompatible) without serving unverified bytes as truth.
4. Assert zero transaction/waiver records and one audit record with exit 2.
5. Control: with the valid record the envelope passes; and the stale case of TC-MERGE-008 remains exit 1, proving the exit-2 split is not over-applied.

**Expected Outcome**:

- Missing or unreadable verification state is state-unverified at exit 2 with no mutation and no silent pass; stale-but-readable remains an exit-1 refusal. DEC-8 is asserted in both directions.

#### TC-MERGE-012 - Text refusal surface: named gate/condition, inline evidence, remediation, continuity keys

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-2, DEC-4, SC-M1-02, SC-M1-03
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-refusal-surface.test.ts`
**Tags**: @backend @ui

**Preconditions**:

- One fixture per refusal family: `merge.gates-stale`, `merge.gate.<gate-id>.failed` (built-in and repo-declared id), `merge.gate.tracker-freshness.failed`, `merge.waiver-unauthorized`, `merge.owner-gate-override-without-waiver`, `merge.rebase-conflict`, `merge.transaction-aborted`, `merge.state-unverified`.
- A success fixture for the continuity keys.

**Steps**:

1. For each refusal fixture, assert text mode prints `result=refused`, names the failed gate or condition, prints the evidence inline, and prints a remediation hint; assert exit 1 (or 2 for state-unverified) and never exit 0.
2. Assert the success fixture prints `result=merged` and `squash=` with the squash SHA, and that `squash=` is absent from every refusal.
3. Assert the diagnostics stream carries the full per-gate citations while stdout stays within the human bounds (cross-ref TC-MERGE-033); assert no refusal path prints a bare `result=refused` with no named condition.
4. Assert every refusal is classified: the run's envelope error object exists and its code is the expected row.
5. Mutation control: remove the gate name from a temp copy of the message builder and assert the case fails by name, proving the assertion is not matching a constant.

**Expected Outcome**:

- Every refusal names its condition, carries inline evidence and a remediation hint, keeps the continuity keys, and never exits 0. The success path keeps `result=`/`squash=` in the delivered key shape.

#### TC-MERGE-013 - Scripted refusal surface: `error` + `runId`, no `data`, agent-mode trim

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-2, DEC-4, Appendix A, NFR-8
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-refusal-surface.test.ts`, `tests/golden/helpers.ts`
**Tags**: @backend @envelope

**Preconditions**:

- Scripted (non-TTY) mode and agent-mode environment as used by the audit/trim suite.
- One stale refusal and one gate-failure refusal.

**Steps**:

1. Assert the scripted envelope parses, validates with `assertEnvelopeContract`, and contains `error` with `code`/`category`/`retryable`/`consequence`/`remediationHint`; assert `data` is absent.
2. Assert `runId` is present on the error line (the agent-mode trim keeps it) and that `schemaVersion` and `timing` are trimmed in agent mode, matching the delivered trim contract.
3. Assert the line is a single minified JSON object (no embedded newlines) and that it contains no `data` key at any depth.
4. Negative assertion against the pack spelling: assert the refusal is **not** rendered as `{"data":{"result":"refused"}}` — this is the recorded Appendix A refinement, and a regression to the pack shape must fail here.
5. Assert text mode still prints `result=refused` while scripted mode carries the verdict semantics in the classified error (no prose-as-identity: the machine identity is the code).

**Expected Outcome**:

- Scripted refusals use the shipped failure envelope with `runId`, no `data`, trimmed in agent mode, and the pack's `data`-shaped refusal is explicitly rejected. AC-F2-2's machine-mode half holds without inventing a second wire shape.

#### TC-MERGE-014 - Exit projection and error-table parity for the 8 merge rows and 3 deploy rows

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-2, AC-F2-3, NFR-8, DEC-7
**Test Type(s)**: Structure, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts`, `scripts/checks/error-table-sync.ts`, `tests/fixtures/result/code-corpora`
**Tags**: @backend @contract

**Preconditions**:

- The documented table (`doc/spec/features/feature-result-contract.md`) and the machine table (`ERROR_TABLE`) are the two oracles.
- A temp copy harness for mutation controls (the live tree is never written).

**Steps**:

1. Assert the machine table gains exactly eight `merge.*` rows and three `verify.deploy.*` rows: the family row `merge.gate.<gate-id>.failed`, `merge.gates-stale`, `merge.waiver-unauthorized`, `merge.owner-gate-override-without-waiver`, `merge.rebase-conflict`, `merge.state-unverified`, `merge.landing-unverified`, `merge.transaction-aborted`; `verify.deploy.trace-missing`, `verify.deploy.status-stale`, `verify.deploy.trace-failed`.
2. Assert each row appears in the documented table in the same change and that `DOMAIN_KINDS` grows by exactly one (`merge`) with no code reused as a `failureClass`.
3. Assert the declared exit projection per row: stale/waiver-unauthorized/override-without-waiver/rebase-conflict/transaction-aborted/gate-family/trace-missing/status-stale/trace-failed → 1; state-unverified → 2; landing-unverified → 2 (GAP-10 pin); `success` → 0.
4. Assert the family row validates its slot against the effective declared gate set: each built-in id, `tracker-freshness`, and a repo-declared id resolve to the family row; empty, malformed, and undeclared ids are rejected (GAP-13).
5. Assert the documented/machine sync check is green in both directions, and run mutation controls in a temp copy: an undocumented code, a documented-but-undeclared code, a widened family pattern, and a mismatched projection each fail by name.
6. Assert no row is emitted on a path that would contradict its category (for example, no `merge.*` row carries the `success` projection class).

**Expected Outcome**:

- Eleven new identities are documented and declared together, project the pinned exits, and the family slot is validated against the effective registry without pattern widening. NFR-8 holds with mutation controls proving the sync is not vacuous.

#### TC-MERGE-015 - Post-verification tracker transition caught with transition and age (SC-M1-03)

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-1, F-3, SC-M1-03
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-probe.test.ts`, `tests/fixtures/merge/probes/tracker-flip/**`
**Tags**: @backend @negative

**Preconditions**:

- Verification record 2 minutes old whose tracker posture snapshot records "review, no owner-attention labels".
- Probe facts: the same work item now carries an owner-attention label (`hand-back`), timestamped 1 minute after the verification time.
- Recorded provider readers and a guarded state store.

**Steps**:

1. Run `merge` and assert exit 1 with `merge.gate.tracker-freshness.failed`.
2. Assert the evidence names the transition (observed posture before → now) and the transition's age relative to the verification time; assert the owner-gate scan labels are cited inline (the refusal cites the scan, not only the label).
3. Assert the remediation hint names re-running verify gates (and, where applicable, the owner-gate path).
4. Assert exactly one work-item read for the probe and no re-probe loop; assert zero git mutations, zero transaction/waiver records, base HEAD unchanged, request state unchanged.
5. Restored control: identical facts with unchanged posture pass the gate and the merge lands.
6. Negative control: an owner-attention label present at verification time is not a *transition*; assert the refusal reason differs (the recorded verification would already have failed the gate) and that no transition-age evidence is fabricated.

**Expected Outcome**:

- A tracker flip after verification is caught by the probe and refused with the transition and its age plus the cited scan, two minutes after a valid verification. SC-M1-03 is reproduced exactly.

#### TC-MERGE-016 - Post-verification CI regression caught on the head SHA

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F3-1, F-3, RSK-1, AC-F2-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-probe.test.ts`, `tests/fixtures/merge/probes/ci-regression/**`
**Tags**: @backend @negative

**Preconditions**:

- Fresh verification (2 m) whose citations record all head check-runs green.
- Probe facts: the bounded check-run page now shows job `CI / test (18)` failed on the same head SHA.
- Variants: the red job was already recorded as red at verification (so no valid passing verification could exist — modelled as a gate-level fail at verify time), and a red job on a different SHA.

**Steps**:

1. Assert the fresh case refuses with `merge.gate.ci-green.failed`, exit 1, the new job id inline, and the remediation hint.
2. Assert the durable delta is unchanged (no mutation, no records) and exactly one check-run page read was made.
3. Assert a red job on a different SHA than the recorded head does not produce a head-SHA refusal (it is not head evidence) and the merge proceeds on the unchanged head.
4. Assert that when the same red job appears with a stale verification, the identity is `merge.gates-stale` with the red job as additional evidence (GAP-6 precedence), not the gate row.
5. Restored control: all-green page on the head passes the gate.

**Expected Outcome**:

- A CI regression on the verified head is caught as a gate refusal with the job id inline, and the gates-stale/gate-failed precedence is asserted both ways.

#### TC-MERGE-017 - Owner-gate classification readable from declared policy and authoritative at merge

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F4-1, F-4, DM-5, DEC-11, RSK-6
**Test Type(s)**: Structure, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-classification.test.ts`, `tests/structure/merge-contract.test.ts`, `tests/fixtures/merge/policy/**`
**Tags**: @backend @contract

**Preconditions**:

- The GH-229 policy module (kind/class map plus the new per-class authorization policy) is injected as data.
- Temp deep copies for mutation controls.

**Steps**:

1. Assert the classification is readable as data: resolving `owner-review` yields class `owner-review`, `neverMerge: true`, and owner-authored authorization; resolving `waiver` yields its class and defaultability; no evaluation logic is needed to read it (data-only module assertion).
2. Assert merge consumes this map rather than a fork: a structure assertion that the merge-time authorization reads the same exported policy object (import identity), and that no duplicate kind/class literal exists in the merge modules.
3. Behaviour: an override on a never-merge gate with a non-owner principal refuses; with the owner principal it passes (full detail in TC-MERGE-018/019).
4. Mutation control: in a temp copy, make `owner-review` authorizable by any principal and assert the observed outcome flips to a pass; restore and assert the refusal returns. A second mutation removes the class binding and asserts a classified failure, never a default.
5. Assert the vocabulary (`owner-review`, `waiver`) and the map content are consumed unchanged from GH-229 (no added kinds, no changed default).

**Expected Outcome**:

- The classification is readable from declared data without logic inspection and is the authority merge consults, proven live by mutation. AC-F4-1 holds from the refusal path, and GH-229 ownership is not forked.

#### TC-MERGE-018 - Authorized waiver recorded before landing, gate passes, record persists

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-2, F-5, EVT-2, DM-2, DEC-5, NFR-9
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-waivers.test.ts`, `tests/fixtures/merge/waivers/authorized/**`
**Tags**: @backend @state

**Preconditions**:

- Owner-gated change; provider-resolved owner principal `owner-principal` injected.
- Override declaration naming `owner-gate` and that principal (grammar read from the command contract).
- Operation-order recorder covering state appends and git mutations.

**Steps**:

1. Run `merge` and assert the owner-gate passes under the recorded waiver and the transaction lands (exit 0).
2. Assert exactly one waiver record appended with schema `delivery.merge.waiver.v1`, carrying gate id, class, ref, authorizer principal, authorization time equal to the injected clock, and a bounded reason.
3. Assert the ordering: the waiver append index precedes the first git mutation (no landing mutation occurs before the record).
4. Assert the transaction record references the waiver, and that the waiver record still exists after the transaction completes.
5. Variant: same authorized declaration but another gate fails (injected CI red) → the transaction refuses and the waiver record still exists (persists regardless of the final verdict); assert zero landing mutations.
6. Determinism: run the same facts twice and assert the authorization decision and record bytes (modulo append position) are identical (NFR-9).

**Expected Outcome**:

- An authorized override is recorded before any landing mutation, makes the gate pass, is referenced by the transaction, and survives a later refusal. AC-F5-2's record-first ordering is asserted, not assumed.

#### TC-MERGE-019 - Unauthorized or unresolvable authorizer refused; no waiver record; audit captures the attempt

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-1, F-5, DM-5, DEC-5, RSK-4
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-waivers.test.ts`, `tests/fixtures/merge/waivers/{unauthorized,unresolvable,non-waivable}/**`
**Tags**: @backend @security @negative

**Preconditions**:

- Variants: (a) declaration by principal `someone-else` against a never-merge gate owned by `owner-principal`; (b) owner principal unresolvable (provider identity read returns empty/not-found); (c) declaration against a gate with no waivable class (for example `ci-green`).
- Guarded store and audit recorder.

**Steps**:

1. For each variant, run `merge` and assert exit 1 with `merge.waiver-unauthorized`, naming the gate, the class (or the absence of a waivable class), and the authorizer reference.
2. Assert **no** waiver record exists afterwards (verified-empty read) and zero landing mutations; base HEAD and request state unchanged.
3. Assert the audit ledger contains exactly one invocation record for the attempt with exit 1 and the declared override metadata redacted as required — the attempt is durable even though the waiver is not.
4. Assert fail-closed for the unresolvable case: the refusal is the same class, never a default/silent authorization; assert a fixture where the identity read throws is also fail-closed.
5. Assert the principal is rendered as an identity reference (no credential material, no raw provider payload).
6. Restored control: the authorized principal passes (TC-MERGE-018) through the same declaration grammar.

**Expected Outcome**:

- An unauthorized, unresolvable, or non-waivable override is refused with no waiver record and no mutation, while the audit trail captures the attempt. AC-F5-1 holds; the security boundary of §21 is asserted directly.

#### TC-MERGE-020 - Board consumes recorded waivers: waiver-kind mapping and real `waivedBy` (GAP-9 flip)

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F4-1, F-4, DEC-11, RSK-6, GH-229 GAP-9
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/board-waiver-recording.test.ts`, board fixtures + temp state root
**Tags**: @backend @state

**Preconditions**:

- A temp state store containing one authorized waiver record for gate X (produced through the merge path or the declared recording seam) and no waiver for gate Y.
- Board runtime with injected collector facts for X and Y.

**Steps**:

1. Run `board --json` and assert gate X is collected as kind `waiver` with `waivedBy` equal to the recorded authorizer principal, and gate Y remains kind `owner-review` with `waivedBy: null` (no synthesis).
2. Assert the board payload schema is unchanged (same keys, same schema version) — the flip is a data population, not a shape change.
3. Assert an unwaived never-merge gate still escalates per the SLA thresholds (GH-229 posture unchanged) and that a waiver record never authorizes a merge by itself.
4. Assert determinism and that no additional record kind is required.
5. Mutation control: remove the waiver record from a temp store and assert `waivedBy` returns to `null`, proving the render is data-driven.

**Expected Outcome**:

- Recorded waivers populate the waiver-kind mapping and `waivedBy` against real data for the first time, with the schema and the unwaived escalation posture unchanged. The GAP-9 seam is closed and tested from the consumer side.

#### TC-MERGE-021 - Owner-gate failure with no override declaration refuses `merge.owner-gate-override-without-waiver`

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-2, F-5, DEC-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-waivers.test.ts`, `tests/fixtures/merge/waivers/no-declaration/**`
**Tags**: @backend @negative

**Preconditions**:

- Owner-gated change; no override declaration on the invocation.
- Owner principal resolvable (proving the refusal is about the missing declaration, not authorization).

**Steps**:

1. Assert exit 1 with `merge.owner-gate-override-without-waiver`, naming the gate and the override path (how to declare one), with a remediation hint.
2. Assert no waiver record, no transaction record, zero mutations, base HEAD and request state unchanged.
3. Assert the refusal is distinguishable from `merge.waiver-unauthorized` (different code, different remediation) and that neither is emitted in the other's place.
4. Control: add the authorized declaration through the same grammar and assert the outcome becomes a landing (TC-MERGE-018), proving the refusal is the missing declaration.

**Expected Outcome**:

- An owner-gate failure without an override is its own classified refusal with the override path named; adding an authorized declaration changes the outcome. The two waiver identities are mutually exclusive and correct.

#### TC-MERGE-022 - Rebase conflict: classified refusal naming paths, exactly one attempt, no force path

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F7-1, F-7, DEC-6, RSK-5, GAP-14
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-rebase.test.ts`, real temp git repositories (`tests/fixtures/commit/harness.ts` pattern)
**Tags**: @backend @git @negative

**Preconditions**:

- Temp repo where the request branch is behind base and the rebase produces a conflict in two known paths (for example `packages/core/src/a.ts`, `packages/core/src/b.ts`).
- Git adapter recorder counting operations; request-detail facts showing behind-base.
- A source scan for force constructs and a mutation-control fixture that uses one.

**Steps**:

1. Run `merge` and assert exit 1 with `merge.rebase-conflict`, naming both conflicting paths inline (and the declared `+N` mark when over the cap).
2. Assert exactly one refresh attempt in the invocation (recorder count == 1) and that a second refresh is never attempted in the same invocation.
3. Assert no force operation occurred: the git recorder shows no force variant, and the repository state shows no rewritten history beyond the aborted refresh; the operation union has no force member (structure assertion) and the source scan finds no force construct in the merge modules.
4. Mutation control: a fixture that performs a force push/rebase must be detected by the scan (failing control), proving the no-force assertion is live rather than a constant.
5. Assert base HEAD unchanged, zero squash commits, branch present, no branch deletion, request state unchanged; one audit record with exit 1.
6. Assert a fresh invocation after the conflict makes exactly one new attempt (per-invocation rule), i.e. the refusal is retryable after the conflict is resolved.

**Expected Outcome**:

- A conflicting refresh is a classified refusal naming paths with exactly one attempt and no force path in the vocabulary. AC-F7-1 and the structural half of §21 are asserted together.

#### TC-MERGE-023 - Successful refresh voids the SHA binding and refuses `merge.gates-stale` (old→new SHA)

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F7-2, AC-F2-1, F-7, F-2, DEC-6
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-rebase.test.ts`, temp git repo + verification fixtures
**Tags**: @backend @git

**Preconditions**:

- Temp repo where the request is behind base and the rebase succeeds cleanly, changing head from `9f21c0e` to `a1b2c3d`.
- A fresh verification record bound to `9f21c0e` (within bound, same set).

**Steps**:

1. Run `merge` and assert exactly one refresh attempt occurred and the head changed as expected.
2. Assert exit 1 with `merge.gates-stale` whose evidence names the old and new SHAs and the remediation to re-run verify gates on the rebased head.
3. Assert no squash landing and no branch deletion; the verification record still bound to the old SHA and not consumed as fresh for the new head.
4. Control: after running `verify gates` on the new head (fresh record), `merge` lands — proving the earlier refusal was the SHA binding, not a dead end.
5. Assert the refresh attempt and its outcome appear in the transaction evidence even though the transaction did not land (and that no transaction record with a `merged` result exists).

**Expected Outcome**:

- A successful refresh is recorded progress that voids the SHA-bound verification and refuses with the old→new transition. AC-F7-2 is asserted, and the remediation loop (re-verify then merge) is proven to work.

#### TC-MERGE-024 - Squash landing verified with post-landing steps declared (SC-M1-01)

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F8-1, F-8, EVT-3, DM-3, SC-M1-01
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-landing.test.ts`, real temp git repo + provider fakes
**Tags**: @backend @git @api

**Preconditions**:

- Temp repo with base at `oldBase`; request branch containing three commits; a fresh verification and a clean probe (no behind-base, no waiver).
- Provider facts: request state `open` before, `merged` after the mutation; branch deletion available.

**Steps**:

1. Run `merge GH-301` and assert exit 0, `data.result == "merged"`, a squash SHA present, and text `result=merged` with `squash=` and the squash SHA.
2. Assert the base branch advanced by exactly one commit: new base HEAD's parent equals `oldBase`, commit count increased by exactly one, and the commit is a single-parent squash whose tree equals the request branch head's tree.
3. Assert the landing is verified: the squash SHA is reachable from base, and the request state read after the mutation is `merged`.
4. Assert post-landing steps are declared with per-step status in the output and in the transaction record: branch deletion performed (branch ref absent after), closeout-ready state recorded.
5. Assert exactly one transaction record with schema `delivery.merge.transaction.v1`, result, squash SHA, landing evidence, zero refresh attempts, the waiver reference list (empty), and post-landing statuses.
6. Assert exactly one audit record and one verification read; assert no second landing path fired.

**Expected Outcome**:

- The full seed scenario lands as one verified squash commit with branch deletion and closeout-ready recorded, and the durable evidence matches the output. SC-M1-01's four assertions (HEAD +1, PR merged, `data.result`, exit 0) are reproduced exactly.

#### TC-MERGE-025 - Unverifiable landing is `merge.landing-unverified` with consequence `unknown`

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, EVT-3, DEC-7, RSK-1, GAP-10
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-landing.test.ts`, temp git repo + provider fault injection
**Tags**: @backend @git @negative

**Preconditions**:

- Variants: (a) the squash fired but the base containment read fails; (b) the squash fired but the request state read still reports `open`; (c) the squash SHA is not reachable from base after the mutation.
- A clean-landing control.

**Steps**:

1. For each variant, assert exit 2 with `merge.landing-unverified`, consequence `unknown`, and a remediation hint that warns against blind re-merge.
2. Assert the outcome is never `merged` and never exit 0; assert the transaction record (if written) records consequence `unknown`, the squash SHA if known, and the landing evidence that could be observed.
3. Assert no branch deletion is claimed as performed when the landing is unverified, and that no second landing fires.
4. Assert a re-run re-verifies the landing and converges: if the SHA is later observable on base, the re-run replays `merged` (exit 0) without a second landing; if not, it stays unverified.
5. Control: the clean-landing fixture reports exit 0 with the same probe/verification facts.

**Expected Outcome**:

- A fired-but-unverifiable landing is an honest first-class `unknown` at exit 2, never a false success, and the re-run converges by re-verification rather than re-landing. The ambiguity of the exit projection is recorded as GAP-10.

#### TC-MERGE-026 - Clean pre-mutation abort is `merge.transaction-aborted` and converges on re-run

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, EVT-3, DEC-12, NFR-7, GAP-11
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-convergence.test.ts`, temp git repo + state fence faults
**Tags**: @backend @state @negative

**Preconditions**:

- Injected faults after evaluation but before the first mutation in turn: state fence acquisition failure, git operation refusal, audit reservation failure.
- Zero-mutation recorder and a clean-path control.

**Steps**:

1. For each fault, assert exit 1 with `merge.transaction-aborted`, `retryable: true`, `consequence: not_landed`, and a remediation hint.
2. Assert nothing landed: base HEAD unchanged, commit count unchanged, branch present, request state unchanged, zero transaction/waiver records, zero successful mutation operations.
3. Assert the failure is classified as a state/operation failure and not reported as `merged` or `landing-unverified`.
4. Re-run with the fault cleared and assert the merge lands exactly once (convergence), with exactly one transaction record.
5. Assert the aborted invocation left an audit record with exit 1.

**Expected Outcome**:

- A pre-mutation abort is a clean, retryable, classified refusal with nothing landed and a converging re-run. The exit projection is pinned as GAP-11.

#### TC-MERGE-027 - Idempotent replay of a recorded landing: exit 0, same SHA, no second landing

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F8-2, DEC-12, NFR-9, EVT-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-convergence.test.ts`, temp git repo + temp state
**Tags**: @backend @state @idempotency

**Preconditions**:

- A completed merge from TC-MERGE-024 (or an equivalent seeded transaction record + base containment).
- A recorder that fails the test on any git mutation.

**Steps**:

1. Re-run `merge` and assert exit 0, `data.result == "merged"`, and the same squash SHA as the recorded verdict.
2. Assert zero git mutations (no rebase, squash, deletion, or history write) and zero new transaction records (idempotent by change).
3. Assert no request mutation and that the recorded closeout-ready state is preserved.
4. Assert a second audit record exists with a new `runId` (the re-run is a new invocation even though the verdict replays).
5. Negative control: a transaction record whose SHA is no longer contained on base → not a replay; assert `merge.landing-unverified` (consequence `unknown`), never a second landing.
6. Assert the replay does not require a fresh verification record (the recorded landing is the evidence) and that no state-unverified is emitted.

**Expected Outcome**:

- A re-run over a recorded, contained landing replays the verdict byte-identically with no mutation and no duplicate record. AC-F8-2's "no second landing" is asserted at the git level, not only in the envelope.

#### TC-MERGE-028 - `--dry-run` evaluates, records the verification, and lands nothing

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-8, EVT-1, DEC-1, GAP-5, GAP-12
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-dry-run.test.ts`, temp git repo + temp state
**Tags**: @backend @state

**Preconditions**:

- Full merge-applicable gate facts, one passing and one failing battery variant.
- A recorder that fails on any git mutation; temp state root.

**Steps**:

1. Passing variant: run `merge <ref> --dry-run` and assert exit 0, exactly one verification record appended (EVT-1), zero git mutations, zero transaction records, request state unchanged, and that the text does **not** contain `result=merged` or `squash=`.
2. Failing variant (one merge-applicable gate fails): assert exit 1 with the standard gate refusal; still exactly one verification record; still zero mutations.
3. Assert the dry-run's verification record is consumable by a subsequent real `merge` within the bound (the intended operator loop), and that the real merge then lands.
4. With a declared authorized override: assert the authorization is reported but **no waiver record** is appended by the dry run (GAP-12 pin), and that the subsequent real merge records it.
5. Assert exactly one audit record per dry run and no verification record is appended when the invocation fails before evaluation (input validation).

**Expected Outcome**:

- Dry run evaluates the merge-applicable set, records exactly one verification, lands nothing, never claims a merge, and does not record a waiver. The operator loop (dry-run then merge) is proven, and the deliberately unpinned envelope-reporting detail (GAP-5) is not invented.

#### TC-MERGE-029 - Post-landing cleanup failure never flips the landing verdict and is never silent

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F8-1, F-8, EVT-3, NFR-7
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-landing.test.ts`, temp git repo + state append fault
**Tags**: @backend @state

**Preconditions**:

- Variants: (a) branch deletion fails; (b) the closeout-ready append fails; (c) both fail.
- A verified landing control.

**Steps**:

1. Assert the landing verdict remains `merged` at exit 0 (the landing was verified; a cleanup failure does not un-land it).
2. Assert the failure is declared: the output names the failing post-landing step with its status, and the transaction record's post-landing statuses match.
3. Assert the refusal is never silent: no exit 0 with an all-green summary, and no `merge.landing-unverified` (the landing evidence is intact).
4. Assert a re-run does not re-land, keeps the recorded landing, and keeps the cleanup failure declared (no silent repair claim).
5. Control: cleanup succeeds and every post-landing step reports `ok`.

**Expected Outcome**:

- Cleanup failure is declared without flipping a verified landing and without silence. F-8's post-landing discipline is asserted in both directions.

#### TC-MERGE-030 - No daemon merge path; every invocation audited with its claimed identity

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F8-3, NFR-6, §21
**Test Type(s)**: Structure, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-coordinator-boundary.test.ts`, `tests/boundaries/**`, `scripts/checks/workspace-entrypoints.ts`
**Tags**: @backend @security

**Preconditions**:

- Boundary rules and the package import graph; a negative fixture that adds a daemon→merge edge.
- Audit ledger with injected claimed identity present and absent.

**Steps**:

1. Assert no daemon/dispatch module imports or composes the merge transaction's mutation surface (dependency rule plus an import-scan assertion); assert the negative fixture fails the rule (fixture coverage is mandatory).
2. Assert the merge command is the only producer of the squash landing: scan for landing mutation call sites outside the command/transaction composition and assert none exist.
3. Assert a positive control: the CLI merge command does produce the landing mutation.
4. Audit: run a passing merge and a refusal; assert exactly one audit record per invocation with runId, command, redacted args, exit, timing, and the claimed identity when present; assert identity is absent (never inferred) when not supplied.
5. Assert a re-run produces a second record with a new runId and that no secret pattern appears in any record.

**Expected Outcome**:

- The coordinator-only boundary is a failing-fixture-backed invariant, and every merge invocation is durably audited with claimed identity semantics. AC-F8-3 and NFR-6 hold structurally and behaviourally.

#### TC-MERGE-031 - Pure domain core, tier discipline, no new runtime API location

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-1, NFR-6, §16, ADR-0003
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/merge-imports.test.ts`, `tests/boundaries/**`, `scripts/checks/{ambient-globals,workspace-entrypoints}.ts`
**Tags**: @backend @architecture

**Preconditions**:

- Delivered package tiers and the ambient-globals AST guard; the structural inventory.

**Steps**:

1. Assert the new contracts module is data-only and the new domain modules contain no I/O, clock, randomness, environment, filesystem, network, or child-process access (AST assertions with runtime sentinels).
2. Assert domain imports only contracts; adapters/CLI keep their delivered direction; no new runtime-API location, package, or subpath is introduced.
3. Assert the new modules are registered in the inventory/subpath checks and that the boundary fixture coverage is complete (every new rule has a failing fixture).
4. Negative control: a fixture that imports an adapter from the domain fails the rule.

**Expected Outcome**:

- The merge/deploy engine obeys the delivered tier and purity discipline; purity is proven by AST and runtime sentinels, not by convention.

#### TC-MERGE-032 - Read budget: one read per provider source, no retries or pagination

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: NFR-2, F-3, §8.4
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-probe.test.ts`, recorded provider readers
**Tags**: @backend @performance

**Preconditions**:

- Recording readers for the work item, check-run page, request detail, and state; recording git adapter.
- One invocation per scenario: clean landing, tracker refusal, CI refusal, waiver refusal, rebase conflict.

**Steps**:

1. For each scenario, assert the exact read counts: one verification read, one work-item read, one check-run page, one request-detail read, bounded local git reads; zero pagination, zero retries.
2. Assert mutation operations occur only on their declared path (none on refusals; exactly one refresh, one squash, one deletion on their paths).
3. Assert no second probe or re-derivation of the full battery: provider read counts do not grow with the number of gates.
4. Deliberate-second-read control: a fixture that reads twice must fail the count assertion, proving the budget check is live.
5. Assert the refusal path performs no re-read after the decision (the evidence is inline; no caller-side re-probe).

**Expected Outcome**:

- The transaction stays within the declared read budget on success and refusal, with no retries or pagination, and the counters are proven sensitive by a control.

#### TC-MERGE-033 - Output bounds: 65 536-byte machine, 24-line/4 096-byte human, marked truncation

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-4
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-bounds.test.ts`, `tests/fixtures/merge/bounds/**`
**Tags**: @backend @bounds

**Preconditions**:

- Under-cap, at-cap, and over-cap fixtures: many declared gates, long gate ids, long evidence lists, many conflicting paths, many waiver references, multibyte UTF-8 names.
- A fixed run id/clock/brand for byte comparisons.

**Steps**:

1. Assert machine `data` ≤ 65 536 UTF-8 bytes in every success and failure fixture; assert the serialized refusal evidence is included in the bound.
2. Assert the human transaction summary ≤ 24 lines and ≤ 4 096 UTF-8 bytes; assert the under-cap control is unmarked.
3. Assert every drop or clamp is marked: evidence name and path lists carry `+N` (or the declared omitted count), and no unbounded dump path exists (a hostile-length fixture is clamped).
4. Assert truncation never hides the refusal reason or the failing gate id (the decisive evidence is rendered first).
5. Mutation control: lower a declared cap in a temp contract copy and assert the marks appear at the new boundary.

**Expected Outcome**:

- Both output bounds hold with explicit marks, the under-cap control is unmarked, and truncation cannot hide the decisive refusal evidence. NFR-4 is measured, not sampled.

#### TC-MERGE-034 - Privacy: no secrets, payloads, titles, or bodies in any output or record

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: §20, §21, NFR-4
**Test Type(s)**: Integration, Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-privacy.test.ts`, `tests/fixtures/merge/privacy/**`, `tests/checks/secret-read-boundary.test.ts`
**Tags**: @backend @security @privacy

**Preconditions**:

- Canaries `planted-merge-title`, `planted-merge-body`, `planted-merge-comment`, `planted-merge-payload`, `planted-merge-logbody`, `planted-merge-credential` planted in the work-item view, raw provider payload, deploy log body, and credential field.
- A builder assertion that each canary is present in the fixture before the run.

**Steps**:

1. Run success and each refusal path; assert no canary appears in stdout, stderr, the envelope, the verification/waiver/transaction records, the audit record, or the human output.
2. Assert allowed identity fields are present: ref, head SHA, gate ids, refusal reason, principal reference, bounded reason text under its cap.
3. Assert the bounded waiver reason passes the single serialization redaction chokepoint (a planted secret inside the reason is redacted).
4. Assert no new secret-read allowlist entry was added (allowlist count unchanged) and that provider reads go through the delivered port.
5. Mutation control: a fixture that copies the title into the evidence must fail the canary scan, proving the scan reaches the evidence field.

**Expected Outcome**:

- No secret, title, body, comment, raw payload, or log body reaches any surface or record, while identity fields remain. §20's privacy posture is asserted on both success and refusal paths.

#### TC-MERGE-035 - Determinism: byte-identical output, including refusal evidence, under fixed facts

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-determinism.test.ts`, `tests/golden/helpers.ts`
**Tags**: @backend @determinism

**Preconditions**:

- Fixed brand, clock, run id, configuration, provider facts, state, and git outcomes.
- One success and four refusal fixtures.

**Steps**:

1. Run each fixture 20 times and assert identical stdout, stderr, and exit code bytes across runs (success and refusal).
2. Assert permutation invariance: reversing the declared gate order, provider item order, and waiver reference order does not change the rendered bytes where the order is declared normalised; where declaration order is semantic, assert the declared order is used deterministically.
3. Assert a changed-fact control (one gate verdict flipped) produces different bytes, proving the equality is not a constant.
4. Assert TTY-independence: the same facts in TTY and non-TTY modes differ only by the declared mode switch, not by incidental formatting.
5. Assert the run id is the only field that varies when only it is varied (no leakage into evidence).

**Expected Outcome**:

- Identical injected facts produce byte-identical text and machine output, including refusal evidence, and the equality is proven non-constant. NFR-1 holds for the new surfaces.

#### TC-MERGE-036 - Golden: merge success text and machine envelope

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F8-1, NFR-1, SC-M1-01
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/golden/merge.test.ts`, `tests/fixtures/merge/golden/success-{data.json,human.txt}`
**Tags**: @backend @golden

**Preconditions**:

- Fixed facts for the SC-M1-01 landing, fixed run id/clock/brand.
- Committed golden files.

**Steps**:

1. Assert the machine `data` equals the committed `success-data.json` exactly and validates with `assertEnvelopeContract`.
2. Assert the human output equals `human-success.txt` exactly, including per-gate `ok` lines with citations, `result=merged`, and `squash=`.
3. Assert the machine `data` is within the 65 536-byte bound.
4. Mutation control: a deliberately altered golden value fails, and the golden is read-only at test time (the suite never regenerates it).

**Expected Outcome**:

- The merge success surface is pinned byte-for-byte in both modes for the seed landing, with a mutation control proving the golden is compared rather than regenerated.

#### TC-MERGE-037 - Golden: merge refusals in text, scripted, and agent-trimmed forms

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F2-2, NFR-1, SC-M1-02, DEC-4
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/golden/merge.test.ts`, `tests/fixtures/merge/golden/refusal-*`
**Tags**: @backend @golden

**Preconditions**:

- Committed golden pairs for stale, gate-failure, tracker-freshness, waiver-unauthorized, override-without-waiver, and rebase-conflict refusals: `refusal-stale-human.txt` and `refusal-stale-scripted.json`, plus the analogous pair for each of the other five cases.
- Agent-mode environment for the trimmed variant.

**Steps**:

1. Assert each text refusal equals its committed human golden exactly, including `result=refused`, the named condition, evidence, and remediation.
2. Assert each scripted refusal equals its committed scripted golden exactly: one minified line with `error` and `runId`, no `data`, no `schemaVersion`, no `timing`.
3. Assert the agent-trimmed line keeps `runId` and the code and drops the envelope metadata, matching the delivered trim contract "per man-page examples" (the man page's `data` wiring is superseded by DEC-4).
4. Assert the stale refusal evidence golden contains the three pinned evidence facts (age, bound, new red job id) and that the tracker golden contains transition plus age.
5. Mutation control: a changed evidence field in a temp golden fails the comparison.

**Expected Outcome**:

- Every refusal surface is byte-pinned in text, scripted, and agent-trimmed forms, with the Appendix A refinement enforced rather than the pack's illustrative shape.

#### TC-MERGE-038 - Verify-gates non-regression: record append while verdict bytes stay golden-identical

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: RSK-2, §8.5, EVT-1
**Test Type(s)**: Integration, Regression
**Automation Level**: Automated
**Target Layer / Location**: `tests/golden/verify-gates.test.ts` (goldens unchanged), `tests/behaviour/verify-gates-*.test.ts`, `tests/fixtures/verify-gates/cases/harness.ts` (gains a temp state store)
**Tags**: @backend @golden @regression

**Preconditions**:

- The pre-change goldens `tests/fixtures/verify-gates/golden/{success-data.json,human-success.txt,failure-summary.txt,verify-change-human.txt}` remain the oracle and are not regenerated.
- The harness gains a temp state store so the append has a destination.

**Steps**:

1. Run the full shipped verify-gates suite and assert every pre-change golden still matches byte-for-byte (data, human success, failure summary, verify-change human).
2. Assert the only observable delta is one appended verification record per full battery evaluation: read the ledger before/after and assert exactly one new record with the EVT-1 schema; assert no record is appended by `verify change`.
3. Assert ordering, citations, and verdicts are unchanged (structure/contract suite and corpus unchanged).
4. Assert the append failure does not alter the computed verdict bytes (TC-MERGE-006) — the failure is the invocation outcome.
5. Assert `tests/checks/verify-gates-no-live-calls.test.ts` still passes for the updated harness (the state store is not a network path).
6. Mutation control: changing a golden byte fails, proving the pin is live.

**Expected Outcome**:

- `verify gates` gains exactly one fenced append and nothing else observable: verdicts, citations, order, and human bytes are golden-identical. RSK-2's "classified, not a verdict change" and §8.5 are proven, not asserted.

#### TC-MERGE-039 - No live calls on any default merge or deploy path

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-2, NFR-3, testing strategy
**Test Type(s)**: Check, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/merge-deploy-no-live-calls.test.ts`, `tests/fixtures/verify-gates/cases/network-guard.ts`
**Tags**: @backend @security

**Preconditions**:

- The delivered `scanForLiveCalls` and `createNoNetworkGuard` helpers; the list of production modules and default harnesses for merge and deploy.

**Steps**:

1. Assert a static scan of the merge/deploy production modules and the default harnesses returns no live-call construct (fetch, http(s) client, child process that reaches the network).
2. Assert the throwing fetch guard is installed for every behaviour case and that its call counter is zero for all success and refusal fixtures.
3. Assert the guard itself rejects a deliberate call (positive control), so the zero counter is meaningful.
4. Assert the new modules are added to the no-live-calls module list so a future path cannot bypass the scan.
5. Assert the deploy trace read goes through the injected provider port (no direct transport) and that no retry/pagination capability exists on it.

**Expected Outcome**:

- No default path in the new surfaces can make a live call, and the guard is proven live. The testing-strategy default of zero live calls holds for the whole change.

#### TC-DEPLOY-001 - Verified verdict from executed steps and produced artifacts

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F6-1, F-6, DEC-10, NFR-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-deploy-verdicts.test.ts`, `tests/fixtures/verify-deploy/traces/verified/**`
**Tags**: @backend @api

**Preconditions**:

- Trace fixture: job `deploy-44833` with declared steps `build`, `publish`, `smoke` all `succeeded` and the declared artifact (`registry:app@9f21c0e`) present in the trace evidence.
- A declared expectation set derived from the declared expectation source (GAP-3).
- Recorded trace reader.

**Steps**:

1. Run `verify deploy <ref>` and assert exit 0, `data.verdict == "verified"`, and the trace summary carrying jobId, steps with statuses, and artifacts.
2. Assert no `reason` field is present on a verified verdict and that text mode prints `verdict=verified` with the trace summary.
3. Assert exactly one bounded trace read and zero trigger/re-run/schedule operations.
4. Assert the artifact expectation is satisfied by trace evidence, not by a status field: a variant with the artifact absent but the status `success` must not be verified (control for TC-DEPLOY-003).
5. Assert the envelope validates and is within the machine bound.

**Expected Outcome**:

- A complete successful trace with its artifacts yields `verified` at exit 0 with the trace summary; nothing else is accepted as verified evidence.

#### TC-DEPLOY-002 - Created-never-ran pipeline reads unknown, never green (SC-M1-05)

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F6-2, F-6, DEC-10, SC-M1-05, RSK-7
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-deploy-verdicts.test.ts`, `tests/fixtures/verify-deploy/traces/never-ran/**`
**Tags**: @backend @negative

**Preconditions**:

- Trace fixture: pipeline exists (job `deploy-44840`) with zero executed steps and zero artifacts; the job status field is `success` in one variant and `queued` in another.
- Control: the same pipeline with executed steps (TC-DEPLOY-001).

**Steps**:

1. Run `verify deploy GH-305` and assert exit 1 with the classified `verify.deploy.trace-missing` identity (GAP-2 mapping).
2. Assert text mode prints `verdict=unknown` and the reason `pipeline-created-never-ran`, with the trace showing zero steps; assert scripted mode renders the error envelope with `runId`, no `data`, and no `success`/`verified` token anywhere.
3. Assert the verdict is never `verified` and exit is never 0, even when the status field says `success`.
4. Assert exactly one trace read and no retry (an empty trace is not re-read).
5. Assert the evidence shows the zero-step trace (the caller can see why), and that the status field is not cited as evidence.

**Expected Outcome**:

- A created-never-ran pipeline reads unknown at exit 1 with the zero-step trace shown and is never green. SC-M1-05's semantics are preserved; its `data.verdict` spelling is superseded per GAP-4 (recorded, not silent).

#### TC-DEPLOY-003 - Status fields are never evidence: standalone or contradicting status reads `status-stale`; an empty trace never upgrades

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F6-2, F-6, DEC-10, RSK-7
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-deploy-verdicts.test.ts`, `tests/fixtures/verify-deploy/traces/status-stale/**`
**Tags**: @backend @negative

**Preconditions**:

- Variants: (a) green status field with no trace evidence at all; (b) green status with a trace whose `smoke` step failed; (c) red status with a fully green trace; (d) green status with a trace of zero steps — variant (d) is the GAP-2 created-never-ran case, not a status contradiction.
- Controls: green status with a complete green trace (TC-DEPLOY-001) and a red status with a failing trace (TC-DEPLOY-004).

**Steps**:

1. For variants (a)–(c), assert exit 1 with `verify.deploy.status-stale`, `verdict=unknown`, and a reason naming the status/trace contradiction or the absent trace evidence.
2. For variant (d), assert exit 1 with `verify.deploy.trace-missing`, `verdict=unknown`, and reason `pipeline-created-never-ran` (spec v1.1 DEC-10/GAP-2); identity pinning for this fixture is delegated to TC-DEPLOY-002.
3. Assert no variant renders `verified` and none exits 0, regardless of the status colour.
4. Assert the evidence states that the status field is disqualified and names the observed trace state.
5. Assert a status field never overrides a failing trace (variant b) and never upgrades an empty trace to `verified` (variant d); the empty-trace identity remains `pipeline-created-never-ran` at `verify.deploy.trace-missing`, never `status-stale`.
6. Assert exactly one trace read per invocation and no retry to "get a better answer".

**Expected Outcome**:

- Status fields are disqualified in every direction: standalone, contradicting, or empty-trace. A vacuous green cannot be produced through any status path; an empty trace reads created-never-ran at `verify.deploy.trace-missing` (GAP-2), never `status-stale`.

#### TC-DEPLOY-004 - Failed trace reads `failed` with the failing step named

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F6-3, F-6, DEC-10
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-deploy-verdicts.test.ts`, `tests/fixtures/verify-deploy/traces/failed/**`
**Tags**: @backend @negative

**Preconditions**:

- Trace fixture: `build` and `publish` succeeded, `smoke` failed; a partial artifact list.
- Control: the same steps with `smoke` succeeded.

**Steps**:

1. Assert exit 1, `verdict=failed` in text mode, the failing step (`smoke`) named inline, and the classified `verify.deploy.trace-failed` identity in scripted mode.
2. Assert the trace summary reports the observed step statuses and the partial artifacts, without inventing missing ones.
3. Assert the verdict is not `unknown` and not `verified`; assert the failing step is not omitted by truncation.
4. Control: the fully green variant yields `verified` (TC-DEPLOY-001).
5. Assert one trace read, no retry, and one audit record with exit 1.

**Expected Outcome**:

- A failed trace yields `failed` at exit 1 with the step named and the evidence reported honestly; the verdict is disjoint from unknown and verified.

#### TC-DEPLOY-005 - Absent trace evidence reads unknown at exit 1, distinct from a read fault

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F6-2, F-6, DEC-8, GAP-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-deploy-verdicts.test.ts`, `tests/fixtures/verify-deploy/traces/absent/**`
**Tags**: @backend @negative

**Preconditions**:

- Variants: (a) target resolves but the provider returns no trace records at all; (b) target resolves to a deploy job that was never created; (c) no declared deploy expectation exists for the change.
- A read-fault fixture (TC-DEPLOY-006) as the paired disjoint control.

**Steps**:

1. For each variant, assert exit 1 with `verify.deploy.trace-missing`, `verdict=unknown`, and a remediation hint that names how to produce a trace; assert never `verified` and never exit 0.
2. Assert the evidence distinguishes "trace examined, nothing executed" from "no trace located" in its wording while sharing the declared identity (no invented fourth row).
3. Assert the outcome is disjoint from the platform fault: exit 1 vs exit 2, classified rows differ (run the fault fixture in the same test).
4. Assert variant (c) fails closed: with no declared expectation the verdict cannot be `verified`.
5. Assert one bounded resolution read and one bounded trace read at most, no retries.

**Expected Outcome**:

- Absent trace evidence is an honest unknown at exit 1 under the declared identity, fail-closed when expectations are missing, and clearly disjoint from a read fault.

#### TC-DEPLOY-006 - Trace read fault is exit 2 with a platform identity, disjoint from the unknown verdict

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F6-3, DEC-8, GAP-8
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-deploy-verdicts.test.ts`, provider fault fixtures
**Tags**: @backend @negative @platform

**Preconditions**:

- Injected trace-read faults: transport failure, credential missing, provider 5xx, malformed payload.
- The readable-empty control (TC-DEPLOY-005).

**Steps**:

1. For each fault, assert exit 2 with a platform-category classified identity that is a declared row of the existing table (no new `verify.deploy.*` row for a fault).
2. Assert no `verdict` datum is emitted as if evidence had been examined, and that the text mode does not print `verdict=unknown` or `verdict=verified`.
3. Assert the outcome is disjoint from the unknown verdict: exit 2 vs exit 1, and the error class differs.
4. Assert one attempt, zero retries, no pagination, and one audit record with exit 2.
5. Control: the readable-empty fixture still exits 1 with trace-missing.

**Expected Outcome**:

- A failed read is a platform fault at exit 2, never a verdict; the unknown/fault split of DEC-8 is asserted in both directions.

#### TC-DEPLOY-007 - Closed verdict/reason vocabulary, reason→row map, and exit projection

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-8, AC-F6-2, AC-F6-3, DEC-10, GAP-2, GAP-16
**Test Type(s)**: Structure, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/verify-deploy-contract.test.ts`, `tests/structure/inventory.json`
**Tags**: @backend @contract

**Preconditions**:

- The deploy contract is data-only and exports its vocabularies; a deep-copy mutation harness.

**Steps**:

1. Assert the verdict enum is exactly `["verified","unknown","failed"]` and the reason enum is exactly `["pipeline-created-never-ran","status-stale"]` plus the failed-step naming rule; assert no fourth value is representable.
2. Assert the declared reason→row map: `status-stale`→`verify.deploy.status-stale`; failed-step→`verify.deploy.trace-failed`; absent-evidence unknown (including the zero-step instance)→`verify.deploy.trace-missing`; assert every row is reachable and every reason maps to exactly one row (bidirectional check).
3. Assert the exit projection: verified→0, unknown→1, failed→1, read-fault→2 (reusing a declared platform row).
4. Assert the module is data-only and registered in the inventory; assert no prose is used as identity (the machine identity is the code, GAP-16).
5. Mutation controls: add a verdict, rename a reason, map unknown to 0, drop a row mapping, add a `verify.deploy.*` row for a read fault — each fails by name; the unmutated control is green.
6. Assert the three rows are documented in the result-contract feature doc in the same change (cross-ref TC-MERGE-014).

**Expected Outcome**:

- The deploy surface's vocabulary, mapping, and projection are closed contract data with bidirectional completeness, and prose is never the machine identity. The spec's reason/row ambiguity (GAP-2) is resolved as declared data, not ad hoc code.

#### TC-DEPLOY-008 - Deterministic target resolution and one bounded trace read; never triggers a deploy

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: NFR-3, F-6, NG-5, §8.4
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-deploy-read-budget.test.ts`
**Tags**: @backend @performance

**Preconditions**:

- Facts: a change with one deploy workflow and one deploy job; a change with two candidate deploy targets (declared resolution rule); a change with none.
- Recording provider adapter; a recorder that fails on any trigger/re-run/schedule operation.

**Steps**:

1. Assert target resolution is deterministic for identical facts (same target across 10 runs) and that a declared tie/ambiguity rule resolves without heuristic guessing.
2. Assert exactly one bounded trace read per invocation, zero retries, zero pagination, and bounded step/artifact lists.
3. Assert no trigger, re-run, schedule, or cancel operation exists on the adapter surface used by `verify deploy` (structure assertion) and that zero such calls are recorded.
4. Assert a change with no deploy target yields a classified outcome (unknown/refusal) with a remediation hint, never a crash and never exit 0.
5. Deliberate-second-read control: a fixture reading twice must fail the count assertion.

**Expected Outcome**:

- Deploy verification is one read with a deterministic target and no execution capability. NG-5 is asserted as an absent capability, not a promise.

#### TC-DEPLOY-009 - Bounded step/artifact evidence with explicit truncation marks; no log bodies

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: NFR-3, NFR-4, §20
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-deploy-bounds.test.ts`, `tests/fixtures/verify-deploy/bounds/**`
**Tags**: @backend @bounds @privacy

**Preconditions**:

- Under-cap, at-cap, and over-cap step/artifact fixtures, with long job/step/artifact names, multibyte UTF-8, and a step fixture whose raw log body contains a canary.
- Fixed run id/clock/brand.

**Steps**:

1. Assert the step and artifact lists are bounded with explicit truncation marks (`+N` / omitted count) and that the under-cap control is unmarked.
2. Assert machine `data` ≤ 65 536 bytes and the human summary ≤ 24 lines / 4 096 bytes.
3. Assert the decisive evidence (verdict, reason, failing step) is never truncated away.
4. Assert no log body, stdout snippet, or raw payload appears anywhere (the `planted-merge-logbody` canary is absent).
5. Mutation control: lower a declared cap in a temp copy and assert the mark appears at the new boundary.

**Expected Outcome**:

- Step/artifact evidence is bounded and marked, the decisive facts survive truncation, and no log content leaks. NFR-3/NFR-4 and §20 hold on the deploy surface.

#### TC-DEPLOY-010 - Golden: deploy verified/unknown/failed surfaces, trim, and determinism

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F6-1, AC-F6-2, NFR-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/golden/verify-deploy.test.ts`, `tests/fixtures/verify-deploy/golden/**`
**Tags**: @backend @golden

**Preconditions**:

- Fixed facts for verified, created-never-ran, status-stale, failed, and trace-missing fixtures; fixed run id/clock/brand; committed golden files.

**Steps**:

1. Assert the verified machine `data` equals the committed golden and that the human output equals the committed text golden including `verdict=verified` and the trace summary.
2. Assert each negative verdict's scripted output equals its committed golden: one minified line with `error` and `runId`, no `data`, and the declared code.
3. Assert agent-mode trim keeps `runId` and the code, and drops `schemaVersion` and `timing`.
4. Assert 20 repeated runs are byte-identical for every fixture, with a changed-fact control producing different bytes.
5. Mutation control: a changed golden byte fails.

**Expected Outcome**:

- The deploy surface is byte-pinned across every verdict and both modes, deterministic under fixed facts, and consistent with the recorded refusal-shape refinement.

## 6. Environments and Test Data

### 6.1 Environments

| Environment | Requirements | Notes |
|-------------|--------------|-------|
| Local dev (delivery) | Bun pinned by `.bun-version`; pnpm pinned by `packageManager`; git available for temp repos | All suites hermetic; temp git repos are local only |
| CI (GitHub Actions, `ubuntu-latest`) | Frozen-lockfile install; pinned Bun/pnpm; existing `ts-*` jobs | Authoritative for structure, checks, boundary, golden, and aggregate gates |
| Temp git repositories | `mkdtemp` root per case; `git init`; deterministic author/committer name, email, and dates; no remotes configured | Landing, rebase, and convergence assertions only; never the live repo |
| Temp state roots | `mkdtemp` under the OS temp directory (state harness) | Ledgers, torn copies, fence faults, permission faults never touch the live state directory |
| In-process test process | Bun runtime; injected brand, clock, run id, config, provider readers, principal, state, git adapter, audit, streams | No child processes except local git operations inside the temp repo |
| Default CI | No credentials, no live switch, no network | Zero live calls; the throwing `fetch` guard proves it |

### 6.2 Test Data

| Data | Source / shape | Lifecycle |
|------|----------------|-----------|
| Gate sets | `tests/fixtures/merge/gate-sets/{default,custom-workspace-gate,applicability,invalid}/**` (declared sets and expected effective identities) | Read-only; mutation copies in temp roots |
| Verification records | `tests/fixtures/merge/verification-records/{fresh,stale,boundary,sha-mismatch,set-mismatch,torn,absent,schema-v2}/**` | Read-only; materialised into temp state roots |
| Probe facts | `tests/fixtures/merge/probes/{clean,tracker-flip,ci-regression,different-sha-red}/**` (normalized work item + check-run page + request detail) | Read-only |
| Policy and config | `tests/fixtures/merge/policy/**` (classification map and authorization policy), `tests/fixtures/merge/config/**` (freshness bound, declared sets) | Read-only; deep-copy mutation controls |
| Waivers | `tests/fixtures/merge/waivers/{authorized,unauthorized,unresolvable,non-waivable,no-declaration}/**` | Read-only; records produced at test time in temp stores |
| Rebase / landing | `tests/fixtures/merge/git/**` (branch/commit recipes) + programmatic temp repo construction | Created and removed per test |
| Bounds | `tests/fixtures/merge/bounds/{under-cap,at-cap,over-cap,hostile-length,multibyte}/**` | Read-only |
| Privacy | `tests/fixtures/merge/privacy/**` with `planted-merge-*` canaries in title, body, comment, payload, log body, credential | Read-only, synthetic; never real credentials |
| Deploy traces | `tests/fixtures/verify-deploy/traces/{verified,never-ran,status-only,contradicting,failed,absent,fault}/**` | Read-only |
| Deploy bounds | `tests/fixtures/verify-deploy/bounds/**` | Read-only |
| Golden | `tests/fixtures/merge/golden/**`, `tests/fixtures/verify-deploy/golden/**` at fixed run id/clock/brand | Read-only; mutations only in temp copies |
| Existing battery | `tests/fixtures/verify-gates/**` (facts, harness, golden, corpus) | Read-only baseline; harness gains a temp state store, goldens unchanged |
| Error-table corpus | `tests/fixtures/result/code-corpora` plus the merge/deploy additions and family true/false positives | Read-only; drift fails sync |
| Existing suites | `tests/fixtures/{status,queue-ready,commit,state}/**` | Read-only baseline for non-regression |

### 6.3 Isolation Strategy

- Every fixture, temp repo, and state root is created under a fresh `mkdtemp` root and removed afterwards; no test writes the live repository tree, `dist/`, the real local state directory, or the user's home. A clean-tree assertion after the suite is part of the aggregate gate.
- Suites inject brand, paths, clock, run id, configuration, provider facts, principal, state store, git adapter, audit seam, and streams; they never read `$HOME`, the wall clock, the ambient environment where purity is asserted, or the network.
- Temp git repositories configure no remotes, so no push path exists even accidentally; a force construct would be a source-scan failure, not a network event.
- State ledgers are built from verified bytes with the real state harness and mutated by a named operation; a detection-disabled control exposes the planted value, proving the fixture is live.
- Goldens and corpora are read-only at test time; mutation controls run on in-memory values or temp copies, and the unmutated control runs in the same suite.
- The policy map, gate set, and configuration are injected data; mutation controls use deep copies and never touch production contracts.
- The existing goldens/corpora for `verify gates`, `verify change`, and the board are the non-regression oracle and are not regenerated by this change.

## 7. Automation Plan and Implementation Mapping

All TCs are automated. Locations follow the spec's affected-components table and the repository testing strategy; delivery planning may rename helper files but must preserve each TC's behaviour, records, reasons, exits, bounds, assertions, and AC/NFR/SC mapping.

| TC ID | Test file / artefact | Execution command | Control / mutation | Status |
|-------|----------------------|-------------------|--------------------|--------|
| TC-MERGE-001 | `tests/structure/merge-contract.test.ts`, `tests/structure/inventory.json` | `bun test tests/structure/merge-contract.test.ts` | per-datum deep-copy mutations (ids, surfaces, recipes, bound, comparator, version) | To Implement |
| TC-MERGE-002 | `tests/behaviour/merge-gate-set.test.ts` + `tests/fixtures/merge/gate-sets/custom-workspace-gate/**` | `bun test tests/behaviour/merge-gate-set.test.ts` | declared-job pass/fail control; production-source id scan; temp hard-coded-id control | To Implement |
| TC-MERGE-003 | same suite + `gate-sets/invalid/**` | same | each invalid variant + paired valid declaration; zero-read/zero-append assertions | To Implement |
| TC-MERGE-004 | `merge-contract` + `merge-gate-set` + `gate-sets/applicability/**` | corresponding `bun test` | battery-only/merge-only/both matrix; surface mutation flips visibility | To Implement |
| TC-MERGE-005 | `tests/behaviour/merge-verification-record.test.ts` + `tests/fixtures/state/harness.ts` | `bun test tests/behaviour/merge-verification-record.test.ts` | payload key set; prefix property; second-run append; dry-run append | To Implement |
| TC-MERGE-006 | same + state edge faults | same | fence/permission/append/post-verify faults; consumer refusal control | To Implement |
| TC-MERGE-007 | `tests/behaviour/merge-freshness.test.ts` + `verification-records/fresh/**` | `bun test tests/behaviour/merge-freshness.test.ts` | 4 m fresh control against every negative | To Implement |
| TC-MERGE-008 | same + `verification-records/stale/**` | same | 31 m stale with new red job; durable-delta and call-log assertions | To Implement |
| TC-MERGE-009 | same + `verification-records/boundary/**` | same | T−1 ms / T / T+1 ms; comparator mutation; clock jump | To Implement |
| TC-MERGE-010 | same + `verification-records/{sha-mismatch,set-mismatch}/**` | same | single-datum mutations isolate each voiding reason; identical control | To Implement |
| TC-MERGE-011 | same + state harness (absent/torn/permission/version) | same | each state variant + valid-record control + stale-exit-1 contrast | To Implement |
| TC-MERGE-012 | `tests/behaviour/merge-refusal-surface.test.ts` | `bun test tests/behaviour/merge-refusal-surface.test.ts` | one fixture per refusal family; message-builder mutation; success control | To Implement |
| TC-MERGE-013 | same + `tests/golden/helpers.ts` | same | envelope contract; trim assertion; pack-shape negative assertion | To Implement |
| TC-MERGE-014 | `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts`, `scripts/checks/error-table-sync.ts`, `tests/fixtures/result/code-corpora` | `bun run scripts/checks/error-table-sync.ts`; `bun test tests/checks/error-table-sync.test.ts`; `bun test tests/structure/error-table.test.ts` | row/projection/family-slot mutations; widened-pattern control; documented/machine parity | Existing – Update |
| TC-MERGE-015 | `tests/behaviour/merge-probe.test.ts` + `probes/tracker-flip/**` | `bun test tests/behaviour/merge-probe.test.ts` | 2 m verification + flip; unchanged-posture control; no-fabricated-transition control | To Implement |
| TC-MERGE-016 | same + `probes/ci-regression/**` | same | fresh verification + new red job; different-SHA control; gates-stale precedence case | To Implement |
| TC-MERGE-017 | `tests/behaviour/merge-classification.test.ts`, `tests/fixtures/merge/policy/**` | `bun test tests/behaviour/merge-classification.test.ts` | policy deep-copy mutations flip the outcome; import-identity assertion | To Implement |
| TC-MERGE-018 | `tests/behaviour/merge-waivers.test.ts` + `waivers/authorized/**` | `bun test tests/behaviour/merge-waivers.test.ts` | record-before-mutation ordering; later-refusal durability; determinism | To Implement |
| TC-MERGE-019 | same + `waivers/{unauthorized,unresolvable,non-waivable}/**` | same | three refusal variants; no-record assertion; audit attempt; authorized control | To Implement |
| TC-MERGE-020 | `tests/behaviour/board-waiver-recording.test.ts` + board fixtures | `bun test tests/behaviour/board-waiver-recording.test.ts` | waiver present/absent; record removed control; SLA non-regression | To Implement |
| TC-MERGE-021 | `merge-waivers` + `waivers/no-declaration/**` | same | missing declaration vs unauthorized identity separation; declaration-added control | To Implement |
| TC-MERGE-022 | `tests/behaviour/merge-rebase.test.ts` + temp git repos | `bun test tests/behaviour/merge-rebase.test.ts` | conflict-path fixture; force-construct scan with failing control; one-attempt counter | To Implement |
| TC-MERGE-023 | same | same | successful refresh + re-verify control; record-still-bound assertion | To Implement |
| TC-MERGE-024 | `tests/behaviour/merge-landing.test.ts` + temp git repo | `bun test tests/behaviour/merge-landing.test.ts` | parent/count/tree assertions; post-landing statuses; transaction record | To Implement |
| TC-MERGE-025 | same | same | three unverifiable variants + clean control; re-run convergence | To Implement |
| TC-MERGE-026 | `tests/behaviour/merge-convergence.test.ts` | `bun test tests/behaviour/merge-convergence.test.ts` | three pre-mutation faults; nothing-landed assertions; re-run control | To Implement |
| TC-MERGE-027 | same | same | replay with mutation recorder; SHA-not-contained control; new-runId audit | To Implement |
| TC-MERGE-028 | `tests/behaviour/merge-dry-run.test.ts` | `bun test tests/behaviour/merge-dry-run.test.ts` | pass/fail dry runs; no-mutation recorder; waiver-not-recorded; operator loop | To Implement |
| TC-MERGE-029 | `merge-landing` | same | deletion/append/both failures; clean control; no-flip and no-silence assertions | To Implement |
| TC-MERGE-030 | `tests/behaviour/merge-coordinator-boundary.test.ts`, `tests/boundaries/**`, `scripts/checks/workspace-entrypoints.ts` | corresponding `bun test`/`bun run` | daemon→merge negative fixture; positive CLI control; audit identity present/absent | To Implement + Existing – Update |
| TC-MERGE-031 | `tests/structure/merge-imports.test.ts`, `tests/boundaries/**`, `scripts/checks/{ambient-globals,workspace-entrypoints}.ts` | corresponding `bun test`/`bun run` | AST purity; runtime sentinels; import-direction negative fixture | To Implement + Existing – Update |
| TC-MERGE-032 | `merge-probe` with recording readers | `bun test tests/behaviour/merge-probe.test.ts` | exact counts per scenario; deliberate-second-read control | To Implement |
| TC-MERGE-033 | `tests/behaviour/merge-bounds.test.ts` + `tests/fixtures/merge/bounds/**` | `bun test tests/behaviour/merge-bounds.test.ts` | under/at/over-cap; hostile length; cap mutation; decisive-evidence ranking | To Implement |
| TC-MERGE-034 | `tests/behaviour/merge-privacy.test.ts` + `tests/fixtures/merge/privacy/**`; `tests/checks/secret-read-boundary.test.ts` | corresponding `bun test` | canaries in every disallowed field; allowlist count; evidence-field mutation | To Implement + Existing – Update |
| TC-MERGE-035 | `tests/behaviour/merge-determinism.test.ts` + `tests/golden/helpers.ts` | `bun test tests/behaviour/merge-determinism.test.ts` | 20-run byte equality; permutation; changed-fact and run-id controls; TTY parity | To Implement |
| TC-MERGE-036 | `tests/golden/merge.test.ts` + `tests/fixtures/merge/golden/success-*` | `bun test tests/golden/merge.test.ts` | exact data + human bytes; golden mutation control | To Implement |
| TC-MERGE-037 | same + `tests/fixtures/merge/golden/refusal-*` | same | six refusal goldens (text/scripted/trim); evidence-field mutation | To Implement |
| TC-MERGE-038 | `tests/golden/verify-gates.test.ts` (goldens unchanged), `tests/behaviour/verify-gates-*.test.ts`, `tests/fixtures/verify-gates/cases/harness.ts` | `bun test tests/golden/verify-gates.test.ts`; `bun test tests/behaviour/verify-gates-*` | pre-change goldens; one-append delta; golden mutation control | Existing – Update (harness) / No Change (goldens) |
| TC-MERGE-039 | `tests/checks/merge-deploy-no-live-calls.test.ts`, `tests/checks/verify-gates-no-live-calls.test.ts`, `tests/fixtures/verify-gates/cases/network-guard.ts` | corresponding `bun test` | static scan; runtime guard zero counter; deliberate-call control | To Implement + Existing – Update |
| TC-DEPLOY-001 | `tests/behaviour/verify-deploy-verdicts.test.ts` + `traces/verified/**` | `bun test tests/behaviour/verify-deploy-verdicts.test.ts` | full trace vs artifact-absent/status-success control | To Implement |
| TC-DEPLOY-002 | same + `traces/never-ran/**` | same | zero-step trace, two status variants; executed control | To Implement |
| TC-DEPLOY-003 | same + `traces/status-stale/**` | same | four status variants; fully-green-trace and failing-trace controls | To Implement |
| TC-DEPLOY-004 | same + `traces/failed/**` | same | failed step named; green control; truncation check | To Implement |
| TC-DEPLOY-005 | same + `traces/absent/**` | same | absent/never-created/no-expectation variants; read-fault disjoint control | To Implement |
| TC-DEPLOY-006 | same + provider fault fixtures | same | four fault kinds; readable-empty control | To Implement |
| TC-DEPLOY-007 | `tests/structure/verify-deploy-contract.test.ts`, `tests/structure/inventory.json` | `bun test tests/structure/verify-deploy-contract.test.ts` | vocabulary/mapping/projection mutations; bidirectional completeness | To Implement |
| TC-DEPLOY-008 | `tests/behaviour/verify-deploy-read-budget.test.ts` | `bun test tests/behaviour/verify-deploy-read-budget.test.ts` | target determinism; one-read counter; no-trigger surface; deliberate-second-read control | To Implement |
| TC-DEPLOY-009 | `tests/behaviour/verify-deploy-bounds.test.ts` + `tests/fixtures/verify-deploy/bounds/**` | `bun test tests/behaviour/verify-deploy-bounds.test.ts` | under/at/over-cap; log-body canary; cap mutation | To Implement |
| TC-DEPLOY-010 | `tests/golden/verify-deploy.test.ts` + `tests/fixtures/verify-deploy/golden/**` | `bun test tests/golden/verify-deploy.test.ts` | five fixture goldens; trim; 20-run determinism; golden mutation | To Implement |

**Execution order.**

1. Contracts, vocabularies, and structure baselines: TC-MERGE-001, TC-MERGE-004, TC-MERGE-014, TC-MERGE-031, TC-DEPLOY-007.
2. Gate set and configuration: TC-MERGE-002, TC-MERGE-003.
3. Verification record and freshness envelope: TC-MERGE-005, TC-MERGE-006, TC-MERGE-007, TC-MERGE-008, TC-MERGE-009, TC-MERGE-010, TC-MERGE-011.
4. Refusal surface: TC-MERGE-012, TC-MERGE-013.
5. Probe and classification: TC-MERGE-015, TC-MERGE-016, TC-MERGE-017, TC-MERGE-020.
6. Waivers and overrides: TC-MERGE-018, TC-MERGE-019, TC-MERGE-021.
7. Refresh, landing, and convergence: TC-MERGE-022, TC-MERGE-023, TC-MERGE-024, TC-MERGE-025, TC-MERGE-026, TC-MERGE-027, TC-MERGE-028, TC-MERGE-029.
8. Coordinator boundary and audit: TC-MERGE-030.
9. Budgets, bounds, privacy, determinism: TC-MERGE-032, TC-MERGE-033, TC-MERGE-034, TC-MERGE-035.
10. Deploy surface: TC-DEPLOY-001, TC-DEPLOY-002, TC-DEPLOY-003, TC-DEPLOY-004, TC-DEPLOY-005, TC-DEPLOY-006, TC-DEPLOY-008, TC-DEPLOY-009.
11. Goldens, non-regression, and no-live checks: TC-MERGE-036, TC-MERGE-037, TC-MERGE-038, TC-MERGE-039, TC-DEPLOY-010.
12. Aggregate: `pnpm check`; `git diff --check`; `git status --porcelain`.

All 49 TCs appear exactly once in the order above.

**Wiring.** The new behaviour suites are discovered by root `bun test`; no new CI job topology is introduced. The new structure suites are discovered by `bun test tests/structure`; the deploy contract and gate-registry modules are registered in the inventory. Error-table parity rides the existing `ts-invariants` wiring with the narrow family recognizer added for `merge.gate.<gate-id>.failed`. Boundary, ambient-globals, forbidden-literal, exit-code-literal, secret-read, and entrypoint gates extend to the new modules automatically; no rule is weakened. Documentation reconciliation runs in phase 7: `git diff --check`, YAML parse for changed `.yaml` files, markdown/link review, the error-table sync check, forbidden-literal registration for the new current-truth doc, and `bash scripts/.tests/test-doc-distribution.sh` for any changed redistributable guide or template.

**Evidence commands** (run and record in the change/PR; never record unrun results as passing):

```
pnpm install --frozen-lockfile
bun test tests/structure/merge-contract.test.ts
bun test tests/structure/merge-imports.test.ts
bun test tests/structure/verify-deploy-contract.test.ts
bun test tests/structure/error-table.test.ts
bun test tests/structure/verify-gates-contract.test.ts
bun test tests/structure/config-contract.test.ts
bun test tests/structure/registry-imports.test.ts
bun test tests/structure/subpaths.test.ts
bun test tests/structure/branding-seam.test.ts
bun test tests/behaviour/merge-gate-set.test.ts
bun test tests/behaviour/merge-verification-record.test.ts
bun test tests/behaviour/merge-freshness.test.ts
bun test tests/behaviour/merge-refusal-surface.test.ts
bun test tests/behaviour/merge-probe.test.ts
bun test tests/behaviour/merge-classification.test.ts
bun test tests/behaviour/merge-waivers.test.ts
bun test tests/behaviour/board-waiver-recording.test.ts
bun test tests/behaviour/merge-rebase.test.ts
bun test tests/behaviour/merge-landing.test.ts
bun test tests/behaviour/merge-convergence.test.ts
bun test tests/behaviour/merge-dry-run.test.ts
bun test tests/behaviour/merge-coordinator-boundary.test.ts
bun test tests/behaviour/merge-bounds.test.ts
bun test tests/behaviour/merge-privacy.test.ts
bun test tests/behaviour/merge-determinism.test.ts
bun test tests/behaviour/verify-deploy-verdicts.test.ts
bun test tests/behaviour/verify-deploy-read-budget.test.ts
bun test tests/behaviour/verify-deploy-bounds.test.ts
bun test tests/golden/merge.test.ts
bun test tests/golden/verify-deploy.test.ts
bun test tests/golden/verify-gates.test.ts
bun test tests/behaviour/verify-gates-lifecycle.test.ts
bun test tests/behaviour/verify-gates-output.test.ts
bun test tests/behaviour/verify-gates-read-budget.test.ts
bun test tests/behaviour/verify-gates-corpus.test.ts
bun test tests/behaviour/board-defaults.test.ts
bun test tests/behaviour/board-never-silence.test.ts
bun test tests/checks/error-table-sync.test.ts
bun test tests/checks/merge-deploy-no-live-calls.test.ts
bun test tests/checks/verify-gates-no-live-calls.test.ts
bun test tests/checks/secret-read-boundary.test.ts
bun test tests/checks/forbidden-literals.test.ts
bun test tests/checks/exit-code-literals.test.ts
bun run scripts/checks/error-table-sync.ts
bun run scripts/checks/ambient-globals.ts
bun run scripts/checks/forbidden-literals.ts
bun run scripts/checks/exit-code-literals.ts
bun run scripts/checks/workspace-entrypoints.ts
bun test tests/boundaries
pnpm check
git diff --check
git status --porcelain
```

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

**Specification risk coverage (RSK-1..RSK-8).** Every spec risk is exercised by at least one TC.

| Spec risk | Mitigating TC(s) |
|-----------|------------------|
| RSK-1 — a transition occurs between probe and landing | TC-MERGE-015, TC-MERGE-016, TC-MERGE-024, TC-MERGE-025 |
| RSK-2 — the verify-gates write breaks read-only consumers | TC-MERGE-005, TC-MERGE-006, TC-MERGE-038 |
| RSK-3 — a mis-declared gate set silently drops a safety gate | TC-MERGE-001, TC-MERGE-003, TC-MERGE-010 |
| RSK-4 — a claimed rather than authorized waiver principal | TC-MERGE-017, TC-MERGE-019 |
| RSK-5 — a half-refreshed request branch | TC-MERGE-022, TC-MERGE-023, TC-MERGE-026 |
| RSK-6 — the GH-229 inertness flip surprises board goldens | TC-MERGE-017, TC-MERGE-020, TC-MERGE-038 |
| RSK-7 — deploy-trace availability degrades verdicts | TC-DEPLOY-002, TC-DEPLOY-003, TC-DEPLOY-005, TC-DEPLOY-009 |
| RSK-8 — the freshness bound is mis-tuned | TC-MERGE-008, TC-MERGE-009, TC-MERGE-015 |

**Testing risks.**

| ID | Risk | Impact | Probability | Mitigation |
|----|------|--------|-------------|------------|
| RSK-T1 | A refusal test asserts only the code, so a wrong durable delta passes | H | M | Every refusal asserts exit, code, evidence fields, record counts, base HEAD/commit count, branch presence, request state, and the mutation-call log (§4.2) |
| RSK-T2 | The freshness tests hard-code 30 m / 31 m, hiding a broken comparator | H | M | Bound and comparator are read from contract data and mutation-controlled; the boundary case runs at T−1 ms / T / T+1 ms |
| RSK-T3 | The authorization test is vacuous because the principal is hard-coded | H | M | A flipped temp policy must change the observed outcome, proving the merge reads the declared map |
| RSK-T4 | Idempotency is asserted by envelope equality only, missing a second landing | H | M | The replay test records git mutations and fails on any; it also asserts the transaction-record count and the SHA containment |
| RSK-T5 | The "no daemon path" assertion is a grep that would miss a dynamic import | M | M | Boundary rule + negative fixture + import scan + a positive CLI control; fixture coverage is mandatory |
| RSK-T6 | The "no force path" scan is vacuous | M | M | A failing control fixture that uses a force construct must be detected by the same scan |
| RSK-T7 | Deploy negatives collapse into one unknown bucket | H | M | Reasons and codes are asserted distinctly for never-ran, status-stale, absent-trace, failed, and read-fault; each has a paired control |
| RSK-T8 | Golden bytes are regenerated rather than compared | M | M | Goldens are read-only at test time with a mutation control in the same suite |
| RSK-T9 | Family-row recognition widens the error table unboundedly | M | M | Narrow recognizer, registry-validated slot, mutation controls for undeclared/malformed slots |
| RSK-T10 | Privacy canaries are planted in allowed fields, making the scan vacuous | M | M | Canaries target only disallowed fields; the builder asserts presence; `ref`/SHA are asserted as allowed identity |
| RSK-T11 | Temp-git determinism varies with committer identity or dates | M | L | Harness pins author/committer name, email, and dates; no remotes configured |
| RSK-T12 | Delivery drifts from the pinned readings (GAP-2/4/5/6/9/10/11/13) | M | M | Each reading is plan-pinned with a TC and an OQ owner; any change reopens the affected TC and this log |

### 8.2 Assumptions

- **A-T1 — Spec binding.** The spec is the single source of truth for capabilities, acceptance criteria, NFRs, EVT-1..3, DM-1..5, and the recorded refinements. Delivery planning may choose helper/file/spelling names but may not rebind a pinned value (GAP-15).
- **A-T2 — Plan mapping.** GAP-1: the implementation plan is authored in phase 4 and must map all 49 TCs onto phases without reshaping them. If it alters a TC's behaviour, record, reason, exit, bound, assertion, or mapping, this test plan reopens.
- **A-T2b — Seed binding.** SC-M1-01..05 are inherited with their Given/When/Then and machine assertions. The only divergence is the recorded wire-shape refinement (GAP-4), which preserves every seed's observable semantics; the pack rows must be reconciled in phase 7 rather than forked silently.
- **A-T3 — In-process harness.** Every merge/deploy behaviour test uses `runCli` with injected dependencies; landing/rebase tests may use a local temp git repository. No suite spawns the product binary, reaches the network, or reads the ambient environment where purity is asserted.
- **A-T4 — Injected policy.** The gate set, freshness bound, classification policy, owner principal, and configuration are injected data. Tests mutate deep copies only.
- **A-T5 — State substrate.** The delivered state layer's verified reads, fences, checksums, post-append verification, and torn-state classification are the substrate; three additive record kinds are added with no schema bump.
- **A-T6 — Provider reads.** The delivered work-item, check-run, and request-detail read kinds are reused; the deploy trace read is a new bounded adapter capability returning steps and artifacts only. No new credential path exists.
- **A-T7 — Single-host trust boundary.** Filesystem authorization (0700 state dir, same user) is the accepted M1 boundary for principal claims (RSK-4); the tests assert identity references and fail-closed resolution, not a remote identity provider.
- **A-T8 — Delivery-bound spellings.** Contract export names, module/file names, record schema and kind strings, human labels, evidence rendering, the closeout-ready marker field, the deploy expectation field names, the reason/row mapping field, and the audit identity field are delivery-bound. The vocabulary (gate ids, recipes, surfaces, classes, verdicts, reasons, error codes, exits, comparator, caps, assertions) is pinned.
- **A-T9 — No live evidence.** This plan requires no live GitHub run; committed fixtures and goldens are the deterministic oracle. Any future live smoke is a separate, opt-in, structural check.

### 8.3 Open Questions

| ID | Question | Context | Status | Owner |
|----|----------|---------|--------|-------|
| OQ-T1 | Which error row carries the `pipeline-created-never-ran` reason, and what reason accompanies a truly absent trace? | GAP-2. The plan pins one declared map (absent-evidence unknown → `verify.deploy.trace-missing`; `status-stale` → `verify.deploy.status-stale`; failed-step → `verify.deploy.trace-failed`) and asserts it bidirectionally, inventing neither a fourth row nor a fourth reason. | Resolved in this plan; confirm at DoR | @spec-writer |
| OQ-T2 | Where do the "declared deploy steps and artifacts" expectations come from? | GAP-3. The plan pins fail-closed: no declared expectation ⇒ never `verified`. The source (workflow read vs configuration) stays delivery-bound. | Resolved in behaviour; source delivery-bound | @plan-writer / @spec-writer |
| OQ-T3 | Do deploy negative verdicts render an error envelope (DEC-4 by analogy) or a `data` envelope with a negative verdict (the pack example and SC-M1-05's `data.verdict`)? | GAP-4/GAP-16. The plan pins the error envelope with `runId`, no `data`, text `verdict=` continuity, and the code as the machine identity. SC-M1-05's wire spelling is recorded as superseded, its semantics preserved. | Resolved in this plan; pack row to reconcile at phase 7 | @spec-writer |
| OQ-T4 | Does `merge --dry-run` also report the freshness envelope over the pre-existing record? | GAP-5. Only the behaviour that the spec pins is asserted (evaluate, record one verification, land nothing, never claim merged). | Open — non-blocking; not asserted | @plan-writer |
| OQ-T5 | When both the freshness envelope and a probe observation fail, which identity is primary? | GAP-6. The plan pins `merge.gates-stale` for envelope violations with the probe observation as additional evidence, and `merge.gate.ci-green.failed` for a fresh verification with a new red job. | Resolved in this plan; confirm at DoR | @spec-writer |
| OQ-T6 | What is the waiver declaration grammar? | GAP-7. Behaviour, record content, ordering, and refusals are pinned; the flag spelling is delivery-bound and read from the command contract. | Open — delivery-bound | @plan-writer |
| OQ-T7 | Which existing platform identity does a provider fault use in merge/deploy? | GAP-8. No new row is added; the tests assert platform class, exit 2, and a declared existing row. | Open — reuse only | @plan-writer |
| OQ-T8 | May a declared set reuse a built-in id with a different recipe? | GAP-9. The plan pins reserved ids with shipped recipe/surface required, fail-closed. | Resolved in this plan; confirm at DoR | @spec-writer |
| OQ-T9 | What are the exit projections of `merge.landing-unverified` and `merge.transaction-aborted`? | GAP-10/GAP-11. The plan pins landing-unverified → 2 (mutation state unknown) and transaction-aborted → 1 (clean, retryable refusal). | Resolved in this plan; confirm at DoR | @spec-writer |
| OQ-T10 | May a `--dry-run` record a waiver? | GAP-12. The plan pins no: dry-run verifies and reports authorization but records no waiver or transaction. | Resolved in this plan | @spec-writer |
| OQ-T11 | How is the family-row slot validated for repo-declared gate ids? | GAP-13. The plan pins validation against the effective declared gate set with a narrow recognizer and no pattern widening. | Resolved in this plan; implementation detail at delivery | @plan-writer |
| OQ-T12 | How is the "no force path" absence asserted without a vacuous scan? | GAP-14. The plan pins the adapter-union assertion plus a source scan with a mandatory failing control fixture. | Resolved in this plan | @plan-writer |
| OQ-T13 | Which platform-fault identity and exit does a landing-verification read failure use? | GAP-10 overlaps GAP-8. The plan pins `merge.landing-unverified` at exit 2 for the unestablished landing state, and the reuse of a declared platform/state row for the read fault that produced it. | Resolved in this plan | @spec-writer |

**Recorded gaps, not silently adjusted:**

1. **Implementation-plan mapping** — GAP-1/A-T2; pending phase 4; the plan must map all 49 TCs without reshaping them.
2. **Deploy reason ↔ row mapping** — GAP-2/OQ-T1; declared map pinned, no fourth row or reason.
3. **Declared deploy expectations** — GAP-3/OQ-T2; fail-closed, source delivery-bound.
4. **Deploy negative-envelope shape and SC-M1-05** — GAP-4/OQ-T3; error envelope pinned, seed spelling recorded as superseded, semantics preserved.
5. **Dry-run envelope reporting** — GAP-5/OQ-T4; not asserted, nothing invented.
6. **Gates-stale vs gate-failed precedence** — GAP-6/OQ-T5; envelope primary when stale, gate row when fresh.
7. **Waiver grammar** — GAP-7/OQ-T6; behaviour pinned, spelling delivery-bound.
8. **Platform identity reuse** — GAP-8/OQ-T7; no new row.
9. **Reserved built-in ids** — GAP-9/OQ-T8; fail-closed override refusal.
10. **Landing-unverified / transaction-aborted exits** — GAP-10/GAP-11/OQ-T9; 2 and 1 respectively.
11. **Dry-run and waivers** — GAP-12/OQ-T10; no waiver recorded by a dry run.
12. **Family slot validation** — GAP-13/OQ-T11; registry-validated, narrow recognizer.
13. **No-force assertion technique** — GAP-14/OQ-T12; structural plus mandatory failing control.
14. **Delivery-bound spellings** — GAP-15/A-T8; vocabulary pinned, spellings not.
15. **Prose-free deploy envelope identity** — GAP-16; the code is the machine identity; consumers map codes.
16. **Spec ambiguities that block no AC** — none. Every AC is testable as specified; the gaps above are precision gaps with pinned fail-closed readings, not untestable criteria.

No AC and no NFR is left without a TC.

## 9. Plan Revision Log

| Version | Date (UTC) | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-11-06T17:00:00Z | Change Test Plan Writer | Initial plan: 49 TCs (TC-MERGE-001..039, TC-DEPLOY-001..010). All 18 ACs (AC-F1-1..AC-F8-3), all 9 NFRs, EVT-1..3, DM-1..5, and all 8 spec risks mapped; SC-M1-01..05 inherited verbatim with their Given/When/Then and assertions (§3.4). Pins the freshness envelope (exists, within bound with at-bound stale, same head SHA, same gate-set identity; absent/torn state is exit-2 state-unverified), the classified-refusal surface (text `result=refused` + continuity keys; scripted `error` + `runId` with no `data`, per DEC-4/Appendix A), the eleven new error identities with their exit projections and registry-validated family slot, the probe (tracker transition and CI regression with inline evidence), owner-gate classification as merge authority with the GH-229 waiver-kind/`waivedBy` flip, record-first authorized waivers with fail-closed authorization, one rebase-refresh with no force path and SHA-voiding on success, the verified squash landing with declared post-landing steps, honest unverified landings, clean aborts, idempotent replay, `--dry-run` recording without mutation, the coordinator-only boundary, read budgets, output bounds, privacy, determinism, deploy-by-trace with created-never-ran/status-stale/trace-missing/failed/read-fault separation, and byte-identical verify-gates non-regression. Sixteen recorded gaps (GAP-1..GAP-16) with chosen fail-closed readings and owners; no coverage silently weakened, no AC or NFR left without a TC. |

## 10. Test Execution Log

| TC ID / gate | Run Date (UTC) | Result | Notes / command / HEAD |
|---|---|---|---|
| Not run | — | Planned | This writer ran no builds or tests and implemented no code. The executor records per-TC evidence, commands, HEAD, and pushed-HEAD CI results here; unrun evidence must never be recorded as passing. |

### Execution log — delivery (2026-11-06)

All commands were run from the repository root with the pinned Bun 1.4.4 and
pnpm 10.18.3. Per-phase delivery commits: `9bc01c16` (contracts/config/state/
error rows), `91844970` (pure domain), `33a4d391` (merge surface + recording),
`6489f9b2` (transaction pinning), `f82e5c61` (verify deploy), `ab6ec552`
(invariants/goldens). The aggregate battery is recorded below.

| Gate / evidence command | Result | Notes |
|---|---|---|
| `bun test tests/structure/merge-contract.test.ts` | PASS (14) | TC-MERGE-001/004 structure |
| `bun test tests/structure/verify-deploy-contract.test.ts` | PASS (11) | TC-DEPLOY-007 |
| `bun test tests/structure/error-table.test.ts` | PASS | TC-MERGE-014; documented/machine parity |
| `bun test tests/checks/error-table-sync.test.ts` | PASS (67) | TC-MERGE-014; family slot both ways |
| `bun test tests/structure/owner-gate-sla-contract.test.ts` | PASS | TC-MERGE-017 contract half |
| `bun test tests/structure/merge-imports.test.ts` | PASS (6) | TC-MERGE-031 |
| `bun test tests/behaviour/merge-gate-set.test.ts` | PASS (14) | TC-MERGE-002/003/004 |
| `bun test tests/behaviour/merge-verification-record.test.ts` | PASS (8) | TC-MERGE-005/006 |
| `bun test tests/behaviour/merge-freshness.test.ts` | PASS (15) | TC-MERGE-007..011 |
| `bun test tests/behaviour/merge-refusal-surface.test.ts` | PASS (6) | TC-MERGE-012/013 |
| `bun test tests/behaviour/merge-probe.test.ts` | PASS (10) | TC-MERGE-015/016/032 |
| `bun test tests/behaviour/merge-classification.test.ts` | PASS (5) | TC-MERGE-017 |
| `bun test tests/behaviour/merge-waivers.test.ts` | PASS (11) | TC-MERGE-018/019/021 |
| `bun test tests/behaviour/board-waiver-recording.test.ts` | PASS (3) | TC-MERGE-020; GH-229 GAP-9 flip |
| `bun test tests/behaviour/merge-rebase.test.ts` | PASS (5) | TC-MERGE-022/023; real temp repos |
| `bun test tests/behaviour/merge-landing.test.ts` | PASS (9) | TC-MERGE-024/025/029; real temp repo |
| `bun test tests/behaviour/merge-convergence.test.ts` | PASS (7) | TC-MERGE-026/027 |
| `bun test tests/behaviour/merge-dry-run.test.ts` | PASS (6) | TC-MERGE-028 |
| `bun test tests/behaviour/merge-coordinator-boundary.test.ts` | PASS (6) | TC-MERGE-030 |
| `bun test tests/behaviour/merge-bounds.test.ts` | PASS (3) | TC-MERGE-033 |
| `bun test tests/behaviour/merge-privacy.test.ts` | PASS (5) | TC-MERGE-034 |
| `bun test tests/behaviour/merge-determinism.test.ts` | PASS (8) | TC-MERGE-035; 20-run equality |
| `bun test tests/golden/merge.test.ts` | PASS (18) | TC-MERGE-036/037; six refusal pairs |
| `bun test tests/golden/verify-deploy.test.ts` | PASS (12) | TC-DEPLOY-010 |
| `bun test tests/golden/verify-gates.test.ts` | PASS (5) | TC-MERGE-038; pre-change goldens unchanged |
| `bun test tests/behaviour/verify-deploy-verdicts.test.ts` | PASS (21) | TC-DEPLOY-001..006 |
| `bun test tests/behaviour/verify-deploy-read-budget.test.ts` | PASS (5) | TC-DEPLOY-008 |
| `bun test tests/behaviour/verify-deploy-bounds.test.ts` | PASS (6) | TC-DEPLOY-009 |
| `bun test tests/checks/merge-deploy-no-live-calls.test.ts` | PASS (6) | TC-MERGE-039 |
| `bun test tests/checks/secret-read-boundary.test.ts` | PASS | TC-MERGE-034 allowlist unchanged |
| `bun test tests/checks/verify-gates-no-live-calls.test.ts` | PASS | updated harness stays offline |
| `bun test tests/boundaries` | PASS (137) | tier and runtime-API invariants |
| `pnpm -r typecheck` | PASS | six packages + tests/types |
| `pnpm exec biome lint .` | PASS | 0 errors |
| `pnpm format:check` | PASS | 1106 files |
| `bun test` (aggregate) | PASS | 3804 pass / 4 skip / 0 fail across 382 files |
| `pnpm check` (final, after integrating origin/main-tools at `eb279f9c`) | PASS | lint, format, typecheck, full test battery, boundaries, ambient globals, entrypoints, secret-read boundary, and exports parity all green |

The branch was integrated with the current `origin/main-tools` baseline (GH-224
doctor v1) in merge commit `eb279f9c`; the shared error table, contract
inventories, sync check, and fixtures were reconciled additively. The aggregate
battery is green end-to-end.
