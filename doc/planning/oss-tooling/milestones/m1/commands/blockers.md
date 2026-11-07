# blockers(1)

Status: M1 planned (M1-S16). Proposed contract; scenario SC-M1-13.

## NAME

`blockers` - the typed question channel: publish, list, answer.

## SYNOPSIS

```
<binary> blockers list [--open]
<binary> blockers answer <id> [--choice <n>] [--text <text>]
<binary> blockers publish <type> --lane <id> "<question>" [--options a,b]
```

## DESCRIPTION

Typed questions replace prose blockers: decision-needed (with options),
spec-ambiguity, credential-missing (variable name only, never values;
the channel refuses values), external-wait. Questions rank in the digest
and brief within one collection cycle; answers are data records the
machinery applies to resume lanes without re-entering delivery sessions.
One mechanism, two audiences: owner gates and the coordinator.

## OUTPUT

Text: ranked question lines. Envelope `data`: `questions[]` (id, type,
lane, ref, question, options[], askedAt, age, rank), and on answer:
`applied`, `laneResume` (mode: boundary-note, attach-continue).

## EXIT STATUS

0 listed or answered; 1 invalid type, unknown id, or a credential value
was supplied; 2 platform faults.

## EXAMPLES

Answer and resume (SC-M1-13):

```
$ <binary> blockers answer q-8f21 --choice 2 --json
{
  "schemaVersion": 1,
  "runId": "r_01J8ZT5V7Z",
  "exitCode": 0,
  "timing": { "started": "2026-11-18T09:20:00Z", "durationMs": 130 },
  "data": {
    "answered": "q-8f21",
    "audience": "coordinator",
    "choice": "lite+escalation",
    "applied": true,
    "laneResume": { "lane": "L2", "mode": "boundary-note", "sessionReentry": false }
  }
}
```

Cross-audience answer refused (the confused-deputy guard):

```
$ <binary> blockers answer q-9043 --choice 1 --json | cat
{"runId":"r_01J9B7K2M4","error":{"code":"blockers.audience-mismatch","category":"user","retryable":false,"consequence":"not_landed","remediationHint":"question q-9043 is addressed to audience owner; this identity may not answer it (delegation policy: none)"}}
```

Credential value refused by the channel:

```
$ <binary> blockers publish credential-missing --lane L4 "token" --text "ghp_livevalue" --json | cat
{"error":{"code":"blockers.credential-value-rejected","category":"user","retryable":false,"consequence":"not_landed","remediationHint":"credential questions carry the variable name only; the value comes from the environment"}}
```

## ERRORS

`blockers.invalid-type`, `blockers.unknown-id`,
`blockers.credential-value-rejected`.

## SEE ALSO

[status.md](status.md), [board.md](board.md), [dispatch.md](dispatch.md)

## HELP

`<binary> blockers --help` prints usage, options, at least one example, exit codes,
and a see-also pointer. Root `<binary> --help` and `<binary> --version` are
self-description only: zero state, network, git, or configuration reads and
zero writes. The executable is a non-installed Bun bin; see the
[man page](../man-page.md).

