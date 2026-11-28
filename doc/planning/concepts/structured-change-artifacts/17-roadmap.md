---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/planning/concepts/structured-change-artifacts/17-roadmap.md
---
# 17. Roadmap: tickets that each deliver value alone

Status: **Confirmed** (2026-11-28, Q30): six tickets, delivered from the top. Every ticket below is worth merging on its
own. If the work stops after any of them, nothing is left half-built. The order follows value
and dependency.

## The tickets

| # | Ticket | Scope | Value on its own | After | Signal that it worked |
|---|---|---|---|---|---|
| T1 | Typed working state and cost events | Typed commands for open items (blockers, questions, decisions, next actions); a write that does not validate changes nothing; at every boundary the tool records the real time, the minutes, the sessions and the tokens per role; `change cost` prints them per phase | The corruption class is gone (a hand-edited ledger that breaks verification); from the first change on, cost is measured instead of guessed | Nothing | No artifact-caused verification failure; cost recorded for every change |
| T2 | One contract, lint and preflight | The `contract` command family (sections, criteria, obligations, decisions, phases, steps, flags); `lint change` over the one file; `preflight` (cited paths, versions and commands exist and run; changed literals searched; named gates exist); one author, the PM for a light change; the two retired writer agents; a compatibility reader for changes in flight | Three documents become one a fraction of the size; the mechanical half of readiness failures is caught before any reader | T1 | Artifact lines per change fall by at least half; readiness rounds fall |
| T3 | Read by bundle, state from events, handovers | `context bundle` per role and phase over the contract, with a `missing` list; `workflow next`; the PM brief as state plus typed open items; `step done` as an event over a stable ID; the handover drafted by the tool and confirmed by the coder; the commit subject and body from the phase | Agents stop reading whole files; the PM stops reading the ledger; a fresh coder continues from a handover | T2 | Read amplification falls; the bundle miss rate stays near its target |
| T4 | Classification and earned rounds | The surface map (path patterns per flag, per repository); the tool proposes flags at intake, when the contract is validated, at review and before merge, and the PM confirms; typed findings with a category and a materiality; `review rounds allowed`; the reader prompts (reproduce, mutate); escalation on category | Harness and documentation work stops paying for the heavy shape; risky work gets its add-ons; rounds with nothing to find disappear | T2, T3 | Rounds per gate fall; flags corrected by the PM are rare and recorded |
| T5 | Verification evidence | Obligations carry a method and a test reference; the tool runs them on the base and on the candidate and records both (status, counts, candidate, evidence reference); evidence stored by reference; the definition of done reads statuses; acceptance tests first by an independent author for `security` and `data` | A test that passes without the fix, and a gate that reports green while running nothing, are caught before merge | T1, T2 | Every criterion has a recorded run on the merge candidate; proxy tests are caught |
| T6 | Paths and parallelism | `plan conflicts` across changes from typed paths; `change audit` as a learning signal; the queue consumes the verdict | The scheduler gets a real input; retrospectives get the misprediction rate | T2 | Conflict predictions checked against what actually collided |

T6 can be parked without loss to the others.

## Why this order

- **T1 first.** It removes a failure that exists today, and it turns every later question
  ("was that worth it?") into one that data can answer.
- **T2 before T3.** The read path is where the value is, but a contract a fraction of the size is
  already a read win; bundles then serve parts of it. Shipping a schema without the bundle command
  would leave the token bill unchanged, so T3 follows immediately.
- **One process change at a time.** T2 changes what agents write. T3 changes what they read.
  T4 changes how a change is shaped. A failure in any of them can be attributed.
- **T5 after the contract.** Obligations are part of the contract; the evidence is part of
  the event log from T1.
- **The pilot runs across T1 to T5**, on at least one change of each shape, then on the next
  ten to twenty changes with a retrospective after each (Q27, Q28).

## Any prefix is consistent

| Delivered | State of Jaiship |
|---|---|
| T1 | Working state is typed and cost is recorded. Changes still use their earlier artifacts, which every reader understands |
| T1, T2 | One contract per new change. Agents read the whole contract file until T3; it is a fraction of the earlier three documents |
| T1 to T3 | Agents read bundles; the PM reads a brief; a coder continues from a handover |
| T1 to T4 | A change takes its shape from its surface and its decisions; rounds are earned |
| T1 to T5 | Every criterion carries a recorded proof on the merge candidate |
| T1 to T6 | The scheduler reads typed paths |

In every state, a change in flight on the earlier artifacts can still be finished.

## If fewer tickets are wanted

The six collapse to three without losing the "valuable alone" property:

1. **Write**: T1 and T2.
2. **Read**: T3.
3. **Shape and proof**: T4 and T5.

T6 stays optional. One ticket for everything is possible but not recommended: it would change
the write path, the read path and the process in a single review.

## Open point

Answered (Q30, 2026-11-28): six tickets in this order.
