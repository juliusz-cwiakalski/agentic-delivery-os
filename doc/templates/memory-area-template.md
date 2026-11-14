---
ados_distribution: redistributable
---

# Memory Area Template

Template for a shared memory area README — instantiated as `.ai/memory/lessons/README.md` and `.ai/memory/tacit/README.md`, materializing the two areas in git. One template parameterized by area: copy it once per area, replacing `<area>` with `lessons` or `tacit`.

## Instantiated files

- `.ai/memory/lessons/README.md` — the lessons area.
- `.ai/memory/tacit/README.md` — the tacit area.

## Purpose per area

- `lessons` — durable operational lessons: what went wrong, what fixed it, what to do differently. This area is the promotion-handoff target for accepted lesson candidates.
- `tacit` — durable heuristics and working judgment: how decisions get made and why. This area is the promotion-handoff target for accepted tacit candidates.

## Discipline

- **Seeded empty.** The area carries structure and conventions, not records; records arrive through promotion, never pre-seeded.
- **Append at event time.** New records are appended with a date and an evidence link; a replaced record is superseded (linked from its replacement), never rewritten in place or deleted.
- **Consolidation-owned.** Shared surfaces are edited by consolidation only: agents propose candidates through the promotion path, and the curator merges, supersedes, prunes, and rebuilds. Past ~50 lines, distinct areas split into topic files with one-line pointers left behind.

## Routing

The capture bar, read policy, and write ownership live in the `AGENTS.md` memory section and the agent entry points; the promotion path lives in the coordinator instructions. This README routes to them and does not restate them.
