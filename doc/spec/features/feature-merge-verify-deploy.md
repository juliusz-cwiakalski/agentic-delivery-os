---
ados_distribution: internal
id: SPEC-MERGE-VERIFY-DEPLOY
status: Current
created: 2026-11-06
last_updated: 2026-11-08
owners: ["engineering"]
service: delivery-os
summary: "The merge transaction and verify-deploy engine: the config-declared versioned gate registry shared by verify gates and merge, the fenced EVT-1 gate-verification record and freshness envelope, the post-verification tracker and CI probe, owner-gate classification as merge authority, recorded authorized waivers, the single rebase-refresh with no force path, the verified squash landing with idempotent convergence and dry-run, the lifecycle merge path the coordinator uses, the verify deploy trace verdict taxonomy, the recorded squash SHA and parent that anchor closeout's merged-diff sweep, and the merge.* / verify.deploy.* error identities."
links:
  related_changes: ["GH-225", "GH-237", "GH-240", "GH-242"]
  related_decisions: ["ADR-0003", "ADR-0004", "PDR-0003"]
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
waiver override against the gate class's declared policy, attempts exactly one
rebase-refresh when the request is behind its base, lands one squash commit,
verifies the landing, and records the outcome. No daemon path fires a merge and
no force operation exists in the mutation vocabulary.

`merge` is the lifecycle merge path. The coordinator verifies finalization with
`verify change` and `phase list`, then runs `merge <ref>` for each ready item;
the platform merge command (`gh pr merge`, `glab mr merge`) is not the primary
path, and `@pr-manager` never merges.

## Command surfaces

| Invocation | Outcome |
|---|---|
| `merge <ref>` | Land one verified squash commit; `result=merged` with `squash=` on success. |
| `merge <ref> --dry-run` | Evaluate the merge-applicable set, append one verification record, land nothing: no waiver record, no transaction record, no git mutation, never `result=merged`/`squash=`. |
| `merge <ref> --waive <gate-id> --waived-by <principal>` | Declare an override; the authorizer is verified before any record or mutation. |
| `verify deploy <ref>` | Read the deploy-job trace once and render `verdict=verified|unknown|failed`. |

Refusals are classified errors at exit 1 (or exit 2 for platform faults and
state-unverified): the text-mode summary keeps `result=refused` and names the
failed gate or condition with inline evidence and a remediation hint. Scripted
mode renders the shipped failure envelope (`error` + `runId`, no `data`).

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

Every full evaluation appends exactly one fenced, post-append-verified record
(`delivery.merge.gate-verification.v1`, record kind
`merge.gate-verification`): `verify gates` records the battery entries and
`merge --dry-run` records the merge-applicable entries. The record carries the
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
and its age. A newly failing job on the verified head refuses
`merge.gate.ci-green.failed` with the job id. A different-SHA page is not head
evidence. When the freshness envelope is also violated, `merge.gates-stale` is
primary and the probe observation rides as additional evidence.

## Classification and waivers

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

## Rebase-refresh

A behind-base request gets exactly one refresh attempt per invocation. A
conflict refuses `merge.rebase-conflict` naming the conflicting paths. A
successful refresh changes the head, voids the SHA-bound verification, and
refuses `merge.gates-stale` with the old-to-new SHA transition and the re-verify
remediation. No force variant exists in the declared mutation union.

## Squash landing and convergence

With every enforced gate passing (by fresh verification plus probe, or a
recorded authorized waiver) the request lands as one squash commit. The landing
is verified (squash SHA on the base, request merged) and recorded
(`delivery.merge.transaction.v1`, kind `merge.transaction`) with the landing
evidence, refresh attempts, waiver references, and post-landing step statuses
(branch deletion, closeout-ready). A fired but unverifiable landing refuses
`merge.landing-unverified` at exit 2 with consequence `unknown`; a re-run
re-verifies and never re-lands. A clean pre-mutation abort refuses
`merge.transaction-aborted` at exit 1 with retryable `true` and consequence
`not_landed`. A post-landing cleanup failure never flips a verified landing and
is never silent. A recorded contained landing replays `merged` at exit 0 with the
same squash SHA, zero git mutations, and no duplicate records.

The recorded `merge.transaction` is the merged evidence anchor for closeout's read-only merged-diff sweep: the sweep reads the recorded squash SHA and its parent to obtain one bounded added-line diff. No merge contract, gate set, or mutation vocabulary changes for that consumer; closeout reads the record and performs no merge action. See [Closeout Transaction](feature-closeout.md).

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

The reason↔identity map is total and bidirectional: absent executed-step
evidence (including a created-never-ran pipeline, which keeps that reason) maps
to `verify.deploy.trace-missing`, `status-stale` maps to
`verify.deploy.status-stale`, and a failed step maps to
`verify.deploy.trace-failed`. No fourth reason and no fourth row exists, and
every row is reachable from its reason.

## Error identities

The machine table declares a `merge` domain kind with seven concrete rows
(`merge.gates-stale`, `merge.waiver-unauthorized`,
`merge.owner-gate-override-without-waiver`, `merge.rebase-conflict`,
`merge.state-unverified`, `merge.landing-unverified`,
`merge.transaction-aborted`) and the one open-slot family
`merge.gate.<gate-id>.failed`; the `verify` kind carries
`verify.deploy.trace-missing`, `verify.deploy.status-stale`, and
`verify.deploy.trace-failed`. Every row is documented and machine-declared
together; the family slot is validated against the effective declared gate set,
with no pattern widening.

## Invariants

- The five built-in gate ids stay reserved and mandatory in any declared set.
- `merge --dry-run` performs zero mutations: it appends one verification record
  and never a waiver record, a transaction record, a git mutation,
  `result=merged`, or `squash=`.
- No daemon or dispatch path composes the merge mutation surface; the merge
  command is the only landing producer.
- The mutation union declares no force variant; a production-source scan runs
  with a mandatory failing control.
- Secrets, payloads, titles, bodies, and log lines never reach output or records;
  the single redaction chokepoint covers every surface.
- Reads are bounded (one verification read, one work-item read, one check-run
  page, one request-detail read, one deploy trace read) and outputs are bounded
  (65 536-byte machine data; 24-line/4 096-byte human summaries) with explicit
  `+N` marks.

## Related

[Verify Gates](feature-verify-gates.md) · [Owner-Gate SLA](feature-owner-gate-sla.md) ·
[Configuration Layer](feature-config-layer.md) · [State Layer](feature-state-layer.md) ·
[Adapter Ports](feature-adapter-ports.md) · [Closeout Transaction](feature-closeout.md) ·
[Result Contract and Error Table](feature-result-contract.md) · [Commit Primitive](feature-commit-primitive.md)

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
