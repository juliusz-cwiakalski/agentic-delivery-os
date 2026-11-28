---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://www.x.com/juliusz)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/planning/concepts/structured-change-artifacts/07-parallelism.md
---
# 07. Affected paths and parallelism

`../parallel-delivery.md` already names the mechanism as strategy 3, "structured plan
locations": the contract's Work section lists the exact locations each phase will modify, and the
scheduler computes overlap mechanically. This file makes that concrete and adds the audit
that keeps the declaration honest.

## Why paths live in the plan

- The plan is the only artifact that knows **when** a path is touched (the phase) and
  **why** (the step). The specification knows the components; the diff knows the aftermath.
- The scheduler needs the declaration **before any code exists**. A prediction from the ticket
  is coarse; a declaration from the plan is precise.
- The audit needs a baseline. A declared path that is not modified, or a modified path that
  was not declared, is evidence about the plan's quality.

## Granularity

- **File-level, explicit.** Every file the phase will modify is listed, even a one-line change
  in a large folder. The owner's rule: if a tiny file in a folder is modified, it is in the
  plan.
- **Role.** Each path is a `producer` or a `consumer` of a contract. A producer changes the
  shape; a consumer reads it. Two consumers of the same contract can run in parallel if they
  do not write it; a producer and a consumer cannot, unless the consumer is updated in the
  same lane.
- **Kind.** `add`, `modify`, `delete`. A delete is a write for conflict purposes.
- **Globs are conservative.** A glob expands to the files it matches at plan time; an
  unmatched glob is a lint warning. A glob that matches a large tree serializes the change;
  the contract author is encouraged to enumerate.
- **Generated files and lockfiles** are declared as `generated` and serialize by default.

## Conflict classes

| Class | Definition | Decision |
|---|---|---|
| `disjoint` | no path overlap | parallel |
| `read-only-overlap` | one reads, the other writes, and the reader is not the producer | parallel, with a note; the reader re-syncs if the producer lands first |
| `write-overlap` | both write the same path | serialize |
| `contract-overlap` | one produces a contract the other consumes | order by dependency; the consumer waits |
| `test-overlap` | both modify the same test file or fixture | serialize |
| `order-dependency` | the plan declares `dependsOn` a change that is not merged | wait |
| `generated-or-lockfile` | a lockfile, a generated inventory, or a snapshot | serialize |

Conservative default: an undeclared or fuzzy scope serializes. The cost of a false serial is
wall-clock; the cost of a false parallel is a merge conflict and a retro.

## The algorithm

```text
conflicts(A, B):
  writesA = paths(A, kind in {add, modify, delete})
  writesB = paths(B, kind in {add, modify, delete})
  if writesA ∩ writesB != {} -> write-overlap, serialize
  contractsA = producers(A) ∪ consumers(A)
  contractsB = producers(B) ∪ consumers(B)
  if producers(A) ∩ consumers(B) != {} or producers(B) ∩ consumers(A) != {} -> contract-overlap, order
  if tests(A) ∩ tests(B) != {} -> test-overlap, serialize
  if A.dependsOn contains B or B.dependsOn contains A -> order-dependency, wait
  if generated(A) ∩ generated(B) != {} -> serialize
  else -> disjoint or read-only-overlap, parallel
```

The comparison is computed on the declared path sets, not on the diff. The diff is the audit's
job.

## Scheduler decision

- `parallel`: both lanes may run; the queue grants both leases if the per-repository cap
  allows it.
- `serialize`: the second lane waits for the first to land, then re-plans its phase bundle
  with a rebase note.
- `order`: the consumer waits for the producer; the dependency is explicit in both plans.
- `read-only-overlap`: parallel; the reader's bundle carries a note that the contract may move,
  and the reader re-syncs at its next phase boundary.

The decision is recorded with the plan revisions that produced it, so a later conflict is
evidence about the declaration, not a mystery.

## The drift audit at the pull request

```bash
jaiship change audit GH-416 --base origin/main-tools
```

The audit compares the declared `affectedPaths` with the diff. It is a **learning signal**,
not a gate for an ordinary miss:

- A modified path that was not declared: `change.paths.undeclared`. Recorded as drift. The
  merge authority resolves any conflict, and the retro compares the planned manifest with the
  actual diff.
- A declared `modify` path that is unchanged: `change.paths.unmodified`. Usually a stale plan;
  the contract author updates it.
- A declared `add` path that exists: a duplicate or a rename; the contract author resolves it.
- A path outside the change's scope: `change.paths.out-of-scope`. This one fails the audit,
  because it is a scope breach, not a planning miss.
- A path in a protected area (a security-sensitive file, a merge policy, a permission file):
  fails the audit.

The audit result is appended to the retrospective log with the plan revision, the actual diff,
and the conflict class. The misprediction rate is the share of audits with an undeclared path
or a false parallel. The rate is the learning loop: it improves the plan templates, the
path-suggestion tooling, and the conflict strategy.

## Example

Change A (`GH-416`) and change B (`GH-417`) both declare
`packages/cli/src/production.ts:modify:consumer`.

```text
jaiship plan conflicts GH-416 GH-417
verdict: serialize
reason: write-overlap on packages/cli/src/production.ts
order: GH-416 first (older plan revision); GH-417 rebases after it lands
```

The second lane's coder bundle includes:

```markdown
## Order note
Serialized behind GH-416. Rebase after it lands. The shared write path is
packages/cli/src/production.ts. Your phase P2 must re-read the composed program after the
rebase; do not assume the registration block is unchanged.
```

## Integration with the existing work

- #405 (scope locks): the plan's `affectedPaths` is the input to the lock; the lock is the
  enforcement, the plan is the declaration.
- #412 (parallel lanes): the lease and the cap consume the conflict verdict; the lane's
  worktree isolates the write.
- #367 (queue readiness): the queue stores the verdict and the order; the PM brief shows it.
- The retro subsystem: the misprediction rate is a retro metric, per strategy, as
  `../parallel-delivery.md` proposes.

## Limitations

- A plan cannot declare what it does not know. A refactor that touches fifty files through a
  codemod is better declared as a glob with a serial default.
- A rename can hide a write overlap; the audit catches it after the fact.
- A test fixture shared by two changes is a write overlap even if the tests are different.
- The declaration is a prediction until the code exists. The audit is the truth; the retro is
  the learning loop.
