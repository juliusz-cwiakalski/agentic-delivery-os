---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/planning/concepts/structured-change-artifacts/16-testing-in-a-change.md
---
# 16. Testing inside a change

Status: **Accepted in principle** (2026-11-28, Q47). It answers Q5 and Q7 and details the
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
| Criterion | A precise example (given, when, then) or a property, with a stable ID and an explicit expected outcome | The author | Typed data in the contract |
| Obligation | The link from a criterion to its proof: method, boundary, test reference or command with its expected output, the expected baseline, whether it is required for merge | The author | Typed data in the contract |
| Test | The executable check, in the repository's own framework | The coder; for some flags an independent author (section 5) | Native test code |

There is no second copy of a scenario. A project that keeps its examples in feature files
references them, and the contract does not restate them. No scenario language is mandated.
When a rule has many cases, a table of inputs and expected outputs is data.

A vague criterion ("works correctly", "returns a proper error") fails the lint: it cannot
have a proof. Unresolved product choices are marked as open questions; a test author never
settles them by accident.

## 3. A proof is a recorded run

For each obligation the tool records, per run: the status, the selected, executed, passed,
failed and skipped counts, the candidate (commit or tree digest), the command, the duration
and an evidence reference.

| Status | Meaning | Consequence |
|---|---|---|
| PASS | Executed and met the expectation | Counts when the candidate is current |
| FAIL | The behavior violates a valid expectation | Blocks; remediate |
| ERROR | Harness, fixture or environment problem | Blocks; it is neither a red nor a pass |
| FLAKY | Inconsistent across attempts | Blocks or follows an explicit policy; never silently passes |
| SKIPPED | An applicable case did not run | Blocks unless separately authorized |
| NOT_APPLICABLE | Evaluated, and a policy permits the omission | The reason is recorded |
| STALE | Recorded for another candidate, oracle or environment | Run again |
| WAIVED | An authorized exception with a reason and an expiry | Never printed as PASS |

Rules:

- More selected than executed, or nothing executed, is not green.
- A retry does not erase a failure; attempts are kept.
- The definition of done reads obligation statuses for the merge candidate, not notes.

Three words keep the levels apart. **Claimed**: an agent says it is done. **Observed**: the
tool recorded a run. **Accepted**: the policy allowed the next step on that evidence.

## 4. Before and after, by kind of change

| Kind | Baseline, before coding | Candidate, after |
|---|---|---|
| Fix | A reproducing test fails for the right reason | It passes; everything else stays green |
| Feature | The new acceptance test fails because the behavior is absent | It passes; regressions stay green |
| Refactor | The existing behavioral suite passes; undocumented behavior is characterized first where the suite is thin | The same suite passes; developer tests may change |
| Intentional behavior change | The old behavior is recorded, and the contract names the superseded criterion | The new passes; unchanged criteria pass; consumers are verified |
| Docs or content | Lint, a link check, an independent reader | The same |
| Infra or config | A plan or conformance check, and the known drift | The desired state, smoke checks, rollback evidence, a check of the integration branch after merge |

The tool runs an obligation's test on the base and on the candidate and records both. Red
and green are evidence, not assertions.

A compile error, a broken fixture, an unavailable environment or a timeout is not a meaningful
red. A new test that is already green on the base may be a valid guard but does not prove the
behavior was absent. When a baseline cannot run, the reason is recorded; a red is never
staged.

## 5. Who writes which test

- **Developer tests**: the coder, refactored with the code.
- **Acceptance tests**: the coder writes them from the contract's criterion and obligation.
  The expectation predates the implementation.
- **For the `security` and `data` flags**: an independent author writes the acceptance tests
  before the coder starts, and the coder may not edit them. The author is the
  acceptance author: the existing test-plan-writer with this job instead of a
  test-plan document.
- **The reviewer, for every change**: for each obligation, asks what fails if the change is
  removed, and runs it. A test that stays green without the fix is a material finding in the
  category coverage.
- **For the `environment-bound` and `data` flags**: an obligation whose method is a mutation
  battery (a listed set of faults that the suite must catch) may replace several review
  rounds.

## 6. Changing a test

| Situation | Route |
|---|---|
| The expected behavior changes | A new revision of the contract names the superseded criterion; the test follows |
| The harness is broken (a selector, a fixture, an adapter) | A repair; the reviewer confirms that the assertion still proves the same criterion |
| A new edge case, consistent with the contract | A test enhancement, reviewed like code |
| An internal developer test | Normal review |

A diff that touches a file an obligation references is reported to the reviewer with the
obligations it affects. Weakening an expectation, skipping a case or loosening a tolerance
without a contract revision is a material finding.

## 7. Coverage means traceability

In this pack, coverage is the link from every criterion to at least one obligation, and from
every obligation to an existing test reference that executed. It is not line or branch
coverage. With one contract it is a join inside one file: the lint derives it and fails on a
criterion without an obligation. Nothing is stored. Line coverage and a mutation score are
optional obligations. The identifiers are `AC-` for a criterion, `PROOF-` for an
obligation and `TC-` for a test case (`15-classification-and-rounds.md`, section 10).

## 8. By shape

| Shape | What the oracle section holds |
|---|---|
| Light | One to three criteria, each with an obligation: usually a test that must be red before and green after, or a command with an expected output |
| Flagged | Plus negative and boundary cases, properties for invariants, and the flag's own evidence: a hostile run, the CI job battery, a rendered check |
| Phased | The full list, with the baseline run recorded before the first phase |

## 9. Not in this proposal

- A universal scenario language or runner.
- Held-out scenarios: in this epic the reviewer's mutation covers the same risk at a lower
  cost.
- Observation of the running software after release: a later topic.
- An emergency shape: Q48.

## Open points

Q47 (this proposal) and Q48 (an emergency shape) in `09-open-points.md`.
