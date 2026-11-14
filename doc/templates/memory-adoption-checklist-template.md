---
ados_distribution: redistributable
---

# Memory Adoption Checklist Template

Template for the manual adoption checklist shipped in the installed set. Projects bootstrapped before the memory conventions landed receive the new templates through content sync, but `AGENTS.md` and the agent-instruction files are project-specific and are never auto-updated: the owner adopts the learning loop by hand. No retrofit automation exists or ships.

## Adopt the tree scaffold

1. Create `.ai/memory/` with exactly this committed set: the index at `.ai/memory/README.md`, one entry-point README per resident agent role at `.ai/memory/agents/<agent>/README.md` (from `doc/templates/memory-agent-entrypoint-template.md`), and the two shared areas `.ai/memory/lessons/` and `.ai/memory/tacit/` (from `doc/templates/memory-area-template.md`) — seeded empty. Do not provision additional areas.
2. Keep ephemeral session state outside the committed tree at `.ai/local/**` (git-ignored).

## Adopt the kernel section

3. Render the memory section into the project's `AGENTS.md` from `doc/templates/memory-kernel-section-template.md` (all twelve content classes, no record-schema fields, ~200-line budget).

## Adopt the instruction wiring

4. Append the coordinator memory block from `doc/templates/memory-coordinator-wiring-template.md` to the project's coordinator instructions (`.ai/agent/pm-instructions.md`).
5. Add the per-role expectations from `doc/templates/memory-instruction-expectations-template.md` to each companion instruction file (`.ai/agent/pr-instructions.md`, `.ai/agent/decision-instructions.md`, `.ai/agent/code-review-instructions.md`), parameterized per role.

## Adopt the conventions

6. Install the retro-note conventions from `doc/templates/memory-retro-notes-template.md` and the manual doctor checklist from `doc/templates/memory-doctor-checklist-template.md`; fix the audit cadence the project will run.

## Further reading

The upstream repository (https://github.com/juliusz-cwiakalski/agentic-delivery-os) publishes the source practices narrative. The installed convention set above is self-contained: it requires nothing beyond itself, and the published reference is optional further reading only.
