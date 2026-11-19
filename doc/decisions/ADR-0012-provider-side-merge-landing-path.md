---
id: ADR-0012
decision_type: adr
status: Proposed
created: 2026-11-18
decision_date: null
last_updated: 2026-11-18
summary: "The lifecycle `merge` command lands through the closed `merge-delivery-request` adapter operation — one mechanism, exact-head-SHA guarded, crafted squash title/message, provider-asserted merged truth as the only landing verdict — while the local-git squash transaction and its single rebase-refresh leave the landing path (retained as declared git-seam capabilities with no composed caller); DIRTY/BEHIND become one typed `merge.sync-required` outcome instead of an internal rebase loop, provider-asserted mergeability `unknown` is recovered by one exact-head re-read and then `merge.mergeability-unknown`, and queued/running checks are not green in both the declared gate evaluation and the post-verification probe."
owners:
  - "Juliusz Ćwiąkalski"
service: "delivery-os merge primitive, core merge transaction, and provider adapter contracts"
decision_scope: repo
review_date: null
business_impact: "The flip's F4 bar ('merge lands with crafted metadata without a platform CLI') becomes reachable: today the lifecycle merge path never publishes a landing, so merge truth, closeout's merged-request resolution, and the merged-diff anchor all rest on a locally synthesized state."
customer_impact: "An operator gets a squash commit whose subject and message are the reviewed request's, a typed answer for every refusal (out-of-date, checks, provider still computing, landing unverified) instead of a generic abort, and no silent force or bypass."
classification:
  domains: [architecture, contracts, tooling, operations]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: moderate
  stakes: high
  urgency: medium
  uncertainty: medium
  blast_radius: team
  recurrence: recurring
governance:
  driver: "@decision-advisor (GH-349: @pm routed the merge-reconciliation question — deferred by feature-merge-verify-deploy and by TDR-0033 — to a record during clarify_scope)"
  decider: "Juliusz Ćwiąkalski — human acceptance at the GH-349 PR review; AI does not accept this R2 record"
  contributors:
    - "@pm (GH-349 clarify_scope: the five-item gap analysis and the landing-mechanism position)"
    - "@decision-advisor (repository analysis and this record)"
    - "@spec-writer (carry the removed/added identities, the refusal table, and the metadata derivation into the GH-349 change spec)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "Human owner (GH-349 PR review — this record rewires the only composed landing path)"
  performers:
    - "@coder (GH-349 delivery: transaction ports, adapter operation composition, refusal classification, error rows, regression suites)"
    - "@doc-syncer (merge-verify-deploy, result-contract, adapter-reference-behavior reconciliation)"
  informed:
    - "The coordinator and `@pm` prompts that call `merge` — the refusal vocabulary they branch on changes"
    - "Closeout's merged-diff sweep — its anchor is now a provider-side merge commit"
    - "M3-S3 GitLab adapter (GH-337) — `merge-delivery-request` remains its declared gap, so `merge` refuses there"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: false
  human_decider: null
  reviewers: []
revisit_triggers:
  - "A repository needs `merge` to work where the adapter declares `merge-delivery-request` a gap (GitLab, or a tracker-only provider): decide an explicit operator-visible path — the current answer is a classified refusal naming the gap, and a silent local fallback is prohibited."
  - "Serial-merge churn (F8) stays expensive after the typed sync-required outcome: adopt a coordinator-owned 'update branch from base then push without force, then re-verify' action as its own decision — never inside `merge`, which would recreate the unbounded loop this record removes."
  - "The retained `squashLand`/`refresh` git-seam capabilities acquire no consumer by the end of M5: delete them, or re-purpose `refresh` for the coordinator sync action named above."
  - "GitHub exposes a provider-asserted required-check posture per request (rather than a collapsed `blocked`/`unstable` token): replace the post-refusal re-read classification with that signal instead of adding prose matching."
  - "The normalized delivery-request view gains a provider-asserted mergeability detail that separates an out-of-date head from another protection rule: restore a decisive `behind` reason value through its own additive decision; until then `behind-unconfirmed` is the only non-`dirty` reason and prose matching is prohibited as a substitute."
  - "Closeout's merged-diff sweep proves materially lossy because the squash object is not in the operator's checkout: add a bounded provider-side diff read or a declared fetch, as its own decision; do not put a fetch inside `merge`."
links:
  related_changes: ["GH-349"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/changes/2026-11/2026-11-18--GH-349--merge-closeout-queue-repair/chg-GH-349-pm-notes.yaml"
    - "doc/spec/features/feature-merge-verify-deploy.md"
    - "doc/spec/features/feature-result-contract.md"
    - "doc/spec/features/feature-adapter-reference-behavior.md"
    - "doc/spec/features/feature-closeout.md"
    - "doc/planning/oss-tooling/milestones/m4/flip-plan.md"
    - "doc/planning/oss-tooling/milestones/m4/backlog.md"
  contracts:
    - "packages/core/src/contracts/ports.ts"
    - "packages/core/src/contracts/adapter-capabilities.ts"
    - "packages/core/src/contracts/error-table.ts"
    - "packages/core/src/domain/merge-transaction.ts"
    - "packages/adapters/src/git/merge.ts"
  diagrams: []
  decisions: ["TDR-0033", "TDR-0031", "TDR-0032", "TDR-0005", "ADR-0005", "TDR-0036"]
  experiments: []
  metrics: []
  roadmap_items: ["M4-S11", "GH-349"]
---

# ADR-0012: Provider-Side Landing Is the Lifecycle Merge Path — One Mechanism, Exact-Head Guards, and Typed Sync-Required Outcomes

## Context

Two landing mechanisms coexist by design. The lifecycle `merge` command runs a verified local-git
squash transaction (`packages/core/src/domain/merge-transaction.ts`, read 2026-11-18) and the adapter
layer declares a provider-side landing, the closed `merge-delivery-request` operation with a squash
strategy, optional crafted commit title/message, and an optional expected head
(`packages/core/src/contracts/adapter-capabilities.ts:24-34`, `packages/core/src/contracts/ports.ts:253-284`).
The merge specification states the coexistence explicitly and defers reconciliation to "a separate
decision" (`doc/spec/features/feature-merge-verify-deploy.md:61-72`); TDR-0033 records the same
non-decision as a revisit trigger. GH-349 is that decision's home.

The decisive situational fact is not a preference between two styles. The local path cannot publish a
landing at all: `squashLand` performs `checkout`, `merge --squash`, and `commit` only, the seam
declares "no network, no remotes", no push exists anywhere on the merge path, and the seam returns
`requestState: "merged"` as a **string literal**
(`packages/adapters/src/git/merge.ts:1-8,182-209`; composition at `packages/cli/src/edge.ts:1509-1516`).
The transaction then treats that literal as provider truth
(`packages/core/src/domain/merge-transaction.ts:750`). A "verified landing" therefore means "a local
commit exists on the local base branch and the seam said merged". The delivery request is never
merged on the provider, so closeout's merge truth (`merged_at`), its review-thread resolution, and
the recorded squash anchor it hands to the merged-diff sweep all read a request that no landing ever
touched (`doc/spec/features/feature-closeout.md:275-279,142-157`).

Three further facts shape the refusal surface. First, the normalized mergeability has four values and
collapses `blocked`, `behind`, `unstable`, and `draft` into `not-mergeable`
(`packages/adapters/src/github/normalize.ts:140-153`), while the transaction refreshes only on
`conflicting` and otherwise proceeds to land
(`packages/core/src/domain/merge-transaction.ts:699-735`). Second, the single rebase-refresh is
local-only and never pushed (`packages/adapters/src/git/merge.ts:156-180`), so it cannot change what
the provider will accept; its only observable effect is that the head moves and the SHA-bound
verification is voided — the serial-merge churn GH-349 names as F8. Third, the post-verification
probe detects only *newly failing* jobs (`packages/core/src/domain/merge-probe.ts:103-116`), while a
required check that re-enters `queued`/`running` on the verified head is already not-green in the
gate evaluation (`packages/core/src/domain/merge-probe.ts:126-198`, bucketing at
`packages/core/src/domain/ci-result.ts:14`) and invisible to the probe.

## Problem Framing (Clarified)

The decision question is: **which mechanism may make the lifecycle landing, and what exactly does the
command promise when it refuses?** Two symptoms hide one root cause.

- **Root cause.** The recorded landing outcome is produced by the mechanism rather than observed from
  the system of record. The local path has no way to observe a landing, so it asserts one; that single
  inversion produces every downstream symptom (a `merged` report with no merged request, a squash SHA
  that exists only in one checkout, closeout anchoring on an object the provider never created).
- **Symptom A — conflated refusals.** "Cannot merge because the branch conflicts", "cannot merge
  because required checks or reviews are not satisfied", and "cannot tell yet" all reach the operator
  as `merge.transaction-aborted` with an opaque detail, and BEHIND is not even consulted.
- **Symptom B — the churn loop.** An internal rebase that cannot affect the provider still changes the
  head, voids verification, and forces another verify-and-retry cycle per serial merge.

The problem is therefore not "modernize the merge path". It is: **bind the landing to a mechanism that
can observe its own effect, and give each refusal cause one honest, actionable identity.**

## Constraints (Hard Requirements)

### C-1: The landing path composes no platform CLI

- **Statement:** No `gh`/`glab`/platform merge subcommand is composed on any landing path; the
  landing rides the injected provider transport.
- **Source:** AC (GH-349, flip-plan F4 verification bar `doc/planning/oss-tooling/milestones/m4/flip-plan.md:118`); prior decision TDR-0032.
- **Verification:** test (production-source scan with a mandatory failing control) + code review.
- **Negotiable:** no.

### C-2: Exactly one mechanism is the command's landing path

- **Statement:** `merge` composes exactly one landing mechanism; no second landing path is reachable
  from the command by flag, configuration, or fallback.
- **Source:** AC (GH-349 "no `gh pr merge` … one path") + PM position (GH-349 pm-notes, decision 3).
- **Verification:** code review of the composition + test asserting a single landing call site.
- **Negotiable:** no.

### C-3: No force, bypass, auto-merge, merge queue, or landing retry

- **Statement:** The landing union gains no force/bypass/auto-merge/queue variant and no landing is
  re-issued after a failure.
- **Source:** internal standard (declared mutation union; `merge-transaction.ts:1-11`); prior decision TDR-0033 §1 ("at most once per invocation and never retried").
- **Verification:** test (union inventory + no-force scan) + code review.
- **Negotiable:** no.

### C-4: A landing is verified by provider-asserted merged truth only

- **Statement:** `result=merged` requires the provider to assert the request merged; no locally
  synthesized state, containment read, or derived value may stand in for it.
- **Source:** internal standard (truthful absence/attribution; ADR-0004 absence rule).
- **Verification:** test (a fixture whose local containment is true and whose provider state is not
  merged refuses) + code review.
- **Negotiable:** no.

### C-5: The landing is bound to the verified head

- **Statement:** The landing carries the exact head SHA the freshness envelope verified; a moved head
  refuses before any landing call.
- **Source:** AC (GH-349 exact-head recovery) + internal standard (`feature-merge-verify-deploy.md:133-138`).
- **Verification:** test (head-moved refusal with zero landing calls).
- **Negotiable:** no.

### C-6: Additive within contract v1

- **Statement:** No delivered field is removed, narrowed, or made required; a delivered value domain may
  widen only additively, so an existing value keeps its meaning and stays valid; new contract surface is
  optional; no schema-version bump or persisted-state migration. This is the discipline
  `landing.shaOnBase` follows when it gains `"unknown"` (§3).
- **Source:** prior decisions ADR-0004, ADR-0006, TDR-0008 C-1, TDR-0033 C-1.
- **Verification:** typecheck + contract-inventory probe + a legacy-record round-trip (an existing
  boolean `shaOnBase` record still reads as before).
- **Negotiable:** no.

### C-7: Error identities are documented and machine-declared together, with no pattern widening

- **Statement:** Every new refusal identity is one concrete row in both the machine table and the
  documented table, reachable from a named branch; the open-slot family is unchanged.
- **Source:** internal standard (`feature-result-contract.md` binding rule; `feature-merge-verify-deploy.md:242-253`).
- **Verification:** test (bidirectional table sync + per-row reachability) + code review.
- **Negotiable:** no.

### C-8: The recorded transaction stays closeout's merged-evidence anchor

- **Statement:** A landed merge still records `merge.transaction` with the landing commit SHA that
  closeout's merged-diff sweep reads.
- **Source:** prior decision (closeout contract, `feature-closeout.md:142-157,210`).
- **Verification:** test (transaction record carries the provider-asserted merge commit SHA).
- **Negotiable:** no.

## Decision Drivers

1. **D-1 Truthfulness of the recorded outcome (highest).** The record must say what the provider did.
2. **D-2 Legibility of the landed commit.** The squash subject/message are the reviewer-visible
   artefact; they must be the reviewed thing, not an internal synthesis.
3. **D-3 Replay safety.** A re-run after an unknown or partial landing converges without a second
   mutation.
4. **D-4 Bounded cost and no waiting.** One bounded probe, at most one landing call, at most one
   recovery read; no sleep, no poll loop, no unbounded retry.
5. **D-5 Actionable refusal taxonomy.** The operator can tell "sync the branch" from "checks are not
   green" from "the provider has not decided".
6. **D-6 Minimal new surface on the paved road.** Prefer the declared operation and additive optional
   fields over new operations, flags, or provider-specific dialects.
7. **D-7 Determinism without operator craft.** The coordinator must not hand-author commit metadata.

Priority order: **D-1 > D-2 > D-3 > D-5 > D-4 > D-6 > D-7.** D-1 and D-6 conflict at one point — the
truthful path needs the review-visible title, which the normalized request does not carry today — and
D-1 wins with the smallest possible additive field.

*(Overlap check: boundedness, no-retry, and additivity are gates (C-3, C-6) and appear here only as the
ranking value "how much truth per unit of surface". The gate decides eligibility; the driver ranks
survivors.)*

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` (GH-349 clarify_scope routed the reconciliation here).
- **Decider / Approver:** Juliusz Ćwiąkalski — human acceptance at the GH-349 PR review. AI does not
  accept this R2 record.
- **Contributors:** `@pm` (gap analysis, position, F8 evidence); `@decision-advisor` (analysis and
  record); `@spec-writer` (carry the refusal table into the change spec).
- **Required reviewers:** `@readiness-reviewer`, `@reviewer`, and the owner for final acceptance.
- **Performers:** `@coder` (transaction ports, composition, classification, rows, regressions);
  `@doc-syncer` (merge-verify-deploy, result-contract, adapter-reference-behavior).
- **Informed:** the coordinator/`@pm` call sites; closeout's sweep; the GitLab and Jira adapter owners.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| The local landing never pushes and reports `requestState: "merged"` as a literal | FACT | `packages/adapters/src/git/merge.ts:1-8,182-209`; `packages/core/src/domain/merge-transaction.ts:750` (read 2026-11-18) | The strongest argument for switching would weaken to a preference; the AC would still force a mechanism that can express crafted metadata | High |
| No push exists on any merge composition path | FACT | repository scan for `push` over `core/domain/merge-transaction.ts`, `adapters/src/git/merge.ts`, `cli/src/edge.ts` (read 2026-11-18) | As above | High |
| The adapter landing is reachable only by a direct caller today (conformance/testkit), never by a lifecycle path | FACT | `feature-merge-verify-deploy.md:260-264`; `packages/testkit/src/conformance/adapters.ts:81-88` | A second composed caller would already have made the local path a fallback | High |
| The local landing synthesizes its squash subject: `merge(<ref>): squash <branch>` | FACT | `packages/cli/src/edge.ts:1515` | The crafted-metadata gap would be smaller | High |
| Mergeability collapses `blocked`/`behind`/`unstable`/`draft` into `not-mergeable`, and the transaction ignores `not-mergeable` | FACT | `packages/adapters/src/github/normalize.ts:140-153`; `packages/core/src/domain/merge-transaction.ts:699-735` | A pre-flight sync decision would be simpler, without the post-refusal classification | High |
| The single refresh is local-only (checkout + rebase, no push) | FACT | `packages/adapters/src/git/merge.ts:156-180` | A refresh could still affect the request, and sync-required would be optional | High |
| Queued/running checks are already not-green in the gate evaluation and the required-job recipe | FACT | `packages/core/src/domain/ci-result.ts:14`; `packages/core/src/domain/merge-probe.ts:126-198` | A new gate dimension would be needed rather than a probe extension | High |
| The probe detects only newly failing jobs, so a re-queued required check is invisible post-verification | FACT | `packages/core/src/domain/merge-probe.ts:103-116` | The probe gap would not exist | High |
| The normalized `DeliveryRequest` carries no title | FACT | `packages/core/src/contracts/ports.ts:165-192` | The crafted title would need a different source (work-item title), which is ticket-shaped | High |
| The merge error kind carries exactly seven concrete rows today | FACT | `packages/core/src/contracts/error-table.ts:880-955`; `feature-result-contract.md` merge-kind declaration | The additive budget would be larger or smaller | High |
| Closeout's merged-diff sweep reads `git diff <squash>^ <squash>` locally | FACT | `feature-closeout.md:142-157`; `packages/adapters/src/git/index.ts` diff reader | A provider landing would not change the sweep's prerequisites | High |
| GitHub's `PUT /pulls/{n}/merge` accepts `merge_method`, `commit_title`, `commit_message`, and an expected-head `sha` | ASSUMPTION (documented REST surface; already proven by the GH-338 fixture) | TDR-0033 evidence row | Crafted metadata or the head guard would degrade to a declared limitation | High |
| No normalized delivery-request signal separates an out-of-date head from another protection rule, so a decisive out-of-date reason is not representable | FACT | `packages/adapters/src/github/normalize.ts:138-152` (only `mergeable_state` is normalized; `blocked`, `behind`, `unstable`, and `draft` all collapse to `not-mergeable`); `packages/core/src/contracts/ports.ts:165-192` (no second mergeability signal) (read 2026-11-18) | A decisive `behind` reason would be reachable and the two-value vocabulary would be under-specified | High |
| A guard rejection surfaces as a non-2xx refusal, never as a silent success | TO-CONFIRM | provider behaviour | The adapter's read-back rule keeps the outcome safe either way | Medium-High |
| A `blocked` request cannot be further decomposed client-side into "required checks pending" versus "required review missing" | TO-CONFIRM | provider surface (no decomposed signal in the delivered normalization) | A finer identity would be possible now rather than later | Medium |

## Mental Models & Techniques Used

- **Inversion.** "What would make this decision wrong?" It is wrong if the provider landing cannot be
  guarded (race with a push), if it cannot be verified (unknown landing), or if it cannot refuse
  honestly. The exact-head guard, read-back verification, and refusal re-read answer the three.
- **Second-order thinking.** Removing the internal rebase does not only stop churn: it also removes the
  only client-side action that could change the request's mergeability, which is why the honest output
  is a sync instruction rather than a retry loop.
- **Systems thinking.** The landing is a join across four surfaces — verification, provider request
  state, the recorded transaction, and closeout's diff anchor. The decision keeps all four on one
  provenance (provider truth) instead of three local facts plus one claim.
- **First principles.** A landing is safe when it is (a) guarded to a known head, (b) at most once,
  (c) verified from the system of record, (d) replayable. All four are properties of the mechanism,
  not of the caller.
- **Opportunity cost.** Each retained mechanism costs a second verification story, a second failure
  taxonomy, and a permanent ambiguity in the record. One mechanism costs the loss of an offline landing
  capability that has never published anything.
- **KISS / paved road.** The chosen path reuses the declared operation, the additive-optional-field
  precedent, and the delivered classify-by-declared-identity discipline.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

|          | C-1 | C-2 | C-3 | C-4 | C-5 | C-6 | C-7 | C-8 |
|----------|-----|-----|-----|-----|-----|-----|-----|-----|
| ALT-0 keep both, no change | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ |
| ALT-1 adapter operation as the landing path (chosen) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-2 fix the local path (push the squash to the base) | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ |
| ALT-3 local rebase + force-push, then land | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ |
| ALT-4 both mechanisms, selectable by flag/config | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-5 adapter operation with a silent local fallback on a gap | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

Legend: ✅ passes · ❌ fails · ⚠️ passes only via an accepted-risk exception (none taken).

### Alternative 0 — Keep Both Mechanisms as Delivered (baseline)

- **Eligibility:** Not eligible (fails C-4, C-5, C-8).
- **Summary:** Keep the local squash transaction as the composed landing path and leave
  `merge-delivery-request` as an adapter capability with no lifecycle caller.
- **Constraint compliance:** C-4 fails because the "verified landing" is a local containment read plus
  a literal provider state; C-8 fails because the recorded squash SHA and the request's real state
  describe different systems; C-5 is unimplementable on this path because there is nothing to guard —
  the landing is a local commit.
- **Driver fit:** Best on D-6 (no change) and worst on D-1, D-2, D-5, D-7.
- **Pros:** Zero work; no migration; the local path needs no credentials.
- **Cons:** The F4 bar is unreachable; every `merged` report is an assertion the provider never made;
  closeout's anchor is an object the provider did not create.
- **Why rejected:** It fails the truthfulness driver at its root, and GH-349's AC cannot be satisfied
  without a mechanism that observes a provider landing.

### Alternative 1 — The Adapter Operation Is the Landing Path (chosen)

- **Eligibility:** Eligible.
- **Summary:** `merge` composes `merge-delivery-request` with the verified head as `expectedHeadSha`,
  a crafted title/message, and a provider-asserted read-back; the local squash and its refresh leave
  the landing path; refusals are classified into sync-required, check-posture, and
  mergeability-unknown outcomes.
- **Constraint compliance:** Passes all of C-1…C-8 (matrix row).
- **Driver fit:** Best on D-1, D-2, D-3, D-5; acceptable on D-4 (one extra recovery read at most) and
  D-6 (one additive optional field, two additive rows).
- **Pros:** The record finally describes the system of record; the squash commit carries the reviewed
  title; the head guard closes the racing-push hole; convergence is a read, not a re-land.
- **Cons:** `merge` now requires a provider landing capability (GitLab refuses until it lands); the
  local base is no longer advanced by the command, so closeout's diff object waits for a fetch; one
  unreachable row (`merge.rebase-conflict`) is retained rather than removed.
- **Why chosen:** It is the only eligible alternative in which the recorded outcome is observable, and
  it is the only one that can express crafted CR-visible metadata at all.

### Alternative 2 — Fix the Local Path: Push the Squash to the Base

- **Eligibility:** Not eligible (fails C-4 and C-8).
- **Summary:** Add a push of the locally created squash commit to the base branch, keeping local git as
  the landing mechanism.
- **Constraint compliance:** C-4 fails: pushing a commit to the base branch does not merge the delivery
  request, so the provider still reports an open request and closeout still reads no merge truth. C-8
  fails for the same reason. It would also bypass review: a direct base push is exactly the mutation
  the delivery request exists to gate.
- **Driver fit:** Good on D-1 for the *commit*, poor on D-1 for the *request*, poor on D-5 and D-7.
- **Pros:** No adapter dependency; works without provider merge API support.
- **Cons:** Bypasses the reviewed request entirely; needs credentials in the git seam, which is declared
  remote-free; leaves the PR open, so the lifecycle's closeout contract breaks differently.
- **Why rejected:** It moves the landing further from the system of record rather than toward it.

### Alternative 3 — Local Rebase Plus Force-Push, Then Land

- **Eligibility:** Not eligible (fails C-3 and C-5).
- **Summary:** Keep the local refresh, add a force-push so the provider sees the rebased head, then land.
- **Constraint compliance:** C-3 fails (force is not representable and must not become representable);
  C-5 fails because the refresh deliberately changes the head after verification, so the landing would
  no longer be bound to verified evidence.
- **Driver fit:** Attractive on D-5 (the tool "solves" BEHIND) and catastrophic on D-1 and D-3.
- **Pros:** Removes the operator's manual sync.
- **Cons:** Rewrites published history; voids verification on every serial merge; the exact churn loop
  F8 names.
- **Why rejected:** C-3 is disqualifying, and the churn it produces is the defect, not the fix.

### Alternative 4 — Keep Both, Selectable by Flag or Configuration

- **Eligibility:** Not eligible (fails C-2).
- **Summary:** Compose the adapter landing when credentials exist and the local path otherwise, or let
  configuration choose.
- **Constraint compliance:** C-2 fails by definition; the record would still have two landing semantics
  and two verification stories, so C-4's guarantee would hold only on one branch.
- **Driver fit:** Superficially eases migration (D-6), destroys D-1's guarantee.
- **Pros:** Nothing to decide at rollout; every environment keeps working.
- **Cons:** The refusal taxonomy doubles; a green `merge` says nothing about which mechanism ran; the
  spec's "one path" statement becomes false.
- **Why rejected:** It is the one alternative that makes the record permanently ambiguous.

### Alternative 5 — Adapter Landing With a Silent Local Fallback on a Declared Gap

- **Eligibility:** Not eligible (fails C-2).
- **Summary:** Land provider-side; when the adapter declares `merge-delivery-request` a gap, land
  locally instead of refusing.
- **Constraint compliance:** C-2 fails (a second reachable landing path), and the gap stops being a
  declared capability fact — the exact dishonesty TDR-0033's capability-honesty constraint forbids.
- **Driver fit:** Good on D-6, unacceptable on D-1.
- **Pros:** GitLab and tracker-only projects keep a working `merge`.
- **Cons:** A gap silently changes semantics; the operator cannot tell which mechanism produced a merge.
- **Why rejected:** Capability declarations exist so a caller never has to guess; a fallback makes the
  declaration unreadable.

## Decision

- **Decision:** Adopt **Alternative 1**. Alt-1 is not only the recommended option; it is the only one that can satisfy GH-349.

### 1. One landing path

`merge` composes `merge-delivery-request` through the transaction's ports. The transaction's `land`
port is replaced by one guarded landing call carrying
`{ deliveryRequest, strategy: "squash", commitTitle, commitMessage, expectedHeadSha }` and returning
`{ merged: true, mergeCommitSha? }`. The call is issued at most once per invocation and is never
re-issued after a failure.

### 2. Crafted, deterministic squash metadata

- `commitTitle` is the delivery request's **provider-asserted title verbatim**. To make that possible
  additively, `DeliveryRequest` gains one optional field, `title?: string` (absent = unknown, never
  derived). When the provider omits it, the title falls back to the delivered deterministic subject
  `merge(<ref>): squash <sourceRef>` — the change ref, then the request's source ref, the exact shape
  the local landing path synthesized at `packages/cli/src/edge.ts:1515` — so a provider that omits a
  title never loses a landing.
- `commitMessage` is one fixed verbatim line, byte-identical for every landing and composed in core
  with no interpolated value: `Landed by the delivery lifecycle merge primitive.` No flag, no
  free-form input, no request body, no change-ref or request-identity interpolation, and no provider
  prose.

### 3. The landing verdict is provider truth

`result=merged` requires a read-back in which the provider asserts the request merged. The provider's
merge commit SHA is the recorded `squashSha`; absent means unknown, which is `merge.landing-unverified`,
never a derived value. Local containment is no longer landing evidence — the command does not advance
the local base at all. A re-run over an already-merged request replays `merged` with the recorded SHA
and performs no second landing call.

The recorded transaction keeps its delivered shape, and its `landing.shaOnBase` keeps a narrowed,
truthful meaning: it reports containment of the provider-asserted merge commit on the base **only when a
local containment read answers for that identity**, and `unknown` otherwise — the ordinary case after a
provider landing, because the squash object is not in the checkout and the command performs no fetch. Its
value domain therefore widens from `boolean` to `boolean | "unknown"`; the human line renders the third
state; existing records carrying a boolean stay valid and are read as before; and the state-layer
validation of the recorded landing must accept exactly `boolean | "unknown"`, with the recorded value
round-tripped through the delivered reader rather than only type-widened. `shaOnBase` is never landing
evidence and is never a substitute for the provider-truth verdict.

### 4. Exact-head guard and head drift

`expectedHeadSha` is the head SHA the freshness envelope verified. A head that moved between
verification and the landing call refuses `merge.gates-stale` before any landing. A guard rejection at
the provider is a classified refusal, never retried and never overridden.

### 5. Refusal semantics — one cause, one identity

| Observed condition | Outcome |
|---|---|
| `mergeableState: "mergeable"` | Proceed to the guarded landing. |
| `mergeableState: "conflicting"` (dirty) | `merge.sync-required` with reason `dirty`; no rebase, no force, no landing call. |
| `mergeableState: "not-mergeable"` | Attempt the guarded landing — the provider is the authority on whether its protection rule blocks a behind, unstable, or blocked request — then classify a single refusal with one bounded post-refusal re-read of the same request: a checks posture yields the effective gate set's row (`merge.gate.ci-green.failed` with the delivered `ci-pending`/`ci-failed` reason); otherwise the outcome is `merge.sync-required` with reason `behind-unconfirmed`, naming the observed provider state. The re-read cannot do better: the normalized view collapses an out-of-date head and every other protection rule into the same `not-mergeable` value (see the evidence row on the missing signal), so no branch here resolves a decisive out-of-date condition. No refusal is retried and none is classified as a clean pre-mutation abort. |
| `mergeableState` absent or `"unknown"` | Exactly one bounded re-read of the same request, compared on the exact head SHA. Recovered → the row above. Head changed → `merge.gates-stale`. Still unknown → `merge.mergeability-unknown`. |
| Landing fired, provider truth not observed | `merge.landing-unverified` (exit 2, consequence `unknown`); a re-run re-verifies, never re-lands. |
| The adapter declares `merge-delivery-request` a gap | `merge.transaction-aborted` at exit 1 with evidence naming the operation and its declared `CapabilityGapReason`; zero landing attempts, zero local squash, zero fallback, and no added identity — the concrete `merge` rows stay at nine. |

Two additive `merge` rows carry the new causes, taking the concrete `merge` rows from seven to nine:
`merge.sync-required` (user, non-retryable, `not_landed`, exit 1) and `merge.mergeability-unknown`
(platform, retryable, `not_landed`, exit 2, remediation = retry after the provider finishes computing;
the command never waits). `merge.sync-required` carries a closed `reason` vocabulary of exactly two
values — `dirty` (the normalized mergeability is `conflicting`, refused before any landing call) and
`behind-unconfirmed` (the request is not mergeable, or was unresolved, and the provider refused the
guarded landing while the post-refusal re-read cannot separate an out-of-date head from another
protection rule). There is no `behind` value and no decisive out-of-date branch: the normalized view
collapses that distinction, so a third value would be a declared outcome nobody can produce. The
`behind-unconfirmed` remediation instructs the operator to update the delivery branch onto the base and
re-verify, with the explicit caveat that a refusal persisting after the sync means the protection rule
is the cause. No third reason exists and no value outside the vocabulary is representable; the
provider-asserted signal that would make a decisive distinction lawful stays a revisit trigger.
`merge.transaction-aborted` does not carry the sync remediation and is not used for this condition; it
carries the declared landing gap (above) and nothing else here. Both additive rows are documented and
machine-declared together; the `merge.gate.<gate-id>.failed` family is unchanged, and the gap refusal
adds no identity.

### 6. No internal refresh; F8 is removed, not automated

The single rebase-refresh leaves the landing path. A local-only rebase cannot change what the provider
accepts, and the only way it could — a force-push — is not representable (C-3). BEHIND therefore
resolves as a sync instruction to the coordinator, not as an internal loop: each landing attempt does
one bounded probe, at most one landing call, and at most one recovery read, and never mutates the head.
The delivered `merge.rebase-conflict` row is **retained and reserved** (no removal, no re-meaning): no
delivered path emits it in v1, and the revisit trigger above names the coordinator sync action that
would re-reach it. The golden scenarios that asserted the removed refresh are retired with the
mechanism — a test-artifact retirement, not a row removal — so the delivered golden set keeps only the
scenarios a delivered path can still produce.

### 7. Required-check awareness, including queued checks

- Client-side gate truth already treats `queued`/`running` as not-green; the decision pins that as a
  contract test rather than leaving it implicit in two implementations.
- The post-verification probe is extended from "newly failing" to "newly not-green for a declared
  required job" — `queued`, `running`, `canceled`, `skipped`, and `failed` on the verified head are all
  gate evidence, classified through the delivered reasons (`ci-pending`, `ci-canceled`,
  `ci-all-skipped`, `ci-failed`) on the existing `merge.gate.<id>.failed` family. A non-declared job
  stays non-evidence.
- Each not-green finding names its evidence source instead of relying on a "newness" comparison: the
  refusal evidence gains exactly one additive optional bounded field, `attribution`, whose closed
  vocabulary is `recorded` | `probe`. `recorded` means the recorded gate verdict already reported that
  job not green, and the evidence carries the gate's effective id, the job, and the verdict — the three
  facts that identify the persisted `merge.gate-verification` record. The verification timestamp is
  **not** an evidence field and is never duplicated onto the refusal: it stays on the persisted
  verification record the gate id plus job resolves to. `probe` means the recorded verdict was green and
  the probe observed the job not green. It is additive evidence, not a row, kind, exit class, or bound;
  the byte-pinned required-job refusal goldens move because the summary renders the attribution.
- Provider-required checks are the provider's authority: its refusal is classified, never retried and
  never bypassed. The tool adds no second required-check evaluator and no prose matching.

### 8. Disposition of the other mechanism

The local squash and the local refresh remain **declared, tested git-seam capabilities with no composed
caller**: `squashLand` and `refresh` stay in `@delivery-os/adapters/git`, and a production-source scan
asserts no composition path calls either for a landing or a sync. They are not a second landing
mechanism because no reachable path can invoke them; the revisit trigger retires them if no consumer
appears by the end of M5.

### 9. Documented consequence — closeout's diff anchor

A provider landing does not put the squash commit in the operator's checkout, and `merge` performs no
fetch (the git seam stays remote-free). Closeout's merged-diff sweep therefore finds its anchor object
only after the checkout is fetched by a later operation; until then the step degrades to the delivered
`skipped-gap` with `merged-diff-unavailable` evidence. This is a real capability reduction in a
detection-only step, recorded here rather than papered over; the revisit trigger names the two honest
repairs (a bounded provider diff read, or a declared fetch).

- **Rationale (tied to drivers):** One mechanism whose outcome is observable satisfies D-1 and makes
  D-3 mechanical instead of inferred; the reviewed request title makes D-2 true without operator input
  (D-7); the three-way refusal split satisfies D-5 while keeping the cost bounded (D-4); the surface
  added is one optional field and two rows (D-6).
- **Decider:** Juliusz Ćwiąkalski — human acceptance at the GH-349 PR review; this record stays
  `Proposed` until then.
- **Conditions for revisit:** see `revisit_triggers` — notably a provider-side merge gap, persistent
  serial-merge churn, and the retained-capability cleanup.

### Constraint Compliance Attestation

The chosen alternative (ALT-1) satisfies every constraint C-1 … C-8. No accepted-risk exceptions are
taken. Three consequences are recorded as consequences rather than exceptions: `merge` refuses where
the adapter declares the landing a gap (capability honesty, not a violation of C-2); the local base is
no longer advanced by `merge`, which defers rather than disables closeout's diff sweep (C-8 still holds
on the recorded SHA); and `merge.rebase-conflict` becomes unreachable from the command while remaining
declared, which preserves C-7's "documented and machine-declared together" without inventing a
re-meaning.

## Trade-offs & Consequences

### Positive Outcomes

- Every `merged` report is backed by provider truth, and the recorded squash SHA is the provider's
  merge commit — closeout, the board, and the record finally agree.
- The CR-visible squash commit carries the title the reviewer approved.
- The exact-head guard closes the racing-push window that no local mechanism could see.
- Refusals become actionable: sync, checks, or not-yet-decided are three different instructions.
- F8's churn disappears because the command can no longer mutate the head it verified.
- A re-queued required check can no longer slip through the probe.

### Negative Outcomes

- `merge` now requires a provider landing capability; on GitLab it refuses with a declared gap until
  M3-S3 delivers the operation. The flip therefore depends on the GitHub reference adapter alone, which
  is the stated M4 scope but a real adoption constraint.
- The local base is not updated by a landing, so the operator's next `merge` sees the base as behind
  until a fetch, and closeout's diff sweep can lose its anchor object until then.
- Two additive contract fields (`DeliveryRequest.title` and the refusal-evidence `attribution`) and two
  additive error rows enter the merged contract; the byte-pinned required-job refusal goldens move, and
  the conformance ripple is paid in this change.
- `merge.rebase-conflict` survives as a row no delivered path emits — cheap, but visible drift until
  the revisit trigger fires.
- The post-refusal re-read is one more provider call on a refusal path; the bound is deliberate
  (refusals only, at most one).

### Unresolved Questions

- [ ] Whether a provider-asserted per-request mergeability detail will ever separate an out-of-date head
  from another protection rule, which is the only thing a decisive `behind` reason would require; until
  then `behind-unconfirmed` is the only non-`dirty` reason and the distinction stays out of the
  vocabulary (owner: the provider-signal revisit trigger).
- [ ] Whether a `blocked` request should ever be decomposed further (required checks versus required
  reviews) — deferred until a provider exposes the distinction (owner: future merge decision).
- [ ] Whether the retained `squashLand`/`refresh` capabilities should be deleted at M5 (owner: this
  record's revisit trigger).

## Implementation Plan

1. **Ports and transaction.** Replace the `land` port with one guarded landing input/outcome; bind
   `expectedHeadSha` to the verified head; make provider read-back the landing verdict; remove the
   refresh attempt and its branch; keep the recorded transaction shape and its `squashSha`.
2. **Metadata derivation.** Add optional `DeliveryRequest.title` with verbatim normalization and the
   declared fallback subject `merge(<ref>): squash <sourceRef>`; compose the fixed verbatim message
   line `Landed by the delivery lifecycle merge primitive.` in core with no interpolated value.
3. **Refusal classification.** Implement the table in §5, including the single post-refusal re-read,
   the single unknown-recovery re-read (both bounded and head-compared), the closed two-value
   `sync-required` reason vocabulary (`dirty`, `behind-unconfirmed`) with no decisive out-of-date arm,
   and the `attribution` field on not-green required-job findings.
4. **Probe extension.** Classify newly not-green required jobs through the delivered reasons and carry
   their `recorded`/`probe` attribution; pin the queued-is-not-green contract in a test.
5. **Error rows.** Add `merge.sync-required` and `merge.mergeability-unknown` to the machine table and
   the documented table together, taking the concrete rows from seven to nine; update the merge-kind
   declaration and the composition's declared emittable set; the declared landing gap keeps the
   delivered `merge.transaction-aborted` row and adds no identity.
6. **Adapter.** Compose the landing over the existing injected transport; no new transport, credential,
   or network location; a declared gap is a classified refusal through `merge.transaction-aborted` at
   exit 1 with the declared `CapabilityGapReason` in evidence.
7. **Retirement guard.** Add the production-source scan that asserts no composition path calls
   `squashLand`/`refresh`, with a mandatory failing control.
8. **Regressions.** Name one suite per defect: F1 (`fallback.internal` never the landing refusal),
   UNKNOWN recovery (head-compared), sync-required for `dirty` and `behind-unconfirmed` (with no value
   outside the pair representable), queued-required-check attribution, crafted metadata round-trip,
   idempotent convergence, no-retry.
9. **Reversal path.** Reverting is a code revert of the composition and the transaction ports: no
   persisted state migrates, and landed merges stay landed. The additive field and rows may remain
   harmlessly if only the composition is reverted.

## Verification Criteria

- Metric: landing provenance — every `result=merged` fixture requires provider-asserted merged truth;
  a fixture with local containment and a non-merged provider state refuses — Target: 100% — Window:
  GH-349 CI.
- Metric: crafted metadata — the squash title equals the request title verbatim (or, only when that
  signal is absent, the declared fallback `merge(<ref>): squash <sourceRef>`) and the message equals
  `Landed by the delivery lifecycle merge primitive.` byte for byte with no interpolation — Target:
  exact — Window: GH-349 CI.
- Metric: head guard — a head that moves after verification refuses with zero landing calls — Target:
  exactly 0 calls — Window: GH-349 CI.
- Metric: refusal taxonomy — `conflicting` (reason `dirty`), a `not-mergeable` refusal (reason
  `behind-unconfirmed`), checks posture, unknown-then-recovered, unknown-persisting, and a declared
  landing gap each resolve to their declared identity; the sync-required reason set is exactly
  `dirty` | `behind-unconfirmed` with no third value representable; and every not-green required-job
  refusal carries exactly one `attribution` value — Target: ≥1 case per state, per reason, and per
  attribution — Window: GH-349 CI.
- Metric: churn — landing attempts per invocation ≤ 1 and provider landing calls ≤ 1 across a
  three-merge serial fixture; no head mutation — Target: exact — Window: GH-349 CI.
- Metric: queued checks — a required job re-entering `queued` on the verified head refuses — Target:
  ≥1 case — Window: GH-349 CI.
- Metric: retired capability — production source composes no local squash/refresh — Target: 0 call
  sites, with a failing control — Window: GH-349 CI.
- Metric: error-table integrity — documented and machine tables agree, each new row reachable —
  Target: exact — Window: GH-349 CI.

## Confidence Rating

**High** for the mechanism choice and the refusal split: the local path's inability to publish, the
mergeability collapse, the probe's failed-only detection, and the missing request title are verified in
the delivered source, and the additive precedents (ADR-0004/0006, TDR-0008, TDR-0033) cover the contract
shape. **Medium** for the provider-refusal classification (the post-refusal re-read is an assumption
proven by fixture, and its only non-`dirty` arm is the declared `behind-unconfirmed` reason because the
normalized view cannot separate an out-of-date head from another protection rule) and for how lossy the
diff-sweep anchor becomes in practice; both degrade truthfully (an explicitly unconfirmed reason on the
same identity; a declared gap) rather than fabricating an outcome.

## References

- GH-349 clarify-scope facts, gap analysis, and positions:
  `doc/changes/2026-11/2026-11-18--GH-349--merge-closeout-queue-repair/chg-GH-349-pm-notes.yaml`
- M4 blueprint: `doc/planning/oss-tooling/milestones/m4/flip-plan.md:29-39,110-121`,
  `doc/planning/oss-tooling/milestones/m4/backlog.md` (§M4-S11)
- Current truth: `doc/spec/features/feature-merge-verify-deploy.md`,
  `doc/spec/features/feature-result-contract.md`,
  `doc/spec/features/feature-adapter-reference-behavior.md`,
  `doc/spec/features/feature-closeout.md`
- Delivered source: `packages/core/src/domain/merge-transaction.ts`,
  `packages/core/src/domain/merge-probe.ts`, `packages/core/src/contracts/ports.ts`,
  `packages/core/src/contracts/error-table.ts`, `packages/adapters/src/git/merge.ts`,
  `packages/adapters/src/github/{client,normalize,capabilities}.ts`, `packages/cli/src/edge.ts`
- Prior decisions: [TDR-0033](TDR-0033-github-adapter-completion-contract-extensions.md) (the deferred
  reconciliation), [TDR-0031](TDR-0031-engine-first-evaluation-surfaces.md),
  [TDR-0032](TDR-0032-github-adapter-cli-first-provider-transport.md),
  [TDR-0005](TDR-0005-delivery-result-enum-and-cli-exit-taxonomy.md),
  [TDR-0008](TDR-0008-additive-adapter-contract-extensions-closeout-v1.md),
  [ADR-0005](ADR-0005-runtime-confinement-provider-client-subpaths.md)

## Revision

### 2026-11-18 — carrier details aligned with GH-349 specification v1.1/1.2

- **Status:** unchanged — `Proposed`, `decision_date: null`. The owner accepts or rejects this record at the GH-349 PR review; this revision grants no authority and records no acceptance.
- **Trigger:** GH-349 specification v1.1/1.2 (`doc/changes/2026-11/2026-11-18--GH-349--merge-closeout-queue-repair/chg-GH-349-spec.md`, defects D1, D2, D3, D4 and D6 of the 1.1 remediation, plus the readiness amendment to D2 that removes the verification timestamp from the evidence), which resolved four carrier defects while this record is still `Proposed`. The record is amended in place rather than left contradicting the binding artifact. The decision, its six alternatives and their rejections, the constraints, the drivers, the reasoning, the consequences, the evidence set, and the status are unchanged: this is a contract-detail correction, not a re-decision.
- **What this record had wrong, and what it now states.**
  1. **Crafted metadata carrier.** §2 gave the provider-absent fallback as `merge(<ref>): <sourceRef>` and described the message as a trailer interpolating `Change: <ref>` / `Delivery-Request: <system>#<id>`. The delivered local shape — and the form the specification now binds — is the fallback subject `merge(<ref>): squash <sourceRef>` (the change ref, then the request's source ref), and the message is one fixed verbatim line, `Landed by the delivery lifecycle merge primitive.`, byte-identical for every landing, one bounded line with no leading or trailing whitespace and no interpolated value. §2 now states exactly that, and no change-ref, request-identity, body, or provider prose participates in either field.
  2. **`merge.sync-required` reason vocabulary.** §5 implied a single-cause sync refusal and routed the undecisive post-refusal branch to a generic gate-posture refusal through `merge.transaction-aborted`. That identity then carried a closed `reason` vocabulary of exactly three values — `dirty`, `behind`, `behind-unconfirmed` *(superseded: the `behind` value was withdrawn in the 2026-11-18 reason-vocabulary entry below, because no delivered branch can produce it)* — the undecisive branch was `behind-unconfirmed` with evidence naming the observed provider state and a caveated remediation (sync onto the base and re-verify; a refusal persisting after the sync means the protection rule is the cause), no fourth reason existed, and `merge.transaction-aborted` does not carry the sync remediation.
  3. **Declared landing gap.** §5 named no row for the case where the adapter declares `merge-delivery-request` a gap. The refusal is the delivered `merge.transaction-aborted` at exit 1 with evidence naming the operation and its declared `CapabilityGapReason`, performing zero landing attempts, zero local squash, and zero fallback; the concrete `merge` rows stay at nine, so the gap adds no third identity.
  4. **Refusal evidence attribution.** §7 treated a not-green required job as a "newness" finding with no provenance. The refusal evidence now gains exactly one additive optional bounded field, `attribution`, with the closed pair `recorded` | `probe`: `recorded` means the recorded gate verdict already reported that job not green and the evidence names the gate's effective id, the job, and the verdict; the verification timestamp is explicitly **not** an evidence field and is never duplicated onto the refusal (it stays on the persisted `merge.gate-verification` record the gate id plus job resolves to); `probe` means the recorded verdict was green and the probe observed the job. It is additive evidence, not a row, kind, exit class, or bound, and the byte-pinned required-job refusal goldens move because the summary renders the attribution.
- **Sections amended:** §2 (fallback subject, verbatim message line); §5 (the `not-mergeable` row, the added declared-gap row, and the additive-row paragraph carrying the closed reason triple *(three values then; superseded below)* and the abort-row boundary); §7 (the attribution paragraph); the Evidence table's out-of-date-refusal row (impact-if-false cell only, so it no longer asserts a collapsed single-cause outcome); Trade-offs → Negative Outcomes (additive-field count); Unresolved Questions (the distinguishing question restated as a reason-value question); Implementation Plan items 2–8; Verification Criteria (crafted metadata; refusal taxonomy); Confidence Rating (the undecisive arm is a declared reason, not a generic refusal). Every other line of the record is unchanged.
- **Follow-ups not made here:** the specification body already carried all five statements (F-1, F-2, F-3, AC-F1-6, AC-F1-7, AC-F2-1…AC-F2-3, AC-F3-2, DM-1, DM-2, API-2) at the time of this entry. Its DOCUMENT HISTORY then ended at the 1.1 row while the body already carried the later timestamp correction; that was resolved by the specification's subsequent revisions (current: v1.4), so nothing is outstanding there. No spec, test plan, plan, code, or other decision record was changed by this revision.

### 2026-11-18 — `merge.sync-required` reasons reduced to two values (DoR iteration 1, finding F4)

- **Status:** unchanged — `Proposed`, `decision_date: null`. The owner accepts or rejects this record at the GH-349 PR review; this revision grants no authority and records no acceptance.
- **Trigger:** GH-349 readiness gate iteration 1 (`doc/changes/2026-11/2026-11-18--GH-349--merge-closeout-queue-repair/readiness-review/readiness-iter-1.md`, finding **F4**, blocking, `carrier_observability`): "`behind` is unreachable given the delivered four-value normalization". The finding is correct; the value was declared but not producible, and a closed vocabulary must not advertise an outcome no branch can emit.
- **What this record had wrong.** The previous entry added `behind` as the *decisive* arm of the post-refusal re-read. It has no carrier. The GitHub normalizer derives mergeability from `mergeable` plus `mergeable_state` only: `mergeable: false` with `clean`/`dirty` and `mergeable_state: dirty` become `conflicting`; `blocked`, `behind`, `unstable`, and `draft` all collapse to `not-mergeable`; `mergeable: true` with no state or `clean` becomes `mergeable`; everything else reads `unknown` (`packages/adapters/src/github/normalize.ts:138-152`, read 2026-11-18). `DeliveryRequest` carries no second mergeability signal — no per-request out-of-date fact and no protection-rule detail — so a bounded post-refusal re-read through the same port returns the same four-value view (`packages/core/src/contracts/ports.ts:165-192`). The decisive branch was therefore unreachable by construction, and the record's own earlier "unresolved question" treated a settled impossibility as a pending fixture.
- **Corrected statement now carried by this record.** `merge.sync-required` carries a closed `reason` vocabulary of exactly **two** values: `dirty` (the normalized mergeability is `conflicting`; no landing call) and `behind-unconfirmed` (the request is not mergeable, or was unresolved, and the provider refused the guarded landing; the post-refusal re-read cannot separate an out-of-date head from another protection rule — evidence names the observed provider state, and the remediation instructs syncing onto the base and re-verifying with the caveat that a persisting refusal means the protection rule is the cause). There is no `behind` value, no decisive out-of-date branch, and no third value; the provider-asserted signal that would make a decisive distinction lawful stays a recorded revisit trigger and prose matching is prohibited as a substitute. GH-349's "typed sync-required result for a DIRTY/BEHIND request" is satisfied by these two values: DIRTY is `dirty`, BEHIND is `behind-unconfirmed`.
- **Sections amended:** §5 (the `not-mergeable` row drops the decisive arm and states why the re-read cannot do better; the additive-row paragraph now declares the two-value vocabulary, the no-`behind` boundary, and the reachability reason); the Evidence table's out-of-date-refusal row, formerly an ASSUMPTION that the distinction is observable, replaced by a FACT row that no normalized signal separates the two conditions; the front-matter revisit triggers gain one entry naming the provider-asserted mergeability detail a later decisive reason would require; Unresolved Questions (the decisive-`behind` question restated as the provider-signal question); Implementation Plan items 3 and 8; Verification Criteria (refusal taxonomy pins the reason set at exactly two values with no third representable); Confidence Rating (the only non-`dirty` arm is the declared unconfirmed reason). §2, §3, §4, §6, §7, the constraints, the drivers, all six alternatives and their rejections, the DACI assignment, the status, and every other evidence row are unchanged. *(Later the same day, the consistency-sweep entry below amended §3, §6, and C-6; every other item in this sentence still stands.)*
- **Follow-ups not made here:** the change specification (F-2 table and prose, AC-F2-2, AC-F2-3, DM-2, API-2, RSK-7, Appendix B/D/G) and the test plan (`TC-F2-*` reason cases) then still carried the withdrawn `behind` value and a decisive-re-read oracle the production input domain cannot produce. Both were corrected by the specification's v1.3/v1.4 revisions and the test plan's v1.5 revision; this follow-up is closed and nothing is outstanding there. No spec, test plan, plan, code, or other decision record was changed by this revision.

### 2026-11-18 — consistency sweep against GH-349 specification v1.4 and DoR iteration 2

- **Status:** unchanged — `Proposed`, `decision_date: null`. The owner accepts or rejects this record at the GH-349 PR review; this revision grants no authority and records no acceptance.
- **Trigger:** GH-349 DoR iteration 2 (`readiness-review/readiness-iter-2.md`), minor finding **N6** ("record and pm-notes state facts that later revisions superseded"), plus a check of this record against specification v1.4. No new decision is taken; the sweep fixes only statements the later revisions made stale.
- **Corrected:** (a) **§3 now carries the `landing.shaOnBase` carrier** — the field keeps its delivered shape and reports containment of the provider-asserted merge commit only when a local read answers for that identity, `unknown` otherwise (the ordinary case after a provider landing, since the command does not fetch); its domain widens to `boolean | "unknown"`, legacy boolean records read as before, and the state-layer validation must accept exactly that pair with the recorded value round-tripped through the delivered reader — it is never landing evidence and never a substitute for the provider-truth verdict. (b) **§6 now states the golden disposition** of the removed refresh: the scenarios that asserted it are retired with the mechanism (a test-artifact retirement, not a row removal), so the set keeps only scenarios a delivered path can still produce. (c) **C-6 now states the additive-widening discipline** that (a) requires — a delivered value domain may widen only additively, an existing value keeps its meaning and validity — instead of a blanket "no retyping" the record's own §3 would otherwise contradict; its verification adds a legacy-record round-trip. (d) The two Revision follow-up notes that asserted a then-current spec/test-plan gap are labelled as resolved by spec v1.4 and test plan v1.5 (this is N6).
- **Checked, no change needed:** version citations outside this section — there are none; the only `v1.1/1.2` references are the earlier entries' historical trigger and heading. Golden arithmetic — the record claims only that the required-job refusal goldens move (the moved pair) and never asserts a count that contradicts 2 moved / 2 retired / 11 unchanged; it asserted nothing about the retired pair before this sweep, which (b) now states. Suite counts — the record names no merge-suite population, so the delivered sixteen and the rewritten subset are not contradicted. Reason vocabulary — no three-value or decisive-`behind` language outside the labelled history in this section.
- **Sections amended:** §3 (new `shaOnBase` paragraph), §6 (golden retirement clause), C-6 (statement and verification), the first revision entry's follow-up note (labelled resolved), the second revision entry's follow-up note (labelled resolved). The decision, all six alternatives and their rejections, the drivers, the evidence rows, the DACI assignment, the status, and `last_updated` (2026-11-18) are unchanged.
