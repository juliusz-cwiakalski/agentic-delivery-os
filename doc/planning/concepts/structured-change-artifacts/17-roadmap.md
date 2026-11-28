---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/juliusz)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/planning/concepts/structured-change-artifacts/17-roadmap.md
---
# 17. Roadmap: tickets that each deliver value alone

Status: **Confirmed** (2026-11-28, Q30), revised after the critique; decisions 34 to 42 in
`14-review-decisions.md` govern it. Six tickets, delivered from the top; epic #434 to #440 in
the tracker. Every ticket below is worth merging on its own: if the work stops after any of
them, nothing is left half-built. The order follows value and dependency, and each ticket has
one numeric criterion.

## The tickets

| # | Ticket | Scope | Value on its own | After | One numeric criterion |
|---|---|---|---|---|---|
| T1 (#434) | Typed working state and cost | Typed commands for open items (blockers, questions, decisions, next actions), under the write transaction: a per-change lock, an expected revision and an idempotency key; a write that does not validate changes nothing. Cost: the tool reads the telemetry Jaiship already captures per change, phase and role, adds the phase and gate dimensions, and `change cost` reads live cost from the host-local store and the cost of a landed change; at closeout it writes one aggregate cost record per change to the repository's measurement log | The corruption class is gone (a hand-edited ledger that breaks verification); from the first change on, cost is measured instead of guessed | Nothing | Zero artifact-caused verification failures over the first ten changes; acceptance: the cost of a change reads correctly after its merge and the removal of its worktree |
| T2 (#435) | One contract, lint and preflight | The `contract` command family (sections, criteria, obligations, decisions, phases, steps, flags), written by the contract author, a new agent whose prompt this ticket installs; the specification writer and the plan-writer retire. `lint change` over the one file; a machine-readable schema for the contract, with examples validated in CI; `preflight` (cited paths, versions and gates exist; cited commands run under the command policy; changed literals searched); writes under T1's write transaction; the identifiers `VFACT-` and `RFIND-`. The interim rule for a light card, until T4: the PM writes it only when the ticket carries a typed block or a complete diagnosis and the change is expected to fit one phase; otherwise the contract author writes. Migration (decision 40): a new version reads every shape the previous one wrote and writes only the current one; the contract is the only new shape; the files of a change in flight stay until it lands; a migration refuses to drop content; the compatibility reader goes when no open change uses the earlier files (Q29) | Three documents become one a fraction of the size; the mechanical half of readiness failures is caught before any reader | T1 (#434) | Artifact lines per change fall by at least half |
| T3 (#436) | Read by bundle, state from events, handovers | One ticket, in this order, with a signal for each part. (1) Bundles: `context bundle` per role and phase over the contract, with a `missing` list; signal: a role's question is answered without a whole-file read. (2) The PM brief as state plus typed open items, and `step done` as an event over a stable ID; signal: no step state is hand-edited. (3) The handover, drafted by the tool and confirmed by the coder; signal: a fresh coder continues from it on every phased change. (4) The commit subject and body from the phase; signal: every commit subject on a change branch is derived. Read telemetry is host-local | Agents stop reading whole files; the PM stops reading the ledger; a fresh coder continues from a handover | T2 (#435) | Read amplification of 5 times the artifact size or less |
| T4 (#437) | Classification and earned rounds | The surface map (path patterns per flag, per repository), read from the merge base, in the lane and in CI. Flags scripted in part: the tool proposes them by path, by history and by a coverage run, at intake, when the contract is validated, at review and before merge; the PM confirms, and a removed flag carries a reason. Typed findings with a category and a materiality; `review rounds allowed`; escalation on category and materiality. In the light shape the coder is the first reader, in place of the readiness session. The reader prompts (reproduce, mutate); mutation as a tool command. Before the map is frozen, past diffs are replayed against draft maps and the flagged share is reported | Harness and documentation work stops paying for the heavy shape; risky work gets its add-ons; rounds with nothing to find disappear | T2, T3 | Zero review rounds that follow a round without a material finding |
| T5 (#438) | Verification evidence | Obligations name the observable and the predicate. Legs: the base leg on the merge-base tree with the change's test files added, once per change for the acceptance obligations, and the candidate leg; red kinds; a waiver as an audited event with an expiry. The watchlist of an obligation; the mutation command and the removal check per obligation; the definition of done reads statuses and shows a base leg that could not be attempted. Acceptance tests first by the acceptance author for `security` and `data`. Cited commands run only under the command policy | A test that passes without the fix, and a gate that reports green while running nothing, are caught before merge | T1, T2, T4 | Every criterion has a recorded run on the merge candidate: 100 percent |
| T6 (#439) | Paths and parallelism | `plan conflicts` across changes from typed paths; `change audit` as a learning signal; the queue consumes the verdict | The scheduler gets a real input; retrospectives get the misprediction rate | T2 (#435) | Conflict predictions checked against what actually collided: at least 80 percent right |

T6 can be parked without loss to the others.

T2 departs from two rules of section 08, and the departure is recorded. The first is one
process change at a time: T2 changes what agents write and installs one author. The readiness
gate and the reviewer keep running, on the one contract, so no check is lost while the process
changes. The second is that no schema ships without the bundle command: the contract's schema
ships in T2 and the bundles in T3. One small file is read whole until T3, which is already a
read win against three documents, and T3 follows immediately.

## Why this order

- **T1 first.** It removes a failure that exists today, and it turns every later question
  ("was that worth it?") into one that data can answer.
- **T5 after T4.** The flags of T4 invoke the acceptance author, so T5 depends on T1, T2 and
  T4.
- **The pilot** runs across T1 to T5, on at least one change of each shape, then on the next
  ten to twenty changes, with a retrospective after each (Q27, Q28).

## Every prefix keeps today's checks

Each cell says whether a check of today's lifecycle is present or replaced, and by what.
"Same" means the same as the cell on its left.

| Today's check | T1 | T1 and T2 | T1 to T3 | T1 to T4 | T1 to T5 | T1 to T6 |
|---|---|---|---|---|---|---|
| Scope clarification | Present | Present; the intake records the diagnosis as verified facts | Same | Same; the tool proposes the flags and the PM confirms | Same | Same |
| Specification | Present | Replaced by: the contract's goal, criteria, verified facts and decisions, written by the contract author | Same | Same | Same | Same |
| Test planning | Present | Replaced by: the contract's oracle section, written by the contract author | Same | Same (the oracle section); the flags exist from T4, and the acceptance author they invoke arrives with T5 | Replaced by: the oracle section, plus acceptance tests written first by the acceptance author for `security` and `data` | Same |
| Delivery planning | Present | Replaced by: the contract's Work section (phases, steps, paths, verify commands), written by the contract author | Same | Same | Same | Same |
| The readiness gate | Present | Present, on the contract, after the preflight | Present, reading a bundle | Replaced by: the preflight and the coder as first reader for a light change; the pre-code reader for a flagged or phased change | Same | Same |
| The independent review | Present | Present, against the contract | Same | Same; a further round is earned only by a material finding | Same; mutation through the tool command | Same |
| The quality gates | Present | Present | Same | Same | Same | Same |
| The definition of done | Present | Present, against the contract's criteria and phases | Same | Same | Same; it reads obligation statuses and shows a base leg that could not be attempted | Same |
| The pull request | Present | Present | Same | Same | Same | Same |
| Provenance | Present | Present; the contract is written only by the tool, each write bound to a session and a role | Same | Same | Same | Same |
| Reconciliation of current-truth documents | Present | Present; the contract's `docs:` says whether it applies | Same | Same | Same | Same |
| Continuity between phases | Present | Present, through the typed open items and the event log | Present; the handover between phases, drafted by the tool | Same | Same | Same |
| The evidence that tests ran | Present | Present | Same | Same | Present, and stronger: a recorded run per obligation on both legs | Same |

No cell is absent. The one session a prefix gives up is the readiness session of a light
change at T4; the preflight and the coder as first reader replace it (decision 35).

## The size of the levers

The classification lever is small: reclassifying small changes is worth about five percent of
total delivery minutes on the study's medians. The levers in artifact volume, the read path
and rounds are larger, and none of the three is sized: the study recorded tokens in no ledger,
and the add-ons of the flags were never measured. T1 measures. Once it has measured ten
changes, T2 to T5 are re-sized from what it shows.

## If fewer tickets are wanted

The six collapse to three without losing the "valuable alone" property: write (T1 and T2),
read (T3), shape and proof (T4 and T5). T6 stays optional. One ticket for everything is
possible but not recommended: it would change the write path, the read path and the process
in a single review.
