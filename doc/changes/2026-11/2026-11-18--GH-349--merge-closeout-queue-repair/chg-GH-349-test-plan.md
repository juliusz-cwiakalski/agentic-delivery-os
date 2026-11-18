---
id: chg-GH-349-test-plan
status: Updated
created: 2026-11-18T20:30:00Z
last_updated: 2026-11-18T21:35:00Z
owners: ["engineering"]
service: "delivery-os merge primitive, closeout transaction, phase truth surface, and scheduling queue"
labels: ["merge", "closeout", "phase", "queue", "m4-s11"]
version_impact: minor
summary: "Prove that every recorded outcome is bound to a mechanism that can observe its own effect and that every refusal has one honest identity: one guarded provider-side landing call per invocation at the exact verified head with the provider-asserted request title byte-for-byte (or, only when that signal is absent, the declared deterministic fallback `merge(<ref>): squash <sourceRef>` built from the change ref and the request source ref) and one fixed verbatim message trailer `Landed by the delivery lifecycle merge primitive.` with no interpolated value, provider-asserted merged truth as the only landing verdict, a declared landing gap refused as `merge.transaction-aborted` at exit 1 with the operation and its gap reason in evidence and no third identity, and zero composed callers of the retained local landing/refresh proven by a scan with a mandatory failing control; a total four-state plus absence refusal taxonomy in which dirty, behind-through-one-bounded-post-refusal-re-read, the declared undecisive boundary and undecided-after-one-exact-head-re-read each resolve to exactly one declared row with its declared kind and exit, with the closed `merge.sync-required` reason triple `dirty` | `behind` | `behind-unconfirmed` (the undecisive branch carrying the caveated sync remediation and never a clean pre-mutation abort), `fallback.internal` unreachable for a declared refusal, and a live mismatch control that still contains; queued and running pinned as not-green on both sides of the check boundary, the probe extended to not-green declared jobs, every not-green refusal carrying exactly one attribution value from the closed pair `recorded` | `probe` (with the recorded arm naming gate id, job and verdict) and the byte-pinned required-job refusal goldens moving deliberately, while undeclared jobs and other-head pages produce neither a refusal nor an attribution; `closeout --apply` gaining `milestone-sync` at position 12 of 13 over one new `close-milestone` operation whose vocabulary structurally cannot express create/attach/detach/rename/reopen and one bounded adapter-local attached-set read, gated by an exit review that withholds on open items, unavailable signals, unknown state and truncation, with plan mode limited to the four outcomes a declared milestone fact can produce and GH-349's own M4 outcome asserted as withheld rather than closed; one phase truth source in which every document-writing branch derives `completed` from the post-transition fold, `started` is never rewritten, and one read-only `lint.phases.divergent` row reports the first ledger-backed divergence with zero writes, zero fences, zero appends, zero tracker reads and zero clock reads; seven queue integrity properties each proven through the production composition with an injected-breach control, the automatic `landed` removal unchanged across the step insertion, and the delivered verbs/kinds/keys/flags and bounds proven identical by exact-set equality; and three defect-named suites (F1 classification totality, F4 stale-completion/divergence, F8 serial-merge churn) whose paired controls reproduce the pre-fix derivation and must fail by name — every one of the 46 acceptance criteria mapped to a named case through the delivered field or observable that carries it, 81 cases, 92 mutation controls, no orphan and no unmapped criterion."
links:
  change_spec: ./chg-GH-349-spec.md
  implementation_plan: ./chg-GH-349-plan.yaml
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - M4-S11: Merge, closeout, and queue repair on the primitives (M4)

## 1. Scope and Objectives

This change does not add a feature surface; it *re-points four recorded outcomes onto mechanisms that can observe their own effect* and then proves the re-pointing with defect-named evidence. The verification risk is therefore not "a module is missing". It is that the change produces a **declaration that restates itself**: a landing "verified" by a literal the transaction wrote, a crafted-message assertion that compares a composer with itself instead of the declared bytes, a not-green finding whose evidence cannot say whether the record or the probe produced it, a refusal taxonomy proven over a hand-picked list that omits the family it emits, a milestone step whose "synced" verdict is a step outcome nobody compared with a provider fact, a mirror "equal to the fold" because the test folded the document, a queue property "proven" by a suite that never injects the breach, and three defect suites named after defects that cannot fail on the pre-fix behaviour.

Every case below is an oracle over observables reached through the production composition or a declared seam: the recording provider transport's request log, the injected port call counters, the git seam's event log, an exact set built from a production constant, a step outcome plus its residue item, a lint failure's code and bounded detail, an append sequence number, an exit class resolved from the declared row, and a committed golden. **Absence claims carry a positive control in the same case** (a zero landing call is paired with a run that lands once; "no divergence finding" is paired with a fixture that must produce one; "no composition site" is paired with a planted site that must be found). **Every scan, every pin and every byte-pinned golden carries a mutation that must fail by name** (§7.5, 92 controls). No case asserts only that a declaration equals itself, and every acceptance criterion is mapped in §3.1 through the *delivered field or observable that carries the assertion* — the dimension that has a carrier, named explicitly, because this repository's history contains ACs that failed while a plausible-looking assertion passed over a dimension nothing delivered.

Three constraints shape the whole plan.

1. `.ai/rules/testing-strategy.md` forbids permanent suites from asserting a diff against a moving base ref. Every "nothing else moved" claim is therefore a tree invariant (exact-set equality against a production constant, a committed golden, a pinned inventory) or a **recorded gate result** in §10. Where the only evidence is a diff, it is named as review-verified rather than dressed up as a suite (§3.4).
2. Capability honesty and offline determinism are binding: no case calls a provider, opens a network location, or spawns a process beyond the git seam the delivered local-repository tests already declare. Provider shapes are committed synthetic fixtures; the milestone read and close write ride the existing injected transport and credential port.
3. The three defect suites must be able to fail. Each carries a **paired pre-fix control** that reproduces the old derivation minimally and asserts the *differing* value, so a suite cannot go green because its assertion was quietly weakened or its control copied the new behaviour.

This document is a verification map, not an execution claim. No case has been run at authoring time. §10 is populated during delivery and the quality gates.

### 1.1 In Scope

- **F-1 Provider-side landing (9 ACs).** Exactly one guarded landing call per invocation at the verified head with the crafted title byte-for-byte (the provider-asserted title, or the declared fallback `merge(<ref>): squash <sourceRef>` built from the change ref and the request's source ref) and the one fixed verbatim message trailer `Landed by the delivery lifecycle merge primitive.` with no interpolation; provider-asserted read-back as the only `merged` verdict; the provider's merge commit as the recorded landing identity; the exact-head guard; the declared gap refused as `merge.transaction-aborted` at exit 1 with the operation and its gap reason in evidence and no third identity; replay without a second landing; and the retirement scan over the retained local landing/refresh.
- **F-2 Mergeability refusal taxonomy (6 ACs).** One total decision rule over `mergeable`, `conflicting`, `not-mergeable`, `unknown`/absent and "landing fired, truth not observed"; one bounded post-refusal re-read; one exact-head recovery re-read; two additive rows with their declared kind and exit; the closed `merge.sync-required` reason triple `dirty` | `behind` | `behind-unconfirmed`, where the undecisive branch is that identity with the caveated sync remediation and never a clean pre-mutation abort; the removal of the internal rebase and the structural absence of force/bypass/auto-merge/queue/retry.
- **F-3 Required-check awareness (4 ACs).** `queued`/`running` pinned as not-green in the declared gate evaluation and in the probe, with `canceled`, `skipped` and `failed` keeping their delivered reasons; every not-green refusal carrying exactly one attribution from the closed pair `recorded` | `probe` (the recorded arm naming gate id, job and verdict), with undeclared jobs and other-head pages producing neither a refusal nor an attribution; provider-required refusals classified and never retried or bypassed.
- **F-4 Milestone synchronization (9 ACs).** `milestone-sync` at step 12 of 13; the declaration/attachment check; the exit-review predicate over one bounded read capped at 200 attached items; the closed outcome table, whose plan column is exactly `would-apply` | `satisfied` | `skipped-noop` | `skipped-gap` (a mismatch or a withheld closure is `skipped-noop` plus residue); the single `close-milestone` operation and its three capability postures; the withheld outcome and its one residue kind; the gating write failure; plan-mode zero writes and two-apply idempotency; GH-349's own withheld closure.
- **F-5 One phase truth source (7 ACs).** The fold-derived mirror on every document-writing branch, `started` immutability, reopen writing null, the no-op evidence reporting the fold value, and one read-only `lint.phases.divergent` row with its stated exclusions and its determinism.
- **F-6 Queue integrity (6 ACs).** Seven property proofs with injected-breach controls over the production composition, the automatic `landed` removal's unchanged contract across the step insertion, park-release ordering, unchanged bounds and reasons, and zero surface widening.
- **F-7 Named-defect regressions (5 ACs).** Three defect-named suites with pre-fix controls, the assertion-presence meta-check, and the offline/topology assertion.
- **Additive-surface synchronization (DM/API).** The pins and parity surfaces that must move with the change: identity total, step inventory in two places, residue kinds in three places, the tenth operation and its thirty parity cells, the additive normalized field, the additive refusal-evidence attribution field, the additive lint read field, the milestone observation shape, and the byte-pinned refusal goldens the attribution moves.
- **Regression floor.** Delivered suites stay green and unweakened; the no-adapter-change obligation; the offline guards; testkit runtime neutrality; the pinned CI topology; the gate battery and the corpus measurement.

### 1.2 Out of Scope & Known Gaps

- [OUT] **Completing or changing an adapter's behaviour** beyond the milestone operation and its declared gaps (spec §7.2, Appendix C-14). `TC-FLOOR-003` fails an adapter delta; no case drives adapter completion.
- [OUT] **A merge queue, force, bypass, auto-merge, rebase-merge, or landing retry** (NG-2/NG-3). No case drives them; `TC-F2-008` and `TC-SYNC-008` prove they are unrepresentable rather than rejected.
- [OUT] **Milestone create, attach, detach, rename, reopen, entry review, or a `milestone` command family** (NG-4). No case drives them; `TC-F4-009` proves the vocabulary cannot express them.
- [OUT] **A `phase repair`, a lint fix mode, a new phase state kind, or a change to `verify change`'s verdict** (NG-5). `TC-F5-007` asserts their absence; no case exercises a repair.
- [OUT] **New queue verbs, record kinds, state keys, flags, or a second lease/removal mechanism** (NG-6). `TC-F6-011` pins the surface; no case drives a new one.
- [OUT] **New CI workflow files, jobs, triggers, permissions, uploads or artifact fields** (NG-8). `TC-FLOOR-006` pins the topology; the suites ride the existing `pnpm test` path.
- [OUT] **New network locations, credentials, transports, or secret-read allowlist entries** (NG-8). `TC-FLOOR-004` and `TC-F4-015` assert the exact delivered set.
- [OUT] **Memory, promotion, capsule routing, retro behavior** beyond the step insertion and the one residue kind (NG-9). `TC-F6-008` asserts the capsule close is unchanged; no case exercises promotion.
- [OUT] **Fetching inside `merge` and repairing closeout's merged-diff anchor** (NG-11, Appendix G-2). `TC-F1-001` asserts zero fetch; `TC-F4-002` asserts the delivered `skipped-gap`/`merged-diff-unavailable` degradation rather than a repaired anchor.
- **GAP-TP-1 — GH-349's own milestone closure is asserted as withheld, never as closed.** AC-F4-7 is a *negative* acceptance criterion: M4 carries other open attached tickets, so the verified outcome for this change is the attachment check plus a recorded exit-review verdict. `TC-F4-012` asserts the withheld outcome offline against a synthetic M4 attached set and explicitly forbids asserting a closed record; the live closeout run is recorded in §10 as a gate result, and a reader who expects "GH-349 closes M4" fails the case by name. The delivery's real closeout therefore has a *different* evidence class from a suite, and the plan says so rather than faking one.
- **GAP-TP-2 — "zero composed callers of the local landing/refresh" is a source-scan invariant, not a behavioural one.** Nothing observable at runtime distinguishes "unreachable" from "reachable but untaken" in one run, so `TC-F1-009` expresses the claim as a scan over the production composition roots plus `MERGE_GIT_OPERATIONS` membership plus the seam's declared-and-tested status, with a planted-caller mutation. It does not attempt a diff-against-base assertion (forbidden by `.ai/rules/testing-strategy.md`).
- **GAP-TP-3 — the corpus divergence sweep needs the delivery environment's registry.** The verified ledger lives in the project/host state root, not in the checkout, so a CI job without that state would compare zero ledger-backed phases and go green vacuously. `TC-F5-008` therefore requires a **non-vacuity precondition** (the run reports how many ledger-backed phases it compared; zero compared is an ERROR, never a pass) and is recorded as a gate result in §10. It is deliberately not a permanent suite that can silently degrade to "nothing to compare".
- **GAP-TP-4 — the pre-fix controls are discriminating derivations, not executions of the old binary.** `TC-F7-002` (F1) recomputes the pre-fix seventeen-member declaration; `TC-F7-003` (F4) recomputes the history-lookup completion; `TC-F7-004` (F8) injects the refresh the removed branch performed through the harness's git fake. Each is executable in-process, names the differing value it must produce, and is asserted to differ from the production value — so a control cannot be "implemented" by copying the fixed code. This is stated as a gap because a reader could reasonably expect the old code to be re-run; spawning a second test process to do so is forbidden by NFR-2.
- **GAP-TP-5 — fixture-decided provider shapes.** GitHub's milestone write/read surface and read-back shape (spec OQ-3) are fixture-decided. Cases pin the *shape* (identity, title, state, attached items, truncation marker, cap) and the *semantics* (four distinct facts never collapsing); the concrete JSON lives in one fixture per fact, and a shape change updates that fixture without touching an assertion.
- **GAP-TP-6 — no case can assert that `verify change`'s verdict is unchanged by inspecting a new code path**, because no code path is added. `TC-F5-005` asserts the delivered verdict, precedence and read-only contract through the delivered suite plus a paired fixture where a mirror mismatch exists and `verify change` still finalizes — the strongest available oracle for a "nothing changed here" claim.
- **GAP-TP-7 — two byte-pinned expectations are written in the cases, not read from production.** The trailer literal and the fallback form are asserted against strings the test states itself (the spec's bytes and a string composed from the fixture's ref and `sourceRef`). A case that imported the production composer and compared it with itself would be a declaration restating itself, so the production composer is exercised only through the landing port's captured input. `TC-F1-006`/`TC-F1-007` fail if the bytes drift by one character, including a missing or extra `squash ` token.
- **GAP-TP-8 — the golden move is deliberate and is not evidence of anything else.** `tests/fixtures/merge/golden/refusal-gate-human.txt` and `refusal-gate-scripted.json` are regenerated by an explicit command because the attribution line joins the summary; the other four refusal pairs and the success trio must stay byte-identical. `TC-FLOOR-005` asserts both halves and names the file, so a blanket regeneration that also rewrites an unrelated golden fails.

## 2. References

| Reference | Role in this plan |
|---|---|
| [`chg-GH-349-spec.md`](./chg-GH-349-spec.md) **v1.2** | Binding source: F-1..F-7, **46 ACs** (`AC-F1-1..9`, `AC-F2-1..6`, `AC-F3-1..4`, `AC-F4-1..9`, `AC-F5-1..7`, `AC-F6-1..6`, `AC-F7-1..5`), API-1..API-7, DM-1..DM-9, NFR-1..NFR-13, §24.3 non-widening invariants, §24.4 additive inventory, §24.5 conformance/parity ripple, §24.6 defect register, §24.7 declared boundaries. Section references in this plan are to that file. **v1.1 resolves D1–D6** (the `merge(<ref>): squash <sourceRef>` fallback, the closed `merge.sync-required` reason triple, the `merge.transaction-aborted` gap identity at exit 1, the `recorded` | `probe` attribution pair and its golden move, the four-outcome milestone plan list, and the verbatim `Landed by the delivery lifecycle merge primitive.` trailer); **v1.2 resolves D7** (the `recorded` arm identifies its source record by gate id, job and verdict, and the verification timestamp stays on the persisted `merge.gate-verification` record rather than entering the refusal evidence, so DM-2 still declares exactly one additive evidence field). §11 records all seven resolutions and the one finding that remains open (D8, the ADR-0012 drift). |
| [`chg-GH-349-pm-notes.yaml`](./chg-GH-349-pm-notes.yaml) | Delivery mode (autonomous), milestone, the seven recorded positions (scope source, phase truth, landing mechanism, milestone sync, queue integrity, defect regressions, the three decision records), the five item gap analysis, the doc-impact risks, the `TMPDIR=$PWD/tmp/tmpdir` convention, and the decision-advisor challenge that the two merge mechanisms were never equivalent. |
| [`chg-GH-349-plan.yaml`](./chg-GH-349-plan.yaml) — **authored in phase 4 (`delivery_planning`)** | The delivery projection this plan expects. §7.6 is the binding input the plan must carry: case→phase ownership, the two-place pins, the decision-record staging, the Appendix E ripple, and the conditional queue repair. This plan does not assume a plan exists and does not invent its phase names; §7.6 states the outcomes each phase must own. |
| [ADR-0012](../../../decisions/ADR-0012-provider-side-merge-landing-path.md) (DEC-1, DEC-2, DEC-3) | The one landing path and its port shape (`{deliveryRequest, strategy:"squash", commitTitle, commitMessage, expectedHeadSha}` → `{merged:true, mergeCommitSha?}`), the additive `DeliveryRequest.title`, the provider-truth verdict and recorded-identity provenance, the four-state refusal table, the retained reserved `merge.rebase-conflict`, and §7's queued-is-not-green pin with the five delivered reasons. Authority for every F-1/F-2/F-3 assertion **except** the two strings spec v1.1 re-states: this record's §2 still gives the superseded fallback (`merge(<ref>): <sourceRef>`) and an interpolated trailer (`Change: <ref>` / `Delivery-Request: <system>#<id>`), which AC-F1-6 now binds otherwise (see D8 in §11). Where the two disagree, the plan asserts the spec's bytes and records the drift; no case is authored against the stale text. |
| [TDR-0040](../../../decisions/TDR-0040-phase-truth-registry-fold-mirror.md) (DEC-5) | Truth (§1), the fold-written mirror applied uniformly to `both`, `record-atomic-without-commit`, `record-record-only` and the landing branches (§2), the no-op evidence (§3), the read-only scoped comparison after both conformance checks pass with its exit and remediation (§4), the document-only exclusion (§5), the unchanged `verify change` (§6), and the F4 regression shape (§7). |
| [ODR-0005](../../../decisions/ODR-0005-closeout-milestone-synchronization.md) (DEC-4) | Step position 12 of 13 (§1), attachment verification (§2), the exit review with `CLOSEOUT_MAX_ATTACHED_ITEMS = 200` (§3), the `close-milestone` vocabulary and its three postures (§4), the closed outcome/residue table (§5), idempotency and dry-run with the operation identity (§6), and the scope boundaries (§7). |
| [`.ai/rules/testing-strategy.md`](../../../../.ai/rules/testing-strategy.md) | Layer model, module-to-test mapping (`packages/**` → `bun test tests/structure tests/behaviour`; testkit conformance → `tests/structure/conformance-coverage.test.ts` and `bun test tests/conformance`; `scripts/checks/*.ts` → the check plus its `tests/checks/**` mutation test), invariant-test authoring (**no moving-base diffs**, assert meaning not a growing count), fixture naming, and the aggregate gate. |
| [`.ai/rules/typescript.md`](../../../../.ai/rules/typescript.md) | Strict types, `exactOptionalPropertyTypes` (absence, not `undefined`), injected ports over `mock.module`, `spyOn` + restore, deterministic fixtures, golden discipline, and "test real behavior through ports with fakes; do not re-implement the logic under test". |
| **[`feature-merge-verify-deploy.md`](../../../spec/features/feature-merge-verify-deploy.md)** | Delivered current truth this change re-points: the verified transaction, the freshness envelope, the probe, the gate set, the local squash landing, the seven concrete `merge` rows, and the statement that the two mechanisms coexist deliberately. |
| **[`feature-closeout.md`](../../../spec/features/feature-closeout.md)** | The twelve-step inventory, the operation ledger and identity derivation, the outcome vocabularies, the eight residue kinds, the single-writer fence, and the automatic queue-removal hook. |
| **[`feature-pm-notes-lint-and-phase-transitions.md`](../../../spec/features/feature-pm-notes-lint-and-phase-transitions.md)** | The ledger-as-truth declaration, the five lint rows and their order, the registry read shape, the phase-state projection, and the mirror rule this change repairs. |
| **[`feature-scheduling-engine.md`](../../../spec/features/feature-scheduling-engine.md)** | The append-only queue graph, leases, parks, reason-bearing removal, reconcile bound, single-flight admission, and presence by append position. |
| **[`feature-adapter-conformance.md`](../../../spec/features/feature-adapter-conformance.md)** and **[`feature-adapter-ports.md`](../../../spec/features/feature-adapter-ports.md)** | The nine closed operations and the tenth appended one, the flow registry, both coverage gates, the parity matrix and register, the mock tenant routes and projections, and the capability/gap vocabulary. |
| **Delivered suites consumed as anchors** | `tests/behaviour/{merge-landing,merge-refusal-surface,merge-probe,merge-convergence,merge-rebase,merge-freshness,merge-bounds,merge-determinism,merge-privacy,merge-production-composition,phase-completion-convergence,phase-transitions,pm-notes-lint,closeout-*,queue-*}.test.ts`; `tests/structure/{merge-classification-conformance,merge-contract,closeout-contract,closeout-additive,error-table,queue-removal-contract,queue-scheduling-contract,ci-topology-pin,conformance-coverage,content-inventory,reference-behavior}.test.ts`; `tests/checks/{error-table-sync,capsule-bounds,closeout-mutants}.test.ts`; `tests/conformance/{parity-gate,control-registration,family-classification,mock-conformance}.test.ts`; fixtures `tests/fixtures/merge/**`, `tests/fixtures/closeout/**`, `tests/fixtures/pins/**`. |

## 3. Coverage Overview

Evidence classes: **Suite** (a committed assertion in `pnpm check`), **Suite + control** (its discrimination is proven by a named mutation or pre-fix control in §7.5), **Golden** (a committed fixture compared exactly), **Gate** (an execution record in §10), **Review-verified** (a content/diff inspection recorded in §10).

### 3.1 Functional Coverage (F-#, AC-#)

The **Carrier** column names the delivered field or observable that carries each assertion. A row whose carrier would be "the declaration itself" is not acceptable and does not appear here.

| AC ID | Criterion (abridged) | Carrier — the delivered field or observable | TC ID(s) | Evidence |
|---|---|---|---|---|
| AC-F1-1 | One landing call through the closed operation carrying squash, H, crafted title, composed message; no platform CLI; no local squash; no push; no second mechanism | The recording landing port's call log (`strategy`, `expectedHeadSha`, `commitTitle`, `commitMessage`, call count) + the git seam event log (no `git-squash-land`, no push) + the production-source scan (composition sites, `gh pr merge` literal) | TC-F1-001 | Suite + control |
| AC-F1-2 | Provider-asserted merged read-back → `result=merged` with that identity recorded, record shape unchanged | `MergeReport.result`/`squash`, `MergeTransactionRecord.squashSha` + `landing.requestState`, and the record's exact key set | TC-F1-002 | Suite + control |
| AC-F1-3 | Local containment true and provider not merged → `merge.landing-unverified`, exit 2, consequence `unknown`, never `merged` | Failure `code`, row `consequence`, `exit`, and the absence of a `result=merged` payload — with a paired fixture where the provider *is* merged | TC-F1-003 | Suite + control |
| AC-F1-4 | Read-back merged with no merge commit → identity unknown, never derived; re-run re-verifies without re-landing | `MergeTransactionRecord.squashSha` absent + the report's rendered identity line + the landing port call count on the second run | TC-F1-004 | Suite + control |
| AC-F1-5 | Head moved between verification and landing → `merge.gates-stale`, exit 1, recorded and current head, zero landing calls | Failure `code`/`exit`, `evidence.recordedSha`/`evidence.currentSha`, and the landing call count 0 | TC-F1-005 | Suite + control |
| AC-F1-6 | Title is the provider-asserted title byte-for-byte, else `merge(<ref>): squash <sourceRef>`; message is exactly `Landed by the delivery lifecycle merge primitive.` with no interpolation; no flag/input/body/prose | Landing input `commitTitle` (byte-equal to `DeliveryRequest.title`, or the fallback string the **case** composes from the change ref and `sourceRef`) and `commitMessage` (byte-equal to the literal the **case** states), plus the command's declared flag set | TC-F1-001, TC-F1-006, TC-F1-007, TC-SYNC-004 | Suite + control |
| AC-F1-7 | A declared landing gap refuses as `merge.transaction-aborted` at exit 1 with evidence naming the operation and its gap reason; zero landing attempts, zero local squash, zero fallback; concrete rows stay nine | Failure `code` string equality, `exit` 1, `evidence` carrying the operation name and the exact `CapabilityGapReason`, the landing-attempt count 0, the git event log, and `ERROR_TABLE`'s concrete `merge` row count 9 | TC-F1-008, TC-SYNC-003 | Suite + control |
| AC-F1-8 | Zero composed callers of the retained local landing/refresh; both remain declared and tested; the scan has a mandatory failing control | Scan result over the composition roots + `MERGE_GIT_OPERATIONS` membership + `GitMergeSeam.squashLand`/`refresh` export and delivered suite presence | TC-F1-009 | Suite + control |
| AC-F1-9 | Re-run over a recorded landed request replays `merged` with the recorded identity, zero landing calls, no duplicate record | Report `result`/`squash`, landing call count 0, and the transaction record count 1 | TC-F1-010 | Suite + control |
| AC-F2-1 | `conflicting` → exactly one `merge.sync-required` reason `dirty`, exit 1, evidence names the condition, sync remediation; zero rebase/head mutation/landing | Failure `code`, `evidence` (reason + recorded/current head), the row's `remediationHint`, refresh count 0, landing count 0, head reads before/after equal | TC-F2-001 | Suite + control |
| AC-F2-2 | `not-mergeable` → one guarded landing, then one bounded re-read resolving to `sync-required`/`behind`, the gate row for a checks posture, or `sync-required`/`behind-unconfirmed`; no retry; none classified as a clean pre-mutation abort | Landing count 1, request-detail read count exactly 2, and the resulting `code` + `evidence.detail` reason (`behind`; `merge.gate.ci-green.failed` with `ci-pending`/`ci-failed`; `behind-unconfirmed`), with `merge.transaction-aborted` absent from every branch | TC-F2-002, TC-F2-003, TC-F2-004 | Suite + control |
| AC-F2-3 | A behind request whose re-read is undecisive yields exactly one `merge.sync-required` with reason `behind-unconfirmed`, evidence naming the observed provider state, and the caveated sync remediation; zero rebases/retries, never success | `code` = `merge.sync-required`, `exit` 1, `evidence.detail` = `behind-unconfirmed`, `evidence.requestState` = the observed state, and the row's declared remediation text carrying the persisting-refusal caveat | TC-F2-005 | Suite + control |
| AC-F2-4 | `unknown`/absent → exactly one exact-head re-read; recovered → rule above; head changed → `gates-stale`; still unknown → `merge.mergeability-unknown` exit 2 retryable `not_landed`; never waits | Request-detail read count 2, resulting `code`, row `retryable`/`consequence`, `exit`, and the absence of any timer/loop seam in the runtime | TC-F2-006 | Suite + control |
| AC-F2-5 | Every refusal's code/kind/exit equals its declared row; both new rows documented and machine-declared together; family slot unchanged; `merge.rebase-conflict` retained and unreachable | `ERROR_TABLE` rows (kind/category/retryable/consequence/projectionClass), the documented table's rows, `ERROR_TABLE_FAMILIES` slot rule, and the emittable-set membership of the reserved row plus its absence from every emit site | TC-F2-007, TC-SYNC-001 | Suite + control |
| AC-F2-6 | No internal rebase, no head mutation, no force/bypass/auto-merge/queue/retry representable | `MERGE_GIT_OPERATIONS`, `DeliveryRequestLandingStrategy`, the landing input type, and the git event log across a full run | TC-F2-008, TC-SYNC-008 | Suite + control |
| AC-F3-1 | A declared required job queued/running is not green with the delivered pending reason; canceled/skipped/failed keep theirs | `verify gates` `ci-green` verdict+`reason` (`ci-pending`) and `evaluateRequiredJobGate`'s verdict+reason for the same input (parity assertion) | TC-F3-001 | Suite + control |
| AC-F3-2 | Every not-green declared job (queued/running/canceled/skipped/failed) refuses on the family row and the evidence carries exactly one attribution value, `recorded` or `probe`; the recorded arm also names gate id, job and verdict and carries **no** timestamp; undeclared jobs and other-head pages produce neither a refusal nor an attribution | Refusal `code` `merge.gate.<gate-id>.failed`, `evidence.gateId`, `evidence.detail` (the delivered reason), `evidence.jobs`, the additive `evidence.attribution` valued `probe` or `recorded`, the **absent** timestamp member on the evidence key set, and the persisted verification record's `verifiedAt` resolved by gate id + job — five stimulus cases plus the two attribution arms | TC-F3-002, TC-F3-003 | Suite + control |
| AC-F3-3 | An undeclared job is not evidence and produces no refusal; a page for another head is not head evidence | Refusal presence/absence with a paired positive (the same job declared → refusal) and the same page at the verified head → refusal | TC-F3-004, TC-F3-005 | Suite + control |
| AC-F3-4 | A provider-required refusal is classified, never retried or bypassed; no second evaluator, no prose matching | The refusal's declared `code`/`kind`, the landing-call count (no retry), and a scan for a second evaluator entry point or a prose regex on the check path | TC-F3-006 | Suite + control |
| AC-F4-1 | Thirteen steps with `milestone-sync` at 12 and `capsule` at 13; consumers resolve by `stepId`; documented inventory says thirteen; the step-failure family slot validates unchanged | `CLOSEOUT_STEP_IDS` (length + positions), `closeoutStepDefinitions`, `CloseoutData.steps[*].stepId`, a consumer that resolves by id after the insertion, the documented inventory text, and `closeout.step.<id>.failed` resolution for the new id | TC-F4-001, TC-SYNC-002 | Suite + control |
| AC-F4-2 | Declared + attached + exit review passing + open → `applied` after exactly one close write whose read-back asserts closed; other steps/exit/queue-removal unchanged | Step `outcome`, close-write count 1 with its read-back request, and a deep-equal comparison of all other steps and the queue-removal block against the same run without the milestone | TC-F4-002 | Suite + control |
| AC-F4-3 | Absent / non-conforming / mismatched declaration → `skipped-noop` + exactly one residue naming the closed reason, zero writes, no title-similarity guessing; `none` → `skipped-gap` | Step `outcome`, `residue[]` (`kind`, `item`, `location`), close-write count 0, and a fixture whose milestone title *matches* the declaration but is not attached | TC-F4-003, TC-F4-004 | Suite + control |
| AC-F4-4 | An open attached item, unavailable signal, unknown state, or truncated set withholds closure with one residue naming the reason; the read is capped at 200 and performed once | Step `outcome`, `residue[].item`, milestone-read count 1, and the declared cap observed from the attached-set fixture | TC-F4-005, TC-F4-006, TC-F4-007, TC-F4-008 | Suite + control |
| AC-F4-5 | The operation vocabulary cannot express create/attach/detach/rename/reopen; one close per run; read-back verified; never retried; `alreadyApplied` when already closed | The operation's canonical argument type and effect union (type probes) + close-write count ≤1 + the already-closed fixture yielding `satisfied` | TC-F4-009, TC-SYNC-008 | Suite + control |
| AC-F4-6 | Plan mode reads and renders one of `would-apply`/`satisfied`/`skipped-noop`/`skipped-gap` with zero writes/appends/fences; two applies perform at most one close and the second reports `satisfied` | Plan step `outcome` across the closed table, with `would-refuse` unreachable (no declared milestone fact produces it); write/append/fence counters 0; second-apply `outcome` `satisfied` and the total close count 1 | TC-F4-010, TC-F4-011 | Suite + control |
| AC-F4-7 | GH-349's own closeout verifies attachment plus a recorded exit-review verdict and withholds closure; the acceptance never asserts a closed record | The synthetic M4 attached-set fixture's step `outcome` `skipped-noop` + `residue[].item` `closure-withheld` + the exit-review evidence, and an assertion that no close write occurred | TC-F4-012 | Suite + control |
| AC-F4-8 | A close write that did not land / read-back not closed → `closeout.write.failed` exit 2, no capsule close, failure recorded, converges on retry; a provider without the surface → `skipped-gap` with its reason | Failure `code`/`kind`/`exit`, capsule close-event count 0, the retry run's converging outcome, and the gap fixture's `skipped-gap` + reason | TC-F4-013, TC-F4-014 | Suite + control |
| AC-F4-9 | The milestone read is a declared gap for a provider without the surface, adds no operation and no flag; both surfaces ride the existing transport/credential port; the secret-read allowlist is unchanged | `ADAPTER_OPERATIONS` length and membership, the declaration's gap reason for the read's provider, the read's transport/credential seam identity, and exact equality of the secret-read allowlist | TC-F4-015, TC-SYNC-007 | Suite + control |
| AC-F5-1 | Every document-writing branch derives `completed` from the post-transition fold; `started` never rewritten; reopen writes null; no branch uses a history lookup | The written document's `phases.<id>.completed` compared with `foldPhaseState(...).phases[id].completed` on each branch (`both`, `record-record-only`, `record-atomic-without-commit`, `commit-without-record`), plus `started` equality | TC-F5-001, TC-F5-002 | Suite + control |
| AC-F5-2 | complete → reopen → re-complete: fold, `phase list`, document all carry the second timestamp; the pre-reopen value appears nowhere; the no-op re-run reports the same value | All three surfaces' `completed`, a string scan of the document and the `phase list` payload for the first timestamp, and `evidence.completedAt` on the no-op envelope | TC-F5-003 | Suite + control |
| AC-F5-3 | A ledger-backed divergence yields exactly one `lint.phases.divergent` at exit 1 naming the phase and both bounded values, with the declared remediation; null ≠ timestamp | Lint failure `code`, `summary` (phase id + both values), `exit` from the row's projection, and the remediation text | TC-F5-004 | Suite + control |
| AC-F5-4 | A ledger-less phase and a document-only completion produce no finding; the exclusion is documented; `verify change` unchanged | Finding absence with a paired positive (one ledger-backed divergence in the same fixture), the rule's documentation, and the delivered `verify change` suite's verdict/precedence | TC-F5-005 | Suite + control |
| AC-F5-5 | The rule performs zero document writes, fences, appends, tracker reads and clock reads, and replays identically | Injected-port call counters (`writePmNotes`, `appendTransition`, `fenceToken`, registry/tracker read, clock) and two-run verdict equality | TC-F5-006 | Suite + control |
| AC-F5-6 | No `phase repair`, no lint fix mode, no new state kind; the five delivered rows keep their codes and remediation; the new row is appended in the declared order with both tables moving together | The command grammar and flag set, the lint finding order and codes, and the documented/machine row sets | TC-F5-007 | Suite + control |
| AC-F5-7 | The both-target lint reports zero new findings across the acceptance corpus; any hit is recorded and investigated | The recorded corpus run's compared-phase count and finding count (non-vacuity precondition) | TC-F5-008 | Gate |
| AC-F6-1 | Seven properties, each asserted through the production composition with a control that injects the breach and fails naming the property | Each property's declared outcome (refusal `code`+holder, park record fields, reconcile payload counts/remainder, mutation result vocabulary, append sequences, presence fold) and its control's named failure | TC-F6-001, TC-F6-002, TC-F6-003, TC-F6-004, TC-F6-005, TC-F6-006, TC-F6-007 | Suite + control |
| AC-F6-2 | A repair restores the declared sentence only, changes no vocabulary/key/flag/refusal-into-success, and its control still fails | Exact-set equality of the vocabularies/keys/flags before and after, the suite green, and the control's named failure persisting | TC-F6-012, TC-F6-005 | Suite + control |
| AC-F6-3 | Verb set, record kinds, state keys and flag grammar are exactly the delivered ones | Exact-set equality over the command's verb list, `QUEUE_*` record declarations, key builders and grammar, with add/remove mutations | TC-F6-011 | Suite + control |
| AC-F6-4 | The automatic `landed` removal stays a non-step, fail-open, merge-truth-gated, idempotent hook inside the existing fence, with no duplicate removal and no step/exit change — including when the milestone was withheld or gapped | `CloseoutQueueRemovalData` (`outcome`, `skipReason`, `ref`), removal record count, fence-acquisition count 1, and step-outcome/exit equality across the applied/withheld/gap milestone variants | TC-F6-008 | Suite + control |
| AC-F6-5 | A parked entry's removal appends the park release before the removal in one fenced transaction; the park history stays durable; any refusal appends nothing | The two appended records' sequence numbers and the durable park record, plus the graph document and append count 0 on refusal | TC-F6-009, TC-F6-002 | Suite + control |
| AC-F6-6 | The folded-read cap, reconcile examined-entry cap, four removal reasons and refusal-detail bound are unchanged; a truncated reconcile reports its remainder | `QUEUE_RECONCILE_MAX_ENTRIES`, `QUEUE_REMOVAL_REASONS`, the folded-read cap constant, the refusal detail bound, and the payload's reported remainder | TC-F6-010, TC-F6-003 | Suite + control |
| AC-F7-1 | A gate-family landing refusal classifies as the family code, kind `merge`, exit 1; the emittable set covers every emitted code including the family; no member resolves to another kind; `fallback.internal` absent; a live mismatch control still contains | `classifyThrown`/`resolveAppErrorCode` results for a gate-family code, `MERGE_COMPOSITION_EMITTABLE_CODES` expanded membership, the per-member kind check, and the mismatch control's `fallback.internal` | TC-F7-001, TC-F7-002 | Suite + control |
| AC-F7-2 | The F4 suite named after the defect fails on pre-fix behaviour and asserts the fixed sequence plus the companions | The three-surface value, the pre-fix derivation's differing value, the finding for a hand-edited document, the absence for a document-only completion, and the write/fence counters | TC-F7-003 | Suite + control |
| AC-F7-3 | A three-merge serial fixture: ≤1 landing call per invocation, zero head mutations, no rebase attempt, non-first invocations resolve as typed sync refusals | Per-invocation landing counts, the head-mutation counter, the git refresh event count, and the second/third refusal `code` | TC-F7-004 | Suite + control |
| AC-F7-4 | Removing a defect suite's primary assertion or restoring pre-fix behaviour makes it fail by name | A suite-level assertion-presence registry (each suite's declared primary assertion id observed as executed) plus the three pre-fix controls | TC-F7-005 | Suite + control |
| AC-F7-5 | The three defect suites and the queue-integrity suites execute offline inside the existing test jobs with no workflow change and the topology contract green | `bun test` discovery count for the named files, the workflow pin's file/job/trigger sets, and both guards' counters | TC-F7-006, TC-FLOOR-006 | Suite + control + Gate |

**All 46 acceptance criteria are mapped to named cases.** 46/46 mapped, 0 unmapped, 0 deferred; the two rows carrying a *reduced* carrier (`AC-F2-3`, `AC-F3-2`) are flagged and their gap is stated as a specification defect in §11 rather than papered over.

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

The spec declares no `EVT-` identifiers (§8.2: no event, message, telemetry record, or state-schema record). The interfaces under test are in-process contracts, one adapter operation pair, and the declared data shapes.

| ID | Element | Observable contract | TC ID(s) |
|---|---|---|---|
| API-1 | Guarded landing call | One call per invocation carrying `deliveryRequest`, `strategy:"squash"`, `expectedHeadSha` = the verified head, `commitTitle` (provider title or `merge(<ref>): squash <sourceRef>`), and `commitMessage` byte-equal to `Landed by the delivery lifecycle merge primitive.`; returns `{merged:true, mergeCommitSha?}` or a refusal; at most once, never re-issued, never with a force/bypass/auto-merge/queue variant | TC-F1-001, TC-F1-002, TC-F1-003, TC-F1-004, TC-F1-005, TC-F1-010, TC-F2-002, TC-SYNC-008 |
| API-2 | Merge refusal classification | One total decision function over the five observations; ≤1 post-refusal re-read and ≤1 unknown-recovery re-read, both head-compared; every produced identity is a declared row with that row's kind and exit; a sync-required outcome carries one reason from the closed triple `dirty`/`behind`/`behind-unconfirmed` and a not-green required-job outcome one attribution from the closed pair `recorded`/`probe`, with the `recorded` arm identifying its source record by gate id, job and verdict (the verification timestamp stays on the persisted record and never enters the evidence); evidence is bounded and carries no provider prose | TC-F2-001..TC-F2-007, TC-F3-002, TC-F3-004, TC-F3-006, TC-F7-001 |
| API-3 | `close-milestone` closed operation | Canonical arguments name only the milestone identity; effect is "set closed"; read-back verified; at most once per run; never retried; `alreadyApplied` when already closed; every adapter declares support or a closed gap reason | TC-F4-002, TC-F4-009, TC-F4-013, TC-F4-014, TC-SYNC-003 |
| API-4 | Bounded milestone read | One adapter-local read returning identity, title, state (`open`/`closed`/unknown) and attached items with delivery states under a cap of 200 plus a truncation marker; adds no closed operation and no capability flag; four facts never collapse; at most once per run | TC-F4-005..TC-F4-008, TC-F4-015, TC-SYNC-007 |
| API-5 | Phase divergence finding | One comparison on the both-target lint, executed only after both conformance checks pass, over ledger-backed phases and `completed` only; first divergence is `lint.phases.divergent` with phase id, both bounded values and the declared remediation; read-only and deterministic | TC-F5-004, TC-F5-005, TC-F5-006, TC-SYNC-006 |
| API-6 | Phase mirror write | Every document-writing branch derives `completed` from the post-transition fold; `started` only on creation; reopen writes null; the no-op evidence reports the same value; no branch holds a different derivation | TC-F5-001, TC-F5-002, TC-F5-003 |
| API-7 | Queue integrity properties | The seven declared properties as observable outcomes of the delivered verbs over the delivered ledger; no new verb/kind/key/flag; the automatic closeout removal keeps its contract | TC-F6-001..TC-F6-012 |
| DM-1 | Normalized delivery-request title | One additive optional field, verbatim, absent = unknown and never derived; participates only in the landing subject; no field removed/retyped/required; no schema version change | TC-SYNC-004, TC-F1-006, TC-F1-007 |
| DM-2 | Merge refusal identities and evidence | `merge` concrete rows 7 → 9 (`merge.sync-required` with the closed reason triple, `merge.mergeability-unknown`); the `merge.gate.<gate-id>.failed` slot unchanged; `merge.rebase-conflict` retained, reserved, reachable from no command path; **exactly one** additive optional bounded evidence field for the attribution pair — no second field, so no timestamp enters the evidence, and the `recorded` arm identifies its source record by gate id, job and verdict with the timestamp remaining on the persisted verification record; a declared landing gap refused through the delivered `merge.transaction-aborted`; the emittable declaration exhaustive over the family it emits | TC-F2-007, TC-SYNC-001, TC-F7-001, TC-F7-002 |
| DM-3 | Recorded landing identity | The transaction record keeps its shape; `squashSha` becomes the provider's merge commit; absence is `merge.landing-unverified`, never derived; local containment is not landing evidence; the record remains closeout's merged-evidence anchor | TC-F1-002, TC-F1-003, TC-F1-004, TC-SYNC-005 |
| DM-4 | Closeout step inventory | `CLOSEOUT_STEP_IDS` 12 → 13 with `milestone-sync` at 12 and `capsule` terminal at 13; consumers resolve by `stepId`; the documented inventory states thirteen; the `closeout.step.<id>.failed` slot rule validates against the effective set unchanged | TC-F4-001, TC-SYNC-002 |
| DM-5 | Judgment residue kind | The closed residue set 8 → 9 with `milestone-sync-withheld`; bounded item text carries the closed reason; location is the work-item ref; dedup key, ordering and the 50-item cap with sentinel unchanged | TC-F4-003, TC-F4-005..TC-F4-008, TC-SYNC-002, TC-FLOOR-008 |
| DM-6 | Operation set and capability declarations | `ADAPTER_OPERATIONS` 9 → 10 with `close-milestone` appended and nothing reordered; GitHub support; GitLab `adapter-not-implemented`; Jira `provider-unsupported`; the milestone read adds no operation and no flag | TC-SYNC-003, TC-F4-009, TC-F4-015 |
| DM-7 | Conformance and parity surfaces | The tenth operation represented by an executing step or a declared-gap step; all ten represented; each adapter's supported set and gaps backed by steps and covering the closed set; the matrix 27 → 30 cells with three adjudicated cells; mock routes and projections cover the supported execution; the six-family × three-adapter accounting stays 18 | TC-SYNC-003, TC-FLOOR-001 |
| DM-8 | Phase truth surfaces | The pm-notes lint family 5 → 6 with `lint.phases.divergent` in the declared order; `lint` concrete rows 6 → 7; the two-table identity total 149 → 152; `LintRegistryRead` gains the verified fold additively and no other read changes | TC-SYNC-001, TC-SYNC-006, TC-F5-007, TC-FLOOR-001 |
| DM-9 | Milestone observation | Record identity, title, state (`open`/`closed`/unknown), attached items with delivery states, a truncation marker and the declared cap; absent surface, unavailable signal, unknown state and truncation are four distinct facts that never collapse into an empty set | TC-SYNC-007, TC-F4-006, TC-F4-007, TC-F4-008 |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR | Requirement (abridged) | Carrier | TC ID(s) | Status |
|---|---|---|---|---|
| NFR-1 | Two replays of the same declared input produce byte-identical merge refusal summaries, closeout plans and operation identities, lint verdicts and phase folds; no wall clock, randomness, provider return order or map iteration order | Committed goldens for the refusal summary and the closeout plan/operation ids; two-run canonical-JSON equality; the phase fold compared as a value | TC-FLOOR-005, TC-F5-006, TC-F6-001 | Covered |
| NFR-2 | Zero live network calls and zero child processes across every added suite; provider shapes are committed fixtures; the git seam's child processes stay confined to the delivered local-repository tests | Both delivered guards' counters armed and asserted at zero; the new suites' import set (no `fetch`, no `child_process` outside the declared git seam) | TC-FLOOR-002, TC-F7-006 | Covered |
| NFR-3 | Zero new transport, credential path, network location or secret-read allowlist entry | Exact equality of the secret-read allowlist; the landing and milestone surfaces reading the delivered credential/transport ports | TC-FLOOR-004, TC-F4-015 | Covered |
| NFR-4 | Per merge: ≤1 landing, ≤1 post-refusal re-read, ≤1 recovery re-read, 1 verification read, 1 work-item read, 1 check-run page, 1 request-detail read, 0 head mutations. Per closeout: ≤1 milestone read, ≤1 close write, 0 polls/pagination/retries. Per lint: 1 fold read, 0 tracker reads | The harness's port call counters and the git event log | TC-F1-005, TC-F2-002, TC-F2-006, TC-F4-008, TC-F6-010 | Covered |
| NFR-5 | No derived, fabricated or defaulted value stands in for an absent provider signal; unknown never becomes mergeable, closed, empty or success | Absent-title, absent-mergeability, absent-merge-commit, absent-attachment, unknown-state and truncated-set fixtures, each paired with a present-signal positive | TC-F1-003, TC-F1-004, TC-F1-007, TC-F2-006, TC-F4-006, TC-F4-007, TC-SYNC-007 | Covered |
| NFR-6 | Zero removed/retyped delivered fields; zero unreachable declared rows; both tables agree bidirectionally at 152 identities; every new row reachable from a named branch; no pattern widening; each set changes by exactly its declared delta | The documented↔machine table comparison, the reachability table (row → emitting branch), the exact-set deltas for steps/residue/operations/lint rows, and the family slot rule | TC-SYNC-001, TC-SYNC-002, TC-FLOOR-001, TC-F2-007 | Covered |
| NFR-7 | Every adapter declares support or a closed gap reason for the tenth operation; the matrix covers every operation × adapter with zero missing/duplicate/extra/unadjudicated cells; every declared gap is reached by a step with its exact reason | The capability declarations, the expanded matrix cell set (30), the register bijection, and the runtime coverage gate's gap encounters | TC-SYNC-003, TC-FLOOR-003 | Covered |
| NFR-8 | The divergence rule performs zero document writes, fences, appends, tracker calls and clock reads, and returns the same verdict across replays | Injected-port counters and two-run equality | TC-F5-006 | Covered |
| NFR-9 | No argument shape or effect expresses milestone create/attach/detach/rename/reopen; no landing or mutation union member expresses force/bypass/auto-merge/queue/retry; proven structurally | Type probes over the operation argument and effect unions plus the `MERGE_GIT_OPERATIONS`/strategy sets, each with a compile-time negative | TC-SYNC-008, TC-F2-008, TC-F4-009 | Covered |
| NFR-10 | Testkit keeps zero `node:*`/`bun:*` imports and zero ambient environment, clock or randomness reads; fixture loading, environment reads, native fetch, child-process substitution and artifact writing stay under the test tree | The dependency-cruiser runtime-API confinement rule, the ambient-globals AST guard, and a planted-import mutation | TC-FLOOR-002 | Covered |
| NFR-11 | Zero new both-target lint findings across the acceptance corpus; any hit is triaged as a second writer and recorded | The recorded corpus run with its compared-phase count (§10) | TC-F5-008, TC-FLOOR-007 | Gate |
| NFR-12 | Every recorded gate command uses `TMPDIR=$PWD/tmp/tmpdir`; no lease/retrieval command outside the change's gates; commits through the primitive; the PR targets the tooling integration branch and stops open | The §10 command column, the topology pin, and a review-verified PR-base row | TC-FLOOR-007, TC-FLOOR-006 | Gate + review-verified |
| NFR-13 | Every new diagnostic and outcome stays within the delivered bounds; no credential, payload, title beyond the crafted subject, body or provider prose appears in any output | Human line/byte bounds with explicit `+N`, the residue 50-item cap + sentinel, the refusal detail character bound, and the sanitization/secret canaries | TC-FLOOR-008 | Covered |

### 3.4 Traceability Closure

- **Acceptance criteria**: 46 declared, **46 mapped**, 0 unmapped, 0 deferred. Capability distribution: F-1 → 10 cases, F-2 → 8 (+1 shared sync case), F-3 → 6, F-4 → 15 (+3 shared sync cases), F-5 → 8 (+1 shared sync case), F-6 → 12, F-7 → 6 (+1 shared floor case), interface/pin surface → 8, floor → 8.
- **Test cases**: **81 declared** — `TC-F1-001..010` (10), `TC-F2-001..008` (8), `TC-F3-001..006` (6), `TC-F4-001..015` (15), `TC-F5-001..008` (8), `TC-F6-001..012` (12), `TC-F7-001..006` (6), `TC-SYNC-001..008` (8), `TC-FLOOR-001..008` (8) = 10+8+6+15+8+12+6+8+8 = **81**. Every case names at least one AC or NFR; §3.1 is the reverse map.
- **Orphans**: **0**. Every case is either a positive proof of an AC/NFR or a control proving the same AC cannot pass vacuously. No case asserts a behaviour outside the spec, and no case pre-commits a delivery verdict the spec leaves to measurement (the corpus result and the live GH-349 closeout are recorded as gate evidence, not predicted).
- **Carrier discipline (the reason this section exists)**: each §3.1 row names the *field or observable* that carries the assertion. **No row is reduced.** The five originally reduced rows are closed: four by spec v1.1 (the fallback string, the reason triple, the caveated remediation, the attribution pair) and the last by spec v1.2 — the `recorded` arm identifies its source record by gate id, job and verdict, the refusal asserts the **absence** of a timestamp field, and the timestamp is corroborated from the persisted `merge.gate-verification` record that gate id + job resolves to. No row claims coverage on a dimension the change does not deliver, and none borrows a carrier from a different surface without naming it.
- **Invariants have controls, not re-reads**: `AC-F1-8` (zero composed callers) → scan + planted caller + seam-declared check (`TC-F1-009`); `AC-F2-6`/`AC-F4-5`/`NFR-9` (unrepresentable) → type probes with a compile-time negative plus a union-set equality (`TC-SYNC-008`); `AC-F5-6` and `AC-F6-3` (surface unchanged) → exact-set equality with add/remove mutations (`TC-F5-007`, `TC-F6-011`); `AC-F7-5`/`NFR-12` (topology unchanged) → the delivered base-free pin plus a discovery assertion (`TC-FLOOR-006`).
- **Review-verified residue**: the "this change's diff adds no workflow file" half and the live GH-349 closeout outcome are recorded in §10 as review/gate evidence, per `.ai/rules/testing-strategy.md`'s prohibition on base-ref assertions. Neither is ever the only evidence for its AC.
- **No-skip rule**: no `test.skip`, `test.todo`, conditional early return, or environment-gated pass is permitted in any suite this change touches. A case that cannot resolve its seam throws naming the missing contract. A skipped control is the precise failure these suites exist to prevent.

## 4. Test Types and Layers

| Layer | Type | Location | Runner | Applies to |
|---|---|---|---|---|
| Behaviour (in-process composition) | Integration, contract | `tests/behaviour/**` | `bun test tests/behaviour` | Landing, refusal taxonomy, probe, milestone sync, phase mirror, queue integrity, the three defect suites |
| Structure / declared-data | Contract, static scan, exact-set pin | `tests/structure/**` | `bun test tests/structure` | Emittable totality, step inventory, residue kinds, operation set and parity cells, error-table rows, type probes, topology pin |
| Repository invariants | Static scan + mutation | `tests/checks/**` | `bun test tests/checks` | Error-table bidirectional sync, capsule bounds, sanitization/privacy, secret-read boundary, doc distribution |
| Offline conformance | Contract | `tests/conformance/**` | `bun test tests/conformance` | Parity gate over 30 cells, mock-tenant routes and projections, family accounting unchanged |
| Compile-time probes | Type | `tests/types/**` | `pnpm typecheck` | Landing strategy union, close-milestone argument/effect vocabulary, `DeliveryRequest.title` optionality |
| Boundaries | Graph | `tests/boundaries/**` | `bun test tests/boundaries` | `runtime-apis-confinement` for testkit, ambient-globals guard |
| Quality gate | Execution record | repository root | `pnpm check` | Aggregate gate, corpus measurement, topology check |

Mocking and isolation: every provider interaction is an injected transport (the merge harness's recording landing port, the closeout fake provider/git/state, the mock tenant). Time is the injected constant (`MERGE_CLOCK_MS`, `CLOSEOUT_TIMESTAMP`) or the closeout harness's fixed timestamp; identities are fixed strings. No case reads the ambient environment, the network, a credential, or a real clock. Controls that need a writable tree copy into `mkdtemp` and clean up; no case mutates a committed file or leaves module-level mutable state.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Layer | Priority | AC Coverage |
|-------|-------|------|-------|----------|-------------|
| TC-F1-001 | Exactly one guarded landing call at the verified head with the declared bytes, and no second mechanism reachable | Contract | Behaviour + checks | Critical | AC-F1-1, AC-F1-6, API-1, DM-1, DM-3, NFR-9 |
| TC-F1-002 | The provider's merge commit is the recorded landing identity and the record keeps its shape | Happy Path | Behaviour | Critical | AC-F1-2, API-1, DM-3 |
| TC-F1-003 | Local containment is never landing evidence: provider-not-merged refuses `merge.landing-unverified` | Negative | Behaviour | Critical | AC-F1-3, DM-3, NFR-5 |
| TC-F1-004 | A merged read-back with no merge commit reports the identity unknown; the re-run does not re-land | Edge Case | Behaviour | Critical | AC-F1-4, DM-3, NFR-5 |
| TC-F1-005 | A head that moved after verification refuses with exactly zero landing calls | Negative | Behaviour | Critical | AC-F1-5, API-1, API-2, NFR-4 |
| TC-F1-006 | The crafted title is the provider title byte-for-byte and the message is the fixed verbatim trailer | Contract | Behaviour + golden | Critical | AC-F1-6, API-1, DM-1 |
| TC-F1-007 | An absent title falls back to `merge(<ref>): squash <sourceRef>` and is never derived from an empty signal | Edge Case | Behaviour | High | AC-F1-6, DM-1, NFR-5 |
| TC-F1-008 | A declared landing gap refuses as `merge.transaction-aborted` at exit 1 with the operation and gap reason named | Negative | Behaviour + structure | Critical | AC-F1-7, API-1, DM-2, DM-6, NFR-7 |
| TC-F1-009 | Zero composed callers of the retained local landing and refresh, with a planted-caller control | Contract | Checks | Critical | AC-F1-8, DM-2, NFR-9 |
| TC-F1-010 | A re-run over a recorded landing replays without a second landing or a duplicate record | Regression | Behaviour | Critical | AC-F1-9, API-1, DM-3 |
| TC-F2-001 | A conflicting request refuses one typed `sync-required` with reason `dirty` and touches nothing | Negative | Behaviour | Critical | AC-F2-1, API-2, DM-2, NFR-4 |
| TC-F2-002 | A not-mergeable refusal whose re-read is decisive out-of-date resolves to `sync-required` reason `behind` | Negative | Behaviour | Critical | AC-F2-2, API-2, DM-2 |
| TC-F2-003 | A not-mergeable refusal whose re-read shows a checks posture resolves to the gate row with the delivered reason | Negative | Behaviour | Critical | AC-F2-2, API-2, DM-2 |
| TC-F2-004 | No not-mergeable branch yields a clean pre-mutation abort: an inseparable protection rule is `behind-unconfirmed` | Negative | Behaviour | Critical | AC-F2-2, AC-F2-3, API-2, DM-2 |
| TC-F2-005 | The undecisive boundary yields `sync-required`/`behind-unconfirmed` with the caveated sync remediation, never success | Edge Case | Behaviour | Critical | AC-F2-3, API-2, DM-2, RSK-7 |
| TC-F2-006 | Unknown mergeability is recovered by exactly one exact-head re-read, then typed | Edge Case | Behaviour | Critical | AC-F2-4, API-2, DM-2, NFR-4 |
| TC-F2-007 | Every refusal's code, kind and exit are its row's, and the reserved row stays declared and unreachable | Contract | Structure + checks | Critical | AC-F2-5, DM-2, NFR-6 |
| TC-F2-008 | No internal rebase, no head mutation, and no force/bypass/auto-merge/queue/retry representable | Contract | Behaviour + types | Critical | AC-F2-6, API-2, NFR-9 |
| TC-F3-001 | Queued and running are not-green with `ci-pending` on both sides of the check boundary | Contract | Behaviour | Critical | AC-F3-1, API-2, NFR-1 |
| TC-F3-002 | A not-green declared job refuses through the family row with attribution `probe`, naming job and reason | Negative | Behaviour + golden | Critical | AC-F3-2, API-2, DM-2 |
| TC-F3-003 | A job already not-green in the record carries attribution `recorded`, identifies its source record by gate id/job/verdict, and carries no timestamp | Edge Case | Behaviour + golden | Critical | AC-F3-2, API-2, DM-2 |
| TC-F3-004 | An undeclared job produces no refusal and no attribution, proven by a paired declared-job positive | Negative | Behaviour | Critical | AC-F3-2, AC-F3-3, API-2 |
| TC-F3-005 | A check-run page for another head is not head evidence, proven by the same page at the head | Negative | Behaviour | Critical | AC-F3-3, API-2 |
| TC-F3-006 | A provider-required refusal is classified and never retried or bypassed, with no second evaluator | Contract | Behaviour + checks | High | AC-F3-4, API-2, NFR-9 |
| TC-F4-001 | Thirteen steps with `milestone-sync` at 12, `capsule` terminal, and step-id resolution holding | Contract | Structure + behaviour | Critical | AC-F4-1, API-3, DM-4, NFR-6 |
| TC-F4-002 | A satisfying exit review closes once, read-back verified, with every other step and the queue outcome unchanged | Happy Path | Behaviour | Critical | AC-F4-2, API-3, API-4, DM-9 |
| TC-F4-003 | An absent, non-conforming or mismatched declaration withholds with one residue and zero writes | Negative | Behaviour | Critical | AC-F4-3, API-3, DM-5, DM-9 |
| TC-F4-004 | A `none` declaration is a declared gap, not a withheld closure | Edge Case | Behaviour | High | AC-F4-3, API-3, DM-5 |
| TC-F4-005 | An open attached item withholds closure with `closure-withheld` | Negative | Behaviour | Critical | AC-F4-4, API-4, DM-5 |
| TC-F4-006 | An unavailable signal withholds as a distinct fact, never as an empty set or a failure | Negative | Behaviour | Critical | AC-F4-4, API-4, DM-5, DM-9, NFR-5 |
| TC-F4-007 | An unknown milestone state withholds closure rather than reading as open | Negative | Behaviour | Critical | AC-F4-4, API-4, DM-9, NFR-5 |
| TC-F4-008 | A truncated attached set withholds, and the read is capped at 200 and performed once | Edge Case | Behaviour | Critical | AC-F4-4, API-4, DM-5, NFR-4 |
| TC-F4-009 | The close-milestone vocabulary cannot express create, attach, detach, rename or reopen | Contract | Structure + types | Critical | AC-F4-5, API-3, DM-6, NFR-9 |
| TC-F4-010 | Plan mode renders only the four declared outcomes with zero writes, appends and fences | Contract | Behaviour | Critical | AC-F4-6, API-3, NFR-4 |
| TC-F4-011 | Two consecutive applies perform at most one close and the second reports `satisfied` | Regression | Behaviour | Critical | AC-F4-6, API-3, NFR-4 |
| TC-F4-012 | GH-349's own M4 outcome is withdrawn closure, never a closed record | Regression | Behaviour | Critical | AC-F4-7, API-4, DM-5, RSK-1 |
| TC-F4-013 | A close that did not land gates at `closeout.write.failed` with no capsule close and converges on retry | Negative | Behaviour | Critical | AC-F4-8, API-3, DM-6, RSK-11 |
| TC-F4-014 | A provider without the surface is a declared gap, never a silent skip | Negative | Behaviour + structure | Critical | AC-F4-8, API-3, DM-6 |
| TC-F4-015 | The milestone read adds no operation and no flag and rides the existing transport and credential port | Contract | Structure + checks | Critical | AC-F4-9, API-4, DM-6, NFR-3 |
| TC-F5-001 | Every document-writing branch writes the post-transition fold's completion | Contract | Behaviour | Critical | AC-F5-1, API-6, DM-8 |
| TC-F5-002 | `started` is never rewritten and a reopen writes null with no history lookup | Contract | Behaviour | Critical | AC-F5-1, API-6 |
| TC-F5-003 | complete → reopen → re-complete leaves the second completion on all three surfaces and nowhere else | Regression | Behaviour | Critical | AC-F5-2, API-6, DM-8 |
| TC-F5-004 | A hand-edited completion yields exactly one `lint.phases.divergent` naming phase and both values | Negative | Behaviour | Critical | AC-F5-3, API-5, DM-8 |
| TC-F5-005 | A ledger-less phase and a document-only completion are not flagged, with a paired positive | Negative | Behaviour | Critical | AC-F5-4, API-5, DM-8 |
| TC-F5-006 | Detection writes nothing, takes no fence, appends nothing and replays identically | Contract | Behaviour | Critical | AC-F5-5, API-5, NFR-8 |
| TC-F5-007 | No repair surface exists and the lint rows keep their codes, order and remediation | Contract | Structure | High | AC-F5-6, DM-8, NFR-6 |
| TC-F5-008 | The both-target lint reports zero new findings over the acceptance corpus, non-vacuously | Corpus | Gate | Critical | AC-F5-7, NFR-11 |
| TC-F6-001 | Claim integrity: single-flight, same-holder renewal, stale takeover, cross-ref conflict | Contract | Behaviour | Critical | AC-F6-1, API-7, NFR-1 |
| TC-F6-002 | Park integrity: closed causes, battery-only refusal by name, expiry rules, removal releases first | Contract | Behaviour | Critical | AC-F6-1, AC-F6-5, API-7 |
| TC-F6-003 | Reconcile integrity: done/canceled only, retained unobserved, bounded with remainder, `--ref` narrows | Contract | Behaviour | Critical | AC-F6-1, AC-F6-6, API-7 |
| TC-F6-004 | CRUD integrity: one edge per add, one-edge removal, add-only cycle check, no cascade | Contract | Behaviour | Critical | AC-F6-1, API-7 |
| TC-F6-005 | Reason-bearing removal: four reasons, the full refusal set, zero appends, deliberate non-idempotency | Contract | Behaviour | Critical | AC-F6-1, AC-F6-2, API-7 |
| TC-F6-006 | Single-flight names the live holder at the envelope root within its bound | Contract | Behaviour | Critical | AC-F6-1, API-7 |
| TC-F6-007 | Presence is decided by append position, never by timestamp text, and re-declaration restores | Contract | Behaviour | Critical | AC-F6-1, API-7 |
| TC-F6-008 | The automatic `landed` removal is unchanged across the milestone step insertion | Regression | Behaviour | Critical | AC-F6-4, API-7, DM-4 |
| TC-F6-009 | A parked entry's removal appends the park release first, durably, in one fenced transaction | Contract | Behaviour | Critical | AC-F6-5, API-7 |
| TC-F6-010 | The delivered bounds, reasons and refusal detail are unchanged and truncation is reported | Contract | Behaviour + structure | High | AC-F6-6, API-7, NFR-4 |
| TC-F6-011 | The queue surface gained no verb, record kind, state key or flag | Contract | Structure | Critical | AC-F6-3, API-7, NFR-6 |
| TC-F6-012 | A repair restores only the declared sentence, and its control still fails on the breach | Contract | Behaviour | Critical | AC-F6-2, API-7, NFR-6 |
| TC-F7-001 | F1: a gate-family refusal carries its family code, kind `merge` and exit 1 with containment absent | Regression | Structure + behaviour | Critical | AC-F7-1, AC-F2-5, DM-2, NFR-6 |
| TC-F7-002 | F1 control: the pre-fix emittable declaration fails the totality proof by name | Negative | Structure | Critical | AC-F7-1, AC-F7-4, DM-2 |
| TC-F7-003 | F4: the defect-named suite fails on the pre-fix lookup and passes on the fold | Regression | Behaviour | Critical | AC-F7-2, AC-F5-1, AC-F5-2 |
| TC-F7-004 | F8: a three-merge serial fixture shows ≤1 landing each, zero head mutations and typed sync refusals | Regression | Behaviour | Critical | AC-F7-3, AC-F2-1, AC-F2-6 |
| TC-F7-005 | Each defect suite fails by name when its primary assertion is removed, and its control executes | Contract | Structure | Critical | AC-F7-4, NFR-1 |
| TC-F7-006 | The defect and integrity suites ride the existing test jobs offline with the topology contract green | Contract | Checks + structure | Critical | AC-F7-5, NFR-2 |
| TC-SYNC-001 | The identity total moves 149 → 152 on both tables with no pattern widening and no orphan row | Contract | Checks + structure | Critical | AC-F2-5, DM-2, DM-8, NFR-6 |
| TC-SYNC-002 | Step inventory, residue kinds and their pins move exactly, in every place they exist | Contract | Structure + checks | Critical | AC-F4-1, DM-4, DM-5, NFR-6 |
| TC-SYNC-003 | The tenth operation moves the registry, both coverage gates, thirty parity cells and the mock routes atomically | Contract | Conformance + structure | Critical | AC-F1-7, DM-6, DM-7, NFR-7 |
| TC-SYNC-004 | The normalized title is one additive optional field with absence semantics and no schema change | Contract | Structure + types | High | AC-F1-6, DM-1, NFR-6 |
| TC-SYNC-005 | The transaction record keeps its shape and its landing identity changes provenance only | Contract | Structure + behaviour | Critical | AC-F1-2, AC-F1-9, DM-3 |
| TC-SYNC-006 | The lint registry read gains the verified fold additively and nothing else changes | Contract | Structure + behaviour | High | AC-F5-3, DM-8 |
| TC-SYNC-007 | Milestone observation keeps four distinct facts and never collapses them | Contract | Structure | Critical | AC-F4-9, DM-9, NFR-5 |
| TC-SYNC-008 | Forbidden acts are unrepresentable in the landing, mutation and close-milestone vocabularies | Contract | Types + boundary | Critical | AC-F2-6, AC-F4-5, NFR-9 |
| TC-FLOOR-001 | Every moved pin moves exactly, is not loosened, and fails by name when only one side moves | Regression | Structure + conformance + checks | Critical | NFR-6, AC-F2-5, AC-F4-1, AC-F6-3 |
| TC-FLOOR-002 | The added suites are offline and the testkit stays runtime-neutral | Regression | Boundaries + checks | Critical | NFR-2, NFR-10 |
| TC-FLOOR-003 | No adapter behaviour changed beyond the new operation and its two declared gaps | Regression | Behaviour + structure | Critical | NFR-7, §24.3(14) |
| TC-FLOOR-004 | No new network location, credential path or secret-read allowlist entry | Regression | Checks | Critical | NFR-3 |
| TC-FLOOR-005 | Determinism and byte pins: two replays are identical, the moved attribution golden matches, the rest are unchanged | Contract | Behaviour + golden | Critical | NFR-1, NFR-6 |
| TC-FLOOR-006 | The pinned CI topology is unchanged and the new suites are discovered by the existing jobs | Contract | Structure + checks | Critical | AC-F7-5, NFR-12 |
| TC-FLOOR-007 | The gate battery and the corpus measurement are recorded with the `TMPDIR` convention | Quality gate | Gate | Critical | NFR-12, NFR-11 |
| TC-FLOOR-008 | Every new diagnostic and outcome stays within its declared bound, the trailer is one line, and no provider content leaks | Contract | Behaviour + checks | High | NFR-13, DM-5, DM-1 |

### 5.2 Scenario Details

#### TC-F1-001 - Exactly one guarded landing call at the verified head, and no second mechanism reachable

**Type** Contract · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-1, AC-F1-1, AC-F1-6, API-1, DM-1, DM-3, NFR-9
**Target** `tests/behaviour/merge-landing.test.ts` (extend) over `tests/fixtures/merge/harness.ts` · **Tags** @behaviour @merge @landing
**Carrier** the harness's recording landing port (one entry per call, each with `{deliveryRequest, strategy, expectedHeadSha, commitTitle, commitMessage}` and a call count), the git seam's event log (`git-squash-land`, `git-rebase-refresh`, push), and the production-source scan result over the composition roots. The expected `commitMessage` bytes are written in the case, not read from the production composer (GAP-TP-7).

**Given** a ready item with a fresh verification at head `H` and a `mergeable` request whose `title` is `feat(GH-349): crafted subject` and whose `sourceRef` is `feat/GH-349/merge-closeout-queue-repair`, **When** `merge <ref>` runs, **Then** the landing log has exactly one entry whose `strategy` is `"squash"`, whose `expectedHeadSha` equals `H`, whose `commitTitle` is byte-equal to the request's title, whose `commitMessage` is byte-equal to `Landed by the delivery lifecycle merge primitive.` (one line, no leading/trailing whitespace, no interpolated ref or identity), and whose `deliveryRequest` identity is the request's; the git event log contains no `git-squash-land`, no `git-rebase-refresh` and no push; the scan over `packages/cli/src/edge.ts` and `packages/cli/src/production.ts` finds zero call sites of the local seam's `squashLand`/`refresh` for a landing or a sync and zero platform-CLI literals (`gh pr merge`, `glab mr merge`).
**Pass** one call with those two byte-exact strings, head equality, and both absence checks in the same case. **Control** a planted `squashLand(` call site and a planted `gh pr merge` literal are each found by name; a second landing call on the same invocation fails naming the count; a message carrying an interpolated ref fails naming the byte difference.

#### TC-F1-002 - The provider's merge commit is the recorded landing identity and the record keeps its shape

**Type** Happy Path · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-1, AC-F1-2, API-1, DM-3
**Target** `tests/behaviour/merge-landing.test.ts` · **Tags** @behaviour @merge @landing @record
**Carrier** `MergeReport.result`/`MergeReport.squash`, `MergeTransactionRecord.squashSha` and `landing.requestState`, and the record's exact key set.

**Given** a landing whose read-back asserts merged and carries merge commit `M`, **When** the outcome is rendered and recorded, **Then** the report is `result=merged` with `squash=<M>`, the appended record's `squashSha` is exactly `M`, `landing.requestState` is `merged`, and the record's key set equals the delivered `MergeTransactionRecord` key set (no added, removed or retyped field).
**Pass** string equality with `M` (not "a sha appeared") plus exact key-set equality. **Control** a read-back whose merge commit differs from any local object must still record the provider's value, so a derivation from local ancestry fails naming the two values.

#### TC-F1-003 - Local containment is never landing evidence: provider-not-merged refuses `merge.landing-unverified`

**Type** Negative · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-1, AC-F1-3, API-1, DM-3, NFR-5
**Target** `tests/behaviour/merge-landing.test.ts` · **Tags** @behaviour @merge @provenance
**Carrier** the failure `code`, its row's `consequence` and projection `exit`, and the absence of a `result=merged` payload.

**Given** a fixture in which the landing identity is locally contained (the fake git reports containment true) while the provider read-back does **not** assert merged, **When** `merge` runs, **Then** the outcome is `merge.landing-unverified`, its row's consequence is `unknown`, exit is 2, the report contains no `merged` result, and the recorded `landing.requestState` is not `merged`.
**Pass** code + consequence + exit + absent merged result in one assertion set. **Control (paired positive in the same case)** the identical fixture with a provider read-back that *does* assert merged yields `merged`, so the case cannot pass by never merging; a second control makes containment `true` and the provider state `closed`, which must still refuse.

#### TC-F1-004 - A merged read-back with no merge commit reports the identity unknown; the re-run does not re-land

**Type** Edge Case · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-1, AC-F1-4, API-1, DM-3, NFR-5
**Target** `tests/behaviour/merge-landing.test.ts` · **Tags** @behaviour @merge @absence
**Carrier** the record's absent `squashSha`, the rendered identity line, and the landing port's call count on the second invocation.

**Given** a read-back reporting merged with **no** merge commit identity, **When** the first run completes and the command re-runs with the provider now asserting the request merged, **Then** the first run records `result=merged` with no `squashSha` (identity unknown, never a local object, never an empty string), and the re-run performs zero landing calls and does not append a duplicate record.
**Pass** absent identity + zero landing calls on the re-run + record count 1. **Control** the same re-run against a provider that does **not** assert merged performs exactly one landing call, so "zero calls" is not satisfied by never landing; a second control makes the read-back an empty string, which must be treated as absent.

#### TC-F1-005 - A head that moved after verification refuses with exactly zero landing calls

**Type** Negative · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-1, AC-F1-5, API-1, API-2, NFR-4
**Target** `tests/behaviour/merge-head-guard.test.ts` (new) over the merge harness · **Tags** @behaviour @merge @head-guard
**Carrier** the failure `code`/`exit`, `evidence.recordedSha`, `evidence.currentSha`, and the landing call count 0.

**Given** a verification recorded at head `H1` and a current head `H2`, **When** `merge` runs, **Then** it refuses `merge.gates-stale` at exit 1 with both SHAs present in the bounded evidence, and the landing log is empty.
**Pass** code, exit, both SHAs, and an empty landing log in one case. **Control** the same fixture with `H2 === H1` lands exactly once, so a broken seam cannot make the zero-call assertion vacuous; a provider-side head rejection is a separate classified refusal, never retried (asserted by the call count staying 1).

#### TC-F1-006 - The crafted title is the provider-asserted title verbatim and the message is the fixed trailer

**Type** Contract · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-1, AC-F1-6, API-1, DM-1
**Target** `tests/behaviour/merge-landing-metadata.test.ts` (new) · **Tags** @behaviour @merge @metadata
**Carrier** the landing input's `commitTitle` and `commitMessage` byte strings, and the merge command's declared flag list. The expected message is a literal written in the case (GAP-TP-7), not a value imported from the production composer.

**Given** a normalized request carrying `title: "feat(GH-349): crafted subject"`, change ref `GH-349` and identity `<system>#<id>`, **When** the landing is composed, **Then** `commitTitle` equals that string character for character, `commitMessage` is exactly `Landed by the delivery lifecycle merge primitive.` (one bounded line, no leading or trailing whitespace, no `Change:`/`Delivery-Request:` interpolation and no provider prose), and the merge command's flag set contains no title, message or body flag.
**Pass** two byte-exact string equalities plus a one-line assertion plus the flag-set equality; the trailer is also checked against a second request whose ref and identity differ, and must be byte-identical there (proving no interpolation). **Control** a request whose title differs only by a leading space must transmit that space (verbatim, not trimmed); adding a `--title` flag fails naming the flag set; a trailer rendered with an interpolated ref fails naming the byte difference.

#### TC-F1-007 - An absent title falls back deterministically and is never derived from an empty signal

**Type** Edge Case · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-1, AC-F1-6, DM-1, NFR-5
**Target** `tests/behaviour/merge-landing-metadata.test.ts` · **Tags** @behaviour @merge @metadata @absence
**Carrier** the landing input's `commitTitle` for three requests: title present, title absent, title empty. The expected fallback string is composed in the case from the fixture's change ref and `sourceRef` (GAP-TP-7).

**Given** three requests for change `GH-349` whose `sourceRef` is `feat/GH-349/merge-closeout-queue-repair` — `title` present, `title` absent, `title: ""` — **When** each lands, **Then** the present case transmits the provider title byte-for-byte, and both absent forms transmit exactly `merge(GH-349): squash feat/GH-349/merge-closeout-queue-repair`, the declared deterministic fallback built from the change ref and the request's source ref, with no third form and no provider prose.
**Pass** three byte-exact strings, with the two absent forms equal to each other and different from the present one, and the fallback containing the `squash ` token once. **Control** a composer that drops `squash `, or that substitutes the branch for the change ref, fails naming the expected and received strings; a title carrying the request body must never be transmitted beyond its own string.

#### TC-F1-008 - A declared landing gap refuses as `merge.transaction-aborted` at exit 1 with the operation and gap reason named

**Type** Negative · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-1, AC-F1-7, API-1, DM-2, DM-6, NFR-7
**Target** `tests/behaviour/merge-refusal-surface.test.ts` (extend) + `tests/structure/merge-contract.test.ts` · **Tags** @behaviour @merge @capability
**Carrier** the failure `code` and `exit`, its bounded evidence naming the operation and the exact `CapabilityGapReason`, the landing-attempt count, the git event log, and `ERROR_TABLE`'s concrete `merge` row count.

**Given** an adapter whose declaration carries `merge-delivery-request` as a gap with reason `adapter-not-implemented` (and a second run with `provider-unsupported`), **When** `merge` runs, **Then** it refuses `merge.transaction-aborted` at exit 1, its bounded evidence names the operation `merge-delivery-request` and the exact gap reason verbatim, the landing-attempt count is 0, the git event log shows no `git-squash-land` and no `git-rebase-refresh`, and the concrete `merge` rows still number nine.
**Pass** the code string, exit 1, the operation name, the verbatim reason, zero landing attempts, zero local-landing events, and the row count 9, in one case. **Control** a silent local fallback (a harness whose landing port delegates to `squashLand`) must fail naming the fallback; the two reasons are asserted separately so a single hard-coded string cannot satisfy both; a third refusal identity (for example a new `merge.landing-gap`) fails naming the row count 10.

#### TC-F1-009 - Zero composed callers of the retained local landing and refresh, with a planted-caller control

**Type** Contract · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-1, AC-F1-8, DM-2, NFR-9
**Target** `tests/checks/merge-landing-retirement.test.ts` (new) · **Tags** @checks @merge @scan
**Carrier** the scan's result over the composition roots, `MERGE_GIT_OPERATIONS` membership, and the seam's exported members plus their delivered suites.

**Given** the production source of `packages/cli/src/{edge,production}.ts` and the git seam, **When** the scan runs, **Then** there is no composition site that calls `squashLand` or `refresh`, `MERGE_GIT_OPERATIONS` still declares `squash-land` and `rebase-refresh` (retained capability), `createGitMergeSeam` still exports both, and the delivered seam suite still exercises them.
**Pass** zero call sites + both operations declared + both still tested, in one case. **Control** a planted `squashLand(` call site in a temp copy is found and named with file and line; removing `rebase-refresh` from the declared operations fails naming the missing member (the capability must be retained, not deleted).

#### TC-F1-010 - A re-run over a recorded landing replays without a second landing or a duplicate record

**Type** Regression · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-1, AC-F1-9, API-1, DM-3
**Target** `tests/behaviour/merge-convergence.test.ts` (extend) · **Tags** @behaviour @merge @idempotency
**Carrier** the report's `result`/`squash`, the landing call count, and the transaction record count.

**Given** a recorded `merged` transaction with identity `M` and a provider request that still reads merged, **When** `merge` runs again, **Then** the report is `result=merged` with `squash=<M>`, the landing log is empty, and the transaction record count stays 1.
**Pass** replay + zero calls + record count 1. **Control** the same fixture without the record performs exactly one landing (so the replay is not "always empty"); a duplicate append mutation fails naming the record count 2.

#### TC-F2-001 - A conflicting request refuses one typed `sync-required` with reason `dirty` and touches nothing

**Type** Negative · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-2, AC-F2-1, API-2, DM-2, NFR-4
**Target** `tests/behaviour/merge-refusal-taxonomy.test.ts` (new) · **Tags** @behaviour @merge @refusal
**Carrier** the failure `code`, its `evidence` (reason, recorded and current head), the row's `remediationHint`, the refresh count, the landing count, and the head before/after.

**Given** a request whose normalized `mergeableState` is `conflicting` and a fresh verification at head `H`, **When** `merge` runs, **Then** exactly one refusal is produced with `code=merge.sync-required`, evidence naming the condition and reason `dirty`, the row's declared remediation (update the delivery branch onto the base by the normal path, re-verify, retry), exit 1; the refresh port was called 0 times, the landing port 0 times, and the head read after the run equals `H`.
**Pass** one refusal + the four zero/none assertions in the same case. **Control** a run that performs one refresh fails naming the refresh count 1; a run that lands fails naming the landing count.

#### TC-F2-002 - A not-mergeable refusal whose re-read is decisive out-of-date resolves to `sync-required` reason `behind`

**Type** Negative · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-2, AC-F2-2, API-2, DM-2
**Target** `tests/behaviour/merge-refusal-taxonomy.test.ts` · **Tags** @behaviour @merge @refusal @re-read
**Carrier** the landing count, the request-detail read count (exactly 2), and the resulting `code` + `evidence.detail` reason.

**Given** a `not-mergeable` request whose guarded landing is refused by the provider and whose single post-refusal re-read reports the out-of-date condition, **When** `merge` runs, **Then** the landing log has one entry, the request-detail read count is exactly 2, the refusal is `merge.sync-required` at exit 1 with `evidence.detail` `behind` and the row's sync remediation, and no second landing occurs.
**Pass** landing 1, re-read 2, `code`/`exit`/`detail` exact, and the reason drawn from the closed triple. **Control** two re-reads fail naming the count 3; a retry fails naming the landing count 2; reporting `behind-unconfirmed` for a decisive re-read fails naming both reason values.

#### TC-F2-003 - A not-mergeable refusal whose re-read shows a checks posture resolves to the gate row with the delivered reason

**Type** Negative · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-2, AC-F2-2, API-2, DM-2
**Target** `tests/behaviour/merge-refusal-taxonomy.test.ts` · **Tags** @behaviour @merge @refusal @ci
**Carrier** the refusal `code` (`merge.gate.ci-green.failed` for the built-in gate id), `evidence.gateId`, `evidence.detail` (the delivered reason), and the re-read count.

**Given** a `not-mergeable` request whose landing is refused and whose re-read reports a pending/failed checks posture, **When** `merge` runs, **Then** two independent runs yield `merge.gate.ci-green.failed` with `evidence.detail` `ci-pending` (queued stimulus) and `ci-failed` (failed stimulus) respectively, each naming the gate id, with the request-detail read count 2.
**Pass** both reasons produced by the stimulus that must produce them, declared code, gate id present. **Control** a `merge.sync-required` for a checks posture fails naming the two codes; returning the same reason for both stimuli fails naming the duplicated value.

#### TC-F2-004 - No not-mergeable branch yields a clean pre-mutation abort: an inseparable protection rule is `behind-unconfirmed`

**Type** Negative · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-2, AC-F2-2, AC-F2-3, API-2, DM-2
**Target** `tests/behaviour/merge-refusal-taxonomy.test.ts` · **Tags** @behaviour @merge @refusal @boundary
**Carrier** the refusal `code`/`exit` and its `evidence.detail` reason + `evidence.requestState`, asserted across every branch of the not-mergeable rule.

**Given** a `not-mergeable` request whose re-read reports a protection posture that is neither the out-of-date condition nor a checks posture (for example a blocked/`draft` posture, which the four-value normalization cannot separate from a behind head), **When** `merge` runs, **Then** the refusal is `merge.sync-required` at exit 1 with `evidence.detail` `behind-unconfirmed` naming the observed provider state, the landing count is 1, the re-read count is 2, and `merge.transaction-aborted` appears at **no** not-mergeable outcome (asserted as one code set over the rule's three stimuli: the decisive case, the checks-posture case, and this inseparable case).
**Pass** the three not-mergeable outcomes' code set equals `{merge.sync-required, merge.gate.ci-green.failed}` with `merge.transaction-aborted` absent, plus the reason and observed-state evidence. **Control** the same fixture classified as `merge.transaction-aborted` fails naming the code (a clean pre-mutation abort is exactly what AC-F2-2 forbids for this branch); the out-of-date fixture still yields `behind`, so a single catch-all reason cannot satisfy both.

#### TC-F2-005 - The declared undecisive boundary still yields one typed refusal naming the sync condition, never success

**Type** Edge Case · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-2, AC-F2-3, API-2, DM-2, RSK-7
**Target** `tests/behaviour/merge-refusal-taxonomy.test.ts` · **Tags** @behaviour @merge @boundary
**Carrier** `code` = `merge.sync-required`, `exit` 1, `evidence.detail` = `behind-unconfirmed`, `evidence.requestState` = the observed provider state, and the row's declared remediation text.

**Given** a request that is behind its base but whose post-refusal re-read is *not decisive* because the four-value normalization collapses the condition, **When** `merge` runs, **Then** the outcome is exactly one `merge.sync-required` at exit 1 with reason `behind-unconfirmed` from the closed triple, its bounded evidence names the observed provider state, its remediation instructs the operator to sync the delivery branch onto the base and re-verify **and states that a refusal persisting after the sync means the protection rule is the cause**, the refresh count is 0 and the landing count is ≤1 with no success outcome.
**Pass** one refusal + `behind-unconfirmed` + observed state + the caveated remediation + no success. **Control** a run that reports success fails by name; a `dirty` or `behind` reason for this stimulus fails naming both values; a remediation without the persisting-refusal caveat fails naming the missing sentence; introducing prose matching (classifying on the refusal message text) fails naming the matcher, and a fixture whose message contains "behind" while the structure says otherwise must not change the classification.

#### TC-F2-006 - Unknown mergeability is recovered by exactly one exact-head re-read, then typed

**Type** Edge Case · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-2, AC-F2-4, API-2, DM-2, NFR-4
**Target** `tests/behaviour/merge-refusal-taxonomy.test.ts` · **Tags** @behaviour @merge @recovery
**Carrier** the request-detail read count (2), the resulting `code`, the row's `retryable`/`consequence`, and `exit`.

**Given** three fixtures whose mergeability is absent or `unknown` — (a) the re-read recovers `mergeable`, (b) the re-read resolves at a changed head, (c) the re-read stays unknown — **When** `merge` runs, **Then** each performs exactly one recovery re-read: (a) proceeds to exactly one guarded landing, (b) refuses `merge.gates-stale` with both heads, (c) refuses `merge.mergeability-unknown` at exit 2, `retryable: true`, consequence `not_landed`, with a retry-after-computation remediation; and no run polls or waits (no timer seam is invoked and the clock is read a bounded number of times).
**Pass** three outcomes + the per-case read count 2 + the row facts. **Control** two recovery reads fail naming the count 3; a "wait and retry" loop fails naming the second landing attempt.

#### TC-F2-007 - Every refusal's code, kind and exit are its row's, and the reserved row stays declared and unreachable

**Type** Contract · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-2, AC-F2-5, DM-2, NFR-6
**Target** `tests/structure/merge-refusal-rows.test.ts` (new) + the delivered `merge-classification-conformance.test.ts` · **Tags** @structure @merge @rows
**Carrier** `ERROR_TABLE` rows for the two new codes, the row-declared closed vocabularies (`merge.sync-required`'s reason triple, the attribution pair), the documented table's rows, `ERROR_TABLE_FAMILIES`' slot rule, and the emit-site scan.

**Given** the two additive rows and the reserved row, **When** the tables and the emit sites are inspected, **Then** `merge.sync-required` and `merge.mergeability-unknown` each carry their declared `category`, `retryable`, `consequence`, `projectionClass` and `domainKind` (`merge`), exit 1 and 2 respectively by projection; `merge.sync-required` declares exactly the reason triple `dirty`/`behind`/`behind-unconfirmed` (three members, no fourth) and the refusal evidence declares exactly the attribution pair `recorded`/`probe`; both rows appear in the documented table with the same fields and the same vocabularies; the `merge.gate.<gate-id>.failed` family's slot rule is unchanged and still validates the id against the effective gate set; `merge.rebase-conflict` is still declared with its unchanged projection and remediation and appears at no emit site.
**Pass** field-by-field equality per row + two closed-vocabulary equalities + the documented/machine agreement + zero emit sites for the reserved code. **Control** a widened family slot (accepting `merge.gate.any.failed`) fails naming the id; deleting `merge.rebase-conflict` fails naming the row; adding a fourth reason or a third attribution value fails naming the member and the set size.

#### TC-F2-008 - No internal rebase, no head mutation, and no force/bypass/auto-merge/queue/retry representable

**Type** Contract · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-2, AC-F2-6, API-2, NFR-9
**Target** `tests/behaviour/merge-refusal-taxonomy.test.ts` + `tests/types/merge-landing.type-test.ts` (new) · **Tags** @behaviour @types @merge @unrepresentable
**Carrier** the git event log across a full run, `MERGE_GIT_OPERATIONS`, `DeliveryRequestLandingStrategy`, and the landing input type.

**Given** the full taxonomy exercised in one suite, **When** every path is inspected, **Then** no path emits `git-rebase-refresh`, the head read before the landing equals the head after it, `DeliveryRequestLandingStrategy` is exactly `"squash"`, and the landing input type has no `force`, `bypass`, `autoMerge`, `queue` or `retry` member (a compile-time probe asserts each is not assignable).
**Pass** zero refresh events + head equality + union equality + five negative type probes. **Control** re-adding a refresh on the `conflicting` path fails naming the event; widening the strategy union fails the type probe.

#### TC-F3-001 - Queued and running are not-green with `ci-pending` on both sides of the check boundary

**Type** Contract · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-3, AC-F3-1, API-2, NFR-1
**Target** `tests/behaviour/merge-probe.test.ts` (extend) + the delivered `verify-gates` suite · **Tags** @behaviour @merge @ci
**Carrier** the `verify gates` `ci-green` verdict and `reason`, and `evaluateRequiredJobGate`'s verdict and `reason` for the same stimulus.

**Given** a check-run page in which a declared job is `queued` (then `running`), **When** the declared gate evaluation runs and the required-job evaluator runs over the same page, **Then** both report `fail` with reason `ci-pending`; and for the `canceled`, `skipped` and `failed` stimuli both report `fail` with `ci-canceled`, `ci-all-skipped` and `ci-failed` respectively.
**Pass** two-implementation agreement per stimulus (four stimuli × two evaluators). **Control** treating `queued` as green in either evaluator fails naming the side and the stimulus; a divergence between the two implementations fails naming both reasons.

#### TC-F3-002 - A not-green declared job refuses through the family row with attribution `probe`

**Type** Negative · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-3, AC-F3-2, API-2, DM-2
**Target** `tests/behaviour/merge-required-job-probe.test.ts` (new) · **Tags** @behaviour @merge @probe @golden
**Carrier** the refusal `code` (`merge.gate.<gate-id>.failed`), `evidence.gateId`, `evidence.detail` (delivered reason), `evidence.jobs` (names), the new additive `evidence.attribution`, and the rendered summary line.

**Given** a declared `required-ci-job` gate entry whose job the recorded verification observed **green** and whose state on the verified head is now one of `queued`, `running`, `canceled`, `skipped`, `failed`, **When** `merge` runs, **Then** five runs each refuse through `merge.gate.<gate-id>.failed` naming the gate id, carrying `ci-pending`/`ci-pending`/`ci-canceled`/`ci-all-skipped`/`ci-failed` respectively, each with `evidence.attribution` exactly `probe` and the job's name in the bounded evidence where the delivered reason list carries names; the rendered human summary carries the same attribution.
**Pass** five (stimulus → code+reason) pairs with the gate id and `attribution: "probe"` present in each. **Control** a probe result without an attribution fails naming the missing field; `attribution: "recorded"` for a recorded-green verdict fails naming both values; a probe that ignores `queued` fails naming that stimulus; returning one reason for all five fails naming the duplicated value.

#### TC-F3-003 - A job already not-green in the recorded verification carries attribution `recorded` and identifies its source record by gate id, job and verdict

**Type** Edge Case · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-3, AC-F3-2, API-2, DM-2
**Target** `tests/behaviour/merge-required-job-probe.test.ts` (extend `tests/golden/merge.test.ts` for the rendered line) · **Tags** @behaviour @merge @probe @attribution
**Carrier** the refusal's `evidence.attribution` (`recorded`), `evidence.gateId`, `evidence.jobs`, `evidence.detail` (the recorded verdict's reason), the **absence** of any timestamp field on the refusal evidence, and the persisted `merge.gate-verification` record's `verifiedAt` read by the case and matched on gate id + job.

**Given** a verification whose recorded `ci-green` verdict already reports job `J` not green (the record holds `verifiedAt`) and a check-run page where `J` is still not green, **When** `merge` runs, **Then** the refusal carries exactly one attribution, `recorded`, plus the effective gate id, the job name `J` and the recorded verdict in `evidence.detail` — the three facts that identify the source record; and the refusal evidence carries **no** timestamp field (the evidence key set contains no time-valued member, and `evidence.detail` holds the verdict, not a date). The case then resolves the persisted `merge.gate-verification` record by that gate id + job through the injected verification read, asserts the record exists and is the one the refusal cites, and corroborates its `verifiedAt` against the harness's injected verification timestamp.
**Pass** attribution `recorded` + gate id + job + verdict, **plus** the negative assertion that no timestamp field exists on the refusal, **plus** the corroboration read succeeding on gate id + job with the expected `verifiedAt`. **Control (paired)** the same fixture with the recorded verdict green produces the probe refusal with `attribution: "probe"` naming `J`, so the case cannot pass by producing no refusal at all; a refusal carrying both attribution values or neither fails naming the field; a refusal whose evidence gained a timestamp field fails naming the extra key; a corroboration lookup that cannot resolve a record for the gate id + job fails naming the lookup key.

#### TC-F3-004 - An undeclared job is not gate evidence, proven by a paired declared-job positive

**Type** Negative · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-3, AC-F3-3, API-2
**Target** `tests/behaviour/merge-required-job-probe.test.ts` · **Tags** @behaviour @merge @probe @evidence
**Carrier** refusal presence/absence and `evidence.attribution` presence/absence for the same not-green job, once undeclared and once declared.

**Given** a job `K` that is not green on the verified head and that the effective gate set does **not** declare, **When** `merge` runs, **Then** no refusal names `K`, no outcome carries an `attribution` at all, and the run proceeds to its landing; and with `K` added as a declared `required-ci-job` entry in a second run, the same page produces the family refusal naming `K` with `attribution: "probe"`.
**Pass** absent-then-present for one job (refusal and attribution together), both asserted. **Control** treating every observed job as evidence fails the first half naming `K`; emitting an attribution without a refusal fails naming the orphan field; treating none as evidence fails the second half.

#### TC-F3-005 - A check-run page for another head is not head evidence, proven by the same page at the head

**Type** Negative · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-3, AC-F3-3, API-2
**Target** `tests/behaviour/merge-required-job-probe.test.ts` · **Tags** @behaviour @merge @probe @head
**Carrier** the refusal presence/absence for a page whose `sha` is a different head, and for the same page labelled with the verified head.

**Given** a page of not-green declared jobs labelled with head `Hother ≠ H`, **When** `merge` runs, **Then** no refusal names those jobs (the page is not head evidence); and the identical page labelled `H` produces the family refusal.
**Pass** two runs, one page, two labels, opposite outcomes. **Control** accepting an `Hother` page as evidence fails the first half naming both SHAs.

#### TC-F3-006 - A provider-required refusal is classified and never retried or bypassed, with no second evaluator

**Type** Contract · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-3, AC-F3-4, API-2, NFR-9
**Target** `tests/behaviour/merge-refusal-taxonomy.test.ts` + `tests/checks/merge-check-path-scan.test.ts` (new) · **Tags** @behaviour @checks @merge @provider-authority
**Carrier** the classified refusal (code/kind from its row), the landing count, and the scan result for a second evaluator or prose matcher.

**Given** a provider whose guarded landing is refused because its required checks are unsatisfied, **When** `merge` runs, **Then** the outcome is a classified refusal drawn from the declared set with its row's kind and exit, the landing count is 1 (no retry, no bypass, no second attempt), and the scan finds no second required-check evaluator entry point and no prose/regex classification on the check or refusal path.
**Pass** classified refusal + landing 1 + scan empty. **Control** a planted `detail.toLowerCase().includes("check")` classifier is found and named; a retry loop fails naming the landing count 2.

#### TC-F4-001 - Thirteen steps with `milestone-sync` at 12, `capsule` terminal, and step-id resolution holding

**Type** Contract · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-4, AC-F4-1, API-3, DM-4, NFR-6
**Target** `tests/structure/closeout-contract.test.ts` (extend) + `tests/behaviour/closeout-milestone-sync.test.ts` (new) · **Tags** @structure @closeout @steps
**Carrier** `CLOSEOUT_STEP_IDS` length and positions, `closeoutStepDefinitions`, `CloseoutData.steps[*].stepId`, a consumer resolving by id, and the `closeout.step.<id>.failed` resolution.

**Given** the delivered step inventory, **When** the plan is inspected, **Then** `CLOSEOUT_STEP_IDS` has exactly 13 entries with `milestone-sync` at index 11 (position 12) and `capsule` last; `closeoutStepDefinitions` has the same 13 ids in the same order with a label each; a plan payload renders 13 steps and a consumer that resolves `milestone-sync` by id finds it without a positional assumption; `closeout.step.milestone-sync.failed` resolves to the family row and `closeout.step.unknown.failed` does not.
**Pass** 13 + both positions + id-resolution + family slot in one case. **Control** inserting the step at position 11 fails naming the index; moving `capsule` off the end fails naming the terminal id; a consumer that reads index 11 and expects `capsule` fails naming the resolved id.

#### TC-F4-002 - A satisfying exit review closes once, read-back verified, with every other step and the queue outcome unchanged

**Type** Happy Path · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-4, AC-F4-2, API-3, API-4, DM-9
**Target** `tests/behaviour/closeout-milestone-sync.test.ts` over `tests/fixtures/closeout/**` · **Tags** @behaviour @closeout @milestone
**Carrier** the step's `outcome`, the close-write call log (count and read-back), the deep-equality of all other steps against the no-milestone baseline, the exit code, and the `queueRemoval` block.

**Given** pm-notes declaring `M4: Jaiship-native delivery`, a work item carrying the same provider-asserted milestone, an open record, and every attached item `done` or `canceled`, **When** `closeout --apply` runs, **Then** the `milestone-sync` step reports `applied`, the close-write log has exactly one entry whose read-back asserts `closed`, every other step's `outcome` and `detail` deep-equals the same fixture without a milestone, the exit code equals the baseline's, and the `queueRemoval` block is unchanged.
**Pass** applied + exactly one read-back-verified write + step-by-step equality + exit equality + queue equality. **Control** two close writes fail naming the count 2; a read-back that reports `open` fails naming the observed state.

#### TC-F4-003 - An absent, non-conforming or mismatched declaration withholds with one residue and zero writes

**Type** Negative · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-4, AC-F4-3, API-3, DM-5, DM-9
**Target** `tests/behaviour/closeout-milestone-sync.test.ts` · **Tags** @behaviour @closeout @milestone @withheld
**Carrier** the step `outcome`, `residue[]` (`kind`, `item`, `location`), and the close-write count.

**Given** four fixtures — declaration absent, declaration non-`M<n>:` shaped, declaration attached to a *different* milestone, and a declaration whose text *matches* a milestone title that the work item does not carry — **When** the step runs in apply mode, **Then** each is `skipped-noop` with exactly one residue item of kind `milestone-sync-withheld` whose `item` is the closed reason (`declared-milestone-missing` for the first two, `attachment-mismatch` for the last two) and whose `location` is the work-item ref, and the close-write count is 0.
**Pass** four (fixture → reason) pairs + one residue each + zero writes. **Control** selecting a target by title similarity fails the fourth fixture naming the guessed identity; two residue items fail naming the count.

#### TC-F4-004 - A `none` declaration is a declared gap, not a withheld closure

**Type** Edge Case · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-4, AC-F4-3, API-3, DM-5
**Target** `tests/behaviour/closeout-milestone-sync.test.ts` · **Tags** @behaviour @closeout @milestone @gap
**Carrier** the step `outcome` and the residue list.

**Given** a pm-notes `milestone: none` declaration, **When** the step runs in plan and in apply mode, **Then** both report `skipped-gap`, no close write occurs, and no `milestone-sync-withheld` residue item is produced.
**Pass** `skipped-gap` in both modes + zero writes + zero residue items of the new kind. **Control** producing `skipped-noop` with `declared-milestone-missing` fails naming the outcome (a project without the construct is a gap, not a missing declaration).

#### TC-F4-005 - An open attached item withholds closure with `closure-withheld`

**Type** Negative · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-4, AC-F4-4, API-4, DM-5
**Target** `tests/behaviour/closeout-milestone-sync.test.ts` · **Tags** @behaviour @closeout @exit-review
**Carrier** the step `outcome`, the residue `item`, and the close-write count.

**Given** an open milestone record with every attached item `done` except one `in-progress`, **When** the step runs, **Then** it is `skipped-noop` with one residue whose `item` is `closure-withheld`, and no close write occurs.
**Pass** withheld + exact reason + zero writes. **Control (paired positive)** the same fixture with that item flipped to `canceled` reports `applied`, proving the predicate is the delivery state and not the presence of a list.

#### TC-F4-006 - An unavailable signal withholds as a distinct fact, never as an empty set or a failure

**Type** Negative · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-4, AC-F4-4, API-4, DM-5, DM-9, NFR-5
**Target** `tests/behaviour/closeout-milestone-sync.test.ts` · **Tags** @behaviour @closeout @absence
**Carrier** the step `outcome`, the residue `item`, and the absence of any `failed` step outcome.

**Given** a milestone read that returns an unavailable signal (a transport/read fault), **When** the step runs, **Then** it is `skipped-noop` with one residue whose `item` is `milestone-signal-unavailable`, no close write occurs, and the run does not treat the fault as a failure or as an empty attached set.
**Pass** withheld + reason + zero writes + no `failed` outcome. **Control** mapping the fault to an empty attached set closes the milestone (and fails naming the closed write); mapping it to `failed` fails naming the outcome.

#### TC-F4-007 - An unknown milestone state withholds closure rather than reading as open

**Type** Negative · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-4, AC-F4-4, API-4, DM-9, NFR-5
**Target** `tests/behaviour/closeout-milestone-sync.test.ts` · **Tags** @behaviour @closeout @absence
**Carrier** the step `outcome`, the residue `item`, and the close-write count.

**Given** a milestone record whose state is unknown (the provider supplied no state), **When** the step runs, **Then** closure is withheld as `skipped-noop` with `closure-withheld` and the record's unknown state carried in the bounded evidence, and no close write occurs.
**Pass** withheld + reason + zero writes. **Control** defaulting the state to `open` fails naming the closed write; dropping the state from the evidence fails naming the missing bound fact.

#### TC-F4-008 - A truncated attached set withholds, and the read is capped at 200 and performed once

**Type** Edge Case · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-4, AC-F4-4, API-4, DM-5, NFR-4
**Target** `tests/behaviour/closeout-milestone-sync.test.ts` · **Tags** @behaviour @closeout @truncation
**Carrier** the step `outcome`, the residue `item`, the milestone-read count, and the declared cap constant.

**Given** a milestone whose attached set exceeds the declared cap and whose read returns a truncation marker, **When** the step runs, **Then** it is `skipped-noop` with `attached-set-truncated`, the milestone read was performed exactly once, the cap constant equals 200, and no close write occurs.
**Pass** withheld + reason + read count 1 + cap equality. **Control** ignoring the marker fails naming the closed write; raising the cap to hide truncation fails naming the constant; a second read fails naming the count 2.

#### TC-F4-009 - The close-milestone vocabulary cannot express create, attach, detach, rename or reopen

**Type** Contract · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-4, AC-F4-5, API-3, DM-6, NFR-9
**Target** `tests/structure/closeout-milestone-contract.test.ts` (new) + `tests/types/closeout-milestone.type-test.ts` (new) · **Tags** @structure @types @closeout @unrepresentable
**Carrier** the operation's canonical argument type and its effect union, the write-outcome shape (`alreadyApplied`), and the close-write count.

**Given** the new operation's declared shape, **When** it is inspected, **Then** its arguments name only a milestone identity, its effect union has exactly one member ("set closed"), and a type probe asserts that a create/attach/detach/rename/reopen argument or effect is not assignable; at runtime an already-closed record yields `satisfied` (the `alreadyApplied` path) and the close-write count per run is at most 1 with no retry.
**Pass** one-member effect union + argument shape + five negative type probes + `alreadyApplied` + count bound. **Control** adding an `attach` effect fails the union equality naming the extra member; a retry loop fails naming the write count.

#### TC-F4-010 - Plan mode reads and renders the closed outcome table with zero writes, appends and fences

**Type** Contract · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-4, AC-F4-6, API-3, NFR-4
**Target** `tests/behaviour/closeout-milestone-sync.test.ts` · **Tags** @behaviour @closeout @dry-run
**Carrier** the plan step `outcome` across the fixtures, plus the write/append/fence counters.

**Given** the seven plan-reachable fixtures (satisfying, already closed, absent/malformed, `none`, mismatch, withheld, gap adapter), **When** `closeout <ref>` runs without `--apply`, **Then** the step renders `would-apply`, `satisfied`, `skipped-noop`, `skipped-noop`, `skipped-noop`, `skipped-noop` and `skipped-gap` respectively — exactly the four declared outcomes, with a mismatch and a withheld closure both `skipped-noop` plus residue — the milestone read was performed, and the document-write, record-append and fence-acquisition counters are all 0.
**Pass** the outcome per fixture (seven values drawn from a four-member set) + three zero counters, plus an assertion that no fixture yields `would-refuse` because no declared milestone fact produces it. **Control** a plan run that appends one record fails naming the append count; an outcome outside the four fails naming the outcome and the fixture (the closed table is the oracle, not the vocabulary's length).

#### TC-F4-011 - Two consecutive applies perform at most one close and the second reports `satisfied`

**Type** Regression · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-4, AC-F4-6, API-3, NFR-4
**Target** `tests/behaviour/closeout-milestone-sync.test.ts` · **Tags** @behaviour @closeout @idempotency
**Carrier** the first and second apply's step `outcome`, the total close-write count, and the second run's write count.

**Given** the satisfying fixture and a provider whose record flips to `closed` after the first write, **When** `closeout --apply` runs twice, **Then** the first run reports `applied`, the second reports `satisfied`, the total close-write count across both runs is 1, and the second run performs 0 writes.
**Pass** applied → satisfied + total 1 + second-run 0. **Control** a second close fails naming the total count 2; reporting `applied` on the second run fails naming the outcome.

#### TC-F4-012 - GH-349's own M4 outcome is withdrawn closure, never a closed record

**Type** Regression · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-4, AC-F4-7, API-4, DM-5, RSK-1
**Target** `tests/behaviour/closeout-milestone-sync.test.ts` over `tests/fixtures/closeout/m4-attached-set.ts` (new) · **Tags** @behaviour @closeout @gh-349
**Carrier** the step `outcome`, the residue `item`, the exit review's evidence, and the close-write count.

**Given** a synthetic attached set shaped like M4 at this change's boundary — the change's own ticket done, at least one other attached ticket open — and the `M4: Jaiship-native delivery` declaration with a matching attachment, **When** `closeout --apply` runs, **Then** the `milestone-sync` step is `skipped-noop` with one residue whose `item` is `closure-withheld`, the attachment check and the exit-review verdict appear in the step's bounded evidence, and no close write occurs.
**Pass** withheld + exact reason + attachment/exit-review evidence + zero writes. **Control (the guard that matters)** the case *also* asserts that the fixture's milestone record is still `open` after the run, so an assertion of "closed" cannot pass; flipping the open item to `canceled` makes the same fixture `applied`, proving the withholding is produced by the open item and not by a disabled step.

#### TC-F4-013 - A close that did not land gates at `closeout.write.failed` with no capsule close and converges on retry

**Type** Negative · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-4, AC-F4-8, API-3, DM-6, RSK-11
**Target** `tests/behaviour/closeout-milestone-write-failure.test.ts` (new) · **Tags** @behaviour @closeout @failure
**Carrier** the run's failure `code`/`kind`/`exit`, the capsule close-event count, and the retry run's `outcome`.

**Given** two write faults — the close request fails, and the request succeeds but the read-back does not observe `closed` — **When** `closeout --apply` runs, **Then** each returns `closeout.write.failed` with kind `closeout` at exit 2, the capsule close event count is 0, the failure is recorded as step evidence, and a retry against a healthy provider reports `applied` (convergence).
**Pass** code+kind+exit per fault + capsule count 0 + convergence. **Control** a swallowed write failure that lets the capsule close fails naming the capsule event count 1.

#### TC-F4-014 - A provider without the surface is a declared gap, never a silent skip

**Type** Negative · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-4, AC-F4-8, API-3, DM-6
**Target** `tests/behaviour/closeout-milestone-sync.test.ts` + `tests/structure/closeout-contract.test.ts` · **Tags** @behaviour @structure @closeout @capability
**Carrier** the step `outcome`, the declared gap reason for the adapter, and the close-write count.

**Given** an adapter declaring `close-milestone` as `adapter-not-implemented` (GitLab) and another as `provider-unsupported` (Jira), **When** the step runs in apply mode, **Then** each reports `skipped-gap` carrying its declared gap reason, performs no write, and produces no `milestone-sync-withheld` residue item.
**Pass** `skipped-gap` with each exact reason + zero writes. **Control** returning `skipped-noop` with a withheld reason fails naming the outcome; returning `failed` fails naming the exit.

#### TC-F4-015 - The milestone read adds no operation and no flag and rides the existing transport and credential port

**Type** Contract · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-4, AC-F4-9, API-4, DM-6, NFR-3
**Target** `tests/structure/closeout-milestone-contract.test.ts` + `tests/checks/secret-read-boundary` (delivered) · **Tags** @structure @checks @closeout @boundary
**Carrier** `ADAPTER_OPERATIONS` membership, the three capability declarations, the read's transport/credential seam identity, and exact equality of the secret-read allowlist.

**Given** the read's implementation and the three adapters, **When** the surfaces are inspected, **Then** `ADAPTER_OPERATIONS` is exactly the ten declared operations with `close-milestone` appended and no other member added for the read; no capability flag exists for the read; the read is performed through the same injected transport and credential port the delivered reads use (the seam types are identical); and the secret-read allowlist equals the delivered set exactly.
**Pass** ten-member set + no new flag + identical seam types + allowlist equality. **Control** adding an eleventh operation or a capability flag fails naming it; one added allowlist entry fails naming the file and pattern.

#### TC-F5-001 - Every document-writing branch writes the post-transition fold's completion

**Type** Contract · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-5, AC-F5-1, API-6, DM-8
**Target** `tests/behaviour/phase-completion-convergence.test.ts` (extend) over `tests/fixtures/phase` helpers · **Tags** @behaviour @phase @mirror
**Carrier** the written document's `phases.<id>.completed` compared with `foldPhaseState(...).phases[id].completed` on each branch.

**Given** a transition history in which the phase has two completions separated by a reopen (so the first completion ≠ the fold's latest) and one branch per document-writing path (`both`, `record-record-only`, `record-atomic-without-commit`, `commit-without-record`), **When** each branch runs, **Then** in every branch the written document's `completed` equals the fold's `completed` for that phase.
**Pass** four branch assertions, each an equality with the fold value, plus the assertion that the fold value differs from the first completion (so the equality is discriminating). **Control** the pre-fix history lookup applied to the same history yields the first completion and therefore differs — asserted as the control's expected value.

#### TC-F5-002 - `started` is never rewritten and a reopen writes null with no history lookup

**Type** Contract · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-5, AC-F5-1, API-6
**Target** `tests/behaviour/phase-completion-convergence.test.ts` · **Tags** @behaviour @phase @mirror
**Carrier** the document's `phases.<id>.started` and `.completed` after a re-completion and after a reopen.

**Given** an existing entry with `started: S` and a second completion at `T2`, and then a reopen, **When** each transition lands, **Then** the re-completion leaves `started` exactly `S` (never `T2`) and writes `completed: T2`; the reopen writes `completed: null` while keeping `started: S`; and neither branch consults a history lookup (the pre-fix derivation, applied to the same history, produces a different value — asserted as the control).
**Pass** `started` equality across three transitions + `null` on reopen + the control's differing value. **Control** rewriting `started` on the second completion fails naming the two values; writing `T2` instead of `null` on reopen fails naming the field.

#### TC-F5-003 - complete → reopen → re-complete leaves the second completion on all three surfaces and nowhere else

**Type** Regression · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-5, AC-F5-2, API-6, DM-8
**Target** `tests/behaviour/phase-completion-convergence.test.ts` (the named F4 scenario) · **Tags** @behaviour @phase @defect-f4
**Carrier** the fold's value, the `phase list` payload's value, the document's value, and the no-op envelope's `evidence.completedAt`, plus a string scan of both surfaces.

**Given** a real sequence complete(`T1`) → reopen → complete(`T2`), **When** the second completion lands and the command is re-run, **Then** the fold, `phase list` and the document all report `T2`; the string `T1` appears in neither the document nor the `phase list` payload; and the no-op re-run's `evidence.completedAt` is `T2` with `commitSkipped: "no-op"`.
**Pass** three equalities + two absences + the no-op evidence, in one case. **Control** the pre-fix derivation yields `T1` and therefore makes the equality, the absence and the evidence assertions fail — this is the suite's primary discrimination and is executed on every run.

#### TC-F5-004 - A hand-edited completion yields exactly one `lint.phases.divergent` naming phase and both values

**Type** Negative · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-5, AC-F5-3, API-5, DM-8
**Target** `tests/behaviour/pm-notes-lint-divergence.test.ts` (new) over `tests/behaviour/pm-notes-lint-command-support.ts` · **Tags** @behaviour @lint @divergence
**Carrier** the lint failure's `code`, `summary` (phase id + both bounded values), the row's projection `exit`, and the remediation text.

**Given** two conforming surfaces and a ledger-backed phase whose document `completed` was hand-edited to a different timestamp, **When** `lint <ref> --pm-notes --registry` runs, **Then** the verdict is exactly one failure with `code=lint.phases.divergent`, `summary` naming the phase id and both values, exit 1, and the declared remediation; the payload contains no second finding of that code.
**Pass** one finding + phase id + both values + exit + remediation. **Control** a `null` document value against a timestamp fold produces the finding (null and timestamp are different facts); an unchanged pair produces none.

#### TC-F5-005 - A ledger-less phase and a document-only completion are not flagged, with a paired positive

**Type** Negative · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-5, AC-F5-4, API-5, DM-8
**Target** `tests/behaviour/pm-notes-lint-divergence.test.ts` · **Tags** @behaviour @lint @exclusion
**Carrier** finding presence/absence per fixture, the rule's documented exclusion, and the delivered `verify change` verdict.

**Given** three fixtures — a document phase with no ledger transition at all, a document completion with no ledger transition while other phases do have transitions, and (paired positive) one ledger-backed divergence — **When** the both-target lint runs, **Then** the first two produce no `lint.phases.divergent` and the third produces exactly one; and the delivered `verify change` verdict, precedence and read-only contract are unchanged for the same change folder.
**Pass** two absences + one presence + the unchanged verdict in one case. **Control** flagging the document-only completion fails naming the phase; removing the comparison fails the paired positive by name.

#### TC-F5-006 - Detection writes nothing, takes no fence, appends nothing and replays identically

**Type** Contract · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-5, AC-F5-5, API-5, NFR-8
**Target** `tests/behaviour/pm-notes-lint-divergence.test.ts` · **Tags** @behaviour @lint @read-only
**Carrier** the injected runtime's call counters (`writePmNotes`, `appendTransition`, `newFenceToken`, registry/tracker read, clock) and two-run verdict equality.

**Given** the divergence fixture, **When** the both-target lint runs twice, **Then** the document-write, append and fence counters are 0, no tracker read is performed beyond the declared registry fold read, the clock is read 0 times, and both runs produce the identical finding (same code, same summary, same order).
**Pass** five zero counters + two-run equality. **Control** a rule that re-derives the document before comparing fails naming the write count 1; a rule that reads the tracker fails naming the read.

#### TC-F5-007 - No repair surface exists and the lint rows keep their codes, order and remediation

**Type** Contract · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-5, AC-F5-6, DM-8, NFR-6
**Target** `tests/structure/lint-surface.test.ts` (new) + the delivered `error-table` suite · **Tags** @structure @lint @surface
**Carrier** the command grammar/flag set, the lint row order and codes, and the documented↔machine row comparison.

**Given** the command surface and the lint tables, **When** they are inspected, **Then** the `phase` command has no `repair` verb, the `lint` command has no `--fix` flag or write mode, no new phase state kind exists, the five delivered pm-notes rows keep their codes and remediation strings, and the new row is appended last in the declared order with its documented entry present.
**Pass** three absences + five unchanged rows + one appended row in both tables. **Control** adding `--fix` fails naming the flag; reordering the rows fails naming the first moved code; a documented row without its machine row fails naming the code.

#### TC-F5-008 - The both-target lint reports zero new findings over the acceptance corpus, non-vacuously

**Type** Corpus · **Impact** Critical · **Priority** High · **Automation** Semi-automated (recorded)
**Related** F-5, AC-F5-7, NFR-11
**Target** recorded in §10; command in §7.4 (G11) · **Tags** @gate @corpus @lint
**Carrier** the recorded run's compared-phase count and finding count.

**Given** the acceptance corpus (80 change folders dated 2026-10 onward, each with a pm-notes document — measured 2026-11-18, asserted as a floor rather than an equality because the population grows), **When** the both-target lint runs over every folder with the delivery environment's verified registry, **Then** the recorded report shows zero `lint.phases.divergent` findings and a **compared-phase count greater than zero**; any finding is recorded as evidence of a second writer with the folder and phase named.
**Pass** findings = 0 **and** compared > 0. **Control** a zero compared-phase count is an ERROR (an absent registry is never a pass); suppressing a finding by an exclusion list is a blocking finding in review.

#### TC-F6-001 - Claim integrity: single-flight, same-holder renewal, stale takeover, cross-ref conflict

**Type** Contract · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-6, AC-F6-1, API-7, NFR-1
**Target** `tests/behaviour/queue-integrity.test.ts` (new) — `describe("claim integrity")`, extending `tests/behaviour/queue-claim-single-flight.test.ts` and `queue-lease-takeover.test.ts` · **Tags** @behaviour @queue @property
**Carrier** the claim result (`ok`/refusal `code` + holder), the lease records' holder and heartbeat, and the incident record for a takeover.

**Given** a live lease held by holder `A` on ref `R`, **When** (a) holder `B` claims `R`, (b) holder `A` claims `R` again, (c) `A`'s lease is stale and `B` claims `R`, (d) `A` holds ref `S` and `B` claims `R`, **Then** (a) refuses `queue.single-flight` naming `A`, (b) renews `A`'s lease with no second lease record, (c) takes over with one incident record naming the stale lease, (d) refuses `queue.lease-conflict` naming `A`'s repo-exclusive hold.
**Pass** four declaration-matching outcomes in one suite. **Control** (injected breach) a same-holder claim that refuses fails naming the holder; a stale lease not taken over fails naming the heartbeat age; a cross-ref claim that succeeds fails naming the lease.

#### TC-F6-002 - Park integrity: closed causes, battery-only refusal by name, expiry rules, removal releases first

**Type** Contract · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-6, AC-F6-1, AC-F6-5, API-7
**Target** `tests/behaviour/queue-integrity.test.ts` — `describe("park integrity")` · **Tags** @behaviour @queue @property
**Carrier** the park record's `cause`/`condition`/`recheckMs`, the refusal `code` + detail, and the removal run's park state.

**Given** the delivered park vocabulary, **When** (a) a cause outside the closed set is supplied, (b) `liveness-stall` is supplied on the operator path, (c) `provider-window` is supplied without an expiry, (d) `owner-hold` is supplied with an expiry, (e) a parked entry is removed, **Then** (a) refuses naming the value, (b) refuses that cause by name, (c) refuses naming the missing expiry, (d) refuses naming the forbidden expiry, (e) appends a `released` park record before the removal so no active park remains.
**Pass** five outcomes. **Control** (injected breach) accepting `liveness-stall` on the operator path fails naming the cause; accepting an expiry on `owner-hold` fails naming the cause; leaving the park active after removal fails naming the fold.

#### TC-F6-003 - Reconcile integrity: done/canceled only, retained unobserved, bounded with remainder, `--ref` narrows

**Type** Contract · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-6, AC-F6-1, AC-F6-6, API-7
**Target** `tests/behaviour/queue-integrity.test.ts` — `describe("reconcile integrity")` · **Tags** @behaviour @queue @property
**Carrier** the reconcile payload's `removed[]`/`retained[]`/remainder, and the examined count.

**Given** entries in `done`, `canceled`, `in-progress` and `in-review` states plus one unobserved item and a queue longer than the examined cap, **When** `queue reconcile` runs, **Then** only `done` and `canceled` are removed, the `in-review` and unobserved items are retained with their state (or the not-found fact), the examined count equals the cap and the remainder is reported explicitly, and `--ref` narrows the run to exactly one entry with a one-entry payload.
**Pass** the removed/retained multisets + the remainder + the narrowed run. **Control** (injected breach) removing `in-review` fails naming the state; dropping the remainder fails naming the count; `--ref` matching a prefix fails naming the extra entries.

#### TC-F6-004 - CRUD integrity: one edge per add, one-edge removal, add-only cycle check, no cascade

**Type** Contract · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-6, AC-F6-1, API-7
**Target** `tests/behaviour/queue-integrity.test.ts` — `describe("CRUD integrity")` · **Tags** @behaviour @queue @property
**Carrier** the dependency records' `edges`, the mutation result vocabulary, and the removal's effect on other entries.

**Given** the delivered add/prioritize/`dep add`/`dep remove`/remove verbs, **When** (a) an accepted `dep add` runs, (b) `dep remove` runs, (c) a `dep add` would close a cycle, (d) an entry with dependents is removed, **Then** (a) writes exactly one new edge and reports `added`, (b) removes exactly that one edge and reports `removed`, (c) refuses `queue.dependency-cycle` naming the existing path, (d) cascades nothing and leaves dependent entries present with their edges minus the removed ref.
**Pass** the edge deltas + the cycle path + the no-cascade state. **Control** (injected breach) an add creating two edges fails naming the count; a cascade fails naming the surviving set; a cycle check that only looks at direct edges fails naming the path length.

#### TC-F6-005 - Reason-bearing removal: four reasons, the full refusal set, zero appends, deliberate non-idempotency

**Type** Contract · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-6, AC-F6-1, AC-F6-2, API-7
**Target** `tests/behaviour/queue-integrity.test.ts` — `describe("reason-bearing removal")` · **Tags** @behaviour @queue @property
**Carrier** the removal result, the refusal `code`/`detail`, the append count, and the explicit-versus-automatic comparison.

**Given** the four declared reasons and the delivered refusal set, **When** each of missing reason, out-of-vocabulary reason, non-canonical ref, unobserved ref and a live lease naming its holder is supplied, **Then** each refuses with its declared identity and appends zero records; and when the same ref is removed twice explicitly, the second run refuses `queue.entry.unobserved` while the automatic closeout path converges to `satisfied`.
**Pass** five refusals × zero appends + the explicit/automatic asymmetry. **Control** (injected breach) a refusal that appends fails naming the count 1; making the explicit verb idempotent fails naming the second result.

#### TC-F6-006 - Single-flight names the live holder at the envelope root within its bound

**Type** Contract · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-6, AC-F6-1, API-7
**Target** `tests/behaviour/queue-integrity.test.ts` — `describe("single-flight")` · **Tags** @behaviour @queue @property
**Carrier** the refusal's envelope root holder field and its character bound.

**Given** a live lease held by holder `A`, **When** a same-ref claim by `B` is refused, **Then** the holder appears at the envelope root (not only in a nested detail), equals `A` exactly, and stays within the declared character bound.
**Pass** root-level field + exact holder + bound. **Control** (injected breach) a refusal without the root holder fails naming the missing field; a holder naming a stale previous holder fails naming both.

#### TC-F6-007 - Presence is decided by append position, never by timestamp text, and re-declaration restores

**Type** Contract · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-6, AC-F6-1, API-7
**Target** `tests/behaviour/queue-integrity.test.ts` — `describe("append-position presence")` · **Tags** @behaviour @queue @property
**Carrier** the folded presence of a ref after a removal and a later re-declaration, with deliberately inverted timestamp text.

**Given** an entry added at sequence 3 and removed at sequence 7 with a *lexicographically earlier* `recordedAt`, **When** the fold runs, **Then** the ref is absent; and when it is re-declared at sequence 9 with an earlier `recordedAt` than the removal, it is present again with no special case.
**Pass** absent-then-present with the timestamps inverted in both runs. **Control** (injected breach) presence computed from `recordedAt` fails naming both timestamps; a special-case branch for re-declaration fails the second half by naming the branch (the presence rule must be sequence-only).

#### TC-F6-008 - The automatic `landed` removal is unchanged across the milestone step insertion

**Type** Regression · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-6, AC-F6-4, API-7, DM-4
**Target** `tests/behaviour/closeout-queue-removal.test.ts` (extend) + `closeout-milestone-sync.test.ts` · **Tags** @behaviour @closeout @queue @regression
**Carrier** `CloseoutQueueRemovalData`, the removal record count, the fence-acquisition count, and the step/exit equality across three milestone variants.

**Given** three apply runs over the same queue fixture — milestone applied, milestone withheld, milestone gap — **When** `closeout --apply` completes, **Then** each run appends exactly one removal record with reason `landed` (none on a re-run), acquires exactly one fence token, and produces the same step outcomes and exit code as the same fixture without a milestone step; the queue-removal block remains a non-step disclosure (absent from `steps[]`).
**Pass** three runs × (1 removal, 1 fence, equal steps/exit) + the non-step assertion. **Control** a second fence acquisition fails naming the count 2; a re-run appending a duplicate removal fails naming the record count; a swallowed removal fails naming `outcome: "skipped"` when merge truth is present.

#### TC-F6-009 - A parked entry's removal appends the park release first, durably, in one fenced transaction

**Type** Contract · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-6, AC-F6-5, API-7
**Target** `tests/behaviour/queue-integrity.test.ts` — `describe("park release ordering")` · **Tags** @behaviour @queue @property
**Carrier** the two appended records' sequence numbers, the durable park record, and the append count on refusal.

**Given** an entry with an active park and a held lease, **When** a removal with a valid reason is refused on the lease precondition and then accepted after release, **Then** the refusal appends nothing and leaves the graph document byte-identical, and the accepted removal appends the `released` park record at a lower sequence than the removal record inside one fence, with both records readable afterwards.
**Pass** refusal-appends-0 + sequence ordering + both records durable. **Control** (injected breach) appending the removal first fails naming the two sequences; dropping the park release fails naming the active park; a two-fence implementation fails naming the acquisition count.

#### TC-F6-010 - The delivered bounds, reasons and refusal detail are unchanged and truncation is reported

**Type** Contract · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-6, AC-F6-6, API-7, NFR-4
**Target** `tests/structure/queue-bounds.test.ts` (new) + `tests/behaviour/queue-integrity.test.ts` · **Tags** @structure @queue @bounds
**Carrier** the cap/reason constants, the refusal detail bound, and the payload's reported remainder.

**Given** the delivered constants, **When** they are inspected and exercised, **Then** the reconcile examined-entry cap, the folded-read cap and the four removal reasons equal their delivered values, a refusal's detail stays within its character bound with the offending value bounded, and a truncated reconcile reports its remainder rather than omitting it.
**Pass** constant equality + bound + remainder. **Control** (injected breach) raising the examined cap fails naming the constant; truncating the detail without a bound fails naming the length; a truncated run with no remainder fails naming the missing field.

#### TC-F6-011 - The queue surface gained no verb, record kind, state key or flag

**Type** Contract · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-6, AC-F6-3, API-7, NFR-6
**Target** `tests/structure/queue-surface.test.ts` (new) · **Tags** @structure @queue @surface
**Carrier** exact sets over the command's verb list, the record declaration kinds, the key builders and the flag grammar.

**Given** the queue surface, **When** it is inspected, **Then** the verb set, the record-kind set, the state-key builders and the flag grammar equal their delivered sets exactly (add/remove in either direction fails), and no new verb, kind, key or flag exists.
**Pass** four exact-set equalities. **Control** adding a verb fails naming it; removing a delivered verb fails naming it (both directions); a new record kind fails naming the kind.

#### TC-F6-012 - A repair restores only the declared sentence, and its control still fails on the breach

**Type** Contract · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-6, AC-F6-2, API-7, NFR-6
**Target** `tests/behaviour/queue-integrity.test.ts` + `tests/fixtures/queue/integrity-breaches.ts` (new) · **Tags** @behaviour @queue @repair
**Carrier** the pre-repair breach result, the post-repair declared outcome, the vocabulary/key/flag sets before and after, and the control's persistent failure.

**Given** any property whose control demonstrates a breach, **When** the repair lands, **Then** the property's declared outcome is restored, the vocabulary/key/flag sets are unchanged, no refusal became a success, and the control still fails on the injected breach; and the delivery records which of the seven properties proved clean without a repair.
**Pass** restored outcome + unchanged sets + the control still failing + the recorded clean/breach list. **Control** a "repair" that widens a vocabulary or turns a refusal into a success fails naming the changed member; a repair that also disables the control fails naming the missing failure. This case is the guard against repairing a symptom (spec §3, NG-6).

#### TC-F7-001 - F1: a gate-family refusal carries its family code, kind `merge` and exit 1 with containment absent

**Type** Regression · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-7, AC-F7-1, AC-F2-5, DM-2, NFR-6
**Target** `tests/structure/defect-f1-merge-refusal-containment.test.ts` (new; extends the delivered `merge-classification-conformance.test.ts`) · **Tags** @structure @defect-f1 @classification
**Carrier** the classifier's result for a gate-family code, the expanded emittable declaration's membership, the per-member kind check, and the mismatch control.

**Given** a landing refusal on a declared gate, **When** the failure is classified end to end, **Then** the emitted code is `merge.gate.<gate-id>.failed` for the resolved gate id, the classifier returns a row whose `domainKind` is `merge`, the projection exit is 1, `fallback.internal` appears nowhere in the outcome or the summary, the composition's declared emittable set expanded over its declared family expression contains that code, and no member of the declaration resolves to a row of a different kind.
**Pass** code + kind + exit + containment absent + declaration membership + per-member kind equality. **Pre-fix failure** with the delivered seventeen-member declaration the family code is outside the proof's domain, so the totality assertion reports it uncovered (the code resolves and classifies, but nothing proves the set is exhaustive) — the suite fails naming the uncovered code, not the classifier. **Control** a live kind/code mismatch (`{kind:"provider", code:"config.credential.missing"}`) still classifies as `fallback.internal`, so the assertion cannot pass by the containment branch being dead.

#### TC-F7-002 - F1 control: the pre-fix emittable declaration fails the totality proof by name

**Type** Negative · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-7, AC-F7-1, AC-F7-4, DM-2
**Target** `tests/structure/defect-f1-merge-refusal-containment.test.ts` · **Tags** @structure @defect-f1 @control
**Carrier** the pre-fix declaration value (seventeen codes, no gate family) and the same totality predicate applied to it.

**Given** the pre-fix declaration — the delivered configuration codes plus the three read identities and the seven merge identities, with no `merge.gate.<gate-id>.failed` member — **When** the same totality predicate runs over it, **Then** it reports the family code as uncovered, naming the code and the missing member class; the production declaration passes the same predicate; and the two results differ (asserted as `preFix.uncovered.length > 0 && production.uncovered.length === 0`).
**Pass** the pre-fix failure is named and the production pass is asserted in the same case. **Control** a control that copies the production declaration would report zero uncovered and fail this case by name — which is exactly the vacuity this case exists to prevent.

#### TC-F7-003 - F4: the defect-named suite fails on the pre-fix lookup and passes on the fold

**Type** Regression · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-7, AC-F7-2, AC-F5-1, AC-F5-2
**Target** `tests/behaviour/defect-f4-phase-mirror.test.ts` (new; the suite named after the stale-completion defect) · **Tags** @behaviour @defect-f4 @control
**Carrier** the pre-fix derivation's value, the production surfaces' values, the divergence finding, and the write/fence counters.

**Given** the complete → reopen → re-complete history, **When** the suite's primary assertion runs, **Then** the pre-fix derivation (`history.find(phase && operation === "complete")`) yields `T1`, the production fold, `phase list` and the document yield `T2`, and the suite asserts `T1 !== T2` before asserting the equalities — so the suite fails if the production value ever becomes `T1`. The suite's companions assert the hand-edited divergence finding, the document-only exclusion, and zero writes/fences, each with its own control.
**Pass** the discriminating inequality plus the three companions, all in one named suite. **Pre-fix failure** the delivered convergence branch takes the first matching completion in history (`transitions.find(...)`), which is `T1`; the document and the no-op evidence therefore carry `T1`, so the equality with `T2` and the absence scan both fail — and the pre-reopen timestamp is reported as the no-op evidence. **Control** the pre-fix value is asserted to be exactly `T1` (not "different from T2"), so a control that merely returns the fixed value fails by name.

#### TC-F7-004 - F8: a three-merge serial fixture shows ≤1 landing each, zero head mutations and typed sync refusals

**Type** Regression · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-7, AC-F7-3, AC-F2-1, AC-F2-6
**Target** `tests/behaviour/defect-f8-serial-merge-churn.test.ts` (new) over `tests/fixtures/merge/serial-three.ts` (new) · **Tags** @behaviour @defect-f8 @churn
**Carrier** the per-invocation landing counts, the git head-mutation counter, the refresh event count, and the second/third refusal codes.

**Given** a serial sequence of three merges from the same base where the second and third read `conflicting`/`not-mergeable`, **When** the three invocations run, **Then** each performs at most one landing call (the first exactly one, the second and third zero), the head-mutation counter stays 0 across all three, no `git-rebase-refresh` event occurs, and the second and third resolve as `merge.sync-required` refusals whose remediation instructs the coordinator to sync.
**Pass** 1/0/0 landing + head mutations 0 + refresh events 0 + two typed refusals. **Pre-fix failure** the delivered transaction performs one local rebase-refresh on a `conflicting` request; the refresh moves the head, voids the SHA-bound verification, and refuses with the stale identity, so the serial fixture records one head mutation and one refresh event per non-first invocation and the suite fails naming the invocation index and the head pair. **Control** the pre-fix refresh is injected through the harness's git fake; the head-mutation assertion then reports 1 (or 2) — proving the assertion discriminates rather than describing a run that never mutates.

#### TC-F7-005 - Each defect suite fails by name when its primary assertion is removed, and its control executes

**Type** Contract · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-7, AC-F7-4, NFR-1
**Target** `tests/structure/defect-suite-presence.test.ts` (new) · **Tags** @structure @defect @meta
**Carrier** a declared assertion registry (suite file, primary assertion id, control id) and the observed execution of each.

**Given** the three defect suites and the queue-integrity suite, **When** the meta-check runs, **Then** each declared primary assertion id is present in its file, each declared control id is present and executed and asserts a *differing* value from production, and removing a primary assertion (simulated by a text-level presence check over the file) fails naming the suite and the missing id.
**Pass** registry ↔ file bidirectional equality + control-differs assertion. **Control** a suite with a primary assertion but no control fails naming the missing control; a control that asserts the production value fails naming the non-difference.

#### TC-F7-006 - The defect and integrity suites ride the existing test jobs offline with the topology contract green

**Type** Contract · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** F-7, AC-F7-5, NFR-2
**Target** `tests/checks/merge-suite-discovery.test.ts` (new) + the delivered `tests/structure/ci-topology-pin.test.ts` · **Tags** @checks @structure @topology
**Carrier** the discovery count for the named files under `bun test`, the workflow pin's file/job/trigger sets, and both guards' counters.

**Given** the four new suite files, **When** the discovery check runs, **Then** each file path is matched by `bun test` discovery (it is not under `tmp/`, a git-ignored directory, or named as a fixture), the aggregate `test` stage includes it, the workflow pin's file set, per-file job set and triggers equal the pins, and both guards report zero network and zero child-process calls for the new suites.
**Pass** four discoveries + three pin equalities + two zero counters. **Control** moving one suite under `tmp/` fails naming the file and the ignore pattern; adding a job fails naming the job (the pin's own mutation already proves this and is reused, not duplicated).

#### TC-SYNC-001 - The identity total moves 149 → 152 on both tables with no pattern widening and no orphan row

**Type** Contract · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** AC-F2-5, DM-2, DM-8, NFR-6
**Target** `tests/checks/error-table-sync.test.ts` (extend the pinned counts and add the three-row delta assertion) · **Tags** @checks @error-table @pins
**Carrier** the bidirectional sync result's `sourceEntries`/`documentedRows` counts, the three new rows' presence in both tables, and the family slot rules.

**Given** the change's three additive rows, **When** the sync check runs, **Then** `sourceEntries` and `documentedRows` both equal 152, the documented "N identities" statement equals 152, each new row appears in both tables with identical fields, no family pattern admits a code outside its declared slot set (the merge-gate id must resolve to a registered gate id, the closeout step id to a `CLOSEOUT_STEP_IDS` member), and every new row is reachable from a named branch.
**Pass** 152/152 + per-row equality + two slot rules + the reachability table. **Control** a row added to one table only fails naming the code and the side; a widened pattern (`merge.gate.*.failed`) fails naming the id; a count moved to 152 in one place only fails naming both values.

#### TC-SYNC-002 - Step inventory, residue kinds and their pins move exactly, in every place they exist

**Type** Contract · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** AC-F4-1, DM-4, DM-5, NFR-6
**Target** `tests/structure/closeout-additive.test.ts` + `tests/structure/closeout-contract.test.ts` + `tests/checks/capsule-bounds.test.ts` (all extend) · **Tags** @structure @checks @closeout @pins
**Carrier** the step set in both production places, the residue set, the documented inventory text, and the residue producers map.

**Given** the change's two additive entries, **When** the pins are inspected, **Then** `CLOSEOUT_STEP_IDS` and `closeoutStepDefinitions` agree at 13 ids in the same order, the documented inventory states thirteen, `CAPSULE_RESIDUE_KINDS` has 9 members with `milestone-sync-withheld` last and its unique count is 9, the residue producers map's key set equals the residue set, and the dedup/order/50-item-cap behaviour is unchanged.
**Pass** both step places + documented text + residue count + producers key-set equality. **Control** moving only `CLOSEOUT_STEP_IDS` fails naming the mismatch with `closeoutStepDefinitions`; adding a residue kind without a producer fails naming the kind; changing the cap fails naming the value.

#### TC-SYNC-003 - The tenth operation moves the registry, both coverage gates, thirty parity cells and the mock routes atomically

**Type** Contract · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** AC-F1-7, DM-6, DM-7, NFR-7
**Target** `tests/conformance/parity-gate.test.ts` (extend the cell census) + `tests/structure/conformance-coverage.test.ts` (extend) + `tests/conformance/mock-conformance.test.ts` (extend the route) · **Tags** @conformance @structure @parity
**Carrier** the matrix cell multiset (30), the three adjudicated cells, the registry's representation of the operation, the gap encounters, the mock route and expected projection, and the family accounting (18).

**Given** the appended operation, **When** the conformance surfaces are inspected and executed, **Then** `ADAPTER_OPERATIONS` is exactly ten with `close-milestone` last; the matrix has 30 cells with GitHub `same-as-reference`, GitLab `gap` citing `adapter-not-implemented`, Jira `gap` citing `provider-unsupported`; the flow registry represents the operation with an executing step (GitHub) or a gap-reaching step (the others); the structural gate's requirement says ten and the runtime gate executes the supported path and encounters both gaps with their exact reasons; the mock tenant carries the write route and its read-back route with expected projections; and the six-family × three-adapter accounting is still 18.
**Pass** the multiset + three cell kinds with exact reasons + both gates + the mock projection + 18. **Control** adding the operation to the family vocabulary fails naming the family; omitting the mock route fails naming the operation; a cell without adjudication fails naming the pair; the register gains an orphan entry → fails naming it.

#### TC-SYNC-004 - The normalized title is one additive optional field with absence semantics and no schema change

**Type** Contract · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** AC-F1-6, DM-1, NFR-6
**Target** `tests/structure/port-contract-inventory.test.ts` (extend) + `tests/types/delivery-request-title.type-test.ts` (new) · **Tags** @structure @types @contract
**Carrier** the normalized request's key set and the optionality probe.

**Given** the normalized request type and its normalization output, **When** the contract inventory runs, **Then** `title` is present as an optional property, every delivered field is still present with its delivered type (no removal, no retype, no new required field), no schema version changed, and a probe asserts that constructing a request without `title` compiles and reports no title downstream.
**Pass** key-set superset by exactly one optional key + no schema change + the compile probe. **Control** making `title` required fails the compile probe naming the missing property; deriving a title from `sourceRef` when absent fails `TC-F1-007`.

#### TC-SYNC-005 - The transaction record keeps its shape and its landing identity changes provenance only

**Type** Contract · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** AC-F1-2, AC-F1-9, DM-3
**Target** `tests/structure/merge-contract.test.ts` (extend) + `tests/behaviour/merge-convergence.test.ts` · **Tags** @structure @behaviour @merge @record
**Carrier** the record's exact key set, the delivered record reader's accepted shape, and the legacy-record re-run behaviour.

**Given** a `merge.transaction` record written before this change (its `squashSha` a local commit) and a fresh record written after, **When** each is read and re-run, **Then** both parse with the same key set; the fresh record's `squashSha` equals the provider's merge commit; and the legacy record's re-run re-verifies rather than re-landing (zero landing calls when the provider asserts merged, one when it does not).
**Pass** key-set equality for both records + provider provenance for the new one + the legacy re-run behaviour. **Control** a record with an added field fails naming the key; a legacy re-run that re-lands fails naming the landing count.

#### TC-SYNC-006 - The lint registry read gains the verified fold additively and nothing else changes

**Type** Contract · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** AC-F5-3, DM-8
**Target** `tests/structure/lint-registry-read.test.ts` (new) + the delivered `pm-notes-lint-command-support.ts` · **Tags** @structure @lint @read
**Carrier** the `LintRegistryRead` shape, its existing fields' values, and the new fold field's content.

**Given** a registry with verified transitions, **When** the lint runtime reads it, **Then** the read's delivered fields (`verifiedEmpty`, `recordCount`, `verification`, `projection`) keep their exact values and types, the new fold field carries the same `phases` map `foldPhaseState` produces for those transitions (asserted by equality with a direct fold), and no other read in the command changed.
**Pass** delivered-field equality + fold equality + no other read. **Control** a fold field that carries the *document's* phases instead of the fold's fails naming the differing phase; a delivered field whose value moved fails naming it.

#### TC-SYNC-007 - Milestone observation keeps four distinct facts and never collapses them

**Type** Contract · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** AC-F4-9, DM-9, NFR-5
**Target** `tests/structure/closeout-milestone-contract.test.ts` + `tests/behaviour/closeout-milestone-sync.test.ts` · **Tags** @structure @behaviour @closeout @absence
**Carrier** four read outcomes decoded into the provider-neutral shape: absent surface, unavailable signal, unknown state, truncated set.

**Given** the four read outcomes, **When** each is decoded, **Then** each yields a distinct shape: absent surface → the adapter's declared gap; unavailable signal → a present read with an unavailable marker; unknown state → a record with `state: "unknown"`; truncated set → a record with the truncation marker — and none of the four yields an empty attached set or a `closed` state.
**Pass** four distinct decodes + zero empty-set collapses. **Control** mapping unavailable to `[]` fails naming the two outcomes; mapping unknown state to `open` fails naming the state.

#### TC-SYNC-008 - Forbidden acts are unrepresentable in the landing, mutation and close-milestone vocabularies

**Type** Contract · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** AC-F2-6, AC-F4-5, NFR-9
**Target** `tests/types/forbidden-acts.type-test.ts` (new) + `tests/structure/merge-contract.test.ts` + `tests/structure/queue-surface.test.ts` · **Tags** @types @structure @unrepresentable
**Carrier** the landing strategy union, the landing input type, the close-milestone argument/effect unions, and the queue mutation union.

**Given** the four vocabularies, **When** the type probes compile, **Then** `"force"`, `"bypass"`, `"auto-merge"`, `"queue"` and `"rebase"` are not assignable to the landing strategy or input; the close-milestone arguments admit only a milestone identity and its effect union has one member; and the queue mutation union equals its delivered set. Each negative probe carries a one-line reason.
**Pass** eight compile-time negatives + two union equalities. **Control** widening any union fails the corresponding probe with a compile error naming the file; a probe deleted to make the build pass fails `TC-F7-005` naming the missing assertion.

#### TC-FLOOR-001 - Every moved pin moves exactly, is not loosened, and fails by name when only one side moves

**Type** Regression · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** NFR-6, AC-F2-5, AC-F4-1, AC-F6-3
**Target** `tests/structure/closeout-contract.test.ts`, `tests/checks/error-table-sync.test.ts`, `tests/checks/capsule-bounds.test.ts`, `tests/structure/content-inventory.test.ts`, `tests/conformance/parity-gate.test.ts`, `tests/structure/queue-surface.test.ts` (all extend) · **Tags** @structure @checks @pins
**Carrier** the nine moved values: merge concrete rows 7→9, lint rows 6→7, pm-notes family 5→6, identity total 149→152, steps 12→13, residue 8→9, operations 9→10, parity cells 27→30, family accounting 18 unchanged.

**Given** the change's declared deltas, **When** the pin suite runs, **Then** each value equals its declared after-state in **every** place it exists, no pin is loosened (no `toBeGreaterThan` where an equality is declared, no wildcard in an allowlist, no skipped assertion), and the delivered statements ("N identities", "twelve-step" → "thirteen-step", "nine operations" → "ten") match.
**Pass** nine exact values, each asserted where it lives. **Control** a single-place move fails naming both values; a loosened pin fails naming the loosening; a documented statement left at the old number fails naming the file and the number.

#### TC-FLOOR-002 - The added suites are offline and the testkit stays runtime-neutral

**Type** Regression · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** NFR-2, NFR-10
**Target** `tests/boundaries/**` (delivered) + `tests/checks/testkit-exclusion` (delivered) · **Tags** @boundaries @checks @hermetic
**Carrier** both guards' counters, the dependency-cruiser runtime-API confinement rule, and the ambient-globals scan.

**Given** the new suites and the testkit modules, **When** the boundary tier runs, **Then** the network guard and the child-process guard both report zero calls for the new suites (the git seam's child processes appear only in the delivered local-repository suites), testkit has zero `node:*`/`bun:*` imports and zero ambient environment/clock/randomness reads, and the fixture-coverage meta-check still passes every rule.
**Pass** two zero counters + the confinement rule + the meta-check. **Control** a planted `fetch(` in a new suite fails naming the guard and the URL; a planted `node:fs` import in testkit fails naming the file and the construct.

#### TC-FLOOR-003 - No adapter behaviour changed beyond the new operation and its two declared gaps

**Type** Regression · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** NFR-7, §24.3(14)
**Target** `tests/behaviour/providers/**` (delivered, read-only) + `tests/structure/**` capability pins · **Tags** @behaviour @structure @adapters
**Carrier** each adapter's `supportedOperations` and `declaredGaps` sets and reasons, and the delivered provider suites' results.

**Given** the three adapters, **When** their declarations and delivered suites are compared with the pre-change values, **Then** GitHub's supported set is the delivered nine plus `close-milestone` and nothing else moved; GitLab and Jira gain exactly the one `close-milestone` gap with its declared reason and no other change; every delivered gap reason is byte-identical; and the delivered provider suites are green.
**Pass** per-adapter set-and-reason diff of exactly the declared delta. **Control** flipping one delivered reason fails naming the adapter and the operation; adding a support flag fails naming the operation.

#### TC-FLOOR-004 - No new network location, credential path or secret-read allowlist entry

**Type** Regression · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** NFR-3
**Target** `tests/checks/**` (delivered `secret-read-boundary` and sanitization suites) · **Tags** @checks @security
**Carrier** exact equality of the secret-read allowlist, and the sanitization canary result.

**Given** the change's new reads and writes, **When** the boundary checks run, **Then** the secret-read allowlist equals the delivered set exactly (no added entry, no widened pattern), the planted-secret canary is still detected, and the new fixtures pass the sanitization/privacy audits with provenance markers and example-only hosts.
**Pass** allowlist equality + canary positive + fixture audit. **Control** adding one allowlist entry fails naming the file and pattern; removing the canary detection fails naming the canary.

#### TC-FLOOR-005 - Determinism and byte pins: two replays are identical, the moved attribution golden matches, and the other goldens do not move

**Type** Contract · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** NFR-1, NFR-6
**Target** `tests/behaviour/merge-determinism.test.ts` (extend), `tests/behaviour/closeout-*` (extend), `tests/behaviour/pm-notes-lint-determinism.test.ts` (extend), `tests/golden/merge.test.ts` (extend), `tests/fixtures/merge/golden/**` · **Tags** @behaviour @golden @determinism
**Carrier** committed goldens for the refusal summary and the closeout plan/operation id, canonical-JSON equality across two runs, and the golden file set itself.

**Given** one declared input per surface, **When** each runs twice, **Then** the merge refusal summary, the closeout plan, the derived operation ids, the lint verdict and the phase fold are byte-identical across runs and equal to their committed goldens (with normalized paths and no absolute timestamps). Additionally, `refusal-gate-human.txt` and `refusal-gate-scripted.json` match the regenerated bytes **including** the attribution line, while `refusal-{stale,tracker,waiver,override,rebase}-{human.txt,scripted.json}` and `success-{human.txt,data.json,scripted.json}` are byte-identical to their pre-change content.
**Pass** two-run equality + the moved golden's equality + the thirteen unchanged goldens' equality (the moved pair is named, not merely "the set"; the fixture directory holds fifteen files, so the split is 2 moved + 13 unchanged). **Control** a blanket regeneration that also rewrites an unrelated golden fails naming that file; a map-iteration-ordered output fails naming the reordered element; a wall-clock-derived field fails naming the differing field.

#### TC-FLOOR-006 - The pinned CI topology is unchanged and the new suites are discovered by the existing jobs

**Type** Contract · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** AC-F7-5, NFR-12
**Target** the delivered `tests/structure/ci-topology-pin.test.ts` (read-only) + `tests/checks/merge-suite-discovery.test.ts` · **Tags** @structure @checks @topology
**Carrier** the workflow pin's file/job/trigger sets and check-name inventory, and the discovery result.

**Given** the repository's workflows, **When** the pin runs, **Then** the workflow file set, per-file job set, per-file trigger set and the two pinned suites' check-name inventories equal the pins, and the new suites are discovered through the existing `test` stage with no path filter.
**Pass** the three pin equalities + discovery. **Control** the pin's own mutations (added job, added file, added trigger, deleted check) are reused rather than duplicated; a new suite under `tmp/` fails naming the file.

#### TC-FLOOR-007 - The gate battery and the corpus measurement are recorded with the `TMPDIR` convention

**Type** Quality gate · **Impact** Critical · **Priority** High · **Automation** Recorded
**Related** NFR-12, NFR-11
**Target** the repository root; §7.4 G1–G12 · **Tags** @gate
**Carrier** the §10 rows: command, exit code, one-line result, and the corpus counts.

**Given** the completed change, **When** every gate in §7.4 runs with `TMPDIR=$PWD/tmp/tmpdir`, **Then** each exits as declared, the corpus row reports its compared-phase count and finding count, the topology check passes or reports a named finding, and `git diff --check` is clean.
**Pass** the recorded rows, with `pnpm check` green. **Control** a narrow-suite pass never substitutes for G12; a missing `origin/main-tools` is an ERROR, never a skip.

#### TC-FLOOR-008 - Every new diagnostic and outcome stays within its bound and leaks no provider content

**Type** Contract · **Impact** Critical · **Priority** High · **Automation** Automated
**Related** NFR-13, DM-5
**Target** `tests/behaviour/merge-bounds.test.ts` (extend), `tests/behaviour/closeout-bounds.test.ts` (extend), `tests/behaviour/merge-privacy.test.ts` (extend) · **Tags** @behaviour @bounds @privacy
**Carrier** the human line/byte counts with explicit `+N`, the residue item count and sentinel, the refusal detail length, the landing message's line count and bytes, and a scan for provider prose/titles/bodies.

**Given** an over-long refusal (many gate ids, job names and conflict paths), an over-long residue set, and a landing whose title is the provider's full title, **When** each is rendered, **Then** the summary stays inside the human line/byte bounds with an explicit `+N` mark, the residue stays within the 50-item cap plus its sentinel, the refusal detail stays within its character bound, the landing message is exactly one line inside the message bound with no interpolated value, and no credential, provider payload, body or provider prose appears.
**Pass** five bound assertions + the absence scan. **Control** an unbounded list fails naming the line count; a two-line or interpolated message fails naming the line count and the offending bytes; a title copied from the provider body fails naming the leaked field.

## 6. Environments and Test Data

- **Execution environment**: local dev / CI, fully offline. No network, no live credential, no live provider, no child process outside the git seam the delivered local-repository suites already declare. The mock tier's network guard and child-process guard are the enforcement, and `TC-FLOOR-002` asserts their counters rather than the absence of an error.
- **Runner and shell**: `bash`/`zsh` from the repository root; `bun` pinned by `.bun-version`; `pnpm` pinned by `packageManager`. Every gate command uses a repository-local temp root via `TMPDIR=$PWD/tmp/tmpdir` (`tmp/` is git-ignored, and `bunfig.toml` excludes `tmp/**` from discovery — which is why `TC-F7-006` asserts the new suites are *not* under an ignored path).
- **Clock and identifiers**: the merge harness's injected `MERGE_CLOCK_MS`/`MERGE_CLOCK_ISO`; the closeout harness's fixed `CLOSEOUT_TIMESTAMP`; the phase and lint fixtures' explicit timestamps (`T1`, `T2` are literals in the fixture, never `Date.now()`). No real UUIDs, no randomness, no ambient environment reads on any asserted path.
- **Credentials**: the delivered non-secret canaries only (`conformance-canary-credential-value` and the runtime-constructed token-shaped canary used by the redaction cases). No new secret, no new allowlist entry.
- **Local repositories**: the closeout apply path runs against the delivered fake git/state harness (`tests/fixtures/closeout/harness.ts`, `makeGit`, `makeState`) and, where a real worktree is required, a `mkdtemp` local repository created and destroyed inside the case. The merge landing path uses the harness's injected ports; the delivered `createLandingRepo` helper remains for the seam-level suites only.
- **Merge fixtures**: `tests/fixtures/merge/harness.ts` is extended with a recording landing port (`{deliveryRequest, strategy, expectedHeadSha, commitTitle, commitMessage}` per call, plus a call counter), a `title`-bearing `baseRequest`, the four read-back shapes (merged with commit, merged without commit, not merged, refusal), and two required-job scenarios whose recorded verdict is green (attribution `probe`) and non-pass (attribution `recorded`). The persisted `merge.gate-verification` record for the recorded scenario carries a known `verifiedAt`, which is the corroboration `TC-F3-003` reads by gate id + job; the refusal evidence holds no timestamp. The fake git records `git-rebase-refresh`, `git-squash-land` and head mutations in its event log.
- **Byte-pinned goldens**: `tests/fixtures/merge/golden/` holds fifteen files. `refusal-gate-human.txt` and `refusal-gate-scripted.json` are **regenerated** in this change because the required-job refusal summary gains the attribution line; the other five refusal pairs and the three `success-*` files are **unchanged by obligation** and are compared byte-for-byte. Regeneration is an explicit command recorded in §10, never a blanket rewrite.
- **Conformance tenants**: the **GitHub** tenant (`tests/fixtures/providers/conformance/github/tenant.json`) is the only one this change touches and only by appending the `close-milestone` write route and its read-back route with their expected projections — no delivered route is removed, reordered or retyped, and the stateless projections of the delivered routes stay byte-identical. The **GitLab and Jira** tenants (`…/{gitlab,jira}/tenant.json`) are byte-unchanged: their posture is a declared gap, and adding a route there would assert a capability the adapters do not claim. The committed tenants remain sanitized synthetic documents under the delivered audit.
- **Declared byte values live in the cases**: the trailer literal `Landed by the delivery lifecycle merge primitive.` and the fallback `merge(<ref>): squash <sourceRef>` are written in `TC-F1-006`/`TC-F1-007` as expected strings and compared with the landing port's captured input; neither is imported from the production composer (GAP-TP-7).
- **Closeout/milestone fixtures**: `tests/fixtures/closeout/milestone.ts` (declaration/observation builders), `tests/fixtures/closeout/m4-attached-set.ts` (a synthetic M4-shaped attached set: the change's own ticket done, at least one other open), and `tests/fixtures/providers/conformance/milestone/**` (record open/closed/unknown, attached sets all-done, one-open, truncated, absent surface, unavailable signal). Every JSON carries `"provenance": "hand-authored-synthetic 2026-11-18"`, example-only hosts, declared placeholders, no email/avatar/token/PEM/private-repository reference and no absolute path.
- **Phase/lint fixtures**: `tests/fixtures/phase/**` (transition histories including complete→reopen→re-complete and the ledger-less/document-only cases) and `tests/fixtures/lint/divergence.ts` (typed builders pairing a document value with a fold value, including `null` vs a timestamp).
- **Queue fixtures**: `tests/fixtures/queue/integrity-breaches.ts` — seven typed builders, one per property, each injecting exactly one breach over the production shapes, so a breach cannot silently stop being a breach when a type changes (a compile error, not a passing no-op).
- **Pins are read, never copied**: every count in §7.5 is asserted by importing the production constant (`CLOSEOUT_STEP_IDS`, `CAPSULE_RESIDUE_KINDS`, `ADAPTER_OPERATIONS`, `ERROR_TABLE`, `QUEUE_*`, `PARITY_MATRIX`) rather than restating it in a fixture. A fixture that duplicated a pin would be a second source of truth and is a review finding.
- **The acceptance corpus**: 80 change folders dated 2026-10 onward, each with a pm-notes document (measured 2026-11-18). The sweep runs in the delivery environment where the verified registry exists; the compared-phase count is recorded, and a zero count is an ERROR (`TC-F5-008`).
- **Isolation**: controls that need a writable tree copy into `mkdtemp` and clean up; no case mutates a committed file; no module-level mutable state; guards are installed per suite and asserted after the run; the recording ports are constructed per test.

## 7. Automation Plan and Implementation Mapping

### 7.1 Suite Mapping

| Area | Test file(s) | Status | Cases |
|---|---|---|---|
| Landing path | `tests/behaviour/merge-landing.test.ts` (extend), `tests/fixtures/merge/harness.ts` (extend with the recording landing port) | Existing – Update | TC-F1-001, TC-F1-002, TC-F1-003, TC-F1-004 |
| Landing metadata | `tests/behaviour/merge-landing-metadata.test.ts` (new) | New | TC-F1-006, TC-F1-007 |
| Byte-pinned goldens | `tests/golden/merge.test.ts` (extend: the attribution line and the moved gate goldens), `tests/fixtures/merge/golden/{refusal-gate-human.txt,refusal-gate-scripted.json}` (regenerate), `tests/fixtures/merge/golden-scenarios.ts` (extend: the recorded/probe attribution scenarios) | Existing – Update | TC-F3-002, TC-F3-003, TC-FLOOR-005 |
| Head guard | `tests/behaviour/merge-head-guard.test.ts` (new) | New | TC-F1-005 |
| Gap refusal + retirement scan | `tests/behaviour/merge-refusal-surface.test.ts` (extend), `tests/checks/merge-landing-retirement.test.ts` (new) | Existing – Update + New | TC-F1-008, TC-F1-009 |
| Replay / convergence | `tests/behaviour/merge-convergence.test.ts` (extend) | Existing – Update | TC-F1-010, TC-SYNC-005 |
| Refusal taxonomy | `tests/behaviour/merge-refusal-taxonomy.test.ts` (new) | New | TC-F2-001, TC-F2-002, TC-F2-003, TC-F2-004, TC-F2-005, TC-F2-006, TC-F3-006 |
| Refusal rows and unrepresentability | `tests/structure/merge-refusal-rows.test.ts` (new), `tests/structure/merge-classification-conformance.test.ts` (extend), `tests/types/merge-landing.type-test.ts` (new) | New + Existing – Update | TC-F2-007, TC-F2-008 |
| Required-check contract | `tests/behaviour/merge-probe.test.ts` (extend) + the delivered `verify-gates` suite | Existing – Update | TC-F3-001 |
| Probe extension and attribution | `tests/behaviour/merge-required-job-probe.test.ts` (new) over the harness's recorded/probe scenarios | New | TC-F3-002, TC-F3-003, TC-F3-004, TC-F3-005 |
| Check-path scan | `tests/checks/merge-check-path-scan.test.ts` (new) | New | TC-F3-006 |
| Closeout step inventory | `tests/structure/closeout-contract.test.ts` (extend), `tests/structure/closeout-additive.test.ts` (extend) | Existing – Update | TC-F4-001, TC-F4-014, TC-SYNC-002 |
| Milestone sync | `tests/behaviour/closeout-milestone-sync.test.ts` (new) over `tests/fixtures/closeout/milestone.ts` (new) | New | TC-F4-002, TC-F4-003, TC-F4-004, TC-F4-005, TC-F4-006, TC-F4-007, TC-F4-008, TC-F4-010, TC-F4-011, TC-F4-012, TC-F4-014, TC-SYNC-007 |
| Milestone write failure | `tests/behaviour/closeout-milestone-write-failure.test.ts` (new) | New | TC-F4-013 |
| Milestone contract / vocabulary | `tests/structure/closeout-milestone-contract.test.ts` (new), `tests/types/closeout-milestone.type-test.ts` (new) | New | TC-F4-009, TC-F4-015, TC-SYNC-007 |
| Phase mirror | `tests/behaviour/phase-completion-convergence.test.ts` (extend) | Existing – Update | TC-F5-001, TC-F5-002, TC-F5-003 |
| Lint divergence | `tests/behaviour/pm-notes-lint-divergence.test.ts` (new) over `tests/behaviour/pm-notes-lint-command-support.ts` | New | TC-F5-004, TC-F5-005, TC-F5-006 |
| Lint surface | `tests/structure/lint-surface.test.ts` (new), `tests/structure/lint-registry-read.test.ts` (new) | New | TC-F5-007, TC-SYNC-006 |
| Corpus sweep | recorded (§7.4 G11) | Gate | TC-F5-008 |
| Queue integrity (seven properties) | `tests/behaviour/queue-integrity.test.ts` (new) — seven named `describe` blocks; extends `queue-claim-single-flight.test.ts`, `queue-lease-takeover.test.ts`, `queue-hold-*`, `queue-dep-*`, `queue-removal*`, `queue-graph.test.ts` | New + Existing – Update | TC-F6-001, TC-F6-002, TC-F6-003, TC-F6-004, TC-F6-005, TC-F6-006, TC-F6-007, TC-F6-009, TC-F6-012 |
| Closeout × queue removal | `tests/behaviour/closeout-queue-removal.test.ts` (extend), `closeout-queue-removal-idempotency.test.ts` (extend) | Existing – Update | TC-F6-008 |
| Queue bounds and surface | `tests/structure/queue-bounds.test.ts` (new), `tests/structure/queue-surface.test.ts` (new) | New | TC-F6-010, TC-F6-011 |
| F1 defect suite | `tests/structure/defect-f1-merge-refusal-containment.test.ts` (new) | New | TC-F7-001, TC-F7-002 |
| F4 defect suite | `tests/behaviour/defect-f4-phase-mirror.test.ts` (new) | New | TC-F7-003 |
| F8 defect suite | `tests/behaviour/defect-f8-serial-merge-churn.test.ts` (new) over `tests/fixtures/merge/serial-three.ts` (new) | New | TC-F7-004 |
| Defect meta-check and discovery | `tests/structure/defect-suite-presence.test.ts` (new), `tests/checks/merge-suite-discovery.test.ts` (new) | New | TC-F7-005, TC-F7-006 |
| Error-table sync / identity total | `tests/checks/error-table-sync.test.ts` (extend) | Existing – Update | TC-SYNC-001 |
| Residue bounds | `tests/checks/capsule-bounds.test.ts` (extend) | Existing – Update | TC-SYNC-002 |
| Conformance and parity | `tests/conformance/parity-gate.test.ts` (extend), `tests/structure/conformance-coverage.test.ts` (extend), `tests/conformance/mock-conformance.test.ts` (extend the route cases), **`tests/fixtures/providers/conformance/github/tenant.json`** (append the `close-milestone` write and read-back routes with expected projections), `tests/conformance/family-classification.test.ts` (read-only) | Existing – Update + read-only | TC-SYNC-003 |
| Contract shape pins | `tests/structure/port-contract-inventory.test.ts` (extend), `tests/structure/merge-contract.test.ts` (extend) | Existing – Update | TC-SYNC-004, TC-SYNC-005, TC-SYNC-008 |
| Forbidden acts | `tests/types/forbidden-acts.type-test.ts` (new) | New | TC-SYNC-008 |
| Pin floor | the nine pinned surfaces listed in §7.5 (extend each) | Existing – Update | TC-FLOOR-001 |
| Offline/testkit floor | `tests/boundaries/**`, `tests/checks/testkit-exclusion` (delivered) | Existing – No Change | TC-FLOOR-002 |
| Adapter floor | `tests/behaviour/providers/**` (read-only), capability pins | Existing – No Change | TC-FLOOR-003 |
| Security floor | `tests/checks/secret-read-boundary`, `fixture-sanitization`, `fixture-privacy` (delivered) | Existing – No Change | TC-FLOOR-004 |
| Determinism | `tests/behaviour/merge-determinism.test.ts`, `closeout-*`, `pm-notes-lint-determinism.test.ts` (extend) | Existing – Update | TC-FLOOR-005 |
| Topology | `tests/structure/ci-topology-pin.test.ts` (read-only) | Existing – No Change | TC-FLOOR-006 |
| Gate battery | repository root | Gate | TC-FLOOR-007 |
| Output bounds/privacy | `tests/behaviour/merge-bounds.test.ts`, `closeout-bounds.test.ts`, `merge-privacy.test.ts` (extend) | Existing – Update | TC-FLOOR-008 |

### 7.2 Fixtures to Author

| Path | Purpose | Cases |
|---|---|---|
| `tests/fixtures/merge/harness.ts` (extend) | The recording landing port, a `title`-bearing `baseRequest`, the four read-back shapes, and the head-mutation counter | TC-F1-001..010, TC-F2-*, TC-F7-004, TC-FLOOR-004 |
| `tests/fixtures/merge/serial-three.ts` (new) | The three-merge serial fixture: one base, three invocations, the second and third out-of-date | TC-F7-004 |
| `tests/fixtures/merge/golden/refusal-gate-{human.txt,scripted.json}` (**regenerated**) | The required-job refusal summary now renders the attribution; both files move byte-exactly, produced by the explicit golden command in §10 | TC-F3-002, TC-F3-003, TC-FLOOR-005 |
| `tests/fixtures/merge/golden/{success-*,refusal-stale,refusal-tracker,refusal-waiver,refusal-override,refusal-rebase}-*` (**unchanged**) | The thirteen goldens no required-job attribution touches; compared byte-for-byte so the single move cannot hide a second one | TC-FLOOR-005 |
| `tests/fixtures/merge/golden-scenarios.ts` (extend) | Two scenarios: a declared required job whose recorded verdict is green (probe attribution) and one whose recorded verdict is already non-pass (recorded attribution) | TC-F3-002, TC-F3-003, TC-FLOOR-005 |
| `tests/fixtures/closeout/milestone.ts` (new) | Builders for the declaration, the attachment observation, the record, the attached set and the four withholding facts | TC-F4-002..011, TC-SYNC-007 |
| `tests/fixtures/closeout/m4-attached-set.ts` (new) | The synthetic M4-shaped attached set with at least one open item; the fixture that makes GH-349's withheld outcome assertable | TC-F4-012 |
| `tests/fixtures/providers/conformance/milestone/{record,attached}.json` (new) | Committed synthetic provider shapes for the milestone read and the close read-back (open, closed, unknown, truncated, absent) | TC-F4-002, TC-F4-005..008, TC-SYNC-007 |
| `tests/fixtures/lint/divergence.ts` (new) | Typed builders pairing a document `completed` with a fold `completed`, including `null` and an equal pair | TC-F5-004, TC-F5-005 |
| `tests/fixtures/queue/integrity-breaches.ts` (new) | Seven typed breach builders, one per property | TC-F6-001..007, TC-F6-012 |
| `tests/fixtures/phase/**` (extend) | Transition histories for the four document-writing branches and the ledger-less/document-only exclusions | TC-F5-001, TC-F5-002, TC-F5-005 |
| `tests/fixtures/providers/conformance/github/tenant.json` (**append-only**) | The supported adapter's mock tenant gains the `close-milestone` write route and its read-back route, each with its expected projection; every delivered route keeps its key, order and shape | TC-SYNC-003 |
| `tests/fixtures/providers/conformance/{gitlab,jira}/tenant.json` (**unchanged**) | The two adapters whose `close-milestone` posture is a declared gap add no route; the files stay byte-identical so a silent route cannot imply parity | TC-SYNC-003, TC-FLOOR-003 |
| `tests/fixtures/ports/…` (extend only) | The additive `title` field and the additive lint fold field in the contract inventory expectations | TC-SYNC-004, TC-SYNC-006 |

### 7.3 Fixture Sets Extended vs Authored

- **Authored**: the recording landing port and its read-back shapes, the three-merge serial fixture, the milestone builders and the M4 attached set, the provider milestone shapes, the lint divergence builders, the seven queue breach builders, and the three defect-suite control helpers.
- **Extended (append-only)**: `tests/fixtures/merge/harness.ts` (new port and counter; every delivered helper keeps its signature), `tests/fixtures/merge/golden-scenarios.ts` (two appended scenarios), **`tests/fixtures/providers/conformance/github/tenant.json`** (the `close-milestone` write route and its read-back route appended with their expected projections; no existing route removed, reordered or retyped), `tests/fixtures/merge/golden/**` (**exactly two files regenerated** by the explicit command — `refusal-gate-human.txt` and `refusal-gate-scripted.json` — with the other thirteen byte-identical; never blanket-rewritten), `tests/fixtures/closeout/harness.ts` (a milestone read/close seam added; delivered helpers unchanged), `tests/fixtures/phase/**` (new histories appended), `tests/fixtures/ports/**` inventory expectations, and the nine pinned surfaces in §7.5.
- **Unchanged by obligation**: `packages/adapters/src/git/merge.ts` (the local landing and refresh stay declared and tested — `TC-F1-009`), `packages/core/src/contracts/merge.ts`'s `MERGE_GIT_OPERATIONS`, the `merge.rebase-conflict` row's fields, `tests/behaviour/providers/**` (no adapter behaviour change — `TC-FLOOR-003`), `.github/workflows/**`, `scripts/checks/ci-topology.ts`, `tests/structure/ci-topology-pin.test.ts`, and the **GitLab and Jira** conformance tenants (`tests/fixtures/providers/conformance/{gitlab,jira}/tenant.json`, byte-unchanged). A change to any of these outside an explicitly declared additive expectation is a review finding.
- **Sanitization obligations for every new fixture**: provenance marker, declared placeholders only, example/reserved hosts only, no bearer header/PEM key/token shape/email/avatar URL/private-repository reference, no absolute path. Enforced by the delivered sanitization and privacy suites in the same gate pass (`TC-FLOOR-004`).

### 7.4 Gate Battery and Failure Triaging

Every command runs from the repository root with the temp root inside the tree.

| # | Command | Expected signal on success | Failing signal |
|---|---|---|---|
| G1 | `TMPDIR=$PWD/tmp/tmpdir bun test tests/behaviour tests/golden` | exit 0; landing, taxonomy, probe, milestone, phase mirror, lint divergence, queue integrity, three defect suites, and the byte-pinned goldens (2 moved + 13 unchanged) | a named case failure with its carrier value, or a byte difference naming the golden file |
| G2 | `TMPDIR=$PWD/tmp/tmpdir bun test tests/structure` | exit 0; emittable totality, step inventory, residue kinds, operation set, parity census, lint rows, topology pin | a named set-equality or count mismatch |
| G3 | `TMPDIR=$PWD/tmp/tmpdir bun test tests/checks` | exit 0; identity total 152/152, capsule bounds, sanitization, secret-read boundary, retirement scan, check-path scan, suite discovery | the offending field, the file+construct, or both counts |
| G4 | `TMPDIR=$PWD/tmp/tmpdir bun test tests/conformance` | exit 0; 30 cells with three adjudicated, the GitHub tenant's appended `close-milestone` write and read-back routes with their projections, gap encounters, family accounting 18 | the pair, the cell kind, the route or projection, or the family |
| G5 | `TMPDIR=$PWD/tmp/tmpdir bun test tests/boundaries` | exit 0; runtime-API confinement, ambient-globals, fixture-coverage meta-check | the rule and the violating file |
| G6 | `TMPDIR=$PWD/tmp/tmpdir pnpm typecheck` | exit 0; landing strategy, `title` optionality, close-milestone vocabulary, forbidden-acts probes, all `@ts-expect-error` reasons honoured | a type error naming the probe file and member |
| G7 | `TMPDIR=$PWD/tmp/tmpdir bun run scripts/checks/ci-topology.ts` | `OK ci-topology: …`; requires `origin/main-tools` | a named job/trigger/wiring finding, or `origin/main-tools is unavailable` (an ERROR, never a skip) |
| G8 | `TMPDIR=$PWD/tmp/tmpdir bash scripts/.tests/test-doc-distribution.sh` | exit 0; every changed redistributable doc declares `ados_distribution` | the offending file and marker |
| G9 | `TMPDIR=$PWD/tmp/tmpdir git diff --check` | no output, exit 0 | whitespace/conflict-marker finding |
| G10 | `TMPDIR=$PWD/tmp/tmpdir bun test tests/behaviour/defect-f1-merge-refusal-containment.test.ts tests/behaviour/defect-f4-phase-mirror.test.ts tests/behaviour/defect-f8-serial-merge-churn.test.ts` | exit 0; the three defect suites green **with their controls failing as declared** | a suite green while its control also passes (a vacuous control) |
| G11 | `TMPDIR=$PWD/tmp/tmpdir <binary> lint <ref> --pm-notes --registry` over the corpus (recorded) | exit 0 per folder, findings 0, compared phases > 0 | any `lint.phases.divergent`, or compared phases 0 |
| G12 | `TMPDIR=$PWD/tmp/tmpdir pnpm check` | exit 0 through lint → format → typecheck → test → boundaries → memory → prompt/help/exports parity | the first failing stage with its output |

G1–G11 are the narrow loop; **G12 is the binding completion gate** and is recorded in §10 plus a pm-notes `notes:` entry. G8 applies because the documentation phase changes `doc/spec/features/**`, `doc/guides/milestone-management.md` and `doc/overview/**`. No command requires network access or a live credential; a command that attempts either fails through the guards rather than hanging.

**Failure-triaging rule** (applies to every row):

1. **Read the named element first.** A property control names the property; a scan names file and construct; a pin names the extra/missing member; a refusal names its code. Triage starts from that name, never from a stack trace.
2. **A failing control is a control defect, not a declaration defect.** If a mutation stops producing its named failure, it has gone vacuous (or the code lost a rule); it is never "fixed" by deleting the mutation or relaxing its expected failure.
3. **Never widen a scope, a vocabulary or an allowlist to go green.** Growing the secret-read allowlist, the emittable declaration with a wildcard, the family slot, the queue verb set or a pin is a scope decision that must be recorded, not a repair. `TC-FLOOR-001`, `TC-FLOOR-004`, `TC-SYNC-001`, `TC-SYNC-003` and `TC-F6-011` pin those collections exactly and fail on growth by name.
4. **Never regenerate a golden to pass.** The refusal-summary and closeout-plan goldens are compared exactly; a diff means a behaviour change that must be justified by the AC that permits it.
5. **A green suite is not evidence that a control ran.** If a new suite is not discovered, `TC-F7-006` fails naming the path; if a control passes with production, `TC-F7-005` fails naming the non-difference.
6. **A corpus hit is evidence, not noise.** `TC-F5-008` records the folder, phase and both values; the response is an investigation, never an exclusion.
7. **Escalate after two narrow loops.** A failure that survives a narrow run plus one targeted fix is reported with the command, exit code and named element; no third blind attempt.

### 7.5 Non-Vacuity and Mutation Control Register

Every gate rule, scan, pin and absence claim has at least one control here. Each row states the exact failure the mutation must produce; a mutation that produces a different failure, or none, is a blocking finding. **92 register rows.** Cases whose control is stated inside the case body rather than as a register row are listed after the table so nothing is unaccounted for.

| # | Mutation | Case | Required failure (named elements) |
|---|---|---|---|
| M1 | Call the landing twice in one invocation | TC-F1-001 | landing count 2 |
| M2 | Plant a local `squashLand(`/`refresh(` composition site in a temp copy | TC-F1-001, TC-F1-009 | file + line |
| M3 | Plant a platform-CLI literal (`gh pr merge`, `glab mr merge`) | TC-F1-001 | file + literal |
| M4 | Widen or replace the landing strategy union | TC-F1-001, TC-SYNC-008 | the extra member + compile error |
| M5 | Omit `expectedHeadSha`, or set it to a head other than the verified one | TC-F1-001, TC-F1-005 | missing field / head pair |
| M6 | Derive the recorded identity from a local object | TC-F1-002 | expected vs received sha |
| M7 | Add or remove a transaction-record field | TC-F1-002, TC-SYNC-005 | field name |
| M8 | Report `merged` from local containment with the provider not merged | TC-F1-003 | expected `merge.landing-unverified` |
| M9 | Derive an identity from a merged read-back that supplied none | TC-F1-004 | `squashSha` present where it must be absent |
| M10 | Re-land on a re-run, or append a duplicate transaction record | TC-F1-004, TC-F1-010 | landing count / record count |
| M11 | Land with a moved head | TC-F1-005 | landing count 1 |
| M12 | Trim, case-fold or otherwise alter the transmitted title | TC-F1-006 | expected vs received title |
| M13 | Drift the trailer's line count, or include provider prose | TC-F1-006, TC-FLOOR-008 | message line set / leaked field |
| M14 | Add a `--title` or `--message` flag to the merge grammar | TC-F1-006 | flag set |
| M15 | Transmit an empty-string title as the subject | TC-F1-007 | expected fallback vs `""` |
| M16 | Change the fallback composer's shape | TC-F1-007 | expected vs received string |
| M17 | Fall back to the local landing on a declared gap | TC-F1-008 | `git-squash-land` event present |
| M18 | Leave the gap reason out of the evidence, name a different one, or refuse a gap through a third identity | TC-F1-008, TC-F4-014 | expected vs received reason / the row count 10 |
| M19 | Delete `squash-land`/`rebase-refresh` from the declared operations instead of retaining them | TC-F1-009 | missing member |
| M20 | Append a second transaction record on replay | TC-F1-010, TC-F6-008 | record count 2 |
| M21 | Attempt a refresh on `conflicting` (the pre-fix F8 behaviour) | TC-F2-001, TC-F7-004 | refresh count 1 / head pair |
| M22 | Perform two post-refusal re-reads | TC-F2-002 | request-detail read count 3 |
| M23 | Retry the landing after a refusal | TC-F2-002, TC-F3-006 | landing count 2 |
| M24 | Map a checks posture to `sync-required`, or reuse one reason for both checks stimuli | TC-F2-003 | expected `merge.gate.ci-green.failed` / duplicated detail |
| M25 | Classify an inseparable protection rule as a clean pre-mutation abort (the pre-v1.1 behaviour) | TC-F2-004 | expected `merge.sync-required` with `behind-unconfirmed`; the code `merge.transaction-aborted` named |
| M26 | Report success for an undecisive behind request | TC-F2-005 | `result=merged` present |
| M27 | Classify by matching prose instead of structure | TC-F2-005, TC-F3-006 | matcher file+line; classification changed by a message string |
| M28 | Perform two recovery reads, or fail to refuse a changed head | TC-F2-006 | read count 3 / head pair |
| M29 | Change one new row's projection class, kind, retryability or remediation | TC-F2-007, TC-SYNC-001 | field + expected vs received |
| M30 | Widen the `merge.gate.<gate-id>.failed` slot rule | TC-F2-007, TC-SYNC-001 | offending gate id |
| M31 | Delete `merge.rebase-conflict` from the declaration | TC-F2-007 | missing code |
| M32 | Make the classifier accept a kind/code mismatch for a declared refusal | TC-F7-001 | the mismatch control must still contain |
| M33 | Add a force/bypass/auto-merge/queue/retry member to a vocabulary | TC-F2-008, TC-SYNC-008 | the member + compile error |
| M34 | Treat `queued` as green in either evaluator | TC-F3-001 | verdict expected `fail` |
| M35 | Make the probe ignore `queued`, or return one reason for all five not-green states | TC-F3-002 | missing refusal for that stimulus / duplicated detail |
| M36 | Report a pre-existing not-green as probe-discovered | TC-F3-003 | `attribution: "probe"` where `recorded` is required |
| M37 | Treat an undeclared job as gate evidence | TC-F3-004 | the job name |
| M38 | Treat an other-head page as head evidence | TC-F3-005 | both SHAs |
| M39 | Add a second required-check evaluator entry point | TC-F3-006 | file + construct |
| M40 | Insert the step at position 11, move `capsule` off the end, or resolve steps positionally | TC-F4-001, TC-SYNC-002 | index / terminal id / resolved id |
| M41 | Close twice, or record a close whose read-back did not observe closed | TC-F4-002, TC-F4-011, TC-F4-013 | write count / observed state |
| M42 | Select a milestone by title similarity, or emit two residue items for one withheld fact | TC-F4-003 | guessed identity / residue count |
| M43 | Produce a withheld residue for a `none` declaration | TC-F4-004 | outcome `skipped-gap` expected |
| M44 | Close with an open attached item | TC-F4-005 | close write present |
| M45 | Map an unavailable signal to an empty set, or an unknown state to `open` | TC-F4-006, TC-F4-007, TC-SYNC-007 | collapsed decode / state value |
| M46 | Ignore the truncation marker, raise the cap, or read twice | TC-F4-008, TC-FLOOR-004 | closed fixture / constant / read count |
| M47 | Write, append or acquire a fence in plan mode | TC-F4-010 | counter 1 |
| M48 | Close again on the second apply | TC-F4-011 | total write count 2 |
| M49 | Assert or produce a closed record for the GH-349 fixture | TC-F4-012 | record state after the run |
| M50 | Add an attach/detach/rename/create/reopen effect to the operation vocabulary | TC-F4-009, TC-SYNC-008 | the member + compile error |
| M51 | Swallow the write failure and let the capsule close | TC-F4-013 | capsule close count 1 |
| M52 | Report `skipped-noop` or `failed` for a gap adapter | TC-F4-014 | outcome |
| M53 | Add a capability flag or an eleventh operation for the milestone read | TC-F4-015 | operation / flag |
| M54 | Restore the history lookup in the `both` branch (the pre-fix F4 behaviour) | TC-F5-001, TC-F7-003 | document value vs fold value |
| M55 | Write a stale completion in `record-record-only` | TC-F5-001 | value |
| M56 | Rewrite `started`, or write a timestamp where a reopen must write null | TC-F5-002 | field values |
| M57 | Report the first completion in the no-op evidence | TC-F5-003 | evidence value |
| M58 | Remove the comparison, or treat null and a timestamp as equal | TC-F5-004 | missing finding / expected one |
| M59 | Flag a document-only completion or a ledger-less phase | TC-F5-005 | the phase id |
| M60 | Write, fence, append or read the clock during detection | TC-F5-006 | the counter |
| M61 | Reorder the lint rows, or add a documented row without its machine row | TC-F5-007, TC-SYNC-001 | the first moved code / the code + side |
| M62 | Suppress a corpus finding through an exclusion list | TC-F5-008 | the exclusion entry |
| M63 | Refuse a same-holder claim, skip a stale takeover, or accept a cross-ref claim | TC-F6-001 | holder / heartbeat age / lease id |
| M64 | Accept a battery-only cause, accept a wrong expiry, or leave a park active after removal | TC-F6-002, TC-F6-009 | cause / fold |
| M65 | Remove `in-review`, drop the reconcile remainder, or match `--ref` by prefix | TC-F6-003, TC-F6-010 | state / count / extra refs |
| M66 | Write two edges per add, cascade on removal, or check cycles shallowly | TC-F6-004 | edge count / surviving set / path length |
| M67 | Append on a removal refusal, or make the explicit verb idempotent | TC-F6-005 | append count / second result |
| M68 | Omit the holder from the envelope root | TC-F6-006 | missing field |
| M69 | Decide presence from timestamp text, or special-case re-declaration | TC-F6-007 | both timestamps / the branch site |
| M70 | Acquire a second fence, duplicate the `landed` removal, or suppress it under a withheld milestone | TC-F6-008 | fence count / record count / outcome |
| M71 | Append the park release after the removal, or drop it | TC-F6-009 | sequence pair / active park |
| M72 | Add a queue verb/kind/key/flag, raise a cap, or emit an unbounded detail | TC-F6-010, TC-F6-011 | the member / constant / length |
| M73 | Apply the pre-fix seventeen-member emittable declaration | TC-F7-002 | the uncovered family code |
| M74 | Remove a defect suite's primary assertion | TC-F7-005 | the suite and the missing id |
| M75 | Make a control assert the production value (a non-difference) | TC-F7-003, TC-F7-005 | the non-difference |
| M76 | Inject the pre-fix refresh into the serial fixture | TC-F7-004 | the invocation index |
| M77 | Add a workflow job or file, or move a suite under `tmp/` | TC-F7-006, TC-FLOOR-006 | job / file / ignore pattern |
| M78 | Move a pin in one place only, or loosen one (floor→equality, wildcard, skip) | TC-FLOOR-001, TC-SYNC-002 | both values / the loosening |
| M79 | Plant `node:*` in testkit, ambient `Date.now()` in a neutral tier, or a live `fetch(` in a suite | TC-FLOOR-002 | file + construct |
| M80 | Add a secret-read allowlist entry, or disable the planted-secret canary | TC-FLOOR-004 | file + pattern / the canary |
| M81 | Produce an order-dependent or clock-derived output | TC-FLOOR-005 | the reordered element / the field |
| M82 | Exceed a line/byte/item bound, or leak a provider title, body or payload | TC-FLOOR-008 | the count / the leaked field |
| M83 | Add the operation to the family vocabulary, omit its mock route, leave a cell unadjudicated, or orphan a register entry | TC-SYNC-003 | the family / the operation / the pair / the `registerId` |
| M84 | Carry the document's phases in the fold field, or make `title` required/derived | TC-SYNC-006, TC-SYNC-004 | the differing phase / compile error + fallback |
| M85 | Omit the attribution, or overload `detail` with the source instead of the reason | TC-F3-002, TC-F3-003 | the missing field / the conflated `detail` value |
| M86 | Emit `recorded` without the gate id, the job, or the recorded verdict | TC-F3-003 | the missing member, named |
| M87 | Emit an attribution outside the closed pair, or both values at once | TC-F3-002, TC-F3-003, TC-F3-004 | the offending value / the pair size, and the orphan case |
| M88 | Interpolate the change ref or the request identity into the trailer | TC-F1-001, TC-F1-006 | expected vs received message bytes |
| M89 | Drop the `squash ` token from the fallback, or substitute the branch for the change ref | TC-F1-007 | expected vs received title bytes |
| M90 | Add a fourth sync reason, report `behind` for an undecisive re-read, or drop the persisting-refusal caveat | TC-F2-005, TC-F2-007 | the reason pair / the missing sentence / the set size |
| M91 | Regenerate an unrelated golden, or blanket-rewrite the golden set | TC-FLOOR-005 | the untouched golden's file name |
| M92 | Add a verification-timestamp member to the refusal evidence, or leave the corroborating record unresolvable by gate id + job | TC-F3-003 | the extra evidence key / the lookup key and the missing record |

**Controls stated inside their case body (not duplicated as rows)**: `TC-FLOOR-003` (flip one delivered gap reason / add a support flag), `TC-FLOOR-007` (a narrow-suite pass never substitutes for G12; a missing base is an ERROR), `TC-SYNC-005` (added record field / legacy re-land), `TC-SYNC-007` (four-way collapse), `TC-SYNC-008` (each union widening), `TC-F6-012` (repair that widens a vocabulary or disables a control), `TC-F5-008` (zero compared phases is an ERROR), `TC-F1-009` (capability deletion), `TC-F2-004` (the branch's code set with `merge.transaction-aborted` absent), `TC-F2-005`/`TC-F2-006` (second attempt), `TC-F4-010` (an outcome outside the four), and `TC-F4-011` (second close). Every one names the value that must differ.

### 7.6 Plan Coordination — Phase/File Bindings the Delivery Plan Must Carry

This plan binds each case to a file and to a module the spec or a decision record names. `chg-GH-349-plan.yaml` is authored in phase 4; the following bindings must appear in it so plan and test plan cannot diverge. Phase names here follow the *outcome sequencing* of spec §18 and are not a claim about the plan's identifiers.

| Case(s) | Owning outcome (spec §18 order) | Editable targets the phase must declare | Read-only controls |
|---|---|---|---|
| TC-SYNC-001, TC-SYNC-004, TC-SYNC-002 | **Additive contract surface + its pins** (first) | `packages/core/src/contracts/error-table.ts` (three rows), `packages/core/src/contracts/ports.ts` (`title`), `packages/core/src/contracts/adapter-capabilities.ts` (tenth operation), `packages/core/src/contracts/closeout.ts` (`CLOSEOUT_STEP_IDS`), `packages/core/src/contracts/capsule.ts` (`CAPSULE_RESIDUE_KINDS`), `tests/checks/error-table-sync.test.ts`, `tests/checks/capsule-bounds.test.ts`, `tests/structure/closeout-contract.test.ts`, `tests/structure/closeout-additive.test.ts`, `tests/structure/port-contract-inventory.test.ts`, the three adapter declarations | the delivered rows and fields (read for equality only) |
| TC-F1-001..010, TC-F2-001..008, TC-F3-001..006, TC-F7-001..005, TC-FLOOR-005 | **Landing path + refusal taxonomy + probe + goldens** (second and third) | `packages/core/src/domain/merge-transaction.ts` (landing input, the reason triple, the attribution field and its rendering), `packages/cli/src/edge.ts` (`createMergeCommandRuntime`'s landing port), `packages/cli/src/production.ts` (the emittable declaration and its family expression, the composition's landing port), `packages/core/src/domain/merge-probe.ts`, `packages/adapters/src/github/{client,normalize}.ts` (title normalization only), the nine merge suites, the F1 defect suite, `tests/golden/merge.test.ts`, `tests/fixtures/merge/golden-scenarios.ts`, and **exactly** `tests/fixtures/merge/golden/refusal-gate-human.txt` + `refusal-gate-scripted.json` | `packages/adapters/src/git/merge.ts` (**unchanged** — retained capability), `MERGE_GIT_OPERATIONS`, the `merge.rebase-conflict` row, and the other thirteen golden files (**byte-identical**) |
| TC-F4-001..015, TC-SYNC-002, TC-SYNC-007 | **Milestone step + its two provider surfaces** (fifth) | `packages/core/src/domain/closeout.ts` (the step, its predicate, the residue), `packages/core/src/contracts/closeout.ts`, `packages/adapters/src/github/client.ts` (read + close), `packages/cli/src/production.ts` (the closeout composition's milestone seams), the milestone suites and fixtures, `doc/spec/features/feature-closeout.md`, `doc/guides/milestone-management.md` | the automatic queue-removal hook (compared, not edited), the capsule event vocabulary |
| TC-F5-001..008, TC-SYNC-006 | **Phase mirror + divergence** (fourth) | `packages/cli/src/commands/phase.ts` (every document-writing branch), `packages/cli/src/commands/lint.ts` (`LintRegistryRead` + the comparison), `packages/cli/src/edge.ts` + `production.ts` (the lint runtime's registry read), the phase and lint suites, `doc/spec/features/feature-pm-notes-lint-and-phase-transitions.md` | `foldPhaseState` (the authority), `verify change` (**unchanged**) |
| TC-F6-001..012 | **Queue property proofs + conditional repair** (sixth) | `tests/behaviour/queue-integrity.test.ts`, `tests/fixtures/queue/integrity-breaches.ts`, `tests/structure/queue-bounds.test.ts`, `tests/structure/queue-surface.test.ts`, and — **only where a control demonstrates a breach** — the repaired function in `packages/core/src/app/queue.ts` | the delivered config, park, lease and removal contracts; the automatic closeout removal |
| TC-SYNC-003, TC-FLOOR-003 | **Conformance/parity ripple** (with the operation, all-or-nothing) | `packages/testkit/src/conformance/{parity,flows,coverage,mock-tenant}.ts`, `tests/conformance/{parity-gate,mock-conformance}.test.ts`, `tests/structure/conformance-coverage.test.ts`, **`tests/fixtures/providers/conformance/github/tenant.json`** (append the `close-milestone` write and read-back routes with their expected projections), the register entry, `doc/spec/features/feature-adapter-conformance.md` | the six-family accounting (18), and the GitLab/Jira stateless tenants byte-unchanged (the GitHub tenant is an editable target for the two appended routes) |
| TC-FLOOR-001, TC-FLOOR-002, TC-FLOOR-004..008, TC-F7-006 | **Quality gates** | — (control runs and the §10 record) | all delivered suites, the topology pin, the secret-read allowlist |

Five obligations the plan text must carry verbatim, because they are the difference between a proof and a slogan:

(i) **The three decision records are staged, not authored.** `doc/decisions/{ADR-0012,TDR-0040,ODR-0005}*.md` already exist as untracked `Proposed` files; the plan must stage them **and** their three rows in `doc/decisions/00-index.md` in the phase that first depends on them (the additive/landing phase), and must not re-author, accept, or mark them `Accepted` — acceptance is the owner's review act.

(ii) **Every count that exists in two places moves in both, in one commit.** The pairs are: `CLOSEOUT_STEP_IDS` ↔ `closeoutStepDefinitions` (plus the documented inventory, `EXPECTED_STEPS`, and `tests/fixtures/closeout/plan.ts`'s `EXPECTED_STEP_IDS`); `CAPSULE_RESIDUE_KINDS` ↔ the documented residue vocabulary ↔ the producers map; `ADAPTER_OPERATIONS` ↔ the three declarations ↔ the matrix ↔ the documented "nine operations" statements; the error table ↔ the documented table ↔ the `149`/`152` statements; the lint family ↔ the documented rule order; and the parity census in `tests/conformance/parity-gate.test.ts`. A phase may not move one side.

(iii) **The Appendix E ripple is atomic.** Representation, both coverage gates, **the GitHub tenant's two appended routes with their expected projections** (Appendix E item 5 — and only that tenant: the GitLab and Jira tenants stay byte-unchanged because their posture is a declared gap), the register adjudication, the export inventory and the reference/help inventory move with the operation. Any subset is a red gate, not a partial success; `TC-SYNC-003` fails naming the missing item.

(iv) **The emittable declaration must express the family, not enumerate it.** `MERGE_COMPOSITION_EMITTABLE_CODES` must cover `merge.gate.<gate-id>.failed` for every gate id the effective set can resolve — as a declared family expression expanded by the totality proof, not as a hand-written list of gate ids — and the existing refusal-site scan must be extended so a family emission is visible to it. Otherwise adding a declared gate id re-opens F1 in a later change, and `TC-F7-001`/`TC-F7-002` become vacuous.

(v) **The convergence branch must stop treating local containment as merged truth.** With `merge` no longer advancing the base, a provider landing leaves the merge commit outside the checkout, so the delivered "request already merged" branch cannot use `readBaseContainment` to decide replay. `TC-F1-004`/`TC-SYNC-005` require the re-run to decide from the provider request read (and the recorded identity when present) with zero landing calls when the provider asserts merged; the plan must name this branch as touched rather than assuming the delivered convergence logic survives.

(vi) **The attribution field moves its golden in the same commit, and only that golden.** `MergeFailureEvidence` gains exactly one additive optional field for the `recorded` | `probe` pair **and no second field** — the `recorded` arm identifies its source record by gate id, job and verdict, and the verification timestamp stays on the persisted `merge.gate-verification` record that gate id + job resolves to, so a phase that adds a `verifiedAt` evidence member fails `TC-F3-003` and `M92`; the required-job refusal summary renders the attribution; therefore `tests/golden/merge.test.ts` gains the attribution assertion **and** `refusal-gate-human.txt`/`refusal-gate-scripted.json` are regenerated by the explicit command in §10. The phase must declare those two files and no others: `TC-FLOOR-005` fails naming any other golden that moved, and `M91` proves it. A phase that regenerates the directory wholesale is a blocking finding.

(vii) **The reason triple is declared once and consumed everywhere.** `merge.sync-required` carries the closed triple in one declaration; the three refusing branches (`dirty`, decisive `behind`, undecisive `behind-unconfirmed`) and the row's documented entry read from it, and the undecisive branch's remediation carries the persisting-refusal caveat. `TC-F2-001`/`TC-F2-002`/`TC-F2-005` assert one value each and `TC-F2-007` asserts the set has exactly three members, so a fourth value or a branch that reports `behind` where `behind-unconfirmed` is required fails by name. The plan must not introduce a second vocabulary for the same triple.

Two further bindings the plan must not get wrong: **no phase may declare the three decision records, `packages/adapters/src/git/merge.ts`, `tests/behaviour/providers/**`, `.github/workflows/**` or the topology pin as editable**; and **a queue phase that repairs nothing must say so explicitly** ("property proved clean; no repair"), because a silent no-op phase reads as an unfinished one at the DoD gate.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Risk to the test strategy | Impact | Mitigation (how the plan fails visibly) |
|---|---|---|---|
| RSK-TP-1 | **The pinned counts move in two places and only one moves.** Step ids live in `CLOSEOUT_STEP_IDS` *and* `closeoutStepDefinitions` (plus the documented inventory, the fixture expectation and the structure pin); residue kinds live in the constant, the documented vocabulary, the producers map and a count pin; the identity total lives in the machine table, the documented table, two count pins and several prose statements; the parity census lives in the matrix and the gate test. | **H** | `TC-SYNC-002` and `TC-FLOOR-001` assert every pair by equality and name both values on a mismatch; M78 mutates one side of each pair and must fail naming the other. Triage rule 3 forbids "updating until green". |
| RSK-TP-2 | **The conformance/parity ripple is all-or-nothing and a subset passes vacuously.** An operation added to the set but not to the registry yields a gate that either fails or (worse) passes because the coverage requirement still says "nine". | **H** | `TC-SYNC-003` asserts representation, both gates' requirement text, the 30-cell multiset with three adjudicated cells, the GitHub tenant's appended routes and projections (with the GitLab/Jira tenants byte-unchanged), and the unchanged 18-cell accounting, in one case; M83 mutates each supplied item and requires a named failure. |
| RSK-TP-3 | **The merged-diff anchor degrades after a provider landing.** The squash object is not in the operator's checkout and `merge` never fetches, so closeout's sweep becomes `skipped-gap` with `merged-diff-unavailable`. A test that "fixes" this by fetching, or that asserts the sweep still reports hits, would contradict Appendix G-2 and hide a real capability reduction. | M | `TC-F4-002` asserts the delivered degradation explicitly (the step reports the gap; no fetch occurs; the recorded landing identity remains the anchor) and forbids a repaired anchor. The revisit path is a separate decision, recorded in the plan as out of scope. |
| RSK-TP-4 | **GH-349's own withheld milestone is read as a failure, or a reader expects "GH-349 closes M4".** M4 carries other open tickets, so the correct outcome for this change is `skipped-noop` + one residue. | **H** | `TC-F4-012` asserts the withheld outcome, the attachment and exit-review evidence, and the record still `open` after the run; the live closeout outcome is recorded in §10 as gate evidence. Any case asserting a closed M4 record is a blocking review finding. |
| RSK-TP-5 | **A queue property control reveals a genuine breach.** The repair could then drift beyond the declared property (widen a vocabulary, add a key, turn a refusal into a success) to make the suite pass. | **H** | `TC-F6-012` asserts the repaired outcome plus unchanged vocabulary/key/flag sets plus the control still failing, and requires the delivery to record which of the seven proved clean; M72 mutates the surface sets. A repair outside the declared sentence returns to the spec per Appendix C-1. |
| RSK-TP-6 | **The corpus sweep goes green vacuously** because the registry is absent in CI, so zero ledger-backed phases are compared. | M | `TC-F5-008` requires `compared > 0` and treats zero as ERROR; the sweep is a recorded gate, never a silent suite; M62 covers suppression. |
| RSK-TP-7 | **The emittable declaration is expanded by enumerating gate ids** instead of expressing the family, so a future declared gate re-opens F1. | **H** | `TC-F7-001` expands the declaration's own family expression over the effective gate set and asserts coverage property-wise; `TC-F7-002` requires the pre-fix declaration to fail; §7.6(iv) binds the plan. |
| RSK-TP-8 | **A defect suite cannot fail** — its control was weakened, deleted, or made to assert the fixed value. | **H** | `TC-F7-005` requires an assertion-presence registry plus a control-differs assertion per suite; `TC-F7-002`/`TC-F7-003`/`TC-F7-004` each name the differing pre-fix value they must produce; M74/M75 mutate both halves. |
| RSK-TP-9 | **A case asserts a declaration restating itself** (the constant equals the constant; the fold folded the document) and passes while nothing is delivered. | **H** | §3.1's carrier column forbids that shape; `TC-SYNC-006` compares the read's fold with a *direct* fold; `TC-F7-003` asserts an inequality before the equalities; every absence claim carries a paired positive. |
| RSK-TP-10 | **The pre-fix control becomes a re-implementation of production**, so the "control" cannot discriminate. | M | The controls are minimal derivations (the history lookup, the seventeen-member declaration, the refresh injection) whose expected value is asserted literally (`T1`, the uncovered family code, the invocation index), so a control returning the production value fails by name. |
| RSK-TP-11 | **The GitHub milestone surface is fixture-decided and the fixture drifts** from what the adapter decodes. | M | `TC-SYNC-007` pins the four decode outcomes and the cap; a shape change updates one fixture and must not touch an assertion; the sanitization audit runs on the same pass. |
| RSK-TP-12 | **A refusal-summary golden is regenerated to pass**, hiding a behaviour change in the refusal vocabulary. | M | `TC-FLOOR-005` compares against committed goldens; Triage rule 4 forbids regeneration as a repair; the golden diff is reviewed as a contract change. |
| RSK-TP-13 | **The new suites slow or destabilise the existing test job** (temporary repositories, many fixtures). | L | In-process pure validation, bounded fixtures, `mkdtemp` cleanup, no network or child process; `TC-FLOOR-007` records the gate duration in §10 so a regression is visible. |
| RSK-TP-14 | **The attribution golden move hides a second change.** A blanket regeneration of `tests/fixtures/merge/golden/**` would accept an unrelated drift in the same commit. | **H** | `TC-FLOOR-005` names the moved pair and asserts the other thirteen byte-identical; M91 regenerates an unrelated golden and must fail naming the untouched file; §7.6(vi) binds the phase to those two paths only; Triage rule 4 forbids regeneration as a repair. |
| RSK-TP-15 | **The attribution is overloaded onto `detail`**, conflating the reason with its source, so `recorded` and `probe` become indistinguishable by structure again. | M | `TC-F3-002`/`TC-F3-003` assert `evidence.attribution` as a field and `evidence.detail` still carrying the delivered reason; M85 mutates the overload and must fail naming both fields. |

### 8.2 Assumptions

- The merged composition accepts an injected landing port, so the landing call, its arguments and its count are observable without a provider. The delivered `merge` harness already injects every other port the transaction consumes.
- The closeout apply path is drivable offline on a fake provider/git/state harness (delivered) and, where a worktree is required, on a `mkdtemp` local repository; the milestone step needs no provider process.
- The milestone read can be implemented as an adapter-local bounded read over the existing injected transport without adding a closed operation or a capability flag (ODR-0005 §3/§4). A delivery that needs a new flag contradicts `TC-F4-015`.
- GitHub's close write is read-back verified through the same client and transport, and `alreadyApplied` is derivable from the record's state on read — so idempotency is testable without a second write.
- The effective gate set can resolve a `required-ci-job` entry by id, so the probe's not-green classification can be asserted per gate id rather than per code string.
- The verified registry is readable in the delivery environment (for the corpus sweep) and is not committed; CI without it must never report a pass.
- The conformance tenants are per-adapter documents, so the GitHub tenant can gain two appended routes without touching the other two: the mock tier loads a tenant by adapter, and a gap-declared adapter's tenant is never asked for the operation. A delivery that "aligns" the three tenants fails `TC-SYNC-003` and `TC-FLOOR-003` (the gap postures) by name.
- `bun test` discovery is path-based on `tests/**/*.test.ts` with `tmp/**` excluded, so a new suite is picked up with no workflow or script change (delivered precedent).
- `origin/main-tools` is fetchable in the quality-gate environment for `ci-topology.ts`; a missing base is an ERROR, never a skip.
- The three decision records are `Proposed` and are accepted by the owner at review; no test asserts their status, and no delivery step marks them accepted.
- The seven queue properties are correctly declared; the proofs are expected to confirm them, and a failing control is a genuine breach to repair within the declared sentence.
- The refusal-evidence attribution is additive and optional, so a delivered refusal path that does not carry it still classifies; only not-green required-job outcomes must carry it, and `TC-F3-002`..`TC-F3-004` are the only cases that assert it.
- The verification timestamp is corroborated, not carried: the persisted `merge.gate-verification` record is readable through the same injected verification seam the transaction already consumes, so a gate id + job resolves to exactly one record whose `verifiedAt` the case can compare. A refusal that started carrying a timestamp would be a second additive evidence field and is failed by `TC-F3-003` and `M92`.
- The two moved goldens are regenerated from the *fixed* implementation by an explicit command, and the regeneration's diff is reviewed as a contract change (the attribution line joins the summary); no other golden moves in this change.
- The trailer and the fallback are stable declared bytes, not computed per run: a provider title that varies changes only `commitTitle`, never `commitMessage`, which is what lets `TC-F1-006` compare the message across two different requests.

### 8.3 Open Questions

| ID | Question / finding | Blocking? | Owner | Resolution path |
|---|---|---|---|---|
| OQ-TP-1 | **CLOSED by spec v1.1 (D1)** — the fallback is `merge(<ref>): squash <sourceRef>` built from the change ref and the request's source ref, which is the delivered local shape at `packages/cli/src/edge.ts:1515`; ADR-0012 §2 still shows the older form (see D8). | No — closed | @spec-writer (done, v1.1) | `TC-F1-007` composes the expected string in the case from the fixture's ref and `sourceRef`; a missing `squash ` token or a substituted ref fails naming both strings. |
| OQ-TP-2 | **CLOSED by spec v1.1 (D2)** — the "newness" comparison is replaced by attribution: one additive optional bounded field with the closed pair `recorded` \| `probe`, and the recorded arm names gate id, job and verdict. | No — closed; one element open as D7 | @spec-writer (done, v1.1) | `TC-F3-002` asserts `probe`; `TC-F3-003` asserts `recorded` plus gate id, job and verdict; the recorded arm's verification timestamp has no field (D7) and is asserted from the fixture. |
| OQ-TP-3 | **CLOSED by spec v1.1 (D3)** — the undecisive branch is `merge.sync-required` with reason `behind-unconfirmed` and a caveated remediation; `merge.transaction-aborted` no longer carries the sync remediation. | No — closed | @spec-writer (done, v1.1) | `TC-F2-005` asserts the identity, the reason, the observed state and the caveat; `TC-F2-004` asserts the abort code is absent from every not-mergeable outcome. |
| OQ-TP-4 | **CLOSED by spec v1.1 (D4)** — a declared landing gap refuses as `merge.transaction-aborted` at exit 1 with the operation and gap reason in evidence, adding no identity. | No — closed | @spec-writer (done, v1.1) | `TC-F1-008` asserts the code, exit, operation, verbatim reason, zero landing attempts and the nine-row count. |
| OQ-TP-5 | **CLOSED by spec v1.1 (D5)** — the milestone step's plan list is `would-apply` \| `satisfied` \| `skipped-noop` \| `skipped-gap`; mismatch and withheld closure are `skipped-noop` with residue. | No — closed | @spec-writer (done, v1.1) | `TC-F4-010` asserts the seven fixtures map onto those four outcomes and that no fixture yields `would-refuse`. |
| OQ-TP-6 | **CLOSED by spec v1.1 (D6)** — the message is exactly `Landed by the delivery lifecycle merge primitive.`, one bounded line, no interpolation. | No — closed | @spec-writer (done, v1.1) | `TC-F1-006` compares the bytes against a literal written in the case and against a second request (proving no interpolation); `TC-F1-001` compares the same bytes on the landing port. |
| OQ-TP-7 | **What exactly is GitHub's milestone close/read shape**, and is the attached read stably bounded at 200 (spec OQ-3)? | No — fixture-decided | delivery + review | `TC-SYNC-007` pins the shape and the cap; a different surface updates one fixture, not an assertion. |
| OQ-TP-8 | **What is the corpus size and finding count at the closeout boundary?** 80 folders measured 2026-11-18. | No | delivery | `TC-F5-008` asserts a floor and records the actual counts in §10. |
| OQ-TP-9 | **Does the delivery extend `merge-probe.ts`'s `newRedJobs` or add a sibling classifier?** Both are compatible with the ACs. | No | delivery | `TC-F3-002` asserts the observable (five refusal pairs plus their attribution), not the function name; `TC-F3-006` forbids a second *evaluator*, which is different from a naming choice. |
| OQ-TP-10 | **CLOSED by spec v1.2 (D7)** — the timestamp is not an evidence field: the `recorded` arm identifies its source record by gate id, job and verdict, and the timestamp remains on the persisted `merge.gate-verification` record that gate id + job resolves to; DM-2 still declares exactly one additive evidence field. | No — closed | @spec-writer (done, v1.2) | `TC-F3-003` asserts the three carried facts from the refusal, asserts no timestamp field is present, and corroborates `verifiedAt` from the resolved record; `M92` adds a timestamp field and must fail. |
| OQ-TP-11 | **ADR-0012 §2 still states the superseded fallback and an interpolated trailer.** See D8. | No — the spec's bytes are asserted; the drift is reported | owner + @decision-advisor | The record is amended before acceptance; no case is authored against the stale text, and `TC-F1-006`/`TC-F1-007` would fail if the ADR's form were implemented. |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-18 | @test-plan-writer | Initial test plan for GH-349. **81 cases** across nine groups (`TC-F1`…`TC-F7`, `TC-SYNC`, `TC-FLOOR`), covering all **46** acceptance criteria (`AC-F1-1..9`, `AC-F2-1..6`, `AC-F3-1..4`, `AC-F4-1..9`, `AC-F5-1..7`, `AC-F6-1..6`, `AC-F7-1..5`), API-1..7, DM-1..9 and NFR-1..13; traceability closed both directions with zero orphans; **84 mutation controls** in §7.5. Every §3.1 row names the delivered carrier of its assertion (the requirement this plan adds over a plain traceability table); three defect-named suites (F1, F4, F8) each carry a paired pre-fix control that must fail by name; the milestone step is proven offline over injected transports including GH-349's own withheld outcome; the automatic `landed` removal is proven unchanged across the step insertion; the seven queue properties each carry an injected-breach control; and §11 raises five specification defects (D1 fallback-subject text, D2 newness carrier, D3 sync-remediation carrier, D4 unnamed gap identity, D5 unreachable `would-refuse`) with the exact fix that would make each clause testable. |
| 1.1 | 2026-11-18 | @test-plan-writer | Realigned to **spec v1.1**, which resolves D1–D6. **Net count unchanged: 81 cases** (no case added, removed or renumbered; the reason triple and the attribution pair are asserted by existing cases, one value per case). **Changed cases:** `TC-F1-001` (byte-exact title and the verbatim trailer on the landing call), `TC-F1-006` (message is exactly `Landed by the delivery lifecycle merge primitive.`, no interpolation; second-request byte equality), `TC-F1-007` (fallback `merge(<ref>): squash <sourceRef>` composed in the case), `TC-F1-008` (gap refused as `merge.transaction-aborted` at exit 1 with operation + reason; nine rows), `TC-F2-002` (reason `behind` in `evidence.detail`), `TC-F2-004` (**repurposed**: the not-mergeable branch yields no clean pre-mutation abort; code set asserted with `merge.transaction-aborted` absent), `TC-F2-005` (reason `behind-unconfirmed`, observed state, caveated remediation), `TC-F2-007` (closed reason triple and attribution pair asserted on the declarations), `TC-F3-002` (attribution `probe`), `TC-F3-003` (attribution `recorded` with gate id, job, verdict; timestamp reduced by D7), `TC-F3-004` (no refusal and no attribution for an undeclared job), `TC-F4-010` (four-outcome plan list, `would-refuse` unreachable), `TC-FLOOR-005` (the two moved goldens named, the other thirteen byte-identical), `TC-FLOOR-008` (message is one line, no interpolation). **Register 84 → 91 controls** (M36 rewritten; M25 rewritten; M85–M91 added for attribution, the recorded arm, the attribution pair, trailer interpolation, the fallback token, the reason triple, and blanket golden regeneration). **§7.6** gains obligations (vi) the golden move and (vii) the reason triple, and the landing phase now owns `tests/golden/merge.test.ts` plus exactly the two regenerated golden paths. **§3.1** drops three reduced-carrier markers and keeps one element open on `AC-F3-2`; **§2** records the ADR-0012 drift. §11 records the six resolutions and two open findings (D7 timestamp carrier, D8 ADR drift). |
| 1.2 | 2026-11-18 | @test-plan-writer | Realigned to **spec v1.2** (D7 closed). **Net count unchanged: 81 cases**; no id added, removed or renumbered. **Changed case: `TC-F3-003` only** — it now asserts the three facts that identify the source record (effective gate id, job, verdict) from the refusal evidence, asserts the **absence** of a timestamp member on that evidence, and corroborates `verifiedAt` from the persisted `merge.gate-verification` record resolved by gate id + job, with the paired `probe` control retained. `§3.1` drops the last reduced-carrier marker and restores `AC-F3-2` to full coverage; `§3.2` `API-2`/`DM-2`, `§6` fixtures, `§7.6` obligation (vi) and `§8.3` `OQ-TP-10` are aligned to "timestamp on the record, never in the evidence". **Register 91 → 92** (M92: a timestamp member added to the refusal evidence, or the corroborating record unresolvable by gate id + job). §11 moves D7 into the resolved table and leaves D8 (ADR-0012 drift) open. |
| 1.3 | 2026-11-18 | @test-plan-writer | **Internal contradiction removed; no TC change** (count stays **81**, ids unchanged, coverage and bijection unchanged). §7.3 listed "the three committed provider tenants" as unchanged-by-obligation while §6, §7.4 (G4), §7.1, §7.2 and §7.6 obligation (iii) require the mock tier to carry the new `close-milestone` route pair — and that route data lives in `tests/fixtures/providers/conformance/github/tenant.json`. The rule is now stated once and consistently: the **GitHub** tenant is **extended append-only** with the write route and its read-back route plus expected projections (no existing route removed, reordered or retyped), while the **GitLab and Jira** tenants stay **byte-unchanged** because their posture is a declared gap. Edited: §6 (a "Conformance tenants" bullet), §7.1 (the conformance suite row's editable targets), §7.2 (two tenant rows), §7.3 (the extended list and the unchanged-by-obligation list), §7.4 (G4's expected signal), §7.6 (the conformance row's targets/read-only column and obligation (iii)), §8.1 (RSK-TP-2's mitigation) and §8.2 (a per-adapter-tenant assumption). No case body, no mutation row and no AC carrier changed. |

## 10. Test Execution Log

No case has been executed at authoring time: this file was produced in `test_planning` (phase 3), before delivery. Rows are populated during delivery and the quality gates with the exact command, exit code and a one-line result. `G12` evidence is also recorded as a pm-notes `notes:` entry. Three rows are by nature **review-verified or recorded** and are marked as such rather than given a fake suite.

| TC ID(s) | Run date | Command | Result | Notes |
|---|---|---|---|---|
| TC-F1-001..010, TC-F2-001..008, TC-F3-001..006, TC-F7-004 | — | `TMPDIR=$PWD/tmp/tmpdir bun test tests/behaviour tests/golden` | Not run | Pending delivery — landing/taxonomy/probe/serial fixtures; every absence paired with its positive; the three reasons and the two attributions each asserted by their own case |
| TC-F4-001..015 | — | `TMPDIR=$PWD/tmp/tmpdir bun test tests/behaviour/closeout-milestone-sync.test.ts tests/behaviour/closeout-milestone-write-failure.test.ts tests/structure/closeout-contract.test.ts` | Not run | Pending delivery — outcome matrix, withholding facts, idempotency, gap postures, GH-349's withheld case |
| TC-F5-001..007 | — | `TMPDIR=$PWD/tmp/tmpdir bun test tests/behaviour/phase-completion-convergence.test.ts tests/behaviour/pm-notes-lint-divergence.test.ts` | Not run | Pending delivery — four document-writing branches; the F4 control executes on every run |
| TC-F5-008 | — | `TMPDIR=$PWD/tmp/tmpdir <binary> lint <ref> --pm-notes --registry` over the corpus | Not run | Pending delivery — must record compared-phase count > 0 and findings 0; a zero count is ERROR |
| TC-F6-001..012 | — | `TMPDIR=$PWD/tmp/tmpdir bun test tests/behaviour/queue-integrity.test.ts tests/behaviour/closeout-queue-removal.test.ts` | Not run | Pending delivery — seven property blocks each with an injected breach; records which properties proved clean |
| TC-F7-001, TC-F7-002 | — | `TMPDIR=$PWD/tmp/tmpdir bun test tests/structure/defect-f1-merge-refusal-containment.test.ts` | Not run | Pending delivery — production pass + pre-fix failure in one case |
| TC-F7-003 | — | `TMPDIR=$PWD/tmp/tmpdir bun test tests/behaviour/defect-f4-phase-mirror.test.ts` | Not run | Pending delivery — the inequality `T1 !== T2` asserted before the equalities |
| TC-F7-005 | — | `TMPDIR=$PWD/tmp/tmpdir bun test tests/structure/defect-suite-presence.test.ts` | Not run | Pending delivery — assertion-presence registry |
| TC-SYNC-001..008, TC-FLOOR-001, TC-FLOOR-003, TC-FLOOR-008 | — | `TMPDIR=$PWD/tmp/tmpdir bun test tests/structure tests/checks tests/conformance` | Not run | Pending delivery — pins, identity total, parity census, vocabulary probes |
| TC-SYNC-003 | — | `TMPDIR=$PWD/tmp/tmpdir bun test tests/conformance` | Not run | Pending delivery — 30 cells, three adjudicated, mock route, 18-cell accounting |
| TC-FLOOR-002, TC-FLOOR-004 | — | `TMPDIR=$PWD/tmp/tmpdir bun test tests/boundaries tests/checks` | Not run | Pending delivery — guards, testkit neutrality, secret-read allowlist, sanitization canary |
| TC-FLOOR-005 | — | `TMPDIR=$PWD/tmp/tmpdir bun test tests/golden` | Not run | Pending delivery — two-run equality; `refusal-gate-human.txt`/`refusal-gate-scripted.json` regenerated by the explicit command (record its output here) and the other thirteen byte-identical |
| TC-FLOOR-006, TC-F7-006 | — | `TMPDIR=$PWD/tmp/tmpdir bun test tests/structure/ci-topology-pin.test.ts tests/checks/merge-suite-discovery.test.ts` | Not run | Pending delivery — pin equality + discovery |
| TC-FLOOR-007 | — | `TMPDIR=$PWD/tmp/tmpdir bun run scripts/checks/ci-topology.ts` and `TMPDIR=$PWD/tmp/tmpdir git diff --check` | Not run | Pending delivery — a missing `origin/main-tools` is an ERROR, never a skip |
| all | — | `TMPDIR=$PWD/tmp/tmpdir pnpm check` | Not run | Binding completion gate (G12); also recorded as a pm-notes `notes:` entry |
| TC-F4-012 (live half) | — | the change's own `closeout --apply` at the boundary | Not run | **Recorded**, not a suite: the expected outcome is withheld closure (`skipped-noop` + `closure-withheld`); a closed M4 record is a blocking finding (RSK-TP-4) |
| TC-SYNC-001 (diff half), TC-FLOOR-006 (diff half) | — | review of the change's touched files | Not run | **Review-verified**: the change's diff contains no `.github/workflows/**` path and no second table edit outside the declared ones |

## 11. Specification Defects Found

Six findings were resolved by **spec v1.1** (five raised by test planning and one by the PM) and the seventh, a residual carrier gap inside the D2 remediation, by **spec v1.2**. They are recorded here so the resolution stays auditable and so a reader can see which case now carries which closed clause. One finding remains open: **D8**, a decision-record drift created by D1/D6. It does not block the plan; the affected cases assert the spec's bytes and would fail by name if the stale decision text were implemented, and nothing is silently worked around.

### 11.1 Resolved in spec v1.1 and v1.2 (D1–D7)

| ID | AC / surface | Defect as found in v1.0 | Resolution | Case that now carries it |
|---|---|---|---|---|
| D1 | AC-F1-6, DM-1 | The fallback subject was stated as `merge(<ref>): <sourceRef>` while §2.1 quoted the delivered subject `merge(<ref>): squash <branch>`; a byte assertion had to choose and made the other sentence false. | The fallback is exactly `merge(<ref>): squash <sourceRef>` — the change ref, then the request's source ref — matching the delivered local shape at `packages/cli/src/edge.ts:1515`. | `TC-F1-007` composes the expected string in the case from the fixture's ref and `sourceRef`; `TC-F1-001`/`TC-F1-006` compare the title bytes. |
| D2 | AC-F3-2, DM-2, API-2 | "A job already not green is not reported as new" had no carrier: both paths emitted the same code and reason and the recorded path won by precedence. | Provenance replaces newness: one additive optional bounded evidence field with the closed pair `recorded` \| `probe`; the recorded arm also names gate id, job and verdict; the required-job refusal goldens move. | `TC-F3-002` (`probe`), `TC-F3-003` (`recorded` + gate id/job/verdict), `TC-F3-004` (neither for an undeclared job), `TC-FLOOR-005` (the two goldens). |
| D3 | AC-F2-3, AC-F2-2, DM-2 | The undecisive branch had to "carry the sync remediation" through a row whose remediation is generic, and the not-mergeable third branch was a clean pre-mutation abort. | `merge.sync-required` carries the closed reason triple `dirty`/`behind`/`behind-unconfirmed`; the undecisive branch is that identity with the caveated sync remediation; `merge.transaction-aborted` carries no sync remediation and is not used for this condition. | `TC-F2-001` (`dirty`), `TC-F2-002` (`behind`), `TC-F2-005` (`behind-unconfirmed` + caveat), `TC-F2-004` (abort absent), `TC-F2-007` (three-member set). |
| D4 | AC-F1-7, DM-2 | "A classified identity naming that gap" named no identity, and no third row was permitted. | A declared gap refuses as `merge.transaction-aborted` at exit 1 with evidence naming the operation and its declared `CapabilityGapReason`; concrete rows stay nine. | `TC-F1-008` (code, exit, operation, reason, zero attempts, row count 9). |
| D5 | AC-F4-6 | `would-refuse` was listed as a milestone plan outcome that no declared fact could produce. | The plan list is `would-apply` \| `satisfied` \| `skipped-noop` \| `skipped-gap`; a mismatch or a withheld closure is `skipped-noop` plus residue. | `TC-F4-010` (seven fixtures onto four outcomes, `would-refuse` unreachable). |
| D6 | AC-F1-6, API-1 (PM-raised) | The trailer was described as "composed from the change ref and the request identity", so no byte assertion was possible without inventing a format. | The message is exactly `Landed by the delivery lifecycle merge primitive.` — one bounded line, no leading/trailing whitespace, no interpolated value. | `TC-F1-006` (literal compared; second request proves no interpolation), `TC-F1-001` (same bytes on the landing call), `TC-FLOOR-008` (one line, within bound). |

| D7 | AC-F3-2 (recorded arm), DM-2, API-2 | The recorded-attribution arm had to name "the gate id, the job, the verdict, and the verification timestamp", but DM-2 permits exactly one additive evidence field (the attribution) and the delivered evidence has no timestamp field, so the fourth fact had no carrier. | **Resolved by v1.2.** The `recorded` arm identifies its source record by the effective gate id, the job and the verdict; the verification timestamp is **not** an evidence field and stays on the persisted `merge.gate-verification` record that gate id + job resolves to; DM-2 still declares exactly one additive evidence field. | `TC-F3-003` asserts the three carried facts, asserts the **absence** of any timestamp member on the refusal evidence, and corroborates `verifiedAt` from the record resolved by gate id + job; `M92` adds a timestamp field and must fail. |

### 11.2 Open findings

| ID | AC / surface | Defect | Why it matters for verification | What would make it testable |
|---|---|---|---|---|
| D8 | AC-F1-6, API-1 vs ADR-0012 §2 | ADR-0012 §2 still states the superseded fallback `merge(<ref>): <sourceRef>` and an interpolated trailer (`Change: <ref>` / `Delivery-Request: <system>#<id>`). Spec v1.1 (D1, D6) now binds `merge(<ref>): squash <sourceRef>` and the single verbatim line. | A case written against the ADR would contradict AC-F1-6 and fail the delivery; a reader could take the record as the authority it was before the remediation. No case may assert both. | Amend ADR-0012 §2 (and its §1 summary if it repeats the trailer) to the v1.1 forms before the record is accepted. Until then the plan asserts the spec's bytes and cites the drift; `TC-F1-006`/`TC-F1-007` would fail by name if the ADR's forms were implemented. |
