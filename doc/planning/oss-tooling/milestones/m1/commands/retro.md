# retro(1)

Status: Delivered M1-S8 (GH-232). Implemented contract.

## NAME

`retro` - the retro evidence pipeline: collect, report.

## SYNOPSIS

```
<binary> retro collect [--level <name>]
<binary> retro report [--level <name>] [--json]
```

## DESCRIPTION

Runs retro levels on demand per concepts/retrospectives.md. Evidence
comes from the independent sidecar: a separate append-only artifact
family a delivery agent cannot write, keyed-chain verified on every
read, with collector trace ids, collection windows, and pipeline-truth
checks. Malformed entries classify in-band with every valid entry
preserved. The validated retro registry declares levels R1-R6; only
`change` (R1) is implemented, and an omitted `--level` defaults to it.
A declared-but-unimplemented level refuses with a hint naming its
owning story. A collect with no eligible uncollected target is an
explicit exit-0 `no-target` success, not a vacuous run.

Evidence export is a bounded library/engine surface in M1; the command
surface carries no export verb.

## OUTPUT

Collect `data`: `level`, `outcome` (`collected` | `no-target`),
`selection`, `counts`, and (for a collected run) `runId` and `truth`.
Report `data`: exactly `level`, `findings[]`, `followThrough[]`, and
`evidenceRefs[]`. Findings carry `kind`, `text`, and evidence refs;
follow-through entries carry `action`, `verdict` (`verified` |
`unverified` | `unknown`), and an optional artifact ref.

## EXIT STATUS

0 collected, reported, or an explicit `no-target` collect; 1 malformed
evidence entry, a detected chain break (sidecar or consumed audit
domain), a vacuous run, or an input/permission refusal; 2 evidence
store unreachable (torn store, missing key material) or a write refused
outside the collector seam.

## EXAMPLES

```
$ <binary> retro report --level change --json
{
  "schemaVersion": "delivery.result.v1",
  "runId": "r_01J8ZY6A3X",
  "exitCode": 0,
  "timing": { "totalMs": 950 },
  "data": {
    "level": "change",
    "findings": [
      { "kind": "retro-note", "text": "atomic phase commits eliminated hand-crafted messages", "evidenceRefs": ["ev-2211"] },
      { "kind": "truth-check", "text": "dangling evidence ref ev-2263", "evidenceRefs": [] }
    ],
    "followThrough": [
      { "action": "port park-exactness check to docs", "verdict": "verified", "artifactRef": "PR 344" }
    ],
    "evidenceRefs": ["ev-2211", "ev-2214"]
  }
}
```

## ERRORS

`retro.evidence.malformed-entry` (classified in-band; valid entries
preserved), `retro.evidence.tamper-flagged` (a keyed chain failed
verification; altered records are never served as verified),
`retro.truth.vacuous-run` (the collection executed and produced zero
collector records), `retro.evidence.denied` (a write outside the
collector seam was refused). Store-level damage reuses the existing
`state.store.torn`, `state.keys.missing`, and `state.permission.denied`
rows with their delivered projections.

## SEE ALSO

[closeout.md](closeout.md), [spend.md](spend.md), [state.md](state.md)

## HELP

`<binary> retro --help` prints usage, options, at least one example, exit codes,
and a see-also pointer. Root `<binary> --help` and `<binary> --version` are
self-description only: zero state, network, git, or configuration reads and
zero writes. The executable is a non-installed Bun bin; see the
[man page](../man-page.md).

