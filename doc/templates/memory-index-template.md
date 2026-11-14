---
ados_distribution: redistributable
---

# Memory Index Template

Template for a project's memory index — instantiated as `.ai/memory/README.md`, the entry point of the committed memory tree at `.ai/memory/**`.

## Instantiated file

`.ai/memory/README.md`

## What the index is

The index is the map of the memory tree: what exists, when to read it, and where new candidates go. It is the always-current table of contents for project memory — not a memory record itself. Agents read it just-in-time; only their own agent entry point is read at every session start.

## Tree layout the index describes

- `.ai/memory/README.md` — this index (the entry-point map).
- `.ai/memory/agents/<agent>/README.md` — one entry-point README per resident agent role; the only memory file that agent always reads at session start.
- `.ai/memory/lessons/` — operational lessons promoted from accepted candidates.
- `.ai/memory/tacit/` — heuristics and working judgment promoted from accepted candidates.

The scaffold is seeded empty: structure and conventions, not records. Ephemeral session state and scratch stay at `.ai/local/**` and are never committed.

## Sections the instance carries

- **Read-when hints.** One line per area stating when to read it (own entry point at session start; index and topic files just-in-time; append at event time, not in wrap-ups).
- **Coverage honesty.** One line per entry; never claim coverage that does not exist; stale rows are pruned with a recorded reason by consolidation, not by individual agents.
- **Routing.** The capture bar, read policy, and write ownership live in the `AGENTS.md` memory section and the agent entry points; the promotion path lives in the coordinator instructions. This index routes to them and never restates them.

## Budget

Keep the index at or under 200 lines. Past ~50 lines with distinct areas emerging, split into topic files inside the tree and leave one-line pointers behind; topic files load on demand.
