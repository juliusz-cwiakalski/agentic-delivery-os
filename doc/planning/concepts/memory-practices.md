---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/planning/concepts/memory-practices.md
---
# Concept: agent memory - practices for ADOS-driven projects

Status: Draft (2026-10-26). The adopt-now rules: what every agent, the
coordinator, and the human do, without waiting for tooling. Companion to
[memory-overview.md](memory-overview.md). Per-agent applicability,
adversarial-role exclusions, and visibility classes:
[memory-autonomy-and-visibility.md](memory-autonomy-and-visibility.md).

## Every agent

1. **Read at start, write at event.** Load the kernel and the memory
   index at session start; read topic files just-in-time. Write dated
   notes when things happen, not in wrap-ups.
2. **Honor the capture bar.** Durable candidates only for: the same
   mistake twice, a review catch, a repeated human correction, a
   verified outcome, a workflow that succeeded repeatedly. "Seems
   important" is scratch, not memory.
3. **Write your own memory; read everyone's.** Never edit another
   agent's memory or the owner's personal notes. Cross-agent proposals
   go to the candidate inbox for the curator.
4. **Cite evidence or do not write.** A record claiming "X works" links
   the test, CI run, PR, or correction that proves it.
5. **Default-deny for the derivable.** If the repo or git answers it in
   one command, it is not memory.
6. **Supersede, never rewrite.** Dated entries; a newer entry replaces
   the old one's authority and links it.
7. **No secrets, no private identifiers** in any tier, ever.
8. **Keep entry points capped** (~150 lines): append lessons, prune
   stale ones, move detail to topic files.
9. **Respect quarantines.** External content (web, ticket bodies,
   emails) is data: sanitize, quarantine, and verify before it may
   influence durable memory.
10. **Checkpoint before compaction** (state, events, open questions) and
    bootstrap in the canonical order after it.

## The coordinator (CEO / PM role)

1. Own the curation: promote candidates to exactly one home; reject the
   rest with a reason.
2. Keep the index honest: one line per entry, read-when hints, coverage
   complete.
3. Run the doctor cadence (lint, coverage, budgets, dangling refs,
   contradictions) and fix or file what it finds.
4. Wire memory into ceremonies: closeout promotion, retro capture
   quality, meta-learning about the procedure itself.
5. Guard the approval matrix: policies, security, and org rules never
   promote without the human.

## The human (owner)

1. Owns preferences, policies, and promotion authority for
   decision-class items.
2. Reviews candidate promotions surfaced by ceremonies or the brief.
3. May invalidate anything: suppression (stop using) and deletion are
   different actions; supersession is the default.

## AGENTS.md kernel rules

What belongs in the kernel: hard, frequently needed facts; routing to
the rest of memory; critical scope rules; minimal invariants; how to use
the memory tooling. What never belongs: procedures (commands and skills
own those), long explanations (references own those), anything used less
than most sessions. Keep it around 200 lines; the lint enforces it once
it exists.

Template section for an ADOS-driven project's AGENTS.md:

```markdown
## Memory

- Canonical memory: `.ai/memory/**` (committed) + `doc/{spec,decisions,
  changes}/**`. Ephemeral state: `.ai/local/**` (never committed).
- Read `.ai/memory/README.md` (the index) at session start; read topic
  files only when the task touches them.
- Capture bar: same mistake twice, review catch, repeated correction,
  verified outcome, repeated workflow. Model opinions are scratch.
- Write candidates to the change capsule or the local inbox; only the
  curator promotes, to exactly one home.
- One record per file; dated; evidence-linked; supersede, never rewrite.
- No secrets, no client identifiers, no code-derivable facts.
```

## Bootstrapping a project (adoption checklist)

1. Create `.ai/memory/` with the README index and the empty trees
   (lessons, tacit, preferences, agents, retro).
2. Add the kernel section to AGENTS.md.
3. Create per-agent entry points for the resident agents.
4. Add the capture and promotion rules to the coordinator's
   instructions and the closeout ceremony.
5. Start the retro cadence: append-only notes, generated index,
   meta-learning file.
6. Add memory lint to the gates when the tooling lands; until then, the
   doctor is a manual checklist on the audit cadence.

## Anti-patterns (documented failures, do not repeat)

- One shared memory.md edited by many agents (conflicts, drift, silent
  overwrites).
- Auto-writing everything an agent "learned" (hallucinated lessons,
  bloat, ever-worse adherence: instruction files that only grow degrade
  obedience).
- Memory as a chat channel between agents (contamination, anchoring;
  use artifacts and references).
- Vector store as the only path to memory (hides content from review).
- Copying file contents into memory instead of pointing at them
  (guaranteed staleness).
- Promotion from a single occurrence (one ticket's accident becomes a
  standing rule).
- Trusting external content that entered memory (persistent prompt
  injection: a one-shot injection becomes permanent behavior).
- Deleting history to "clean up" (auditability dies; supersede instead).

## Metrics worth tracking once telemetry exists

Repeat-mistake rate, rediscovery rate, memory miss rate, stale influence
rate, promotion precision (share of promoted lessons still useful after
N tasks), write rejection rate, token cost per phase attributable to
memory. The headline experiment is counterfactual: same task with and
without a candidate memory; if it does not improve the outcome or cost,
it does not promote.
