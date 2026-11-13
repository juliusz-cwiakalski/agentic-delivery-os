# queue(1)

Status: `queue ready` M0 shipped (M0-S7); full queue shipped by GH-237
(M1-S17); lifecycle completion shipped by GH-292 (M2-S15). Examples
reconcile the delivered surface; scenarios SC-M1-08..11, SC-M1-17.

## NAME

`queue` - the programmatic delivery queue: dependency graph, ready set,
scheduling with single-flight and weight classes.

## SYNOPSIS

```
<binary> queue ready <ref>... (1..8 refs)
<binary> queue list
<binary> queue plan [--next <n>]
<binary> queue add <ref> [--priority <n>] [--dep <ref>]
<binary> queue prioritize <ref> <n>
<binary> queue dep <ref> <on-ref>
<binary> queue dep add <ref> <on-ref>
<binary> queue dep remove <ref> <on-ref>
<binary> queue claim [<ref>] [--holder <id>]
<binary> queue release <ref> [--holder <id>] [--park <cause>] [--until <iso>]
<binary> queue remove <ref> --reason <landed|abandoned|superseded|reconciled>
<binary> queue reconcile [--ref <ref>]
```

## DESCRIPTION

`queue ready` is the read-only ready-set (deps satisfied, repo free,
tier known, no owner gate, CI healthy, provider available; every
unsatisfied condition named). The queue manages scheduling:
per-repo single-flight as the only structural cap, build-weight classes
as resource classes, producers before consumers, closing beats opening,
parks that resume exactly when their condition clears, and one-shot
operation without the daemon. Mutating subcommands append intent under
the state layer's fence and land durably; no resident daemon or control
socket is required, and every successful queue/lanes payload carries
`degraded: ["daemon-unreachable"]` at exit 0 when no daemon is reachable.
`--watch` is accepted: it streams bounded daemon frames when the daemon is
reachable and degrades to bounded state polling at `daemon.watch-poll-interval`
when it is not.

The lifecycle is complete (GH-292): entries leave the queue when their work
lands, is abandoned, or is superseded — by hand through `queue remove` with a
required reason, automatically through `closeout --apply` with reason `landed`,
or through `queue reconcile` against tracker truth with reason `reconciled`.
Dependency edges are edited one edge per invocation with the explicit
`queue dep add <ref> <on-ref>` / `queue dep remove <ref> <on-ref>` grammar;
the delivered two-positional `queue dep <ref> <on-ref>` add stays valid and
behaves identically to `dep add`. Removal is append-only: an entry is present
iff its latest `queue.entry` append is later than its latest `queue.removal`
append in ledger position, so a removed entry disappears from every read
without any record being deleted, and a later re-declaration restores it.
`queue release` is unchanged: it drops the lane's lease and never removes an
entry.

## OUTPUT

Text: one bounded summary plus one line per entry or action; `queue
plan` prints the next N actions with reasons. Envelope `data` (schema
`delivery.queue.v1`): `entries[]` (ref, repository, state, rankClass,
priority, weightClass, weightClassSource, deps, blocking), `leases[]`,
`weights[]`, `parks[]`, `findings[]`, `degraded[]`, `truncated`, `counts`,
and, for `plan`, `nextActions[]` with `ref`, `repository`, `rankClass`,
`reason`, `priority`, `weightClass`, `weightClassSource`, `lease`,
`blocking[]`, optional `deploy`, and optional `preemption`.

Lifecycle payloads are additive per verb, each carrying the delivered
`degraded[]`:

- `remove` → `ref`, `result` (`removed`), `reason`, `readySet[]`, `event`
  (`{ topic: "queue.graph", kind: "remove" }`), `degraded[]`.
- `dep add` (either spelling) → the delivered `add | prioritize | dep` payload.
- `dep remove` → the delivered mutation keys plus `readySet[]` and `event`
  (`{ topic: "queue.graph", kind: "dependency-edge" }`); an absent edge is
  `result: "noop"` at exit 0 with zero appends and zero events.
- `reconcile` → `result` (`removed` | `noop`), `checked`, `removed[]`,
  `retained[]` (each retained ref with its observed `deliveryState`),
  `unobserved[]` (not-found items, retained), `readySet[]`, `truncated`,
  `remainder`, `degraded[]`. A run examines at most 100 entries with one
  bounded tracker read per examined entry and reports `truncated` with the
  exact `remainder` beyond the cap.

## EXIT STATUS

0 read, landed mutation, observed-empty queue, or report-only stuck-park
finding; 1 invocation rejection (such as an unknown park cause), dependency
cycle, lease conflict, unmet claim precondition, stuck-park claim refusal, or
unobserved entry; 2 platform or state read failure, including
`list`/`plan` over unreadable, torn, or unknown-kind history.

Exit matrix for the lifecycle mutations (no exit outside {0, 1, 2} is ever
produced):

| Outcome | Identity | Exit |
|---|---|---|
| Removal applied | — (success `data`) | 0 |
| `dep remove` / `reconcile` with no work | — (success `data`, result `noop`) | 0 |
| Removal without a reason | `queue.reason-missing` | 1 |
| Second dispatch against a ref with an active lane | `queue.single-flight` | 1 |
| Removal of a ref with no entry | `queue.entry.unobserved` | 1 |
| Removal or claim blocked by a precondition (`lease-held`, owner hold) | `queue.precondition.unmet` | 1 |
| Claim for another ref while a live lease is held in one repository | `queue.lease-conflict` | 1 |
| Out-of-vocabulary reason, non-canonical ref, malformed grammar | `input.value.rejected` | 1 |
| Cycle-closing add | `queue.dependency-cycle` | 1 |
| Tracker credential rejected during reconcile | `provider.auth.rejected` | 1 |
| Tracker unreadable or quota-exhausted during reconcile | `provider.outage`, `provider.quota.exceeded` | 2 |
| Queue state unreadable or torn | delivered `state.*` row | 2 |

## EXAMPLES

```
$ <binary> queue plan --next 3 --json
{
  "schemaVersion": "delivery.result.v1",
  "runId": "run-queue-example",
  "exitCode": 0,
  "timing": { "totalMs": 10 },
  "data": {
    "schemaVersion": "delivery.queue.v1",
    "entries": [
      {
        "ref": "GH-310",
        "repository": "github.com/owner/repo-alpha",
        "state": "ready",
        "rankClass": "merge-ready",
        "priority": 100,
        "weightClass": "standard",
        "weightClassSource": "absent",
        "deps": [],
        "blocking": []
      }
    ],
    "leases": [],
    "weights": [],
    "parks": [],
    "findings": [],
    "degraded": ["daemon-unreachable"],
    "truncated": false,
    "counts": {
      "entries": 1, "ready": 1, "held": 0, "parked": 0, "leases": 0, "parks": 0
    },
    "nextActions": [
      {
        "ref": "GH-310",
        "repository": "github.com/owner/repo-alpha",
        "rankClass": "merge-ready",
        "reason": "close-first",
        "priority": 100,
        "weightClass": "standard",
        "weightClassSource": "absent",
        "lease": { "state": "free" },
        "blocking": []
      }
    ]
  }
}
```

Dependency cycle refused (nothing appended):

```
$ <binary> queue dep GH-306 GH-307 --json
{
  "schemaVersion": "delivery.result.v1",
  "runId": "run-queue-example",
  "exitCode": 1,
  "timing": { "totalMs": 10 },
  "error": {
    "code": "queue.dependency-cycle",
    "category": "user",
    "retryable": false,
    "consequence": "not_landed",
    "remediationHint": "Remove the named cycle-creating dependency edge (the existing path is named) and retry; nothing was appended.",
    "summary": "The dependency edge would close a directed cycle."
  }
}
```

Reason-bearing removal applied (exactly one `queue.graph/remove` event later
observable in the ref's lane):

```
$ <binary> queue remove GH-310 --reason abandoned --json
{
  "schemaVersion": "delivery.result.v1",
  "runId": "run-queue-example",
  "exitCode": 0,
  "timing": { "totalMs": 10 },
  "data": {
    "ref": "GH-310",
    "result": "removed",
    "reason": "abandoned",
    "readySet": [],
    "event": { "topic": "queue.graph", "kind": "remove" },
    "degraded": []
  }
}
```

Single-flight refusal naming the holder at the envelope root (zero records,
zero events):

```
$ <binary> queue claim GH-310 --holder lane-2 --json
{
  "schemaVersion": "delivery.result.v1",
  "runId": "run-queue-example",
  "exitCode": 1,
  "timing": { "totalMs": 10 },
  "detail": { "holder": "lane-1" },
  "error": {
    "code": "queue.single-flight",
    "category": "transient",
    "retryable": true,
    "consequence": "not_landed",
    "remediationHint": "Wait for the named holder's lane to end, then retry; no session, lease record, attempt, or event was created.",
    "summary": "The requested ref already has an active lane."
  }
}
```

## ERRORS

`queue.dependency-cycle`, `queue.lease-conflict`,
`queue.park-condition-stuck`, `queue.entry.unobserved`,
`queue.precondition.unmet`, `queue.reason-missing`,
`queue.single-flight` (seven queue identities). An invocation rejection
such as an unknown park cause reuses `fallback.invocation` at exit 1; an
out-of-vocabulary `--reason` value, a non-canonical ref, or a malformed
grammar token is `input.value.rejected` at exit 1; a reconcile over an
unreadable or quota-exhausted tracker exits 2 with the provider's own
`provider.outage` / `provider.quota.exceeded` identity and a rejected
credential exits 1 with `provider.auth.rejected`; unreadable lease, park,
or entry history reuses the delivered `state.*` identities at exit 2.
A watch over unreadable state exits 2 with the delivered `state.*` identity.

## SEE ALSO

[lanes.md](lanes.md), [status.md](status.md),
[scheduling engine specification](../../../../../spec/features/feature-scheduling-engine.md)

## Shipped contract (GH-237)

The full family ships as `ready`, `list`, `plan`, `add`, `prioritize`, `dep`,
`claim`, and `release`. `ready` is unchanged; GH-292 extends the family with
`remove`, the `dep add`/`dep remove` grammar, and `reconcile`
([Shipped contract (GH-292)](#shipped-contract-gh-292)).

```
<binary> queue list
<binary> queue plan [--next <n>]
<binary> queue add <ref> [--priority <n>] [--dep <ref>]
<binary> queue prioritize <ref> <n>
<binary> queue dep <ref> <on-ref>
<binary> queue claim [<ref>] [--holder <id>]
<binary> queue release <ref> [--holder <id>] [--park <cause>] [--until <iso>]
```

`--watch` is accepted on `queue` (GH-238) as an additive flag. With a reachable
daemon the invocation subscribes to the closed `queue` topic, prints one bounded
initial snapshot, then one deduplicated bounded event frame per line, and exits
0 on interruption. With no reachable daemon it enters declared degraded polling
at `daemon.watch-poll-interval`, names `daemon-unreachable`, prints only changed
snapshots, and exits 0; unreadable state exits 2 with the delivered `state.*`
identity.

Machine envelopes follow the contract-level shapes:

- `list` → `entries[]`, `leases[]`, `weights`, `parks[]`, `findings[]`,
  `degraded[]`, `truncated`, `counts`. The entry `repository` field is the
  normalized `host/owner/name` key; the recorded root is internal and never
  rendered.
- `plan [--next n]` → the same collections plus `nextActions[]` with `ref`,
  `repository`, `rankClass`, `reason`, `priority`, `weightClass`,
  `weightClassSource`, `lease`, `blocking[]`, optional `deploy`, optional
  `preemption`.
- `add | prioritize | dep` → `ref`, `entry`, `edges[]`, `result`
  (`added`/`updated`/`noop`), `degraded[]`.
- `claim` → `result` (`claimed`/`renewed`/`taken-over`), `selectedRef`, `lease`,
  `action`, `degraded[]`.
- `release` → `result` (`released`/`parked`/`noop`), `lease`, optional `park`,
  `degraded[]`.

Exit projection: `0` computed/read/landed/observed-empty/report-only stuck-park
finding; `1` invocation rejection, dependency cycle, lease conflict, unmet
precondition (including no eligible action), stuck-park refusal on a claim, or
unobserved entry; `2` platform/provider/unverified state read, including
`list|plan` when lease or park history is unreadable, torn, or of unknown kind.
A daemon-down successful mutation lands durably and carries
`degraded: ["daemon-unreachable"]` at exit 0; a refused mutation projects only
its exit-1 identity.

`release --park <cause>` accepts exactly `provider-window`, `provider-quota`,
and `preempted-for-close-item`. Causes and condition types are two distinct
closed sets paired one-to-one: cause `preempted-for-close-item` pairs with
condition type `preemption`. A condition-type or unknown token is an invocation
rejection at exit 1 and appends nothing. With `--park`, the park record is
appended first; if the lease-release append then fails, a compensating
`queue.park` record with `recoveryState: released` withdraws the park and the
command returns the classified state failure. `--until <iso>` supplies the
absolute window expiry for `--park provider-window`, where it is required; a
missing `--until` or an `--until` paired with another park cause is refused
through `fallback.invocation` at exit 1 and appends nothing.

## Shipped contract (GH-292)

The lifecycle completion ships `queue remove`, the explicit
`queue dep add` / `queue dep remove` grammar over the preserved
two-positional add, and `queue reconcile`:

```
<binary> queue remove <ref> --reason <landed|abandoned|superseded|reconciled>
<binary> queue dep add <ref> <on-ref>
<binary> queue dep remove <ref> <on-ref>
<binary> queue reconcile [--ref <ref>]
```

Removal reasons are a closed four-value vocabulary: `landed`, `abandoned`,
`superseded`, `reconciled`. `--reason` is required on `remove`: a missing
flag is `queue.reason-missing` at exit 1 and an out-of-vocabulary value is
`input.value.rejected`; both append nothing. An accepted removal appends the
delivered park-withdrawal record first when a park is active, then one
`queue.removal` record, inside one fenced transaction, and replaces the
derived document only after verification; no record is ever deleted, edited,
or re-keyed. Removing a ref with no entry is `queue.entry.unobserved`; a
removal blocked by a live lease is `queue.precondition.unmet` with blocking
reason `lease-held`, naming the holder, releasing nothing. Removal is
non-cascading: a dependent keeps its edge and is held
`dependency-unobserved`, with no record appended for it. Re-declaring a
removed ref restores the entry (the presence rule is ledger position, not
`recordedAt` text).

Automatic removal: after a squash merge and an observed merged delivery
request, `closeout --apply` appends the `landed` removal inside the fence
closeout already holds, after the closeout writes. It is a non-step data
block: `queueRemoval` reports `removed` / `would-remove` (plan mode) /
`satisfied` (re-run over a removed or never-entered ref, exit 0) /
`skipped` with the closed skip reasons `no-merge-truth`, `lease-held`,
`state-unavailable`, `ref-not-canonical`. The hook never changes a step
outcome or closeout's exit code.

Reconcile: `queue reconcile [--ref <ref>]` reads each examined entry's
tracked work item through the injected tracker read and removes exactly the
stale entries — normalized `deliveryState` `done` or `canceled` — with
reason `reconciled`, under the same F-1 invariants as a manual removal. Open
states (`backlog`, `ready`, `in-progress`, `in-review`) are retained with
their observed state; a not-found item is retained and reported
`unobserved`; an unreadable tracker appends nothing, removes nothing, and
exits on the provider's own identity. The read is one bounded call per
examined entry,
sequential, no retry, no pagination, capped at 100 entries with `truncated`
and an exact `remainder`; a repeat run over reconciled entries exits 0 and
reports the second observation truthfully.

Per-ref single-flight precedence (distinct from the scheduling engine's
per-pass single-flight — one action per repository per pass — and from the
repository-exclusive lease, both unchanged). Every requester/live-lease pair
has exactly one outcome:

| Path | Live lease state | Outcome |
|---|---|---|
| dispatch family (`dispatch run`, composed daemon supervision claim) | recorded ref = requested ref, any holder | refused `queue.single-flight` at exit 1, envelope-root `detail.holder` names the holder; zero records, zero events |
| dispatch family | recorded ref ≠ requested ref, any holder | refused `queue.lease-conflict` at exit 1 |
| dispatch family | no live lease | `claimed` (one `acquired` record) |
| dispatch family | stale lease (heartbeat age ≥ TTL) | `taken-over` + incident evidence |
| `queue claim` | same ref, caller's own holder | `renewed` (one record, no session, no `detail`) |
| `queue claim` | same ref, another holder | refused `queue.single-flight` at exit 1, envelope-root `detail.holder` |
| `queue claim` | other ref, any holder | refused `queue.lease-conflict` at exit 1, the lease's recorded ref unchanged |
| `queue claim` | no live lease | `claimed` (one `acquired` record) |
| `queue claim` | stale lease | `taken-over` + incident evidence |

A refusal appends nothing and publishes no event; it happens before any
claim, spawn, resume, attempt, or record. The holder is named through the
additive optional command-declared `detail` object on the failure-envelope
root (`detail.holder`, single line, ≤ 128 characters, identifiers only);
`CommandResultError` keeps exactly its six fields, and `error.detail` is not
a placement (TDR-0027). Stale means heartbeat age at or over the lease TTL,
so a crashed session keeps the delivered stale takeover on every path
instead of refusing. Renewal is narrowed to one (repository, ref, holder): a
same-holder claim for a different ref refuses `queue.lease-conflict`, and
the lease's recorded ref is never rewritten. The direct
`claimQueueLease` seam keeps its delivered same-holder/same-ref renewal.

## HELP

`<binary> queue --help` prints usage, options, at least one example, exit codes,
and a see-also pointer. Root `<binary> --help` and `<binary> --version` are
self-description only: zero state, network, git, or configuration reads and
zero writes. The executable is a non-installed Bun bin; see the
[man page](../man-page.md).


## Owner hold

While an owner hold is active, `queue list` and `queue plan` carry the additive
optional `ownerHold` member (`source`, optional `reason`) and no next action;
`owner-hold` is prepended to every gated entry's ordered blocking list,
including active and stuck park entries, whose state and park reason are
preserved. `lanes` renders exactly one reason from `blocking[0]`: a gated entry
that is not an active or stuck park shows `owner-hold` and masks its more
specific idle reason, while an active or stuck park lane keeps rendering its
park reason; `queue list` retains the full ordered `blocking[]`. `queue ready` is
unchanged and carries no hold.

`queue claim <ref>` and `queue claim` with no ref both refuse
`queue.precondition.unmet` with the blocking-reason token exactly `owner-hold`
before ref selection, so the no-ref form never returns `no-eligible-action`.
The bounded detail names the source and optional reason, for example
`owner hold active (marker): peak-hour cost pause`. The refusal exits `1`, appends
zero records, and is a classified user-validation refusal: callers that want
deferral semantics treat `owner-hold` as wait/do-not-abort. The fenced claim
refuses before acquiring the fence. `queue add`, `queue prioritize`, `queue dep`,
and `queue release` still work while held; the mutating park-recovery pass is
skipped.

The hold is resolved from `<PREFIX>_OWNER_HOLD` and the host-wide marker
`<host root>/owner-hold`, where the host root is an absolute `<PREFIX>_STATE_DIR`
when set and otherwise `<home>/<stateDirectoryName>`; there is no marker-path
override, and the hold never narrows to one project. The hold adds no new
command, no new flag, no new `--park` cause, and no new exit code.
