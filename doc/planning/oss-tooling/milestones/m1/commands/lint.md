# lint(1)

Status: M0 shipped (M0-S10); M1-S13 adds delivery-plan schema. Proposed
examples.

## NAME

`lint` - document conformance: pm-notes, delivery registry, plans.

## SYNOPSIS

```
<binary> lint <ref>
<binary> lint plan <ref>
```

## DESCRIPTION

Schema and format conformance at write time for pm-notes and the
delivery registry (M0) and the machine-readable delivery plan (M1-S13).
Verify is evidence against reality; lint is schema and format.

## OUTPUT

Text: per-document verdicts. Envelope `data`: `documents[]` (path,
verdict, errors[] with code and location).

## EXIT STATUS

0 conformant; 1 non-conformant (classified errors); 2 unreadable
(classified).

## EXAMPLES

```
$ <binary> lint GH-301 --json
{
  "schemaVersion": 1,
  "runId": "r_01J8ZX4S3P",
  "exitCode": 0,
  "timing": { "started": "2026-11-18T10:35:00Z", "durationMs": 55 },
  "data": {
    "documents": [
      { "path": "doc/changes/2026-11/.../chg-GH-301-pm-notes.yaml",
        "verdict": "valid", "errors": [] }
    ]
  }
}
```

## ERRORS

`lint.notes.malformed`, `lint.registry.malformed`,
`lint.plan.schema.invalid`.

## SEE ALSO

[plan.md](plan.md), [phase.md](phase.md), [verify-change.md](verify-change.md)
