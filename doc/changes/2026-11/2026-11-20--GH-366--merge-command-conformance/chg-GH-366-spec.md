---
change:
  ref: GH-366
  type: fix
  status: Proposed
  slug: merge-command-conformance
  title: "M4-S3 Delivery command conformance (residual) — merge slice: resolve the change branch, enforce required checks on the resolved head, and name every refusal"
  owners: ["engineering"]
  service: delivery-os
  milestone: "M4: Jaiship-native delivery"
  labels: [merge, conformance, m4-s3, diagnostics, error-table]
  version_impact: minor
  audience: internal
  security_impact: low
  risk_level: high
  dependencies:
    internal:
      - "@delivery-os/core merge contracts, gate set, merge transaction, merge probe"
      - "@delivery-os/cli merge production composition"
      - "delivered error table and the merge reference page"
      - "delivered pm-notes parse and the merge git seam's bounded local object read"
      - "delivered CI-workflow expected-job read"
      - "delivered commit check-runs read, and the delivered delivery-request open-list, single-request and merged-request reads"
      - "delivered shared merged-request read (used by closeout, whose ranked selection is unchanged)"
    external:
      - "GitHub commit check-runs API (read-only, via the delivered adapter)"
      - "GitHub delivery-request open-list, single-request and merged-request API (read-only, via the delivered adapter)"
---

# CHANGE SPECIFICATION

> **PURPOSE**: Make `merge` verify the change's delivery request rather than the
> ambient checkout, make the merge-applicable gate set actually enforce the
> required checks the provider reports on the resolved head, and make every
> refusal name the command, the ref, the breached contract, and the offending
> object — so that a coordinator merging from any checkout either verifies the
> request's head or is refused by name.

## 1. SUMMARY

This change repairs three deterministic defects in the `merge` slice of the
delivery command family: the change branch is read from the invocation
checkout's git facts, the merge-applicable projection freshly evaluates exactly
one gate and never reads the check-run page, and refusals do not name the
breached contract (a missing credential names neither its reference nor its
environment variable, an unreadable work item collapses into an opaque
`merge.transaction-aborted`, and the composition's own emittable declaration
cannot express the gate family at runtime, so its exhaustiveness rests on a
source-text assertion). The change resolves the change branch from the change's
own `branch` declaration **read at the delivery request's asserted head**,
cross-checks it against the open delivery request, binds the freshness envelope
to that request's head, makes the shipped default set enforce the
repository-declared CI job set on the resolved head (failing, pending, canceled
and skipped checks each refuse by name), and replaces the opaque and unnamed
refusals with three additive rows plus a declared refusal-cause contract. Merged
truth is obtained the only way the delivered surface offers it — through one
additional bounded merged-request read of the delivered closed-state surface,
taken only when the primary open read has no match, whose one additive, optional
member — the **matched request identities** — makes more than one merged match an
abort that names each matched identity rather than a silent selection, makes zero
matches decidable, and keeps a faulted read a named provider outcome instead of a
false "nothing was open"; the landing decision reads mergeability from the
delivered single-request read of the resolved request, because the list page it
consults today cannot carry that fact. Budgets state the honest per-path counts —
the merged read's own review-thread query included — so a run spends at most
three delivery-request provider requests and never chooses between duplicates.

## 2. CONTEXT

### 2.1 Current State Snapshot

**Branch source.** The production merge composition assigns the merge branch
from the checkout's own resolved git facts, and its own contract comment states
that the value is "the checkout's own current branch, read from its git facts".
The composition holds no change-record branch source at all: resolving one is
new design, not a wiring repair.

**Request resolution.** The composition lists open delivery requests and matches
an entry whose provider-asserted source ref equals that checkout branch. On no
match it attempts to recover a change ref from the branch name — which yields
nothing for the declared integration base — and otherwise returns
`merge.transaction-aborted`. This is the path that produced both observed
symptoms at once: a run started from the integration base verified evidence
about the base tip, and a run whose request could not be matched from that
branch surfaced as an opaque abort rather than a named condition. That list read
is bounded and is issued with the open state filter, so it yields **only open
entries**: no merged request is ever on that page, and the page can never
establish merged truth. Merged truth comes from a second, distinct bounded read
of the closed state, which filters by a work-item-ref predicate rather than by
the branch convention, and which **ranks** several matches and returns one
selected request; that same read is what closeout consumes. Nothing on the merge
path today can observe how many merged requests matched — the delivered read
returns only its selection, and its no-match result and a failed read surface as
the same unavailable outcome — so a merge that matched several takes the
delivered selection without the operator learning that a choice was made, and a
faulted merged read would be indistinguishable from an empty one.

**Mergeability on the landing path.** The delivered merge decision obtains the
request detail — mergeability included — through the open-list read's opt-in
gate-facts form, and the delivery-request list endpoint never returns
mergeability fields; only the single-request read does. The decision therefore
sees `unknown`, its one bounded unknown-recovery re-read repeats the same
list-shaped read, and every ready request refuses
`merge.mergeability-unknown`: a mergeable, clean change cannot land through the
merge command today. The delivered single-request read is already consumed
successfully by the verify-gates family, so the fact is reachable on the
delivered surface — the merge path simply reads it from a shape that cannot
carry it.

**Gate set.** `MERGE_DEFAULT_GATE_ENTRIES` ships five built-in entries on the
`battery` surface (`lifecycle-finalization`, `ci-green`, `push-parity`,
`owner-gate`, `squash-preflight`) plus `tracker-freshness` on the `merge`
surface. The fresh merge projection therefore evaluates exactly one gate, which
is the observed `gates=1/1 passed`: a merge over a request with failing CI
reports the same verdict as a merge over a fully green request. The *enforced*
merge set, by contrast, carries every built-in regardless of its declared
surface, which is what makes the recorded-verdict check below reachable.

**Recorded CI verdict, and the fresh page.** The enforced merge set places every
built-in id in the merge path regardless of declared surface, and the
transaction refuses on a persisted non-pass `ci-green` verdict found there. The
recorded half is therefore a delivered safeguard, not a gap. What is missing is
the fresh half: the live sweep skips `ci-green` and the fresh merge projection
carries one tracker gate, so the check-run page is never consulted for the
built-in CI gate at merge time. The consequence is narrower and worse than "CI
is never enforced": the verdict is consulted but the page is not, so a head that
turns red after `verify gates` but inside the delivered 1800 s freshness bound
is invisible, and a page whose SHA is not the resolved head is skipped rather
than refused.

**Required-check machinery already delivered.** The transaction evaluates every
merge-applicable `required-ci-job` entry through one evaluator with `recorded`
and `probe` attribution, a job the set does not declare is never evidence, and a
check-run page whose SHA is not the head is not head evidence. `queued`,
`running`, `canceled`, `skipped` and `failed` are not green, with the delivered
reasons `ci-pending`, `ci-canceled`, `ci-all-skipped`, `ci-failed`. The dry run
evaluates the merge-applicable entries, reads the head from the transaction's
head port, appends one verification record, and returns `verified` for an
all-pass set; a merge-surface entry whose recipe is neither `required-ci-job` nor
`tracker-freshness` currently yields `verdict: unknown, reason: read-failed`.

**Delivered "required" sources.** The only CI read is the commit check-runs page
for one SHA; no branch-protection "required status contexts" read exists anywhere
in the product. Two further delivered, repo-declared sources exist and are
already consumed by the battery's `ci-green` gate: the repository's own CI
workflow job set (the expected-job names read from the checkout's declared
workflow path) and the effective declared gate set's `required-ci-job` entries.
There is exactly one per-job mapping, `evaluateRequiredJobGate`, shared by the
battery and the probe.

**Diagnostics.** `config.credential.missing` is declared as a `config` refusal
whose hint is "supply the credential through its declared environment source";
the merge path forwards that identity without naming the credential reference or
the environment variable, although the tracker family already has a delivered
precedent for a refusal summary that names both. A non-resolving request or work
item is mapped onto `merge.transaction-aborted`, whose hint instructs the
operator to "clear the named pre-condition" while naming no condition, and whose
declared row claims `retryable: true` with a convergence promise even for causes
that do not converge on a re-run. The row also reaches every landing fault: the
transaction converts any landing-port failure into it, carrying the port's own
failure token into the abort's evidence, and the composition maps a provider
refusal to `provider.outage` for a payload-invalid response whose status is
neither 401 nor 403. A provider outage converges on a plain re-run, so the row's
convergence promise is not merely unnamed for that cause — it is false. The
landing port's failure is an open string, not a closed set: the production seam
maps the provider failure vocabulary it knows, but the port itself admits any
token, and one delivered convergence cell exercises exactly that with an
arbitrary code. Removing the abort wrapper without closing the port's failure set
would therefore let an arbitrary token become an emitted identity that resolves
to no declared row. The unverified-state refusal's remediation has the same
defect in a milder form: it tells the operator to produce a verification without
naming the command that produces one or the work item to produce it for.

No refusal rendering names the command, the invocation's change ref, or a
validated operation token, and no read operation appears as a field at all: the
human and scripted summaries are
`result=refused; condition=<code>` plus evidence lines, and the code's own
`merge.` prefix is the only occurrence of the command name — which is exactly why
an assertion on that occurrence would be vacuous.

The `merge.gate.<gate-id>.failed` family is emitted by the transaction and **is**
resolved at classification: the classifier recognizes an emitted code whose kind
is `merge` and whose slot has the declared gate-id shape and returns the declared
family row (kind `merge`, exit 1), so a gate refusal already renders as its own
row. What is weaker is the composition's side of the contract: its runtime
emittable declaration enumerates exact codes only and expresses the family as a
type, so nothing in that runtime vocabulary states that a family emission is
admissible, and the totality proof closes the gap by asserting the presence of
that type name and the family prefix/suffix constants in the composition's
source text rather than by ranging over a runtime declaration.

**Change record reads.** The pm-notes parse is delivered and separable from
acquisition (text in, located path and parsed value out), and the closeout
composition already consumes the `milestone` key from it. The delivered
*acquisition*, however, is rooted at the invocation's working tree: an in-flight
change's folder exists only on the change branch, so a run from the integration
base cannot see it — the base carries no folder for this change, and carried none
for GH-350 before it merged. The merge git seam already performs bounded,
fixed-argv, local object reads at a commit through an injected child runner (its
tree-of-commit read), so one local tree/blob read at a candidate head is the
same class of operation: no shell, no network, no credential, and
offline-testable. The pm-notes lint has no closed key set: every extra top-level
key is opaque, preserved and never inspected, so an added `branch` declaration is
additively admissible and survives every document-writing branch
value-faithfully.

**Contract that this change amends, and one it states.** `feature-merge-verify-deploy`
currently states that the composition resolves the branch from the checkout's git
facts, that the verification record's head is the checkout head, that the default
gate set is six entries of which one is merge-applicable, and that the declared
emittable set is exhaustive so `fallback.internal` is reachable only for a
genuinely undeclared failure — four statements this change amends. It discusses
the merged report not at all, so the merged report's gate semantics are stated
here and written into that page by this change's doc reconciliation rather than
amended there. The coverage map `test-spec-merge-verify-deploy` states the
checkout-facts branch resolution in its "Composition reachability" row. The page
and the coverage map must be reconciled in the same change.

### 2.2 Pain Points / Gaps

- **P-1 — The verified object is not the merged object.** A `merge` invoked from
  the base checkout verifies the base tip and can report `result=verified` for a
  head that has nothing to do with the change.
- **P-2 — The fresh gate projection is vacuous on CI.** The merge-applicable set
  contains one tracker gate, so a failing, pending, canceled or skipped check on
  the resolved head can neither refuse a merge nor be named.
- **P-3 — The fresh CI page is never consulted.** The persisted battery verdict
  for the resolved head is honored, but the merge's own evaluation reads no page:
  a check that turns red after `verify gates` inside the 1800 s bound is
  invisible, and the merge reports `gates=1/1` either way.
- **P-4 — Refusals are opaque.** A credential condition narrates no reference and
  no environment variable; an unreadable work item reports
  `merge.transaction-aborted` whose hint names nothing; no refusal names the
  command or the ref it was invoked with; and the composition's own declaration
  cannot express the gate family at runtime, so no part of the composition's
  vocabulary says a family emission is admissible and the totality proof stands on
  a source-text match rather than on a runtime declaration.
- **P-5 — A row's retryability claim is false for causes it reaches.** A declared
  row advertises `retryable: true` and a remediation that promises convergence,
  while causes routed to that same row need an operator act before a re-run can
  converge — so the claim is false for part of the row's own cause set.
- **P-6 — A dry run can describe a different object** from the one the real merge
  would land, because both take their head from the invocation checkout.
- **P-7 — The declaration cannot be read where the verdict is needed.** The change
  record that declares the branch lives on the change branch, so a working-tree
  read of it answers "missing" precisely in the integration-base invocation the
  capability exists for.
- **P-8 — Merged truth can be chosen silently.** The delivered merged-request read
  ranks several matches and returns one while exposing no identities, so a merge
  that matched more than one merged request proceeds on one selected request and never
  tells the operator that a choice was made — and a merge that matched more than
  one open request for the same branch takes the first without noticing.
- **P-9 — The landing decision cannot observe mergeability.** The merge decision
  reads the request through the open-list read's gate-facts form, and the list
  endpoint never returns mergeability fields; the decision sees `unknown`, its
  bounded re-read repeats the same list-shaped read, and every ready request
  refuses `merge.mergeability-unknown`.
- **P-10 — The unverified-state remediation names no command.** A
  `merge.state-unverified` refusal instructs the operator to produce a
  verification without naming the command that produces it or the work item to
  produce it for.

## 3. PROBLEM STATEMENT

Because `merge` resolves the change branch and the verified head from the ambient
checkout, and because the merge-applicable projection evaluates only a tracker
gate and never reads the fresh check-run page, an operator merging a change from
the integration base cannot obtain a verdict about the change's delivery
request — the run verifies the base tip and reports a vacuous all-pass gate set,
while the refusals it does emit name neither the command, the ref, the
credential, the work item, nor the gate that breached the contract, and the
unverified-state remediation names no producing command. The change
record that declares the branch exists only on the change branch, so the
declaration must be read at the head the run is about rather than from the
invocation's working tree. The delivered merged-request read also ranks several
matches and returns one with no matched-identity visibility, so merged truth can
be chosen silently and a duplicate delivery request never surfaces as a refusal —
and because the read's empty result and its fault share one outcome shape, a read
fault would be reported as a false "nothing was open". The landing decision
consults mergeability through the list-shaped read that cannot carry it, so a
ready, clean change refuses `merge.mergeability-unknown` instead of landing. As a
result, a failing or
pending required check never stops a landing, a genuine refusal is
indistinguishable from an internal defect, and a merge can proceed on a silently
chosen duplicate — so the coordinator cannot tell which condition blocked a
delivery or which contract to repair.

## 4. GOALS

- **G-1**: `merge` resolves the change branch from the change record's
  declaration read at the delivery request's asserted head and binds the verified
  head to that request's head; the ambient checkout's branch and head never
  participate in that resolution.
- **G-2**: The shipped default merge-applicable gate set enforces the required
  checks reported on the resolved head, so a failing, pending, canceled or
  skipped required check refuses by name and a fully green request does not
  produce the same verdict.
- **G-3**: Every refusal renders the command, the ref it was invoked with, the
  breached contract, and the offending object; a credential refusal names the
  credential reference and the environment variable; a read fault names the
  operation that failed.
- **G-4**: No credential condition is reported as `merge.transaction-aborted`,
  no landing fault is reported as that row either — every landing-port failure
  resolves to one of the four declared identities (`config.credential.missing`,
  `provider.auth.rejected`, `provider.outage` including the unclassified case, or
  `merge.landing-unverified`) and never to the port's own token — no declared row
  claims `retryable: true` while a cause it reaches needs an operator act before a
  re-run can converge, no read fault of the merged-request read is reported as
  `no-open-request` or `merge.request-unresolved` — a transport, auth or payload
  fault of that read is a distinct outcome that names the provider identity and
  the read's operation — and no remediation hint instructs an operator to clear a
  condition that is not named (the unverified-state remediation names the command
  and the work item that produce the verification).
- **G-5**: Every code the merge transaction can emit resolves to a declared row
  or the declared family, and the composition declares that family at runtime
  rather than only in a type, so its exhaustiveness is proven over the runtime
  declaration — and fails by name when that declaration is removed — instead of
  over source text.
- **G-6**: A dry run resolves and describes exactly the object the real merge
  would land, and both reports state the gate projection the run actually
  evaluated.
- **G-7**: The landing decision reads mergeability from the delivered
  single-request read of the resolved request — the request located on the
  open-list page — so a list page that carries no mergeability fields never
  produces `merge.mergeability-unknown`, and a ready, clean request lands.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Merge-applicable gates under the shipped default set | 2 (CI gate + tracker gate), up from 1 |
| Merge-applicable gates rendered in the merged report | 2 — the same projection the dry run evaluates, never the record's battery list |
| Named-checks refusals | 100 % of failing, pending, canceled and skipped required checks refuse at exit 1 with the check name in evidence |
| Base-checkout invocations reporting the base tip as the verified head | 0 |
| Successful resolutions reporting a resolution source other than `declared-at-head` | 0 |
| Delivery-request provider requests per path, success or refusal, the merged read's own review-thread query included | Honest per-path counts; **at most 3 delivery-request provider requests on any run**. Every run spends the bounded open-list read — the delivered `listDeliveryRequests` at `TRUTH_PROVIDER_LIMIT` with gate facts. An open-page-only run that reaches the merge decision costs **2** (the open list + the single-request mergeability read); a convergence attempt with nothing matching costs **2** (open list + the closed-state merged read); a match-bearing convergence attempt — a replay or a duplicate-merged abort — costs **3** (open list + the closed scan + the read's delivered review-thread query, which no option may suppress for the merge caller); a faulted merged read costs **2** and refuses the declared provider identity, never `no-open-request`. Refusals decided before the merge decision (`merge.branch-unresolved` in all causes, `ambiguous-open-request`, `head-unresolved`, a duplicate-open abort, `merge.state-unverified`, `merge.gates-stale`, a gate refusal, `merge.work-item-unresolved`) spend exactly **1**. No pagination, no retry, no fetch. |
| Duplicate matching delivery requests resolved by a silent selection | 0 — more than one matched identity in either read aborts `merge.transaction-aborted` naming each matched identity, and the merge path never inherits the delivered selection when more than one identity is observed (within the bounded pages; a saturated closed page is not detectable on this path and is deferred with OQ-6) |
| Local change-record reads on the resolution path | ≤ 3 (one per candidate), 0 working-tree reads, 0 fetches |
| Refusals missing a named cause (dedicated `command` field, code, dedicated `ref` field, dedicated `operation` field, offending object) | 0 across the enumerated refusal matrix (≥ 18 cases) |
| Refusals rendering an `operation` token outside the closed vocabulary | 0 — the rendering site rejects an out-of-vocabulary token rather than passing it through; `-` is the only value for a refusal that names no operation |
| Credential refusals naming reference **and** environment variable | 100 % |
| Landing faults reported as `merge.transaction-aborted` | 0 — a transient or transport fault reports `provider.outage`, a rejected credential `provider.auth.rejected`, an absent credential `config.credential.missing`, and a landing that fired without observed merged truth `merge.landing-unverified`; no envelope carries a raw landing-port token |
| Mergeability decisions made from a source that cannot carry mergeability | 0 — the landing decision reads the delivered single-request read of the resolved request; an open-list entry without mergeability fields never produces `merge.mergeability-unknown` for a clean request |
| Unverified-state refusals whose remediation names the producing command and target | 100 % — `merge.state-unverified` names `verify gates <ref>` for the same work item, then a re-run |
| Emitted codes resolving to a declared row or the declared family | 100 %; the containment identity reachable only by an undeclared failure, proven by a live mismatch control, and the totality proof fails by name when the runtime family declaration is removed |
| Declared rows advertising `retryable: true` while a cause they reach needs an operator act before a re-run can converge | 0 |
| Refusals rendering a `retryable` other than their emitted code's declared row value | 0 |
| In-flight changes forced to re-verify because of this change | 0 (the effective gate-set identity is unchanged) |

### 4.2 Non-Goals

- **NG-1**: No branch-protection "required status contexts" read. The product has
  none and this change does not add one.
- **NG-2**: No change to the battery's five built-in gate evaluations, to
  `verify gates` output, or to its goldens.
- **NG-3**: No new landing mechanism, refresh path, force/bypass/auto-merge/queue
  variant, or head mutation.
- **NG-4**: No re-scoping of the ticket body's family-wide battery (see §7.2).
- **NG-5**: No automatic writer that maintains the change-record branch
  declaration (see OQ-1).
- **NG-6**: No change to waiver authorization policy, to owner-gate
  classification, or to the `--waive` flag surface.
- **NG-7**: No fetch, pull, or other network operation to make a missing head
  object readable (see OQ-4).
- **NG-8**: No suppression option for the shared merged-request read's own
  review-thread query on the merge path. The read is used verbatim and its query
  is counted in the budget (NFR-2); an option to skip it for one caller is
  forbidden.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Change-branch resolution from the change record read at the delivery request's head, cross-checked against the open delivery request | Removes the ambient checkout from the merge path (P-1, P-6, P-7) and gives the invocation a single declared source that is readable where the verdict is needed, with a fail-closed refusal when it cannot be established; the request read resolves to the open entry whose source ref equals that resolved branch exactly, a duplicate match aborts rather than choosing silently (P-8), and the landing decision reads mergeability from the single request the resolution located (P-9). |
| F-2 | Required-check enforcement on the resolved head under the shipped default gate set | Makes the merge-applicable projection non-vacuous and turns the delivered per-job mapping into a real merge gate on the fresh page (P-2, P-3). |
| F-3 | Refusal diagnostics contract | Makes every refusal actionable and non-misleading, attributes it to a command and a change, and keeps `retryable` a row property that is nonetheless true of every cause the row reaches (P-4, P-5, P-10). |
| F-4 | Emitted-identity totality for the gate family | Gives the composition a runtime family declaration so its exhaustiveness is proven over that declaration rather than over source text, while the classifier's delivered family resolution is preserved unchanged (P-4). |
| F-5 | Dry-run / real-merge object agreement | Makes the pre-flight verdict a true statement about the object the merge would land, including the gate projection it evaluated (P-6). |

### 5.1 Capability Details

#### F-1 — Change-branch resolution

`merge` derives the change branch from the change record and requires it to name
an open delivery request. The single declared source is a `branch` declaration on
the change's pm-notes document — the same committed change record the closeout
composition already reads, and a key the pm-notes lint preserves as opaque.

**Where the declaration is read.** The declaration is read **at the delivery
request's asserted head** — the commit the merge will land — through one bounded,
fixed-argv, local git tree/blob read owned by the merge composition, with the
delivered pm-notes parse applied to the text obtained from that head. The
invocation checkout's working-tree change-record read is not an authority on this
path and does not participate: for an in-flight change its root does not contain
the change folder at all, so it could only produce a refusal in exactly the
scenario this capability exists for. There is no second source, no derived
fallback and no ambient read.

Resolution order and outcomes:

1. **Primary read — the delivered open-request list.** One bounded
   `listDeliveryRequests` read at the declared `TRUTH_PROVIDER_LIMIT`, with gate
   facts (`includeGateFacts: true`). It yields the **open** entries, the observed
   open count, and whether the bounded page saturated. That page carries the open
   state filter and therefore never carries a merged request: it cannot establish
   merged truth, and this resolution does not claim it does. It cannot carry
   mergeability either — the list endpoint returns no mergeability fields — so
   the merge decision's mergeability fact comes from the single-request read
   (below), not from this page. The request this read resolves to is the open
   entry whose provider-asserted source ref equals the change's **resolved
   branch** exactly (`sourceRef === resolvedChangeBranch`); the candidate set
   below locates the record head whose declaration is read, and acceptance
   (step 5) is the exact equality that establishes the resolved branch. A
   candidate whose asserted head is absent or is not a full hex SHA refuses the
   **run** — `head-unresolved` is a run-level refusal, not a per-candidate skip:
   the unusable candidate is never read and the remaining candidates are not
   consulted, because a candidate set with an unreadable member cannot establish
   the uniqueness the resolution claims.
2. **Candidate set** = the open entries whose provider-asserted source ref
   matches the repository's declared branch convention for the invocation's ref
   (`^[a-z][a-z0-9-]*/<REF>/.+$`, the delivered predicate already used by the
   closeout resolution), capped at `MERGE_BRANCH_CANDIDATE_MAX = 3`. **Saturation
   is evaluated before the candidate count**: a bounded page that saturated
   refuses `ambiguous-open-request` naming the saturation, *even when zero
   convention-matching candidates are on the page*, because a truncated page
   cannot establish any uniqueness claim and a zero count taken from it would be
   a claim about a page the run did not see. On an unsaturated page, more than
   three candidates refuse `ambiguous-open-request`, and a candidate whose
   asserted head is absent or is not a full hex SHA refuses `head-unresolved` and
   is never read. **A non-empty candidate set is resolved without any convergence
   read** (steps 4–6): the run has something to resolve, and that is what keeps
   every refusal taken from this page — including `merge.branch-unresolved` — at
   one provider read.
3. **Convergence attempt** — reached only when the primary read has **no match**
   on an unsaturated page, i.e. only where the open page offers nothing to
   resolve: exactly **one bounded merged-request read**, the delivered
   `findMergedDeliveryRequest` invoked as
   `findMergedDeliveryRequest({ workItemRef, limit: TRUTH_PROVIDER_LIMIT })`,
   used **verbatim** — its delivered work-item-ref filter and its delivered
   deterministic selection, with **no convention filter of this change's own**
   and no ranking of its own. No pagination, no retry, no fetch. The delivered
   read exposes only its ranked single selection to any caller — no match
   census, and one shared outcome shape for "no match" and "could not read" — so
   this change adds **one additive, optional member** to that read's result: the
   **matched request identities**, computed **before** its delivered selection
   and carried on every match outcome — beside the delivered signals on a match,
   and on the shared unavailable outcome with an **empty** set when the closed
   page was read and matched nothing, **absent** when the page could not be read.
   No second, competing count field exists: any count is derived from the
   identities. Closeout, the read's other consumer, ignores the member, so
   closeout's behaviour and output are unchanged. The merge path decides from
   the identities:
   - **exactly one identity** — the run replays from provider truth at exit 0 and
     reports `replayed=true` with that request's identity. It reports neither a
     `declared-at-head` resolution source nor a resolved head taken from the
     candidate resolution, and because it lands nothing it neither reads a change
     record nor requires a readable head object.
   - **the empty set** — the page was read and matched nothing: the run refuses
     `merge.request-unresolved` with `no-open-request`, naming the observed empty
     matched-identity set. Zero is decidable, not assumed.
   - **more than one identity** — the run refuses `merge.transaction-aborted`,
     naming **each** matched identity and presenting **none** of them as *the*
     request, rather than allowing the delivered selection to choose silently.
     This is the abort row's duplicate-request cause (F-3).
   - **the member absent** — the read itself failed (transport, auth, or
     payload): a **distinct outcome**, never folded into zero. The run refuses
     `provider.outage` (one identity for all three fault classes; a payload
     the read cannot parse lands on that same row because the delivered
     payload-invalid mapping itself resolves to `provider.outage` at this
     seam) naming `operation=github-delivery-request-list`, and never reports
     `no-open-request` or `merge.request-unresolved`: an act-not-required
     provider fault must not masquerade as "nothing was open".

   The delivered read's ranked single selection stays exactly as delivered for
   closeout, and the merge path uses it only to name the single matched identity
   when exactly one identity is observed; on more than one it aborts and never
   inherits the selection, so one read serves two behaviours and only closeout's
   output is unchanged. The read's own delivered sequence — including its
   bounded review-thread query for the selected request — is part of the
   attempt: a match-bearing attempt costs three provider requests (open list,
   closed scan, thread query), counted in the budget and never suppressed for
   the merge caller.
4. **Each candidate's record is read at that candidate's own asserted head**
   through one bounded local read (at most two fixed-argv git invocations: a
   `ls-tree -r --name-only <sha> -- <pathspec>` locate, then one bounded blob
   read), and the candidate is **accepted** only when its `branch` declaration
   equals its own provider-asserted source ref as an exact string. There is no
   prefix, suffix, glob, or change-ref-substring matching; the convention
   narrows *where to look* and never supplies the value.
5. **Exactly one accepted candidate is the delivery request**, and the resolution
   source is reported as **`declared-at-head`**. The duplicate check runs
   **before** the distinct-refs ambiguity check, and its population is the
   **candidate set**: an entry whose provider-asserted source ref equals the
   resolved branch necessarily follows the declared convention that resolved
   branch came from, so the scan is decidable within the cap. **More than one
   open entry whose provider-asserted source ref equals the resolved branch
   exactly** is a duplicate-request condition: the run refuses
   `merge.transaction-aborted` naming the duplicate identities and never selects
   one (the abort row's duplicate-request cause, F-3) — the duplicate refusal
   wins over the ambiguity refusal when both conditions are present on one page.
   Two or more accepted candidates **with distinct source refs** refuse
   `merge.request-unresolved` with `ambiguous-open-request` (a declared guard,
   not a ranking); a well-formed list cannot carry two distinct open source refs
   that both declare themselves for one change.
6. **The matched request's asserted full-SHA head is the resolved head.** The
   freshness envelope compares the verification record's head against the resolved
   head, and the landing's expected head is the resolved head. A record whose head
   is the integration base therefore refuses `merge.gates-stale` with both SHAs
   recorded, at exit 1, with zero landing calls.
7. If no candidate can be accepted, the run refuses `merge.branch-unresolved` at
   exit 1 with exactly one closed reason, chosen by the declared precedence:
   `declaration-disagrees` > `record-invalid` > `record-unreadable` >
   `record-missing` > `declaration-missing` > `declaration-unusable`. The six
   reasons are:
   - `declaration-missing` — the record is a mapping and declares no `branch` key,
     or declares a non-string or empty value;
   - `declaration-unusable` — the value contains whitespace or a control
     character, or is longer than the declared cap (measured in characters, never
     truncated);
   - `declaration-disagrees` — the value is usable but is not an exact match for
     that candidate's own source ref;
   - `record-missing` — the candidate's head carries no change record for the ref;
   - `record-invalid` — the record exists at that head but does not parse, is not
     a mapping, or fails the delivered parse's health rules;
   - `record-unreadable` — the head object is not in the invocation's object
     database, or the local read failed, so the content cannot be observed.

   The evidence names each read candidate's own cause and its attempted tree path
   (at most three candidates), so one run diagnoses all of them. A malformed
   record is therefore the same refusal *identity* as an absent one with a
   distinct reason, because the repair differs (fix the YAML, commit the record,
   make the object present locally, or correct the value). `merge.request-unresolved`
   carries exactly three closed reasons — `no-open-request`,
   `ambiguous-open-request`, and `head-unresolved` — and a candidate whose head is
   not a full hex SHA is never read.

The three request reasons partition by the page they are read from:
`ambiguous-open-request` and `head-unresolved` come from the open page;
`no-open-request` comes from the convergence attempt, which is this change's only
path to merged truth. A duplicate match on either read is not a request reason: it
refuses `merge.transaction-aborted` under F-3.

Convergence is decided on the convergence attempt, **before any change-record
read**: a converged re-run therefore needs no declaration and performs no
change-record read at all. It is not behind the declaration refusal, because it is
attempted only where no candidate exists to read a declaration from — a stale
conforming open request is resolved (or refused by name with its attempted record
path) instead of being pre-empted by a replay.

The pinned constants are contract constants, not configuration:
`MERGE_BRANCH_DECLARATION_MAX_CHARS = 256` (characters; a longer value is refused,
never truncated), `MERGE_BRANCH_CANDIDATE_MAX = 3`, and
`MERGE_CHANGE_RECORD_MAX_BYTES = 262_144` per record read. The read budget is
declared **per path**, counting every provider request each read itself issues
(the merged read's delivered review-thread query included), and it peaks at
**three delivery-request provider requests on any run**:

- an open-page-only run that reaches the merge decision spends **2** — the
  bounded open-list read plus the single-request mergeability read of the
  resolved request;
- a convergence attempt with nothing matching spends **2** — the open list plus
  the closed-state merged read, whose thread query is not issued without a
  selected match;
- a match-bearing convergence attempt — a replay or a duplicate-merged abort —
  spends **3** — the open list, the closed scan, and the read's delivered
  review-thread query, which no option may suppress for the merge caller;
- a faulted merged read spends **2** and refuses the declared provider identity
  (the distinct fault outcome of step 3), never `no-open-request`;
- refusals decided before the merge decision — every `merge.branch-unresolved`
  cause, `ambiguous-open-request`, `head-unresolved`, a duplicate-open abort,
  `merge.state-unverified`, `merge.gates-stale`, and a gate refusal — spend
  exactly **1** (the open list), because the mergeability read is reached only by
  a run whose gates pass.

Beyond those: at most three bounded local change-record reads (each at most two
fixed-argv git invocations), with no retry, no pagination and no fetch.

The branch refusal's honest read claim is **exactly one provider read**, not zero:
the candidate set can only be built from the list read that the request resolution
needs anyway. Every `merge.branch-unresolved` cause performs that one read and no
other — no convergence read is taken on a run that has candidates to resolve, the
declaration causes (`declaration-missing`, `declaration-unusable`,
`declaration-disagrees`) add no further provider read beyond it, and
`record-unreadable` adds no provider read for the missing object, only the local
read attempt that could not observe it. A duplicate-open abort also spends exactly
one provider read — the open list that observed the duplicate entries. A candidate
whose branch name does not follow the declared convention is invisible to the
candidate filter, so a ref with no conforming request reaches the convergence
attempt and refuses `no-open-request` there, naming the change ref and the
observed empty matched-identity set.

A head object the checkout does not hold refuses `record-unreadable`; the merge
path performs no fetch, as a delivered design property, so the run never fetches
to make it readable (NG-7, OQ-4, RSK-9).

The resolution result — resolved branch, resolution source, matched request
identity, observed candidate count, the observed matched request identities on a
convergence attempt, and resolved head — is part of the run's reported data for both the dry
run and the merged report, so an operator can see which object a verdict describes
and which reads the verdict rests on. The composition never reads the checkout's
branch or head on this path and never reads a change record from the working
tree; a production-source scan with a mandatory failing control proves all three
absences.

**What the merge decision reads.** The landing decision resolves mergeability
from the delivered **single-request read** of the resolved request — the request
the resolution located on the open-list page — because the list endpoint cannot
carry mergeability. A list payload without mergeability fields plus a
single-request payload reporting the request mergeable and clean is a landing,
never `merge.mergeability-unknown`: the refusal is reachable only when the
single request's mergeability state itself cannot be established. Where an
unknown-recovery re-read is kept, it re-reads the **single request**, never the
list, and a fault of the single-request read resolves to the declared provider
identity naming `operation=github-delivery-request-detail`. The read is
delivered, read-only, and already consumed successfully by the verify-gates
family; the merge path adds no endpoint, credential, or capability by consuming
it.

The declaration is not configuration: it lives on the change artifact, adds no
key to the configuration document, and carries no schema version. Its absence is
not a default but a refusal: a change whose declaration cannot be established at
its request head refuses `merge.branch-unresolved` unconditionally, so an
existing or in-flight change must add the one-line declaration on its own branch
before it can merge. Nothing stored is re-read to satisfy it — the merge path
reads no historical record — so no backfill is required and no stored state
migrates. The authoring obligation is documented where a change is created (§16,
§19), and the convergence case is exempt because it decides from provider truth on
the convergence attempt, before any record read.

#### F-2 — Required-check enforcement on the resolved head

The shipped default set makes `ci-green` merge-applicable, so the effective
merge projection is two entries: `ci-green` and `tracker-freshness`. The
effective gate-set identity is the schema version plus the entry-id sequence, and
that sequence does not change, so no in-flight verification is invalidated.

The **merge-applicable required-check set** is derived once per invocation:

- Every merge-applicable `required-ci-job` entry contributes `job ?? id`.
- The merge-applicable `ci-green` entry contributes the repository-declared
  expected job set: the job names the repository's own CI workflow declares, read
  through the same delivered read the battery's `ci-green` gate uses.

Each name in that set is evaluated against the check-run page of the resolved
head through the single delivered per-job mapping. The authoritative source of a
job's state is that page; the authoritative source of which jobs are required is
the effective gate set (its declared entries, plus the built-in CI entry's
repository-declared expected set). Where those two sources disagree the page
wins on state and the gate set wins on membership.

Outcomes:

| Observed condition | Outcome |
|---|---|
| Every required check green | The CI gate passes; its citation carries the evaluated counts and the evaluated job count. |
| A required check failing, canceled or skipped | Refusal on the `merge.gate.<gate-id>.failed` family at exit 1, naming the gate id, the offending job name(s), and the delivered reason. |
| A required check queued or running (pending) | Refusal on the same family at exit 1, naming the gate id and the pending job name(s) with the pending reason. Pending is not green. |
| A required check absent from the page | Refusal on the same family naming the missing job(s). |
| The page reports a SHA other than the resolved head | The page is not head evidence: refusal with the delivered head-unresolved reason naming both SHAs, and never a pass. |
| The repository-declared expected job set cannot be read, or is empty, malformed, duplicated, or over the declared cap | Refusal naming the gate and the invalid-expected-set condition; never a pass. |
| The CI read faults (unreachable, malformed payload) | A named refusal naming the read operation; never a pass and never a silent skip. |
| A credential is unavailable or rejected | The declared credential or auth identity, naming the credential reference and the environment variable; never a gate pass and never `merge.transaction-aborted`. |

A persisted verdict that is already non-pass refuses with the `recorded`
attribution and cites the persisted gate, the job, and the verdict; a persisted
pass that the fresh page contradicts refuses with the `probe` attribution. The
two attributions remain the whole vocabulary. A job neither a declared
`required-ci-job` entry nor the CI entry's expected set names is never gate
evidence.

The merged report states the projection the run evaluated, not the verification
record's battery list: on success it renders `gates=2/2 passed` with one line per
merge-applicable entry and that entry's verdict and reason, so a landing says
which gates it **freshly evaluated**. The enforced set stays as delivered — all
five built-ins enter the merge path regardless of declared surface, which is what
keeps the recorded-verdict check reachable — so the report's two lines are the
fresh projection, not a claim that the other three were not enforced. This is the
same projection the dry run reports.

Authored gate sets keep the five built-in ids reserved and mandatory. A declared
built-in entry may not change a built-in's recipe or class; its `surface` must
lie in that built-in's admitted surface set — `battery` or `both` for
`ci-green`, `battery` alone for the other four — so declaring `ci-green` on the
`battery` surface is an explicit, reviewed opt-out from merge-surface CI
enforcement, and omitting a built-in's class adopts the shipped class. A declared
set that declares no required-check entry therefore declares an authored check
posture, and the dry run discloses the evaluated required-check count so the
posture is visible rather than silent.

The check gate gains no waivability: `--waive` keeps its delivered meaning for the
gates that carry a class binding, and the recorded remedy for a check gate the
repository cannot satisfy is the authored surface opt-out above — a reviewed
configuration act, not a per-invocation override. Pending checks converge by
waiting, and a failing check is repaired by its owner.

#### F-3 — Refusal diagnostics contract

Every refusal the merge command emits carries, in one rendering contract:

- a **dedicated `command=merge` field** — the command identity as its own
  rendered field, not a token that can be satisfied incidentally by a code
  prefix;
- a **dedicated `ref=<ref>` field** — the invocation's change ref as its own
  rendered field. The field always carries the invocation's ref: every merge
  refusal path is reached with a usable ref, so there is no empty-value branch
  and nothing about the field is left unasserted;
- a **dedicated `operation=<token>` field** — the read, citation source, or
  provider operation the refusal is about, drawn from a **closed vocabulary** of
  nine tokens plus `-`:
  - `github-work-item`, `github-check-runs`, `github-delivery-request-list`
    (either state filter on a delivery-request list read — the open list on the
    resolution path, the closed-state merged read on the convergence attempt),
    `github-delivery-request-detail` (the delivered single-request read the
    merge decision makes for mergeability, and its unknown-recovery re-read),
    `github-merge-delivery-request`, `repository-ci-workflow`,
    `delivery-registry`, `local-change-record-read`, `local-git-object-read`;
  - `-` when the refusal names no operation — a gate refusal, a stale evidence
    set, or a condition about the declaration's *value* rather than a read.

  The set is a declared **filter** over the delivered source-name vocabulary, not
  an unstated derivation: that vocabulary contributes `delivery-registry`,
  `repository-ci-workflow`, `github-check-runs`, `github-work-item`,
  `github-delivery-request-list` and `github-delivery-request-detail`; two of its
  members are excluded for stated reasons — `repository-head` (no checkout-head
  read exists on this path, and NFR-6 forbids one) and `pm-notes` (the change
  record is obtained as a git object, so the operation that can fail is a local
  read and the local tokens name it) — and the set adds the two local-read tokens
  the delivered vocabulary does not name, the one landing-operation token it does
  not name, and `-`. The detail token's membership follows the read path: the
  delivery-request list read is not the request-detail read (the list endpoint
  cannot carry mergeability), so the single-request mergeability read has its own
  token and is a member. Coverage is therefore total
  by construction: every provider read a refusal can cite has its token, a
  transport or provider fault names the operation it attempted (a fault of the
  merged-request read names `github-delivery-request-list`, and a fault of the
  mergeability read names `github-delivery-request-detail`), a landing fault
  names `github-merge-delivery-request`, a local read names its own source
  (`local-change-record-read`, `local-git-object-read`, or `delivery-registry`
  for the verification-state read), and a refusal with no operation renders `-`.
  The value is **rejected at the rendering site when it is not a member** — an
  out-of-vocabulary token is a rendering failure, never a value passed through
  into the summary — so the field is what makes "names the operation that failed"
  assertable without parsing the summary;
- the refusal code, and the gate id when the code is a family instance;
- the breached contract in operator terms (the candidate source ref and the
  change-record path at the head for a branch refusal; the change ref and the
  observed open and candidate counts for a request refusal — including a
  saturated page — and, on a convergence attempt, the observed matched request
  identities or the named read fault; each matched identity for a
  duplicate-request abort, none of them presented as *the* request; the work
  item that does not resolve; the gate and job that are not green; the operation
  that failed to read; the credential reference and environment variable that are
  unresolvable);
- bounded, secret-free evidence members, never raw payloads, titles, bodies, or
  log lines;
- an actionable remediation, or none at all — never an instruction to clear a
  condition the refusal does not name. The unverified-state row's remediation
  names the exact prior command and target: produce the verification with
  `verify gates <ref>` for the same work item, then re-run — never a bare
  "produce a verification".

The command, ref and operation fields are part of the contract because no
delivered refusal renders any of them as a field: the rendering is
`result=refused; condition=<code>` plus evidence lines, so implementing this
contract moves **every** refusal rendering — the human and scripted forms of all
five delivered refusal goldens — in the same change. No refusal code, category,
consequence, exit digit, or envelope property moves with them.

Credential refusals name the credential reference and the environment variable
exactly as the tracker family already does, and a credential condition is never
reported as `merge.transaction-aborted`. A tracker object that does not resolve
is reported by its own identity naming the object and the read operation, never
as the generic abort.

**A refused landing never reaches `merge.transaction-aborted`, and no landing
failure reaches an envelope as its raw port token.** The landing port's failure
is a closed identity set at the seam: **every** landing-port failure maps to
exactly one declared identity —

- `config.credential.missing` when no credential is available to attempt the
  landing, naming the reference and the environment variable;
- `provider.auth.rejected` when a credential was rejected;
- `provider.outage` when the failure is transient, a transport fault, or
  **unclassified** — an arbitrary or unrecognised port token is unclassified by
  definition and reports this identity;
- `merge.landing-unverified` when the landing fired but merged truth was not
  observed.

No other value may appear: the mapping is total, so a port failure can neither
surface as its own token nor fall back to the abort row. The abort row therefore
reaches exactly three causes, all requiring an operator act before a re-run can
converge: a **waiver-append failure** and a **declared landing gap** (both
**pre-mutation**) and **duplicate matching delivery requests (open or merged)**,
observed from the primary read or from the merged read's matched identities and
named by each duplicate identity rather than silently resolved by a selection. The cause removed from it
— the refused landing — reports the identities above in place of the abort, so no
converging landing fault is narrated by a row that claims no convergence.

**The regression the delivery keeps.** The delivered convergence cell that drives
the landing port with an arbitrary, undeclared code (the fixture's
`protection-rule`) keeps every behavioural assertion it makes today — exit 1,
`consequence: not_landed`, exactly one landing attempt, zero transaction records
after the refusal, and convergence at exit 0 on a plain re-run with exactly one
recorded transaction — and its
identity assertion moves from `merge.transaction-aborted` to `provider.outage`,
which is the declared identity for an unclassified port failure. That cell is what
proves an arbitrary port token can no longer reach an envelope: a pass-through
implementation re-pointed only in prose fails it by name.

`retryable` is always the emitted code's declared row value and never a
per-instance value, and a declared row may not carry `retryable: true` while any
cause reachable for that row requires an operator act before a re-run can
converge. Convergence that needs no act — a pending check — is carried by the
refusal's named reason and an accurate remediation, not by a different
`retryable`. `merge.transaction-aborted` therefore declares `retryable: false`
with a remediation that names the aborted pre-mutation condition and promises no
convergence — true of all three causes it reaches. The delivered convergence suite
asserts the row's old shape and moves with the row in the same change.

#### F-4 — Emitted-identity totality

The classifier's family resolution is delivered and stays exactly as it is: an
emitted code whose kind is `merge` and whose slot is a valid gate id resolves to
the declared family row. The gap is on the composition's side, and this change
closes it by giving the composition a **runtime family declaration** exported
beside its exact-member list — the declared family expression together with its
slot rule — so the composition's vocabulary states that a family emission is
admissible and `MERGE_COMPOSITION_EMITTABLE_CODES` plus that declaration are
runtime-exhaustive over every code the refusal branches emit. The totality proof
ranges over the runtime declaration and **fails by name when the declaration is
deleted or replaced by the bare exact-member list**; no source-text match remains
as the proof, so a behaviour-preserving refactor passes and a lost declaration
fails.

Closing the gap adds no second vocabulary and no second resolver: the family
expression is the contract's own declared prefix, suffix, and template, the slot
stays validated against the effective declared gate set at emission, and the
gate-id pattern is not widened. The already-declared family instance over
`ci-green` — `merge.gate.ci-green.failed` — is already in the derived population
and stays the live proof case once `ci-green` is merge-applicable. A mismatch
control still drives an undeclared code to the containment identity, so the
assertion cannot pass vacuously.

#### F-5 — Dry-run / real-merge object agreement

The dry run and the real merge resolve the change branch, the delivery request,
and the resolved head through the same resolution, so `merge <ref> --dry-run`
describes exactly the object `merge <ref>` would land. The dry run keeps its
delivered non-mutation contract: it appends one verification record whose head is
the resolved head, appends no waiver, transaction, or git mutation, and never
reports `result=merged` or `squash=`. Its reported data names the resolved
branch, the resolution source, the request identity, the observed candidate
count, the observed matched request identities on a convergence attempt, and the
resolved head, so a verdict recorded from an integration-base
checkout is visibly about the request's head rather than about the checkout. The
dry run reaches no landing decision, so it performs no mergeability read and no
landing call; its per-path provider-request counts are the live merge's up to and
including the convergence attempt. Both
reports state the same merge-applicable gate projection.

## 6. USER & SYSTEM FLOWS

```
Flow 1 — Coordinator merges from the integration base checkout.
  Coordinator (on the base branch) runs `merge GH-366`.
    -> one bounded open-request list read; that page carries only open requests
       and no mergeability fields
    -> candidate set: open entries whose source ref follows the declared
       convention for GH-366 (at most three); the request is the entry whose
       source ref equals the resolved branch exactly
    -> if the primary read has no match: one bounded merged-request read (the
       convergence attempt) — the delivered read, verbatim (its work-item-ref
       filter and its deterministic selection), with the additive
       matched-request-identities member
       -> exactly one matched identity: replay from provider truth here — exit 0,
          replayed=true, no record read, no declaration needed
       -> more than one matched identity: merge.transaction-aborted naming each
          matched identity (exit 1) — never a silent choice, none presented as
          *the* request
       -> empty identity set (member present and empty): merge.request-unresolved
          with no-open-request — a decidable zero
       -> the read faulted (transport/auth/payload): provider.outage naming
          operation=github-delivery-request-list — a distinct outcome, never
          no-open-request
    -> otherwise each candidate's change record read at its own asserted head
    -> exactly one candidate declares that same branch: resolution
       source=declared-at-head
    -> resolved head = that request's asserted full-SHA head
    -> freshness envelope: record head must equal the resolved head
       -> no fresh record for that head: merge.state-unverified (exit 2),
          remediation naming `verify gates GH-366` for the same work item
       -> record for the base tip: merge.gates-stale with both SHAs (exit 1)
       -> fresh record for the resolved head: continue
    -> probe: work item and check-run page on the resolved head
    -> merge-applicable projection (ci-green, tracker-freshness) evaluated
    -> required-check set evaluated per job on the fresh page
       -> any not green: merge.gate.<id>.failed naming the gate and job(s) (exit 1)
       -> all green + tracker gate fresh: mergeability from the single-request
          read of the resolved request (the list page cannot carry it) — a clean
          request lands; merge.mergeability-unknown only when the single
          request's state cannot be established (an unknown-recovery re-read
          re-reads the single request, never the list)
          -> one guarded landing at the resolved head
          -> refused or faulted: config.credential.missing (no credential),
             provider.auth.rejected (rejected credential) or provider.outage
             (transient/transport/unclassified), naming
             operation=github-merge-delivery-request
          -> landed but merged truth not observed: merge.landing-unverified
          -> never merge.transaction-aborted for a landing (that row reaches only
             the waiver-append failure, a declared landing gap, and duplicate
             matching delivery requests) and never the landing port's own token
    -> result=merged, gates=2/2, command=merge ref=GH-366 operation=<token>
       in any refusal
```

```
Flow 2 — The change record at the request head declares no branch.
  Coordinator runs `merge GH-366`.
    -> one open-request list read; not a converged re-run; candidate set resolved
    -> candidate record read at its asserted head: a mapping with no `branch` key
    -> merge.branch-unresolved (exit 1), reason=declaration-missing, naming the
       candidate source ref, the tree path at that head, and the `branch` key
    -> exactly that one provider read (the open-request list) and no
       merged-request read at all — a run with a candidate never attempts
       convergence — zero landing calls
    -> remediation: declare the branch on the change record and push it to the
       change branch
```

```
Flow 3 — The request head's object is not in the local object database.
  Coordinator runs `merge GH-366` in a fresh clone that never held the branch.
    -> one open-request list read; the request and its full-SHA head are known
    -> the local record read cannot observe the object
    -> merge.branch-unresolved (exit 1), reason=record-unreadable, naming the
       candidate source ref and the attempted tree path
    -> no fetch, no second provider read for the missing object, no fallback to
       the working tree, no convention-only acceptance
    -> remediation: make the head object present locally, then re-run
```

```
Flow 4 — A required check is pending at merge time.
  Coordinator runs `merge GH-366 --dry-run`, then `merge GH-366`.
    -> dry run: CI gate fail, reason ci-pending, pending job named; exit 1
    -> live merge after the check finishes red: probe attribution, job named; exit 1
    -> live merge after the check finishes green: gates pass, landing fires once
```

```
Flow 5 — A credential is absent.
  Coordinator runs `merge GH-366` with no token in the environment.
    -> the open-request list read reports the credential condition
    -> config.credential.missing at exit 1, command=merge ref=GH-366
       operation=github-delivery-request-list, naming the reference, the
       environment variable, and the operation that needed it
    -> never merge.transaction-aborted; zero landing calls
```

```
Flow 6 — Merged truth is ambiguous.
  Coordinator runs `merge GH-366` where the primary open read has no match and the
  delivered merged-request read exposes more than one matched identity.
    -> one bounded open-request list read, then one bounded merged-request read
       (the convergence attempt) — three provider requests on the run, counting
       the read's own delivered review-thread query for the selected request
    -> more than one matched identity: the run aborts rather than taking the
       delivered selection
    -> merge.transaction-aborted (exit 1), not_landed, retryable=false, naming
       each matched identity and presenting none as *the* request
    -> zero change-record reads, zero record-read git invocations; no fetch
    -> remediation: establish a single merged request for the change and re-run
```

```
Flow 7 — The merged-request read faults.
  Coordinator runs `merge GH-366` where the primary open read has no match and the
  merged-request read fails (transport, auth, or an unparseable payload).
    -> the read's failure is a distinct outcome, never folded into zero
    -> provider.outage (or the delivered payload-invalid mapping) naming
       operation=github-delivery-request-list, at exit 1
    -> never merge.request-unresolved / no-open-request: the remediation is a
       plain re-run, not "open a conforming request"
    -> two provider requests spent (the open list and the failed merged read)
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- Change-branch resolution from the change record **read at the candidate
  delivery request's asserted head**, including the bounded local tree/blob read,
  the candidate set, its cap and saturation guard, the exact-equality acceptance,
  the closed reasons and their precedence, and the removal of the checkout-branch,
  checkout-head, branch-name-parsing and working-tree change-record reads from the
  merge path.
- The **convergence attempt**: one bounded merged-request read — the delivered
  `findMergedDeliveryRequest` at `TRUTH_PROVIDER_LIMIT`, used verbatim with its
  delivered work-item-ref filter and its delivered deterministic selection — taken
  only where the primary open read has no match, with one additive, optional
  member — the matched request identities — computed before that selection and
  carried on every match outcome, including the shared unavailable outcome (empty
  when the page matched nothing, absent when the page could not be read); exactly
  one identity replays, the empty set refuses `no-open-request` as a decidable
  zero, more than one refuses `merge.transaction-aborted` naming each matched
  identity rather than choosing silently, and a faulted read refuses the declared
  provider identity as a distinct outcome — while the delivered read's output for
  closeout stays unchanged (it ignores the member), and the read's own delivered
  review-thread query is counted in the budget, never suppressed for the merge
  caller.
- The merge decision's mergeability read: the landing guard reads the delivered
  single-request read of the resolved request (the request located on the
  open-list page), because the list endpoint cannot carry mergeability; an
  unknown-recovery re-read re-reads the single request, never the list.
- The `merge.state-unverified` remediation content: the row names the producing
  command and target — `verify gates <ref>` for the same work item, then re-run.
- Binding the verified head, the freshness envelope comparison, the landing's
  expected head, and the reported head to the resolved delivery-request head.
- Making `ci-green` merge-applicable in the shipped default set, deriving the
  merge-applicable required-check set, and evaluating it per job through the
  single delivered mapping on the fresh page with `recorded`/`probe` attribution.
- Reporting the merged report's gate projection as the merge-applicable
  projection the run evaluated.
- The admitted-surface rule for declared built-in entries, and the disclosure of
  the evaluated required-check posture.
- The refusal-diagnostics contract including the dedicated `command`, `ref` and
  `operation` rendering fields with their closed vocabulary and its rejection rule,
  the retryability rule, the closed landing-fault identity set, the three additive
  `merge` rows (`merge.branch-unresolved`, `merge.request-unresolved`,
  `merge.work-item-unresolved`) with their closed reason vocabularies, and the
  narrowed abort row's three act-requiring causes (a waiver-append failure, a
  declared landing gap, and duplicate matching delivery requests).
- Emitted-identity totality for the gate family: a runtime family declaration
  beside the exact-member list, with the totality proof ranging over that
  declaration and the classifier's delivered family resolution untouched.
- Dry-run / real-merge object agreement.
- Reconciliation of the merge feature spec, the merge test specification, the
  merge reference page, the non-functional specification's merge read-budget row,
  the change-lifecycle and change-convention guidance, and the PM instruction
  surface with the amended contract, and the release note.

### 7.2 Out of Scope

- [OUT] The ticket body's family-wide command battery over `dispatch`, `loop`,
  `merge`, `closeout`, `queue`, `phase`, `verify`, `blockers`, `board`, `brief`,
  `metrics`, `spend`, and `provider` on the installed binary. This change claims
  only the `merge` slice plus the diagnostics contract it proves; the remainder is
  explicitly **not** claimed green, the `merge` slice itself is proven by
  in-process suites, **no installed-binary end-to-end conformance run is
  claimed**, and no follow-up ticket is created.
- [OUT] Any branch-protection required-status-contexts read or any other new
  provider operation. The closed-state merged-request read is **not** a new
  operation: it is delivered today and is reused verbatim, gaining only one
  additive, optional member — the matched request identities, derived from the
  page the read already holds — that its other consumer, closeout, ignores; the
  merge decision consumes the delivered single-request read the verify-gates
  family already uses. No endpoint, scope, credential, or capability is added and
  no second source of merged truth is introduced.
- [OUT] Changing the battery's `ci-green`, `push-parity`, `squash-preflight`,
  `owner-gate`, or `lifecycle-finalization` evaluations, or their goldens.
- [OUT] Making `verify gates` resolve its branch from the change record (the
  battery keeps its delivered resolution; see OQ-3).
- [OUT] Automatically maintaining the change-record branch declaration (OQ-1).
- [OUT] Waiver-policy change, owner-gate classification change, new waiver
  classes, or a per-invocation override for the check gate.
- [OUT] Any new landing, refresh, force, bypass, queue, retry, or head-mutation
  capability.
- [OUT] `verify deploy`'s declared target-resolution residual.

### 7.3 Deferred / Maybe-Later

- A branch-declaration writer in the change-lifecycle commands, so the
  declaration never has to be authored by hand (OQ-1).
- **A fetch policy for a request head object the invocation's object database
  does not hold.** The run refuses `record-unreadable` today; adding a fetch is a
  network operation with its own credential and failure surface and needs its own
  decision (OQ-4, RSK-9).
- Branch resolution from the change record on the battery side, so a verification
  record can be produced from any checkout with the same fidelity as the merge
  (OQ-3).
- A provider capability for required status contexts, if one becomes exercisable
  through the delivered adapter surface.
- A multi-workflow expected-job union if repositories declare CI in more than one
  workflow file (OQ-2).
- **Adopting the merge path's refuse-on-multi-match rule for the shared
  merged-request read's other consumer.** Closeout keeps its delivered ranked
  single selection in this change (it ignores the additive identities member);
  whether
  closeout should also refuse on more than one merged match is a closeout decision,
  not a merge one (OQ-6).

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

No HTTP surface is added. The changed contract surfaces are command-level:

| ID | Surface | Contract change |
|----|---------|-----------------|
| API-1 | `merge <ref>` | Resolves the change branch from the declaration read at the delivery request's asserted head, binds the verified head to that request's head, evaluates the merge-applicable required-check set on that head, and refuses by name on every non-green, unreadable, or unresolvable condition. Added machine data: resolved branch, resolution source (`declared-at-head`), matched request identity, observed candidate count, the observed matched request identities on a convergence attempt, resolved head, a convergence flag (`replayed=true` for an already-merged request, which carries no resolution source and resolves no candidate), evaluated required-check count and set size. Delivery-request provider requests are declared per path and peak at **3**: the bounded open list on every run; the delivered single-request read for mergeability when the run reaches the landing decision (the list endpoint cannot carry mergeability); at most one bounded merged-request read taken only where the primary open read has no match, which uses the delivered read verbatim, decides from its matched identities (one replays, the empty set refuses `no-open-request` as a decidable zero), aborts `merge.transaction-aborted` when more than one identity is observed, and reports a faulted read as the declared provider identity naming `operation=github-delivery-request-list` — never as `no-open-request`. Per path: refusals decided before the merge decision spend 1; an open-page-only run reaching the merge decision spends 2; a convergence attempt with nothing matching spends 2; a match-bearing attempt (replay or duplicate abort) spends 3, counting the read's own review-thread query, which no option suppresses. The merged report states the merge-applicable projection the run evaluated (`gates=<passed>/<total>` over the two merge-applicable entries, one line per entry with its verdict and reason) and does not echo the verification record's battery gate list. |
| API-2 | `merge <ref> --dry-run` | Same resolution as `API-1`, including the same convergence attempt and the same per-path delivery-request counts up to the merge decision (1 on a resolved dry run; 2 with nothing matching on a convergence attempt; 3 on a match-bearing attempt, the read's own query counted); the dry run reaches no landing decision, so it performs no mergeability read and no landing call; reports the same resolved object and the same merge-applicable gate projection; appends exactly one verification record for the resolved head; still performs zero mutations and never reports `result=merged` or `squash=`. |
| API-3 | Refusal envelope | `error.code` is the stored identity or the family instance — never a raw landing-port token; `error.summary` renders a dedicated `command=merge` field, a dedicated `ref=<ref>` field carrying the invocation's ref, a dedicated `operation=<token>` field drawn from the closed vocabulary and **rejected at the rendering site when it is not a member** (with `-` the only value for a refusal that names no operation), the code, the breached contract, and the offending object; evidence members are bounded and secret-free; `retryable` is always the emitted code's declared row value, and no row declares `true` while a cause it reaches needs an operator act before a re-run can converge; the unverified-state row's remediation names the producing command and target — `verify gates <ref>` for the same work item, then re-run. A landing fault reports exactly one declared identity — `config.credential.missing`, `provider.auth.rejected`, `provider.outage` (transient, transport, or unclassified) or `merge.landing-unverified` — and never `merge.transaction-aborted`. |

### 8.2 Events / Messages

| ID | Event | Contract change |
|----|-------|-----------------|
| EVT-1 | `merge.gate-verification` record (`delivery.merge.gate-verification.v1`) | Schema and record kind unchanged. Content changes: a `merge --dry-run` record now carries a CI gate entry alongside the tracker entry, and that entry's citation declares the sources it actually read (the declared CI-workflow source and the check-run page), so a reader can distinguish a merge-surface CI evaluation from a battery one. Records produced by `verify gates` are unchanged. |
| EVT-2 | Capsule and delivery-registry events | Unchanged: no new event kind, key, or schema. Resolution facts are reported in command data, not persisted as a new event. |

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Change-record `branch` declaration | One additive top-level key on the change's pm-notes document. Read **at the candidate delivery request's asserted head** through one bounded local tree/blob read and the delivered parse; never through the working tree. The value is a string of at most `MERGE_BRANCH_DECLARATION_MAX_CHARS = 256` characters carrying no whitespace or control character, and it must equal its own request's provider-asserted source ref exactly. Preserved value-faithfully by every document-writing branch, opaque to lint, and read by no other surface. No fallback derivation, no truncation. |
| DM-2 | Resolved change context | Non-persisted derived facts reported in command data: resolved branch, resolution source (`declared-at-head` on a successful resolution), matched delivery-request identity, observed candidate count, the observed matched request identities on a convergence attempt (the shared read's additive member; any count is derived from it), resolved head, a convergence flag (`replayed`, true only for an already-merged replay, where the resolution fields are absent), evaluated required-check count and set size, and the merge-applicable gate projection rendered in the report. Bounded; never a stored record. |
| DM-3 | Merge-applicable gate membership and admitted surfaces | Contract data: the shipped default set's merge-applicable membership becomes two entries; each reserved built-in gains a declared admitted surface set; a built-in's declared class may be omitted to adopt the shipped class. No identity, schema-version, recipe, or configuration-key change. |

### 8.4 External Integrations

- GitHub commit check-runs read: unchanged operation, now consumed for the CI
  gate's per-check state on the resolved head on the fresh path.
- GitHub delivery-request reads: three delivered operations, all bounded and
  unpaginated. The **open-list** read supplies the candidate set and the resolved
  head, and is spent on every run. The **single-request** read — delivered and
  already consumed by the verify-gates family — supplies mergeability for the
  landing decision, because the list endpoint cannot carry mergeability fields;
  it is spent only by a run that reaches the landing decision, and an
  unknown-recovery re-read re-reads it, never the list. The **merged-request**
  read (the delivered closed-state read) supplies merged truth and is spent at
  most once, only when the primary open read has no match: it is used verbatim
  with its delivered work-item-ref filter and its delivered deterministic
  selection, and gains one additive, optional member — the matched request
  identities — computed before that selection and carried on every match outcome,
  including the shared unavailable outcome (empty when the page matched nothing,
  absent when the page could not be read). The read's own delivered review-thread
  query for the selected request stays part of its sequence and is counted in the
  budget; no option suppresses it for the merge caller. Closeout ignores the
  member, so its behaviour and output are unchanged; more than one matched
  identity aborts on the merge path rather than being silently selected, and a
  faulted merged read is reported as the declared provider identity rather than
  as an empty result. No run performs both a resolution and a convergence read.
- No new endpoint, capability, scope, or credential reference is introduced. The
  change-record read is a local git object read: no network, no credential.
- Credential handling is unchanged; the refusal merely names the reference and the
  environment variable.

### 8.5 Backward Compatibility

- The effective gate-set identity (schema version plus entry-id sequence) is
  unchanged, so existing verification records stay consumable and no change is
  forced to re-verify.
- Existing authored `merge.gates` declarations remain valid: a built-in declared
  on the `battery` surface stays accepted (and is the documented check-gate
  opt-out), and an omitted built-in class adopts the shipped class.
- Existing refusals keep their codes, categories, consequences, exit digits, and
  envelope properties; three additive rows appear at exit 1
  (`merge.branch-unresolved` and `merge.request-unresolved` at `not_landed` and
  `retryable: false`, `merge.work-item-unresolved` likewise).
  **Every refusal's rendered summary changes**, because the dedicated `command`,
  `ref` and `operation` fields are new: the human and scripted forms of all five
  delivered refusal goldens move in this change, while their codes and exits do
  not.
- The merged report's gate list changes meaning: it states the merge-applicable
  projection the run **freshly evaluated** rather than the verification record's
  battery gate list, so a successful landing reports `gates=2/2` with two gate
  lines where it previously echoed five. The enforced set is unchanged — all five
  built-ins still enter the merge path for the recorded-verdict check — so the two
  lines are the fresh projection, not a narrowing of enforcement. The dry-run
  report already describes the projection it evaluates.
- `merge.transaction-aborted` keeps its code, category, consequence, and
  projection, and is narrowed in use: it no longer carries credential conditions,
  unresolvable requests or work items, **and no longer carries a refused
  landing**. A landing fault reports exactly one declared identity —
  `config.credential.missing` when no credential is available to attempt the
  landing, `provider.auth.rejected` for a rejected credential, `provider.outage`
  for a transient, transport, or **unclassified** failure, and
  `merge.landing-unverified` when the landing fired but merged truth was not
  observed. The landing port's failure is closed at the seam, so the port's own
  token never reaches an envelope. The row reaches exactly three causes: a
  waiver-append failure and a declared landing gap (both pre-mutation) and
  duplicate matching delivery requests (open or merged), observed before any
  mutation and named by their duplicate identities. It declares
  `retryable: false` with a remediation naming the aborted pre-mutation condition
  and promising no convergence — true of all three causes it reaches. The delivered
  convergence suite asserts that row's old shape (a `retryable: true` expectation)
  and its refused-landing cell moves with the routing: its arbitrary undeclared
  port code now resolves to `provider.outage`, while its exit, `not_landed`
  consequence, single landing attempt, zero transactions and re-run convergence are
  kept unchanged.
- The landing decision's mergeability source changes: the delivered composition
  reads the request through the list-shaped read that cannot carry mergeability,
  so every ready request today refuses `merge.mergeability-unknown`; the merge
  decision now reads the delivered single-request read of the resolved request, so
  a clean request lands and the refusal is reachable only when the single
  request's mergeability state cannot be established. No code, exit, category, or
  envelope property of that row moves.
- `merge.state-unverified` keeps its code, exit, and category, and its remediation
  becomes specific: it names the producing command and target — produce the
  verification with `verify gates <ref>` for the same work item, then re-run —
  instead of "produce a verification".
- `--waive`, waiver authorization, owner-gate classification, the landing
  mechanism, the mutation vocabulary, and the persisted record schemas are
  unchanged.
- A change whose declaration cannot be established at its request head now
  refuses `merge.branch-unresolved` — the one behaviour a repository must adopt,
  with the refusal naming exactly what to add. A converged re-run for an
  already-merged request needs neither a record nor a declaration.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Determinism | 20 consecutive runs over identical fixtures are byte-identical for one success and six refusals (branch unresolved with `declaration-missing`, branch unresolved with `record-unreadable`, request unresolved, gate failure, pending check, credential missing); a changed-fact control differs. |
| NFR-2 | Read budget | Per invocation, delivery-request provider requests are declared **per path**, counting every request each read itself issues — the merged read's delivered review-thread query included — and peak at **3 on any run**; no option may suppress that query for the merge caller. Every run spends the bounded open-list read — the delivered `listDeliveryRequests` at `TRUTH_PROVIDER_LIMIT` with gate facts. Refusals decided before the merge decision — `merge.branch-unresolved` in all causes, `ambiguous-open-request`, `head-unresolved`, a duplicate-open abort, `merge.state-unverified`, `merge.gates-stale`, a gate refusal, `merge.work-item-unresolved` — spend exactly 1. An open-page-only run reaching the merge decision spends 2: the open list plus the delivered single-request read for mergeability (the list endpoint cannot carry it); a faulted merged read spends 2 and is a distinct outcome. A convergence attempt — the delivered `findMergedDeliveryRequest` at `TRUTH_PROVIDER_LIMIT`, used verbatim, taken only when the primary open read has no match — spends 2 with nothing matching and 3 when it matches (the open list, the closed scan, and the read's own review-thread query), on the replay path and the duplicate-merged abort path alike. Beyond those: at most `MERGE_BRANCH_CANDIDATE_MAX` = 3 bounded local change-record reads (each at most two fixed-argv git invocations), one work-item read, one CI-workflow read, one check-run page on the resolved head, one verification-record read; at most one post-refusal re-read and one unknown-recovery re-read, which re-reads the single request, never the list; ≤ 1 landing call; zero retries, zero pagination, zero fetches. |
| NFR-3 | Output bounds | Machine `data` ≤ 65 536 UTF-8 bytes; human summary ≤ 24 lines and ≤ 4 096 UTF-8 bytes; every dropped item marked `+N`; no new unbounded field. |
| NFR-4 | Offline determinism | Zero network calls in every new suite; the new suites spawn no real child process (the local record read and the git seam run through the injected child runner); the existing no-live-call guards stay green. |
| NFR-5 | Refusal completeness | 100 % of refusals across the enumerated matrix (≥ 18 cases) render the dedicated `command`, `ref` and `operation` fields, the code, at least one named cause, and an actionable or absent remediation; every `operation` token is a member of the nine-token closed vocabulary or `-`, and the rendering site **rejects** an out-of-vocabulary token rather than passing it through, so 0 tokens outside the set are rendered; 0 refusals carry an instruction to clear an unnamed condition. |
| NFR-6 | No ambient read | 0 reads of the checkout's branch **and 0 reads of the checkout's head** on the merge path, 0 working-tree change-record reads, and 0 fetch/pull invocations, proven by a production-source scan with a mandatory failing control. |
| NFR-7 | Identity totality | 100 % of emitted codes resolve to a declared row or the declared family, with the family slot validated against the effective gate set; the proof ranges over the runtime family declaration and fails by name when it is removed; no pattern widening; a live mismatch control still reaches the containment identity. |
| NFR-8 | Identity stability | The effective gate-set id sequence equals the pre-change sequence. Documented and machine error identities move together on the synced base: **169 → 172** machine entries, **168 → 171** delivered rows, **68 → 71** two-segment allowlist members, arithmetic **`BASELINE_ROWS.length + 136` → `+ 138`**, and the `merge` kind from **9** to **12** concrete rows; the reference page, feature spec, test specification, and the phrase-table authority state the same counts in the same change. The phrase table rotates with them: **167 stays a banned stale total**, the outgoing arithmetic base `+ 136` joins the legacy forms, and the incoming `+ 138` is published as the live arithmetic rather than left as a legacy token. Recounted under owner ruling **CEO-D-116** (2026-11-22): the ruling adds no error identity — the merged read's fault maps to the delivered provider identities, the mergeability read consumes the delivered single-request read, and the restored detail token is a rendering-vocabulary member, not a table row. The arithmetic base is stated from the delivered tree's own outgoing-totals record — **169 → 172 machine entries and 168 → 171 delivered rows** — with `+136` → `+138` (the baseline absorbs one row while the table grows three); the delivered state holds at those anchors, verified by the green error-table sync (**172 entries / 172 documented**), the sync suite's pins (**172 documented / 171 delivered / `+138` / allowlist 71**), the doc-conformance required strings, and the green full aggregate gate; the earlier anchors were measured on a stale pre-change base one too high. |
| NFR-9 | Secret hygiene | 0 occurrences of any credential value, title, body, comment, raw payload, or log line in output or records, verified with canary secrets. |
| NFR-10 | Latency and read shape | The open-list read the request resolution needs anyway is the floor; the change adds **at most two delivery-request provider requests beyond it**, per path: the delivered single-request mergeability read on a run that reaches the landing decision, or the bounded merged-request read on a convergence attempt — where a match-bearing attempt adds one more (the read's own review-thread query, never suppressed for the merge caller). All delivery-request reads are bounded and unpaginated; the record reads are local, bounded (≤ 3 reads, ≤ 2 fixed-argv git invocations each, 262 144 bytes each) and network-free. Every refusal decided before the merge decision performs one delivery-request provider request and no other — `record-unreadable` included, which adds only the failed local read; a duplicate-open abort spends one; a duplicate-merged abort spends three (it is match-bearing); a faulted merged read spends two and refuses the declared provider identity, never `no-open-request`. No added polling or waiting. |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- The merged report and the dry-run report expose the resolved object (branch,
  resolution source `declared-at-head`, request identity, observed candidate
  count, the observed matched identities on a convergence attempt, resolved head,
  or `replayed=true` for an already-merged replay) and
  `gates=<passed>/<total>` over the merge-applicable projection the run
  **freshly evaluated**, so a coordinator can see both which object a verdict is
  about and which gates the merge evaluated fresh. The enforced set — every
  built-in, including the recorded-verdict check — stays as delivered and is not
  what the two reported lines describe. The merged report does not echo the
  verification record's battery gate list; the record's own gates remain readable
  in the verification record.
- Every refusal's rendering carries the dedicated `command=merge`, `ref=<ref>`
  and `operation=<token>` fields beside its code, so a refusal is attributable to
  a command, a change, and a named read without parsing evidence prose, and the
  closed `operation` vocabulary makes read-fault rates countable per source. A
  token outside that vocabulary is rejected at the rendering site, so a
  read-fault count can never be polluted by a free-text source name.
- Every refusal's code is the observable signal; the additive rows make the
  previously indistinguishable causes separable in aggregation, and the closed
  branch reasons make "the declaration could not be established" separable from
  "the declaration says the wrong thing". The three request reasons make "nothing
  was open" and "the open set is ambiguous" separable, while a duplicate matching
  delivery request is countable under the abort row's duplicate cause; a faulted
  merged-request read is countable under the declared provider identity with
  `operation=github-delivery-request-list`, never under `no-open-request`, so a
  provider fault can never pollute the nothing-was-open count; the family
  instance keeps the gate id in the code, so gate refusals are countable per gate
  without parsing prose. A landing fault is countable by its declared identity,
  never by a port token.
- The verification record's citation names the sources it read, so a CI verdict
  in a record is attributable to its evaluation surface.
- No new metric stream, log sink, record kind, or trace span is introduced; the
  capsule and registry event vocabulary is unchanged.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | In-flight changes whose change record, read at their request head, declares no branch refuse `merge.branch-unresolved` | M | H | The refusal names the candidate source ref, the tree path at that head and the key; the PM instruction surface and the change-convention guide document the declaration, its cap and its refusal vocabulary; this change declares its own branch in the same delivery | Other open changes must add the one-line declaration on their branch before they can merge; a converged re-run needs none |
| RSK-2 | Enforcing the repository-declared expected job set blocks merges in repositories with permanently conditional or skipped jobs | M | M | The checked remedy is the authored `surface: battery` opt-out; the dry run discloses the evaluated required-check count; the refusal names the skipped job | A repository that opts out loses merge-surface CI enforcement |
| RSK-3 | The expected-job set is read from the checkout's workflow while the verified object is the request head, so a job that exists only on the head is not required evidence | M | M | The page-versus-expected comparison surfaces the gap as a named missing-job condition; the docs state that a change-branch checkout gives exact fidelity | A head-only job is not enforced until the checkout contains it |
| RSK-4 | Blocking on pending checks increases merge latency and may push operators toward unrelated overrides | L | M | Pending refusals name the pending job and state that the condition converges without an act; no override exists for the check gate | Repeated waiting remains an operator cost |
| RSK-5 | New rows, changed remediation text, the changed abort-row value, the moved refusal renderings, and a changed default set drift between the machine table, the documented table, the reference page, and the test specification | M | M | One change moves all four with the pinned-count requirement in NFR-8 and the existing sync checks; the golden set is declared per file | None once gated; a partial delivery fails the gate |
| RSK-6 | The runtime family declaration could be written as pattern widening, accepting gate ids the effective set does not declare — or could drift from the classifier's delivered family resolution and become a second vocabulary | H | L | NFR-7 pins slot validation against the effective gate set and forbids widening; the declaration reuses the contract's prefix/suffix/template and adds no resolver; the proof ranges over the runtime declaration and the mismatch control proves the containment identity still works | None accepted |
| RSK-7 | The admitted-surface rule for built-ins is read as licence to weaken other built-ins | M | L | Only `ci-green` gains `both`; the other four keep `battery` alone; the opt-out is visible in configuration and reviewed | A repository may still opt out of CI enforcement by declaration |
| RSK-8 | A dry run executed from the integration base produces a record about the request head, which an operator may mistake for a checkout verification | L | M | The data names the resolution source and the resolved head; the docs state that the record describes the request, not the checkout | Operator confusion on a first run |
| RSK-9 | The invocation's object database does not hold the request head's object (a fresh, shallow, or base-only clone), so the declaration cannot be read and the run refuses `record-unreadable` | M | M | The refusal names the candidate source ref and the attempted tree path, and its remediation states that the object must be present locally; no fetch is added and no convention-only fallback exists, so the same provider state never resolves differently in two clones | A base-checkout run in a clone without the branch object cannot merge until the operator makes the object present; the fetch policy is deferred (OQ-4) |
| RSK-10 | The candidate filter hides a legitimately named branch that does not follow the repository's `<type>/<REF>/<slug>` convention, so the run refuses `no-open-request` | L | L | The convention is already declared and already used by the closeout resolution; the refusal names the convention and the change ref, so the repair (rename, or open a conforming request) is explicit | A non-conforming workflow must conform or re-decide the candidate rule |
| RSK-11 | A read leaks onto a path that should not pay for it — the convergence read onto the resolution path, or the mergeability read onto a run that refuses earlier — so an ordinary run silently exceeds its declared per-path count and the budget becomes false again | M | M | NFR-2 and NFR-10 pin the per-path counts (1 for every refusal decided before the merge decision; 2 for an open-page-only run reaching the merge decision and for an empty convergence attempt; 3 for a match-bearing attempt, the merged read's own review-thread query counted and never suppressible), the attempt is reached only from a no-match primary read, and the read-count assertions are per path rather than per run | A future refactor that reorders the attempt or the mergeability read re-opens the budget claim |
| RSK-12 | One shared merged-request read serves two behaviours: the merge path aborts on more than one match while closeout keeps its delivered ranked selection and ignores the additive identities member, so a change in either consumer can move the other | M | M | The closeout behaviour is named as unchanged and out of scope; the merge path reads the matched identities before any selection and never inherits a selection when more than one identity is observed; the regression suite pins both behaviours against the same read | A future unification decision (OQ-6) would revisit both |
| RSK-13 | An arbitrary landing-port token reaches an envelope once the abort wrapper is removed, so a landing fault resolves to no declared row | M | M | The landing-fault identity set is closed at the seam with a total mapping (`config.credential.missing`, `provider.auth.rejected`, `provider.outage` for the unclassified case, `merge.landing-unverified`); the delivered convergence cell that drives an arbitrary undeclared code keeps its behavioural assertions and asserts the declared identity, so a pass-through fails by name | A new landing failure class must be given a declared identity before it can be emitted |
| RSK-14 | The landing decision's mergeability premise regresses: a change re-entangles the mergeability fact with the list-shaped read that cannot carry it, so every ready request refuses `merge.mergeability-unknown` again; or the single-request read faults and the fault is mis-routed to a request reason | M | M | The merge decision reads the delivered single-request read of the resolved request, and AC-F1-7 pins the oracle (a list payload without mergeability fields plus a clean single request must land); an unknown-recovery re-read re-reads the single request, never the list; a fault of that read resolves to the declared provider identity naming `operation=github-delivery-request-detail`, never to `no-open-request` or the abort row | A provider change to the single-request read's shape would need its own named mapping |

## 12. ASSUMPTIONS

- The change ref identifies both the tracker work item and the change folder, and
  the folder exists only on the change branch; the change record is therefore read
  at a candidate head, never from the invocation's working tree.
- The delivery workflow creates the change branch in the operator's clone (or the
  operator has fetched it), so the request head's object is normally present
  locally; the merge path adds no fetch, and an absent object is a named refusal
  (RSK-9, OQ-4).
- Exactly one open delivery request's source ref follows the repository's declared
  `<type>/<REF>/<slug>` convention for the change ref and declares that same
  branch; a second open entry matching one resolved branch is a duplicate this
  change aborts rather than silently selecting, and a non-conforming branch is
  refused rather than guessed.
- Where no open request matches the resolved branch, at most one **merged** request
  does; more than one merged match is an anomaly the convergence attempt refuses by
  name (`merge.transaction-aborted`) rather than choosing the delivered selection.
  The merged read is bounded at `TRUTH_PROVIDER_LIMIT` and adds no pagination, so
  the change states no saturation-uniqueness claim about the closed page.
- The open delivery-request page is normalized with its page size already computed
  by the delivered list normalization, so open-page saturation is judged from that
  page; the merged read's additive matched-identities member is computed by the
  read itself from the page it already holds, before its delivered selection, and
  needs no second request. Neither is a new provider read; the read's own
  delivered review-thread query, by contrast, is a real provider request and is
  counted in the budget rather than suppressed.
- The delivered single-request read returns mergeability for a resolved request —
  the verify-gates family already consumes it successfully — so the landing
  decision can obtain mergeability without a new operation.
- A transport, auth, or payload failure of the merged-request read is observable
  as a fault at the read's own boundary, so it can be refused as the declared
  provider identity instead of being folded into an empty result.
- The repository declares its CI jobs in the workflow file the delivered
  expected-job read targets; a repository with no such workflow fails the CI gate
  explicitly (`ci-expected-jobs-invalid`) and has the surface opt-out as its
  declared remedy.
- The provider reports check runs for the resolved head commit; an empty or absent
  page is a named condition, not a pass.
- The persisted `ci-green` verdict refusal on the enforced set is delivered and
  stays; this change's repair is the fresh-page half, not the recorded half.
- The branch declaration is authored when the change is opened, and the PM
  instruction surface documents that obligation; this change does not add a writer
  (OQ-1).
- The tracker family's delivered precedent for naming a credential reference and
  an environment variable is the shape this change reuses; no new secret-bearing
  field is introduced.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | Delivered merge git seam (bounded, fixed-argv, local object reads at a commit) | Its existing tree-of-commit read is the precedent for the one change-record read at a candidate head: no shell, no network, no credential, and injectable for offline tests |
| Depends on | Delivered pm-notes parse (text in, path and parsed value out) | Applied to text obtained from the head; no new parser and no second document acquisition |
| Depends on | Delivered branch-convention predicate | The candidate filter reuses the repository's declared `<type>/<REF>/<slug>` rule; no second grammar |
| Depends on | Delivered CI-workflow expected-job read | Source of the repository-declared job set; already consumed by the battery's CI gate |
| Depends on | Delivered check-run page read | The only per-check state source; now consulted on the merge's fresh path |
| Depends on | Delivered delivery-request open-list read with source ref, head and gate facts | One read supplies the candidate set and the resolved head; it never supplies merged truth and cannot carry mergeability (the list endpoint returns no mergeability fields) |
| Depends on | Delivered single-request delivery-request read | Mergeability source for the landing decision; the verify-gates family already consumes this read successfully, so no new operation is introduced |
| Depends on | Delivered closed-state merged-request read, and its ranked single selection | Reused for merged truth on the convergence attempt: the merge path invokes it verbatim (its delivered work-item-ref filter and its delivered deterministic selection) at `TRUTH_PROVIDER_LIMIT`, and gains one additive, optional member — the matched request identities — computed before that selection and carried on every match outcome; it uses the delivered selection only when exactly one identity is observed and aborts when more than one is. Closeout ignores the member, so its ranked behaviour and output are unchanged; the read's own review-thread query is counted in the merge budget |
| Depends on | Delivered `evaluateRequiredJobGate` mapping and `recorded`/`probe` attribution | One mapping, no second evaluator |
| Depends on | Delivered error table (machine and documented) | Additive rows, the narrowed abort row, and the pinned totals move together |
| Blocks | Any change that expects `merge` to be runnable from the integration base | Those changes must declare `branch` on their change record, unless their request is already merged |
| Blocks | The remainder of the ticket body's family-wide battery | Explicitly not claimed (see §7.2) |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | Should a delivery command write the change-record `branch` declaration so no change relies on a hand-authored line? | This change requires the declaration to be establishable at the request head and refuses when it cannot be, but adds no writer. A writer belongs to the change-lifecycle commands, not to `merge`, and would need its own scope decision. | Deferred; decision needed: consult `@decision-advisor` (TDR-0071 scope) |
| OQ-2 | If a repository declares CI across several workflow files, is the expected job set the union of all of them? | The delivered expected-job read targets one declared path. Widening it is a capability change with its own fidelity questions and is not required by this slice. | Deferred; decision needed: consult `@decision-advisor` (TDR-0072 scope) |
| OQ-3 | Should `verify gates` also resolve the change branch from the change record so a fresh record can be produced from any checkout with merge-equivalent fidelity? | This change binds the merge path only. Making the battery record for a requested head from a base checkout is the natural follow-on, but it changes battery semantics and goldens. | Deferred; decision needed: consult `@decision-advisor` |
| OQ-4 | Should the merge path fetch a request head object the invocation's object database does not hold, instead of refusing `record-unreadable`? | A fetch turns a local fail-closed refusal into a network operation with its own credential, timeout, and failure surface, and would make the same provider state resolve differently in two clones unless carefully bounded. The run refuses today and names the repair. | Deferred; decision needed: consult `@decision-advisor` (TDR-0071 revisit trigger) |
| OQ-5 | Do any runtime consumers (as opposed to prompt prose or runbooks) treat `merge.transaction-aborted` as a generic "merge blocked" signal? | The three additive rows split the causes it used to swallow, its `retryable` becomes `false`, and a refused landing leaves it for `config.credential.missing` / `provider.auth.rejected` / `provider.outage` / `merge.landing-unverified`. A consumer keying on the literal would lose a signal it must re-express over the new vocabulary. | Deferred; owner: `@pm` at the PR review |
| OQ-6 | Should closeout adopt the merge path's refuse-on-multi-match rule for merged requests, instead of its delivered ranked single selection? | One shared merged-request read now carries two behaviours: closeout ranks several matches by entity id and deliberately ignores the additive matched-identities member, while the merge path aborts when more than one identity is observed. Both are correct for their owners, but the divergence is a decision a closeout owner should take rather than a merge side-effect. | Deferred; decision needed: consult `@decision-advisor` |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | The change branch has exactly one source: a `branch` declaration on the change's pm-notes, **read at the delivery request's asserted head** through one bounded local tree/blob read. No derived fallback, no working-tree read, no ambient read; a declaration that cannot be established refuses `merge.branch-unresolved` with a closed reason. | The declaration is the reviewable authority, and a declaration the run cannot read is a refusal generator: the change folder exists only on the change branch, so a working-tree read cannot satisfy the base-checkout invocation the capability exists for. Reading at the head keeps one authority and moves only the read's address; the delivered parse and the delivered convention predicate are reused, and the provider list supplies an address rather than a value. Record: TDR-0071. | 2026-11-20 |
| DEC-2 | The resolved delivery request's asserted head is the resolved head: the freshness envelope compares against it, the landing's expected head is it, and the reported head is it. | The merged object is the request, not the checkout; comparing the record against the request head makes a base-tip evidence set refuse `merge.gates-stale` with both SHAs instead of "verifying" the base. Record: TDR-0071. | 2026-11-20 |
| DEC-3 | The shipped default set makes the reserved built-in `ci-green` merge-applicable, and the merge-applicable required-check set is the declared `required-ci-job` entries plus the `ci-green` entry's repository-declared expected job set, evaluated on the fresh check-run page. | The recorded verdict is consulted but the fresh page is never consulted and the fresh projection carries one gate, so a head that turns red inside the freshness bound is invisible. Making `ci-green` merge-applicable fixes the fresh half with the reserved id, one mapping, and no new id, recipe, or configuration key; the entry-id sequence — and therefore the gate-set identity — does not change. Record: TDR-0072. | 2026-11-20 |
| DEC-4 | The check gate is enforced fail-closed and gains no waivability; the declared remedy is the authored `ci-green` surface opt-out, and the admitted surface sets of the reserved built-ins become contract data. | An in-band waiver class on CI would let a failing pipeline land silently-by-policy; a reviewed configuration act is the recorded override. Requiring declaration of surface-not-equal-to-default would invalidate every existing authored set. Record: TDR-0072. | 2026-11-20 |
| DEC-5 | Diagnostics become a contract: every refusal renders a dedicated `command=merge` field, a dedicated `ref=<ref>` field carrying the invocation's ref, a dedicated `operation=<token>` field drawn from a closed vocabulary and **rejected at the rendering site when it is not a member**, the breached contract, and the offending object; credential refusals name the reference and the environment variable; a read fault names the operation in that field; remediation is actionable or absent; `retryable` is the declared row's value, and no row may declare `true` while a cause it reaches needs an operator act before a re-run can converge. | The observed refusals were unactionable and unattributable: no rendering names the command, the ref, or the failed read as a field, and the code's own `merge.` prefix makes a token assertion vacuous. Dedicated fields give the contract a non-vacuous oracle; the closed operation vocabulary makes the read-fault assertion a membership test rather than prose matching. The retryability rule follows because a static row value is the delivered envelope's only retryability field, so the row's cause set must be narrow enough — and honest enough — to make that one value true. Record: TDR-0073. | 2026-11-20 |
| DEC-6 | `merge.transaction-aborted` is narrowed: no credential condition, no unresolvable request or work item, and **no refused landing**; it reaches exactly three act-requiring causes — a waiver-append failure, a declared landing gap (both pre-mutation), and duplicate matching delivery requests (open or merged), which the merge path refuses rather than silently resolving through the delivered selection — and declares `retryable: false` with no convergence hint. Three additive rows carry the removed resolution causes, and a landing fault reports one of four closed declared identities (`config.credential.missing`, `provider.auth.rejected`, `provider.outage`, `merge.landing-unverified`) — never the port's own token. | Each cause has a different operator and a different repair; the generic abort erased that. Additive rows keep existing codes stable. The refused landing is removed rather than re-pinned because a provider refusal or outage converges on a plain re-run, so a row whose remediation promises no convergence would be false for it; naming the provider identity also satisfies the change's own rule that a refusal names the breached contract. All three remaining causes need an operator act, so `false` is true of every cause the row still reaches. The landing identities are closed at the seam because the port's failure is an open string: removing the abort wrapper without closing it would let an arbitrary token become an undeclared identity. Record: TDR-0073; duplicate-request cause per CEO-D-111. | 2026-11-20 |
| DEC-7 | Emitted-identity totality is closed in this change by giving the composition a runtime declaration of the gate family, beside its exact-member list, with the slot validated against the effective gate set and the totality proof ranging over that declaration. | The classifier already resolves an emitted family instance to the declared family row; what is missing is the composition's own runtime statement that a family emission is admissible, which today exists only as a type and is asserted only by source text — so the mechanism behind AC 3's guarantee must be made declarative here rather than deferred. Record: TDR-0073. | 2026-11-20 |
| DEC-8 | The dry run and the real merge share one resolution, so a dry run describes the object the merge would land. | A pre-flight verdict about a different object is worse than no verdict. | 2026-11-20 |
| DEC-9 | No new configuration key, schema version, record kind, recipe, or gate id is introduced; the one new declaration lives on the change artifact, and the three new constants are contract constants rather than configuration. | The existing surfaces carry the facts; a configuration key would make the change branch (or the declaration's cap) a per-repository setting, which it is not. | 2026-11-20 |
| DEC-10 | The ticket body's family-wide battery is not claimed; the `merge` slice and the diagnostics contract are claimed, with the remainder recorded as out of scope and no follow-up ticket created. | Owner scope, recorded in the change's pm-notes; PM never creates tickets autonomously. | 2026-11-20 |
| DEC-11 | The refusal rendering contract is uniform: every refusal renders dedicated `command=merge`, `ref=<ref>` and `operation=<token>` fields — the ref is always the invocation's ref, the operation is a closed-vocabulary token or `-` — and all five delivered refusal golden pairs are regenerated in this change. | A uniform field is the only rendering in which "names the command, the ref and the read" can be asserted non-vacuously: the code prefix already contains `merge`, nothing today contains the ref, and no delivered summary carries a validated operation token. An empty-ref placeholder branch was considered and dropped because every merge refusal path is reached with a usable ref, so the branch would be unasserted by construction. Narrowing the contract instead would leave the owner's "every refusal names the command" item with no oracle. | 2026-11-20 |
| DEC-12 | The merged report renders the **merge-applicable projection the run evaluated**, not the verification record's battery gate list. | The report's subject is what the merge **freshly evaluated**; echoing the battery's five gates states the verification's posture and hides the merge's. The enforced set — every built-in, including the recorded-verdict check — is unchanged and is not what the two reported lines describe. Rendering the evaluated projection makes the success and dry-run reports tell the same story and makes the "two merge-applicable gates" metric observable in normal output. | 2026-11-20 |
| DEC-13 | Merged truth comes from **one additional bounded merged-request read** — the delivered `findMergedDeliveryRequest` at `TRUTH_PROVIDER_LIMIT`, used **verbatim** (its delivered work-item-ref filter and its delivered deterministic selection) — spent only when the primary open read has no match, and the change's earlier "exactly one provider read on every run" claim stays withdrawn in favour of honest **per-path** counts. Because the delivered read exposes only its ranked single selection — no match census, with one shared outcome shape for "no match" and "could not read" — the change adds **one additive, optional member: the matched request identities**, computed before the delivered selection and carried on every match outcome (beside the delivered signals on a match; on the shared unavailable outcome, empty when the closed page matched nothing and absent when the page could not be read); any count is derived from the identities, and no second, competing count field exists. One identity replays; the empty set refuses `no-open-request` as a decidable zero; more than one identity — in either read — refuses `merge.transaction-aborted` naming **each** matched identity and presenting none as *the* request; and a transport, auth or payload failure of the read is a **distinct outcome** that refuses the declared provider identity naming `operation=github-delivery-request-list`, never `no-open-request` or `merge.request-unresolved`. The read's own delivered review-thread query is counted in the budget (three provider requests on a match-bearing attempt) and no suppression option for the merge caller is added; closeout, the read's other consumer, ignores the member, so its behaviour and output are unchanged. The landing decision reads mergeability from the delivered **single-request read** of the resolved request, because the list endpoint cannot carry it. This supersedes the v2.3 count-shaped signal — **explicitly withdrawing its premise: the "minimum additive change is one optional count signal" claim does not survive the delivered read** (a count cannot name the identities the refusal must name, and the count's zero has no carrier distinct from a fault) — and restates the v2.2 withdrawal of the convention-filtered read (owner rulings CEO-D-111, amended by CEO-D-116). | The delivered open list is `state=open` and can never return a merged request, so merged truth requires the separate `state=closed` read. The delivered merged read ranks several matches and returns one — a silent choice the owner's "never choose silently" rule forbids — and its result carries neither the matched identities nor a fault-distinct zero, so the minimum honest change is one identities member on the match outcomes (including the unavailable arm of the shared closeout contract type, which the plan's declared scoped edits already cover) plus budget truth: the read's own review-thread query is a real provider request and is counted, not suppressed. Using the delivered read verbatim keeps one source of merged truth and leaves closeout untouched; the identities come from the page the read already holds, so no endpoint, credential, or capability is added. Record: TDR-0072, TDR-0073. | 2026-11-22 |
| DEC-14 | The landing-port failure is a **closed identity set** at the seam: `config.credential.missing` (no credential to attempt), `provider.auth.rejected` (rejected credential), `provider.outage` (transient, transport, or **unclassified** — including an arbitrary port token), `merge.landing-unverified` (fired, unobserved). No raw port code appears in an envelope. | The delivered port's failure is `{ ok: false; code: string }`, so once the abort wrapper is removed the emitted identity would be whatever the port returned; the delivered convergence cell drives exactly that with an arbitrary code. Mapping it to `provider.outage` rather than declaring a new identity keeps the set to the rows that already carry the right `retryable`, `consequence` and remediation, and keeps the abort row to act-requiring, pre-mutation causes. | 2026-11-20 |
| DEC-15 | The `operation` vocabulary is a **declared filter** over the delivered source-name vocabulary plus two local-read tokens, one landing-operation token and `-`, and the rendering site **rejects** a non-member rather than rendering it. | The gate found the earlier list unequal to the sources the spec itself cites: it omitted the delivered `delivery-registry`, carried a `github-delivery-request-detail` that the then-current list-as-detail read made unreachable (restored to membership by CEO-D-116, under which the merge decision reads the delivered single request for mergeability), and left `pm-notes` and `repository-head` unaccounted for. A named filter with a stated reason per excluded member is auditable; a rejection rule makes "outside the vocabulary" an asserted failure instead of a silent pass-through, which is what the field exists for. | 2026-11-20 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Merge production composition | Updated — candidate-set resolution over one open-request list read, a bounded local change-record read at each candidate head, the `branch` declaration resolution with its closed reasons and precedence, exact-match acceptance with the full-SHA head guard, resolved-head binding, the duplicate-open abort, the convergence attempt (one bounded merged-request read used verbatim, with the additive matched-identities member: exactly one identity replays, the empty set refuses `no-open-request` as a decidable zero, more than one aborts naming each matched identity, and a faulted read refuses the declared provider identity rather than folding into zero), the landing decision's mergeability read from the delivered single-request read (the list endpoint cannot carry mergeability; an unknown-recovery re-read re-reads the single request), credential and read-fault naming, removal of the checkout-branch, checkout-head, branch-name-parse and working-tree change-record reads from this path, the closed landing-fault mapping, a runtime family declaration for the gate family, and the refusal rendering work: the third dedicated `operation` field with its closed vocabulary, rejected at the rendering site where the summary is rendered (rendering work only — no new record kind, event, or persisted surface) |
| Merge contracts (report shapes, default gate set, admitted surfaces) | Updated — the merged and dry-run report shapes gain the resolved object, the resolution source or `replayed` flag, candidate count, the convergence attempt's matched identities and the merge-applicable gate projection; the `merge.request-unresolved` reason vocabulary stays at three (its v2.2 fourth member is withdrawn); `ci-green` merge-applicable by default; declared admitted-surface sets; the three new resolution constants |
| Delivered shared merged-request read (closeout's source of merged truth) | Behaviour for closeout **unchanged** — the ranked single selection stays exactly as delivered, and closeout ignores the new member. The read gains one **additive, optional** member — the matched request identities — computed before its delivered selection and carried on every match outcome: beside the delivered signals on a match, and on the shared closeout contract type's unavailable outcome as an additive optional member closeout never reads (empty when the closed page matched nothing, absent when the page could not be read). The merge path reads the identities and aborts when more than one is observed, treats the empty set as a decidable zero, and reports a faulted read as the declared provider identity; any count is derived from the identities, and no second count field exists. The read's own delivered review-thread query stays part of its sequence and is counted in the merge budget, never suppressed for the merge caller. No closeout behaviour, record, or output moves; no second source of merged truth is introduced. The provider-client current-truth page (`doc/spec/features/feature-provider-client-seeds.md`) states the operation set and the read-observation discriminator, and both statements move with this member in the same change's reconciliation |
| Merge git seam (local object read) | Extended — its existing bounded, fixed-argv, local tree-of-commit read is the precedent for the one record read at a candidate head; no provider, network or credential surface is added |
| Merge emittable-code declaration and totality proof | Updated — the family is declared at runtime beside the exact-member list, the proof ranges over that declaration and fails by name when it is removed, and the delivered classifier family resolution is unchanged |
| Merge transaction (freshness, probe, refusal evidence) | Updated — required-check set derivation, merge-surface CI evaluation on the fresh page, refused page-not-head, evidence members, the merged report's gate projection, and the landing-fault attribution: a refused or faulted landing reports one declared identity — `config.credential.missing`, `provider.auth.rejected`, `provider.outage` (transient, transport, or unclassified) or `merge.landing-unverified` — instead of being converted into the abort row, which keeps the waiver-append failure, a declared landing gap, and the duplicate-request cause; the port's own token is never emitted |
| Merge probe / required-check mapping | Reused unchanged as the single evaluator; the required-check set it is fed is extended |
| Change-record read (pm-notes) | Reused — the delivered parse applied to text read from the candidate head; no parser change |
| CI-workflow expected-job read | Reused — one additional consumer |
| Error table (machine and documented) | Updated — three additive `merge` rows, the narrowed abort row's `retryable` and remediation with its three-cause set (a waiver-append failure, a declared landing gap, and duplicate matching delivery requests; the refused-landing cause removed to the four landing identities `config.credential.missing` / `provider.auth.rejected` / `provider.outage` / `merge.landing-unverified`), the `merge.state-unverified` remediation naming `verify gates <ref>` for the same work item, remediation and summary adjustments, totals **169 → 172** recounted under CEO-D-116 with the arithmetic base corrected to the delivered tree's own totals record (delivered 168 → 171, two-segment allowlist 68 → 71, arithmetic `BASELINE_ROWS.length + 136` → `+ 138`, `merge` kind 9 → 12; the ruling adds no row) |
| Merge reference page | Updated — branch and head resolution, the declaration's cap and closed reasons, gate set, the convergence case with its single merged-request read, three request reasons and duplicate-request abort, the single-request mergeability read and its unknown-recovery re-read, exit-status causes, the `merge.state-unverified` remediation naming the producing command, refusal examples with the three new fields, the closed `operation` vocabulary and its rejection rule, and the four landing-fault identities |
| Merge feature spec | Updated — Overview resolution paragraph, the open-list/merged-read posture and the convergence attempt with its additive matched-identities member, gate registry defaults, verification-record head meaning, the landing decision's single-request mergeability read, merged-report gate semantics, error identities (including the three request reasons, the duplicate-request abort and the closed landing identities), invariants |
| Merge test specification | Updated — "Composition reachability", "Required-check awareness", "Classification fidelity", "Emittable-code totality", "Error-identity stability" rows |
| Non-functional specification (merge read budget row) | Updated — the merge row states the honest per-path counts: the bounded open-list read on every run, the delivered single-request mergeability read on a run reaching the landing decision, and the single optional merged-request read — its own review-thread query counted — taken only when the primary has no match, replacing the one request-detail read it states today |
| Change-lifecycle and change-convention guidance for change records | Updated — the `branch` declaration requirement, its 256-character cap, its closed refusal reasons, its read-at-head semantics, and the declaration-free convergence case |
| PM instruction surface (`.ai/agent/pm-instructions.md`, the `@pm` prompt and its generated `.ados-claude` mirror) | Updated — the change record declares `branch` when the change is opened, with the cap and the refusal vocabulary named; the prompt edit is regenerated, not hand-edited |
| Release note (changeset) | New — the fixed-group packages at `minor` |

## 17. ACCEPTANCE CRITERIA

### 17.1 Change-branch resolution (owner AC 1)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** an open delivery request for the change and a fixture whose working tree carries **no** change folder and whose checkout HEAD is the integration-base tip, **when** `merge <ref>` runs, **then** the declaration is read at the request's asserted head, the resolution source is reported as `declared-at-head`, the run reports the request's head as the resolved head, verifies or refuses against that head, and can never report the base tip as the verified head. *(owner AC 1; regression (a))* | F-1, API-1, DM-1, DM-2 |
| AC-F1-2 | **Given** the same request and an invocation from the change-branch checkout at the request head, **when** `merge <ref>` runs, **then** the checkout's working-tree change record is **not read at all**, so no worktree record can govern; the only record read on the path is the one at the request head, the verified head equals the request head, and the result is `merged` only after the one guarded landing at that head. *(owner AC 1; wording per readiness iter-4 nit 12)* | F-1, API-1, NFR-6 |
| AC-F1-3 | **Given** an invocation whose candidate change records cannot establish a declaration — no `branch` key, a non-string or empty value, a value containing whitespace or a control character or longer than 256 characters, a value that disagrees with its own request's source ref, a head carrying no record, a record that does not parse, or a head object the checkout does not hold — **when** `merge <ref>` runs, **then** it refuses `merge.branch-unresolved` at exit 1 with exactly one closed reason (`declaration-missing`, `declaration-unusable`, `declaration-disagrees`, `record-missing`, `record-invalid`, `record-unreadable`) chosen by the declared precedence, naming the candidate's source ref, the change-record tree path at that head, and the `branch` key, having spent exactly that one bounded open-request list read — the read the request resolution needs anyway — and **no merged-request read and no other provider read**, plus at most three local record reads, with zero landing calls. | F-1, DM-1, NFR-5 |
| AC-F1-4 | **Given** an open-request list read where more than three open entries follow the declared convention for the ref, where the bounded page saturated — including a saturated page on which **zero** convention-matching candidates appear — where two or more candidates with distinct source refs are accepted, where a candidate's asserted head is absent or not a full hex SHA, where the primary open read has no match and the convergence attempt observes the **empty** matched-identity set (the additive member present and empty — a decidable zero), or where the convergence attempt's read **faults** (a transport, auth, or payload failure), **when** `merge <ref>` runs, **then** the empty-set case refuses `merge.request-unresolved` at exit 1 with `no-open-request` and the ambiguity cases refuse with `ambiguous-open-request` or `head-unresolved` accordingly — each naming the change ref, the observed open count, the candidate count and, on the convergence path, the observed empty matched-identity set — and a candidate whose head is not a full SHA is never read; while the **fault** case is a distinct outcome: it refuses the declared provider identity (`provider.outage`, or the delivered payload-invalid mapping) naming `operation=github-delivery-request-list`, and is **never** reported as `no-open-request` or `merge.request-unresolved`, never folded into zero. Saturation is evaluated before the candidate count, so a truncated page refuses `ambiguous-open-request` even with zero convention-matching entries rather than claiming `no-open-request`. A duplicate match — more than one open request whose source ref equals the resolved branch — aborts rather than refusing a request reason; that is carried by AC-F1-6. | F-1, F-3, API-3, DM-2 |
| AC-F1-5 | **Given** a fresh verification record whose head is the integration base and a resolved request head that differs, **when** `merge <ref>` runs, **then** it refuses `merge.gates-stale` at exit 1 recording both SHAs and performs zero landing calls. | F-1, F-2, API-1 |
| AC-F1-6 | **Given** a primary open read with **no** match for the change's resolved branch and a convergence attempt over the delivered merged-request read that exposes **exactly one** matched request identity, with no readable change record anywhere (no change folder in the working tree, a head object absent from the local object database, and no declaration reachable), **when** `merge <ref>` runs, **then** it replays from provider truth at exit 0 and reports `replayed=true`, spends the open list and the one bounded merged-request read — three provider requests in all, counting the read's own delivered review-thread query — and **zero** change-record reads and zero record-read git invocations, reports neither `declared-at-head` nor `merge.branch-unresolved`, and lands nothing; and **given** a convergence attempt that exposes **more than one** matched request identity, or a primary open read in which **more than one** open request's provider-asserted source ref equals the resolved branch, **when** `merge <ref>` runs, **then** it refuses `merge.transaction-aborted` at exit 1, `not_landed`, `retryable: false`, naming **each** matched identity and presenting **none** of them as *the* request, and never silently chooses one. *(owner AC 1, as amended by CEO-D-116)* | F-1, F-3, API-1, NFR-2 |
| AC-F1-7 | **Given** a resolved request whose open-list entry carries **no** mergeability fields and whose delivered single-request read reports the request mergeable with a clean mergeable state — with every required check green and the tracker gate fresh — **when** `merge <ref>` runs, **then** the landing decision obtains mergeability from the **single-request read** of the request it located on the open-list page, the run lands once at the resolved head, and `merge.mergeability-unknown` is **never** refused for the list entry's missing fields; and **given** a mergeability state the single-request read cannot establish, **when** an unknown-recovery re-read is taken, **then** it re-reads the **single request**, never the list, and a fault of the single-request read resolves to the declared provider identity naming `operation=github-delivery-request-detail`. *(CEO-D-116, folded finding LF-1)* | F-1, API-1, NFR-2 |

### 17.2 Required checks on the resolved head (owner AC 2)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F2-1 | **Given** no `merge.gates` declaration and a resolved-head check-run page reporting one failing check, **when** `merge <ref>` runs, **then** the merge-applicable set includes the CI gate and the run refuses `merge.gate.<gate-id>.failed` at exit 1 naming that check, the gate, and the failure reason, with zero landing calls. *(owner AC 2; regression (b))* | F-2, EVT-1, NFR-5 |
| AC-F2-2 | **Given** the same page reporting one queued or running required check, **when** `merge <ref>` runs, **then** the run refuses on the same family at exit 1 naming that check with the pending reason. *(owner AC 2)* | F-2, NFR-5 |
| AC-F2-3 | **Given** a page where every required check is green and a fresh tracker gate, **when** `merge <ref> --dry-run` then `merge <ref>` run, **then** the dry run reports `verified` and the merge lands once — so a green and a failing request never share a verdict. | F-2, F-5, API-2 |
| AC-F2-4 | **Given** a check-run page whose SHA is not the resolved head, **when** `merge <ref>` runs, **then** the page is not used as head evidence and the run refuses naming both SHAs, never reporting a pass. | F-2, NFR-5 |
| AC-F2-5 | **Given** a CI read that faults, **when** `merge <ref>` runs, **then** the run refuses with the declared provider identity naming the failed operation, and never treats the fault as a passed gate. | F-2, F-3, NFR-5 |
| AC-F2-6 | **Given** an authored gate set declaring a `required-ci-job` entry and a page where an undeclared, non-expected job is red, **when** `merge <ref>` runs, **then** the declared job is enforced and the undeclared job is not gate evidence. | F-2, DM-3 |
| AC-F2-7 | **Given** an authored gate set, **when** it is validated, **then** the five built-in ids remain reserved and mandatory, a built-in's recipe and class cannot change (an omitted class adopts the shipped one), `ci-green` is accepted on `battery` or `both`, and the other four only on `battery`. | F-2, DM-3 |
| AC-F2-8 | **Given** a successful merge over a request whose evaluated merge-applicable projection is the CI gate and the tracker gate, **when** the merged report is rendered, **then** it states `gates=2/2` over that projection with one line per entry and each entry's verdict and reason, and does not echo the verification record's battery gate list; the dry-run report for the same head states the same projection. | F-2, F-5, API-1, DM-2 |

### 17.3 Refusal diagnostics (owner AC 3)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F3-1 | **Given** any refusal across the enumerated refusal matrix, **when** it is rendered, **then** it carries a dedicated `command=merge` field, a dedicated `ref=<ref>` field carrying the invocation's ref, a dedicated `operation=<token>` field drawn from the closed vocabulary (or `-` when the refusal names no operation), the code, and at least one named cause, and its remediation is actionable or absent — never an instruction to clear an unnamed condition. A token outside the vocabulary is **rejected at the rendering site**, not rendered: the run fails the rendering contract by name rather than passing an unknown value through. The command, ref and operation assertions are made against those fields, not against the occurrence of the string `merge`, of the ref, or of an operation name anywhere in the summary. *(owner AC 3)* | F-3, API-3, NFR-5 |
| AC-F3-2 | **Given** an absent token in the environment, **when** `merge <ref>` runs, **then** it refuses `config.credential.missing` at exit 1 naming the credential reference, the environment variable, and the operation that required it as `operation=github-delivery-request-list` (or the operation actually attempted). *(owner AC 3; regression (c))* | F-3, API-3, NFR-9 |
| AC-F3-3 | **Given** any credential condition on the merge path, **when** it is rendered, **then** the reported code is the declared credential or auth identity (`config.credential.missing`, `provider.auth.rejected`) and never `merge.transaction-aborted`; and **given** any landing fault, **when** it is rendered, **then** it is reported as exactly one of the four closed declared identities — `config.credential.missing` (no credential to attempt the landing), `provider.auth.rejected` (rejected credential), `provider.outage` (transient, transport, or unclassified failure), or `merge.landing-unverified` (fired, merged truth not observed) — never as `merge.transaction-aborted`, and **never as the landing port's own failure token**, including an arbitrary undeclared one. | F-3, API-3 |
| AC-F3-4 | **Given** a tracker work item that does not resolve, **when** `merge <ref>` runs, **then** it refuses `merge.work-item-unresolved` at exit 1 naming the work-item ref and the read operation, and the remediation names that cause. | F-3, API-3, NFR-5 |
| AC-F3-5 | **Given** any refusal the merge command emits, **when** it is rendered, **then** `retryable` equals the declared row value of the emitted code and is never a per-instance value, and its remediation is accurate for the named cause — a condition that clears without an operator act (a pending check) is expressed by the refusal's named reason and a remediation that says so, and no remediation instructs an operator to clear a condition the refusal does not name. | F-3, API-3 |
| AC-F3-6 | **Given** every declared row on the merge refusal surface, **when** each row's reachable cause set is inspected, **then** no row declares `retryable: true` while a cause it reaches requires an operator act before a re-run can converge; `merge.transaction-aborted` reaches exactly three causes — a waiver-append failure, a declared landing gap (both pre-mutation), and duplicate matching delivery requests (open or merged), named by their duplicate identities — and declares `retryable: false` with a remediation that names the aborted pre-mutation condition and promises no convergence, true of all three; a refused landing is not among its causes, reporting exactly one of `config.credential.missing` (no credential to attempt), `provider.auth.rejected` (rejected credential), `provider.outage` (transient, transport, or unclassified — an arbitrary port token is unclassified) or `merge.landing-unverified` (fired, merged truth not observed), so no envelope carries a raw landing-port code; and the family row's single `false` stays honest for every gate cause, including the act-free pending one. *(owner AC 3)* | F-3, API-3, NFR-5 |
| AC-F3-7 | **Given** a merge invocation whose freshness precondition is unmet — no readable verification record for the resolved head — **when** `merge <ref>` runs, **then** it refuses `merge.state-unverified` at exit 2 with a remediation naming the exact prior command and target: **produce the verification with `verify gates <ref>` for the same work item, then re-run** — and never a bare "produce a verification" that names neither the producing command nor the work item. *(CEO-D-116, folded finding LF-2)* | F-3, API-3, NFR-5 |

### 17.4 Emitted-identity totality

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F4-1 | **Given** the composition's runtime emittable declaration, **when** the totality proof runs, **then** it ranges over the runtime family declaration exported beside the exact-member list — the contract's prefix, suffix, template, and slot rule — so every code the refusal branches emit resolves to an exact member or that declaration; the proof does not match source text; a behaviour-preserving refactor passes; and a live gate-family refusal (`merge.gate.<gate-id>.failed`) still resolves to the declared family row with the gate id preserved. | F-4, NFR-7 |
| AC-F4-2 | **Given** the composition with the runtime family declaration deleted, or replaced by the bare exact-member list, **when** the totality proof runs, **then** it fails by name, naming the missing family declaration — not a source-text mismatch — and no source-text assertion remains in its place that could pass; the live mismatch control still drives an undeclared code to the containment identity. | F-4, NFR-7 |

### 17.5 Dry-run / real-merge agreement

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F5-1 | **Given** one fixture and one invocation context, **when** `merge <ref> --dry-run` and `merge <ref>` run, **then** both report the same resolved branch, resolution source, request identity, candidate count, resolved head, and merge-applicable gate projection. | F-5, API-1, API-2 |
| AC-F5-2 | **Given** an invocation from the integration-base checkout whose worktree carries no change folder, **when** `merge <ref> --dry-run` runs, **then** the appended verification record's head is the resolved request head, no waiver, transaction, or git mutation is written, and `result=merged` and `squash=` are never reported. | F-5, API-2, EVT-1 |
| AC-F5-3 | **Given** the new regression suites, **when** they run, **then** they perform zero network calls and spawn no real child process, and the existing no-live-call guards stay green. *(owner AC 4)* | F-1, F-2, F-3, NFR-4 |

### 17.6 Owner acceptance trace

| Owner item | Carried by |
|---|---|
| AC 1 — branch resolved from the change record + open PR; from the base checkout it verifies the PR head or refuses; never `head=<base tip>` | AC-F1-1, AC-F1-2, AC-F1-5, AC-F5-2 |
| Already-merged convergence — a converged re-run replays from provider truth with no change-record read and no declaration, lands nothing, and aborts naming the duplicate identities when more than one merged (or open) request matches | AC-F1-6 |
| The landing decision reads mergeability from the single request — a list entry without mergeability fields never produces `merge.mergeability-unknown` for a clean request | AC-F1-7 |
| AC 2 — required checks read on the resolved head; failing and pending each fail closed and are named | AC-F2-1, AC-F2-2, AC-F2-3, AC-F2-4, AC-F2-5, AC-F2-8 |
| AC 3 — every refusal names the command and the breached contract, including the credential reference and environment name | AC-F3-1, AC-F3-2, AC-F3-3, AC-F3-4, AC-F4-1, AC-F4-2 |
| AC 4 — regressions: (a) base-checkout invocation does not verify the base tip; (b) one failing required check refuses with that check named; (c) absent `GITHUB_TOKEN` names the variable | AC-F1-1, AC-F2-1, AC-F3-2, AC-F5-3 |
| Pending-check refusal and the retained explicit waiver path | AC-F2-2, AC-F2-3. The explicit `--waive` path is unchanged by this change (NG-6) and is asserted by the delivered waiver suite's authorized-waiver case — an authorized `--waive owner-gate --waived-by <authorized principal>` is recorded before landing and the gate passes under it — together with its delivered unauthorized and missing-principal cases. |
| Unreadable work item names its cause; no unnamed remediation; `retryable` follows the declared row and no row overstates convergence | AC-F3-1, AC-F3-4, AC-F3-5, AC-F3-6, AC-F3-7 |
| The unverified-state refusal's remediation names the producing command and target (`verify gates <ref>` for the same work item) | AC-F3-7 |
| Dry run describes the same object the real merge would land | AC-F5-1, AC-F5-2 |

### 17.7 Definition of Done

This change is done when every row below holds, with the evidence named in it.

| # | Condition | Evidence |
|---|---|---|
| DOD-1 | Every acceptance criterion is green: the 22 carried forward from v1.0/v1.2 (AC-F1-1…AC-F1-5, AC-F2-1…AC-F2-7, AC-F3-1…AC-F3-6, AC-F4-1, AC-F5-1…AC-F5-3), plus the two added in v2.0 (AC-F2-8 merged-report projection, AC-F4-2 runtime-declaration negative control), the one added in v2.1 (AC-F1-6 already-merged convergence), and the two added in v2.4 (AC-F1-7 mergeability from the single request, AC-F3-7 named unverified-state remediation) — 27 ids in all. | The test plan's per-AC case results, with each criterion's named cases green inside the aggregate gate. |
| DOD-2 | All ten non-functional requirements (NFR-1…NFR-10) are green at their stated thresholds. | The test plan's NFR rows and the gates that execute them. |
| DOD-3 | Every declared plan phase is complete, with its pm-notes evidence entry recording the gate it passed. | `phase list` shows all phases complete; the pm-notes `notes:` entries carry each phase's evidence. |
| DOD-4 | TDR-0071, TDR-0072 and TDR-0073 are accepted or amended at the PR review, and no record's premise contradicts the delivered behaviour (the recorded-versus-fresh CI account, the read-at-head resolution, the `retryable: false` abort row). | The PR review record and each record's status and decision date. |
| DOD-5 | The identity totals are reconciled on the synced base: 172 machine identities / 172 documented / 171 delivered / 71 two-segment allowlist members / `BASELINE_ROWS.length + 138`, with the `merge` kind at 12 concrete rows, and no page states a superseded total. | The error-table sync suite, the documented table and reference page, and the phrase-table scan. |
| DOD-6 | The changed current-truth pages and the changeset have landed: the merge feature spec, the merge test specification, the merge reference page, the change-lifecycle and change-convention guidance, the PM instruction surface (with its regenerated mirror), and the fixed-group packages at `minor`. | The doc-sync phase's diff and the committed changeset. |
| DOD-7 | The doc-distribution guard and the aggregate gate are green, with every check executed and none skipped. | The distribution guard and the aggregate check output. |
| DOD-8 | The scope held and the scope not claimed are disclosed in the PR body: the `merge` slice plus the diagnostics contract are claimed, proven by in-process suites, and the family-wide installed-binary battery is not claimed. | The PR body's scope section. |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- One change delivers the behaviour, the three additive rows, the amended
  documented table, the reference page, the feature spec, the test specification,
  and the regenerated refusal goldens together: documented and machine-declared
  identities move in the same change, and the pinned totals move with them
  (169 → 172 on the synced base, delivered 168 → 171, allowlist 68 → 71,
  arithmetic `+136` → `+138`, `merge` kind 9 → 12 — recounted under CEO-D-116,
  which adds no error identity, with the arithmetic base corrected to the
  delivered tree's own totals record).
- The shared merged-request read's contract type gains exactly one additive,
  optional member — the matched request identities — carried on the match outcome
  and on the shared closeout contract type's **unavailable** outcome (empty when
  the page matched nothing, absent when the page could not be read): an additive
  optional member closeout never reads, so closeout's behaviour and output are
  unchanged, and the plan's declared scoped edits for that shared surface stand.
- Delivery order: refusal identities and the diagnostics contract first (they are
  the vocabulary the other capabilities report in), then the branch/head
  resolution together with the convergence attempt and its duplicate-request abort
  (they share the one resolution path and the one merged-truth read), then the
  required-check enforcement, then the report and dry-run agreement; every phase
  leaves the delivered behaviour consistent with its declarations.
- No feature flag and no staged default: the shipped default gate set is the
  contract, and a repository that must keep a `battery`-surface CI gate declares
  it.
- The release note declares the fixed-group packages at `minor`, as the
  workspace's changeset additivity rule requires for any added changeset; the
  specification may not claim `patch` or `none`.
- Communication: the change's PR body states the scope held (the `merge` slice
  plus the diagnostics contract, proven by in-process suites), the scope
  explicitly not claimed (the family-wide battery, and specifically that **no
  installed-binary end-to-end conformance run is claimed**), and the one authoring
  obligation the release imposes (`branch` on every change record), so the owner
  can rule on the remainder at review.
- Merge authority stays with the CEO or the human; the PR remains open for review.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

- No stored state is migrated: no record schema, record kind, registry key, or
  configuration key changes, and the effective gate-set id sequence is unchanged,
  so existing verification and transaction records remain readable and valid.
- Seeding is limited to the change artifact: this change's own change record gains
  its `branch` declaration, and the change-lifecycle and change-convention
  guidance document that a change declares its branch where it is opened. In-flight
  changes need the same one-line declaration on their own branch before they can
  merge; the refusal names the key and the head it looked at.
- The obligation is documented on the surfaces that create a change, not only at
  merge time: the PM instruction surface (`.ai/agent/pm-instructions.md` and the
  `@pm` prompt, with its generated `.claude` mirror regenerated rather than
  hand-edited) states that a change record declares `branch` when the change is
  opened, and the change-convention guide documents the key, its 256-character
  cap, the closed refusal reasons, and that the declaration is read at the
  request head. These are scope statements; the exact wording is delivery's.
- No backfill of historical change records is required, because no historical
  record is read by the merge path.
- The already-merged convergence case needs no seeding at all: a converged re-run
  is decided from provider truth on the convergence attempt, before any record
  read, so it requires neither a declaration nor a locally readable head object.
  The attempt's single merged-request read is a read of provider state, not of
  stored local state, so it migrates nothing.
- The merged read's additive member is contract surface, not stored state: it
  lives on the shared closeout read's result type — including its unavailable
  outcome — is written by no record, and migrates nothing; closeout's records and
  output are unchanged.

## 20. PRIVACY / COMPLIANCE REVIEW

No personal data is introduced. The change reads and reports only repository and
tracker facts already read today — branch names, request identities, head SHAs,
job names, label names, work-item references, candidate counts — and adds one
change-artifact key carrying a branch name. Credential handling is unchanged and
no secret material is reported: only the reference name and the
environment-variable name, which are non-secret identifiers. Evidence members
stay bounded and secret-free, and the new `ref` rendering field carries the
invocation's change ref, which is not personal data.

## 21. SECURITY REVIEW HIGHLIGHTS

- Security posture improves: a failing, pending, canceled or skipped required
  check can no longer be absent from a merge verdict, and a merge can no longer
  verify a head unrelated to the change.
- The change introduces no new provider capability, scope, or credential
  reference; read-only operations are reused — including the delivered
  merged-request read, which is spent at most once and only when the primary open
  read has no match, and the delivered single-request read the verify-gates
  family already consumes, now read by the landing decision for mergeability —
  and the change-record read is a local git object read with no
  network and no credential.
- The local record read is fixed-argv with no shell, and the ref used to build its
  pathspec is validated before use; the candidate cap and the byte bound constrain
  the work.
- The gate-id slot of the refusal family stays validated against the effective
  gate set, so giving the composition a runtime family declaration does not open a
  code-injection or pattern-widening hole.
- Refusal naming must never echo secret material: the reference name and the
  environment-variable name are reported, never the value, and a canary test
  proves it.
- No force, bypass, auto-merge, queue, retry, or head-mutation capability is
  added; the check gate deliberately has no in-band override, and no fetch is
  added to the resolution path.
- The change branch is now an authored fact on the change artifact, which is
  reviewed like any other change content, rather than an implicit property of the
  operator's checkout — and it is read at the commit that lands.

## 22. MAINTENANCE & OPERATIONS IMPACT

- Operators gain three new refusal rows, the abort row's duplicate-request cause,
  and the request row's three reasons to recognise, each with a named repair; the
  branch refusal's six closed reasons separate "no declaration" from "wrong
  declaration" from "record not readable here", and the request row's three reasons
  separate "nothing was open" from "the open set is ambiguous", while a duplicate
  matching delivery request (open or merged) aborts naming the duplicate
  identities; runbooks and the reference page carry them.
- A converged re-run costs the open list plus the merged-request read — three
  provider requests in all on a match-bearing attempt, counting the read's own
  delivered review-thread query — and nothing else: it still reads no change
  record, writes no transaction and lands nothing. An ordinary resolution costs
  the one open-list read it always did, plus the single-request mergeability read
  when the run reaches the landing decision.
- Coordinators may now run `merge` from the integration base, which removes a
  checkout dance but makes two things sharper: the freshness requirement (no
  fresh record for the request head means `merge.state-unverified`, a record for
  another head means `merge.gates-stale`), and the local-object requirement (a
  clone that does not hold the request head refuses `record-unreadable` rather
  than fetching — OQ-4).
- Repositories must declare a branch on each change record; this is the single new
  authoring obligation, documented on the PM instruction surface and the
  change-convention guide and enforced by a named refusal. A converged re-run is
  exempt.
- Repositories with legitimately skipped CI jobs must decide explicitly between
  accepting the enforcement and declaring the CI gate on the `battery` surface.
- The error table, the reference page, the feature spec, and the test
  specification must stay in step; the existing sync and conformance checks gate
  that, and the pinned totals move with any future identity change. The merge
  read-budget row in `doc/spec/nonfunctional.md` is a named phase-7 reconciliation
  target for this change: it currently states one verification read, one work-item
  read, one check-run page and **one request-detail read**, and it must state the
  honest per-path counts: the bounded open-list read on every run, the delivered
  single-request mergeability read on a run reaching the landing decision, and the
  single optional merged-request read — its own review-thread query counted —
  taken only when the primary has no match.
- The `merge.mergeability-unknown` refusal's firing premise changes: it reports a
  mergeability state the single-request read could not establish, never an open
  list entry's missing fields — runbooks and the reference page carry the
  corrected trigger, and the unverified-state remediation now names
  `verify gates <ref>` for the same work item.
- Refusal renderings are now a consumed surface: anything that parsed
  `result=refused; condition=<code>` keeps working on the code line, but the
  summary gains the `command`, `ref` and `operation` fields and the five refusal
  goldens are regenerated. A refused landing now appears under one of four declared
  identities rather than under the abort, and never under the landing port's own
  token, so an operator or a runbook that watched for the abort on a landing fault
  switches to the named identity.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Change record | The committed per-change artifacts, of which the pm-notes document carries the branch declaration read here. |
| Change branch | The repository branch that carries the change's delivery request, declared on the change record. |
| Delivery request | The provider's normalized pull/merge request for the change branch, with its asserted head commit and mergeability. |
| Candidate set | The open delivery requests whose provider-asserted source ref follows the repository's declared `<type>/<REF>/<slug>` convention for the invocation's change ref, capped at three. The convention narrows where to look; it never supplies the branch. |
| Declared-at-head | The reported resolution source of a successful resolution: the branch was established from the change record read at that request's own asserted head. |
| Resolved head | The head commit the accepted delivery request asserts; the object the run verifies and the head the landing must match. |
| Local change-record read | The one bounded, fixed-argv, network-free git object read (a tree locate plus one blob read) that obtains the change record at a candidate head. |
| Repository-declared expected job set | The job names the repository's own CI workflow declares, read through the delivered expected-job read. |
| Merge-applicable projection | The gates a merge **freshly evaluates** under the effective set — two entries on the shipped default (`ci-green` and `tracker-freshness`), and what the merged and dry-run reports state — as distinct from the enforced set (every built-in, used for the recorded-verdict check, which enters the merge path regardless of declared surface) and the record's battery gate list. |
| Merge-applicable required-check set | The union of the declared required-job entries and the CI entry's repository-declared expected job set, evaluated per job against the resolved head's check-run page. |
| Admitted surface set | The surfaces within which a reserved built-in gate entry may be declared. |
| Operation token | The closed-vocabulary value of a refusal's dedicated `operation` field: one of `github-work-item`, `github-check-runs`, `github-delivery-request-list`, `github-delivery-request-detail`, `github-merge-delivery-request`, `repository-ci-workflow`, `delivery-registry`, `local-change-record-read`, `local-git-object-read`, or `-` when the refusal names no operation. Rejected at the rendering site when the value is not a member. |
| Single-request mergeability read | The delivered single-request delivery-request read the landing decision consults for mergeability — the list endpoint cannot carry mergeability fields; an unknown-recovery re-read re-reads it, never the list. |
| Convergence attempt | The single bounded merged-request read the merge path takes only when the primary open read has no match: the delivered `findMergedDeliveryRequest` used verbatim, with its additive matched-request-identities member — replaying on exactly one identity, refusing `no-open-request` on the empty set (a decidable zero), aborting `merge.transaction-aborted` on more than one identity rather than choosing, and reporting a faulted read as the declared provider identity. The read's own delivered review-thread query is part of the attempt and is counted in the budget. |
| Matched request identities | The one additive, optional member the delivered merged-request read reports before its deterministic selection, carried on every match outcome — beside the delivered signals on a match, and on the shared unavailable outcome empty when the closed page matched nothing and absent when the page could not be read; any match count is derived from it, no second count field exists, closeout ignores it, and the merge path aborts when it carries more than one identity. |
| Duplicate request | More than one delivery request matching the change on one read — multiple open entries whose provider-asserted source ref equals the resolved branch, or more than one matched identity on the merged read. The merge path aborts `merge.transaction-aborted` naming each matched identity and never selects one. |
| Converged re-run | A `merge` whose convergence attempt observes exactly one already-merged delivery request: it replays from provider truth at exit 0 with `replayed=true`, reads no change record, needs no declaration, and lands nothing. |
| Landing-fault identity | The closed set a landing-port failure resolves to at the seam: `config.credential.missing`, `provider.auth.rejected`, `provider.outage` (transient, transport, or unclassified) or `merge.landing-unverified`. The port's own failure token is never emitted. |
| Refusal cause | The named object or operation a refusal reports: the candidate source ref and record path, the unresolved request, the unresolved work item, the non-green job, the failed read, or the unresolvable credential. |
| Containment identity | The generic internal failure rendered when an emitted code is not declared; reachable only for a genuinely undeclared failure. |
| Named checks refusal | A refusal on the `merge.gate.<gate-id>.failed` family that names the gate and the offending check. |

## 24. APPENDICES

### A. Resolution procedure (normative order)

1. Perform the one bounded open-request list read — the delivered
   `listDeliveryRequests` at `TRUTH_PROVIDER_LIMIT` with gate facts; record the
   open count and whether the page saturated. That page carries the open state
   filter and yields no merged entry, and it cannot carry mergeability (the list
   endpoint returns no mergeability fields); the mergeability fact comes from the
   single-request read at the landing decision (step 10). The request
   this read resolves to is the open entry whose provider-asserted source ref
   equals the change's resolved branch exactly.
2. Build the candidate set: open entries whose provider-asserted source ref
   matches `^[a-z][a-z0-9-]*/<REF>/.+$` for the invocation's ref, capped at three.
   **Saturation is evaluated first**: a saturated page →
   `merge.request-unresolved` / `ambiguous-open-request`, even with zero
   convention-matching entries, because a truncated page establishes no
   uniqueness. On an unsaturated page: more than three →
   `ambiguous-open-request`; a candidate head absent or not a full hex SHA →
   `head-unresolved`, and that candidate is never read. A non-empty candidate set
   proceeds to step 4; **no convergence read is performed** on such a run.
3. **Convergence attempt**, reached only when the primary read has no match on an
   unsaturated page: perform the one bounded merged-request read — the delivered
   `findMergedDeliveryRequest({ workItemRef, limit: TRUTH_PROVIDER_LIMIT })` used
   verbatim, with no convention filter of this change's own (no pagination, no
   retry, no fetch) — and read its additive matched-request-identities member,
   computed before its delivered deterministic selection:
   - exactly one identity → replay from provider truth at exit 0 with
     `replayed=true`; the run stops here — no record read, no declaration needed,
     no head taken from the resolution below, nothing landed;
   - the empty set (the member present and empty) → `merge.request-unresolved` /
     `no-open-request` — a decidable zero, not an assumption;
   - more than one identity → `merge.transaction-aborted`, naming each matched
     identity and presenting none as *the* request; the merge path never chooses,
     and closeout, which ignores the member, keeps its delivered ranked selection
     unchanged;
   - the member absent (the read faulted — transport, auth, or payload) → the
     declared provider identity (`provider.outage`, or the delivered
     payload-invalid mapping) naming `operation=github-delivery-request-list` — a
     distinct outcome, never `no-open-request`, never folded into zero.
   The read's own delivered review-thread query is part of the attempt: a
   match-bearing attempt costs three provider requests.
4. For each candidate (at most three), read the change record at that candidate's
   own asserted head through the bounded local read and classify that candidate's
   own cause: `record-missing`, `record-invalid`, `record-unreadable`,
   `declaration-missing`, `declaration-unusable`, or `declaration-disagrees`.
5. Accept exactly one candidate whose declaration equals its own source ref
   exactly; report resolution source `declared-at-head` and the observed candidate
   count. None accepted → `merge.branch-unresolved` with the precedence
   `declaration-disagrees` > `record-invalid` > `record-unreadable` >
   `record-missing` > `declaration-missing` > `declaration-unusable`, evidence
   naming each read candidate's own cause. More than one open entry whose source
   ref equals the resolved branch → `merge.transaction-aborted` naming the
   duplicate identities; two accepted candidates with distinct source refs →
   `merge.request-unresolved` / `ambiguous-open-request`.
6. For a non-converged run, take the accepted request's asserted full-SHA head as
   the resolved head.
7. Read the verification record; enforce readability, age bound, head equality
   against the resolved head, and gate-set identity.
8. Probe: work item and the check-run page on the resolved head.
9. Derive the merge-applicable projection and the merge-applicable required-check
   set; evaluate it per job with `recorded` then `probe` attribution.
10. Authorize declared waivers; apply remaining gate failures by declared
    precedence; resolve mergeability from the delivered single-request read of
    the resolved request (the list page cannot carry mergeability; an
    unknown-recovery re-read re-reads the single request, never the list); land
    at most once at the resolved head; report the resolved object and the
    merge-applicable gate projection.

### B. Refusal matrix (each row must name the cause in §17's sense)

Every row renders the dedicated `command=merge`, `ref=<ref>` and `operation=<token>`
fields (§5.1 F-3, API-3) in addition to the cause named below; the `operation`
token is a member of the closed nine-token vocabulary or `-`, and the rendering
site **rejects** a non-member instead of rendering it; the `ref` is always the
invocation's ref. Read counts are declared **per path, not per row**. Every
`merge.branch-unresolved` cause, and every refusal decided before the merge
decision — on the open page (`ambiguous-open-request` for >3 candidates, a
saturated open page, `head-unresolved`, two accepted candidates with distinct
source refs) or at the freshness, work-item or gate stages — performs exactly one
delivery-request provider request — the bounded open-request list read — and **no
merged-request read and no mergeability read**; the declaration causes add no
further provider request beyond it, and `record-unreadable` adds no provider
request for the missing object, only the local read attempt that could not
observe it. A duplicate-open abort also performs exactly one provider request
(the open list that observed the duplicates). An open-page-only run that reaches
the merge decision performs exactly **two** — the open list and the single-request
mergeability read. The `no-open-request` reason and a faulted merged read perform
exactly **two** — the open list and the one merged-request read (the fault is a
distinct outcome, never `no-open-request` itself). A converged replay and a
duplicate-merged abort perform exactly **three** — the open list, the closed
scan, and the merged read's own delivered review-thread query, which no option
suppresses for the merge caller. No path spends more than three.

| Refusal | Cause named | Act required before a re-run converges |
|---|---|---|
| `merge.branch-unresolved` (`declaration-missing`) | candidate source ref, tree path at that head, `branch` key | yes — declare the branch and push it |
| `merge.branch-unresolved` (`declaration-unusable`) | candidate source ref, tree path, the cap and the unusable value class | yes — correct the value (≤ 256 characters, no whitespace or control character) |
| `merge.branch-unresolved` (`declaration-disagrees`) | candidate source ref, the declared value | yes — correct the declaration to match its own request |
| `merge.branch-unresolved` (`record-missing`) | candidate source ref, the tree path attempted | yes — commit the change record on the branch |
| `merge.branch-unresolved` (`record-invalid`) | candidate source ref, tree path, the parse cause | yes — fix the record's YAML |
| `merge.branch-unresolved` (`record-unreadable`) | candidate source ref, the attempted tree path | yes — make the head object present locally (no fetch on this path) |
| `merge.request-unresolved` (`no-open-request`) | change ref, open count, candidate count, and the observed empty matched-identity set (a decidable zero — the additive member present and empty) | yes — open a conforming request (a merged match would have replayed instead; a faulted read reports the provider identity instead) |
| `merge.request-unresolved` (`ambiguous-open-request`) | convention, change ref, open count, candidate count (or page saturation) | yes — resolve the duplicate or narrow the open set. A saturated page refuses this way even with zero convention-matching candidates: saturation is evaluated before the candidate count |
| `merge.request-unresolved` (`head-unresolved`) | candidate source ref, request identity, the unusable head | yes — push a full-SHA head |
| `merge.work-item-unresolved` | work-item ref, read operation (`github-work-item`) | yes — repair the ref or the tracker |
| `merge.gate.<id>.failed` (failing/canceled/skipped) | gate id, job(s), reason, attribution; `operation=-` | yes — repair CI or declare the surface opt-out |
| `merge.gate.<id>.failed` (pending) | gate id, pending job(s), reason; `operation=-` | no — the check converges |
| `merge.gate.<id>.failed` (missing job) | gate id, missing job(s); `operation=-` | yes — run or declare the job |
| `merge.gate.<id>.failed` (page not head) | gate id, both SHAs; `operation=-` | no |
| `merge.gates-stale` | age/bound, both SHAs, or set delta; `operation=-` | yes — re-verify the resolved head |
| `merge.state-unverified` | the unreadable state reason; `operation=delivery-registry` | yes — produce the verification with `verify gates <ref>` for the same work item, then re-run |
| `config.credential.missing` | reference, environment variable, and the operation that required it (`github-delivery-request-list` for a list read, `github-delivery-request-detail` for the mergeability read, `github-check-runs` for a check read, `github-merge-delivery-request` for a landing) | yes — supply the credential |
| `provider.auth.rejected` | reference, the operation attempted | yes — supply a usable credential |
| `provider.outage` | the operation that failed — a read or citation source (including the merged-request read's transport, auth or payload fault, `operation=github-delivery-request-list`, and the mergeability read's fault, `operation=github-delivery-request-detail`), or `github-merge-delivery-request` for a landing | no — a plain re-run converges |
| `merge.transaction-aborted` | the aborted condition — a waiver-append failure, a declared landing gap, or duplicate matching delivery requests (open or merged), named by their duplicate identities; a refused landing is **not** this row; `operation=-` for the waiver and landing-gap causes, `github-delivery-request-list` for the duplicate-request cause (the read that observed the duplicates — the open list or the merged read's identities) | yes (all three causes need an operator act) — the row declares `retryable: false` and claims no convergence, true of the three causes it reaches |
| Landing fault | exactly one of four closed identities, with `operation=github-merge-delivery-request`: `config.credential.missing` (no credential to attempt, naming the reference and the environment variable), `provider.auth.rejected` (rejected credential), `provider.outage` (transient, transport, or unclassified — an arbitrary port token is unclassified), or `merge.landing-unverified` (fired, merged truth not observed). The port's own token is never rendered | per the delivered rows: `provider.outage` no, `provider.auth.rejected` yes (supply a usable credential), `config.credential.missing` yes (supply the credential), `merge.landing-unverified` as its delivered row declares; none is ever `merge.transaction-aborted` |
| `merge.sync-required` / `merge.owner-gate-override-without-waiver` / `merge.waiver-unauthorized` | delivered causes, unchanged | unchanged |
| `merge.mergeability-unknown` | delivered row — code, exit and category unchanged; its firing premise is amended: it reports a mergeability state the **single-request read** could not establish (`operation=github-delivery-request-detail`), never an open-list entry's missing mergeability fields | unchanged |

### C. Decision records

`TDR-0071` (change-branch resolution from the change record read at the delivery
request's head, and head binding), `TDR-0072` (required-check authority, default
gate membership, admitted surfaces), `TDR-0073` (refusal diagnostics contract and
emitted-identity totality) are authored on this branch and cited here. All three
are `Proposed`: the human owner accepts, amends, or rejects them at the PR review,
and the independent challenge is not claimed. This specification states the
behaviour and the identities; the analysis and the rejected alternatives live in
the records. The merged-truth rule is fixed by the owner ruling **CEO-D-111**
(implemented in v2.3) as amended by **CEO-D-116** (2026-11-22, implemented in
v2.4): the primary open read; the delivered merged read used verbatim with one
additive, optional member — the matched request identities — carried on every
match outcome including the shared unavailable outcome; the refuse-on-more-than-
one rule for either read, naming each matched identity; a faulted merged read
reported as the declared provider identity, never as a zero; the read's own
review-thread query counted in the budget, with no suppression option for the
merge caller; and the landing decision's mergeability read from the delivered
single-request read.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-20 | spec-writer | Initial specification for the merge slice of the M4-S3 conformance residual |
| 1.1 | 2026-11-20 | spec-writer | Corrected F-1's migration statement (§5.1) to match the unconditional `merge.branch-unresolved` refusal, and restated the retryability rule at row level (§4.1, F-3, API-3, §8.5, AC-F3-5/AC-F3-6, Appendix B, DEC-5) so it is satisfiable by the delivered error envelope |
| 1.2 | 2026-11-20 | spec-writer | Corrected the current-state and totality claims: the family is resolved at classification (a gate refusal already renders as its declared family row), and the real gap is the composition's type-only declaration and its source-text proof. Restated §2.1, P-4, G-5, F-4, the §5 table rationale, §7.1, §16, RSK-6, §21, and DEC-7 accordingly; no AC text, scope, or identity changed |
| 2.0 | 2026-11-20 | spec-writer | DoR-remediated revision answering the readiness gate's 22 findings. (1) The branch declaration is read **at the delivery request's asserted head** through one bounded local tree/blob read (Critical 1): F-1, §2.1, P-7, §3, G-1, §6 Flows 1–3, §7.1/§7.3, §8.3 DM-1/DM-2, §9 NFR-1/NFR-2/NFR-6/NFR-10, §11, §12, §13, §16, §17.1, §19, §22, §24-A and §24-B are restated on the candidate-set resolution order, the six closed branch reasons with their precedence, the three request reasons, the three pinned constants, and the one-provider-read budget. (2) The identity arithmetic is restated on the synced base — 170 → 173 entries, 169 → 172 delivered, 68 → 71 allowlist, `+136` → `+139`, `merge` kind 9 → 12 — in §4.1, §8.5, §9 NFR-8, §16, §18, and 167 is recorded as a banned stale total (Critical 2). (3) The totality deliverable gains a runtime oracle: AC-F4-1 ranges over the exported runtime family declaration and AC-F4-2 is its negative control, with no source-text proof remaining (Critical 3). (4) The recorded-CI premise is corrected in §2.1, P-3 and DEC-3: the recorded verdict is consulted, the fresh page is not, and the fresh projection carries one gate. (5) §17.7 Definition of Done is added inside §17. (6) The abort row is pinned to `retryable: false` (AC-F3-6, §8.5, §24-B), with the delivered convergence assertion moving with it. (7) The refusal rendering contract is decided (DEC-11): dedicated `command=merge` and `ref=<ref>` fields, with AC-F3-1 asserting the fields and all five refusal golden pairs moving. (8) The merged report's gate semantics are decided (DEC-12, AC-F2-8, API-1, §10): the evaluated merge-applicable projection, not the record's battery list. (9) §16/§19 add the PM instruction surface and the change-convention guide as the home of the authoring obligation. (10) §7.2/§18 state that no installed-binary end-to-end conformance run is claimed. (11) §17.6 re-traces the waiver item and drops AC-F2-7 from it. (12) The final TDR-0071 amendment is folded in: the branch refusal's read claim is exactly one provider read — never zero — with the declaration causes adding no further provider read and `record-unreadable` adding none for the missing object (F-1, §4.1, AC-F1-3, NFR-2/NFR-10, Appendix B); convergence is decided before any record read, so a converged re-run needs no declaration (F-1 step 2, §6 Flow 1, §24-A); the six branch reasons, the three request reasons and their precedence are stated verbatim; and the pinned constants plus the `declared-at-head` source are restated. No previously accepted capability, non-goal or identity was withdrawn; the AC inventory grew from 22 to 24 ids |
| 2.1 | 2026-11-20 | spec-writer | Answers the second readiness iteration's specification findings. (1) The abort row's truth claim is repaired by narrowing its cause set rather than by re-pinning it (major 2): a refused landing no longer reaches `merge.transaction-aborted` and instead reports the provider identity the composition already computes — `provider.outage` for a transient or transport fault, `provider.auth.rejected` for a rejected credential, `merge.landing-unverified` when the landing fired without observed merged truth — so the row reaches exactly the waiver-append failure and a declared landing gap, both pre-mutation and both act-requiring, and `retryable: false` with no convergence promise is true of every cause it still reaches; F-3, AC-F3-3, AC-F3-6, §2.1, G-4, §4.1, §6 Flow 1, §8.5, §16, §22, DEC-6, OQ-5 and §24-B carry it, and §8.5 records that the delivered convergence test asserts the row's old shape and moves with it. (2) Convergence gains an acceptance criterion (major 3): AC-F1-6 asserts a unique already-merged request replays at exit 0 with `replayed=true`, zero change-record reads and zero record-read git invocations, reporting neither `declared-at-head` nor `merge.branch-unresolved` and landing nothing, while two merged matches refuse; F-1 step 2, API-1, DM-2, §24-A, §22 and the glossary state the `replayed` flag, and the inventory grows from 24 to 25 ids (§17.6, DOD-1). (3) The failed operation becomes a third dedicated field (major 4): `operation=<token>` with the closed vocabulary `github-work-item`, `github-check-runs`, `github-delivery-request-list`, `github-delivery-request-detail`, `repository-ci-workflow`, `local-change-record-read`, `local-git-object-read` and `-`, validated at the rendering site and asserted by AC-F3-1 (F-3, API-3, §4.1, NFR-5, §10, §16, §22, §24-B, DEC-5, DEC-11); rendering work only, no new record kind. (4) The `ref` field's empty-value branch is dropped (minor 10): the field always carries the invocation's ref, which every merge refusal path has, and F-3, API-3, AC-F3-1 and DEC-11 say so with no unasserted branch. (5) Saturation precedence is stated (minor 11): a saturated bounded page refuses `ambiguous-open-request` before the candidate count is taken, even with zero convention-matching entries, in F-1 step 3, AC-F1-4, §24-A and §24-B. (6) The merged report is said to state the gates it **freshly evaluated**, with the enforced set named separately (F-2, §10, glossary, DEC-12; nit 12). (7) §2.1's contract paragraph distinguishes the four statements this change amends from the merged-report semantics it states and reconciles (nit 13). (8) DOD-1's inventory arithmetic is restated so the sentence adds up and no id is listed twice — 22 carried forward from v1.0/v1.2, plus AC-F2-8 and AC-F4-2 added in v2.0, plus AC-F1-6 added in v2.1 = 25 — and the validation checklist states the same split. No identity total moved: 173 / 173 / 172 / 71 / `+ 139`, `merge` kind 9 → 12 |
| 2.2 | 2026-11-20 | spec-writer | Answers the third readiness iteration's three specification findings. (1) The read budget is restated honestly on the delivered surface (critical 1): the open list is `state=open` and can never return a merged request, so merged truth comes from one additional bounded **closed-request read**, spent only on the convergence attempt — F-1 is reordered (open read → candidate set → convergence attempt → record reads) and F-1's read-budget and branch-refusal paragraphs, §1, §2.1, §4.1, §6 Flows 1–2 and the new Flow 6, §7.1/§7.3, §8.1 API-1/API-2, §8.3 DM-2, §8.4, §9 NFR-2/NFR-10, §10, §11 (RSK-11…RSK-13), §12, §13, §14 (OQ-6), §15 (DEC-13), §16, §17.1 (AC-F1-3, AC-F1-4, AC-F1-6), §17.6, §19, §22, §23, §24-A and §24-B state **at most two provider reads on a run** — one open list on the resolution path, plus at most one closed list on a convergence attempt — with no pagination, no retry and no fetch, and every surviving "exactly one provider read" claim was swept. The merged candidates are filtered by the **declared branch convention** rather than the shared read's work-item-ref predicate, the merge path observes `0 / 1 / 2+` and **refuses on 2+ rather than ranking**, and the shared closeout read's ranked single selection is named as unchanged; `merge.request-unresolved` gains a fourth closed reason, `ambiguous-merged-request`. (2) The `operation` vocabulary is made equal to what the product cites (minor 6): it is declared as a filter over the delivered source-name vocabulary, drops the unreachable `github-delivery-request-detail`, adds `delivery-registry` and the one landing-operation token, states how a transport read fault, a landing fault and a local read each name their source, and says the rendering site **rejects** an out-of-vocabulary token rather than passing it through (F-3, API-3, §4.1, NFR-5, §10, §23, §24-B, DEC-15, AC-F3-1). (3) The refused-landing pass-through is closed (minor 8): every landing-port failure maps to one of four declared identities — `config.credential.missing`, `provider.auth.rejected`, `provider.outage` for a transient, transport or unclassified failure including an arbitrary port token, `merge.landing-unverified` — and no raw port code may appear in an envelope; the delivered convergence cell that drives the port with an arbitrary undeclared code keeps its behavioural assertions and moves its identity assertion to `provider.outage` (F-3, §2.1, §6 Flow 1, §8.5, §16, §22, §23, RSK-13, DEC-6, DEC-14, AC-F3-3, AC-F3-6, §24-B). No identity total and no AC count moved: 173 / 173 / 172 / 71 / `+ 139`, `merge` kind 9 → 12, 25 AC ids |
| 2.3 | 2026-11-21 | spec-writer | Implements the owner ruling **CEO-D-111** (GH-366), restating merged truth in one place. (1) **Primary read** is the delivered `listDeliveryRequests` at `TRUTH_PROVIDER_LIMIT` with `includeGateFacts: true`, resolved to the open entry whose `sourceRef` equals the change's resolved branch exactly; the convention candidate set only locates the record heads whose declarations are read. (2) **Convergence read** is the delivered `findMergedDeliveryRequest(workItemRef, limit = TRUTH_PROVIDER_LIMIT)` used **verbatim** — its work-item-ref filter and its deterministic selection — with no convention filter of this change's own and no enumerated merged-match refusal vocabulary; it is spent at most once and only when the primary has no match. (3) Because the delivered read exposes no count, the change adds **one additive, optional** `signals.mergedMatches` count computed before its delivered selection; closeout ignores it, so closeout's behaviour and output are unchanged. (4) **More than one match in either read** (an open duplicate for the resolved branch, or `mergedMatches > 1`) refuses `merge.transaction-aborted` naming the duplicate identities and never chooses silently; the abort row therefore reaches **three** causes — a waiver-append failure, a declared landing gap, and duplicate matching delivery requests — all act-requiring, so `retryable: false` stays true. (5) The fourth request reason (the v2.2 merged-ambiguity reason) is **withdrawn** everywhere; `merge.request-unresolved` returns to its three reasons (`no-open-request`, `ambiguous-open-request`, `head-unresolved`). Carriers: §1, §2.1, P-8, §3, §4.1, F-1 steps 1–5 and its read-budget paragraph, F-3, §6 Flow 1 and Flow 6, §7.1/§7.2/§7.3, §8.1 API-1, §8.3 DM-2, §8.4, §8.5, §9 NFR-2/NFR-10, §10, §11 (RSK-11/RSK-12), §12, §13, §14 (OQ-6), §15 (DEC-6/DEC-13/DEC-14), §16, §17.1 (AC-F1-3/AC-F1-4/AC-F1-6), §17.3 AC-F3-6, §17.6, §18, §19, §21, §22, §23, §24-A, §24-B and §24-C. The **25-AC inventory** and the identity arithmetic (**173 / 173 / 172 / 71 / `+ 139`**, `merge` kind **9 → 12**) are unchanged; only the merged-truth rule and the abort row's cause set move. |
| 2.4 | 2026-11-22 | spec-writer | Implements the owner ruling **CEO-D-116** (GH-366, issue comment 2026-11-22T15:13:00Z, outcome (A)), amending the v2.3 merged-truth shape and folding two live findings the same ruling accepted. (1) **Identities, not a count**: the v2.3 additive `signals.mergedMatches: number` is replaced everywhere by one additive, optional member on the shared merged-request read — the **matched request identities** — carried on every match outcome and on the shared closeout contract type's unavailable outcome (empty when the closed page matched nothing, absent when the page could not be read); any count is derived from it and no second count field exists; one identity replays, the empty set is a decidable zero refusing `no-open-request`, and more than one aborts `merge.transaction-aborted` naming **each** matched identity and presenting none as *the* request (AC-F1-6, AC-F3-6, F-3, §6 Flow 6, Appendix B restated in identity language); closeout ignores the member and is unchanged. (2) **Fault is not zero**: a transport, auth or payload failure of the merged read is a distinct outcome refusing the declared provider identity with `operation=github-delivery-request-list`, never `no-open-request` or `merge.request-unresolved` (AC-F1-4's zero half is decidable through the member plus the fault outcome). (3) **Budget truth**: the read's own delivered review-thread query is counted and no suppression option is added (NG-8) — per-path counts restated in §1, §4.1, F-1's budget paragraph, §6, §8.1 API-1/API-2, NFR-2, NFR-10, RSK-11, §22 and Appendix B: 2 for an open-page-only run reaching the merge decision, 2 for an empty convergence attempt, 3 for a match-bearing attempt, ceiling 3 on any run. (4) **The additive member lands on the unavailable arm** of the shared closeout contract type, stated in §18/§19 and DEC-13; closeout's behaviour and output unchanged, the plan's declared scoped edits standing. (5) **DEC-13** explicitly withdraws the "minimum additive change is one optional count signal" claim and records the amended shape; **TDR-0072 and TDR-0073 are amended in place** (the two records whose text stated the count shape); TDR-0071 untouched and TDR-0076 left free. (6) **Folded finding LF-1**: the landing decision's mergeability comes from the delivered **single-request read** of the resolved request (the list endpoint cannot carry mergeability; an unknown-recovery re-read re-reads the single request, never the list) — new **AC-F1-7** pins the oracle; `github-delivery-request-detail` is **restored** to the `operation` vocabulary (nine tokens; F-3, NFR-5, §23, §24-B, DEC-15's rationale), and the identity arithmetic is **recounted and unchanged** — 173 / 173 / 172 / 71 / `+ 139`, `merge` kind 12 — because the ruling adds no error identity. (7) **Folded finding LF-2**: the `merge.state-unverified` remediation names the exact prior command and target — `verify gates <ref>` for the same work item, then re-run (new **AC-F3-7**; §8.5, §6 Flow 1, §16, §24-B). (8) `merge.transaction-aborted` stays at exactly three act-requiring causes with `retryable: false` honest; the #386 push-defect scope is not absorbed. **AC inventory 25 → 27** (DOD-1, §17.6, validation checklist recounted). |
| 2.5 | 2026-11-22 | spec-writer | Answers readiness iteration 5 (`readiness-iter-5`), finding 3 (nit, riding finding 1's authorized remediation pass): the merged-read fault parenthetical in F-1 step 3 is restated so one refusal identity governs — the merged read's transport, auth or payload fault refuses `provider.outage` naming `operation=github-delivery-request-list`, and the delivered payload-invalid mapping is recorded as the reason the payload class lands on that same Appendix B `provider.outage` row (rationale, not a second asserted identity). No acceptance criterion added or removed — the 27-id inventory and the recounted arithmetic stand; no other section changed |
| 2.6 | 2026-11-23 | spec-writer | Numeric-anchor reconciliation: the identity-arithmetic base is corrected to the delivered tree's own outgoing-totals record (169/168 → 172/171, +136 → +138 with the baseline absorbing one row; allowlist 71 and merge kind 12 unchanged) — the v2.4/v2.5 recount anchored on a stale pre-change base; verified against error-table-sync (172/172), the error-table-sync suite (+138, 172/171/71), doc-conformance's required strings, and the green full aggregate gate; no acceptance criterion, shape, or ruling outcome changed |

---

## AUTHORING GUIDELINES

Authored from the owner-scoped delivery definition (the issue comment of
2026-11-20T10:42:14Z and the three earlier owner comments of 2026-11-19T20:49Z,
2026-11-20T01:22Z and 2026-11-20T01:23Z), the change's pm-notes intake record,
the current-truth merge contract, and the three decision records this change
cites. The verified current-state facts were taken from the delivered merge
composition, the merge gate contract, the merge transaction and probe, the error
table, the credentials contract, the pm-notes lint contract, the merge git seam,
the merge feature spec, and the merge test specification. Design questions were
settled rather than deferred: the branch source and its read address, head
binding, the required-check authority, the diagnostics and retryability contract,
emitted-identity totality, the refusal rendering contract, and the report's gate
semantics. Version 2.0 answers the readiness gate's findings: the read-at-head
resolution, the synced-base identity arithmetic, the runtime-declaration oracle,
and the decisions the gate found undecidable are now stated rather than implied.
Version 2.1 answers the second iteration: the abort row's cause set is narrowed so
its `retryable` claim is true of every cause it reaches, convergence gains an
acceptance criterion, the failed operation becomes a declared rendering field, the
unasserted empty-ref branch is removed, saturation precedence is stated, and the
report and current-state wording distinguishes freshly evaluated from enforced.
Version 2.2 answers the third iteration: the one-provider-read claim is withdrawn
because the delivered open list cannot carry merged truth, so the convergence
attempt spends one additional bounded closed-request read and the change states an
at-most-two budget with a per-path count, a convention filter and a refuse-on-
ambiguity rule that leaves closeout's ranked selection untouched; the `operation`
vocabulary is reconciled with every source the product cites and gains a
rejection rule; and the landing-port failure set is closed so no raw port token
can reach an envelope.
Version 2.3 implements the owner ruling CEO-D-111: the primary read is the
delivered open list resolved to the resolved branch exactly; merged truth uses the
delivered merged-request read verbatim with one additive, optional
`signals.mergedMatches` count that closeout ignores; more than one match in either
read aborts `merge.transaction-aborted` naming the duplicate identities rather than
choosing silently; and the abort row therefore reaches three act-requiring causes
while `merge.request-unresolved` returns to its three reasons.
Version 2.4 implements the owner ruling CEO-D-116, which amends CEO-D-111: the
shared merged-request read exposes one additive, optional member — the matched
request identities — on every match outcome including the unavailable arm,
replacing the v2.3 count whose "minimum additive change" premise is explicitly
withdrawn in DEC-13; a faulted read is a distinct outcome that never masquerades
as an empty one; the read's own review-thread query is counted in honest per-path
budgets rather than suppressed; the landing decision reads mergeability from the
delivered single-request read the list page cannot supply; and the
unverified-state remediation names the command that produces the verification.
No implementation steps, file paths, or code-level instructions are given; the
specification states behaviour, contracts, and identities.

## VALIDATION CHECKLIST

- [x] `change.ref` matches the provided `workItemRef` (`GH-366`)
- [x] `owners` has at least one entry (`engineering`)
- [x] `status` is `Proposed`
- [x] `change.milestone` equals the pm-notes milestone verbatim
      (`M4: Jaiship-native delivery`)
- [x] All sections present in order (1–25 + guidelines + checklist); no section
      renumbered — the Definition of Done is §17.7 inside §17
- [x] ID prefixes consistent and unique (F-, API-, EVT-, DM-, NFR-, AC-, DEC-,
      RSK-, OQ-)
- [x] Acceptance criteria reference at least one F-/API-/EVT-/DM-/NFR- ID and use
      Given/When/Then; the inventory is 27 ids (22 carried forward, AC-F2-8 and
      AC-F4-2 added in v2.0, AC-F1-6 added in v2.1, AC-F1-7 and AC-F3-7 added in
      v2.4; v2.2 and v2.3 restate criteria without adding or removing an id)
- [x] NFRs include measurable values, including the per-path delivery-request
      budget with its honest counts (1 for every refusal decided before the merge
      decision, 2 for an open-page-only run reaching the merge decision and for an
      empty convergence attempt, 3 for a match-bearing attempt with the merged
      read's own review-thread query counted and never suppressed; ceiling 3 on
      any run)
- [x] Risks include Impact, Probability, mitigation, and residual risk
- [x] No implementation details (no file-level code paths, no step-by-step tasks)
- [x] Out-of-scope items are prefixed `[OUT]`, including the family-wide battery
      remainder and the installed-binary non-claim
- [x] The four owner acceptance items are carried and traced explicitly
- [x] Identity totals are stated on the synced base (169 → 172 / 168 → 171 /
      68 → 71 / +136 → +138 / merge 9 → 12) and 167 is named as superseded
- [x] Version impact is `minor`, as the changeset addition rule requires
