# attempts(1)

Status: Proposed (M2)

## NAME

`attempts` - the dispatch attempt evidence read side, a subfamily of `dispatch`.

## SYNOPSIS

```
<binary> dispatch attempts [--ref <ref>] [--limit <n>] [--json]
<binary> dispatch attempts --help
<binary> --version
```

## DESCRIPTION

Read-only history of dispatch attempts. `attempts` is a subfamily of
`dispatch`, not a separate root family: it reads the evidence the dispatch
engine already records and never starts, stops, or mutates a dispatch. It is
mounted with the delivered dispatch family and does not change the root family
listing or the prompt-required command set; see
[../entrypoint-delta.md](../entrypoint-delta.md). The contract is
`attempts.v1` in [../contracts.md](../contracts.md). The companion
`dispatch dual-run resolve` result declares `mode: "local-evidence"`
unconditionally, names the divergence's own repository, and reports the shared
repository-scoped divergence block.

`--help` and `--version` are served from the static help inventory: they perform
no state, network, git, configuration, or model read.

Each attempt carries its token, the corroboration triple (completed pm-notes
phase evidence, tracker state, and CI on the pushed head), its single divergence
reference, start and end timestamps, and the harness identity. `endedAt` is the
consumer name for the record's finish timestamp. `divergenceRef` is one
identifier or explicit `null`, never a list, because the durable record carries
at most one reference. The read side is what handover decisions and retros cite
instead of file spelunking.

The read is scoped to the invoking checkout's repository twice: physically by
the project state root and logically by filtering each record on its own
`repository`. Records of another repository in the same root are excluded and
disclosed as a count only (`excluded.foreignRepository`), never named, so a
migrated root cannot present another repository's evidence as the operator's
own. Repository identity resolves with persistence disabled, so a read never
creates or repairs the dispatch repository binding marker.

The read is read-only with respect to evidence: zero attempt, divergence,
handover, or authority appends and zero fence acquisitions. It opens a store, so
it inherits the host-index maintenance write (zero when unchanged) and the
create-once project checkout identity marker that any store-opening invocation
performs.

When `--ref` is omitted the active reference resolves from
`.ai/local/pm-context.yaml` (`active_change.workItemRef`). When that context is
absent, unparsable, or carries no active change, the command refuses at exit
`1` with a bounded summary naming the context file and the `--ref` remedy. When
the checkout identity cannot be resolved, it refuses at exit `1` naming the
checkout; an invocation outside any checkout never reports the host-scoped
`unbound` store as a repository's history.

A verified read that matches no record is a success, not a refusal: the ledger
is keyed by attempt identifier, so an absent reference and a reference whose
attempts have not been recorded yet are the same observation.

## OPTIONS

| Option | Meaning |
|---|---|
| `--ref <ref>` | Restrict history to one work item (canonical `[A-Z]+-\d+`); omitted, the active ref is resolved from the local delivery context. |
| `--limit <n>` | Page size in canonical decimal form, 1..100, default 20. The envelope states whether more attempts remain. |
| `--json` | Emit the machine envelope instead of the human digest. |

Nothing is clamped or silently normalised: a non-canonical `--limit` (`0`,
`101`, `-1`, `abc`, `07`, `+7`, ` 7`, `001`) or a missing value is refused.

## OUTPUT

Text: one summary line, then one line per attempt newest first, then an optional
truncation line, then the coverage/floor pointer.

```
attempts=<n>; repository=<identity>; ref=<ref>; has_more=<true|false>
<startedAt> <ref> <token> <corroboration> <divergenceRef|none> <harness> <evidenceClass>
truncation=human:bound:<kept>,omitted:<dropped>
next: dispatch dual-run summary --repo <repository> (coverage and floor)
```

The timestamps print exactly as stored. The corroboration cell is the closed
three-value derivation: `corroborated` when no source is `unsatisfied` and at
least one is `satisfied`, `uncorroborated` when any source is `unsatisfied`, and
`vacuous` when all three are `not-applicable`. The digest is bounded to 40 lines
and 8,192 bytes: rows are dropped from the oldest end, and at most 37 rows print
beside a truncation line. `has_more` is untouched by the human cut. An empty
page prints the summary line, no rows, and the pointer.

Envelope `data` carries eight always-present keys plus `truncation` only when a
bound binds:

| Key | Contract |
|---|---|
| `repository` | The resolved normalized `host/owner/name` identity |
| `ref` | The reference the read was scoped to |
| `refSource` | `"flag"` or `"active-change"` |
| `limit` | The effective page bound |
| `matched` | Matching records within the bounded ledger read |
| `hasMore` | Whether matching attempts exist beyond the returned array |
| `attempts[]` | Projected attempts, newest first |
| `excluded.foreignRepository` | Count of foreign-repository records in the retained window |
| `truncation` | `{ scope: "ledger" \| "page", bound, omittedRecords }`, only when a bound binds |

Each `attempts[]` entry projects exactly sixteen fields: `attemptId`,
`repository`, `ref`, `harness`, `evidenceClass`, `outcome`, `token`,
`startedAt`, `endedAt`, `divergenceRef` (string or `null`), `corroboration`,
`falseSuccess`, `comparison` (`class`, `token` or `null`, `outcome`),
`resumeMode` (string or `null`), `evidenceRefs` (≤ 16 identifiers), and
`recordedAt`. No prompt, transcript, diff, credential, or provider payload is
projected.

Bounds: ledger read 5,000 records; page 20 by default, 1 minimum, 100 maximum;
machine `data` 65,536 UTF-8 bytes; human digest 40 lines and 8,192 bytes; at most
37 attempt rows beside a truncation line; 16 evidence references per record; 20
unresolved identifiers per block. Every bound that binds is declared:
`truncation.bound` is `5000` for the ledger scope and `65536` for the page scope,
and the ledger scope takes precedence.

## EXIT STATUS

| Code | Meaning |
|---|---|
| `0` | History was produced, including a verified empty history |
| `1` | The request was refused: a non-canonical ref, an invalid limit, an unknown flag, an unexpected positional, an unresolvable active reference, or an unresolvable repository identity (all `input.value.rejected`) |
| `2` | A platform state failure prevented reading the ledger honestly; the delivered `state.*` identity is reported and never an empty history |

The exit always follows the delivered row: `state.permission.denied` projects
`user-validation` at exit `1`, while the platform state rows project exit `2`.

## EXAMPLES

```
$ <binary> dispatch attempts --ref GH-241 --limit 3
attempts=3; repository=github.com/owner/repo; ref=GH-241; has_more=true
2026-11-09T10:12:00.000Z GH-241 merged corroborated none opencode pilot
2026-11-09T08:40:00.000Z GH-241 pr-open uncorroborated DIV-1 opencode pilot
2026-11-08T19:03:00.000Z GH-241 blocked vacuous none claude-code pilot
next: dispatch dual-run summary --repo github.com/owner/repo (coverage and floor)
```

```
$ <binary> dispatch attempts --ref GH-241 --json
{
  "schemaVersion": "delivery.result.v1",
  "runId": "run-1",
  "exitCode": 0,
  "timing": { "totalMs": 4 },
  "data": {
    "repository": "github.com/owner/repo",
    "ref": "GH-241",
    "refSource": "flag",
    "limit": 20,
    "matched": 1,
    "hasMore": false,
    "attempts": ["..."],
    "excluded": { "foreignRepository": 0 }
  }
}
```

The delivered envelope is the five-field `CommandResult`
(`schemaVersion`, `runId`, `exitCode`, `timing`, and `data`, plus `error` on a
failure). It carries no `ok` and no `command` field; the invocation is recorded
in the command audit ledger under the family token `dispatch`, and no subform
name is added to the envelope.

## ERRORS

| Error | Meaning | Exit |
|---|---|---|
| `input.value.rejected` | A malformed request or an unresolvable context/identity; nothing was read, nothing was appended | 1 |
| `state.*` (for example `state.store.torn`) | The attempt ledger cannot be read honestly; that row's own identity, category, retryability, consequence, and remediation apply, never an empty history | The delivered projection of that row: `state.permission.denied` is `1`; the platform state rows are `2` |

There is no `attempts.*` error identity. The read side's refusals are the
delivered `input` and `state` identities above, and a document that names an
`attempts.*` code is stale.

## SEE ALSO

[attempts.v1](../contracts.md), [attempt-history flow](../architecture.md),
[dispatch](../../m1/commands/dispatch.md)
