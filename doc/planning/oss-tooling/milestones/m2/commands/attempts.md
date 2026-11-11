# attempts(1)

Status: Proposed (M2)

## NAME

`attempts` - the dispatch attempt evidence read side, a subfamily of `dispatch`.

## SYNOPSIS

```
<binary> dispatch attempts [--ref <ref>] [--limit <n>] [--json]
```

## DESCRIPTION

Read-only history of dispatch attempts. `attempts` is a subfamily of
`dispatch`, not a separate root family: it reads the evidence the dispatch
engine already records and never starts, stops, or mutates a dispatch.

Each attempt carries its token, the corroboration triple (completed pm-notes
phase evidence, tracker state, and CI on the pushed head), divergence refs,
start and end timestamps, and the harness identity. The read side is what
handover decisions and retros cite instead of file spelunking.

This surface is proposed for M2-S12 and is not yet registered at the root
listing; see [../entrypoint-delta.md](../entrypoint-delta.md). The contract is
`attempts.v1` in [../contracts.md](../contracts.md).

## OPTIONS

| Option | Meaning |
|---|---|
| `--ref <ref>` | Restrict history to one work item; omitted, the active ref is resolved from the local delivery context. |
| `--limit <n>` | Bound the page size. The envelope states whether more attempts remain. |
| `--json` | Emit the machine envelope instead of the human digest. |

## OUTPUT

Text: one line per attempt with time, ref, outcome token, corroboration state,
divergence count, and harness, newest first.

Envelope `data` carries:

| Key | Contract |
|---|---|
| `attempts[]` | Attempt records, newest first |
| `attempts[].token` | The result token recorded for the attempt |
| `attempts[].corroboration` | The three corroboration sources and their states |
| `attempts[].divergenceRefs[]` | References to recorded divergences |
| `attempts[].startedAt` / `endedAt` | Attempt timestamps |
| `attempts[].harness` | Harness identity recorded for the attempt |
| `hasMore` | Whether more attempts remain beyond the page |

## EXIT STATUS

| Code | Meaning |
|---|---|
| `0` | History was produced, including an empty history |
| `1` | The request was refused, for example an unknown ref |
| `2` | A platform or state failure prevented reading the ledger |

## EXAMPLES

```
$ <binary> dispatch attempts --ref GH-241 --limit 3
2026-11-09T10:12Z  GH-241  success   corroborated  divergences=0  harness=h1
2026-11-09T08:40Z  GH-241  success   uncorroborated divergences=1 harness=h1
2026-11-08T19:03Z  GH-241  refused   corroborated  divergences=0  harness=h2
```

```
$ <binary> dispatch attempts --ref GH-241 --json
{ "ok": true, "command": "dispatch attempts", "data": { "attempts": [ "..." ], "hasMore": true } }
```

## ERRORS

| Error | Meaning | Exit |
|---|---|---|
| `attempts.ref-unknown` | The ref has no attempt history | 1 |
| `attempts.limit-invalid` | `--limit` is not a positive integer | 1 |
| `attempts.ledger-unavailable` | The attempt ledger cannot be read | 2 |

## SEE ALSO

[attempts.v1](../contracts.md), [attempt-history flow](../architecture.md),
[dispatch](../../m1/commands/dispatch.md)
