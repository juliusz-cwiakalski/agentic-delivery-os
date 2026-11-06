# status(1)

Status: delivered (M0-S6 shipped; M1-S10 attention-state expansion delivered).

## NAME

`status` - one bounded, ranked digest of the delivery world; the first
call of every session.

## SYNOPSIS

```
<binary> status [--repo <path>]... [--json]
```

## DESCRIPTION

Artifact-verified collectors render nine fixed sections in order:
tracker, changes and pull requests, CI, lanes or queue, providers, parked
work, ready-to-merge, spend, and blockers. Each section carries a closed
state (`observed`, `degraded`, `unknown`, `unavailable`, `not-delivered`),
bounded evidence, counts, and an explicit truncation marker.

Attention-state coverage groups and ranks findings by a closed
finding-code registry with per-code severity, so four red CI runs on the
declared primary branch render as one job (`ci.red-on-main` × 4), not
four. The tracker exposes tri-state hygiene assertions (epic membership,
story points, in-sprint), owner-gate ages and `slaState`, and parked
re-entry conditions. Ready-to-merge is a ranked action list that reuses
the queue-ready merge-ready/review-pending classification. The lane
attention-state vocabulary is declared while the section reports its
existing not-delivered gap; spend and typed blockers are named
not-delivered placeholders until their delivering stories land.

The command is read-only: at most three network reads (issues, pull
requests, check-runs for the checkout HEAD), one park fold, and one
configuration resolve. Partial collection is reported in-band, never
silent. There is no `--watch` flag; live subscription belongs to the
daemon story.

## OUTPUT

Text: one line per section in fixed order, then the attention rollup
(at most three severity-ordered finding groups, then `+N`). The optional
header appears only when the repository binding is observed and the SHA
resolved. Human output is at most 32 lines and 6144 UTF-8 bytes.

Envelope `data`: `schemaVersion`, `generatedAt`, `repository`, `summary`
(with per-state counts, `actionable`, `findingsTotal`, and
`placeholderSectionCount`), and `sections[]`. Each section carries `id`,
`title`, `state`, `evidence`, `counts`, `truncated`, its section-specific
items, and an optional `findings[]` of `{ code, severity, count,
members[], evidenceRef }`. Findings are identities, codes, and counts
only; members are never titles or payloads. A failed or unresolved read
emits no finding for its section.

## EXIT STATUS

0 digest rendered (degraded, unknown, unavailable, and not-delivered
sections are digest data and still exit 0); 1 rejected invocation
(`fallback.invocation`); 2 containment failure (`fallback.internal`).
The digest never exits 1 because a finding exists.

## EXAMPLES

```
$ <binary> status --json
{
  "schemaVersion": "delivery.result.v1",
  "runId": "run-01J8ZR8M6T",
  "exitCode": 0,
  "timing": { "totalMs": 42 },
  "data": {
    "schemaVersion": "delivery.status.v1",
    "generatedAt": "2026-11-18T09:00:12Z",
    "summary": {
      "sections": 9, "observed": 6, "degraded": 0, "unknown": 0,
      "unavailable": 0, "notDelivered": 3, "actionable": 12,
      "findingsTotal": 1, "placeholderSectionCount": 2
    },
    "sections": [
      { "id": "tracker", "state": "observed" },
      { "id": "ci", "state": "observed", "findings": [
        { "code": "ci.red-on-main", "severity": "high", "count": 4,
          "members": ["44827", "44828", "44829", "44830"],
          "evidenceRef": "44827" }
      ] },
      { "id": "ready-to-merge", "state": "observed", "items": [
        { "ref": "GH-301", "class": "merge-ready",
          "sourceRef": "feat/GH-301/status", "targetRef": "main-tools",
          "reviewState": "observed", "ciResult": "succeeded" }
      ] },
      { "id": "spend", "state": "not-delivered" },
      { "id": "blockers", "state": "not-delivered" }
    ]
  }
}
```

## ERRORS

Section failures are digest data, not command failures. Only
`fallback.invocation` (exit 1) and `fallback.internal` (exit 2) can fail
the command. No status-collector error identity is emitted by the
digest.

## SEE ALSO

[queue.md](queue.md), [blockers.md](blockers.md), [brief.md](brief.md)
