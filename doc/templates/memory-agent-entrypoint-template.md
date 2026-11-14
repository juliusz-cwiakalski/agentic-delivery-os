---
ados_distribution: redistributable
---

# Agent Memory Entry Point Template

Template for one agent's memory entry point — instantiated as `.ai/memory/agents/<agent>/README.md`, once per resident agent role. One generic template parameterized by role: copy it per role and replace `<agent>` with the role name.

## Instantiated file

`.ai/memory/agents/<agent>/README.md`

## What the entry point is

This file is the only memory file the `<agent>` role always reads at session start. It states that role's capture bar and read/write policy; everything else in the tree is read just-in-time from the memory index (`.ai/memory/README.md`).

## Content the instance carries

- **Read policy.** Your own entry point (this file) is the only memory file always read at session start. Read the memory index and topic files just-in-time, only when the task touches them; read other agents' memory the same way. Append at event time, not in wrap-ups.
- **Capture bar.** Write a durable entry only for: the same mistake twice, a review catch, a repeated human correction, a verified outcome (CI, review, or merge verdict), or a workflow that succeeded at least twice with likely recurrence. Routine success never qualifies. Everything else is scratch in `.ai/local/**` (never committed). Every entry links its evidence: PR, CI run, test, review comment, or correction. Secrets and one-command repo or git facts are never memory.
- **Write ownership.** Write only inside your own folder (`.ai/memory/agents/<agent>/`) and never edit another agent's memory. Shared surfaces (`lessons/`, `tacit/`, the index) are consolidation-owned: route candidates through the promotion path instead of editing them.
- **Routing.** The `AGENTS.md` memory section is the authority for the conventions; this entry point mirrors the capture bar and read/write policy for the role and routes to the index for everything else.

## Record properties

Entries are dated, evidence-linked, and supersede-never-rewrite: a replacing entry links the entry it replaces and the old entry is marked superseded — never rewritten or deleted.

## Budget

Keep the entry point at or under 150 lines. Past ~50 lines with distinct areas emerging, split into topic files inside your own folder and leave one-line pointers; topic files load on demand.
