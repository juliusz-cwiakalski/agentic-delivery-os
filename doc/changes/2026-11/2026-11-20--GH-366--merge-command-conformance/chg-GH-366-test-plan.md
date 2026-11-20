---
id: chg-GH-366-test-plan
status: Updated
created: 2026-11-20T12:10:00Z
last_updated: 2026-11-20T12:52:00Z
owners: ["engineering"]
service: delivery-os
labels: [merge, conformance, m4-s3, diagnostics, error-table]
version_impact: minor
summary: "Prove the merge slice's three repaired defects and the diagnostics contract they report in: the change branch is resolved by a bounded open-request list read, a candidate set bounded by the declared branch convention and capped at three, and one bounded local tree/blob read of each candidate's change record at that candidate's own asserted head (the base checkout's branch, head and working-tree record never participate), with six closed branch reasons, the declared precedence, four closed request reasons (`no-open-request`, `ambiguous-open-request`, `ambiguous-merged-request`, `head-unresolved`) and the declared head binding, and with an already-merged request converging from one bounded closed-request list read filtered by the declared branch convention (observed as `0 | 1 | 2+`; `2+` refused as `merge.request-unresolved` / `ambiguous-merged-request`, never ranked) before any record read (`replayed=true`, zero record reads and zero record-read git invocations, no declaration needed, nothing landed); the shipped default merge projection enforces the required checks reported on the resolved head so failing, pending, canceled, skipped, missing and other-head checks each refuse by name, and the merged report renders the projection it evaluated (`gates=2/2`) rather than the record's battery list; and every refusal renders a dedicated `command=merge` field, a dedicated `ref=<ref>` field carrying the invocation's ref, and a dedicated `operation=<token>` field drawn from a closed vocabulary validated at the rendering site, beside the code and at least one named cause — a credential condition naming the credential reference, the environment variable and the operation, and never `merge.transaction-aborted`, an unresolvable work item naming its ref and read operation, `retryable` always the emitted row's declared value with `merge.transaction-aborted` narrowed to its two pre-mutation causes and pinned to `false` and a landing fault reporting `provider.outage` / `provider.auth.rejected` / `merge.landing-unverified`, and the totality proof ranging over a runtime family declaration that fails by name when removed while a live mismatch control still reaches the containment identity; plus dry-run/real-merge object agreement and the non-functional proofs (determinism, the two-read provider budget, bounds, offline, no ambient branch or head read, identity totality and stability at 170 → 173, secret hygiene)."
links:
  change_spec: ./chg-GH-366-spec.md
  implementation_plan: ./chg-GH-366-plan.yaml
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
  (spec §2.1, P-1) — and, after the repair, because a fixture hands the run a
  change record the real base checkout cannot have (spec §2.1 "Change record
  reads", P-7);
- the merge-applicable projection stays vacuous, so a failing and a fully green
  request produce the same all-pass verdict (P-2, P-3);
- a refusal narrates no command, no ref and no operation, an unresolvable work
  item collapses into an opaque abort, and the composition's runtime vocabulary
  cannot state that a gate-family emission is admissible so the totality proof
  rests on source text (P-4);
- an already-merged request is refused for a branch declaration it no longer
  needs, because the convergence decision sits behind the change-record read
  instead of in front of it (F-1 step 2, AC-F1-6);
- a declared row advertises `retryable: true` while causes routed to it need an
  operator act before a re-run converges (P-5);
- a dry run describes a different object from the one the merge would land
  (P-6).

Every case below is an oracle over an observable reached through the production
composition or a declared seam: the injected transport's request log, the
injected port and local-read call counters, the real temp checkout's git state,
the appended state records, the resolved error-table row and its exit projection,
the rendering's parsed `command`/`ref`/`operation` fields, the composition's
exported runtime emittable declaration **as a value**, and the committed source
tree.
**Absence claims carry a positive control in the same case** — a zero additional
provider read is paired with the declared reads that must occur (the open-list
read, plus the closed-list convergence read on the cells that reach it); "no
ambient branch or head read" is paired with a planted read the scan must find; "no
working-tree record read" is paired with a planted working-tree read; "the
containment identity is unreachable for a declared gate refusal" is paired with a
live mismatch that still reaches it; "no row overstates convergence" is paired
with a row object that must be flagged; "the totality proof fails when the
runtime declaration is removed" is paired with the unmutated declaration passing.

Four constraints shape the plan.

1. `.ai/rules/testing-strategy.md` binds: fixtures live under `tests/fixtures/**`,
   suites are `bun:test` under the `behaviour`, `structure`, `checks` and `golden`
   layers, and a permanent suite asserts properties of the current tree or HEAD,
   never a diff against a moving base branch. Every "nothing else moved" claim is
   therefore an exact-set equality against a production constant, a committed
   golden, or a pinned inventory.
2. Offline determinism is binding (NFR-4, AC-F5-3): every new case is in-process
   over injected ports, transport and child runner. No network call, no real child
   process, no live provider, no live credential read.
3. **Fixture truth is binding (spec §2.1 "Change record reads", AC-F1-1).** A
   base-checkout case is only meaningful when its fixture reproduces the real
   state: the worktree contains **no change folder** for the change and `HEAD` is
   the integration-base tip. The change record is then obtained from the request's
   asserted head through the local tree/blob read — never from the working tree.
   A fixture that writes `chg-<ref>-pm-notes.yaml` into the checkout no longer
   satisfies the criterion (§6, §8.1 TP-R-10).
4. The change is **not** claiming the ticket body's family-wide command battery
   (spec §7.2). No case here exercises `dispatch`, `loop`, `closeout`, `queue`,
   `phase`, `verify`, `blockers`, `board`, `brief`, `metrics`, `spend` or
   `provider`, and no installed-binary end-to-end conformance run is claimed.

This document is a verification map, not an execution claim. No case has been
run at authoring time; §10 is populated during delivery and the quality gates.

### 1.1 In Scope

- **F-1 Change-branch resolution and head binding (6 ACs).** One bounded
  **open-request list** read (which is also the request-detail read) supplies the
  open count, the saturation flag and the candidate set — the open entries whose
  provider-asserted source ref follows the declared `<type>/<REF>/<slug>`
  convention, capped at `MERGE_BRANCH_CANDIDATE_MAX = 3`. Zero candidates on an
  unsaturated page refuse `merge.request-unresolved` / `no-open-request`; more
  than three, or a saturated page — **including a saturated page with zero
  convention-matching entries**, because saturation is evaluated before the
  candidate count — refuse `ambiguous-open-request`; a candidate whose asserted
  head is absent or not a full hex SHA refuses `head-unresolved` and is never
  read. Each candidate's record is read at its own asserted head (one bounded
  local tree/blob read, `MERGE_CHANGE_RECORD_MAX_BYTES = 262_144`), and a
  candidate is accepted only when its `branch` declaration equals its own source
  ref exactly; the resolution source is then `declared-at-head`. When none is
  accepted the run refuses `merge.branch-unresolved` at exit 1 with exactly one
  of six closed reasons (`declaration-missing`, `declaration-unusable`,
  `declaration-disagrees`, `record-missing`, `record-invalid`,
  `record-unreadable`) chosen by the declared precedence, with
  `MERGE_BRANCH_DECLARATION_MAX_CHARS = 256`. The matched request's asserted head
  is the resolved head, which the freshness envelope, the landing's expected head
  and the reported head all bind to, so a record for the base tip refuses
  `merge.gates-stale` with both SHAs. Convergence is decided **before any record
  read** from a second, bounded **closed-request list** read whose entries are
  filtered by the declared branch convention and observed as `0 | 1 | 2+`:
  `1` replays from provider truth at exit 0 with `replayed=true`, performs zero
  change-record reads and zero record-read git invocations, reports neither
  `declared-at-head` nor `merge.branch-unresolved` and lands nothing, needing no
  declaration; `2+` refuses `merge.request-unresolved` / `ambiguous-merged-request`
  rather than ranking; `0` continues to the candidate path. The resolution path
  therefore spends **at most two** provider reads — the open list, plus at most
  one closed convergence read — and never a third (`AC-F1-6`).
- **F-2 Required-check enforcement on the resolved head (8 ACs).** The shipped
  default merge projection becomes `ci-green` + `tracker-freshness`, and the
  merged report renders that evaluated projection (`gates=2/2`) rather than the
  verification record's battery list. The merge-applicable required-check set is
  the declared `required-ci-job` entries plus the `ci-green` entry's
  repository-declared expected job set, evaluated per job through the single
  delivered mapping with `recorded`/`probe` attribution; failing, canceled,
  skipped, pending, missing and other-head conditions each refuse on
  `merge.gate.<gate-id>.failed` at exit 1 by name; a read fault names the failed
  read in the dedicated `operation` field; the five built-ins stay reserved and
  mandatory, `ci-green` is admitted on `battery` or `both` and the other four on
  `battery` only, and an omitted class adopts the shipped class.
- **F-3 Refusal diagnostics contract (6 ACs).** Every refusal renders a dedicated
  `command=merge` field, a dedicated `ref=<ref>` field carrying the invocation's
  ref, and a dedicated `operation=<token>` field drawn from the closed vocabulary
  the spec declares — the **six provider source names** (the filter of
  `VERIFY_GATES_SOURCE_NAMES` to the provider members) plus the two local tokens
  (`local-change-record-read`, `local-git-object-read`) plus `-` when the refusal
  names no operation — validated at the rendering site, beside the code and at
  least one named cause, with an actionable or absent remediation. The edges are
  asserted too: a transport/read fault names the **attempted** operation, a
  landing fault names the **failing** landing operation, a local change-record
  read names its own source (`local-git-object-read` when the object read fails,
  `local-change-record-read` when the parse fails), `merge.state-unverified` (a
  non-provider state read) renders `-`, and an out-of-vocabulary token is
  **rejected at the rendering site rather than passed through**; a credential
  condition names the credential reference (`github-read`), the environment
  variable (`GITHUB_TOKEN`) and the operation, and is never
  `merge.transaction-aborted`; an unresolvable work item is
  `merge.work-item-unresolved` naming its ref and read operation; `retryable` is
  always the emitted row's declared value; no row declares `retryable: true` while
  a cause it reaches needs an operator act, and `merge.transaction-aborted` is
  pinned to `false` with no convergence claim over its two remaining causes (a
  waiver-append failure and a declared landing gap), while a refused landing
  reports a **declared identity** (`provider.outage`, `provider.auth.rejected`,
  `merge.landing-unverified` or `config.credential.missing`) and never the
  arbitrary port code `protection-rule`.
- **F-4 Emitted-identity totality (2 ACs).** The composition exports a **runtime**
  family declaration beside the exact-member list (the contract's prefix, suffix,
  template and a slot rule validated against the effective gate set); the totality
  proof ranges over that value, so a behaviour-preserving refactor passes and
  deleting or replacing the declaration fails by name, with no source-text
  assertion left to pass; a live mismatch control still reaches the containment
  identity and the gate-id pattern is never widened.
- **F-5 Dry-run / real-merge agreement (3 ACs).** Both surfaces report the same
  resolved branch, resolution source, request identity, candidate count, resolved
  head and merge-applicable gate projection; the dry-run record's head is the
  resolved head with zero waiver, transaction or git mutation and never
  `result=merged` or `squash=`; the new suites are offline.
- **Non-functional (10 NFRs).** Determinism (20 runs over one success and six
  refusals, changed-fact control), the **two-read** provider budget (the bounded
  open-request list read, which is also the detail read, plus at most one bounded
  closed-request convergence read filtered by the declared branch convention)
  plus at most three bounded local record reads and no fetch, output bounds,
  offline determinism, refusal completeness with the dedicated `command`, `ref`
  and `operation` fields over a 22-cell matrix and zero `operation` tokens outside
  the closed vocabulary, no ambient branch or head read and no working-tree record
  read, identity totality over the runtime declaration, identity stability
  (170 → 173 / 169 → 172 / 68 → 71 / `+136` → `+139` / `merge` kind 9 → 12, with
  167 banned), secret hygiene with canary secrets, and the latency/read-shape
  delta.
- **Additive-surface synchronization.** Three additive rows in both tables, the
  seven identity pin sites, the two identity-count pages, the merge reference
  page, the merge feature spec, the merge test specification, the change-lifecycle
  and change-convention guidance, the PM instruction surface and its generated
  mirror; the `branch` declaration on the change record is opaque to lint and
  preserved value-faithfully by every document-writing branch.

### 1.2 Out of Scope & Known Gaps

- [OUT] **The family-wide command battery** over `dispatch`, `loop`, `merge`,
  `closeout`, `queue`, `phase`, `verify`, `blockers`, `board`, `brief`,
  `metrics`, `spend`, `provider` on the installed binary (spec §7.2). Not
  claimed green; no case here asserts it, and no installed-binary end-to-end
  conformance run is claimed.
- [OUT] **Branch-protection required-status-contexts** or any new provider
  operation, scope or credential reference (NG-1). The provider reads on the
  resolution path are the delivered bounded open-request list read and the
  delivered bounded closed-request merged read (now convention-filtered) — two
  reads, no new provider operation; the change-record read is a local git object
  read.
- [OUT] **The battery's five gate evaluations, `verify gates` output, and their
  goldens** (NG-2). `TC-MRG-032` asserts the battery-side record and goldens are
  byte-identical; no case drives a battery change.
- [OUT] **`verify gates` resolving its branch from the change record** (OQ-3).
  The battery keeps its delivered resolution.
- [OUT] **A branch-declaration writer** (OQ-1, NG-5). The declaration is
  authored; no case asserts automatic maintenance.
- [OUT] **Waiver policy, owner-gate classification and the `--waive` surface**
  (NG-6). `TC-MRG-048` asserts the retained explicit path still authorizes where
  a class binding exists; it claims no policy change.
- [OUT] **New landing, refresh, force, bypass, auto-merge, queue, retry or
  head-mutation capability** (NG-3). `merge.transaction-aborted` keeps its row;
  no case drives a new mechanism.
- [OUT] **A fetch of a request head object the local object database does not
  hold** (NG-7, OQ-4). `TC-MRG-042`'s `record-unreadable` cell asserts the pinned
  refusal and the absence of a fetch; the fetch policy is deferred (§8.3
  OQ-TP-6).
- [OUT] **`verify deploy` target resolution** — its delivered residual is
  unchanged and no case claims an engine-verified deploy.
- **GAP-TP-1 — "zero ambient branch/head read" and "zero working-tree record
  read" are source invariants, not behavioural ones.** Nothing distinguishable at
  runtime separates "not read" from "read and unused" in one invocation, so
  `TC-MRG-037` expresses the claims as a production-source scan with mandatory
  planted controls, following the delivered
  `tests/checks/merge-landing-retirement.test.ts` precedent. It does not attempt
  a diff-against-base assertion (forbidden by `.ai/rules/testing-strategy.md`).
- **GAP-TP-2 — the refusal matrix is an enumerated oracle, not a generator.**
  `TC-MRG-023` enumerates this plan's own closed **22-cell** matrix (its
  enumeration rule is stated in that case, and it is not a transcription of the
  spec's Appendix B row count) rather than scanning production for emitted codes;
  the scan-based totality claim belongs to
  `TC-MRG-028`/`TC-MRG-029`/`TC-MRG-045` and to
  `tests/structure/defect-f1-merge-refusal-containment.test.ts`. The two together
  cover "no emitted code escapes"; neither is claimed to cover the other.
  Cell 17 (the abort row) is carried as its **two** remaining pre-mutation causes
  (a waiver-append failure and a declared landing gap), and cell 20 as the
  landing-fault expansion (transient → `provider.outage`, rejected credential →
  `provider.auth.rejected`, fired-but-unobserved → `merge.landing-unverified`), so
  the act-required column is derived from the shipped mapping for each cell rather
  than asserted (readiness iteration 2, findings 2 and 14).
- **GAP-TP-3 (closed in v1.2) — the already-merged convergence provision now has
  its own AC.** Spec v2.1 adds `AC-F1-6`; `TC-MRG-049` is its dedicated carrier and
  `TC-MRG-043` is re-pointed to it as its primary criterion. The earlier note that
  "§17 carries no criterion" is superseded: the provision is judged by an AC, not
  by a case traced as the negative of `AC-F1-3`.
- **GAP-TP-4 (closed in v1.2) — the `ref=-` branch no longer exists.** Spec v2.1
  drops the empty-value clause: every merge refusal path is reached with a usable
  ref, so the `ref` field always carries the invocation's ref and nothing about it
  is left unasserted. `TC-MRG-046` asserts the field's value for the five delivered
  refusal shapes and `TC-MRG-023` for every matrix cell; there is no fallback
  carrier to invent.

## 2. References

- Change specification: [`chg-GH-366-spec.md`](./chg-GH-366-spec.md) (**v2.2**,
  25 acceptance criteria — the 22 carried forward plus `AC-F2-8`, `AC-F4-2` and
  `AC-F1-6` — §17.6 owner acceptance trace, §17.7 Definition of Done, Appendix A
  normative resolution order, Appendix B refusal matrix).
- Implementation plan: [`chg-GH-366-plan.yaml`](./chg-GH-366-plan.yaml) (seven
  phases; phase 1 planning, phase 2 refusal identities and the diagnostics
  contract, phase 3 branch resolution and head binding, phase 4 required-check
  enforcement, phase 5 the runtime family declaration and totality proof, phase 6
  the merged report's evaluated projection and the golden-set contract closure,
  phase 7 documentation reconciliation). The golden movement itself is distributed
  across phases 2, 3 and 6 as that plan's movement table declares.
  Every scenario below carries a `Plan Phase(s)` line keyed to those phase ids;
  §5.1 states the allocation as a whole (OQ-TP-3 closed).
- Testing strategy: [`../../../../.ai/rules/testing-strategy.md`](../../../../.ai/rules/testing-strategy.md).
- Current-truth merge contract: [`doc/spec/features/feature-merge-verify-deploy.md`](../../../spec/features/feature-merge-verify-deploy.md)
  — its Overview resolution paragraph, gate-registry defaults, verification
  record head meaning, merged-report gate semantics and invariants are reconciled
  in this change.
- Merge test specification: [`doc/quality/test-specs/test-spec-merge-verify-deploy.md`](../../../quality/test-specs/test-spec-merge-verify-deploy.md)
  — rows "Composition reachability", "Required-check awareness", "Classification
  fidelity", "Emittable-code totality", "Error-identity stability" move here.
- Documented identity table: [`doc/spec/features/feature-result-contract.md`](../../../spec/features/feature-result-contract.md)
  (170 → 173 rows in the same change; 167 is a banned stale total).
- Merge command reference page: `doc/planning/oss-tooling/milestones/m1/commands/merge.md`
  (the page `check:help` resolves for `merge`).
- Delivered change-record **parse**: `parsePmNotesText` in
  `packages/adapters/src/file/pm-notes-parser.ts` — the parse the closeout
  composition already consumes, reused unchanged and applied to text obtained from
  the candidate head. `readPmNotesText` in the same module is the locate + read +
  parse **acquisition**, and is the one *not* used on this path: its working-tree
  root is exactly the ambient read the change removes.
- Delivered local object read precedent: the merge git seam's bounded,
  fixed-argv, tree-of-commit read (no shell, no network, no credential; injected
  child runner).
- Delivered per-job mapping: `evaluateRequiredJobGate` in
  `packages/core/src/domain/merge-probe.ts` — the single evaluator, reused.
- Contracts: `packages/core/src/contracts/merge.ts` (`MERGE_DEFAULT_GATE_ENTRIES`,
  `MERGE_BUILTIN_GATE_IDS`, `MERGE_GATE_ENTRY_FIELDS`,
  `MERGE_GATE_ERROR_PREFIX`/`SUFFIX`/`TEMPLATE`, and the three resolution
  constants), `packages/core/src/contracts/error-table.ts`,
  `packages/core/src/contracts/verify-gates.ts` (the gate-source vocabulary:
  `repository-ci-workflow`, `github-work-item`, `github-check-runs`,
  `github-delivery-request-list`, `github-delivery-request-detail` — the provider
  members of the closed `operation` vocabulary are **the filter** of this list to
  the six provider source names spec F-3 declares, a filter and not a derivation;
  spec F-3 completes the vocabulary with `local-change-record-read`,
  `local-git-object-read` and `-`, and it is validated where the summary is
  rendered).
- Credential reference: `githubReadReference` (`referenceName: "github-read"`,
  `sourceKey.name: "GITHUB_TOKEN"`) in `packages/cli/src/production.ts`.
- Decision records (all `Proposed`, amended 2026-11-20):
  [`TDR-0071`](../../../../decisions/TDR-0071-merge-change-branch-and-resolved-head-authority.md)
  (read-at-head resolution, candidate set, closed reasons, head binding),
  [`TDR-0072`](../../../../decisions/TDR-0072-required-check-authority-and-gate-membership.md)
  (required-check authority, gate membership, admitted surfaces),
  [`TDR-0073`](../../../../decisions/TDR-0073-refusal-diagnostics-and-emitted-identity-totality.md)
  (rendering fields, retryability, the narrowed abort, runtime declaration and
  totality).
- Delivered suites this plan re-points rather than invents:
  `tests/behaviour/merge-waivers.test.ts` (`TC-MERGE-018` authorized waiver,
  `TC-MERGE-019` unauthorized/unresolvable/non-waivable),
  `tests/behaviour/merge-convergence.test.ts` (its
  `expect(errorOf(result)?.retryable).toBe(true)` assertion moves with the abort
  row), `tests/structure/merge-suite-obligations.test.ts` (the closed
  sixteen-file population), `tests/checks/merge-suite-discovery.test.ts` (the
  pinned new-suite list).
- Base facts of this revision: `origin/main-tools` at `e1ebc76c`
  (`feat(GH-350): deliver declarative provider policy (#372)`), synced into the
  change branch before authoring. Every identity count below is stated on that
  base (170 entries / 169 delivered / 68 allowlist / `+136`), never on the
  intake snapshot.
- Owner acceptance trace (spec §17.6): AC 1 → AC-F1-1, AC-F1-2, AC-F1-5,
  AC-F5-2; already-merged convergence → AC-F1-6; AC 2 → AC-F2-1 … AC-F2-5,
  AC-F2-8; AC 3 → AC-F3-1 … AC-F3-4, AC-F4-1, AC-F4-2; AC 4 → AC-F1-1, AC-F2-1,
  AC-F3-2, AC-F5-3.

## 3. Coverage Overview

Every one of the 25 acceptance criteria appears below with at least one scenario.
No criterion is TODO: each has a carrier in the delivered field or observable
named in its scenario. §3.2 and §3.3 record interface and non-functional
coverage separately so a reader can see which dimension of each AC is proven.

Arithmetic of this revision: 49 scenarios (`TC-MRG-001` … `TC-MRG-049`) cover
25/25 functional criteria, 10/10 NFRs and 8/8 interface elements; 41 scenarios
carry forward from v1.0, seven were added in v1.1 (`TC-MRG-042` … `TC-MRG-048`)
and one in v1.2 (`TC-MRG-049`, the `AC-F1-6` carrier).

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Criterion (short) | TC ID(s) | Status |
|-------|-------------------|----------|--------|
| AC-F1-1 | Base-checkout invocation (worktree with no change folder, HEAD at the base tip) reads the declaration at the request's head, reports `declared-at-head`, and reports the request head as the resolved head *(owner AC 1, regression (a))* | TC-MRG-001, TC-MRG-002 | Covered |
| AC-F1-2 | Change-branch checkout at the request head: the record read at the request head governs over any record in the worktree, the verified head equals the request head, and `merged` follows the one guarded landing *(owner AC 1)* | TC-MRG-003 | Covered |
| AC-F1-3 | No candidate can establish a declaration refuses `merge.branch-unresolved` at exit 1 with exactly one closed reason (`declaration-missing`, `declaration-unusable`, `declaration-disagrees`, `record-missing`, `record-invalid`, `record-unreadable`) by declared precedence, naming the candidate source ref, tree path and key, having spent the bounded open-request list read (its candidate is on the page, so no closed convergence read is spent) and no other provider read, with zero landing calls | TC-MRG-004, TC-MRG-042 | Covered |
| AC-F1-4 | Zero convention-matching open candidates, more than three, a saturated page (evaluated before the candidate count, including a saturated page with zero convention-matching entries), two accepted candidates, or a non-full-SHA head refuses `merge.request-unresolved` with `no-open-request` / `ambiguous-open-request` / `head-unresolved`, naming convention, ref, open count and candidate count; a non-SHA head is never read. The fourth closed reason, `ambiguous-merged-request`, is the convergence-side counterpart carried by `AC-F1-6` (TC-MRG-049) | TC-MRG-005, TC-MRG-006, TC-MRG-007 | Covered |
| AC-F1-5 | A record whose head is the base tip refuses `merge.gates-stale` at exit 1 recording both SHAs with zero landing calls | TC-MRG-008 | Covered |
| AC-F1-6 | A unique merged match for the ref — observed as `0 | 1 | 2+` from one bounded **closed-request list** read whose entries are filtered by the declared branch convention, never ranked — with no readable change record anywhere, replays from provider truth at exit 0 with `replayed=true`, zero change-record reads and zero record-read git invocations, reporting neither `declared-at-head` nor `merge.branch-unresolved`, landing nothing; `2+` merged matches refuse `merge.request-unresolved` / `ambiguous-merged-request`, and `0` continues to the candidate path *(owner AC 1)* | TC-MRG-049, TC-MRG-043 | Covered |
| AC-F2-1 | One failing required check refuses `merge.gate.<gate-id>.failed` at exit 1 naming the check, the gate and the reason, zero landing calls *(owner AC 2, regression (b))* | TC-MRG-010 | Covered |
| AC-F2-2 | One queued or running required check refuses on the same family naming the check with the pending reason *(owner AC 2)* | TC-MRG-012, TC-MRG-027 | Covered |
| AC-F2-3 | All-green dry run reports `verified` and the merge lands once, so green and failing never share a verdict | TC-MRG-011 | Covered |
| AC-F2-4 | A page for another SHA is never head evidence; refuses naming both SHAs, never a pass | TC-MRG-013 | Covered |
| AC-F2-5 | A CI read fault refuses with the declared provider identity naming the failed operation in the dedicated `operation` field, never a pass | TC-MRG-014 | Covered |
| AC-F2-6 | A declared `required-ci-job` is enforced while an undeclared, non-expected job is not evidence | TC-MRG-015 | Covered |
| AC-F2-7 | Five built-ins reserved and mandatory with immutable recipe/class, omitted class adopts shipped class, `ci-green` admitted on `battery`/`both` and the other four on `battery` only | TC-MRG-016, TC-MRG-017 | Covered |
| AC-F2-8 | The merged report states `gates=2/2` over the evaluated merge-applicable projection with one line per entry (verdict and reason) and does not echo the verification record's battery list; the dry run states the same projection | TC-MRG-044 | Covered |
| AC-F3-1 | Every refusal across the enumerated matrix renders a dedicated `command=merge` field, a dedicated `ref=<ref>` field carrying the invocation's ref, a dedicated `operation=<token>` field from the closed vocabulary (or `-` when the refusal names no operation, validated at the rendering site), the code and ≥1 named cause with actionable-or-absent remediation, asserted against those fields *(owner AC 3)* | TC-MRG-023, TC-MRG-024, TC-MRG-046 | Covered |
| AC-F3-2 | Absent token refuses `config.credential.missing` naming reference, environment variable and operation *(owner AC 3, regression (c))* | TC-MRG-020, TC-MRG-021 | Covered |
| AC-F3-3 | Any credential condition is the declared credential/auth identity, never `merge.transaction-aborted` | TC-MRG-021 | Covered |
| AC-F3-4 | An unresolvable work item refuses `merge.work-item-unresolved` naming ref and read operation, remediation naming that cause | TC-MRG-022 | Covered |
| AC-F3-5 | `retryable` equals the emitted row's declared value and is never per-instance; remediation accurate for the named cause; no instruction to clear an unnamed condition | TC-MRG-025, TC-MRG-027 | Covered |
| AC-F3-6 | No row declares `retryable: true` while a cause it reaches needs an operator act; `merge.transaction-aborted` reaches exactly two pre-mutation causes (a waiver-append failure and a declared landing gap) and declares `false` with no convergence hint — while a refused landing reports `provider.outage` (transient/transport), `provider.auth.rejected` (rejected credential) or `merge.landing-unverified` (fired but unobserved), never the abort row *(owner AC 3)* | TC-MRG-026, TC-MRG-047 | Covered |
| AC-F4-1 | The totality proof ranges over the runtime family declaration exported beside the exact-member list (prefix, suffix, template, slot rule), not source text; a behaviour-preserving refactor passes; a live gate refusal resolves to the declared family row with the gate id preserved | TC-MRG-028, TC-MRG-029 | Covered |
| AC-F4-2 | Deleting the runtime family declaration, or replacing it with the bare exact-member list, makes the proof fail by name with no source-text assertion left to pass; the live mismatch control still reaches the containment identity | TC-MRG-045 | Covered |
| AC-F5-1 | Dry run and real merge report the same resolved branch, resolution source, request identity, candidate count, resolved head and merge-applicable gate projection | TC-MRG-030 | Covered |
| AC-F5-2 | A base-checkout dry run records the resolved request head; no waiver/transaction/git mutation; never `result=merged` or `squash=` | TC-MRG-001, TC-MRG-031 | Covered |
| AC-F5-3 | The new regression suites perform zero network calls and spawn no real child process; existing no-live-call guards stay green *(owner AC 4)* | TC-MRG-036 | Covered |

**Counts.** 25 criteria, 25 with at least one carrier, 0 TODO. F-1 — 6
criteria, carried by TC-MRG-001…008, 042, 043, 049. F-2 — 8 criteria, carried by
TC-MRG-010…019 and 044. F-3 — 6 criteria, carried by TC-MRG-020…027, 046, 047.
F-4 — 2 criteria, carried by TC-MRG-028, 029, 045. F-5 — 3 criteria, carried by
TC-MRG-001, 030, 031, 036, 044. Non-functional — 10 NFRs, carried by TC-MRG-023,
024, 033…040. Interface — 8 elements, carried by TC-MRG-004…009, 016, 017,
019, 023…034, 038, 041, 042, 044, 046, 049.

**Owner acceptance trace, kept visible.** Owner AC 1 → TC-MRG-001, TC-MRG-002,
TC-MRG-003, TC-MRG-008, TC-MRG-031. Already-merged convergence →
**TC-MRG-049** and TC-MRG-043. Owner AC 2 → TC-MRG-010, TC-MRG-011,
TC-MRG-012, TC-MRG-013, TC-MRG-014, TC-MRG-044. Owner AC 3 → TC-MRG-020,
TC-MRG-021, TC-MRG-022, TC-MRG-023, TC-MRG-024, TC-MRG-028, TC-MRG-045,
TC-MRG-046. Owner AC 4 → TC-MRG-001, TC-MRG-002, TC-MRG-010, TC-MRG-020,
TC-MRG-036. Pending-check refusal and the retained explicit waiver path →
TC-MRG-012, TC-MRG-027, TC-MRG-011 and **TC-MRG-048** (which asserts a successful
explicit `--waive owner-gate --waived-by <authorized principal>`; `AC-F2-7` is no
longer cited for the waiver item — readiness finding 17). Unreadable work item,
no unnamed remediation, honest `retryable` → TC-MRG-022, TC-MRG-023, TC-MRG-024,
TC-MRG-025, TC-MRG-026, TC-MRG-047. Dry run describes the landed object →
TC-MRG-030, TC-MRG-031, TC-MRG-044.

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

| ID | Surface | TC ID(s) | Assertion carried |
|----|---------|----------|-------------------|
| API-1 | `merge <ref>` | TC-MRG-001, TC-MRG-003, TC-MRG-008, TC-MRG-030, TC-MRG-044, TC-MRG-049 | Resolved branch, resolution source, request identity, candidate count, resolved head and the evaluated required-check count/set size are reported; an already-merged request reports `replayed=true` with the matched request identity and no resolution source, having observed the merged match as `1` of `0 | 1 | 2+` from the closed-request read; the landing's expected head is the resolved head; the report's gate projection is the merge-applicable projection the run evaluated (`gates=2/2`), not the record's battery list (rendered from phase 6; asserted by TC-MRG-044) |
| API-2 | `merge <ref> --dry-run` | TC-MRG-030, TC-MRG-031, TC-MRG-032, TC-MRG-044 | Same resolved object and same merge-applicable projection as the real merge; one verification record for the resolved head; zero waiver/transaction/git mutation; never `result=merged` or `squash=` |
| API-3 | Refusal envelope | TC-MRG-023, TC-MRG-024, TC-MRG-025, TC-MRG-026, TC-MRG-027, TC-MRG-046 | `error.code` is the stored identity or family instance; the summary renders dedicated `command=merge`, `ref=<ref>` and `operation=<token>` fields (parsed as fields, not substring matches; the `operation` token is a member of the closed vocabulary or `-`, validated at the rendering site, and a token outside it is rejected rather than emitted), the code, the breached contract and the offending object; evidence bounded and secret-free; `retryable` is the row's declared value; a landing fault reports a **declared identity** — `provider.outage` / `provider.auth.rejected` / `merge.landing-unverified` / `config.credential.missing` — and never `merge.transaction-aborted` and never the arbitrary port code `protection-rule` |
| EVT-1 | `delivery.merge.gate-verification.v1` record | TC-MRG-032 | Schema and kind unchanged; a merge-surface dry-run record carries the CI gate entry alongside the tracker entry, and its citation declares the sources it read (`repository-ci-workflow`, `github-check-runs`); `verify gates` records byte-identical |
| EVT-2 | Capsule and delivery-registry events | TC-MRG-041 | No new event kind, key or schema; resolution facts are command data, not a persisted event |
| DM-1 | Change-record `branch` declaration | TC-MRG-004, TC-MRG-009, TC-MRG-042 | Additive top-level key read at the candidate head (never the working tree), ≤ 256 characters, opaque to lint, preserved value-faithfully by document-writing branches, never inspected by another surface |
| DM-2 | Resolved change context (non-persisted) | TC-MRG-019, TC-MRG-030, TC-MRG-034, TC-MRG-044, TC-MRG-049 | Resolved branch, source, request identity, candidate count, resolved head, required-check count/set size and the merge-applicable gate projection are reported, bounded, and never written as a record; a converged replay reports `replayed=true` with the resolution fields absent |
| DM-3 | Merge-applicable membership and admitted surfaces | TC-MRG-016, TC-MRG-017, TC-MRG-038 | Two merge-applicable entries under the shipped default; declared admitted surface sets; no identity, schema-version, recipe or configuration-key change |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR | Threshold (v2.1) | TC ID(s) | How it is carried |
|-----|------------------|----------|-------------------|
| NFR-1 | 20 consecutive byte-identical runs for one success and six refusals (`declaration-missing`, `record-unreadable`, request unresolved, gate failure, pending check, credential missing); a changed-fact control differs | TC-MRG-033 | Twenty fresh harness runs per scenario, stdout/stderr/exit compared; a flipped fact must differ |
| NFR-2 | **At most two provider reads** on the resolution path: (1) the bounded **open-request list** read, which also supplies the request detail, and (2) at most one bounded **closed-request list** read for merged truth, spent at the convergence decision and filtered by the declared branch convention — `0 | 1 | 2+` observed, `2+` refused, never ranked. A run resolved from the open list spends one; a converged replay, an `ambiguous-merged-request` refusal or a refusal reached through the convergence decision spends two; the replay spends **zero** record reads. Plus at most 3 bounded local change-record reads (each ≤ 2 fixed-argv git invocations, ≤ 262 144 bytes), one work-item read, one CI-workflow read, one check-run page on the resolved head, one verification read; ≤ 1 post-refusal re-read, ≤ 1 unknown-recovery re-read, ≤ 1 landing call; zero retries, zero pagination, zero fetches | TC-MRG-034, TC-MRG-049 | Per-invocation counters and the transport request log compared to the declared budget as an exact multiset (the open-list URL and, on convergence cells, the closed-list URL, each at most once); the convergence cell asserts an exact zero on the record-read and record-read-git counters |
| NFR-3 | Machine `data` ≤ 65 536 UTF-8 bytes; human summary ≤ 24 lines / ≤ 4 096 bytes; every dropped item marked `+N`; no new unbounded field | TC-MRG-035 | Byte and line counts on the new refusal/evidence shapes; omission marks asserted |
| NFR-4 | Zero network calls in every new suite; no real child process (the local record read and the git seam run through the injected child runner); no-live-call guards green | TC-MRG-036 | Throwing fetch guard records zero calls; injected child-runner seam records zero real invocations; static scan of the new suites |
| NFR-5 | 100 % of refusals across the 22-cell matrix render dedicated `command`, `ref` and `operation` fields, the code, ≥1 named cause and actionable-or-absent remediation; every `operation` token is a member of the closed vocabulary or `-`, and 0 tokens outside it are rendered because the value is validated at the rendering site; 0 instructions to clear an unnamed condition | TC-MRG-023, TC-MRG-024, TC-MRG-046 | Enumerated 22-cell matrix with parsed field assertions, the closed-vocabulary membership check, plus a planted unnamed-remediation/absent-field/out-of-vocabulary control |
| NFR-6 | 0 reads of the checkout's branch, 0 reads of the checkout's head, 0 working-tree change-record reads, 0 fetch/pull invocations on the merge path, proven by a source scan with mandatory failing controls | TC-MRG-037 | Production-source scan over the merge path with planted reads found by file and line, one per absence claim |
| NFR-7 | 100 % of emitted codes resolve to a row or the declared family, slot validated against the effective gate set; the proof ranges over the **runtime declaration** and fails by name when removed; no pattern widening; live mismatch control | TC-MRG-028, TC-MRG-029, TC-MRG-045 | Totality predicate over the derived emission set and the exported runtime value, plus the removal mutation and the mismatch control |
| NFR-8 | Effective gate-set id sequence unchanged; **170 → 173** machine entries, **169 → 172** delivered, **68 → 71** allowlist, **`+136` → `+139`**, `merge` kind **9 → 12**; 167 stays a banned stale total and the phrase table rotates | TC-MRG-038 | Identity arithmetic, seven pin sites, two count pages, four doc surfaces, the exact identity string, the banned-total scan |
| NFR-9 | 0 occurrences of a credential value, title, body, comment, raw payload or log line, verified with canary secrets | TC-MRG-039 | Canary set over stdout, stderr, envelope and every appended record; the reference name and env-var name remain present, the value never |
| NFR-10 | The resolution adds **no provider read beyond the declared two-read budget**: the closed-request convergence read is the same provider operation the delivered merged-request read performs, now filtered by the declared branch convention; record reads are local, ≤ 3, ≤ 2 git invocations each, ≤ 262 144 bytes, network-free; `record-unreadable` adds only the failed local read; no added polling or waiting | TC-MRG-040 | Provider-request population equals two on the convergence path and one on an open-resolved path; local read counters bounded; clock/read counters show no loop |

## 4. Test Types and Layers

All layers run in-process with `bun test` (or `pnpm test`); the repository's
map is `packages/**` → `tests/structure` + `tests/behaviour` + the boundary
suite + `pnpm typecheck`, plus `tests/checks/**` for repository invariants and
`tests/golden/**` for byte pins.

| Layer | Location | Framework / convention | What this change uses it for |
|-------|----------|------------------------|------------------------------|
| Behaviour (transaction) | `tests/behaviour/merge-*.test.ts` over `tests/fixtures/merge/harness.ts` | `bun:test`; the real command definition over injected ports, a real temp state ledger, a recording fake git seam | Per-job evaluation, pending/other-head/undeclared-job cells, freshness comparison, landing count, determinism, read budget, bounds |
| Behaviour (production composition) | `tests/behaviour/merge-production-composition.test.ts` over `tests/fixtures/merge/production-composition.ts` | `bun:test`; the shipped `createProductionComposer` over a real temp checkout with only transport, credential, configuration-fs, state-store wrap and the child runner injected | Candidate-set resolution, the six branch reasons and their precedence, credential and read-fault naming, base-tip refusal, dry-run/merge agreement, end-to-end regression (a)/(b)/(c) |
| Behaviour (local object read) | `tests/behaviour/merge-git-seam-capabilities.test.ts` + the composition fixture's recording child-runner seam | `bun:test`; fixed-argv invocations recorded, no real process | The record read at a candidate head: argv shape, the `ls-tree` + blob sequence, the byte bound, the candidate cap, and `record-unreadable` when the head object is absent from the object database |
| Structure / contract | `tests/structure/merge-*.test.ts`, `tests/structure/defect-f1-merge-refusal-containment.test.ts`, `tests/structure/error-table.test.ts`, `tests/structure/pm-notes-contract.test.ts` | `bun:test`; exact-set equality against production constants, source reads, temp-tree sync runs | Gate-set validation and admitted surfaces, row-level retryability honesty, identity totality, identity stability, record shapes |
| Repository checks | `tests/checks/merge-check-path-scan.test.ts`, `merge-landing-retirement.test.ts`, `merge-deploy-no-live-calls.test.ts`, `merge-suite-discovery.test.ts`, `error-table-sync.test.ts` (+ new `merge-branch-read-scan.test.ts`) | `bun:test`; production-source scans with mandatory planted controls | Single-evaluator scan, the no-ambient-read quartet (branch, head, working-tree record, fetch), offline guard, suite discovery/offline static scan, two-table sync |
| Golden | `tests/golden/merge.test.ts` over `tests/fixtures/merge/golden/` | `bun:test`; committed byte files with a mutation control | The declared per-phase movement (13 committed files move at least once, six added; `EXPECTED` 13 → 15 in phase 2 → 19 in phase 3, unchanged at 19 in phase 6), including all five refusal human and all five refusal scripted files; each phase that changes a byte runs this suite in its own gate; the battery-side `verify gates` record stays byte-identical |
| Content (docs) | Manual + `tests/checks/doc-conformance.test.ts` | Traceability and link review; current-truth phrase table | NFR-8's four doc surfaces, the rotated arithmetic token, and the `branch` authoring guidance |
| E2E / live provider | — | Not used | Forbidden by NFR-4/AC-F5-3; the family-wide battery is explicitly out of scope (§1.2) and no installed-binary conformance run is claimed |

Assertion discipline for this plan: every expected outcome names a value — an
exit code, an exact `error.code`, a named evidence token, a parsed rendering
field (`command`, `ref`, `operation`), a SHA pair, a read count, a byte bound, an
identity total, or a set equality. No case asserts that "a refusal renders" or
that "a report exists", and no case satisfies a field claim by finding the
string `merge` inside a code or the ref inside unrelated prose.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Scenario Type | Test Type(s) | Layer | Priority | AC Coverage |
|-------|-------|---------------|--------------|-------|----------|-------------|
| TC-MRG-001 | Base-checkout invocation resolves and verifies the request head | Regression | Integration, Contract | Behaviour (production composition) | High | AC-F1-1, AC-F5-2 |
| TC-MRG-002 | Control: the pre-fix branch source reproduces the base-tip verdict | Regression | Integration | Behaviour (production composition) | High | AC-F1-1 |
| TC-MRG-003 | Change-branch checkout: the record at the request head governs and the merge lands once | Happy Path | Integration | Behaviour (production composition) | High | AC-F1-2 |
| TC-MRG-004 | No usable declaration refuses `declaration-missing` / `declaration-unusable` | Negative | Integration, Contract | Behaviour (production composition) | High | AC-F1-3, DM-1 |
| TC-MRG-005 | Zero convention-matching candidates refuse `no-open-request` | Negative | Integration | Behaviour (production composition) | High | AC-F1-4 |
| TC-MRG-006 | Over-cap candidates, a saturated page (even with zero matches) or two accepted refuse `ambiguous-open-request` | Negative | Integration | Behaviour (production composition) | High | AC-F1-4 |
| TC-MRG-007 | A candidate head that is not a full SHA refuses `head-unresolved` and is never read | Negative | Integration | Behaviour (production composition) | High | AC-F1-4 |
| TC-MRG-008 | A record for the base tip refuses `merge.gates-stale` with both SHAs | Negative | Integration | Behaviour (production composition) | High | AC-F1-5 |
| TC-MRG-009 | The `branch` declaration is lint-opaque and value-faithfully preserved | Edge Case | Contract, Integration | Behaviour (pm-notes lint + phase writes) | Medium | DM-1 |
| TC-MRG-010 | One failing required check refuses with the check, gate and reason named | Regression | Integration | Behaviour (production composition) | High | AC-F2-1, NFR-5 |
| TC-MRG-011 | All-green dry run verifies and the merge lands once, distinct from red | Happy Path | Integration | Behaviour (dry run + landing) | High | AC-F2-3 |
| TC-MRG-012 | A queued or running required check refuses with the pending reason | Negative | Integration | Behaviour (transaction) | High | AC-F2-2, NFR-5 |
| TC-MRG-013 | A check-run page for another SHA is never head evidence | Negative | Integration | Behaviour (transaction) | High | AC-F2-4 |
| TC-MRG-014 | A CI read fault names the failed operation in the `operation` field | Negative | Integration | Behaviour (production composition) | High | AC-F2-5 |
| TC-MRG-015 | A declared required job is enforced; an undeclared job is not evidence | Corner Case | Integration | Behaviour (transaction) | High | AC-F2-6 |
| TC-MRG-016 | Built-ins stay reserved, mandatory and recipe/class-immutable | Negative | Contract | Behaviour (gate set) + Structure | High | AC-F2-7 |
| TC-MRG-017 | Admitted surface sets admit `ci-green` on `battery`/`both` only | Negative | Contract | Behaviour (gate set) + Structure | High | AC-F2-7, DM-3 |
| TC-MRG-018 | An invalid repository expected-job set refuses and never passes | Negative | Integration | Behaviour (transaction) | Important | F-2 |
| TC-MRG-019 | The dry run discloses the evaluated required-check posture | Edge Case | Integration | Behaviour (dry run) | Important | F-2, API-2 |
| TC-MRG-020 | An absent token names reference, environment variable and operation | Regression | Integration | Behaviour (production composition) | High | AC-F3-2, NFR-9 |
| TC-MRG-021 | A credential condition is never `merge.transaction-aborted` | Negative | Integration, Contract | Behaviour (production composition) | High | AC-F3-3, AC-F3-2 |
| TC-MRG-022 | An unresolvable work item refuses with its own identity and cause | Negative | Integration | Behaviour (production composition) | High | AC-F3-4, NFR-5 |
| TC-MRG-023 | Every matrix refusal renders command/ref/operation fields, code and a named cause | Negative | Contract | Behaviour (refusal surface) | High | AC-F3-1, NFR-5 |
| TC-MRG-024 | Control: a missing field, an unnamed cause or an unnamed-remediation hint is flagged | Negative | Contract | Behaviour (refusal surface) | High | AC-F3-1, NFR-5 |
| TC-MRG-025 | `retryable` is always the emitted row's declared value | Edge Case | Contract | Behaviour (refusal surface) + Structure | High | AC-F3-5 |
| TC-MRG-026 | No row claims `retryable: true` over an act-requiring cause | Edge Case | Contract | Structure (refusal rows) | High | AC-F3-6 |
| TC-MRG-027 | A pending cause converges without an act and its remediation says so | Edge Case | Integration, Contract | Behaviour (probe + rendering) | High | AC-F3-5, AC-F2-2 |
| TC-MRG-028 | A gate refusal resolves to the runtime-declared family, gate id preserved | Happy Path | Contract | Structure (containment + conformance) | High | AC-F4-1, NFR-7 |
| TC-MRG-029 | A live mismatch control still reaches containment; no slot widening | Corner Case | Contract | Structure (containment + conformance) | High | AC-F4-1, NFR-7 |
| TC-MRG-030 | Dry run and real merge report the same resolved object; each asserts its own projection | Happy Path | Integration | Behaviour (production composition) | High | AC-F5-1 |
| TC-MRG-031 | A base-checkout dry run records the resolved head with zero mutation | Regression | Integration | Behaviour (production composition, record) | High | AC-F5-2 |
| TC-MRG-032 | The merge-surface CI entry is cited by source; battery records unchanged | Edge Case | Integration, Contract | Behaviour (record) + Golden | Important | EVT-1 |
| TC-MRG-033 | Twenty runs are byte-identical across one success and six refusals | Regression | Integration, Performance | Behaviour (determinism) | High | NFR-1 |
| TC-MRG-034 | The per-invocation read budget holds exactly | Corner Case | Integration, Performance | Behaviour (probe + composition) | High | NFR-2 |
| TC-MRG-035 | Machine and human output stay inside the declared bounds | Corner Case | Integration, Performance | Behaviour (bounds) | Medium | NFR-3 |
| TC-MRG-036 | The new suites are offline: no network, no real child process | Regression | Integration, Contract | Behaviour + Checks | High | NFR-4, AC-F5-3 |
| TC-MRG-037 | The merge path reads no ambient branch, head or working-tree record | Regression | Contract | Checks (source scan) | High | NFR-6 |
| TC-MRG-038 | Identities move 170 → 173 with the gate-set identity unchanged | Regression | Contract | Structure + Checks + docs | High | NFR-8 |
| TC-MRG-039 | Canary secrets never reach output or records | Negative | Integration, Contract | Behaviour (privacy) | High | NFR-9 |
| TC-MRG-040 | The added reads are local, bounded and network-free, with no added polling | Corner Case | Integration, Performance | Behaviour (read counts) | Medium | NFR-10 |
| TC-MRG-041 | No new record kind, key or event schema; shapes unchanged | Regression | Contract | Structure (record shapes) | Medium | EVT-2, DM-3 |
| TC-MRG-042 | Six closed branch reasons, the declared precedence and the candidate bounds | Negative | Integration, Contract | Behaviour (production composition + local read) | High | AC-F1-3, DM-1, NFR-2, NFR-5 |
| TC-MRG-043 | A converged re-run replays from provider truth without a record read | Corner Case | Integration | Behaviour (production composition) | High | AC-F1-6 (primary), AC-F1-3, AC-F5-1, NFR-2 |
| TC-MRG-044 | The merged report renders the evaluated merge-applicable projection | Happy Path | Integration, Contract | Behaviour (production composition, report) | High | AC-F2-8, AC-F5-1, API-1 |
| TC-MRG-045 | Deleting the runtime family declaration fails the totality proof by name | Negative | Contract | Structure (containment + conformance) | High | AC-F4-2, NFR-7 |
| TC-MRG-046 | The five refusal renderings carry `command`/`ref` fields and all ten refusal goldens move | Regression | Contract, Integration | Behaviour (refusal surface) + Golden | High | AC-F3-1, NFR-5, NFR-3 |
| TC-MRG-047 | The abort row declares `retryable: false` and the convergence assertion moves | Regression | Contract, Integration | Structure (refusal rows) + Behaviour (convergence) | High | AC-F3-6, AC-F3-5 |
| TC-MRG-048 | An explicit `--waive` still authorizes where a class binding exists | Regression | Integration, Contract | Behaviour (waiver surface) | High | F-2 (retained path), NFR-5 |
| TC-MRG-049 | Already-merged convergence: provider truth replays with zero record reads and lands nothing | Corner Case | Integration, Contract | Behaviour (production composition) | High | AC-F1-6, NFR-2, API-1, DM-2 |

**Plan-phase allocation (OQ-TP-3 closed).** Every case is allocated to exactly one
`chg-GH-366-plan.yaml` phase, and each scenario detail restates it on a
`Plan Phase(s)` line. Phase 1 (planning) carries no case. Phase 2 — TC-MRG-020,
021, 022, 026, 027, 039, 047, 048 (8). Phase 3 — TC-MRG-001, 002, 003, 004, 005,
006, 007, 008, 009, 030, 031, 036, 037, 042, 043, 049 (16). Phase 4 — TC-MRG-010,
011, 012, 013, 014, 015, 016, 017, 018, 019, 023, 024, 025, 032, 034, 040 (16).
Phase 5 — TC-MRG-028, 029, 045 (3). Phase 6 — TC-MRG-033, 035, 041, 044, 046 (5).
Phase 7 — TC-MRG-038 (1). Total **49**, disjoint: 8 + 16 + 16 + 3 + 5 + 1 = 49.
Allocation follows the plan's own index where it exists; the eight cases added
after v1.0 are allocated to the phase whose scope lands their last dependency
(042/043/049 to the resolution phase — the plan's phase 3 already scopes the
convergence behaviour and the local record read — 044/046 to the
report-and-golden phase, 045 to the declaration phase, 047/048 to the diagnostics
phase). The plan revision that carries this test-plan revision raises phase 3's
declared allocation from 15 of 48 to 16 of 49; the case ids, not the plan's
comment arithmetic, are the binding statement.

### 5.2 Scenario Details

#### TC-MRG-001 - Base-checkout invocation resolves and verifies the request head

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Plan Phase(s)**: 3
**Related IDs**: F-1, AC-F1-1, AC-F5-2, API-1, DM-1, DM-2, NFR-2, NFR-6
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-production-composition.test.ts` (update; the suite's current assertion that the branch comes from the checkout's git facts is replaced per spec §16)
**Tags**: @backend, @api, @merge

**Preconditions**:

- One `createMergeProductionHarness` fixture whose temp checkout has `HEAD`
  detached/attached on the integration base tip (`main-tools`) and whose **working
  tree contains no change folder** — no
  `doc/changes/<YYYY-MM>/<date>--<ref>--<slug>/` directory for the change. This is
  the load-bearing fixture constraint (spec AC-F1-1, §8.1 TP-R-10): a fixture that
  writes `chg-<ref>-pm-notes.yaml` into the checkout does not reproduce the real
  invocation and no longer satisfies this case.
- The change record **is committed on the feature branch** at the request head,
  i.e. in the local object database, carrying `branch: <feature branch>` as a
  top-level key. It is obtained by the run only through the local tree/blob read at
  the request's asserted head (the delivered child-runner seam records the
  `ls-tree -r --name-only <sha> -- <pathspec>` plus one blob read).
- The injected transport answers the bounded open-request list with exactly one
  open entry whose `head.ref` follows the declared convention and equals the
  declared branch, and whose `head.sha` is the request head; it answers the work
  item and the check-run page for that head.
- The checkout's own branch and head are distinct from the request head, so a
  checkout-derived answer is observably wrong.

**Steps**:

1. Run `merge <ref> --dry-run --json` from the base checkout.
2. Read `data.resolvedBranch`, `data.resolutionSource`, `data.requestIdentity`,
   `data.candidateCount` and `data.headSha` from the envelope.
3. Read the appended verification records, the transport request log and the local
   read counters.
4. Run `merge <ref> --json` from the same checkout with the same fixtures.

**Expected Outcome**:

- Both runs report `resolvedBranch` equal to the declared change branch,
  `resolutionSource` equal to `declared-at-head`, `requestIdentity` equal to the
  matched request's number, `candidateCount` equal to `1`, and `headSha` equal to
  the request head.
- `headSha` does not equal the base tip in either run; no output, record or
  evidence member contains the base tip as `headSha`/`verified head`.
- The record read addresses the request head: the recorded tree invocation carries
  that SHA and a pathspec under `doc/changes/`, and no working-tree read of the
  change folder occurs (the folder does not exist in the worktree).
- The check-run read addresses the request head (the request URL carries that
  SHA), not the base tip.
- Exactly one provider read (the open-request list) and at most one local record
  read leave the process in each run; no closed convergence read is spent, because
  the open page yields the unique convention-matching candidate.
- The real merge's landing call count is 1 and its expected head is the request
  head; the dry run's count is 0.
- Wall-clock/exit: dry run exits 0 with `result=verified`; the merge exits 0 with
  `result=merged`.

**Notes / Clarifications**:

- This is owner regression (a) and the owner AC 1 carrier. The assertion is the
  SHA inequality plus the named resolution source plus the head-addressed read,
  not "the dry run finished".
- The fixture's base checkout must be a clone that holds the branch's objects
  (spec §12 assumption); `TC-MRG-042`'s `record-unreadable` cell covers the clone
  that does not.

#### TC-MRG-002 - Control: the pre-fix branch source reproduces the base-tip verdict

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Plan Phase(s)**: 3
**Related IDs**: F-1, AC-F1-1, NFR-6
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-production-composition.test.ts` (control in the same file as TC-MRG-001)
**Tags**: @backend, @api, @merge

**Preconditions**:

- The TC-MRG-001 fixture and data, unchanged — same base-tip `HEAD`, same absent
  change folder in the worktree, same record at the request head.
- One substituted binding of the composition's branch-resolution seam to the
  checkout's own git facts — the pre-fix source
  (`resolvedRepositoryFacts.head.branch`), which is the base branch in this
  fixture. No pre-fix code from an earlier commit is executed: the control
  substitutes the *derivation value*, exactly as the delivered `defect-f1` control
  substitutes the pre-fix declaration.

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
- The control performs no network call, no real child process and no working-tree
  record read.

**Notes / Clarifications**:

- Delivered precedent for the substitution shape:
  `tests/structure/defect-f1-merge-refusal-containment.test.ts` — "no case
  executes pre-fix code from an earlier commit".
- The control is what distinguishes C-1's *declared* source from a fixture that
  merely moved the answer: the same fixture must fail when the checkout-derived
  value is substituted back.

#### TC-MRG-003 - Change-branch checkout: the record at the request head governs and the merge lands once

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Plan Phase(s)**: 3
**Related IDs**: F-1, AC-F1-2, API-1, DM-1, DM-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-production-composition.test.ts` (update) with the landing-count oracle in `tests/behaviour/merge-landing.test.ts`
**Tags**: @backend, @api, @merge

**Preconditions**:

- The TC-MRG-001 fixture with the checkout left on the change branch at the
  request head, so the worktree *does* contain a change folder.
- The record at the request head declares `branch: <feature branch>`; the worktree
  copy carries a **different** declaration (a sibling branch of the same ref) so
  the governing copy is observable.
- The open-request list returns exactly one entry asserting that head; the page is
  all green and the work item is fresh.

**Steps**:

1. Run `merge <ref> --json`.
2. Read `data.result`, `data.headSha`, `data.resolvedBranch` and the recorded
   landing input.
3. Read the transaction records, the git seam's operation log and the local read
   log.
4. Lint the worktree record and read its verdict.

**Expected Outcome**:

- `result=merged` with `headSha` equal to the request head and `resolvedBranch`
  equal to the head record's declaration; the worktree's disagreeing value never
  appears as a resolved fact.
- The local read log shows the tree/blob read at the request head; no
  working-tree read of `chg-<ref>-pm-notes.yaml` is recorded.
- Exactly one landing call (count 1), its expected head equal to the request head,
  and exactly one transaction record.
- The merge never lands before the verification/freshness/gate path completes:
  the operation log's landing entry is the last mutating entry, and no
  rebase/fetch/push entry exists.
- Exit 0.

#### TC-MRG-004 - No usable declaration refuses `declaration-missing` / `declaration-unusable`

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Plan Phase(s)**: 3
**Related IDs**: F-1, AC-F1-3, DM-1, API-3, NFR-2, NFR-5
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-production-composition.test.ts` (new cell family) with the cap pin in `tests/structure/merge-contract.test.ts`
**Tags**: @backend, @api, @merge

**Preconditions**:

- Four fixture cells over the same base-checkout fixture (worktree carries no
  change folder, `HEAD` at the base tip), each with one open request whose source
  ref follows the declared convention and whose head holds the record:
  (i) the record is a mapping with no `branch` key; (ii) `branch: ""`; (iii)
  `branch` is a non-string scalar; (iv) `branch: "   "` (whitespace only) or a
  value containing a control character.
- A fifth cell with a value of **257 characters** — one over
  `MERGE_BRANCH_DECLARATION_MAX_CHARS = 256`, measured in characters and never
  truncated (the cap is read from the contract constant, not transcribed).
- The transport is recording; the state ledger is empty; the child-runner seam
  records invocations.

**Steps**:

1. For each cell, run `merge <ref> --json` and `merge <ref> --dry-run`.
2. Read `error.code`, the single closed reason member, `error.summary` and the
   `command`/`ref` rendering fields.
3. Read the transport request log, the local read counters and the state ledger.

**Expected Outcome**:

- Every cell exits 1 with `error.code === "merge.branch-unresolved"` and exactly
  one closed reason: `declaration-missing` for cells (i)–(iii),
  `declaration-unusable` for cell (iv) and the 257-character cell. No run reports
  more than one reason.
- The summary names the candidate's source ref, the change-record tree path at
  that head, the `branch` key, `command=merge` and `ref=<ref>`; the unusable cells
  also name the cap and the unusable value class. The 256-character control value
  is accepted and resolves (the boundary is asserted on both sides).
- **Exactly one provider read** — the bounded open-request list — is recorded, and
  no other provider request: the earlier "zero provider reads" claim is superseded
  by spec v2.1 (the candidate set can only come from that read). No fetch, no pull.
- At most one local record read occurs per cell (one candidate), and the
  verification ledger has zero appended records and the transaction ledger zero
  records: zero landing calls.
- No cell's output contains `merge.transaction-aborted` or `fallback.internal`.
- The remediation names the declaration to add (record path plus the key, or the
  corrected value), not an unnamed condition.

**Notes / Clarifications**:

- The record-side reasons (`record-missing`, `record-invalid`,
  `record-unreadable`) and `declaration-disagrees`, plus the declared precedence
  across several failing candidates, are carried by TC-MRG-042; this case is the
  two declaration-value reasons plus the cap boundary.

#### TC-MRG-005 - Zero convention-matching candidates refuse `no-open-request`

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Plan Phase(s)**: 3
**Related IDs**: F-1, AC-F1-4, API-3, DM-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-production-composition.test.ts` (new cell; the delivered `merge.transaction-aborted` expectation for this input is replaced)
**Tags**: @backend, @api, @merge

**Preconditions**:

- The base-checkout fixture; the open list read returns an **unsaturated** empty
  page (`pageItemCount < limit`), and in a second cell open entries whose source
  refs are **near misses** for the invocation's ref:
  a different case, a different prefix (`feature/GH-366/...`), a suffix mismatch
  (`fix/GH-3660/...`), and a branch with no `<type>/<REF>/<slug>` shape at all.
  Because no convention-matching candidate exists, the run reaches the convergence
  decision and spends the one bounded **closed-request list** read, which returns
  **0** merged matches, so `no-open-request` is decided rather than assumed.
- The work item and check-run replies are healthy, so a wrong path would pass.
- The saturated counterpart of this input is TC-MRG-006's cell (iv): the two cases
  differ only in the saturation flag, so the precedence is asserted by a pair
  rather than by one fixture.

**Steps**:

1. Run `merge <ref> --json`.
2. Read `error.code`, the closed reason member, the summary's counted facts and
   the `command`/`ref` fields.
3. Read the transport log, the local read counters and the state ledger.

**Expected Outcome**:

- Exit 1 with `error.code === "merge.request-unresolved"` and the closed reason
  exactly `no-open-request`.
- The summary names the declared convention (`^[a-z][a-z0-9-]*/<REF>/.+$` in
  operator terms), the change ref, the observed open count and the candidate
  count `0`; `ref=<ref>` equals the invocation ref.
- Near-miss source refs do not match: the same empty outcome, never an entry
  chosen by fuzzy comparison. A non-conforming branch is invisible to the filter
  and produces this same refusal, not a branch refusal.
- The page is **unsaturated** in both cells, so `no-open-request` is a claim about
  the whole open population. The identical zero-candidate input on a saturated page
  refuses `ambiguous-open-request` instead (TC-MRG-006 cell (iv)): saturation is
  evaluated before the candidate count and a truncated page establishes no
  uniqueness, including no zero count.
- **Zero local record reads** (no candidate exists to read) and zero landing
  calls; the run spends exactly the two bounded list reads — the open page and the
  closed convergence read — and no other provider read. The convergence read is
  what makes the zero a decision: a run that skipped it could not distinguish
  "never opened" from "already merged".
- The code is a member of the composition's declared emittable set; the output
  contains no `merge.transaction-aborted`.

#### TC-MRG-006 - Over-cap candidates, a saturated page (even with zero matches) or two accepted refuse `ambiguous-open-request`

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Plan Phase(s)**: 3
**Related IDs**: F-1, AC-F1-4, API-3, DM-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-production-composition.test.ts` (new cell family)
**Tags**: @backend, @api, @merge

**Preconditions**:

- Four ambiguity cells over the base-checkout fixture:
  (i) **four** open entries whose source refs follow the convention for the ref
  (`MERGE_BRANCH_CANDIDATE_MAX = 3`), all with distinct full-SHA heads;
  (ii) a **saturated** bounded page (`pageItemCount >= limit`) containing exactly
  one convention-matching entry, so a truncation-blind implementation would
  resolve;
  (iii) two candidates that each declare their own source ref exactly, i.e. two
  accepted candidates (the declared guard);
  (iv) a **saturated** bounded page containing **zero** convention-matching
  entries — the precedence cell: `no-open-request` and
  `ambiguous-open-request` are both literally true here, and the declared order
  decides.

**Steps**:

1. For each cell, run `merge <ref> --json`.
2. Read `error.code`, the closed reason, the summary's open/candidate counts, the
   saturation fact and the `command`/`ref`/`operation` fields.
3. Read the local read counters, the state ledger and the landing count.
4. For cell (iv), assert the order explicitly: saturation is evaluated **before**
   the candidate count, so the run refuses `ambiguous-open-request` and never
   evaluates a zero-candidate `no-open-request`; then re-run the same fixture with
   the saturation flag cleared and assert the pair flips to `no-open-request`
   (TC-MRG-005's input), which is what makes the precedence observable rather than
   incidental.

**Expected Outcome**:

- Every cell exits 1 with `error.code === "merge.request-unresolved"` and the
  reason exactly `ambiguous-open-request`.
- Cell (i) names the candidate count `4` and the cap; cell (ii) names the page
  saturation (a bounded page cannot establish uniqueness) even though exactly one
  entry matches; cell (iii) names both accepted source refs and presents neither
  identity as *the* request; cell (iv) names the page saturation and the observed
  candidate count `0`, and its summary carries no `no-open-request` claim.
- Cell (iv)'s desaturated control exits 1 with the reason `no-open-request`: the
  only difference between the two runs is the saturation flag, so the case proves
  the declared precedence `saturation > candidate count` rather than a
  coincidence of fixtures.
- No head is chosen where the run refuses before acceptance, so cells (i), (ii)
  and (iv) perform **zero local record reads**; cell (iii) performs exactly two
  (one per candidate, never more).
- Read budget: cells (i)–(iv) spend **one** provider read (the open page — each
  refuses from the page, before the convergence decision); the desaturated control
  spends **two** (the open page plus the closed convergence read, which returns
  `0` and is what lets it report `no-open-request`). The pair therefore also
  demonstrates where the second read is spent.
- Zero verification records and zero landing calls in every cell; the output
  contains no `merge.transaction-aborted`.

#### TC-MRG-007 - A candidate head that is not a full SHA refuses `head-unresolved` and is never read

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Plan Phase(s)**: 3
**Related IDs**: F-1, AC-F1-4, API-3, DM-2, NFR-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-production-composition.test.ts` (new cell family)
**Tags**: @backend, @api, @merge

**Preconditions**:

- Three cells, each with exactly one convention-matching open entry whose asserted
  head is (i) absent, (ii) empty, (iii) not a full hex SHA (`a1b2c3d` and a
  `refs/heads/...`-shaped value).

**Steps**:

1. Run `merge <ref> --json` for each cell.
2. Read `error.code`, the closed reason, the named request identity and the
   unusable head value.
3. Read the child-runner invocation log and the check-run request log.

**Expected Outcome**:

- Exit 1 with `error.code === "merge.request-unresolved"` and the reason exactly
  `head-unresolved`.
- The summary names the candidate's source ref, the matched request's identity and
  the unusable head; `command=merge` and `ref=<ref>` are present.
- **The candidate is never read**: the child-runner log contains no `ls-tree` or
  blob invocation for it, and the check-run log contains no `/check-runs` request
  for `""` or a placeholder SHA.
- Zero local record reads, zero landing calls.

#### TC-MRG-008 - A record for the base tip refuses `merge.gates-stale` with both SHAs

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Plan Phase(s)**: 3
**Related IDs**: F-1, F-2, AC-F1-5, API-1, NFR-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-production-composition.test.ts` (update; `tests/behaviour/merge-freshness.test.ts` TC-MERGE-010 keeps the row-level head-mismatch oracle unchanged)
**Tags**: @backend, @api, @merge

**Preconditions**:

- The base-checkout fixture: worktree carries no change folder, `HEAD` at the base
  tip; the record at the request head declares the change branch; the resolved
  head is a distinct SHA.
- A fresh, otherwise valid verification record was appended whose `headSha` is the
  base tip (the `seedVerification` shape the suite already uses).

**Steps**:

1. Run `merge <ref> --json`.
2. Read `error.code` and the evidence members.
3. Read the transaction ledger and the landing count.

**Expected Outcome**:

- Exit 1 with `error.code === "merge.gates-stale"`.
- The evidence carries both SHAs: the recorded head equals the base tip and the
  current/resolved head equals the request head, field by field; the rendering
  carries `command=merge` and `ref=<ref>`.
- The freshness comparison is against the resolved head, not the checkout: the
  same record with the request head as its `headSha` would pass (paired control,
  asserting exit 0 and one landing).
- Zero landing calls and zero transaction records for the stale cell.

#### TC-MRG-009 - The `branch` declaration is lint-opaque and value-faithfully preserved

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: Medium
**Plan Phase(s)**: 3
**Related IDs**: DM-1, F-1, AC-F1-2
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/phase-completion-convergence.test.ts` (the preservation oracle) over `tests/behaviour/phase-support.ts` (the phase harness) and `tests/fixtures/phase/history.ts` (the pm-notes document text builder, which gains the key), with `tests/behaviour/pm-notes-lint.test.ts` (extend `TC-LINT-006` "opaque extra keys") and `tests/behaviour/phase-write-path-lint.test.ts` carrying the lint half
**Tags**: @backend, @config

**Preconditions**:

- A pm-notes fixture carrying `branch: <feature branch>` as an extra top-level
  key alongside the canonical keys; a second fixture carrying a control-character
  value to prove lint never inspects it.
- `tests/fixtures/phase/history.ts` builds the document text with the key present,
  so every document-writing branch of `phase complete` receives the same input
  rather than one privileged path receiving a hand-built copy.
- The phase harness (`phase-support.ts`) can enumerate every document-writing
  branch, so the case iterates the branches instead of picking one.

**Steps**:

1. **Lint half (first):** lint both fixtures and read the verdict; run
   `phase-write-path-lint.test.ts` and assert it still blocks malformed writes
   (this half does not prove preservation).
2. **Preservation half:** for **each** document-writing branch of a real
   `phase complete`, drive one real completion over the harness and read the
   committed document afterwards.
3. Compare the `branch` value after the write with the value before it, branch by
   branch, as a decoded scalar (not as a substring of the file).
4. Assert the phase entry's own `started`/`completed` mutation is the only change
   in the document, and that every document-writing branch appears in the
   enumerated population (a branch added without being visited fails by name).

**Expected Outcome**:

- Lint returns `{ ok: true }` with the delivered variant for both fixtures: the
  key is opaque and never validated — a control-character value passes lint and is
  refused only at resolution (`declaration-unusable`).
- **On every document-writing branch**, the document committed by the real
  `phase complete` carries the same `branch` value it carried before the write; a
  branch that drops, reorders into a different scalar, or re-encodes the key fails
  **by branch name**, so the spec DM-1 / RSK-1 mitigation cannot pass while one
  path silently loses the declaration.
- The read-at-head path then returns that same value from the produced commit, so
  a declaration written by the phase surface is readable by the resolution the
  change introduces.
- No new lint rule id, key set or failure code appears: the lint registry is an
  exact-set equality with the delivered one.

#### TC-MRG-010 - One failing required check refuses with the check, gate and reason named

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Plan Phase(s)**: 4
**Related IDs**: F-2, AC-F2-1, EVT-1, NFR-5, API-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-production-composition.test.ts` (update `TC-ENGINE-051` to the default set; the per-state matrix stays in `tests/behaviour/merge-required-job-probe.test.ts`)
**Tags**: @backend, @api, @merge

**Preconditions**:

- **No authored `merge.gates` declaration**: the shipped default set is in force,
  so the merge projection is the effective merge-applicable membership **at this
  phase** — one entry, the CI gate. `tracker-freshness` joins the merge surface in
  phase 6, and this case derives the ids from the exported set rather than pinning
  a length, so it stays true when that second entry arrives.
- A fresh verification record for the resolved head; a repository CI workflow
  whose expected job set is `CI / test`; the check-run page for the resolved head
  reports that one job `completed`/`failure`.
- Two attribution cells beside the baseline: one whose verification record
  **persists a non-pass** `ci-green` (the `recorded` cell), and one whose record
  **persists a pass** while the fresh page is red (the persisted-pass-contradicted
  cell).

**Steps**:

1. Run `merge <ref> --json` and then text mode.
2. Read `error.code`, the gate id in the code, the job name, the reason and the
   attribution field in the evidence/summary.
3. Read `data.gates` if a report is produced, plus the landing count and the
   transaction ledger.
4. Run the two attribution cells and read each attribution.
5. Run the same fixture with the job `success` (the contrast cell).

**Expected Outcome**:

- Exit 1 with `error.code === "merge.gate.<gate-id>.failed"` where the gate id is
  the effective CI gate and the code is **not** the tracker gate id.
- The summary names the offending job (`CI / test`), the gate id and the delivered
  reason `ci-failed`; `command=merge` and `ref=<ref>` are present.
- The attribution is one of the closed pair and matches the source that decided:
  `probe` for the baseline fresh-red cell, `recorded` for the persisted-non-pass
  cell, and `probe` for the persisted-pass-but-fresh-red cell (the page wins on
  state, the gate set wins on membership).
- Zero landing calls; zero transaction records; no `fallback.internal` anywhere.
- The contrast cell exits 0 with `result=merged` and exactly **one** landing call,
  and its report's `gates` ids equal the **effective merge-applicable entry ids the
  run actually evaluated** (at this phase: the CI gate id alone; after phase 6: the
  CI gate id and `tracker-freshness`), derived from the exported gate set, never a
  literal length — so a green and a failing request never share a verdict. This
  cell makes **no** two-entry or cross-phase projection claim: the `gates=2/2`
  end state and the dry-run/merged equality are `TC-MRG-044`'s assertion in
  phase 6 (readiness iteration 3, finding 2).

**Notes / Clarifications**:

- Owner regression (b). The gate id is read from the effective set rather than
  hard-coded, because `ci-green` is the built-in id and an authored set may carry
  a `ci-required` entry; asserting one literal would let a rename slip by.

#### TC-MRG-011 - All-green dry run verifies and the merge lands once, distinct from red

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Plan Phase(s)**: 4
**Related IDs**: F-2, F-5, AC-F2-3, API-2, EVT-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-dry-run.test.ts` (update: the dry run's projection is the effective merge-applicable membership at the run) with the landing count in `tests/behaviour/merge-landing.test.ts`
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

- Dry run exits 0 with `result=verified` and a `gates` array whose ids equal the
  **effective merge-applicable set this run evaluated** — at this phase the CI
  entry alone; `tracker-freshness` joins the merge surface in phase 6 — every entry
  `pass`. The ids are derived from the exported set, never a literal length.
- Exactly one verification record appended by the dry run; zero transactions;
  zero waivers; zero landing calls.
- The real merge exits 0 with `result=merged` and exactly one landing at the
  resolved head and exactly one transaction record. This case does not assert the
  merged report's gate list: at this phase it renders the verification record's
  list, and the evaluated projection plus the dry-run/merged equality is
  `TC-MRG-044`'s assertion in phase 6 (readiness iteration 3, finding 2).
- The green verdict and the failing verdict differ in exit code, `result` and
  the gate entry: `toEqual` on the two reports fails.

#### TC-MRG-012 - A queued or running required check refuses with the pending reason

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Plan Phase(s)**: 4
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
  exactly `ci-pending` and the job name present in the names/evidence; the
  rendering carries `command=merge` and `ref=<ref>`.
- Both cells carry the family row's single `retryable` value (`false`), even
  though the pending cause converges without an act (AC-F3-6: the family's single
  value stays honest for every gate cause, and the act-free convergence is carried
  by the reason and remediation — TC-MRG-027).
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
**Plan Phase(s)**: 4
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
  `head-unresolved` reason, naming both SHAs (`pageSha` and `headSha`), at exit 1,
  with `command=merge` and `ref=<ref>` present.
- The green content of the other-head page is not used as a pass; no `verified`
  or `merged` result exists.
- The labelled control with identical bytes passes, proving the discriminator is
  the page SHA.
- Zero landing calls on the other-SHA cell.

#### TC-MRG-014 - A CI read fault names the failed operation and never passes

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Plan Phase(s)**: 4
**Related IDs**: F-2, F-3, AC-F2-5, NFR-5, API-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-production-composition.test.ts` (extend `TC-ENGINE-053`)
**Tags**: @backend, @api, @merge

**Preconditions**:

- The composition harness with four transport cells for provider reads: HTTP 500,
  HTTP 401/403 and a malformed payload on the check-runs read, and a fault on the
  **open-request list** read; every other read healthy.
- The open list succeeds in the check-run cells, so the refusal is reached on the
  check-run path; in the list-fault cell the fault is the first provider read, so
  the run stops there.

**Steps**:

1. Run `merge <ref> --json` for each cell.
2. Parse the rendering's `command`, `ref` and `operation` fields from their own
   field grammar and read the code and exit code.
3. Read the state ledger and the landing count.

**Expected Outcome**:

- Each cell exits with the declared row's projection: `provider.outage` at exit 2
  for the 500/malformed cells and `provider.auth.rejected` at exit 1 for the
  401 cell (both resolved from `ERROR_TABLE`, never transcribed).
- The failed operation is carried in the **dedicated `operation` field** the spec
  declares (`operation=<token>`, spec F-3 / API-3 / AC-F2-5), populated from the
  **closed vocabulary** and validated at the rendering site. The token names the
  **attempted** operation: `github-check-runs` for the three check-run cells and
  `github-delivery-request-list` for the open-list fault, never `-` and never the
  operation of a later read the run never attempted. The assertion is on the
  parsed field, never on an operation name occurring somewhere in the summary;
  `command=merge` and `ref=<ref>` are present on every cell.
- No cell treats the fault as a passed gate (no `verified`, no `merged`).
- Zero landing calls and zero appended records in every cell.
- No cell renders `fallback.internal` or `merge.transaction-aborted`.
- A planted rendering whose `operation` is `-`, or names a different read, fails
  this case by name: "a read fault names the attempted operation" is asserted in
  both directions.

#### TC-MRG-015 - A declared required job is enforced; an undeclared job is not evidence

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Plan Phase(s)**: 4
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
**Plan Phase(s)**: 4
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
**Plan Phase(s)**: 4
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
**Plan Phase(s)**: 4
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
**Plan Phase(s)**: 4
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
  the observed candidate count (`1`), and the CI gate present with its per-job
  evaluation.
- Fixture (ii) reports an evaluated required-check count of 0 **explicitly**
  (the field is present and zero), and the merge projection contains only
  `tracker-freshness`: the authored posture is visible, not silent.
- Both dry runs exit 0 or 1 according to the gates, land nothing, and append one
  verification record; both report `resolutionSource=declared-at-head`.

#### TC-MRG-020 - An absent token names reference, environment variable and operation

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Plan Phase(s)**: 2
**Related IDs**: F-3, AC-F3-2, API-3, NFR-9
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-production-composition.test.ts` (update `TC-ENGINE-052`)
**Tags**: @backend, @api, @security

**Preconditions**:

- The base-checkout composition harness with no `GITHUB_TOKEN` in the injected
  environment and the credential port in its declared `missing` mode.
- The change record is readable at the request head, so the refusal is reached on
  the provider read path, not on state.

**Steps**:

1. Run `merge <ref> --json` and text mode, and again with `--dry-run`.
2. Read `error.code`, `error.summary` and the exit code.
3. Read the `command`, `ref` and `operation` fields, the transport log, the
   credential read counter, the state ledger and the landing count.

**Expected Outcome**:

- Exit 1 with `error.code === "config.credential.missing"`.
- The rendering carries `command=merge`, `ref=<ref>` equal to the invocation's ref
  (the field has no empty-value branch: spec v2.1 keeps the `ref=-` fallback out,
  §1.2 GAP-TP-4), and the **dedicated `operation` field** declared in spec F-3 /
  API-3, carrying the operation that required the credential as a member of the
  closed vocabulary — `github-delivery-request-list` for the list read,
  `github-check-runs` for the check-run path — with the token validated at the
  rendering site. The field is **not** `-`: this refusal names a read, so the
  empty-value form is wrong here and the case asserts both directions. The
  evidence members name the credential reference
  `github-read` and the environment variable `GITHUB_TOKEN`.
- The credential **value** never appears (assert against the canary/harness
  material).
- The credential condition is raised by the one bounded open-request list read the
  resolution performs anyway (spec Flow 5): no **additional** provider request is
  attempted, and no request is retried. Zero records appended, zero landing calls.
- No invocation cell renders `merge.transaction-aborted` or `fallback.internal`.

**Notes / Clarifications**:

- Owner regression (c). The assertion is the three literal tokens plus the exit
  code; "the refusal mentions a credential" would not carry the owner's item.

#### TC-MRG-021 - A credential condition is never `merge.transaction-aborted`

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Plan Phase(s)**: 2
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
  exit, and each rendering carries `command=merge`, `ref=<ref>` and the dedicated
  `operation` field with a closed-vocabulary token.
- The string `merge.transaction-aborted` appears in **no** output, evidence member
  or record of any credential cell.
- Both codes are members of `MERGE_COMPOSITION_EMITTABLE_CODES`; the row each
  resolves to has `domainKind` `config` / `provider` respectively.
- Zero landing calls.

#### TC-MRG-022 - An unresolvable work item refuses with its own identity and cause

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Plan Phase(s)**: 2
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
- The summary names the invocation's work-item ref (`<PREFIX>-<n>`), the read
  operation in the dedicated `operation` field (`operation=github-work-item`, a
  member of the closed vocabulary declared in spec F-3 / API-3), `command=merge`
  and `ref=<ref>`. The field is **not** `-`: the refusal names the read it
  attempted, so a rendering that leaves it empty fails by name.
- The remediation names that cause (repair the ref or the tracker), not "clear
  the named pre-condition" without a name.
- The code is in the declared emittable set; the output contains no
  `merge.transaction-aborted`.
- Zero landing calls; the verification record count is unchanged (no second
  append).

#### TC-MRG-023 - Every matrix refusal renders command/ref/operation fields, code and a named cause

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Plan Phase(s)**: 4
**Related IDs**: F-3, AC-F3-1, API-3, NFR-5
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-refusal-surface.test.ts` (extend `TC-MERGE-012`) with the taxonomy cells in `tests/behaviour/merge-refusal-taxonomy.test.ts`
**Tags**: @backend, @api, @merge

**Preconditions**:

- One table-driven case with **22 enumerated cells**, one per concrete refusal
  the merge command emits, each cell a fixture over the harness that reaches that
  refusal. Cell 1 (`merge.branch-unresolved`) is carried as its six closed reasons
  (TC-MRG-042 holds the per-reason detail); cell 17
  (`merge.transaction-aborted`) as its **two** remaining pre-mutation causes; cell
  20 as the landing-fault expansion's three identities (TC-MRG-047 holds the
  row-level detail).
- The matrix is **this plan's own closed enumeration**, not an arithmetic
  derivation from spec Appendix B (whose v2.2 table carries a separate
  landing-fault row and therefore a different row count). The 22 cells are:
  1 branch cell (six closed reasons as sub-runs) + 3 request cells (the **four**
  closed request reasons, the two ambiguity reasons as sub-runs of cell 3) +
  1 work-item cell + 6 gate-condition cells + 2 evidence cells
  (`merge.gates-stale`, `merge.state-unverified`) + 3 credential/provider cells +
  1 abort cell (two sub-runs) + 1 landing-fault cell (four identities) +
  4 delivered-unchanged cells = **22**. Sub-runs add no cell:
  1 + 3 + 1 + 6 + 2 + 3 + 1 + 1 + 4 = 22. The request row's fourth reason,
  `ambiguous-merged-request`, is therefore in the matrix without changing the cell
  count.
- The act-required column is **derived from the shipped mapping for the cell**,
  never asserted: the cell's cause is mapped to its emitted identity by the
  composition's shipped cause→identity mapping, and that identity's declared
  convergence semantics (`retryable`, `consequence`, and whether the remediation
  claims a plain re-run converges) supply the value. Where the value is decisive
  the case also confirms it behaviourally (a plain re-run of the same fixture), so
  the oracle can disagree with the row it judges (readiness iteration 2, findings 2
  and 14).

**Steps**:

1. For each enumerated cell, drive the fixture and capture the envelope and the
   human rendering.
2. Parse the rendering's `command`, `ref` and `operation` fields from their own
   field grammar (`command=merge`, `ref=<value>`, `operation=<token>`) and assert
   the parsed values — never a substring search for `merge`, for the ref, or for an
   operation name anywhere in the summary. Assert the `operation` token is a member
   of the closed vocabulary (spec F-3, API-3) **or** `-`; assert that a cell whose
   named cause is a read carries that read's token rather than `-`, and that `-`
   appears only where the refusal names no operation (the gate cells, the stale and
   unverified evidence cells, and a condition about a declaration's value).
3. Assert, per cell, the row-projected exit, the exact code, the named-cause
   token(s) and the remediation shape.
4. **Derive** the act-required value per cell: resolve the cell's cause to its
   shipped identity, read that identity's declared convergence semantics, then
   re-drive the same fixture with only a transient condition cleared
   (pending → green, transport outage → recovered) and record whether the run exits
   without the refusal. Compare the derived value to the table's and record it for
   TC-MRG-026/047. A cell whose emitted row claims no convergence must refuse
   again with unaltered persisted state.

**Expected Outcome**:

All 22 cells exit with the exit projected from their declared row and carry
exactly the expected code:

| Cell | Code | Named cause asserted | Act required before a re-run converges (derived from the shipped mapping for the cell) |
|------|------|----------------------|------------------------------------------------------------------------------------------|
| 1 | `merge.branch-unresolved` (six closed reasons, one per run) | candidate source ref + tree path at that head + `branch` key | yes for every reason — the shipped mapping routes each to the declaration-refusal row, whose remediation names the act |
| 2 | `merge.request-unresolved` (`no-open-request`) | convention + ref + open count + candidate count `0` | yes — open a conforming request |
| 3 | `merge.request-unresolved` (`ambiguous-open-request` \| `ambiguous-merged-request`, one sub-run each) | open side: convention + ref + open/candidate counts, or page saturation; merged side: convention + ref + the observed merged count (`2+`) and the two matched source refs, with neither presented as *the* request | yes — resolve the duplicate or narrow the open/merged set; never a ranking |
| 4 | `merge.request-unresolved` (`head-unresolved`) | candidate source ref + request identity + unusable head | yes — push a full-SHA head |
| 5 | `merge.work-item-unresolved` | work-item ref + `operation=github-work-item` | yes — repair the ref or the tracker |
| 6 | `merge.gate.<id>.failed` (failing) | gate id + job + `ci-failed` + attribution | yes — repair CI or declare the surface opt-out |
| 7 | `merge.gate.<id>.failed` (canceled) | gate id + job + `ci-canceled` | yes — rerun the job |
| 8 | `merge.gate.<id>.failed` (skipped) | gate id + job + `ci-all-skipped` | yes — run the required job |
| 9 | `merge.gate.<id>.failed` (pending) | gate id + job + `ci-pending` | **no — the check converges**: a plain re-run after the check turns green exits without the refusal |
| 10 | `merge.gate.<id>.failed` (missing) | gate id + missing job name | yes — run or declare the job |
| 11 | `merge.gate.<id>.failed` (page not head) | gate id + both SHAs | no — the observed page cannot become head evidence; no operator repair is claimed |
| 12 | `merge.gates-stale` | both SHAs (base-tip cell) | yes — re-verify the resolved head |
| 13 | `merge.state-unverified` | the state reason; `operation=-` — a non-provider state read names no operation | yes — produce a verification |
| 14 | `config.credential.missing` | `github-read` + `GITHUB_TOKEN` + `operation=<token>` | yes — supply the credential |
| 15 | `provider.auth.rejected` | reference + `operation=<token>` | yes — supply a usable credential |
| 16 | `provider.outage` | `operation=<token>` | no — a plain re-run converges (observed) |
| 17 | `merge.transaction-aborted` — two pre-mutation causes: (a) waiver-append failure, (b) declared landing gap | the aborted pre-mutation condition | **yes for both**: the shipped mapping routes each to the row that claims no convergence, and a re-run with unaltered persisted state refuses again |
| 18 | `merge.sync-required` | delivered causes (unchanged) | derived from the shipped row |
| 19 | `merge.mergeability-unknown` | delivered causes (unchanged) | derived from the shipped row |
| 20 | Landing fault — shipped mapping: transient/transport → `provider.outage`, rejected credential → `provider.auth.rejected`, fired but unobserved → `merge.landing-unverified`, missing credential → `config.credential.missing`; the failing operation in the `operation` field | the failed landing operation and the credential reference / unobserved landing; the envelope carries a **declared identity**, explicitly not the arbitrary port code `protection-rule` | **no** for `provider.outage` (a plain re-run converges); **yes** for `provider.auth.rejected` and `config.credential.missing` (supply a usable credential); `merge.landing-unverified` as its delivered row declares — derived, never asserted |
| 21 | `merge.owner-gate-override-without-waiver` | delivered causes (unchanged) | derived from the shipped row |
| 22 | `merge.waiver-unauthorized` | gate + class + authorizer | derived from the shipped row |

- **The `operation` edges are asserted per cell.** `-` is the value only where the
  refusal names no operation: the gate-condition cells, `merge.gates-stale`, and
  `merge.state-unverified` (a non-provider state read), and a condition about a
  declaration's value. A transport/read fault names the **attempted** operation
  (`github-check-runs`, `github-delivery-request-list`, `github-work-item`); a
  local change-record read names its own source — `local-git-object-read` when the
  object read fails, `local-change-record-read` when the parse fails; the
  `ambiguous-merged-request` sub-run names the closed-list operation; a landing
  fault names the failing landing operation and is never `-`. A token outside the
  vocabulary is a rendering-site failure, not a pass-through: the renderer refuses
  to emit it, so no envelope can carry one (TC-MRG-024's control).
- **A landing fault never leaks a raw port code.** Cell 20's envelopes carry a
  declared identity, and the arbitrary `land` port code `protection-rule` — the
  delivered convergence fixture's sentinel — appears in no envelope, evidence
  member, record or summary of any cell. The case asserts the absence literally
  and asserts that every emitted code resolves to a declared row or the declared
  family (NFR-7).
- Every cell's parsed `command` field equals `merge` and its parsed `ref` field
  equals the invocation ref. The assertion is made against the field: a rendering
  that carries the code (whose `merge.` prefix contains the token) but omits the
  field fails by name (TC-MRG-024's control).
- Every cell's parsed `operation` field is a member of the closed vocabulary or
  `-`; a token outside the vocabulary fails by name (TC-MRG-024's control), and a
  cell that names a read carries that read's token rather than `-`.
- **A refused landing is not cell 17.** Cell 17's two causes are both
  pre-mutation and both act-requiring; a landing that the provider refuses or that
  faults is driven through cell 20 and reports `provider.outage` /
  `provider.auth.rejected` / `merge.landing-unverified`. A run that produces
  `merge.transaction-aborted` for a landing fault fails this case by name.
- Every cell's remediation either names an object the refusal named, or is
  absent; the literal phrase "named condition" appears in no cell's remediation
  without an accompanying name.
- No cell's output contains `fallback.internal`.

**Notes / Clarifications**:

- Cells 18–22 are the delivered rows whose contract is unchanged apart from the
  rendering: tying them to their delivered behaviour is the regression half of the
  matrix, not a claim that they were repaired.
- The 22-cell count is this plan's closed enumeration stated above and is **not**
  changed by the sub-run expansions (cell 1's six reasons, cell 3's two ambiguity
  reasons, cell 17's two causes, cell 20's four landing-fault identities), so the
  matrix remains an enumerated oracle rather than a generator (GAP-TP-2).
  Readiness finding 8 is answered by declaring the enumeration here instead of
  citing a spec row count that the spec does not state.

#### TC-MRG-024 - Control: an unnamed cause or unnamed-remediation hint is flagged

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Plan Phase(s)**: 4
**Related IDs**: F-3, AC-F3-1, NFR-5
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-refusal-surface.test.ts` (control paired with TC-MRG-023)
**Tags**: @backend, @api, @merge

**Preconditions**:

- The TC-MRG-023 matrix predicate extracted as a function over
  `(code, commandField, refField, operationField, summary, remediation, evidence)`,
  with the closed `operation` vocabulary supplied as a fixture constant read from
  the contract: the **six provider source names** (the filter of
  `VERIFY_GATES_SOURCE_NAMES` to the provider members), the two local tokens
  (`local-change-record-read`, `local-git-object-read`) and `-`. The plan does not
  transcribe the list, so dropping or retaining a provider member in spec F-3 is a
  contract change the case follows rather than a test edit.

**Steps**:

1. Feed the predicate a refusal summary with the code and a named object but **no
   `command` field** (the code's `merge.` prefix is present, so a substring
   implementation would pass).
2. Feed it a summary with **no `ref` field**, then one whose field is absent but
   whose prose happens to contain the ref string.
3. Feed it a summary with **no `operation` field**, then one whose operation token
   is outside the closed vocabulary (`github-checkrunz`, `local-record-read`, and
   a plausible truncation such as `github-delivery-request`), then one that
   renders `operation=-` on a cell that names a read. For the out-of-vocabulary
   variants, also drive the **renderer** (not just the predicate) and assert it
   fails closed: no envelope is produced, so the token cannot reach output.
4. Feed it a refusal with the fields and the code but no named object.
5. Feed it a remediation of the delivered pre-change shape ("Clear the named
   pre-mutation condition and retry; a re-run converges.") with no named
   condition.
6. Feed it a compliant cell, and a compliant gate cell whose `operation` is `-`,
   and compare.

**Expected Outcome**:

- Case 1 is flagged as "no dedicated `command` field" and the finding names the
  missing field — the code prefix does not satisfy it.
- Case 2 is flagged as "no dedicated `ref` field"; the incidental-prose variant is
  flagged too, so the assertion cannot be satisfied by coincidence.
- Case 3's variants are flagged as "no dedicated `operation` field", "token
  outside the closed vocabulary" (naming the offending token) and "`-` on a cell
  that names a read"; the vocabulary is validated at the rendering site, so an
  unknown token is a declared failure and not free prose. For each
  out-of-vocabulary variant the renderer **rejects rather than passes through**:
  the case asserts no envelope, no stdout summary and no record carries the token,
  and a pass-through implementation fails by name.
- Case 4 is flagged as "no named cause"; case 5 as "remediation instructs clearing
  an unnamed condition".
- Case 6 passes for both the naming cell and the `-` cell: `-` is legitimate where
  the refusal names no operation, so the control distinguishes an absent field from
  a declared absence.
- The control fails **by name**: removing any one of the six dimensions from a
  compliant cell makes the predicate report it, so TC-MRG-023 cannot pass
  vacuously.

#### TC-MRG-025 - `retryable` is always the emitted row's declared value

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Plan Phase(s)**: 4
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
**Plan Phase(s)**: 2
**Related IDs**: F-3, AC-F3-6, API-3, NFR-5
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/merge-refusal-rows.test.ts` (extend the row-declaration case with the derived act-required oracle)
**Tags**: @backend, @api, @merge

**Preconditions**:

- The merge refusal surface's declared rows and families, read from the machine
  table.
- The reachable cause set per row, **derived from the shipped cause→identity
  mapping** — the same mapping the composition uses to turn a failure cause into
  an emitted code (TC-MRG-023 step 4) — together with each cause's act-required
  value derived from that identity's declared convergence semantics
  (`retryable`, `consequence`, and whether the remediation claims a plain re-run
  converges). Included: cell 17's **two** remaining pre-mutation causes (a
  waiver-append failure and a declared landing gap), which must both derive
  act-required and refuse again with unaltered persisted state; cell 9's pending
  cause, which must derive act-free and exit without the refusal once the check
  turns green; and cell 20's landing-fault identities, where `provider.outage` must
  derive act-free (a plain re-run converges) and `provider.auth.rejected` must
  derive act-requiring.
- The derivation is independent of the row it judges: the act-required value is a
  function of the shipped mapping and the observed re-run, not a literal
  transcribed beside the matrix and not a projection of the row's own `retryable`.

**Steps**:

1. For each merge row and family, compute the reachable causes and whether any
   cause is act-requiring, from the derivation only.
2. Assert `retryable === false` whenever an act-requiring cause is reachable.
3. Assert `merge.transaction-aborted` declares `retryable: false`, that the
   shipped mapping routes exactly two causes to it — a waiver-append failure and a
   declared landing gap — and that both derive act-requiring; assert a refused
   landing is **not** among them and maps to `provider.outage`,
   `provider.auth.rejected` or `merge.landing-unverified`.
4. Assert the family row's single `false` is consistent with cell 9's act-free
   pending cause (the value is not required to be `true` for an act-free cause).
5. Assert no act-required value is supplied to the predicate as a literal: the
   predicate receives the derivation function, and a substituted derivation for one
   cause changes the verdict by name.
6. Run the mutation control.

**Expected Outcome**:

- Every row that reaches an act-requiring cause declares `retryable: false`; no
  row declares `true` over such a cause. No row is exempted by the shape of its
  own declaration, and no cell's value is asserted by fiat.
- `merge.transaction-aborted` declares `retryable: false` (spec v2.1 pins the
  narrowed shape; the earlier either-or is closed — OQ-TP-5) and its remediation
  names the aborted pre-mutation condition with no convergence promise; the derived
  cause set is exactly {waiver-append failure, declared landing gap}.
- The family row's `false` is reported as *honest* rather than tolerated, because
  the only act-free cause (pending) is carried by the reason and remediation, not
  by a different value (AC-F3-6).
- **Mutation control**: with the delivered pre-change row substituted
  (`merge.transaction-aborted` with `retryable: true`, the convergence hint, and
  the credential/unresolvable/refused-landing causes still routed to it), the
  predicate reports exactly that row by name and fails; the production row passes.
  A second mutation sets only the value back to `true` and no other field: the
  predicate still fails, so the oracle is the derived act-required value and not
  the row text.
- **Mapping control**: substituting a mapping in which a refused landing routes to
  `merge.transaction-aborted` fails by name (the abort row's derived cause set would
  then contain an act-free cause under a `false` + no-convergence claim), which is
  the defect readiness iteration 2 finding 2 described and this case must catch.
- No family slot is widened to satisfy the rule (asserted in TC-MRG-029).

#### TC-MRG-027 - A pending cause converges without an act and its remediation says so

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Plan Phase(s)**: 2
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

#### TC-MRG-028 - A gate refusal resolves to the runtime-declared family, gate id preserved

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Plan Phase(s)**: 5
**Related IDs**: F-4, AC-F4-1, NFR-7, API-3
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/defect-f1-merge-refusal-containment.test.ts` (extend: the proof reads the exported runtime declaration instead of matching source text) + `tests/structure/merge-classification-conformance.test.ts`
**Tags**: @backend, @api

**Preconditions**:

- The composition's exported **runtime** declaration — the exact-member list plus
  the family declaration (contract prefix, suffix, template and the slot rule) —
  imported as a value.
- The effective gate ids derived from the shipped default set plus a declared
  `required-ci-job` entry, so the family-instance population is the widened one;
  `ci-green` is merge-applicable, so `merge.gate.ci-green.failed` is the live
  proof instance.

**Steps**:

1. Derive every code the transaction's refusal branches can emit, plus one family
   instance per effective gate id.
2. Assert the runtime declaration covers all of them and expresses the family as a
   declaration object (prefix, suffix, template, slot rule) — not as a name
   matched in source text.
3. Read the proof's own input: it must be the imported value; assert the proof
   contains no source-text read of the composition for the family (a source scan
   of the proof, with a planted matcher control).
4. Resolve and classify one live gate refusal end to end.
5. Assert the gate id is preserved in the code and in the summary, with
   `command=merge` and `ref=<ref>`.

**Expected Outcome**:

- The uncovered set is empty; the family-instance count equals the effective
  gate-id count.
- `merge.gate.<id>.failed` resolves to the declared family entry with
  `domainKind` `merge` and exit 1; `classifyThrown({ kind: "merge", code })`
  returns the same code; a behaviour-preserving refactor of the composition
  (renaming the module's internals, moving the declaration) leaves the proof
  green because it ranges over the value.
- The proof performs no source-text read of the family: `readFileSync`-based
  matching of `MergeCompositionEmittableFamily`, the prefix or the suffix is
  absent from the proof, and the planted matcher control is found by the scan.
- The live refusal's code is exactly `merge.gate.<effective-id>.failed`, its
  summary names that gate id, and `fallback.internal` appears in neither the
  outcome nor the summary.
- The reference page, feature spec and test specification describe the same
  family (asserted in TC-MRG-038's doc surfaces).

#### TC-MRG-029 - A live mismatch control still reaches containment; no slot widening

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Plan Phase(s)**: 5
**Related IDs**: F-4, AC-F4-1, NFR-7
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/defect-f1-merge-refusal-containment.test.ts` (control) + `tests/structure/merge-classification-conformance.test.ts` (slot rule)
**Tags**: @backend

**Preconditions**:

- The runtime family declaration's prefix/suffix/template and its slot rule; the
  effective gate-set id set.

**Steps**:

1. Classify a family code under a mismatched kind (`provider`).
2. Classify a family code whose slot is not in the effective gate set.
3. Read the declaration's template, prefix, suffix and slot rule as values.
4. Read the effective gate-set id sequence.

**Expected Outcome**:

- Case 1 returns `fallback.internal` (the containment identity), and the same
  code on its own kind resolves — the branch is live, not dead.
- Case 2 does **not** resolve to a declared pass: an unvalidated slot is refused
  at emission, so pattern widening cannot be used to gain coverage.
- The declaration is exactly the family `merge.gate.<gate-id>.failed` with the
  contract's `slotPrefix: "merge.gate."` and `slotSuffix: ".failed"`; no wildcard,
  alternation or optional slot exists in the value.
- The effective gate-set id sequence equals the delivered sequence (no new gate id
  was added to close the gap).

#### TC-MRG-030 - Dry run and real merge report the same branch, request and head

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Plan Phase(s)**: 3
**Related IDs**: F-5, AC-F5-1, API-1, API-2, DM-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-production-composition.test.ts` (new case)
**Tags**: @backend, @api, @merge

**Preconditions**:

- One fixture (base checkout: no change folder in the worktree, `HEAD` at the base
  tip), one invocation context, one resolved branch/request/head; the open-request
  page order is varied between runs to prove the match is by convention plus exact
  equality and not by position.
- **Phase-local projection truth.** At the end of this phase the merge-applicable
  set is `ci-green` alone, so the dry run renders `gates=1/1`; the merged report
  still renders the verification record's battery list, because the merged report's
  gate list changes in phase 6. This case therefore asserts **each run's own**
  projection and makes no cross-run, cross-phase projection claim; the two-entry
  `gates=2/2` projection and the dry-run/merged equality are `TC-MRG-044`'s
  assertion in phase 6 (readiness iteration 3, finding 2).

**Steps**:

1. Run `merge <ref> --dry-run --json` and capture the resolved facts and **that
   run's own** `data.gates`.
2. Run `merge <ref> --json` in a fresh state on the same fixture and capture the
   same facts and that run's own report gates.
3. Compare the resolved branch, resolution source, request identity, candidate
   count and resolved head across the two runs (`toEqual` on the projected object);
   then assert each run's gate list against the object it renders from, not against
   the other run.

**Expected Outcome**:

- The **five resolved facts** are equal across the two runs, field by field
  (`toEqual` on the projected object): `resolvedBranch`, `resolutionSource`,
  `requestIdentity`, `candidateCount` and `headSha`. Both report
  `candidateCount` equal to the observed candidate count (`1` in this fixture).
- Both name the same request identity, not merely the same branch.
- The dry run's `data.gates` ids equal the **effective merge-applicable set this
  run evaluated** (at this phase: the CI gate alone, `gates=1/1`); the real
  merge's report `gates` equals the verification record's `gates` list, which is
  the pre-phase-6 rendering. The two lists are **not** asserted equal here.
- The real merge's landing expected head equals the dry run's reported head.
- Neither report contains the checkout's base branch or base-tip SHA as any
  resolved fact.

**Notes / Clarifications**:

- The phase boundary stays gate-green: every assertion above is created by this
  phase. The end-state projection equality is asserted once, in the phase that
  creates it (`TC-MRG-044`), so this case does not depend on a later phase's
  rendering.

#### TC-MRG-031 - A base-checkout dry run records the resolved head with zero mutation

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Plan Phase(s)**: 3
**Related IDs**: F-5, AC-F5-2, API-2, EVT-1, DM-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-production-composition.test.ts` (update `TC-ENGINE-050`) + `tests/behaviour/merge-verification-record.test.ts`
**Tags**: @backend, @api, @merge

**Preconditions**:

- The TC-MRG-001 fixture: the worktree carries **no change folder** and `HEAD` is
  the integration-base tip; the record at the request head declares the change
  branch; a healthy request/check/work-item set.

**Steps**:

1. Run `merge <ref> --dry-run --json` and read the appended verification record.
2. Read the waiver, transaction and git-operation state.
3. Render text mode and scan it; read the local read log.

**Expected Outcome**:

- Exactly one verification record appended, whose `headSha` equals the resolved
  request head and whose `verifiedAt`/identity are the fixture's declared values.
- The record was produced from a run whose worktree has no change folder: the
  declaration was read at the request head, and the record's head is that head.
- Zero waivers, zero transactions; the git seam records no `squash-land`,
  `rebase-refresh`, push, fetch or head mutation; the checkout's `HEAD` still
  points at the base branch and its SHA is unchanged after the run.
- Neither stdout nor stderr contains `result=merged` or `squash=`.
- Exit 0 with `result=verified`, `resolutionSource=declared-at-head`, and `gates`
  of length 2 (both passing).

#### TC-MRG-032 - The merge-surface CI entry is cited by source; battery records unchanged

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: Important
**Plan Phase(s)**: 4
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
**Plan Phase(s)**: 6
**Related IDs**: NFR-1
**Test Type(s)**: Integration, Performance
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-determinism.test.ts` (extend `TC-MERGE-035`'s scenario list)
**Tags**: @backend, @perf

**Preconditions**:

- Seven scenarios: one success plus six refusals —
  `merge.branch-unresolved` with `declaration-missing`, `merge.branch-unresolved`
  with `record-unreadable`, `merge.request-unresolved`, a gate failure, a pending
  check, and `config.credential.missing`.
- A fresh harness per run (fresh temp state root, fresh fixture, fresh local
  object-read log), fixed clock and fixed run id.

**Steps**:

1. Run each scenario 20 times and compare stdout, stderr and exit code to the
   first run.
2. Run the changed-fact control (one route, label, reason or SHA flipped) for a
   branch-refusal scenario and for the gate-failure scenario.

**Expected Outcome**:

- All 20 runs of each of the seven scenarios are byte-identical on stdout and
  stderr and share the same exit code; the run id is the only permitted variance
  and is injected.
- The `declaration-missing` and `record-unreadable` renderings are byte-stable
  **and distinct from each other**: the closed reason is part of the deterministic
  output, so the two branch causes cannot collapse into one rendering.
- The changed-fact control differs from its base scenario (asserted by
  inequality, not by a snapshot), proving the comparison is not vacuous.
- No scenario's output depends on iteration order, time of day, state-root path,
  or the order in which candidate records are read.

#### TC-MRG-034 - The per-invocation read budget holds exactly

**Scenario Type**: Corner Case
**Impact Level**: High
**Priority**: High
**Plan Phase(s)**: 4
**Related IDs**: NFR-2, DM-2, API-1
**Test Type(s)**: Integration, Performance, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-probe.test.ts` (extend `TC-MERGE-032`) + `tests/behaviour/merge-production-composition.test.ts` (composition-wide transport log)
**Tags**: @backend, @perf

**Preconditions**:

- A success fixture and the six refusal fixtures; a recording local-read port (the
  tree/blob read) and the recording transport for the two permitted provider reads
  (the open page and, on the convergence cells, the closed read).

**Steps**:

1. For each fixture, run one invocation and read every counter.
2. Build the exact multiset of reads and compare it to the budget.
3. Drive the `not-mergeable` and `unknown` cells to count the two permitted
   re-reads.

**Expected Outcome**:

- Success resolved from a unique open candidate: **one** provider read — the
  bounded open-request list, which also supplies the request detail (there is no
  second detail read) — plus at most one bounded local change-record read per
  candidate, one work-item read, one CI-workflow read, one check-run page **on the
  resolved head SHA**, one verification read, and at most one landing.
- The budget is an exact multiset per fixture, not an upper bound: the open-list
  URL appears once and, on a fixture that reaches the convergence decision, the
  closed-list URL appears once — never twice, and no detail URL is requested
  separately.
- Zero retries, zero pagination and zero fetches: no endpoint or local read is
  repeated except the declared post-refusal and unknown-recovery allowances, each
  capped at one and asserted by name.
- Refusal fixtures stop at the read that refused: each
  `merge.branch-unresolved` cell spends exactly the open-list read (its candidate
  is on the page, so no closed read is spent); a `no-open-request` or
  `ambiguous-merged-request` cell spends the open page plus the closed convergence
  read — **two** — and no other provider read; a one-candidate branch refusal adds
  exactly one local record read, and a zero-candidate request refusal adds none.
- No read addresses a SHA other than the resolved head on the check-run path, and
  no local read addresses the checkout's working tree.

#### TC-MRG-035 - Machine and human output stay inside the declared bounds

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: Medium
**Plan Phase(s)**: 6
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
  identity, candidate count, head) are single bounded scalars, the
  required-check count and set size are numbers rather than lists, and the
  `command`/`ref` rendering fields are length-bounded (the ref is one token, and
  the branch-evidence list is capped at three candidates).

#### TC-MRG-036 - The new suites are offline: no network, no child process

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Plan Phase(s)**: 3
**Related IDs**: NFR-4, AC-F5-3, F-1, F-2, F-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/merge-deploy-no-live-calls.test.ts` (extend `DEFAULT_MODULES`) + `tests/checks/merge-suite-discovery.test.ts` (static scan of new suites)
**Tags**: @backend, @security

**Preconditions**:

- The throwing fetch guard; the injected child-runner seam; the new suites'
  sources.

**Steps**:

1. Run the new behaviour cells with the guard installed and read `guard.calls`.
2. Read the child-runner seam's invocation count and confirm no real process was
   spawned (the seam returns declared results for the local record read).
3. Run the static scan over the new suites for network/transport/child-process
   imports and call sites.

**Expected Outcome**:

- `guard.calls` is `[]` after every new case; the deliberate-call positive
  control still throws, so the guard is live.
- The child-runner seam is the only executor of the local git reads: zero real
  child processes are spawned (`spawn`/`exec` never reached), even in the
  `record-unreadable` cell.
- The static scan finds no `fetch(`, no transport import and no `child_process`
  / spawn site in the new suites; the delivered no-live-call modules stay green.
- The suite-discovery check admits every new file (not under `tmp/`, not a
  fixture) and the pinned CI topology is unchanged.

#### TC-MRG-037 - The merge path reads no ambient branch, head or working-tree record

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Plan Phase(s)**: 3
**Related IDs**: NFR-6, F-1, G-1, G-5
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
2. Scan it for a read of the checkout's head (`rev-parse HEAD`,
   `resolvedRepositoryFacts.head.sha`, equivalent).
3. Scan it for a working-tree read of the change record (the delivered
   `readPmNotesText` acquisition rooted at `cwd`, `join(cwd, "doc/changes", …)`,
   or any `readFileSync` of a `chg-*-pm-notes.yaml` path).
4. Scan it for a fetch/pull invocation (`fetch`, `pull`, `upload-pack`,
   `remote update`).
5. Record findings as `file:line`.
6. Plant one instance of each forbidden construct into a temp copy of the scanned
   tree and re-run the same matcher.
7. Confirm the permitted positive sources are present: the one open-request list
   read, the bounded local tree/blob read at the candidate head, and the delivered
   parse applied to that text.

**Expected Outcome**:

- The production scan's finding set is empty for all four absence claims (branch,
  head, working-tree record, fetch/pull).
- Each planted control is found and named by `file:line`, so no matcher can pass
  vacuously; the four controls are distinct assertions, not one shared regex.
- The positive sources are present: the two bounded list reads (the open page and
  the closed convergence read) are the only provider reads on the path, and the
  record is obtained from a commit SHA, so the scan asserts the replacement as well
  as the removal.
- No `git branch`/`rev-parse --abbrev-ref` invocation and no working-tree
  change-record open exists on the merge path.

**Notes / Clarifications**:

- This case is the source-invariant half of NFR-6 (GAP-TP-1); the behavioural
  halves are TC-MRG-001's base-tip inequality, TC-MRG-031's unchanged checkout
  and TC-MRG-042's `record-unreadable` cell.

#### TC-MRG-038 - Identities move 170 → 173 with the gate-set identity unchanged

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Plan Phase(s)**: 7
**Related IDs**: NFR-8, F-3, F-4, DM-3
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/error-table.test.ts` (`TC-SYNC-001`), `tests/checks/error-table-sync.test.ts`, `tests/structure/merge-refusal-rows.test.ts`, `tests/checks/doc-conformance.test.ts`, plus the four doc surfaces
**Tags**: @backend, @docs

**Preconditions**:

- The synced base: `origin/main-tools` at `e1ebc76c`, where the machine table
  holds **170** entries, the documented table **170** rows, the delivered set
  **169**, the two-segment allowlist **68**, and the arithmetic is
  `BASELINE_ROWS.length + 136`.
- The machine table, the documented table, the seven identity pin sites, the two
  identity-count pages, the merge reference page, the merge feature spec, the
  merge test specification and the phrase-table authority.

**Steps**:

1. Run the two-table sync check and read every count it reports.
2. Assert the deltas are exactly the three additive rows and the one narrowed row
   (no other row removed, retyped or reworded).
3. Read every identity pin site and count page.
4. Read the effective gate-set identity string.
5. Read the four merge doc surfaces for the same total, the same family and the
   same merged-report semantics.
6. Read the phrase-table scan's verdict for the superseded tokens.

**Expected Outcome**:

- Machine entries **173** (170 → 173), documented rows **173** (170 → 173),
  delivered rows **172** (169 → 172), two-segment allowlist **71** (68 → 71), and
  arithmetic `BASELINE_ROWS.length + 139` (`+136` → `+139`); the `merge` kind
  count is **12** (9 → 12).
- The delta is exactly `merge.branch-unresolved`, `merge.request-unresolved`,
  `merge.work-item-unresolved`, each documented exactly once, plus the
  `merge.transaction-aborted` row's narrowed text, value and remediation.
- All seven pin sites carry the new numbers; **167 is a banned stale total** (it
  is a `LEGACY_ENTRY_167_FORMS` token, so a page that "moves 167 → 170" would be
  asserting a superseded value), and no page states 170 as a live total or `+136`
  as the live arithmetic.
- The phrase table rotates: `+136` joins the legacy forms and `+139` is published
  as the live arithmetic; the scan's control proves a superseded token planted in
  a page is found.
- The merge reference page, the merge feature spec, the merge test specification
  and the documented table state the same total, the same refusal family and the
  merged report's evaluated-projection semantics.
- The effective gate-set identity is unchanged:
  `delivery.merge.gates.v1:[lifecycle-finalization,ci-green,push-parity,owner-gate,squash-preflight,tracker-freshness]`
  — the surface of `ci-green` moves, the id sequence does not.
- The family declarations are unchanged (no pattern widening, no third family).

**Notes / Clarifications**:

- The counts are restated from the post-sync tree, not the intake snapshot
  (readiness finding 2). A change that moves any single site without the others
  fails the sync check or the phrase-table scan in the same commit.

#### TC-MRG-039 - Canary secrets never reach output or records

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Plan Phase(s)**: 2
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
- The allowed identity fields (the invocation ref in `ref=<ref>`, `command=merge`,
  head SHA, gate id, `ci-green`, `operation=<token>`) remain present, so the scan
  is not passing by removing everything; the new `ref` field is a change ref, not
  personal data (spec §20).
- The secret-read allowlist is an exact-set equality with the delivered one: no
  new entry was added to name a credential.
- The mutation control (a title copied into evidence) is detected by the same
  scan.

#### TC-MRG-040 - The added reads are local, bounded and network-free, with no added polling

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: Medium
**Plan Phase(s)**: 4
**Related IDs**: NFR-10, NFR-2, DM-2
**Test Type(s)**: Integration, Performance
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-probe.test.ts` (count delta) + `tests/behaviour/merge-production-composition.test.ts` (transport and local-read logs)
**Tags**: @backend, @perf

**Preconditions**:

- A success fixture and the branch/request refusal fixtures, with the pre-change
  provider-read population recorded as a declared constant from the delivered tree.
- The local-read port recording each tree/blob invocation and its byte count.

**Steps**:

1. Run one invocation and read the provider request count, the local record-read
   count and the per-read git-invocation count.
2. Compare the provider count to the pre-change population: the list read is the
   same operation, now also the detail read.
3. Read the byte count of each local read and the clock-read counter.

**Expected Outcome**:

- **The provider population stays at the declared two-read budget**: the
  open-request list read is the one the request resolution already performed, and
  the closed-request convergence read is the delivered merged-request read — the
  same provider operation (`state=closed`), now filtered by the declared branch
  convention — so the path performs at most two reads, never a third, adds no new
  provider operation and no fetch.
- Local record reads are bounded: ≤ 3 (one per candidate, capped by
  `MERGE_BRANCH_CANDIDATE_MAX`), ≤ 2 fixed-argv git invocations each, ≤ 262 144
  bytes each, and network-free; the worst case is six local invocations.
- Every refusal on the resolution path performs exactly the reads its path
  declares — one (the open page) when a convention-matching candidate exists, two
  (open page plus closed convergence read) when it reaches the convergence
  decision (`no-open-request`, `ambiguous-merged-request`) — and no other.
  `record-unreadable` is included, and adds only the failed local read, not a
  provider request for the missing object.
- The clock-read count is bounded (no wait/poll cycle), and the invocation
  performs zero retries and zero sleeps.
- Total reads stay within the NFR-2 budget across success and refusal cells, and
  the change-record read adds no credential read.

#### TC-MRG-041 - No new record kind, key or event schema; shapes unchanged

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Plan Phase(s)**: 6
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

#### TC-MRG-042 - Six closed branch reasons, the declared precedence and the candidate bounds

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Plan Phase(s)**: 3
**Related IDs**: F-1, AC-F1-3, DM-1, API-3, NFR-2, NFR-5
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-production-composition.test.ts` (new cell family) + `tests/behaviour/merge-git-seam-capabilities.test.ts` (the local read's argv and byte bound) + `tests/structure/merge-contract.test.ts` (the three pinned constants)
**Tags**: @backend, @api, @merge

**Preconditions**:

- The base-checkout fixture family: worktree carries **no change folder**, `HEAD`
  at the base tip, the feature branch's objects present locally except where a
  cell removes them.
- One open request per single-candidate cell, whose source ref follows the
  declared convention for the ref; the three pinned constants are read from the
  contract (`MERGE_BRANCH_DECLARATION_MAX_CHARS = 256`,
  `MERGE_BRANCH_CANDIDATE_MAX = 3`, `MERGE_CHANGE_RECORD_MAX_BYTES = 262_144`).
- Six single-candidate reason cells:
  (a) `record-missing` — the head tree has no `chg-<ref>-pm-notes.yaml`;
  (b) `record-invalid` — the record exists but does not parse, or parses to a
  non-mapping;
  (c) `record-unreadable` — the asserted head is a **full 40-hex SHA that is not
  in the local object database** (a synthetic SHA with no object), so the local
  tree read cannot observe it;
  (d) `declaration-disagrees` — a usable value that is not an exact match for the
  candidate's own source ref (a sibling branch of the same ref);
  (e) `declaration-missing` — covered in detail by TC-MRG-004;
  (f) `declaration-unusable` — covered in detail by TC-MRG-004.
- Two multi-candidate cells for the precedence: (i) three candidates failing with
  `declaration-missing`, `record-invalid` and `record-missing`; (ii) three
  candidates failing with `declaration-unusable`, `record-unreadable` and
  `declaration-disagrees`.

**Steps**:

1. Run `merge <ref> --json` in each single-candidate cell.
2. Read `error.code`, the single closed reason, the rendered cause evidence (one
   entry per read candidate, with its own reason and attempted tree path) and the
   `command`/`ref` fields.
3. Read the transport log, the local read log (invocations, argv, byte counts),
   the state ledger and the landing count.
4. Run the two multi-candidate cells and read the reported reason and the
   per-candidate evidence.

**Expected Outcome**:

- Every cell exits 1 with `error.code === "merge.branch-unresolved"` and **exactly
  one** closed reason, drawn only from the six:
  `declaration-missing`, `declaration-unusable`, `declaration-disagrees`,
  `record-missing`, `record-invalid`, `record-unreadable`.
- The reported reason follows the declared precedence
  `declaration-disagrees` > `record-invalid` > `record-unreadable` >
  `record-missing` > `declaration-missing` > `declaration-unusable`: cell (i)
  reports `record-invalid`; cell (ii) reports `declaration-disagrees`. The
  evidence still carries each read candidate's own cause, so one run diagnoses
  all three (≤ 3 entries).
- The evidence names each candidate's own source ref and the attempted tree path;
  the `branch` key is named; `command=merge` and `ref=<ref>` are present.
- **Cell (c) is the fetch-policy pin**: the run performs the one open-list read
  (its single candidate is on the page, so the closed convergence read is not
  spent), then a local read that cannot observe the object, and refuses — no fetch,
  no pull, no `upload-pack`, no additional provider request for the missing object,
  and no fallback to the working tree or to convention-only acceptance. The same
  provider state therefore resolves identically in a clone that holds the object
  and one that does not.
- **Operation tokens are source-faithful**: `record-unreadable` renders
  `operation=local-git-object-read` and `record-invalid` renders
  `operation=local-change-record-read` — each the local token for the operation
  that failed, and **not** `-`; the declaration-value reasons
  (`declaration-missing`, `declaration-unusable`, `declaration-disagrees`) render
  `-`, because they name no read operation. A local read that leaves the field
  empty, or names the other local operation, fails this case by name.
- Read budget per cell: exactly one provider read (the open list) and at most one
  local record read (one candidate), each local read at most two fixed-argv
  invocations and at most 262 144 bytes; every invocation is `ls-tree -r
  --name-only <sha> -- <pathspec>` then one blob read, with no shell.
- The three constants are asserted by exact value; a 257-character declaration is
  `declaration-unusable` and a 256-character one is accepted (TC-MRG-004).
- Zero landing calls, zero appended verification or transaction records, and no
  `merge.transaction-aborted` in any cell.

**Notes / Clarifications**:

- The six reasons are a closed vocabulary: an unknown reason value fails the
  case. The distinction between `record-missing`, `record-invalid` and
  `record-unreadable` is the *repair* (commit the record, fix the YAML, make the
  object present), which is why they share one identity.
- `record-unreadable` is the cell that decides whether `OQ-4`'s deferred fetch is
  needed; no case depends on the deferred policy — this case asserts the pinned
  refusal (NG-7) and §8.3 OQ-TP-6 records the deferral.

#### TC-MRG-043 - A converged re-run replays from provider truth without a record read

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Plan Phase(s)**: 3
**Related IDs**: F-1 (convergence provision), AC-F1-6 (primary), AC-F1-3 (secondary), AC-F5-1, DM-2, NFR-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-production-composition.test.ts` (new cell; the delivered replay oracle stays in `tests/behaviour/merge-convergence.test.ts`)
**Tags**: @backend, @api, @merge

**Preconditions**:

- The base-checkout fixture: worktree carries no change folder, `HEAD` at the base
  tip, and **no `branch` declaration exists anywhere** — not in the worktree, not
  at any head the run could read.
- The bounded **open-request list** read returns no convention-matching open
  candidate (so the run reaches the convergence decision); the bounded
  **closed-request list** read returns exactly one merged request whose **source
  ref follows the declared convention** for the invocation's ref. Entries are
  filtered by that convention — never matched by work-item substring and never
  ranked — and the page is unsaturated.
- The request head object is **absent** from the local object database, so a run
  that attempted a record read would refuse `record-unreadable` instead.

**Steps**:

1. Run `merge <ref> --dry-run --json`, then `merge <ref> --json` in a fresh state.
2. Read `data.result`, `data.replayed`, the reported head and the post-landing
   steps.
3. Read the local read log, the transport log and the landing count.
4. Run a second cell whose closed read returns two merged matches and a third
   whose closed read returns zero merged matches (the open page is empty in both).

**Expected Outcome**:

- Both runs exit 0, report `result=merged` with `replayed=true`, and perform
  **zero local record reads** and **zero record-read git invocations** — the
  convergence match is decided from the bounded closed-request read, before any
  record read.
- No `branch` refusal is reachable: the run performs no declaration check and
  reports no `merge.branch-unresolved`; the report does not claim
  `declared-at-head` (no declaration was read) and names the replay instead.
- The landing count is 0 and the transaction record count is 0 on the first
  replay; the post-landing steps are reported (`branch-deletion`,
  `closeout-ready`) rather than silently skipped.
- **Two** merged matches refuse as `merge.request-unresolved` /
  `ambiguous-merged-request` rather than guess, naming the convention, the ref and
  the observed merged count; **zero** merged matches continue to the candidate
  path, where the empty open page produces `merge.request-unresolved` /
  `no-open-request` (the paired control, proving the replay branch is not a run
  that skipped resolution).
- **Exactly two provider reads per run** — the open page plus the closed
  convergence read, each observed once — with **zero** fetches, zero retries and
  no third read; the two-read budget is asserted as an exact multiset.

**Notes / Clarifications**:

- Spec v2.1 gives the provision its own criterion — `AC-F1-6` is this case's
  primary AC (no longer the negative of `AC-F1-3`) — and spec v2.2 restates its
  read premise: merged truth comes from the bounded **closed-request** list read,
  filtered by the declared branch convention, and the former GAP-TP-3 is closed.
  `TC-MRG-049` carries the dedicated zero-record-read proof, the "no readable
  record anywhere" precondition and the `0 | 1 | 2+` observation; this case keeps
  the ordering claim and the paired control that **zero** merged matches continue
  to the request refusal rather than replaying.

#### TC-MRG-044 - The merged report renders the evaluated merge-applicable projection

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Plan Phase(s)**: 6
**Related IDs**: F-2, F-5, AC-F2-8, API-1, API-2, DM-2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-production-composition.test.ts` (new case) with the rendering unit in `tests/behaviour/merge-dry-run.test.ts`
**Tags**: @backend, @api, @merge

**Preconditions**:

- One fixture whose fresh check-run page is all green and whose tracker gate is
  fresh; the shipped default set, so the merge projection is `ci-green` +
  `tracker-freshness`.
- The seeded verification record's own `gates` list is the battery's five
  built-ins (as a `verify gates` record would carry), so echoing the record is
  observable: the current delivered `success-human.txt` says `gates=5/5` and the
  record is **not** rewritten by this case.
- Both surfaces run on the same fixture and head: `merge <ref> --dry-run --json`
  and `merge <ref> --json`.

**Steps**:

1. Run the dry run; read `data.gates` (ids, verdicts, reasons) and the human
   `gates=<passed>/<total>` line plus the per-gate lines.
2. Run the real merge; read the same fields.
3. Read the seeded verification record's `gates` list from the ledger.
4. Assert the report's projection against the record's list and against the
   effective merge-applicable entries.

**Expected Outcome**:

- The merged report renders `gates=2/2 passed` over exactly `ci-green` and
  `tracker-freshness`, with one line per entry carrying that entry's verdict and
  reason; `data.gates` has length 2.
- The report contains **no** line for `lifecycle-finalization`, `push-parity`,
  `owner-gate` or `squash-preflight`, and never `gates=5/5`: the report does not
  echo the verification record's battery list (spec API-1, §10, DEC-12).
- The verification record still carries its five-entry battery list: the
  discriminator is report-versus-record, and the record is untouched.
- The dry-run report states the same two-entry projection and the same
  `gates=2/2`, field by field, so AC-F2-8's two halves agree. **This is the
  phase-6 home of the projection-equality assertion moved out of `TC-MRG-030`,
  `TC-MRG-010` and `TC-MRG-011`**: those cases are owned by phases 3 and 4, where
  the merged report still renders the record's list, and could only have asserted
  a state this phase creates (readiness iteration 3, finding 2). The equality is
  `toEqual` over the projected arrays — ids, verdicts and reasons — not a count.
- **Projection-equality control**: a report whose gate list differs from the dry
  run's in one verdict, one id or one reason fails this case by name; a
  behaviour-preserving run whose two surfaces agree passes, so the equality is a
  live comparison rather than a shared fixture.
- **Control**: substituting the record's gate list into the report makes the case
  fail by name (`gates=5/5` detected), so the assertion is not satisfied by any
  `gates=` line.
- Exit 0 for both surfaces, exactly one landing for the real merge, zero for the
  dry run.

#### TC-MRG-045 - Deleting the runtime family declaration fails the totality proof by name

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Plan Phase(s)**: 5
**Related IDs**: F-4, AC-F4-2, NFR-7, DEC-7
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/defect-f1-merge-refusal-containment.test.ts` (new mutation cases beside the positive proof) + `tests/structure/content-inventory.test.ts` (the declaration is a registered export)
**Tags**: @backend

**Preconditions**:

- The composition's exported runtime emittable declaration (the exact-member list
  and the family declaration: contract prefix, suffix, template and slot rule),
  imported as a value.
- A substitution seam that supplies the declaration value to the proof, so the two
  mutations are value substitutions and never edits of committed source — the same
  shape the delivered `defect-f1` control uses.
- The live mismatch control from TC-MRG-029 still available.

**Steps**:

1. Run the totality proof against the production declaration value; assert it
   passes.
2. Run it against mutation (i): the declaration **deleted** (the value is absent).
3. Run it against mutation (ii): the declaration **replaced by the bare
   exact-member list** (no family expression, no slot rule).
4. Read each failure message and assert what it names.
5. Scan the proof's source for a source-text assertion of the family, with a
   planted matcher control.
6. Re-run the live mismatch control under mutation (ii).

**Expected Outcome**:

- The production value passes; both mutations **fail by name**, naming the missing
  family declaration (and, for mutation (ii), the missing slot rule), not a source
  text mismatch and not a generic uncovered-code list.
- No source-text assertion remains as the proof: the proof performs no
  `readFileSync` of the composition and no `includes("MergeCompositionEmittableFamily")`
  / prefix / suffix match; the planted source-text matcher is found by the scan
  and reported as a forbidden shape.
- A behaviour-preserving refactor control (the declaration moved to a different
  module and re-exported) still passes, so the proof follows the value and not a
  file.
- Under mutation (ii) the live mismatch control still drives an undeclared code to
  `fallback.internal`, so the removal of the declaration is detected without
  making containment unreachable.
- `merge.gate.ci-green.failed` still resolves to the family row under the
  production value (the guarantee AC-F4-1 asserts), and the declaration is
  registered in both export inventories.

**Notes / Clarifications**:

- The mutation must not be produced by editing a committed file in place: a case
  that only fails because the repository was temporarily broken would pass on a
  clean checkout and prove nothing. The seam is the proof's input.

#### TC-MRG-046 - The five refusal renderings carry `command`/`ref` fields and all ten refusal goldens move

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Plan Phase(s)**: 6
**Related IDs**: F-3, AC-F3-1, API-3, NFR-3, NFR-5
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-refusal-surface.test.ts` (field rendering) + `tests/golden/merge.test.ts` and `tests/fixtures/merge/golden/` (the declared movement)
**Tags**: @backend, @api, @golden

**Preconditions**:

- The five delivered refusal scenarios (gate, stale, tracker, override, waiver),
  each rendered in human and scripted form.
- The thirteen committed merge goldens and the plan's per-file movement, which is
  distributed by phase: phase 2 regenerates the ten moved refusal goldens and adds
  the work-item pair (`EXPECTED` 13 → 15), phase 3 moves the success trio and the
  stale pair and adds the branch and request pairs (`EXPECTED` 15 → 19), and phase
  6 re-renders the success trio over the evaluated `gates=2/2` projection
  (`EXPECTED` stays 19). Each of those phases runs `tests/golden/merge.test.ts` in
  its own gate.
- The phase ownership split: the `command`/`ref`/`operation` fields are authored
  in phase 2, the resolution bytes in phase 3, and phase 6 — which owns this case
  — asserts the complete contract closure: the whole set, the mutation control and
  the 19-file arithmetic.
- The `EXPECTED` set and its count as the plan declares them.
- The amended rendering contract (spec F-3, API-3, DEC-11): a dedicated
  `command=merge` field, a dedicated `ref=<ref>` field carrying the invocation's
  ref, and a dedicated `operation=<token>` field from the closed vocabulary (or
  `-`) on **every** refusal — the three fields together are what move the
  renderings.

**Steps**:

1. Render each of the five refusals in human and scripted form and parse the
   `command`, `ref` and `operation` fields from their declared field grammar;
   assert the `operation` token is in the closed vocabulary or `-`.
2. Compare each rendering to its committed golden; read the `EXPECTED` set and its
   count from the golden suite.
3. Read the golden directory listing and compare it to the plan's declared
   per-phase movement table.
4. Run the mutation control (a golden regenerated outside the phase's declared
   subset).

**Expected Outcome**:

- Every one of the five refusals carries `command=merge`, `ref=<ref>` and
  `operation=<token>` (closed vocabulary or `-`) as parsed fields; removing any of
  the three while leaving the code in place fails by name (TC-MRG-024's control).
- **All five human refusal goldens and all five scripted refusal goldens move**
  (byte-changed): the rendering contract is uniform, so the earlier
  7-moved/6-identical split no longer describes the set. Together with the three
  success files (which gain the resolved object and `gates=2/2`) the **thirteen
  committed files all move**, and the three new rows add **six** files
  (`refusal-branch-*`, `refusal-request-*`, `refusal-work-item-*`, human +
  scripted).
- `EXPECTED` moves **13 → 15 → 19** exactly as the plan declares — 13 → 15 in
  phase 2, 15 → 19 in phase 3, and unchanged at 19 in phase 6 — because the
  golden set moves in the phase that changes the bytes, not in one commit with
  the rendering change; the byte-for-byte text comparisons move **11 → 13**
  (phase 2) **→ 17** (phase 3) (eight refusal human files and eight refusal
  scripted files — five existing pairs plus the three added pairs — plus the
  success human rendering), `success-data.json` remains the single structural
  comparison, and `success-scripted.json` stays pinned by the directory
  listing. The comparison count is the number of files the suite compares
  byte-for-byte, not the number of files that stay unchanged.
- No committed merge golden is left byte-identical: a movement table that claims
  an unchanged refusal pair contradicts the contract and fails this case.
- The mutation control: a golden regenerated outside the phase's declared subset
  fails the suite by file name. Every phase declares its subset by exact path, so
  a file regenerated in a phase that does not name it — early, late, or by a
  blanket rewrite — is a named failure, and each phase's gate proves only its own
  subset.
- No refusal code, category, consequence, exit digit or envelope property moves
  with the rendering (asserted against the delivered table).

**Notes / Clarifications**:

- This case closes OQ-TP-2 on the plan's per-file movement table (its GOLDEN
  MOVEMENT BY PHASE block), which distributes the movement across phases 2, 3 and
  6; the earlier 7-moved/6-identical reading predates DEC-11 and is superseded
  (spec §8.5: "Every refusal's rendered summary changes").
- Phase 6 owns this case. The fields are authored in phase 2 and the resolution
  bytes in phase 3, so those phases regenerate only their declared subsets and run
  `tests/golden/merge.test.ts` in their own gates; the complete contract closure —
  the whole set, the mutation control and the 19-file arithmetic — is asserted
  here. A regeneration outside a phase's declared subset must fail by name.
- The three success files are covered here for the movement arithmetic; their
  content assertions belong to TC-MRG-044 and TC-MRG-032.

#### TC-MRG-047 - The abort row declares `retryable: false` and the convergence assertion moves

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Plan Phase(s)**: 2
**Related IDs**: F-3, AC-F3-6, AC-F3-5, API-3
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-convergence.test.ts` (update: the delivered `expect(errorOf(result)?.retryable).toBe(true)` moves to `false`) + `tests/structure/merge-refusal-rows.test.ts` + the documented row in `doc/spec/features/feature-result-contract.md`
**Tags**: @backend, @api

**Preconditions**:

- The **two** pre-mutation causes the narrowed row still reaches, each drivable in
  the transaction harness: (a) a waiver-append failure (`appendWaiverFault`), (b) a
  declared landing gap (the coordinator-boundary fixture). A refused landing is
  **not** one of them (spec v2.1, F-3, AC-F3-6).
- The **landing-fault** cells, driven through the same seam, whose identity is
  taken from the shipped mapping rather than assumed: a transient/transport fault
  → `provider.outage`, a rejected credential (401/403) → `provider.auth.rejected`,
  a landing that fired without observed merged truth →
  `merge.landing-unverified`, and a missing credential →
  `config.credential.missing`. The port's refusal type is the **closed
  landing-fault identity set**, not a free string: the delivered
  `merge-convergence.test.ts` cell's arbitrary code `protection-rule` is
  re-pointed to a declared identity rather than merely re-asserted, and a port
  returning `protection-rule` is a negative control that must still leave as a
  declared identity.
- The parsed rendering fields, so the landing fault's **failing operation** is
  asserted in the dedicated `operation` field (a member of the closed vocabulary,
  not `-`).
- The delivered convergence suite's two abort cells (`TC-MERGE-026`
  descriptions), whose `retryable` assertion is the one that moves.
- The documented table's `merge.transaction-aborted` row and the landing-fault
  identities it now names.

**Steps**:

1. Drive each of the two remaining causes and read `error.code`,
   `error.retryable`, the consequence, the remediation and the exit code.
2. **Derive** each cause's act-required value from the shipped mapping for that
   cell: map the cause to its emitted identity, read that identity's declared
   convergence semantics, then re-run the same fixture with unaltered persisted
   state. For the abort row's two causes a plain re-run must refuse again; for the
   landing-fault cells a plain re-run with only the transient condition cleared
   must exit without the refusal (`provider.outage`), while `provider.auth.rejected`
   must refuse again until a usable credential is supplied.
3. Drive the four landing-fault cells and assert the emitted identity, that
   `merge.transaction-aborted` is never emitted for any of them, the failing
   operation in the `operation` field, and the observed re-run outcome. Drive the
   `protection-rule` negative control and assert the emitted identity is a declared
   member and that `protection-rule` appears nowhere.
4. Read the delivered convergence suite's assertions and the documented row.
5. Run the mutation control (the pre-change row substituted: `retryable: true` plus
   the convergence hint) and the mapping control (a refused landing routed back to
   the abort row).

**Expected Outcome**:

- Each of the two remaining causes refuses `merge.transaction-aborted` at its
  row-projected exit with `retryable === false`, `consequence=not_landed`, and a
  remediation naming the aborted pre-mutation condition with **no convergence
  promise**; the derived cause set is exactly those two, and neither is act-free.
- The landing-fault cells report a **declared identity** — `provider.outage`
  (transient/transport, exit projected by its delivered row),
  `provider.auth.rejected` (rejected credential),
  `config.credential.missing` (missing credential) and `merge.landing-unverified`
  (fired but unobserved) — each resolved from the shipped mapping, never
  transcribed, and each rendering carrying `operation=<the failing landing
  operation>`, never `-`. The `provider.outage` cell converges on a plain re-run
  with no operator act; the `provider.auth.rejected` and
  `config.credential.missing` cells do not converge until a usable credential is
  supplied. **No landing-fault cell emits `merge.transaction-aborted`.**
- **No raw port code leaks.** The envelope, evidence, appended records and summary
  carry **no** arbitrary port string: the literal `protection-rule` is absent from
  every cell, including the negative control in which the land port returns it, and
  the control's emitted code is asserted to be a member of the closed landing-fault
  identity set. A run that passes a port code through fails this case by name,
  because the emitted code would resolve to no declared row (NFR-7).
- The delivered convergence assertion now expects `false`: the suite's
  `toBe(true)` is replaced in the same change, and the case fails by name if the
  old expectation survives (a stale `true` assertion is a detected regression, not
  a tolerated difference).
- The documented table row states `false`, the two-cause list and the
  no-convergence remediation, and names the landing-fault identities; the
  reference page (TC-MRG-038's doc surfaces) agrees.
- The credential condition, unresolvable request, unresolvable work item and
  refused landing reach none of the abort cells (each refuses its own identity —
  TC-MRG-021/022/005 and the landing-fault cells).
- Mutation control: with `retryable: true` and the convergence hint restored, both
  this case and TC-MRG-026 fail by name. Mapping control: routing a refused landing
  back to the abort row fails by name, because the row's derived cause set would
  contain a cause that converges on a plain re-run.
- Zero landing calls in cause (a); cause (b) lands nothing and reports the gap; the
  landing-fault cells record exactly one attempted landing call and no cell claims
  `result=merged`.

**Notes / Clarifications**:

- OQ-TP-5 is closed: spec v2.1 pins `retryable: false` for this row (§8.5, F-3,
  AC-F3-6) **and** narrows the row to two pre-mutation causes by moving the refused
  landing to the provider identities (readiness iteration 2, major 2). The either-or
  shape in the earlier revision of this plan is superseded, and the delivered
  convergence suite is inside this change's blast radius (readiness finding 7).

#### TC-MRG-048 - An explicit `--waive` still authorizes where a class binding exists

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Plan Phase(s)**: 2
**Related IDs**: F-2 (retained waiver path), NG-6, API-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-waivers.test.ts` (`TC-MERGE-018` authorized; `TC-MERGE-019` unauthorized / unresolvable / non-waivable) — executed unchanged
**Tags**: @backend, @api

**Preconditions**:

- The delivered waiver harness: an `owner-gate` entry carrying a waiver class
  binding, `owner-principal` as the authorized principal, and a fresh verification
  record for the resolved head.
- The three delivered negative variants: an unauthorized authorizer, an
  unresolvable principal, and `--waive ci-green` (a gate with no class binding).

**Steps**:

1. Run `merge <ref> --waive owner-gate --waived-by <authorized principal>` and read
   the exit code, the recorded waiver and the landing count.
2. Run the three negative variants and read the code, the waiver ledger and the
   landing count.
3. Read the waiver class binding data and compare it to the delivered set.

**Expected Outcome**:

- The authorized run exits 0, records exactly one waiver with its `authorizedAt`
  before the landing, lands exactly once, and the `owner-gate` gate passes under
  that waiver — the explicit path still authorizes where a class binding exists.
- Each negative variant exits 1 with `merge.waiver-unauthorized`, records no
  waiver and lands nothing; the rendered authorizer is an identity reference, never
  a credential.
- `--waive ci-green` gains no binding: it refuses on the same row and records no
  waiver (the check gate keeps its delivered non-waivability — F-2, NG-6).
- The waiver class binding set is an exact-set equality with the delivered one: no
  waiver class, override or bypass was added.
- The `command`/`ref` fields are present on the `merge.waiver-unauthorized`
  rendering (matrix cell 22), and no refusal code or exit digit moved.

**Notes / Clarifications**:

- This is a regression proof that the retained explicit path still authorizes; it
  claims no waiver-policy change (NG-6), and it replaces `AC-F2-7` in the owner
  trace (readiness finding 17).

#### TC-MRG-049 - Already-merged convergence: provider truth replays with zero record reads and lands nothing

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Plan Phase(s)**: 3
**Related IDs**: F-1, AC-F1-6, API-1, DM-2, NFR-2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-production-composition.test.ts` (new cell; the delivered replay oracle stays in `tests/behaviour/merge-convergence.test.ts`)
**Tags**: @backend, @api, @merge

**Preconditions**:

- The base-checkout fixture: the worktree contains **no change folder** and `HEAD`
  is the integration-base tip.
- **No readable change record anywhere**, per `AC-F1-6`: no change folder in the
  working tree, the request head object **absent** from the local object database
  (so the bounded local read could not observe it), and no `branch` declaration
  reachable at any head the run could read.
- The bounded **open-request list** read returns **no convention-matching open
  candidate**; the bounded **closed-request list** read — the read production
  actually performs for merged truth — returns exactly **one** merged request whose
  **source ref follows the declared convention** for the invocation's ref, its
  `head.sha` a full-SHA request head. The page is unsaturated, so no saturation
  refusal is in play.
- The **open reply carries open requests only**: it has no merged section, because
  a `state=open` page cannot return a merged request. Merged entries come from the
  closed reply. The transport's shape therefore matches the provider surface
  instead of fabricating one (readiness iteration 3, finding 1).
- The recording transport, the recording child-runner seam (which would answer
  "object absent") and an empty state ledger.

**Steps**:

1. Run `merge <ref> --json` in a fresh state.
2. Read the exit code, `data.replayed`, `data.requestIdentity` and any reported
   head; assert the absence of `data.resolutionSource` / `declared-at-head`, and
   that any reported head is the matched merged request's asserted head rather than
   a head taken from a candidate resolution.
3. Read the change-record read counter, the child-runner invocation log, the
   transport request log, the state ledger and the landing count.
4. Run the two further cells: (i) the closed read returns **two** merged matches
   for the ref, (ii) the closed read returns **zero** merged matches (the open page
   is empty in both), so the run continues to the candidate path.
5. Scan every output, evidence member and appended record for the branch-refusal
   identity and for any raw port code.

**Expected Outcome**:

- The run exits 0, reports `data.replayed === true` and the single matched
  request's identity, and **lands nothing**: zero landing calls, zero waiver,
  transaction or git-mutation records, and no claim that this run performed a
  landing. The case does not assert a dry-run expectation: the spec pins the
  convergence behaviour for the merge invocation (`AC-F1-6`), and inventing a
  dry-run cell here would assert more than the contract states.
- **Zero change-record reads** and **zero record-read git invocations**: the
  record-read counter is exactly `0` and the child-runner log contains no
  `ls-tree -r --name-only` and no blob invocation. Because the head object is
  absent, a run that read before deciding would have refused `record-unreadable`,
  so the zero is a decided path and not an unexercised one.
- The output, the evidence and the appended records contain **neither
  `declared-at-head` nor `merge.branch-unresolved`**: convergence precedes the
  record read and the declaration refusal.
- **Read budget: exactly two provider reads** — the bounded open-request list page
  and the bounded closed-request convergence read, each observed once as an exact
  multiset; **zero** fetches, zero retries, and no third read. A converged run
  spends the closed read; a run that rules convergence out spends the same two.
- Cell (i) — **two merged matches** — refuses rather than ranking: it exits 1 with
  `merge.request-unresolved` / **`ambiguous-merged-request`**, lands nothing, does
  not report `replayed=true`, names the declared convention, the change ref, the
  observed merged count (`2+`) and both matched source refs, and presents neither
  request as *the* request. The identity and its row are read from `ERROR_TABLE`,
  never transcribed.
- Cell (ii) — **zero merged matches** — continues to the candidate path and
  refuses `merge.request-unresolved` / `no-open-request` (the open page is empty),
  which is the paired control proving that the zero-record-read result above is the
  convergence branch and not a run that skipped resolution. Its record-read counter
  is also `0`, because no candidate exists to read.
- **No raw port code appears**: the literal `protection-rule` is absent from every
  envelope, evidence member and record emitted by the three cells.

**Notes / Clarifications**:

- This case is the dedicated carrier of `AC-F1-6` (spec v2.1, read premise
  restated in v2.2). The superseded fixture put a merged section inside the
  open-request reply, a shape a `state=open` page cannot return; the case now
  serves the two reads the production path performs — the open page for candidates
  and the bounded closed read for merged truth, filtered by the declared branch
  convention and observed as `0 | 1 | 2+` with no ranking (readiness iteration 3,
  finding 1). `TC-MRG-043` keeps the ordering claim at the same fixture; the two
  cases are allocated to the same plan phase and assert different halves rather
  than duplicating one.
- The fixture is deliberately incapable of a record read: writing the record into
  the checkout, or leaving the head object present, would make "zero record reads"
  an observation about the fixture instead of about the run's ordering (TP-R-14).

## 6. Environments and Test Data

**Environments.** One: the developer/CI Linux container running `bun test` (or
`pnpm test`) and `pnpm check`. There is no staging and no live provider tier for
this change — NFR-4/AC-F5-3 forbid it, and the provider is always a synthetic
in-process transport. The only filesystem state used is a per-fixture temp
directory (checkout, home, state root), removed on `dispose()`/`cleanup()`.

**Fixture families and their shapes.** Every new case belongs to one of five
families; the shape is stated so an implementer does not invent a live seam.

1. **Resolution fixtures (composition level)** —
   `createMergeProductionHarness` over a real temp git checkout containing
   `main-tools` plus a one-commit feature branch, with:
   - **the fixture truth for every base-checkout case**: `HEAD` left on the
     integration-base tip **and the worktree containing no change folder** — no
     `doc/changes/<YYYY-MM>/<date>--<ref>--<slug>/` directory and no
     `chg-<ref>-pm-notes.yaml` in the checkout. The change record is **committed
     on the feature branch** (so its object is in the local object database) and
     is obtained by the run only through the local tree/blob read at the request's
     asserted head. A fixture that writes the record into the checkout fabricates
     a state a real base checkout cannot be in and does not satisfy AC-F1-1
     (readiness finding 1; §8.1 TP-R-10). The `branch` variant cells (absent,
     empty, whitespace, control-character, over-cap, disagreeing) are committed
     variants of that record, never worktree edits;
   - a `checkout`/`head` fixture option that leaves `HEAD` on the integration base;
     it must not add a provider read and must not mutate the checkout;
   - a **recording child-runner seam** for the local object read: it answers the
     fixed-argv `ls-tree -r --name-only <sha> -- <pathspec>` and one bounded blob
     read from the real temp repository, records each invocation (argv, byte
     count), and can answer "object absent" for the `record-unreadable` cell
     without any real child process;
   - a per-URL reply function for the **two bounded list reads**: the
     **open-request** page (open entries only, with `head.ref`/`head.sha` varied
     and a page-size knob so the saturation and zero-candidate-saturated cells are
     declared inputs) and the **closed-request** page (the merged entries, filtered
     by the declared branch convention, driven with one / two / none so the
     `0 | 1 | 2+` convergence cells are declared inputs). A `state=open` reply
     **never** contains a merged entry: the two replies mirror the two provider
     surfaces production reads, so the convergence fixture cannot fabricate a shape
     the transport cannot return (readiness iteration 3, finding 1);
     the work item, and the check-run page (with an optional `sha` field for the
     other-head cell);
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
   verification, landing, clock) and `events`; the `appendWaiverFault` /
   `appendTransactionFault` seams for the abort row's two pre-mutation causes.
3. **Expected-job set fixtures** — the repository-declared job names as the
   delivered `VerifyGatesWorkflowFacts` (`outcome: "read" | …`, `names`), injected
   per fixture so an unreadable/empty/malformed/duplicated/over-cap set is a
   declared cell, never a filesystem accident.
4. **Refusal-rendering and structural fixtures** — the enumerated matrix cells
   over family 2, plus committed source reads for the scans. The matrix's
   "act required" column is **derived per cell** from the shipped
   cause→identity mapping plus that identity's declared convergence semantics, and
   confirmed by a plain re-run on the decisive cells (pending, `provider.outage`,
   the abort row's two causes), so the row-level honesty predicate has an oracle
   independent of the rows it judges; cell 17 carries the abort row's two
   remaining causes and cell 20 the closed landing-fault identity set (four
   identities plus the `protection-rule` negative control, which must not reach an
   envelope).
5. **Declaration-mutation fixtures (proof level)** — the runtime family
   declaration supplied to the totality proof through a substitution seam, so the
   "deleted" and "bare exact-member list" mutations are value substitutions and
   never edits of committed source (TC-MRG-045).

**Test data rules.** No real credential, no real token, no live payload: the
credential material is a synthetic string and the canary secret is a distinct
literal. Titles, bodies, comments and payloads are synthetic canaries. Fixtures
are never named `*.test.ts` and never live under `tmp/`. No case writes outside
its temp root. **No fixture writes a change record into a base checkout**: the
record is committed on the change branch, and the only way a case obtains it is
the local read at the asserted head. **No fixture puts a merged entry in the
open-request reply**: merged truth comes only from the closed-request reply, as it
does in production. The one committed-state read is the source tree itself
(scans); no case asserts a diff against a moving base branch.

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
| TC-MRG-004 | `tests/behaviour/merge-production-composition.test.ts` (+ cap pin in `tests/structure/merge-contract.test.ts`) | New | same as row 1 |
| TC-MRG-005 | `tests/behaviour/merge-production-composition.test.ts` | New | same |
| TC-MRG-006 | `tests/behaviour/merge-production-composition.test.ts` | New | same |
| TC-MRG-007 | `tests/behaviour/merge-production-composition.test.ts` | New | same |
| TC-MRG-008 | `tests/behaviour/merge-production-composition.test.ts` | Existing – Update | same |
| TC-MRG-009 | `tests/behaviour/phase-completion-convergence.test.ts` (preservation oracle) over `tests/behaviour/phase-support.ts` + `tests/fixtures/phase/history.ts`; `tests/behaviour/pm-notes-lint.test.ts` + `tests/behaviour/phase-write-path-lint.test.ts` (lint half) | Existing – Update | `bun test tests/behaviour/phase-completion-convergence.test.ts tests/behaviour/pm-notes-lint.test.ts tests/behaviour/phase-write-path-lint.test.ts` |
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
| TC-MRG-042 | `tests/behaviour/merge-production-composition.test.ts` + `merge-git-seam-capabilities.test.ts` (+ constants in `tests/structure/merge-contract.test.ts`) | New | `bun test tests/behaviour/merge-production-composition.test.ts tests/behaviour/merge-git-seam-capabilities.test.ts` |
| TC-MRG-043 | `tests/behaviour/merge-production-composition.test.ts` (replay oracle retained in `merge-convergence.test.ts`) | New | same as row 1 + `bun test tests/behaviour/merge-convergence.test.ts` |
| TC-MRG-044 | `tests/behaviour/merge-production-composition.test.ts` (+ rendering unit in `merge-dry-run.test.ts`) | New | row 1 + `bun test tests/behaviour/merge-dry-run.test.ts` |
| TC-MRG-045 | `tests/structure/defect-f1-merge-refusal-containment.test.ts` + `tests/structure/content-inventory.test.ts` | New (mutation cases) | row 28 command + `bun test tests/structure/content-inventory.test.ts` |
| TC-MRG-046 | `tests/behaviour/merge-refusal-surface.test.ts` + `tests/golden/merge.test.ts` over `tests/fixtures/merge/golden/` | Existing – Update (13 committed goldens move across phases 2/3/6, 6 added; `EXPECTED` 13 → 15 → 19) | `bun test tests/behaviour/merge-refusal-surface.test.ts tests/golden/merge.test.ts` |
| TC-MRG-047 | `tests/behaviour/merge-convergence.test.ts` (assertion moves) + `tests/structure/merge-refusal-rows.test.ts` + the documented row | Existing – Update | `bun test tests/behaviour/merge-convergence.test.ts tests/structure/merge-refusal-rows.test.ts tests/structure/error-table.test.ts` |
| TC-MRG-048 | `tests/behaviour/merge-waivers.test.ts` (`TC-MERGE-018`/`TC-MERGE-019`) | Existing – No Change (executed as the waiver regression carrier) | `bun test tests/behaviour/merge-waivers.test.ts` |
| TC-MRG-049 | `tests/behaviour/merge-production-composition.test.ts` (new convergence cell; the replay oracle retained in `merge-convergence.test.ts`) | New | row 1 command + `bun test tests/behaviour/merge-convergence.test.ts` |

### 7.2 Mocking and seam requirements

- Provider I/O is the injected transport only: the composition harness's
  `githubTransport.send` and the transaction harness's
  `readWorkItem`/`readCheckRuns`/`readRequestDetail` ports. No case mocks a
  module; there is no live provider client in the process.
- The local change-record read is the **injected child runner**: the fixed-argv
  tree locate plus one blob read, recorded (argv, byte count) and answered from
  the real temp repository. `record-unreadable` is the seam answering "object
  absent", never a real failing process and never a fetch.
- The credential port is injected (`resolved`/`missing`, plus a rejected cell).
- The change record's **parse** is the delivered `parsePmNotesText`, applied to
  the text obtained from the head. The read's *acquisition* is the child-runner
  seam; `readPmNotesText` — the locate + read + parse acquisition rooted at `cwd` —
  is the delivered entry point this path does **not** use, and is exactly the shape
  TC-MRG-037 scans for. The parse is never stubbed, and no case reads the record
  from the working tree.
- The CI-workflow expected-job read is injected as `VerifyGatesWorkflowFacts`
  (`outcome`, `names`), the same shape the battery's `ci-green` consumes.
- The clock and run id are injected and fixed, so determinism and freshness are
  assertions about behaviour rather than about wall time.
- The state store is a real temp JSONL ledger; append faults are injected by
  wrapping the port (the delivered `stateStoreWrap` seam) and the waiver-append
  fault seam, never by editing records.
- The runtime emittable declaration is supplied to the totality proof through a
  substitution seam so its removal mutations are values, not source edits; the
  proof consumes the value, and no case edits a committed source file to make a
  negative control fail.

### 7.3 Meta-suite registration obligations (must move in the same delivery)

These are repository invariants that will fail if the change adds suites,
exports, rows or goldens without registering them. They are implementation
obligations, not new requirements:

- `tests/structure/merge-suite-obligations.test.ts` pins a **closed sixteen-file**
  `tests/behaviour/merge-*.test.ts` population (verified in the tree), a
  `CHANGED` list with per-suite obligation markers, and a `GREEN` list with each
  suite's pinned case-id inventory. This change moves the population's split
  **9/7 → 10/6**: `merge-production-composition` moves from `GREEN` to `CHANGED`
  with a declared obligation-marker set, and the population stays closed at
  sixteen. The bidirectional controls (a planted count, producer claim or scenario
  name failing by name; no green suite asserting the new path) stay intact.
- **The six remaining GREEN suites are still edited in this change** —
  `merge-classification`, `merge-dry-run`, `merge-freshness`, `merge-gate-set`,
  `merge-privacy`, `merge-verification-record`. They stay in `GREEN` because their
  obligation markers do not change, not because they are untouched: each keeps its
  pinned case-id inventory (`merge-classification` → `TC-MERGE-017`;
  `merge-dry-run` → `TC-MERGE-028`; `merge-freshness` → `TC-MERGE-007`;
  `merge-gate-set` → `TC-MERGE-002`, `TC-MERGE-003`, `TC-MERGE-004`;
  `merge-privacy` → `TC-MERGE-034`; `merge-verification-record` →
  `TC-MERGE-005`, `TC-MERGE-006`) while their assertions move to the resolved
  object, the two-entry projection or the rendered fields. A rewrite that drops
  one of those inventory ids fails the meta-check by name, so "GREEN" must not be
  read as "unedited" (readiness finding 19).
- `tests/checks/merge-suite-discovery.test.ts` pins the new-suite list (**5 → 6**:
  `tests/checks/merge-branch-read-scan.test.ts` is added), the offline static scan
  and the CI topology pin.
- `tests/structure/content-inventory.test.ts` and
  `tests/fixtures/ports/v1-contract-inventory.json` pin exported names per
  module: any new export (the runtime family declaration, the admitted-surface
  contract data, an added port or child-runner member, a new evidence field type)
  must be registered in the phase that adds it.
- `tests/structure/merge-contract.test.ts` pins the shipped default set's entries,
  the effective identity string, the three resolution constants and the record
  shapes; the `ci-green` surface movement is the declared one and every other
  field stays pinned.
- `tests/fixtures/merge/golden/` holds **thirteen** committed files with a
  non-regeneration discipline. Plan phases 2, 3 and 6 declare the per-file
  movement by phase: phase 2 regenerates the ten moved refusal goldens and adds
  the work-item pair (`EXPECTED` 13 → 15), phase 3 moves the success trio and the
  stale pair and adds the branch and request pairs (`EXPECTED` 15 → 19), and phase
  6 re-renders the success trio over the evaluated `gates=2/2` projection
  (`EXPECTED` stays 19), each phase running `tests/golden/merge.test.ts` in its own
  gate. The amended rendering contract moves **all thirteen** (three success files
  plus all five refusal human and all five refusal scripted files) while **six**
  are added for the three new rows, and the byte-for-byte text comparisons move
  11 → 13 (phase 2) → 17 (phase 3) (five human + five scripted refusal files, plus
  the success human rendering, become eight + eight + one), with `success-data.json`
  as the single structural comparison, `success-scripted.json` pinned by the
  directory listing, and the mutation control intact. A file regenerated outside
  its phase's declared subset fails by name. Whatever moves is listed in §10; a
  blanket rewrite fails the mutation control.
- `scripts/checks/error-table-sync.ts` (consumed by
  `tests/checks/error-table-sync.test.ts`) is the two-table authority for the
  **170 → 173** move (delivered 169 → 172, allowlist 68 → 71, `+136` → `+139`,
  `merge` kind 9 → 12); the documented table, the machine table, the pin sites and
  the phrase-table rotation move together in one commit.

### 7.4 Documentation surfaces that the identity and contract moves touch

`doc/spec/features/feature-merge-verify-deploy.md` (Overview resolution
paragraph, gate-registry defaults, verification-record head meaning, the
merged-report gate semantics, error identities, invariants),
`doc/quality/test-specs/test-spec-merge-verify-deploy.md` (the five named rows),
`doc/planning/oss-tooling/milestones/m1/commands/merge.md` (branch and
read-at-head resolution, the declaration's cap and closed reasons, gate set,
refresh and exit-status causes, refusal examples with the `command`/`ref`/
`operation` fields and the closed `operation` vocabulary),
`doc/spec/features/feature-result-contract.md` (the documented table at 173),
`doc/spec/features/feature-metrics.md` and the two other pinned-count pages (the
`+139` arithmetic and the merge row count), the change-lifecycle and
change-convention guidance that a change record declares its branch at the head
that lands, and the PM instruction surface (`.ai/agent/pm-instructions.md` and the
`@pm` prompt with its regenerated `.ados-claude` mirror).
`tests/checks/doc-conformance.test.ts` enforces the current-truth phrase table, so
the updates state the current contract rather than narrating the change, and the
superseded `+136` token is a legacy form, never a live claim.

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
| TP-R-1 | The base-checkout regression passes while the run still reports something derived from the checkout (for example a base-tip SHA in evidence) | Critical | TC-MRG-001 asserts the resolved source, the head inequality, the head-addressed record read, the check-run URL's SHA and the landing's expected head; TC-MRG-002 proves the assertion is sensitive |
| TP-R-2 | The required-check assertion is satisfied by a fixture whose page has no SHA, so "other head" is untested | High | TC-MRG-013 uses the same bytes under two SHAs; the labelled control must pass |
| TP-R-3 | The refusal matrix is asserted as one case and hides a cell that regresses | Critical | TC-MRG-023 enumerates its own 22 closed cells with per-cell named causes and a per-cell act-required value derived from the shipped mapping; TC-MRG-024 proves a missing field, an out-of-vocabulary `operation` token or an unnamed cause is flagged |
| TP-R-4 | The retryability rule passes vacuously because the act-required oracle is read from the row it judges | Critical | TC-MRG-026 derives each value from the shipped cause→identity mapping plus that identity's declared convergence semantics and confirms the decisive cells by a plain re-run (cell 17's two causes refuse again; pending and `provider.outage` converge); two row mutations and a mapping mutation must each fail by name |
| TP-R-5 | A "no ambient read" scan is written so it cannot match the pre-fix construct | High | TC-MRG-037 plants four constructs (branch read, head read, working-tree record read, fetch) and requires the matcher to find each by `file:line` |
| TP-R-6 | The identity move is applied to one table or one pin site and the surfaces drift, or a page keeps a superseded total | High | TC-MRG-038 reads both tables, all seven pin sites, both count pages and four doc surfaces; 167 is asserted as banned and `+136` as legacy; the sync and phrase-table checks gate it |
| TP-R-7 | A golden is silently regenerated, or an unchanged refusal pair is claimed while the rendering contract moved | High | TC-MRG-046 asserts all thirteen committed files move, six are added and `EXPECTED` steps 13 → 15 → 19 across phases 2/3/6, with a mutation control that fails a regeneration outside the phase's declared subset by name; §7.3 and §10 require a per-file list |
| TP-R-8 | The new suites reach the network or a real child process through a helper | Critical | TC-MRG-036 asserts the guard, the child-runner seam and a static scan; the topology pin is unchanged |
| TP-R-9 | The 16-suite meta-check or the export inventory breaks and the delivery "fixes" it by deleting the check | High | §7.3 records the registration obligation, names the six edited GREEN suites and their pinned ids; the bidirectional controls must stay |
| TP-R-10 | **A base-checkout case is satisfied by a fixture that writes the change record into the checkout** — the original readiness failure re-appearing as a green test | Critical | The fixture truth is stated in §1, §6 and the preconditions of TC-MRG-001/002/030/031/043/049: no change folder in the worktree, HEAD at the base tip, record read at the asserted head; TC-MRG-002 and TC-MRG-037 are the controls, and a worktree write is a named failure mode |
| TP-R-11 | Fixture capability (a base-checkout option, a recording child runner, a declaration substitution seam) introduces a live read, a real process or a committed-source edit | Medium | TC-MRG-036 covers the new suites; TC-MRG-031 asserts the checkout's `HEAD` and SHA are unchanged; TC-MRG-045 requires the mutation to be a value, not a file edit |
| TP-R-12 | The `command`/`ref` assertion is satisfied by the code's `merge.` prefix or by the ref appearing in unrelated prose | High | TC-MRG-023 parses the fields from their own grammar; TC-MRG-024 feeds a field-less rendering and an incidental-prose variant that must both be flagged |
| TP-R-13 | The runtime-declaration negative control is achieved by temporarily editing committed source, so it proves nothing on a clean checkout | High | TC-MRG-045 requires a substitution seam and a behaviour-preserving refactor control; a source-text matcher is scanned for and reported as a forbidden shape |
| TP-R-14 | The already-merged convergence case reports "zero record reads" over a fixture whose record happens to be readable, so the assertion is unexercised rather than decided | Critical | TC-MRG-049's fixture has **no readable record anywhere** (no worktree folder, head object absent from the object database), so a read before deciding would have refused `record-unreadable`; the zero record-read counter and the empty child-runner log are paired with the zero-merged-matches control (`no-open-request`, which also spends the closed read and reaches the request path) |
| TP-R-15 | The convergence fixture fabricates a provider shape that cannot occur — a merged entry inside the `state=open` reply — so the case passes against a lying transport while production still spends two reads | Critical | TC-MRG-043/049 drive merged truth from the **closed-request** reply only; §6 forbids a merged entry in an open reply, and the transport log asserts one request per surface (the open page and the closed read), so the fixture and the production path agree |

### 8.2 Assumptions

- The change ref identifies both the tracker work item and the change folder, and
  the folder **exists only on the change branch**; the record is therefore read at
  a candidate head and never from the invocation's working tree (spec §2.1, §12).
- The delivery workflow creates the change branch in the operator's clone (or the
  operator has fetched it), so the request head's object is normally present
  locally. The merge path adds no fetch, and an absent object is the named
  `record-unreadable` refusal (RSK-9, NG-7).
- In a healthy flow exactly one open delivery request's source ref follows the
  declared `<type>/<REF>/<slug>` convention for the change ref and declares that
  same branch. A second is refused rather than ranked, more than three refuse as
  ambiguous, and a saturated page cannot establish uniqueness — before any
  candidate count is read.
- An already-merged request for the ref replays from the bounded **closed-request**
  read (reached after the open page yields no convention-matching candidate) and
  needs no readable change record: the convergence case assumes the change folder
  lives only on the change branch (as above), which is why the fixture that proves
  it must not carry the record at all.
- The repository declares its CI jobs in the workflow file the delivered
  expected-job read targets; a repository without one fails the CI gate
  explicitly with the surface opt-out as the remedy.
- The `branch` declaration is authored when the change is opened; this plan does
  not assume a writer (OQ-1 / NG-5).
- The delivered credential precedent (`github-read` + `GITHUB_TOKEN`) is the shape
  reused; no new secret-bearing field exists, so the canary scan can assert "names
  present, value absent".
- The effective gate-set identity (schema version + entry-id sequence) is unchanged
  by the surface movement, so in-flight verification records remain consumable and
  TC-MRG-038's identity string is a stable oracle.
- The merged report's projection is the merge-applicable one (spec DEC-12), so the
  success rendering is `gates=2/2` while the verification record keeps its
  battery list; the two are different objects by design.
- Fixtures run with a fixed clock and an injected run id; no case depends on real
  time.
- The implementation plan's seven phases are the allocation base (§5.1); a plan
  revision that adds scope requires re-deriving this coverage map rather than
  stretching it.

### 8.3 Open Questions

| ID | Question | Context | Blocking? | Owner | Status |
|----|----------|---------|-----------|-------|--------|
| OQ-TP-1 | Which part of F-4 is still to be delivered, given the tree already exports a family expression and the containment suite passes? | Closed by spec v2.0 F-4, AC-F4-1 and AC-F4-2: the deliverable is a **runtime** declaration beside the exact-member list whose removal fails the proof by name; TC-MRG-028/029/045 assert exactly that, and a delivery that re-implements the classifier's resolution is out of scope. | No | `@plan-writer` / `@readiness-reviewer` | **Closed** (spec v2.0 §5.1 F-4, §17.4) |
| OQ-TP-2 | Which merge goldens move, and which stay byte-identical? | Closed by the plan's per-file movement table — distributed across phases 2, 3 and 6 — plus the amended rendering contract: all thirteen committed files move at least once (three success, five refusal human, five refusal scripted) and six are added, `EXPECTED` moving 13 → 15 in phase 2, 15 → 19 in phase 3 and staying 19 in phase 6; no committed refusal pair stays byte-identical. TC-MRG-046, owned by phase 6, asserts the complete contract closure, the movement and the mutation control. The earlier 7-moved/6-identical split is superseded (spec §8.5, DEC-11). | No | `@plan-writer` | **Closed** (plan movement table, phases 2/3/6; DEC-11) |
| OQ-TP-3 | Should the scenario-to-phase allocation be re-stated once the plan exists? | Closed: the plan exists with seven phases and a TC allocation index, and every scenario carries a `Plan Phase(s)` line; §5.1 states the whole allocation (49 cases, 8 / 16 / 16 / 3 / 5 / 1), with the eight cases added after v1.0 placed by their last dependency. | No | `@pm` / `@plan-writer` | **Closed** (plan v1, §5.1) |
| OQ-TP-4 | Where must the "failed read operation" be carried: an evidence member, the summary, or both? | Closed: spec F-3/API-3/AC-F3-1 **declare** the field — `operation=<token>` is a dedicated rendering field with a closed vocabulary (the six provider source names, the two local tokens `local-change-record-read` and `local-git-object-read`, and `-` when the refusal names no operation), validated at the rendering site. Spec v2.2 closes the vocabulary edges: `-` only where no operation is named, a read/transport fault names the **attempted** operation, a landing fault names the **failing** landing operation, a local change-record read names its own source, a non-provider state read renders `-`, and an out-of-vocabulary token is rejected rather than passed through. TC-MRG-014/020/022/023/042/047 assert the parsed field and its edges; TC-MRG-024 is the negative control. | No | `@plan-writer` | **Closed** (spec v2.2 F-3, API-3, AC-F2-5, AC-F3-1) |
| OQ-TP-5 | After narrowing, does `merge.transaction-aborted` keep `retryable: true` or move to `false`? | Closed by spec v2.1: the row declares **`retryable: false`** with a no-convergence remediation and reaches exactly two pre-mutation causes (a waiver-append failure and a declared landing gap); a refused landing reports `provider.outage` / `provider.auth.rejected` / `merge.landing-unverified`, and the delivered convergence suite's `toBe(true)` moves with it. TC-MRG-026/047 derive the two-cause set and assert the pinned shape. | No | `@plan-writer` | **Closed** (spec v2.1 AC-F3-3, AC-F3-6, §8.5) |
| OQ-TP-6 | Should the merge path fetch a request head object the local object database does not hold, instead of refusing `record-unreadable`? | Spec §7.3/OQ-4 defers the fetch policy (it needs its own credential, timeout and failure surface). **No case in this plan depends on that policy**: TC-MRG-042's `record-unreadable` cell asserts the pinned refusal and the absence of any fetch (NG-7), so a future policy change would add a case rather than invalidate one. | No | `@decision-advisor` (TDR-0071 revisit) | Open (non-blocking; no case depends) |
| OQ-TP-7 | Is there an invocation that reaches a refusal with no usable ref, so a `ref=-` fallback needs a carrier? | **Closed by spec v2.1, which removes the clause rather than the carrier**: every merge refusal path is reached with a usable ref, so the `ref` field always carries the invocation's ref and there is no empty-value branch to assert. TC-MRG-046 asserts the field's value across the five delivered refusal shapes and TC-MRG-023 across every matrix cell; the former GAP-TP-4 is closed. | No | `@spec-writer` / `@pm` | **Closed** (spec v2.1 F-3, API-3, AC-F3-1) |

**No acceptance criterion is TODO.** All 25 are mapped in §3.1. The one open
question above concerns a deferred fetch policy that no case depends on; it leaves
no criterion uncovered and is not silently dropped.

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-20 | test-plan-writer | Initial test plan for GH-366 (spec v1.1). 41 scenarios (`TC-MRG-001`…`TC-MRG-041`), 22/22 acceptance criteria mapped, 10/10 NFRs mapped, 7 interface elements mapped. Derived from the spec only; the implementation plan was absent (OQ-TP-3). Records the existing suite each scenario lands in or next to, and the meta-suite registration obligations the change must satisfy. |
| 1.1 | 2026-11-20 | test-plan-writer | DoR-remediated revision against **spec v2.0** (24 ACs). (1) Framing: `links.implementation_plan` now points at `chg-GH-366-plan.yaml`; spec referenced as v2.0; the "gate refusal renders as the containment identity" claim and every "not yet authored" sentence removed; base facts restated on `origin/main-tools` @ `e1ebc76c`. (2) Fixture truth: every base-checkout case now requires a worktree with **no change folder** and `HEAD` at the base tip, with the record read at the asserted head through the local tree/blob seam; writing the record into the checkout is named as a failure mode (§1, §6, TC-MRG-001/002/030/031/043, TP-R-10). (3) Coverage: 24/24 ACs — `AC-F2-8` and `AC-F4-2` added; `AC-F1-1`, `AC-F1-2`, `AC-F1-3`, `AC-F1-4`, `AC-F3-1`, `AC-F3-6`, `AC-F4-1`, `AC-F5-1`, `AC-F5-2` restated to the v2.0 wording; owner trace updated and the waiver item re-pointed off `AC-F2-7`. (4) Cases: 41 → **48**; seven added — `TC-MRG-042` (six closed branch reasons, precedence, cap, candidate bounds, `record-unreadable` with no fetch), `TC-MRG-043` (convergence before the record read), `TC-MRG-044` (`gates=2/2` merged projection), `TC-MRG-045` (runtime-declaration negative control), `TC-MRG-046` (`command`/`ref` fields and the full refusal-golden movement), `TC-MRG-047` (abort row `retryable: false` and the moved convergence assertion), `TC-MRG-048` (retained explicit `--waive` path). Re-pointed: 001, 002, 003, 004, 005, 006, 007, 008, 009, 010, 011, 012, 013, 014, 019, 020, 021, 022, 023, 024, 025, 026, 028, 029, 030, 031, 033, 034, 035, 036, 037, 038, 039, 040. (5) Readiness findings 3/8/14/16/17 answered: the totality proof ranges over a runtime value; the rendering contract is uniform and all ten refusal goldens move; the matrix's act-required column is declared data (cell 17 carries the three residual causes) so overstatement is detectable independently; the waiver trace names a case that asserts a successful explicit authorization. (6) NFR rows restated to the one-provider-read budget, the no-ambient-read quartet, the 170 → 173 arithmetic with 167 banned, and the runtime-declaration totality. (7) OQ-TP-1…OQ-TP-5 closed with pointers; OQ-TP-6 (deferred fetch policy; no case depends) and OQ-TP-7 (`ref=-` carrier) added. (8) §10 remains empty: no execution yet. |

| 1.2 | 2026-11-20 | test-plan-writer | Answers readiness iteration 2 against **spec v2.1** (25 ACs). (1) Coverage 25/25: `AC-F1-6` (already-merged convergence) added with **`TC-MRG-049`** as its dedicated carrier in plan phase 3, `TC-MRG-043` re-pointed to it as its primary criterion (`AC-F1-3` kept as secondary), the former GAP-TP-3 closed; §1.1/§2/§3.1/§3.2/§3.3 and the owner trace restated. (2) `operation=<token>`: spec v2.1 declares it as a third dedicated rendering field with the closed vocabulary validated at the rendering site; TC-MRG-014/020/022 and the TC-MRG-024 control now assert that declared field and its vocabulary membership (`-` where the refusal names no operation, an out-of-vocabulary token flagged), and OQ-TP-4 cites F-3/API-3/AC-F2-5/AC-F3-1. (3) Abort row: cell 17 narrowed to its **two** pre-mutation causes (waiver-append failure, declared landing gap) and cell 20 expanded to the landing-fault identities (`provider.outage` converging on a plain re-run, `provider.auth.rejected`, `merge.landing-unverified`); the act-required column is now **derived per cell** from the shipped cause→identity mapping plus that identity's declared convergence semantics and confirmed by a plain re-run, so TC-MRG-026/047 no longer assert `true` by fiat and gain a mapping mutation control. (4) Saturation precedence: TC-MRG-006 cell (iv) adds a saturated page with zero convention-matching entries refusing `ambiguous-open-request`, with a desaturated control that flips to `no-open-request`; TC-MRG-005 gains the unsaturated counterpart. (5) `ref=-` removed: spec v2.1 drops the empty-value branch, so GAP-TP-4 and OQ-TP-7 are closed and TC-MRG-020 asserts the invocation ref only. (6) TC-MRG-009 re-pointed to `phase-completion-convergence.test.ts` + `phase-support.ts` + `fixtures/phase/history.ts`, asserting value-faithful preservation **after a real `phase complete` on every document-writing branch**, with the lint half (`pm-notes-lint`, `phase-write-path-lint`) as its first step; §7.1 row updated. (7) The 22-cell matrix is declared this plan's own closed enumeration with its arithmetic stated (1 + 3 + 1 + 6 + 2 + 3 + 1 + 1 + 4 = 22), replacing the "derived from Appendix B" claim; the cell count is unchanged. (8) §2/§7.2 cite `parsePmNotesText` as the reused parse and `readPmNotesText` only as the acquisition **not** used on this path. (9) Cases 48 → **49** (`TC-MRG-001`…`TC-MRG-049`), allocation 8 / 16 / 16 / 3 / 5 / 1 = 49, disjoint; identity arithmetic (170 → 173 / 169 → 172 / 68 → 71 / `+136` → `+139`, kind 9 → 12) and the golden movement (13 moved, 6 added, `EXPECTED` 13 → 19) unchanged. (10) §10 remains empty: no execution yet. |

| 1.3 | 2026-11-20 | test-plan-writer | Wording alignment to the revised plan's **per-phase** golden movement; coverage, allocation, ids and the refusal matrix unchanged. `TC-MRG-046` (§5.2 preconditions, steps, expected outcome and notes) now states that the `command`/`ref`/`operation` fields are authored in **phase 2**, that the golden set moves in the phase that changes the bytes (`EXPECTED` 13 → 15 in phase 2, 15 → 19 in phase 3, unchanged at 19 in phase 6), and that **phase 6**, which owns the case, asserts the complete contract closure — the whole set, the mutation control and the 19-file arithmetic. A regeneration outside a phase's declared subset must fail by name, and each affected phase runs `tests/golden/merge.test.ts` in its own gate. The superseded single-phase phrasing, which tied the golden movement to the rendering change's own commit, is removed together with the equivalent claims in §2, the §4 layer row, §7.1, §7.3, TP-R-7 and OQ-TP-2. Still **49** cases, 25/25 ACs and the 8 / 16 / 16 / 3 / 5 / 1 allocation. |

## 10. Test Execution Log

_Populated during delivery and the quality gates. No case has been executed at
authoring time._

| TC ID | Run Date | Result | Command / Evidence | Notes |
|-------|----------|--------|--------------------|-------|
