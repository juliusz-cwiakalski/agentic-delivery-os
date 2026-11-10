# queue(1)

Status: `queue ready` M0 shipped (M0-S7); full queue shipped by GH-237
(M1-S17). Examples reconcile the M1-S17 delivery; scenarios SC-M1-08..11,
SC-M1-17.

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
<binary> queue claim [<ref>] [--holder <id>]
<binary> queue release <ref> [--holder <id>] [--park <cause>] [--until <iso>]
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

## OUTPUT

Text: one bounded summary plus one line per entry or action; `queue
plan` prints the next N actions with reasons. Envelope `data` (schema
`delivery.queue.v1`): `entries[]` (ref, repository, state, rankClass,
priority, weightClass, weightClassSource, deps, blocking), `leases[]`,
`weights[]`, `parks[]`, `findings[]`, `degraded[]`, `truncated`, `counts`,
and, for `plan`, `nextActions[]` with `ref`, `repository`, `rankClass`,
`reason`, `priority`, `weightClass`, `weightClassSource`, `lease`,
`blocking[]`, optional `deploy`, and optional `preemption`.

## EXIT STATUS

0 read, landed mutation, observed-empty queue, or report-only stuck-park
finding; 1 invocation rejection (such as an unknown park cause), dependency
cycle, lease conflict, unmet claim precondition, stuck-park claim refusal, or
unobserved entry; 2 platform or state read failure, including
`list`/`plan` over unreadable, torn, or unknown-kind history.

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

## ERRORS

`queue.dependency-cycle`, `queue.lease-conflict`,
`queue.park-condition-stuck`, `queue.entry.unobserved`,
`queue.precondition.unmet`. An invocation rejection such as an
unknown park cause reuses `fallback.invocation` at exit 1; unreadable lease,
park, or entry history reuses the delivered `state.*` identities at exit 2.
A watch over unreadable state exits 2 with the delivered `state.*` identity.

## SEE ALSO

[lanes.md](lanes.md), [status.md](status.md),
[scheduling engine specification](../../../../../spec/features/feature-scheduling-engine.md)

## Shipped contract (GH-237)

The full family ships as `ready`, `list`, `plan`, `add`, `prioritize`, `dep`,
`claim`, and `release`. `ready` is unchanged.

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

## HELP

`<binary> queue --help` prints usage, options, at least one example, exit codes,
and a see-also pointer. Root `<binary> --help` and `<binary> --version` are
self-description only: zero state, network, git, or configuration reads and
zero writes. The executable is a non-installed Bun bin; see the
[man page](../man-page.md).


## Owner hold

While an owner hold is active, `queue list` and `queue plan` carry the additive
optional `ownerHold` member (`source`, optional `reason`) and no next action; each
entry's blocking list starts with `owner-hold`. `lanes` renders exactly one
reason, so it shows `owner-hold` and masks the more specific reason; `queue list`
retains the full ordered `blocking[]`. `queue ready` is unchanged and carries no
hold.

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

The hold is resolved from `<PREFIX>_OWNER_HOLD` and the fixed production-store
marker `<home>/<stateDirectoryName>/owner-hold`; there is no marker-path
override, store relocation, new command, new flag, new `--park` cause, or new
exit code.
