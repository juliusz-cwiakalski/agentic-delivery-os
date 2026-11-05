# db(1)

Status: M0 shipped (M0-S11). Shipped behavior summarized.

## NAME

`db` - harness session-database admin: size, list, prune, reboot.

## SYNOPSIS

```
<binary> db size | list
<binary> db prune [--older-than <date>] [--dry-run]
<binary> db reboot
```

## DESCRIPTION

Admin for the harness session store. Dry-run by default; prune is
idempotent and never deletes a live session lock.

## OUTPUT

Text: store stats or prune plan. Envelope `data`: `size`, `sessions[]`
(id, updated, bytes, live), `prunePlan[]`.

## EXIT STATUS

0 ok; 1 invalid arguments; 2 store unreachable (classified).

## EXAMPLES

```
$ <binary> db prune --older-than 2026-10-01 --json
{
  "schemaVersion": 1,
  "runId": "r_01J8ZX9W7T",
  "exitCode": 0,
  "timing": { "started": "2026-11-18T10:40:00Z", "durationMs": 700 },
  "data": {
    "dryRun": true,
    "prunePlan": [
      { "session": "ses_01J7...", "updated": "2026-09-28", "bytes": 18340211, "live": false }
    ],
    "protectedLive": 3
  }
}
```

## ERRORS

`db.store-unreachable`, `db.live-lock-protected`.

## SEE ALSO

[doctor.md](doctor.md), [state.md](state.md)
