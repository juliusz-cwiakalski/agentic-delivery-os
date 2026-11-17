---
change:
  ref: GH-293
  type: feat
  status: Proposed
  slug: engine-first-operations
  title: "M2-S16: Engine-first delivery operations"
  version: "1.0"
  owners: ["engineering"]
  service: delivery-os
  milestone: "M2: Ceremonies, measurement, and memory"
  labels:
    - engine-first
    - handover-gate
    - repos
    - dispatch
    - dual-run
    - shell-fallback
    - merge
    - classification
    - documentation
    - m2
  version_impact: minor
  audience: mixed
  security_impact: low
  risk_level: medium
  dependencies:
    internal:
      - "delivered handover gate (M1-S9, TDR-0015): the four-condition predicate, evidence classes, incident-exclusive window, floor, corroboration matrix, and reversal semantics, applied by `evaluateHandoverGate`"
      - "delivered evidence read side (TDR-0020, TDR-0024): attempt and divergence ledgers with the bounded attempt read (`DISPATCH_MAX_ATTEMPT_RECORDS = 5000`) and the classified unreadable/truncated outcomes"
      - "delivered dispatch authority (GH-239): the folded authority document, `reversalAvailable`, and the per-repository `dual-run` → `authoritative` handover and reversal records"
      - "delivered `repos list` read (GH-288): the five-field row, the read-only store pass, the handover projection, and the `projects list --flat` byte-compatibility promise"
      - "delivered shell fallback (GH-239): `scripts/lib/dispatch-authority.sh` plus the four entry points and the five-key delivery-summary tail"
      - "delivered merge transaction (GH-225): the gate registry, freshness envelope, post-verification probe, squash landing, and classified refusals"
      - "delivered error table and classifier: declared `domainKind` per row, `DOMAIN_KINDS`, and the contained-internal fallback"
      - "delivered provider reads: the GitHub work-item, check-run, and request-detail adapters with the configured credential seam"
      - "delivered peak pausing (GH-294): lane parks, `status.laneParks`, brief park fields, `lanes` `peakEnforcement`, window-scoped spend evidence, park events"
      - "delivered owner hold (#280): the host-wide read-time hold gate, `status.ownerHold`, board `ownerHold`"
    external:
      - "none new (the merge restoration composes the already-delivered provider read and credential seams; no new vendor, endpoint, credential, or network surface)"
links:
  issue: https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/293
  related_changes: ["GH-293", "GH-239", "GH-266", "GH-288", "GH-289", "GH-290", "GH-294", "GH-280", "GH-225"]
  related_decisions: ["TDR-0031", "TDR-0015", "TDR-0020", "TDR-0024", "TDR-0026", "TDR-0029", "TDR-0030", "ODR-0004"]
  contracts:
    - "`dispatch dual-run summary` data gains `cleanDispatches`, `consecutiveCleanDispatches`, and `conditions[]` appended after `floor`; `truncation` stays last"
    - "`dispatch handover` data gains `conditions[]` (always present) and `reversible` appended after `unmetConditions`; `truncation` present iff `verdict == \"unverifiable\"`"
    - "`repos list` row gains `reversible` and `handoverGate` appended after `handoverState`; `projects.v1` and `projects list --flat` stay byte-identical"
    - "one shared `DispatchConditionStatus = {condition, status: \"met\" | \"open\"}` in the declared `truth, coverage, floor, corroboration` order"
    - "merge failure classification derives `domainKind` from the resolved error-table row; no new identity, row, `DOMAIN_KINDS` member, or exit"
    - "the production merge composition performs real tracker/CI/request-detail reads and resolves configuration, branch, base reference, and owner principal"
---

# CHANGE SPECIFICATION

> **PURPOSE**: Make engine-first delivery operable and observable without manufacturing evidence or widening the shell contract: accrue corroborated clean dispatches and report the handover gate's per-condition status on the summary, handover decision, and fleet row; project per-repository reversibility on the engine surfaces; keep the shell stack byte-stable and document the engine-first routine; correct the peak-pausing lane-read over-claim; and restore the production merge path (real reads, honest classification) so regular delivery can actually run through the engine — while flipping no repository.

## 1. SUMMARY

The handover gate already computes the four facts the milestone needs, but the machine surfaces discard them. `dispatch dual-run summary` reports window facts and an unmet list only; `dispatch handover` reports a verdict and, on refusal, unmet conditions; `repos list` folds only the latest handover operation and never evaluates the gate. So an operator cannot see which condition is open per repository, cannot see that a flip is reversible, and cannot tell whether the engine path is accruing corroborated deliveries.

This change projects what is already computed, additively:

1. `dispatch dual-run summary` gains `cleanDispatches` (declared identical to `corroboration.satisfied`), `consecutiveCleanDispatches` (the trailing clean run over counted attempts), and `conditions[]` — four `{condition, status}` entries in the declared order `truth, coverage, floor, corroboration`, with `status` in `met | open`.
2. `dispatch handover` always carries the same four-entry `conditions` plus `reversible` (the folded authority after the operation); window-level unverifiability stays at `verdict` + `truncation`, never a third condition status.
3. `repos list` evaluates the gate at read time and reports it per repository in a `handoverGate` block plus `reversible`, over one bounded attempts read per ready row, with declared failure behaviour (unreadable ⇒ classified exit 2 and no row; truncated ⇒ `unverifiable` + `truncation`; no evidence ⇒ empty-window evaluation).
4. Provider windows and holds become "engine-visible data" through a documented mapping of already-delivered effect surfaces; **no** new window/hold read, command, verb, or daemon tick is added, and the lane-read profile gap is declared instead of denied.
5. The shell stack is untouched: the five-key delivery-summary tail, the exit behaviour, and the authoritative deprecation pointer stay exactly as delivered; the "shell stays usable and documented" AC is proven by non-change plus a new operating guide.
6. The production merge composition is restored: real tracker/CI/request-detail reads and real configuration/branch/base-reference/owner-principal resolution, with failure classification derived from the resolved error-table row so no emit collapses to `fallback.internal`. The adjacent `verify deploy` production stub is a declared out-of-scope residual.
7. No repository is flipped. This repository stays `dual-run`; the flip remains a later owner act executed by `dispatch handover` once the gate reads eligible, and its reversal is observable on the engine surfaces.

Every delivered key, order, exit code, error identity, `projects.v1` byte, and shell summary byte remains valid; all contract changes are additive and the pinned suites are extended, not weakened.

## 2. CONTEXT

### 2.1 Current State Snapshot

The pieces this change composes are delivered on `main-tools`:

- **Handover gate (M1-S9, TDR-0015).** Eligibility is the conjunction of four separated facts over the counted dispatches in the evidence window: **truth** (zero false-success incidents, zero unresolved divergences), **coverage** (the eleven-token exposure **set** equals the TDR-0005 set), **floor** (at least 20 counted dispatches or at least 7 consecutive UTC dates with a counted dispatch), and **corroboration** (every counted success claim carries the evidence its outcome family requires). The declaration order is `truth, coverage, floor, corroboration` ([Dispatch Engine](../../../spec/features/feature-dispatch-engine.md) §Handover gate).
- **One computation, partial projection.** The pure evaluation produces all four condition facts; `dispatch dual-run summary` keeps only the unmet list and the aggregate corroboration block; `dispatch handover` returns `{repository, operation, recorded, noop, verdict, unmetConditions?}`; `repos list` folds only the latest handover operation into `handoverState`. The summary's and the handover's key orders are pinned by the delivered additive-stability suite (summary and handover cases).
- **Truncation and unreadability are distinct.** A truncated attempt read returns data at exit 1 with `verdict: "unverifiable"` and a `truncation` object; an unreadable or torn attempts/divergences ledger fails the read with `dispatch.state-unverified` and returns no data. `met | open` alone cannot express the window-level state.
- **Fleet read (`repos list`).** Each row carries exactly `repoKey`, `root`, `stateLocation`, `daemonReachable`, `handoverState` (`REPOS_ENTRY_FIELDS`); the read opens each project store read-only and performs no write beyond the delivered create-once identity marker and the delivered temp-sibling removal. `repos list` on an unreadable project state root fails `repos.state-unavailable` at exit `2`. `projects list --flat` is required to remain byte-identical to the delivered `projects.v1` payload ([Projects](../../../spec/features/feature-projects.md) §`repos list` contract). The production daemon composition is `supervise-only` and single-project scoped, so a daemon-hosted periodic evaluation would be invisible in the shipped build.
- **Reversibility already has one derivation.** The authority view carries `reversalAvailable`, derived from the folded operation (`authoritative` vs `dual-run`), and nothing projects it. A met bar appends a handover record and flips only the resolved repository; `--revert` appends a reversal record and restores `dual-run`, preserving history; replay appends no duplicate.
- **Shell fallback.** `scripts/lib/dispatch-authority.sh` reads the derived authority document as a plain file. In `dual-run` the four entry points behave as before with no pointer; in `authoritative` they print a bounded stderr deprecation pointer naming `dispatch <ref>` and `dispatch handover <repo> --revert` and remain executable. The delivery summary is a five-key text tail (`result=`, `pr_url=`, `exit_code=`, `closeout_unverified=`, `last_message=`) whose order is pinned by the delivered shell summary key-order test; the shell has no machine-readable mode.
- **Windows and holds are already engine-visible as effects.** Owner hold reaches admission refusal, queue blocking, `status.ownerHold`, and board `ownerHold`. A peak window reaches lane parks (`reason: "peak-window"`, `until`, `preservation`), `status.laneParks`, brief park fields, `lanes` `peakEnforcement`, window-scoped spend evidence, and `stop`/`parked` events. Declared/current windows have no read surface, and `QueueLane` carries no `providerProfile`: the lanes fold projects queue entries, leases, and parks, so a parked-only profile field would misstate presence for running lanes ([Peak Pausing](../../../spec/features/feature-peak-pausing.md)).
- **Merge is unusable through the production composition.** The production merge runtime is composed with `readWorkItem`, `readCheckRuns`, and `readRequestDetail` set to a credential refusal, `values: () => ({})`, and no branch, base reference, or owner principal. `merge <ref> --dry-run --json` therefore exits `2` as `fallback.internal` for every ref. The chain: the merge read failure hard-codes `domainKind: "provider"` for a code whose declared row is `config`; the CLI forwards the pair; the classifier refuses the kind/code contradiction and contains it as `fallback.internal` ([Merge / Verify / Deploy](../../../spec/features/feature-merge-verify-deploy.md)). The adjacent `verify deploy` production composition also stubs its target resolution (`no-target`).
- **Milestone contract.** M2-S16 asks for engine-first regular delivery, provider windows and holds as engine-visible data, periodic per-repository gate evaluation with the shell path green, and deprecation pointers after a flip; its ACs are corroborated accrual in the summary, per-condition reporting, a usable and documented shell path, and per-repository reversible flips ([M2 backlog](../../../planning/oss-tooling/milestones/m2/backlog.md) §M2-S16, lines 355-370).

**Users and current impact.** An operator planning a flip must read four separate summary fields and reconstruct the conjunction by hand, cannot see the gate from the fleet read that already opens every repository, and cannot see whether authority is reversible. Meanwhile the lifecycle merge path — the thing "delivery through the engine" depends on — refuses every ref with an internal fallback, so the engine cannot yet be the regular delivery path.

### 2.2 Pain Points / Gaps

- **Per-condition facts are computed and discarded.** The summary keeps an unmet list; the decision keeps a verdict; the fleet row keeps a handover operation. No surface reports the four conditions with a `met | open` status, so AC2 has no oracle and the operator re-derives the conjunction.
- **Accrual has no honest counter.** Nothing reports how many corroborated dispatches accrued or whether a clean streak is intact. `coverage` is an eleven-token set, so the story's "coverage grows by one per dispatch" cannot be represented; a numeric coverage counter would read exposure as progress.
- **Reversibility is invisible.** `reversalAvailable` exists and is projected nowhere; the shell summary cannot carry it without breaking a pinned five-key contract.
- **No per-repository evaluation host.** "Periodic evaluation per repository" has no surface in the shipped composition: no new command is justified, the daemon is `supervise-only`, and the fleet read never evaluates.
- **Window/hold visibility is claimed more broadly than delivered.** The peak-pausing page says the lanes read agrees on the nomination, while the lanes row carries no profile. Left uncorrected, the next reader builds on a false contract.
- **The merge primitive is dead in production.** Regular delivery cannot run lifecycle merge/closeout through the engine while the production merge composition refuses every ref, and the classification chain hides the real cause as `fallback.internal`.
- **The two story scenarios assert payloads that do not exist.** `SC-M2-S16-02` asserts per-dispatch coverage growth; `SC-M2-S16-03` asserts a shell `data.reversible`. Delivering them literally would require inventing a coverage counter and widening the shell contract in the change whose AC protects it.

## 3. PROBLEM STATEMENT

Because the handover gate's per-condition result is computed but never projected and no daemon-free per-repository evaluation surface exists, the operator cannot see which condition blocks a flip, how many corroborated dispatches accrued, or whether a flip is reversible — while the lifecycle merge primitive is unusable in production and collapses a configuration failure into `fallback.internal`, so regular delivery cannot actually run through the engine, and any attempt to satisfy the story's literal scenario text would either fabricate a coverage counter or widen the shell contract the story requires to stay stable.

**Who is affected.** The owner cannot authorize a per-repository flip on evidence they can read. The operator cannot run regular delivery through the engine because merge refuses every ref. The reviewer cannot verify AC1/AC2/AC4 without reconstructing the gate by hand. Downstream stories (retro/measurement, multi-repository operations) cannot consume one per-repository gate read.

## 4. GOALS

- **G-1** Report clean-dispatch accrual honestly: `cleanDispatches` identical to `corroboration.satisfied`, and a trailing-run `consecutiveCleanDispatches` that a non-clean dispatch breaks (ticket AC1; DEC-3).
- **G-2** Report the handover gate per condition on the summary, the handover decision, and the fleet row, from one shape in one declared order (ticket AC2; DEC-2, DEC-1).
- **G-3** Evaluate the gate per repository at read time on `repos list`, daemon-free and side-effect free, with bounded cost and declared degraded-evidence behaviour (ticket task "periodic handover-gate evaluation … per repository"; DEC-1).
- **G-4** Project per-repository reversibility on the engine surfaces (`dispatch handover` data, `repos list` row) from the delivered authority fold, leaving the shell untouched (ticket AC4; DEC-4).
- **G-5** Keep the shell path usable, unchanged, and documented throughout, with the engine as the documented regular delivery path and the flip a separate owner act (ticket AC3, AC4; DEC-6, DEC-9).
- **G-6** Satisfy "provider windows and holds as engine-visible data" by a documented mapping of delivered effect surfaces, adding no new window/hold read, and declaring the lanes-read profile gap as a known limitation while correcting the over-claiming sentence (ticket task (b); DEC-5).
- **G-7** Restore the production merge composition to real reads and real declared-configuration resolution so the lifecycle merge path works for a resolvable ref (ticket task "operate dispatch through the engine for regular delivery"; DEC-7, DEC-8).
- **G-8** Make failure classification faithful to the declared error table: derive the emitted domain kind from the resolved row, introduce no new identity/row/kind/exit, and pin it with a conformance test (DEC-7).
- **G-9** Restate the two unrepresentable scenarios to their truthful surfaces, record why the delivered payload forces each restatement, and show they do not weaken any story AC (DEC-3, DEC-4, DEC-10).
- **G-10** Deliver the documentation and planning-corpus reconciliation in the same change, including a new engine-first operating guide marked redistributable and the landing of TDR-0031 (ticket AC3; DEC-10).

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Surfaces reporting the four conditions from one producer (summary, handover, fleet row) | 3 of 3 agree on every fixture; `open` conditions equal `unmetConditions` in order |
| Fixtures where `cleanDispatches !== corroboration.satisfied` | 0 |
| Violations of `verdict == "unverifiable" ⟺ truncation present` | 0 |
| `repos list` rows carrying exactly the seven declared fields in order | 100% of ready and first-use rows |
| `projects list --flat` payload deviations from `projects.v1` bytes | 0 |
| `repos list` payload differences between two reads over unchanged state | 0 bytes |
| Unreadable-ledger fleet reads that fabricate a row | 0 (classified `repos.state-unavailable` at exit 2) |
| Shell delivery-summary keys and order deviations | 0 (five keys, pinned order) |
| Emitted `(kind, code)` pairs whose kind differs from the code's declared `domainKind` | 0 |
| `merge <ref> --dry-run --json` invocations collapsing a configuration failure to `fallback.internal` | 0 |
| `dispatch.handover` authoritative records attributable to this change | 0 |
| Corrected over-claim sentences remaining in the reconciled pages | 0 |
| New guide distribution marker | `ados_distribution: redistributable` present |

### 4.2 Non-Goals

- **NG-1**: No repository flip. This repository and every other repository stay `dual-run`; authority moves only through a later owner-executed `dispatch handover`.
- **NG-2**: No new command, verb, flag, daemon tick, scheduler, cache, or sampling for gate evaluation. The fleet read re-evaluates on every read.
- **NG-3**: No new window or hold read. Declared/current peak windows remain without a read surface; the change documents delivered effect surfaces.
- **NG-4**: No `QueueLane.providerProfile` field. The lanes fold cannot state profile presence truthfully; the gap is declared as a known limitation.
- **NG-5**: No shell contract growth. No sixth summary key, no new stdout line, no changed exit, no machine mode.
- **NG-6**: No change to `projects.v1` rows or the `projects list --flat` alias bytes.
- **NG-7**: No new error identity, error-table row, `DOMAIN_KINDS` member, or exit class; no three-valued condition status; no numeric coverage counter.
- **NG-8**: No `verify deploy` production-composition fix. The delivered `no-target` stub is recorded as an out-of-scope residual risk.
- **NG-9**: No migration, backfill, or seeding of attempt, divergence, handover, or reversal records.
- **NG-10**: No live model call, live credential read, live network call, or real sleep in the delivering test suite.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Clean-dispatch accrual and per-condition projection on `dispatch dual-run summary` | AC1 needs a corroboration-honest accrual number and an observable condition set |
| F-2 | Per-condition status and per-repository reversibility on `dispatch handover` | AC2 and AC4 need the gate's decision surface to name open conditions and whether authority can be undone |
| F-3 | Read-time per-repository gate evaluation and reversibility on the `repos list` row | "Periodic per-repository evaluation" must be readable without a daemon and without a side effect |
| F-4 | Engine-first regular delivery with the shell stack unchanged and documented; no repository flip | AC3 and AC4: fallback usability is proven by not changing it; a flip stays an owner act |
| F-5 | Provider windows and holds as documented engine-visible effect surfaces, with no new read | Task (b) is met by delivered surfaces; the lanes gap must be declared, not denied |
| F-6 | Production merge composition restored to real reads and real configuration resolution | Regular delivery cannot operate while the lifecycle merge path is unusable for every ref |
| F-7 | Failure classification derives the domain kind from the resolved error-table row | The merge defect's containment as `fallback.internal` hides the true failure; the declared table is authoritative |
| F-8 | Documentation, operating guide, planning corpus, and decision landing | The story's "documented" clause and the repository's reconciliation convention name concrete deliverables |

### 5.1 Capability Details

- **F-1 — Summary accrual and conditions.** `dispatch dual-run summary` appends, after `floor`, `cleanDispatches`, `consecutiveCleanDispatches`, and `conditions`. `cleanDispatches` is the number of counted attempts whose token is a success claim and whose corroboration is satisfied — declared **identical** to `corroboration.satisfied`, with one derivation and an identity test, never a second counting rule. `consecutiveCleanDispatches` is the length of the **trailing** run of clean counted attempts ending at the window's last counted attempt in ledger append order (the order the counted set carries); it is `0` when that attempt is not clean or the window is empty. Trailing-run semantics are chosen because the story describes a streak that a non-clean dispatch breaks; a longest-run metric would not break. `conditions` carries exactly four `{condition, status}` entries in the declared `truth, coverage, floor, corroboration` order, with `status` in `met | open` and no `detail` field (detail stays where it already lives). The optional `truncation` object stays last. The text form gains `clean_dispatches=`, `consecutive_clean_dispatches=`, and a `conditions=truth:<status>,coverage:<status>,floor:<status>,corroboration:<status>` line after `unmet_conditions=` and before the optional truncation line. No numeric coverage counter is added: it would be `coverage.present.length`, a derived duplicate that invites reading exposure as progress.
- **F-2 — Handover conditions and reversibility.** `dispatch handover` data always carries the same four-entry `conditions` (same shape, same order, no detail) and `reversible`. `unmetConditions` keeps its delivered shape and stays refusal-only. `reversible` is `true` iff the repository's latest folded handover operation after the operation is `authoritative` — so a recorded flip is `true`, an idempotent flip noop is `true`, a clean refusal is `false`, and a revert is `false`. This is the same rule the authority document applies to `reversalAvailable`; no second reversible rule exists. `truncation` is present exactly when `verdict == "unverifiable"`, and `unverifiable` remains a **window-level verdict**, never a third condition status: under truncation the statuses are explicitly "over the visible window", and `verdict`/`eligibility` remains the only eligibility signal. The data-level invariant `verdict == "unverifiable" ⟺ truncation present` holds on every data-returning surface. Handover and reversal **records** keep their existing conditions snapshot unchanged.
- **F-3 — Fleet read-time evaluation.** `repos list` (and only `repos list`) appends two fields to each row after `handoverState`: `reversible`, then `handoverGate` = `{verdict, conditions, countedDeliveries, cleanDispatches, truncation?}`. The block is computed in the same pass that already opens each project store, for every row whose state location is `ready`; a `first-use` row reports the fold of an empty window **without opening a store** (`ineligible`; `truth` met; `corroboration` met vacuously; `coverage` and `floor` open; `countedDeliveries: 0`), never an absent block and never an "unknown" row. Cost posture: one bounded attempts read plus one divergences read per ready row and a pure fold over the visible records; no write, network, model call, cache, or scheduler. Freshness is read time, so "periodic evaluation" means "every fleet read re-evaluates". Failure behaviour is declared: an unreadable, torn, or malformed attempts/divergences ledger fails the whole read through the delivered `repos.state-unavailable` identity at exit `2` with **no fabricated row** (the same rule the row already applies to an unreadable handover ledger); a truncated attempt read is not a failure — the row reports the evaluation over the visible window with `verdict: "unverifiable"` and the `truncation` object. The text table is unchanged: no sixth column, because the row's gate detail is a JSON read and the human per-condition view is the summary text.
- **F-4 — Engine-first with an unchanged shell.** The engine is the documented regular delivery path: `dispatch <ref>` appends real `pilot` attempt records and the lifecycle merge/closeout run through the engine primitives. Authority stays `dual-run`; the shell entry points stay executable and keep their five-key summary tail, their exit behaviour, and the pointer-only authoritative behaviour (a bounded stderr deprecation pointer naming `dispatch <ref>` and `dispatch handover <repo> --revert`, no stdout change). A flip is a separate owner act executed with `dispatch handover <repo>` once the gate reads eligible; its reversal is `dispatch handover <repo> --revert`, and both are observable per repository on the engine surfaces (F-2, F-3). `AGENTS.md`-level operating instructions are not rewritten; the new guide is the operator reference and the feature pages are the contract reference.
- **F-5 — Windows and holds as documented engine-visible data.** S16 adds no window or hold read and no code change for window/hold visibility. The spec and the reconciled pages state the delivered effect-surface mapping explicitly: **owner hold** → dispatch admission refusal, queue blocking, `status.ownerHold`, board `ownerHold`; **peak window** → lane parks with `reason: "peak-window"`, `until`, `preservation`, `status.laneParks`, brief park fields, `lanes` `peakEnforcement`, window-scoped spend evidence, and `stop`/`parked` events. A declared window is an *input* to admission and parking; its effect is what an operator acts on, and a declared-window read is a separate question. `QueueLane.providerProfile` is out of scope: the change corrects the sentence claiming that the lanes read carries the nomination, names the surfaces that do carry it (attempt history, daemon lane records, `status.laneParks`, board `PARKED`, spend window evidence), and records the lanes-read profile blindness as a declared known limitation.
- **F-6 — Production merge composition.** The production `merge` composition supplies real tracker work-item, check-run, and request-detail reads through the delivered provider adapters, and resolves its declared configuration, branch, base reference, and owner principal from real sources instead of stubs and empty values. With that composition, `merge <ref> --dry-run` evaluates the merge-applicable battery, appends one verification record, lands nothing, and reports the delivered outcomes: exit `0` when every merge-applicable gate passes, or a classified gate refusal at exit `1`. No new merge capability, verb, gate recipe, or record kind is added; the composition change makes the delivered transaction reachable in the shipped CLI. A regression exercised through the production composition (the existing dry-run behaviour test, `TC-MERGE-028`) proves the reachability.
- **F-7 — Classification faithfulness.** Every failure a production composition emits carries the `domainKind` declared by the resolved error-table row for its code. The merge read failure derives its kind from the resolved entry instead of hard-coding `provider`, so a `config.credential.missing` read failure is emitted as `config` at its declared projection and exit, can never be contained as `fallback.internal` (the containment that hides the true cause), and adds no error identity, no row, no `DOMAIN_KINDS` member, and no exit class. A code with no declared row keeps the delivered contained-internal behaviour and is treated as a composition conformance failure (the composition must not emit it). A conformance test asserts, over every code the production composition can emit, that the emitted `(kind, code)` pair matches the declared row.
- **F-8 — Documentation and corpus reconciliation.** The change reconciles `feature-dispatch-engine.md` (summary/handover surfaces, the fleet evaluation host, the no-flip operating definition), `feature-projects.md` (the `repos list` row contract and the unchanged flat alias), `feature-peak-pausing.md` (the corrected nomination sentence, the effect-surface mapping, the declared lanes limitation), `feature-merge-verify-deploy.md` (production composition and classification; the `verify deploy` residual), and `feature-autonomous-delivery.md` / `feature-resident-daemon.md` residual wording as needed. It adds a new operator guide under `doc/guides/` declaring `ados_distribution: redistributable` that covers daily engine-first operation, how to read the gate and the fleet row, how a per-repository flip and its reversal are performed, and the shell fallback. It updates the planning corpus: the M2-S16 `Progress:` line in `milestones/m2/backlog.md`, the `status.md` M2 snapshot addendum, the `milestones/m2/README.md` scenario row gaining `SC-M2-S16-03`, and the restated `SC-M2-S16-02` / `SC-M2-S16-03` in `test-scenarios.md`. It lands TDR-0031 with its `doc/decisions/00-index.md` row. It creates no new `doc/quality/test-specs/` entry: the convention makes the per-change test plan canonical and aligns the existing broader specs during test planning.

## 6. USER & SYSTEM FLOWS

```
Flow 1: Regular delivery through the engine accrues corroborated evidence
  The operator runs `dispatch <ref>` for a ticket.
  → The engine admits, spawns/resumes, classifies, and appends exactly one attempt
    record carrying the real outcome and corroboration.
  → A corroborated success is a clean counted dispatch.
  → `dispatch dual-run summary --repo <repo>` shows countedDeliveries plus one,
    cleanDispatches plus one, a clean streak of one or more, and the four
    conditions with their statuses.
  → The shell stack remains available throughout; in dual-run it prints no pointer.

Flow 2: Operator reads the gate per repository, then flips or reverts
  `repos list --json` is read.
  → Every ready row carries reversible and handoverGate{verdict, conditions,
    countedDeliveries, cleanDispatches[, truncation]} computed at read time.
  → While ineligible, the open conditions name what blocks the flip.
  → Once the gate reads eligible, the owner runs `dispatch handover <repo>`.
  → The handover data reports verdict eligible, conditions all met, recorded true,
    reversible true; the row reports reversible true for that repository only.
  → `dispatch handover <repo> --revert` appends a reversal record; handover data
    reports reversible false; the row reports reversible false; history is preserved.

Flow 3: Shell fallback before and after a flip
  A repository in dual-run: `deliver-ticket.sh REF` behaves exactly as delivered,
  five-key tail, exit unchanged, no pointer.
  A repository flipped to authoritative: the same invocation exits 0, keeps the
  five-key tail, and prints the bounded stderr deprecation pointer naming
  `dispatch <ref>` and `dispatch handover <repo> --revert`; it remains executable.
  Reversibility is read from the engine surface (handover data or fleet row),
  not from the shell output.

Flow 4: Degraded evidence on the fleet read
  A truncated attempts read for one ready repository: the row reports
  verdict unverifiable with the truncation object and conditions over the visible
  window; the read succeeds.
  An unreadable or torn attempts/divergences ledger: the whole read fails
  `repos.state-unavailable` at exit 2 and fabricates no row.
  A first-use repository: the row reports the empty-window evaluation with
  countedDeliveries 0, truth met, corroboration met vacuously, coverage and
  floor open — no store is opened.

Flow 5: Lifecycle merge through the engine
  The coordinator finalizes phases and runs `merge <ref> --dry-run` then `merge <ref>`.
  → The production composition performs real tracker, check-run, and
    request-detail reads and resolves configuration, branch, base reference, and
    owner principal.
  → Dry run evaluates and records the verification, lands nothing.
  → A gate failure is a classified refusal at exit 1 naming the gate; a
    configuration-read failure is classified by its declared row (never
    fallback.internal).
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- `dispatch dual-run summary`: additive `cleanDispatches`, `consecutiveCleanDispatches`, and `conditions[]` (four, declared order, `met | open`), plus the three text lines; `truncation` stays last; every delivered key and order unchanged.
- `dispatch handover`: additive `conditions[]` (always present) and `reversible`; `unmetConditions` refusal-only and unchanged; `truncation` present iff `verdict == "unverifiable"`; record shapes unchanged.
- `repos list`: additive row fields `reversible` and `handoverGate`, read-time evaluation per ready row over the bounded attempts and divergences reads, the declared degraded-evidence behaviour, first-use empty-window evaluation, unchanged text table, and unchanged `projects.v1` / `projects list --flat` bytes.
- One shared condition-status shape and the declared four-condition order as the single order authority across the three surfaces; the invariant that `open` conditions equal `unmetConditions` in order.
- The navigation/visibility statement for provider windows and holds as delivered effect surfaces, the correction of the over-claiming peak-pausing sentence, and the declared lanes-read profile limitation — documentation only, no window/hold read.
- The no-flip scope and the operational definition of engine-first regular delivery, with the shell stack unchanged and documented; the per-repository flip and reversal remain `dispatch handover` acts.
- The production merge composition: real tracker/CI/request-detail reads and real declared-configuration, branch, base-reference, and owner-principal resolution; the failure-classification derivation from the resolved error-table row; a regression through the production composition and a classification conformance test.
- Documentation deliverables: reconciliation of the named feature pages, a new redistribution-marked engine-first operating guide, planning-corpus updates (backlog progress line, status addendum, milestone README scenario row, restated scenarios), and the TDR-0031 landing with its index row.
- Compatibility work: extending the pinned payload/order suites by appending only, and extending the error/classification conformance coverage.

### 7.2 Out of Scope

- [OUT] Flipping this repository or any repository to `authoritative`; inserting a handover record; fabricating pilot evidence.
- [OUT] A new command, verb, flag, daemon tick, scheduler, cache, or sampling for gate evaluation.
- [OUT] A declared/current peak-window read, or any other new window/hold read.
- [OUT] A `QueueLane.providerProfile` field or any lanes-read profile projection.
- [OUT] Any addition to the shell delivery-summary keys, stdout lines, exits, or a shell machine-readable mode.
- [OUT] Changes to `projects.v1` rows or `projects list --flat` byte-compatibility.
- [OUT] A three-valued condition status (`met | open | unverifiable`), a numeric coverage counter, or a new condition vocabulary.
- [OUT] Any new error identity, error-table row, `DOMAIN_KINDS` member, or exit class.
- [OUT] The `verify deploy` production-composition stub (declared residual, RSK-8).
- [OUT] Migration, backfill, or seeding of historical attempt, divergence, handover, or reversal records.
- [OUT] Rewriting agent/command prompts or the consumer shell scripts beyond the documentation statements.

### 7.3 Deferred / Maybe-Later

- A declared/current peak-window read that shows a window *before* it opens (revisit trigger: an operator needs to plan around a window rather than act on its effects).
- A truthful `QueueLane.providerProfile`, which needs daemon lane records rather than a parked-only fold.
- A shell machine-readable mode; only then does projecting `reversible` on the shell tail lose its rationale.
- Fleet-scale evaluation beyond a bounded per-row read (a separate read verb or a row budget), if the per-row cost becomes unacceptable.
- A coverage-progress metric that is not a duplicate of the exposure set, if a different consumer question emerges.
- A tracker defect for the lanes-read profile gap (currently a documented limitation and out-of-scope boundary).

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A. No HTTP surface is added or changed. The affected command surfaces are existing CLI reads and writes:

| Surface | Change |
|---------|--------|
| `dispatch dual-run summary [--repo] [--json]` | Additive data keys `cleanDispatches`, `consecutiveCleanDispatches`, `conditions[]`; three additive text lines; delivered keys/order unchanged; `truncation` last |
| `dispatch handover <repo> [--revert] [--json]` | Additive data keys `conditions[]` and `reversible`; `unmetConditions` refusal-only; `truncation` iff `unverifiable`; records unchanged |
| `repos list [--json]` | Additive row keys `reversible` and `handoverGate`; text table unchanged; read-time evaluation |
| `projects list --flat [--json]` | Unchanged and byte-identical to `projects.v1` |
| `merge <ref> [--dry-run] [--json]` | No contract change; production composition restored to real reads and configuration |
| Shell entry points | Unchanged; five-key summary tail and pointer behaviour preserved |

### 8.2 Events / Messages

N/A. No event topic, kind, payload, or taxonomy version is added or changed. This change publishes no event and subscribes to none; the delivered taxonomy and its envelopes are untouched.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Summary additive fields | `cleanDispatches` (number, declared identical to `corroboration.satisfied`), `consecutiveCleanDispatches` (number, trailing clean run, `0` when none), and `conditions` (four entries) appended after `floor`; the optional `truncation` object remains last |
| DM-2 | Handover additive fields | `conditions` (four entries, always present) and `reversible` (boolean) appended after `unmetConditions`; `unmetConditions` keeps its delivered refusal-only shape; `truncation` present iff `verdict == "unverifiable"` |
| DM-3 | Shared condition-status shape | `DispatchConditionStatus = {condition: truth | coverage | floor | corroboration, status: "met" | "open"}`, four entries in the declared order, no `detail`; one producer, three readers |
| DM-4 | Fleet row additive fields | `reversible: boolean` and `handoverGate: {verdict, conditions[4], countedDeliveries, cleanDispatches, truncation?}` appended after `handoverState`; `REPOS_ENTRY_FIELDS` extended in that order; `projects.v1` and the flat alias carry neither |
| DM-5 | Emitted failure classification | For every code a production composition can emit, the emitted `domainKind` equals the code's declared error-table row (so `config.credential.missing` emits `config`); no row, kind, or exit is added |

### 8.4 External Integrations

The only external-facing change is that the production merge path begins performing the tracker, check-run, and request-detail reads the merge transaction already declares, using the already-delivered provider adapters and configured credential seam. No new vendor, endpoint, credential, environment variable, or network surface is added, and no new payload leaves the process. The fleet read performs no network call.

### 8.5 Backward Compatibility

- **Additive payloads only.** Summary, handover, and fleet-row keys are appended in the declared order; no delivered key is removed, renamed, reordered, or re-typed. The pinned key-order suites are extended by appending the declared keys and never weakened.
- **`projects.v1` and the flat alias stay byte-identical.** The new row fields exist only on the `repos` row; the retiring alias carries neither.
- **Exits and identities unchanged.** `dispatch` exits stay `{0, 1, 2}`; `repos` exits stay `{0, 1, 2}`; the error-table row count, `DOMAIN_KINDS`, and every delivered code remain as declared. The merge correction changes which declared kind is emitted, not the vocabulary.
- **One status vocabulary.** Condition status is `met | open` everywhere; `unverifiable` remains a verdict and is never a condition status. A consumer that ignores `verdict`/`truncation` and treats a condition status as eligibility is out of contract (a declared revisit trigger).
- **The shell contract does not grow.** Five summary keys in the pinned order, no new stdout line, unchanged exits and pointer behaviour; a `dual-run` repository sees exactly delivered behaviour.
- **No record or taxonomy change.** Handover/reversal records, attempt and divergence records, and the event taxonomy are unchanged; no migration is required (§19).

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Additive stability across every touched payload | 0 delivered keys removed, renamed, reordered, or re-typed; appended keys in the declared order; pinned order suites green |
| NFR-2 | Bounded, daemon-free fleet evaluation | Per ready row ≤ 1 attempts read bounded at 5000 records + ≤ 1 divergences read + a pure fold; 0 writes, 0 network calls, 0 model calls, no cache, no scheduler |
| NFR-3 | Fleet-read determinism | Two `repos list --json` reads over unchanged state are byte-identical; the row carries no wall-clock or relative-time field |
| NFR-4 | Truthful degraded evidence | `verdict == "unverifiable" ⟺ truncation present` on every data-returning surface; unreadable ledger ⇒ exit 2 with no row/data; 0 fabricated zeros, defaulted statuses, or "unknown" rows |
| NFR-5 | Classification totality | 0 emitted `(kind, code)` pairs whose kind differs from the declared row; 0 new error rows, `DOMAIN_KINDS` members, or exit classes |
| NFR-6 | Shell contract stability | Exactly five summary keys in the pinned order; 0 new stdout keys or lines; the `dual-run` no-pointer behaviour and the `authoritative` pointer-at-exit-0 behaviour unchanged; all four entry points executable |
| NFR-7 | No flip | 0 `dispatch.handover` authoritative records attributable to the change; every repository's authority unchanged |
| NFR-8 | Documentation conformance | The new guide declares `ados_distribution: redistributable`; 0 reconciled pages retain the corrected over-claim; documentation and prompt conformance checks green |
| NFR-9 | Hermetic verification | Real state store plus injected harness, tracker, CI, VCS, provider, and clock ports; 0 live network calls, 0 live credential reads, 0 live model calls, 0 real sleeps |
| NFR-10 | Cross-surface coherence | 100% agreement of the four condition statuses across summary, handover, and fleet row on every fixture; 0 violations of the open-set identity |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- The observables of this change are the contract fields themselves: `cleanDispatches`, `consecutiveCleanDispatches`, `conditions[]`, `reversible`, and the `handoverGate` block. No new telemetry event, metric, or log line is introduced.
- Every observable is a positive reading over present evidence: a clean count is composed from counted corroborated attempts; a condition status is composed from the folded window; a reversibility value is composed from the recorded authority. An unreadable ledger produces a classified failure, never a fabricated value; a truncated read produces a verdict plus truncation, never a padded window.
- The fleet read is repeatable: identical state produces identical bytes, so an operator can diff two reads and trust the difference only when state changed.
- The corrected documentation makes the window/hold observability boundary explicit: effects are observable on delivered surfaces; declared windows are not readable, and that absence is declared rather than implied.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | AC1's accrual cannot be demonstrated on a real repository inside the PR because coverage and the 20-dispatch floor are unmet | H | H | Prove accrual through the real state store and command path with injected ports (controlled composition), declare the post-delivery observation as the operational proof, and state that no evidence is fabricated | M |
| RSK-2 | The fleet read's per-row evaluation cost grows with fleet size or ledger size | M | M | One bounded attempts read (≤ 5000 records) plus one divergences read per ready row, no cache; a named revisit trigger reopens the hosting clause rather than silently sampling | M |
| RSK-3 | One torn attempts ledger now fails the whole fleet read instead of degrading one row | M | M | Declared failure behaviour and classified identity; delivery is never blocked (shell fallback and one-shot dispatch are unaffected); documentation states the strictness | M |
| RSK-4 | A restated scenario is read as weakening the story | M | M | The spec records each restatement, its forcing payload fact, its truthful replacement, and the story AC it still satisfies; the test plan derives oracles from the restated assertions | L |
| RSK-5 | The merge composition restoration introduces new live read behaviour or masks a real failure behind a different identity | H | M | Reuse the delivered provider adapters, credential seam, and classified read outcomes; derive the kind from the declared row; prove through the production composition with injected provider ports and a conformance test over every emittable code | M |
| RSK-6 | The classification conformance test covers only an enumerated subset and a future composition code escapes | M | M | Assert over every code the composition can emit and over the declared table rows; treat an undeclared emitted code as a conformance failure (`fallback.internal` remains the contained behaviour, not an accepted outcome) | L |
| RSK-7 | The shell contract drifts while the change is in review (a convenience key is added for SC-03) | M | L | The five-key tail and pointer behaviour are pinned ACs/NFRs; the scenario is restated to the engine surfaces; the delivered pinned test is unmodified | L |
| RSK-8 | `verify deploy` remains unusable in production (`no-target` stub), so deploy confidence cannot be read through the shipped composition | H | H | Declared out of scope with a named residual; documented in the merge/verify page and the operating guide as a known gap, not as delivered capability | H |
| RSK-9 | The over-claim correction is applied to one sentence and leaves other pages implying lanes carry the profile | M | M | The reconciliation names the corrected sentence, the replacement surfaces, and the declared limitation; documentation conformance plus review check the set | L |
| RSK-10 | A consumer reads `conditions[].status` as eligibility and ignores `verdict`/`truncation` | M | L | The contract states eligibility is `verdict`/`eligibility` only; the invariant test pins the open set; a declared revisit trigger reopens the shape if a consumer is found misreading it | M |
| RSK-11 | A defaulted or invented condition status appears for a first-use or empty window | M | L | Empty-window evaluation is declared field-by-field (`ineligible`, truth met, corroboration vacuous, coverage/floor open, zero counted); tests assert no store open and no fabricated row | L |

## 12. ASSUMPTIONS

- The four condition facts are already computed by the delivered evaluation; this change projects them and does not re-derive them.
- `coverage` is an eleven-token exposure **set**, so the story's per-dispatch growth clause is unrepresentable and must be restated.
- `repos list` already opens each project store read-only, so hosting the evaluation there adds a bounded read, not a new data path or a write.
- `projects.v1` and `projects list --flat` must remain byte-identical; new fields may exist only on the `repos` row.
- The production daemon composition is `supervise-only` and single-project scoped, so a daemon-hosted evaluation would be invisible in the shipped build; read-time evaluation is the only daemon-free host.
- One bounded attempts read plus one divergences read per ready row is acceptable at the expected repository count.
- This repository will remain `ineligible` after the change (coverage and the floor are unmet), so the flip and its reversal are proven by controlled composition plus post-delivery observation.
- The production merge path can obtain the declared tracker, check-run, and request-detail reads through the already-delivered credential seam; a missing credential is a classified refusal, not a stub.
- No out-of-repo consumer depends on the summary's key set beyond the declared additive rule; appended keys with preserved order are the compatibility contract.
- The delivered handover/reversal record shapes, the attempt/divergence record families, and the event taxonomy require no change.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | M1-S9 handover gate (delivered, TDR-0015) | The four-condition predicate and reversal semantics are applied unchanged |
| Depends on | Evidence read side (delivered, TDR-0020, TDR-0024) | Bounded attempt read, divergence block, classified unreadable/truncated outcomes |
| Depends on | Dispatch authority (delivered, GH-239) | Folded authority, `reversalAvailable`, handover/reversal records |
| Depends on | `repos list` and project reading (delivered, GH-288) | The row contract, read-only store pass, handover projection, flat-alias compatibility |
| Depends on | Shell fallback (delivered, GH-239) | Four entry points, five-key summary tail, deprecation pointer |
| Depends on | Merge transaction and gate registry (delivered, GH-225) | The transaction, probe, and classified refusals the production composition must reach |
| Depends on | Error table and classifier (delivered) | Declared `domainKind` per row; contained-internal fallback |
| Depends on | Provider read adapters and credential seam (delivered) | The real reads the merge composition must supply |
| Depends on | Peak pausing (delivered, GH-294) | The effect surfaces the window/hold mapping documents |
| Depends on | Owner hold (delivered, #280) | The hold surfaces the mapping documents |
| Depends on | M1-S18 resident daemon (delivered) | The `supervise-only` and single-project composition facts that rule out a daemon-hosted evaluation |
| Blocks | An owner decision to flip this repository | The gate is readable per repository and reversibility is visible, but the flip is a later act |
| Blocks | M2 retro/measurement consumption | One per-repository gate read is the input those layers can consume |

## 14. OPEN QUESTIONS

| ID | Question | Resolution | Status |
|----|----------|------------|--------|
| OQ-1 | Does the post-change regular-delivery routine live in a runbook guide or only in the feature reference? | Resolved: a new operator guide under `doc/guides/` declares `ados_distribution: redistributable` and covers daily engine-first operation, reading the gate and fleet row, performing a flip and its reversal, and the shell fallback; the feature pages remain the contract reference and cross-link the guide. | Resolved 2026-11-17 |
| OQ-2 | Does the lanes-read profile gap get a tracker defect or a spec-level out-of-scope declaration? | Resolved: declared as an out-of-scope boundary plus a known limitation in the reconciled peak-pausing page, with the over-claiming sentence corrected; no lanes-read code change. A tracker defect may be opened later without changing this contract. | Resolved 2026-11-17 |
| OQ-3 | Do real provider reads replace the merge credential stubs in this change, or remain declared stubs? | Resolved: they are replaced in this change, per the owner-authored scope comment on issue #293; the failure classification is derived from the declared row, `verify deploy` stays a declared residual. | Resolved 2026-11-17 |
| OQ-4 | Is a new `doc/quality/test-specs/` entry required? | Resolved: no. The per-change test plan is canonical and the existing `test-spec-dispatch-engine.md` and `test-spec-merge-verify-deploy.md` are aligned during test planning; no touched surface lacks an owning broader spec. | Resolved 2026-11-17 |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Per-repository gate evaluation is **read-time**, hosted on `repos list`; that row alone gains `reversible` then `handoverGate` after `handoverState`; no new command, verb, flag, or daemon tick; the evaluation runs in the existing project-read pass for every `ready` row, `first-use` rows report the empty window without opening a store; cost is one bounded attempts read plus one divergences read per ready row; unreadable ⇒ `repos.state-unavailable` exit 2 with no row; truncated ⇒ `unverifiable` + `truncation`; no evidence ⇒ the empty-window evaluation | TDR-0031 D1: the fleet read already opens every store, while a new verb or daemon tick adds a permanent surface or disappears in the shipped composition | 2026-11-17 |
| DEC-2 | One condition shape `DispatchConditionStatus = {condition, status: "met" | "open"}` is produced once and read by `dispatch handover`, `dispatch dual-run summary`, and the fleet row; `conditions` is always present with four entries in the declared `truth, coverage, floor, corroboration` order, carries no `detail`, and `unverifiable` stays a verdict-level state (`verdict` + `truncation`) | TDR-0031 D2: one derivation, one order, no third status that a consumer can average into "fine" | 2026-11-17 |
| DEC-3 | Clean accrual is `cleanDispatches` (declared identical to `corroboration.satisfied`) plus `consecutiveCleanDispatches` (the trailing clean run over counted attempts in append order, `0` when none); `cleanDispatches` also appears on the fleet row and `consecutiveCleanDispatches` does not; no numeric coverage counter exists, and SC-M2-S16-02 is restated to counted-dispatch growth plus first-appearance coverage growth plus clean accrual | TDR-0031 D3: the number that grows must be the corroborated number; exposure is not progress, and coverage is a set | 2026-11-17 |
| DEC-4 | `reversible: boolean` is projected on `dispatch handover` data and the `repos` row, derived from the folded authority after the operation (`true` iff `authoritative`, so a recorded flip and an idempotent flip noop are `true`; a clean refusal and a revert are `false`); the shell path is unchanged (no key, line, or exit); SC-M2-S16-03 is restated to shell exit 0 + pointer with reversibility read from the engine surface before and after `--revert`; a torn ledger refusing a recorded revert while the flip stands is a declared residual | TDR-0031 D4: the claim is about repository authority, so it belongs on the authority surfaces; the fallback's value is that it stayed stable | 2026-11-17 |
| DEC-5 | S16 adds no window or hold read and writes the delivered effect-surface mapping explicitly (owner hold → admission refusal, queue blocking, `status.ownerHold`, board `ownerHold`; peak window → `status.laneParks` with reason/until/preservation, brief park fields, `lanes` `peakEnforcement`, window-scoped spend evidence, `stop`/`parked` events); `QueueLane.providerProfile` is out of scope, the over-claiming peak-pausing sentence is corrected to the surfaces that do carry the nomination, and the lanes-read profile blindness is a declared known limitation | TDR-0031 D5: a declared window is an input to admission and parking; its effect is what an operator acts on, and a truthful lanes field needs daemon lane records | 2026-11-17 |
| DEC-6 | GH-293 flips no repository. "Operate dispatch through the engine for regular delivery" means the engine is the regular path appending real `pilot` attempts with lifecycle merge/closeout running through the engine primitives, while authority stays `dual-run`, the shell entry points remain the documented fallback with no pointer in `dual-run`, and the flip stays a later owner act executed by `dispatch handover <repo>` | TDR-0031 D6; GH-239 NG-1 and the unmet coverage/floor conditions still govern | 2026-11-17 |
| DEC-7 | The merge read-failure mismatch is **restoration of the declared error-table contract**, not a new decision: the emitted `domainKind` is derived from the resolved row (`config.credential.missing` ⇒ `config`), so no emit collapses to `fallback.internal`; no error identity, row, `DOMAIN_KINDS` member, or exit is added; a conformance test asserts every code the composition can emit matches its declared row | TDR-0031 D7: the row already declares `config`; the hard-coded `provider` contradicting it is the defect, and containing the contradiction is what hides it | 2026-11-17 |
| DEC-8 | The production merge composition is in scope: real tracker/CI/request-detail reads and real declared-configuration, branch, base-reference, and owner-principal resolution replace the credential-refusal stubs, empty values, and missing parameters; `verify deploy`'s production stub is a declared out-of-scope residual carried as a risk | The owner scoped the merge defect to this ticket (issue comment 2026-11-15); regular delivery cannot operate without the lifecycle merge path, while deploy confidence is a separable question | 2026-11-17 |
| DEC-9 | All contract changes are additive: appended keys in declared order, preserved delivered order, unchanged exits/identities/`projects.v1` bytes/five-key shell summary; the pinned payload/order tests are extended by appending only and never weakened or removed | The compatibility rule TDR-0031 C-2/D-shapes fix; the pinned suites are the guard, not an obstacle | 2026-11-17 |
| DEC-10 | Documentation, the new operating guide, the planning-corpus updates, and the TDR-0031 landing are deliverables of this change, not follow-ups; the two scenario restatements are recorded in the corpus and here, traced to their story ACs, with an explicit statement that no story AC is weakened | The story's AC3 says "usable and documented"; the repository reconciles planning truth per change; an unevidenced restatement is the failure TDR-0031 exists to prevent | 2026-11-17 |
| DEC-11 | `doc/quality/test-specs/` gains no new entry: the per-change test plan stays canonical and the existing dispatch-engine and merge/verify broader specs are aligned during test planning | The documentation handbook's convention (per-change plan, broader specs aligned) and the absence of an unowned surface | 2026-11-17 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Dispatch contracts and gate domain | Updated — the shared condition-status shape, the two accrual counters, and the three-surface projection from one producer (F-1, F-2, DM-1..DM-3) |
| `dispatch dual-run summary` surface and text output | Updated — appended data keys and three text lines; delivered keys/order unchanged (F-1) |
| `dispatch handover` surface | Updated — appended `conditions` and `reversible`; `unmetConditions` refusal-only; `truncation` iff unverifiable (F-2) |
| `repos list` read and project composition | Updated — read-time gate evaluation and reversibility per row, bounded reads, declared failure behaviour, unchanged text table and flat alias (F-3, DM-4) |
| Merge production composition | Updated — real tracker/CI/request-detail reads and real configuration/branch/base-reference/owner-principal resolution (F-6, DEC-8) |
| Failure classification | Updated — domain kind derived from the resolved error-table row; conformance coverage extended; vocabulary unchanged (F-7, DM-5) |
| Shell fallback entry points | Unchanged — five-key tail, exits, and pointer behaviour verified as unchanged (F-4, NFR-6) |
| Documentation: dispatch engine, projects, peak pausing, merge/verify/deploy, autonomous delivery, resident daemon | Updated — delivered contracts, the corrected over-claim, the effect-surface mapping, and the declared residuals (F-5, F-8) |
| New operator guide | New — engine-first daily operation, reading the gate, performing and reversing a flip, the shell fallback; `ados_distribution: redistributable` (F-8) |
| Planning corpus | Updated — M2-S16 backlog progress line, status snapshot addendum, milestone README scenario row, restated scenarios (F-8, DEC-10) |
| Decision records | Updated — TDR-0031 landing plus its `00-index.md` row (F-8) |

## 17. ACCEPTANCE CRITERIA

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** a repository with a folded evidence window of counted attempts, **when** `dispatch dual-run summary --repo <repo> --json` returns data, **then** `data.cleanDispatches` equals `data.corroboration.satisfied`, `data.consecutiveCleanDispatches` equals the length of the trailing run of clean counted attempts in ledger append order (`0` when the last counted attempt is not clean or the window is empty), and `data.conditions` has exactly four entries in the declared order `truth, coverage, floor, corroboration`, each `{condition, status}` with `status` in `met \| open`; every delivered key and its order is unchanged, and the optional `truncation` object remains last | F-1, DM-1, DM-3, NFR-1, DEC-3 |
| AC-F1-2 | **Given** any summary window (eligible, ineligible, or truncated), **when** the summary is compared with the handover decision over the same ledger, **then** the set and order of `open` conditions equals `data.unmetConditions[].condition`, `cleanDispatches === corroboration.satisfied` holds on every fixture, and the text form carries `clean_dispatches=`, `consecutive_clean_dispatches=`, and `conditions=truth:<status>,coverage:<status>,floor:<status>,corroboration:<status>` after `unmet_conditions=` and before the optional truncation line | F-1, DM-1, DM-3, NFR-1, NFR-4, DEC-2, DEC-3 |
| AC-F2-3 | **Given** any `dispatch handover <repo> --json` outcome that returns data, **when** the data is read, **then** `data.conditions` is always present with exactly four entries in the declared order, each `{condition, status}` with `status` in `met \| open`; `data.unmetConditions` is present only on refusal; `data.reversible` is a boolean equal to the latest folded authority being `authoritative`; `data.truncation` is present exactly when `data.verdict == "unverifiable"`; no condition `status` is ever `unverifiable`; and every delivered key keeps its position | F-2, DM-2, DM-3, NFR-4, DEC-2, DEC-4 |
| AC-F2-4 | **Given** a repository whose gate reads met (constructed by controlled composition over the real state store with injected ports), **when** `dispatch handover <repo>` records the flip and the same repository is later reverted with `dispatch handover <repo> --revert`, **then** `data.reversible` reads `true` after the recorded flip and after an idempotent flip noop, `false` after the recorded revert and on a clean refusal, the reversal record shape is unchanged, replay appends no duplicate record, and an unrelated repository's `reversible` and gate data are unchanged by the flip or the revert | F-2, DM-2, DEC-4, NFR-7 |
| AC-F3-5 | **Given** a host with `ready` and `first-use` project rows, **when** `repos list --json` is read, **then** every `data.repos[]` row carries exactly the delivered five fields followed by `reversible` and `handoverGate`; `handoverGate` carries `verdict` in `eligible \| ineligible \| unverifiable`, `conditions` (four, declared order, `met \| open`), `countedDeliveries`, `cleanDispatches`, and `truncation` only when the read was truncated; `handoverGate.cleanDispatches` equals the summary's `cleanDispatches` over the same ledger; and the `projects list --flat` payload remains byte-identical to the delivered `projects.v1` payload carrying neither new field | F-3, DM-3, DM-4, NFR-1, NFR-2, NFR-10, DEC-1 |
| AC-F3-6 | **Given** an unreadable or torn attempts/divergences ledger for one ready repository, **when** `repos list --json` is read, **then** the read fails with `repos.state-unavailable` at exit `2` and fabricates no row; **given** a truncated attempts read, **then** that row reports `handoverGate.verdict == "unverifiable"` with `handoverGate.truncation` present and condition statuses computed over the visible window; **given** a `first-use` row, **then** it reports the empty-window evaluation (`ineligible`; `truth` met; `corroboration` met vacuously; `coverage` and `floor` open; `countedDeliveries: 0`) without opening a store; and two consecutive reads over unchanged state are byte-identical | F-3, DM-4, NFR-2, NFR-3, NFR-4, DEC-1 |
| AC-F4-7 | **Given** a repository in `dual-run` and a repository whose authority is `authoritative`, **when** each shell entry point (`deliver-ticket.sh`, `batch-deliver.sh`, `pm-liveness.sh`, `ceo-loop.sh`) is invoked, **then** the `dual-run` invocation prints no deprecation pointer, the `authoritative` invocation exits `0` and prints the bounded stderr deprecation pointer naming `dispatch <ref>` and `dispatch handover <repo> --revert`, both remain executable, and the delivery summary keeps exactly five keys in the pinned order `result=`, `pr_url=`, `exit_code=`, `closeout_unverified=`, `last_message=` with no new stdout key or line | F-4, NFR-6, DEC-4, DEC-9 |
| AC-F4-8 | **Given** this change is delivered, **when** the authority state is inspected, **then** this repository and every repository in the fleet remain `dual-run` with no `dispatch.handover` authoritative record attributable to the change, the flip remains a separate owner act executed by `dispatch handover <repo>` once the gate reads eligible, and the operating guide documents the engine as the regular delivery path (`dispatch <ref>` appending real `pilot` attempts, lifecycle merge/closeout through the engine) with the shell stack as the documented fallback | F-4, F-8, DEC-6, NFR-7 |
| AC-F5-9 | **Given** the reconciled peak-pausing documentation, **when** the pages are read, **then** the owner-hold and peak-window effect-surface mapping is stated explicitly (owner hold → dispatch admission refusal, queue blocking, `status.ownerHold`, board `ownerHold`; peak window → `status.laneParks` with `reason`/`until`/`preservation`, brief park fields, `lanes` `peakEnforcement`, window-scoped spend evidence, `stop`/`parked` events), the former claim that the lanes read agrees on the nomination is removed and replaced by the surfaces that do carry it (attempt history, daemon lane records, `status.laneParks`, board `PARKED`, spend window evidence), the lanes-read profile blindness is declared as a known limitation, and no declared-window read or `QueueLane.providerProfile` field is introduced | F-5, DEC-5 |
| AC-F6-10 | **Given** the production CLI composition and a resolvable change ref, **when** `merge <ref> --dry-run --json` runs, **then** the composition performs real tracker work-item, check-run, and request-detail reads and resolves its declared configuration, branch, base reference, and owner principal from real sources; the command produces the delivered dry-run report (one verification record appended, zero landing mutations, no `result=merged`) at exit `0`, or a classified gate refusal at exit `1`; and it never emits `fallback.internal` for a configuration-read failure | F-6, F-7, DM-5, NFR-5, DEC-7, DEC-8 |
| AC-F7-11 | **Given** every failure code the production composition can emit, **when** the failure is classified, **then** the emitted error `kind` equals the code's declared `domainKind` in the error table (`config.credential.missing` classifies as `config`, not `provider`), no emitted `(kind, code)` pair contradicts the table, a merge dry run under a missing credential is classified by its declared identity at its declared exit, and the error-table row count, `DOMAIN_KINDS` membership, and exit classes are unchanged | F-7, DM-5, NFR-5, DEC-7 |
| AC-F8-12 | **Given** the change is delivered, **when** the documentation set is checked, **then** `feature-dispatch-engine.md`, `feature-projects.md`, `feature-peak-pausing.md`, `feature-merge-verify-deploy.md`, `feature-autonomous-delivery.md`, and `feature-resident-daemon.md` state the contracts and residuals named in §16; a new guide under `doc/guides/` declares `ados_distribution: redistributable` and covers daily engine-first operation, reading the gate and the fleet row, performing a per-repository flip and its reversal, and the shell fallback; the planning corpus carries the M2-S16 `Progress:` line, the `status.md` M2 snapshot addendum, the `milestones/m2/README.md` scenario row including `SC-M2-S16-03`, and the restated `SC-M2-S16-02` / `SC-M2-S16-03`; and TDR-0031 lands with its `doc/decisions/00-index.md` row | F-8, DEC-10, NFR-8 |
| AC-F8-13 | **Given** the restated scenarios, **when** the planning corpus and this spec are read, **then** `SC-M2-S16-02` asserts `countedDeliveries` grows by one per counted dispatch, `coverage.present` gains a token only on first appearance (at most one per dispatch, at most eleven overall), and `cleanDispatches` grows by one per corroborated dispatch; `SC-M2-S16-03` asserts the shell entry point exits `0` and prints its deprecation pointer while reversibility is read from `dispatch handover` data or the `repos list` row before (`true`) and after `--revert` (`false`) with per-repository isolation; and each restatement is traced to story AC1 or AC4 with an explicit statement that no story AC is weakened | F-1, F-2, F-4, F-8, DEC-3, DEC-4, DEC-10 |
| AC-NFR1-14 | **Given** the delivered pinned suites (the additive-stability summary/handover order suite, the fleet-row contract suite, the shell delivery-summary key-order case) and the error/classification conformance checks, **when** the change's quality gates run, **then** every delivered key, order, exit code, error identity, `projects.v1` byte-compatibility, and five-key shell summary remains valid; assertions are extended by appending only and none is weakened or removed; and no new command, verb, flag, error row, `DOMAIN_KINDS` member, or exit class exists | F-1..F-8, NFR-1, NFR-5, NFR-6, DEC-9 |

**Story traceability.** Ticket AC1 → AC-F1-1, AC-F1-2; ticket AC2 → AC-F2-3, AC-F3-5; ticket AC3 → AC-F4-7, AC-F8-12; ticket AC4 → AC-F2-4, AC-F3-5, AC-F4-8. Ticket task "operate dispatch through the engine for regular delivery" → AC-F6-10, AC-F7-11, AC-F4-8. Ticket task "provider windows and holds as engine-visible data" → AC-F5-9. Ticket task "periodic handover-gate evaluation … shell path kept green" → AC-F3-5, AC-F3-6, AC-F4-7. Ticket task "deprecation pointers … once a repository flips" → AC-F4-7.

**Scenario coverage and restatements.** `SC-M2-S16-01` → AC-F2-3, AC-F3-5. `SC-M2-S16-02` is **restated** (Appendix B) and covered by AC-F1-1, AC-F1-2, AC-F8-13. `SC-M2-S16-03` is **restated** (Appendix B) and covered by AC-F2-4, AC-F4-7, AC-F8-13. Both restatements are forced by the delivered payload: coverage is an eleven-token set (no per-dispatch growth is representable), and the shell summary is a pinned five-key tail with no reversibility producer. Neither restatement weakens a story AC: AC1 still requires corroborated accrual (now on the honest `cleanDispatches` counter), AC3 still requires the shell path usable and documented (now proven by an unchanged contract plus a guide), and AC4 still requires a per-repository reversible flip (now observable on the authority surfaces before and after `--revert`).

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- Full 11-phase lifecycle on `feat/GH-293/engine-first-operations`; plan phases declared in the plan; commits through the commit primitive; quality gate `TMPDIR=$PWD/tmp/tmpdir pnpm check` green before the PR; the PR targets `main-tools`.
- Order inside the change: contracts and the one producer first; the fleet host next; the merge composition and classification conformance after; documentation and planning-corpus reconciliation in the same change; no repository flip at any point.
- Consumption order outside the change: the operator reads the fleet row (ineligible, with open conditions), then runs regular deliveries through the engine (`dispatch <ref>`), then observes `cleanDispatches`/`consecutiveCleanDispatches` accrue; the flip is a later owner act once the gate reads eligible.
- Adoption is passive: no configuration is required, no flag is introduced, and no daemon is required. A `dual-run` repository sees exactly delivered shell behaviour; the only visible change is the additive JSON/text output.
- TDR-0031 lands as a Proposed record with this change; the owner accepts it at the PR review. Documentation ships in the same change so the corpus never states the restated scenarios without their replacement.
- `doc/quality/test-specs/` is not extended by this change (DEC-11); test planning aligns the existing dispatch-engine and merge/verify specs to the per-change plan.
- After merge, the accrual observation is an operating question, not a contract one: if the engine path is not actually used, the counters stay flat by design rather than being relaxed.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

None. All changes are additive payload fields, a read-time projection, a composition replacement, and documentation. No record family, schema version, handover/reversal record, attempt/divergence ledger, or event taxonomy changes; pre-change records stay valid and no backfill is performed. No repository is flipped, so no authority record is seeded.

## 20. PRIVACY / COMPLIANCE REVIEW

No new personal or credential data is collected or persisted. Condition statuses, clean counters, and reversibility are operational metadata about the delivery process. The merge restoration reads work-item, check-run, and request-detail data through the already-delivered provider seams under the delivered privacy posture (no log bodies, no message content) and stores only what the delivered transaction already records. The fleet read remains local and aggregates-only with respect to delivery evidence; it performs no network call. No tracker or vendor data flow is added.

## 21. SECURITY REVIEW HIGHLIGHTS

- No new credential, endpoint, environment variable, or network surface. The merge restoration uses the delivered credential seam and deny-by-default provider reads; a missing credential is a classified refusal, never a stubbed success.
- Deriving the failure kind from the declared row removes a class of masking: a configuration or provider failure can no longer be mislabeled as an internal fallback, which improves diagnosis without changing the security posture.
- The fleet read stays read-only with respect to store content (apart from the delivered create-once identity marker and temp-sibling removal) and gains no query, no arbitrary path read, and no write.
- The condition projection carries no free-text detail and no evidence bodies; the bounded `truncation` object and the status pair are the only new data.
- No new way to change authority is added: handover and revert remain the only writers, and the change adds no command that could flip a repository as a side effect.

## 22. MAINTENANCE & OPERATIONS IMPACT

- The `repos` row grows from five to seven fields; the row contract test is deliberately extended. Any future row field must respect the additive order and the flat-alias byte-compatibility.
- The fleet read pays one extra bounded ledger read per ready repository. Fleet-scale cost is a named revisit trigger; the remedy is a declared host change, not silent caching or sampling.
- A torn attempts ledger fails the whole fleet read by design. Operators can still deliver (shell fallback and one-shot dispatch are unaffected), and the classified identity names the cause.
- Condition status, accrual counters, and reversibility must stay single-derivation: any new reader consumes the shared producer, and the open-set/identity invariants remain test-pinned.
- The corrected peak-pausing documentation must stay corrected: any future claim that a lanes row carries a provider profile needs the field to exist first.
- The `verify deploy` production stub is a known operational gap; the guide and the merge/verify page must keep stating it as a residual, not as delivered capability.
- The five-key shell summary is a durable contract; future shell work must add a machine mode rather than a sixth key if more data is needed.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Handover gate | The four-condition predicate (truth, coverage, floor, corroboration) over the counted dispatches in the evidence window, declared by TDR-0015 |
| Condition status | `met` or `open` for one of the four conditions; the only per-condition vocabulary in this change |
| Clean dispatch | A counted attempt whose token is a success claim and whose corroboration is satisfied; identical by declaration to `corroboration.satisfied` |
| Clean streak | `consecutiveCleanDispatches`: the trailing run of clean counted attempts in ledger append order; a non-clean dispatch resets it to zero |
| Empty-window evaluation | The gate result over a window with no counted dispatches: `ineligible`, truth met, corroboration met vacuously, coverage and floor open, zero counted |
| Truncation | The bounded object describing an attempt read that omitted records; it accompanies `verdict: "unverifiable"` and only that verdict |
| Unverifiable | A window-level verdict meaning the evidence read was truncated; never a condition status |
| Reversible | `true` iff the latest folded handover operation for the repository is `authoritative`; the one authority-derived reversibility rule |
| `handoverGate` | The fleet row's per-repository evaluation block: verdict, four conditions, counted deliveries, clean dispatches, optional truncation |
| Read-time evaluation | Gate evaluation performed during a read, with no write, no daemon, no cache, and freshness equal to the read |
| Fleet read | `repos list`, the per-repository read that opens each project store read-only |
| Engine-first regular delivery | The engine (`dispatch <ref>`, lifecycle merge/closeout) is the documented regular delivery path while authority stays `dual-run` |
| Flip / handover | The owner act that records a handover and moves one repository to `authoritative`; reversed by `dispatch handover <repo> --revert` |
| Shell fallback | The four bash entry points plus `dispatch-authority.sh`, with the five-key delivery-summary tail and the pointer-only authoritative behaviour |
| Effect-surface mapping | The documented correspondence between an input condition (hold or peak window) and the delivered surfaces that expose its effects |
| `fallback.internal` | The contained-internal classification produced when a kind/code pair contradicts the declared error table; this change ensures no legitimate production failure reaches it |

## 24. APPENDICES

### Appendix A: Exact additive shapes

```text
dispatch dual-run summary data (existing keys unchanged, order preserved; appended):
  ... existing keys through floor ...
  cleanDispatches: number                     // === corroboration.satisfied
  consecutiveCleanDispatches: number           // trailing run, 0 when none
  conditions: [{ condition, status } x4]       // declared order, status: "met" | "open"
  truncation?: { bound, omittedRecords }       // unchanged, stays last

dispatch handover data:
  repository, operation, recorded, noop, verdict,
  unmetConditions? (unchanged, refusal only),
  conditions: [{ condition, status } x4],      // always present
  reversible: boolean,                         // folded authority === "authoritative"
  truncation?: { bound, omittedRecords }       // present iff verdict === "unverifiable"

repos list row (data.repos[], exactly these keys in this order):
  repoKey, root, stateLocation, daemonReachable, handoverState,
  reversible: boolean,
  handoverGate: {
    verdict: "eligible" | "ineligible" | "unverifiable",
    conditions: [{ condition, status } x4],
    countedDeliveries: number,
    cleanDispatches: number,
    truncation?: { bound, omittedRecords }
  }

unchanged: handover/reversal records, projects.v1 rows and `projects list --flat`
byte-compatibility, the five-key shell summary, every exit code and error identity
```

Summary text (appended after `unmet_conditions=`, before the optional truncation line):
`clean_dispatches=<n>`, `consecutive_clean_dispatches=<n>`,
`conditions=truth:<status>,coverage:<status>,floor:<status>,corroboration:<status>`.
The `repos list` text table is unchanged.

### Appendix B: Scenario restatements (forced by delivered payloads)

| Scenario | Delivered assertion | Why it is unrepresentable | Restated assertion | Story AC preserved |
|----------|--------------------|---------------------------|--------------------|--------------------|
| `SC-M2-S16-02` | `data.cleanDispatches` grows by one per corroborated dispatch and `data.coverage` grows with it | `coverage` is the eleven-token exposure **set**; it cannot grow by one per dispatch, and a numeric counter would be a derived duplicate of `coverage.present.length` | `countedDeliveries` grows by one per counted dispatch; `coverage.present` gains a token only on first appearance (at most one per dispatch, at most eleven overall); `cleanDispatches` grows by one per corroborated dispatch; `consecutiveCleanDispatches` grows on a clean streak and resets to zero on a non-clean counted attempt | AC1 (corroborated outcomes accrue) |
| `SC-M2-S16-03` | The shell entry point exits `0`, prints its deprecation pointer, and reports `data.reversible == true` | The shell summary is a pinned five-key text tail with no machine mode and no reversibility producer; adding a key trades the guarantee the AC protects | The shell entry point exits `0` and prints its deprecation pointer with the five-key tail unchanged; reversibility is read from the engine surface (`dispatch handover` data `reversible` or the `repos list` row `reversible`) before (`true`) and after `--revert` (`false`), with per-repository isolation | AC3 (shell usable and documented); AC4 (per-repository reversible flip) |

No story AC is weakened: the restatements move each assertion to the surface that can carry it and keep the underlying requirement intact.

### Appendix C: Window and hold effect-surface mapping (documented, no new read)

| Input condition | Delivered engine-visible effect surfaces |
|-----------------|-------------------------------------------|
| Owner hold (host-wide, no expiry) | Dispatch admission refusal; queue blocking; `status.ownerHold`; board `ownerHold` |
| Peak window (declared UTC window) | Lane parks with `reason: "peak-window"`, `until`, `preservation`; `status.laneParks`; brief park fields; `lanes` `peakEnforcement`; window-scoped spend evidence; `stop` and `parked` events |

Declared/current peak windows have no read surface and this change adds none. `QueueLane` carries no `providerProfile`; the surfaces that do carry a nomination are attempt history, daemon lane records, `status.laneParks`, board `PARKED`, and spend window evidence.

### Appendix D: Source anchors

- Ticket: GitHub issue 293 (milestone M2); backlog story M2-S16 in `doc/planning/oss-tooling/milestones/m2/backlog.md` (lines 355-370); owner-authored scope comment of 2026-11-15 (recorded in this change's pm-notes).
- Scenarios: `doc/planning/oss-tooling/milestones/m2/test-scenarios.md` — `SC-M2-S16-01` (M2-S16 section) and `SC-M2-S16-03` (cross-story scenarios); `SC-M2-S16-02` restated per Appendix B.
- Decided contract semantics: `doc/decisions/TDR-0031-engine-first-evaluation-surfaces.md` (D1–D7, shapes, scenario restatements; status Proposed, owner acceptance at the PR review).
- Related decisions: TDR-0015 (gate semantics, applied unchanged), TDR-0020 (divergences), TDR-0024 (attempt read side), TDR-0026 (queue lifecycle), TDR-0029 (taxonomy v2), TDR-0030 (park preservation), ODR-0004 (flat alias retirement at M3).
- Current-truth spec pages: `feature-dispatch-engine.md` (handover gate, surfaces, bash fallback, daemon composition), `feature-projects.md` (`repos list` contract, flat alias, state-location outcomes), `feature-peak-pausing.md` (nomination, effect surfaces, daemon-absent degradation), `feature-merge-verify-deploy.md` (command surfaces, probe, classification, `verify deploy`), `feature-autonomous-delivery.md` (shell delivery engine), `feature-resident-daemon.md` (composition, `supervise-only`).
- Pinned tests: `tests/behaviour/dispatch-additive-stability.test.ts` (summary and handover order), `tests/behaviour/repos-list-contract.test.ts` (row field set, determinism, read-only), `tests/behaviour/merge-dry-run.test.ts` (`TC-MERGE-028`), `tests/behaviour/merge-classification.test.ts`, `scripts/.tests/test-deliver-ticket.sh` (five-key summary order).
- Planning session: PM clarify-scope summary for GH-293 (this change's pm-notes), including the milestone attachment and the owner-scoped merge defect.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-17 | @spec-writer | Initial specification: encodes TDR-0031 D1–D7, the merge-composition restoration and classification conformance, the no-flip scope, the scenario restatements, and the documentation/corpus deliverables |

---

## AUTHORING GUIDELINES

- Authored from the GitHub issue 293 body (goal, tasks, four verbatim ACs, delivery conventions), the M2-S16 backlog story and milestone pack, the two authoritative scenarios plus the third cross-story scenario, the owner-authored scope comment (recorded in pm-notes), the TDR-0031 decision record (D1–D7 and the exact additive shapes), and the current-truth system spec pages named in Appendix D. No requirement is invented beyond those sources.
- TDR-0031's seven clauses are encoded as binding semantics and are not reopened. Its three residual questions (guide vs feature reference, lanes-gap remedy, merge stub replacement) are resolved by the PM scope and recorded as OQ-1..OQ-3 and DEC-5/DEC-8; DEC-11 records the test-spec convention answer.
- Every acceptance criterion names an observable payload field, command, or documentation artifact and is assertable by the automated suites or a precisely scripted check; no "ensure"/"support" phrasing is used without a pinned observable.
- Scope discipline: this spec states behavior and contracts only. Mechanism choices (where the projection is built, how each payload is serialized, how the merge composition is wired) belong to the plan.
- Technology-neutral phrasing with repository conventions: additive versioned payloads, one derivation per fact, truthful degraded evidence, closed vocabularies, and byte-compatible aliases are treated as standing guarantees this change joins rather than re-specifies.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-293)
- [x] `change.milestone` is the tracker milestone title verbatim and equals the pm-notes value (`M2: Ceremonies, measurement, and memory`)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1-25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, AC-, NFR-, RSK-, DEC-, DM-, OQ-)
- [x] Acceptance criteria reference at least one F-/NFR-/DM- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation details (no file-level code paths in requirements, no step-by-step tasks; test and documentation anchors appear as evidence references only)
- [x] No content duplicated from linked docs beyond anchored summary
- [x] Front matter validates per front_matter_rules
