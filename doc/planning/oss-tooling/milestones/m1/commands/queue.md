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
<binary> queue [list|plan]
<binary> queue add <ref> [--priority <n>] [--dep <ref>]...
<binary> queue prioritize <ref> <n>
<binary> queue dep <ref> <on-ref>
```

## DESCRIPTION

`queue ready` is the read-only ready-set (deps satisfied, repo free,
tier known, no owner gate, CI healthy, provider available; every
unsatisfied condition named). The full queue (M1) manages scheduling:
per-repo single-flight as the only structural cap, build-weight classes
as resource classes, producers before consumers, closing beats opening,
parks that resume exactly when their condition clears, one-shot
operation without the daemon. Mutating subcommands write intent to
state and notify a running daemon (control socket); daemon-down they
still write and the daemon reconciles on start.

## OUTPUT

Text: graph, lease holders, weight loads, parks with conditions; `queue
plan` prints the next N actions with reasons. Envelope `data`:
`entries[]` (ref, state, priority, deps), `leases[]` (repo, holder,
scope), `weights` (runner, class, active), `parks[]` (id, cause,
condition, recheck), `nextActions[]` (ref, reason).

## EXIT STATUS

0 computed; 1 dependency cycle or unmet precondition named; 2 platform
faults.

## EXAMPLES

```
$ <binary> queue plan --next 3 --json
{
  "schemaVersion": 1,
  "runId": "r_01J8ZS2P8V",
  "exitCode": 0,
  "timing": { "started": "2026-11-18T09:05:00Z", "durationMs": 140 },
  "data": {
    "nextActions": [
      { "ref": "GH-303", "reason": "merge-ready (close-first)", "lease": "repo-alpha: free" },
      { "ref": "GH-302", "reason": "resume at phase boundary (answered)", "lease": "repo-beta: free" },
      { "ref": "GH-305", "reason": "held: weight heavy on runner R2 (ETA 22m); standard lanes unaffected" }
    ],
    "parks": [
      { "id": "P-31", "cause": "provider-peak-window", "condition": "ends 10:30Z", "recheck": "60s" }
    ]
  }
}
```

Dependency cycle refused:

```
$ <binary> queue dep GH-306 GH-307 --json | cat
{"error":{"code":"queue.dependency-cycle","category":"user","retryable":false,"consequence":"not_landed","remediationHint":"the edge creates a cycle: GH-307 -> GH-306 already exists"}}
```

## ERRORS

`queue.dependency-cycle`, `queue.lease-conflict`,
`queue.park-condition-stuck` (park outliving its condition is a bug
class, surfaced as a finding).

## SEE ALSO

[lanes.md](lanes.md), [plan.md](plan.md), [daemon.md](daemon.md)

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
<binary> queue release <ref> [--holder <id>] [--park <cause>]
```

`--watch` is not accepted on any queue subcommand; it is an invocation rejection
at exit 1 through `fallback.invocation`.

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
rejection at exit 1 and appends nothing.
