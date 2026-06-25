---
# GENERATED FILE — DO NOT EDIT DIRECTLY.
# Source of truth: .opencode/command/decision-index.md
# Regenerate with: scripts/build-claude-plugin.sh
# If behavior must change, edit the source file above and rebuild.
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
# source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/.opencode/command/decision-index.md
name: decision-index
description: Regenerate the decision-record index (doc/decisions/00-index.md) and Health report via tools/generate-decision-index. Read-only w.r.t. records — mutates only 00-index.md.
model: sonnet
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - WebFetch
  - "mcp__*"
---

<purpose>
Implement the `/decision-index` command. It is a thin, **read-only w.r.t. records** wrapper around `tools/generate-decision-index` that regenerates the deterministic decision-record index (`doc/decisions/00-index.md`) — the DM-3 table plus the generated Health subsection.

It mutates **only** `doc/decisions/00-index.md` and **never** edits, stages, or commits any decision record (F-5, DEC-9, AC-GH63-11).

User invocation:

    /decision-index [mode]

where `[mode]` is optional and selects the generator behavior:

- *(omitted)* — **write mode**: regenerate `doc/decisions/00-index.md` in place (table + time-INDEPENDENT health only). This is the default after editing a record.
- `dry run` — print the committed index to stdout without writing (used by the CI drift check).
- `summary` — print the full advisory health report including time-DEPENDENT overdue-review findings to stdout (never writes).

Typical use: invoke after `/write-decision` or `/review-decision`, or whenever a decision record is added/edited, to keep the index current and surface governance findings (missing deciders, missing metrics, overdue reviews).
</purpose>

<inputs>
- mode='$ARGUMENTS' (optional): `dry run` | `summary` | *(empty = write mode)*.

<rawArguments>
$ARGUMENTS
</rawArguments>
</inputs>

<process>
1. Resolve the repository root (the directory containing `tools/generate-decision-index`).
2. Map the requested mode to the generator flag:
   - empty → write mode (no flag): `tools/generate-decision-index`
   - `dry run` → `tools/generate-decision-index --dry-run`
   - `summary` → `tools/generate-decision-index --summary`
3. Run the generator via the bash tool (delegate to `@runner` if the output is large). It runs on **stdlib only** (bash + python3 + jq); no network, no pip install.
4. Capture the exit code and report it. Non-zero means a generation/validation error — surface it and stop.
5. For **write mode**: the generator rewrites `doc/decisions/00-index.md` in place. Do NOT separately stage or commit unless the caller asks — the caller (or the delivery process) decides when to commit the regenerated index alongside the record change.
6. For **dry run / summary**: present the stdout output to the caller; no files are written.
</process>

<safety>
- **Read-only w.r.t. decision records.** The only file this command may cause to change is `doc/decisions/00-index.md` (the generated index). It MUST NOT edit, move, or delete any `doc/decisions/<TYPE>-<number>-*.md` record (DEC-9, AC-GH63-11).
- The generator itself never mutates records; `00-index.md` is excluded from the record set it scans.
- No network calls (NFR-1).
- Time-DEPENDENT overdue findings are **advisory only** (`summary`/stdout) and are NEVER written to the committed `00-index.md`, so calendar time cannot trip the CI drift check (DEC-15, AC-GH63-12).
</safety>

<output_contract>
Report to the caller:

- **Status**: `REGENERATED` (write mode) | `PRINTED` (dry-run/summary) | `ERROR`
- **Mode**: write | dry-run | summary
- **Records indexed**: count from the generator's `[INFO]` line
- **Health findings** (time-independent, present in all modes): missing deciders, missing metrics, future-field waivers
- **Overdue reviews** (advisory, `summary` mode only): count + record ids
- **Exit code**: the generator's exit code
- **Next step**: e.g., "commit the regenerated 00-index.md alongside your record change" / "address flagged findings, then re-run" / "index is up to date"
</output_contract>

<constraints>
- Mutate only `doc/decisions/00-index.md`; never decision records.
- Do not auto-commit unless explicitly instructed by the caller.
- Do not use the network.
- Preserve the existing license-header block at the top of `00-index.md` (the generator does this automatically).
</constraints>
