# queue(1)

Status: `queue ready` M0 shipped (M0-S7); full queue M1 planned
(M1-S17). Proposed examples; scenarios SC-M1-08..11, SC-M1-17.

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
{"schemaVersion":1,"runId":"r_01J8ZS3Q9W","exitCode":1,"timing":{"started":"2026-11-18T09:07:31Z","durationMs":22},"error":{"code":"queue.dependency-cycle","category":"user","retryable":false,"consequence":"not_landed","remediationHint":"the edge creates a cycle: GH-307 -> GH-306 already exists"}}
```

## ERRORS

`queue.dependency-cycle`, `queue.lease-conflict`,
`queue.park-condition-stuck` (park outliving its condition is a bug
class, surfaced as a finding).

## SEE ALSO

[lanes.md](lanes.md), [plan.md](plan.md), [daemon.md](daemon.md)
