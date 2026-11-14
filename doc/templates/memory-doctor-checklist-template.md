---
ados_distribution: redistributable
---

# Memory Doctor Checklist Template

Template for the manual memory-health checklist installed into a bootstrapped project. Documentation only: it prescribes an audit cadence and performs nothing — no script, gate, or automation ships with it. The checklist stays manual until memory lint lands in the quality gates (GH-301); when that tooling lands, it replaces this checklist.

## Cadence

Run the audit per retro (after each retrospective) or on a periodic cadence the project fixes (for example monthly). Findings are fixed or filed as retro notes.

## The six audit areas

1. **Index coverage.** Every record in the tree has an index row (`.ai/memory/README.md`), and the index claims no coverage it lacks.
2. **Budget caps.** Agent entry points at or under 150 lines; the memory index at or under 200; the `AGENTS.md` memory section around 200 lines or fewer; oversized files split into topic files with one-line pointers left behind.
3. **Dangling references.** Every pointer — index rows, record links, replacement links — resolves to an existing file or entry.
4. **Contradictions.** No two records give conflicting guidance; conflicts resolve by evidence and current repo or spec truth, with the losing record superseded, never rewritten.
5. **Derivable content.** Nothing is stored that the repository or a single git or repo command answers; derivable entries are pruned with a recorded reason.
6. **Secret-pattern scan.** No secrets, tokens, credentials, or private identifiers in any memory location; scan for credential patterns before promoting or indexing anything.

## Rules of engagement

- The audit reads; it does not modify shared surfaces directly. Fixes route through the promotion path (consolidation-owned) or the owning agent's own folder.
- Record the audit outcome as a retro note (append-only, dated, evidence-linked).
