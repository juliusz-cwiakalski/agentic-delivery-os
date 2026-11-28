---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/planning/concepts/structured-change-artifacts/18-delivery-study.md
---
# 18. Evidence: the delivery study behind sections 15 to 17

Status: **Evidence note** (2026-11-28), revised after the critique; decision 28 governs it.
The owner agreed that figures from his private repositories may be published (Q46). Names,
ticket references and paths stay out; repository types and counts stay.

## Method

- **Repositories.** Eight private product repositories: four services, a web client, an
  end-to-end test repository, a design system and a CI repository.
- **History.** First-parent commits of the integration branch, grouped by ticket (subject
  first, then body). Diff lines exclude the change's own artifacts, lockfiles, build output and
  agent configuration.
- **Artifacts.** The files of each change folder, classified by keyword, whatever their naming.
- **Ledgers.** Tier, phase windows, rounds, verdicts and findings, read with a tolerant parser;
  every filter and what it set aside is reported.
- **Depth.** Six reading passes over about 90 changes, chosen on purpose: changes with failed
  readiness rounds, small changes sent to the heavy shape by a risk rule, the lightest changes,
  reviews in the light shape, repositories that are not services, and older eras. Each catch
  was classified by hand with a category and a materiality.
- **Period.** A tier policy was in force from 2026-09-06: a light shape with one note and a
  scoped review, against the full lifecycle. Of 538 ticketed changes, 429 fall in that period
  and 386 have a ledger. The main tables use that period. Earlier ledgers were stubs without
  readiness or review evidence.

## Limits

- Minutes are estimates: 64 to 76 percent of ledger timestamps sit on five-minute boundaries.
- Tokens were never recorded. Sessions were recorded in 27 of 581 ledgers.
- Severity word counts were unreliable and are not used. The categories below were assigned by
  reading.
- The samples were not random. The study is descriptive, not a controlled experiment.

## Cost by shape (medians, 386 ledgers)

| | Light | Full |
|---|---|---|
| Changes | 124 | 249 |
| Product lines | 174 | 2,339 |
| Artifact lines | 461 | 3,470 |
| Of which test plan, plan, specification | 0 | 1,053, 904, 514 |
| Active minutes | 79 | 272 |
| Scope to readiness, share of active minutes | 32% | 47% |
| At least one failed readiness round | 1 change | 59%; among small changes sent there by a risk rule, 19 of 37 |
| Three or more readiness rounds | 1% | 31% |
| Two or more review rounds | 21% | 49% |
| Review failed at least once | 10% | 29% |
| Sessions, where recorded | 1 | 9 |

Small changes, at most 1k product lines:

| Group | Changes | Product lines | Artifact lines | Active minutes | Changes with a failed readiness round |
|---|---:|---:|---:|---:|---:|
| Light | 108 | 145 | 452 | 77 | 0 |
| Full, sent there by a risk rule | 37 | 419 | 2,338 | 173 | 19 |
| Full, sent there by size | 5 | 215 | 2,230 | 143 | 2 |

A light change costs about 70 to 110 active minutes whatever its size. A full change costs 129
minutes at 100 lines and 370 above 10k. The comparison of light with full small changes is
confounded by the selection (see Reconciliation).

## Population

- Kinds of 538 ticketed changes: fix 200, feature 172, docs 84, chore 34, test, performance and
  refactor 28, CI and build 18.
- A third of the changes are at or below 300 product lines; half at or below 1k.
- In five of the eight repositories, 19 to 59 percent of commits carry no ticket.
- Fixes failed readiness most often (69 percent). Features failed review most often (34
  percent).

## What the readers caught

Readiness: 12 changes with failed rounds, 70 blocking findings over 34 rounds.

| Category | Findings | Material |
|---|---:|---:|
| Design | 22 | 17 |
| Coverage | 22 | 8 |
| Fact | 9 | 5 |
| Format | 14 | 2 |
| Environment | 3 | 1 |
| Process | 4 | 2 |

- 33 findings (47 percent) and 19 rounds (56 percent) were checkable by a tool before the gate.
- Six rounds ended with cosmetic findings only.
- Readiness changed what was built in 8 of the 12 changes.

Small changes sent to the full shape by a risk rule, 13 changes: 16 material catches in design,
6 in environment, 6 in coverage, 4 as false facts, 4 in code, 3 in security, none in format or
process. The front half earned its cost in 10 of the 13, each time through a second reader
disagreeing with the first.

Review in the light shape, 12 changes, 57 findings: 21 material (coverage 6, code 6, fact 5,
format 2, security 1, environment 1). In 25 changes with a trial block, the review caught 19
defects in 13 changes, the light readiness check 3, the gates 4. All five escalations from light
to full were triggered by the reviewer.

## What escaped

- About 2 percent of first-parent commits repair earlier work, concentrated in CI and deploy
  plumbing.
- Of six examined escapes, five came from changes that ran the full shape. The causes were where
  the gate looked: a test that assumed the branch is not the integration branch, a local gate
  that cannot see CI, a JVM test suite against a native image.
- A mutation battery of 28 faults matched three review rounds at a lower cost.
- One repository worked without the lifecycle. It showed no recorded gate failure and the most
  visible escaped defects.

## Where the time goes in a light change

- Writing the note takes 0 to 30 minutes, the gates up to 85, the review and its re-review up to
  155.
- The first hour is diagnosis. Where the ticket already carried it, the time to a ready note
  fell to 15 to 20 minutes.
- About 100 of 220 note lines were load-bearing. The requirements comparison was cited by 2 of
  17 reviewers.
- In four light changes the note itself broke the repository's formatter.

## Reconciliation

- The 386 ledgers of the period are 124 light, 249 full, 4 in the documents-only tier, 8
  without a tier and 1 with a tier value that could not be read.
- The small-change table shows 150 of the 172 small changes of the period. The other 22 are
  2 light changes without a rule, 18 full changes sent there by another rule and 2 without a
  tier.
- Of the 429 changes in the period, 43 have no ledger: their repositories worked without the
  lifecycle.
- The 27 ledgers with sessions are counted over the 581 ledger files of all periods, not over
  the 386 of the period.
- The readiness findings are about 70; the category rows, assigned by hand, sum to 74.
- The 59 percent is the share of all full changes with a failed readiness round. Among the 37
  small changes sent to the full shape by a risk rule, 19 had one: a share of 27 to 51
  percent, as a population bound.
- The comparison of minutes between light and full small changes is confounded by the
  selection: the light changes were also smaller (145 against 419 product lines), so it
  measures the rule that sorted them as much as the shape.

The large example of `10-evidence.md` is not in these tables. Its merged diff is 129 files,
about 12.6k inserted lines and 383 deleted; the ratios in sections 01 and 10 were measured
before its final commit.

## What the study does not show

- Which agent topology is best. The repositories used one.
- The value of a second review round in isolation. Rounds were not classified one by one.
- Anything about tokens.
