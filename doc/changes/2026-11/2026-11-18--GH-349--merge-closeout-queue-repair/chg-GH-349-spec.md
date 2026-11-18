---
change:
  ref: GH-349
  type: feat
  status: Proposed
  slug: merge-closeout-queue-repair
  title: "M4-S11: Merge, closeout, and queue repair on the primitives (M4)"
  owners: ["engineering"]
  service: delivery-os merge primitive, closeout transaction, phase truth surface, and scheduling queue
  milestone: "M4: Jaiship-native delivery"
  labels: ["merge", "closeout", "phase", "queue", "m4-s11"]
  version_impact: minor
  audience: internal
  security_impact: low
  risk_level: high
  dependencies:
    internal:
      - M4-S1 installed, versioned binary (delivered)
      - merge and verify-deploy transaction with its gate-verification freshness envelope
      - closeout transaction with its operation ledger, outcome vocabularies, and judgment residue
      - delivery registry ledger and phase-state fold
      - scheduling engine queue graph, leases, parks, and reason-bearing removal
      - adapter operation set, capability declarations, and the provider client seeds
      - adapter conformance suite, parity matrix, and declared-difference register
      - pm-notes lint surface and its documented/machine error-table sync
      - decision records ADR-0012, TDR-0040, ODR-0005 (Proposed; accepted by the owner at review)
    external:
      - GitHub pull-request landing and milestone REST surfaces (fixture-proven; no live call in tests)
      - GitLab and Jira capability postures (declared gaps only)
---

# CHANGE SPECIFICATION

> **PURPOSE**: Remove the last manual steps from the CEO merge-and-cleanup loop by making landing, refusal, closeout, and queue repair primitives-only and truthful — a landing that is provider-verified with a crafted squash subject and message at an exact head, one typed outcome for every mergeability state including the one the provider has not decided, a closeout that leaves no leftover worktree, a closed issue, and a milestone whose exit review was actually evaluated, both phase surfaces agreeing after every transition, and one regression per named defect that fails on the pre-fix behaviour.

## 1. SUMMARY

This change reconciles the merge primitive onto the one mechanism that can observe its own effect, gives every merge refusal one honest identity, adds the missing planning-unit half of closeout, makes the phase mirror a derived surface with detected (never repaired) divergence, and repairs the delivered queue surface only where a proof fails.

Four outcomes define it. First, `merge` lands through the closed `merge-delivery-request` adapter operation at the exact head the freshness envelope verified, with the delivery request's provider-asserted title as the squash subject and a fixed bounded trailer as the message; a landing is `merged` only when the provider asserts it merged, and the recorded landing identity is the provider's merge commit. Second, each mergeability state resolves to one outcome: a conflicting request refuses with one typed `merge.sync-required` and never rebases, a `not-mergeable` request is offered to the provider and its refusal is classified by one bounded re-read, an `unknown` request is recovered by exactly one exact-head re-read before `merge.mergeability-unknown`, and a required check that re-enters `queued` or `running` on the verified head is gate evidence rather than invisible. Third, `closeout --apply` gains milestone synchronization as step 12 of 13 — verify the change's declared milestone against the provider-asserted attachment, evaluate the exit review over one bounded read, and close through one new `close-milestone` operation whose vocabulary cannot express creating, attaching, detaching, renaming, or reopening a milestone — with a withheld closure reported as `skipped-noop` plus one additive residue kind, a write failure still gating at `closeout.write.failed` exit 2, and dry-run and idempotency visible like every other step. Fourth, the delivery-registry ledger stays the only phase truth: every document-writing branch derives the mirror's `completed` from the post-transition fold, `started` is never rewritten, and one additive `lint.phases.divergent` row on the existing both-target reports drift without repairing it.

Nothing else widens. No new queue verb, record kind, or state key exists; no milestone is created, attached, detached, renamed, or reopened by any agent path; no merge queue, force, bypass, auto-merge, or landing retry becomes representable; no workflow job, trigger, or artifact field is added; and the additive contract surface is enumerated in full in Appendix D with counts before and after. The three named defects ride in with defect-named regressions and a failing control each: F1 (a merge refusal reaching the containment identity), F4 (the phase mirror taking the earliest recorded completion instead of the fold), and F8 (serial-merge churn caused by an internal rebase that cannot affect the provider).

## 2. CONTEXT

### 2.1 Current State Snapshot

- `merge` is a verified transaction: it consumes the newest gate-verification record, enforces a freshness envelope over the verified head, performs one bounded post-verification probe, authorizes and records waivers, attempts exactly one local rebase-refresh, lands one local squash commit, verifies the landing against local containment plus a literal provider state, and records the outcome in `merge.transaction`.
- The landing mechanism cannot publish anything. The local git seam's landing performs a checkout, a squash merge, and a commit, declares "no network, no remotes", has no push on any composition path, and returns `requestState: "merged"` as a string literal; the transaction then treats that literal plus local ancestry as landing truth. The composition synthesizes the squash subject as `merge(<ref>): squash <branch>`.
- The adapter layer already declares and implements a provider-side landing: the closed `merge-delivery-request` operation with a squash strategy, an optional crafted commit title and message, and an optional expected-head guard, at most once per invocation, read-back verified, with GitHub supporting it and GitLab declaring `adapter-not-implemented` and Jira `provider-unsupported`. No lifecycle path composes it; the merge specification and TDR-0033 both record the coexistence as deliberately unreconciled.
- The normalized `DeliveryRequest` carries identity, source and target refs, review state, threads, an optional merged head, an optional source head, an optional mergeability, and three optional gate facts — and no title. The normalized mergeability has four values: `mergeable`, `conflicting`, `not-mergeable`, `unknown`. The normalizer maps `blocked`, `behind`, `unstable`, and `draft` into `not-mergeable` and never defaults to `mergeable`.
- The transaction refreshes only when the request reads `conflicting`; a `not-mergeable` request proceeds straight to the landing. The refresh is local-only (checkout plus rebase, no push), so it cannot change what the provider accepts, and its only observable effect is that the head moves and the SHA-bound verification is voided.
- The post-verification probe detects only newly **failing** declared jobs. The declared `required-ci-job` gate evaluation already treats `queued` and `running` as not-green with the `ci-pending` reason, and the shared CI classifier already buckets `queued`/`running` as pending, so a required check that re-enters `queued` on the verified head is already not-green in the gate evaluation and invisible to the probe.
- `merge` is also the surface where the containment identity is reachable: the CLI classifier resolves a failure by declared kind and code, and any emitted pair whose code is undeclared, or whose code resolves to a different domain kind, is contained as `fallback.internal` at exit 2. The merge composition publishes its emittable failure codes as one exported declaration — seventeen members at runtime: seven forwarded configuration codes, three read identities, and seven merge identities — and the `merge.gate.<gate-id>.failed` family the transaction emits from its refusal path is not represented in it, so the classification-totality proof ranges over a set that does not cover every code the command can emit.
- `closeout` is a dry-run-by-default, twelve-step transaction with a SHA-256 operation ledger over an append-only operation history, terminal outcomes reused on re-run, an additive non-step disclosure block for its queue removal, and a bounded judgment residue of eight closed kinds. Its step order is binding, and consumers resolve steps by `stepId`. The plan and apply outcome vocabularies already admit `would-apply`, `satisfied`, `would-refuse`, `skipped-noop`, `skipped-gap`, `applied`, `failed`, and `refused`.
- No milestone surface exists anywhere in the product packages: repository scan for `milestone` (2026-11-18) finds only the work-item normalizer's verbatim milestone title (absent-means-unknown), pm-notes' optional `milestone` key, and ceremony inputs. The only work-item write is labels plus an assignee clear. The closed adapter operation set has nine members and no milestone surface. The milestone operating rule (naming `M<n>: <outcome phrase>`, tracker record as source of truth, attachment at creation, exit review before closure, agent never creates a milestone autonomously) is written and binding.
- The closeout transaction already retires the work item's queue entry with reason `landed` after its writes, inside the single-writer fence it holds, as a fail-open non-step disclosure that changes no step outcome and no exit code, and it already removes a delivery-owned local worktree and deletes the squashed local branch under explicit safety predicates.
- The phase surface declares the ledger as the only truth: `phase list` folds the verified transitions, the per-change phase-state document is a disposable projection, and the pm-notes document carries the same phase map as a mirror written by the same command. `started` is written only when an entry is created; an existing entry receives only `completed`.
- The one mirror branch that breaks that declaration is the convergence path: when a completion re-run finds both a record and a commit already present, the document is re-staged from the **first** matching completion in the full history, while the fold defines `completed` as the **latest** completion. A reopen followed by a re-complete therefore leaves the document carrying the pre-reopen timestamp, and the same stale value is reported as the no-op evidence. No surface compares the two.
- The five pm-notes lint rows validate one surface each and no cross-surface comparison exists. The both-target invocation (`--pm-notes --registry`) already reads both surfaces in one run — pm-notes first, then registry, first failure wins — but its registry read returns counts, verification classes, and projection presence only, with no fold. The machine error table declares 149 rows and the documented table declares the same 149 identities under a bidirectional sync check.
- `queue` ships the complete lifecycle over an append-only, fence-guarded graph: add, prioritize, dep add/remove, remove with one of four closed reasons, reconcile against tracker truth under a bound, claim/release with repo-exclusive leases, per-ref single-flight admission naming the holder at the envelope root, parks over a closed cause vocabulary, and presence decided by ledger append position rather than by timestamp text. The delivered queue surface carries a broad characterization battery — behaviour suites over queue CRUD, leases, parks, reconcile, removal, single-flight, and member refs — and no suite named after a defect (scan of the behaviour suite names, 2026-11-18).
- The scheduling engine and the closeout transaction share one reason-bearing removal seam; the automatic closeout removal and the explicit `queue remove` verb deliberately differ in idempotency (the automatic path converges; the explicit verb refuses an unobserved ref).
- Binding invariants that constrain this change: additive-within-v1 contract evolution; a closed adapter operation set that appends and is never reordered; capability honesty (support or a declared gap, never an implied parity); documented and machine-declared error rows moving together with no pattern widening; a runtime-neutral, dev-only testkit; offline determinism with network and child-process containment; the pinned CI topology; and the injected-transport rule that adds no credential, transport, or network location.

### 2.2 Pain Points / Gaps

- **A landing that cannot be observed cannot be trusted.** The recorded `merged` result is produced by the mechanism rather than read from the system of record: no request is merged on the provider, the recorded squash identity exists only in one checkout, and closeout's merge truth and merged-diff anchor therefore describe an object the provider never created. GH-349's F4 verification bar — merge lands with crafted metadata without a platform CLI — is unreachable while the composed path cannot publish.
- **One cause, three conflated refusals.** "The branch conflicts", "required checks or reviews are not satisfied", and "the provider has not decided" all reach the operator as one generic abort with opaque detail, and "behind its base" is not consulted at all. The operator cannot tell which action to take, so the human step this story exists to remove comes back as manual diagnosis.
- **The churn loop is the defect, not the fix.** The internal refresh cannot affect the provider; it can only move the verified head, void the evidence, and force another verify-and-retry cycle per serial merge. The three named defects are its evidence: F8 records the churn, F1 records a refusal that reached the containment identity instead of its declared one, and F4 records two phase surfaces that disagreed after a legitimate reopen.
- **The probe has a blind spot exactly where CI flaps.** A required job that re-enters `queued` or `running` on the verified head is already not-green in the gate evaluation and invisible after verification, so a merge can fire on evidence that has already changed.
- **"No leftovers" excludes the planning unit.** The milestone that is the tracker's statement of scope is closed by hand, after the last ticket, from an operator's memory — the one bookkeeping act the loop still cannot perform, and the one whose premature execution is unsafe.
- **Two phase surfaces, one fact, no agreement guarantee.** The mirror is written from an identity lookup over history rather than from the fold that defines state, so a re-completed phase reports a stale timestamp in the document and in the evidence, and nothing detects the disagreement that predates or follows the fix.
- **Queue integrity is asserted by breadth, not by defect.** The delivered queue surface is well covered but carries no regression named after a defect, so a property that silently regresses between changes has no failing control that says which property broke.
- **Affected users:** the coordinator and `@pm` that run the loop and branch on the refusal vocabulary; operators who own the checkout, worktrees, and milestone state; reviewers and readiness roles who read pm-notes as the human-facing phase record; the closeout capsule cross-check that derives expected events from the same ledger; the adapter and conformance owners who must move the parity surface with the operation set; and the maintainers of every downstream consumer that resolves closeout steps by id.

## 3. PROBLEM STATEMENT

Because the lifecycle landing mechanism cannot publish or observe a provider landing, because every merge refusal cause collapses into one opaque abort while the one client-side action that could change the cause is a local rebase that only voids verification, because closeout has no planning-unit half and the phase mirror is written from a history lookup rather than from the fold that defines state, the CEO merge-and-cleanup loop still requires manual steps and can record outcomes the system of record never asserted; GH-349's four acceptance clauses — a landing with crafted metadata and a typed result without a platform CLI, a typed sync-required outcome for an out-of-date request, a closeout that leaves no leftover worktree, a closed issue and a synced milestone, and two phase sources that agree after every transition — are therefore unreachable, and the mutation error of a temporary disclosure must not be repeated by repairing the symptom. The change is not "modernize merge": it is **bind every recorded outcome to a mechanism that can observe its own effect, and give every refusal one honest identity**, then carry that same discipline into closeout, the phase mirror, and the queue surface.

## 4. GOALS

- **G-1**: A landing is one provider-verified mutation with crafted, deterministic squash metadata and an exact-head guard, composed through the closed adapter operation and no platform CLI.
- **G-2**: Every mergeability state has one typed outcome, including the state the provider has not decided, and no path mutates the head it verified.
- **G-3**: Required-check awareness treats queued and running checks as not-green both before and after verification, for declared required jobs only.
- **G-4**: `closeout --apply` synchronizes the change's declared milestone: verify the attachment, evaluate the exit review over one bounded read, close through one narrow operation, withhold otherwise, and stay idempotent and dry-run visible.
- **G-5**: The delivery-registry fold is the only phase truth, the pm-notes mirror is written from it on every document-writing branch, and divergence is reported once without being repaired.
- **G-6**: The delivered queue surface is proven property by property, repaired only where a proof fails, and widened by nothing.
- **G-7**: Each named defect (F1, F4, F8) lands with a regression named after it whose control fails on the pre-fix behaviour.
- **G-8**: The change stays additive and synchronized: every new identity, field, step, residue kind, and operation moves its documented, machine-declared, conformance, parity, and pinned-count surfaces in the same change.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Landing provenance | 100% of `result=merged` outcomes require a provider-asserted merged read-back; a fixture whose local containment is true and whose provider state is not merged refuses |
| Crafted metadata fidelity | The squash title equals the provider-asserted request title verbatim, or the declared fallback; the message equals the composed trailer; 0 operator-supplied or free-form metadata inputs |
| Head guard | A head that moves after verification refuses with exactly 0 landing calls |
| Refusal taxonomy totality | Dirty, behind, checks-posture, unknown-then-recovered, and unknown-persisting each resolve to their declared identity: ≥1 case each, 0 cases reaching the containment identity |
| Churn | ≤1 landing call per invocation and 0 head mutations across a three-merge serial fixture |
| Queued-check awareness | ≥1 case where a required job re-entering `queued` on the verified head refuses; 0 non-declared jobs treated as evidence |
| Milestone sync fidelity | 0 closes across the open-item, unavailable-signal, unknown-state, and truncated-set fixtures; exactly 1 close across the satisfying fixture; 0 writes in plan mode |
| Phase agreement | 100% of transition combinations (complete, re-complete, reopen, reopen→re-complete, absent phase) leave the mirror equal to the fold; 0 occurrences of a pre-reopen timestamp after a re-complete |
| Divergence detection | A diverging completion yields exactly one `lint.phases.divergent` naming the phase and both values; 0 writes, 0 fences, 0 appends; 0 findings for document-only completions |
| Corpus stability | 0 new lint findings across the acceptance corpus; any hit is investigated as a second-writer defect, never suppressed |
| Queue integrity | 7/7 integrity properties carry a defect-named regression with a failing control; 0 breaches left unrepaired; 0 new verbs, record kinds, state keys, or flags |
| Additive sync | Error identities 149→152 declared on both tables; adapter operations 9→10 with 3 cells adjudicated; closeout steps 12→13; residue kinds 8→9; pm-notes lint family 5→6; 0 moved-but-unpinned counts |
| Offline containment | 0 live network calls and 0 child processes attributable to the new suites; the two delivered guards stay green |

### 4.2 Non-Goals

- **NG-1**: Completing, changing, or re-declaring the GitLab or Jira adapters' behavior; `merge` refuses where the landing is a declared gap, and that is the intended posture.
- **NG-2**: A merge queue, an enqueue implementation, queue-based serialization, or any automatic branch-update action inside `merge`.
- **NG-3**: Force, branch-protection bypass, auto-merge, rebase-merge, or merge-commit strategies; the landing union gains no variant.
- **NG-4**: Milestone creation, attachment, detachment, rename, reopen, entry review, planned-scope verification, or a `milestone` command family.
- **NG-5**: A second phase write path, a `phase repair`, a `lint --fix`, a new state kind, or any change to `verify change`'s verdict.
- **NG-6**: New queue verbs, record kinds, state keys, flags, or a second removal/lease mechanism.
- **NG-7**: New error identities beyond the three additive rows and one residue kind, or any pattern widening, exit-class, or domain-kind change.
- **NG-8**: New CI workflow files, jobs, triggers, permissions, uploads, or artifact fields; a new network location, credential, or secret-read allowlist entry.
- **NG-9**: Memory, promotion, capsule-routing, or retro behavior changes beyond the closeout step insertion and the one added residue kind.
- **NG-10**: Publishing a report, command, or rendered surface for merge refusal classes, milestone sync, or phase divergence beyond the delivered command data.
- **NG-11**: Any fetch inside `merge`; closeout's merged-diff anchor stays a read of the recorded landing identity (see Appendix G for the declared consequence).

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Provider-side landing with crafted squash metadata and an exact-head guard | The ticket's first acceptance clause needs a landing the provider performs and asserts; today's composed path can publish nothing and synthesizes its own subject. |
| F-2 | One typed outcome per mergeability state, with no head mutation | The ticket's DIRTY/BEHIND clause and F8 both require removing the local rebase and replacing one opaque abort with actionable identities. |
| F-3 | Required-check awareness including queued and running checks | A re-queued required check is already not-green in the gate evaluation and invisible after verification; the probe must not be narrower than the gate it post-checks. |
| F-4 | Exit-review-gated milestone synchronization in `closeout --apply` | The ticket's "synced milestone" is the one planning-unit effect closeout lacks, and it is the only place an operator-invoked transaction can close it safely. |
| F-5 | One phase truth source with a derived mirror and detected divergence | The ticket's "both phase sources agree after every transition" is unverifiable while the mirror is written from a history lookup and nothing compares the two. |
| F-6 | Queue integrity repair with property-level, defect-named regressions | The ticket's queue clause is repair and proof of the delivered surface, not a new surface. |
| F-7 | Named-defect regression evidence (F1, F4, F8) with failing controls | The ticket requires a regression test per named defect; a suite that cannot fail on the pre-fix behaviour is not evidence. |

### 5.1 Capability Details

**F-1 — Provider-side landing.** `merge` composes exactly one landing mechanism: the closed `merge-delivery-request` operation through the transaction's ports. The landing call carries the request identity, the squash strategy, the verified head as the expected head, the crafted title, and the crafted message; it is issued at most once per invocation, is never re-issued after a failure, and carries no force, bypass, auto-merge, queue, or retry variant — those are absent from the type rather than rejected at runtime.

The crafted metadata is deterministic and operator-free. The title is the delivery request's provider-asserted title, verbatim, which requires one additive optional field on the normalized request; absence means unknown and never a derivation, so when the provider omits it the title falls back to the deterministic subject the local path used to synthesize — `merge(<ref>): <sourceRef>` — and a provider that omits a title never loses a landing. The message is a fixed bounded trailer composed in core from facts the transaction already holds (the change ref and the delivery-request identity). No flag, no free-form input, no request body, and no provider prose participates.

The landing verdict is provider truth only. `result=merged` requires a read-back in which the provider asserts the request merged; the provider's merge-commit identity is the recorded landing identity, and its absence is unknown — `merge.landing-unverified` — never a derived value. Local containment stops being landing evidence, because the command no longer advances the local base at all. A re-run over an already-merged request replays `merged` with the recorded identity and performs no second landing call. The recorded merge transaction keeps its shape and stays closeout's merged-evidence anchor; only the provenance of its landing identity changes from a local commit to the provider's merge commit.

The exact-head guard binds the landing to the evidence: the expected head is the head the freshness envelope verified, and a head that moved between verification and the landing refuses `merge.gates-stale` with zero landing calls. A head-rejection at the provider is a classified refusal, never retried and never overridden. Where the adapter declares the landing a gap, `merge` refuses with that declared gap; a silent local fallback is prohibited because it would make the capability declaration unreadable. The local squash landing and the local refresh remain declared, tested git-seam capabilities with **no composed caller**, proven by a production-source scan with a mandatory failing control, and they retire only through the recorded revisit trigger.

**F-2 — Mergeability refusal taxonomy.** The decision rule is total over the four normalized mergeability states plus absence:

| Observed condition | Outcome |
|---|---|
| `mergeable` | Proceed to the guarded landing. |
| `conflicting` (dirty) | `merge.sync-required` with reason `dirty`; no rebase, no force, no landing call. |
| `not-mergeable` | Attempt the guarded landing — the provider is the authority on whether its protection rule blocks a behind, unstable, or blocked request — then classify a single refusal with one bounded post-refusal re-read of the same request: a re-read that resolves to the out-of-date condition yields `merge.sync-required` with reason `behind`; a checks posture yields the effective gate set's row (`merge.gate.ci-green.failed` with the delivered `ci-pending`/`ci-failed` reason); otherwise the declared gate-posture refusal `merge.transaction-aborted` naming the observed provider state. |
| `unknown` or absent | Exactly one bounded re-read of the same request, compared on the exact head. Recovered → the row above. Head changed → `merge.gates-stale`. Still unknown → `merge.mergeability-unknown`. |
| Landing fired, provider truth not observed | `merge.landing-unverified` (exit 2, consequence `unknown`); a re-run re-verifies and never re-lands. |

Two additive `merge` rows carry the new causes: `merge.sync-required` (user, non-retryable, `not_landed`, exit 1; remediation — update the delivery branch onto the base by the normal path, then re-verify and retry) and `merge.mergeability-unknown` (platform, retryable, `not_landed`, exit 2; remediation — retry after the provider finishes computing; the command never waits). Both are documented and machine-declared together, and the `merge.gate.<gate-id>.failed` family is unchanged.

Two boundaries are stated rather than papered over. First, the delivered four-value normalization collapses `behind` into `not-mergeable`, so a behind request is reported as sync-required only when the post-refusal re-read is decisive; when it is not, the refusal is the declared gate-posture identity naming the observed provider state and carrying the sync remediation, and prose matching is never introduced to recover the distinction (Appendix G). Second, `merge.rebase-conflict` is **retained and reserved**: no delivered path emits it after this change, it keeps its code, category, projection, and remediation unchanged, it is never removed from the declared emittable set, and the revisit trigger names the coordinator-side sync action that would re-reach it.

There is no internal refresh on the landing path. Each attempt performs one bounded probe, at most one landing call, and at most one recovery read, and never mutates the head; a local-only rebase cannot change what the provider accepts and a force-push is not representable, so BEHIND resolves as an instruction to the coordinator rather than as an internal loop.

**F-3 — Required-check awareness.** Both sides of the check boundary are pinned to one contract. The declared gate evaluation already treats `queued` and `running` as not-green; that becomes an asserted contract rather than an implicit agreement between two implementations. The post-verification probe is extended from "newly failing" to "newly not-green for a declared required job": queued, running, canceled, skipped, and failed on the verified head are all gate evidence, classified through the delivered reasons (`ci-pending`, `ci-canceled`, `ci-all-skipped`, `ci-failed`) on the existing `merge.gate.<gate-id>.failed` family. A job the gate set does not declare stays non-evidence, and a page for another head is not head evidence. Provider-required checks remain the provider's authority: its refusal is classified, never retried and never bypassed, and the tool adds no second required-check evaluator and no prose matching.

**F-4 — Milestone synchronization.** `milestone-sync` is step 12 of a thirteen-step plan; `capsule` stays terminal at 13, and consumers keep resolving steps by `stepId`. The declared milestone is the change's pm-notes `milestone`, recorded at intake; the observed attachment is the provider-asserted milestone on the change's own work item. An absent declaration, a non-`M<n>:`-shaped declaration, or a declaration/observation mismatch never becomes a target: the step is `skipped-noop` with one residue item naming the fact and performs no write; a declaration of `none` is `skipped-gap`, meaning the project has no milestone construct.

The exit review is the gate. One bounded adapter-local milestone read returns the record (identity, title, state) and its attached work items with their delivery states, capped at 200 attached items. Closure holds only when the record is open and **every** attached item is done or canceled. An unavailable signal, an unknown state, or a truncated attached set withholds closure — a partial view never closes a scope commitment — and a detachment the tool cannot observe leaves the milestone withheld until the owner detaches and re-runs. The read is an adapter-local bounded read on the delivered precedent, adds no closed operation and no capability flag, and is performed at most once per run.

The effect is one new closed operation, `close-milestone`, whose canonical arguments name only the milestone identity and whose one effect is to set the record closed. The vocabulary cannot express create, attach, detach, rename, or reopen; that is structural, not a documented prohibition. The write is read-back verified (the provider must assert the closed state), issued at most once per run, never retried, and reports `alreadyApplied` when the record already reads closed. GitHub supports it; GitLab declares `adapter-not-implemented`; Jira declares `provider-unsupported`; an adapter gap is a `skipped-gap` step outcome, never a silent skip.

The outcome table is closed: declared and attached with a passing exit review and an open record → `would-apply` in plan and `applied` in apply; record already closed → `satisfied` in both; absent or malformed declaration → `skipped-noop` with `declared-milestone-missing`; `none` → `skipped-gap`; attachment mismatch → `skipped-noop` with `attachment-mismatch`; exit review not holding → `skipped-noop` with `closure-withheld`; truncated set → `skipped-noop` with `attached-set-truncated`; unavailable or invalid read → `skipped-noop` with `milestone-signal-unavailable`; adapter gap → `skipped-gap`; a close write that did not land or whose read-back did not observe closed → `failed` in apply, returning the delivered gating identity `closeout.write.failed` at exit 2 with no capsule close. The one additive residue kind, `milestone-sync-withheld`, carries the closed reason as bounded item text and the work-item ref as its location.

Idempotency and dry-run follow the transaction: plan mode performs the read and renders the verdict with zero writes, zero appends, and zero fence acquisitions; apply mode folds the ledger and reuses any terminal outcome, so two consecutive applies perform at most one close and report `satisfied` on the second.

**F-5 — One phase truth source.** The verified delivery-registry ledger stays the only authority; the pm-notes document and the derived phase-state projection are both derived surfaces, and neither is ever read for idempotency, convergence, or a verification verdict. Every branch that writes the document derives the target entry's `completed` from the post-transition fold (the ledger history including the just-appended record, or the verified history on a convergence-only branch) instead of an identity lookup over history. `started` is never rewritten for an existing entry, and reopen keeps its delivered behaviour (the fold clears `completed`; the document writes null). The no-op evidence reports the same fold value, so the stale-timestamp defect does not survive in the envelope after the document is fixed.

Divergence is detected, reported, and never repaired. The both-target lint gains one comparison, run after both conformance checks pass (so a malformed document is still reported as malformed): for each canonical phase id that has at least one ledger transition, the document's `completed` must equal the fold's `completed`, and null and a timestamp are different facts. The first divergence is `lint.phases.divergent` — user, non-retryable, `not_landed`, exit 1 — naming the phase id, both values bounded, and the remediation "re-derive the document from `phase list`, or record the missing transition through `phase complete`". The rule performs no write, acquires no fence, appends nothing, performs no tracker read, reads no clock, and is deterministic across replays. To implement it, the lint surface's registry read exposes the verified fold additively; no other read changes.

Two boundaries are declared. A document completion with no ledger transition is out of scope for this row — it is a declaration question already handled by `verify change`'s registry-over-declaration precedence, and flagging it would fail the legacy corpus for documents authored before the command wrote them. And `verify change` is unchanged: a mirror mismatch is a bookkeeping defect, and making it a finalization verdict would couple delivery to document hygiene.

**F-6 — Queue integrity.** The delivered queue surface is the scope: claim and release with repo-exclusive leases, parks over the closed cause vocabulary with expiry rules, reconciliation against tracker truth under its bound, the add/prioritize/dependency CRUD path, reason-bearing append-only removal, per-ref single-flight admission, and presence by ledger append position. Seven properties are each proven by a named suite with a mutation control:

1. **Claim integrity** — a second same-ref claim by another holder refuses `queue.single-flight` naming the live holder; a claim by the same holder under the same ref renews; a stale lease is taken over with incident evidence; a claim naming another ref held elsewhere refuses `queue.lease-conflict`.
2. **Park integrity** — only the closed cause vocabulary is accepted, the battery-only cause is refused on the operator path by name, an expiry-carrying window cause requires its explicit expiry, a non-expiring cause refuses an expiry, and a removal releases the active park first.
3. **Reconcile integrity** — only done and canceled are stale, an unobserved item is retained, the examined set is bounded and a truncated run reports it, and `--ref` narrows to exactly one entry.
4. **CRUD integrity** — one edge per accepted add, an edit-one-edge `dep remove`, an add-only cycle check with the existing path named, no cascade on removal, and the unchanged `added`/`updated`/`noop` and `removed`/`noop` vocabularies.
5. **Reason-bearing removal** — the four closed reasons, the refusal set (missing reason, out-of-vocabulary value, non-canonical ref, unobserved ref, live lease naming its holder), zero appends on any refusal, and the deliberate non-idempotency of the explicit verb preserved alongside the converging automatic path.
6. **Single-flight** — the refusal names the holder at the envelope root within its declared bound, and the holder identity is the live one.
7. **Append-position presence** — presence is decided by record sequence, never by timestamp text; a later re-declaration restores an entry with no special case; a tie is impossible.

A repair is performed only where its control demonstrates a breach, and a repair restores the declared property — it never widens a vocabulary, adds a key, or changes a delivered refusal into a success. The change reports which of the seven proved clean. Nothing in the closeout interaction moves: the automatic `landed` removal stays a non-step, fail-open, merge-truth-gated, idempotent hook inside the transaction's existing fence, and the new milestone step neither changes its outcome nor suppresses it.

**F-7 — Named-defect regressions.** F1 is repaired where the classification-totality declaration had a hole rather than where a probe was missing: the composition's declared emittable set must cover every code its refusal branches can emit, including the `merge.gate.<gate-id>.failed` family it emits from the refusal path, and every emitted pair must resolve to a row whose declared kind equals the emitted kind so the containment step is unreachable for a declared refusal. The landing path's catch-all is the classifier's containment of an undeclared or kind-mismatched pair; that branch must remain reachable only for a genuinely undeclared failure, and the regression asserts the declared identity — code, domain kind, and exit — for a gate-family landing refusal, for `merge.sync-required`, and for `merge.mergeability-unknown`, with `fallback.internal` absent, plus a live mismatch control that still contains, so the assertion cannot pass vacuously.

F4's regression asserts the whole sequence complete → reopen → re-complete: after the second completion the fold, `phase list`, and the document all report the **second** completion timestamp, the pre-fix value appears nowhere, and the no-op re-run reports the same value; companion cases assert that a hand-edited completion produces `lint.phases.divergent` with the phase named, that a document-only completion is not flagged, and that detection performs zero writes and zero fence acquisitions.

F8's regression asserts that a serial sequence of three merges performs at most one landing call per invocation, mutates no head, and never attempts an internal rebase: the second and third merges in the fixture resolve as typed refusals that instruct the coordinator to sync, rather than rebasing, re-verifying, and retrying.

## 6. USER & SYSTEM FLOWS

```
Flow 1: A ready item lands
  verify gates records the evidence for head H
    → merge reads the newest record, enforces the envelope at H, probes once
    → the request reads mergeable, the head is still H
    → one landing call: squash, expectedHeadSha H, crafted title, fixed trailer
    → the provider asserts merged; the merge commit is recorded
    → one merge.transaction record; post-landing steps unchanged
```

```
Flow 2: A request is not landable
  the request reads conflicting → merge.sync-required (dirty), zero landing calls
  the request reads not-mergeable → landing offered to the provider
    → refusal → one bounded re-read
      → out-of-date → merge.sync-required (behind)
      → checks posture → the effective gate set's row
      → otherwise → merge.transaction-aborted naming the observed provider state
  the request reads unknown → one exact-head re-read
    → recovered → classify; head changed → merge.gates-stale; still unknown → merge.mergeability-unknown
```

```
Flow 3: Closeout at the change boundary
  closeout <ref>            → plan: 13 steps, milestone-sync renders would-apply/satisfied/would-refuse/skipped-*
  closeout <ref> --apply    → ticket closed, worktree removed, branch deleted, milestone reviewed and closed only on a passing exit review
    → a withheld closure is skipped-noop plus one residue item; the run exits 1 through attention when other residue remains
    → a close write that did not land returns closeout.write.failed at exit 2 and appends no capsule close
    → the queue entry is retired with reason landed after the writes, unchanged
```

```
Flow 4: A phase transition and a divergence
  phase complete <ref> <phase>  → ledger append → projection replace → document re-staged from the post-transition fold
  phase reopen <ref> <phase>    → fold clears completed → document writes null
  phase complete <ref> <phase>  → the second completion is the fold's latest value; the document and the no-op evidence carry it
  lint <ref> --pm-notes --registry → both conformance checks pass → per-phase completion comparison → lint.phases.divergent
```

```
Flow 5: Queue integrity proof
  each of the seven properties is exercised through the production composition
    → the named suite asserts the declared outcome
    → a mutation control injects the breach and must fail naming the property
    → a property that fails its control is repaired to the declared sentence and re-proven
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The lifecycle `merge` landing path: one composed mechanism, crafted deterministic metadata, the exact-head guard, provider-asserted landing truth, and the recorded landing identity's new provenance.
- The merge refusal taxonomy: the four-state decision rule, the two additive rows, the one bounded post-refusal re-read, the one exact-head recovery read, the retained reserved `merge.rebase-conflict`, and the removal of the internal rebase from the command path.
- Required-check awareness in the declared gate evaluation (pinned as a contract) and in the post-verification probe (extended to not-green declared jobs).
- The classification-totality repair: the declared emittable set covers every emitted code including the gate family, and every emitted pair carries its row's declared kind.
- `closeout --apply` milestone synchronization: the step at position 12, the attachment verification, the exit-review predicate over one bounded read, the `close-milestone` operation and its capability declarations, the withheld outcome and its residue kind, and the dry-run/idempotency posture.
- The phase mirror rule, the divergence finding on the both-target lint, the additive fold exposure on the lint registry read, and the F4 regression.
- The queue integrity property proofs and any repair a failing control demonstrates, with no surface widening.
- The three named-defect regressions with failing controls, and the additive-surface synchronization this change owes (Appendix D, Appendix E).
- Decision records ADR-0012, TDR-0040, and ODR-0005, authored on the change branch, cited here as DEC-1, DEC-2, and DEC-3, and accepted by the owner at review.

### 7.2 Out of Scope

- [OUT] Completing or changing any adapter's behavior, capability posture, or gap declaration beyond adding the milestone operation.
- [OUT] A merge queue, an enqueue implementation, a coordinator branch-update action, or any automatic sync inside `merge`.
- [OUT] Force, bypass, auto-merge, rebase, or merge-commit landing strategies, and any landing retry.
- [OUT] Milestone create, attach, detach, rename, reopen, entry review, planned-scope verification, scope extension, and any `milestone` command family.
- [OUT] Multi-repository member milestones; the step targets the change-level work item only.
- [OUT] A phase repair command, a lint fix mode, a new phase state kind, or any change to `verify change`'s verdict or precedence.
- [OUT] New queue verbs, record kinds, state keys, flags, or a second lease/removal mechanism.
- [OUT] New CI workflow files, jobs, triggers, permissions, uploads, or artifact fields.
- [OUT] New network locations, credentials, transports, or secret-read allowlist entries.
- [OUT] Memory promotion, capsule routing, retro behavior, and harness telemetry changes beyond the one residue kind and the step insertion.
- [OUT] Reconciling pm-notes `milestone` with the change spec's `change.milestone` (a separate declaration question), and any second derived mirror.
- [OUT] Any fetch inside `merge`, and any provider-side diff read to repair closeout's anchor.

### 7.3 Deferred / Maybe-Later

- The coordinator-owned "update branch from base, then push without force, then re-verify" action that would re-reach `merge.rebase-conflict` and remove the manual sync step, as its own decision.
- Deleting or re-purposing the retained local landing/refresh git-seam capabilities if no consumer appears by the end of M5.
- Replacing the post-refusal re-read classification with a provider-asserted per-request required-check posture when a provider exposes one.
- A provider-side bounded merged-diff read (or a declared fetch) to restore closeout's anchor after a provider landing.
- Decomposing a `blocked` request into "checks pending" versus "review missing" when a provider exposes the distinction.
- Reconciling the change declaration's milestone with pm-notes by a dedicated finding, and any rendered view replacing the pm-notes mirror.
- Milestone sync per member repository on a multi-repository change.
- A recorded-detachment representation the exit review can consume, so a deliberately detached ticket no longer blocks closure.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

No inbound endpoint is added, changed, or removed. The outbound provider surfaces are the ones the delivered adapters already use, plus the two milestone calls below. This change's interfaces are in-process contracts and the declared provider operations:

| ID | Surface | Contract |
|----|---------|----------|
| API-1 | Guarded landing call | One call per invocation carrying the delivery-request identity, `strategy: "squash"`, the exact expected head SHA the freshness envelope verified, the crafted title, and the composed bounded message; it returns either a provider-asserted merged outcome with an optional merge-commit identity or a classified refusal. It is issued at most once, never after a failure, never with a force/bypass/auto-merge/queue variant, and never re-issued on a re-run. A refusal is returned as a refusal: it is never converted into a local commit, a fallback landing, or a success by inference. |
| API-2 | Merge refusal classification | One total decision function over the observed condition set (`mergeable`, `conflicting`, `not-mergeable`, `unknown`/absent, and "landing fired, truth not observed") producing exactly one declared identity per observation, with at most one post-refusal re-read and at most one unknown-recovery re-read, both bounded and head-compared. Every produced identity is a declared row, and its domain kind and exit are the row's declared kind and projection. Refusals carry bounded structured evidence and the row's remediation; they never carry provider prose. |
| API-3 | `close-milestone` closed operation | Canonical arguments name only the milestone identity; the single effect is to set the record closed. The argument and effect vocabulary cannot express create, attach, detach, rename, or reopen. Read-back verified (the provider must assert the closed state), at most once per run, never retried, and `alreadyApplied` when the record already reads closed. Every adapter declares support or a valid closed gap reason. |
| API-4 | Bounded milestone read | One adapter-local read returning a provider-neutral record (identity, title, state) and its attached work items with delivery states, under a declared cap of 200 attached items and a truncation marker. It adds no closed operation and no capability flag, distinguishes absent-surface from unavailable-signal from truncated, and is performed at most once per run. An unavailable signal is never an empty set and never a failure. |
| API-5 | Phase divergence finding | One comparison on the both-target lint, run only after both conformance checks pass: for every canonical phase id with at least one ledger transition, the document's `completed` must equal the fold's `completed`. The first divergence is `lint.phases.divergent` carrying the phase id, both values within the declared bound, and the declared remediation. The comparison is read-only: zero document writes, zero fence acquisitions, zero appends, no tracker read, no clock read. |
| API-6 | Phase mirror write | Every branch that writes the pm-notes document derives the target entry's `completed` from the post-transition fold and never from a lookup over history; `started` is written only on creation and never rewritten; a reopen writes null; the no-op evidence reports the same fold value. No branch may hold a different derivation. |
| API-7 | Queue integrity properties | The seven declared properties of §5.1 F-6, each expressed as an observable outcome of the delivered verbs over the delivered ledger, with no new verb, record kind, state key, flag, or vocabulary value, and with the automatic closeout removal keeping its non-step, fail-open, merge-truth-gated, idempotent contract. |

### 8.2 Events / Messages

No event, message, telemetry record, or state-schema record is added. The new surfaces are: two additive `merge` error rows, one additive `lint` error row, one additive residue kind, one additive closeout step id, one additive optional normalized field, and one additive optional read field on the lint registry read. None of them is an event or a new record kind: the closeout operation ledger keeps its single `closeout.operation` kind and its operation-identity derivation (the new step's operations are ordinary members of it), the merge transaction record keeps its schema, the phase ledger keeps `phase.transition`, and the capsule keeps its event vocabulary — a withheld milestone closure is a residue item and a step outcome, not a capsule event. The queue graph keeps every delivered record kind; the integrity work adds none.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Normalized delivery-request title | One additive optional field on the normalized delivery request: the provider-asserted title, verbatim, with absent meaning unknown and never derived. It participates only in the crafted landing subject; when absent, the landing uses the declared deterministic fallback subject. No delivered field is removed, retyped, or made required; no schema version changes. |
| DM-2 | Merge refusal identities | The `merge` domain kind carries two additive concrete rows — `merge.sync-required` (user, non-retryable, `not_landed`, user-validation → exit 1) and `merge.mergeability-unknown` (platform, retryable, `not_landed`, platform-provider → exit 2) — taking the concrete rows from seven to nine, while the one open-slot `merge.gate.<gate-id>.failed` family is unchanged in identity and slot rule. `merge.rebase-conflict` is retained verbatim, becomes unreachable from the command, and is never removed from the emittable declaration. The composition's declared emittable set is exhaustive over its refusal branches and includes the family it emits. |
| DM-3 | Recorded landing identity | The merge transaction record keeps its shape; its landing identity becomes the provider-asserted merge commit, and its absence is unknown (`merge.landing-unverified`) rather than a derived local value. Local containment stops being landing evidence, and the record remains closeout's merged-evidence anchor. |
| DM-4 | Closeout step inventory | `CLOSEOUT_STEP_IDS` grows from twelve to thirteen: `milestone-sync` at position 12 and the terminal `capsule` at 13. Consumers resolve by `stepId`, so the insertion is additive; the documented inventory changes from twelve to thirteen steps in the same change, and the `closeout.step.<id>.failed` family's slot rule validates against the effective set unchanged. The plan and apply outcome vocabularies are reused, not extended. |
| DM-5 | Judgment residue kind | The closed residue set grows from eight to nine with `milestone-sync-withheld`, carrying a closed reason as its bounded item text and the work-item ref as its location. No kind is renamed or removed; the dedup key, ordering, and 50-item cap with its sentinel are unchanged. |
| DM-6 | Adapter operation set and capability declarations | `ADAPTER_OPERATIONS` grows from nine to ten with `close-milestone` appended (the set appends and is never reordered). GitHub declares support; GitLab declares `adapter-not-implemented`; Jira declares `provider-unsupported`. The milestone read adds no operation and no capability flag. |
| DM-7 | Conformance and parity surfaces | The flow registry represents the tenth operation exactly as the coverage gate requires (an executing step, or a declared gap reached by a step), all ten operations are represented, every adapter's supported set and declared gaps are each backed by a step and together cover the closed set, and the parity matrix moves from 27 cells (nine operations × three adapters) to 30 with each new cell adjudicated — GitHub `same-as-reference`, the other two `gap` with their declared reasons. Mock tenant routes and their expected projections cover the supported execution. The six-family, eighteen-cell family accounting is unchanged because `close-milestone` is not a trap family. |
| DM-8 | Phase truth surfaces | The pm-notes lint family grows from five to six rows with `lint.phases.divergent` in the declared rule order, documented and machine-declared together, so the `lint` domain kind's concrete rows move from six to seven and the two-table identity total moves from 149 to 152 (the two merge rows and this one). The lint surface's registry read gains the verified fold additively; no other read changes and the rule order is not reordered. |
| DM-9 | Milestone observation | The bounded milestone read's provider-neutral shape: record identity, title, state (`open`/`closed`/unknown), the attached items with their delivery states, and a truncation marker with the declared cap. Absent surface, unavailable signal, unknown state, and truncation are four distinct facts and never collapse into an empty set. |

### 8.4 External Integrations

The only new outbound surfaces are the provider's milestone close write and its bounded milestone/attached-set read, both over the existing injected transport and credential port; no new transport, credential, network location, or secret-read allowlist entry is introduced. Provider shapes are proven by committed synthetic fixtures under the delivered sanitization discipline with example-only hosts; no live call is made by any suite this change adds. GitHub's landing surface is the one the delivered adapter already uses, and its refusal behaviour under an out-of-date head is a fixture-proven assumption (Appendix G). GitLab and Jira take declared positions on both new surfaces rather than implicitly skipping.

### 8.5 Backward Compatibility

- Additive within contract v1: no delivered field is removed, retyped, or made required; the new normalized field, the new read field, the new residue kind, the new step id, and the three error rows are additive, and the step-id and residue-kind consumers already resolve by id.
- The merge command's success payload keeps its shape and its `result`/`squash=` continuity; the identity carried in `squash=` is now the provider's merge commit. A re-run over a recorded landing replays rather than re-landing, as delivered.
- The refusal vocabulary grows by two identities and keeps every delivered one. Callers that branch on the delivered identities keep working; a caller that branched on the generic abort for an out-of-date or undecided request now receives the specific identity, which is the intended behavioural change and is called out for the coordinator and `@pm` prompts.
- The closeout payload keeps `delivery.closeout.v1`, its step-id resolution, and its additive optional fields; the inserted step is new data, not a reshaped payload, and a consumer that counted twelve steps positionally was already outside the contract.
- The lint row order is append-only in the declared order: the five delivered pm-notes rows keep their codes and remediation, and the plan-target row is untouched.
- `verify change` keeps its verdict, its precedence, and its read-only contract; it gains no row and changes no classification.
- The queue surface is behaviour-identical for every delivered input; the integrity work changes behaviour only where a control demonstrates a breach, and that change is a repair to the declared sentence.
- The pinned surfaces move exactly and in the same change: the two error tables and their bidirectional sync, the pinned identity total, the documented step inventory and residue vocabulary, the conformance registry and coverage gates, the parity matrix and its register, the mock tenant routes and expected projections, the per-file executable-export inventory, and the help/reference coverage inventory. No pin is loosened or made vacuous.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Determinism | Two replays of the same declared input produce byte-identical merge refusal summaries, closeout plans and operation identities, lint verdicts, and phase state folds; 0 wall-clock, randomness, provider return order, or map iteration order in any plan or verdict |
| NFR-2 | Offline containment | 0 live network calls and 0 child processes across every suite this change adds, enforced by the delivered guards; provider shapes are committed fixtures; the pre-existing git seam's child processes stay confined to the local-repository tests that already declare them |
| NFR-3 | No new network, credential, or secret-read location | 0 new transport, credential path, network location, or secret-read allowlist entry; the landing and both milestone surfaces ride the existing injected transport and credential port |
| NFR-4 | Bounded cost | Per merge invocation: ≤1 landing call, ≤1 post-refusal re-read, ≤1 unknown-recovery re-read, 1 verification read, 1 work-item read, 1 check-run page, 1 request-detail read, and 0 head mutations. Per closeout run: ≤1 milestone read and ≤1 close write, 0 polls, 0 pagination loops, 0 retries. Per lint run: 1 fold read and 0 tracker reads |
| NFR-5 | Truthful absence | No derived, fabricated, or defaulted value stands in for an absent provider signal: an absent title, mergeability, merge commit, milestone attachment, milestone state, or attached set is unknown, and unknown never becomes mergeable, closed, empty, or success |
| NFR-6 | Additive sync integrity | 0 removed or retyped delivered fields; 0 unreachable declared rows; machine and documented error tables agree bidirectionally at 152 identities; every new row is reachable from a named branch; no pattern widening; the operation set, step set, residue set, and lint family each change by exactly the declared delta |
| NFR-7 | Capability honesty and parity completeness | Every adapter declares support or a valid closed gap reason for the tenth operation; the parity matrix covers every closed operation × registered adapter pair with 0 missing, duplicate, extra, or unadjudicated cells; every declared gap is reached by a step with its exact reason |
| NFR-8 | Read-only detection | The divergence rule performs 0 document writes, 0 fence acquisitions, 0 record appends, 0 tracker calls, and 0 clock reads, and returns the same verdict across replays |
| NFR-9 | Unrepresentable forbidden acts | No argument shape or effect in the closeout operation vocabulary expresses milestone create, attach, detach, rename, or reopen, and no landing or mutation union member expresses force, bypass, auto-merge, queue, or retry; proven by a structure test plus review, not by a documented prohibition |
| NFR-10 | Testkit runtime neutrality | The conformance and testkit packages keep 0 `node:*`/`bun:*` imports and 0 ambient environment, clock, or randomness reads; fixture loading, environment reads, native fetch, child-process substitution, and artifact writing stay under the test tree |
| NFR-11 | Corpus stability | The both-target lint reports 0 new findings across the acceptance corpus; any hit is triaged as evidence of a second writer and recorded, never suppressed or excluded silently |
| NFR-12 | Gate and delivery conventions | Every recorded gate command uses the `TMPDIR=$PWD/tmp/tmpdir` convention; no lease or retrieval command is composed outside the change's own gates; commits go through the commit primitive only; the change's pull request targets the tooling integration branch and stops with the PR open (merge authority stays outside this change) |
| NFR-13 | Bounded output | Every new diagnostic and outcome stays within the delivered bounds: refusal summaries within the human line/byte bounds with explicit `+N` marks, residue items within the 50-item cap plus the sentinel, refusal detail within its declared character bound, and no credential, payload, title, body, or provider prose in any output or record |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- No new telemetry event, metric, state record kind, or artifact field is introduced. The landing identity, the refusal identity, the milestone verdict, the divergence finding, and the queue property results are command data and test outcomes; they are not serialized into any artifact.
- The merge refusal is observable as one declared code plus structured bounded evidence (age and bound, recorded and current head, gate-set delta, gate id and class, conflicting paths, observed provider state, job names) with its row's remediation; the text summary keeps `result=refused` (or the delivered unverified line) and puts the decisive condition and the named gate first.
- The closeout milestone verdict is observable in plan and apply data as one step with its outcome, its bounded detail, and at most one residue item naming the closed reason; the human digest renders the same step and residue through the delivered rendering path, and gains no new section.
- Phase divergence is observable as the first lint finding with the phase id and both values; the delivered lint evidence for a passing both-target run keeps its shape and gains the fold exposure it needs.
- Queue integrity is observable as the named failing control per property, and as the delivered reason-bearing refusal identities; no new collector id, daemon surface, or watch topic is added.
- Operator-visible behaviour is otherwise unchanged: no command gains a new verb, flag, or stream, and no existing line is reworded beyond the refusal identities the change declares.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | GH-349's own closeout withholds milestone closure, and a reader takes the AC as "GH-349 closes M4" | M | H | The spec states the reading explicitly (AC-F4-7): M4 has other attached tickets open, so the verified outcome for this change is attachment plus a recorded exit-review verdict, never a closed milestone record; the step's withheld outcome is a success-shaped `skipped-noop` plus one residue item | L |
| RSK-2 | PDR-0005's "never a milestone write" is read as a global prohibition rather than a boundary on the attachment check, making the closure half wrong | H | M | ODR-0005 states its reading openly and names the withdrawal path: if the owner reads it globally, the write half is withdrawn and the step degrades to verification plus a withheld-closure residue without touching the rest; the owner decides at review | M |
| RSK-3 | After a provider landing the squash object is not in the operator's checkout, so closeout's merged-diff sweep degrades to `skipped-gap` with `merged-diff-unavailable` until a fetch | M | H | Declared as a consequence, not a defect (Appendix G): the sweep stays detection-only, the recorded landing identity remains its anchor, and the two honest repairs (a bounded provider diff read or a declared fetch) are deferred to their own decision. `merge` never fetches | M |
| RSK-4 | `merge` refuses on GitLab and any tracker-only project, so the F4 evidence window is GitHub-only | M | H | Capability honesty is the intended posture: the refusal names the declared gap and a silent local fallback is prohibited and scanned; the adoption bound is stated in the rollout section | M |
| RSK-5 | `merge.rebase-conflict` becomes unreachable from the command yet stays declared, creating visible drift | L | H | Retained and reserved by decision: no removal, no re-meaning, no removal from the declared emittable set, and a revisit trigger names the coordinator-side action that would re-reach it | L |
| RSK-6 | The additive surface moves five pinned sets and their counts, and a half-moved surface either fails a gate or is weakened to pass | H | M | Appendix D and Appendix E enumerate every surface with before→after counts, and NFR-6 forbids loosening a pin; the sync checks fail closed, so a partial move is a red build, not a silent acceptance | L |
| RSK-7 | The four-value normalization collapses `behind` into `not-mergeable`, so a behind request cannot always be reported as `sync-required` | M | M | Declared boundary: sync-required when the post-refusal re-read is decisive, otherwise the declared gate-posture refusal naming the observed provider state with the sync remediation; prose matching is prohibited as a substitute; the ADR revisit trigger names the provider signal that would remove the limit | M |
| RSK-8 | A silent local fallback is reintroduced to keep `merge` working where the landing is a gap | H | M | The landing composes exactly one mechanism, the gap is a classified refusal, and the retirement scan asserts no composed caller of the local landing/refresh with a mandatory failing control | L |
| RSK-9 | The conformance or parity surface is moved for the new operation without its mask, route, or projection, so the gate either fails or passes vacuously | M | M | The structural and runtime coverage gates require representation, execution, and exact gap reasons; the parity register must adjudicate every new cell; a mutation control removes one supplied item and must fail | L |
| RSK-10 | `lint.phases.divergent` flags legacy corpus documents and pressure arises to repair or suppress instead of investigate | M | M | The comparison is scoped to ledger-backed phases and completion only, the document-only case is a stated exclusion, and NFR-11 requires a recorded investigation of any hit rather than suppression | L |
| RSK-11 | The milestone read is declared supported on a provider whose attached set cannot be read completely, so closure is attempted on a partial view | H | L | Truncation, unknown state, and unavailable signal each withhold closure; the cap and the truncation marker are contractual, and a provider that cannot prove completeness can never close through the tool | L |
| RSK-12 | The churn is "fixed" by re-adding an internal rebase or an automatic push | H | M | The landing path performs no head mutation and no force is representable; the F8 regression asserts zero head mutations across a serial fixture, and the sync action is explicitly a coordinator decision, not this command's | L |

## 12. ASSUMPTIONS

- GitHub is the reference provider for the landing path in this milestone, and its landing surface accepts the squash method, a crafted title and message, and an expected head (documented surface, already exercised by the delivered fixture).
- A provider refusal for an out-of-date head is distinguishable from a checks/reviews refusal by re-reading mergeability after the refusal; where it is not, the declared gate-posture fallback applies (RSK-7).
- The delivered adapter's landing read-back is the only success signal available, and a guard rejection surfaces as a non-2xx refusal rather than a silent success.
- The normalized request's absence semantics hold: an absent field is unknown, so an absent title falls back deterministically and an absent merge commit is reported unverified.
- GitHub exposes a milestone record with a state and a bounded attached-issue set that can be closed; the exact write surface, read-back shape, and the stability of the 200-item bound are proven by fixture during delivery.
- Jira has no milestone equivalent with these closure semantics, so its declared gap is honest rather than a convenience.
- The pm-notes `milestone` value recorded at intake is the correct declaration source for the change-level planning unit; concatenating it with the change spec's `change.milestone` is out of scope.
- A milestone whose attached set legitimately needs a detachment stays withheld until the owner detaches and re-runs; the tool reports the withholding and cannot resolve it.
- Every command-written completion carries the same timestamp in the ledger record and the document, so the comparison can use the value as identity.
- The legacy corpus (change folders from 2026-10 onward) is command-written with respect to completions; a finding under the scoped comparison is evidence of a second writer and is investigated.
- The delivered queue surface's properties are correctly declared; the seven proofs are expected to confirm them, and a failed control is a genuine breach to repair.
- The existing TypeScript test jobs have capacity for the added in-process suites, so no new job or workflow file is needed.
- The pinned surfaces (error-table sync, conformance coverage, parity gate, export inventory, help coverage) can be updated exactly in this change without weakening any check.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | M4-S1 installed, versioned binary | The loop this change removes manual steps from runs on the installed binary, not the source tree. |
| Depends on | Merge and verify-deploy transaction | The gate-verification record, freshness envelope, probe, waiver authorization, and transaction record this change re-points; their identity and bounds are unchanged. |
| Depends on | Adapter operation set and provider clients | The landing operation and its GitHub implementation are delivered; this change composes them into the lifecycle path and adds one operation for the milestone write. |
| Depends on | Closeout transaction | The step inventory, operation ledger, outcome vocabularies, residue machinery, and fence the new step rides. |
| Depends on | Delivery registry ledger and phase fold | The fold is the authority; the mirror derivation and the divergence comparison consume it. |
| Depends on | pm-notes lint surface and error-table sync | The both-target invocation, the rule order, and the bidirectional documented/machine binding the sixth row enters. |
| Depends on | Scheduling engine queue and its removal seam | The integrity properties and the automatic closeout removal that must keep its contract across the step insertion. |
| Depends on | Adapter conformance suite, parity matrix, register | The operation-set change moves the registry, coverage gates, matrix, mock routes, and projections in the same change. |
| Depends on | ADR-0012, TDR-0040, ODR-0005 | Proposed records authored on the change branch; accepted by the owner at review. The delivery plan lands them and their index rows. |
| Depends on | Milestone operating rule and PDR-0005 | The naming, attachment, exit-review, and closure rules the step implements, and the constraint whose scope the owner confirms. |
| Blocks | The F4 verification bar of the jaiship-only flip | "Merge lands with crafted metadata without a platform CLI; DIRTY/BEHIND returns a typed sync-required result; closeout is idempotent." |
| Blocks | Any later milestone-closure work | Closure now happens through the transaction; a `milestone` command family, per-member milestones, and detached-ticket handling build on this step. |
| Blocks | Multi-tracker deliverability of `merge` | A provider that implements the landing operation becomes able to run the lifecycle merge path without further changes. |

## 14. OPEN QUESTIONS

Three questions remain genuinely open; each is either an owner judgment this change may not make or a fact this change measures rather than decides.

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | Does the owner read PDR-0005's constraint on milestone writes as scoped to the attachment check, or as a global prohibition? | ODR-0005 states its scoping reading openly and names the withdrawal path: on a global reading, the write half is withdrawn and the step degrades to attachment verification plus a withheld-closure residue item, with the rest of the record untouched. The owner decides at the PR review; no agent may decide that a milestone closes. | Open — owner decision |
| OQ-2 | Does any document in the acceptance corpus already diverge under the scoped comparison? | Measured during delivery by the both-target lint over the corpus. A hit is evidence of a second writer and is investigated and recorded; it is never evidence that the rule is wrong, and the rule is never repaired into a writer. | Open — measurement |
| OQ-3 | What exactly is GitHub's milestone write surface and read-back shape, and is the attached-item read stably bounded at 200? | Settled by fixture during delivery. If the attached set cannot be read completely, closure is withheld on the truncation marker rather than attempted; a richer read is a separate decision. | Open — fixture |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Land through the closed provider-side landing operation as the single lifecycle merge path, with the exact verified head, the provider-asserted title (or the declared deterministic fallback), a fixed bounded message trailer, provider-asserted merged truth as the only landing verdict, and the local squash/refresh retained as declared capabilities with no composed caller. | The local mechanism cannot publish a landing at all and treats its own literal as provider truth; a second selectable mechanism would make every `merged` report ambiguous. Source: ADR-0012. | 2026-11-18 |
| DEC-2 | Remove the internal rebase from the command path and give each refusal cause one identity: dirty → one typed sync-required, not-mergeable → guarded landing plus one bounded post-refusal re-read, unknown → one exact-head re-read then a typed undecided identity, with `merge.rebase-conflict` retained and reserved. | A local-only rebase cannot change the provider's answer; it can only void the evidence it verified, which is the churn the ticket names. Source: ADR-0012 §5–§6. | 2026-11-18 |
| DEC-3 | Extend required-check awareness to not-green declared jobs in the probe and pin queued-is-not-green in the gate evaluation as a contract, adding no second evaluator and no prose matching. | A re-queued required check is already not-green before verification; a narrower probe is a blind spot exactly where CI flaps. Source: ADR-0012 §7. | 2026-11-18 |
| DEC-4 | Add milestone synchronization as step 12 of 13 over one new `close-milestone` operation and one bounded adapter-local read, gated by the exit review, withheld otherwise, gating on write failure, idempotent and dry-run visible. | The planning unit is the last manual closeout step; the narrow operation vocabulary makes the unsafe acts unrepresentable rather than prohibited. Source: ODR-0005. | 2026-11-18 |
| DEC-5 | Keep the delivery-registry ledger as the only phase truth, derive the mirror from the post-transition fold on every document-writing branch, and add one read-only divergence finding without repairing, without changing `verify change`, and with document-only completions as a stated exclusion. | One fact, one author; detection preserves the evidence a repair would destroy; bookkeeping must not gate delivery. Source: TDR-0040. | 2026-11-18 |
| DEC-6 | Queue integrity is repair plus property-level regressions on the delivered surface: no new verb, record kind, state key, or flag, and a repair only where a control demonstrates a breach. | The delivered surface is the ticket's "queue integrity"; widening it would be a new feature, not a repair. Source: PM position recorded as the R0 non-decision in the planning notes. | 2026-11-18 |
| DEC-7 | Repair F1 as a classification-totality defect: the composition's declared emittable set covers every code its branches emit — including the gate family — and every emitted pair carries its row's declared domain kind, so a declared refusal can never be contained. | The containment branch is the classifier's catch for an undeclared or kind-mismatched pair; a totality declaration that omits an emitted family cannot prove the property it claims. Source: the delivered result contract's binding rule, and the F1 regression requirement. | 2026-11-18 |
| DEC-8 | GH-349's own closeout is verified by attachment plus a recorded exit-review verdict, not by closing M4; the step's withheld outcome is a success-shaped `skipped-noop` plus one residue item. | M4 has other attached tickets open; reading the AC as "GH-349 closes M4" would be both wrong and unsafe. Source: ODR-0005 §5 negative outcomes; ticket AC read literally. | 2026-11-18 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Merge transaction and its composed landing path | Re-pointed onto the provider-side landing: guarded call, crafted metadata, provider-truth verdict, the internal rebase removed, the refusal taxonomy implemented |
| Merge command surface and its composition | Unchanged verbs and flags; the refusal vocabulary gains two identities; the emittable declaration becomes exhaustive over the emitted family; the composition expresses the gap as a refusal |
| Local git merge seam | Landing and refresh retained as declared capabilities with no composed caller; branch deletion unchanged; no new git operation, no force |
| Post-verification probe and declared gate evaluation | Probe extended to not-green declared jobs; queued-is-not-green pinned as a contract in both |
| Closeout transaction | One step inserted at 12, one residue kind, one operation composed, the exit-review predicate evaluated in core, the queue-removal hook unchanged |
| Closeout provider composition | One bounded milestone read and one close write composed over the existing transport; gaps declared for the two other adapters |
| Adapter operation set and capability declarations | Ten operations; GitHub support and two declared gaps for the new operation; no new flag or carrier |
| Adapter conformance suite and parity surface | Flow registry, coverage gates, parity matrix (27→30 cells), register, mock tenant routes, and expected projections move in this change |
| Phase command and the pm-notes mirror | Every document-writing branch derives completion from the fold; the no-op evidence reports the fold value; `started` stays immutable |
| Lint surface and error tables | Fold exposed additively on the registry read; one new finding in the declared order; two merge rows and one lint row documented and machine-declared together; identity total 149→152 |
| Scheduling queue | Seven properties proven with defect-named controls; behaviour unchanged except where a control shows a breach |
| Pinned inventories and reference pages | Error-table pins, export inventory, help/reference coverage, the documented step inventory, residue vocabulary, and operation-set counts updated exactly |
| Test suites | New defect-named suites (F1, F4, F8), refusal-taxonomy, landing-metadata, head-guard, milestone-sync, divergence, and queue-integrity suites, each with a failing control |
| Documentation | Reconciled in the documentation phase (Appendix A) |
| CI topology and workflow files | Unchanged (deliberate) |
| Memory, promotion, retro, harness telemetry | Unchanged (deliberate) |

## 17. ACCEPTANCE CRITERIA

### 17.1 Provider-side landing (F-1)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** a ready item with a fresh gate verification at head H, **when** `merge <ref>` runs, **then** exactly one landing call is composed through the closed provider-side landing operation carrying the squash strategy, H as the expected head, the crafted title, and the composed message; no platform merge subcommand is spawned on any landing path (production-source scan with a mandatory failing control), no local squash commit is created, no push occurs, and no second mechanism is reachable by flag, configuration, or fallback. | F-1, API-1, DM-3, NFR-9 |
| AC-F1-2 | **Given** a landing call that returned a provider-asserted merged read-back carrying a merge commit, **when** the outcome is rendered and recorded, **then** `result=merged` with that identity as the recorded landing identity, and the transaction record keeps its delivered shape. | F-1, API-1, DM-3 |
| AC-F1-3 | **Given** a fixture whose local containment of the landing identity is true and whose provider state is not merged, **when** `merge` runs, **then** the outcome is `merge.landing-unverified` at exit 2 with consequence `unknown`, never `merged`, and local containment is never accepted as landing evidence. | F-1, API-1, DM-3, NFR-5 |
| AC-F1-4 | **Given** a landing whose provider read-back asserts merged but supplies no merge commit, **when** the outcome is rendered, **then** the landing identity is reported unknown rather than derived from any local object, and a re-run re-verifies without re-landing. | F-1, API-1, DM-3, NFR-5 |
| AC-F1-5 | **Given** a head that moves between the freshness verification and the landing call, **when** `merge` runs, **then** it refuses `merge.gates-stale` at exit 1 with the recorded and current head, and performs exactly zero landing calls. | F-1, API-1, API-2, NFR-4 |
| AC-F1-6 | **Given** the crafted metadata contract, **when** a landing is composed, **then** the title is the delivery request's provider-asserted title verbatim, or — only when that signal is absent — the deterministic fallback `merge(<ref>): <sourceRef>`; the message is the fixed bounded trailer built from the change ref and the request identity; and no flag, free-form input, request body, or provider prose participates in either. | F-1, API-1, DM-1 |
| AC-F1-7 | **Given** an adapter that declares the landing a gap, **when** `merge` runs, **then** it refuses with a classified identity naming that declared gap and performs no landing, no local squash, and no fallback; the capability declaration is never contradicted by a silent success. | F-1, API-1, DM-6, NFR-7 |
| AC-F1-8 | **Given** the retained local landing and refresh capabilities, **when** the production source is scanned for composition sites, **then** zero composed callers exist, both capabilities remain declared and tested, the scan carries a mandatory failing control, and no path composes them for a landing or a sync. | F-1, DM-2, NFR-9 |
| AC-F1-9 | **Given** a re-run over a request already recorded as landed, **when** `merge` runs, **then** it replays `merged` with the recorded identity, performs zero landing calls, and appends no duplicate transaction record. | F-1, API-1, DM-3 |

### 17.2 Mergeability refusal taxonomy (F-2)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F2-1 | **Given** a request whose normalized mergeability is `conflicting`, **when** `merge` runs, **then** it refuses exactly one `merge.sync-required` with reason `dirty` at exit 1, whose evidence names the condition and whose remediation instructs the operator to update the delivery branch onto the base, re-verify, and retry; and it performs zero rebase attempts, zero head mutations, and zero landing calls. | F-2, API-2, DM-2, NFR-4 |
| AC-F2-2 | **Given** a request whose normalized mergeability is `not-mergeable`, **when** `merge` runs, **then** it offers exactly one guarded landing call — the provider being the authority on whether its protection rule blocks the request — and, on refusal, performs exactly one bounded post-refusal re-read of the same request and resolves the outcome by the declared rule: an out-of-date condition yields `merge.sync-required` with reason `behind`, a checks posture yields the effective gate set's row with the delivered reason, and any other observation yields `merge.transaction-aborted` naming the observed provider state; and no refusal is retried. | F-2, API-2, DM-2, NFR-4 |
| AC-F2-3 | **Given** a request that is behind its base but whose post-refusal re-read is not decisive because the delivered four-value normalization collapses that condition, **when** `merge` runs, **then** the outcome is still exactly one typed refusal from the declared set that names the sync condition in its evidence and carries the sync remediation, performs zero rebases and zero retries, and never reports success; the boundary is stated in the specification and no prose matching is introduced to recover the distinction. | F-2, API-2, DM-2, RSK-7 |
| AC-F2-4 | **Given** a request whose mergeability is absent or `unknown`, **when** `merge` runs, **then** it performs exactly one bounded re-read of the same request compared on the exact head: a recovered read classifies by the rule above, a changed head refuses `merge.gates-stale`, and a still-unknown read refuses `merge.mergeability-unknown` at exit 2, retryable, with consequence `not_landed` and a remediation that instructs a retry after the provider finishes computing; and the command never waits or polls. | F-2, API-2, DM-2, NFR-4 |
| AC-F2-5 | **Given** any refusal path in the taxonomy, **when** it is emitted, **then** its code, domain kind, and exit are exactly the declared row's, the two new rows are documented and machine-declared together in the declared order, the family slot is unchanged and validated against the effective gate set with no pattern widening, and `merge.rebase-conflict` remains declared, reserved, and reachable from no delivered command path. | F-2, DM-2, NFR-6 |
| AC-F2-6 | **Given** any `merge` invocation, **when** the landing path is inspected, **then** no branch performs an internal rebase, no branch mutates the head it verified, and no force, bypass, auto-merge, queue, or landing-retry variant is representable in the mutation union (structure test with a failing control). | F-2, API-2, NFR-9 |

### 17.3 Required-check awareness (F-3)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F3-1 | **Given** a declared required job in `queued` or `running` on the verified head, **when** the declared gate evaluation runs, **then** the verdict is not green with the delivered pending reason, and this is asserted as a contract rather than left to two implementations; `canceled`, `skipped`, and `failed` keep their delivered reasons. | F-3, API-2, NFR-1 |
| AC-F3-2 | **Given** the post-verification probe, **when** a declared required job on the verified head is newly not green — queued, running, canceled, skipped, or failed — **then** `merge` refuses on the `merge.gate.<gate-id>.failed` family naming the job and its delivered reason, and a job that was already not green in the recorded verification is not reported as new. | F-3, API-2, DM-2 |
| AC-F3-3 | **Given** a job the effective gate set does not declare, **when** it is not green on the verified head, **then** it is not gate evidence and produces no refusal, and a check-run page for a different head is never treated as head evidence. | F-3, API-2 |
| AC-F3-4 | **Given** a provider-required check refusal, **when** it is received, **then** it is classified as a refusal, never retried and never bypassed, and no second required-check evaluator and no prose matching exist on the path. | F-3, API-2, NFR-9 |

### 17.4 Closeout milestone synchronization (F-4)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F4-1 | **Given** the closeout plan, **when** it is inspected after the change, **then** the step inventory is exactly thirteen entries with `milestone-sync` at position 12 and `capsule` terminal at 13, consumers resolve steps by `stepId` and tolerate the insertion, the documented inventory states thirteen, and the step-failure family slot validates against the effective set unchanged. | F-4, API-3, DM-4, NFR-6 |
| AC-F4-2 | **Given** a change whose pm-notes declares a conforming milestone and whose work item carries the same provider-asserted milestone, **when** `closeout --apply` runs on the last open ticket with every attached item done or canceled, **then** the step reports `applied` after exactly one close write whose read-back asserts the closed state, and the run's other steps, exit, and queue-removal outcome are unchanged. | F-4, API-3, API-4, DM-9 |
| AC-F4-3 | **Given** an absent declaration, a non-conforming declaration, or a declaration that does not match the provider-asserted attachment, **when** the step runs, **then** it is `skipped-noop` with exactly one residue item naming the closed reason (`declared-milestone-missing` or `attachment-mismatch`), performs zero writes, and never guesses a target by title similarity or derivation; a declaration of `none` is `skipped-gap`. | F-4, API-3, DM-5, DM-9 |
| AC-F4-4 | **Given** an open attached item, an unavailable signal, an unknown state, or a truncated attached set, **when** the step runs, **then** closure is withheld — `skipped-noop` with exactly one residue item naming the closed reason (`closure-withheld`, `milestone-signal-unavailable`, or `attached-set-truncated`) — and no close write occurs; the read is bounded at 200 attached items and performed at most once. | F-4, API-4, DM-5, DM-9, NFR-4 |
| AC-F4-5 | **Given** the new operation's argument and effect vocabulary, **when** it is inspected by a structure test and by review, **then** no shape can express creating, attaching, detaching, renaming, or reopening a milestone; the effect is at most one close per run, read-back verified, never retried, and `alreadyApplied` when the record already reads closed. | F-4, API-3, DM-6, NFR-9 |
| AC-F4-6 | **Given** plan mode and two consecutive apply runs, **when** the milestone facts are unchanged, **then** plan performs the read and renders `would-apply`, `satisfied`, `would-refuse`, `skipped-noop`, or `skipped-gap` with zero writes, zero appends, and zero fence acquisitions; the first apply performs at most one close and the second reports `satisfied` with zero writes. | F-4, API-3, NFR-4 |
| AC-F4-7 | **Given** GH-349's own closeout, **when** the step runs against the M4 milestone, **then** the verified outcome is the attachment check plus a recorded exit-review verdict — the closure is withheld because other attached tickets are open — and this is accepted as satisfying the ticket's "synced milestone" clause; the acceptance never requires, and must never assert, a closed milestone record for this change. | F-4, API-4, DM-5, RSK-1 |
| AC-F4-8 | **Given** a close write that did not land, or a read-back that did not observe closed, **when** the step runs in apply mode, **then** the run returns the delivered gating identity `closeout.write.failed` at exit 2, appends no capsule close, records the failure as evidence, and converges on retry; and a provider without the surface reports `skipped-gap` with its declared gap reason, never a silent skip. | F-4, API-3, DM-6, RSK-11 |
| AC-F4-9 | **Given** the milestone read, **when** a provider lacks the surface, **then** the read is a declared gap and adds no closed operation and no capability flag; both new surfaces ride the existing injected transport and credential port, and the secret-read allowlist is unchanged. | F-4, API-4, DM-6, NFR-3 |

### 17.5 One phase truth source (F-5)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F5-1 | **Given** any successful completion or reopen, **when** the pm-notes document is written, **then** the target entry's `completed` is the post-transition fold's value on every document-writing branch, `started` is never rewritten for an existing entry, a reopen writes null, and no branch derives the value from a lookup over history. | F-5, API-6, DM-8 |
| AC-F5-2 | **Given** the sequence complete → reopen → re-complete, **when** the second completion lands, **then** the fold, `phase list`, and the document all report the second completion timestamp, the pre-reopen value appears nowhere in either surface, and an already-converged re-run reports the same value as its no-op evidence. | F-5, API-6, DM-8 |
| AC-F5-3 | **Given** both surfaces conforming, **when** `lint <ref> --pm-notes --registry` runs and a ledger-backed phase's document completion differs from the fold's completion, **then** the verdict is exactly one `lint.phases.divergent` at exit 1 naming the phase id, both values within the declared bound, and the declared remediation; a null value and a timestamp are treated as different facts. | F-5, API-5, DM-8 |
| AC-F5-4 | **Given** a phase with no ledger history, or a document completion with no ledger transition, **when** the both-target lint runs, **then** neither produces `lint.phases.divergent`; the exclusion is stated in the specification and in the finding's documentation, not implied, and `verify change`'s verdict, precedence, and read-only contract are unchanged. | F-5, API-5, DM-8 |
| AC-F5-5 | **Given** a divergence fixture, **when** the rule runs, **then** it performs zero document writes, zero fence acquisitions, zero record appends, zero tracker reads, and zero clock reads, and two replays of the same inputs produce the identical verdict and ordering. | F-5, API-5, NFR-8 |
| AC-F5-6 | **Given** the change lands, **when** the command surface is inspected, **then** no `phase repair`, no lint fix mode, and no new state kind exists, the five delivered lint rows keep their codes and remediation, and the new row is appended in the declared rule order with its documented and machine-declared entries moving together. | F-5, DM-8, NFR-6 |
| AC-F5-7 | **Given** the acceptance corpus, **when** the both-target lint runs, **then** zero new findings are reported; any finding is recorded as evidence of a second writer and investigated rather than suppressed or excluded. | F-5, NFR-11 |

### 17.6 Queue integrity (F-6)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F6-1 | **Given** the seven declared integrity properties — claim, park, reconcile, CRUD, reason-bearing removal, single-flight, and append-position presence — **when** each property's suite runs, **then** each asserts its declared outcome through the production composition and each carries a mutation control that injects the breach and fails naming the property. | F-6, API-7, NFR-1 |
| AC-F6-2 | **Given** a property whose control demonstrates a breach, **when** it is repaired, **then** the repair restores the declared sentence, changes no vocabulary value, key, flag, or refusal into a success, and the property's suite passes with its control still failing on the injected breach. | F-6, API-7, NFR-6 |
| AC-F6-3 | **Given** any queue mutation, **when** the surface is inspected, **then** the verb set, record kinds, state keys, and flag grammar are exactly the delivered ones, and no new verb, kind, key, or flag exists. | F-6, API-7, NFR-6 |
| AC-F6-4 | **Given** the new milestone step, **when** `closeout --apply` retires the queue entry, **then** the automatic `landed` removal remains a non-step, fail-open, merge-truth-gated, idempotent hook inside the transaction's existing fence, performs zero duplicate removals on re-run, acquires no second fence, and changes no step outcome or exit code — including when the milestone closure was withheld or its step was a gap. | F-6, API-7, DM-4 |
| AC-F6-5 | **Given** a removal of a parked entry, **when** it lands, **then** the park release is appended before the removal in one fenced transaction and the park history stays durable, and a refusal on any precondition appends nothing and leaves the entry exactly as it was. | F-6, API-7 |
| AC-F6-6 | **Given** the delivered bounds, **when** the queue surface runs, **then** the folded-read cap, the reconcile examined-entry cap, the four removal reasons, and the refusal-detail bound are unchanged, and a truncated reconcile reports its remainder rather than omitting it silently. | F-6, API-7, NFR-4 |

### 17.7 Named-defect regressions (F-7)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F7-1 | **Given** a landing refusal on a declared gate, **when** the failure is classified, **then** the emitted code is the family code, its domain kind is `merge`, and its exit is 1; the composition's declared emittable set covers every code its refusal branches emit including that family, no member resolves to a row of a different kind, `fallback.internal` appears nowhere in the outcome, and a live mismatch control still reaches the containment identity so the assertion cannot pass vacuously. | F-7, API-2, DM-2, NFR-6 |
| AC-F7-2 | **Given** the F4 regression suite named after the stale-timestamp defect, **when** it runs against the pre-fix behaviour, **then** it fails; against the fixed behaviour it asserts that the fold, `phase list`, and the document all carry the second completion, that a hand-edited completion yields `lint.phases.divergent` naming the phase, that a document-only completion is not flagged, and that detection performs zero writes and zero fence acquisitions. | F-7, F-5, API-5, API-6 |
| AC-F7-3 | **Given** the F8 regression suite, **when** it replays a serial sequence of three merges from the same base, **then** each invocation performs at most one landing call, no invocation mutates the head, no internal rebase is attempted, and the non-first invocations resolve as typed refusals that instruct the coordinator to sync rather than rebasing and retrying. | F-7, F-2, API-1, API-2 |
| AC-F7-4 | **Given** each of the three defect suites, **when** its primary assertion is removed or the pre-fix behaviour is restored, **then** the suite fails by name; a suite that cannot fail is a delivery defect, not a passing test. | F-7, NFR-1 |
| AC-F7-5 | **Given** the change lands, **when** the aggregate test path runs, **then** the three defect suites and the queue-integrity suites execute offline inside the existing test jobs, no workflow file or job is added, and the pinned topology contract stays green. | F-7, NFR-2 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- Delivered as one change on its own branch from the tooling integration branch, with the pull request targeting that integration branch and stopping with the PR open; merge authority stays outside this change.
- Sequenced by outcome so each declaration lands with the evidence that proves it: first the additive contract surface (the normalized title, the two merge rows, the lint row, the residue kind, the operation, the step id) and its synchronized pins; then the landing path and its refusal taxonomy; then the probe extension; then the phase mirror and divergence rule; then the milestone step and its two provider surfaces; then the queue property proofs; then the defect-named regressions and the documentation reconciliation.
- Decision records ADR-0012, TDR-0040, and ODR-0005 are authored as `Proposed`, cited rather than duplicated, and land with their index rows; the owner accepts them at review. Their acceptance is a review act, not an AI act.
- No feature flag is required. The merge path is the loop's only landing path, so a staged rollout would recreate the second mechanism this decision removes; the change is instead reversible by reverting the composition and the transaction's landing port, with no persisted-state migration (landed merges stay landed, and the additive field and rows may remain harmlessly if only the composition is reverted).
- The milestone step is additive and idempotent; a repository whose declaration is absent or non-conforming sees `skipped-noop` with a recorded reason and no behaviour change beyond one extra plan line.
- Adoption bound stated openly: the lifecycle `merge` requires a provider that implements the landing operation. GitHub does; GitLab and Jira declare gaps and therefore refuse. The flip's F4 evidence is consequently GitHub-only, which is the stated M4 scope and a real adoption constraint.
- Release impact is a minor version bump: new additive contract surface plus one behavioural change in the merge refusal vocabulary. No operator configuration is added, no new command exists, and no persisted state migrates.
- Communication is internal to the coordinator/`@pm` call sites (whose refusal branching changes), the closeout and queue owners, the adapter and conformance owners, and the milestone-pack owners (closure now happens through the transaction).

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

Not applicable. No persisted-state schema, record kind, or document schema is migrated. The new normalized field, the new read field, the two merge rows, the lint row, the residue kind, the step id, and the tenth operation are additive and require no backfill. Existing `merge.transaction` records keep their meaning: a record whose landing identity predates this change describes a local squash commit, and a re-run over such a record re-verifies containment rather than re-landing; no record is rewritten. Existing pm-notes documents are not migrated: the next transition writes the fold value, and any pre-existing disagreement is reported by the divergence finding rather than repaired. Existing closeout operation histories keep their identities; the inserted step's operations are new identities under the same kind, so a re-run of an older history executes only the steps it has not yet recorded.

## 20. PRIVACY / COMPLIANCE REVIEW

- No personal data is introduced. The milestone read returns provider-owned identity, title, state, and work-item delivery states; the crafted landing metadata carries the request title, the change ref, and the request identity, and nothing else.
- The refusal evidence and the residue items carry bounded scalar facts — phase ids, timestamps, job names, gate ids, provider states, milestone titles, work-item refs — and never credential material, payloads, bodies, review prose, or provider-native documents.
- No telemetry is added, so no new personal-data flow exists; the closeout capsule gains no event for the milestone verdict.
- Fixtures are synthetic and sanitized under the delivered audit, with example-only hosts and stable placeholders; the planted-secret canary stays binding.
- No cloud service, hosted product, or vendor-specific naming is added, and the new surfaces are provider-neutral in core with provider behavior confined to the adapter subpaths.

## 21. SECURITY REVIEW HIGHLIGHTS

- **No new I/O edge.** The landing and the milestone read/write ride the existing injected transport and credential port; no new transport, credential path, network location, or secret-read allowlist entry exists, and the invariant count is unchanged.
- **No force, no bypass, no widening.** Force, branch-protection bypass, auto-merge, merge queues, rebase, and merge-commit strategies remain unrepresentable in the landing type; the queue mutation union gains nothing; the closeout operation vocabulary cannot express creating, attaching, detaching, renaming, or reopening a milestone. Structural unrepresentability is the control, not a documented prohibition.
- **The exact-head guard closes a racing-push window.** A head that moves after verification cannot be landed, and a provider guard rejection is a classified refusal that is never retried and never overridden.
- **Truthful failure over silent containment.** A declared refusal must carry its row's declared kind and exit; the containment identity is reachable only for a genuinely undeclared failure, and the F1 regression proves both directions with a live mismatch control.
- **Withholding is the default for a destructive effect.** A milestone is closed only on a complete, open, fully-closed attached set; an unavailable, unknown, or truncated view withholds, and the write is read-back verified.
- **Read-only detection cannot become a writer.** The divergence rule performs no write, no fence, and no append, and the change adds no repair command, so a second write path cannot hide behind a fix.
- **Secret and output hygiene.** Refusal summaries, residue items, and verdicts stay within their declared bounds and never echo provider payloads, titles beyond the crafted subject, bodies, or credential material.

## 22. MAINTENANCE & OPERATIONS IMPACT

- **New ongoing surfaces:** two merge refusal identities, one lint finding, one residue kind, one closeout step, one adapter operation with its read, and one normalized optional field. Each is declared data with a documented counterpart, so a future change is reviewable without discovering a convention.
- **The merge path has exactly one landing mechanism.** Adding a provider means implementing the declared landing operation and declaring the read/close surfaces for the milestone step; it does not mean adding a branch to `merge`.
- **Refusal vocabulary is a contract for the coordinator.** A prompt or script that branches on the generic abort for an out-of-date or undecided request must branch on the new identities; the two identities' remediation strings are the operator-facing instructions.
- **The milestone step is the closure path.** Closing a milestone by hand is no longer the routine act; a milestone that needs a detached ticket stays withheld and requires the owner's detachment, which is an owner act outside the tool.
- **Phase drift has a name.** A mirror mismatch surfaces before verification as one finding naming the phase; the remedy is a re-derivation or a recorded transition, never a repair command.
- **Queue integrity is proven per property.** A future queue change either keeps a property's suite green or fails naming the property; the cost is one control per property, not a new convention.
- **No new operational surface:** no new command, job, artifact, alert, or configuration key. On-call sees ordinary command refusals and ordinary test failures with named causes.
- **Documentation debt is paid in the same change** through the phase-7 reconciliation list in Appendix A; the pins that move are enumerated in Appendices D and E.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Provider-side landing | The closed adapter operation that lands a delivery request on the provider with a squash strategy, an optional crafted title and message, and an optional expected head, at most once and never retried. |
| Crafted squash metadata | The landing's commit subject — the provider-asserted request title or its deterministic fallback — and its fixed bounded message trailer, composed without operator input. |
| Exact-head guard | The landing's binding to the head SHA the freshness envelope verified; a moved head refuses before any landing call. |
| Sync-required | The typed merge outcome stating that the delivery branch must be updated onto its base by the normal path before a retry; it performs no rebase and never lands. |
| Mergeability-unknown | The typed merge outcome stating that the provider has not decided the request's mergeability after exactly one exact-head recovery read. |
| Containment identity | The fallback failure identity that classifies a failure whose declared kind and code do not resolve to a matching error-table row; a declared refusal must never reach it. |
| Exit-review gate | The predicate that permits milestone closure: the record is open and every attached work item is done or canceled, on a complete bounded view. |
| Milestone sync | The closeout step that verifies the change's declared milestone against the provider-asserted attachment, evaluates the exit review, and closes only when it holds. |
| Withheld closure | The success-shaped outcome of a milestone step that could not safely close: `skipped-noop` plus one residue item naming the closed reason. |
| Phase fold | The pure derivation of phase state from ledger transition records: `started` from the first completion, `completed` from the latest, cleared by a reopen. |
| Mirror | The pm-notes phase map, derived from the fold on every write and never read as truth. |
| Divergence | A ledger-backed phase whose document completion differs from the fold's completion; reported once, never repaired. |
| Document-only completion | A document completion with no ledger transition, excluded from divergence detection by design. |
| Defect-named regression | A suite named after a defect whose control fails on the pre-fix behaviour, so the suite cannot pass vacuously. |
| Append-position presence | The queue rule that a ref is present iff its latest entry append is later than its latest removal append in record sequence, never by timestamp text. |
| Emittable declaration | The exported set of failure codes a production composition's refusal branches can emit, used as the domain of the classification-totality proof. |

## 24. APPENDICES

### 24.1 Appendix A — Phase-7 documentation impacts

| Document | Required reconciliation |
|----------|-------------------------|
| `doc/spec/features/feature-merge-verify-deploy.md` | Replace the "two mechanisms coexist" statement and the local landing description with the provider-side landing path: one composed mechanism, crafted metadata and its fallback, the exact-head guard, provider-asserted truth and the recorded landing identity's new provenance, the four-state refusal rule with the two new rows, the removal of the rebase-refresh from the command path, the retained reserved row, the probe's not-green extension, and the unchanged post-landing steps. Update the error-identity section from seven concrete rows to nine. |
| `doc/spec/features/feature-closeout.md` | Twelve-step inventory → thirteen with `milestone-sync` at 12 and `capsule` terminal; the attachment verification, exit-review predicate, bounded read and its cap, the outcome table and closed withheld reasons, the gating write failure, the dry-run/idempotency posture, the ninth residue kind, the capability matrix entry for the new operation, and the statement that the automatic queue removal and every other step are unchanged. |
| `doc/spec/features/feature-pm-notes-lint-and-phase-transitions.md` | The mirror rule (completion derived from the post-transition fold on every document-writing branch, `started` immutable, reopen writes null, no-op evidence reports the fold), the sixth lint row in the declared order with its scope exclusion, the fold exposure on the lint registry read, and the unchanged `verify change` statement. |
| `doc/spec/features/feature-verify-change-and-exit-taxonomy.md` | State that divergence detection lives on the conformance surface, that `verify change`'s verdict, precedence, and read-only contract are unchanged, and that a mirror mismatch is not a finalization failure. |
| `doc/spec/features/feature-scheduling-engine.md` | Record the queue integrity properties and their defect-named controls, the unchanged verbs, kinds, keys, and bounds, and the unchanged automatic `landed` removal contract across the closeout step insertion. |
| `doc/spec/features/feature-result-contract.md` | Two new concrete `merge` rows and the retained reserved one, the one new lint row, the identity total 149→152 on both tables, the emittable-declaration statement (exhaustive over emitted codes including the family), and the unchanged containment semantics. |
| `doc/spec/features/feature-adapter-ports.md` | Ten closed operations with `close-milestone` appended, its canonical arguments and single effect, the additive optional normalized request title, the bounded milestone read as an adapter-local read adding no operation and no flag, and the per-adapter postures. |
| `doc/spec/features/feature-adapter-reference-behavior.md` | The landing composition's normative behavior (crafted metadata transmitted verbatim, expected-head guard, read-back truth, at-most-once), the milestone read's absence/unavailable/truncated semantics, the close write's read-back and `alreadyApplied` rule, and the gap postures. |
| `doc/spec/features/feature-adapter-conformance.md` | The tenth operation's registry representation, the coverage-gate statements that say nine, the parity matrix's row and cell counts (27→30), the adjudicated new cells, and the unchanged six-family accounting. |
| `doc/guides/milestone-management.md` | State that closure is executed by the closeout transaction on the exit review, that creation/attachment/detachment/rename/reopen remain owner acts outside the tool, and that a withheld closure is the routine outcome for a milestone that is not on its last ticket. This page is `redistributable`, so `scripts/.tests/test-doc-distribution.sh` must pass. |
| `doc/overview/glossary.md` and `doc/00-index.md` | Add the new terms (provider-side landing, crafted squash metadata, exact-head guard, sync-required, mergeability-unknown, exit-review gate, withheld closure, phase fold vs mirror, divergence) and update the merge, closeout, phase, and scheduling index lines for the changed surfaces. The index is `redistributable`. |
| `doc/decisions/00-index.md` | Add ADR-0012, TDR-0040, and ODR-0005 rows (`project-generated`). |
| Command reference pages (`merge`, `closeout`, `phase`, `lint`, `queue`) | Reconcile the documented surfaces: the merge refusal list, the closeout step list and residue vocabulary, the phase mirror rule, the lint row list, and the queue integrity statement. No new command is added, so the help/reference coverage inventory keeps its command set; every touched page keeps `--help`/`--version`. |
| `doc/spec/features/feature-capsule.md` | Record that a withheld milestone closure is a residue item and a step outcome, never a capsule event, and that the capsule's event vocabulary and cross-check are unchanged. |
| Archived plan pages | Reconcile the historical statements that these surfaces are unimplemented or that the step inventory is twelve, where a page describes current behavior rather than history. |

**Doc-distribution obligation.** Every changed document that carries an `ados_distribution` marker keeps it (or gains it where a new page is created under a governed root: `doc/guides/`, `doc/templates/`, `doc/00-index.md`); `.md` keys go inside the existing front matter block, `.yaml` register templates carry the key as a top-level line. A change that ships or modifies a `redistributable` doc must pass the distribution drift guard in the same change.

### 24.2 Appendix B — Ticket-to-AC traceability

| Ticket element | AC ids | Verifying test class |
|---|---|---|
| AC (a): "merge on a ready item lands with the crafted squash message and returns a typed result without any platform CLI" | AC-F1-1, AC-F1-2, AC-F1-4, AC-F1-6, AC-F1-9 | Behaviour suite over the production composition with an injected recording transport (exactly one landing call, crafted title/message, typed result); production-source scan with a failing control for platform-CLI and local-landing composition; golden for the rendered success line |
| AC (a) negative half: a landing that cannot be trusted is not reported merged | AC-F1-3, AC-F1-5, AC-F1-7, AC-F1-8 | Contract/behaviour suite: provider-not-merged fixture refuses; moved-head fixture with a zero-call assertion; gap adapter refuses; retirement scan with a failing control |
| AC (a) typed-refusal half: no declared refusal reaches the containment identity | AC-F7-1, AC-F2-5 | Classification-totality suite over the exported emittable declaration plus a live mismatch control; bidirectional error-table sync check |
| AC (b): "a DIRTY/BEHIND PR is rebased by the primitive or refused with a typed sync-required result" | AC-F2-1 (dirty), AC-F2-2 (behind via the post-refusal re-read), AC-F2-3 (declared boundary), AC-F2-6 (no rebase exists) | Refusal-taxonomy behaviour suite, one case per observed state, with call-count assertions; no-force/no-rebase scan with a failing control; structure test on the mutation union |
| AC (b) undecided half: "the provider has not decided" is a typed outcome, not a force | AC-F2-4, AC-F3-1, AC-F3-2, AC-F3-3, AC-F3-4 | Recovery-read suite (exactly one re-read, head comparison); probe extension suite (queued/running/canceled/skipped/failed cases, non-declared job control) |
| AC (c): "`closeout --apply` at the change boundary leaves zero leftover worktrees, a closed issue, and a synced milestone" | AC-F4-2 (synced milestone), AC-F4-7 (GH-349's own boundary), AC-F4-1, AC-F4-3, AC-F4-4, AC-F4-5, AC-F4-6, AC-F4-8, AC-F4-9 | Closeout behaviour suite over a temporary local repository and fixture provider: worktree/branch/issue outcomes unchanged and asserted together with the milestone verdict; milestone outcome matrix (one case per row); idempotency (two applies, one write); plan zero-write; write-failure gating; structure test on the operation vocabulary; capability coverage |
| AC (d): "both phase sources agree after every phase transition" | AC-F5-1, AC-F5-2, AC-F5-6 | Property-style mirror suite over the transition matrix including reopen → re-complete, with the pre-fix value asserted absent; command-surface structure test |
| AC (d) detection half: a disagreement is reported, not repaired | AC-F5-3, AC-F5-4, AC-F5-5, AC-F5-7 | Lint both-target suite (divergence, exclusion, zero-write/zero-fence, determinism) plus the corpus run recorded as evidence |
| "queue integrity (claim, park, reconcile, CRUD)" | AC-F6-1, AC-F6-2, AC-F6-3, AC-F6-5, AC-F6-6 | Seven property suites with one injected-breach control each, over the production composition; grammar/structure invariance |
| "queue removal" interaction with the new step | AC-F6-4 | Closeout behaviour suite asserting the removal outcome, exit, and single fence with and without a withheld milestone |
| "one phase truth source between the registry and pm-notes artifacts (F4)" | AC-F5-1, AC-F5-2, AC-F5-3, AC-F5-4, AC-F5-5, AC-F5-6, AC-F7-2 | Defect-named F4 suite (fails on pre-fix behaviour) |
| "a regression test per named defect" (F1, F4, F8) | AC-F7-1, AC-F7-2, AC-F7-3, AC-F7-4, AC-F7-5 | Three defect-named suites with controls, plus the offline/topology assertion |
| "F8 serial-merge churn" | AC-F7-3, AC-F2-1, AC-F2-6 | Three-merge serial fixture with call-count and head-mutation assertions |
| "no `gh pr merge`, no manual worktree pruning, no manual issue closing" | AC-F1-1, AC-F4-2 | Production-source scans with failing controls; closeout behaviour suite asserting the delivered worktree and issue outcomes without an operator act |
| Deliverable conventions (commit primitive, gate TMPDIR, PR base) | NFR-12 | Gate-command record review; PR base assertion |

### 24.3 Appendix C — Invariants the plan may not widen

These are binding on delivery planning. Each is a boundary, not a preference; a plan phase that needs to cross one is out of scope and returns for a specification revision.

1. No new queue verb, subcommand, record kind, state key, or flag; the queue integrity work is property proof plus repair to the declared sentence.
2. No milestone create, attach, detach, rename, reopen, entry review, planned-scope verification, extension, or a `milestone` command family, anywhere, by any actor.
3. No new closed adapter operation beyond the single milestone close; no removed, renamed, retyped, or reordered operation, carrier kind, gap reason, or capability flag.
4. No landing force, bypass, auto-merge, merge-queue, rebase, or merge-commit strategy, no landing retry, no second landing mechanism, and no silent local fallback on a declared gap.
5. No fetch, push, remote read, or base mutation on the merge path; the git seam stays remote-free.
6. No second required-check evaluator and no prose matching anywhere in the check or refusal path.
7. No phase repair, lint fix mode, new phase state kind, or change to `verify change`'s verdict, precedence, or read-only contract.
8. No second derived mirror of phase state, and no surface that treats the pm-notes document as truth.
9. No new error identity beyond the two merge rows and the one lint row; no pattern widening; no exit class, domain kind, or projection change; the retained reserved row is neither removed nor re-meant.
10. No new CI workflow file, job, trigger, permission, upload, or artifact field; the suites ride the existing test jobs.
11. No new network location, credential, transport, secret-read allowlist entry, or ambient environment read.
12. No execution of a provider write, a close, or a phase transition by a test: every new suite drives injected transports and temporary local repositories offline.
13. Capability declarations stay honest: every adapter declares support or a valid closed gap reason for every declared operation, and no unadvertised capability is implied.
14. No adapter behaviour change outside the declared operation addition and the bounded milestone read; the GitHub landing implementation, the normalization rules, and the failure identities keep their delivered behaviour.
15. Testkit stays runtime-neutral: no `node:*`/`bun:*` import and no ambient environment, clock, or randomness read.
16. No change to the capsule event vocabulary, the promotion rules, the retro surface, or harness telemetry.
17. No touched pin is loosened, skipped, made vacuous, or updated without its pinned counterpart; a count that exists in two places moves in both.

### 24.4 Appendix D — Additive surface inventory (complete, with counts)

| Surface | Before | After | Non-negotiable companion moves |
|---|---|---|---|
| Normalized delivery-request title | absent | one additive optional field (absent = unknown) | Crafted-title fallback declared and tested; no reretyped or newly required field |
| Concrete `merge` refusal rows | 7 | 9 (`merge.sync-required`, `merge.mergeability-unknown`) | Documented table, machine table, the merge-kind declaration, the composition's emittable set, and the reachability proof |
| `merge` open-slot family | 1 (`merge.gate.<gate-id>.failed`) | 1 (unchanged) | Family declaration, slot rule, and effective-gate-set validation unchanged |
| Retained reserved row | `merge.rebase-conflict` (reachable) | same row, unreachable from the command | Retained in the declared emittable set; revisit trigger recorded |
| pm-notes lint family rows | 5 | 6 (`lint.phases.divergent`) | Documented table in the declared order, machine table, the lint-kind declaration, and the rule-order statement |
| `lint` domain concrete rows | 6 (five pm-notes + the plan-target row) | 7 | The plan-target row is unchanged and keeps its own meaning |
| Machine/documented identity total | 149 | 152 | Both tables, the bidirectional sync check, the pinned counts in the sync and structure checks, and the documented "N identities" statements |
| `CLOSEOUT_STEP_IDS` | 12 | 13 (`milestone-sync` at 12, `capsule` terminal at 13) | Documented twelve-step inventory, the step-failure family's slot validation, the reference page, and every index line that states twelve |
| Closeout residue kinds | 8 | 9 (`milestone-sync-withheld`) | Documented residue vocabulary, the closed withheld-reason set, the dedup/order/cap statement, and the rendering statement |
| `ADAPTER_OPERATIONS` | 9 | 10 (`close-milestone`) | GitHub support, GitLab `adapter-not-implemented`, Jira `provider-unsupported`; see Appendix E |
| Parity matrix cells | 27 (9 × 3) | 30 (10 × 3) | Row set derived from the closed set; three adjudicated cells; register entries where a cell is a difference |
| Conformance coverage requirement | "all nine operations represented" | "all ten" | Structural gate text, the runtime gate's exact-gap-encounter rule, and the per-adapter support/gap coverage |
| Trap-family accounting | 6 families × 3 adapters = 18 cells | unchanged (18) | The new operation is not a trap family and must not be added to the family vocabulary |
| `LintRegistryRead` | counts, verification classes, projection presence | adds the verified fold additively | One comparison site; no other read changes |
| Closeout operation record kind | 1 (`closeout.operation`) | unchanged | The new step's operations are ordinary members of the same kind and identity derivation |
| Merge transaction record | 1 kind, fixed shape | unchanged shape; landing-identity provenance changes | Closeout's merged-evidence anchor statement |
| Event/message vocabulary | unchanged | unchanged | A withheld closure is a residue item, not an event |
| Workflow files, jobs, artifact fields, exit classes, domain kinds | unchanged | unchanged | Topology, artifact, and taxonomy pins stay green |

### 24.5 Appendix E — Conformance and parity ripple checklist (one change, atomically)

An operation-set change is not complete until every item below moves together. Any subset is a red gate, not a partial success.

1. The closed operation set gains the tenth member by append; no index moves and no existing member is reordered.
2. The flow registry represents the new operation with a step (an executing step for a supporting adapter, or a step that reaches the declared gap), and no existing flow, step id, assertion family, or step count is renumbered.
3. The structural coverage gate's representation requirement moves from nine to ten, and the per-adapter supported/gap coverage rule still holds for every adapter.
4. The runtime coverage gate executes the supported operation against the mock tenant and encounters every declared gap with its exact reason.
5. The mock tenant's route table carries the new write route and its read-back route, each with an expected projection.
6. The parity matrix gains one row, yielding 30 cells, with each new cell adjudicated: the reference adapter `same-as-reference`, the two others `gap` citing their declared reason; a difference would require a register entry with a class set, evidence per class, and an adjudication reference.
7. The declared-difference register is either unchanged (no new difference) or carries exactly one entry per new declared-difference cell — never an orphan and never a duplicate.
8. The per-file executable-export inventory and the export-discipline expectation are updated exactly for any new export, without weakening either check.
9. The identity-construct scan's allowlist is unchanged: the new operation name is data, and the new client method lives in the provider subpath that is already a permitted home.
10. The capability declarations' gap reasons are drawn from the closed reason set, and a provider that cannot read the attached set still declares its position rather than implying parity.
11. The reference/help coverage inventory keeps its command set (no new command) and the touched pages keep their required markers.
12. The topology contract test stays green with zero workflow-file, job, trigger, permission, and upload changes.

### 24.6 Appendix F — Defect register (evidence, repair, regression)

| Defect | Verified current condition | Repair required | Named regression and control |
|---|---|---|---|
| **F1** — a merge refusal reaching the containment identity | The CLI classifier resolves a failure by declared kind plus code and contains any pair that does not resolve to a matching row as the fallback identity at exit 2. The merge composition's declared emittable set carries seventeen members (seven forwarded configuration codes, three read identities, seven merge identities) and omits the `merge.gate.<gate-id>.failed` family, which the transaction emits from its refusal path; the classification-totality suite ranges over that declaration only. An exported internal-failure constructor also declares the merge kind with the containment code while having no production caller (scan scope: the product packages and the test tree, 2026-11-18). | Make the declared emittable set exhaustive over every code the refusal branches emit, including the family; emit each refusal from its resolved row so kind and code cannot contradict; leave the containment branch reachable only for a genuinely undeclared failure; remove or re-derive the contradictory constructor so no merge failure can declare a kind its row denies. | Suite named for the defect: a gate-family refusal asserts code, domain kind `merge`, and exit 1 with the containment identity absent from the outcome and summary; the same suite asserts the two new rows' code/kind/exit; a live mismatch control still reaches the containment identity, so an empty or hand-picked assertion set cannot pass. |
| **F4** — pm-notes/registry divergence | The convergence branch re-stages the document from the **first** matching completion in the full history while the fold defines completion as the **latest**; the same stale value is reported as the no-op evidence; no surface compares the two, and the both-target lint's registry read exposes no fold. | Derive completion from the post-transition fold on every document-writing branch; report the fold value in no-op evidence; add the read-only divergence comparison scoped to ledger-backed phases and completion only. | Suite named for the defect: complete → reopen → re-complete asserts the second completion in the fold, `phase list`, and the document, with the pre-reopen value absent; companions assert a hand-edited completion yields `lint.phases.divergent` naming the phase, a document-only completion is not flagged, and detection writes nothing and takes no fence. The control restores the history lookup and must fail. |
| **F8** — serial-merge churn | The transaction attempts one local rebase-refresh when the request reads `conflicting`; the refresh is checkout plus rebase with no push, so it cannot change what the provider accepts; a successful refresh changes the head, voids the SHA-bound verification, and refuses with the stale-verification identity, forcing another verify-and-retry cycle per serial merge. | Remove the refresh from the command path; resolve the out-of-date cause as one typed sync instruction; keep the landing bound to the verified head; retain the refresh capability with no composed caller. | Suite named for the defect: a three-merge serial fixture asserts at most one landing call per invocation, zero head mutations, no rebase attempt, and a typed sync refusal for the non-first merges. The control restores the refresh attempt and must fail on the head-mutation assertion. |

### 24.7 Appendix G — Declared boundaries and consequences

1. **`behind` is not always separable.** The delivered four-value normalization collapses `behind` into `not-mergeable`, so a behind request is reported as `sync-required` only when the post-refusal re-read is decisive. Otherwise the refusal is the declared gate-posture identity naming the observed provider state and carrying the sync remediation. Prose matching is prohibited as a substitute; the provider-asserted per-request posture that would remove the limit is a recorded revisit trigger.
2. **Closeout's merged-diff anchor waits for a fetch.** A provider landing does not put the squash object in the operator's checkout, and `merge` performs no fetch, so the merged-diff sweep degrades to `skipped-gap` with `merged-diff-unavailable` until a later operation fetches the checkout. The sweep remains detection-only, the recorded landing identity remains its anchor, and the two honest repairs are deferred to their own decision.
3. **`merge` refuses on a provider without the landing.** GitHub supports the operation; GitLab and Jira declare gaps, so the lifecycle merge is unavailable there until the adapter lands it. This is capability honesty, not a regression, and a local fallback is prohibited.
4. **GH-349 does not close M4.** This change's own closeout withholds milestone closure because M4 carries other open tickets; the verified outcome is the attachment check plus a recorded exit-review verdict. The first milestone that closes through this step will be the milestone whose last attached ticket closes.
5. **One row stays declared and unreachable.** `merge.rebase-conflict` keeps its identity, projection, and remediation while no delivered path emits it; its removal or re-purposing is a recorded revisit trigger, never an undocumented delete.
6. **PDR-0005's scope reading is an owner act.** The interpretation that makes the closure half lawful is stated openly in the milestone decision; if the owner reads the constraint globally, the write half is withdrawn and the step becomes verification plus a withheld-closure residue item without touching any other part of this change.
7. **Queue integrity proves properties, not new behaviour.** Where a property holds, the change adds proof and nothing else; a "repair" that changes an observable the property does not name is out of scope and returns for a specification revision.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-18 | @spec-writer | Initial specification for GH-349, grounded in the M4 blueprint (F4 row, verification bar, §M4-S11, ranking), the GH-349 planning notes (clarify-scope facts, five-item gap analysis, PM positions, doc-impact risks), the current-truth merge/closeout/phase/scheduling/result-contract/adapter pages, the delivered merge, closeout, phase, lint, queue, adapter, and conformance surfaces as read on 2026-11-18, and the three binding decision records ADR-0012, TDR-0040, and ODR-0005 cited as DEC-1…DEC-5. Completes the additive surface inventory (149→152 identities for the three added rows, 9→10 operations, 12→13 steps, 8→9 residue kinds, 5→6 pm-notes lint rows, 27→30 parity cells), carries the GH-339 specification's 25-section shape with unique per-capability acceptance ids, and adds five appendices (documentation impacts, ticket traceability, binding non-widening invariants, additive inventory with counts, conformance/parity ripple) plus a defect register and a declared-boundaries appendix. |

---

## AUTHORING GUIDELINES

- **Sources.** The GH-349 ticket body (M4-S11) and the M4 blueprint (`flip-plan.md` F4 and its verification bar, `backlog.md` §M4-S11, `ranking.md`); the GH-349 planning notes (clarify-scope facts, gap analysis, positions on the phase truth source, the landing mechanism, milestone sync, queue scope, and defect regressions); the three binding decision records; the current-truth feature pages for merge/verify-deploy, closeout, pm-notes lint and phase transitions, verify change, the scheduling engine, the result contract, adapter ports, adapter reference behavior, and adapter conformance; the milestone operating rule and its product decision; and the delivered source as read on 2026-11-18. No behavior is invented; every numeric count in Appendix D was read from the delivered declarations, and every absence claim names its scan scope.
- **Approach.** The specification is organized around outcomes: capabilities state behavior and rationale, interfaces state contracts, acceptance criteria are mechanically checkable and non-overlapping, and every ticket clause is traced to AC ids and to the class of test that proves it. Where a binding decision leaves a boundary (behind-detection, the diff anchor, the reserved row, the owner's reading of the milestone constraint, GH-349's own withholding), the boundary is stated in the body, in Appendix G, and in the risks rather than smoothed over.
- **Constraints applied.** Additive-within-v1 contract evolution; one landing mechanism with no force and no retry; capability honesty with declared gaps; documented and machine-declared error rows moving together with no pattern widening; a closed operation set that appends and is never reordered; read-only detection that never repairs; offline determinism with network and child-process containment; a runtime-neutral testkit; the pinned CI topology; and exact synchronization of every pinned count.
- **Deliberate omissions.** No code-level tasks, no step-by-step implementation instructions, no commit or branch instructions, and no technology tuning beyond what the declared outcomes require. Details a decision leaves to fixtures or implementation are named as such rather than decided here.

## VALIDATION CHECKLIST

- [x] `change.ref` matches the provided work item ref (`GH-349`)
- [x] `owners` has at least one entry (`engineering`)
- [x] `status` is `Proposed`
- [x] `change.milestone` is the tracker milestone title verbatim and equals the planning-notes milestone (`M4: Jaiship-native delivery`)
- [x] All sections present in order (1–25, then authoring guidelines and this checklist)
- [x] ID prefixes consistent and unique (`F-`, `API-`, `DM-`, `NFR-`, `AC-`, `RSK-`, `DEC-`, `OQ-`)
- [x] Every acceptance criterion references at least one `F-`/`API-`/`DM-`/`NFR-` id and uses Given/When/Then
- [x] Every ticket acceptance clause is covered by at least one unique AC (Appendix B)
- [x] NFRs carry measurable thresholds
- [x] Risks carry impact, probability, mitigation, and residual risk
- [x] Out-of-scope items are prefixed `[OUT]`
- [x] No implementation detail (no code-level tasks, file paths, or step-by-step instructions)
- [x] The additive surface inventory is complete and internally consistent, with counts before→after (Appendix D)
- [x] The conformance and parity ripple is enumerated atomically (Appendix E)
- [x] Documented and machine-declared error rows move together, with no pattern widening and no removed row
- [x] The three named defects each carry a repair, a defect-named regression, and a failing control (Appendix F)
- [x] Non-widening invariants are recorded and binding on the plan (Appendix C)
- [x] Documentation impacts and the distribution-marker obligation are named for the documentation phase (Appendix A)
- [x] No decision is re-litigated; every routed question cites its record or is genuinely open (Section 14, Section 15)
- [x] No milestone is claimed to be closed by this change; the withholding is stated and made an acceptance criterion
