---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://www.x.com/juliusz)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/planning/concepts/structured-change-artifacts/08-migration.md
---
# 08. Migration: slices, pilot, metrics

## Principles

- **Small slices, each with a metric and a rollback.** No big bang.
- **Read path first, write path second.** The token win is in the read path; the corruption
  win is in the write path. Both matter, but they can land separately.
- **Measure on real changes.** A pilot on one M ticket, with a baseline from the same tier.
- **Keep the old reader until the new shape is proven.** Dual read, new writes only.
- **Do not change the lifecycle and the tooling in the same slice.** A process change and a
  schema change together make a failure hard to attribute.

## Delivery shape: one epic, multiple pull requests, one milestone

The pack is delivered as **one epic with multiple pull requests**, not one big-bang pull
request. The slices share a schema and a CLI, land behind flags, and are measured. A single
long-lived branch would be hard to review and risky to land; the epic keeps the coherence the
owner wants. The recommendation is slice 0 and slice 1 first, then slices 2 to 5 tightly
sequenced.

## Slice 0: the typed ledger and the fail-closed write

**Scope.**

- `jaiship pm loop add`, `pm loop close`, `pm next add`, `pm next done`, `pm blocker add`,
  `pm blocker clear`, `decision add`.
- `jaiship phase complete` refuses to write when the PM context does not parse.
- `jaiship lint change` checks schema, references, budget, and provenance for the PM context.
- A compatibility writer for the old pm-notes during the migration.

**What it fixes.** The GH-416 corruption class: a hand-edited note with an invalid escape, a
`verify` that fails, a watcher that reads zero phases.

**Metric.** Artifact-caused verify failures: 1 in the GH-416 lane to 0. Hand-edit incidents:
1 to 0.

**Rollback.** The old writer stays behind a flag for one milestone; the new files are additive.

**Work item.** Extend #113 from "validate at phase 11" to "typed writer, validate on every
write, fail closed".

## Slice 1: the data-first plan and the coder and reviewer bundles

**Scope.**

- `delivery.plan.v2` with `phases[].acceptance`, `tests`, `affectedPaths`, `steps`, `verify`,
  `dependsOn`, `handover`.
- `jaiship plan phase add`, `plan phase complete`, `plan path add`, `plan verify add`.
- `jaiship context bundle --for coder` and `--for reviewer`.
- The plan's comment share is capped; the plan-writer writes `detail` fields, not comments.

**What it fixes.** The coder and the reviewer reading the whole plan and the whole test plan;
the plan being 86 percent comments.

**Metric.** Read amplification for the coder and the reviewer: from about 35x to 10x or less
in the pilot. Input tokens per 1k lines: from about 397k to 300k or less.

**Rollback.** The old plan reader stays; the new fields are additive; the bundle command can
fall back to the file read.

**Work item.** A new M4 item, or an extension of #412 (parallel lanes) if the plan schema is
delivered there. The pack recommends a separate item so the bundle can be measured on its own.

## Slice 2: the test plan as data

**Scope.**

- `change.test-plan.v1` with `cases`, `preconditions`, `coverage`.
- `jaiship test case add`, `test precondition add`, `test coverage rebuild`.
- The readiness bundle reads the coverage table, not the prose.

**What it fixes.** The 156KB test plan with 800 words per case and 26 percent duplicate lines.

**Metric.** Test-plan bytes per case: from about 5KB to 1.2KB or less. Coverage gaps found at
DoR: from 0 to at least 1 in the pilot (the gate gets teeth).

**Rollback.** The old test plan reader stays for one milestone.

## Slice 3: the specification contract

**Scope.**

- `change.spec.v1` with `acceptanceCriteria`, `decisions`, `interfaces`, `affectedPaths`,
  `risks`, `openQuestions`, `nonGoals`, bounded `prose`.
- `jaiship spec set`, `spec ac add`, `spec decision add`, `spec interface add`, `spec risk
  add`, `spec oq add`.
- The spec bundle serves the contract, not the 25 sections.

**What it fixes.** The 101KB specification with 25 sections and 131 table rows; the restatement
of ACs, decisions, and paths across four artifacts.

**Metric.** Specification bytes: from about 101KB to 40KB or less for an L change. Reopens per
ticket: from 2 to 1 or less.

**Rollback.** The `.md` specification stays readable; the contract is additive.

**Open point.** This is the slice where the hybrid decision matters. Do not formalize the
rationale; bound it.

## Slice 4: handovers and the full bundle set

**Scope.**

- `delivery.handover.v1`, `jaiship handover record`, `plan phase complete --handover`.
- Bundles for PM, readiness, plan-writer, test-plan-writer, spec-writer, doc-syncer, runner,
  pr-manager, retrospective.
- The `missing` list and the `context fetch` event.

**What it fixes.** The fresh-context reread; the PM context carrying history; the handover
that is either missing or a prose dump.

**Metric.** Bundle miss rate: 10 percent or less after two iterations. PM context size: 8KB or
less. Handover size: 1KB or less per phase.

**Rollback.** The bundles are read-only projections; the old read path still works.

## Slice 5: affected-path audit and parallelism

**Scope.**

- `jaiship plan conflicts`, `jaiship change audit`.
- The queue consumes the conflict verdict; the lane's bundle carries the order note.
- The retro records the misprediction rate.

**What it fixes.** The prediction-based parallelism and the silent undeclared path.

**Metric.** Misprediction rate: 20 percent or less. Undeclared paths at the pull request: 0
for L, recorded for S and M during the pilot.

**Rollback.** The queue can ignore the verdict and serialize; the audit can be advisory.

**Work item.** #405 (scope locks) and #412 (parallel lanes); this slice is the plan-side input.

## Slice 6 (deferred): the milestone contract and goal verification

Deferred by the owner's review decision (section 14). It is not part of this epic; the
specification's `milestone` field is a free-text label. The section is kept as a future
slice.

**Scope.**

- `milestone.contract.v1`, `jaiship milestone init`, `goal add`, `verify`.
- The milestone verifier is independent of the PM.
- The ticket specification references goal IDs.

**What it fixes.** The milestone-level memory and the "all tickets merged but the goal is not
met" failure.

**Metric.** Goal verification coverage: every goal has a measure and an evidence trail. Cycle
time per milestone: measured, target set after the first milestone.

**Rollback.** The contract is a document; the per-ticket flow is unchanged.

## Tier review

Before slice 3, review what goes into each tier. The rule: every tier keeps the safety checks
(acceptance criteria, tests, a review, the gates, the DoD, the pull request, provenance); the
tiers slim the artifact volume (specification prose, test-plan depth, plan granularity,
readiness depth, handover requirement). The review produces a table per tier: which artifacts,
which phases, which gates, which reviews, which handover. The table is the input to the
workflow templates in section 12.

## The pilot

- **Ticket:** one M change, not a foundation ticket. A foundation ticket has too many
  confounders.
- **Baseline:** the same tier's last three changes, measured with the same method as section
  10.
- **Duration:** the whole lifecycle, including one review round.
- **Measure:** input tokens per 1k lines, read amplification, bundle miss rate, reopens,
  review edits, cycle time, hand-edit incidents.
- **Decision:** continue, adjust the bundles, or stop. The kill criteria are in section 01.

## Compatibility

- Dual read: the CLI reads the old `.md` and the new `.yaml`; it writes only the new shape.
- `jaiship change migrate <ref>` converts an in-flight change in one commit, after a backup
  commit, and records the migration in the PM context.
- The compatibility reader is removed after two milestones.
- A write to a legacy file is refused with `change.facet.legacy`.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| The bundle omits a fact and the coder builds the wrong thing | a written context contract, a `missing` list, on-demand fetch, a measured miss rate, generous first bundles |
| The plan's paths are wrong | tool-assisted suggestions, a lint for at least one path per phase, the audit at the pull request |
| Hand-edit prevention blocks legitimate work | start with detection and a human import; move to a path deny only after the pilot |
| Auto-commit noise | squash at merge, pathspec-only commits, never mix code and artifacts |
| The specification becomes a form | keep the prose budget, keep the decision records, review the contract and the rationale separately |
| The milestone contract becomes a second specification | cap it at goals, scope, architecture, dependency graph, test strategy, DoD |
| The tooling is late and the old path stays | time-box each slice, keep the old reader, measure the old path as the control |

## What not to do

- Do not formalize the rationale.
- Do not ship the schemas without the bundle command; the read path is the product.
- Do not make signing a prerequisite; the trailer and the CI check are enough.
- Do not auto-commit code; only artifacts.
- Do not skip the pilot because the design is obvious; the miss rate is not obvious.
- Do not remove the old reader in the same slice that introduces the new writer.
- Do not build the delta protocol or the push model in this epic; both are deferred.

## Rollout gates

| Gate | Pass when |
|---|---|
| G1: slice 0 | no artifact-caused verify failure in one lane |
| G2: slice 1 | coder and reviewer read amplification at 10x or less; no increase in rework |
| G3: slice 2 | test-plan bytes per case at 1.2KB or less; at least one coverage gap caught at DoR |
| G4: slice 3 | specification at 40KB or less for L; reopens at 1 or less |
| G5: slice 4 | miss rate at 10 percent or less; PM context at 8KB or less |
| G6: slice 5 | misprediction rate at 20 percent or less; no undeclared path on L |
| G7: slice 6 (deferred) | not in this epic; revisit with the milestone contract |
