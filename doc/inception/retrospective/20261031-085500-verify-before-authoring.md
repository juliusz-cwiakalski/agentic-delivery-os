---
status: final
created: 2026-10-31T08:55:00+01:00
phase_scope: 1
topic: verify existing artifacts before authoring new ones
outcome: repeat
---

# Retrospective: spec-coverage verification prevented a duplicate spec

## What happened

Phase 1's legacy duty includes seeding feature specs from existing
behavior. Counting feature-spec files against the nine closed M0 stories
suggested one missing (S16 interim mitigations, GH-185). Before drafting a
replacement, the delivery commit was inspected directly.

## What went well

The GH-185 commit showed the story reconciled existing feature specs instead
of adding a new file, which is the correct shape for a docs-and-config-only
change. Result: no duplicate spec authored, coverage recorded as verified
with evidence, and a false gap avoided in the registers.

## Improvement pattern to repeat

When an artifact count suggests a gap, verify against the delivery commit
(diff stat) before authoring anything. Counts are a screening signal; the
commit is the truth. This applies to every remaining phase and to phase 6
consistency checks.
