---
ados_distribution: redistributable
---

# Coordinator Memory Wiring Template

Template for the agent-memory block rendered into a project's installed coordinator instructions (`.ai/agent/pm-instructions.md`). It gives the coordinating role the capture bar, the promotion path, and the curation mandate.

## Rendered content

- **Capture bar.** A durable memory entry requires one of: the same mistake twice, a review catch, a repeated human correction, a verified outcome (CI, review, or merge verdict), or a workflow that succeeded at least twice with likely recurrence. Everything else is scratch in `.ai/local/**` (never committed). Every entry links its evidence: PR, CI run, test, review comment, or correction. Routine success never qualifies.
- **Promotion path.** Route each accepted candidate to exactly one home: operational lessons to `.ai/memory/lessons/`, heuristics to `.ai/memory/tacit/`, and verified facts, decisions, norms, and repeated workflows as handoffs to the owning process. Capture never writes shared surfaces directly; the coordinating role owns the routing.
- **Curation mandate.** The coordinating role owns consolidation: validate evidence, dedupe, supersede (never rewrite), prune stale entries with a recorded reason, and rebuild the index (`.ai/memory/README.md`) when growth requires topic-file splits. Shared surfaces are consolidation-owned.
- **Budgets.** Agent entry points stay at or under 150 lines; the memory index at or under 200; split topic files past ~50 lines with one-line pointers left behind.

## Rendering rules

- Append this block to the coordinator instructions; reference the `AGENTS.md` memory section as the authority — never restate it wholesale.
- Keep the block inside the coordinator file's own size budget.
- Conventions only: no ceremony, command, or automation ships with this wiring.
