---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://www.x.com/juliusz)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/planning/concepts/structured-change-artifacts/08-migration.md
---
# 08. Migration: tickets, pilot, metrics

Status: governed by `14-review-decisions.md` (decisions 4, 5, 10, 16, 17, 21, 26, 29, 31, 36
and 40) and by `17-roadmap.md`.

## Principles

- **Every ticket delivers value alone.** A ticket is worth merging on its own, and stopping
  after any of them leaves Jaiship in a consistent state (`17-roadmap.md`).
- **Measure on real changes.** A pilot on one change of each shape, against a baseline taken
  with the same method.
- **Read every shape, write the current one.** A new version reads what the previous version
  wrote, and writes only its own shape.
- **One process change at a time.** A ticket changes the write path, the read path or the
  shape of a change, and never two of them. Do not change the artifacts and the agents in
  the same slice: a failure must be attributable to one cause.
- **No schema ships without the bundle command.** The token win is in the read path; a
  schema on its own moves nothing.

## The slices

The slices are the six tickets of `17-roadmap.md`, T1 to T6, in its order and under its rule
that any prefix is consistent. Delivery is one epic with multiple pull requests, and T6 can
be parked without loss to the others. No prefix loses a check: until T4 the readiness gate
keeps running on every shape, and T4 is what limits the reader to flagged and phased changes
and gives a light change the coder as its first reader. The check matrix of each prefix is in
`17-roadmap.md`. This file adds what a ticket cannot hold on its own: the pilot, the metrics,
the compatibility rules, the two recorded departures from the principles above, and the
rollback of each ticket.

## The pilot

Two stages (decision 17; Q27 and Q28).

1. **One change of each shape.** A light, a flagged and a phased change, none of them a
   foundation ticket, delivered through T1 to T5. Before the surface map is frozen, past
   diffs are replayed against draft maps and the flagged share is reported.
2. **The next ten to twenty changes of different shapes.** After each one: a retrospective,
   then a tuning pass. Tuning does not end with the pilot. Retrospectives across the
   repositories delivered with Jaiship continue it.

The baseline is the set of changes of the same shape, measured with the method of
`10-evidence.md`; the study's medians are in `18-delivery-study.md`. Each pilot change
measures input tokens per 1k changed lines, read amplification, the bundle miss rate, reopens
per ticket, rounds per gate, edits after review, artifact lines per change, hand-edit
incidents, and cost per role, phase and gate (`jaiship change cost`).

The retrospective reads the events and the host-local fetch records, and proposes: a section
to add to or remove from a role's mandatory set; a correction to the surface map, landed as a
normal repository change; a warning line to reset; a target to re-size. Once T1 has measured
ten changes, T2 to T5 are re-sized from what it shows.

The decision after each stage is to continue, adjust or stop. Twenty percent fewer input
tokens is enough to continue. The kill criteria are in `01-analysis.md`.

## The metrics

Each ticket has one numeric criterion. It is the one in `17-roadmap.md`, with the figures it
rests on and the measures read beside it.

| Ticket | Numeric criterion | Read from |
|---|---|---|
| T1 | Zero artifact-caused verification failures over the first ten changes, against 1 in the measured lane. The cost of a change reads correctly after its merge and the removal of its worktree | lint and verify; `change cost` |
| T2 | Artifact lines per change fall by at least half: the study's medians of 461 lines for a light change and 3,470 for a change with the full lifecycle become 230 and 1,735 or less. Beside it: the tool-written share of artifact changes, 95 percent or more after the pilot | the change folder; the commit trailers |
| T3 | Read amplification of 5 times the artifact size or less, from about 35x. Beside it: the bundle miss rate, 10 percent or less after two iterations; input tokens per 1k changed lines, about 397k to 250k or less | read tool counts; the host-local store; the session store |
| T4 | Zero review rounds that follow a round without a material finding. Beside it: proposed flags removed without a reason, 0 | the events |
| T5 | Every criterion has a recorded run on the merge candidate: 100 percent | the obligation statuses |
| T6 | Conflict predictions checked against what actually collided: at least 80 percent right | `change audit`; the retrospective |

## Compatibility and migration

Decision 40 states the rules. They are acceptance criteria of T2.

- **Read every shape, write the current one.** A new version reads every shape the previous
  one wrote and writes only the current one.
- **One new shape.** The contract is the only new shape. A change folder holds three stored
  artifacts: the contract, the typed open items and the handovers.
- **Files in flight stay.** The files of a change in flight stay until it lands. No command
  converts a change behind its lane.
- **A migration refuses to drop content.** `jaiship change migrate <ref>` converts a change
  in one commit, after a backup commit. When a fact has no place in the contract, the
  migration is refused and the fact is named.
- **The compatibility reader leaves on evidence.** It goes when no open change uses the
  earlier files. The tool reports that state; there is no fixed period (Q29).

| Shape in a change folder | Read by | Written by | Until |
|---|---|---|---|
| The contract, one YAML file | every version from T2 on | every version from T2 on | stays |
| The typed open items and the handovers | every version from T1 and T3 on | the same versions | stays |
| A separate specification, test plan and plan | the compatibility reader, from T2 on | no version from T2 on | the last open change on them lands |
| A hand-written ledger | the compatibility reader, from T1 on | no version from T1 on | the last open change on it lands |

### A lane that meets a new version mid-flight

The binary and the agent definitions are brought to the tip after a merge and before the next
lane starts. A lane in flight meets the new version at its next command.

1. **It continues.** Every read works, because the new version reads every shape the
   previous one wrote. Its state continues, because the state is a fold over events that the
   new version reads as they are.
2. **Its files stay.** No command edits or converts the file of a change in flight. The new
   version writes only the current shape, so it never revises an earlier file; a write to one
   is refused with `change.file.legacy`.
3. **A needed revision goes through the migration.** When a state must revise an earlier
   file, the PM runs `jaiship change migrate <ref>` at the state boundary. The migration
   converts what has a place and adds the contract; the earlier files stay until the change
   lands. What has no place is named and the migration is refused. The lane then either
   gives the fact a place (a decision record, a typed open item, a free-text slot) and
   migrates, or lands on the files it has.
4. **Progress is an event.** Steps, rounds, findings and gate results are recorded as events
   over either set of files. Nothing is written into an earlier document.

### Two recorded departures

T2 departs from two principles of this file. Both are accepted with their reasons (CG-12).

| Departure | Why it is accepted |
|---|---|
| T2 changes the artifacts and the agents together, against one process change at a time | The contract has one author and one command family. The file without its author leaves every later ticket to invent its own author; the author without the file has nothing to write. The readiness gate and the reviewer keep running on the one contract, so no check is lost while the process changes. T1 changes only state and cost writes, so a failure in T2 is attributed to the write path. |
| T2 ships the schema before the bundle command, against the rule that no schema ships without it | One small file read whole is already a read win against three documents, and T2's own criterion is that artifact lines fall by at least half. Bundles over three documents would build the read path twice. T3 follows immediately, and until it lands an agent reads the whole contract. |

## Rollback

A revert of a ticket is a change delivered through the lifecycle. It restores, for changes
that start after it, the behaviour that stood before the ticket. A change in flight keeps
what it has.

| Revert | Restores | Must keep |
|---|---|---|
| T1 | the ledger as agents wrote it before the typed commands | every event already written; the cost records, readable for a landed change |
| T2 | the earlier files as what new changes write, with the agents that wrote them | every contract already written, read until its change lands; the migration's refusal to drop content; the repair path |
| T3 | whole-file reads in place of bundles | every step event and handover, which still fold into the state; the host-local fetch records |
| T4 | the readiness session before coding, for every change | every flag and finding on record: a revert de-escalates nothing |
| T5 | gate verdicts as the evidence of done | every recorded run and the evidence store with its retention; a recorded failure still blocks |
| T6 | a queue that serializes what it cannot compare | the audit records |

Four rules hold for every revert. The event log is append-only and the reverted version reads
it. The read rule holds in both directions: a reverted version reads every shape, the contract
included. Nothing on record is de-escalated or dropped. The per-write commits are squashed at
merge, so the audit trail is the events in the change folder and, as decision 36 proposes to
the owner, one aggregate cost record per change.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| A bundle omits a fact and the coder builds the wrong thing | the mandatory set, the `missing` list, on-demand fetch, the measured miss rate |
| A lane in flight loses work at an upgrade | files in flight stay; a backup commit; a migration that refuses to drop content |
| Hand-edit detection blocks a legitimate repair | the repair path; a path deny for writes only, and only after the pilot shows accidental edits |
| The tooling is late and the earlier path stays | time-box each ticket; any prefix is consistent; measure the earlier path as the control |
| A target is wrong | the retrospective after each pilot change resets it |

## What not to do

- Do not ship the contract without its author, or the author without the contract.
- Do not remove the compatibility reader on a date. Remove it when the tool reports that no
  open change uses the earlier files.
- Do not make signing a prerequisite; the trailer and the CI check are enough.
- Auto-commit artifacts only. Code keeps the commit primitive.
- Do not skip the pilot because the design is obvious; the miss rate is not obvious.
- Do not build the delta protocol or the push model in this epic.
- Do not narrow a pattern of the surface map in an agent-delivered change.
