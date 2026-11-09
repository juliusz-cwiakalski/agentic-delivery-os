# coordinator(1)

Status: delivered (M1-S23).

## NAME

`coordinator` - supervise the coordinator session: claim the single-instance
lease, run the foreground supervision loop, request a stop, report status, and
run one bounded collection cycle.

## SYNOPSIS

```
<binary> coordinator start --foreground [--fresh-budget] [--json]
<binary> coordinator stop [--json]
<binary> coordinator status [--live] [--json]
<binary> coordinator tick [--json]
<binary> coordinator --help
```

## DESCRIPTION

The coordinator family is the delivered M1-S23 supervision surface. `start`
requires `--foreground` in v1 (a bare `start` is `fallback.invocation` at exit
1); it claims the append-only instance lease, records the acquisition, runs the
declared foreground loop over an injected cycle driver, and appends one
`released` at loop exit. `--fresh-budget` opens a new restart-budget epoch that
is persisted on the lease carrier, so later `status`, `tick`, and `start`
invocations observe it even when the start consumes no restart ordinal.

`stop` is a recorded request: it appends a `stop-requested` lease record for the
live holder and never releases another process's handle. The live supervisor
honours the request only when the `instanceId` matches its own and appends
`released` at the next cycle boundary.

`status [--live]` reports the folded instance, regime, session, last decision,
restart count and bound, the last persisted stuck verdict, `tickVerdict: null`,
the last wake, escalation state, and lease holder. `--live` adds the bounded
positive live-facts set (`alive`, `startTimeVerified`, `leaseAgeMs`) when the
process facts are available, and declares `unknown` otherwise. `status` never
mutates state and never evaluates; run `tick` for an evaluation.

`tick` claims the lease, runs exactly one bounded collection cycle, attempts one
lease pair, and returns the cycle payload with a non-null `tickVerdict`. A
cycle with no wake pickup reports `no-pickup` with a null question.

Every successful command returns the bounded `delivery.coordinator.v1` `data`
payload. Non-zero exits project the declared coordinator error families:
`coordinator.already-running`, `coordinator.restart-budget-exhausted`,
`coordinator.process.capability-gap`, `coordinator.session.kill-failed`,
`coordinator.escalation.publish-failed`, and `coordinator.wake.delivery-failed`.

## OPTIONS

- `--foreground` - run the foreground supervision loop (`start` only).
- `--fresh-budget` - open a new restart budget epoch (`start` only).
- `--live` - report bounded live process facts (`status` only).
- `--json` - emit the machine envelope instead of human text.
- `--verbose`, `--pretty` - standard global output flags.

## EXIT CODES

- `0` - the command completed with its declared verdict (including
  `not-running`, `exhausted-escalated`, and `no-pickup`).
- `1` - invocation or verdict refusal (grammar, missing `--foreground`,
  restart-budget exhaustion, harness spawn gap).
- `2` - classified platform/state failure (lease contention, capability gap,
  torn state, failed kill, failed escalation publish, wake delivery failure).

## SEE ALSO

`status`, `brief`, `blockers`, `daemon`, and the coordinator feature spec.
