# lint(1)

Status: M0 shipped (M0-S10); plan target shipped in GH-226 (M1-S13);
both-target divergence detection shipped in M4-S11 (GH-349).
Delivered contract.

## NAME

`lint` - document conformance: pm-notes, delivery registry, plans.

## SYNOPSIS

```
<binary> lint <ref> [--pm-notes] [--registry]
<binary> lint plan <ref>
```

## DESCRIPTION

Schema and format conformance at write time for pm-notes and the
delivery registry (M0) and the machine-readable delivery plan (M1-S13).
Verify is evidence against reality; lint is schema and format.

With both targets selected (`lint <ref> --pm-notes --registry`), the run also
compares the two surfaces once both conformance checks pass: for every phase the
ledger holds a transition for, the document's `completed` must equal the
registry fold's. The first disagreement is `lint.phases.divergent`, naming the
phase and both values; the rule reports and never repairs, writes nothing,
takes no fence, and reads no clock. A phase with no ledger history and a
document-only completion are out of scope, so `verify change` is unaffected.

## OUTPUT

Text: per-document verdicts. Envelope `data` for the plan target:
`changeRef`, `target` (`plan`), `documents[]` (path, verdict
`valid | invalid | unreadable`, errors[] with code, location, detail).
The pm-notes and registry targets keep their existing payloads.

## EXIT STATUS

0 conformant; 1 non-conformant (a classified finding, including
`lint.phases.divergent`); 2 unreadable (classified).

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

`lint.notes.malformed`, `lint.keys.missing`, `lint.variant.unknown`,
`lint.phases.incomplete`, `lint.target.missing`, `lint.phases.divergent`,
`lint.document.unreadable`, and the shared plan identities
`plan.schema.invalid`, `plan.tier.unknown`, `plan.format.legacy-markdown`,
`plan.artifact.missing`.

## SEE ALSO

[plan.md](plan.md), [phase.md](phase.md), [verify-change.md](verify-change.md)

## HELP

`<binary> lint --help` prints usage, options, at least one example, exit codes,
and a see-also pointer. Root `<binary> --help` and `<binary> --version` are
self-description only: zero state, network, git, or configuration reads and
zero writes. The executable is a non-installed Bun bin; see the
[man page](../man-page.md).

