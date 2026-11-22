---
ados_distribution: internal
id: SPEC-MERGE-VERIFY-DEPLOY
status: Current
created: 2026-11-06
last_updated: 2026-11-19
owners: ["engineering"]
service: delivery-os
summary: "The merge transaction and verify-deploy engine: the config-declared versioned gate registry shared by verify gates and merge, the fenced EVT-1 gate-verification record and freshness envelope, the post-verification tracker and CI probe extended to every not-green declared required job with its recorded-or-probe attribution, owner-gate classification as merge authority, recorded authorized waivers, the one composed provider-side squash landing with crafted metadata and an exact-head guard, the total mergeability refusal taxonomy and its closed sync-required reason pair, the retained local landing and refresh capabilities with no composed caller, the recorded landing identity's provider provenance and the truthful `shaOnBase` third state, the verify deploy trace verdict taxonomy, the recorded merge commit that anchors closeout's merged-diff sweep, and the merge.* / verify.deploy.* error identities."
links:
  related_changes: ["GH-225", "GH-237", "GH-240", "GH-242", "GH-300", "GH-293", "GH-338", "GH-349"]
  related_decisions: ["ADR-0003", "ADR-0004", "PDR-0003", "TDR-0031", "TDR-0033", "ADR-0012"]
  contracts:
    - "packages/core/src/contracts/merge.ts"
    - "packages/core/src/contracts/verify-deploy.ts"
---

# Feature: Merge and Verify Deploy

## Overview

`merge <ref>` turns landing into one verified transaction. `verify deploy <ref>`
turns deploy confidence into a job-trace read. The gate registry is
config-declared versioned data shared by `verify gates` and `merge`, so a
repository adds gates without a code change while the five shipped built-in gate
ids stay reserved, mandatory, and byte-identical by default.

The merge transaction consumes the newest gate-verification record, enforces the
freshness envelope, performs one bounded post-verification probe, verifies any
waiver override against the gate class's declared policy, resolves the request's
mergeability into one declared outcome, lands through exactly one provider-side
call at the head the envelope verified, records the provider's own merged truth,
and records the outcome. No daemon path fires a merge, no branch mutates the head
it verified, and no force operation exists in the mutation vocabulary.

The production composition supplies the transaction's reads for real: the tracker
work-item read, the check-run page, and the request-detail read run through the
delivered provider adapters and credential seam, and the composition resolves its
inputs from declared sources only — configuration from the resolved document's
typed `merge` branch, the branch from the checkout's git facts, the base
reference from the declared integration base, and the **owner principal** from the
provider-resolved repository owner: the owner component of the checkout's
normalized `host/owner/name` identity, resolved through the delivered identity
policy with no new configuration key. The declared `merge` configuration keys stay
exactly `gate-freshness`, `gates`, and `deploy-expectations`.

The configuration document is resolved once per invocation, before the
transaction reads anything. An absent document keeps the delivered defaults; a
document that cannot be read or resolved is refused by its own classified
identity instead of being replaced by an empty map — a malformed document is
`config.file.malformed`, and an invalid `merge` value (a refused `merge.gates`
set, or a `gate-freshness` that is not a finite non-negative number) is
`config.value.invalid`. Each is a declared `config` row at its declared
projection (exit `1`), reached before any provider read and before any
verification or transaction append, and never the contained `fallback.internal`.

`merge` is the lifecycle merge path. The coordinator verifies finalization with
`verify change` and `phase list`, then runs `merge <ref>` for each ready item;
the platform merge command (`gh pr merge`, `glab mr merge`) is not the primary
path, and `@pr-manager` never merges.

## One landing mechanism

`merge` composes exactly one landing mechanism: the closed
`merge-delivery-request` adapter operation, through the transaction's landing
port. The call carries the request identity, the squash strategy, the verified
head as the expected head, the crafted title, and the crafted message; it is
issued at most once per invocation, never re-issued after a failure, and carries
no force, bypass, auto-merge, queue, or landing-retry variant — those are absent
from the type rather than rejected at runtime. See [Adapter Reference
Behavior](feature-adapter-reference-behavior.md) for the operation's contract and
[Adapter Ports](feature-adapter-ports.md) for its canonical arguments.

The crafted metadata is deterministic and operator-free. The title is the
delivery request's provider-asserted title, verbatim; when the provider asserts
no title, the deterministic fallback is `merge(<ref>): squash <sourceRef>` —
the change ref, then the request's source ref. The message is one fixed verbatim
trailer for every landing: `Landed by the delivery lifecycle merge primitive.`
No flag, free-form input, request body, interpolation, or provider prose
participates in either field.

The landing verdict is provider truth only. `result=merged` requires a read-back
in which the provider asserts the request merged, and the provider's merge-commit
identity becomes the recorded landing identity; an absent merge commit is unknown
rather than derived. The exact-head guard binds the landing to the evidence: the
expected head is the head the envelope verified, and a head that moved between
verification and the landing refuses `merge.gates-stale` with zero landing calls.
A landing refused by the provider is returned as a refusal and is never converted
into a local commit, a fallback landing, or a success by inference. Where an
adapter declares the landing a gap, `merge` refuses `merge.transaction-aborted` at
exit 1 naming the operation and its declared gap reason, with zero landing
attempts, zero local squash, and zero fallback — capability honesty instead of a
silent local path. A re-run over a request already recorded as landed replays
`merged` with the recorded identity and performs no second landing call.

The local squash landing and the local rebase-refresh remain declared,
seam-level-tested git capabilities with no composed caller: nothing in the
coordinator, daemon, dispatch, closeout, or merge path invokes them, and a
production-source scan with a mandatory failing control proves the absence.

## Command surfaces

| Invocation | Outcome |
|---|---|
| `merge <ref>` | Land one delivery request through the provider-side landing call at the verified head; `result=merged` with `squash=` carrying the provider's merge commit on success. |
| `merge <ref> --dry-run` | Evaluate the merge-applicable set, append one verification record, land nothing: no waiver record, no transaction record, no git mutation, never `result=merged`/`squash=`. |
| `merge <ref> --waive <gate-id> --waived-by <principal>` | Declare an override; the authorizer is verified before any record or mutation. |
| `verify deploy <ref>` | Read the deploy-job trace once and render `verdict=verified|unknown|failed`. |

Refusals are classified errors at exit 1 (or exit 2 for platform faults and
state-unverified): the text-mode summary keeps `result=refused` and names the
failed gate or condition with inline evidence and a remediation hint. Scripted
mode renders the shipped failure envelope (`error` + `runId`, no `data`).

`<ref>` is the declared work-item-ref grammar
(`^[A-Za-z][A-Za-z0-9]*-[0-9]+$`), the same `QUEUE_REF_PATTERN` the queue surface
validates. A shape outside it is refused `input.value.rejected` at exit `1`
before any read. The composition resolves a ref's work-item number through that
same pattern, so a prefix carrying a digit (`ABC2-12`) resolves to issue `12`
rather than being refused as unresolvable.

## Config-declared gate registry

`merge.gates` is an optional schema-versioned declaration
(`delivery.merge.gates.v1`); absent means the shipped default set. Each entry
declares a stable `id`, a recipe from the closed vocabulary
(`lifecycle-finalization`, `ci-green`, `push-parity`, `owner-gate`,
`squash-preflight`, `required-ci-job`, `tracker-freshness`), a surface
(`battery`, `merge`, or `both`), and optionally a class binding or a required CI
job. The default set is the five built-ins on the battery surface in shipped
order plus the merge-only `tracker-freshness` entry.

A declared set replaces the default wholesale and is refused as invalid
configuration when it omits a built-in, redefines a reserved built-in id with a
different recipe/surface/class, carries an unsupported version, contains a
duplicate or malformed entry, or carries an undeclared field. The effective
identity (schema version plus entry-id sequence) is recorded in every
verification and binds its validity.

`merge.gate-freshness` is the declared bound in seconds (default 1800). The
declared comparator is `>=`: at-bound is stale.

## Gate-verification record and freshness envelope

Every full evaluation that is not refused for narrowed suite breadth appends
exactly one fenced, post-append-verified record
(`delivery.merge.gate-verification.v1`, record kind
`merge.gate-verification`): `verify gates` records the battery entries and
`merge --dry-run` records the merge-applicable entries. A `verify gates` run
refused with `verify.narrowed-scope` appends no record and no capsule event, so
`merge`'s freshness read sees only the previous record. The record shape,
schema, derivation, and the one-append counting for every non-refused evaluation
are unchanged. The record carries the
change ref, head SHA, verification time, gate-set identity, per-gate verdicts
with bounded citations, and the observed tracker posture. An append failure is
a classified state failure and is never consumable evidence. `verify gates`
verdicts, citations, ordering, and human bytes are pinned byte-identically by
goldens; the append is the only output effect.

`merge` reads the newest record and enforces: the record exists and is readable;
age ≤ the bound (at-bound stale); the recorded head SHA equals the current head;
the recorded gate-set identity equals the effective one. A violation refuses
`merge.gates-stale` with the age, bound, SHAs, set delta, and any probe
observation inline. Absent, torn, unreadable, or schema-incompatible state
refuses `merge.state-unverified` at exit 2.

## Post-verification probe

One work-item read, one check-run page on the verified head, and one
request-detail read. A tracker transition into an owner-attention posture after
verification refuses `merge.gate.tracker-freshness.failed` with the transition
and its age. A declared required job that is not green on the verified head —
queued, running, canceled, skipped, or failed — refuses on the
`merge.gate.<gate-id>.failed` family with the delivered reason
(`ci-pending`, `ci-canceled`, `ci-all-skipped`, `ci-failed`). A job the effective
gate set does not declare is never gate evidence, and a check-run page for
another SHA is not head evidence. The post-refusal checks posture reads that same
declared set — every `required-ci-job` entry of the effective gate set, by
`job ?? id` — so a non-green job the set does not declare produces no refusal and
the refusal stays `behind-unconfirmed`. When the freshness envelope is also violated,
`merge.gates-stale` is primary and the probe observation rides as additional
evidence.

The declared gate evaluation treats `queued` and `running` as not green with the
pending reason, and the probe uses the same per-job evaluation, so the
post-check is never narrower than the gate it post-checks. Every not-green
required-job refusal names its evidence source in one additive optional bounded
field whose vocabulary is the closed pair:

| Attribution | Meaning |
|---|---|
| `recorded` | The persisted gate verdict already reported that job not green; the evidence also names the gate's effective id, the job, and the verdict, which together identify the persisted `merge.gate-verification` record. |
| `probe` | The recorded verdict was green and the probe observed the job not green. |

The verification timestamp is not an evidence field: it stays on the persisted
verification record that the gate id plus job resolves to. Provider-required
checks remain the provider's authority — a provider refusal is classified, never
retried and never bypassed, and there is no second required-check evaluator and
no prose matching anywhere on the path.

## Classification and waivers

Every failure the production composition emits carries the `domainKind` its
resolved error-table row declares, and its exit is that row's declared
projection: the state-read and read-fault constructors derive both the kind and
the exit from the same resolved row, so `config.credential.missing` is a `config`
refusal at `user-validation` (exit `1`), never the contained `fallback.internal`
at exit `2`. The composition publishes its emittable failure-code set as one
named exported constant, `MERGE_COMPOSITION_EMITTABLE_CODES`, plus one declared
family type for `merge.gate.<gate-id>.failed`; the declaration is exhaustive by
construction over every code its refusal branches can emit — including the gate
family those branches emit — and it is a declaration only: it adds no row, kind,
or exit. The configuration-read branch contributes its forwarded codes:
they are declared in one tuple typed against the delivered configuration
taxonomy, so a code the taxonomy does not declare cannot reach the declaration,
and they are members of the emittable set like every other branch. A read fault
the table already declares is expressed through that declared identity: a
rejected credential is `provider.auth.rejected` at exit `1`, an unreachable or
malformed provider answer is `provider.outage` at exit `2`, and a request or work
item that does not resolve aborts as `merge.transaction-aborted` at exit `1`.

The PDR-0003 two-row kind/class policy is consumed as declared and extended with
a per-class waiver-authorization policy: `owner-review` is never-merge and
owner-authored; `waiver` is defaultable. A declaration names the gate and the
authorizer. A gate with no class binding is never waivable. A never-merge gate
authorizes only the provider-resolved owner principal; an unresolvable principal
never authorizes. An unauthorized declaration refuses
`merge.waiver-unauthorized` naming the gate, class, and authorizer, and records
no waiver; the invocation remains in the audit ledger.

An authorized waiver is appended (`delivery.merge.waiver.v1`, kind
`merge.waiver`) before any landing mutation and persists regardless of the final
verdict. An owner-gate failure with no declaration refuses
`merge.owner-gate-override-without-waiver`. The board consumes recorded waivers:
a gate with a recorded owner-gate waiver is collected as `waiver`-kind with its
recorded authorizer, while an unwaived gate stays `owner-review` with
`waivedBy: null`; the board payload schema remains `delivery.board.v1`.

## Mergeability refusal taxonomy

The decision rule is total over the four normalized mergeability states plus
absence, and every path is bounded:

| Observed condition | Outcome |
|---|---|
| `mergeable` | Proceed to the guarded landing. |
| `conflicting` | `merge.sync-required` with reason `dirty`, exit 1; no landing call, no rebase, no head mutation. |
| `not-mergeable` | Offer the guarded landing once — the provider is the authority on whether its protection rule blocks a behind, unstable, blocked, or draft request — and classify a refusal with exactly one bounded post-refusal re-read of the same request: a checks posture over the effective gate set's declared `required-ci-job` entries yields the effective required-job row with its delivered reason; any other re-read, including one whose only non-green job the gate set does not declare, yields `merge.sync-required` with reason `behind-unconfirmed`, naming the observed provider state. |
| `unknown` or absent | Exactly one bounded re-read of the same request, compared on the exact head: recovered reads classify by the rule above, a changed head refuses `merge.gates-stale`, and a still-unknown read refuses `merge.mergeability-unknown` at exit 2. The command never waits or polls. |
| Landing fired, provider truth not observed | `merge.landing-unverified` at exit 2 with consequence `unknown`; a re-run re-verifies and never re-lands. |

`merge.sync-required` carries a closed `reason` vocabulary of exactly two values:
`dirty` (the request reads conflicting, so the sync cause is certain and no
landing is attempted) and `behind-unconfirmed` (the request was offered to the
provider, the provider refused, and the one bounded re-read cannot separate an
out-of-date head from another protection rule). The delivered four-value
normalization collapses `behind`, `blocked`, `unstable`, and `draft` into
`not-mergeable` and exposes no second provider signal, so a confirmed out-of-date
reason has no carrier and is not declared; prose matching is not a substitute.
The `behind-unconfirmed` remediation instructs the operator to update the
delivery branch onto the base by the normal path, re-verify, and retry, and
states that a refusal persisting after the sync means the protection rule is the
cause.

There is no internal refresh on the landing path. Each attempt performs one
bounded probe, at most one landing call, and at most one recovery read, and never
mutates the head: a local-only rebase cannot change what the provider accepts, and
a force push is not representable. An out-of-date request therefore resolves as an
instruction to the coordinator rather than as an internal loop.

`merge.rebase-conflict` is retained and reserved: it keeps its code, category,
projection, and remediation, stays in the composition's declared emittable set,
and is reachable from no delivered command path. Its removal or re-purposing is a
recorded revisit trigger tied to a coordinator-side sync action, never an
undocumented delete.

## Landing evidence and convergence

With every enforced gate passing (by fresh verification plus probe, or a
recorded authorized waiver) the request lands through the one composed landing
call and the outcome is recorded (`delivery.merge.transaction.v1`, kind
`merge.transaction`) with the landing evidence, the refresh evidence,
waiver references, and post-landing step statuses (branch deletion,
closeout-ready). The record's `squashSha` is the provider-asserted merge commit.

`landing.shaOnBase` is retained with a narrowed, truthful meaning: it reports
whether the provider-asserted merge commit is contained on the base **only when a
local containment read answers for that identity**, and reports `unknown`
otherwise. Its value domain is `boolean | "unknown"`, the state-layer record
validator accepts exactly that domain so a written `unknown` round-trips through
the verified read, a legacy boolean record reads exactly as before, and the human
line renders the third state as `unknown`. After a provider landing with no fetch
the object is not in the checkout, so a production run reports `unknown` rather
than a locally derived `true`, and the field is never landing evidence — the
verdict is the provider's merged assertion plus the merge-commit identity.

A fired landing whose provider truth is not observed refuses
`merge.landing-unverified` at exit 2 with consequence `unknown`; a re-run
re-verifies and never re-lands. A clean pre-mutation abort refuses
`merge.transaction-aborted` at exit 1 with retryable `true` and consequence
`not_landed`. A post-landing cleanup failure never flips a verified landing and
is never silent. A recorded landing replays `merged` at exit 0 with the recorded
identity, zero landing calls, and no duplicate record.

The recorded `merge.transaction` is the merged evidence anchor for closeout's read-only merged-diff sweep: the sweep reads the recorded merge commit and its parent to obtain one bounded added-line diff. Because `merge` performs no fetch, the squash object of a provider landing is not in the operator's checkout until a later operation fetches it, so the sweep degrades to `skipped-gap` with `merged-diff-unavailable` in that window; the sweep stays detection-only and its two honest repairs are deferred to their own decision. No merge contract, gate set, or mutation vocabulary changes for that consumer; closeout reads the record and performs no merge action. See [Closeout Transaction](feature-closeout.md).

## verify deploy

`verify deploy <ref>` resolves the deployment target deterministically, reads the
deploy job's execution trace once (executed steps with outcomes and produced
artifacts; no log bodies, no retries, no pagination), and compares it against the
declared expectation set (`merge.deploy-expectations`, or the provider-declared
fact where exposed). `verified` requires the declared steps executed successfully
and the artifacts present. Zero executed steps reads `unknown` with reason
`pipeline-created-never-ran` at `verify.deploy.trace-missing`. A status field
standing alone or contradicting the trace reads `unknown` with reason
`status-stale` at `verify.deploy.status-stale`. Failed steps read `failed` with
the step named at `verify.deploy.trace-failed`. No declared expectation or absent
evidence degrades to `unknown`, never `verified`. A trace-read fault is exit 2
with a declared existing platform identity, never a new `verify.deploy.*` fault
row. Negative verdicts are classified errors at exit 1 with `runId` and no
`data`; text mode keeps `verdict=` continuity.

**Declared residual.** `verify deploy`'s production target resolution remains a
stub: the command's delivered behaviour, its golden, and its error identities are
unchanged, and engine-verified deploy target resolution is *not delivered*. An
operator reading this page or the engine-first guide must treat deploy
verification as a residual gap rather than an engine-verified capability.

The reason↔identity map is total and bidirectional: absent executed-step
evidence (including a created-never-ran pipeline, which keeps that reason) maps
to `verify.deploy.trace-missing`, `status-stale` maps to
`verify.deploy.status-stale`, and a failed step maps to
`verify.deploy.trace-failed`. No fourth reason and no fourth row exists, and
every row is reachable from its reason.

## Error identities

The machine table declares a `merge` domain kind with twelve concrete rows
(`merge.gates-stale`, `merge.waiver-unauthorized`,
`merge.owner-gate-override-without-waiver`, `merge.rebase-conflict`,
`merge.state-unverified`, `merge.landing-unverified`,
`merge.transaction-aborted`, `merge.sync-required`,
`merge.mergeability-unknown`) and the one open-slot family
`merge.gate.<gate-id>.failed`; the `verify` kind carries
`verify.deploy.trace-missing`, `verify.deploy.status-stale`, and
`verify.deploy.trace-failed`. Every row is documented and machine-declared
together; the family slot is validated against the effective declared gate set,
with no pattern widening.

| Row | Category | Retryable | Consequence | Projection | Exit |
|---|---|---|---|---|---|
| `merge.sync-required` | user | no | `not_landed` | `user-validation` | 1 |
| `merge.mergeability-unknown` | platform | yes | `not_landed` | `platform-provider` | 2 |

`merge.sync-required` also carries its closed `reason` pair; the family row
carries the not-green required-job findings and, where the finding came from a
declared required job, the `recorded` or `probe` attribution. A declared landing
gap is refused through the delivered `merge.transaction-aborted` row and adds no
identity.

## Invariants

- The five built-in gate ids stay reserved and mandatory in any declared set.
- `merge --dry-run` performs zero mutations: it appends one verification record
  and never a waiver record, a transaction record, a git mutation,
  `result=merged`, or `squash=`.
- No daemon or dispatch path composes the merge mutation surface; the merge
  command is the only composed producer of the lifecycle merge, and it composes
  exactly one landing mechanism — the closed `merge-delivery-request` operation.
  The local squash landing and the rebase-refresh stay declared git-seam
  capabilities with no composed caller.
- No path mutates the head it verified: there is no internal rebase, no fetch,
  no push, and no force, bypass, auto-merge, queue, or landing-retry variant; the
  mutation union cannot express them, and a production-source scan runs with a
  mandatory failing control.
- The composition's declared emittable set (`MERGE_COMPOSITION_EMITTABLE_CODES`
  plus the declared `merge.gate.<gate-id>.failed` family) is exhaustive over
  every code its refusal branches can emit, and every emitted pair resolves to a
  row whose declared kind equals the emitted kind, so `fallback.internal` is
  reachable only for a genuinely undeclared failure.
- Secrets, payloads, titles, bodies, and log lines never reach output or records;
  the single redaction chokepoint covers every surface.
- Reads are bounded (one verification read, one work-item read, one check-run
  page, one request-detail read, at most one post-refusal re-read, at most one
  unknown-recovery re-read, one deploy trace read) and outputs are bounded
  (65 536-byte machine data; 24-line/4 096-byte human summaries) with explicit
  `+N` marks.

## Quality evidence

The enduring coverage map is the [merge and verify-deploy test specification](../../quality/test-specs/test-spec-merge-verify-deploy.md). The enduring coverage spans the production composition's reachability and classification (`merge-production-composition`, `merge-dry-run`, `merge-classification`, `merge-classification-conformance`), the landing mechanism and its crafted metadata (`merge-landing`, `merge-landing-metadata`, `merge-head-guard`, `merge-landing-retirement`), the refusal taxonomy (`merge-refusal-taxonomy`, `merge-refusal-surface`, `merge-refusal-rows`), the required-check contract and attribution (`merge-required-job-probe`, `merge-probe`, `merge-check-path-scan`), the retained git-seam capabilities (`merge-git-seam-capabilities`), idempotent replay (`merge-convergence`), and the named-defect regressions `defect-f1-merge-refusal-containment` and `defect-f8-serial-merge-churn`. The determinism, budget, bounds, state-write, privacy, and verify-gates rows of that specification are unchanged.

## Related

[Verify Gates](feature-verify-gates.md) · [Owner-Gate SLA](feature-owner-gate-sla.md) ·
[Configuration Layer](feature-config-layer.md) · [State Layer](feature-state-layer.md) ·
[Adapter Ports](feature-adapter-ports.md) · [Adapter Reference Behavior](feature-adapter-reference-behavior.md) ·
[Closeout Transaction](feature-closeout.md) ·
[Result Contract and Error Table](feature-result-contract.md) · [Commit Primitive](feature-commit-primitive.md) ·
[Engine-first Delivery Operations](../../guides/engine-first-operations.md) ·
[TDR-0031 — Engine-first evaluation surfaces](../../decisions/TDR-0031-engine-first-evaluation-surfaces.md) ·
[ADR-0012 — Provider-side landing path](../../decisions/ADR-0012-provider-side-merge-landing-path.md)

## Scheduling engine reconciliation (GH-237)

The scheduler reads the delivered deploy verdict and the producer repository's
own `merge.deploy-expectations`; it never executes a merge or evaluates a gate.
A dependent merge action is eligible only after the producer has landed and,
where expectations are declared, the verdict is `verified` with evidence.
Unknown, failed, or unreadable traces hold the dependent at `deploy-unverified`,
never green; a producer with no declared expectation passes on landing with
`deploy: not-declared` evidence. Deploy verdict reads are bounded at three per
scheduling pass and memoized per producer, and an exhausted budget holds the
dependent `deploy-unverified` with reason `read-budget-exhausted`. Expectations
are resolved through an injected producer-root port from the roots recorded on
queue entries only: the producer's entry-recorded root is matched to the
producer entry's recorded normalized repository key by exact string equality,
and the invocation checkout's configuration is never substituted. No matching
recorded root, two distinct roots claiming one key, or a missing, unreadable, or
invalid matched config is `unknown`, never `not-declared` or `verified`. See
[Scheduling Engine](feature-scheduling-engine.md).
