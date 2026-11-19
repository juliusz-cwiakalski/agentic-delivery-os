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

## CONFIGURATION CONSUMED BY DISPATCH

The typed dispatch lane adds no configuration key and changes no default. It
consumes four delivered policy values as data:

| Key | Default | Use |
|---|---|---|
| `lane.restart-budget` | `3` | The in-process restart bound. A non-positive value composes no restart policy, so the loop never auto-restarts. |
| `lane.liveness-interval` | `30000` ms | The liveness evaluation cadence while evidence collection is pending. |
| `coordinator.kill-grace` | `20000` ms | The terminate grace: TERM first, KILL only after the grace. |
| `queue.lease-ttl` | `90000` ms | The lease staleness bound and the ceiling on the admission fence wait. |

`coordinator.restart-budget` governs coordinator supervision and is not consumed
by dispatch. The terminate grace reuses `coordinator.kill-grace` rather than
duplicating a signalling constant.

## ERRORS

`config.invalid` (fail closed, file and line named).

## SEE ALSO

[doctor.md](doctor.md)
