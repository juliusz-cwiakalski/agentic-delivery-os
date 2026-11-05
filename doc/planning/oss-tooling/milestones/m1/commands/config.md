# config(1)

Status: M0 shipped (M0-S4). Shipped behavior summarized.

## NAME

`config` - print merged configuration; debug adds per-key provenance.

## SYNOPSIS

```
<binary> config [--debug] [--json]
```

## DESCRIPTION

Layered chain (built-in, system, user-global, project committed,
project local, environment, CLI flags); maps merge recursively, lists
replace; secrets environment-only. `config debug` names the layer,
file, and line behind every key.

## OUTPUT

Merged configuration as a JSON object (or annotated JSONC with
provenance comments in debug text mode).

## EXIT STATUS

0 ok; 1 malformed config (classified with code); 2 environment faults.

## EXAMPLES

```
$ <binary> config --debug --json | head -20
{
  "schemaVersion": 1,
  "runId": "r_01J8ZX1Q1N",
  "exitCode": 0,
  "timing": { "started": "2026-11-18T10:30:00Z", "durationMs": 40 },
  "data": {
    "harness": {
      "value": "opencode",
      "origin": { "layer": "project-committed", "file": "config.yaml (project committed layer)", "line": 3 }
    },
    "daemon.transport": {
      "value": "unix",
      "origin": { "layer": "built-in", "file": null, "line": null }
    }
  }
}
```

## ERRORS

`config.invalid` (fail closed, file and line named).

## SEE ALSO

[doctor.md](doctor.md)
