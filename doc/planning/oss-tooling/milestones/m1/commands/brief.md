# brief(1)

Status: M1-S6 shipped (GH-228). Example values are illustrative unless stated.

## NAME

`brief` - the deterministic, render-only owner brief.

## SYNOPSIS

```
<binary> brief [--json]
```

## DESCRIPTION

One screen, decision-first, rendered from the same collector state as
the status digest (one source of truth). The brief carries ready-to-merge
and owner-gate ages as anchored action groups, then six digest-section
surfaces. Ready-to-merge is an attention projection over observed
approved, non-draft, open pull requests; it is never a merge verdict.
Unbuilt capabilities appear as named placeholders, exactly
three: typed questions (M1-S16), gate SLA states (M1-S5), and the
queue/lane engine (M1-S17). No LLM in the render path (asserted in
review and by dependency checks). Read-only: no writes, no child
processes, and no brief-specific reads.

## OUTPUT

Text: one bounded screen, at most 24 lines and 4096 bytes, decision-first.
The header names the injected binary and the bound repository.

Envelope `data`: `delivery.brief.v1`, with `schemaVersion`, `generatedAt`,
`repository`, `surfaces[]` (the closed nine ids: six digest sections plus
`typed-questions`, `gate-sla-states`, `lane-queue-engine`), `anchors[]`
(`ready-to-merge`, `owner-gate-ages`), `placeholders[]` (exactly three
entries, each naming capability, owning story, and `not-delivered`), and
`truncation[]` (one marker per omitted surface or anchor group).

## EXIT STATUS

0 brief rendered, including every failed, absent, unattempted, or
unresolved collector read and every unbuilt capability. Those conditions
are payload evidence on the affected surface or a named placeholder, not
a command failure.
1 rejected invocation (`fallback.invocation`), before any source read.
2 containment/internal failure (`fallback.internal`).

## EXAMPLES

Envelope shape (abridged; `runId`, `timing`, `generatedAt`, binding
values, and counts are illustrative):

```
$ <binary> brief --json
{
  "schemaVersion": "delivery.result.v1",
  "runId": "run-example",
  "exitCode": 0,
  "timing": { "totalMs": 10 },
  "data": {
    "schemaVersion": "delivery.brief.v1",
    "generatedAt": "2026-10-31T00:00:00Z",
    "repository": {
      "state": "observed",
      "host": "github.com",
      "owner": "<owner>",
      "name": "<name>",
      "remoteName": "origin"
    },
    "surfaces": [
      {
        "id": "tracker",
        "title": "Tracker",
        "state": "observed",
        "counts": { "observed": 0, "unknown": 0, "total": 0, "omitted": 0 },
        "truncated": false,
        "reason": "observed"
      }
    ],
    "anchors": [
      {
        "group": "ready-to-merge",
        "state": "observed",
        "items": [],
        "truncated": false,
        "omitted": 0
      },
      {
        "group": "owner-gate-ages",
        "state": "observed",
        "items": [],
        "truncated": false,
        "omitted": 0
      }
    ],
    "placeholders": [
      { "capability": "typed-questions", "owningStory": "M1-S16", "state": "not-delivered" },
      { "capability": "gate-sla-states", "owningStory": "M1-S5", "state": "not-delivered" },
      { "capability": "lane-queue-engine", "owningStory": "M1-S17", "state": "not-delivered" }
    ],
    "truncation": []
  }
}
```

The `surfaces` array is abridged above; every run carries all nine ids in
fixed order. Human mode:

```
$ <binary> brief
<binary> brief  <owner>/<name>
ready-to-merge  observed  none approved
blocker-questions  typed-questions (M1-S16)  not-delivered
owner-gate-ages  observed  <ref> <n>d
gate-sla-states  M1-S5  not-delivered
tracker  observed  total <n> (<n> unknown)
changes-and-prs  observed  total <n> (<n> unknown)
ci  observed  total <n> (<n> unknown)
lanes-or-queue  not-delivered (engine-not-delivered)  lane-queue-engine (M1-S17)
providers  observed  total <n> (<n> unknown)
parked-work  observed  total <n> (<n> unknown)
```

## ERRORS

The brief adds no error identity. Collector unavailability is payload
data: the affected surface names its own evidence state (state word plus
reason). Only `fallback.invocation` and `fallback.internal` can fail the
command. The brief renders no `status.collector.<id>.unavailable`
identity (the family itself is the board's declared status-domain
identity, see board.md), and collector failure never projects to exit `2`.

## SEE ALSO

[status.md](status.md), [board.md](board.md), the current-truth
[Brief specification](../../../../../spec/features/feature-brief.md), and the
[status digest specification](../../../../../spec/features/feature-status-digest.md).
