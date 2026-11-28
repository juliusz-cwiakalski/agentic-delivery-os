---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/juliusz)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/planning/concepts/structured-change-artifacts/16-testing-in-a-change.md
---
# 16. Testing inside a change

Status: **Accepted in principle** (2026-11-28, Q47), revised after the critique. It is governed
by decisions 24 and 37 in `14-review-decisions.md`. It answers Q5 and Q7 and details the
oracle section of the contract in `15-classification-and-rounds.md`. It is a design for one
change, not a testing strategy for a product.

## 1. The principle

The contract states what must be true. The repository's tests and commands prove it. The
tool records the proof.

A coding agent may change how a result is achieved. It may not change what counts as success.
Three things follow:

- Expectations are written before the code, in the contract, by the author and not by the
  coder.
- A result counts only when the tool recorded it for the exact candidate. What an agent
  reports is a claim, not a result.
- A criterion without a proof is not done.

## 2. Three layers, one representation

| Layer | What it is | Written by | Form |
|---|---|---|---|
| Criterion | A precise example (given, when, then) or a property, with a stable ID and an explicit expected outcome | The contract author | Typed data in the contract |
| Obligation | The link from a criterion to its proof; its fields are below | The contract author | Typed data in the contract |
| Test | The executable check, in the repository's own framework | The coder; for some flags the acceptance author (section 5) | Native test code |

An obligation holds: the criterion, the claim, the observable, the predicate, the method,
the boundary, the test reference or the command with its expected output, the expected
baseline, and whether it is required for merge. A test reference alone is not a proof: the
observable and the predicate say what must be observed and what must hold.

There is no second copy of a scenario. A repository that keeps its examples in feature files
references them, and the contract does not restate them. No scenario language is mandated.
When a rule has many cases, a table of inputs and expected outputs is data.

A vague criterion ("works correctly", "returns a proper error") fails the lint: it cannot
have a proof. Unresolved product choices are marked as open questions; a test author never
settles them by accident.

## 3. A proof is a recorded run

A run has two legs. The **base leg** runs on the merge-base tree, taken by digest, with the
change's test files added, so that a new test can import what it needs. The **candidate leg**
runs on the candidate. The base leg runs once per change, for the acceptance obligations,
and not once per obligation.

For each obligation the tool records, per run and per leg: the status, the selected,
executed, passed, failed and skipped counts, the tree (commit or tree digest), the command,
the duration and an evidence reference.

| Status | Meaning | Consequence |
|---|---|---|
| PASS | Executed and met the expectation | On the candidate leg it counts when the candidate is current; on the base leg it means the test is green before the change |
| FAIL | The behavior violates a valid expectation | On the candidate leg it blocks; remediate. On the base leg it is a red, and it has a kind |
| ERROR | Harness, fixture or environment problem | Blocks; it is neither a red nor a pass |
| FLAKY | Inconsistent across attempts | Blocks or follows an explicit policy; never silently passes |
| SKIPPED | An applicable case did not run | Blocks unless separately authorized |
| NOT_APPLICABLE | Evaluated, and a policy permits the omission | The reason is recorded |
| STALE | Recorded for another tree, obligation or environment; defined per leg | Run again |
| WAIVED | An authorized exception, recorded as an audited event with a reason and an expiry | Never printed as PASS; shown as open at the definition of done until it expires |

A red has a kind. Only a failed assertion is a red: the test ran and its expectation was not
met. A missing symbol, an unresolved import or a harness error on the base leg is recorded
with its kind and is not a red: it does not prove that the behavior was absent.

Staleness is defined per leg: a base leg is stale when the merge base moves; a candidate
leg is stale when the candidate, an obligation or the environment changed after the run.

Rules:

- More selected than executed, or nothing executed, is not green.
- A retry does not erase a failure; attempts are kept.
- The definition of done reads obligation statuses for the merge candidate, not notes. It
  also shows a base leg that could not be attempted, with the reason; it is never silently
  accepted.

Three words keep the levels apart. **Claimed**: an agent says it is done. **Observed**: the
tool recorded a run. **Accepted**: the policy allowed the next step on that evidence.

## 4. Two legs, by kind of change

| Kind | Base leg (merge base, with the change's tests) | Candidate leg |
|---|---|---|
| Fix | A reproducing test fails for the right reason: a failed assertion | It passes; everything else stays green |
| Feature | The new acceptance test fails because the behavior is absent | It passes; regressions stay green |
| Refactor | The existing behavioral suite passes; undocumented behavior is characterized first where the suite is thin | The same suite passes; developer tests may change |
| Intentional behavior change | The old behavior is recorded, and the contract names the superseded criterion | The new passes; unchanged criteria pass; consumers are verified |
| Docs or content | Lint, a link check, an independent reader | The same |
| Infra or config | A plan or conformance check, and the known drift | The desired state, smoke checks, rollback evidence, a check of the integration branch after merge |

An acceptance obligation sits at a boundary above the change: a command, an interface, a
file. That is what makes a base red meaningful: the boundary exists on the merge-base tree,
so the obligation runs there and fails by a failed assertion. Unit tests support the
acceptance obligation and are written with the code.

The tool records both legs; red and green are evidence, not assertions. A test that is green
on the base may serve only as a guard, and then a case is added. A broken fixture, an
unavailable environment or a timeout is not a meaningful red: it is recorded with its kind,
and a red is never staged.

## 5. Who writes which test

- **Developer tests**: the coder, refactored with the code.
- **Acceptance tests**: the coder writes them from the contract's criterion and obligation.
  The expectation predates the implementation.
- **For the `security` and `data` flags**: an independent author writes the acceptance tests
  before the coder starts, and the coder may not edit them. The author is the
  acceptance author: the existing test-plan-writer with this job instead of a
  test-plan document.
- **The reviewer, for every change**: for each obligation, asks what fails if the change is
  removed, and requests the mutation. Mutation is a tool command in a copy of the tree: it
  applies a fault set, runs the obligation and records the result. The reviewer requests it
  and reads the result, and stays read-only for source. A test that stays green without the
  fix is a material finding in the category coverage.
- **For the `environment-bound` and `data` flags**: an obligation whose method is a mutation
  battery (a listed set of faults that the suite must catch) may replace several review
  rounds.
- **Obligations**: only the author revises one. At the tool, a write to the oracle section
  is accepted only from the author. A revision by the coder is a finding.

## 6. Changing a test

| Situation | Route |
|---|---|
| The expected behavior changes | A new revision of the contract names the superseded criterion; the test follows |
| The harness is broken (a selector, a fixture, an adapter) | A repair; the reviewer confirms that the assertion still proves the same criterion |
| A new edge case, consistent with the contract | A test enhancement, reviewed like code |
| An internal developer test | Normal review |

Every obligation has a watchlist: its test file, what the test imports, the test
configuration and the CI workflow that runs it. The tool computes it, and a change to any
file on it is reported to the reviewer with the obligations it affects. Weakening an
expectation, skipping a case or loosening a tolerance without a contract revision is a
material finding.

The tool runs a cited command only under the command policy
(`15-classification-and-rounds.md`, section 7).

## 7. Coverage means traceability

In this pack, coverage is the link from every criterion to at least one obligation, and from
every obligation to an existing test reference that executed. It is not line or branch
coverage. With one contract it is a join inside one file: the lint derives it and fails on a
criterion without an obligation, and that failure is a finding (`RFIND-`). Nothing is
stored. Line coverage and a mutation score are optional obligations. The identifiers are
`AC-` for a criterion, `PROOF-` for an obligation, `TC-` for a test case and `VFACT-` for a
verified fact of the diagnosis (`15-classification-and-rounds.md`, section 10).

## 8. By shape

| Shape | What the oracle section holds |
|---|---|
| Light | One to three criteria, each with an obligation: usually a test that must be red on the base leg and green on the candidate leg, or a command with an expected output |
| Flagged | Plus negative and boundary cases, properties for invariants, and the flag's own evidence: a hostile run, the CI job battery, a rendered check |
| Phased | The full list, with the base leg recorded before the first phase |

## 9. Not in this proposal

- A universal scenario language or runner.
- Held-out scenarios: in this epic the mutation command covers the same risk at a lower
  cost.
- Observation of the running software after release: a later topic.
- An emergency shape: none. An urgent fix takes the shape its surface dictates, and CI and
  the gates always run (Q48).

## Open points

Q47 (this proposal) and Q48 (no emergency shape) in `09-open-points.md`. The identifiers
this file uses, `VFACT-` and `RFIND-` among them, are in `15-classification-and-rounds.md`,
section 10.
