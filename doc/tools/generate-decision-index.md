---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/tools/generate-decision-index.md
---
# generate-decision-index User Guide

> Version 1.0.0 | [Changelog](#changelog)

## Overview

`tools/generate-decision-index` is the **deterministic index generator** for
decision records. It reads the front matter of every record in
`doc/decisions/*.md` and emits a byte-stable `00-index.md` containing a
sortable table (DM-3) plus a generated **Health** subsection.

It runs on **stdlib only** (bash + `python3` + `jq`) — no `jsonschema`, no
`import yaml`, no network calls (DEC-4/DEC-14). It reuses the **same**
front-matter parser as `tools/validate-decision-record` (the shared
`tools/.lib/frontmatter.sh`) so the index and the validator parse records
identically.

It **never mutates decision records**; the only file it writes is
`doc/decisions/00-index.md` (F-4, DEC-9).

## Requirements

- `bash` >= 4
- `python3` (stdlib only; 3.14+ fine — no bundled `yaml` needed)
- `jq`
- `find`

No `pip install`. No network access.

## The DEC-15 health split (important)

The Health view is **split** so that calendar time can never trip the
committed-artifact drift check (AC-GH63-12):

| Finding | Kind | Where it appears |
|---------|------|------------------|
| Missing deciders (Accepted R2/R3 without `governance.decider`) | time-INDEPENDENT | Committed `00-index.md` **and** advisory stdout |
| Missing metrics (Accepted records lacking `links.metrics`) | time-INDEPENDENT | Committed `00-index.md` **and** advisory stdout |
| Future-field waivers (DEC-11) | time-INDEPENDENT | Committed `00-index.md` **and** advisory stdout |
| **Overdue reviews** (`review_date` in the past, or `last_updated` older than the 180-day horizon) | time-DEPENDENT | **Advisory stdout only** — NEVER written to `00-index.md` |

> **Note (RT2 M1):** the "missing metrics" dimension uses the front-matter
> `links.metrics` field (Accepted records lacking it are flagged). This is
> **distinct** from `tools/validate-decision-record`'s body `## Verification
> Criteria` heuristic (AC-GH63-6), which remains a separate, non-blocking
> validator signal.

The committed `00-index.md` is byte-stable for a fixed input set: regenerate it
today, next week, or next year and you get identical bytes (assuming the records
did not change). Overdue findings use today's date, so they are advisory only.

## Usage Examples

### Regenerate the index in place (default / write mode)

```bash
tools/generate-decision-index
# -> rewrites doc/decisions/00-index.md (table + time-independent health only)
```

### Dry-run (print committed index, no write)

Prints exactly what write mode would write — table + time-independent health,
**no** overdue findings. This is what the CI drift check uses.

```bash
tools/generate-decision-index --dry-run
```

### Summary (full advisory health, including overdue)

Prints the table plus the full health report — including time-DEPENDENT
overdue-review findings — to stdout. Never writes `00-index.md`.

```bash
tools/generate-decision-index --summary
```

### Point at a different decisions directory

```bash
tools/generate-decision-index --dry-run path/to/other/decisions/
```

## Flags

| Flag | Effect |
|------|--------|
| `--help` | Show usage and exit 0 |
| `--version` | Show version and exit 0 |
| `--dry-run` | Print the committed index to stdout (no write) |
| `--summary` | Print full advisory health report (incl. overdue) to stdout |
| `--verbose` | Increase log verbosity |

## Determinism and the drift check

The output is **byte-stable** for the same input set: records are sorted by type
(ADR < PDR < TDR < BDR < ODR) then numeric id, and formatting is fixed. Running
`--dry-run` twice produces identical bytes (`cmp`).

CI (Phase 7) enforces a **drift check**: regenerate the index and diff against
the committed `00-index.md`; any difference fails the gate. This means:

- After editing a decision record, run `tools/generate-decision-index` and commit
  the regenerated `00-index.md` alongside the record change.
- Never hand-edit `00-index.md` — your edits will be overwritten and flagged as
  drift.

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | success |
| 1 | validation / generation error |
| 2 | usage error |

## Changelog

- **1.0.0** (GH-63) — initial release: deterministic index table + Health
  subsection with the DEC-15 committed-vs-advisory split.
