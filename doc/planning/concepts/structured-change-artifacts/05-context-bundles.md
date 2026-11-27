---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://www.x.com/juliusz)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/planning/concepts/structured-change-artifacts/05-context-bundles.md
---
# 05. Just-in-time context bundles

## What a bundle is

A bundle is a **projection** of the facets for one role at one moment. It is not a file and it
is not a search result. It is an ordered set of sections with a source revision, a byte
budget, and a `missing` list. The agent reads the bundle and starts work; if it needs a fact
that was omitted, it fetches that section by ID.

The contract:

- **Deterministic.** The same role, phase, and facet revisions produce the same bundle, in
  the same order.
- **Bounded.** Every role has a byte budget. The builder stops at the budget and lists what it
  dropped.
- **Linked.** Every section names its source facet and revision. A stale bundle is visible.
- **Complete by contract, not by size.** Each role has a written context contract: the facts
  it must have, the facts it may fetch on demand, and the facts it never needs.
- **Measured.** Every on-demand fetch is an event. The miss rate is the share of bundles after
  which the agent fetched more.

## The role and phase matrix

| Role | When | Anchor | Must include | May omit | Budget |
|---|---|---|---|---|---|
| `pm` | every phase boundary, resume | PM context | phase state, open loops, next actions, blockers, decision summaries, risk summaries, handover summaries | decision rationale, test steps, plan steps, history | 8KB |
| `spec-writer` | specification | ticket and milestone | problem, scope, ACs, interfaces, affected components, related decisions, tier rules | full system spec, test plan, plan | 32KB |
| `test-plan-writer` | test planning | specification | ACs, interfaces, plan phase list, existing test conventions, tier rules | spec prose, plan steps | 24KB |
| `plan-writer` | delivery planning | specification | ACs, interfaces, affected components, repository map, test case list, tier rules | spec prose, test steps | 32KB |
| `readiness-reviewer` | DoR and DoD | specification and coverage | contract, coverage table, plan summary, lint gaps | spec prose, test steps, plan steps | 12KB |
| `coder` | phase start | plan phase | phase goal, ACs, paths, interfaces, tests, verify, handover, invariants, next | other phases, history, closed loops | 16KB |
| `reviewer` | review | diff and contract | diff summary, ACs, tests, decisions, handovers, review checklist | plan steps, PM loops | 24KB |
| `doc-syncer` | system spec update | changed interfaces | interfaces, ACs, affected doc sections | test steps, plan steps | 16KB |
| `runner` | gates | verify commands | commands, cwd, expected exits, environment | everything else | 4KB |
| `pr-manager` | pull request | contract and review | title, ACs, tests, changeset, summary, review verdict | plan steps, loops | 12KB |
| `retrospective` | retro | all facets | PM context, handovers, gate evidence, review findings, retro log | none; read-only | 32KB |

## The filtering algorithm

1. **Anchor.** Start from the role and the phase. The coder anchors on the plan phase; the
   reviewer on the diff and the specification contract; the PM on the PM context; readiness on
   the specification and the coverage table.
2. **Follow the links.** Phase to acceptance criteria; phase to tests; phase to paths; paths
   to interfaces; criteria to decisions; tests to preconditions.
3. **Add the invariants.** Accepted decisions marked `global: true`, the milestone
   architecture, the non-goals, and `scope.out`. These are small and they prevent local
   optimization.
4. **Add the next.** The next phase's `nextInputs` and handover requirement. A coder that
   does not know what the next phase expects will break it.
5. **Exclude.** Other phases' steps, closed loops, superseded decisions, the retrospective
   log, and prose the role does not need.
6. **Order.** Goal and criteria first, then paths and interfaces, then tests and verify, then
   handover, then invariants, then next.
7. **Budget.** Drop from the end, record every drop in `missing`.
8. **Stamp.** Emit the source revisions and a bundle hash.

## The context contract per role

The contract is the answer to "what is required in which context". It is written down,
reviewed, and tested with the workflows in section 06.

| Role | Must have | Must not be without | Never needs |
|---|---|---|---|
| coder | phase goal, ACs, paths, interfaces, tests, verify, handover, invariants, next | the handover when the phase requires one; the invariants when a decision constrains the phase | other phases' steps, closed loops, the retrospective log |
| reviewer | diff summary, ACs, tests, decisions, handovers, checklist | the ACs the diff claims to satisfy; the tests that prove them | PM loops, plan steps |
| readiness | contract, coverage, plan summary, lint gaps | the coverage table; the lint gaps | spec prose, test steps |
| PM | phase state, loops, actions, blockers, decision summaries, risk summaries, handover summaries | the blocking actions; the open blockers | decision rationale, test steps |
| plan-writer | ACs, interfaces, components, repo map, test list | the ACs the plan must cover; the interfaces it must respect | spec prose, test steps |
| test-plan-writer | ACs, interfaces, phase list, test conventions | the ACs without a case; the phase each case belongs to | spec prose, plan steps |
| spec-writer | problem, scope, ACs, interfaces, components, related decisions | the tier rules; the milestone goal | the test plan, the plan |

A bundle that violates a "must have" is a bug in the bundle builder, not a reason for the
agent to read the whole file.

## Example: coder, phase P3

```markdown
# Bundle: coder / GH-416 / P3
Revisions: spec 3, test-plan 2, plan 4, handover P2 1
Budget: 16KB, used 9.8KB

## Phase
P3: The command, the renderer, and the edge wiring.
Goal: expose `push <ref>` as a prompt-required command and wire it into the composed program.
Acceptance: AC-1, AC-2, AC-3.

## Acceptance criteria
AC-1: `push <ref>` pushes once and reports `verdict: pushed` with the full remote head.
AC-2: a refused transport is a data-bearing answer with a closed cause, exit 1, no new error identity.
AC-3: `dispatch status` carries the additive `lanePush` fact without changing an existing field.

## Paths
- packages/cli/src/commands/push.ts (add, producer): the command entry and grammar.
- packages/cli/src/output/push-text.ts (add, producer): the renderer.
- packages/cli/src/production.ts (modify, consumer): the composed program.
- packages/cli/src/help.ts (modify, consumer): the help inventory.

## Interfaces
API-1 (cli, added): jaiship push <ref>; positional ref, optional --json, exit 0 on pushed,
exit 1 on a refused act, standard envelope on a grammar refusal.

## Tests to satisfy
TC-LCMD-001: push once and report the remote head.
  1. Run push --json with the transport returning status 0.
  2. Assert one runner invocation with the delivered argv.
  3. Assert lanePush carries verdict, branch, head, recorded, recordedAt.
TC-LCMD-003: the status answer carries lanePush additively.

## Verify
- pnpm typecheck (cwd ., exit 0)
- pnpm test tests/behaviour/dispatch-lane-push-command.test.ts (cwd ., exit 0)

## Handover from P2
Done: resolve, act, append, answer over injected ports; domain rules without transport.
Deviations: the append is attempted after a failed act so the record carries the refusal.
Open risks: no test for a concurrent append on the fence refusal path.
Next inputs: resolve, act, append, answer are exported; the renderer must not add an error
identity for a refusal.

## Invariants
DEC-1: the lane owns the push act through a typed command; the engine's ensure-push stays the
backstop.
NG-1: no change to branch protection or the merge path.

## Next phase expects
P4 needs the command registered in the composed program and the help inventory updated.

## Missing (fetch on demand)
- spec.prose.rationale: not needed for P3.
- plan.P1.steps: not needed for P3.
- test-plan.PRE-2: fetched only if the fence path is touched.
```

## Example: reviewer, phase P3

```markdown
# Bundle: reviewer / GH-416 / P3
Revisions: spec 3, test-plan 2, plan 4
Budget: 24KB, used 14.2KB

## Diff summary
12 files, +940 -120. Three are generated inventories; the rest are command, renderer, and
wiring.

## Acceptance criteria claimed
AC-1, AC-2, AC-3.

## Tests that prove them (including P2's cases)
TC-LCMD-001, TC-LCMD-002, TC-LCMD-003, TC-LCMD-004.

## Decisions that constrain the diff
DEC-1: typed command, engine backstop.
DEC-2: closed cause vocabulary, 512-byte payload bound.

## Handovers
P2: resolve, act, append, answer over injected ports; the append follows a failed act.

## Review checklist
- [ ] AC-1 is proven by TC-LCMD-001 and the diff adds exactly one act.
- [ ] AC-2 is proven by TC-LCMD-002 and TC-LCMD-004; no new error identity.
- [ ] AC-3 is proven by TC-LCMD-003; no existing field changed.
- [ ] The record payload is within the bound and the cause vocabulary is closed.
- [ ] The changeset is present.

## Missing
- plan.P3.steps: the reviewer sees the diff, not the plan's prose.
```

## Example: PM brief

```markdown
# PM brief / GH-416
Phase: delivery. Revisions: pm-context 7, handover P2 1.

## Next actions
ACT-1 (blocking): wait for the coder's P3 handover, then run the review bundle.
ACT-2: confirm the changeset before the full gate.

## Open loops
None.

## Blockers
None.

## Decisions (summaries)
DEC-1: the lane owns the push act; the engine's ensure-push is the backstop.
DEC-2: a closed cause vocabulary; no free-text reason.

## Risks
RSK-1 (high): a lane behind the remote; the command reports and never forces.
RSK-2 (medium): the new record kind can break a pinned count.

## Handovers
P2: done; the append follows a failed act; no concurrent-append test.

## Missing
- decision rationale: fetch DEC-1 or DEC-2 only if a new decision is needed.
```

## Example: readiness

```markdown
# Readiness / GH-416
Revisions: spec 3, test-plan 2, plan 4.

## Contract
ACs: AC-1, AC-2, AC-3. Scope out: force push, retry loop, merge path. Interfaces: API-1, API-2.
Paths declared: 14. Risks: RSK-1 high, RSK-2 medium.

## Coverage
AC-1 -> TC-LCMD-001 (P3)
AC-2 -> TC-LCMD-002, TC-LCMD-004 (P3)
AC-3 -> TC-LCMD-003 (P3)

## Plan summary
P1 contracts (AC-2, AC-3), P2 use case (AC-2), P3 command (AC-1, AC-2, AC-3), P4 surfaces
(AC-1). Every phase has a path and a verify command.

## Lint gaps
None.

## Missing
- spec prose, test steps, plan steps: not needed for the verdict.
```

## Miss handling and measurement

- Every bundle ends with `missing`. The agent fetches a section with
  `jaiship context get --change <ref> --section <id>`.
- The tool records a `context.fetch` event with the role, the phase, the section, and the
  reason. The miss rate is computed per role and phase.
- If a section is fetched in more than 20 percent of the bundles for a role, the bundle
  builder promotes it. If a section is never fetched, it is a candidate for removal.
- A miss is not a failure. A miss that causes rework is. The retrospective log records both.

## Anti-patterns

- **The whole file in a bundle.** If the bundle is the file, the model has failed.
- **A bundle without invariants.** The coder optimizes its phase and breaks the next.
- **A bundle without next.** The coder does not know what the next phase expects.
- **A non-deterministic bundle.** The agent cannot cache or compare.
- **A bundle that includes prose the role does not need.** That is the 35x read
  amplification again, one bundle at a time.
- **A bundle that is complete but huge.** Budgets exist for a reason; a 60KB coder bundle is
  a plan problem, not a bundle problem.

## The one-command ideal, and its limit

The owner's ideal is that a coder runs one command and starts work. That is achievable for
the **contract** of a phase: goal, criteria, paths, interfaces, tests, verify, handover,
invariants, next. It is not achievable for **judgment**: the coder may still need to read the
surrounding code, the existing tests, or a decision's rationale. The bundle gives the coder
the contract; the repository gives the coder the code. The design goal is that the coder never
reads the artifact files, not that it never reads anything.
