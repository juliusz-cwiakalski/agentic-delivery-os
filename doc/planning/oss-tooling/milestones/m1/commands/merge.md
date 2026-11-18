# merge(1)

Status: Delivered M1-S4 (GH-225); the production composition, the dry-run
report, and the declared emittable failure set are delivered by M2-S16
(GH-293). Implemented contract; scenarios SC-M1-01..04.

## NAME

`merge` - the merge transaction: gates fresh, squash, landing verified.

## SYNOPSIS

```
<binary> merge <ref> [--dry-run] [--waive <gate-id> --waived-by <principal>] [--waive-reason <text>]
<binary> merge --help
<binary> merge --version
```

## DESCRIPTION

Reads the newest recorded gate verification and enforces the freshness
envelope over it: the record is readable, its age is below the declared bound
(default 1800 seconds, comparator `>=`, so at-bound is stale), its head SHA
equals the current head, and its gate-set identity equals the effective one.
Then one bounded post-verification probe re-reads the work item, one check-run
page on the head, and the request detail.

With fresh evidence the transaction authorizes any declared waiver, applies
the declared-gate verdicts plus the probe, performs at most one rebase-refresh
when the request is behind its base, lands one squash commit, verifies the
landing (squash SHA on the base, request merged), and records the transaction.

A recorded contained landing replays `result=merged` at exit 0 with the same
squash SHA, no git mutation, and no duplicate record. A clean pre-mutation
abort never mutates and reports retryable `merge.transaction-aborted`; a fired
but unverifiable landing refuses `merge.landing-unverified` with consequence
`unknown` and is never re-landed by a re-run.

The effective gate set is configuration data (`merge.gates`, versioned, with
every built-in retained); the freshness bound is `merge.gate-freshness`. Owner
gate classification is policy-as-data and overrides are recorded waivers. The
base is the request's declared target (default `main-tools`) and the branch is
the checkout's head: neither is a flag. An explicit coordinator action: the
daemon can prepare and queue but never fire a merge.

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
`squash=`, `landing=sha-on-base:<yes|no> request-state=<state>`,
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
`squashSha`, `replayed`, `landing` (`shaOnBase`, `requestState`), `refresh`
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
| `0` | The squash landing was verified and recorded, a recorded contained landing replayed, or the dry-run verdict was produced |
| `1` | Refused: a named gate, freshness, waiver, owner-gate, rebase, a clean pre-mutation abort, a grammar or configuration refusal, an absent request or work item, or a rejected credential |
| `2` | A platform or state failure: non-consumable gate-verification state, an unverified landing, or an unreachable provider |

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
    "landing": { "shaOnBase": true, "requestState": "merged" },
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
remediation=Resolve the named merge-applicable gate evidence and re-run `verify gates`, then retry the merge.
```

(A refusal is exit 1; the condition, the named gate, and the evidence ride in
`error.summary` on the envelope and on stderr in human mode.)

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
| `merge.transaction-aborted` | user | yes | not_landed | user-validation | 1 |
| `merge.state-unverified` | platform | no | not_landed | platform-provider | 2 |
| `merge.landing-unverified` | platform | no | unknown | platform-provider | 2 |

`merge.gate.<gate-id>.failed` is the one declared open-slot family
(`merge.gate.` plus the gate id plus `.failed`) and names the gate whose
evidence did not pass. `merge.gates-stale` covers an aged, head-mismatched, or
gate-set-mismatched record and a refresh that changed the head; its evidence
carries the age, the bound, the SHAs, the set delta, and any probe observation.
`merge.owner-gate-override-without-waiver` names the gate and the declared
override path. `merge.rebase-conflict` names the conflicting paths and has no
force variant.

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
otherwise, and any other read fault is `provider.outage`), and a request or
work item that does not resolve aborts as `merge.transaction-aborted` at exit 1
so a re-run with a valid reference converges.

## SEE ALSO

[verify-gates.md](verify-gates.md), [verify-deploy.md](verify-deploy.md),
[closeout.md](closeout.md)

## HELP

`<binary> merge --help` prints usage, options, at least one example, exit codes,
and a see-also pointer. Root `<binary> --help` and `<binary> --version` are
self-description only: zero state, network, git, or configuration reads and
zero writes. The executable is a non-installed Bun bin; see the
[man page](../man-page.md).
