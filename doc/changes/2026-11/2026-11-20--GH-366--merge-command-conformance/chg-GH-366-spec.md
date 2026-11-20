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
      - "delivered change-record (pm-notes) read"
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
> refusal name the command, the breached contract, and the offending object —
> so that a coordinator merging from any checkout either verifies the request's
> head or is refused by name.

## 1. SUMMARY

This change repairs three deterministic defects in the `merge` slice of the
delivery command family: the change branch is read from the invocation
checkout's git facts, the merge-applicable gate set evaluates exactly one gate
and never consults CI, and refusals do not name the breached contract (a missing
credential names neither its reference nor its environment variable, an
unreadable work item collapses into an opaque `merge.transaction-aborted`, and the
composition's own emittable declaration cannot express the gate family at runtime,
so its exhaustiveness rests on a source-text assertion). The change resolves the change
branch from the change record, cross-checks it against the open delivery request
and binds the freshness envelope to that request's head, makes the shipped
default set enforce the repository-declared CI job set on the resolved head
(failing, pending, canceled and skipped checks each refuse by name), and
replaces the opaque and unnamed refusals with three additive rows plus a
declared refusal-cause contract.

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
branch surfaced as an opaque abort rather than a named condition.

**Gate set.** `MERGE_DEFAULT_GATE_ENTRIES` ships five built-in entries on the
`battery` surface (`lifecycle-finalization`, `ci-green`, `push-parity`,
`owner-gate`, `squash-preflight`) plus `tracker-freshness` on the `merge`
surface. The merge projection therefore evaluates exactly one gate, which is the
observed `gates=1/1 passed`: a merge over a request with failing CI reports the
same verdict as a merge over a fully green request.

**Recorded CI verdict.** The transaction honors a persisted `ci-green` verdict
only when `ci-green` belongs to the merge-applicable entries. Because the
shipped default excludes it from that surface, a persisted failing CI verdict
can never reach the merge refusal — the defect behind "required checks never
consulted" is a surface-membership defect, not a missing capability.

**Required-check machinery already delivered.** The transaction evaluates every
merge-applicable `required-ci-job` entry through one evaluator with `recorded`
and `probe` attribution, a job the set does not declare is never evidence, and a
check-run page whose SHA is not the head is never head evidence. `queued`,
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
declared row claims `retryable: true` even for causes that do not converge on a
re-run. The `merge.gate.<gate-id>.failed` family is emitted by the transaction and
**is** resolved at classification: the classifier recognizes an emitted code whose
kind is `merge` and whose slot has the declared gate-id shape and returns the
declared family row (kind `merge`, exit 1), so a gate refusal already renders as
its own row. What is weaker is the composition's side of the contract: its
runtime emittable declaration enumerates exact codes only and expresses the family
as a type, so nothing in that runtime vocabulary states that a family emission is
admissible, and the totality proof closes the gap by asserting the presence of
that type name and the family prefix/suffix constants in the composition's source
text rather than by ranging over a runtime declaration.

**Change record reads.** The closeout composition already reads the change's
pm-notes through the delivered pm-notes text read to obtain its declared
milestone; that is the delivered precedent for a composition reading the change
record. The pm-notes lint has no closed key set: every extra top-level key is
opaque, preserved and never inspected, so an added `branch` declaration is
additively admissible and survives every document-writing branch value-faithfully.

**Contract that this change amends.** `feature-merge-verify-deploy` currently
states that the composition resolves the branch from the checkout's git facts,
that the verification record's head is the checkout head, that the default gate
set is six entries of which one is merge-applicable, and that the declared
emittable set is exhaustive so `fallback.internal` is reachable only for a
genuinely undeclared failure. The coverage map
`test-spec-merge-verify-deploy` states the same branch resolution in its
"Composition reachability" row. Both must be reconciled in the same change.

### 2.2 Pain Points / Gaps

- **P-1 — The verified object is not the merged object.** A `merge` invoked from
  the base checkout verifies the base tip and can report `result=verified` for a
  head that has nothing to do with the change.
- **P-2 — The gate set is vacuous on CI.** The merge-applicable set contains one
  tracker gate, so failing, pending, canceled and skipped checks cannot refuse a
  merge and cannot be named.
- **P-3 — A persisted CI verdict is unreachable.** Even a verified, fresh record
  carrying a failing `ci-green` verdict cannot refuse the merge.
- **P-4 — Refusals are opaque.** A credential condition narrates no reference and
  no environment variable; an unreadable work item reports
  `merge.transaction-aborted` whose hint names nothing; and the composition's own
  declaration cannot express the gate family at runtime, so no part of the
  composition's vocabulary says a family emission is admissible and the totality
  proof stands on a source-text match rather than on a runtime declaration.
- **P-5 — A row's retryability claim is false for causes it reaches.** A declared
  row advertises `retryable: true` and a remediation that promises convergence,
  while causes routed to that same row need an operator act before a re-run can
  converge — so the claim is false for part of the row's own cause set.
- **P-6 — A dry run can describe a different object** from the one the real merge
  would land, because both take their head from the invocation checkout.

## 3. PROBLEM STATEMENT

Because `merge` resolves the change branch and the verified head from the ambient
checkout and its default merge-applicable gate set evaluates only a tracker gate,
an operator merging a change from the integration base cannot obtain a verdict
about the change's delivery request — the run verifies the base tip and reports a
vacuous all-pass gate set, while the refusals it does emit name neither the
credential, the work item, nor the gate that breached the contract. As a result,
a failing or pending required check never stops a landing, and a genuine
refusal is indistinguishable from an internal defect, so the coordinator cannot
tell which condition blocked a delivery or which contract to repair.

## 4. GOALS

- **G-1**: `merge` resolves the change branch from the change record and binds
  the verified head to the open delivery request's head; the ambient checkout's
  branch never participates in that resolution.
- **G-2**: The shipped default merge-applicable gate set enforces the required
  checks reported on the resolved head, so a failing, pending, canceled or
  skipped required check refuses by name and a fully green request does not
  produce the same verdict.
- **G-3**: Every refusal names the command, the breached contract, and the
  offending object; a credential refusal names the credential reference and the
  environment variable; a read fault names the operation that failed.
- **G-4**: No credential condition is reported as `merge.transaction-aborted`, no
  declared row claims `retryable: true` while a cause it reaches needs an operator
  act before a re-run can converge, and no remediation hint instructs an operator
  to clear a condition that is not named.
- **G-5**: Every code the merge transaction can emit resolves to a declared row
  or the declared family, and the composition declares that family at runtime
  rather than only in a type, so its exhaustiveness is proven over the runtime
  declaration instead of over source text.
- **G-6**: A dry run resolves and describes exactly the object the real merge
  would land.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Merge-applicable gates under the shipped default set | 2 (CI gate + tracker gate), up from 1 |
| Named-checks refusals | 100 % of failing, pending, canceled and skipped required checks refuse at exit 1 with the check name in evidence |
| Base-checkout invocations reporting the base tip as the verified head | 0 |
| Refusals missing a named cause (command, code, offending object) | 0 across the enumerated refusal matrix (≥ 18 cases) |
| Credential refusals naming reference **and** environment variable | 100 % |
| Emitted codes resolving to a declared row or the declared family | 100 %; the containment identity reachable only by an undeclared failure, proven by a live mismatch control |
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

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Change-branch resolution from the change record, cross-checked against the open delivery request | Removes the ambient checkout from the merge path (P-1, P-6) and gives the invocation a single declared source with a fail-closed refusal when it is absent. |
| F-2 | Required-check enforcement on the resolved head under the shipped default gate set | Makes the merge-applicable set non-vacuous and turns the delivered per-job mapping into a real merge gate (P-2, P-3). |
| F-3 | Refusal diagnostics contract | Makes every refusal actionable and non-misleading, and keeps `retryable` a row property that is nonetheless true of every cause the row reaches (P-4, P-5). |
| F-4 | Emitted-identity totality for the gate family | Gives the composition a runtime family declaration so its exhaustiveness is proven over that declaration rather than over source text, while the classifier's delivered family resolution is preserved unchanged (P-4). |
| F-5 | Dry-run / real-merge object agreement | Makes the pre-flight verdict a true statement about the object the merge would land (P-6). |

### 5.1 Capability Details

#### F-1 — Change-branch resolution

`merge` derives the change branch from the change record and requires it to name
an open delivery request. The single declared source is a `branch` declaration on
the change's pm-notes document — the same committed change record the closeout
composition already reads, and a key the pm-notes lint preserves as opaque.

Resolution order and outcomes:

1. The change record declares a usable branch → that value is the resolved
   change branch; the declaration is the authority and is reported as the
   resolution source.
2. The change record declares no branch, or declares an empty or unusable value
   (whitespace, control characters, or a value longer than the declared cap) →
   the run refuses `merge.branch-unresolved` naming the change record path, the
   missing key, and the command. There is no ambient fallback: the checkout's
   branch is never a candidate.
3. The open delivery-request read returns exactly one entry whose
   provider-asserted source ref equals the resolved branch → that entry is the
   delivery request. Equality is exact on the provider-asserted value; no prefix,
   suffix, or change-ref-substring matching exists.
4. No open entry matches, more than one open entry matches, or the matched entry
   asserts no head commit → the run refuses `merge.request-unresolved` with the
   closed reason `no-open-request`, `ambiguous-open-request`, or
   `head-unresolved`, naming the resolved branch, its resolution source, and the
   observed open-request count.
5. The matched request's asserted head commit is the **resolved head**. The
   freshness envelope compares the verification record's head against the
   resolved head, and the landing's expected head is the resolved head. A record
   whose head is the integration base therefore refuses `merge.gates-stale` with
   both SHAs recorded, at exit 1, with zero landing calls.
6. The already-merged convergence case is matched by the invocation's change ref
   against merged delivery requests. The branch-name parsing that previously
   recovered a change ref is deleted with its failure mode.

The resolution result — resolved branch, its source, the matched request
identity, and the resolved head — is part of the run's reported data for both the
dry run and the merged report, so an operator can see which object a verdict
describes. The composition never reads the checkout's branch on this path, and a
production-source scan with a mandatory failing control proves the absence.

The declaration is not configuration: it lives on the change artifact, adds no
key to the configuration document, and carries no schema version. Its absence is
not a default but a refusal: step 2 refuses `merge.branch-unresolved` naming the
change-record path and the missing key, unconditionally and for every change
alike, so an existing or in-flight change must add the one-line declaration
before it can merge. Nothing stored is re-read to satisfy it — the merge path
reads no historical record — so no backfill is required and no stored state
migrates.

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

- the command name (`merge`) and the `<ref>` it was invoked with;
- the refusal code, and the gate id when the code is a family instance;
- the breached contract in operator terms (the change record and key that
  declares no branch; the delivery request that could not be resolved and why;
  the work item that does not resolve; the gate and job that are not green; the
  operation that failed to read; the credential reference and environment
  variable that are unresolvable);
- bounded, secret-free evidence members, never raw payloads, titles, bodies, or
  log lines;
- an actionable remediation, or none at all — never an instruction to clear a
  condition the refusal does not name.

Credential refusals name the credential reference and the environment variable
exactly as the tracker family already does, and a credential condition is never
reported as `merge.transaction-aborted`. A tracker object that does not resolve
is reported by its own identity naming the object and the read operation, never
as the generic abort. `retryable` is always the emitted code's declared row value
and never a per-instance value, and a declared row may not carry `retryable: true`
while any cause reachable for that row requires an operator act before a re-run
can converge. Convergence that needs no act — a pending check — is carried by the
refusal's named reason and an accurate remediation, not by a different
`retryable`; a row that reaches an act-requiring cause declares `retryable: false`
with a remediation true of every cause it still reaches.

#### F-4 — Emitted-identity totality

The classifier's family resolution is delivered and stays exactly as it is: an
emitted code whose kind is `merge` and whose slot is a valid gate id resolves to
the declared family row. The gap is on the composition's side, and this change
closes it by giving the composition a **runtime** family declaration beside its
exact-member list — the declared family expression together with its slot rule —
so the composition's vocabulary states that a family emission is admissible and
`MERGE_COMPOSITION_EMITTABLE_CODES` plus that declaration are runtime-exhaustive
over every code the refusal branches emit. The totality proof then ranges over
the runtime declaration, so it fails when a family emission loses its declaration
rather than when a type name disappears from a file's text.

Closing the gap adds no second vocabulary and no second resolver: the family
expression is the contract's own declared prefix, suffix, and template, the slot
stays validated against the effective declared gate set at emission, and the
gate-id pattern is not widened. Adding `ci-green` to the merge surface adds one
more family instance the declaration must cover — `merge.gate.ci-green.failed` —
which becomes the live proof case for the runtime declaration. A mismatch control
still drives an undeclared code to the containment identity, so the assertion
cannot pass vacuously.

#### F-5 — Dry-run / real-merge object agreement

The dry run and the real merge resolve the change branch, the delivery request,
and the resolved head through the same resolution, so `merge <ref> --dry-run`
describes exactly the object `merge <ref>` would land. The dry run keeps its
delivered non-mutation contract: it appends one verification record whose head is
the resolved head, appends no waiver, transaction, or git mutation, and never
reports `result=merged` or `squash=`. Its reported data names the resolved
branch, the resolution source, the request identity, and the resolved head, so a
verdict recorded from an integration-base checkout is visibly about the request's
head rather than about the checkout.

## 6. USER & SYSTEM FLOWS

```
Flow 1 — Coordinator merges from the integration base checkout.
  Coordinator (on the base branch) runs `merge GH-366`.
    -> composition reads the change record; branch = declared change branch
    -> open-request read: exactly one entry whose source ref equals that branch
    -> resolved head = that entry's asserted head
    -> freshness envelope: record head must equal the resolved head
       -> no fresh record for that head: merge.state-unverified (exit 2)
       -> record for the base tip: merge.gates-stale with both SHAs (exit 1)
       -> fresh record for the resolved head: continue
    -> probe: work item, check-run page on the resolved head, request detail
    -> required-check set evaluated per job
       -> any not green: merge.gate.<id>.failed naming the gate and job(s) (exit 1)
       -> all green + tracker gate fresh: one guarded landing at the resolved head
    -> result=merged with the provider-asserted merge commit
```

```
Flow 2 — The change record declares no branch.
  Coordinator runs `merge GH-366`.
    -> change-record read succeeds; no `branch` declaration
    -> merge.branch-unresolved (exit 1) naming the record path and the key
    -> zero provider reads, zero verification reads, zero landing calls
    -> remediation: declare the branch on the change record
```

```
Flow 3 — A required check is pending at merge time.
  Coordinator runs `merge GH-366 --dry-run`, then `merge GH-366`.
    -> dry run: CI gate fail, reason ci-pending, pending job named; exit 1
    -> live merge after the check finishes red: probe attribution, job named; exit 1
    -> live merge after the check finishes green: gates pass, landing fires once
```

```
Flow 4 — A credential is absent.
  Coordinator runs `merge GH-366` with no token in the environment.
    -> the provider read reports the credential condition
    -> config.credential.missing at exit 1, naming the reference and the
       environment variable and the operation that needed it
    -> never merge.transaction-aborted; zero landing calls
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- Change-branch resolution from the change record, its refusal identity, and the
  removal of checkout-branch and branch-name-parsing resolution from the merge
  path.
- Binding the verified head, the freshness envelope comparison, the landing's
  expected head, and the reported head to the resolved delivery-request head.
- Making `ci-green` merge-applicable in the shipped default set, deriving the
  merge-applicable required-check set, and evaluating it per job through the
  single delivered mapping with `recorded`/`probe` attribution.
- The admitted-surface rule for declared built-in entries, and the disclosure of
  the evaluated required-check posture.
- The refusal-diagnostics contract, the retryability rule, and the three additive
  `merge` rows (`merge.branch-unresolved`, `merge.request-unresolved`,
  `merge.work-item-unresolved`) with their closed reason vocabularies.
- Emitted-identity totality for the gate family: a runtime family declaration
  beside the exact-member list, with the totality proof ranging over that
  declaration and the classifier's delivered family resolution untouched.
- Dry-run / real-merge object agreement.
- Reconciliation of the merge feature spec, the merge test specification, and the
  merge reference page with the amended contract, and the release note.

### 7.2 Out of Scope

- [OUT] The ticket body's family-wide command battery over `dispatch`, `loop`,
  `merge`, `closeout`, `queue`, `phase`, `verify`, `blockers`, `board`, `brief`,
  `metrics`, `spend`, and `provider` on the installed binary. This change claims
  only the `merge` slice plus the diagnostics contract it proves; the remainder is
  explicitly **not** claimed green, and no follow-up ticket is created.
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
  declaration never has to be authored by hand.
- Branch resolution from the change record on the battery side, so a verification
  record can be produced from any checkout with the same fidelity as the merge.
- A provider capability for required status contexts, if one becomes exercisable
  through the delivered adapter surface.
- A multi-workflow expected-job union if repositories declare CI in more than one
  workflow file (OQ-2).

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

No HTTP surface is added. The changed contract surfaces are command-level:

| ID | Surface | Contract change |
|----|---------|-----------------|
| API-1 | `merge <ref>` | Resolves the change branch from the change record, binds the verified head to the open request's head, evaluates the merge-applicable required-check set on that head, and refuses by name on every non-green, unreadable, or unresolvable condition. Added machine data: resolved branch, resolution source, matched request identity, resolved head, evaluated required-check count. |
| API-2 | `merge <ref> --dry-run` | Same resolution as `API-1`; reports the same resolved object; appends exactly one verification record for the resolved head; still performs zero mutations and never reports `result=merged` or `squash=`. |
| API-3 | Refusal envelope | `error.code` is the stored identity or the family instance; `error.summary` names the command, the breached contract, and the offending object; evidence members are bounded and secret-free; `retryable` is always the emitted code's declared row value, and no row declares `true` while a cause it reaches needs an operator act before a re-run can converge. |

### 8.2 Events / Messages

| ID | Event | Contract change |
|----|-------|-----------------|
| EVT-1 | `merge.gate-verification` record (`delivery.merge.gate-verification.v1`) | Schema and record kind unchanged. Content changes: a `merge --dry-run` record now carries a CI gate entry alongside the tracker entry, and that entry's citation declares the sources it actually read (the declared CI-workflow source and the check-run page), so a reader can distinguish a merge-surface CI evaluation from a battery one. Records produced by `verify gates` are unchanged. |
| EVT-2 | Capsule and delivery-registry events | Unchanged: no new event kind, key, or schema. Resolution facts are reported in command data, not persisted as a new event. |

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Change-record `branch` declaration | One additive top-level key on the change's pm-notes document. Preserved value-faithfully by every document-writing branch, opaque to lint, and never inspected by any other surface. It carries the change branch as a fact, with no fallback derivation. |
| DM-2 | Resolved change context | Non-persisted derived facts reported in command data: resolved branch, resolution source (declared), matched delivery-request identity, resolved head, evaluated required-check count and set size. Bounded; never a stored record. |
| DM-3 | Merge-applicable gate membership and admitted surfaces | Contract data: the shipped default set's merge-applicable membership becomes two entries; each reserved built-in gains a declared admitted surface set; a built-in's declared class may be omitted to adopt the shipped class. No identity, schema-version, recipe, or configuration-key change. |

### 8.4 External Integrations

- GitHub commit check-runs read: unchanged operation, now consumed for the CI
  gate's per-check state on the resolved head.
- GitHub delivery-request list/detail reads: unchanged operations; the list read
  is the request resolution source, and the matched entry's asserted head is the
  resolved head.
- No new endpoint, capability, scope, or credential reference is introduced.
- Credential handling is unchanged; the refusal merely names the reference and the
  environment variable.

### 8.5 Backward Compatibility

- The effective gate-set identity (schema version plus entry-id sequence) is
  unchanged, so existing verification records stay consumable and no change is
  forced to re-verify.
- Existing authored `merge.gates` declarations remain valid: a built-in declared
  on the `battery` surface stays accepted (and is the documented check-gate
  opt-out), and an omitted built-in class adopts the shipped class.
- Existing refusals keep their codes and exits; three additive rows appear at
  exit 1. `merge.transaction-aborted` keeps its code, category, consequence, and
  projection, and is narrowed in use: it no longer carries credential conditions,
  unresolvable requests or work items, and its declared `retryable` value and
  remediation become true of every cause it still reaches — a row that still
  reaches an act-requiring cause declares `retryable: false` and no convergence
  hint. No row advertises convergence it cannot deliver.
- `--waive`, waiver authorization, owner-gate classification, the landing
  mechanism, the mutation vocabulary, and the persisted record schemas are
  unchanged.
- A change that declares no branch on its change record now refuses
  `merge.branch-unresolved` — the one behaviour a repository must adopt, with the
  refusal naming exactly what to add.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Determinism | 20 consecutive runs over identical fixtures are byte-identical for one success and five refusals (branch unresolved, request unresolved, gate failure, pending check, credential missing); a changed-fact control differs. |
| NFR-2 | Read budget | Per invocation: one change-record read, one open-request list read, one request-detail read, one work-item read, one CI-workflow read, one check-run page on the resolved head, one verification-record read; at most one post-refusal re-read and one unknown-recovery re-read; ≤ 1 landing call; zero retries; zero pagination. |
| NFR-3 | Output bounds | Machine `data` ≤ 65 536 UTF-8 bytes; human summary ≤ 24 lines and ≤ 4 096 UTF-8 bytes; every dropped item marked `+N`; no new unbounded field. |
| NFR-4 | Offline determinism | Zero network calls and zero child processes in every new suite; the existing no-live-call guards stay green. |
| NFR-5 | Refusal completeness | 100 % of refusals across the enumerated matrix (≥ 18 cases) carry the command, the code, at least one named cause, and an actionable or absent remediation; 0 refusals carry an instruction to clear an unnamed condition. |
| NFR-6 | No ambient branch read | 0 reads of the checkout's branch on the merge path, proven by a production-source scan with a mandatory failing control. |
| NFR-7 | Identity totality | 100 % of emitted codes resolve to a declared row or the declared family, with the family slot validated against the effective gate set; no pattern widening; a live mismatch control still reaches the containment identity. |
| NFR-8 | Identity stability | The effective gate-set id sequence equals the pre-change sequence; documented and machine error identities move together (167 → 170), and the reference page, feature spec, and test specification state the same counts in the same change. |
| NFR-9 | Secret hygiene | 0 occurrences of any credential value, title, body, comment, raw payload, or log line in output or records, verified with canary secrets. |
| NFR-10 | Latency | The added reads add ≤ 2 provider-independent reads (change record, CI workflow) and ≤ 1 provider list read already budgeted; the invocation's total read count stays within the NFR-2 budget with no added polling or waiting. |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- The merged report and the dry-run report expose the resolved object (branch,
  resolution source, request identity, resolved head) and `gates=<passed>/<total>`
  with the merge-applicable total, so a coordinator can see whether a verdict is
  about the request or the checkout.
- Every refusal's code is the observable signal; the additive rows make the
  previously indistinguishable causes separable in aggregation. The family
  instance keeps the gate id in the code, so gate refusals are countable per
  gate without parsing prose.
- The verification record's citation names the sources it read, so a CI verdict
  in a record is attributable to its evaluation surface.
- No new metric stream, log sink, record kind, or trace span is introduced; the
  capsule and registry event vocabulary is unchanged.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | In-flight changes whose change record declares no branch refuse `merge.branch-unresolved` | M | H | The refusal names the exact record path and key; the remediation names the declaration; the change documents the requirement and adds its own declaration in the same delivery | Other open changes must add one line before they can merge |
| RSK-2 | Enforcing the repository-declared expected job set blocks merges in repositories with permanently conditional or skipped jobs | M | M | The checked remedy is the authored `surface: battery` opt-out; the dry run discloses the evaluated required-check count; the refusal names the skipped job | A repository that opts out loses merge-surface CI enforcement |
| RSK-3 | The expected-job set is read from the checkout's workflow while the verified object is the request head, so a job that exists only on the head is not required evidence | M | M | The page-versus-expected comparison surfaces the gap as a named missing-job condition; the docs state that a change-branch checkout gives exact fidelity | A head-only job is not enforced until the checkout contains it |
| RSK-4 | Blocking on pending checks increases merge latency and may push operators toward unrelated overrides | L | M | Pending refusals name the pending job and state that the condition converges without an act; no override exists for the check gate | Repeated waiting remains an operator cost |
| RSK-5 | New rows, changed remediation text, and a changed default set drift between the machine table, the documented table, the reference page, and the test specification | M | M | One change moves all four with the pinned-count requirement in NFR-8 and the existing sync checks | None once gated; a partial delivery fails the gate |
| RSK-6 | A runtime family declaration could be written as pattern widening, accepting gate ids the effective set does not declare — or could drift from the classifier's delivered family resolution and become a second vocabulary | H | L | NFR-7 pins slot validation against the effective gate set and forbids widening; the declaration reuses the contract's prefix/suffix/template and adds no resolver; a mismatch control proves the containment identity still works | None accepted |
| RSK-7 | The admitted-surface rule for built-ins is read as licence to weaken other built-ins | M | L | Only `ci-green` gains `both`; the other four keep `battery` alone; the opt-out is visible in configuration and reviewed | A repository may still opt out of CI enforcement by declaration |
| RSK-8 | A dry run executed from the integration base produces a record about the request head, which an operator may mistake for a checkout verification | L | M | The data names the resolution source and the resolved head; the docs state that the record describes the request, not the checkout | Operator confusion on a first run |

## 12. ASSUMPTIONS

- The change ref identifies both the tracker work item and the change folder, so
  the change record is resolvable from the invocation.
- In a healthy flow exactly one open delivery request has the change branch as its
  provider-asserted source ref; a second one is an anomaly this change refuses
  rather than ranks.
- The provider reports check runs for the resolved head commit; an empty or absent
  page is a named condition, not a pass.
- The repository declares its CI jobs in the workflow file the delivered
  expected-job read targets; a repository with no such workflow fails the CI gate
  explicitly (`ci-expected-jobs-invalid`) and has the surface opt-out as its
  declared remedy.
- The change record is the committed pm-notes document the delivered read targets,
  and it is readable from the change folder.
- The `branch` declaration is authored when the change is opened; this change does
  not add a writer (OQ-1).
- The tracker family's delivered precedent for naming a credential reference and
  an environment variable is the shape this change reuses; no new secret-bearing
  field is introduced.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | Delivered change-record (pm-notes) text read | The composition reuses it, as the closeout composition already does |
| Depends on | Delivered CI-workflow expected-job read | Source of the repository-declared job set; already consumed by the battery's CI gate |
| Depends on | Delivered check-run page read | The only per-check state source |
| Depends on | Delivered delivery-request list/detail read with request head and gate facts | Request resolution and resolved head |
| Depends on | Delivered `evaluateRequiredJobGate` mapping and `recorded`/`probe` attribution | One mapping, no second evaluator |
| Depends on | Delivered error table (machine and documented) | Additive rows move together |
| Blocks | Any change that expects `merge` to be runnable from the integration base | Those changes must declare a branch on their change record |
| Blocks | The remainder of the ticket body's family-wide battery | Explicitly not claimed (see §7.2) |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | Should a delivery command write the change-record `branch` declaration so no change relies on a hand-authored line? | This change requires the declaration to exist and refuses when it is absent, but adds no writer. A writer belongs to the change-lifecycle commands, not to `merge`, and would need its own scope decision. | Deferred; decision needed: consult `@decision-advisor` (TDR-0071 scope) |
| OQ-2 | If a repository declares CI across several workflow files, is the expected job set the union of all of them? | The delivered expected-job read targets one declared path. Widening it is a capability change with its own fidelity questions and is not required by this slice. | Deferred; decision needed: consult `@decision-advisor` (TDR-0072 scope) |
| OQ-3 | Should `verify gates` also resolve the change branch from the change record so a fresh record can be produced from any checkout with merge-equivalent fidelity? | This change binds the merge path only. Making the battery record for a requested head from a base checkout is the natural follow-on, but it changes battery semantics and goldens. | Deferred; decision needed: consult `@decision-advisor` |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | The change branch has exactly one source: a `branch` declaration on the change's pm-notes. No derived fallback and no ambient read; absence refuses `merge.branch-unresolved`. | pm-notes already has a delivered read precedent, no closed key set, and value-faithful preservation; a folder-plus-spec-type derivation would add a markdown front-matter parse and assume a branch-prefix convention, and any fallback risks reintroducing the ambient checkout. One authority with a fail-closed refusal is auditable. Record: TDR-0071. | 2026-11-20 |
| DEC-2 | The resolved delivery request's asserted head is the resolved head: the freshness envelope compares against it, the landing's expected head is it, and the reported head is it. | The merged object is the request, not the checkout; comparing the record against the request head makes a base-tip evidence set refuse `merge.gates-stale` with both SHAs instead of "verifying" the base. Record: TDR-0071. | 2026-11-20 |
| DEC-3 | The shipped default set makes the reserved built-in `ci-green` merge-applicable, and the merge-applicable required-check set is the declared `required-ci-job` entries plus the `ci-green` entry's repository-declared expected job set. | Fixes the exact defect (a persisted failing CI verdict was honored only when `ci-green` was merge-applicable) with the reserved id, one mapping, and no new id, recipe, or configuration key; the entry-id sequence — and therefore the gate-set identity — does not change. Record: TDR-0072. | 2026-11-20 |
| DEC-4 | The check gate is enforced fail-closed and gains no waivability; the declared remedy is the authored `ci-green` surface opt-out, and the admitted surface sets of the reserved built-ins become contract data. | An in-band waiver class on CI would let a failing pipeline land silently-by-policy; a reviewed configuration act is the recorded override. Requiring declaration of surface-not-equal-to-default would invalidate every existing authored set. Record: TDR-0072. | 2026-11-20 |
| DEC-5 | Diagnostics become a contract: every refusal names the command, the breached contract, and the offending object; credential refusals name the reference and the environment variable; a read fault names the operation; remediation is actionable or absent; `retryable` is the declared row's value, and no row may declare `true` while a cause it reaches needs an operator act before a re-run can converge. | The observed refusals were unactionable; a static row value is the delivered envelope's only retryability field, so the row's cause set must be narrow enough — and honest enough — to make that one value true. Record: TDR-0073. | 2026-11-20 |
| DEC-6 | `merge.transaction-aborted` is narrowed: no credential condition, no unresolvable request, no unresolvable work item. Three additive rows carry those causes. | Each cause has a different operator and a different repair; the generic abort erased that. Additive rows keep existing codes stable. Record: TDR-0073. | 2026-11-20 |
| DEC-7 | Emitted-identity totality is closed in this change by giving the composition a runtime declaration of the gate family, beside its exact-member list, with the slot validated against the effective gate set and the totality proof ranging over that declaration. | The classifier already resolves an emitted family instance to the declared family row; what is missing is the composition's own runtime statement that a family emission is admissible, which today exists only as a type and is asserted only by source text — so the mechanism behind AC 3's guarantee must be made declarative here rather than deferred. | 2026-11-20 |
| DEC-8 | The dry run and the real merge share one resolution, so a dry run describes the object the merge would land. | A pre-flight verdict about a different object is worse than no verdict. | 2026-11-20 |
| DEC-9 | No new configuration key, schema version, record kind, recipe, or gate id is introduced; the one new declaration lives on the change artifact. | The existing surfaces carry the facts; a configuration key would make the change branch a per-repository setting, which it is not. | 2026-11-20 |
| DEC-10 | The ticket body's family-wide battery is not claimed; the `merge` slice and the diagnostics contract are claimed, with the remainder recorded as out of scope and no follow-up ticket created. | Owner scope, recorded in the change's pm-notes; PM never creates tickets autonomously. | 2026-11-20 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Merge production composition | Updated — change-record branch resolution, request resolution, resolved head, credential and read-fault naming, removal of checkout-branch and branch-name parsing, and a runtime family declaration for the gate family |
| Merge emittable-code declaration and totality proof | Updated — the family is declared at runtime beside the exact-member list, and the totality proof ranges over that declaration instead of a source-text match; the delivered classifier family resolution is unchanged |
| Merge contracts (default gate set, admitted surfaces) | Updated — `ci-green` merge-applicable by default; declared admitted surface sets |
| Merge transaction (freshness, probe, refusal evidence) | Updated — required-check set derivation, merge-surface CI evaluation reuse, evidence members |
| Merge probe / required-check mapping | Reused unchanged as the single evaluator; the required-check set it is fed is extended |
| Change-record read (pm-notes) | Reused — one additional key read, no parser change |
| CI-workflow expected-job read | Reused — one additional consumer |
| Error table (machine and documented) | Updated — three additive `merge` rows, remediation and summary adjustments, totals 167 → 170 |
| Merge reference page | Updated — branch and head resolution, gate set, exit-status causes, refusal examples |
| Merge feature spec | Updated — Overview resolution paragraph, gate registry defaults, verification-record head meaning, error identities, invariants |
| Merge test specification | Updated — "Composition reachability", "Required-check awareness", "Classification fidelity", "Emittable-code totality", "Error-identity stability" rows |
| Change-lifecycle guidance for change records | Updated — the `branch` declaration requirement |
| Release note (changeset) | New — the fixed-group packages at `minor` |

## 17. ACCEPTANCE CRITERIA

### 17.1 Change-branch resolution (owner AC 1)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** an open delivery request for a change branch and an invocation from the integration-base checkout, **when** `merge <ref>` runs, **then** the run reports the request's head as the resolved head, verifies or refuses against that head, and can never report the base tip as the verified head. *(owner AC 1; regression (a))* | F-1, API-1, DM-1 |
| AC-F1-2 | **Given** the same request and an invocation from the change-branch checkout at the request head, **when** `merge <ref>` runs, **then** the verified head equals the request head and the result is `merged` only after the one guarded landing at that head. *(owner AC 1)* | F-1, API-1 |
| AC-F1-3 | **Given** a change record that declares no usable branch, **when** `merge <ref>` runs, **then** it refuses `merge.branch-unresolved` at exit 1 naming the change-record path, the missing key, and the command, with zero provider reads and zero landing calls. | F-1, DM-1, NFR-5 |
| AC-F1-4 | **Given** a resolved branch with zero or with more than one matching open request, or a matching request with no asserted head, **when** `merge <ref>` runs, **then** it refuses `merge.request-unresolved` at exit 1 with the matching closed reason and the resolved branch named. | F-1, API-3, DM-2 |
| AC-F1-5 | **Given** a fresh verification record whose head is the integration base and a resolved request head that differs, **when** `merge <ref>` runs, **then** it refuses `merge.gates-stale` at exit 1 recording both SHAs and performs zero landing calls. | F-1, F-2, API-1 |

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

### 17.3 Refusal diagnostics (owner AC 3)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F3-1 | **Given** any refusal across the enumerated refusal matrix, **when** it is rendered, **then** it names the command, the code, and at least one named cause, and its remediation is actionable or absent — never an instruction to clear an unnamed condition. *(owner AC 3)* | F-3, API-3, NFR-5 |
| AC-F3-2 | **Given** an absent token in the environment, **when** `merge <ref>` runs, **then** it refuses `config.credential.missing` at exit 1 naming the credential reference, the environment variable, and the operation that required it. *(owner AC 3; regression (c))* | F-3, API-3, NFR-9 |
| AC-F3-3 | **Given** any credential condition on the merge path, **when** it is rendered, **then** the reported code is the declared credential or auth identity and never `merge.transaction-aborted`. | F-3, API-3 |
| AC-F3-4 | **Given** a tracker work item that does not resolve, **when** `merge <ref>` runs, **then** it refuses `merge.work-item-unresolved` at exit 1 naming the work-item ref and the read operation, and the remediation names that cause. | F-3, API-3, NFR-5 |
| AC-F3-5 | **Given** any refusal the merge command emits, **when** it is rendered, **then** `retryable` equals the declared row value of the emitted code and is never a per-instance value, and its remediation is accurate for the named cause — a condition that clears without an operator act (a pending check) is expressed by the refusal's named reason and a remediation that says so, and no remediation instructs an operator to clear a condition the refusal does not name. | F-3, API-3 |
| AC-F3-6 | **Given** the declared rows on the merge refusal surface, **when** each row's reachable cause set is inspected, **then** no row declares `retryable: true` while a cause it reaches requires an operator act before a re-run can converge, and `merge.transaction-aborted`'s narrowed cause set carries a `retryable` value and a remediation that are true of every cause it still reaches — or the cause set narrows until they are. *(owner AC 3)* | F-3, API-3, NFR-5 |

### 17.4 Emitted-identity totality

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F4-1 | **Given** a gate refusal emitted on the family, **when** the failure is classified, **then** the code resolves to the declared family row with the gate id preserved, and the containment identity is reached only by an undeclared code (proven by a live mismatch control). | F-4, NFR-7 |

### 17.5 Dry-run / real-merge agreement

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F5-1 | **Given** one fixture and one invocation context, **when** `merge <ref> --dry-run` and `merge <ref>` run, **then** both report the same resolved branch, request identity, and resolved head. | F-5, API-1, API-2 |
| AC-F5-2 | **Given** an invocation from the integration-base checkout, **when** `merge <ref> --dry-run` runs, **then** the appended verification record's head is the resolved request head, no waiver, transaction, or git mutation is written, and `result=merged` and `squash=` are never reported. | F-5, API-2, EVT-1 |
| AC-F5-3 | **Given** the new regression suites, **when** they run, **then** they perform zero network calls and spawn zero child processes, and the existing no-live-call guards stay green. *(owner AC 4)* | F-1, F-2, F-3, NFR-4 |

### 17.6 Owner acceptance trace

| Owner item | Carried by |
|---|---|
| AC 1 — branch resolved from the change record + open PR; from the base checkout it verifies the PR head or refuses; never `head=<base tip>` | AC-F1-1, AC-F1-2, AC-F1-5, AC-F5-2 |
| AC 2 — required checks read on the resolved head; failing and pending each fail closed and are named | AC-F2-1, AC-F2-2, AC-F2-3, AC-F2-4, AC-F2-5 |
| AC 3 — every refusal names the command and the breached contract, including the credential reference and environment name | AC-F3-1, AC-F3-2, AC-F3-3, AC-F3-4, AC-F4-1 |
| AC 4 — regressions: (a) base-checkout invocation does not verify the base tip; (b) one failing required check refuses with that check named; (c) absent `GITHUB_TOKEN` names the variable | AC-F1-1, AC-F2-1, AC-F3-2, AC-F5-3 |
| Pending-check refusal and the retained explicit waiver path | AC-F2-2, AC-F2-3, AC-F2-7 |
| Unreadable work item names its cause; no unnamed remediation; `retryable` follows the declared row and no row overstates convergence | AC-F3-1, AC-F3-4, AC-F3-5, AC-F3-6 |
| Dry run describes the same object the real merge would land | AC-F5-1, AC-F5-2 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- One change delivers the behaviour, the three additive rows, the amended
  documented table, the reference page, the feature spec, and the test
  specification together: documented and machine-declared identities move in the
  same change, and the pinned totals move with them.
- Delivery order: refusal identities and the diagnostics contract first (they are
  the vocabulary the other capabilities report in), then the branch/head
  resolution, then the required-check enforcement, then the dry-run agreement;
  every phase leaves the delivered behaviour consistent with its declarations.
- No feature flag and no staged default: the shipped default gate set is the
  contract, and a repository that must keep a `battery`-surface CI gate declares
  it.
- The release note declares the fixed-group packages at `minor`, as the
  workspace's changeset additivity rule requires for any added changeset; the
  specification may not claim `patch` or `none`.
- Communication: the change's PR body states the scope held (the `merge` slice
  plus the diagnostics contract) and the scope explicitly not claimed (the
  family-wide battery), so the owner can rule on the remainder at review.
- Merge authority stays with the CEO or the human; the PR remains open for review.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

- No stored state is migrated: no record schema, record kind, registry key, or
  configuration key changes, and the effective gate-set id sequence is unchanged,
  so existing verification and transaction records remain readable and valid.
- Seeding is limited to the change artifact: this change's own change record gains
  its `branch` declaration, and the change-lifecycle guidance documents that a
  change declares its branch. In-flight changes need the same one-line
  declaration before they can merge; the refusal names the key.
- No backfill of historical change records is required, because no historical
  record is read by the merge path.

## 20. PRIVACY / COMPLIANCE REVIEW

No personal data is introduced. The change reads and reports only repository and
tracker facts already read today — branch names, request identities, head SHAs,
job names, label names, work-item references — and adds one change-artifact key
carrying a branch name. Credential handling is unchanged and no secret material
is reported: only the reference name and the environment-variable name, which are
non-secret identifiers. Evidence members stay bounded and secret-free.

## 21. SECURITY REVIEW HIGHLIGHTS

- Security posture improves: a failing, pending, canceled or skipped required
  check can no longer be absent from a merge verdict, and a merge can no longer
  verify a head unrelated to the change.
- The change introduces no new provider capability, scope, or credential
  reference; read-only operations are reused.
- The gate-id slot of the refusal family stays validated against the effective
  gate set, so giving the composition a runtime family declaration does not open a
  code-injection or pattern-widening hole.
- Refusal naming must never echo secret material: the reference name and the
  environment-variable name are reported, never the value, and a canary test
  proves it.
- No force, bypass, auto-merge, queue, retry, or head-mutation capability is
  added; the check gate deliberately has no in-band override.
- The change branch is now an authored fact on the change artifact, which is
  reviewed like any other change content, rather than an implicit property of the
  operator's checkout.

## 22. MAINTENANCE & OPERATIONS IMPACT

- Operators gain three new refusal causes to recognise, each with a named repair;
  runbooks and the reference page carry them.
- Coordinators may now run `merge` from the integration base, which removes a
  checkout dance but makes the freshness requirement sharper: no fresh record for
  the request head means `merge.state-unverified`, and a record for another head
  means `merge.gates-stale`.
- Repositories must declare a branch on each change record; this is the single
  new authoring obligation, documented and enforced by a named refusal.
- Repositories with legitimately skipped CI jobs must decide explicitly between
  accepting the enforcement and declaring the CI gate on the `battery` surface.
- The error table, the reference page, the feature spec, and the test
  specification must stay in step; the existing sync and conformance checks gate
  that, and the pinned totals move with any future identity change.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Change record | The committed per-change artifacts, of which the pm-notes document carries the branch declaration read here. |
| Change branch | The repository branch that carries the change's delivery request, declared on the change record. |
| Delivery request | The provider's normalized pull/merge request for the change branch, with its asserted head commit and mergeability. |
| Resolved head | The head commit the matched delivery request asserts; the object the run verifies and the head the landing must match. |
| Repository-declared expected job set | The job names the repository's own CI workflow declares, read through the delivered expected-job read. |
| Merge-applicable required-check set | The union of the declared required-job entries and the CI entry's repository-declared expected job set, evaluated per job against the resolved head's check-run page. |
| Admitted surface set | The surfaces within which a reserved built-in gate entry may be declared. |
| Refusal cause | The named object or operation a refusal reports: the missing declaration, the unresolved request, the unresolved work item, the non-green job, the failed read, or the unresolvable credential. |
| Containment identity | The generic internal failure rendered when an emitted code is not declared; reachable only for a genuinely undeclared failure. |
| Named checks refusal | A refusal on the `merge.gate.<gate-id>.failed` family that names the gate and the offending check. |

## 24. APPENDICES

### A. Resolution procedure (normative order)

1. Read the change record for the invocation's ref.
2. Resolve the change branch from the record's declaration; absent or unusable →
   `merge.branch-unresolved`.
3. Read the bounded open-request list; select entries whose provider-asserted
   source ref equals the resolved branch exactly.
4. Zero matches → `merge.request-unresolved` / `no-open-request`; more than one →
   `ambiguous-open-request`; a match without an asserted head → `head-unresolved`.
5. Take the match's asserted head as the resolved head.
6. Read the verification record; enforce readability, age bound, head equality
   against the resolved head, and gate-set identity.
7. Probe: work item, check-run page on the resolved head, request detail.
8. Derive the merge-applicable required-check set; evaluate it per job with
   `recorded` then `probe` attribution.
9. Authorize declared waivers; apply remaining gate failures by declared
   precedence; resolve mergeability; land at most once at the resolved head.

### B. Refusal matrix (each row must name the cause in §17's sense)

| Refusal | Cause named | Act required before a re-run converges |
|---|---|---|
| `merge.branch-unresolved` | change-record path, missing key | yes — declare the branch |
| `merge.request-unresolved` (`no-open-request`) | resolved branch, source, open count | yes — open the request |
| `merge.request-unresolved` (`ambiguous-open-request`) | resolved branch, match count | yes — resolve the duplicate |
| `merge.request-unresolved` (`head-unresolved`) | resolved branch, request identity | yes — push the branch |
| `merge.work-item-unresolved` | work-item ref, read operation | yes — repair the ref or the tracker |
| `merge.gate.<id>.failed` (failing/canceled/skipped) | gate id, job(s), reason, attribution | yes — repair CI or declare the surface opt-out |
| `merge.gate.<id>.failed` (pending) | gate id, pending job(s), reason | no — the check converges |
| `merge.gate.<id>.failed` (missing job) | gate id, missing job(s) | yes — run or declare the job |
| `merge.gate.<id>.failed` (page not head) | gate id, both SHAs | no |
| `merge.gates-stale` | age/bound, both SHAs, or set delta | yes — re-verify the resolved head |
| `merge.state-unverified` | the unreadable state reason | yes — produce a verification |
| `config.credential.missing` | reference, environment variable, operation | yes — supply the credential |
| `provider.auth.rejected` | reference, operation | yes — supply a usable credential |
| `provider.outage` | the failed operation | no |
| `merge.transaction-aborted` | the named pre-mutation condition only | none for any cause it still reaches — otherwise the row declares `retryable: false` |
| `merge.sync-required` / `merge.mergeability-unknown` / `merge.landing-unverified` / `merge.owner-gate-override-without-waiver` / `merge.waiver-unauthorized` | delivered causes, unchanged | unchanged |

### C. Deterministic decision-record reservations

`TDR-0071` (change-branch resolution from the change record and head binding),
`TDR-0072` (required-check authority, default gate membership, admitted
surfaces), `TDR-0073` (refusal diagnostics contract and emitted-identity
totality). The IDs are reserved by this change; the PM delegates
`@decision-advisor` to author any record the delivery decides is warranted. This
specification does not author them.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-20 | spec-writer | Initial specification for the merge slice of the M4-S3 conformance residual |
| 1.1 | 2026-11-20 | spec-writer | Corrected F-1's migration statement (§5.1) to match the unconditional `merge.branch-unresolved` refusal, and restated the retryability rule at row level (§4.1, F-3, API-3, §8.5, AC-F3-5/AC-F3-6, Appendix B, DEC-5) so it is satisfiable by the delivered error envelope |
| 1.2 | 2026-11-20 | spec-writer | Corrected the current-state and totality claims: the family is resolved at classification (a gate refusal already renders as its declared family row), and the real gap is the composition's type-only declaration and its source-text proof. Restated §2.1, P-4, G-5, F-4, the §5 table rationale, §7.1, §16, RSK-6, §21, and DEC-7 accordingly; no AC text, scope, or identity changed |

---

## AUTHORING GUIDELINES

Authored from the owner-scoped delivery definition (the issue comment of
2026-11-20T10:42:14Z and the three earlier owner comments of 2026-11-19T20:49Z,
2026-11-20T01:22Z and 2026-11-20T01:23Z), the change's pm-notes intake record,
and the current-truth merge contract. The verified current-state facts were taken
from the delivered merge composition, the merge gate contract, the merge
transaction and probe, the error table, the credentials contract, the pm-notes
lint contract, the merge feature spec, and the merge test specification. Design
questions were settled rather than deferred: the branch source and head binding
(one declared source, no ambient fallback), the required-check authority (the
reserved CI built-in plus the repository-declared expected job set, one
evaluator), the diagnostics and retryability contract, emitted-identity totality,
and dry-run object agreement. No implementation steps, file paths, or code-level
instructions are given; the specification states behaviour, contracts, and
identities.

## VALIDATION CHECKLIST

- [x] `change.ref` matches the provided `workItemRef` (`GH-366`)
- [x] `owners` has at least one entry (`engineering`)
- [x] `status` is `Proposed`
- [x] `change.milestone` equals the pm-notes milestone verbatim
      (`M4: Jaiship-native delivery`)
- [x] All sections present in order (1–25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, API-, EVT-, DM-, NFR-, AC-, DEC-,
      RSK-, OQ-)
- [x] Acceptance criteria reference at least one F-/API-/EVT-/DM-/NFR- ID and use
      Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact, Probability, mitigation, and residual risk
- [x] No implementation details (no file-level code paths, no step-by-step tasks)
- [x] Out-of-scope items are prefixed `[OUT]`, including the family-wide battery
      remainder
- [x] The four owner acceptance items are carried and traced explicitly
- [x] Version impact is `minor`, as the changeset additivity rule requires
