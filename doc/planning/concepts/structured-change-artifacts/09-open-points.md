---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://www.x.com/juliusz)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/planning/concepts/structured-change-artifacts/09-open-points.md
---
# 09. Open points

Answer inline under each question, on the `Answer:` line. A question marked **P1** blocks the
first slice; a question marked **P2** has a default that is safe to build on and can be
changed later. If you disagree with a default, write the new rule; the design will be updated
before the slice starts.

## Scope and tiers

### Q1. What are the S, M, and L thresholds?

Priority: **P1**.

Why it matters: the tier decides the artifact set, the review depth, and the gate cost. A
threshold that is too low turns a small fix into a ceremony; too high lets a risky change
through a light gate.

Options:

- A: S up to 300 changed lines and 10 files, no contract change; M up to 3,000 lines and 40
  files, local contract; L above that, cross-cutting contract, security, or data migration.
- B: by risk class only, not by size.
- C: by the number of phases in the plan.

Default: A, with a re-tier by the readiness gate.

If wrong: either ceremony on small changes or a light gate on a risky one.

Answer:

### Q2. Should S changes collapse the eleven phases?

Priority: **P2**.

Why it matters: a 200-line fix does not need a 25-section specification and a 6MB readiness
read. But the review, the gates, the DoD, and the pull request are the safety net.

Options:

- A: collapse clarify and specification, keep a one-page contract, a test list, a file-list
  plan, one review, the gates, the DoD, and the pull request.
- B: keep all eleven phases for every change.
- C: a separate lite lifecycle with its own phases.

Default: A for S, full for M and L.

If wrong: cycle time or rigor.

Answer:

### Q3. Is the specification fully structured or a hybrid?

Priority: **P1**.

Why it matters: this is the biggest design choice in the pack. A fully structured
specification loses the rationale or hides it in blobs; a hybrid keeps a typed contract and
bounded prose.

Options:

- A: hybrid, a typed contract plus 300/700/1,200 words of prose by tier.
- B: fully structured, no prose.
- C: prose only, with a small typed header.

Default: A.

If wrong: either a form that nobody reads or a 100KB document that nobody parses.

Answer:

## Schemas

### Q4. Which ID prefixes should be added to the catalog?

Priority: **P2**.

Why it matters: the catalog-before-create rule (R1) requires an entry before a prefix is used.
The pack proposes `AC-`, `RSK-`, `PRE-`, `ACT-`, and `M<n>-G<nn>`; it reuses `API-` for
interfaces.

Options:

- A: add all five.
- B: add `AC-` and `RSK-` only; reuse `OQ-` for preconditions and `DEC-` for actions where
  possible.
- C: let the implementer choose and register at implementation time.

Default: A, with a collision check by the catalog owner.

If wrong: a prefix collision or a rename later.

Answer:

### Q5. Should test cases become executable specifications?

Priority: **P2**.

Why it matters: a Gherkin-style case is executable but duplicates the test code and adds a
toolchain. A document case with a test path is cheaper but can drift from the test.

Options:

- A: keep the case as data with a test path; the test file is the executable.
- B: make the case executable (Gherkin or a custom runner).
- C: generate the case from the test's titles.

Default: A.

If wrong: duplication or drift.

Answer:

### Q6. Should the specification's prose live in the YAML or in a separate Markdown file?

Priority: **P2**.

Why it matters: one file is easier to keep consistent; two files are easier to read and
review as prose.

Options:

- A: one YAML with block scalars; a separate rationale only for L.
- B: a YAML contract plus a Markdown specification.
- C: Markdown with a YAML front matter.

Default: A.

If wrong: readability or parsing complexity.

Answer:

### Q7. Should coverage be stored or derived?

Priority: **P2**.

Why it matters: a stored coverage table is fast to read but can drift; a derived one is
always right but costs a computation on every read.

Options:

- A: stored, tool-generated, lint-checked.
- B: derived on read.
- C: stored as a cache with a hash.

Default: A.

If wrong: drift or latency.

Answer:

## Context

### Q8. Are the bundle budgets right?

Priority: **P1**.

Why it matters: the budget is the trade-off between a complete context and a small one. The
proposal is PM 8KB, coder 16KB, reviewer 24KB, readiness 12KB, plan-writer 32KB,
test-plan-writer 24KB, spec-writer 32KB, doc-syncer 16KB, runner 4KB, pr-manager 12KB,
retrospective 32KB.

Options:

- A: as proposed, adjust after the pilot.
- B: smaller, with more on-demand fetches.
- C: larger, with fewer misses.

Default: A.

If wrong: token waste or a high miss rate.

Answer:

### Q9. What is the acceptable bundle miss rate?

Priority: **P1**.

Why it matters: the miss rate is the main evidence that the context contract is right. A miss
that causes rework is worse than a whole-file read.

Options:

- A: 10 percent or less after two iterations; stop at 25 percent.
- B: 5 percent.
- C: 20 percent.

Default: A.

If wrong: the bundle is either too thin or too fat.

Answer:

### Q10. Should the bundle be Markdown or JSON?

Priority: **P2**.

Why it matters: Markdown is cheaper for an LLM to read; JSON is easier for a tool to
compose and diff.

Options:

- A: Markdown for the agent, JSON for the tool.
- B: JSON only, rendered by the agent.
- C: Markdown only.

Default: A.

If wrong: tokens or tooling complexity.

Answer:

### Q11. Should the reviewer's bundle include the diff or only a summary?

Priority: **P2**.

Why it matters: the diff is the review's primary evidence, but it can be large and is already
in git.

Options:

- A: a summary plus the ACs and tests; the reviewer reads the diff from git.
- B: include the diff in the bundle.
- C: include only the changed hunks that touch a declared path.

Default: A, with C as a follow-up if the reviewer fetches the diff too often.

If wrong: token waste or a blind review.

Answer:

### Q12. Should the PM brief include decision rationale or only summaries?

Priority: **P2**.

Why it matters: the PM needs the choice, not the essay, but a decision without its rationale
can be re-litigated.

Options:

- A: summaries; fetch the rationale on demand.
- B: include the rationale for accepted decisions.
- C: include the rationale only for decisions marked `global: true`.

Default: A.

If wrong: token waste or a re-litigated decision.

Answer:

## Tooling and provenance

### Q13. Should tool writes always auto-commit, or batch per facet revision?

Priority: **P1**.

Why it matters: always-commit gives provenance per field but a noisy history; batch gives a
clean history but a larger blast radius per commit.

Options:

- A: always commit, squash at merge.
- B: batch per facet revision, with a `facet commit` command.
- C: always commit for the PM context, batch for the specification and the plan.

Default: A.

If wrong: noise or a lost provenance.

Answer:

### Q14. Should hand-editing be a hard failure from day one?

Priority: **P1**.

Why it matters: a hard deny is the strongest control, but it can block a legitimate repair
during the migration.

Options:

- A: detection and a human import first; a path deny after the pilot.
- B: a hard deny from day one.
- C: detection only, never a deny.

Default: A.

If wrong: a blocked lane or a silent hand edit.


**Owner decision (2026-11-27):** detection first; deny writes after the pilot. A manual
edit is attribution, not prohibition; a broken artifact may be repaired through the repair
path.
Answer:

### Q15. Does the harness support a path-scoped deny for `edit`, `write`, and `read`?

Priority: **P1**.

Why it matters: prevention is stronger than detection. If reads cannot be denied, the bundle
rule relies on instructions and measurement.

Options:

- A: deny `edit` and `write`; reads rely on instructions.
- B: deny all three.
- C: no deny; CI only.

Default: A, with B if the harness supports it.

If wrong: the read path does not change and the token win is lost.

Answer:

### Q16. Should the tool commit be signed?

Priority: **P2**.

Why it matters: a signature proves the committer, not the content. It adds key management and
rotation.

Options:

- A: no; the trailer and the CI check are enough.
- B: sign every artifact commit.
- C: sign the merge commit only.

Default: A, with C if tamper evidence is wanted.

If wrong: complexity without a real gain.

Answer:

### Q17. Should a human import be allowed without a waiver?

Priority: **P2**.

Why it matters: the import is the escape hatch for a review fix; a waiver makes it visible.

Options:

- A: allowed with a recorded waiver.
- B: allowed without a waiver.
- C: not allowed; humans use the typed commands.

Default: A.

If wrong: either friction or a silent edit.

Answer:

## Workflow

### Q18. Should plan-phase completion be a new command?

Priority: **P2**.

Why it matters: the lifecycle has one `delivery` phase; the plan has several phases. A
per-phase completion is what makes the handover and the bundle work.

Options:

- A: `jaiship plan phase complete <ref> --phase P3 --handover <file>`.
- B: reuse `jaiship phase complete` with a `--plan-phase` flag.
- C: no per-phase completion; the handover is recorded separately.

Default: A.

If wrong: a missing handover or a confusing double state.

Answer:

### Q19. Should a handover be required for every phase?

Priority: **P2**.

Why it matters: a handover is the next coder's memory, but a one-phase S change does not need
one.

Options:

- A: required when `handover.required` is true; default true for L, false for S.
- B: required for every phase.
- C: optional everywhere.

Default: A.

If wrong: overhead or a lost context.

Answer:

### Q20. Should a review finding that changes the contract reopen the specification?

Priority: **P2**.

Why it matters: a contract change is not a fix; it is a new decision. Reopening is the honest
path, but it costs a loop.

Options:

- A: yes, with the finding as the gap.
- B: no; the coder fixes it and the reviewer accepts.
- C: the PM decides per finding.

Default: A.

If wrong: a silent contract change or an unnecessary loop.

Answer:

### Q21. Should the readiness gate be able to raise the tier?

Priority: **P2**.

Why it matters: a change that outgrew its tier needs more artifact, not less.

Options:

- A: yes, with a recorded re-tier.
- B: no; the PM decides.
- C: the gate can only fail, not re-tier.

Default: A.

If wrong: a light gate on a risky change.

Answer:

## Parallelism

### Q22. File-level or folder-level conflict granularity?

Priority: **P2**.

Why it matters: file-level is precise but costs plan effort; folder-level is cheap but
over-serializes.

Options:

- A: file-level, with a folder summary.
- B: folder-level.
- C: file-level for writes, folder-level for reads.

Default: A.

If wrong: over-serialization or a missed conflict.

Answer:

### Q23. Should an undeclared path fail the pull-request audit?

Priority: **P2**.

Why it matters: a hard failure catches drift but can block a legitimate fix; a recorded drift
is softer.

Options:

- A: fail for L, record for S and M during the pilot.
- B: fail for every change.
- C: record only.

Default: A.

If wrong: friction or a silent drift.


**Owner decision (2026-11-27):** record and learn. Fail only a path outside the change's
scope or a protected area; the merge authority resolves an ordinary conflict.
Answer:

### Q24. Should read-only contract overlap allow parallel?

Priority: **P2**.

Why it matters: a consumer that does not write the contract can run beside a producer, but it
may need a re-sync.

Options:

- A: yes, with a re-sync note.
- B: no; serialize.
- C: only if the consumer is updated in the same lane.

Default: A.

If wrong: throughput or a stale consumer.

Answer:

## Milestone

### Q25. Who owns the milestone contract?

Priority: **P2**.

Why it matters: the contract is the milestone's shared memory; its owner sets the goals and
the definition of done.

Options:

- A: the PM, with the decision-advisor for the durable decisions.
- B: an architect role.
- C: the CEO.

Default: A.

If wrong: a contract without authority or a bottleneck.


**Owner decision (2026-11-27):** deferred. No milestone contract in this epic; the
specification's `milestone` field is a free-text label.
Answer:

### Q26. Should the milestone verifier be a separate agent?

Priority: **P2**.

Why it matters: independence is the point of goal verification; the PM verifying its own
tickets is not independent.

Options:

- A: a separate verifier, independent of the PM.
- B: the CEO.
- C: the PM.

Default: A.

If wrong: a biased verification.


**Owner decision (2026-11-27):** deferred with the milestone contract.
Answer:

## Migration and metrics

### Q27. Which ticket is the pilot?

Priority: **P1**.

Why it matters: the pilot's evidence is only as good as the ticket's representativeness.

Options:

- A: one M change, not a foundation ticket.
- B: an L change.
- C: an S change.

Default: A.

If wrong: a pilot that proves nothing.

Answer:

### Q28. Is a 20 percent token reduction enough to continue?

Priority: **P1**.

Why it matters: the kill criteria need a number. A 20 percent reduction is a start; the
target is 30 to 40 percent after the bundle iterations.

Options:

- A: 20 percent to continue, 30 to 40 percent to scale.
- B: 30 percent to continue.
- C: any reduction, as long as the miss rate is low.

Default: A.

If wrong: a premature stop or a false success.

Answer:

### Q29. When should the old reader be removed?

Priority: **P2**.

Why it matters: a long dual-read period is a maintenance cost; a short one breaks in-flight
changes.

Options:

- A: after two milestones.
- B: after one milestone.
- C: keep it indefinitely.

Default: A.

If wrong: maintenance or a broken migration.

Answer:

### Q30. What is the budget for building this?

Priority: **P1**.

Why it matters: the pack is a multi-slice product change. The first two slices are small; the
rest is larger.

Options:

- A: slice 0 and slice 1 first, then decide.
- B: all slices in one milestone.
- C: only slice 0.

Default: A.

If wrong: a boil-the-ocean failure or a missed opportunity.


**Owner decision (2026-11-27):** one epic, multiple pull requests, one milestone. Slice 0
and slice 1 first, then slices 2 to 5 tightly sequenced; slice 6 is deferred.
Answer:

## Part 3 and 4 additions

### Q41. How many extension slots should a facet have, and what is the budget?

Priority: **P1**.

Why it matters: the extension slot is the backdoor that keeps the specification from becoming
a rigid form. Too many slots recreate the prose dump; too few remove the rationale.

Options:

- A: at most three slots per facet, 80 words each, with a `useIn` audience or `archive: true`.
- B: one slot per major section, 150 words each.
- C: no limit, but every slot must declare an audience.

Default: A.

If wrong: a form with forty textareas, or a specification that cannot explain itself.

Answer:

### Q42. What should the handover prompt say?

Priority: **P1**.

Why it matters: the handover is the next coder's memory. The prompt decides whether it is an
essence or an essay.

Options:

- A: the tool drafts the five fields from the evidence; the coder edits with a three-bullet
  limit per field; the prompt names the fields and the audience (the next coder).
- B: the coder writes the handover from scratch with a template.
- C: the tool generates the handover and the coder only approves it.

Default: A.

If wrong: a missing handover, a prose dump, or a handover that does not match the evidence.

Answer:
