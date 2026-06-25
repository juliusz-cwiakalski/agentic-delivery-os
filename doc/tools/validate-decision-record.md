---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/tools/validate-decision-record.md
---
# validate-decision-record User Guide

> Version 1.0.0 | [Changelog](#changelog)

## Overview

`tools/validate-decision-record` is the **machine-enforcement layer** for
decision-record quality. It turns the invariants that GH-46 established
(rigor-aware required fields, lifecycle validity, constraint/driver discipline)
into actionable, exit-coded failures so a malformed record is caught at PR time
instead of drifting silently.

It runs on **stdlib only** (bash + `python3` + `jq`) — no `jsonschema`, no
`import yaml`, no `shellcheck`, no network calls (DEC-4/DEC-14). It reuses the
shared front-matter parser with its sibling `tools/generate-decision-index`
(plan task 4.2) so both tools parse records identically.

The declarative contract is `schemas/decision-record-frontmatter.schema.json`
(draft 2020-12); this validator encodes the same rules **imperatively**, and a
schema-vs-validator coverage check (`--coverage`) keeps the two coupled
(AC-GH63-15).

## Requirements

- `bash` >= 4
- `python3` (stdlib only; 3.14+ fine — no bundled `yaml` needed)
- `jq`
- `grep`, `awk`

No `pip install`. No `jsonschema`. No `shellcheck`. No network access.

## Installation

No installation required — invoke from the repo root:

```bash
tools/validate-decision-record doc/decisions/ADR-0001-decision-making-framework.md
```

This is a **repo-internal delivery tool**; it lives in the repository it checks,
so its version is `git HEAD`. It intentionally **omits the automatic network
version-check** mandated by `doc/guides/tools-convention.md` (DEC-14 exception).

## Usage Examples

### Validate a single record (default: front matter only — DEC-16)

```bash
tools/validate-decision-record doc/decisions/ADR-0001-decision-making-framework.md
# exit 0 on success; exit 1 on a hard failure; warnings go to stderr (non-blocking)
```

### Validate the whole corpus

```bash
tools/validate-decision-record doc/decisions/
```

### Non-destructive migration lint (warns; NEVER rewrites)

```bash
tools/validate-decision-record --lint doc/decisions/ADR-0001-decision-making-framework.md
```

### Validate a planning-summary artifact (explicit `--summary`; SD-3)

```bash
tools/validate-decision-record --summary tools/.tests/fixtures/planning-summary/generic-summary.json
```

Planning-summary validation is **not** CI-gated over live docs (zero instances
persist under `doc/`); it is invoked on demand and proven by synthetic fixtures.

### Schema-vs-validator coverage summary (AC-GH63-15)

```bash
tools/validate-decision-record --coverage
# reports 0 uncovered schema rules (non-zero exit if any rule lacks a fixture)
```

### Dry run

```bash
tools/validate-decision-record --dry-run doc/decisions/
```

Validation is read-only by design; `--dry-run` prints a `[DRY-RUN]` marker.

## Configuration

No configuration directory is required (the tool is read-only and makes **no**
network calls, so it does not maintain `~/.ai/...` state). Set `VERBOSE=true`
for debug output.

## CLI Reference

```
validate-decision-record [OPTIONS] [PATH...]
validate-decision-record --summary [OPTIONS] <summary.json>...
validate-decision-record --coverage [OPTIONS]
```

| Option | Description |
|--------|-------------|
| `-h, --help` | Show help and exit |
| `-V, --version` | Show version and exit |
| `-n, --dry-run` | `[DRY-RUN]` marker; read-only (no writes ever) |
| `-v, --verbose` | Debug logging |
| `--summary` | Validate planning-summary JSON artifact(s) instead of record front matter |
| `--lint` | Non-destructive migration-lint mode (warns on legacy/unclassified; never rewrites) |
| `--coverage` | Emit schema-vs-validator coverage summary and exit |

| Exit code | Meaning |
|-----------|---------|
| 0 | Success (heuristics may emit non-blocking `[WARN]`/`[HEURISTIC]`) |
| 1 | One or more hard validation failures |
| 2 | Usage error |
| 7 | Filesystem error |

## Enforced rules (§28.3 disposition)

### IN-SCOPE HARD-FAIL cases (non-zero exit; AC-GH63-5)

| # | Case | Rule enforced |
|---|------|---------------|
| 1 | invalid record type | `decision_type` ∈ {adr,pdr,tdr,bdr,odr} |
| 2 | invalid status | `status` ∈ {Proposed, Under Review, Accepted, Deprecated, Superseded} |
| 3 | impossible lifecycle transition / supersedes inconsistency | `status` internally consistent with DM-5; `Superseded` requires non-empty `links.superseded_by`; `Accepted` is terminal |
| 4 | missing owner | `owners` present with minItems 1 |
| 5 | missing decider for Accepted R2/R3 | `governance.decider` non-null when `status=Accepted` AND `rigor ∈ {R2,R3}` |
| 6 | missing decision date for Accepted | `decision_date` non-null when `status=Accepted` |
| 8 | same factor as both constraint and driver | planning-summary `hard_requirements ∩ decision_drivers = ∅` |
| 10 | R3 without review | `governance.reviewers` non-empty when `status=Accepted` AND `rigor=R3` (acceptance-gated, DEC-12) |

### BEST-EFFORT HEURISTICS (non-blocking `[WARN]`/`[HEURISTIC]`, exit 0; AC-GH63-6)

| # | Case | Behavior |
|---|------|----------|
| 9 | non-negotiable-constraint violation in chosen option | `[HEURISTIC]`/`[WARN]` from planning-summary compliance data |
| 12 | accepted decision without verification criteria | `[HEURISTIC]` warning when an Accepted record body lacks a non-empty `## Verification Criteria` |

These are **heuristics, not structural guarantees**. A failing check never fails
the build (DEC-10/DEC-13); a future `--strict` mode (D-5) is deferred.

### DEFERRED cases (documented, NOT enforced; AC-GH63-7)

| # | Case | Owning sibling |
|---|------|----------------|
| 7 | recommendation copied into final decision without authority | GH-64 (body-content rec/decision separation) |
| 11 | R3 without evidence verification | GH-65 (evidence ledger / source verification) |
| 13 | expired waiver | future waiver/expiry field (likely GH-65) |
| 14 | modification of immutable accepted rationale without supersession | GH-64 (snapshot/diff machinery) |

## Backward compatibility

`classification` is optional. When absent, rigor defaults to **R2** (DM-4) and
the record stays valid — never rejected for being un-classified. The migration
linter (`--lint`) warns on legacy shapes and **never rewrites** records (NFR-2).

## Troubleshooting

- **`front matter failed to parse`** — the record uses a YAML construct outside
  the focused subset (nested maps, block/flow sequences, scalars,
  null/true/false, quoted strings). Simplify the front matter to the subset.
- **`filename does not start with the id`** — the file must be named
  `<TYPE>-<zeroPad4>-<slug>.md` matching the `id` field.
- **Accepted R3 rejected for missing reviewers** — `governance.reviewers` must be
  non-empty **only when** `status=Accepted` AND `rigor=R3` (DEC-12). A Proposed
  R3 with empty reviewers (e.g. ADR-0001) is valid.

## Related

- Declarative schema: [`schemas/decision-record-frontmatter.schema.json`](../../schemas/decision-record-frontmatter.schema.json)
- Index generator: [`tools/generate-decision-index`](generate-decision-index.md) — regenerates `doc/decisions/00-index.md` (**`00-index.md` is generated**, not hand-maintained)
- Template: [`doc/templates/decision-record-template.md`](../templates/decision-record-template.md)

## Changelog

### 1.0.0 (2026-06-25)
- Initial release: stdlib-only front-matter + cross-field + lifecycle validator;
  planning-summary validation via `--summary`; migration lint via `--lint`;
  schema-vs-validator coverage via `--coverage` (GH-63).
