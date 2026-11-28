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

**Answered (2026-11-28):** Size in lines does not classify. A change is classified at intake on three facts: the surface it touches (risk flags), the number of decisions it needs, and the oracle of its repository. Option A's numbers remain only as an escalation tripwire, counted on non-artifact lines, never as a classifier. See `15-classification-and-rounds.md`, sections 1 to 4.

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

**Answered (2026-11-27):** Yes. Slimmer versions for S changes, including collapsed phases where it is safe. The contents of each tier still need review; every tier keeps acceptance criteria, tests, a review, the gates, the DoD, the pull request, and provenance.

**Contents (2026-11-28):** Only the light shape collapses. It is one contract card written by the PM at intake, a tool preflight, one reviewer, the gates, the DoD and the pull request. Every other shape uses the same single contract, grown with a decision log and phases, plus an adversarial reader before coding and a review aimed at the risk. The test plan and the plan are sections of the contract, not separate artifacts. See `15-classification-and-rounds.md`, sections 3 and 5.

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

**Answered (2026-11-27):** Hybrid: a typed contract plus declared free-text extension fields, used where useful and skipped where not. The backdoor is a declared slot with an audience and a budget.

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

**Partially answered (2026-11-27):** in the same artifact as declared extension fields; no separate prose file by default. A separate rationale file remains an L-tier option.

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

Answer: to be honest I'm not sure if having strict budgets is proper way to go - the budget would strongly depend on the size of the change. We cannot make it fixed (and this issue works both ways - for small change having a context budget too high would be a poetential waste). What I really think is that we should encode ruels that we put there only things that are really relevant for effective dleivery, we avoid fluff, filler words, we avoid repeating same information in multiple context etc. I really like this test: "would removing this word/phrase/sentence reduce accuracy/value/content of the artifact? if no then it can be removed". In other words we should aim for as small artifacts as possible but not smaller. And this applies to everything we store: ticket content/descriptions/comments, to the specs docs, architectures etc. I'm open to re-discuss it and you can try to convince me we should have strict limits but then also explain how to addres a huge change that would just loose if we set strict limit on artifact.

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

Answer: No strong preference here - this should come from the data collected and probably we could adjust it form time to time after we introduce the new structure and tooling and see. We can start with A.

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

**Answered (2026-11-28):** The reviewer's bundle carries the contract sections that frame the diff (goal, acceptance criteria, the oracle with its commands and expected outputs, decisions, risk flags); the diff is read from git. The reviewer reproduces, mutates and tries to break; it does not check the template. Findings about wording or format never earn another round. See `15-classification-and-rounds.md`, sections 5 and 6.

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

Answer: Let's think about it. My gut's feeling is that giving explanation on why we want to do something increases judgement and output quality. But do we have to explain all the alternatives that were rejected with reasoning? probably not (unless this is relevant for delivery or if providing this rationale would change a way how delivery is done). So seems we end up with option A?

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

**Answered (2026-11-27):** Always commit. The tool commits are the audit trail; the squash merge is the one commit per change.

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
Answer:

**Answered (2026-11-27):** Detection first; deny writes after the pilot. A manual edit is attribution, not prohibition; a broken artifact may be repaired through the repair path.

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

**Answered (2026-11-27):** Invisible by default: instruct agents to use the tool, do not share the artifact location, detect bypasses. No hard read deny; add a write deny later if accidental edits show.

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

**Answered (2026-11-27):** Not a prerequisite. The commit trailer plus the CI check is enough; signing is optional.

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

**Answered (2026-11-28):** Yes, a dedicated command, and it covers steps as well as phases
(`step done <ref> P2-S3`). It records an event and never edits the contract; the state is a
fold over the events. At a phase boundary the handover is its argument. See
`15-classification-and-rounds.md`, section 7.

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

**Partially answered (2026-11-27):** the handover is the essence. Required when the next phase needs it; default true for M and L, false for S.

**Confirmed (2026-11-28):** A handover is required whenever the next phase runs in a fresh session, so never in a one-phase change. It is the only carrier of cross-phase facts: what changed and what the next phase must adjust to. It carries evidence references, not evidence bodies.

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

**Answered (2026-11-28):** Yes, as a new revision of the contract with the finding as the reason. Only the forward-useful sections are updated; no retroactive document is written for work already done.

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

**Answered (2026-11-28):** Yes. Any gate can add a risk flag or move a change to the heavier shape, and nothing is de-escalated without a recorded decision. Escalation keys on the finding's category and materiality (design, contract, security, data, code), never on a severity word alone.

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
Answer:

**Answered (2026-11-27):** Record and learn. Fail only a path outside the change's scope or a protected area; the merge authority resolves an ordinary conflict.

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
Answer:

**Answered (2026-11-27):** Deferred. No milestone contract in this epic; milestones are planned in free text.

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
Answer:

**Answered (2026-11-27):** Deferred with the milestone contract.

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

Answer: I'm bit confused here - if we're talknig about testing the approach on pilot tickets then from my perspective we should pilot at least on one change of each size and then re-valuate/tune (or for next 10-20 changes of different size make constant re-evaluation/retro/tuning after each change). 

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

Answer: yeah, 20 % is good starte but I think this tuning process will never change. I'll do periodical retrospectives on all the products that I'm developing using Jaiship and tune whenrever I find some inefficiencies or figure out better way of operations. 

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
Answer: To naswer I'd need to understand what is included in each slice -> could you break it down into some sort of roadmap proposal/initial tickets breakdown (each ticket should deliver value alone even if we'd stop on it and park delivery of remaining tickets from this change). Think hard and carefully on how to break it down. In general I'm ok if we break it ito only 1-3 tickets if we see that it makes no sense to deliver only part of the changes. I'd say there is no strict budget - we con work on all the required changes - the only constraint is time and return of investment (and ai/token costs to some extent but I guess if we see it's worth doing then I can pay for hte required tokens unless it takes more than 1000USD etc - then it's worth rethinging for sure).

**Partially answered (2026-11-27):** delivery shape is one epic, multiple pull requests, one milestone; slice 0 and slice 1 first, then slices 2 to 5. The budget itself is still open.

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

**Partially answered (2026-11-27):** declared extension fields with `useIn`; the count and budget still need confirmation. The default is at most three slots per facet and 80 words each.

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

Answer: I think there is no one answer, or I don't see one answer. I would leave it to the judgment of the coder AI agent. So basically, the coder knows what is relevant in a given context and it should decide what to put there. Of course, it should not put obvious things and not things that are already in the delivery plan in the next phases, right? So it should only put there what is relevant in the context of the next phase delivery that is not yet documented, maybe something changed during delivery, etc. So I would leave this to the judgment of the Coder AI.

And of course, if the tool could supplement it by something that we can, by automation, figure out, maybe list of the files changed in the last phase, things like that could also maybe benefit. 

**Partially answered (2026-11-27):** the tool drafts the five fields from the evidence; the coder edits with a three-bullet limit per field. The exact prompt wording is still open.
## Part 5 additions

These came out of the review on 2026-11-28; see `15-classification-and-rounds.md`.

### Q43. Which risk flags form the starter set, and where is the surface map declared?

Priority: **P1**.

Why it matters: the flags decide the add-ons. A flag that fires on wording puts ceremony on
harness and documentation work; a missing flag lets a risky change through the light shape.

Options:

- A: the eight flags of section 15 (security, data, contract, irreversible,
  environment-bound, first-of-a-kind, thin-coverage, protected-path), each declared in the
  repository's configuration as path patterns.
- B: a shorter set of four (security, data, contract, environment-bound), adding the others
  from evidence.
- C: flags from ticket labels only.

Default: A.

If wrong: ceremony on the wrong changes, or a light gate on a risky one.

Answer: A is ok for me. so we could define path patterns by repo and ceo/pm(other?) could maintain it, improve as retros discover discrepancies etc. on top of it PM would be able to decide case by case if thes flag should be triggered for given change. Offcourse the tickets could be flagged by the cerator as well even before PM touches the change. 

### Q44. Are the round rules and the ceilings right?

Priority: **P1**.

Why it matters: the round rule decides most of the review cost, and the wrong ceiling either
pays for rounds without findings or cuts off a real disagreement.

Options:

- A: as in section 15: a further round only after a substantial round (one with a material
  finding); ceilings of two rounds for a small change and three for a large one (three or
  more phases, or two or more flags); past the ceiling the PM or the CEO decides.
- B: fixed ceilings of two and three, whatever the previous round found.
- C: a fixed ceiling of two for every change.

Default: A.

If wrong: review rounds that find nothing, or a disagreement ended too early.

Answer: I'm in favour of A with liberty of PM/CEO of overriding the limit in specific cases (huge changes, substantial findings in last review etc). 

### Q45. Where does evidence live?

Priority: **P2**.

Why it matters: gate outputs, logs and screenshots are large. In a tracked change folder every
agent can read them, and in the study such files made some folders tens of thousands of lines.

Options:

- A: a tool-managed store outside the tracked tree, referenced by hash or URL from events and
  handovers.
- B: a tool-owned subfolder of the change folder, excluded from every bundle.
- C: wherever the agent that produced it chose to put it.

Default: A.

If wrong: large folders and read amplification, or evidence that an audit cannot find.

Answer:

### Q46. May the study's figures be cited in this public pack?

Priority: **P2**.

Why it matters: the rules in section 15 come from a study of private repositories. The pack's
boundary allows only figures that are already public.

Options:

- A: keep every figure out. Section 15 states the reasoning, and the evidence note stays
  local.
- B: add an anonymized evidence note with counts and ratios, without names, paths or ticket
  references.
- C: publish the study method and script, without figures.

Default: A.

If wrong: a boundary breach, or a design whose evidence nobody can check.

Answer:
