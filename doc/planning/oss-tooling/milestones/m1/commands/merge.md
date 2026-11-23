# merge(1)

Status: Delivered M1-S4 (GH-225); the production composition, the dry-run
report, and the declared emittable failure set are delivered by M2-S16
(GH-293); the provider-side landing path, the mergeability refusal taxonomy,
and the not-green required-job attribution are delivered by M4-S11 (GH-349);
the change-branch resolution, the merged-request convergence read, the refusal
diagnostics contract, and the single-request mergeability source are delivered
by GH-366. Implemented contract; scenarios SC-M1-01..04.

## NAME

`merge` - the merge transaction: gates fresh, squash, landing verified.

## SYNOPSIS

```
<binary> merge <ref> [--dry-run] [--waive <gate-id> --waived-by <principal>] [--waive-reason <text>]
<binary> merge --help
<binary> merge --version
```

## DESCRIPTION

Resolves the change branch first: one bounded open-request list read builds the
candidate set (capped at three; a saturated page refuses
`ambiguous-open-request` even with zero matches), and each candidate's change
record is read at its own asserted head through a bounded local git read
(at most two fixed-argv invocations, 262 144 bytes, no fetch) and its `branch`
declaration compared exactly to the candidate's own source ref — the resolution
source is `declared-at-head`, and no accepted candidate refuses
`merge.branch-unresolved` with one closed reason (`declaration-missing`,
`declaration-unusable`, `declaration-disagrees`, `record-missing`,
`record-invalid`, `record-unreadable`) naming each read candidate's cause and
attempted tree path. Duplicate matching delivery requests — open or merged —
are never ranked: `merge.transaction-aborted` names each duplicate identity.
Where the open page offers nothing to resolve, one convergence attempt reads
the delivered merged-request read verbatim and decides from its additive
matched-request-identities member: exactly one identity replays at exit 0
(`replayed=true`, zero record reads and zero record-read git invocations, lands
nothing), the empty set refuses `merge.request-unresolved` with
`no-open-request` as a decidable zero, and a faulted read is the distinct
declared provider outcome naming `operation=github-delivery-request-list` —
never folded into zero. The matched request's asserted full-SHA head IS the
resolved head.

The read budget per path peaks at three delivery-request provider requests:
one for every refusal decided before the merge decision (the open list), two
for an open-page-only run reaching the merge decision (the list plus the
single-request mergeability read), an empty convergence attempt, and a faulted
merged read, three for a match-bearing attempt (the read's own review-thread
query counted and never suppressible — no option suppresses it), plus at most
three bounded local record reads, one work-item read, one CI-workflow read, one
check-run page on the resolved head, one verification read, and at most one
post-refusal and one unknown-recovery re-read; no fetch, no pagination, no
retry.

Then the freshness envelope: the newest recorded verification is readable, its
age is below the declared bound (default 1800 seconds, comparator `>=`, so
at-bound is stale), its head SHA equals the resolved head, and its gate-set
identity equals the effective one. One bounded post-verification probe re-reads
the work item, one CI-workflow read, one check-run page on the resolved head,
and the delivered single-request mergeability read — the landing decision reads
mergeability from that single request, never the list; an unknown-recovery
re-read re-reads the single request.

With fresh evidence the transaction authorizes any declared waiver, applies
the declared-gate verdicts plus the probe, resolves the request's mergeability
into one declared outcome, and lands through exactly one guarded call to the
closed `merge-delivery-request` adapter operation at the head the envelope
verified. The squash subject is the request's provider-asserted title verbatim,
or `merge(<ref>): squash <sourceRef>` when the provider asserts none; the
message is the fixed trailer `Landed by the delivery lifecycle merge primitive.`
The outcome is recorded with the provider-asserted merge commit as its landing
identity.

A recorded landing replays `result=merged` at exit 0 with the same identity, no
landing call, and no duplicate record. A clean pre-mutation abort never mutates
and reports non-retryable `merge.transaction-aborted`, whose remediation names
the aborted pre-mutation condition and promises no convergence; a fired landing
whose provider truth was not observed refuses `merge.landing-unverified` with
consequence `unknown` and is never re-landed by a re-run.

The refusal decision is total over the observed mergeability plus absence. A
conflicting request refuses `merge.sync-required` with reason `dirty` and issues
no landing call. A `not-mergeable` request is offered to the provider once, and
its refusal is classified by one bounded re-read: a checks posture over the
effective gate set's declared `required-ci-job` entries yields
the effective required-job row, and any other reading — including one whose only
non-green job the gate set does not declare — yields `merge.sync-required`
with reason `behind-unconfirmed`. An unknown or absent mergeability gets exactly
one exact-head re-read; a still-unknown answer refuses
`merge.mergeability-unknown`. No path performs an internal rebase or mutates the
verified head; `merge.rebase-conflict` stays declared and is reachable from no
command path.

`landing=sha-on-base` reports `yes` or `no` only when a local containment read
answers for the provider's merge commit, and `unknown` otherwise — which is the
normal production answer after a provider landing, because the merge does not
fetch.

The effective gate set is configuration data (`merge.gates`, versioned, with
every built-in retained; the shipped default makes `ci-green` merge-applicable,
so the evaluated merge projection is two entries — `ci-green` and
`tracker-freshness` — and the merged report renders that projection, never the
record's battery list). The required-check set derives once per invocation:
every merge-applicable `required-ci-job` entry contributes `job ?? id` and the
CI gate contributes the repository-declared expected job set read through the
same delivered read the battery uses, validated by the exported
`expectedSetValid` rule; declaring `ci-green` on the `battery` surface is the
reviewed check-gate opt-out, and the check gate gains no waivability. The
freshness bound is `merge.gate-freshness`. Owner gate classification is
policy-as-data and overrides are recorded waivers. The base is the request's
declared target (default `main-tools`); the change branch and the resolved head
come from the resolution — neither is a flag, and no ambient checkout branch or
head is read. An explicit coordinator action: the daemon can prepare and queue
but never fire a merge.

### Refusals

Every merge refusal renders dedicated `command=merge`, `ref=<ref>` (always the
invocation's ref), and `operation=<token>` fields beside its code;
`operation` draws from the closed nine-token vocabulary
(`github-work-item`, `github-check-runs`, `github-delivery-request-list`,
`github-delivery-request-detail`, `github-merge-delivery-request`,
`repository-ci-workflow`, `delivery-registry`, `local-change-record-read`,
`local-git-object-read`) or `-` when the refusal names no operation, validated
at the rendering site. `merge.state-unverified` (exit 2) names the exact prior
command and target in its remediation: produce the verification with
`verify gates <ref>` for the same work item, then re-run. Every landing fault
reports exactly one of four closed declared identities —
`config.credential.missing` (naming the credential reference and environment
variable), `provider.auth.rejected`, `provider.outage`, or
`merge.landing-unverified` — with `operation=github-merge-delivery-request`,
never the abort row and never a raw port code.

## OPTIONS

| Option | Meaning |
|---|---|
| `<ref>` | Change reference in the declared work-item-ref grammar (`^[A-Za-z][A-Za-z0-9]*-[0-9]+$`, the shared `QUEUE_REF_PATTERN`). A shape outside it refuses `input.value.rejected` at exit 1 before any read, and a digit-bearing prefix (`ABC2-12`) resolves to its work item. |
| `--dry-run` | Evaluate the merge-applicable gate set, append one gate-verification record, and print the verdict: no waiver record, no transaction record, no git mutation, and never `result=merged` or `squash=`. A failing gate refuses `merge.gate.<gate-id>.failed` at exit 1. |
| `--waive <gate-id>` | Declare one override naming the gate. Paired with `--waived-by`: one flag without the other, or an empty value, refuses `input.value.rejected` at exit 1 before any read. |
| `--waived-by <principal>` | The declared authorizer. A never-merge gate authorizes only the provider-resolved owner principal; an unresolvable principal never authorizes. |
| `--waive-reason <text>` | Optional rationale, truncated to 280 characters. |
| `--json` | Global flag: emit the machine envelope instead of the human report. |
| `--verbose` | Global flag: add diagnostic detail to human output. |
| `--pretty` | Global flag: indent machine output. |
| `--help`, `--version` | Print command or self-description help and exit without reading state, git, configuration, or the network. |

An authorized declaration is appended before any landing mutation and persists
regardless of the final verdict. An unauthorized declaration refuses
`merge.waiver-unauthorized` and records no waiver. A dry run reports each
declaration's authorization verdict and never appends a waiver record.

## OUTPUT

Text: the bounded merged summary opens with the identity line
`<binary> merge <ref>  merged`, then `result=merged`, `change=`,
`squash=`, `landing=sha-on-base:<yes|no|unknown> request-state=<state>`,
`refresh=attempts=<n> outcome=<outcome>`, `waivers=`, `post-landing=`, and
`gates=<passed>/<total> passed` (`gates-omitted=+N` when the record list was
clamped), followed by one `gate <id> <verdict> reason=<reason>` line per
recorded gate. The dry-run summary carries `result=verified`, `head=`,
`gates=`, one `waiver=<gate-id>:<authorized|unauthorized>` line per declared
override, and the gate lines. Both summaries are bounded to 24 lines and 4096
UTF-8 bytes.

A refusal writes no report to stdout: the identity line and the rendered
condition with inline evidence go to stderr (`<binary>:
<error-code>`, then `summary: result=refused; condition=<code>` and the
evidence lines).

Envelope `data` of a merged transaction: `result` (`merged`), `changeRef`,
`squashSha`, `replayed`, `landing` (`shaOnBase` as `boolean | "unknown"`, `requestState`), `refresh`
(`attempts`, `outcome`), `waiverRefs[]`, `postLanding[]` (`id`, `status`),
`gates[]` (`id`, `verdict` in `pass`/`fail`/`unknown`, `reason`, `citation`),
and `gatesOmitted`.

Envelope `data` of a dry run: `result` (`verified`), `changeRef`, `headSha`,
`gates[]`, `gatesOmitted`, and `authorizations[]` (`gateId`, `authorizer`,
`authorized`, plus `gateClass` when authorized or `reason` when not). The
envelope itself is `schemaVersion` `delivery.result.v1`, `runId`, `exitCode`,
`timing.totalMs`, and either `data` or `error`.

## EXIT STATUS

| Code | Meaning |
|---|---|
| `0` | The provider-asserted landing was recorded, a recorded landing replayed, or the dry-run verdict was produced |
| `1` | Refused: a named gate, freshness, waiver, owner-gate, sync-required (dirty or behind-unconfirmed), a clean pre-mutation abort, a grammar or configuration refusal, an absent request or work item, or a rejected credential |
| `2` | A platform or state failure: non-consumable gate-verification state, an unverified landing, an undecided mergeability, or an unreachable provider |

## EXAMPLES

Clean landing:

```
$ <binary> merge GH-301 --json
{
  "schemaVersion": "delivery.result.v1",
  "runId": "r_01J8ZN2Q9E",
  "exitCode": 0,
  "timing": { "totalMs": 8412 },
  "data": {
    "result": "merged",
    "changeRef": "GH-301",
    "squashSha": "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678",
    "replayed": false,
    "landing": { "shaOnBase": "unknown", "requestState": "merged" },
    "refresh": { "attempts": 0, "outcome": "not-attempted" },
    "waiverRefs": [],
    "postLanding": [
      { "id": "branch-deletion", "status": "ok" },
      { "id": "closeout-ready", "status": "ok" }
    ],
    "gates": [
      { "id": "lifecycle-finalization", "verdict": "pass", "reason": "lifecycle-complete", "citation": { "...": "..." } },
      { "id": "ci-green", "verdict": "pass", "reason": "ci-green", "citation": { "...": "..." } }
    ],
    "gatesOmitted": 0
  }
}
```

`squashSha` is the provider's merge commit. `shaOnBase` is `"unknown"` here
because the checkout holds no object for that identity; a `yes`/`no` answer
requires a local containment read that can resolve it.

Dry run that lands nothing:

```
$ <binary> merge GH-301 --dry-run
<binary> merge GH-301  verified (dry-run)
result=verified
change=GH-301
head=9f21c0e
gates=1/1 passed
gate tracker-freshness pass reason=owner-gate-absent
```

Refusal with inline evidence (SC-M1-02):

```
$ <binary> merge GH-302
<binary>: merge.gate.ci-green.failed
summary: result=refused; condition=merge.gate.ci-green.failed
gate=ci-green
new-red-jobs=ts-tests
attribution=probe
remediation=Resolve the named merge-applicable gate evidence and re-run `verify gates`, then retry the merge.
```

A request that must be synced before it can land:

```
$ <binary> merge GH-303
<binary>: merge.sync-required
summary: result=refused; condition=merge.sync-required
recorded-sha=9f21c0e current-sha=9f21c0e
request-state=conflicting
evidence=dirty
remediation=Update the delivery branch onto the base by the normal path, re-run `verify gates`, then retry the merge; a refusal that persists after the sync means the protection rule is the cause.
```

(A refusal is exit 1; the condition, the named gate or reason, and the evidence
ride in `error.summary` on the envelope and on stderr in human mode. A
required-job finding also names its attribution: `recorded` when the persisted
verdict already reported the job not green, `probe` when the probe observed it.)

## ERRORS

Every emitted failure carries the `domainKind` its resolved error-table row
declares, and its exit is that row's declared projection class, so a code
whose projection moves takes its exit with it. The envelope `error` object
carries the resolved row's `code`, `category`, `retryable`, `consequence`, and
`remediationHint`, plus the rendered `summary` with the inline evidence.

| Error | Category | Retryable | Consequence | Projection | Exit |
|---|---|---|---|---|---|
| `merge.gate.<gate-id>.failed` | user | no | not_landed | user-validation | 1 |
| `merge.gates-stale` | user | no | not_landed | user-validation | 1 |
| `merge.waiver-unauthorized` | user | no | not_landed | user-validation | 1 |
| `merge.owner-gate-override-without-waiver` | user | no | not_landed | user-validation | 1 |
| `merge.rebase-conflict` | user | no | not_landed | user-validation | 1 |
| `merge.sync-required` | user | no | not_landed | user-validation | 1 |
| `merge.transaction-aborted` | user | no | not_landed | user-validation | 1 |
| `merge.branch-unresolved` | user | no | not_landed | user-validation | 1 |
| `merge.request-unresolved` | user | no | not_landed | user-validation | 1 |
| `merge.work-item-unresolved` | user | no | not_landed | user-validation | 1 |
| `merge.state-unverified` | platform | no | not_landed | platform-provider | 2 |
| `merge.landing-unverified` | platform | no | unknown | platform-provider | 2 |
| `merge.mergeability-unknown` | platform | yes | not_landed | platform-provider | 2 |

`merge.gate.<gate-id>.failed` is the one declared open-slot family
(`merge.gate.` plus the gate id plus `.failed`) and names the gate whose
evidence did not pass; a not-green required-job finding on that family carries
the `recorded` or `probe` attribution. `merge.gates-stale` covers an aged,
head-mismatched, or gate-set-mismatched record and a head that moved before the
landing; its evidence carries the age, the bound, the SHAs, the set delta, and
any probe observation. `merge.sync-required` carries the closed reason pair
`dirty` \| `behind-unconfirmed` and instructs a sync-and-re-verify rather than an
internal rebase. `merge.mergeability-unknown` reports that the provider has not
decided after one exact-head re-read and is retryable. `merge.owner-gate-override-without-waiver`
names the gate and the declared override path. `merge.rebase-conflict` stays
declared and reserved: no delivered command path emits it, and no force variant
exists. `merge.branch-unresolved` reports the change branch that could not be
resolved from the change record at the request head and carries one closed
reason (`declaration-missing`, `declaration-unusable`, `declaration-disagrees`,
`record-missing`, `record-invalid`, `record-unreadable`), chosen by the declared
precedence, naming the candidate, the record path at its head, and the reason.
`merge.request-unresolved` reports that no single open delivery request could be
resolved and carries one closed reason (`no-open-request`,
`ambiguous-open-request`, `head-unresolved`), naming the change ref and the
observed open and candidate counts. `merge.work-item-unresolved` reports the
tracker work item that could not be resolved, naming the work item and the read
operation that failed. All three refuse at exit 1.
`merge.transaction-aborted` is non-retryable and reaches exactly three
act-requiring causes — a waiver-append failure, a declared landing gap, and
duplicate matching delivery requests (open or merged, named by each duplicate
identity) — and its remediation names the aborted pre-mutation condition and
promises no convergence; a refused landing never reaches it, and a
non-resolving request, work item, or branch never reaches it.

The composition's emittable set is published as
`MERGE_COMPOSITION_EMITTABLE_CODES`, exhaustive over its refusal branches and
a declaration only: it adds no row, kind, or exit. On the read path it
surfaces these reusable identities:

| Error | Category | Retryable | Consequence | Projection | Exit |
|---|---|---|---|---|---|
| `input.value.rejected` | user | no | not_landed | user-validation | 1 |
| `config.credential.missing` | user | no | not_landed | user-validation | 1 |
| `config.file.malformed` | user | no | not_landed | user-validation | 1 |
| `config.value.invalid` | user | no | not_landed | user-validation | 1 |
| `config.key.unknown` | user | no | not_landed | user-validation | 1 |
| `config.reset.invalid` | user | no | not_landed | user-validation | 1 |
| `config.interpolation.rejected` | user | no | not_landed | user-validation | 1 |
| `config.secret.forbidden` | user | no | not_landed | user-validation | 1 |
| `config.path.forbidden` | user | no | not_landed | user-validation | 1 |
| `provider.auth.rejected` | user | no | not_landed | user-validation | 1 |
| `provider.outage` | transient | yes | not_landed | platform-provider | 2 |

The configuration document is resolved before the transaction reads anything:
an unreadable document forwards its own classified code
(`config.file.malformed`, `config.value.invalid`, `config.key.unknown`,
`config.reset.invalid`, `config.interpolation.rejected`,
`config.secret.forbidden`, `config.path.forbidden`) instead of resolving empty
values, and an invalid `merge.gates` or `merge.gate-freshness` value is
`config.value.invalid`.

A missing credential is `config.credential.missing` at exit 1: it is a `config`
refusal with its declared `user-validation` projection, and `fallback.internal`
at exit 2 is never a valid outcome for it. A provider read fault is expressed
through its declared identity: a rejected credential is
`provider.auth.rejected` at exit 1, an unreachable or malformed provider answer
is `provider.outage` at exit 2 (`provider.payload.invalid` classifies as
`provider.auth.rejected` on HTTP 401 or 403 and as `provider.outage`
otherwise, and any other read fault is `provider.outage`). A request or work
item that does not resolve never aborts: a non-resolving open request refuses
`merge.request-unresolved` at exit 1 with reason `no-open-request`,
`ambiguous-open-request`, or `head-unresolved`; a non-resolving work item
refuses `merge.work-item-unresolved` at exit 1; a change branch that does not
resolve from the change record at the request head refuses
`merge.branch-unresolved` at exit 1 with one of its six closed reasons.
`merge.transaction-aborted` is reserved for its three act-requiring causes —
the waiver-append failure, the declared landing gap, and duplicate matching
delivery requests — and no reference-resolution outcome reaches it.

## SEE ALSO

[verify-gates.md](verify-gates.md), [verify-deploy.md](verify-deploy.md),
[closeout.md](closeout.md)

## HELP

`<binary> merge --help` prints usage, options, at least one example, exit codes,
and a see-also pointer. Root `<binary> --help` and `<binary> --version` are
self-description only: zero state, network, git, or configuration reads and
zero writes. The executable is a non-installed Bun bin; see the
[man page](../man-page.md).
