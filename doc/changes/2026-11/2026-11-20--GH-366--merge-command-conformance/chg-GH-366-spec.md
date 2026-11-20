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
      - "delivered commit check-runs read and delivery-request list/detail read"
    external:
      - "GitHub commit check-runs API (read-only, via the delivered adapter)"
      - "GitHub delivery-request list/detail API (read-only, via the delivered adapter)"
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
refusals with three additive rows plus a declared refusal-cause contract.

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
branch surfaced as an opaque abort rather than a named condition. The list read
is bounded and doubles as the request-detail read, so no second provider read
supplies the request's head or gate facts.

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
transaction converts any landing-port failure into it, and the composition maps a
provider refusal to `provider.outage` for a payload-invalid response whose status
is neither 401 nor 403. A provider outage converges on a plain re-run, so the
row's convergence promise is not merely unnamed for that cause — it is false. No
refusal rendering names the command, the invocation's change ref, or a validated
operation token, and no read operation appears as a field at all: the human and
scripted summaries are
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

## 3. PROBLEM STATEMENT

Because `merge` resolves the change branch and the verified head from the ambient
checkout, and because the merge-applicable projection evaluates only a tracker
gate and never reads the fresh check-run page, an operator merging a change from
the integration base cannot obtain a verdict about the change's delivery
request — the run verifies the base tip and reports a vacuous all-pass gate set,
while the refusals it does emit name neither the command, the ref, the
credential, the work item, nor the gate that breached the contract. The change
record that declares the branch exists only on the change branch, so the
declaration must be read at the head the run is about rather than from the
invocation's working tree. As a result, a failing or pending required check never
stops a landing, and a genuine refusal is indistinguishable from an internal
defect, so the coordinator cannot tell which condition blocked a delivery or
which contract to repair.

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
  no landing fault is reported as that row either (a refused landing reports the
  provider identity the composition computes, and a landing that fired without
  observed merged truth reports its own declared row), no declared row claims
  `retryable: true` while a cause it reaches needs an operator act before a re-run
  can converge, and no remediation hint instructs an operator to clear a condition
  that is not named.
- **G-5**: Every code the merge transaction can emit resolves to a declared row
  or the declared family, and the composition declares that family at runtime
  rather than only in a type, so its exhaustiveness is proven over the runtime
  declaration — and fails by name when that declaration is removed — instead of
  over source text.
- **G-6**: A dry run resolves and describes exactly the object the real merge
  would land, and both reports state the gate projection the run actually
  evaluated.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Merge-applicable gates under the shipped default set | 2 (CI gate + tracker gate), up from 1 |
| Merge-applicable gates rendered in the merged report | 2 — the same projection the dry run evaluates, never the record's battery list |
| Named-checks refusals | 100 % of failing, pending, canceled and skipped required checks refuse at exit 1 with the check name in evidence |
| Base-checkout invocations reporting the base tip as the verified head | 0 |
| Successful resolutions reporting a resolution source other than `declared-at-head` | 0 |
| Provider reads on the resolution path, success or refusal | 1 — the bounded open-request list read, which also supplies the request detail; a `merge.branch-unresolved` or `merge.request-unresolved` refusal spends exactly that one and no other (the declaration causes add no further provider read; `record-unreadable` adds no provider read for the missing object) |
| Local change-record reads on the resolution path | ≤ 3 (one per candidate), 0 working-tree reads, 0 fetches |
| Refusals missing a named cause (dedicated `command` field, code, dedicated `ref` field, dedicated `operation` field, offending object) | 0 across the enumerated refusal matrix (≥ 18 cases) |
| Refusals rendering an `operation` token outside the closed vocabulary | 0 (the vocabulary is validated at the rendering site; `-` is the only value for a refusal that names no operation) |
| Credential refusals naming reference **and** environment variable | 100 % |
| Landing faults reported as `merge.transaction-aborted` | 0 — a transient or transport fault reports `provider.outage`, a rejected credential `provider.auth.rejected`, and a landing that fired without observed merged truth `merge.landing-unverified` |
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

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Change-branch resolution from the change record read at the delivery request's head, cross-checked against the open delivery request | Removes the ambient checkout from the merge path (P-1, P-6, P-7) and gives the invocation a single declared source that is readable where the verdict is needed, with a fail-closed refusal when it cannot be established. |
| F-2 | Required-check enforcement on the resolved head under the shipped default gate set | Makes the merge-applicable projection non-vacuous and turns the delivered per-job mapping into a real merge gate on the fresh page (P-2, P-3). |
| F-3 | Refusal diagnostics contract | Makes every refusal actionable and non-misleading, attributes it to a command and a change, and keeps `retryable` a row property that is nonetheless true of every cause the row reaches (P-4, P-5). |
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

1. **One bounded open-request list read** (the delivered read, with gate facts,
   which is also the request-detail read) yields the merged and open entries, the
   observed open count, and whether the bounded page saturated.
2. **Already-merged convergence** is matched by the invocation's change ref from
   that same list read, **before any change-record read**: a merged request whose
   source ref follows the declared convention for the ref, matching uniquely,
   replays from provider truth at exit 0 and reports `replayed=true` with the
   matched request's identity, and reports neither a `declared-at-head` resolution
   source nor a resolved head taken from the candidate resolution below.
   Because a converged re-run lands nothing, it neither reads a change record nor
   requires a readable head object. Zero merged matches continue to step 3; two
   or more merged matches refuse rather than rank.
3. **Candidate set** = the open entries whose provider-asserted source ref
   matches the repository's declared branch convention for the invocation's ref
   (`^[a-z][a-z0-9-]*/<REF>/.+$`, the delivered predicate already used by the
   closeout resolution), capped at `MERGE_BRANCH_CANDIDATE_MAX = 3`. **Saturation
   is evaluated before the candidate count**: a bounded page that saturated
   refuses `ambiguous-open-request` naming the saturation, *even when zero
   convention-matching candidates are on the page*, because a truncated page
   cannot establish any uniqueness claim and a zero count taken from it would be
   a claim about a page the run did not see. On an unsaturated page, zero
   candidates refuse `merge.request-unresolved` with `no-open-request` and more
   than three refuse it with `ambiguous-open-request`. A candidate whose asserted
   head is absent or is not a full hex SHA refuses `head-unresolved` and is never
   read.
4. **Each candidate's record is read at that candidate's own asserted head**
   through one bounded local read (at most two fixed-argv git invocations: a
   `ls-tree -r --name-only <sha> -- <pathspec>` locate, then one bounded blob
   read), and the candidate is **accepted** only when its `branch` declaration
   equals its own provider-asserted source ref as an exact string. There is no
   prefix, suffix, glob, or change-ref-substring matching; the convention
   narrows *where to look* and never supplies the value.
5. **Exactly one accepted candidate is the delivery request**, and the resolution
   source is reported as **`declared-at-head`**. Two or more accepted candidates
   refuse `merge.request-unresolved` with `ambiguous-open-request` (distinct
   source refs make this unreachable in a well-formed list; it is a declared
   guard, not a ranking).
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
   keeps exactly three reasons — `no-open-request`, `ambiguous-open-request`,
   `head-unresolved` — and a candidate whose head is not a full hex SHA is never
   read.

Convergence is decided **at step 2, before any record read**: a converged re-run
therefore needs no declaration and performs no change-record read at all. It is
not behind the declaration refusal, and no branch-refusal cause can reach a run
whose request is already merged.

The pinned constants are contract constants, not configuration:
`MERGE_BRANCH_DECLARATION_MAX_CHARS = 256` (characters; a longer value is refused,
never truncated), `MERGE_BRANCH_CANDIDATE_MAX = 3`, and
`MERGE_CHANGE_RECORD_MAX_BYTES = 262_144` per record read. The read budget is
**one provider read** (the bounded open-request list, which is also the detail
read) plus at most three bounded local change-record reads (each at most two
fixed-argv git invocations), with no retry, no pagination and no fetch.

The branch refusal's honest read claim is therefore **exactly one provider read**,
not zero: the candidate set can only be built from the list read that the request
resolution needs anyway. Every `merge.branch-unresolved` cause performs that one
read and no other — the declaration causes (`declaration-missing`,
`declaration-unusable`, `declaration-disagrees`) add no further provider read
beyond it, and `record-unreadable` adds no provider read for the missing object,
only the local read attempt that could not observe it. A candidate whose branch
name does not follow the declared convention is invisible to the candidate filter
and therefore refuses `no-open-request` naming the convention and the ref.

A head object the checkout does not hold refuses `record-unreadable`; the merge
path performs no fetch, as a delivered design property, so the run never fetches
to make it readable (NG-7, OQ-4, RSK-9).

The resolution result — resolved branch, resolution source, matched request
identity, observed candidate count, and resolved head — is part of the run's
reported data for both the dry run and the merged report, so an operator can see
which object a verdict describes. The composition never reads the checkout's
branch or head on this path and never reads a change record from the working
tree; a production-source scan with a mandatory failing control proves all three
absences.

The declaration is not configuration: it lives on the change artifact, adds no
key to the configuration document, and carries no schema version. Its absence is
not a default but a refusal: a change whose declaration cannot be established at
its request head refuses `merge.branch-unresolved` unconditionally, so an
existing or in-flight change must add the one-line declaration on its own branch
before it can merge. Nothing stored is re-read to satisfy it — the merge path
reads no historical record — so no backfill is required and no stored state
migrates. The authoring obligation is documented where a change is created (§16,
§19), and the convergence case is exempt because it decides from provider truth
before any record read.

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
- a **dedicated `operation=<token>` field** — the read or citation source the
  refusal is about, drawn from a **closed vocabulary**: `github-work-item`,
  `github-check-runs`, `github-delivery-request-list`,
  `github-delivery-request-detail`, `repository-ci-workflow`,
  `local-change-record-read`, `local-git-object-read`, and `-` when the refusal
  names no operation (a gate refusal, a stale or unverified evidence set, or a
  condition about the declaration's *value* rather than a read). The vocabulary
  is closed and validated at the rendering site, so a token outside it is a
  declared failure rather than free prose, and the field is what makes "names the
  operation that failed" assertable without parsing the summary;
- the refusal code, and the gate id when the code is a family instance;
- the breached contract in operator terms (the candidate source ref and the
  change-record path at the head for a branch refusal; the convention, ref and
  observed counts for a request refusal, including a saturated page; the work
  item that does not resolve; the gate and job that are not green; the operation
  that failed to read; the credential reference and environment variable that are
  unresolvable);
- bounded, secret-free evidence members, never raw payloads, titles, bodies, or
  log lines;
- an actionable remediation, or none at all — never an instruction to clear a
  condition the refusal does not name.

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

**A refused landing never reaches `merge.transaction-aborted`.** A landing fault
reports the identity the composition already computes: the provider identity —
`provider.outage` for a transient or transport fault, `provider.auth.rejected` for
a rejected credential — or `merge.landing-unverified` when the landing fired but
merged truth was not observed. The abort row therefore reaches exactly two causes,
both **pre-mutation** and both requiring an operator act before a re-run can
converge: a **waiver-append failure** and a **declared landing gap**. The cause
removed from it — the refused landing — reports the identities above in place of
the abort, so no converging landing fault is narrated by a row that claims no
convergence.

`retryable` is always the emitted code's declared row value and never a
per-instance value, and a declared row may not carry `retryable: true` while any
cause reachable for that row requires an operator act before a re-run can
converge. Convergence that needs no act — a pending check — is carried by the
refusal's named reason and an accurate remediation, not by a different
`retryable`. `merge.transaction-aborted` therefore declares `retryable: false`
with a remediation that names the aborted pre-mutation condition and promises no
convergence — true of both causes it reaches. The delivered convergence suite
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
count, and the resolved head, so a verdict recorded from an integration-base
checkout is visibly about the request's head rather than about the checkout. Both
reports state the same merge-applicable gate projection.

## 6. USER & SYSTEM FLOWS

```
Flow 1 — Coordinator merges from the integration base checkout.
  Coordinator (on the base branch) runs `merge GH-366`.
    -> one bounded open-request list read (also the request detail)
    -> already merged? a unique merged request for GH-366 replays from provider
       truth right here — exit 0, replayed=true, no record read, no declaration
       needed (converged re-run)
    -> otherwise candidate set: open entries whose source ref follows the declared
       convention for GH-366 (at most three)
    -> each candidate's change record read at its own asserted head
    -> exactly one candidate declares that same branch: resolution
       source=declared-at-head
    -> resolved head = that request's asserted full-SHA head
    -> freshness envelope: record head must equal the resolved head
       -> no fresh record for that head: merge.state-unverified (exit 2)
       -> record for the base tip: merge.gates-stale with both SHAs (exit 1)
       -> fresh record for the resolved head: continue
    -> probe: work item and check-run page on the resolved head
    -> merge-applicable projection (ci-green, tracker-freshness) evaluated
    -> required-check set evaluated per job on the fresh page
       -> any not green: merge.gate.<id>.failed naming the gate and job(s) (exit 1)
       -> all green + tracker gate fresh: one guarded landing at the resolved head
          -> refused or faulted: provider.outage (transient/transport) or
             provider.auth.rejected (rejected credential), naming the operation
          -> landed but merged truth not observed: merge.landing-unverified
          -> never merge.transaction-aborted (that row reaches only the
             waiver-append failure and a declared landing gap)
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
    -> exactly that one provider read (no second provider read of any kind),
       zero landing calls
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

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- Change-branch resolution from the change record **read at the candidate
  delivery request's asserted head**, including the bounded local tree/blob read,
  the candidate set, its cap and saturation guard, the exact-equality acceptance,
  the closed reasons and their precedence, and the removal of the checkout-branch,
  checkout-head, branch-name-parsing and working-tree change-record reads from the
  merge path.
- Binding the verified head, the freshness envelope comparison, the landing's
  expected head, and the reported head to the resolved delivery-request head.
- Making `ci-green` merge-applicable in the shipped default set, deriving the
  merge-applicable required-check set, and evaluating it per job through the
  single delivered mapping on the fresh page with `recorded`/`probe` attribution.
- Reporting the merged report's gate projection as the merge-applicable
  projection the run evaluated.
- The admitted-surface rule for declared built-in entries, and the disclosure of
  the evaluated required-check posture.
- The refusal-diagnostics contract including the dedicated `command` and `ref`
  rendering fields, the retryability rule, and the three additive `merge` rows
  (`merge.branch-unresolved`, `merge.request-unresolved`,
  `merge.work-item-unresolved`) with their closed reason vocabularies.
- Emitted-identity totality for the gate family: a runtime family declaration
  beside the exact-member list, with the totality proof ranging over that
  declaration and the classifier's delivered family resolution untouched.
- Dry-run / real-merge object agreement.
- Reconciliation of the merge feature spec, the merge test specification, the
  merge reference page, the change-lifecycle and change-convention guidance, and
  the PM instruction surface with the amended contract, and the release note.

### 7.2 Out of Scope

- [OUT] The ticket body's family-wide command battery over `dispatch`, `loop`,
  `merge`, `closeout`, `queue`, `phase`, `verify`, `blockers`, `board`, `brief`,
  `metrics`, `spend`, and `provider` on the installed binary. This change claims
  only the `merge` slice plus the diagnostics contract it proves; the remainder is
  explicitly **not** claimed green, the `merge` slice itself is proven by
  in-process suites, **no installed-binary end-to-end conformance run is
  claimed**, and no follow-up ticket is created.
- [OUT] Any branch-protection required-status-contexts read or any other new
  provider operation.
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

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

No HTTP surface is added. The changed contract surfaces are command-level:

| ID | Surface | Contract change |
|----|---------|-----------------|
| API-1 | `merge <ref>` | Resolves the change branch from the declaration read at the delivery request's asserted head, binds the verified head to that request's head, evaluates the merge-applicable required-check set on that head, and refuses by name on every non-green, unreadable, or unresolvable condition. Added machine data: resolved branch, resolution source (`declared-at-head`), matched request identity, observed candidate count, resolved head, a convergence flag (`replayed=true` for an already-merged request, which carries no resolution source and resolves no candidate), evaluated required-check count and set size. The merged report states the merge-applicable projection the run evaluated (`gates=<passed>/<total>` over the two merge-applicable entries, one line per entry with its verdict and reason) and does not echo the verification record's battery gate list. |
| API-2 | `merge <ref> --dry-run` | Same resolution as `API-1`; reports the same resolved object and the same merge-applicable gate projection; appends exactly one verification record for the resolved head; still performs zero mutations and never reports `result=merged` or `squash=`. |
| API-3 | Refusal envelope | `error.code` is the stored identity or the family instance; `error.summary` renders a dedicated `command=merge` field, a dedicated `ref=<ref>` field carrying the invocation's ref, a dedicated `operation=<token>` field drawn from the closed vocabulary and validated at the rendering site (or `-` when the refusal names no operation), the code, the breached contract, and the offending object; evidence members are bounded and secret-free; `retryable` is always the emitted code's declared row value, and no row declares `true` while a cause it reaches needs an operator act before a re-run can converge. A landing fault reports the provider identity (`provider.outage`, `provider.auth.rejected`) or `merge.landing-unverified`, never `merge.transaction-aborted`. |

### 8.2 Events / Messages

| ID | Event | Contract change |
|----|-------|-----------------|
| EVT-1 | `merge.gate-verification` record (`delivery.merge.gate-verification.v1`) | Schema and record kind unchanged. Content changes: a `merge --dry-run` record now carries a CI gate entry alongside the tracker entry, and that entry's citation declares the sources it actually read (the declared CI-workflow source and the check-run page), so a reader can distinguish a merge-surface CI evaluation from a battery one. Records produced by `verify gates` are unchanged. |
| EVT-2 | Capsule and delivery-registry events | Unchanged: no new event kind, key, or schema. Resolution facts are reported in command data, not persisted as a new event. |

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Change-record `branch` declaration | One additive top-level key on the change's pm-notes document. Read **at the candidate delivery request's asserted head** through one bounded local tree/blob read and the delivered parse; never through the working tree. The value is a string of at most `MERGE_BRANCH_DECLARATION_MAX_CHARS = 256` characters carrying no whitespace or control character, and it must equal its own request's provider-asserted source ref exactly. Preserved value-faithfully by every document-writing branch, opaque to lint, and read by no other surface. No fallback derivation, no truncation. |
| DM-2 | Resolved change context | Non-persisted derived facts reported in command data: resolved branch, resolution source (`declared-at-head` on a successful resolution), matched delivery-request identity, observed candidate count, resolved head, a convergence flag (`replayed`, true only for an already-merged replay, where the resolution fields are absent), evaluated required-check count and set size, and the merge-applicable gate projection rendered in the report. Bounded; never a stored record. |
| DM-3 | Merge-applicable gate membership and admitted surfaces | Contract data: the shipped default set's merge-applicable membership becomes two entries; each reserved built-in gains a declared admitted surface set; a built-in's declared class may be omitted to adopt the shipped class. No identity, schema-version, recipe, or configuration-key change. |

### 8.4 External Integrations

- GitHub commit check-runs read: unchanged operation, now consumed for the CI
  gate's per-check state on the resolved head on the fresh path.
- GitHub delivery-request list/detail reads: unchanged operations; the one list
  read is both the convergence match and the request resolution source, and the
  matched entry's asserted head is the resolved head.
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
  landing**. A landing fault reports the provider identity the composition already
  computes — `provider.outage` for a transient or transport fault,
  `provider.auth.rejected` for a rejected credential — or
  `merge.landing-unverified` when the landing fired but merged truth was not
  observed. The row reaches exactly two causes, both pre-mutation: a waiver-append
  failure and a declared landing gap. It declares `retryable: false` with a
  remediation naming the aborted pre-mutation condition and promising no
  convergence — now true of every cause it reaches. The delivered convergence
  suite asserts that row's old shape (a `retryable: true` expectation) and moves
  with the row in the same change; the delivered landing-fault cells move to the
  identities above.
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
| NFR-2 | Read budget | Per invocation: **one provider read** — the bounded open-request list read, which also supplies the request detail — plus at most `MERGE_BRANCH_CANDIDATE_MAX` = 3 bounded local change-record reads (each at most two fixed-argv git invocations), one work-item read, one CI-workflow read, one check-run page on the resolved head, one verification-record read; at most one post-refusal re-read and one unknown-recovery re-read; ≤ 1 landing call; zero retries, zero pagination, zero fetches. A `merge.branch-unresolved` or `merge.request-unresolved` refusal spends exactly that one provider read and no other. |
| NFR-3 | Output bounds | Machine `data` ≤ 65 536 UTF-8 bytes; human summary ≤ 24 lines and ≤ 4 096 UTF-8 bytes; every dropped item marked `+N`; no new unbounded field. |
| NFR-4 | Offline determinism | Zero network calls in every new suite; the new suites spawn no real child process (the local record read and the git seam run through the injected child runner); the existing no-live-call guards stay green. |
| NFR-5 | Refusal completeness | 100 % of refusals across the enumerated matrix (≥ 18 cases) render the dedicated `command`, `ref` and `operation` fields, the code, at least one named cause, and an actionable or absent remediation; every `operation` token is a member of the closed vocabulary or `-`, and 0 tokens outside it are rendered because the value is validated at the rendering site; 0 refusals carry an instruction to clear an unnamed condition. |
| NFR-6 | No ambient read | 0 reads of the checkout's branch **and 0 reads of the checkout's head** on the merge path, 0 working-tree change-record reads, and 0 fetch/pull invocations, proven by a production-source scan with a mandatory failing control. |
| NFR-7 | Identity totality | 100 % of emitted codes resolve to a declared row or the declared family, with the family slot validated against the effective gate set; the proof ranges over the runtime family declaration and fails by name when it is removed; no pattern widening; a live mismatch control still reaches the containment identity. |
| NFR-8 | Identity stability | The effective gate-set id sequence equals the pre-change sequence. Documented and machine error identities move together on the synced base: **170 → 173** machine entries, **169 → 172** delivered rows, **68 → 71** two-segment allowlist members, arithmetic **`BASELINE_ROWS.length + 136` → `+ 139`**, and the `merge` kind from **9** to **12** concrete rows; the reference page, feature spec, test specification, and the phrase-table authority state the same counts in the same change. The phrase table rotates with them: **167 stays a banned stale total**, the outgoing arithmetic base `+ 136` joins the legacy forms, and the incoming `+ 139` is published as the live arithmetic rather than left as a legacy token. |
| NFR-9 | Secret hygiene | 0 occurrences of any credential value, title, body, comment, raw payload, or log line in output or records, verified with canary secrets. |
| NFR-10 | Latency and read shape | The resolution adds **no provider read beyond the one the request resolution needs anyway**: that read is the bounded open-request list read (also the detail read), and the record reads are local, bounded (≤ 3 reads, ≤ 2 fixed-argv git invocations each, 262 144 bytes each) and network-free. Every refusal on the resolution path performs that one provider read and no other — `record-unreadable` included, which adds only the failed local read. No added polling or waiting. |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- The merged report and the dry-run report expose the resolved object (branch,
  resolution source `declared-at-head`, request identity, observed candidate
  count, resolved head, or `replayed=true` for an already-merged replay) and
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
  closed `operation` vocabulary makes read-fault rates countable per source.
- Every refusal's code is the observable signal; the additive rows make the
  previously indistinguishable causes separable in aggregation, and the closed
  branch reasons make "the declaration could not be established" separable from
  "the declaration says the wrong thing". The family instance keeps the gate id in
  the code, so gate refusals are countable per gate without parsing prose.
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
  branch; a second one is an anomaly this change refuses rather than ranks, and a
  non-conforming branch is refused rather than guessed.
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
| Depends on | Delivered delivery-request list read with source ref, head and gate facts | One read supplies the convergence match, the candidate set, the request detail, and the resolved head |
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
| OQ-5 | Do any runtime consumers (as opposed to prompt prose or runbooks) treat `merge.transaction-aborted` as a generic "merge blocked" signal? | The three additive rows split the causes it used to swallow, its `retryable` becomes `false`, and a refused landing leaves it for `provider.outage` / `provider.auth.rejected` / `merge.landing-unverified`. A consumer keying on the literal would lose a signal it must re-express over the new vocabulary. | Deferred; owner: `@pm` at the PR review |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | The change branch has exactly one source: a `branch` declaration on the change's pm-notes, **read at the delivery request's asserted head** through one bounded local tree/blob read. No derived fallback, no working-tree read, no ambient read; a declaration that cannot be established refuses `merge.branch-unresolved` with a closed reason. | The declaration is the reviewable authority, and a declaration the run cannot read is a refusal generator: the change folder exists only on the change branch, so a working-tree read cannot satisfy the base-checkout invocation the capability exists for. Reading at the head keeps one authority and moves only the read's address; the delivered parse and the delivered convention predicate are reused, and the provider list supplies an address rather than a value. Record: TDR-0071. | 2026-11-20 |
| DEC-2 | The resolved delivery request's asserted head is the resolved head: the freshness envelope compares against it, the landing's expected head is it, and the reported head is it. | The merged object is the request, not the checkout; comparing the record against the request head makes a base-tip evidence set refuse `merge.gates-stale` with both SHAs instead of "verifying" the base. Record: TDR-0071. | 2026-11-20 |
| DEC-3 | The shipped default set makes the reserved built-in `ci-green` merge-applicable, and the merge-applicable required-check set is the declared `required-ci-job` entries plus the `ci-green` entry's repository-declared expected job set, evaluated on the fresh check-run page. | The recorded verdict is consulted but the fresh page is never consulted and the fresh projection carries one gate, so a head that turns red inside the freshness bound is invisible. Making `ci-green` merge-applicable fixes the fresh half with the reserved id, one mapping, and no new id, recipe, or configuration key; the entry-id sequence — and therefore the gate-set identity — does not change. Record: TDR-0072. | 2026-11-20 |
| DEC-4 | The check gate is enforced fail-closed and gains no waivability; the declared remedy is the authored `ci-green` surface opt-out, and the admitted surface sets of the reserved built-ins become contract data. | An in-band waiver class on CI would let a failing pipeline land silently-by-policy; a reviewed configuration act is the recorded override. Requiring declaration of surface-not-equal-to-default would invalidate every existing authored set. Record: TDR-0072. | 2026-11-20 |
| DEC-5 | Diagnostics become a contract: every refusal renders a dedicated `command=merge` field, a dedicated `ref=<ref>` field carrying the invocation's ref, a dedicated `operation=<token>` field drawn from a closed vocabulary and validated at the rendering site, the breached contract, and the offending object; credential refusals name the reference and the environment variable; a read fault names the operation in that field; remediation is actionable or absent; `retryable` is the declared row's value, and no row may declare `true` while a cause it reaches needs an operator act before a re-run can converge. | The observed refusals were unactionable and unattributable: no rendering names the command, the ref, or the failed read as a field, and the code's own `merge.` prefix makes a token assertion vacuous. Dedicated fields give the contract a non-vacuous oracle; the closed operation vocabulary makes the read-fault assertion a membership test rather than prose matching. The retryability rule follows because a static row value is the delivered envelope's only retryability field, so the row's cause set must be narrow enough — and honest enough — to make that one value true. Record: TDR-0073. | 2026-11-20 |
| DEC-6 | `merge.transaction-aborted` is narrowed: no credential condition, no unresolvable request or work item, and **no refused landing**; it reaches only two pre-mutation, act-requiring causes — a waiver-append failure and a declared landing gap — and declares `retryable: false` with no convergence hint. Three additive rows carry the removed resolution causes, and a landing fault reports the provider identity (`provider.outage`, `provider.auth.rejected`) or `merge.landing-unverified`. | Each cause has a different operator and a different repair; the generic abort erased that. Additive rows keep existing codes stable. The refused landing is removed rather than re-pinned because a provider refusal or outage converges on a plain re-run, so a row whose remediation promises no convergence would be false for it; naming the provider identity also satisfies the change's own rule that a refusal names the breached contract. The two remaining causes both need an operator act, so `false` is true of every cause the row still reaches. Record: TDR-0073. | 2026-11-20 |
| DEC-7 | Emitted-identity totality is closed in this change by giving the composition a runtime declaration of the gate family, beside its exact-member list, with the slot validated against the effective gate set and the totality proof ranging over that declaration. | The classifier already resolves an emitted family instance to the declared family row; what is missing is the composition's own runtime statement that a family emission is admissible, which today exists only as a type and is asserted only by source text — so the mechanism behind AC 3's guarantee must be made declarative here rather than deferred. Record: TDR-0073. | 2026-11-20 |
| DEC-8 | The dry run and the real merge share one resolution, so a dry run describes the object the merge would land. | A pre-flight verdict about a different object is worse than no verdict. | 2026-11-20 |
| DEC-9 | No new configuration key, schema version, record kind, recipe, or gate id is introduced; the one new declaration lives on the change artifact, and the three new constants are contract constants rather than configuration. | The existing surfaces carry the facts; a configuration key would make the change branch (or the declaration's cap) a per-repository setting, which it is not. | 2026-11-20 |
| DEC-10 | The ticket body's family-wide battery is not claimed; the `merge` slice and the diagnostics contract are claimed, with the remainder recorded as out of scope and no follow-up ticket created. | Owner scope, recorded in the change's pm-notes; PM never creates tickets autonomously. | 2026-11-20 |
| DEC-11 | The refusal rendering contract is uniform: every refusal renders dedicated `command=merge`, `ref=<ref>` and `operation=<token>` fields — the ref is always the invocation's ref, the operation is a closed-vocabulary token or `-` — and all five delivered refusal golden pairs are regenerated in this change. | A uniform field is the only rendering in which "names the command, the ref and the read" can be asserted non-vacuously: the code prefix already contains `merge`, nothing today contains the ref, and no delivered summary carries a validated operation token. An empty-ref placeholder branch was considered and dropped because every merge refusal path is reached with a usable ref, so the branch would be unasserted by construction. Narrowing the contract instead would leave the owner's "every refusal names the command" item with no oracle. | 2026-11-20 |
| DEC-12 | The merged report renders the **merge-applicable projection the run evaluated**, not the verification record's battery gate list. | The report's subject is what the merge **freshly evaluated**; echoing the battery's five gates states the verification's posture and hides the merge's. The enforced set — every built-in, including the recorded-verdict check — is unchanged and is not what the two reported lines describe. Rendering the evaluated projection makes the success and dry-run reports tell the same story and makes the "two merge-applicable gates" metric observable in normal output. | 2026-11-20 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Merge production composition | Updated — candidate-set resolution over one open-request list read, a bounded local change-record read at each candidate head, the `branch` declaration resolution with its closed reasons and precedence, exact-match acceptance with the full-SHA head guard, resolved-head binding, credential and read-fault naming, removal of the checkout-branch, checkout-head, branch-name-parse and working-tree change-record reads from this path, a runtime family declaration for the gate family, and the refusal rendering work: the third dedicated `operation` field with its closed vocabulary validated where the summary is rendered (rendering work only — no new record kind, event, or persisted surface) |
| Merge contracts (report shapes, default gate set, admitted surfaces) | Updated — the merged and dry-run report shapes gain the resolved object, the resolution source or `replayed` flag, candidate count and the merge-applicable gate projection; `ci-green` merge-applicable by default; declared admitted-surface sets; the three new resolution constants |
| Merge git seam (local object read) | Extended — its existing bounded, fixed-argv, local tree-of-commit read is the precedent for the one record read at a candidate head; no provider, network or credential surface is added |
| Merge emittable-code declaration and totality proof | Updated — the family is declared at runtime beside the exact-member list, the proof ranges over that declaration and fails by name when it is removed, and the delivered classifier family resolution is unchanged |
| Merge transaction (freshness, probe, refusal evidence) | Updated — required-check set derivation, merge-surface CI evaluation on the fresh page, refused page-not-head, evidence members, the merged report's gate projection, and the landing-fault attribution: a refused or faulted landing reports `provider.outage`, `provider.auth.rejected` or `merge.landing-unverified` instead of being converted into the abort row, which keeps only the waiver-append failure and a declared landing gap |
| Merge probe / required-check mapping | Reused unchanged as the single evaluator; the required-check set it is fed is extended |
| Change-record read (pm-notes) | Reused — the delivered parse applied to text read from the candidate head; no parser change |
| CI-workflow expected-job read | Reused — one additional consumer |
| Error table (machine and documented) | Updated — three additive `merge` rows, the narrowed abort row's `retryable` and remediation with its two-cause set (the refused-landing cause removed to `provider.outage` / `provider.auth.rejected` / `merge.landing-unverified`), remediation and summary adjustments, totals **170 → 173** (delivered 169 → 172, two-segment allowlist 68 → 71, arithmetic `BASELINE_ROWS.length + 136` → `+ 139`, `merge` kind 9 → 12) |
| Merge reference page | Updated — branch and head resolution, the declaration's cap and closed reasons, gate set, the convergence case, exit-status causes, refusal examples with the three new fields and the closed `operation` vocabulary |
| Merge feature spec | Updated — Overview resolution paragraph, gate registry defaults, verification-record head meaning, merged-report gate semantics, error identities, invariants |
| Merge test specification | Updated — "Composition reachability", "Required-check awareness", "Classification fidelity", "Emittable-code totality", "Error-identity stability" rows |
| Change-lifecycle and change-convention guidance for change records | Updated — the `branch` declaration requirement, its 256-character cap, its closed refusal reasons, its read-at-head semantics, and the declaration-free convergence case |
| PM instruction surface (`.ai/agent/pm-instructions.md`, the `@pm` prompt and its generated `.ados-claude` mirror) | Updated — the change record declares `branch` when the change is opened, with the cap and the refusal vocabulary named; the prompt edit is regenerated, not hand-edited |
| Release note (changeset) | New — the fixed-group packages at `minor` |

## 17. ACCEPTANCE CRITERIA

### 17.1 Change-branch resolution (owner AC 1)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** an open delivery request for the change and a fixture whose working tree carries **no** change folder and whose checkout HEAD is the integration-base tip, **when** `merge <ref>` runs, **then** the declaration is read at the request's asserted head, the resolution source is reported as `declared-at-head`, the run reports the request's head as the resolved head, verifies or refuses against that head, and can never report the base tip as the verified head. *(owner AC 1; regression (a))* | F-1, API-1, DM-1, DM-2 |
| AC-F1-2 | **Given** the same request and an invocation from the change-branch checkout at the request head, **when** `merge <ref>` runs, **then** the record read at the request head governs over any record present in the checkout's working tree, the verified head equals the request head, and the result is `merged` only after the one guarded landing at that head. *(owner AC 1)* | F-1, API-1 |
| AC-F1-3 | **Given** an invocation whose candidate change records cannot establish a declaration — no `branch` key, a non-string or empty value, a value containing whitespace or a control character or longer than 256 characters, a value that disagrees with its own request's source ref, a head carrying no record, a record that does not parse, or a head object the checkout does not hold — **when** `merge <ref>` runs, **then** it refuses `merge.branch-unresolved` at exit 1 with exactly one closed reason (`declaration-missing`, `declaration-unusable`, `declaration-disagrees`, `record-missing`, `record-invalid`, `record-unreadable`) chosen by the declared precedence, naming the candidate's source ref, the change-record tree path at that head, and the `branch` key, having spent exactly that one bounded open-request list read — the read the request resolution needs anyway — and no other provider read, plus at most three local record reads, with zero landing calls. | F-1, DM-1, NFR-5 |
| AC-F1-4 | **Given** an open-request list read where zero open entries follow the declared convention for the ref, where more than three do, where the bounded page saturated — including a saturated page on which **zero** convention-matching candidates appear — where two or more candidates are accepted, or where a candidate's asserted head is absent or not a full hex SHA, **when** `merge <ref>` runs, **then** it refuses `merge.request-unresolved` at exit 1 with `no-open-request`, `ambiguous-open-request`, or `head-unresolved` accordingly, naming the convention, the change ref, the observed open count and the candidate count, and a candidate whose head is not a full SHA is never read. Saturation is evaluated before the candidate count, so a truncated page refuses `ambiguous-open-request` even with zero convention-matching entries rather than claiming `no-open-request`. | F-1, API-3, DM-2 |
| AC-F1-5 | **Given** a fresh verification record whose head is the integration base and a resolved request head that differs, **when** `merge <ref>` runs, **then** it refuses `merge.gates-stale` at exit 1 recording both SHAs and performs zero landing calls. | F-1, F-2, API-1 |
| AC-F1-6 | **Given** a delivery-request list read carrying exactly one merged request whose source ref follows the declared convention for the change ref, and no readable change record anywhere (no change folder in the working tree, a head object absent from the local object database, and no declaration reachable), **when** `merge <ref>` runs, **then** it replays from provider truth at exit 0 and reports `replayed=true`, performs **zero** change-record reads and zero record-read git invocations, reports neither `declared-at-head` nor `merge.branch-unresolved`, and lands nothing; two or more merged matches refuse rather than rank. *(owner AC 1)* | F-1, API-1, NFR-2 |

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
| AC-F3-1 | **Given** any refusal across the enumerated refusal matrix, **when** it is rendered, **then** it carries a dedicated `command=merge` field, a dedicated `ref=<ref>` field carrying the invocation's ref, a dedicated `operation=<token>` field drawn from the closed vocabulary (or `-` when the refusal names no operation), the code, and at least one named cause, and its remediation is actionable or absent — never an instruction to clear an unnamed condition. The command, ref and operation assertions are made against those fields, not against the occurrence of the string `merge`, of the ref, or of an operation name anywhere in the summary. *(owner AC 3)* | F-3, API-3, NFR-5 |
| AC-F3-2 | **Given** an absent token in the environment, **when** `merge <ref>` runs, **then** it refuses `config.credential.missing` at exit 1 naming the credential reference, the environment variable, and the operation that required it. *(owner AC 3; regression (c))* | F-3, API-3, NFR-9 |
| AC-F3-3 | **Given** any credential condition on the merge path, **when** it is rendered, **then** the reported code is the declared credential or auth identity (`config.credential.missing`, `provider.auth.rejected`) and never `merge.transaction-aborted`; and **given** any landing fault, **when** it is rendered, **then** it is reported as the provider identity the composition already computes — `provider.outage` for a transient or transport fault, `provider.auth.rejected` for a rejected credential — or as `merge.landing-unverified` when the landing fired but merged truth was not observed, and never as `merge.transaction-aborted`. | F-3, API-3 |
| AC-F3-4 | **Given** a tracker work item that does not resolve, **when** `merge <ref>` runs, **then** it refuses `merge.work-item-unresolved` at exit 1 naming the work-item ref and the read operation, and the remediation names that cause. | F-3, API-3, NFR-5 |
| AC-F3-5 | **Given** any refusal the merge command emits, **when** it is rendered, **then** `retryable` equals the declared row value of the emitted code and is never a per-instance value, and its remediation is accurate for the named cause — a condition that clears without an operator act (a pending check) is expressed by the refusal's named reason and a remediation that says so, and no remediation instructs an operator to clear a condition the refusal does not name. | F-3, API-3 |
| AC-F3-6 | **Given** every declared row on the merge refusal surface, **when** each row's reachable cause set is inspected, **then** no row declares `retryable: true` while a cause it reaches requires an operator act before a re-run can converge; `merge.transaction-aborted` reaches exactly two causes — a waiver-append failure and a declared landing gap, both pre-mutation — and declares `retryable: false` with a remediation that names the aborted pre-mutation condition and promises no convergence, true of both; a refused landing is not among its causes, reporting `provider.outage` (transient or transport fault), `provider.auth.rejected` (rejected credential), or `merge.landing-unverified` (landing fired, merged truth not observed); and the family row's single `false` stays honest for every gate cause, including the act-free pending one. *(owner AC 3)* | F-3, API-3, NFR-5 |

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
| Already-merged convergence — a converged re-run replays from provider truth with no change-record read and no declaration, and lands nothing | AC-F1-6 |
| AC 2 — required checks read on the resolved head; failing and pending each fail closed and are named | AC-F2-1, AC-F2-2, AC-F2-3, AC-F2-4, AC-F2-5, AC-F2-8 |
| AC 3 — every refusal names the command and the breached contract, including the credential reference and environment name | AC-F3-1, AC-F3-2, AC-F3-3, AC-F3-4, AC-F4-1, AC-F4-2 |
| AC 4 — regressions: (a) base-checkout invocation does not verify the base tip; (b) one failing required check refuses with that check named; (c) absent `GITHUB_TOKEN` names the variable | AC-F1-1, AC-F2-1, AC-F3-2, AC-F5-3 |
| Pending-check refusal and the retained explicit waiver path | AC-F2-2, AC-F2-3. The explicit `--waive` path is unchanged by this change (NG-6) and is asserted by the delivered waiver suite's authorized-waiver case — an authorized `--waive owner-gate --waived-by <authorized principal>` is recorded before landing and the gate passes under it — together with its delivered unauthorized and missing-principal cases. |
| Unreadable work item names its cause; no unnamed remediation; `retryable` follows the declared row and no row overstates convergence | AC-F3-1, AC-F3-4, AC-F3-5, AC-F3-6 |
| Dry run describes the same object the real merge would land | AC-F5-1, AC-F5-2 |

### 17.7 Definition of Done

This change is done when every row below holds, with the evidence named in it.

| # | Condition | Evidence |
|---|---|---|
| DOD-1 | Every acceptance criterion is green: the 22 carried forward from v1.0/v1.2 (AC-F1-1…AC-F1-5, AC-F2-1…AC-F2-7, AC-F3-1…AC-F3-6, AC-F4-1, AC-F5-1…AC-F5-3), plus the two added in v2.0 (AC-F2-8 merged-report projection, AC-F4-2 runtime-declaration negative control) and the one added in v2.1 (AC-F1-6 already-merged convergence) — 25 ids in all. | The test plan's per-AC case results, with each criterion's named cases green inside the aggregate gate. |
| DOD-2 | All ten non-functional requirements (NFR-1…NFR-10) are green at their stated thresholds. | The test plan's NFR rows and the gates that execute them. |
| DOD-3 | Every declared plan phase is complete, with its pm-notes evidence entry recording the gate it passed. | `phase list` shows all phases complete; the pm-notes `notes:` entries carry each phase's evidence. |
| DOD-4 | TDR-0071, TDR-0072 and TDR-0073 are accepted or amended at the PR review, and no record's premise contradicts the delivered behaviour (the recorded-versus-fresh CI account, the read-at-head resolution, the `retryable: false` abort row). | The PR review record and each record's status and decision date. |
| DOD-5 | The identity totals are reconciled on the synced base: 173 machine identities / 173 documented / 172 delivered / 71 two-segment allowlist members / `BASELINE_ROWS.length + 139`, with the `merge` kind at 12 concrete rows, and no page states a superseded total. | The error-table sync suite, the documented table and reference page, and the phrase-table scan. |
| DOD-6 | The changed current-truth pages and the changeset have landed: the merge feature spec, the merge test specification, the merge reference page, the change-lifecycle and change-convention guidance, the PM instruction surface (with its regenerated mirror), and the fixed-group packages at `minor`. | The doc-sync phase's diff and the committed changeset. |
| DOD-7 | The doc-distribution guard and the aggregate gate are green, with every check executed and none skipped. | The distribution guard and the aggregate check output. |
| DOD-8 | The scope held and the scope not claimed are disclosed in the PR body: the `merge` slice plus the diagnostics contract are claimed, proven by in-process suites, and the family-wide installed-binary battery is not claimed. | The PR body's scope section. |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- One change delivers the behaviour, the three additive rows, the amended
  documented table, the reference page, the feature spec, the test specification,
  and the regenerated refusal goldens together: documented and machine-declared
  identities move in the same change, and the pinned totals move with them
  (170 → 173 on the synced base, delivered 169 → 172, allowlist 68 → 71,
  arithmetic `+136` → `+139`, `merge` kind 9 → 12).
- Delivery order: refusal identities and the diagnostics contract first (they are
  the vocabulary the other capabilities report in), then the branch/head
  resolution, then the required-check enforcement, then the report and dry-run
  agreement; every phase leaves the delivered behaviour consistent with its
  declarations.
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
  is decided from provider truth before any record read, so it requires neither a
  declaration nor a locally readable head object.

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
  reference; read-only operations are reused, and the change-record read is a
  local git object read with no network and no credential.
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

- Operators gain three new refusal causes to recognise, each with a named repair,
  and the branch refusal's six closed reasons separate "no declaration" from
  "wrong declaration" from "record not readable here"; runbooks and the reference
  page carry them.
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
  that, and the pinned totals move with any future identity change.
- Refusal renderings are now a consumed surface: anything that parsed
  `result=refused; condition=<code>` keeps working on the code line, but the
  summary gains the `command`, `ref` and `operation` fields and the five refusal
  goldens are regenerated. A refused landing now appears under the provider
  identity or the landing-unverified row rather than under the abort, so an
  operator or a runbook that watched for the abort on a landing fault switches to
  the named provider condition.

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
| Operation token | The closed-vocabulary value of a refusal's dedicated `operation` field: one of `github-work-item`, `github-check-runs`, `github-delivery-request-list`, `github-delivery-request-detail`, `repository-ci-workflow`, `local-change-record-read`, `local-git-object-read`, or `-` when the refusal names no operation. Validated at the rendering site. |
| Converged re-run | A `merge` whose change ref matches exactly one already-merged delivery request: it replays from provider truth at exit 0 with `replayed=true`, reads no change record, needs no declaration, and lands nothing. |
| Refusal cause | The named object or operation a refusal reports: the candidate source ref and record path, the unresolved request, the unresolved work item, the non-green job, the failed read, or the unresolvable credential. |
| Containment identity | The generic internal failure rendered when an emitted code is not declared; reachable only for a genuinely undeclared failure. |
| Named checks refusal | A refusal on the `merge.gate.<gate-id>.failed` family that names the gate and the offending check. |

## 24. APPENDICES

### A. Resolution procedure (normative order)

1. Perform the one bounded open-request list read (it is also the request-detail
   read); record the open count and whether the page saturated.
2. Match already-merged convergence by the invocation's change ref against that
   read: a unique merged request whose source ref follows the convention replays
   from provider truth at exit 0 with `replayed=true`, so the run skips steps 3–5
   entirely — no record read, no declaration needed, and no head taken from the
   resolution below (the replay is decided from provider truth). Two or more
   merged matches refuse rather than rank.
3. Build the candidate set: open entries whose provider-asserted source ref
   matches `^[a-z][a-z0-9-]*/<REF>/.+$` for the invocation's ref, capped at three.
   **Saturation is evaluated first**: a saturated page →
   `merge.request-unresolved` / `ambiguous-open-request`, even with zero
   convention-matching entries, because a truncated page establishes no
   uniqueness. On an unsaturated page: zero → `no-open-request`; more than three
   → `ambiguous-open-request`; a candidate head absent or not a full hex SHA →
   `head-unresolved`, and that candidate is never read.
4. For each candidate (at most three), read the change record at that candidate's
   own asserted head through the bounded local read and classify that candidate's
   own cause: `record-missing`, `record-invalid`, `record-unreadable`,
   `declaration-missing`, `declaration-unusable`, or `declaration-disagrees`.
5. Accept exactly one candidate whose declaration equals its own source ref
   exactly; report resolution source `declared-at-head` and the observed candidate
   count. None accepted → `merge.branch-unresolved` with the precedence
   `declaration-disagrees` > `record-invalid` > `record-unreadable` >
   `record-missing` > `declaration-missing` > `declaration-unusable`, evidence
   naming each read candidate's own cause. Two accepted →
   `merge.request-unresolved` / `ambiguous-open-request`.
6. For a non-converged run, take the accepted request's asserted full-SHA head as
   the resolved head.
7. Read the verification record; enforce readability, age bound, head equality
   against the resolved head, and gate-set identity.
8. Probe: work item and the check-run page on the resolved head.
9. Derive the merge-applicable projection and the merge-applicable required-check
   set; evaluate it per job with `recorded` then `probe` attribution.
10. Authorize declared waivers; apply remaining gate failures by declared
    precedence; resolve mergeability; land at most once at the resolved head;
    report the resolved object and the merge-applicable gate projection.

### B. Refusal matrix (each row must name the cause in §17's sense)

Every row renders the dedicated `command=merge`, `ref=<ref>` and `operation=<token>`
fields (§5.1 F-3, API-3) in addition to the cause named below; the `operation`
token is a member of the closed vocabulary or `-`, and the `ref` is always the
invocation's ref. Every `merge.branch-unresolved`
cause performs exactly one provider read — the bounded open-request list read
that locates the candidates — and no other; the declaration causes add no further
provider read beyond it, and `record-unreadable` adds no provider read for the
missing object, only the local read attempt that could not observe it. Every
`merge.request-unresolved` cause likewise spends that same one read.

| Refusal | Cause named | Act required before a re-run converges |
|---|---|---|
| `merge.branch-unresolved` (`declaration-missing`) | candidate source ref, tree path at that head, `branch` key | yes — declare the branch and push it |
| `merge.branch-unresolved` (`declaration-unusable`) | candidate source ref, tree path, the cap and the unusable value class | yes — correct the value (≤ 256 characters, no whitespace or control character) |
| `merge.branch-unresolved` (`declaration-disagrees`) | candidate source ref, the declared value | yes — correct the declaration to match its own request |
| `merge.branch-unresolved` (`record-missing`) | candidate source ref, the tree path attempted | yes — commit the change record on the branch |
| `merge.branch-unresolved` (`record-invalid`) | candidate source ref, tree path, the parse cause | yes — fix the record's YAML |
| `merge.branch-unresolved` (`record-unreadable`) | candidate source ref, the attempted tree path | yes — make the head object present locally (no fetch on this path) |
| `merge.request-unresolved` (`no-open-request`) | convention, change ref, open count, candidate count | yes — open a conforming request |
| `merge.request-unresolved` (`ambiguous-open-request`) | convention, change ref, open count, candidate count (or page saturation) | yes — resolve the duplicate or narrow the open set. A saturated page refuses this way even with zero convention-matching candidates: saturation is evaluated before the candidate count |
| `merge.request-unresolved` (`head-unresolved`) | candidate source ref, request identity, the unusable head | yes — push a full-SHA head |
| `merge.work-item-unresolved` | work-item ref, read operation | yes — repair the ref or the tracker |
| `merge.gate.<id>.failed` (failing/canceled/skipped) | gate id, job(s), reason, attribution | yes — repair CI or declare the surface opt-out |
| `merge.gate.<id>.failed` (pending) | gate id, pending job(s), reason | no — the check converges |
| `merge.gate.<id>.failed` (missing job) | gate id, missing job(s) | yes — run or declare the job |
| `merge.gate.<id>.failed` (page not head) | gate id, both SHAs | no |
| `merge.gates-stale` | age/bound, both SHAs, or set delta | yes — re-verify the resolved head |
| `merge.state-unverified` | the unreadable state reason | yes — produce a verification |
| `config.credential.missing` | reference, environment variable, operation | yes — supply the credential |
| `provider.auth.rejected` | reference, operation | yes — supply a usable credential |
| `provider.outage` | the failed operation | no — a plain re-run converges |
| `merge.transaction-aborted` | the aborted pre-mutation condition — only a waiver-append failure or a declared landing gap; a refused landing is **not** this row | yes (both remaining causes need an operator act) — the row declares `retryable: false` and claims no convergence, true of the two causes it reaches |
| Landing fault | a transient or transport fault reports `provider.outage` naming the failed operation; a rejected credential reports `provider.auth.rejected` naming the reference and the operation; a landing that fired without observed merged truth reports `merge.landing-unverified` | per the delivered rows: `provider.outage` no, `provider.auth.rejected` yes (supply a usable credential), `merge.landing-unverified` as its delivered row declares; none is ever `merge.transaction-aborted` |
| `merge.sync-required` / `merge.mergeability-unknown` / `merge.owner-gate-override-without-waiver` / `merge.waiver-unauthorized` | delivered causes, unchanged | unchanged |

### C. Decision records

`TDR-0071` (change-branch resolution from the change record read at the delivery
request's head, and head binding), `TDR-0072` (required-check authority, default
gate membership, admitted surfaces), `TDR-0073` (refusal diagnostics contract and
emitted-identity totality) are authored on this branch and cited here. All three
are `Proposed`: the human owner accepts, amends, or rejects them at the PR review,
and the independent challenge is not claimed. This specification states the
behaviour and the identities; the analysis and the rejected alternatives live in
the records.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-20 | spec-writer | Initial specification for the merge slice of the M4-S3 conformance residual |
| 1.1 | 2026-11-20 | spec-writer | Corrected F-1's migration statement (§5.1) to match the unconditional `merge.branch-unresolved` refusal, and restated the retryability rule at row level (§4.1, F-3, API-3, §8.5, AC-F3-5/AC-F3-6, Appendix B, DEC-5) so it is satisfiable by the delivered error envelope |
| 1.2 | 2026-11-20 | spec-writer | Corrected the current-state and totality claims: the family is resolved at classification (a gate refusal already renders as its declared family row), and the real gap is the composition's type-only declaration and its source-text proof. Restated §2.1, P-4, G-5, F-4, the §5 table rationale, §7.1, §16, RSK-6, §21, and DEC-7 accordingly; no AC text, scope, or identity changed |
| 2.0 | 2026-11-20 | spec-writer | DoR-remediated revision answering the readiness gate's 22 findings. (1) The branch declaration is read **at the delivery request's asserted head** through one bounded local tree/blob read (Critical 1): F-1, §2.1, P-7, §3, G-1, §6 Flows 1–3, §7.1/§7.3, §8.3 DM-1/DM-2, §9 NFR-1/NFR-2/NFR-6/NFR-10, §11, §12, §13, §16, §17.1, §19, §22, §24-A and §24-B are restated on the candidate-set resolution order, the six closed branch reasons with their precedence, the three request reasons, the three pinned constants, and the one-provider-read budget. (2) The identity arithmetic is restated on the synced base — 170 → 173 entries, 169 → 172 delivered, 68 → 71 allowlist, `+136` → `+139`, `merge` kind 9 → 12 — in §4.1, §8.5, §9 NFR-8, §16, §18, and 167 is recorded as a banned stale total (Critical 2). (3) The totality deliverable gains a runtime oracle: AC-F4-1 ranges over the exported runtime family declaration and AC-F4-2 is its negative control, with no source-text proof remaining (Critical 3). (4) The recorded-CI premise is corrected in §2.1, P-3 and DEC-3: the recorded verdict is consulted, the fresh page is not, and the fresh projection carries one gate. (5) §17.7 Definition of Done is added inside §17. (6) The abort row is pinned to `retryable: false` (AC-F3-6, §8.5, §24-B), with the delivered convergence assertion moving with it. (7) The refusal rendering contract is decided (DEC-11): dedicated `command=merge` and `ref=<ref>` fields, with AC-F3-1 asserting the fields and all five refusal golden pairs moving. (8) The merged report's gate semantics are decided (DEC-12, AC-F2-8, API-1, §10): the evaluated merge-applicable projection, not the record's battery list. (9) §16/§19 add the PM instruction surface and the change-convention guide as the home of the authoring obligation. (10) §7.2/§18 state that no installed-binary end-to-end conformance run is claimed. (11) §17.6 re-traces the waiver item and drops AC-F2-7 from it. (12) The final TDR-0071 amendment is folded in: the branch refusal's read claim is exactly one provider read — never zero — with the declaration causes adding no further provider read and `record-unreadable` adding none for the missing object (F-1, §4.1, AC-F1-3, NFR-2/NFR-10, Appendix B); convergence is decided before any record read, so a converged re-run needs no declaration (F-1 step 2, §6 Flow 1, §24-A); the six branch reasons, the three request reasons and their precedence are stated verbatim; and the pinned constants plus the `declared-at-head` source are restated. No previously accepted capability, non-goal or identity was withdrawn; the AC inventory grew from 22 to 24 ids |
| 2.1 | 2026-11-20 | spec-writer | Answers the second readiness iteration's specification findings. (1) The abort row's truth claim is repaired by narrowing its cause set rather than by re-pinning it (major 2): a refused landing no longer reaches `merge.transaction-aborted` and instead reports the provider identity the composition already computes — `provider.outage` for a transient or transport fault, `provider.auth.rejected` for a rejected credential, `merge.landing-unverified` when the landing fired without observed merged truth — so the row reaches exactly the waiver-append failure and a declared landing gap, both pre-mutation and both act-requiring, and `retryable: false` with no convergence promise is true of every cause it still reaches; F-3, AC-F3-3, AC-F3-6, §2.1, G-4, §4.1, §6 Flow 1, §8.5, §16, §22, DEC-6, OQ-5 and §24-B carry it, and §8.5 records that the delivered convergence test asserts the row's old shape and moves with it. (2) Convergence gains an acceptance criterion (major 3): AC-F1-6 asserts a unique already-merged request replays at exit 0 with `replayed=true`, zero change-record reads and zero record-read git invocations, reporting neither `declared-at-head` nor `merge.branch-unresolved` and landing nothing, while two merged matches refuse; F-1 step 2, API-1, DM-2, §24-A, §22 and the glossary state the `replayed` flag, and the inventory grows from 24 to 25 ids (§17.6, DOD-1). (3) The failed operation becomes a third dedicated field (major 4): `operation=<token>` with the closed vocabulary `github-work-item`, `github-check-runs`, `github-delivery-request-list`, `github-delivery-request-detail`, `repository-ci-workflow`, `local-change-record-read`, `local-git-object-read` and `-`, validated at the rendering site and asserted by AC-F3-1 (F-3, API-3, §4.1, NFR-5, §10, §16, §22, §24-B, DEC-5, DEC-11); rendering work only, no new record kind. (4) The `ref` field's empty-value branch is dropped (minor 10): the field always carries the invocation's ref, which every merge refusal path has, and F-3, API-3, AC-F3-1 and DEC-11 say so with no unasserted branch. (5) Saturation precedence is stated (minor 11): a saturated bounded page refuses `ambiguous-open-request` before the candidate count is taken, even with zero convention-matching entries, in F-1 step 3, AC-F1-4, §24-A and §24-B. (6) The merged report is said to state the gates it **freshly evaluated**, with the enforced set named separately (F-2, §10, glossary, DEC-12; nit 12). (7) §2.1's contract paragraph distinguishes the four statements this change amends from the merged-report semantics it states and reconciles (nit 13). (8) DOD-1's inventory arithmetic is restated so the sentence adds up and no id is listed twice — 22 carried forward from v1.0/v1.2, plus AC-F2-8 and AC-F4-2 added in v2.0, plus AC-F1-6 added in v2.1 = 25 — and the validation checklist states the same split. No identity total moved: 173 / 173 / 172 / 71 / `+ 139`, `merge` kind 9 → 12 |

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
      Given/When/Then; the inventory is 25 ids (22 carried forward, AC-F2-8 and
      AC-F4-2 added in v2.0, AC-F1-6 added in v2.1)
- [x] NFRs include measurable values, including the one-provider-read budget
- [x] Risks include Impact, Probability, mitigation, and residual risk
- [x] No implementation details (no file-level code paths, no step-by-step tasks)
- [x] Out-of-scope items are prefixed `[OUT]`, including the family-wide battery
      remainder and the installed-binary non-claim
- [x] The four owner acceptance items are carried and traced explicitly
- [x] Identity totals are stated on the synced base (170 → 173 / 169 → 172 /
      68 → 71 / +136 → +139 / merge 9 → 12) and 167 is named as superseded
- [x] Version impact is `minor`, as the changeset addition rule requires
