# retro(1)

Status: M1 planned (M1-S8). Proposed contract.

## NAME

`retro` - the retro evidence pipeline: collect, report.

## SYNOPSIS

```
<binary> retro collect [--level <name>]
<binary> retro report [--level <name>] [--json]
```

## DESCRIPTION

Runs retro levels on demand per concepts/retrospectives.md. Evidence
comes from the independent sidecar (a collector identity delivery
agents cannot write; append-only; pipeline-truth checks). Output
survives a malformed entry without data loss.

## OUTPUT

Text: level report. Envelope `data`: `level`, `findings[]`,
`followThrough[]` (artifact-verified), `evidenceRefs[]`.

## EXIT STATUS

0 collected or reported; 1 malformed evidence entry (classified,
partial output preserved); 2 evidence store unreachable.

## EXAMPLES

```
$ <binary> retro report --level change --json
{
  "schemaVersion": 1,
  "runId": "r_01J8ZY6A3X",
  "exitCode": 0,
  "timing": { "started": "2026-11-18T11:10:00Z", "durationMs": 950 },
  "data": {
    "level": "change",
    "findings": [
      { "kind": "win", "text": "atomic phase commits eliminated hand-crafted messages" }
    ],
    "followThrough": [
      { "action": "port park-exactness check to docs", "verdict": "done", "artifact": "PR 344" }
    ],
    "evidenceRefs": ["ev-2211", "ev-2263"]
  }
}
```

## ERRORS

`retro.evidence.malformed-entry` (classified; no data loss),
`retro.evidence.denied` (delivery-agent identity refused).

## SEE ALSO

[closeout.md](closeout.md), [spend.md](spend.md)
