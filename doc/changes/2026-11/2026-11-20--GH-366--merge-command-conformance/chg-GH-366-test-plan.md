---
id: chg-GH-366-test-plan
status: Proposed
created: 2026-11-20T12:10:00Z
last_updated: 2026-11-20T12:10:00Z
owners: ["engineering"]
service: delivery-os
labels: [merge, conformance, m4-s3, diagnostics, error-table]
version_impact: minor
summary: "Prove the merge slice's three repaired defects and the diagnostics contract they report in: the change branch and the verified head are resolved from the change record and the open delivery request (the base checkout's branch never participates), the shipped default merge projection enforces the required checks reported on the resolved head so failing, pending, canceled, skipped, missing and other-head checks each refuse by name, and every refusal names the command, the code and at least one named cause — a credential condition naming the credential reference and the environment variable and never `merge.transaction-aborted`, an unresolvable work item naming its ref and read operation, `retryable` always the emitted row's declared value with no row overstating convergence, and a gate refusal resolving to its declared family row while a live mismatch control still reaches the containment identity; plus dry-run/real-merge object agreement and the non-functional proofs (determinism, read budget, bounds, offline, no ambient branch read, identity totality and stability at 167 → 170, secret hygiene)."
links:
  change_spec: ./chg-GH-366-spec.md
  implementation_plan: null  # ./chg-GH-366-plan.yaml — not yet authored (phase 4 delivery_planning pending)
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - M4-S3 merge command conformance (GH-366): resolved change branch, required checks on the resolved head, and every refusal named

## 1. Scope and Objectives

This plan verifies three deterministic defects and the diagnostics contract that
reports them. The verification risk is not "the module is missing" — the module,
the gate set, the required-job evaluator, the error table and the refusal
envelope all exist. The risk is that the change produces **evidence about the
wrong object**, or evidence that cannot fail:

- a run from the integration-base checkout reports a verdict about the base tip,
  because the composition still assigns the branch from the checkout's git facts
  (spec §2.1, P-1);
- the merge-applicable projection stays vacuous, so a failing and a fully green
  request produce the same all-pass verdict (P-2, P-3);
- a refusal narrates no reference and no environment variable, an unresolvable
  work item collapses into an opaque abort, and a gate refusal renders as the
  containment identity (P-4);
- a declared row advertises `retryable: true` while causes routed to it need an
  operator act before a re-run converges (P-5);
- a dry run describes a different object from the one the merge would land
  (P-6).

Every case below is an oracle over an observable reached through the production
composition or a declared seam: the injected transport's request log, the
injected port call counters, the real temp checkout's git state, the appended
state records, the resolved error-table row and its exit projection, the
composition's exported emittable declaration, and the committed source tree.
**Absence claims carry a positive control in the same case** — a zero provider
read is paired with a run that reads; "no ambient branch read" is paired with a
planted read the scan must find; "the containment identity is unreachable for a
declared gate refusal" is paired with a live mismatch that still reaches it;
"no row overstates convergence" is paired with a row object that must be flagged.

Three constraints shape the plan.

1. `.ai/rules/testing-strategy.md` binds: fixtures live under `tests/fixtures/**`,
   suites are `bun:test` under the `behaviour`, `structure`, `checks` and `golden`
   layers, and a permanent suite asserts properties of the current tree or HEAD,
   never a diff against a moving base branch. Every "nothing else moved" claim is
   therefore an exact-set equality against a production constant, a committed
   golden, or a pinned inventory.
2. Offline determinism is binding (NFR-4, AC-F5-3): every new case is in-process
   over injected ports and transport. No network call, no child process, no live
   provider, no live credential read.
3. The change is **not** claiming the ticket body's family-wide command battery
   (spec §7.2). No case here exercises `dispatch`, `loop`, `closeout`, `queue`,
   `phase`, `verify`, `blockers`, `board`, `brief`, `metrics`, `spend` or
   `provider`.

This document is a verification map, not an execution claim. No case has been
run at authoring time; §10 is populated during delivery and the quality gates.

### 1.1 In Scope

- **F-1 Change-branch resolution and head binding (5 ACs).** The change branch
  resolves from a `branch` declaration on the change's pm-notes document and
  nowhere else; absence, emptiness, whitespace, control characters or an
  over-cap value refuse `merge.branch-unresolved` naming the record path and the
  key with zero provider reads and zero landing calls; the open delivery-request
  read must match exactly one entry by exact provider-asserted source ref, and
  zero matches, more than one match, or a match with no asserted head refuse
  `merge.request-unresolved` with the closed reason `no-open-request` |
  `ambiguous-open-request` | `head-unresolved`; the matched request's asserted
  head is the resolved head, which the freshness envelope, the landing's expected
  head and the reported head all bind to, so a record for the base tip refuses
  `merge.gates-stale` with both SHAs.
- **F-2 Required-check enforcement on the resolved head (7 ACs).** The shipped
  default merge projection becomes `ci-green` + `tracker-freshness`; the
  merge-applicable required-check set is the declared `required-ci-job` entries
  plus the `ci-green` entry's repository-declared expected job set, evaluated per
  job through the single delivered mapping with `recorded`/`probe` attribution;
  failing, canceled, skipped, pending, missing and other-head conditions each
  refuse on `merge.gate.<gate-id>.failed` at exit 1 by name; a read fault names
  the operation; the five built-ins stay reserved and mandatory, `ci-green` is
  admitted on `battery` or `both` and the other four on `battery` only, and an
  omitted class adopts the shipped class.
- **F-3 Refusal diagnostics contract (6 ACs).** Every refusal names the command,
  the code and at least one named cause with an actionable or absent
  remediation; a credential condition names the credential reference (`github-read`),
  the environment variable (`GITHUB_TOKEN`) and the operation, and is never
  `merge.transaction-aborted`; an unresolvable work item is
  `merge.work-item-unresolved` naming its ref and read operation; `retryable` is
  always the emitted row's declared value; no row declares `retryable: true`
  while a cause it reaches needs an operator act.
- **F-4 Emitted-identity totality (1 AC).** A gate refusal resolves to the
  declared family row with the gate id preserved; the slot stays validated
  against the effective gate set with no pattern widening; a live mismatch
  control still reaches the containment identity.
- **F-5 Dry-run / real-merge agreement (3 ACs).** Both surfaces report the same
  resolved branch, request identity and resolved head; the dry-run record's head
  is the resolved head with zero waiver, transaction or git mutation and never
  `result=merged` or `squash=`; the new suites are offline.
- **Non-functional (10 NFRs).** Determinism (20 runs, 6 scenarios, changed-fact
  control), read budget, output bounds, offline determinism, refusal
  completeness over a ≥18-case matrix, no ambient branch read scan, identity
  totality, identity stability (167 → 170 with the effective gate-set id
  sequence unchanged), secret hygiene with canary secrets, and the latency/read
  delta.
- **Additive-surface synchronization.** Three additive rows in both tables, the
  seven identity pin sites, the two identity-count pages, the merge reference
  page, the merge feature spec and the merge test specification; the `branch`
  declaration on the change record is opaque to lint and preserved
  value-faithfully by every document-writing branch.

### 1.2 Out of Scope & Known Gaps

- [OUT] **The family-wide command battery** over `dispatch`, `loop`, `merge`,
  `closeout`, `queue`, `phase`, `verify`, `blockers`, `board`, `brief`,
  `metrics`, `spend`, `provider` on the installed binary (spec §7.2). Not
  claimed green; no case here asserts it.
- [OUT] **Branch-protection required-status-contexts** or any new provider
  operation, scope or credential reference (NG-1). The only reads are the four
  delivered ones plus the two delivered filesystem reads.
- [OUT] **The battery's five gate evaluations, `verify gates` output, and their
  goldens** (NG-2). `TC-MRG-032` asserts the battery-side record and goldens are
  byte-identical; no case drives a battery change.
- [OUT] **`verify gates` resolving its branch from the change record** (OQ-3).
  The battery keeps its delivered resolution.
- [OUT] **A branch-declaration writer** (OQ-1, NG-5). The declaration is
  authored; no case asserts automatic maintenance.
- [OUT] **Waiver policy, owner-gate classification, the `--waive` surface, and
  any per-invocation override for the check gate** (NG-6). No case drives one.
- [OUT] **New landing, refresh, force, bypass, auto-merge, queue, retry or
  head-mutation capability** (NG-3). `merge.transaction-aborted` keeps its row;
  no case drives a new mechanism.
- [OUT] **`verify deploy` target resolution** — its delivered residual is
  unchanged and no case claims an engine-verified deploy.
- **GAP-TP-1 — "zero ambient branch read" is a source invariant, not a
  behavioural one.** Nothing distinguishable at runtime separates "not read"
  from "read and unused" in one invocation, so `TC-MRG-037` expresses the claim
  as a production-source scan with a mandatory planted control, following the
  delivered `tests/checks/merge-landing-retirement.test.ts` precedent. It does
  not attempt a diff-against-base assertion (forbidden by
  `.ai/rules/testing-strategy.md`).
- **GAP-TP-2 — the merge golden set has no declared movement list yet.** Eight of
  the thirteen committed merge goldens encode `gates=<passed>/<total>` and the
  evaluated gate ids, and the merge projection moves from one to two entries.
  Which files are regenerated is not stated by the spec (NG-2 protects the
  battery goldens only); `TC-MRG-035` therefore asserts the byte bounds and the
  deliberate-regeneration discipline, and OQ-TP-2 records the open allocation.
- **GAP-TP-3 — the refusal matrix is an enumerated oracle, not a generator.**
  `TC-MRG-023` enumerates the 22 concrete cells of spec Appendix B rather than
  scanning production for emitted codes; the scan-based totality claim belongs to
  `TC-MRG-028`/`TC-MRG-029` and to
  `tests/structure/defect-f1-merge-refusal-containment.test.ts`. The two
  together cover "no emitted code escapes"; neither is claimed to cover the
  other.

## 2. References

- Change specification: [`chg-GH-366-spec.md`](./chg-GH-366-spec.md) (v1.1,
  22 acceptance criteria, §17.6 owner acceptance trace, Appendix B refusal
  matrix).
- Implementation plan: `chg-GH-366-plan.yaml` — **not yet authored** at test-plan
  time (phase 4 `delivery_planning` is pending). Scenario-to-phase allocation is
  therefore derived from the spec's own capability grouping (F-1 … F-5) and must
  be re-read against the plan before `dor_check`.
- Testing strategy: [`../../../../.ai/rules/testing-strategy.md`](../../../../.ai/rules/testing-strategy.md).
- Current-truth merge contract: [`doc/spec/features/feature-merge-verify-deploy.md`](../../../spec/features/feature-merge-verify-deploy.md)
  — its Overview resolution paragraph, gate-registry defaults, verification
  record head meaning and invariants are reconciled in this change.
- Merge test specification: [`doc/quality/test-specs/test-spec-merge-verify-deploy.md`](../../../quality/test-specs/test-spec-merge-verify-deploy.md)
  — rows "Composition reachability", "Required-check awareness", "Classification
  fidelity", "Emittable-code totality", "Error-identity stability" move here.
- Documented identity table: [`doc/spec/features/feature-result-contract.md`](../../../spec/features/feature-result-contract.md)
  (167 → 170 rows in the same change).
- Merge command reference page: `doc/planning/oss-tooling/milestones/m1/commands/merge.md`
  (the page `check:help` resolves for `merge`).
- Delivered change-record read: `readPmNotesText` in
  `packages/adapters/src/file/pm-notes-parser.ts` (the read the closeout
  composition already performs for the milestone declaration).
- Delivered per-job mapping: `evaluateRequiredJobGate` in
  `packages/core/src/domain/merge-probe.ts` — the single evaluator, reused.
- Contracts: `packages/core/src/contracts/merge.ts` (`MERGE_DEFAULT_GATE_ENTRIES`,
  `MERGE_BUILTIN_GATE_IDS`, `MERGE_GATE_ENTRY_FIELDS`,
  `MERGE_GATE_ERROR_PREFIX`/`SUFFIX`/`TEMPLATE`), `packages/core/src/contracts/error-table.ts`,
  `packages/core/src/contracts/verify-gates.ts` (the gate-source vocabulary:
  `repository-ci-workflow`, `github-work-item`, `github-check-runs`,
  `github-delivery-request-list`, `github-delivery-request-detail`).
- Credential reference: `githubReadReference` (`referenceName: "github-read"`,
  `sourceKey.name: "GITHUB_TOKEN"`) in `packages/cli/src/production.ts`.
- Owner acceptance trace (spec §17.6): AC 1 → AC-F1-1, AC-F1-2, AC-F1-5,
  AC-F5-2; AC 2 → AC-F2-1 … AC-F2-5; AC 3 → AC-F3-1 … AC-F3-4, AC-F4-1; AC 4
  → AC-F1-1, AC-F2-1, AC-F3-2, AC-F5-3.

## 3. Coverage Overview

Every one of the 22 acceptance criteria appears below with at least one scenario.
No criterion is TODO: each has a carrier in the delivered field or observable
named in its scenario. §3.2 and §3.3 record interface and non-functional
coverage separately so a reader can see which dimension of each AC is proven.

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Criterion (short) | TC ID(s) | Status |
|-------|-------------------|----------|--------|
| AC-F1-1 | Base-checkout invocation reports the request head, never the base tip *(owner AC 1, regression (a))* | TC-MRG-001, TC-MRG-002 | Covered |
| AC-F1-2 | Change-branch checkout at the request head verifies that head and lands once there *(owner AC 1)* | TC-MRG-003 | Covered |
| AC-F1-3 | No usable `branch` declaration refuses `merge.branch-unresolved` naming record path, key and command, with zero provider reads and zero landing calls | TC-MRG-004 | Covered |
| AC-F1-4 | Zero / ambiguous / headless match refuses `merge.request-unresolved` with the matching closed reason and the resolved branch named | TC-MRG-005, TC-MRG-006, TC-MRG-007 | Covered |
| AC-F1-5 | A record whose head is the base tip refuses `merge.gates-stale` at exit 1 with both SHAs and zero landing calls | TC-MRG-008 | Covered |
| AC-F2-1 | One failing required check refuses `merge.gate.<gate-id>.failed` at exit 1 naming the check, the gate and the reason, zero landing calls *(owner AC 2, regression (b))* | TC-MRG-010 | Covered |
| AC-F2-2 | One queued or running required check refuses on the same family naming the check with the pending reason *(owner AC 2)* | TC-MRG-012, TC-MRG-027 | Covered |
| AC-F2-3 | All-green dry run reports `verified` and the merge lands once, so green and failing never share a verdict/path | TC-MRG-011 | Covered |
| AC-F2-4 | A page for another SHA is never head evidence; refuses naming both SHAs, never a pass | TC-MRG-013 | Covered |
| AC-F2-5 | A CI read fault refuses with the declared provider identity naming the failed operation, never a pass | TC-MRG-014 | Covered |
| AC-F2-6 | A declared `required-ci-job` is enforced while an undeclared, non-expected job is not evidence | TC-MRG-015 | Covered |
| AC-F2-7 | Five built-ins reserved and mandatory with immutable recipe/class, omitted class adopts shipped class, `ci-green` admitted on `battery`/`both` and the other four on `battery` only | TC-MRG-016, TC-MRG-017 | Covered |
| AC-F3-1 | Every refusal across the enumerated matrix names command, code and ≥1 named cause with actionable-or-absent remediation *(owner AC 3)* | TC-MRG-023, TC-MRG-024 | Covered |
| AC-F3-2 | Absent token refuses `config.credential.missing` naming reference, environment variable and operation *(owner AC 3, regression (c))* | TC-MRG-020, TC-MRG-021 | Covered |
| AC-F3-3 | A credential condition is the declared credential/auth identity, never `merge.transaction-aborted` | TC-MRG-021 | Covered |
| AC-F3-4 | An unresolvable work item refuses `merge.work-item-unresolved` naming ref and read operation, remediation naming that cause | TC-MRG-022 | Covered |
| AC-F3-5 | `retryable` equals the emitted row's declared value; remediation accurate for the named cause; no instruction to clear an unnamed condition | TC-MRG-025, TC-MRG-027 | Covered |
| AC-F3-6 | No row declares `retryable: true` while a cause it reaches needs an operator act; `merge.transaction-aborted`'s narrowed causes, value and remediation agree *(owner AC 3)* | TC-MRG-026 | Covered |
| AC-F4-1 | A gate refusal resolves to the declared family row with the gate id preserved; containment reached only by an undeclared code, proven by a live mismatch control | TC-MRG-028, TC-MRG-029 | Covered |
| AC-F5-1 | Dry run and real merge report the same resolved branch, request identity and resolved head | TC-MRG-030 | Covered |
| AC-F5-2 | A base-checkout dry run records the resolved request head; no waiver/transaction/git mutation; never `result=merged` or `squash=` | TC-MRG-001, TC-MRG-031 | Covered |
| AC-F5-3 | The new regression suites perform zero network calls and spawn zero child processes; existing no-live-call guards stay green *(owner AC 4)* | TC-MRG-036 | Covered |

**Owner acceptance trace, kept visible.** Owner AC 1 → TC-MRG-001, TC-MRG-002,
TC-MRG-003, TC-MRG-008, TC-MRG-031. Owner AC 2 → TC-MRG-010, TC-MRG-011,
TC-MRG-012, TC-MRG-013, TC-MRG-014. Owner AC 3 → TC-MRG-020, TC-MRG-021,
TC-MRG-022, TC-MRG-023, TC-MRG-024, TC-MRG-028. Owner AC 4 → TC-MRG-001,
TC-MRG-002, TC-MRG-010, TC-MRG-020, TC-MRG-036. Pending-check refusal and the
retained explicit waiver path → TC-MRG-011, TC-MRG-012, TC-MRG-016. Unreadable
work item, no unnamed remediation, honest `retryable` → TC-MRG-022, TC-MRG-023,
TC-MRG-024, TC-MRG-025, TC-MRG-026, TC-MRG-027. Dry run describes the landed
object → TC-MRG-030, TC-MRG-031.

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

| ID | Surface | TC ID(s) | Assertion carried |
|----|---------|----------|-------------------|
| API-1 | `merge <ref>` | TC-MRG-001, TC-MRG-003, TC-MRG-008, TC-MRG-030 | Resolved branch, resolution source, request identity, resolved head and the evaluated required-check count are reported; the landing's expected head is the resolved head |
| API-2 | `merge <ref> --dry-run` | TC-MRG-030, TC-MRG-031, TC-MRG-032 | Same resolved object as the real merge; one verification record for the resolved head; zero waiver/transaction/git mutation; never `result=merged` or `squash=` |
| API-3 | Refusal envelope | TC-MRG-023, TC-MRG-024, TC-MRG-025, TC-MRG-026, TC-MRG-027 | `error.code` is the stored identity or family instance; summary names command, breached contract and offending object; evidence bounded and secret-free; `retryable` is the row's declared value |
| EVT-1 | `delivery.merge.gate-verification.v1` record | TC-MRG-032 | Schema and kind unchanged; a merge-surface dry-run record carries the CI gate entry alongside the tracker entry, and its citation declares the sources it read (`repository-ci-workflow`, `github-check-runs`); `verify gates` records byte-identical |
| EVT-2 | Capsule and delivery-registry events | TC-MRG-041 | No new event kind, key or schema; resolution facts are command data, not a persisted event |
| DM-1 | Change-record `branch` declaration | TC-MRG-004, TC-MRG-009 | Additive top-level key, opaque to lint, preserved value-faithfully by document-writing branches, never inspected by another surface |
| DM-2 | Resolved change context (non-persisted) | TC-MRG-019, TC-MRG-030, TC-MRG-035 | Resolved branch, source, request identity, resolved head and the required-check count/set size are reported, bounded, and never written as a record |
| DM-3 | Merge-applicable membership and admitted surfaces | TC-MRG-016, TC-MRG-017, TC-MRG-038 | Two merge-applicable entries under the shipped default; declared admitted surface sets; no identity, schema-version, recipe or configuration-key change |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR | Threshold | TC ID(s) | How it is carried |
|-----|-----------|----------|-------------------|
| NFR-1 | 20 consecutive byte-identical runs for one success and five refusals; a changed-fact control differs | TC-MRG-033 | Twenty fresh harness runs per scenario, stdout/stderr/exit compared; a flipped fact must differ |
| NFR-2 | One change-record read, one open-request list read, one request-detail read, one work-item read, one CI-workflow read, one check-run page on the resolved head, one verification read; ≤1 post-refusal re-read and ≤1 unknown-recovery re-read; ≤1 landing call; zero retries, zero pagination | TC-MRG-034 | Per-invocation read counters and the transport request log compared to the declared budget as an exact multiset |
| NFR-3 | Machine `data` ≤ 65 536 UTF-8 bytes; human summary ≤ 24 lines / ≤ 4 096 bytes; every dropped item marked `+N`; no new unbounded field | TC-MRG-035 | Byte and line counts on the new refusal/evidence shapes; omission marks asserted |
| NFR-4 | Zero network calls and zero child processes in every new suite; no-live-call guards green | TC-MRG-036 | Throwing fetch guard records zero calls; spawn seam records zero invocations; static scan of the new suites |
| NFR-5 | 100 % of refusals across the ≥18-case matrix carry command, code, ≥1 named cause and actionable-or-absent remediation; 0 instructions to clear an unnamed condition | TC-MRG-023, TC-MRG-024 | Enumerated 22-cell matrix plus a planted unnamed-remediation control |
| NFR-6 | 0 reads of the checkout's branch on the merge path, proven by a source scan with a mandatory failing control | TC-MRG-037 | Production-source scan over the merge path with a planted read found by file and line |
| NFR-7 | 100 % of emitted codes resolve to a row or the declared family, slot validated against the effective gate set, no pattern widening, live mismatch control | TC-MRG-028, TC-MRG-029 | Totality predicate over the derived emission set plus the mismatch control |
| NFR-8 | Effective gate-set id sequence unchanged; 167 → 170 in both tables and in the reference page, feature spec and test specification | TC-MRG-038 | Identity arithmetic, seven pin sites, two count pages, three doc surfaces, the exact identity string |
| NFR-9 | 0 occurrences of a credential value, title, body, comment, raw payload or log line, verified with canary secrets | TC-MRG-039 | Canary set over stdout, stderr, envelope and every appended record; the reference name and env-var name remain present, the value never |
| NFR-10 | ≤2 added provider-independent reads (change record, CI workflow) and ≤1 provider list read already budgeted; total read count within the NFR-2 budget; no added polling or waiting | TC-MRG-040 | Provider-request count equals the budget; the two added reads are filesystem reads; clock/read counters show no loop |

## 4. Test Types and Layers

All layers run in-process with `bun test` (or `pnpm test`); the repository's
map is `packages/**` → `tests/structure` + `tests/behaviour` + the boundary
suite + `pnpm typecheck`, plus `tests/checks/**` for repository invariants and
`tests/golden/**` for byte pins.

| Layer | Location | Framework / convention | What this change uses it for |
|-------|----------|------------------------|------------------------------|
| Behaviour (transaction) | `tests/behaviour/merge-*.test.ts` over `tests/fixtures/merge/harness.ts` | `bun:test`; the real command definition over injected ports, a real temp state ledger, a recording fake git seam | Per-job evaluation, pending/other-head/undeclared-job cells, freshness comparison, landing count, determinism, read budget, bounds |
| Behaviour (production composition) | `tests/behaviour/merge-production-composition.test.ts` over `tests/fixtures/merge/production-composition.ts` | `bun:test`; the shipped `createProductionComposer` over a real temp checkout with only transport, credential, configuration-fs and spawn injected | Branch/request resolution, credential and read-fault naming, base-tip refusal, dry-run/merge agreement, end-to-end regression (a)/(b)/(c) |
| Structure / contract | `tests/structure/merge-*.test.ts`, `tests/structure/defect-f1-merge-refusal-containment.test.ts`, `tests/structure/error-table.test.ts`, `tests/structure/pm-notes-contract.test.ts` | `bun:test`; exact-set equality against production constants, source reads, temp-tree sync runs | Gate-set validation and admitted surfaces, row-level retryability honesty, identity totality, identity stability, record shapes |
| Repository checks | `tests/checks/merge-check-path-scan.test.ts`, `merge-landing-retirement.test.ts`, `merge-deploy-no-live-calls.test.ts`, `merge-suite-discovery.test.ts`, `error-table-sync.test.ts` (+ new `merge-branch-read-scan.test.ts`) | `bun:test`; production-source scans with mandatory planted controls | Single-evaluator scan, no ambient branch read, offline guard, suite discovery/offline static scan, two-table sync |
| Golden | `tests/golden/merge.test.ts` over `tests/fixtures/merge/golden/` | `bun:test`; committed byte files with a mutation control | Deliberate golden reconciliation; the battery-side record stays byte-identical |
| Content (docs) | Manual + `tests/checks/doc-conformance.test.ts` | Traceability and link review; current-truth phrase table | NFR-8's three doc surfaces; the `branch` authoring guidance |
| E2E / live provider | — | Not used | Forbidden by NFR-4/AC-F5-3; the family-wide battery is explicitly out of scope (§1.2) |

Assertion discipline for this plan: every expected outcome names a value — an
exit code, an exact `error.code`, a named evidence token, a SHA pair, a read
count, a byte bound, an identity total, or a set equality. No case asserts that
"a refusal renders" or that "a report exists".

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Scenario Type | Test Type(s) | Layer | Priority | AC Coverage |
|-------|-------|---------------|--------------|-------|----------|-------------|
| TC-MRG-001 | Base-checkout invocation resolves and verifies the request head | Regression | Integration, Contract | Behaviour (production composition) | High | AC-F1-1, AC-F5-2 |
| TC-MRG-002 | Control: the pre-fix branch source reproduces the base-tip verdict | Regression | Integration | Behaviour (production composition) | High | AC-F1-1 |
| TC-MRG-003 | Change-branch checkout at the request head lands once at that head | Happy Path | Integration | Behaviour (production composition) | High | AC-F1-2 |
| TC-MRG-004 | No usable `branch` declaration refuses naming record path and key | Negative | Integration, Contract | Behaviour (production composition) | High | AC-F1-3, DM-1 |
| TC-MRG-005 | Zero matching open requests refuses `no-open-request` | Negative | Integration | Behaviour (production composition) | High | AC-F1-4 |
| TC-MRG-006 | Two matching open requests refuses `ambiguous-open-request` | Negative | Integration | Behaviour (production composition) | High | AC-F1-4 |
| TC-MRG-007 | A matched request with no asserted head refuses `head-unresolved` | Negative | Integration | Behaviour (production composition) | High | AC-F1-4 |
| TC-MRG-008 | A record for the base tip refuses `merge.gates-stale` with both SHAs | Negative | Integration | Behaviour (production composition) | High | AC-F1-5 |
| TC-MRG-009 | The `branch` declaration is lint-opaque and value-faithfully preserved | Edge Case | Contract, Integration | Behaviour (pm-notes lint + phase writes) | Medium | DM-1 |
| TC-MRG-010 | One failing required check refuses with the check, gate and reason named | Regression | Integration | Behaviour (production composition) | High | AC-F2-1, NFR-5 |
| TC-MRG-011 | All-green dry run verifies and the merge lands once, distinct from red | Happy Path | Integration | Behaviour (dry run + landing) | High | AC-F2-3 |
| TC-MRG-012 | A queued or running required check refuses with the pending reason | Negative | Integration | Behaviour (transaction) | High | AC-F2-2, NFR-5 |
| TC-MRG-013 | A check-run page for another SHA is never head evidence | Negative | Integration | Behaviour (transaction) | High | AC-F2-4 |
| TC-MRG-014 | A CI read fault names the failed operation and never passes | Negative | Integration | Behaviour (production composition) | High | AC-F2-5 |
| TC-MRG-015 | A declared required job is enforced; an undeclared job is not evidence | Corner Case | Integration | Behaviour (transaction) | High | AC-F2-6 |
| TC-MRG-016 | Built-ins stay reserved, mandatory and recipe/class-immutable | Negative | Contract | Behaviour (gate set) + Structure | High | AC-F2-7 |
| TC-MRG-017 | Admitted surface sets admit `ci-green` on `battery`/`both` only | Negative | Contract | Behaviour (gate set) + Structure | High | AC-F2-7, DM-3 |
| TC-MRG-018 | An invalid repository expected-job set refuses and never passes | Negative | Integration | Behaviour (transaction) | Important | F-2 |
| TC-MRG-019 | The dry run discloses the evaluated required-check posture | Edge Case | Integration | Behaviour (dry run) | Important | F-2, API-2 |
| TC-MRG-020 | An absent token names reference, environment variable and operation | Regression | Integration | Behaviour (production composition) | High | AC-F3-2, NFR-9 |
| TC-MRG-021 | A credential condition is never `merge.transaction-aborted` | Negative | Integration, Contract | Behaviour (production composition) | High | AC-F3-3, AC-F3-2 |
| TC-MRG-022 | An unresolvable work item refuses with its own identity and cause | Negative | Integration | Behaviour (production composition) | High | AC-F3-4, NFR-5 |
| TC-MRG-023 | Every Appendix B refusal names command, code and a cause | Negative | Contract | Behaviour (refusal surface) | High | AC-F3-1, NFR-5 |
| TC-MRG-024 | Control: an unnamed cause or unnamed-remediation hint is flagged | Negative | Contract | Behaviour (refusal surface) | High | AC-F3-1, NFR-5 |
| TC-MRG-025 | `retryable` is always the emitted row's declared value | Edge Case | Contract | Behaviour (refusal surface) + Structure | High | AC-F3-5 |
| TC-MRG-026 | No row claims `retryable: true` over an act-requiring cause | Edge Case | Contract | Structure (refusal rows) | High | AC-F3-6 |
| TC-MRG-027 | A pending cause converges without an act and its remediation says so | Edge Case | Integration, Contract | Behaviour (probe + rendering) | High | AC-F3-5, AC-F2-2 |
| TC-MRG-028 | A gate refusal resolves to its declared family row, gate id preserved | Happy Path | Contract | Structure (containment + conformance) | High | AC-F4-1, NFR-7 |
| TC-MRG-029 | A live mismatch control still reaches containment; no slot widening | Corner Case | Contract | Structure (containment + conformance) | High | AC-F4-1, NFR-7 |
| TC-MRG-030 | Dry run and real merge report the same branch, request and head | Happy Path | Integration | Behaviour (production composition) | High | AC-F5-1 |
| TC-MRG-031 | A base-checkout dry run records the resolved head with zero mutation | Regression | Integration | Behaviour (production composition, record) | High | AC-F5-2 |
| TC-MRG-032 | The merge-surface CI entry is cited by source; battery records unchanged | Edge Case | Integration, Contract | Behaviour (record) + Golden | Important | EVT-1 |
| TC-MRG-033 | Twenty runs are byte-identical across six scenarios | Regression | Integration, Performance | Behaviour (determinism) | High | NFR-1 |
| TC-MRG-034 | The per-invocation read budget holds exactly | Corner Case | Integration, Performance | Behaviour (probe + composition) | High | NFR-2 |
| TC-MRG-035 | Machine and human output stay inside the declared bounds | Corner Case | Integration, Performance | Behaviour (bounds) | Medium | NFR-3 |
| TC-MRG-036 | The new suites are offline: no network, no child process | Regression | Integration, Contract | Behaviour + Checks | High | NFR-4, AC-F5-3 |
| TC-MRG-037 | The merge path reads no ambient branch, proven by a scan with a control | Regression | Contract | Checks (source scan) | High | NFR-6 |
| TC-MRG-038 | Identities move 167 → 170 with the gate-set identity unchanged | Regression | Contract | Structure + Checks + docs | High | NFR-8 |
| TC-MRG-039 | Canary secrets never reach output or records | Negative | Integration, Contract | Behaviour (privacy) | High | NFR-9 |
| TC-MRG-040 | The added reads are two filesystem reads and no added polling | Corner Case | Integration, Performance | Behaviour (read counts) | Medium | NFR-10 |
| TC-MRG-041 | No new record kind, key or event schema; shapes unchanged | Regression | Contract | Structure (record shapes) | Medium | EVT-2, DM-3 |

### 5.2 Scenario Details

#### TC-MRG-001 - Base-checkout invocation resolves and verifies the request head

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, AC-F5-2, API-1, DM-1, DM-2, NFR-6
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-production-composition.test.ts` (update; the suite's current assertion that the branch comes from the checkout's git facts is replaced per spec §16)
**Tags**: @backend, @api, @merge

**Preconditions**:

- One `createMergeProductionHarness` fixture whose temp checkout is left with
  `HEAD` on the integration base (`main-tools`) and whose feature branch stands at
  a distinct commit; the base tip and the request head are therefore different
  SHAs.
- The fixture writes
  `doc/changes/<YYYY-MM>/<date>--<ref>--<slug>/chg-<ref>-pm-notes.yaml` into the
  checkout with `branch: <feature branch>` (the DM-1 declaration; the read is the
  delivered `readPmNotesText` over the real temp filesystem).
- The injected transport answers the bounded open-request list with exactly one
  open entry whose `head.ref` equals the declared branch and whose `head.sha` is
  the request head; it answers the work item and the check-run page for that head.

**Steps**:

1. Run `merge <ref> --dry-run --json` from the base checkout.
2. Read `data.resolvedBranch`, `data.resolutionSource`, `data.requestIdentity`
   and `data.headSha` from the envelope.
3. Read the appended verification records and the transport request log.
4. Run `merge <ref> --json` from the same checkout with the same fixtures.

**Expected Outcome**:

- Both runs report `resolvedBranch` equal to the declared change branch,
  `resolutionSource` equal to the declared-only value, `requestIdentity` equal to
  the matched request's number, and `headSha` equal to the request head.
- `headSha` does not equal the base tip in either run; no output, record or
  evidence member contains the base tip as `headSha`/`verified head`.
- The check-run read addresses the request head (the request URL carries that
  SHA), not the base tip.
- The real merge's landing call count is 1 and its expected head is the request
  head; the dry run's count is 0.
- Wall-clock/exit: dry run exits 0 with `result=verified`; the merge exits 0 with
  `result=merged`.

**Notes / Clarifications**:

- This is owner regression (a) and the owner AC 1 carrier. The assertion is the
  SHA inequality plus the named resolution source, not "the dry run finished".

#### TC-MRG-002 - Control: the pre-fix branch source reproduces the base-tip verdict

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, NFR-6
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-production-composition.test.ts` (control in the same file as TC-MRG-001)
**Tags**: @backend, @api, @merge

**Preconditions**:

- The TC-MRG-001 fixture and data, unchanged.
- One substituted binding of the composition's branch-resolution seam to the
  checkout's own git facts — the pre-fix source (`resolvedRepositoryFacts.head.branch`),
  which is the base branch in this fixture. No pre-fix code from an earlier
  commit is executed: the control substitutes the *derivation value*, exactly as
  the delivered `defect-f1` control substitutes the pre-fix declaration.

**Steps**:

1. Run `merge <ref> --dry-run --json` with the resolution bound to the checkout
   branch.
2. Read the reported `headSha` and the appended verification record's `headSha`.
3. Run the same assertion TC-MRG-001 applies (`headSha !== base tip`).

**Expected Outcome**:

- The substituted run reports `headSha` equal to the base tip and the record's
  head equals the base tip; the TC-MRG-001 assertion fails **by name** on this
  substitution.
- The control's own message names the offending SHA and the resolution source, so
  a future weakening of TC-MRG-001 (for example dropping the inequality) is
  detectable rather than silent.
- The control performs no network call and no child process.

**Notes / Clarifications**:

- Delivered precedent for the substitution shape:
  `tests/structure/defect-f1-merge-refusal-containment.test.ts` — "no case
  executes pre-fix code from an earlier commit".

#### TC-MRG-003 - Change-branch checkout at the request head lands once at that head

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-2, API-1, DM-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-production-composition.test.ts` (update) with the landing-count oracle in `tests/behaviour/merge-landing.test.ts`
**Tags**: @backend, @api, @merge

**Preconditions**:

- The TC-MRG-001 fixture, with the checkout left on the change branch at the
  request head.
- The pm-notes declaration names the same branch; the open-request list returns
  exactly one entry asserting that head; the page is all green and the work item
  is fresh.

**Steps**:

1. Run `merge <ref> --json`.
2. Read `data.result`, `data.headSha` and the recorded landing input.
3. Read the transaction records and the git seam's operation log.

**Expected Outcome**:

- `result=merged` with `headSha` equal to the request head.
- Exactly one landing call (count 1), its expected head equal to the request
  head, and exactly one transaction record.
- The merge never lands before the verification/freshness/gate path completes:
  the operation log's landing entry is the last mutating entry, and no
  rebase/fetch/push entry exists.
- Exit 0.

#### TC-MRG-004 - No usable `branch` declaration refuses naming record path and key

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-3, DM-1, API-3, NFR-5
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-production-composition.test.ts` (new cell)
**Tags**: @backend, @api, @merge

**Preconditions**:

- Four fixture cells over the same temp checkout: (i) the pm-notes document
  exists with no `branch` key; (ii) `branch: ""`; (iii) `branch: "   "` (whitespace
  only) and a control-character value; (iv) a value longer than the declared cap.
- A second cell pair where the change record is absent entirely and where it is
  unreadable/malformed.
- The transport is recording; the state ledger is empty.

**Steps**:

1. For each cell, run `merge <ref> --json` and `merge <ref> --dry-run`.
2. Read `error.code`, `error.summary`, the transport request log and the state
   ledger.
3. Apply the same assertions to the absent-record and malformed-record cells.

**Expected Outcome**:

- Every cell exits 1 with `error.code === "merge.branch-unresolved"`.
- The summary contains the literal change-record file name
  (`chg-<ref>-pm-notes.yaml`), the key name `branch`, and the command name
  `merge`.
- `harness.transportCalls` is empty and the credential port is never read: zero
  provider reads.
- The verification ledger has zero appended records and the transaction ledger
  zero records: zero landing calls.
- No cell's output contains `merge.transaction-aborted` or `fallback.internal`.
- The remediation names the declaration to add (a record path plus the key), not
  an unnamed condition.

#### TC-MRG-005 - Zero matching open requests refuses `no-open-request`

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-4, API-3, DM-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-production-composition.test.ts` (new cell; the delivered `merge.transaction-aborted` expectation for this input is replaced)
**Tags**: @backend, @api, @merge

**Preconditions**:

- The declared branch resolves; the open-request list returns an empty page (and,
  in a second cell, entries whose `head.ref` differ by prefix, suffix or case, so
  only exact equality could match).
- The work item and check-run replies are healthy, so a wrong path would pass.

**Steps**:

1. Run `merge <ref> --json`.
2. Read `error.code`, the closed reason member and the summary.
3. Read the transport log and the state ledger.

**Expected Outcome**:

- Exit 1 with `error.code === "merge.request-unresolved"` and the closed reason
  exactly `no-open-request`.
- The summary names the resolved branch, its resolution source and the observed
  open-request count `0`.
- Near-miss branches (prefix/suffix/case variants) do not match: the same empty
  outcome, never an entry chosen by fuzzy comparison.
- Zero landing calls and zero transaction records.
- The code is a member of the composition's declared emittable set; the output
  contains no `merge.transaction-aborted`.

#### TC-MRG-006 - Two matching open requests refuses `ambiguous-open-request`

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1, AC-F1-4, API-3, DM-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-production-composition.test.ts` (new cell)
**Tags**: @backend, @api, @merge

**Preconditions**:

- The declared branch resolves; the open-request page returns two open entries
  whose provider-asserted source ref equals the declared branch exactly, with
  different heads.

**Steps**:

1. Run `merge <ref> --json`.
2. Read `error.code`, the closed reason and the summary's counts.
3. Read the state ledger and the landing count.

**Expected Outcome**:

- Exit 1 with `error.code === "merge.request-unresolved"` and the reason exactly
  `ambiguous-open-request`.
- The summary names the resolved branch and the match count `2`; neither request's
  identity is presented as *the* request.
- No head is chosen, so no verification record and no landing call exist.
- The output contains no `merge.transaction-aborted`.

#### TC-MRG-007 - A matched request with no asserted head refuses `head-unresolved`

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1, AC-F1-4, API-3, DM-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-production-composition.test.ts` (new cell)
**Tags**: @backend, @api, @merge

**Preconditions**:

- Exactly one open entry matches the declared branch, and its `head.sha` is
  absent/empty.

**Steps**:

1. Run `merge <ref> --json`.
2. Read `error.code`, the closed reason and the named request identity.
3. Read the check-run request log — no page may be requested for an absent SHA.

**Expected Outcome**:

- Exit 1 with `error.code === "merge.request-unresolved"` and the reason exactly
  `head-unresolved`.
- The summary names the resolved branch and the matched request's identity.
- No check-run read is issued for `""` or a placeholder SHA: the log contains no
  `/check-runs` request.
- Zero landing calls.

#### TC-MRG-008 - A record for the base tip refuses `merge.gates-stale` with both SHAs

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-2, AC-F1-5, API-1, NFR-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-production-composition.test.ts` (update; `tests/behaviour/merge-freshness.test.ts` TC-MERGE-010 keeps the row-level head-mismatch oracle unchanged)
**Tags**: @backend, @api, @merge

**Preconditions**:

- The base checkout declares the change branch; the request head is a distinct
  SHA.
- A fresh, otherwise valid verification record was appended whose `headSha` is the
  base tip (the `seedVerification` shape the suite already uses).

**Steps**:

1. Run `merge <ref> --json`.
2. Read `error.code` and the evidence members.
3. Read the transaction ledger and the landing count.

**Expected Outcome**:

- Exit 1 with `error.code === "merge.gates-stale"`.
- The evidence carries both SHAs: the recorded head equals the base tip and the
  current/resolved head equals the request head, field by field.
- The freshness comparison is against the resolved head, not the checkout: the
  same record with the request head as its `headSha` would pass (paired control,
  asserting exit 0 and one landing).
- Zero landing calls and zero transaction records for the stale cell.

#### TC-MRG-009 - The `branch` declaration is lint-opaque and value-faithfully preserved

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: DM-1, F-1, AC-F1-3
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/pm-notes-lint.test.ts` (extend `TC-LINT-006` "opaque extra keys") and the phase document-write suites over `tests/behaviour/phase-support.ts`
**Tags**: @backend, @config

**Preconditions**:

- A pm-notes fixture carrying `branch: <feature branch>` as an extra top-level
  key alongside the canonical keys; a second fixture carrying a control-character
  value to prove lint never inspects it.

**Steps**:

1. Lint both fixtures and read the verdict.
2. Stage one phase `complete` edit over the document and read the staged text.
3. Re-read the declaration value from the staged document.

**Expected Outcome**:

- Lint returns `{ ok: true }` with the delivered variant for both fixtures: the
  key is opaque and never validated.
- The staged document preserves the `branch` value byte-for-byte (same decoded
  scalar), and the phase entry's own `started`/`completed` mutation is the only
  change.
- No new lint rule id, key set or failure code appears: the lint registry is an
  exact-set equality with the delivered one.

#### TC-MRG-010 - One failing required check refuses with the check, gate and reason named

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-1, EVT-1, NFR-5, API-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-production-composition.test.ts` (update `TC-ENGINE-051` to the default set; the per-state matrix stays in `tests/behaviour/merge-required-job-probe.test.ts`)
**Tags**: @backend, @api, @merge

**Preconditions**:

- **No authored `merge.gates` declaration**: the shipped default set is in force,
  so the merge projection is `ci-green` + `tracker-freshness`.
- A fresh verification record for the resolved head; a repository CI workflow
  whose expected job set is `CI / test`; the check-run page for the resolved head
  reports that one job `completed`/`failure`.

**Steps**:

1. Run `merge <ref> --json` and then text mode.
2. Read `error.code`, the gate id in the code, the job name and the reason in the
   evidence/summary.
3. Read `data.gates` if a report is produced, plus the landing count and the
   transaction ledger.
4. Run the same fixture with the job `success` (the contrast cell).

**Expected Outcome**:

- Exit 1 with `error.code === "merge.gate.<gate-id>.failed"` where the gate id is
  the effective CI gate and the code is **not** the tracker gate id.
- The summary names the offending job (`CI / test`), the gate id and the delivered
  reason `ci-failed`; the attribution value is one of the closed pair
  (`probe` for this fixture).
- Zero landing calls; zero transaction records; no `fallback.internal` anywhere.
- The contrast cell exits 0 with `result=merged` and exactly one landing, so a
  green and a failing request never share a verdict.

**Notes / Clarifications**:

- Owner regression (b). The gate id is read from the effective set rather than
  hard-coded, because `ci-green` is the built-in id and an authored set may carry
  a `ci-required` entry; asserting one literal would let a rename slip by.

#### TC-MRG-011 - All-green dry run verifies and the merge lands once, distinct from red

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-5, AC-F2-3, API-2, EVT-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-dry-run.test.ts` (update: the merge-applicable set is now two entries) with the landing count in `tests/behaviour/merge-landing.test.ts`
**Tags**: @backend, @api, @merge

**Preconditions**:

- The shipped default set; all expected jobs green on the resolved head; the
  tracker gate fresh.
- The same fixture family as TC-MRG-010's contrast cell.

**Steps**:

1. Run `merge <ref> --dry-run --json`, then `merge <ref> --json`.
2. Read `data.result`, `data.gates` (ids and verdicts), the verification records
   and the transaction records.
3. Compare with the failing-cell verdict from TC-MRG-010.

**Expected Outcome**:

- Dry run exits 0 with `result=verified` and a `gates` array whose merge-applicable
  length is 2, containing the CI entry and `tracker-freshness`, both `pass`.
- Exactly one verification record appended by the dry run; zero transactions;
  zero waivers; zero landing calls.
- The real merge exits 0 with `result=merged` and exactly one landing at the
  resolved head, exactly one transaction record.
- The green verdict and the failing verdict differ in exit code, `result` and
  the gate entry: `toEqual` on the two reports fails.

#### TC-MRG-012 - A queued or running required check refuses with the pending reason

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-2, NFR-5, API-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-required-job-probe.test.ts` (extend `TC-F3-002`)
**Tags**: @backend, @api, @merge

**Preconditions**:

- The default set (or an authored set with a declared `required-ci-job`) over the
  transaction harness; a fresh verification record for the head.
- Two cells: one job with `status: "queued"`, one with `status: "running"`, both
  for the same required job name on the resolved head.

**Steps**:

1. Run the transaction for each cell.
2. Read the refusal code, the reason, the named job and the evidence members.
3. Read the landing count and the appended records.

**Expected Outcome**:

- Both cells refuse on `merge.gate.<gate-id>.failed` at exit 1 with the reason
  exactly `ci-pending` and the job name present in the names/evidence.
- No cell reports a pass, `verified`, or an empty evidence list: pending is not
  green.
- Zero landing calls in both cells; the verification record is unchanged (the
  refusal precedes any append).
- Control: the same page with the job `completed`/`success` yields no finding, so
  the assertion is sensitive to the state rather than to the fixture's existence.

#### TC-MRG-013 - A check-run page for another SHA is never head evidence

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-4, NFR-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-required-job-probe.test.ts` (extend `TC-F3-005` to the widened required set)
**Tags**: @backend, @api, @merge

**Preconditions**:

- A page whose `sha` is a different commit from the resolved head, carrying a
  green job set; the same page bytes are reused in a second cell labelled with
  the resolved head.

**Steps**:

1. Run the transaction/merge for the other-SHA cell.
2. Read the refusal code, the reason and the SHA evidence.
3. Run the labelled control cell and read the verdict.

**Expected Outcome**:

- The other-SHA cell never passes: it refuses on the family with the delivered
  `head-unresolved` reason, naming both SHAs (`pageSha` and `headSha`).
- The green content of the other-head page is not used as a pass; no `verified`
  or `merged` result exists.
- The labelled control with identical bytes passes, proving the discriminator is
  the page SHA.
- Zero landing calls on the other-SHA cell.

#### TC-MRG-014 - A CI read fault names the failed operation and never passes

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-3, AC-F2-5, NFR-5, API-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-production-composition.test.ts` (extend `TC-ENGINE-053`)
**Tags**: @backend, @api, @merge

**Preconditions**:

- The composition harness with three transport cells for the check-runs read:
  HTTP 500, HTTP 401/403, and a malformed payload; every other read healthy.

**Steps**:

1. Run `merge <ref> --json` for each cell.
2. Read `error.code`, the exit code and the summary's operation token.
3. Read the state ledger and the landing count.

**Expected Outcome**:

- Each cell exits with the declared row's projection: `provider.outage` at exit 2
  for the 500/malformed cells and `provider.auth.rejected` at exit 1 for the
  401 cell (both resolved from `ERROR_TABLE`, never transcribed).
- The summary names the failed operation from the declared gate-source vocabulary
  — the literal token `github-check-runs` — and no cell treats the fault as a
  passed gate (no `verified`, no `merged`).
- Zero landing calls and zero appended records in every cell.
- No cell renders `fallback.internal` or `merge.transaction-aborted`.

#### TC-MRG-015 - A declared required job is enforced; an undeclared job is not evidence

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-6, DM-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-required-job-probe.test.ts` (extend `TC-F3-004`)
**Tags**: @backend, @api, @merge

**Preconditions**:

- An authored gate set declaring `{ id: ci-required, recipe: required-ci-job, surface: merge, job: "CI / test" }`
  and no other required-job entry.
- A page where `CI / test` is green and a second job (`lint / docs`, not declared
  and not in the repository expected set) is red.

**Steps**:

1. Run the merge and read the verdict.
2. Flip the declared job to red and re-run.
3. Read the named jobs in both outcomes.

**Expected Outcome**:

- Cell 1 exits 0 / `merged` with exactly one landing: the undeclared red job is
  not gate evidence and appears in no refusal evidence.
- Cell 2 refuses `merge.gate.ci-required.failed` naming `CI / test` and never
  `lint / docs`.
- Control: the page-wide rule that would name any red job is shown to differ —
  run the same page with `lint / docs` added to the effective set, and the
  refusal then names it. The discriminator is membership, not redness.
- The page's state is authoritative and the gate set's membership is
  authoritative: no cell contradicts either direction.

#### TC-MRG-016 - Built-ins stay reserved, mandatory and recipe/class-immutable

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-2, AC-F2-7, DM-3
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-gate-set.test.ts` (extend `TC-MERGE-003`) with the registry pin in `tests/structure/merge-contract.test.ts` (`TC-MERGE-001`)
**Tags**: @backend, @config

**Preconditions**:

- The five reserved ids read from `MERGE_BUILTIN_GATE_IDS`; the shipped classes
  read from the delivered registry/default set.

**Steps**:

1. Resolve a set omitting each built-in in turn; read the refusal.
2. Resolve a set declaring a built-in with a different recipe, and one with a
   different class.
3. Resolve a set omitting `class` on `owner-gate` and read the effective class.
4. Resolve duplicated ids, unknown recipes, empty ids and extra fields.

**Expected Outcome**:

- Each omission exits 1 with the declared configuration refusal naming the missing
  entry id.
- A changed recipe or a changed class exits 1 naming the entry id and the field;
  no declaration can retype a built-in.
- An omitted `class` on `owner-gate` resolves to the shipped class
  `owner-review`, and the effective set cites that class.
- Duplicate ids, unknown recipes, empty ids and extra fields each refuse by name;
  the effective set is never partially applied (zero reads, zero appends, zero
  mutations on every refusal cell).

#### TC-MRG-017 - Admitted surface sets admit `ci-green` on `battery`/`both` only

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-7, DM-3
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-gate-set.test.ts` (update `TC-MERGE-004`) + `tests/structure/merge-contract.test.ts` (default-set pin)
**Tags**: @backend, @config

**Preconditions**:

- The declared admitted surface sets for the five built-ins (contract data).

**Steps**:

1. Resolve `ci-green` on `battery`, then on `both`, then on `merge`.
2. Resolve each of the other four built-ins on `battery`, then on `both`, then on
   `merge`.
3. Read the effective merge projection for each accepted cell.
4. Read the shipped default set and its effective identity.

**Expected Outcome**:

- `ci-green` on `battery` and on `both` both resolve; on `merge` the set is
  refused naming the entry id and the surface, because `merge` is not in its
  admitted surface set.
- `lifecycle-finalization`, `push-parity`, `owner-gate` and `squash-preflight`
  resolve on `battery` only; `both` and `merge` each refuse naming the id.
- The shipped default set's merge projection is exactly the two ids
  (`ci-green`, `tracker-freshness`) and its entry-id sequence is unchanged from
  the delivered six ids in shipped order.
- `surface: battery` on `ci-green` remains accepted and produces a
  one-entry merge projection (the documented opt-out), so the rule is an
  admission rule and not a removal.

#### TC-MRG-018 - An invalid repository expected-job set refuses and never passes

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-2, AC-F2-1, NFR-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-required-job-probe.test.ts` (new cell) with the expected-set validity rule reused from `tests/behaviour/verify-gates-ci.test.ts`
**Tags**: @backend, @config, @merge

**Preconditions**:

- Five cells for the repository-declared expected job set: unreadable, empty,
  malformed, duplicated, and over the declared cap; the check-run page is green
  in every cell so a lenient path would pass.

**Steps**:

1. Run `merge <ref>` for each cell.
2. Read the refusal code, the gate id and the named condition.
3. Read the landing count.

**Expected Outcome**:

- Every cell refuses naming the CI gate and the invalid-expected-set condition
  (the delivered `ci-expected-jobs-invalid` reason) at exit 1.
- No cell reports `verified` or lands; the green page is never treated as a
  sufficient signal on its own.
- The summary names the gate id and the condition; the remediation names the
  declared surface opt-out or the workflow repair, not an unnamed condition.
- Zero landing calls in all five cells.

#### TC-MRG-019 - The dry run discloses the evaluated required-check posture

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-2, API-2, DM-2, DM-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-dry-run.test.ts` (new cell)
**Tags**: @backend, @api, @merge

**Preconditions**:

- Two fixtures: (i) the shipped default set with a repository expected set of
  three jobs; (ii) an authored set that declares no required-check entry and puts
  `ci-green` on `battery`.

**Steps**:

1. Run `merge <ref> --dry-run --json` for each fixture.
2. Read the disclosed evaluated required-check count and set size.
3. Read the gate entries and their verdicts.

**Expected Outcome**:

- Fixture (i) reports an evaluated required-check count of 3 and a set size of 3,
  and the CI gate is present with its per-job evaluation.
- Fixture (ii) reports an evaluated required-check count of 0 **explicitly**
  (the field is present and zero), and the merge projection contains only
  `tracker-freshness`: the authored posture is visible, not silent.
- Both dry runs exit 0 or 1 according to the gates, land nothing, and append one
  verification record.

#### TC-MRG-020 - An absent token names reference, environment variable and operation

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-2, API-3, NFR-9
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-production-composition.test.ts` (update `TC-ENGINE-052`)
**Tags**: @backend, @api, @security

**Preconditions**:

- The composition harness with no `GITHUB_TOKEN` in the injected environment and
  the credential port in its declared `missing` mode; a fresh verification record
  so the refusal is reached on the read path, not on state.

**Steps**:

1. Run `merge <ref> --json` and text mode, and again with `--dry-run`.
2. Read `error.code`, `error.summary` and the exit code.
3. Read the transport log, credential read counter, state ledger and landing
   count.

**Expected Outcome**:

- Exit 1 with `error.code === "config.credential.missing"`.
- The summary contains the credential reference `github-read`, the environment
  variable name `GITHUB_TOKEN`, and the read operation that required it (a
  declared gate-source token such as `github-work-item` or `github-check-runs`).
- The credential **value** never appears (assert against the canary/harness
  material).
- Zero provider requests leave the process, zero records are appended, zero
  landing calls.
- No invocation cell renders `merge.transaction-aborted` or `fallback.internal`.

**Notes / Clarifications**:

- Owner regression (c). The assertion is the three literal tokens plus the exit
  code; "the refusal mentions a credential" would not carry the owner's item.

#### TC-MRG-021 - A credential condition is never `merge.transaction-aborted`

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-3, AC-F3-2, API-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-production-composition.test.ts` (new assertion over the credential cells)
**Tags**: @backend, @api, @security

**Preconditions**:

- Two credential cells: the port refuses `config.credential.missing`; the
  provider answers 401/403 (`provider.auth.rejected`).
- Both run on the same fixture, once on the read path and once on the landing
  path.

**Steps**:

1. Run all four cells and read the code and summary of each.
2. Assert the code is the declared credential/auth identity in each cell.
3. Scan the serialized output and appends for the abort identity.

**Expected Outcome**:

- The absent-credential cells report `config.credential.missing`; the rejected
  credential cells report `provider.auth.rejected`, each at its row's declared
  exit.
- The string `merge.transaction-aborted` appears in **no** output, evidence member
  or record of any credential cell.
- Both codes are members of `MERGE_COMPOSITION_EMITTABLE_CODES`; the row each
  resolves to has `domainKind` `config` / `provider` respectively.
- Zero landing calls.

#### TC-MRG-022 - An unresolvable work item refuses with its own identity and cause

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-4, API-3, NFR-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-production-composition.test.ts` (update `TC-ENGINE-053`'s unresolved cell, whose expectation changes from `merge.transaction-aborted` to the new identity)
**Tags**: @backend, @api, @merge

**Preconditions**:

- The declared branch and request resolve; the work-item read returns
  `provider.not-found` (and, in a second cell, a malformed payload).
- A fresh verification record exists so the work-item read is reached.

**Steps**:

1. Run `merge <ref> --json`.
2. Read `error.code`, the exit code, the named ref and the operation token.
3. Read the remediation text and the state ledger.

**Expected Outcome**:

- Exit 1 with `error.code === "merge.work-item-unresolved"`.
- The summary names the invocation's work-item ref (`<PREFIX>-<n>`) and the read
  operation (`github-work-item`).
- The remediation names that cause (repair the ref or the tracker), not "clear
  the named pre-condition" without a name.
- The code is in the declared emittable set; the output contains no
  `merge.transaction-aborted`.
- Zero landing calls; the verification record count is unchanged (no second
  append).

#### TC-MRG-023 - Every Appendix B refusal names command, code and a cause

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1, API-3, NFR-5
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-refusal-surface.test.ts` (extend `TC-MERGE-012`) with the taxonomy cells in `tests/behaviour/merge-refusal-taxonomy.test.ts`
**Tags**: @backend, @api, @merge

**Preconditions**:

- One table-driven case with 22 enumerated cells, one per concrete refusal the
  merge command emits, each cell a fixture over the harness that reaches that
  refusal.

**Steps**:

1. For each enumerated cell, drive the fixture and capture the envelope and text.
2. Assert, per cell, the row-projected exit, the exact code, the command token
   `merge`, the named-cause token(s) and the remediation shape.
3. Assert the remediation is actionable or absent, never a request to clear an
   unnamed condition.

**Expected Outcome**:

All 22 cells exit with the exit projected from their declared row and carry
exactly the expected code:

| Cell | Code | Named cause asserted |
|------|------|----------------------|
| 1 | `merge.branch-unresolved` | record path `chg-<ref>-pm-notes.yaml` + key `branch` |
| 2 | `merge.request-unresolved` (`no-open-request`) | resolved branch + source + open count `0` |
| 3 | `merge.request-unresolved` (`ambiguous-open-request`) | resolved branch + match count `2` |
| 4 | `merge.request-unresolved` (`head-unresolved`) | resolved branch + request identity |
| 5 | `merge.work-item-unresolved` | work-item ref + `github-work-item` |
| 6 | `merge.gate.<id>.failed` (failing) | gate id + job + `ci-failed` + attribution |
| 7 | `merge.gate.<id>.failed` (canceled) | gate id + job + `ci-canceled` |
| 8 | `merge.gate.<id>.failed` (skipped) | gate id + job + `ci-all-skipped` |
| 9 | `merge.gate.<id>.failed` (pending) | gate id + job + `ci-pending` |
| 10 | `merge.gate.<id>.failed` (missing) | gate id + missing job name |
| 11 | `merge.gate.<id>.failed` (page not head) | gate id + both SHAs |
| 12 | `merge.gates-stale` | both SHAs (base-tip cell) |
| 13 | `merge.state-unverified` | the state reason |
| 14 | `config.credential.missing` | `github-read` + `GITHUB_TOKEN` + operation |
| 15 | `provider.auth.rejected` | reference + operation |
| 16 | `provider.outage` | failed operation token |
| 17 | `merge.transaction-aborted` | the named pre-mutation condition |
| 18 | `merge.sync-required` | delivered causes (unchanged) |
| 19 | `merge.mergeability-unknown` | delivered causes (unchanged) |
| 20 | `merge.landing-unverified` | delivered causes (unchanged) |
| 21 | `merge.owner-gate-override-without-waiver` | delivered causes (unchanged) |
| 22 | `merge.waiver-unauthorized` | gate + class + authorizer |

- Every cell's summary contains the literal command name `merge`.
- Every cell's remediation either names an object the refusal named, or is
  absent; the literal phrase "named condition" appears in no cell's remediation
  without an accompanying name.
- No cell's output contains `fallback.internal`.

**Notes / Clarifications**:

- Cells 18–22 are the delivered rows whose contract is unchanged: tying them to
  their delivered behaviour is the regression half of the matrix, not a claim
  that they were repaired.

#### TC-MRG-024 - Control: an unnamed cause or unnamed-remediation hint is flagged

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1, NFR-5
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-refusal-surface.test.ts` (control paired with TC-MRG-023)
**Tags**: @backend, @api, @merge

**Preconditions**:

- The TC-MRG-023 matrix predicate extracted as a function over
  `(code, summary, remediation, evidence)`.

**Steps**:

1. Feed the predicate a refusal summary with the command and code but no named
   object.
2. Feed it a remediation of the delivered pre-change shape ("Clear the named
   pre-mutation condition and retry; a re-run converges.") with no named
   condition.
3. Feed it a compliant cell and compare.

**Expected Outcome**:

- Case 1 is flagged as "no named cause" and the finding names the missing
  dimension.
- Case 2 is flagged as "remediation instructs clearing an unnamed condition".
- Case 3 passes.
- The control fails **by name**: removing any one of the three dimensions from a
  compliant cell makes the predicate report it, so TC-MRG-023 cannot pass
  vacuously.

#### TC-MRG-025 - `retryable` is always the emitted row's declared value

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-5, API-3
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-refusal-surface.test.ts` (extend `TC-MERGE-013`) + `tests/structure/merge-refusal-rows.test.ts`
**Tags**: @backend, @api, @merge

**Preconditions**:

- The 22 TC-MRG-023 cells; the declared rows from `ERROR_TABLE` and
  `ERROR_TABLE_FAMILIES`.

**Steps**:

1. For every cell, compare `envelope.error.retryable` to the resolved row's
   `retryable` (family instance → the family row's value).
2. Compare `category`, `consequence` and `projectionClass`-derived exit in the
   same pass.
3. Read the code path for any per-instance assignment.

**Expected Outcome**:

- Every cell's `error.retryable` equals its row's declared value exactly; no cell
  differs.
- Family instances (`merge.gate.<id>.failed`) all carry the family row's single
  value, whatever the reason, so two causes of one family never disagree on
  `retryable`.
- A source read of the merge path finds no assignment of `retryable` outside the
  row/family projection helper (grep-level absence with a planted control).

#### TC-MRG-026 - No row claims `retryable: true` over an act-requiring cause

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-6, API-3, NFR-5
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/merge-refusal-rows.test.ts` (new case over the row declarations)
**Tags**: @backend, @api, @merge

**Preconditions**:

- The merge refusal surface's declared rows and families, read from the machine
  table.
- The reachable cause set per row, read from the enumerated matrix
  (TC-MRG-023) plus the spec's Appendix B "Act required" column encoded as
  declared data next to the matrix (one entry per code/reason cell).

**Steps**:

1. For each merge row and family, compute the reachable causes and whether any
   cause is act-requiring.
2. Assert `retryable === false` whenever an act-requiring cause is reachable.
3. Assert `merge.transaction-aborted`'s narrowed reachable set is empty of
   act-requiring causes **or** the row declares `retryable: false` — and that its
   remediation contains no promise of convergence in the first case.
4. Run the mutation control.

**Expected Outcome**:

- Every row that reaches an act-requiring cause declares `retryable: false`; no
  row declares `true` over such a cause.
- `merge.transaction-aborted` satisfies one of the two declared shapes, and the
  choice is asserted (not accepted as either-or without evidence): either its
  reachable causes are all act-free and its remediation's convergence claim is
  true of them, or it declares `retryable: false` and carries no convergence
  hint.
- **Mutation control**: with the delivered pre-change row substituted
  (`merge.transaction-aborted` with `retryable: true`, the convergence hint, and
  the credential/unresolvable causes still routed to it), the predicate reports
  exactly that row by name and fails; the production row passes.
- No family slot is widened to satisfy the rule (asserted in TC-MRG-029).

#### TC-MRG-027 - A pending cause converges without an act and its remediation says so

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-3, AC-F3-5, AC-F2-2, API-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-required-job-probe.test.ts` (pending cell) + `tests/behaviour/merge-refusal-surface.test.ts` (rendering)
**Tags**: @backend, @api, @merge

**Preconditions**:

- The pending fixture from TC-MRG-012 and the failing fixture from TC-MRG-010,
  both on the same family row.

**Steps**:

1. Render both refusals in text and JSON.
2. Read the reason, the `retryable` value and the remediation of each.
3. Compare the two renderings for cause-specific guidance.

**Expected Outcome**:

- Both carry the family row's `retryable` value (`false`) — neither is a
  per-instance `true`.
- The pending refusal's named reason is `ci-pending` and its remediation states
  that the condition clears without an operator act (waiting), rather than
  instructing a repair that does not apply.
- The failing refusal's remediation names the repair or the declared surface
  opt-out.
- Neither remediation instructs clearing a condition it does not name; the
  pending and failing renderings are distinguishable without parsing prose
  beyond the declared reason.

#### TC-MRG-028 - A gate refusal resolves to its declared family row, gate id preserved

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, NFR-7, API-3
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/defect-f1-merge-refusal-containment.test.ts` (extend the effective-gate-id derivation) + `tests/structure/merge-classification-conformance.test.ts`
**Tags**: @backend, @api

**Preconditions**:

- The composition's exported emittable declaration and family expression; the
  effective gate ids derived from the shipped default set plus a declared
  `required-ci-job` entry, so the family-instance population is the widened one.

**Steps**:

1. Derive every code the transaction's refusal branches can emit, plus one family
   instance per effective gate id.
2. Assert the production declaration covers all of them and expresses the family
   as a family.
3. Resolve and classify one live gate refusal end to end.
4. Assert the gate id is preserved in the code and in the summary.

**Expected Outcome**:

- The uncovered set is empty; the family-instance count equals the effective
  gate-id count.
- `merge.gate.<id>.failed` resolves to the declared family entry with
  `domainKind` `merge` and exit 1; `classifyThrown({ kind: "merge", code })`
  returns the same code.
- The live refusal's code is exactly `merge.gate.<effective-id>.failed`, its
  summary names that gate id, and `fallback.internal` appears in neither the
  outcome nor the summary.
- The reference page, feature spec and test specification describe the same
  family (asserted in TC-MRG-038's doc surfaces).

#### TC-MRG-029 - A live mismatch control still reaches containment; no slot widening

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, NFR-7
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/defect-f1-merge-refusal-containment.test.ts` (control) + `tests/structure/merge-classification-conformance.test.ts` (slot rule)
**Tags**: @backend

**Preconditions**:

- The declared family prefix/suffix and template; the effective gate-set id set.

**Steps**:

1. Classify a family code under a mismatched kind (`provider`).
2. Classify a family code whose slot is not in the effective gate set.
3. Read the family declaration's template, prefix and suffix.
4. Read the effective gate-set id sequence.

**Expected Outcome**:

- Case 1 returns `fallback.internal` (the containment identity), and the same
  code on its own kind resolves — the branch is live, not dead.
- Case 2 does **not** resolve to a declared pass: an unvalidated slot is refused
  at emission, so pattern widening cannot be used to gain coverage.
- The family declaration is exactly
  `merge.gate.<gate-id>.failed` with `slotPrefix: "merge.gate."` and
  `slotSuffix: ".failed"`; no wildcard, alternation or optional slot exists.
- The effective gate-set id sequence equals the delivered sequence (no new gate
  id was added to close the gap).

#### TC-MRG-030 - Dry run and real merge report the same branch, request and head

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1, API-1, API-2, DM-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-production-composition.test.ts` (new case)
**Tags**: @backend, @api, @merge

**Preconditions**:

- One fixture, one invocation context, one resolved branch/request/head; the
  request list page order is varied between runs to prove the match is by
  equality and not by position.

**Steps**:

1. Run `merge <ref> --dry-run --json` and capture the four resolved facts.
2. Run `merge <ref> --json` in a fresh state on the same fixture.
3. Compare the reported resolved branch, resolution source, request identity and
   resolved head.

**Expected Outcome**:

- The four facts are equal across the two runs, field by field (`toEqual` on the
  projected object).
- Both name the same request identity, not merely the same branch.
- The real merge's landing expected head equals the dry run's reported head.
- Neither report contains the checkout's base branch as any resolved fact.

#### TC-MRG-031 - A base-checkout dry run records the resolved head with zero mutation

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-2, API-2, EVT-1, DM-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-production-composition.test.ts` (update `TC-ENGINE-050`) + `tests/behaviour/merge-verification-record.test.ts`
**Tags**: @backend, @api, @merge

**Preconditions**:

- The TC-MRG-001 fixture: `HEAD` on the integration base, the change record
  declaring the change branch, a healthy request/check/work-item set.

**Steps**:

1. Run `merge <ref> --dry-run --json` and read the appended verification record.
2. Read the waiver, transaction and git-operation state.
3. Render text mode and scan it.

**Expected Outcome**:

- Exactly one verification record appended, whose `headSha` equals the resolved
  request head and whose `verifiedAt`/identity are the fixture's declared values.
- Zero waivers, zero transactions; the git seam records no `squash-land`,
  `rebase-refresh`, push, fetch or head mutation; the checkout's `HEAD` still
  points at the base branch and its SHA is unchanged after the run.
- Neither stdout nor stderr contains `result=merged` or `squash=`.
- Exit 0 with `result=verified` and `gates` of length 2 (both passing).

#### TC-MRG-032 - The merge-surface CI entry is cited by source; battery records unchanged

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: Important
**Related IDs**: EVT-1, F-2, F-5
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-verification-record.test.ts` (extend `TC-MERGE-005`/`006`) + `tests/golden/verify-gates.test.ts` (unchanged, as the non-regression oracle)
**Tags**: @backend, @api

**Preconditions**:

- A merge-surface dry run over the shipped default set and a `verify gates` run
  over the same facts.

**Steps**:

1. Read the dry-run record: kind, schema, gate entries and each entry's citation
   sources.
2. Read the battery record for the same facts and its byte-pinned golden.
3. Compare the schemas and the citation vocabularies.

**Expected Outcome**:

- The dry-run record is kind `delivery.merge.gate-verification.v1` with unchanged
  schema; it carries two entries (CI + tracker), and the CI entry's citation
  declares `repository-ci-workflow` **and** `github-check-runs`.
- The battery record is byte-identical to its golden and its CI citation is
  unchanged: `verify gates` records are not re-pointed.
- A reader can distinguish a merge-surface CI evaluation from a battery one by
  the declared sources, with no new source token.

#### TC-MRG-033 - Twenty runs are byte-identical across six scenarios

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: NFR-1
**Test Type(s)**: Integration, Performance
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-determinism.test.ts` (extend `TC-MERGE-035`'s scenario list)
**Tags**: @backend, @perf

**Preconditions**:

- Six scenarios: one success plus five refusals — `merge.branch-unresolved`,
  `merge.request-unresolved`, a gate failure, a pending check, and
  `config.credential.missing`.
- A fresh harness per run (fresh temp state root, fresh fixture), fixed clock and
  fixed run id.

**Steps**:

1. Run each scenario 20 times and compare stdout, stderr and exit code to the
   first run.
2. Run the changed-fact control (one route, label or SHA flipped).

**Expected Outcome**:

- All 20 runs of each scenario are byte-identical on stdout and stderr and share
  the same exit code; the run id is the only permitted variance and is injected.
- The changed-fact control differs from its base scenario (asserted by
  inequality, not by a snapshot), proving the comparison is not vacuous.
- No scenario's output depends on iteration order, time of day, or state-root
  path.

#### TC-MRG-034 - The per-invocation read budget holds exactly

**Scenario Type**: Corner Case
**Impact Level**: High
**Priority**: High
**Related IDs**: NFR-2, DM-2, API-1
**Test Type(s)**: Integration, Performance, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-probe.test.ts` (extend `TC-MERGE-032`) + `tests/behaviour/merge-production-composition.test.ts` (composition-wide transport log)
**Tags**: @backend, @perf

**Preconditions**:

- A success fixture and the five refusal fixtures; a recording filesystem for the
  change-record and workflow reads, and the recording transport for provider
  reads.

**Steps**:

1. For each fixture, run one invocation and read every counter.
2. Build the exact multiset of reads and compare it to the budget.
3. Drive the `not-mergeable` and `unknown` cells to count the two permitted
   re-reads.

**Expected Outcome**:

- Success: exactly one change-record read, one open-request list read, one
  request-detail read, one work-item read, one CI-workflow read, one check-run
  page **on the resolved head SHA**, one verification read, and at most one
  landing.
- Zero retries and zero pagination: no endpoint is requested twice except the
  declared post-refusal and unknown-recovery allowances, each capped at one and
  asserted by name.
- Refusal fixtures stop at the read that refused: the branch-unresolved cell
  performs exactly one change-record read and zero provider reads.
- No read addresses a SHA other than the resolved head on the check-run path.

#### TC-MRG-035 - Machine and human output stay inside the declared bounds

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: NFR-3
**Test Type(s)**: Integration, Performance
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-bounds.test.ts` (extend `TC-MERGE-033`)
**Tags**: @backend, @perf

**Preconditions**:

- Fixtures that maximize the new evidence: many required jobs (over the display
  cap), a long resolved branch name, a large resolved-head/request-identity set,
  and a refusal carrying both SHAs.

**Steps**:

1. Measure the machine `data` bytes (UTF-8) and the human summary lines/bytes.
2. Read the omission marks for every dropped list.
3. Compare against the declared caps.

**Expected Outcome**:

- Machine `data` is ≤ 65 536 UTF-8 bytes; the human summary is ≤ 24 lines and
  ≤ 4 096 UTF-8 bytes, in both text and scripted modes.
- Every dropped item is marked `+N`, and `N` equals the true remainder
  (over-cap count minus displayed count).
- No new field is unbounded: the resolved facts (branch, source, request
  identity, head) are single bounded scalars, and the required-check count is a
  number, not a list.

#### TC-MRG-036 - The new suites are offline: no network, no child process

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-4, AC-F5-3, F-1, F-2, F-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/merge-deploy-no-live-calls.test.ts` (extend `DEFAULT_MODULES`) + `tests/checks/merge-suite-discovery.test.ts` (static scan of new suites)
**Tags**: @backend, @security

**Preconditions**:

- The throwing fetch guard; the harness spawn seam; the new suites' sources.

**Steps**:

1. Run the new behaviour cells with the guard installed and read `guard.calls`.
2. Read the spawn-seam invocation count across the new cells.
3. Run the static scan over the new suites for network/transport/child-process
   imports and call sites.

**Expected Outcome**:

- `guard.calls` is `[]` after every new case; the deliberate-call positive
  control still throws, so the guard is live.
- The spawn seam records zero invocations.
- The static scan finds no `fetch(`, no transport import and no `child_process`
  / spawn site in the new suites; the delivered no-live-call modules stay green.
- The suite-discovery check admits every new file (not under `tmp/`, not a
  fixture) and the pinned CI topology is unchanged.

#### TC-MRG-037 - The merge path reads no ambient branch, proven by a scan with a control

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-6, F-1, G-1
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/merge-branch-read-scan.test.ts` (new; precedent `tests/checks/merge-landing-retirement.test.ts`)
**Tags**: @backend

**Preconditions**:

- The merge path's production sources: the merge composition in
  `packages/cli/src/production.ts`, `packages/cli/src/commands/merge.ts`,
  `packages/core/src/domain/merge-transaction.ts` and the merge adapters; every
  product source is scanned so a composition site in another package is found.

**Steps**:

1. Scan the merge path for a read of the checkout's branch
   (`resolvedRepositoryFacts.head.branch` and equivalent git-facts branch reads).
2. Record findings as `file:line`.
3. Plant the pre-fix read into a temp copy of the scanned tree and re-run the
   same matcher.
4. Confirm the change-record read is present and is the only branch source.

**Expected Outcome**:

- The production scan's finding set is empty.
- The planted control is found and named by `file:line`; the matcher therefore
  cannot pass vacuously.
- The change-record read (`readPmNotesText` over the change folder) is present
  and the resolution source it feeds is the declared one — the scan asserts the
  positive source, not only the absence.
- No `git branch`/`rev-parse --abbrev-ref` invocation exists on the merge path.

#### TC-MRG-038 - Identities move 167 → 170 with the gate-set identity unchanged

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-8, F-3, F-4, DM-3
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/error-table.test.ts` (`TC-SYNC-001`), `tests/checks/error-table-sync.test.ts`, `tests/structure/merge-refusal-rows.test.ts`, plus the three doc surfaces
**Tags**: @backend, @docs

**Preconditions**:

- The machine table, the documented table, the seven identity pin sites, the two
  identity-count pages, the merge reference page, the merge feature spec and the
  merge test specification.

**Steps**:

1. Run the two-table sync check and read both counts.
2. Assert the delta is exactly the three additive rows.
3. Read every identity pin site and count page.
4. Read the effective gate-set identity string.
5. Read the three merge doc surfaces for the same total and the same family.

**Expected Outcome**:

- Both tables report 170 entries and 170 documented rows; the machine merge kind
  count is 12 (9 → 12) and the delivered rows are neither removed, retyped nor
  reworded.
- The delta is exactly `merge.branch-unresolved`, `merge.request-unresolved`,
  `merge.work-item-unresolved`, each documented exactly once.
- All seven pin sites carry `170` and no stale total (`167`, `164`, `156`)
  survives; the two identity-count pages carry the moved numbers.
- The merge reference page, the merge feature spec and the merge test
  specification state the same total and the same refusal family.
- The effective gate-set identity is unchanged:
  `delivery.merge.gates.v1:[lifecycle-finalization,ci-green,push-parity,owner-gate,squash-preflight,tracker-freshness]`
  — the surface of `ci-green` moves, the id sequence does not.
- The family declarations are unchanged (no pattern widening, no third family).

#### TC-MRG-039 - Canary secrets never reach output or records

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-9, AC-F3-2, §20
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-privacy.test.ts` (extend `TC-MERGE-034`)
**Tags**: @backend, @security

**Preconditions**:

- Canary values planted in: the credential material, the request title/body, the
  work-item title and comment body, the raw check-run payload, and a log line —
  the delivered six-canary set plus a canary secret value.
- The refusal cells that report a credential reference and an environment
  variable, and the cells that report a work-item ref.

**Steps**:

1. Drive the success path and every new refusal cell (including the credential
   cells).
2. Scan stdout, stderr, the envelope, and every appended record.
3. Assert the allowed identifiers are present.

**Expected Outcome**:

- None of the canaries appears in any output or record; the credential **value**
  never appears while `github-read` and `GITHUB_TOKEN` do.
- The allowed identity fields (ref, head SHA, gate id, `ci-green`) remain present,
  so the scan is not passing by removing everything.
- The secret-read allowlist is an exact-set equality with the delivered one: no
  new entry was added to name a credential.
- The mutation control (a title copied into evidence) is detected by the same
  scan.

#### TC-MRG-040 - The added reads are two filesystem reads and no added polling

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: NFR-10, NFR-2, DM-2
**Test Type(s)**: Integration, Performance
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-probe.test.ts` (count delta) + `tests/behaviour/merge-production-composition.test.ts` (transport log)
**Tags**: @backend, @perf

**Preconditions**:

- A success fixture, and the pre-change read population recorded as a declared
  constant from the delivered tree (the four provider reads the merge path
  already performs).

**Steps**:

1. Run one invocation and read the provider request count and the filesystem
   read count.
2. Compare the provider count to the pre-change population plus the already
   budgeted list read.
3. Read the clock-read counter and the transport timestamps for any repeat.

**Expected Outcome**:

- Exactly two provider-independent reads are added (the change record and the CI
  workflow); both are filesystem reads and neither creates a provider request.
- The provider request count equals the NFR-2 budget: no additional provider
  operation, no second list read, no polling loop.
- The clock-read count is bounded (no wait/poll cycle), and the invocation
  performs zero retries and zero sleeps.
- Total reads stay within the NFR-2 budget across success and refusal cells.

#### TC-MRG-041 - No new record kind, key or event schema; shapes unchanged

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: EVT-2, DM-3, DEC-9, NFR-8
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/merge-contract.test.ts` (extend `TC-SYNC-005`) + `tests/structure/content-inventory.test.ts`
**Tags**: @backend

**Preconditions**:

- The delivered transaction, verification, waiver and landing record shapes; the
  capsule and registry event vocabulary; the state schema version; the
  configuration catalog.

**Steps**:

1. Compare each record type's key set to its delivered set.
2. Read the capsule/registry event kind set and the state schema version.
3. Read the configuration catalog's `merge` branch keys.

**Expected Outcome**:

- Every record type keeps exactly its delivered keys; the landing evidence keeps
  its two members and its widened containment union; no fourth member exists.
- No new event kind, key or schema version exists: the capsule/registry
  vocabulary is an exact-set equality with the delivered one, and the state
  schema version is unchanged.
- The configuration catalog still exposes exactly `gate-freshness`, `gates`,
  `deploy-expectations`; no `branch-name`, `base-ref` or owner-principal key was
  added (the branch is a change-artifact fact, not configuration).
- Resolution facts appear only as command `data`, never as a persisted record.

## 6. Environments and Test Data

**Environments.** One: the developer/CI Linux container running `bun test` (or
`pnpm test`) and `pnpm check`. There is no staging and no live provider tier for
this change — NFR-4/AC-F5-3 forbid it, and the provider is always a synthetic
in-process transport. The only filesystem state used is a per-fixture temp
directory (checkout, home, state root), removed on `dispose()`/`cleanup()`.

**Fixture families and their shapes.** Every new case belongs to one of four
families; the shape is stated so an implementer does not invent a live seam.

1. **Resolution fixtures (composition level)** —
   `createMergeProductionHarness` over a real temp git checkout containing
   `main-tools` plus a one-commit feature branch, with:
   - `doc/changes/<YYYY-MM>/<date>--<ref>--<slug>/chg-<ref>-pm-notes.yaml`
     written into the checkout (optionally with `branch:` absent, empty,
     whitespace, control-character, or over-cap);
   - a `checkout`/`head` option that leaves `HEAD` on the integration base (this
     is a new fixture capability; it must not add a provider read);
   - a per-URL reply function for the bounded open-request list (entries with
     `head.ref`/`head.sha` varied), the work item, and the check-run page (with
     an optional `sha` field for the other-head cell);
   - the credential port in `resolved` or `missing` mode and a counter of its
     reads;
   - the recording transport (URL and serialized body per request) and the real
     JSONL state ledger for appended records.
2. **Transaction fixtures (behaviour level)** — `createMergeHarness` over a temp
   state root with injected `workItem` / `checkRuns` (`{ items: PipelineRun[],
   pageItemCount, sha? }`) / `request` values or `{ fault: <code> }`; a fake git
   seam recording operations; `declaredGateSetWith(entries)` for authored sets;
   `verificationRecord(...)` / `baseRequest(...)` / `baseWorkItem(...)` /
   `baseCheckRuns()` builders; `counts` (work item, check runs, request detail,
   verification, landing, clock) and `events`.
3. **Expected-job set fixtures** — the repository-declared job names as the
   delivered `VerifyGatesWorkflowFacts` (`outcome: "read" | …`, `names`), injected
   per fixture so an unreadable/empty/malformed/duplicated/over-cap set is a
   declared cell, never a filesystem accident.
4. **Refusal-rendering and structural fixtures** — the enumerated matrix cells
   over family 2, plus committed source reads for the scans. The matrix's
   "act required" column is declared data next to the cells (Appendix B), so the
   row-level honesty predicate has an oracle independent of the rows it judges.

**Test data rules.** No real credential, no real token, no live payload: the
credential material is a synthetic string and the canary secret is a distinct
literal. Titles, bodies, comments and payloads are synthetic canaries. Fixtures
are never named `*.test.ts` and never live under `tmp/`. No case writes outside
its temp root. The one committed-state read is the source tree itself (scans);
no case asserts a diff against a moving base branch.

**Isolation.** Each harness builds its own temp checkout, home and state root;
nothing is shared between cases. The scans read the committed tree read-only. The
golden suite reads committed files and a mutation control proves the comparison
is live.

## 7. Automation Plan and Implementation Mapping

### 7.1 Scenario-to-file mapping

| TC ID | Test file | Status | Command |
|-------|-----------|--------|---------|
| TC-MRG-001 | `tests/behaviour/merge-production-composition.test.ts` | Existing – Update | `bun test tests/behaviour/merge-production-composition.test.ts` |
| TC-MRG-002 | `tests/behaviour/merge-production-composition.test.ts` | New | same |
| TC-MRG-003 | `tests/behaviour/merge-production-composition.test.ts` (+ `merge-landing.test.ts` oracle) | Existing – Update | same + `bun test tests/behaviour/merge-landing.test.ts` |
| TC-MRG-004 | `tests/behaviour/merge-production-composition.test.ts` | New | same |
| TC-MRG-005 | `tests/behaviour/merge-production-composition.test.ts` | New | same |
| TC-MRG-006 | `tests/behaviour/merge-production-composition.test.ts` | New | same |
| TC-MRG-007 | `tests/behaviour/merge-production-composition.test.ts` | New | same |
| TC-MRG-008 | `tests/behaviour/merge-production-composition.test.ts` | Existing – Update | same |
| TC-MRG-009 | `tests/behaviour/pm-notes-lint.test.ts` + phase-write suites | Existing – Update | `bun test tests/behaviour/pm-notes-lint.test.ts` |
| TC-MRG-010 | `tests/behaviour/merge-production-composition.test.ts` | Existing – Update | same as row 1 |
| TC-MRG-011 | `tests/behaviour/merge-dry-run.test.ts` (+ `merge-landing.test.ts`) | Existing – Update | `bun test tests/behaviour/merge-dry-run.test.ts` |
| TC-MRG-012 | `tests/behaviour/merge-required-job-probe.test.ts` | Existing – Update | `bun test tests/behaviour/merge-required-job-probe.test.ts` |
| TC-MRG-013 | `tests/behaviour/merge-required-job-probe.test.ts` | Existing – Update | same |
| TC-MRG-014 | `tests/behaviour/merge-production-composition.test.ts` | Existing – Update | same as row 1 |
| TC-MRG-015 | `tests/behaviour/merge-required-job-probe.test.ts` | Existing – Update | same as row 12 |
| TC-MRG-016 | `tests/behaviour/merge-gate-set.test.ts` (+ `tests/structure/merge-contract.test.ts`) | Existing – Update | `bun test tests/behaviour/merge-gate-set.test.ts tests/structure/merge-contract.test.ts` |
| TC-MRG-017 | `tests/behaviour/merge-gate-set.test.ts` (+ `tests/structure/merge-contract.test.ts`) | Existing – Update | same |
| TC-MRG-018 | `tests/behaviour/merge-required-job-probe.test.ts` | New | same as row 12 |
| TC-MRG-019 | `tests/behaviour/merge-dry-run.test.ts` | New | same as row 11 |
| TC-MRG-020 | `tests/behaviour/merge-production-composition.test.ts` | Existing – Update | same as row 1 |
| TC-MRG-021 | `tests/behaviour/merge-production-composition.test.ts` | Existing – Update | same |
| TC-MRG-022 | `tests/behaviour/merge-production-composition.test.ts` | Existing – Update | same |
| TC-MRG-023 | `tests/behaviour/merge-refusal-surface.test.ts` (+ `merge-refusal-taxonomy.test.ts`) | Existing – Update | `bun test tests/behaviour/merge-refusal-surface.test.ts tests/behaviour/merge-refusal-taxonomy.test.ts` |
| TC-MRG-024 | `tests/behaviour/merge-refusal-surface.test.ts` | New | same |
| TC-MRG-025 | `tests/behaviour/merge-refusal-surface.test.ts` + `tests/structure/merge-refusal-rows.test.ts` | Existing – Update | `bun test tests/behaviour/merge-refusal-surface.test.ts tests/structure/merge-refusal-rows.test.ts` |
| TC-MRG-026 | `tests/structure/merge-refusal-rows.test.ts` | New | same |
| TC-MRG-027 | `tests/behaviour/merge-required-job-probe.test.ts` + `merge-refusal-surface.test.ts` | New | rows 12 + 23 commands |
| TC-MRG-028 | `tests/structure/defect-f1-merge-refusal-containment.test.ts` + `tests/structure/merge-classification-conformance.test.ts` | Existing – Update | `bun test tests/structure/defect-f1-merge-refusal-containment.test.ts tests/structure/merge-classification-conformance.test.ts` |
| TC-MRG-029 | same two files | Existing – Update | same |
| TC-MRG-030 | `tests/behaviour/merge-production-composition.test.ts` | New | row 1 command |
| TC-MRG-031 | `tests/behaviour/merge-production-composition.test.ts` + `merge-verification-record.test.ts` | Existing – Update | row 1 + `bun test tests/behaviour/merge-verification-record.test.ts` |
| TC-MRG-032 | `tests/behaviour/merge-verification-record.test.ts` + `tests/golden/verify-gates.test.ts` | Existing – Update (golden: No Change) | `bun test tests/behaviour/merge-verification-record.test.ts tests/golden/verify-gates.test.ts` |
| TC-MRG-033 | `tests/behaviour/merge-determinism.test.ts` | Existing – Update | `bun test tests/behaviour/merge-determinism.test.ts` |
| TC-MRG-034 | `tests/behaviour/merge-probe.test.ts` + `merge-production-composition.test.ts` | Existing – Update | `bun test tests/behaviour/merge-probe.test.ts` |
| TC-MRG-035 | `tests/behaviour/merge-bounds.test.ts` | Existing – Update | `bun test tests/behaviour/merge-bounds.test.ts` |
| TC-MRG-036 | `tests/checks/merge-deploy-no-live-calls.test.ts` + `tests/checks/merge-suite-discovery.test.ts` | Existing – Update | `bun test tests/checks/merge-deploy-no-live-calls.test.ts tests/checks/merge-suite-discovery.test.ts` |
| TC-MRG-037 | `tests/checks/merge-branch-read-scan.test.ts` | New | `bun test tests/checks/merge-branch-read-scan.test.ts` |
| TC-MRG-038 | `tests/structure/error-table.test.ts` + `tests/checks/error-table-sync.test.ts` + `tests/structure/merge-refusal-rows.test.ts` | Existing – Update | `bun test tests/structure/error-table.test.ts tests/checks/error-table-sync.test.ts` |
| TC-MRG-039 | `tests/behaviour/merge-privacy.test.ts` | Existing – Update | `bun test tests/behaviour/merge-privacy.test.ts` |
| TC-MRG-040 | `tests/behaviour/merge-probe.test.ts` + `merge-production-composition.test.ts` | New | row 34 command |
| TC-MRG-041 | `tests/structure/merge-contract.test.ts` + `tests/structure/content-inventory.test.ts` | Existing – No Change (assertion added) | `bun test tests/structure/merge-contract.test.ts tests/structure/content-inventory.test.ts` |

### 7.2 Mocking and seam requirements

- Provider I/O is the injected transport only: the composition harness's
  `githubTransport.send` and the transaction harness's
  `readWorkItem`/`readCheckRuns`/`readRequestDetail` ports. No case mocks a
  module; there is no live provider client in the process.
- The credential port is injected (`resolved`/`missing`, plus a rejected cell).
- The change record is read through the delivered `readPmNotesText` over the real
  temp checkout, or over an injected `PmNotesFileSystemFacts` map for the
  absent/malformed cells. Both are the production read, not a stub of the
  resolution.
- The CI-workflow expected-job read is injected as `VerifyGatesWorkflowFacts`
  (`outcome`, `names`), the same shape the battery's `ci-green` consumes.
- The clock and run id are injected and fixed, so determinism and freshness are
  assertions about behaviour rather than about wall time.
- The state store is a real temp JSONL ledger; append faults are injected by
  wrapping the port (the delivered `stateStoreWrap` seam), never by editing
  records.

### 7.3 Meta-suite registration obligations (must move in the same delivery)

These are repository invariants that will fail if the change adds suites,
exports, rows or goldens without registering them. They are implementation
obligations, not new requirements:

- `tests/structure/merge-suite-obligations.test.ts` pins a **closed sixteen-file**
  `tests/behaviour/merge-*.test.ts` population with per-suite obligation markers
  and a seven-suite "green unedited" inventory. Any new merge behaviour suite (or
  a materially rewritten one) requires updating `DELIVERED`, `CHANGED`/`GREEN`
  and `OBLIGATIONS` in the same change, with the bidirectional control kept.
- `tests/checks/merge-suite-discovery.test.ts` pins the new-suite list, the
  offline static scan and the CI topology pin. `tests/checks/merge-branch-read-scan.test.ts`
  must be added there.
- `tests/structure/content-inventory.test.ts` and
  `tests/fixtures/ports/v1-contract-inventory.json` pin exported names per
  module: any new export (admitted-surface contract data, an added port member,
  a new evidence field type) must be registered.
- `tests/structure/merge-contract.test.ts` pins the shipped default set's entries,
  the effective identity string and the record shapes; the `ci-green` surface
  movement is the declared one and every other field stays pinned.
- `tests/fixtures/merge/golden/` holds thirteen committed files with a
  non-regeneration discipline. Whatever moves is regenerated deliberately and
  listed in §10; a blanket rewrite must fail the mutation control.
- `scripts/checks/error-table-sync.ts` (consumed by
  `tests/checks/error-table-sync.test.ts`) is the two-table authority for the
  167 → 170 move; the documented table and the machine table move together.

### 7.4 Documentation surfaces that the identity and contract moves touch

`doc/spec/features/feature-merge-verify-deploy.md` (Overview resolution
paragraph, gate-registry defaults, verification-record head meaning, error
identities, invariants), `doc/quality/test-specs/test-spec-merge-verify-deploy.md`
(the five named rows), `doc/planning/oss-tooling/milestones/m1/commands/merge.md`
(branch/head resolution, gate set, refresh and exit-status causes, refusal
examples), `doc/spec/features/feature-result-contract.md` (the documented table at
170), and the change-lifecycle guidance that a change record declares its branch.
`tests/checks/doc-conformance.test.ts` enforces the current-truth phrase table, so
the updates state the current contract rather than narrating the change.

### 7.5 Execution order and gates

1. Narrow suites per touched module while iterating (the commands in §7.1).
2. `bun test tests/behaviour tests/structure tests/checks tests/golden` for the
   whole affected population.
3. `pnpm check` (lint → format:check → typecheck → test → check:boundaries) as
   the aggregate gate; `bun run scripts/checks/error-table-sync.ts` and the
   invariant checks run inside it.
4. `git diff --check` for whitespace/conflict markers.
5. Record every command and result in §10. A case may only be marked PASS with a
   named command and its exit status.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Risk | Impact | Mitigation in this plan |
|----|------|--------|-------------------------|
| TP-R-1 | The base-checkout regression passes while the run still reports something derived from the checkout (for example a base-tip SHA in evidence) | Critical | TC-MRG-001 asserts the resolved source, the head inequality, the check-run URL's SHA and the landing's expected head; TC-MRG-002 proves the assertion is sensitive |
| TP-R-2 | The required-check assertion is satisfied by a fixture whose page has no SHA, so "other head" is untested | High | TC-MRG-013 uses the same bytes under two SHAs; the labelled control must pass |
| TP-R-3 | The refusal matrix is asserted as one case and hides a cell that regresses | Critical | TC-MRG-023 enumerates 22 cells with per-cell named causes; TC-MRG-024 proves an unnamed cell is flagged |
| TP-R-4 | The retryability rule passes vacuously because the cause set is hand-picked to exclude act-requiring causes | Critical | TC-MRG-026 derives the cause set from the delivered enumeration and carries a substituted pre-change row that must fail by name |
| TP-R-5 | The "no ambient branch read" scan is written so it cannot match the pre-fix construct | High | TC-MRG-037 plants the pre-fix read and requires the matcher to find it by `file:line` |
| TP-R-6 | The identity move is applied to one table or one pin site and the four surfaces drift | High | TC-MRG-038 reads both tables, all seven pin sites, both count pages and the three doc surfaces; the sync check gates it |
| TP-R-7 | A golden is silently regenerated, hiding a regression in the merge report | High | TC-MRG-035 and the golden mutation control; §7.3 requires a declared per-file list in §10 |
| TP-R-8 | The new suites reach the network or a child process through a helper | Critical | TC-MRG-036 asserts the guard, the spawn counter and a static scan; the topology pin is unchanged |
| TP-R-9 | The 16-suite meta-check or the export inventory breaks and the delivery "fixes" it by deleting the check | High | §7.3 records the registration obligation; the bidirectional controls in those suites must stay |
| TP-R-10 | The plan's scenario-to-phase allocation drifts from the not-yet-authored implementation plan | Medium | §2 and OQ-TP-3: re-read the plan at `dor_check`; the coverage map itself is spec-derived and stable |
| TP-R-11 | Fixture capability (a base-checkout option) introduces a live read or a checkout mutation | Medium | TC-MRG-036 covers the new suites; TC-MRG-031 asserts the checkout's `HEAD` and SHA are unchanged |

### 8.2 Assumptions

- The change ref identifies both the tracker work item and the change folder, so
  the change record is resolvable from the invocation (spec §12).
- In a healthy flow exactly one open delivery request asserts the change branch;
  a second is refused rather than ranked.
- The repository declares its CI jobs in the workflow file the delivered
  expected-job read targets; a repository without one fails the CI gate
  explicitly with the surface opt-out as the remedy.
- The `branch` declaration is authored when the change is opened; this plan does
  not assume a writer (OQ-1 / NG-5).
- The delivered credential precedent (`github-read` + `GITHUB_TOKEN`) is the
  shape reused; no new secret-bearing field exists, so the canary scan can assert
  "names present, value absent".
- The effective gate-set identity (schema version + entry-id sequence) is
  unchanged by the surface movement, so in-flight verification records remain
  consumable and TC-MRG-038's identity string is a stable oracle.
- Fixtures run with a fixed clock; no case depends on real time.
- The implementation plan will not add scope beyond the spec; if it does, this
  plan's coverage map must be re-derived rather than stretched.

### 8.3 Open Questions

| ID | Question | Context | Blocking? | Owner |
|----|----------|---------|-----------|-------|
| OQ-TP-1 | Which part of F-4 is still to be delivered, given the tree already declares `MergeCompositionEmittableFamily` and `tests/structure/defect-f1-merge-refusal-containment.test.ts` (GH-349) already asserts family coverage and a live mismatch control? | Spec §2.1 states the family "is absent from the composition's declared emittable set", but the current production source exports the family expression and the containment suite passes against it. TC-MRG-028/029 assert the contract rather than a delta, so they hold either way; the question is whether F-4's remaining work is slot validation plus coverage over the widened required-check set, or a re-declaration. A delivery that re-implements the delivered expression would be churn, and one that deletes the control would regress. | No (assertions are contract-shaped) | `@plan-writer` / `@readiness-reviewer` |
| OQ-TP-2 | Which of the thirteen committed merge goldens move when the merge projection becomes two entries, and which stay byte-identical? | Spec NG-2 protects the battery goldens and their `verify gates` output, but does not list the merge goldens. Eight encode `gates=<passed>/<total>` and the evaluated ids. The plan asserts bounds and deliberate regeneration; the per-file movement list must be declared before the quality gates, or a blanket regeneration could pass. | No (must be recorded before phase 9) | `@plan-writer` |
| OQ-TP-3 | Should the scenario-to-phase allocation be re-stated once `chg-GH-366-plan.yaml` exists? | The implementation plan was not authored at test-plan time (phase 4 pending), so §1.1 groups scenarios by spec capability (F-1…F-5) rather than by plan phase. The spec's stated delivery order (diagnostics → branch/head → required checks → dry-run agreement) suggests four phases. | No (coverage is unaffected) | `@pm` / `@plan-writer` |
| OQ-TP-4 | Where must the "failed read operation" be carried: as a bounded evidence member, inside the summary, or both? | AC-F2-5 and F-3 require the refusal to name the operation; the delivered envelope's evidence is a closed member set. TC-MRG-014/020 assert the literal operation token appears in the rendered refusal (summary and/or evidence) and nowhere claims a specific member name, so either contract satisfies the case — but the delivery and the reference page must agree on one. | No (assertion is token-based) | `@plan-writer` |
| OQ-TP-5 | After narrowing, does `merge.transaction-aborted` keep `retryable: true` (with an all-act-free cause set) or move to `false`? | The spec permits either so long as the value and remediation are true of every cause the row still reaches (Appendix B, §8.5). TC-MRG-026 asserts the *rule*, not a literal value, and requires the chosen shape to be recorded. The choice affects the documented table and the reference page, so it must be decided in the same change as the row text. | No (rule asserted) | `@plan-writer` |

**No acceptance criterion is TODO.** All 22 are mapped in §3.1; the five open
questions concern allocation and presentation, not coverage.

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-20 | test-plan-writer | Initial test plan for GH-366 (spec v1.1). 41 scenarios (`TC-MRG-001`…`TC-MRG-041`), 22/22 acceptance criteria mapped, 10/10 NFRs mapped, 7 interface elements mapped. Derived from the spec only; the implementation plan was absent (OQ-TP-3). Records the existing suite each scenario lands in or next to, and the meta-suite registration obligations the change must satisfy. |

## 10. Test Execution Log

_Populated during delivery and the quality gates. No case has been executed at
authoring time._

| TC ID | Run Date | Result | Command / Evidence | Notes |
|-------|----------|--------|--------------------|-------|
