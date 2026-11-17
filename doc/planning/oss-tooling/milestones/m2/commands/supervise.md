# supervise — run the supervisor battery

`supervise` is the operator-invoked supervisor battery: one run reads the
invoking checkout's durable delivery records once and classifies every lane and
every intersecting supervision claim as `progressing`, `stalled`, or `unknown`.
The battery consumes the delivered watchdog classification and corroboration
bound, the daemon instance/heartbeat/lane records, the queue lease/park
machinery, the coordinator ledger lease, and the delivered restart economics. It
never reads process state and never signals a process.

`supervise --help` renders this command's summary, usage, options, examples,
exit codes, and see-also pointer; `supervise --version` prints the resolved
version and build identity. Both are served from the static inventory with zero
state, git, network, configuration, or spawn activity.

## Invocation

```
<binary> supervise [--json]
```

The battery takes no positionals and no command-specific flags. Any extra
positional or unknown flag is the delivered `fallback.invocation` grammar
refusal at exit 1, decided before any state read.

## The report

The machine payload is the schema-versioned `delivery.supervision.v1` report:

- `repo` is the invoking checkout's single managed repository key; no other
  repository is named.
- `lanes[]` carries one entry per lane in scope with the lane's `ref`, its
  tri-state `classification`, its last `heartbeat` observation, the recorded
  live-lease `holder` (present exactly when a live lease exists), and non-empty
  `evidence` naming refs, record kinds, instants, and codes.
- `supervisors[]` carries one entry per supervision claim (daemon instance,
  coordinator ledger lease, live per-ref lease) with its identity, tri-state,
  heartbeat, holder, and scope evidence.
- `actions[]` names what the run applied: the supervised-stall park, the
  safe-boundary park intent over a held session, an admitted restart, the
  terminal exhaustion record, or the declared unavailable outcome.
- `counts`, `degraded`, `truncated` with a named `truncationReason`, and the
  run's recorded instant (`observedAt`).

Classification is artifact-only: any advancing artifact inside the observation
span reads `progressing` (prefill-safe); the full corroboration combination (a
heartbeat at or beyond the delivered stall bound, or a heartbeat trail spanning
the span, with a flat artifact trail) reads `stalled`; absent evidence reads
`unknown` and is never guessed.

## Stall park

A corroborated stall is parked through the delivered park machinery with the
`liveness-stall` cause, the resolver-mapped `provider-window` condition type, a
non-null `until` at the mapped condition type's declared recheck default, and
its corroborating evidence. A repeat run never appends a second park while the
active park stands. A stall over an actively held session records the park as a
safe-boundary intent: the holder is named, the lease is untouched, and nothing
is signalled. The delivered `lanes show <ref>` read then reports state `parked`,
reason `parked:liveness-stall`, and the active park's `until`.

## Restart policy

An already-parked stale lane consults the delivered restart budget and resume
economics exactly as the daemon's cycle does: an admitted restart appends the
delivered restart record with the budget ordinal moving one step; an exhausted
budget appends the delivered terminal exhaustion record and raises one typed
question (a repeat run does not duplicate it); an unevaluable admission is the
declared unavailable outcome and consumes no budget.

## Reflexes

The battery refuses an action whose object another supervision authority is
actively acting on with `supervise.duplicate-supervision` (retryable,
`not_landed`, exit 1, the live claim and holder named). A live resident daemon's
existence alone refuses nothing. A per-ref double-claim is refused through the
delivered `queue.single-flight` identity with the holder named.

## Exit codes

| Exit | Meaning |
|------|---------|
| `0` | The battery ran and produced its report (a detected-and-parked stall rides the report data and counts) |
| `1` | A classified refusal: grammar, a delivered refusal identity, or the per-action duplicate-supervision refusal |
| `2` | The evidence-absent answer (no artifact-evidence source exists for the scope) or unreadable state |

## No-process posture

The classification input shape declares no process-derived member, so a
process-only reading can never satisfy it. The battery never kills, spawns, or
signals; it appends only through the delivered park, restart, and
terminal-exhaustion paths, and the daemon's production composition stays
supervise-only.
