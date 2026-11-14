---
ados_distribution: redistributable
---

# Companion Instruction Memory Expectations Template

Template for the per-role memory expectations rendered into a project's installed companion instruction files — `.ai/agent/pr-instructions.md`, `.ai/agent/decision-instructions.md`, and `.ai/agent/code-review-instructions.md`. One template parameterized by companion role: render one block per file, replacing `<role>` with the file's role.

## Rendered content (per companion role)

- **Read own entry point.** The `<role>` role expects its agent entry point at `.ai/memory/agents/<role>/README.md` to be read at session start; everything else in the memory tree is read just-in-time, only when the task touches it.
- **Write own folder.** Memory writes stay inside `.ai/memory/agents/<role>/`; the role never edits another agent's memory folder.
- **No cross-agent memory edits.** Shared surfaces (`lessons/`, `tacit/`, the index) are consolidation-owned: propose changes through the promotion path instead of editing them.
- **The kernel is the authority.** The memory section of `AGENTS.md` states the read policy, capture bar, and write ownership; these expectations reference it and never restate it.

## Rendering rules

- Parameterize `<role>` per companion file — one block per file, with no duplicated capture-bar or promotion-path text anywhere in the block.
- Reference the `AGENTS.md` memory section rather than duplicating it.
- Append the block; do not restructure the host instruction file around it.
